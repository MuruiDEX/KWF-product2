from django.conf import settings
from django.db import migrations


def ensure_profiles(apps, schema_editor):
    """Создаёт Profile для пользователей без него (легаси-аккаунты).

    Роль по умолчанию 'parent' — самая ограниченная. Тренерам, потерявшим
    роль из-за этого, роль выставляет админ (или повторная регистрация).
    Обратная миграция не требуется (no-op).
    """
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    Profile = apps.get_model("accounts", "Profile")
    existing = set(Profile.objects.values_list("user_id", flat=True))
    missing = User.objects.exclude(id__in=existing).only("id")
    Profile.objects.bulk_create(
        [Profile(user_id=u.id) for u in missing.iterator()],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(ensure_profiles, migrations.RunPython.noop),
    ]
