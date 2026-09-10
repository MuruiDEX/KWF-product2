"""Расписание тренировок: публичный доступ, права, валидация."""
from datetime import time

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import Profile
from .models import TrainingSession

User = get_user_model()

SESSION = {
    "day": 0,
    "start_time": "18:00",
    "end_time": "19:30",
    "group": "Средняя группа",
    "kind": "Кекушинкай",
    "trainer_name": "Иванов А.А.",
    "room": "Зал 1",
}


def make_user(username, role="parent", staff=False):
    u = User.objects.create_user(username=username, password="pass12345")
    u.is_staff = staff
    u.save()
    Profile.objects.update_or_create(user=u, defaults={"role": role})
    return User.objects.get(pk=u.pk)


class TrainingSessionTests(APITestCase):
    def setUp(self):
        self.trainer = make_user("trainer_s", role="trainer")
        self.parent = make_user("parent_s", role="parent")
        TrainingSession.objects.create(**{**SESSION, "start_time": time(18, 0), "end_time": time(19, 30)})
        TrainingSession.objects.create(
            **{**SESSION, "day": 2, "group": "Скрытая", "is_active": False,
               "start_time": time(18, 0), "end_time": time(19, 0)}
        )

    def _results(self, response):
        data = response.data
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return data

    def test_anon_sees_only_active(self):
        r = self.client.get("/api/schedule/sessions/")
        self.assertEqual(r.status_code, 200, r.content)
        rows = self._results(r)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["group"], "Средняя группа")
        self.assertEqual(rows[0]["day_name"], "Понедельник")

    def test_anon_cannot_create(self):
        r = self.client.post("/api/schedule/sessions/", SESSION, format="json")
        self.assertIn(r.status_code, (401, 403))

    def test_parent_cannot_create(self):
        self.client.force_authenticate(self.parent)
        r = self.client.post("/api/schedule/sessions/", SESSION, format="json")
        self.assertEqual(r.status_code, 403, r.content)

    def test_trainer_crud(self):
        self.client.force_authenticate(self.trainer)
        r = self.client.post("/api/schedule/sessions/", SESSION, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        sid = r.data["id"]
        r2 = self.client.patch(f"/api/schedule/sessions/{sid}/", {"room": "Зал 2"}, format="json")
        self.assertEqual(r2.status_code, 200, r2.content)
        self.assertEqual(r2.data["room"], "Зал 2")
        # Тренер видит и неактивные.
        self.assertEqual(len(self._results(self.client.get("/api/schedule/sessions/"))), 3)
        self.assertEqual(self.client.delete(f"/api/schedule/sessions/{sid}/").status_code, 204)

    def test_end_before_start_400(self):
        self.client.force_authenticate(self.trainer)
        bad = dict(SESSION, start_time="19:30", end_time="18:00")
        r = self.client.post("/api/schedule/sessions/", bad, format="json")
        self.assertEqual(r.status_code, 400, r.content)
