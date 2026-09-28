import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  API_URL,
  createAthleteViaApi,
  createCategoryViaApi,
  createTournamentViaApi,
  generateBracketViaApi,
  loginViaApi,
  loginViaUi,
  registerViaApi,
} from './helpers';

test.setTimeout(240000);

/** Manage Redesign: новая иерархия/плотность, пагинация выбора детей,
 * исправленный scope выбора, keyboard-табы, тёмная тема, mobile.
 * Глубина существующих flows — в control-center/weighin-station/referee-assign. */

interface ManageSetup {
  tournament: { id: number };
  owner: { username: string; password: string };
  tag: string;
}

async function setupManageTournament(request: APIRequestContext): Promise<ManageSetup> {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const tag = Date.now().toString(36);
  const kidIds: number[] = [];
  for (let i = 0; i < 20; i++) {
    const k = await createAthleteViaApi(
      request,
      headers,
      { last_name: `Searchable${i}_${tag}`, weight: 30 },
      i,
    );
    kidIds.push(k.id);
  }
  const ivan = await createAthleteViaApi(request, headers, { first_name: 'Ivan', last_name: `Petrov${tag}`, weight: 30 }, 20);
  const artem = await createAthleteViaApi(request, headers, { first_name: 'Artem', last_name: `Ivanov${tag}`, weight: 30 }, 21);
  kidIds.push(ivan.id, artem.id);
  const tournament = await createTournamentViaApi(request, headers);
  const category = await createCategoryViaApi(request, headers, tournament.id);
  const addRes = await request.post(
    `${API_URL}/api/tournament/categories/${category.id}/add_athletes/`,
    { headers, data: { athlete_ids: kidIds } },
  );
  expect(addRes.ok(), `add_athletes: ${await addRes.text()}`).toBeTruthy();
  await generateBracketViaApi(request, headers, category.id, kidIds);
  return { tournament, owner: coach, tag };
}

