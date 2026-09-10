from django.db import transaction
from django.db.models import Q, F
from .models import TournamentCategory, Round, Match, TournamentRegistration, Athlete, Tatami, TournamentEvent
from datetime import timedelta

DEFAULT_MATCH_DURATION = 120


def _log_action(match, actor, action, winner_id=None, score1=None, score2=None, detail=""):
    """Записывает действие судьи в журнал (внутри текущей транзакции)."""
    from .models import MatchActionLog

    actor_id = None
    if actor is not None and getattr(actor, "is_authenticated", False):
        actor_id = getattr(actor, "id", None)
    return MatchActionLog.objects.create(
        match=match,
        actor_id=actor_id,
        action=action,
        winner_id=winner_id,
        score1=score1,
        score2=score2,
        detail=detail or "",
    )


def emit_event(tournament, type, actor=None, match=None, round=None, category=None):
    """Одно realtime-событие на мутирующий запрос. Только добавление строк."""
    actor_id = None
    if actor is not None and getattr(actor, "is_authenticated", False):
        actor_id = getattr(actor, "id", None)

    def _id(o):
        return o.id if hasattr(o, "id") else o

    t_id = tournament.id if hasattr(tournament, "id") else tournament
    return TournamentEvent.objects.create(
        tournament_id=t_id,
        type=type,
        match_id=_id(match),
        round_id=_id(round),
        category_id=_id(category),
        actor_id=actor_id,
    )

def generate_categories(tournament):
    """
    Automatically creates categories based on registered athletes.
    Groups by gender and weight distributions.
    Идемпотентно по имени: повторный вызов не дублирует, а обновляет состав.
    Диапазоны смежные без дыр: (prev_max, max_w].
    """
    from decimal import Decimal

    registrations = TournamentRegistration.objects.filter(tournament=tournament).select_related('athlete')
    athletes = [r.athlete for r in registrations]

    if not athletes:
        return []

    # Separate by gender
    males = [a for a in athletes if a.gender == 'male']
    females = [a for a in athletes if a.gender == 'female']

    created_categories = []

    with transaction.atomic():
        order_base = 0
        for gender, group in [('male', males), ('female', females)]:
            if not group:
                continue

            # Sort by weight to determine ranges
            weights = sorted([a.weight for a in group])

            # Simple weight range logic: split into 3-5 categories based on distribution
            # In a real scenario, this would follow official competition rules
            if len(weights) <= 5:
                ranges = [(weights[0], weights[-1])]
            else:
                # Квантили через stdlib (numpy нет в зависимостях).
                from statistics import quantiles

                q25, q50, q75 = quantiles([float(w) for w in weights], n=4)
                bounds = [Decimal(str(q)) for q in (q25, q50, q75)]
                ranges = [
                    (weights[0], bounds[0]),
                    (bounds[0], bounds[1]),
                    (bounds[1], bounds[2]),
                    (bounds[2], weights[-1]),
                ]

            for i, (min_w, max_w) in enumerate(ranges):
                name = f"{'Мальчики' if gender == 'male' else 'Девочки'} - до {max_w} кг"
                cat, _ = TournamentCategory.objects.update_or_create(
                    tournament=tournament,
                    name=name,
                    defaults={
                        "age_min": 0,
                        "age_max": 100,
                        "weight_max": max_w,
                        "gender": gender,
                        "order": order_base + i,
                    },
                )
                # Смежные диапазоны без дыр: (prev_max, max_w].
                prev_max = ranges[i - 1][1] if i > 0 else None
                if prev_max is None:
                    cat_athletes = [a for a in group if a.weight <= max_w]
                else:
                    cat_athletes = [
                        a for a in group if a.weight <= max_w and a.weight > prev_max
                    ]
                cat.athletes.set(cat_athletes)
                created_categories.append(cat)
            order_base += len(ranges)

    return created_categories


def _tatami_state(tournament):
    """Текущая загрузка татами и занятость спортсменов (только живые бои)."""
    from .models import Tatami, Match
    tatamis = list(Tatami.objects.all().order_by("order"))
    load: dict = {t.id: 0 for t in tatamis}
    athlete_tatamis: dict = {}
    assigned = (
        Match.objects.filter(
            round__category__tournament=tournament,
            tatami__isnull=False,
        )
        .exclude(status__in=[Match.STATUS_FINISHED, Match.STATUS_BYE])
        .select_related("tatami")
    )
    for m in assigned:
        load[m.tatami_id] = load.get(m.tatami_id, 0) + 1
        for aid in (m.athlete1_id, m.athlete2_id):
            if aid:
                athlete_tatamis.setdefault(aid, set()).add(m.tatami_id)
    return tatamis, load, athlete_tatamis


def _capacity_cap(tournament):
    """Мягкий предел живых боёв на одном татами.

    Держит загрузку равномерной: ceil(всего живых / число татами) + 1,
    минимум 2. Превышение возможно только ради безопасности спортсмена
    (его бои остаются на одном татами и идут строго по очереди).
    """
    import math

    from .models import Tatami, Match

    n = Tatami.objects.count() or 1
    live = (
        Match.objects.filter(
            round__category__tournament=tournament, tatami__isnull=False
        )
        .exclude(status__in=[Match.STATUS_FINISHED, Match.STATUS_BYE])
        .count()
    )
    unassigned = Match.objects.filter(
        round__category__tournament=tournament,
        status=Match.STATUS_READY,
        tatami__isnull=True,
    ).count()
    return max(2, math.ceil((live + unassigned) / n) + 1)


