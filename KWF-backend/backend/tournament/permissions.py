from rest_framework import permissions


def get_user_role(user):
    """Безопасно возвращает role профиля ('trainer'/'parent'/...) или None.

    Не создаёт запись в БД (в отличие от get_or_create) — проверки прав
    вызываются на каждый запрос. Отсутствующий профиль = 'parent'
    (самый ограниченный), staff без профиля считается админом.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return None
    try:
        role = user.profile.role
        if role:
            return role
    except Exception:
        pass
    if getattr(user, "is_staff", False):
        return "admin"
    return "parent"


def is_trainer_user(user):
    """True для staff и пользователей с role='trainer'."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_staff", False):
        return True
    return get_user_role(user) == "trainer"


class IsTrainer(permissions.BasePermission):
    """
    Permission class that allows access only to users with the 'trainer' role.
    Staff (is_staff) всегда пропускаются.
    """
    def has_permission(self, request, view):
        return is_trainer_user(request.user)
