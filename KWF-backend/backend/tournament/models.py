from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models


class Tatami(models.Model):
    name = models.CharField(max_length=50)
    order = models.PositiveIntegerField()

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return self.name


class Athlete(models.Model):
    GENDER_MALE = "male"
    GENDER_FEMALE = "female"
    GENDER_CHOICES = [
        (GENDER_MALE, "Мальчик"),
        (GENDER_FEMALE, "Девочка"),
    ]

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    birth_date = models.DateField()
    weight = models.DecimalField(max_digits=5, decimal_places=2)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    height = models.DecimalField(
        max_digits=5, decimal_places=2, blank=True, null=True
    )
    trainer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="athletes",
        limit_choices_to={"profile__role": "trainer"},
    )
    club = models.CharField(max_length=200, blank=True)
    # Код-приглашение для безопасной привязки родителя.
    # Выдаётся тренером; знание кода = согласие тренера на связь.
    # Уникален среди выданных (NULL = не выдавался, в уникальности не участвует).
    link_code = models.CharField(max_length=32, unique=True, null=True, blank=True, default=None)

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.last_name} {self.first_name}"

    @property
    def age(self):
        from datetime import date

        today = date.today()
        return (
            today.year
            - self.birth_date.year
            - (
                (today.month, today.day)
                < (self.birth_date.month, self.birth_date.day)
            )
        )

    @property
    def age_display(self):
        a = self.age
        if a % 10 == 1 and a % 100 != 11:
            return f"{a} год"
        elif 2 <= a % 10 <= 4 and not (12 <= a % 100 <= 14):
            return f"{a} года"
        else:
            return f"{a} лет"


class Tournament(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_PUBLISHED = "published"
    STATUS_FINISHED = "finished"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Черновик"),
        (STATUS_PUBLISHED, "Опубликован"),
        (STATUS_FINISHED, "Завершён"),
    ]

    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, max_length=200)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True, default="")
    start_date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    end_date = models.DateField()
    end_time = models.TimeField(null=True, blank=True)
    mats_count = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_tournaments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    @property
    def is_published(self):
        return self.status == self.STATUS_PUBLISHED


class TournamentCategory(models.Model):
    GENDER_MALE = "male"
    GENDER_FEMALE = "female"
    GENDER_ANY = "any"
    GENDER_CHOICES = [
        (GENDER_MALE, "Мальчики"),
        (GENDER_FEMALE, "Девочки"),
        (GENDER_ANY, "Любые"),
    ]

    tournament = models.ForeignKey(
        Tournament,
        on_delete=models.CASCADE,
        related_name="categories",
    )
    name = models.CharField(max_length=200)
    age_min = models.PositiveIntegerField()
    age_max = models.PositiveIntegerField()
    weight_max = models.DecimalField(
        max_digits=5, decimal_places=2, validators=[MinValueValidator(1)]
    )
    gender = models.CharField(
        max_length=10,
        choices=GENDER_CHOICES,
        default=GENDER_ANY,
    )
    athletes = models.ManyToManyField(
        Athlete,
        related_name="tournament_categories",
        blank=True,
    )
    order = models.PositiveIntegerField(default=0)
    # Шаблон длительности боя категории в секундах (таймер live-боёв).
    match_duration = models.PositiveIntegerField(
        default=120, validators=[MinValueValidator(1)]
    )
    # Привязка категории к татами для параллельного проведения.
    # Назначается автобалансом или вручную; бои категории наследуют её.
    tatami = models.ForeignKey(
        Tatami,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="categories",
    )

    class Meta:
        ordering = ["tournament", "order"]
        unique_together = ["tournament", "name"]

    def clean(self):
        if (
            self.age_min is not None
            and self.age_max is not None
            and self.age_min > self.age_max
        ):
            raise ValidationError(
                {"age_min": "Минимальный возраст не может быть больше максимального."}
            )

    def __str__(self):
        return f"{self.tournament.name} — {self.name}"

    def candidate_athletes(self):
        """ Возвращает атлетов, подходящих по полу и возрасту, а также их соответствие весу. """
        from datetime import date

        today = date.today()
        # Рассчитываем годы рождения на основе возраста
        # age_min: 12 лет -> родился не позже today.year - 12
        # age_max: 13 лет -> родился не раньше today.year - 13
        birth_year_max = today.year - self.age_min
        birth_year_min = today.year - self.age_max

        qs = Athlete.objects.filter(
            birth_date__year__lte=birth_year_max,
            birth_date__year__gte=birth_year_min,
        )

        if self.gender != self.GENDER_ANY:
            qs = qs.filter(gender=self.gender)

        return qs


