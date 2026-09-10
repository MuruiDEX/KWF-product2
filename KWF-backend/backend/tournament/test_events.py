"""Этап 8: лента событий турнира — эмиссия, after, ordering, права."""
from datetime import date

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import Profile
from tournament import services
from tournament.models import (
    Athlete, Match, Round, Tournament, TournamentCategory, TournamentEvent,
)

User = get_user_model()


def make_trainer(username="trainer_e"):
    u = User.objects.create_user(username=username, password="pass12345")
    Profile.objects.update_or_create(user=u, defaults={"role": "trainer"})
    return User.objects.get(pk=u.pk)


def make_parent(username="parent_e"):
    u = User.objects.create_user(username=username, password="pass12345")
    Profile.objects.update_or_create(user=u, defaults={"role": "parent"})
    return User.objects.get(pk=u.pk)


def make_tournament(user, status=Tournament.STATUS_PUBLISHED, tag="ev"):
    t = Tournament.objects.create(
        name=f"Кубок {tag}", slug=f"cup-{tag}",
        start_date=date(2026, 10, 1), end_date=date(2026, 10, 2),
        status=status, created_by=user,
    )
    cat = TournamentCategory.objects.create(
        tournament=t, name=f"Кат {tag}", age_min=8, age_max=12,
        weight_max=60, gender="male", order=0,
    )
    rnd = Round.objects.create(category=cat, name="Финал", order=1)
    a1 = Athlete.objects.create(
        trainer=user, first_name="Ан", last_name="Первый",
        birth_date=date(2015, 5, 1), weight=35, gender="male",
    )
    a2 = Athlete.objects.create(
        trainer=user, first_name="Бо", last_name="Второй",
        birth_date=date(2015, 5, 1), weight=36, gender="male",
    )
    m = Match.objects.create(
        round=rnd, match_number=1, athlete1=a1, athlete2=a2,
        status=Match.STATUS_READY, fight_number=1,
    )
    return t, m


class EventEmissionTests(APITestCase):
    def setUp(self):
        self.trainer = make_trainer()
        self.client.force_authenticate(self.trainer)
        self.t, self.m = make_tournament(self.trainer)

    def events(self, after=0):
        return self.client.get(
            f"/api/tournament/tournaments/{self.t.id}/events/?after={after}"
        )

    def test_start_finish_emit_ordered_events(self):
        base = f"/api/tournament/matches/{self.m.id}"
        self.assertEqual(self.client.post(f"{base}/start_match/").status_code, 200)
        self.assertEqual(
            self.client.post(
                f"{base}/finish_match/", {"winner_id": self.m.athlete1_id}, format="json"
            ).status_code, 200,
        )
        r = self.events()
        self.assertEqual(r.status_code, 200, r.content)
        types = [e["type"] for e in r.data["events"]]
        # Единственный бой — он же финал: финиш завершает и раунд.
        self.assertEqual(types, ["match.started", "match.finished", "round.finished"])
        ids = [e["id"] for e in r.data["events"]]
        self.assertEqual(ids, sorted(ids))
        self.assertEqual(r.data["latest_id"], ids[-1])
        for e in r.data["events"]:
            self.assertEqual(e["tournament"], self.t.id)
            self.assertEqual(e["actor"], self.trainer.id)
        for e in r.data["events"]:
            if e["type"].startswith("match."):
                self.assertEqual(e["match"], self.m.id)

    def test_after_filters_and_resync(self):
        services.start_match(self.m.id, actor=self.trainer)
        first = self.events().data
        self.assertEqual(len(first["events"]), 1)
        # Ничего нового — пусто, latest_id тот же (resync-якорь).
        again = self.events(after=first["latest_id"]).data
        self.assertEqual(again["events"], [])
        self.assertEqual(again["latest_id"], first["latest_id"])
        services.finish_match(self.m.id, winner_id=self.m.athlete1_id, actor=self.trainer)
        tail = self.events(after=first["latest_id"]).data
        self.assertEqual(
            [e["type"] for e in tail["events"]], ["match.finished", "round.finished"]
        )

    def test_round_and_members_events(self):
        cat = self.t.categories.get()
        r1 = self.client.post(f"/api/tournament/rounds/{cat.rounds.get().id}/start/")
        self.assertEqual(r1.status_code, 200, r1.content)
        types = [e["type"] for e in self.events().data["events"]]
        self.assertIn("round.started", types)

    def test_publish_emits(self):
        t2 = Tournament.objects.create(
            name="Черновик", slug="draft-ev",
            start_date=date(2026, 10, 1), end_date=date(2026, 10, 2),
            status=Tournament.STATUS_DRAFT, created_by=self.trainer,
        )
        r = self.client.patch(
            f"/api/tournament/tournaments/{t2.id}/",
            {"status": "published"}, format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        ev = TournamentEvent.objects.filter(tournament=t2)
        self.assertEqual([e.type for e in ev], ["tournament.updated"])


class EventPermissionTests(APITestCase):
    def setUp(self):
        self.trainer = make_trainer(username="tr_ep")
        self.parent = make_parent()
        self.pub, _ = make_tournament(self.trainer, tag="pub")
        self.draft, _ = make_tournament(
            self.trainer, status=Tournament.STATUS_DRAFT, tag="drf"
        )

    def url(self, t, after=0):
        return f"/api/tournament/tournaments/{t.id}/events/?after={after}"

    def test_anon_published_ok_draft_hidden(self):
        self.assertEqual(self.client.get(self.url(self.pub)).status_code, 200)
        self.assertEqual(self.client.get(self.url(self.draft)).status_code, 404)

    def test_parent_published_ok_draft_hidden(self):
        self.client.force_authenticate(self.parent)
        self.assertEqual(self.client.get(self.url(self.pub)).status_code, 200)
        self.assertEqual(self.client.get(self.url(self.draft)).status_code, 404)

    def test_owner_sees_draft(self):
        self.client.force_authenticate(self.trainer)
        self.assertEqual(self.client.get(self.url(self.draft)).status_code, 200)
