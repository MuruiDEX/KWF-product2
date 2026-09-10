from django.contrib import admin
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


@admin.register(Tatami)
class TatamiAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "order")
    search_fields = ("name",)
    ordering = ("order",)


@admin.register(Athlete)
class AthleteAdmin(admin.ModelAdmin):
    list_display = ("id", "first_name", "last_name", "age", "weight", "gender", "trainer")
    list_filter = ("gender",)
    search_fields = ("first_name", "last_name", "trainer__username")
    autocomplete_fields = ("trainer",)


@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "start_date", "end_date", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(TournamentCategory)
class TournamentCategoryAdmin(admin.ModelAdmin):
    list_display = (
        "id", "tournament", "name", "age_min", "age_max",
        "weight_max", "gender", "order", "tatami",
    )
    list_filter = ("tournament", "gender")
    search_fields = ("name",)
    autocomplete_fields = ("tournament",)


@admin.register(Round)
class RoundAdmin(admin.ModelAdmin):
    list_display = ("id", "category", "name", "order")
    list_filter = ("category__tournament",)
    search_fields = ("name", "category__name")


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = (
        "id", "round", "match_number", "athlete1", "athlete2",
        "score1", "score2", "winner", "tatami", "fight_number", "status",
    )
    list_filter = ("status", "round__category__tournament")
    search_fields = ("athlete1__first_name", "athlete1__last_name",
                     "athlete2__first_name", "athlete2__last_name")
    autocomplete_fields = ("round", "athlete1", "athlete2", "winner", "tatami",
                           "previous_match1", "previous_match2")


@admin.register(MatchActionLog)
class MatchActionLogAdmin(admin.ModelAdmin):
    list_display = ("id", "match", "actor", "action", "winner", "score1", "score2", "created_at")
    list_filter = ("action",)
    search_fields = ("actor__username",)
    readonly_fields = ("match", "actor", "action", "winner", "score1", "score2", "detail", "created_at")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(TournamentEvent)
class TournamentEventAdmin(admin.ModelAdmin):
    list_display = ("id", "tournament", "type", "match", "round", "category", "actor", "created_at")
    list_filter = ("type", "tournament")
    readonly_fields = ("tournament", "type", "match", "round", "category", "actor", "created_at")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
