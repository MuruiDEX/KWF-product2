from rest_framework import permissions, viewsets

from tournament.permissions import IsTrainer

from .models import TrainingSession
from .serializers import TrainingSessionSerializer


class TrainingSessionViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingSessionSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [IsTrainer()]

    def get_queryset(self):
        qs = TrainingSession.objects.all()
        user = self.request.user
        if user.is_staff:
            return qs
        try:
            is_trainer = user.profile.role == "trainer"
        except Exception:
            is_trainer = False
        if is_trainer:
            return qs
        # Публика и родители видят только активные занятия.
        return qs.filter(is_active=True)
