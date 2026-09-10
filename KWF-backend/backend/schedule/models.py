from django.core.exceptions import ValidationError
from django.db import models


class TrainingSession(models.Model):
    """Занятие в недельном расписании тренировок."""

    DAY_MONDAY = 0
    DAY_TUESDAY = 1
    DAY_WEDNESDAY = 2
    DAY_THURSDAY = 3
    DAY_FRIDAY = 4
    DAY_SATURDAY = 5
    DAY_SUNDAY = 6

    DAY_CHOICES = [
        (DAY_MONDAY, "Понедельник"),
        (DAY_TUESDAY, "Вторник"),
        (DAY_WEDNESDAY, "Среда"),
        (DAY_THURSDAY, "Четверг"),
        (DAY_FRIDAY, "Пятница"),
        (DAY_SATURDAY, "Суббота"),
        (DAY_SUNDAY, "Воскресенье"),
    ]

    day = models.PositiveSmallIntegerField(choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    group = models.CharField(max_length=100)
    kind = models.CharField(max_length=100, default="Кекушинкай", blank=True)
    trainer_name = models.CharField(max_length=200, blank=True, default="")
    room = models.CharField(max_length=200, blank=True, default="")
    note = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["day", "start_time", "order", "id"]

    def clean(self):
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValidationError(
                {"end_time": "Время окончания должно быть позже начала."}
            )

    def save(self, *args, **kwargs):
        self.full_clean(exclude=["id"] if self.pk else None)
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_day_display()} {self.start_time}–{self.end_time} · {self.group}"
