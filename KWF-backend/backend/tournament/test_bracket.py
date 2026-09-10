"""Этап 3: сетка корректна для 2-16 участников, BYE без пустых пар."""
from datetime import date

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import Profile
from tournament import services
from tournament.models import (
    Athlete, Match, Round, Tournament, TournamentCategory,
)

User = get_user_model()


def make_trainer(username="trainer_b"):
    u = User.objects.create_user(username=username, password="pass12345")
    Profile.objects.update_or_create(user=u, defaults={"role": "trainer"})
    return User.objects.get(pk=u.pk)


def make_setup(trainer, n, tag):
    t = Tournament.objects.create(
        name=f"Кубок {tag}", slug=f"cup-{tag}-{n}",
        start_date=date(2026, 10, 1), end_date=date(2026, 10, 2),
        status=Tournament.STATUS_PUBLISHED, created_by=trainer,
    )
    cat = TournamentCategory.objects.create(
        tournament=t, name=f"Кат {tag}", age_min=8, age_max=12,
        weight_max=60, gender="male", order=0,
    )
    athletes = [
        Athlete.objects.create(
            trainer=trainer, first_name=f"Им{i}", last_name=f"{tag}ов",
            birth_date=date(2015, 5, 1), weight=30 + i, gender="male",
        )
        for i in range(n)
    ]
    return cat, athletes


def next_pow2(n):
    p = 1
    while p < n:
        p *= 2
    return p


