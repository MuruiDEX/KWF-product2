from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model

from .models import (
    Tatami,
    Athlete,
    Tournament,
    TournamentCategory,
    Round,
    Match,
    TournamentRegistration,
    TournamentEvent,
)
from .serializers import (
    TatamiSerializer,
    AthleteSerializer,
    TournamentSerializer,
    TournamentListSerializer,
    TournamentCategorySerializer,
    RoundSerializer,
    MatchSerializer,
    MatchActionLogSerializer,
    TournamentEventSerializer,
)
from .permissions import IsTrainer
from . import services


def _parse_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in ("1", "true", "yes", "y", "on")


def _parse_int(value, field_name="value"):
    from rest_framework.exceptions import ValidationError

    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValidationError({field_name: "Некорректное числовое значение."})


def _require_tournament_owner(tournament, user):
    from rest_framework.exceptions import PermissionDenied

    if user.is_staff:
        return
    if tournament.created_by_id is not None and tournament.created_by_id == user.id:
        return
    raise PermissionDenied("Можно изменять только свои турниры.")


def _require_category_owner(category, user):
    _require_tournament_owner(category.tournament, user)

class StaffWriteMixin:
    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [IsTrainer()]


class TatamiViewSet(StaffWriteMixin, viewsets.ModelViewSet):
    queryset = Tatami.objects.all()
    serializer_class = TatamiSerializer


