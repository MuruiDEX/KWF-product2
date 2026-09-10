from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from django.shortcuts import get_object_or_404

from tournament.models import Athlete, Match, Tournament, TournamentCategory, ParentChildLink
from tournament.serializers import MatchSerializer, TournamentSerializer

from .serializers import MeSerializer, RegisterSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        # Перечитываем пользователя с профилем из БД: user.profile мог быть
        # закэширован сигналом до обновления роли.
        try:
            from django.contrib.auth import get_user_model

            user = (
                get_user_model()
                .objects.select_related("profile")
                .get(pk=user.pk)
            )
        except Exception:
            pass
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": MeSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)

    def patch(self, request):
        serializer = MeSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


def _require_parent(user):
    """Только родитель (staff — через админку, не через этот механизм)."""
    from rest_framework.exceptions import PermissionDenied

    try:
        role = user.profile.role
    except Exception:
        role = None
    if role != "parent":
        raise PermissionDenied("Привязка доступна только родителям.")
    return True


class LinkChildView(APIView):
    """Привязка родителя к существующему спортсмену по коду тренера.

    Новый Athlete НЕ создаётся: используется существующая запись.
    Код выдаёт тренер, поэтому его знание = согласие тренера.
    """

    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "link"

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle

        return [ScopedRateThrottle()]

    def post(self, request):
        _require_parent(request.user)
        code = (request.data.get("code") or "").strip().upper()
        if not code:
            return Response(
                {"code": ["Введите код привязки от тренера."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        athlete = get_object_or_404(Athlete, link_code=code)
        link, created = ParentChildLink.objects.get_or_create(
            parent=request.user,
            athlete=athlete,
            defaults={"is_verified": True},
        )
        if not link.is_verified:
            link.is_verified = True
            link.save(update_fields=["is_verified"])
        return Response(
            {
                "linked": True,
                "already": not created,
                "athlete": {
                    "id": athlete.id,
                    "first_name": athlete.first_name,
                    "last_name": athlete.last_name,
                },
            },
            status=status.HTTP_200_OK,
        )


class UnlinkChildView(APIView):
    """Отвязка своего ребёнка (удаляет только связь, не спортсмена)."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, athlete_id):
        ParentChildLink.objects.filter(
            parent=request.user, athlete_id=athlete_id
        ).delete()
        return Response({"linked": False}, status=status.HTTP_200_OK)


class CabinetView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import Profile

        # Legacy-аккаунты могли остаться без профиля — создаём, а не 500.
        Profile.objects.get_or_create(user=request.user)
        role = request.user.profile.role

        if role == "trainer":
            athletes = Athlete.objects.filter(trainer=request.user)
            matches = (
                Match.objects.filter(athlete1__trainer=request.user)
                | Match.objects.filter(athlete2__trainer=request.user)
            )
        elif role == "parent":
            athletes = Athlete.objects.filter(parent_links__parent=request.user)
            matches = (
                Match.objects.filter(athlete1__parent_links__parent=request.user)
                | Match.objects.filter(athlete2__parent_links__parent=request.user)
            )
        else:
            athletes = Athlete.objects.none()
            matches = Match.objects.none()

        matches = matches.select_related(
            "round",
            "round__category",
            "round__category__tournament",
            "athlete1",
            "athlete2",
            "winner",
            "tatami",
        ).distinct()

        categories = TournamentCategory.objects.filter(
            athletes__in=athletes
        ).select_related("tournament")
        tournament_ids = categories.values_list(
            "tournament_id", flat=True
        ).distinct()
        tournaments = Tournament.objects.filter(
            id__in=tournament_ids
        )
        if role == "trainer":
            # Тренер видит и созданные им турниры, а не только те,
            # где уже заявлены его спортсмены.
            from django.db.models import Q

            tournaments = tournaments | Tournament.objects.filter(
                created_by=request.user
            )
        tournaments = tournaments.prefetch_related(
            "categories", "categories__athletes"
        ).distinct()

        return Response(
            {
                "athletes": [
                    {
                        "id": a.id,
                        "first_name": a.first_name,
                        "last_name": a.last_name,
                        "birth_date": a.birth_date.isoformat() if a.birth_date else None,
                        "age": a.age,
                        "weight": str(a.weight),
                        "gender": a.gender,
                        "height": str(a.height) if a.height else None,
                        "club": a.club or "",
                        # Код привязки видит только тренер-владелец.
                        # Родителю он не нужен и не должен распространяться.
                        "link_code": (a.link_code or None) if role == "trainer" else None,
                    }
                    for a in athletes
                ],
                "tournaments": TournamentSerializer(tournaments, many=True).data,
                "matches": MatchSerializer(matches, many=True).data,
            }
        )