class Round(models.Model):
    """Раунд турнира (1/8, 1/4, 1/2, финал и т.д.)."""
    STATUS_WAITING = "waiting"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_FINISHED = "finished"

    STATUS_CHOICES = [
        (STATUS_WAITING, "Ожидает"),
        (STATUS_IN_PROGRESS, "Идёт"),
        (STATUS_FINISHED, "Завершён"),
    ]

    category = models.ForeignKey(
        TournamentCategory,
        on_delete=models.CASCADE,
        related_name="rounds",
    )
    name = models.CharField(max_length=100)
    order = models.PositiveIntegerField()
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_WAITING,
    )

    class Meta:
        ordering = ["category", "order"]
        unique_together = ["category", "order"]

    def __str__(self):
        return f"{self.category.name} — {self.name}"


class Match(models.Model):
    STATUS_WAITING = "waiting"
    STATUS_READY = "ready"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_PAUSED = "paused"
    STATUS_FINISHED = "finished"
    STATUS_BYE = "bye"

    STATUS_CHOICES = [
        (STATUS_WAITING, "Ожидается"),
        (STATUS_READY, "Готов"),
        (STATUS_IN_PROGRESS, "Бой идёт"),
        (STATUS_PAUSED, "Пауза"),
        (STATUS_FINISHED, "Завершён"),
        (STATUS_BYE, "Автопроход"),
    ]

    round = models.ForeignKey(
        Round,
        on_delete=models.CASCADE,
        related_name="matches",
    )
    match_number = models.PositiveIntegerField()

    athlete1 = models.ForeignKey(
        Athlete,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matches_as_athlete1",
    )

    athlete2 = models.ForeignKey(
        Athlete,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matches_as_athlete2",
    )

    score1 = models.PositiveIntegerField(default=0)
    score2 = models.PositiveIntegerField(default=0)

    winner = models.ForeignKey(
        Athlete,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="won_matches",
    )

    tatami = models.ForeignKey(
        Tatami,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matches",
    )

    fight_number = models.PositiveIntegerField(default=0)
    scheduled_time = models.DateTimeField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    round_number = models.PositiveIntegerField(default=1)

    # Состояние таймера боя (устойчиво к reload: всё хранится в БД).
    # duration_seconds — лимит боя, фиксируется при первом старте из категории.
    # started_at — момент (пере)запуска; accumulated_seconds — набежавшее ранее.
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    accumulated_seconds = models.PositiveIntegerField(default=0)

    # Из каких матчей пришли участники
    previous_match1 = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="next_matches_as_first",
    )

    previous_match2 = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="next_matches_as_second",
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_WAITING,
    )

    class Meta:
        ordering = ["round__order", "match_number"]
        unique_together = ["round", "match_number"]

    def __str__(self):
        return f"{self.round.name} — Матч {self.match_number}"


