from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import TrainingSessionViewSet

router = DefaultRouter()
router.register("sessions", TrainingSessionViewSet, basename="trainingsession")

urlpatterns = [
    path("", include(router.urls)),
]