def _pick_tatami(athlete_ids, tatamis, load, athlete_tatamis, cap=None):
    """Выбирает татами с учётом зависимостей.

    Если у спортсменов уже есть незавершённые бои на каких-то татами —
    новый бой ставится на то же татами (бои одного спортсмена идут строго
    последовательно в очереди татами). Иначе — на наименее загруженное
    в пределах capacity cap.
    """
    aids = [a for a in athlete_ids if a]
    busy: set = set()
    for aid in aids:
        busy |= athlete_tatamis.get(aid, set())
    pool = [t for t in tatamis if t.id in busy] if busy else list(tatamis)
    if not pool:
        pool = list(tatamis)
    if cap is not None:
        eligible = [t for t in pool if load.get(t.id, 0) < cap]
        # Переполнение affinity-пула игнорируем (безопасность важнее),
        # свободный выбор переливаем на другие татами.
        if eligible or not busy:
            pool = eligible or pool
    best = min(pool, key=lambda t: (load.get(t.id, 0), t.order))
    load[best.id] = load.get(best.id, 0) + 1
    for aid in aids:
        athlete_tatamis.setdefault(aid, set()).add(best.id)
    return best


def _auto_assign_tatami(match):
    """Назначает матчу подходящее татами (только если слот свободен).

    Приоритет — привязка категории: бой наследует татами своей категории
    (параллельные категории идут одновременно на разных татами).
    Без привязки — старое поведение: только активная категория, affinity.
    """
    if match.tatami_id:
        return
    category = match.round.category
    if category.tatami_id:
        match.tatami_id = category.tatami_id
        match.save(update_fields=["tatami"])
        return
    active = get_active_category(category.tournament)
    if active is None or active.id != category.id:
        return
    tatamis, load, busy = _tatami_state(category.tournament)
    if not tatamis:
        return
    match.tatami = _pick_tatami(
        [match.athlete1_id, match.athlete2_id],
        tatamis,
        load,
        busy,
        cap=_capacity_cap(category.tournament),
    )
    match.save(update_fields=["tatami"])


def apply_category_tatami(category, tatami):
    """Привязка категории к татами + перенос ЕЩЁ НЕ НАЧАТЫХ боёв.

    Идущие (in_progress/paused), завершённые и BYE не трогаем никогда.
    Один код для авто- и ручного назначения — поведение предсказуемо.
    Возвращает число перенесённых боёв.
    """
    category.tatami = tatami
    category.save(update_fields=["tatami"])
    moved = (
        Match.objects.filter(
            round__category=category,
            status__in=[Match.STATUS_WAITING, Match.STATUS_READY],
        ).update(tatami=tatami)
    )
    return moved


def distribute_categories_to_tatamis(tournament, actor=None):
    """Равномерно раскладывает СУЩЕСТВУЮЩИЕ категории по татами.

    Round-robin по порядку категорий: разница — максимум 1, фиктивных
    категорий нет, лишние татами остаются пустыми. Запускается только
    явным действием (ручной выбор после этого не перезаписывается).
    """
    from .models import Tatami

    tatamis = list(Tatami.objects.all().order_by("order", "id"))
    if not tatamis:
        return {"success": False, "error": "Нет настроенных татами — добавьте хотя бы один."}
    cats = list(tournament.categories.order_by("order", "id"))
    if not cats:
        return {"success": True, "distributed": {}, "moved_matches": 0}

    with transaction.atomic():
        moved_total = 0
        plan = {}
        for i, cat in enumerate(cats):
            tatami = tatamis[i % len(tatamis)]
            moved_total += apply_category_tatami(cat, tatami)
            plan.setdefault(tatami.id, []).append(cat.id)
        emit_event(
            tournament.id if hasattr(tournament, "id") else tournament,
            TournamentEvent.CATEGORY_MEMBERS,
            actor,
        )
    return {"success": True, "distributed": plan, "moved_matches": moved_total}


def least_loaded_tatami():
    """Татами с наименьшим числом привязанных категорий (для новых)."""
    from .models import Tatami, TournamentCategory

    tatamis = list(Tatami.objects.all().order_by("order", "id"))
    if not tatamis:
        return None
    counts = {t.id: 0 for t in tatamis}
    for row in TournamentCategory.objects.filter(
        tatami__isnull=False
    ).values("tatami_id"):
        counts[row["tatami_id"]] = counts.get(row["tatami_id"], 0) + 1
    return min(tatamis, key=lambda t: (counts.get(t.id, 0), t.order, t.id))


def _advance_winner(match, winner):
    """Переносит победителя в соответствующий слот следующего матча.

    Возвращает следующий матч или None. Статус исходного матча не меняется
    (важно для BYE: матч остаётся помеченным как автопроход).
    """
    next_match = (
        Match.objects.select_for_update().filter(
            Q(previous_match1=match) | Q(previous_match2=match)
        )
        .select_related("round", "round__category", "athlete1", "athlete2")
        .first()
    )
    if not next_match:
        return None
    if next_match.previous_match1_id == match.id:
        next_match.athlete1 = winner
    else:
        next_match.athlete2 = winner
    if next_match.athlete1 and next_match.athlete2:
        next_match.status = Match.STATUS_READY
        next_match.save()
        _auto_assign_tatami(next_match)
    elif not next_match.athlete1 and not next_match.athlete2:
        next_match.status = Match.STATUS_WAITING
        next_match.save()
    else:
        next_match.save()
    return next_match