async function openManage(page: Page, tournamentId: number, owner: ManageSetup['owner'], tab = '') {
  await loginViaUi(page, owner.username, owner.password);
  await page.goto(`/cabinet/tournaments/${tournamentId}/manage${tab}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByText('Control Center').first()).toBeVisible({ timeout: 15000 });
}

test('redesign: manage opens with compact header', async ({ page, request }) => {
  const { tournament, owner } = await setupManageTournament(request);
  await openManage(page, tournament.id, owner);
  // Сценарий 1: шапка — название, статус, primary action, без простыни.
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Подготовить турнир|Открыть LIVE|Продолжить настройку/ }).first()).toBeVisible();
});

test('redesign: overview command center renders', async ({ page, request }) => {
  const { tournament, owner } = await setupManageTournament(request);
  await openManage(page, tournament.id, owner);
  // Сценарий 2: KPI + здоровье + следующий шаг + внимание/активность.
  await expect(page.getByText('Участники').first()).toBeVisible();
  const health = page.getByRole('group', { name: 'Операционное здоровье' });
  await expect(health).toBeVisible();
  for (const cell of ['Check-in', 'Weigh-in', 'Категории', 'Расписание', 'Сетки', 'Судьи']) {
    await expect(health.getByText(cell, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('Следующее действие').first()).toBeVisible();
});

test('redesign: participants search and load-more kept', async ({ page, request }) => {
  const { tournament, owner, tag } = await setupManageTournament(request);
  await openManage(page, tournament.id, owner, '?tab=participants');
  // Сценарии 3–4: поиск сужает список, сброс возвращает всех (22 ≤ порога 30 —
  // кнопка «Показать ещё» не нужна; порционная подгрузка — отдельным тестом ниже).
  await page.getByLabel('Поиск спортсмена в списке').fill(`Petrov${tag}`);
  await expect(
    page.getByRole('checkbox', { name: `Явка: Petrov${tag} Ivan` }),
  ).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: `Явка: Ivanov${tag} Artem` }),
  ).toHaveCount(0);
  await page.getByLabel('Поиск спортсмена в списке').fill('');
  await expect(
    page.getByRole('checkbox', { name: `Явка: Ivanov${tag} Artem` }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Показать ещё/ })).toHaveCount(0);
});

test('redesign: participants load-more reveals the tail', async ({ page, request }) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const tag = Date.now().toString(36);
  const ids: number[] = [];
  for (let i = 0; i < 35; i++) {
    const k = await createAthleteViaApi(
      request,
      headers,
      { last_name: `Loadmore${i}_${tag}`, weight: 30 },
      i,
    );
    ids.push(k.id);
  }
  const tournament = await createTournamentViaApi(request, headers);
  const category = await createCategoryViaApi(request, headers, tournament.id);
  const addRes = await request.post(
    `${API_URL}/api/tournament/categories/${category.id}/add_athletes/`,
    { headers, data: { athlete_ids: ids } },
  );
  expect(addRes.ok(), `add_athletes: ${await addRes.text()}`).toBeTruthy();
  await openManage(page, tournament.id, coach, '?tab=participants');
  // 35 > порога 30: хвост скрыт за кнопкой, клик раскрывает.
  const more = page.getByRole('button', { name: /Показать ещё \(5 из 35\)/ });
  await expect(more).toBeVisible({ timeout: 15000 });
  await more.click();
  await expect(page.getByRole('button', { name: /Показать ещё/ })).toHaveCount(0);
  await expect(
    page.getByRole('checkbox', { name: `Явка: Loadmore34_${tag} Athlete34` }),
  ).toBeVisible();
});

// ---------- Create Tournament: child selection ----------

interface CreateSetup {
  owner: { username: string; password: string };
  tag: string;
}

async function setupCreateAthletes(request: APIRequestContext): Promise<CreateSetup> {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const tag = Date.now().toString(36);
  for (let i = 0; i < 23; i++) {
    await createAthleteViaApi(
      request,
      headers,
      { last_name: `Redtest${i}_${tag}`, weight: 30, birth_date: '2015-03-10' },
      i,
    );
  }
  await createAthleteViaApi(
    request,
    headers,
    { first_name: 'Ivan', last_name: `Redsel${tag}`, weight: 30, birth_date: '2015-03-10' },
    23,
  );
  await createAthleteViaApi(
    request,
    headers,
    { first_name: 'Alisa', last_name: `Redsel${tag}`, weight: 30, birth_date: '2015-03-10' },
    24,
  );
  return { owner: coach, tag };
}

async function pagerGo(page: Page, dir: 'Далее' | 'Назад') {
  // Тап по кнопке пейджера под sticky-футером нестабилен в эмуляции —
  // идём через фокус + Enter (тот же keyboard-путь из §26).
  const btn = page
    .getByRole('navigation', { name: 'Страницы спортсменов' })
    .getByRole('button', { name: dir });
  await btn.focus();
  await page.keyboard.press('Enter');
}

async function openChildSelection(page: Page, owner: CreateSetup['owner'], tag: string) {
  await loginViaUi(page, owner.username, owner.password);
  await page.goto('/cabinet/tournaments/create', { waitUntil: 'domcontentloaded' });
  await page.locator('#t-name').fill(`Redesign Cup ${tag}`);
  await page.locator('#t-start-date').fill('2026-10-01');
  await page.locator('#t-end-date').fill('2026-10-05');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить категорию' }).click();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByText('Выбор участников').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Показано 1–20 из 25').first()).toBeVisible({ timeout: 15000 });
}

test('redesign: child selection pagination works', async ({ page, request }) => {
  const { owner, tag } = await setupCreateAthletes(request);
  await openChildSelection(page, owner, tag);
  // Сценарий 5: 25 кандидатов → 2 страницы (номера — desktop, счётчик — mobile).
  const pager = page.getByRole('navigation', { name: 'Страницы спортсменов' });
  await expect(pager).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) >= 640) {
    await expect(page.getByRole('button', { name: 'Страница 2' })).toBeVisible();
  }
  await pagerGo(page, 'Далее');
  await expect(page.getByText('Показано 21–25 из 25').first()).toBeVisible();
  await pagerGo(page, 'Назад');
  await expect(page.getByText('Показано 1–20 из 25').first()).toBeVisible();
});

test('redesign: child search by name works', async ({ page, request }) => {
  const { owner, tag } = await setupCreateAthletes(request);
  await openChildSelection(page, owner, tag);
  // Сценарий 6: поиск по фамилии находит обоих Redsel.
  await page.getByLabel('Поиск спортсмена по фамилии').fill(`Redsel${tag}`);
  await expect(page.getByText('Найдено: 2').first()).toBeVisible();
  await expect(page.getByText(`Redsel${tag}`, { exact: false }).first()).toBeVisible();
});

test('redesign: selection persists across pages', async ({ page, request }) => {
  const { owner, tag } = await setupCreateAthletes(request);
  await openChildSelection(page, owner, tag);
  // Сценарии 7–11: Иван на странице 1, Алиса на странице 2, обе выбраны.
  await page.getByRole('checkbox').first().click();
  await expect(page.getByText('Выбрано: 1').first()).toBeVisible();
  await pagerGo(page, 'Далее');
  await page.getByRole('checkbox').first().click();
  await expect(page.getByText('Выбрано: 2').first()).toBeVisible();
  await pagerGo(page, 'Назад');
  await expect(page.getByRole('checkbox').first()).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Выбрано: 2').first()).toBeVisible();
});

test('redesign: select page scope is page-only', async ({ page, request }) => {
  const { owner, tag } = await setupCreateAthletes(request);
  await openChildSelection(page, owner, tag);
  // Сценарий 12: «Выбрать страницу» — только 20 текущей, страница 2 чиста.
  await page.getByRole('button', { name: 'Выбрать страницу' }).click();
  await expect(page.getByText('Выбрано: 20').first()).toBeVisible();
  await pagerGo(page, 'Далее');
  await expect(page.getByRole('checkbox').first()).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('Выбрано: 20').first()).toBeVisible();
  // Снятие страницы 1 убирает только её 20.
  await pagerGo(page, 'Назад');
  await page.getByRole('button', { name: 'Снять страницу' }).click();
  await expect(page.getByText('Выбрано: 0').first()).toBeVisible();
});

test('redesign: select found covers filtered set', async ({ page, request }) => {
  const { owner, tag } = await setupCreateAthletes(request);
  await openChildSelection(page, owner, tag);
  // Сценарий 13: поиск → «Выбрать найденных (2)» → остальные не выбраны.
  await page.getByLabel('Поиск спортсмена по фамилии').fill(`Redsel${tag}`);
  await page.getByRole('button', { name: 'Выбрать найденных (2)' }).click();
  await expect(page.getByText('Выбрано: 2').first()).toBeVisible();
  await page.getByLabel('Поиск спортсмена по фамилии').fill('');
  await expect(page.getByText('Найдено: 25').first()).toBeVisible();
  await expect(page.getByText('Выбрано: 2').first()).toBeVisible();
});

// ---------- Existing flows still work (entries; depth — в своих спеках) ----------

test('redesign: weigh-in station still opens', async ({ page, request }) => {
  const { tournament, owner } = await setupManageTournament(request);
  await openManage(page, tournament.id, owner, '?tab=participants');
  // Сценарий 14: вход в Station Mode жив (глубина — weighin-station.spec).
  await page.getByRole('button', { name: 'Режим станции' }).click();
  await expect(page.getByText('Режим станции').first()).toBeVisible();
  await expect(page.getByPlaceholder('Поиск спортсмена…')).toBeVisible();
});

test('redesign: staff inline assignment entry works', async ({ page, request }) => {
  const { tournament, owner } = await setupManageTournament(request);
  await openManage(page, tournament.id, owner, '?tab=staff');
  // Сценарий 15: строки без судьи + поповер (глубина — referee-assign.spec).
  await expect(page.getByText('Без судьи').first()).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /Назначить судью/ }).first().click();
  await expect(page.getByPlaceholder('Поиск судьи…')).toBeVisible();
});

test('redesign: brackets summary renders', async ({ page, request }) => {
  const { tournament, owner } = await setupManageTournament(request);
  await openManage(page, tournament.id, owner, '?tab=brackets');
  // Сценарий 16: резюме + сгенерированная сетка (глубина generate-all — control-center).
  // Одна категория рендерится в singular-форме («1 категория»).
  await expect(page.getByText(/категори/).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/готово/).first()).toBeVisible();
});

test('redesign: readiness still visible', async ({ page, request }) => {
  const { tournament, owner } = await setupManageTournament(request);
  await openManage(page, tournament.id, owner);
  // Сценарий 17: готовность и чеклист на месте.
  await expect(page.getByText('Готовность').first()).toBeVisible();
});

test('redesign: tab keyboard navigation works', async ({ page, request }) => {
  const { tournament, owner } = await setupManageTournament(request);
  await openManage(page, tournament.id, owner);
  // Сценарий 18: стрелки двигают фокус, Enter активирует.
  await page.getByRole('tab', { name: 'Обзор' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Участники/ })).toBeFocused();
  await expect(page).not.toHaveURL(/tab=participants/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/tab=participants/, { timeout: 10000 });
  await expect(page.getByRole('tabpanel')).toBeVisible();
});

test('redesign: dark theme has no light leaks', async ({ page, request }) => {
  const { tournament, owner } = await setupManageTournament(request);
  // Сценарий 19: тёмная тема применяется с загрузки (как в dark-theme.spec).
  await page.emulateMedia({ colorScheme: 'dark' });
  await openManage(page, tournament.id, owner, '?tab=participants');
  const bad = await page.evaluate(() => {
    const found: string[] = [];
    document
      .querySelectorAll('.rounded-2xl.border, .rounded-xl.border')
      .forEach((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        const m = getComputedStyle(el as HTMLElement)
          .backgroundColor.match(/[\d.]+/g)
          ?.map(Number);
        if (!m || m.length < 3) return;
        const alpha = m.length >= 4 ? m[3] : 1;
        if (alpha >= 0.5 && m[0] > 200 && m[1] > 200 && m[2] > 200) {
          found.push(((el as HTMLElement).innerText || '').slice(0, 60));
        }
      });
    return found;
  });
  expect(bad).toEqual([]);
});

test('redesign: no horizontal overflow', async ({ page, request }) => {  const { tournament, owner } = await setupManageTournament(request);
  await openManage(page, tournament.id, owner, '?tab=participants');
  // Сценарий 20: manage + child selection без горизонтального скролла.
  for (const url of [
    `/cabinet/tournaments/${tournament.id}/manage?tab=participants`,
    `/cabinet/tournaments/${tournament.id}/manage?tab=categories`,
  ]) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test('redesign: manage width is constrained', async ({ page, request }) => {
  const { tournament, owner } = await setupManageTournament(request);
  await openManage(page, tournament.id, owner);
  // Контейнер консоли ограничен платформ-стандартом, а не full-bleed.
  const maxWidth = await page.evaluate(() => {
    const tablist = document.querySelector('[role="tablist"]');
    const root = tablist?.parentElement;
    return root ? getComputedStyle(root).maxWidth : 'missing';
  });
  expect(maxWidth).toBe('1280px');
});

test('redesign: category chips expander works', async ({ page, request }) => {
  const { tournament, owner } = await setupManageTournament(request);
  await openManage(page, tournament.id, owner, '?tab=participants');
  // 22 спортсмена: 20 чипов видны, остальные — за «Показать всех (22)».
  // Видимость поведенческая (computed), скоп — табпанель (якорь стабилен).
  const panel = page.getByRole('tabpanel');
  await expect(page.getByRole('button', { name: 'Показать всех (22)' })).toBeVisible({
    timeout: 15000,
  });
  await expect(panel.locator('span.inline-flex:visible')).toHaveCount(20);
  await page.getByRole('button', { name: 'Показать всех (22)' }).click();
  await expect(panel.locator('span.inline-flex:visible')).toHaveCount(22);
  await expect(page.getByRole('button', { name: 'Свернуть' })).toBeVisible();
});

async function setupFinishedRound(
  request: APIRequestContext,
): Promise<{ tournament: { id: number }; owner: { username: string; password: string } }> {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const kid1 = await createAthleteViaApi(request, headers, { first_name: 'Fin', last_name: 'One' }, 0);
  const kid2 = await createAthleteViaApi(request, headers, { first_name: 'Fin', last_name: 'Two' }, 1);
  const tournament = await createTournamentViaApi(request, headers);
  const category = await createCategoryViaApi(request, headers, tournament.id);
  const addRes = await request.post(
    `${API_URL}/api/tournament/categories/${category.id}/add_athletes/`,
    { headers, data: { athlete_ids: [kid1.id, kid2.id] } },
  );
  expect(addRes.ok(), `add_athletes: ${await addRes.text()}`).toBeTruthy();
  await generateBracketViaApi(request, headers, category.id, [kid1.id, kid2.id]);
  const detailRes = await request.get(`${API_URL}/api/tournament/tournaments/${tournament.id}/`, {
    headers,
  });
  expect(detailRes.ok()).toBeTruthy();
  const detail = (await detailRes.json()) as {
    categories: { rounds: { matches: { id: number }[] }[] }[];
  };
  const matchId = detail.categories[0].rounds[0].matches[0].id;
  const finRes = await request.post(`${API_URL}/api/tournament/matches/${matchId}/finish_match/`, {
    headers,
    data: { winner_id: kid1.id },
  });
  expect(finRes.ok(), `finish_match: ${await finRes.text()}`).toBeTruthy();
  return { tournament, owner: coach };
}

test('redesign: finished rounds start collapsed, toggle expands', async ({
  page,
  request,
}) => {
  const { tournament, owner } = await setupFinishedRound(request);
  await openManage(page, tournament.id, owner, '?tab=brackets');
  // Завершённый раунд свёрнут по умолчанию; карточка смонтирована (hidden).
  const toggle = page.getByRole('button', { name: /Развернуть раунд/ });
  await expect(toggle).toBeVisible({ timeout: 15000 });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const matchLabel = page.getByText(/Матч #\d+/).first();
  await expect(matchLabel).toBeHidden();
  await expect(matchLabel).toBeAttached();
  await toggle.click();
  const expandedToggle = page.getByRole('button', { name: /Свернуть раунд/ });
  await expect(expandedToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(matchLabel).toBeVisible();
});
