"""Этап 2: инварианты татами — distribute и ручное назначение."""
from datetime import date

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import Profile
from tournament.models import (
    Athlete, Match, Round, Tatami, Tournament, TournamentCategory,
)

User = get_user_model()


def make_trainer(username="trainer_t"):
    u = User.objects.create_user(username=username, password="pass12345")
    Profile.objects.update_or_create(user=u, defaults={"role": "trainer"})
    return User.objects.get(pk=u.pk)


def make_athlete(trainer, first="Иван", last="Петров", weight=35):
    return Athlete.objects.create(
        trainer=trainer, first_name=first, last_name=last,
        birth_date=date(2015, 5, 1), weight=weight, gender="male",
    )


def make_tournament(user, name="Кубок"):
    return Tournament.objects.create(
        name=name, slug=f"{name}-{Tournament.objects.count()}",
        start_date=date(2026, 10, 1), end_date=date(2026, 10, 2),
        status=Tournament.STATUS_PUBLISHED, created_by=user,
    )


def make_category(tournament, name="Кат", order=0):
    return TournamentCategory.objects.create(
        tournament=tournament, name=name, age_min=8, age_max=12,
        weight_max=40, gender="male", order=order,
    )


def make_round(category, name="1/2", order=1):
    return Round.objects.create(category=category, name=name, order=order)


def make_match(rnd, num, a1=None, a2=None, status=Match.STATUS_READY):
    return Match.objects.create(
        round=rnd, match_number=num, athlete1=a1, athlete2=a2,
        status=status, fight_number=num,
    )


class DistributeTests(APITestCase):
    def setUp(self):
        self.trainer = make_trainer()

    def test_distribute_without_tatamis_400_with_hint(self):
        t = make_tournament(self.trainer)
        self.client.force_authenticate(self.trainer)
        r = self.client.post(f"/api/tournament/tournaments/{t.id}/distribute_tatamis/")
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("татами", r.data["error"].lower())

    def test_distribute_ready_matches(self):
        t = make_tournament(self.trainer)
        cat = make_category(t)
        rnd = make_round(cat)
        a = [make_athlete(self.trainer, first=f"Б{i}", last="Цов") for i in range(4)]
        make_match(rnd, 1, a[0], a[1])
        make_match(rnd, 2, a[2], a[3])
        Tatami.objects.create(name="Татами 1", order=1)
        Tatami.objects.create(name="Татами 2", order=2)
        self.client.force_authenticate(self.trainer)
        r = self.client.post(f"/api/tournament/tournaments/{t.id}/distribute_tatamis/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["distributed"], 2)
        self.assertEqual(Match.objects.filter(tatami__isnull=True).count(), 0)

    def test_distribute_only_waiting_returns_hint(self):
        t = make_tournament(self.trainer)
        cat = make_category(t)
        rnd = make_round(cat)
        make_match(rnd, 1, status=Match.STATUS_WAITING)
        make_match(rnd, 2, status=Match.STATUS_WAITING)
        Tatami.objects.create(name="Татами 1", order=1)
        self.client.force_authenticate(self.trainer)
        r = self.client.post(f"/api/tournament/tournaments/{t.id}/distribute_tatamis/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["distributed"], 0)
        self.assertEqual(r.data["waiting"], 2)
        self.assertIn("раунд", (r.data["hint"] or "").lower())


class SetTatamiGuardsTests(APITestCase):
    def setUp(self):
        self.trainer = make_trainer()
        self.t1 = Tatami.objects.create(name="Татами 1", order=1)
        self.t2 = Tatami.objects.create(name="Татами 2", order=2)
        self.tournament = make_tournament(self.trainer)
        self.cat = make_category(self.tournament)
        self.rnd = make_round(self.cat)
        self.a1 = make_athlete(self.trainer, first="Ан", last="Первый")
        self.a2 = make_athlete(self.trainer, first="Бо", last="Второй")
        self.client.force_authenticate(self.trainer)

    def set_url(self, m):
        return f"/api/tournament/matches/{m.id}/set_tatami/"

    def test_finished_cannot_be_reassigned(self):
        m = make_match(self.rnd, 1, self.a1, self.a2, status=Match.STATUS_FINISHED)
        r = self.client.post(self.set_url(m), {"tatami_id": self.t1.id})
        self.assertEqual(r.status_code, 400, r.content)

    def test_bye_cannot_be_assigned(self):
        m = make_match(self.rnd, 1, self.a1, None, status=Match.STATUS_BYE)
        r = self.client.post(self.set_url(m), {"tatami_id": self.t1.id})
        self.assertEqual(r.status_code, 400, r.content)

    def test_live_match_cannot_be_moved(self):
        m = make_match(self.rnd, 1, self.a1, self.a2, status=Match.STATUS_IN_PROGRESS)
        m.tatami = self.t1
        m.save()
        r = self.client.post(self.set_url(m), {"tatami_id": self.t2.id})
        self.assertEqual(r.status_code, 400, r.content)

    def test_athlete_busy_on_other_tatami(self):
        live = make_match(self.rnd, 1, self.a1, self.a2, status=Match.STATUS_IN_PROGRESS)
        live.tatami = self.t1
        live.save()
        nxt = make_match(self.rnd, 2, self.a1, make_athlete(self.trainer, first="Си", last="Третий"))
        r = self.client.post(self.set_url(nxt), {"tatami_id": self.t2.id})
        self.assertEqual(r.status_code, 400, r.content)
        # Тот же татами — очередь последовательна, можно.
        r2 = self.client.post(self.set_url(nxt), {"tatami_id": self.t1.id})
        self.assertEqual(r2.status_code, 200, r2.content)

    def test_inactive_category_needs_force(self):
        cat2 = make_category(self.tournament, name="Позже", order=1)
        rnd2 = make_round(cat2)
        m = make_match(rnd2, 1, self.a1, self.a2)
        r = self.client.post(self.set_url(m), {"tatami_id": self.t1.id})
        self.assertEqual(r.status_code, 400, r.content)
        r2 = self.client.post(
            self.set_url(m), {"tatami_id": self.t1.id, "force": True}
        )
        self.assertEqual(r2.status_code, 200, r2.content)

    def test_force_does_not_bypass_busy_athlete(self):
        live = make_match(self.rnd, 1, self.a1, self.a2, status=Match.STATUS_IN_PROGRESS)
        live.tatami = self.t1
        live.save()
        cat2 = make_category(self.tournament, name="Позже", order=1)
        rnd2 = make_round(cat2)
        m = make_match(rnd2, 1, self.a1, make_athlete(self.trainer, first="Ди", last="Чет"))
        r = self.client.post(
            self.set_url(m), {"tatami_id": self.t2.id, "force": True}
        )
        self.assertEqual(r.status_code, 400, r.content)

    def test_unknown_tatami_400(self):
        m = make_match(self.rnd, 1, self.a1, self.a2)
        r = self.client.post(self.set_url(m), {"tatami_id": 99999})
        self.assertEqual(r.status_code, 400, r.content)
