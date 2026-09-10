from rest_framework import serializers
from .models import TrainingSession


class TrainingSessionSerializer(serializers.ModelSerializer):
    day_name = serializers.CharField(source="get_day_display", read_only=True)

    class Meta:
        model = TrainingSession
        fields = [
            "id",
            "day",
            "day_name",
            "start_time",
            "end_time",
            "group",
            "kind",
            "trainer_name",
            "room",
            "note",
            "is_active",
            "order",
        ]

    def validate(self, attrs):
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start and end and end <= start:
            raise serializers.ValidationError(
                {"end_time": "Время окончания должно быть позже начала."}
            )
        return attrs