class BracketMatrixTests(APITestCase):
    def setUp(self):
        self.trainer = make_trainer()

    def test_matrix_2_to_16(self):
        for n in range(2, 17):
            with self.subTest(n=n):
                cat, athletes = make_setup(self.trainer, n, tag=f"m{n}")
                res = services.generate_bracket(cat, athletes)
                size = next_pow2(n)
                self.assertTrue(res["success"], res)
                self.assertEqual(res["byes_count"], size - n)

                matches = list(Match.objects.filter(round__category=cat))
                r1 = [m for m in matches if m.round.order == 1]
                # В первом раунде нет пустых пар (раунды 2+ создаются
                # пустыми и заполняются продвижением победителей).
                for m in r1:
                    self.assertFalse(
                        m.athlete1_id is None and m.athlete2_id is None,
                        f"n={n}: пустая пара в матче {m.id}",
                    )
                byes = [m for m in r1 if m.status == Match.STATUS_BYE]
                real = [m for m in r1 if m.status == Match.STATUS_READY]
                self.assertEqual(len(byes), size - n)
                self.assertEqual(len(real), (n - (size - n)) // 2)
                for b in byes:
                    # Ровно один участник и зафиксированный победитель.
                    self.assertTrue(bool(b.athlete1_id) != bool(b.athlete2_id))
                    self.assertIsNotNone(b.winner_id)
                # Всего матчей в сетке = size - 1.
                self.assertEqual(len(matches), size - 1)

    def test_bye_winners_advanced_to_round2(self):
        cat, athletes = make_setup(self.trainer, 12, tag="bye12")
        services.generate_bracket(cat, athletes)
        r2 = list(Match.objects.filter(round__category=cat, round__order=2))
        self.assertTrue(len(r2) > 0)
        advanced = {
            a.id
            for m in r2
            for a in (m.athlete1, m.athlete2)
            if a is not None
        }
        bye_winners = set(
            Match.objects.filter(
                round__category=cat, round__order=1, status=Match.STATUS_BYE
            ).values_list("winner_id", flat=True)
        )
        self.assertEqual(len(bye_winners), 4)
        self.assertTrue(bye_winners <= advanced)


def play_to_champion(cat):
    """Проигрывает категорию до конца: побеждает всегда athlete1."""
    for _ in range(30):
        ready = list(
            Match.objects.filter(
                round__category=cat, status=Match.STATUS_READY,
                athlete1__isnull=False, athlete2__isnull=False,
            ).order_by("round__order", "match_number")
        )
        if not ready:
            waiting = Match.objects.filter(
                round__category=cat, status=Match.STATUS_WAITING,
                athlete1__isnull=False, athlete2__isnull=False,
            ).order_by("round__order").first()
            if not waiting:
                break
            services.start_round(waiting.round_id)
            continue
        for m in ready:
            r = services.finish_match(m.id, winner_id=m.athlete1_id)
            assert r["success"], r
    return Match.objects.filter(round__category=cat).exclude(
        status__in=(Match.STATUS_FINISHED, Match.STATUS_BYE)
    ).count()


class BracketPlaythroughTests(APITestCase):
    def setUp(self):
        self.trainer = make_trainer()

    def test_full_playthrough_12(self):
        cat, athletes = make_setup(self.trainer, 12, tag="play12")
        services.generate_bracket(cat, athletes)
        left = play_to_champion(cat)
        self.assertEqual(left, 0)
        final = Match.objects.get(round__category=cat, round__order=4)
        self.assertEqual(final.status, Match.STATUS_FINISHED)
        self.assertIsNotNone(final.winner_id)
        self.assertTrue(services.is_category_complete(cat))

    def test_full_playthrough_5(self):
        cat, athletes = make_setup(self.trainer, 5, tag="play5")
        services.generate_bracket(cat, athletes)
        left = play_to_champion(cat)
        self.assertEqual(left, 0)
        self.assertTrue(services.is_category_complete(cat))

    def test_regeneration_resets_rounds(self):
        cat, athletes = make_setup(self.trainer, 4, tag="regen")
        services.generate_bracket(cat, athletes)
        first_ids = set(Round.objects.filter(category=cat).values_list("id", flat=True))
        services.generate_bracket(cat, athletes)
        second_ids = set(Round.objects.filter(category=cat).values_list("id", flat=True))
        self.assertTrue(first_ids.isdisjoint(second_ids))


class FinishedGuardTests(APITestCase):
    def setUp(self):
        self.trainer = make_trainer(username="trainer_g")
        self.client.force_authenticate(self.trainer)
        self.cat, athletes = make_setup(self.trainer, 4, tag="guard")
        services.generate_bracket(self.cat, athletes)
        self.m1 = Match.objects.get(round__category=self.cat, round__order=1, match_number=1)
        self.m2 = Match.objects.get(round__category=self.cat, round__order=1, match_number=2)

    def match_url(self, m):
        return f"/api/tournament/matches/{m.id}/"

    def finish(self, m, winner_id=None):
        return self.client.post(
            f"/api/tournament/matches/{m.id}/finish_match/",
            {"winner_id": winner_id or m.athlete1_id},
            format="json",
        )

    def test_patch_finished_winner_forbidden(self):
        self.assertEqual(self.finish(self.m1).status_code, 200)
        r = self.client.patch(
            self.match_url(self.m1), {"winner": self.m1.athlete2_id}, format="json"
        )
        self.assertEqual(r.status_code, 400, r.content)

    def test_patch_finished_scores_forbidden(self):
        self.assertEqual(self.finish(self.m1).status_code, 200)
        r = self.client.patch(self.match_url(self.m1), {"score1": 9}, format="json")
        self.assertEqual(r.status_code, 400, r.content)

    def test_patch_transition_to_finished_forbidden(self):
        r = self.client.patch(
            self.match_url(self.m1),
            {"winner": self.m1.athlete1_id, "status": "finished"},
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)

    def test_double_finish_same_winner_idempotent(self):
        self.assertEqual(self.finish(self.m1).status_code, 200)
        nxt_before = Match.objects.filter(
            round__category=self.cat, round__order=2
        ).values_list("athlete1_id", "athlete2_id")
        r = self.finish(self.m1)
        self.assertEqual(r.status_code, 200, r.content)
        nxt_after = Match.objects.filter(
            round__category=self.cat, round__order=2
        ).values_list("athlete1_id", "athlete2_id")
        self.assertEqual(list(nxt_before), list(nxt_after))

    def test_finish_different_winner_rejected(self):
        self.assertEqual(self.finish(self.m1).status_code, 200)
        r = self.client.post(
            f"/api/tournament/matches/{self.m1.id}/finish_match/",
            {"winner_id": self.m1.athlete2_id},
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)

    def test_reopen_flow(self):
        self.assertEqual(self.finish(self.m1).status_code, 200)
        final4 = Match.objects.get(round__category=self.cat, round__order=2)
        self.assertEqual(final4.athlete1_id, self.m1.athlete1_id)
        r = self.client.post(f"/api/tournament/matches/{self.m1.id}/reopen/")
        self.assertEqual(r.status_code, 200, r.content)
        self.m1.refresh_from_db()
        final4.refresh_from_db()
        self.assertIsNone(self.m1.winner_id)
        self.assertEqual(self.m1.status, Match.STATUS_READY)
        self.assertIsNone(final4.athlete1_id)
        # Бой можно завершить заново с другим победителем.
        r2 = self.client.post(
            f"/api/tournament/matches/{self.m1.id}/finish_match/",
            {"winner_id": self.m1.athlete2_id},
            format="json",
        )
        self.assertEqual(r2.status_code, 200, r2.content)

    def test_reopen_blocked_when_next_started(self):
        self.assertEqual(self.finish(self.m1).status_code, 200)
        self.assertEqual(self.finish(self.m2).status_code, 200)
        final4 = Match.objects.get(round__category=self.cat, round__order=2)
        # Стартуем финал — переоткрытие полуфинала теперь опасно.
        self.client.post(f"/api/tournament/matches/{final4.id}/start_match/")
        r = self.client.post(f"/api/tournament/matches/{self.m1.id}/reopen/")
        self.assertEqual(r.status_code, 400, r.content)


class RoundStartTests(APITestCase):
    def setUp(self):
        self.trainer = make_trainer(username="trainer_r")
        self.client.force_authenticate(self.trainer)
        self.cat, athletes = make_setup(self.trainer, 4, tag="rounds")
        services.generate_bracket(self.cat, athletes)
        self.r1 = Round.objects.get(category=self.cat, order=1)
        self.r2 = Round.objects.get(category=self.cat, order=2)

    def test_start_next_round_too_early_rejected(self):
        r = self.client.post(f"/api/tournament/rounds/{self.r2.id}/start/")
        self.assertEqual(r.status_code, 400, r.content)

    def test_double_start_idempotent(self):
        r1 = self.client.post(f"/api/tournament/rounds/{self.r1.id}/start/")
        self.assertEqual(r1.status_code, 200, r1.content)
        r2 = self.client.post(f"/api/tournament/rounds/{self.r1.id}/start/")
        self.assertEqual(r2.status_code, 200, r2.content)

    def test_next_round_starts_after_prev_finished(self):
        self.client.post(f"/api/tournament/rounds/{self.r1.id}/start/")
        for m in Match.objects.filter(round=self.r1, status=Match.STATUS_READY):
            services.finish_match(m.id, winner_id=m.athlete1_id)
        r = self.client.post(f"/api/tournament/rounds/{self.r2.id}/start/")
        self.assertEqual(r.status_code, 200, r.content)


class CategoryMembersTests(APITestCase):
    def setUp(self):
        self.trainer = make_trainer(username="trainer_m")
        self.other = make_trainer(username="trainer_o")
        self.client.force_authenticate(self.trainer)
        self.cat, _ = make_setup(self.trainer, 2, tag="members")
        self.a1 = Athlete.objects.create(
            trainer=self.trainer, first_name="Но", last_name="Вый",
            birth_date=date(2015, 5, 1), weight=30, gender="male",
        )
        self.foreign = Athlete.objects.create(
            trainer=self.other, first_name="Чу", last_name="Жой",
            birth_date=date(2015, 5, 1), weight=30, gender="male",
        )

    def add_url(self):
        return f"/api/tournament/categories/{self.cat.id}/add_athletes/"

    def remove_url(self):
        return f"/api/tournament/categories/{self.cat.id}/remove_athlete/"

    def test_add_and_remove(self):
        r = self.client.post(self.add_url(), {"athlete_ids": [self.a1.id]}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["total"], 1)
        r2 = self.client.post(self.remove_url(), {"athlete_id": self.a1.id}, format="json")
        self.assertEqual(r2.status_code, 200, r2.content)
        self.assertEqual(r2.data["total"], 0)

    def test_add_foreign_forbidden(self):
        r = self.client.post(self.add_url(), {"athlete_ids": [self.foreign.id]}, format="json")
        self.assertEqual(r.status_code, 403, r.content)

    def test_members_frozen_after_bracket(self):
        athletes = list(Athlete.objects.filter(trainer=self.trainer)[:2])
        services.generate_bracket(self.cat, athletes)
        r = self.client.post(self.add_url(), {"athlete_ids": [self.a1.id]}, format="json")
        self.assertEqual(r.status_code, 400, r.content)
        victim = self.cat.athletes.first()
        r2 = self.client.post(self.remove_url(), {"athlete_id": victim.id}, format="json")
        self.assertEqual(r2.status_code, 400, r2.content)

    def test_parent_cannot_edit_members(self):
        from django.contrib.auth import get_user_model
        parent = get_user_model().objects.create_user(username="par_m", password="pass12345")
        Profile.objects.update_or_create(user=parent, defaults={"role": "parent"})
        self.client.force_authenticate(parent)
        r = self.client.post(self.add_url(), {"athlete_ids": [self.a1.id]}, format="json")
        self.assertEqual(r.status_code, 403, r.content)
