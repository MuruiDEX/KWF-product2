"""Этап 7: журнал действий судьи + generate_categories без numpy."""
from datetime import date

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import Profile
from tournament import services
from tournament.models import (
    Athlete, Match, MatchActionLog, Round, Tournament, TournamentCategory,
    TournamentRegistration,
)

User = get_user_model()


def make_trainer(username="trainer_a"):
    u = User.objects.create_user(username=username, password="pass12345")
    Profile.objects.update_or_create(user=u, defaults={"role": "trainer"})
    return User.objects.get(pk=u.pk)


def make_match(trainer, tag="au"):
    t = Tournament.objects.create(
        name=f"Кубок {tag}", slug=f"cup-{tag}",
        start_date=date(2026, 10, 1), end_date=date(2026, 10, 2),
        status=Tournament.STATUS_PUBLISHED, created_by=trainer,
    )
    cat = TournamentCategory.objects.create(
        tournament=t, name=f"Кат {tag}", age_min=8, age_max=12,
        weight_max=60, gender="male", order=0,
    )
    rnd = Round.objects.create(category=cat, name="Финал", order=1)
    a1 = Athlete.objects.create(
        trainer=trainer, first_name="Ан", last_name="Первый",
        birth_date=date(2015, 5, 1), weight=35, gender="male",
    )
    a2 = Athlete.objects.create(
        trainer=trainer, first_name="Бо", last_name="Второй",
        birth_date=date(2015, 5, 1), weight=36, gender="male",
    )
    m = Match.objects.create(
        round=rnd, match_number=1, athlete1=a1, athlete2=a2,
        status=Match.STATUS_READY, fight_number=1,
    )
    return m


class AuditLogTests(APITestCase):
    def setUp(self):
        self.trainer = make_trainer()
        self.client.force_authenticate(self.trainer)
        self.m = make_match(self.trainer)

    def history(self):
        return self.client.get(f"/api/tournament/matches/{self.m.id}/history/")

    def test_full_cycle_logged_with_actor(self):
        base = f"/api/tournament/matches/{self.m.id}"
        self.assertEqual(self.client.post(f"{base}/start_match/").status_code, 200)
        self.assertEqual(self.client.post(f"{base}/pause_match/").status_code, 200)
        self.assertEqual(self.client.post(f"{base}/resume_match/").status_code, 200)
        self.assertEqual(
            self.client.post(
                f"{base}/finish_match/", {"winner_id": self.m.athlete1_id}, format="json"
            ).status_code, 200,
        )
        r = self.history()
        self.assertEqual(r.status_code, 200, r.content)
        actions = [e["action"] for e in r.data]
        self.assertEqual(actions, ["start", "pause", "resume", "finish"])
        self.assertTrue(all(e["actor_name"] == "trainer_a" for e in r.data))
        fin = r.data[-1]
        self.assertEqual(fin["winner"], self.m.athlete1_id)
        # Переоткрытие тоже в журнале.
        self.assertEqual(self.client.post(f"{base}/reopen/").status_code, 200)
        actions2 = [e["action"] for e in self.history().data]
        self.assertEqual(actions2[-1], "reopen")

    def test_history_anon_denied(self):
        self.client.force_authenticate(None)
        r = self.client.get(f"/api/tournament/matches/{self.m.id}/history/")
        self.assertIn(r.status_code, (401, 403))

    def test_set_tatami_logged(self):
        from tournament.models import Tatami
        tat = Tatami.objects.create(name="Татами 1", order=1)
        r = self.client.post(
            f"/api/tournament/matches/{self.m.id}/set_tatami/",
            {"tatami_id": tat.id}, format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        entry = MatchActionLog.objects.get(match=self.m, action="tatami")
        self.assertEqual(entry.detail, "Татами 1")


class GenerateCategoriesTests(APITestCase):
    def test_quantiles_without_numpy(self):
        trainer = make_trainer(username="trainer_g")
        t = Tournament.objects.create(
            name="Авто", slug="auto-cats",
            start_date=date(2026, 10, 1), end_date=date(2026, 10, 2),
            status=Tournament.STATUS_DRAFT, created_by=trainer,
        )
        for i in range(8):
            a = Athlete.objects.create(
                trainer=trainer, first_name=f"Им{i}", last_name="Весов",
                birth_date=date(2015, 5, 1), weight=25 + i * 3, gender="male",
            )
            TournamentRegistration.objects.create(tournament=t, athlete=a)
        cats = services.generate_categories(t)
        self.assertEqual(len(cats), 4)
        total = sum(c.athletes.count() for c in cats)
        self.assertEqual(total, 8)