class MatchActionLog(models.Model):
    """Журнал действий судьи по бою: кто и когда стартовал/завершил/переоткрыл.

    Нужен для разбора спорных боёв. Записи только добавляются, API — read-only.
    """

    ACTION_START = "start"
    ACTION_PAUSE = "pause"
    ACTION_RESUME = "resume"
    ACTION_FINISH = "finish"
    ACTION_REOPEN = "reopen"
    ACTION_TATAMI = "tatami"

    ACTION_CHOICES = [
        (ACTION_START, "Старт"),
        (ACTION_PAUSE, "Пауза"),
        (ACTION_RESUME, "Продолжение"),
        (ACTION_FINISH, "Финиш"),
        (ACTION_REOPEN, "Переоткрытие"),
        (ACTION_TATAMI, "Назначение татами"),
    ]

    match = models.ForeignKey(
        Match,
        on_delete=models.CASCADE,
        related_name="action_logs",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="match_actions",
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    winner = models.ForeignKey(
        Athlete,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="logged_wins",
    )
    score1 = models.PositiveIntegerField(null=True, blank=True)
    score2 = models.PositiveIntegerField(null=True, blank=True)
    detail = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"Матч {self.match_id} — {self.action}"


class TournamentEvent(models.Model):
    """Персистентный журнал событий турнира для realtime-синхронизации.

    Одно событие на один мутирующий запрос (не на внутренний шаг).
    Клиенты опрашивают `events/?after=<last_id>` и тихо перезапрашивают
    затронутые представления — merge payload'ов нет, source of truth — БД.
    Записи только добавляются, API — read-only.
    """

    # Бои
    MATCH_STARTED = "match.started"
    MATCH_PAUSED = "match.paused"
    MATCH_RESUMED = "match.resumed"
    MATCH_FINISHED = "match.finished"
    MATCH_REOPENED = "match.reopened"
    MATCH_TATAMI = "match.tatami"
    # Раунды
    ROUND_STARTED = "round.started"
    ROUND_FINISHED = "round.finished"
    # Категории
    CATEGORY_MEMBERS = "category.members"
    CATEGORY_BRACKET = "category.bracket"
    # Турнир
    TOURNAMENT_UPDATED = "tournament.updated"

    TYPE_CHOICES = [
        (MATCH_STARTED, "Бой стартовал"),
        (MATCH_PAUSED, "Бой на паузе"),
        (MATCH_RESUMED, "Бой продолжен"),
        (MATCH_FINISHED, "Бой завершён"),
        (MATCH_REOPENED, "Бой переоткрыт"),
        (MATCH_TATAMI, "Татами назначено"),
        (ROUND_STARTED, "Раунд стартовал"),
        (ROUND_FINISHED, "Раунд завершён"),
        (CATEGORY_MEMBERS, "Состав категории"),
        (CATEGORY_BRACKET, "Сетка построена"),
        (TOURNAMENT_UPDATED, "Турнир обновлён"),
    ]

    tournament = models.ForeignKey(
        Tournament,
        on_delete=models.CASCADE,
        related_name="events",
    )
    type = models.CharField(max_length=32, choices=TYPE_CHOICES)
    match = models.ForeignKey(
        Match,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="sync_events",
    )
    round = models.ForeignKey(
        Round,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="sync_events",
    )
    category = models.ForeignKey(
        TournamentCategory,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="sync_events",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tournament_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(fields=["tournament", "id"]),
        ]

    def __str__(self):
        return f"Турнир {self.tournament_id} — {self.type} #{self.id}"


class TournamentRegistration(models.Model):
    tournament = models.ForeignKey(
        Tournament,
        on_delete=models.CASCADE,
        related_name="registrations",
    )
    athlete = models.ForeignKey(
        Athlete,
        on_delete=models.CASCADE,
        related_name="registrations",
    )
    registered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["tournament", "athlete"]

    def __str__(self):
        return f"{self.athlete} in {self.tournament}"


class ParentChildLink(models.Model):
    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="child_links",
    )
    athlete = models.ForeignKey(
        Athlete,
        on_delete=models.CASCADE,
        related_name="parent_links",
    )
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["parent", "athlete"]

    def __str__(self):
        return f"{self.parent} -> {self.athlete}"
