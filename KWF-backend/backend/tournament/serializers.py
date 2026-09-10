from datetime import date

from rest_framework import serializers
from .models import (
    Tatami,
    Athlete,
    Tournament,
    TournamentCategory,
    Round,
    Match,
    MatchActionLog,
    TournamentEvent,
)


class TatamiSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tatami
        fields = ["id", "name", "order"]


class AthleteSerializer(serializers.ModelSerializer):
    age = serializers.IntegerField(read_only=True)
    trainer = serializers.PrimaryKeyRelatedField(read_only=True)

    def validate_first_name(self, value):
        value = (value or "").strip()
        if len(value) < 2:
            raise serializers.ValidationError("Укажите настоящее имя (минимум 2 символа).")
        return value

    def validate_last_name(self, value):
        value = (value or "").strip()
        if len(value) < 2:
            raise serializers.ValidationError("Укажите настоящую фамилию (минимум 2 символа).")
        return value

    def validate_birth_date(self, value):
        if value and value > date.today():
            raise serializers.ValidationError("Дата рождения не может быть в будущем.")
        return value

    def validate_weight(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Вес должен быть положительным числом.")
        return value

    def validate_height(self, value):
        # HTML-формы присылают пустую строку для необязательного роста.
        if value in ("", None):
            return None
        if value <= 0:
            raise serializers.ValidationError("Рост должен быть положительным числом.")
        return value

    class Meta:
        model = Athlete
        fields = [
            "id",
            "first_name",
            "last_name",
            "birth_date",
            "weight",
            "height",
            "gender",
            "club",
            "trainer",
            "age",
            "link_code",
        ]
        read_only_fields = ["age", "link_code", "trainer"]


class MatchSerializer(serializers.ModelSerializer):
    athlete1_name = serializers.SerializerMethodField()
    athlete2_name = serializers.SerializerMethodField()
    winner_name = serializers.SerializerMethodField()
    round_name = serializers.CharField(source="round.name", read_only=True)
    round_order = serializers.IntegerField(source="round.order", read_only=True)
    category = serializers.IntegerField(
        source="round.category_id", read_only=True
    )
    category_name = serializers.CharField(
        source="round.category.name", read_only=True
    )
    tatami_name = serializers.CharField(
        source="tatami.name", read_only=True
    )
    remaining_seconds = serializers.SerializerMethodField()
    timer_running = serializers.SerializerMethodField()
    timer_expired = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = [
            "id",
            "round",
            "round_name",
            "round_order",
            "category",
            "category_name",
            "match_number",
            "athlete1",
            "athlete1_name",
            "athlete2",
            "athlete2_name",
            "score1",
            "score2",
            "winner",
            "winner_name",
            "tatami",
            "tatami_name",
            "fight_number",
            "previous_match1",
            "previous_match2",
            "start_time",
            "end_time",
            "duration_seconds",
            "started_at",
            "accumulated_seconds",
            "remaining_seconds",
            "timer_running",
            "timer_expired",
            "status",
        ]

    def get_athlete1_name(self, obj):
        if not obj.athlete1:
            return None
        return f"{obj.athlete1.last_name} {obj.athlete1.first_name}"

    def get_athlete2_name(self, obj):
        if not obj.athlete2:
            return None
        return f"{obj.athlete2.last_name} {obj.athlete2.first_name}"

    def get_winner_name(self, obj):
        if not obj.winner:
            return None
        return f"{obj.winner.last_name} {obj.winner.first_name}"

    def get_remaining_seconds(self, obj):
        cached = getattr(obj, "_cached_timer_state", None)
        if cached is None:
            from .services import match_timer_state

            cached = match_timer_state(obj)
            obj._cached_timer_state = cached
        return cached["remaining_seconds"]

    def get_timer_running(self, obj):
        # Переиспользуем уже посчитанное состояние, если сериализатор
        # вызывается в контексте списка (см. to_representation ниже).
        cached = getattr(obj, "_cached_timer_state", None)
        if cached is None:
            from .services import match_timer_state

            cached = match_timer_state(obj)
            obj._cached_timer_state = cached
        return cached["running"]

    def get_timer_expired(self, obj):
        cached = getattr(obj, "_cached_timer_state", None)
        if cached is None:
            from .services import match_timer_state

            cached = match_timer_state(obj)
            obj._cached_timer_state = cached
        return cached["expired"]

    def to_representation(self, instance):
        from .services import match_timer_state

        # Один расчёт таймера на матч вместо трёх.
        instance._cached_timer_state = match_timer_state(instance)
        try:
            return super().to_representation(instance)
        finally:
            try:
                delattr(instance, "_cached_timer_state")
            except AttributeError:
                pass

    def validate(self, attrs):
        winner = attrs.get("winner", getattr(self.instance, "winner", None))
        a1 = attrs.get("athlete1", getattr(self.instance, "athlete1", None))
        a2 = attrs.get("athlete2", getattr(self.instance, "athlete2", None))
        winner_id = winner.id if hasattr(winner, "id") else winner
        a1_id = a1.id if hasattr(a1, "id") else a1
        a2_id = a2.id if hasattr(a2, "id") else a2
        if winner_id and winner_id not in (a1_id, a2_id):
            raise serializers.ValidationError(
                {"winner": "Победитель должен быть участником боя."}
            )
        return attrs


class MatchActionLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    winner_name = serializers.SerializerMethodField()

    class Meta:
        model = MatchActionLog
        fields = [
            "id",
            "match",
            "actor",
            "actor_name",
            "action",
            "winner",
            "winner_name",
            "score1",
            "score2",
            "detail",
            "created_at",
        ]
        read_only_fields = fields

    def get_actor_name(self, obj):
        return obj.actor.username if obj.actor else None

    def get_winner_name(self, obj):
        if not obj.winner:
            return None
        return f"{obj.winner.last_name} {obj.winner.first_name}"


class TournamentEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = TournamentEvent
        fields = [
            "id",
            "tournament",
            "type",
            "match",
            "round",
            "category",
            "actor",
            "created_at",
        ]
        read_only_fields = fields


class RoundSerializer(serializers.ModelSerializer):
    matches = MatchSerializer(many=True, read_only=True)

    class Meta:
        model = Round
        fields = [
            "id",
            "category",
            "name",
            "order",
            "status",
            "matches",
        ]


class TournamentCategorySerializer(serializers.ModelSerializer):
    athletes = AthleteSerializer(many=True, read_only=True)
    rounds = RoundSerializer(many=True, read_only=True)
    generate_url = serializers.SerializerMethodField()
    tatami_name = serializers.CharField(
        source="tatami.name", read_only=True
    )

    def validate(self, attrs):
        age_min = attrs.get("age_min", getattr(self.instance, "age_min", None))
        age_max = attrs.get("age_max", getattr(self.instance, "age_max", None))
        if age_min is not None and age_max is not None and age_min > age_max:
            raise serializers.ValidationError(
                {"age_min": "Минимальный возраст не может быть больше максимального."}
            )
        duration = attrs.get(
            "match_duration", getattr(self.instance, "match_duration", None)
        )
        if duration is not None and duration <= 0:
            raise serializers.ValidationError(
                {"match_duration": "Длительность боя должна быть положительной."}
            )
        return attrs

    class Meta:
        model = TournamentCategory
        fields = [
            "id",
            "tournament",
            "name",
            "age_min",
            "age_max",
            "weight_max",
            "gender",
            "order",
            "match_duration",
            "tatami",
            "tatami_name",
            "athletes",
            "rounds",
            "generate_url",
        ]

    def get_generate_url(self, obj):
        request = self.context.get("request")
        if request:
            try:
                from django.urls import reverse

                path = reverse(
                    "tournamentcategory-generate-bracket", args=[obj.pk]
                )
                return request.build_absolute_uri(path)
            except Exception:
                pass
            return request.build_absolute_uri(
                f"/api/tournament/categories/{obj.id}/generate_bracket/"
            )
        return None


class TournamentListSerializer(serializers.ModelSerializer):
    """Лёгкий сериализатор для списка: без вложенных категорий/сетки."""

    categories_count = serializers.IntegerField(read_only=True)
    created_by = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = Tournament
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "location",
            "start_date",
            "start_time",
            "end_date",
            "end_time",
            "mats_count",
            "status",
            "created_at",
            "categories_count",
            "created_by",
        ]


class TournamentSerializer(serializers.ModelSerializer):
    categories = TournamentCategorySerializer(
        many=True, read_only=True
    )
    created_by = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = Tournament
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "location",
            "start_date",
            "start_time",
            "end_date",
            "end_time",
            "mats_count",
            "status",
            "created_at",
            "categories",
            "created_by",
        ]