class AthletelViewSet(viewsets.ModelViewSet):
    serializer_class = AthleteSerializer
    queryset = Athlete.objects.all()

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated()]
        # Создание/изменение/удаление спортсменов — только тренер и staff.
        # Родитель привязывает существующего ребёнка по коду через
        # POST /api/auth/children/link/ и получает 403 здесь.
        # invite имеет собственный permission_classes=[IsTrainer] на action.
        return [IsTrainer()]

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied

        from .permissions import get_user_role, is_trainer_user

        user = self.request.user
        if not is_trainer_user(user):
            raise PermissionDenied(
                "Создавать спортсменов может только тренер. "
                "Родителю нужно привязать существующего ребёнка по коду от тренера."
            )
        if user.is_staff and not get_user_role(user) == "trainer":
            # Staff (админка) создаёт спортсмена с явным указанием тренера.
            trainer_id = self.request.data.get("trainer")
            if trainer_id:
                from django.contrib.auth import get_user_model

                if not get_user_model().objects.filter(pk=trainer_id).exists():
                    from rest_framework.exceptions import ValidationError

                    raise ValidationError({"trainer": "Тренер не найден."})
                athlete = serializer.save(trainer_id=trainer_id)
            else:
                # Без тренера запись невалидна (trainer FK обязателен) —
                # честный 400 вместо IntegrityError.
                from rest_framework.exceptions import ValidationError

                raise ValidationError(
                    {"trainer": "Укажите тренера спортсмена."}
                )
            return athlete
        serializer.save(trainer=user)

    def _check_owner(self, athlete):
        """Тренер меняет только своих спортсменов; staff — любых."""
        from rest_framework.exceptions import PermissionDenied

        user = self.request.user
        if not (user.is_staff or athlete.trainer_id == user.id):
            raise PermissionDenied("Можно изменять только своих спортсменов.")
        return athlete

    def perform_update(self, serializer):
        self._check_owner(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._check_owner(instance)
        instance.delete()

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def invite(self, request, pk=None):
        """Код-приглашение для привязки родителя.

        Только тренер-владелец спортсмена (или staff). Знание кода
        родителем = согласие тренера, отдельное подтверждение не нужно.
        """
        import secrets

        from django.db import IntegrityError
        from rest_framework.exceptions import PermissionDenied

        athlete = self.get_object()
        user = request.user
        if not (user.is_staff or athlete.trainer_id == user.id):
            raise PermissionDenied("Можно приглашать только к своим спортсменам.")
        if not athlete.link_code:
            code = None
            for _ in range(10):
                candidate = secrets.token_hex(6).upper()
                if not Athlete.objects.filter(link_code=candidate).exists():
                    code = candidate
                    break
            if code is None:
                return Response(
                    {"error": "Не удалось сгенерировать код, попробуйте позже."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            athlete.link_code = code
            try:
                athlete.save(update_fields=["link_code"])
            except IntegrityError:
                # Гонка двух параллельных invite с одним кодом.
                athlete.refresh_from_db(fields=["link_code"])
                if not athlete.link_code:
                    return Response(
                        {"error": "Не удалось сгенерировать код, попробуйте позже."},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )
        return Response({"code": athlete.link_code})

    def get_queryset(self):
        from .permissions import get_user_role

        user = self.request.user
        role = get_user_role(user)

        if role == "trainer" or user.is_staff:
            return Athlete.objects.all()
        return Athlete.objects.filter(parent_links__parent=user)


class TournamentViewSet(StaffWriteMixin, viewsets.ModelViewSet):
    queryset = Tournament.objects.prefetch_related(
        "categories",
        "categories__athletes",
        "categories__rounds",
        "categories__rounds__matches",
        "categories__rounds__matches__athlete1",
        "categories__rounds__matches__athlete2",
        "categories__rounds__matches__winner",
        "categories__rounds__matches__tatami",
        "categories__rounds__matches__round__category",
    ).all()
    serializer_class = TournamentSerializer

    def get_serializer_class(self):
        if self.action == "list":
            return TournamentListSerializer
        return TournamentSerializer

    def get_queryset(self):
        from django.db.models import Count

        if self.action == "list":
            qs = Tournament.objects.annotate(categories_count=Count("categories"))
        else:
            qs = Tournament.objects.prefetch_related(
                "categories",
                "categories__athletes",
                "categories__rounds",
                "categories__rounds__matches",
                "categories__rounds__matches__athlete1",
                "categories__rounds__matches__athlete2",
                "categories__rounds__matches__winner",
                "categories__rounds__matches__tatami",
                "categories__rounds__matches__round__category",
            )
        if self.action in ("list", "retrieve"):
            user = self.request.user
            profile_role = getattr(getattr(user, "profile", None), "role", "")
            if (
                user
                and user.is_authenticated
                and (user.is_staff or profile_role == "trainer")
            ):
                return qs.filter(
                    Q(status=Tournament.STATUS_PUBLISHED) | Q(created_by=user)
                )
            return qs.filter(status=Tournament.STATUS_PUBLISHED)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        old_status = self.get_object().status
        tournament = serializer.save()
        if tournament.status != old_status:
            services.emit_event(
                tournament.id,
                TournamentEvent.TOURNAMENT_UPDATED,
                self.request.user,
            )

    def perform_destroy(self, instance):
        from rest_framework.exceptions import PermissionDenied

        user = self.request.user
        if not (user.is_staff or instance.created_by_id == user.id):
            raise PermissionDenied("Можно удалять только свои турниры.")
        instance.delete()

    def get_permissions(self):
        # Расписание и лента событий публичны (черновики отсекаются внутри action).
        if self.action in ("schedule", "events"):
            return [permissions.AllowAny()]
        return super().get_permissions()

    def get_object(self):
        """Находит турнир по slug или по id.

        Публичные страницы используют slug, кабинет — id.
        """
        queryset = self.filter_queryset(self.get_queryset())
        lookup = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        try:
            return queryset.get(slug=lookup)
        except (Tournament.DoesNotExist, ValidationError):
            pass
        return super().get_object()

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def register_athlete(self, request, pk=None):
        from django.db import IntegrityError, transaction

        tournament = self.get_object()
        if tournament.status == Tournament.STATUS_FINISHED:
            return Response(
                {"error": "Турнир завершён — регистрация закрыта."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        athlete_id = request.data.get("athlete_id")
        if not athlete_id:
            return Response({"error": "athlete_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            athlete_pk = int(athlete_id)
        except (TypeError, ValueError):
            return Response(
                {"error": "Некорректный athlete_id."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        athlete = get_object_or_404(Athlete, id=athlete_pk)
        # Тренер регистрирует только своих спортсменов (staff — любых).
        user = request.user
        if not user.is_staff and athlete.trainer_id != user.id:
            return Response({"error": "You can only register your own athletes"}, status=status.HTTP_403_FORBIDDEN)

        try:
            with transaction.atomic():
                reg, created = TournamentRegistration.objects.get_or_create(
                    tournament=tournament,
                    athlete=athlete
                )
        except IntegrityError:
            return Response({"status": "already registered"})
        return Response({"status": "registered" if created else "already registered"})

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def generate_categories(self, request, pk=None):
        tournament = self.get_object()
        _require_tournament_owner(tournament, request.user)
        categories = services.generate_categories(tournament)
        return Response({"status": "categories generated", "count": len(categories)})

    @action(detail=True, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def bracket_state(self, request, pk=None):
        """Returns full bracket state for all categories in tournament."""
        tournament = self.get_object()
        if tournament.status != Tournament.STATUS_PUBLISHED:
            user = request.user
            if not (
                user.is_staff
                or tournament.created_by_id == getattr(user, "id", None)
            ):
                return Response(
                    {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
                )
        categories_data = []
        for cat in tournament.categories.all():
            categories_data.append(services.get_bracket_state(cat))
        return Response({"tournament_id": tournament.id, "categories": categories_data})

    @action(detail=True, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def tatami_queue(self, request, pk=None):
        """Returns tatami queue for tournament."""
        tournament = self.get_object()
        if tournament.status != Tournament.STATUS_PUBLISHED:
            user = request.user
            if not (
                user.is_staff
                or tournament.created_by_id == getattr(user, "id", None)
            ):
                return Response(
                    {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
                )
        result = services.get_tatami_queue(tournament)
        if isinstance(result, list):
            return Response({"queue": [], "recent_finished": []})
        return Response({"queue": result["queue"], "recent_finished": result["recent_finished"]})

    @action(detail=True, methods=["get"], permission_classes=[permissions.AllowAny])
    def schedule(self, request, pk=None):
        """Расписание турнира: очередь категорий, текущая/следующая, татами.

        Категории идут строго по полю order: следующая начинается только
        после завершения предыдущей.
        """
        tournament = self.get_object()
        user = request.user
        if tournament.status != Tournament.STATUS_PUBLISHED:
            is_owner = bool(
                user
                and user.is_authenticated
                and (
                    user.is_staff
                    or tournament.created_by_id == getattr(user, "id", None)
                )
            )
            if not is_owner:
                return Response(
                    {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
                )
        schedule = services.get_category_schedule(tournament)
        cats = [
            {
                "id": entry["category"].id,
                "name": entry["category"].name,
                "order": entry["category"].order,
                "gender": entry["category"].gender,
                "age_min": entry["category"].age_min,
                "age_max": entry["category"].age_max,
                "weight_max": str(entry["category"].weight_max),
                "status": entry["status"],
                "total_matches": entry["total"],
                "finished_matches": entry["finished"],
            }
            for entry in schedule
        ]
        current = next((c for c in cats if c["status"] == "active"), None)
        upcoming = [c for c in cats if c["status"] == "waiting"]
        return Response(
            {
                "tournament_id": tournament.id,
                "name": tournament.name,
                "status": tournament.status,
                "categories": cats,
                "current": current,
                "next": upcoming[0] if upcoming else None,
                "tatamis": services.get_tatami_queue(tournament)["queue"],
            }
        )

    @action(detail=True, methods=["get"], permission_classes=[permissions.AllowAny])
    def events(self, request, pk=None):
        """Realtime-лента турнира: события новее ?after=<id>.

        Видимость — как у самого турнира: опубликованный видят все,
        черновик — только staff/тренер-создатель. Только чтение.
        """
        from .models import TournamentEvent

        tournament = self.get_object()
        user = request.user
        if tournament.status != Tournament.STATUS_PUBLISHED:
            is_owner = bool(
                user
                and user.is_authenticated
                and (
                    user.is_staff
                    or tournament.created_by_id == getattr(user, "id", None)
                )
            )
            if not is_owner:
                return Response(
                    {"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND
                )
        try:
            after = int(request.query_params.get("after", 0))
        except (TypeError, ValueError):
            after = 0
        after = max(0, after)
        events = list(
            TournamentEvent.objects.filter(
                tournament=tournament, id__gt=after
            ).order_by("id")[:200]
        )
        latest = (
            TournamentEvent.objects.filter(tournament=tournament)
            .order_by("-id")
            .values_list("id", flat=True)
            .first()
            or 0
        )
        return Response({
            "events": TournamentEventSerializer(events, many=True).data,
            "latest_id": latest,
        })

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def distribute_categories(self, request, pk=None):
        """Равномерно разложить категории по татами (round-robin, разница ≤ 1).

        Явное действие: перезаписывает привязки и переносит ещё не начатые
        бои. Ручной выбор после этого живёт до следующего запуска.
        """
        tournament = self.get_object()
        _require_tournament_owner(tournament, request.user)
        result = services.distribute_categories_to_tatamis(tournament, actor=request.user)
        if not result.get("success"):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def distribute_tatamis(self, request, pk=None):
        tournament = self.get_object()
        _require_tournament_owner(tournament, request.user)
        result = services.distribute_matches_to_tatamis(tournament)
        if result.get("success"):
            return Response({
                "status": "matches distributed to tatamis",
                "distributed": result.get("distributed", 0),
                "waiting": result.get("waiting", 0),
                "hint": result.get("hint"),
                "category_id": result.get("category_id"),
            })
        return Response({"error": result.get("error", "No matches to distribute")}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def start_match(self, request, pk=None):
        """Start a specific match by ID."""
        from rest_framework.exceptions import ValidationError

        tournament = self.get_object()
        _require_tournament_owner(tournament, request.user)
        match_id = request.data.get("match_id")
        if not match_id:
            return Response({"error": "match_id required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            match_pk = _parse_int(match_id, "match_id")
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        if not Match.objects.filter(
            id=match_pk, round__category__tournament=tournament
        ).exists():
            return Response(
                {"error": "Матч не принадлежит этому турниру."},
                status=status.HTTP_404_NOT_FOUND,
            )
        result = services.start_match(match_pk, actor=request.user)
        if not result.get("success"):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def finish_match(self, request, pk=None):
        """Finish a match with winner and scores."""
        from rest_framework.exceptions import ValidationError

        tournament = self.get_object()
        _require_tournament_owner(tournament, request.user)
        match_id = request.data.get("match_id")
        winner_id = request.data.get("winner_id")
        score1 = request.data.get("score1")
        score2 = request.data.get("score2")

        if not match_id:
            return Response({"error": "match_id required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            match_pk = _parse_int(match_id, "match_id")
            parsed_winner = _parse_int(winner_id, "winner_id") if winner_id not in (None, "") else None
            parsed_s1 = _parse_int(score1, "score1") if score1 not in (None, "") else None
            parsed_s2 = _parse_int(score2, "score2") if score2 not in (None, "") else None
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        if not Match.objects.filter(
            id=match_pk, round__category__tournament=tournament
        ).exists():
            return Response(
                {"error": "Матч не принадлежит этому турниру."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if parsed_winner is not None and not Athlete.objects.filter(id=parsed_winner).exists():
            return Response(
                {"winner_id": "Спортсмен не найден."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = services.finish_match(
            match_pk,
            winner_id=parsed_winner,
            score1=parsed_s1,
            score2=parsed_s2,
            actor=request.user,
        )
        if not result.get("success"):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def set_match_tatami(self, request, pk=None):
        """Assign tatami to a match."""
        from rest_framework.exceptions import ValidationError

        tournament = self.get_object()
        _require_tournament_owner(tournament, request.user)
        match_id = request.data.get("match_id")
        tatami_id = request.data.get("tatami_id")
        if not match_id or not tatami_id:
            return Response({"error": "match_id and tatami_id required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            match_pk = _parse_int(match_id, "match_id")
            tatami_pk = _parse_int(tatami_id, "tatami_id")
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        if not Match.objects.filter(
            id=match_pk, round__category__tournament=tournament
        ).exists():
            return Response(
                {"error": "Матч не принадлежит этому турниру."},
                status=status.HTTP_404_NOT_FOUND,
            )

        result = services.set_match_tatami(
            match_pk, tatami_pk,
            force=_parse_bool(request.data.get("force")), actor=request.user,
        )
        if not result.get("success"):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)


class TournamentCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = TournamentCategorySerializer

    def get_permissions(self):
        # NOTE: DRF вызывает get_permissions, а не permission_classes
        # декоратора @action. Поэтому search_candidates перечислен здесь
        # явно: поиск кандидатов — только тренер/staff (в выдаче есть
        # чужие дети: trainer username, club). Родителю — 403.
        if self.action in ("list", "retrieve", "bracket_state"):
            return [permissions.IsAuthenticated()]
        return [IsTrainer()]

    def perform_create(self, serializer):
        # Новая категория сразу получает наименее загруженное татами.
        # Ручные привязки остальных при этом не трогаем.
        from django.db import transaction

        tournament = serializer.validated_data.get("tournament")
        if tournament is not None:
            _require_tournament_owner(tournament, self.request.user)
        with transaction.atomic():
            category = serializer.save()
            if category.tatami_id is None:
                tatami = services.least_loaded_tatami()
                if tatami is not None:
                    services.apply_category_tatami(category, tatami)

    def perform_update(self, serializer):
        # Ручная смена татами идёт через общий хелпер (переносит
        # только ещё не начатые бои) и больше никем не перезаписывается.
        from django.db import transaction

        instance = serializer.instance
        _require_category_owner(instance, self.request.user)
        new_tatami = serializer.validated_data.get("tatami", None)
        new_tatami_id = new_tatami.id if new_tatami else None
        if "tatami" in serializer.validated_data and new_tatami_id != instance.tatami_id:
            from .models import Tatami

            tatami = Tatami.objects.filter(id=new_tatami_id).first() if new_tatami_id else None
            if new_tatami_id and tatami is None:
                from rest_framework.exceptions import ValidationError

                raise ValidationError({"tatami": "Татами не найдено."})
            services.apply_category_tatami(instance, tatami)
            serializer.validated_data.pop("tatami")
        serializer.save()

    def get_queryset(self):
        user = self.request.user
        qs = TournamentCategory.objects.prefetch_related(
            "athletes",
            "rounds",
        )
        if user.is_staff:
            return qs
        profile_role = getattr(getattr(user, "profile", None), "role", "")
        if profile_role == "trainer":
            return qs.filter(
                Q(tournament__status=Tournament.STATUS_PUBLISHED)
                | Q(tournament__created_by=user)
            )
        return qs.filter(tournament__status=Tournament.STATUS_PUBLISHED)

    @action(detail=False, methods=["get"], permission_classes=[IsTrainer])
    def search_candidates(self, request):
        """
        Search for athletes matching specific criteria.
        Query params: gender, age_min, age_max, weight_max
        """
        gender = request.query_params.get("gender")
        age_min = request.query_params.get("age_min")
        age_max = request.query_params.get("age_max")
        weight_max = request.query_params.get("weight_max")
        as_of = request.query_params.get("date")

        if not all([gender, age_min, age_max, weight_max]):
            return Response({"error": "Missing required parameters"}, status=status.HTTP_400_BAD_REQUEST)

        from datetime import date
        from decimal import Decimal, InvalidOperation
        try:
            today = date.fromisoformat(as_of) if as_of else date.today()
        except ValueError:
            return Response({"error": "Invalid date format, use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            age_min_v = int(age_min)
            age_max_v = int(age_max)
            weight_max_v = Decimal(str(weight_max))
        except (TypeError, ValueError, InvalidOperation):
            return Response(
                {"error": "Параметры age_min, age_max должны быть целыми числами, weight_max — числом."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if age_min_v < 0 or age_max_v < 0 or age_min_v > age_max_v or weight_max_v <= 0:
            return Response(
                {"error": "Некорректный диапазон возраста или веса."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if gender not in (
            TournamentCategory.GENDER_MALE,
            TournamentCategory.GENDER_FEMALE,
            TournamentCategory.GENDER_ANY,
        ):
            return Response(
                {"error": "Некорректное значение пола."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        birth_year_max = today.year - age_min_v
        birth_year_min = today.year - age_max_v

        qs = Athlete.objects.select_related("trainer").filter(
            birth_date__year__lte=birth_year_max,
            birth_date__year__gte=birth_year_min,
        )
        if gender != TournamentCategory.GENDER_ANY:
            qs = qs.filter(gender=gender)

        # Лимит выдачи: защита от дампа всей базы PII одним запросом.
        qs = qs.order_by("last_name", "first_name")[:50]

        data = []
        for athlete in qs:
            is_weight_match = athlete.weight <= weight_max_v
            birth = athlete.birth_date
            age = (
                today.year
                - birth.year
                - ((today.month, today.day) < (birth.month, birth.day))
            )
            data.append({
                "id": athlete.id,
                "first_name": athlete.first_name,
                "last_name": athlete.last_name,
                "birth_date": athlete.birth_date,
                "weight": float(athlete.weight),
                "gender": athlete.gender,
                "club": athlete.club,
                "trainer": athlete.trainer.username if athlete.trainer else None,
                "is_weight_match": is_weight_match,
                "age": age,
            })

        return Response(data)


    @action(detail=True, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def bracket_state(self, request, pk=None):
        """Returns full bracket state for this category."""
        category = self.get_object()
        return Response(services.get_bracket_state(category))

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def generate_bracket(self, request, pk=None):
        category = self.get_object()
        _require_category_owner(category, request.user)

        # Опционально: принимаем список ID атлетов с фронтенда для посева.
        # Порядок сохраняем как выбрал тренер (filter(id__in) его не гарантирует).
        athlete_ids = request.data.get("athlete_ids", [])
        athletes_list = None
        if athlete_ids:
            if not isinstance(athlete_ids, list):
                return Response(
                    {"error": "athlete_ids должен быть списком."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                athlete_ids = [int(i) for i in athlete_ids]
            except (TypeError, ValueError):
                return Response(
                    {"error": "Некорректные athlete_ids."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            by_id = {a.id: a for a in Athlete.objects.filter(id__in=athlete_ids)}
            missing = [i for i in athlete_ids if i not in by_id]
            if missing:
                return Response(
                    {"error": f"Спортсмены не найдены: {missing}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            athletes_list = [by_id[i] for i in athlete_ids]
            user = request.user
            if not user.is_staff:
                foreign = [a.id for a in athletes_list if a.trainer_id != user.id]
                if foreign:
                    return Response(
                        {"error": "Можно использовать только своих спортсменов."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            # Сохраняем выбранных атлетов в категорию
            category.athletes.set(athletes_list)

        result = services.generate_bracket(category, athletes_list, actor=request.user)
        if isinstance(result, dict) and result.get("success"):
            return Response({"status": "bracket generated", **result})
        error = result.get("error", "Could not generate bracket") if isinstance(result, dict) else "Could not generate bracket"
        return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def add_athletes(self, request, pk=None):
        """Добавить спортсменов в состав категории (до построения сетки)."""
        category = self.get_object()
        _require_category_owner(category, request.user)
        if category.rounds.exists():
            return Response(
                {"error": "Сетка уже построена — состав заморожен. Перегенерируйте сетку после изменений."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        athlete_ids = request.data.get("athlete_ids", [])
        if not athlete_ids:
            return Response(
                {"error": "Передайте athlete_ids."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        athletes = list(Athlete.objects.filter(id__in=athlete_ids))
        if len(athletes) != len(set(athlete_ids)):
            return Response(
                {"error": "Некоторые спортсмены не найдены."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = request.user
        if not user.is_staff:
            foreign = [a.id for a in athletes if a.trainer_id != user.id]
            if foreign:
                return Response(
                    {"error": "Можно добавлять только своих спортсменов."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        category.athletes.add(*athletes)
        services.emit_event(
            category.tournament_id,
            TournamentEvent.CATEGORY_MEMBERS,
            request.user,
            category=category,
        )
        return Response({"added": [a.id for a in athletes], "total": category.athletes.count()})

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def remove_athlete(self, request, pk=None):
        """Убрать спортсмена из состава категории (до построения сетки)."""
        category = self.get_object()
        _require_category_owner(category, request.user)
        if category.rounds.exists():
            return Response(
                {"error": "Сетка уже построена — состав заморожен. Перегенерируйте сетку после изменений."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        athlete_id = request.data.get("athlete_id")
        if not athlete_id:
            return Response(
                {"error": "Передайте athlete_id."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        athlete = get_object_or_404(Athlete, id=athlete_id)
        user = request.user
        if not user.is_staff and athlete.trainer_id != user.id:
            return Response(
                {"error": "Можно убирать только своих спортсменов."},
                status=status.HTTP_403_FORBIDDEN,
            )
        category.athletes.remove(athlete)
        services.emit_event(
            category.tournament_id,
            TournamentEvent.CATEGORY_MEMBERS,
            request.user,
            category=category,
        )
        return Response({"removed": athlete.id, "total": category.athletes.count()})


class RoundViewSet(viewsets.ModelViewSet):
    serializer_class = RoundSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated()]
        return [IsTrainer()]

    def get_queryset(self):
        user = self.request.user
        qs = Round.objects.prefetch_related("matches")
        if user.is_staff:
            return qs
        profile_role = getattr(getattr(user, "profile", None), "role", "")
        if profile_role == "trainer":
            return qs.filter(
                Q(category__tournament__status=Tournament.STATUS_PUBLISHED)
                | Q(category__tournament__created_by=user)
            )
        return qs.filter(category__tournament__status=Tournament.STATUS_PUBLISHED)

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def start(self, request, pk=None):
        """Официальный старт раунда. Предыдущий раунд должен быть завершён."""
        rnd = self.get_object()
        _require_tournament_owner(rnd.category.tournament, request.user)
        prev = (
            Round.objects.filter(category=rnd.category, order__lt=rnd.order)
            .order_by("-order")
            .first()
        )
        if prev and prev.status != Round.STATUS_FINISHED:
            return Response(
                {"error": "Сначала завершите предыдущий раунд"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = services.start_round(rnd.id, actor=request.user)
        if not result.get("success"):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response({"status": "round started", **result})


class MatchViewSet(viewsets.ModelViewSet):
    queryset = Match.objects.select_related(
        "round",
        "round__category",
        "round__category__tournament",
        "athlete1",
        "athlete2",
        "winner",
        "tatami",
    ).all()
    serializer_class = MatchSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated()]
        return [IsTrainer()]

    # Поля, которые нельзя менять напрямую у завершённого/BYE боя —
    # история сетки. Исправления — через finish (счёт) или reopen.
    PROTECTED_FINISHED_FIELDS = frozenset({
        "athlete1", "athlete2", "winner", "status", "score1", "score2",
        "tatami", "round", "match_number", "fight_number",
        "previous_match1", "previous_match2",
        "duration_seconds", "started_at", "accumulated_seconds",
        "scheduled_time", "round_number",
    })
    # Поля, которые всегда меняются только через actions, даже у живых боёв.
    PROTECTED_LIVE_FIELDS = frozenset({
        "status", "tatami", "round", "match_number",
        "previous_match1", "previous_match2",
        "duration_seconds", "started_at", "accumulated_seconds",
    })

    def perform_update(self, serializer):
        from rest_framework.exceptions import PermissionDenied, ValidationError

        instance = serializer.instance
        if instance is not None:
            tournament = instance.round.category.tournament
            user = self.request.user
            if not (
                user.is_staff or tournament.created_by_id == getattr(user, "id", None)
            ):
                # Тренер может править только бои своих спортсменов,
                # и только счёт/участников, но не статус/татами.
                is_own = (
                    instance.athlete1_id is not None
                    and instance.athlete1.trainer_id == user.id
                ) or (
                    instance.athlete2_id is not None
                    and instance.athlete2.trainer_id == user.id
                )
                if not is_own:
                    raise PermissionDenied(
                        "Можно править только бои своих спортсменов или свои турниры."
                    )
        if instance and instance.status in (
            Match.STATUS_FINISHED,
            Match.STATUS_BYE,
        ):
            touched = self.PROTECTED_FINISHED_FIELDS & set(serializer.validated_data)
            if touched:
                raise ValidationError(
                    "Завершённый бой нельзя менять напрямую — "
                    "используйте действие финиша или переоткройте бой."
                )
        if instance and instance.status not in (
            Match.STATUS_FINISHED,
            Match.STATUS_BYE,
        ):
            touched_live = self.PROTECTED_LIVE_FIELDS & set(serializer.validated_data)
            if touched_live:
                raise ValidationError(
                    "Статус, татами и таймер меняются только через действия "
                    "(старт/пауза/финиш/назначение татами), а не PATCH."
                )
        if (
            instance
            and instance.status != Match.STATUS_FINISHED
            and serializer.validated_data.get("status") == Match.STATUS_FINISHED
        ):
            raise ValidationError(
                {"status": "Завершайте бой через действие «Финиш», а не PATCH."}
            )
        serializer.save()

    def get_queryset(self):
        user = self.request.user
        qs = Match.objects.select_related(
            "round",
            "round__category",
            "round__category__tournament",
            "athlete1",
            "athlete2",
            "winner",
            "tatami",
        )
        if user.is_staff:
            return qs
        profile_role = getattr(getattr(user, "profile", None), "role", "")
        if profile_role == "trainer":
            return qs.filter(
                Q(athlete1__trainer=user)
                | Q(athlete2__trainer=user)
                | Q(round__category__tournament__created_by=user)
            )
        return qs.filter(
            Q(athlete1__parent_links__parent=user)
            | Q(athlete2__parent_links__parent=user)
        )

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def promote_winner(self, request, pk=None):
        from rest_framework.exceptions import ValidationError

        match = self.get_object()
        winner_id = request.data.get("winner_id")
        if not winner_id:
            return Response({"error": "winner_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            winner_pk = _parse_int(winner_id, "winner_id")
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        try:
            services.promote_winner(match.id, winner_pk)
        except (Match.DoesNotExist, Athlete.DoesNotExist):
            return Response(
                {"error": "Матч или спортсмен не найден."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except ValueError as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response({"status": "winner promoted"})

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def promote_winner_detail(self, request, pk=None):
        """Promotes winner and returns detailed info for frontend."""
        from rest_framework.exceptions import ValidationError

        match = self.get_object()
        winner_id = request.data.get("winner_id")
        if not winner_id:
            return Response({"error": "winner_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            winner_pk = _parse_int(winner_id, "winner_id")
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = services.promote_winner_with_details(match.id, winner_pk)
        except (Match.DoesNotExist, Athlete.DoesNotExist):
            return Response(
                {"error": "Матч или спортсмен не найден."},
                status=status.HTTP_404_NOT_FOUND,
            )
        except ValueError as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_400_BAD_REQUEST
            )
        return Response(result)

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def start_match(self, request, pk=None):
        """Starts a match - sets status to IN_PROGRESS."""
        match = self.get_object()
        result = services.start_match(match.id, actor=request.user)
        if not result.get("success"):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def pause_match(self, request, pk=None):
        """Техническая пауза: таймер останавливается, бой продолжается позже."""
        match = self.get_object()
        result = services.pause_match(match.id, actor=request.user)
        if not result.get("success"):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def resume_match(self, request, pk=None):
        """Продолжить бой после паузы с сохранённого времени."""
        match = self.get_object()
        result = services.resume_match(match.id, actor=request.user)
        if not result.get("success"):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def finish_match(self, request, pk=None):
        """Finishes a match with optional winner and scores."""
        match = self.get_object()
        winner_id = request.data.get("winner_id")
        score1 = request.data.get("score1")
        score2 = request.data.get("score2")

        try:
            parsed = {
                "winner_id": _parse_int(winner_id, "winner_id")
                if winner_id not in (None, "")
                else None,
                "score1": _parse_int(score1, "score1")
                if score1 not in (None, "")
                else None,
                "score2": _parse_int(score2, "score2")
                if score2 not in (None, "")
                else None,
            }
        except Exception as e:
            detail = getattr(e, "detail", {"error": "Некорректные числовые значения"})
            return Response(
                {"success": False, **(detail if isinstance(detail, dict) else {"error": str(detail)})},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = services.finish_match(match.id, **parsed, actor=request.user)
        if not result.get("success"):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def reopen(self, request, pk=None):
        """Переоткрыть завершённый бой для исправления ошибки судьи."""
        match = self.get_object()
        result = services.reopen_match(match.id, actor=request.user)
        if not result.get("success"):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=True, methods=["post"], permission_classes=[IsTrainer])
    def set_tatami(self, request, pk=None):
        """Assign tatami to a match."""
        from rest_framework.exceptions import ValidationError

        match = self.get_object()
        tatami_id = request.data.get("tatami_id")
        if not tatami_id:
            return Response({"error": "tatami_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            tatami_pk = _parse_int(tatami_id, "tatami_id")
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        result = services.set_match_tatami(
            match.id, tatami_pk,
            force=_parse_bool(request.data.get("force")), actor=request.user,
        )
        if not result.get("success"):
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    @action(detail=True, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def history(self, request, pk=None):
        """Журнал действий судьи по бою. Видимость — как у самого боя."""
        match = self.get_object()
        logs = match.action_logs.select_related("actor", "winner").all()
        return Response(MatchActionLogSerializer(logs, many=True).data)
