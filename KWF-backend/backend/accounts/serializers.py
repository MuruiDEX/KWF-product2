from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Profile

User = get_user_model()


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ["phone", "club", "belt", "birth_date", "role"]
        # Роль назначается только при регистрации. Через Me API её менять
        # нельзя, иначе любой родитель повысит себя до тренера.
        read_only_fields = ["role"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(
        choices=[("parent", "Родитель"), ("trainer", "Тренер")],
        default="parent",
    )

    class Meta:
        model = User
        fields = ["username", "email", "password", "first_name", "last_name", "role"]

    def create(self, validated_data):
        from django.db import transaction

        role = validated_data.pop("role", "parent")
        with transaction.atomic():
            user = User.objects.create_user(**validated_data)

            # post_save-сигнал уже создал Profile с default parent и закэшировал
            # его в user.profile. Обновляем роль и инвалидируем кэш, иначе
            # RegisterView вернёт stale parent в ответе (см. reproduce).
            profile, _ = Profile.objects.get_or_create(user=user)
            profile.role = role
            profile.save(update_fields=["role"])
            # Привязываем свежий объект к кэшу обратной OneToOne-связи.
            user.profile = profile

        return user


class MeSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "profile",
        ]
        read_only_fields = ["id", "username", "is_staff"]

    def to_representation(self, instance):
        from django.db import transaction

        # Не доверяем закэшированному instance.profile (после регистрации
        # там может лежать stale parent). Читаем роль напрямую из БД.
        try:
            fresh = Profile.objects.filter(user=instance).first()
            if fresh is None:
                with transaction.atomic():
                    fresh, _ = Profile.objects.get_or_create(user=instance)
            instance.profile = fresh
        except Exception:
            pass
        return super().to_representation(instance)

    def update(self, instance, validated_data):
        from django.db import transaction

        profile_data = validated_data.pop("profile", None)
        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
            if profile_data is not None:
                profile, _ = Profile.objects.get_or_create(user=instance)
                for attr, value in profile_data.items():
                    setattr(profile, attr, value)
                profile.save()
        return instance
