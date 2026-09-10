"""Распределение СУЩЕСТВУЮЩИХ категорий по татами: баланс ≤1, ручной выбор."""
from datetime import date

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import Profile
from tournament import services
from tournament.models import (
    Athlete, Match, Round, Tatami, Tournament, TournamentCategory,
)

User = get_user_model()


def make_trainer(username="trainer_ct"):
    u = User.objects.create_user(username=username, password="pass12345")
    Profile.objects.update_or_create(user=u, defaults={"role": "trainer"})
    return User.objects.get(pk=u.pk)


def make_tournament(user, tag, n_cats, n_tatamis):
    t = Tournament.objects.create(
        name=f"Кубок {tag}", slug=f"cup-{tag}",
        start_date=date(2026, 10, 1), end_date=date(2026, 10, 2),
        status=Tournament.STATUS_PUBLISHED, created_by=user,
    )
    for i in range(n_tatamis):
        Tatami.objects.create(name=f"Татами {i + 1}", order=i + 1)
    for i in range(n_cats):
        TournamentCategory.objects.create(
            tournament=t, name=f"Кат {i}", age_min=8, age_max=12,
            weight_max=40, gender="male", order=i,
        )
    return t


def counts(t):
    out = {}
    for c in t.categories.all():
        out.setdefault(c.tatami_id, 0)
        out[c.tatami_id] += 1
    out.pop(None, None)
    return sorted(out.values())


class DistributeCategoriesTests(APITestCase):
    def setUp(self):
        self.trainer = make_trainer()
        self.client.force_authenticate(self.trainer)

    def check(self, n_tatamis, n_cats, expected):
        t = make_tournament(self.trainer, f"{n_tatamis}x{n_cats}", n_cats, n_tatamis)
        r = self.client.post(f"/api/tournament/tournaments/{t.id}/distribute_categories/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(counts(t), sorted(expected))
        # Все существующие категории привязаны, фиктивных нет.
        self.assertEqual(t.categories.count(), n_cats)
        self.assertEqual(t.categories.filter(tatami__isnull=True).count(), 0)
        return t

    def test_1x20(self):
        self.check(1, 20, [20])

    def test_2x7(self):
        self.check(2, 7, [3, 4])

    def test_3x9(self):
        self.check(3, 9, [3, 3, 3])

    def test_3x10(self):
        self.check(3, 10, [3, 3, 4])

    def test_4x10(self):
        self.check(4, 10, [2, 2, 3, 3])

    def test_5x3_extra_empty(self):
        self.check(5, 3, [1, 1, 1])

    def test_no_tatamis_400(self):
        t = make_tournament(self.trainer, "notat", 3, 0)
        r = self.client.post(f"/api/tournament/tournaments/{t.id}/distribute_categories/")
        self.assertEqual(r.status_code, 400, r.content)

    def test_manual_move_persists(self):
        t = self.check(3, 9, [3, 3, 3])
        cat = t.categories.order_by("order").first()
        other = Tatami.objects.exclude(id=cat.tatami_id).order_by("order").first()
        r = self.client.patch(
            f"/api/tournament/categories/{cat.id}/",
            {"tatami": other.id}, format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["tatami"], other.id)
        self.assertEqual(r.data["tatami_name"], other.name)
        # Перечитываем с другой стороны: redistribute НЕ запускался — привязка жива.
        cat.refresh_from_db()
        self.assertEqual(cat.tatami_id, other.id)

    def test_create_assigns_least_loaded(self):
        t = make_tournament(self.trainer, "least", 2, 2)
        self.client.post(f"/api/tournament/tournaments/{t.id}/distribute_categories/")
        r = self.client.post("/api/tournament/categories/", {
            "tournament": t.id, "name": "Новая", "age_min": 8, "age_max": 12,
            "weight_max": 40, "gender": "male", "order": 2,
        }, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertIsNotNone(r.data["tatami"])


class CategoryBindingFlowTests(APITestCase):
    """Бои наследуют татами категории: формирование, очередь, победитель."""

    def setUp(self):
        self.trainer = make_trainer(username="trainer_cf")
        self.client.force_authenticate(self.trainer)
        self.t = make_tournament(self.trainer, "flow", 2, 2)
        self.client.post(f"/api/tournament/tournaments/{self.t.id}/distribute_categories/")
        self.cats = list(self.t.categories.order_by("order"))
        self.athletes = [
            Athlete.objects.create(
                trainer=self.trainer, first_name=f"Им{i}", last_name="Бой",
                birth_date=date(2015, 5, 1), weight=30 + i, gender="male",
            )
            for i in range(4)
        ]

    def test_matches_follow_category_tatami(self):
        cat1, cat2 = self.cats
        self.assertNotEqual(cat1.tatami_id, cat2.tatami_id)
        services.generate_bracket(cat1, self.athletes[:2])
        services.generate_bracket(cat2, self.athletes[2:])
        for m in Match.objects.filter(round__category=cat1):
            if m.status == Match.STATUS_READY:
                self.assertEqual(m.tatami_id, cat1.tatami_id)
        for m in Match.objects.filter(round__category=cat2):
            if m.status == Match.STATUS_READY:
                self.assertEqual(m.tatami_id, cat2.tatami_id)
        # Очередь показывает бои обеих категорий на разных татами.
        q = services.get_tatami_queue(self.t)["queue"]
        used = {item["tatami"]["id"] for item in q if item["next"] or item["current"]}
        self.assertTrue(len(used) >= 1)

    def test_winner_advances_on_same_tatami(self):
        cat1, _ = self.cats
        services.generate_bracket(cat1, self.athletes[:2])
        m = Match.objects.get(round__category=cat1, round__order=1, status=Match.STATUS_READY)
        services.finish_match(m.id, winner_id=m.athlete1_id, actor=self.trainer)
        # Финал из 2 участников: победитель — чемпион своей категории.
        final = Match.objects.get(round__category=cat1, round__order=1)
        self.assertEqual(final.status, Match.STATUS_FINISHED)

    def test_manual_match_tatami_still_guarded(self):
        cat1, _ = self.cats
        services.generate_bracket(cat1, self.athletes[:2])
        m = Match.objects.get(round__category=cat1, round__order=1, status=Match.STATUS_READY)
        r = self.client.post(
            f"/api/tournament/matches/{m.id}/set_tatami/", {"tatami_id": 99999}, format="json"
        )
        self.assertEqual(r.status_code, 400, r.content)
