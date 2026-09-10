from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    TatamiViewSet,
    AthletelViewSet,
    TournamentViewSet,
    TournamentCategoryViewSet,
    RoundViewSet,
    MatchViewSet,
)


router = DefaultRouter()

router.register("tatamis", TatamiViewSet)
router.register("athletes", AthletelViewSet)
router.register("tournaments", TournamentViewSet)
router.register("categories", TournamentCategoryViewSet, basename="tournamentcategory")
router.register("rounds", RoundViewSet, basename="round")
router.register("matches", MatchViewSet)


urlpatterns = [
    path("", include(router.urls)),
]
