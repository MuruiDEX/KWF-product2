from rest_framework import permissions, viewsets
from django.utils import timezone

from .models import News
from .serializers import NewsSerializer


class NewsViewSet(viewsets.ModelViewSet):
    queryset = News.objects.all().order_by("-created_at")
    serializer_class = NewsSerializer
    lookup_field = "slug"

    def get_queryset(self):
        qs = News.objects.all().order_by("-created_at")
        if self.action in ("list", "retrieve"):
            return qs.filter(is_published=True)
        return qs

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [permissions.IsAdminUser()]

    def perform_create(self, serializer):
        serializer.save(
            published_at=timezone.now()
            if serializer.validated_data.get("is_published")
            else None
        )

    def perform_update(self, serializer):
        instance = self.get_object()
        was_published = instance.is_published
        news = serializer.save()
        if news.is_published and not news.published_at:
            news.published_at = timezone.now()
            news.save(update_fields=["published_at"])
        elif not news.is_published and was_published:
            # Распубликация: published_at больше не валиден.
            news.published_at = None
            news.save(update_fields=["published_at"])
