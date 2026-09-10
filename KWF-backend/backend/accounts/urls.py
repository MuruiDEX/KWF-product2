from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import CabinetView, LinkChildView, MeView, RegisterView, UnlinkChildView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("cabinet/", CabinetView.as_view(), name="cabinet"),
    path("children/link/", LinkChildView.as_view(), name="link-child"),
    path("children/<int:athlete_id>/", UnlinkChildView.as_view(), name="unlink-child"),
]