def generate_bracket(category, athletes_list=None, actor=None):
    """
    Генерирует полноценную олимпийскую сетку на выбывание.
    Поддерживает любое количество участников с использованием BYE.
    
    Returns dict with: success, rounds_created, matches_created, byes_count
    """
    with transaction.atomic():
        if athletes_list is None:
            athletes_list = list(category.athletes.all())

        num_participants = len(athletes_list)
        if num_participants < 2:
            return {"success": False, "error": "Need at least 2 participants"}

        category.athletes.set(athletes_list)

        # Очищаем старые данные сетки перед перегенерацией
        Round.objects.filter(category=category).delete()

        # 1. Размер сетки — ближайшая степень двойки сверху.
        bracket_size = 1
        while bracket_size < num_participants:
            bracket_size *= 2

        num_byes = bracket_size - num_participants

        # 2. Пары первого раунда. BYE получают первые num_byes спортсменов
        # (топ посева): каждая BYE-пара — (спортсмен, None), пустых пар
        # (None, None) нет по построению. Остальные идут парами по порядку.
        # Инвариант: num_byes + 2 * len(real_pairs) == bracket_size.
        pairs = []
        idx = 0
        for _ in range(num_byes):
            pairs.append((athletes_list[idx], None))
            idx += 1
        while idx < num_participants:
            pairs.append((athletes_list[idx], athletes_list[idx + 1]))
            idx += 2

        if len(pairs) * 2 != bracket_size:
            return {"success": False, "error": "Bracket seeding invariant violated"}

        # Создаем раунды
        num_rounds = bracket_size.bit_length() - 1
        rounds = []
        round_names = {
            1: "Финал",
            2: "Полуфинал",
            3: "Четвертьфинал",
            4: "1/8 финала",
            5: "1/16 финала",
        }
        
        for i in range(num_rounds):
            round_name = round_names.get(num_rounds - i, f"Раунд {i+1}")
            r = Round.objects.create(
                category=category,
                name=round_name,
                order=i + 1
            )
            rounds.append(r)

        # 3. Создаем матчи первого раунда. BYE не создаёт реальный бой:
        # победитель фиксируется и сразу продвигается дальше (шаг 5),
        # на татами такие бои не попадают (распределяются только READY).
        prev_round_matches = []
        for match_number, (a1, a2) in enumerate(pairs, start=1):
            if a1 and not a2:
                status, winner = Match.STATUS_BYE, a1
            elif not a1 and a2:
                status, winner = Match.STATUS_BYE, a2
            else:
                status, winner = Match.STATUS_READY, None

            match = Match.objects.create(
                round=rounds[0],
                match_number=match_number,
                athlete1=a1,
                athlete2=a2,
                status=status,
                winner=winner,
                fight_number=match_number,
            )
            prev_round_matches.append(match)

        # 4. Создаем последующие раунды (связываем матчи)
        for r_idx in range(1, num_rounds):
            current_round_matches = []
            for i in range(0, len(prev_round_matches), 2):
                m1 = prev_round_matches[i]
                m2 = prev_round_matches[i+1] if (i+1) < len(prev_round_matches) else None

                match = Match.objects.create(
                    round=rounds[r_idx],
                    match_number=(i // 2) + 1,
                    previous_match1=m1,
                    previous_match2=m2,
                    status=Match.STATUS_WAITING,
                    fight_number=0
                )
                current_round_matches.append(match)
            prev_round_matches = current_round_matches

        # 5. BYE-победители сразу проходят в следующий раунд (статус BYE сохраняется)
        for bye_match in Match.objects.filter(
            round=rounds[0], status=Match.STATUS_BYE
        ).select_related("round"):
            winner = bye_match.winner
            if not winner:
                continue
            if bool(bye_match.athlete1) == bool(bye_match.athlete2):
                continue
            _advance_winner(bye_match, winner)

        # 6. Сразу распределяем готовые матчи по татами (если татами настроены)
        try:
            distribute_matches_to_tatamis(category.tournament)
        except Exception:
            pass

        emit_event(
            category.tournament_id,
            TournamentEvent.CATEGORY_BRACKET,
            actor,
            category=category,
        )

    return {
        "success": True,
        "rounds_created": len(rounds),
        "matches_created": Match.objects.filter(round__category=category).count(),
        "byes_count": num_byes,
        "total_participants": num_participants,
    }


def get_bracket_state(category):
    """
    Возвращает полное состояние сетки для фронтенда.
    """
    rounds = category.rounds.prefetch_related(
        "matches__athlete1",
        "matches__athlete2", 
        "matches__winner",
        "matches__tatami",
        "matches__previous_match1",
        "matches__previous_match2",
    ).order_by("order")
    
    result = {
        "category_id": category.id,
        "id": category.id,
        "name": category.name,
        "category_name": category.name,
        "gender": category.gender,
        "age_min": category.age_min,
        "age_max": category.age_max,
        "weight_max": str(category.weight_max),
        "order": category.order,
        "rounds": []
    }
    
    for round_obj in rounds:
        matches_data = []
        for match in round_obj.matches.order_by("match_number"):
            matches_data.append({
                "id": match.id,
                "match_number": match.match_number,
                "round_name": match.round.name,
                "round_order": match.round.order,
                "athlete1": {
                    "id": match.athlete1.id,
                    "name": f"{match.athlete1.last_name} {match.athlete1.first_name}",
                    "weight": str(match.athlete1.weight),
                    "age": match.athlete1.age,
                } if match.athlete1 else None,
                "athlete1_id": match.athlete1_id,
                "athlete1_name": f"{match.athlete1.last_name} {match.athlete1.first_name}" if match.athlete1 else None,
                "athlete2": {
                    "id": match.athlete2.id,
                    "name": f"{match.athlete2.last_name} {match.athlete2.first_name}",
                    "weight": str(match.athlete2.weight),
                    "age": match.athlete2.age,
                } if match.athlete2 else None,
                "athlete2_id": match.athlete2_id,
                "athlete2_name": f"{match.athlete2.last_name} {match.athlete2.first_name}" if match.athlete2 else None,
                "winner": {
                    "id": match.winner.id,
                    "name": f"{match.winner.last_name} {match.winner.first_name}",
                } if match.winner else None,
                "winner_id": match.winner_id,
                "winner_name": f"{match.winner.last_name} {match.winner.first_name}" if match.winner else None,
                "score1": match.score1,
                "score2": match.score2,
                "status": match.status,
                "start_time": match.start_time.isoformat() if match.start_time else None,
                "end_time": match.end_time.isoformat() if match.end_time else None,
                "tatami": {
                    "id": match.tatami.id,
                    "name": match.tatami.name,
                } if match.tatami else None,
                "tatami_name": match.tatami.name if match.tatami else None,
                "fight_number": match.fight_number,
                "previous_match1": match.previous_match1.id if match.previous_match1 else None,
                "previous_match2": match.previous_match2.id if match.previous_match2 else None,
            })
        
        result["rounds"].append({
            "id": round_obj.id,
            "name": round_obj.name,
            "order": round_obj.order,
            "status": round_obj.status,
            "matches": matches_data,
        })
    
    return result


def promote_winner(match_id, winner_id):
    """
    Promotes the winner of a match to the next round.
    Returns updated match info for frontend.
    """
    with transaction.atomic():
        try:
            match = Match.objects.select_for_update().select_related(
                "round", "round__category",
                "previous_match1", "previous_match2"
            ).get(id=match_id)
        except Match.DoesNotExist:
            raise
        try:
            winner = Athlete.objects.get(id=winner_id)
        except Athlete.DoesNotExist:
            raise
        if winner.id not in (match.athlete1_id, match.athlete2_id):
            raise ValueError("Победитель должен быть участником боя.")
        match.winner = winner
        match.status = Match.STATUS_FINISHED
        match.save(update_fields=["winner", "status"])
        _log_action(match, None, "finish", winner_id=winner.id)

        _advance_winner(match, winner)

    return True


def promote_winner_with_details(match_id, winner_id):
    """
    Promotes winner and returns detailed info for frontend updates.
    """
    with transaction.atomic():
        try:
            match = Match.objects.select_for_update().select_related(
                "round", "round__category",
                "athlete1", "athlete2", "winner",
                "previous_match1", "previous_match2"
            ).get(id=match_id)
        except Match.DoesNotExist:
            raise
        try:
            winner = Athlete.objects.get(id=winner_id)
        except Athlete.DoesNotExist:
            raise
        if winner.id not in (match.athlete1_id, match.athlete2_id):
            raise ValueError("Победитель должен быть участником боя.")
        match.winner = winner
        match.status = Match.STATUS_FINISHED
        match.save(update_fields=["winner", "status"])
        _log_action(match, None, "finish", winner_id=winner.id)

        next_match = _advance_winner(match, winner)
        if next_match:
            next_match = Match.objects.select_related(
                "round", "round__category", "athlete1", "athlete2", "winner", "tatami"
            ).get(id=next_match.id)

            return {
                "next_match": {
                    "id": next_match.id,
                    "round_order": next_match.round.order,
                    "match_number": next_match.match_number,
                    "athlete1": {
                        "id": next_match.athlete1.id,
                        "name": f"{next_match.athlete1.last_name} {next_match.athlete1.first_name}",
                    } if next_match.athlete1 else None,
                    "athlete2": {
                        "id": next_match.athlete2.id,
                        "name": f"{next_match.athlete2.last_name} {next_match.athlete2.first_name}",
                    } if next_match.athlete2 else None,
                    "status": next_match.status,
                }
            }

    return {"next_match": None}


def _category_matches(category):
    """Все матчи категории одним списком."""
    from .models import Match
    return list(
        Match.objects.filter(round__category=category).select_related("round")
    )


def is_category_complete(category):
    """Категория завершена, если есть матчи и все они сыграны (finished) или BYE."""
    from .models import Match
    matches = _category_matches(category)
    if not matches:
        return False
    return all(m.status in (Match.STATUS_FINISHED, Match.STATUS_BYE) for m in matches)


def get_category_schedule(tournament):
    """Порядок категорий турнира со статусами очереди.

    Первая незавершённая категория — активная, завершённые до неё — finished,
    остальные — waiting. Следующая категория начинается только после
    завершения предыдущей.
    """
    cats = list(tournament.categories.order_by("order", "id"))
    result = []
    active_found = False
    for cat in cats:
        complete = is_category_complete(cat)
        if complete:
            status = "finished"
        elif not active_found:
            status = "active"
            active_found = True
        else:
            status = "waiting"
        matches = _category_matches(cat)
        finished = sum(
            1 for m in matches if m.status in ("finished", "bye")
        )
        result.append({"category": cat, "status": status,
                       "total": len(matches), "finished": finished})
    return result


def get_active_category(tournament):
    """Активная (текущая) категория турнира или None, если все завершены."""
    for entry in get_category_schedule(tournament):
        if entry["status"] == "active":
            return entry["category"]
    return None


def distribute_matches_to_tatamis(tournament):
    """
    Раздаёт готовые бои без татами.

    Приоритет — привязка категории: бои идут на татами своей категории
    (параллельные категории — одновременно). Без привязки — старое
    поведение: только активная категория, affinity + cap.
    """
    from .models import Tatami, Match

    # Получаем все татами турнира
    tatamis = list(Tatami.objects.all().order_by('order'))
    if not tatamis:
        return {"success": False, "error": "Нет настроенных татами — добавьте хотя бы один."}

    # 1. Привязанные категории: все разом, по порядку сетки.
    bound_ready = list(
        Match.objects.filter(
            round__category__tournament=tournament,
            round__category__tatami__isnull=False,
            status=Match.STATUS_READY,
            tatami__isnull=True,
        ).select_related("round", "round__category").order_by("round__order", "match_number")
    )
    bound_n = 0
    bound_cat = None
    with transaction.atomic():
        for match in bound_ready:
            match.tatami_id = match.round.category.tatami_id
            bound_cat = match.round.category
        if bound_ready:
            Match.objects.bulk_update(bound_ready, ["tatami"])
            bound_n = len(bound_ready)
    if bound_n:
        emit_event(
            tournament.id if hasattr(tournament, "id") else tournament,
            TournamentEvent.MATCH_TATAMI,
            None,
            category=bound_cat,
        )

    # 2. Непривязанные — только активная категория (legacy).
    active = get_active_category(tournament)
    if not active:
        if not bound_n:
            if tournament.categories.exists():
                hint = "Все категории завершены — распределять нечего."
            else:
                hint = "В турнире пока нет категорий."
            return {"success": True, "distributed": 0, "waiting": 0, "hint": hint}
        return {"success": True, "distributed": bound_n, "waiting": 0}

    ready_matches = list(
        Match.objects.filter(
            round__category=active,
            round__category__tatami__isnull=True,
            status=Match.STATUS_READY,
            tatami__isnull=True,
        ).order_by("round__order", "match_number")
    )

    waiting = Match.objects.filter(
        round__category=active,
        status=Match.STATUS_WAITING,
        tatami__isnull=True,
    ).count()

    if not ready_matches:
        if not bound_n:
            if waiting:
                hint = (
                    "Готовых боёв нет, но есть ожидающие — "
                    "сначала стартуйте раунд."
                )
            else:
                hint = "Все готовые бои уже распределены."
            return {
                "success": True,
                "distributed": 0,
                "waiting": waiting,
                "hint": hint,
                "category_id": active.id,
            }
        return {
            "success": True,
            "distributed": bound_n,
            "waiting": waiting,
            "category_id": active.id,
        }

    tatamis, load, busy = _tatami_state(tournament)
    cap = _capacity_cap(tournament)

    # Последовательное планирование: каждый бой ставится с учётом
    # загруженности татами и занятости его спортсменов.
    with transaction.atomic():
        for match in ready_matches:
            match.tatami = _pick_tatami(
                [match.athlete1_id, match.athlete2_id], tatamis, load, busy, cap=cap
            )
        if ready_matches:
            Match.objects.bulk_update(ready_matches, ["tatami"])

    # Одно событие на всех (не per-match, чтобы не спамить).
    emit_event(
        active.tournament_id,
        TournamentEvent.MATCH_TATAMI,
        None,
        category=active,
    )
    return {"success": True, "distributed": len(ready_matches) + bound_n,
            "waiting": waiting, "category_id": active.id}


def get_tatami_queue(tournament):
    """
    Возвращает очередь боёв по татами для отображения тренеру.
    Всегда возвращает dict {"queue": [...], "recent_finished": [...]},
    даже если татами не настроены (тогда queue пуст).
    """
    from .models import Tatami, Match

    tatamis = list(Tatami.objects.all().order_by('order'))
    # Получаем все матчи турнира в порядке сетки: раунд, затем номер боя
    matches = Match.objects.filter(
        round__category__tournament=tournament
    ).select_related(
        "round", "round__category", "athlete1", "athlete2", "winner", "tatami"
    ).order_by("round__order", "match_number")

    if not tatamis:
        recent_finished = sorted(
            (m for m in matches if m.status == Match.STATUS_FINISHED),
            key=lambda m: (m.round.order, m.match_number),
            reverse=True,
        )[:8]
        return {
            "queue": [],
            "recent_finished": [_serialize_match(m) for m in recent_finished],
        }
    
    queue = []
    for tatami in tatamis:
        tatami_matches = [m for m in matches if m.tatami_id == tatami.id]

        # Текущий (in_progress или paused — бой на паузе остаётся на татами)
        current = next((m for m in tatami_matches if m.status == Match.STATUS_IN_PROGRESS), None)
        if current is None:
            current = next((m for m in tatami_matches if m.status == Match.STATUS_PAUSED), None)

        # Следующий (ready)
        next_match = next((m for m in tatami_matches if m.status == Match.STATUS_READY), None)

        # Ожидающие (waiting)
        waiting = [m for m in tatami_matches if m.status == Match.STATUS_WAITING]

        queue.append({
            "tatami": {"id": tatami.id, "name": tatami.name, "order": tatami.order},
            "current": _serialize_match(current) if current else None,
            "next": _serialize_match(next_match) if next_match else None,
            "waiting": [_serialize_match(m) for m in waiting],
        })

    # Недавно завершённые (для секции «Завершены»): свежие — позже по сетке.
    recent_finished = sorted(
        (m for m in matches if m.status == Match.STATUS_FINISHED),
        key=lambda m: (m.round.order, m.match_number),
        reverse=True,
    )[:8]

    return {
        "queue": queue,
        "recent_finished": [_serialize_match(m) for m in recent_finished],
    }


def _serialize_match(match):
    """Сериализует матч для очереди."""
    if not match:
        return None
    timer = match_timer_state(match)
    return {
        "id": match.id,
        "match_number": match.match_number,
        "round_name": match.round.name,
        "category_name": match.round.category.name,
        "athlete1": f"{match.athlete1.last_name} {match.athlete1.first_name}" if match.athlete1 else "TBD",
        "athlete1_id": match.athlete1.id if match.athlete1 else None,
        "athlete2": f"{match.athlete2.last_name} {match.athlete2.first_name}" if match.athlete2 else "TBD",
        "athlete2_id": match.athlete2.id if match.athlete2 else None,
        "status": match.status,
        "fight_number": match.fight_number,
        "duration_seconds": timer["duration"],
        "remaining_seconds": timer["remaining_seconds"],
        "timer_running": timer["running"],
        "timer_expired": timer["expired"],
    }


def match_timer_state(match):
    """Состояние таймера боя, вычисленное сервером.

    Устойчиво к reload: всё считается из started_at/accumulated_seconds/duration,
    хранящихся в БД. Возвращает dict: duration, elapsed, remaining, running.
    """
    from django.utils import timezone

    duration = match.duration_seconds
    if not duration:
        try:
            duration = match.round.category.match_duration
        except Exception:
            duration = DEFAULT_MATCH_DURATION
    elapsed = match.accumulated_seconds or 0
    running = (
        match.status == Match.STATUS_IN_PROGRESS and match.started_at is not None
    )
    if running:
        try:
            delta = (timezone.now() - match.started_at).total_seconds()
            elapsed += max(0, round(delta))
        except Exception:
            pass
    expired = duration > 0 and elapsed >= duration
    return {
        "duration": duration,
        "elapsed": elapsed,
        "remaining_seconds": max(0, duration - elapsed),
        "running": running,
        "expired": expired,
    }


def start_match(match_id, actor=None):
    """Начинает бой - меняет статус на IN_PROGRESS и запускает таймер."""
    from django.utils import timezone

    with transaction.atomic():
        match = Match.objects.select_for_update().select_related(
            "tatami", "round", "round__category"
        ).get(id=match_id)

        if match.status == Match.STATUS_IN_PROGRESS and match.started_at:
            return {"success": True, **match_timer_state(match)}
        if match.status not in (Match.STATUS_WAITING, Match.STATUS_READY):
            return {"success": False, "error": "Бой нельзя запустить из текущего статуса"}

        # Проверяем, нет ли уже активного боя на этом татами
        if match.tatami:
            active_on_tatami = Match.objects.filter(
                tatami=match.tatami,
                status=Match.STATUS_IN_PROGRESS
            ).exclude(id=match_id).exists()
            if active_on_tatami:
                return {"success": False, "error": "На этом татами уже идёт бой"}
        # Спортсмен не может одновременно драться в двух местах
        for aid in (match.athlete1_id, match.athlete2_id):
            if not aid:
                continue
            busy_elsewhere = Match.objects.filter(
                status=Match.STATUS_IN_PROGRESS
            ).filter(
                Q(athlete1_id=aid) | Q(athlete2_id=aid)
            ).exclude(id=match_id).exists()
            if busy_elsewhere:
                return {"success": False, "error": "Спортсмен уже участвует в другом идущем бое"}

        # Фиксируем лимит боя из категории при первом старте
        if not match.duration_seconds:
            try:
                match.duration_seconds = match.round.category.match_duration or DEFAULT_MATCH_DURATION
            except Exception:
                match.duration_seconds = DEFAULT_MATCH_DURATION
        match.started_at = timezone.now()
        match.status = Match.STATUS_IN_PROGRESS
        match.save(update_fields=["started_at", "status", "duration_seconds"])
        _log_action(match, actor, "start")
        emit_event(
            match.round.category.tournament_id,
            TournamentEvent.MATCH_STARTED,
            actor,
            match=match,
            round=match.round,
            category=match.round.category,
        )
        return {"success": True, **match_timer_state(match)}


def _finalize_timer(match):
    """Останавливает таймер, сохраняя набежавшее время в accumulated_seconds."""
    from django.utils import timezone

    if match.started_at:
        try:
            delta = (timezone.now() - match.started_at).total_seconds()
            match.accumulated_seconds = (match.accumulated_seconds or 0) + max(0, round(delta))
        except Exception:
            pass
        match.started_at = None


def _maybe_finish_round(match):
    """Если все бои раунда завершены — помечает раунд завершённым.

    Возвращает True, если раунд только что завершился.
    """
    rnd = match.round
    incomplete = (
        Match.objects.filter(round=rnd)
        .exclude(status__in=[Match.STATUS_FINISHED, Match.STATUS_BYE])
        .exists()
    )
    if not incomplete and rnd.status != Round.STATUS_FINISHED:
        rnd.status = Round.STATUS_FINISHED
        rnd.save(update_fields=["status"])
        return True
    return False


def start_round(round_id, actor=None):
    """Официальный старт раунда.

    Открывает (waiting → ready) бои с обоими участниками и сразу
    раздаёт им татами. Следующий раунд раньше времени не трогаем —
    проверка предыдущего раунда остаётся на вызывающей стороне.
    Идемпотентно: повторный старт возвращает успех без изменений.
    """
    with transaction.atomic():
        rnd = Round.objects.select_for_update().get(id=round_id)
        if rnd.status == Round.STATUS_FINISHED:
            return {"success": False, "error": "Раунд уже завершён"}
        if rnd.status == Round.STATUS_IN_PROGRESS:
            return {"success": True, "already": True, "opened": 0, "distributed": 0}
        opened = (
            Match.objects.filter(
                round=rnd,
                status=Match.STATUS_WAITING,
                athlete1__isnull=False,
                athlete2__isnull=False,
            ).update(status=Match.STATUS_READY)
        )
        rnd.status = Round.STATUS_IN_PROGRESS
        rnd.save(update_fields=["status"])
        try:
            dist = distribute_matches_to_tatamis(rnd.category.tournament)
        except Exception:
            dist = {"distributed": 0}
        emit_event(
            rnd.category.tournament_id,
            TournamentEvent.ROUND_STARTED,
            actor,
            round=rnd,
            category=rnd.category,
        )
        return {
            "success": True,
            "opened": opened,
            "distributed": dist.get("distributed", 0),
        }


def pause_match(match_id, actor=None):
    """Техническая пауза: таймер останавливается, бой можно продолжить."""
    with transaction.atomic():
        match = Match.objects.select_for_update().get(id=match_id)
        if match.status == Match.STATUS_PAUSED:
            return {"success": True, **match_timer_state(match)}
        if match.status != Match.STATUS_IN_PROGRESS or not match.started_at:
            return {"success": False, "error": "Бой сейчас не идёт"}
        _finalize_timer(match)
        match.status = Match.STATUS_PAUSED
        match.save()
        _log_action(match, actor, "pause")
        emit_event(
            match.round.category.tournament_id,
            TournamentEvent.MATCH_PAUSED,
            actor,
            match=match,
            round=match.round,
            category=match.round.category,
        )
        return {"success": True, **match_timer_state(match)}


def resume_match(match_id, actor=None):
    """Продолжить бой после паузы — таймер идёт с сохранённого времени."""
    from django.utils import timezone

    with transaction.atomic():
        match = Match.objects.select_for_update().select_related("tatami").get(id=match_id)
        if match.status == Match.STATUS_IN_PROGRESS and match.started_at:
            return {"success": True, **match_timer_state(match)}
        if match.status != Match.STATUS_PAUSED:
            return {"success": False, "error": "Бой не на паузе"}
        if match.tatami:
            active_on_tatami = Match.objects.filter(
                tatami=match.tatami,
                status=Match.STATUS_IN_PROGRESS
            ).exclude(id=match_id).exists()
            if active_on_tatami:
                return {"success": False, "error": "На этом татами уже идёт бой"}
        for aid in (match.athlete1_id, match.athlete2_id):
            if not aid:
                continue
            busy_elsewhere = Match.objects.filter(
                status=Match.STATUS_IN_PROGRESS
            ).filter(
                Q(athlete1_id=aid) | Q(athlete2_id=aid)
            ).exclude(id=match_id).exists()
            if busy_elsewhere:
                return {"success": False, "error": "Спортсмен уже участвует в другом идущем бое"}
        match.started_at = timezone.now()
        match.status = Match.STATUS_IN_PROGRESS
        match.save()
        _log_action(match, actor, "resume")
        emit_event(
            match.round.category.tournament_id,
            TournamentEvent.MATCH_RESUMED,
            actor,
            match=match,
            round=match.round,
            category=match.round.category,
        )
        return {"success": True, **match_timer_state(match)}


def finish_match(match_id, winner_id=None, score1=None, score2=None, actor=None):
    """Завершает бой, опционально указывая победителя и счет.

    Идемпотентно: повторный финиш с тем же победителем (исправление счёта
    допустимо) не продвигает победителя второй раз. Финиш с ДРУГИМ
    победителем отклоняется — сначала нужно переоткрыть бой (reopen_match).
    """
    with transaction.atomic():
        match = Match.objects.select_for_update().get(id=match_id)

        if match.status == Match.STATUS_FINISHED:
            if winner_id and winner_id != match.winner_id:
                return {
                    "success": False,
                    "error": "Бой уже завершён с другим победителем — сначала переоткройте его.",
                }
            if score1 is not None:
                if score1 < 0:
                    return {"success": False, "error": "Некорректный счёт"}
                match.score1 = score1
            if score2 is not None:
                if score2 < 0:
                    return {"success": False, "error": "Некорректный счёт"}
                match.score2 = score2
            match.save()
            _log_action(
                match, actor, "finish",
                winner_id=match.winner_id, score1=match.score1, score2=match.score2,
                detail="повтор",
            )
            emit_event(
                match.round.category.tournament_id,
                TournamentEvent.MATCH_FINISHED,
                actor,
                match=match,
                round=match.round,
                category=match.round.category,
            )
            return {"success": True, "already": True}

        if score1 is not None:
            if score1 < 0:
                return {"success": False, "error": "Некорректный счёт"}
            match.score1 = score1
        if score2 is not None:
            if score2 < 0:
                return {"success": False, "error": "Некорректный счёт"}
            match.score2 = score2
        effective_winner = winner_id if winner_id else match.winner_id
        if effective_winner:
            if effective_winner not in (match.athlete1_id, match.athlete2_id):
                return {"success": False, "error": "Победитель должен быть участником боя"}
            try:
                match.winner = Athlete.objects.get(id=effective_winner)
            except Athlete.DoesNotExist:
                return {"success": False, "error": "Спортсмен не найден."}

        _finalize_timer(match)
        match.status = Match.STATUS_FINISHED
        match.save()

        # Продвигаем победителя напрямую (без вложенной транзакции/повторного
        # SELECT): _advance_winner уже под select_for_update-транзакцией.
        if match.winner_id:
            _advance_winner(match, match.winner)

        _log_action(
            match, actor, "finish",
            winner_id=match.winner_id, score1=match.score1, score2=match.score2,
        )
        emit_event(
            match.round.category.tournament_id,
            TournamentEvent.MATCH_FINISHED,
            actor,
            match=match,
            round=match.round,
            category=match.round.category,
        )

        if _maybe_finish_round(match):
            emit_event(
                match.round.category.tournament_id,
                TournamentEvent.ROUND_FINISHED,
                actor,
                round=match.round,
                category=match.round.category,
            )

        # Если категория завершена — подтягиваем следующую очередь на татами
        try:
            distribute_matches_to_tatamis(match.round.category.tournament)
        except Exception:
            pass

        return {"success": True}


def reopen_match(match_id, actor=None):
    """Переоткрывает завершённый бой для исправления ошибки судьи.

    Разрешено, только если следующий бой ещё не начался и слот победителя
    можно чисто откатить. Иначе — 400 (править через администратора).
    Счёт и таймер сбрасываются, раунд при необходимости раззавершается.
    """
    with transaction.atomic():
        match = Match.objects.select_for_update().select_related("round").get(id=match_id)
        if match.status != Match.STATUS_FINISHED:
            return {"success": False, "error": "Переоткрыть можно только завершённый бой."}
        nxt = (
            Match.objects.select_for_update()
            .filter(Q(previous_match1=match) | Q(previous_match2=match))
            .select_related("round")
            .first()
        )
        if nxt is not None:
            if (
                nxt.status
                in (Match.STATUS_IN_PROGRESS, Match.STATUS_PAUSED, Match.STATUS_FINISHED)
                or nxt.winner_id
            ):
                return {
                    "success": False,
                    "error": "Следующий бой уже начался — исправление через администратора.",
                }
            if nxt.previous_match1_id == match.id:
                if nxt.athlete1_id != match.winner_id:
                    return {
                        "success": False,
                        "error": "Слот победителя уже перезаписан в следующем бое.",
                    }
                nxt.athlete1 = None
            else:
                if nxt.athlete2_id != match.winner_id:
                    return {
                        "success": False,
                        "error": "Слот победителя уже перезаписан в следующем бое.",
                    }
                nxt.athlete2 = None
            if not nxt.athlete1_id and not nxt.athlete2_id:
                nxt.status = Match.STATUS_WAITING
            nxt.save()
        match.winner = None
        match.started_at = None
        match.accumulated_seconds = 0
        match.score1 = 0
        match.score2 = 0
        if match.athlete1_id and match.athlete2_id:
            match.status = Match.STATUS_READY
        else:
            match.status = Match.STATUS_WAITING
        match.save()
        _log_action(match, actor, "reopen")
        emit_event(
            match.round.category.tournament_id,
            TournamentEvent.MATCH_REOPENED,
            actor,
            match=match,
            round=match.round,
            category=match.round.category,
        )
        rnd = match.round
        if rnd.status == Round.STATUS_FINISHED:
            rnd.status = Round.STATUS_IN_PROGRESS
            rnd.save(update_fields=["status"])
        return {"success": True}


def set_match_tatami(match_id, tatami_id, force=False, actor=None):
    """Ручное назначение татами судьёй.

    Главный инвариант абсолютен и не обходится даже через force:
    один спортсмен не может иметь живых боёв на разных татами.
    Также нельзя переназначать завершённые/BYE бои и двигать идущий бой.
    Флаг force обходит только проверку активной категории
    (судья осознанно ставит вперёд очереди).
    """
    with transaction.atomic():
        match = (
            Match.objects.select_for_update()
            .select_related("round", "round__category", "round__category__tournament")
            .get(id=match_id)
        )
        try:
            tatami = Tatami.objects.get(id=tatami_id)
        except Tatami.DoesNotExist:
            return {"success": False, "error": "Татами не найден."}
        if match.status in (Match.STATUS_FINISHED, Match.STATUS_BYE):
            return {"success": False, "error": "Завершённый бой нельзя переназначать."}
        if match.status == Match.STATUS_IN_PROGRESS:
            return {"success": False, "error": "Идущий бой нельзя переносить на другой татами."}
        if match.status not in (
            Match.STATUS_WAITING,
            Match.STATUS_READY,
            Match.STATUS_PAUSED,
        ):
            return {"success": False, "error": "Бой нельзя назначить из текущего статуса."}
        if not force:
            active = get_active_category(match.round.category.tournament)
            if active is not None and active.id != match.round.category_id:
                return {
                    "success": False,
                    "error": "Категория ещё не активна — дождитесь своей очереди.",
                }
        for aid in (match.athlete1_id, match.athlete2_id):
            if not aid:
                continue
            busy_elsewhere = (
                Match.objects.filter(status=Match.STATUS_IN_PROGRESS)
                .filter(Q(athlete1_id=aid) | Q(athlete2_id=aid))
                .exclude(id=match.id)
                .exclude(tatami_id=tatami.id)
                .exists()
            )
            if busy_elsewhere:
                return {
                    "success": False,
                    "error": "Спортсмен уже участвует в идущем бое на другом татами.",
                }
        match.tatami = tatami
        match.save(update_fields=["tatami"])
        _log_action(match, actor, "tatami", detail=tatami.name)
        emit_event(
            match.round.category.tournament_id,
            TournamentEvent.MATCH_TATAMI,
            actor,
            match=match,
            round=match.round,
            category=match.round.category,
        )
        return {"success": True}
