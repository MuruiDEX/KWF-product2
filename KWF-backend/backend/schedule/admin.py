from django.contrib import admin
from .models import TrainingSession


@admin.register(TrainingSession)
class TrainingSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "day", "start_time", "end_time", "group", "trainer_name", "is_active")
    list_filter = ("day", "is_active")
    search_fields = ("group", "trainer_name", "room")
    ordering = ("day", "start_time")
