"""Матрица прав Этапа 1: Athlete CRUD + search_candidates (trainer/parent/staff/anon)."""
from datetime import date

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import Profile
from tournament.models import Athlete

User = get_user_model()

ATHLETE = {
    "first_name": "Иван",
    "last_name": "Петров",
    "birth_date": "2015-05-01",
    "weight": "35.50",
    "gender": "male",
}

SEARCH = "/api/tournament/categories/search_candidates/?gender=male&age_min=5&age_max=15&weight_max=100"


def make_user(username, role="parent", staff=False):
    u = User.objects.create_user(username=username, password="pass12345")
    u.is_staff = staff
    u.save()
    Profile.objects.update_or_create(user=u, defaults={"role": role})
    # Сбрасываем кэш reverse OneToOne, иначе u.profile вернёт старое значение.
    return User.objects.get(pk=u.pk)


class AthletePermissionsTests(APITestCase):
    def setUp(self):
        self.trainer = make_user("trainer1", role="trainer")
        self.parent = make_user("parent1", role="parent")
        self.staff = make_user("staff1", role="admin", staff=True)

    def test_trainer_can_create_athlete(self):
        self.client.force_authenticate(self.trainer)
        r = self.client.post("/api/tournament/athletes/", ATHLETE, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["trainer"], self.trainer.id)
        a = Athlete.objects.get(id=r.data["id"])
        self.assertEqual(a.trainer_id, self.trainer.id)

    def test_parent_cannot_create_athlete(self):
        self.client.force_authenticate(self.parent)
        r = self.client.post("/api/tournament/athletes/", ATHLETE, format="json")
        self.assertEqual(r.status_code, 403, r.content)
        self.assertEqual(Athlete.objects.count(), 0)

    def test_anon_cannot_create_athlete(self):
        r = self.client.post("/api/tournament/athletes/", ATHLETE, format="json")
        self.assertIn(r.status_code, (401, 403))

    def test_user_without_profile_gets_403_not_500(self):
        legacy = User.objects.create_user(username="legacy", password="pass12345")
        Profile.objects.filter(user=legacy).delete()
        self.client.force_authenticate(legacy)
        r = self.client.post("/api/tournament/athletes/", ATHLETE, format="json")
        self.assertEqual(r.status_code, 403, r.content)

    def test_staff_create_requires_trainer(self):
        self.client.force_authenticate(self.staff)
        r = self.client.post("/api/tournament/athletes/", ATHLETE, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        r2 = self.client.post(
            "/api/tournament/athletes/", ATHLETE, format="json",
        )
        # тот же запрос с явным trainer
        r3 = self.client.post(
            "/api/tournament/athletes/?",
            ATHLETE,
            format="json",
            HTTP_X_TRAINER=str(self.trainer.id),
        )
        # staff обязан передать trainer в теле; query не считается
        self.assertEqual(r2.status_code, 400)
        self.assertEqual(r3.status_code, 400)

    def test_staff_create_with_trainer_in_body(self):
        self.client.force_authenticate(self.staff)
        payload = dict(ATHLETE, trainer=self.trainer.id)
        r = self.client.post("/api/tournament/athletes/", payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["trainer"], self.trainer.id)

    def test_trainer_cannot_update_others_athlete(self):
        a = Athlete.objects.create(
            trainer=self.trainer, birth_date=date(2015, 5, 1),
            weight=35, gender="male", first_name="Иван", last_name="Петров",
        )
        other_trainer = make_user("trainer2", role="trainer")
        self.client.force_authenticate(other_trainer)
        r = self.client.patch(f"/api/tournament/athletes/{a.id}/", {"club": "X"}, format="json")
        self.assertEqual(r.status_code, 403, r.content)

    def test_search_candidates_trainer_ok_parent_forbidden(self):
        self.client.force_authenticate(self.trainer)
        r = self.client.get(SEARCH)
        self.assertEqual(r.status_code, 200, r.content)
        self.client.force_authenticate(self.parent)
        r2 = self.client.get(SEARCH)
        self.assertEqual(r2.status_code, 403, r2.content)

    def test_search_candidates_anon(self):
        r = self.client.get(SEARCH)
        self.assertIn(r.status_code, (401, 403))

    def test_search_candidates_with_athletes_no_500(self):
        Athlete.objects.create(
            trainer=self.trainer, birth_date=date(2015, 5, 1),
            weight=35, gender="male", first_name="Иван", last_name="Петров",
        )
        self.client.force_authenticate(self.trainer)
        r = self.client.get(SEARCH)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(len(r.data), 1)
        self.assertTrue(r.data[0]["is_weight_match"])


class AthleteClubTests(APITestCase):
    """Клуб/тренер: сохраняется, возвращается API и кабинетом, правится."""

    def setUp(self):
        self.trainer = make_user("trainer_club", role="trainer")
        self.client.force_authenticate(self.trainer)

    def test_club_roundtrip_and_cabinet(self):
        payload = dict(ATHLETE, club="KWF Pavlodar / Иванов А.А.")
        r = self.client.post("/api/tournament/athletes/", payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["club"], "KWF Pavlodar / Иванов А.А.")
        # Кабинет отдаёт клуб и дату рождения для формы редактирования.
        cab = self.client.get("/api/auth/cabinet/")
        self.assertEqual(cab.status_code, 200, cab.content)
        self.assertEqual(cab.data["athletes"][0]["club"], "KWF Pavlodar / Иванов А.А.")
        self.assertEqual(cab.data["athletes"][0]["birth_date"], "2015-05-01")
        # Редактирование клуба.
        a_id = r.data["id"]
        r2 = self.client.patch(
            f"/api/tournament/athletes/{a_id}/", {"club": "Новый клуб"}, format="json"
        )
        self.assertEqual(r2.status_code, 200, r2.content)
        self.assertEqual(r2.data["club"], "Новый клуб")

    def test_legacy_empty_club_ok(self):
        a = Athlete.objects.create(
            trainer=self.trainer, birth_date=date(2015, 5, 1),
            weight=35, gender="male", first_name="Иван", last_name="Петров",
        )
        r = self.client.get(f"/api/tournament/athletes/{a.id}/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["club"], "")
