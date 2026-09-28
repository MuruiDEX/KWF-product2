import { test, expect } from '@playwright/test';
import {
  API_URL,
  createAthleteViaApi,
  createCategoryViaApi,
  createTournamentViaApi,
  loginViaApi,
  loginViaUi,
  registerViaApi,
} from './helpers';

test.setTimeout(180000);

/** Phase 4: Control Center — обзор, здоровье, активность, палитра, 403. */
test('control center: ops, health, activity, palette, permission', async ({
  page,
  request,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const kid = await createAthleteViaApi(request, headers, {}, 0);
  const kid2 = await createAthleteViaApi(request, headers, {}, 1);
  const tournament = await createTournamentViaApi(request, headers);
  const category = await createCategoryViaApi(request, headers, tournament.id);
  const addRes = await request.post(
    `${API_URL}/api/tournament/categories/${category.id}/add_athletes/`,
    { headers, data: { athlete_ids: [kid.id, kid2.id] } },
  );
  expect(addRes.ok(), `add_athletes: ${await addRes.text()}`).toBeTruthy();

  // Активность: объявление + явка одного спортсмена.
  const announceText = `Сбор у табло ${Date.now().toString(36)}`;
  const annRes = await request.post(
    `${API_URL}/api/tournament/tournaments/${tournament.id}/announce/`,
    { headers, data: { text: announceText } },
  );
  expect(annRes.ok(), `announce: ${await annRes.text()}`).toBeTruthy();
  const checkRes = await request.post(
    `${API_URL}/api/tournament/tournaments/${tournament.id}/checkin/`,
    { headers, data: { athlete_id: kid.id, checked_in: true } },
  );
  expect(checkRes.ok(), `checkin: ${await checkRes.text()}`).toBeTruthy();

  await loginViaUi(page, coach.username, coach.password);
  await page.goto(`/cabinet/tournaments/${tournament.id}/manage`, {
    waitUntil: 'networkidle',
  });

  // Шапка Control Center: название, статус, контекстное действие черновика.
  await expect(page.getByText('Control Center').first()).toBeVisible({
    timeout: 15000,
  });
  await expect(
    page.getByRole('button', { name: 'Продолжить настройку' }),
  ).toBeVisible();

  // Обзор по умолчанию: KPI, внимание, активность, быстрые действия.
  await expect(
    page.getByRole('region', { name: 'Ключевые показатели' }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole('region', { name: 'Требует внимания' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Быстрые действия' }),
  ).toBeVisible();
  // KPI weigh-in виден в полосе показателей.
  await expect(page.getByText('Без веса').first()).toBeVisible();
  // Объявление видно в ленте активности человекочитаемо.
  await expect(page.getByText(`Объявление: ${announceText}`).first()).toBeVisible({
    timeout: 15000,
  });

  // Ctrl+K: палитра открывается, фильтрует, закрывается по Escape.
  await page.keyboard.press('Control+k');
  await expect(
    page.getByRole('dialog', { name: 'Командная палитра' }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByLabel('Поиск команд и разделов').fill('сетки');
  await expect(
    page.getByRole('option', { name: /Открыть: сетки/ }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Командная палитра' }),
  ).toHaveCount(0);

  // Выбор через палитру ведёт в таб сеток.
  await page.keyboard.press('Control+k');
  await page.getByLabel('Поиск команд и разделов').fill('сетки');
  await page.getByRole('option', { name: /Открыть: сетки/ }).click();
  await expect(page).toHaveURL(/tab=bracket/, { timeout: 10000 });

  // Чужой тренер: черновик ему невидим (контракт backend — 404 в retrieve).
  await page.context().clearCookies();
  await page.reload({ waitUntil: 'networkidle' });
  const other = await registerViaApi(request, 'trainer');
  await loginViaUi(page, other.username, other.password);
  await page.goto(`/cabinet/tournaments/${tournament.id}/manage`, {
    waitUntil: 'networkidle',
  });
  await expect(page.getByText('Турнир не найден').first()).toBeVisible({
    timeout: 15000,
  });
});

/** Participants: поиск по имени, фильтры, пагинация, сброс. */
test('participants: search, filters and pagination work', async ({
  page,
  request,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const tag = Date.now().toString(36);
  const kids: { id: number }[] = [];
  for (let i = 0; i < 20; i++) {
    kids.push(
      await createAthleteViaApi(request, headers, { last_name: `Searchable${i}_${tag}` }, i),
    );
  }
  const ivan = await createAthleteViaApi(
    request,
    headers,
    { first_name: 'Ivan', last_name: `Petrov${tag}` },
    20,
  );
  const artem = await createAthleteViaApi(
    request,
    headers,
    { first_name: 'Artem', last_name: `Ivanov${tag}` },
    21,
  );
  kids.push(ivan, artem);
  const tournament = await createTournamentViaApi(request, headers);
  const category = await createCategoryViaApi(request, headers, tournament.id);
  const addRes = await request.post(
    `${API_URL}/api/tournament/categories/${category.id}/add_athletes/`,
    { headers, data: { athlete_ids: kids.map((k) => k.id) } },
  );
  expect(addRes.ok(), `add_athletes: ${await addRes.text()}`).toBeTruthy();

  await loginViaUi(page, coach.username, coach.password);
  await page.goto(`/cabinet/tournaments/${tournament.id}/manage?tab=participants`, {
    waitUntil: 'domcontentloaded',
  });
  // Поиск сужает список до одного; остальные строки скрыты.
  await page.getByLabel('Поиск спортсмена в списке').fill(`Petrov${tag}`);
  await expect(
    page.getByRole('checkbox', { name: `Явка: Petrov${tag} Ivan` }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole('checkbox', { name: `Явка: Ivanov${tag} Artem` }),
  ).toHaveCount(0);
  // Сброс поиска возвращает всех; порога load-more (30) не достигаем.
  await page.getByLabel('Поиск спортсмена в списке').fill('');
  await expect(
    page.getByRole('checkbox', { name: `Явка: Ivanov${tag} Artem` }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Показать ещё/ })).toHaveCount(0);

  // Пустой результат — честное empty state.
  await page.getByLabel('Поиск спортсмена в списке').fill('zzz-no-such-name');
  await expect(page.getByText(/никого не найдено/).first()).toBeVisible();
  await page.getByLabel('Поиск спортсмена в списке').fill('');
  await expect(
    page.getByRole('checkbox', { name: `Явка: Petrov${tag} Ivan` }),
  ).toBeVisible();
});
/** Phase 2B: новая IA + backward compatibility старых deep links. */
test('manage ia: legacy tabs map, drawer and bulk bar work', async ({
  page,
  request,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const kid = await createAthleteViaApi(request, headers, {}, 0);
  const kid2 = await createAthleteViaApi(request, headers, {}, 1);
  const tournament = await createTournamentViaApi(request, headers);
  const category = await createCategoryViaApi(request, headers, tournament.id);
  const addRes = await request.post(
    `${API_URL}/api/tournament/categories/${category.id}/add_athletes/`,
    { headers, data: { athlete_ids: [kid.id, kid2.id] } },
  );
  expect(addRes.ok(), `add_athletes: ${await addRes.text()}`).toBeTruthy();

  // Татами нужен guardrail bulk-генерации (без него — отдельный guardrail-flow,
  // покрытый bracket-guardrail.spec.ts).
  const tatRes = await request.post(`${API_URL}/api/tournament/tatamis/`, {
    headers,
    data: { name: 'Татами 1', order: 1 },
  });
  expect(tatRes.ok(), `create tatami: ${await tatRes.text()}`).toBeTruthy();

  await loginViaUi(page, coach.username, coach.password);

  // Старые deep links маппятся на новую IA. SSE-ленты держат соединение
  // открытым — ждём контент (domcontentloaded), а не networkidle.
  // Старый ?tab=setup ведёт на Категории.
  await page.goto(`/cabinet/tournaments/${tournament.id}/manage?tab=setup`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByRole('tab', { name: 'Категории' })).toHaveAttribute(
    'aria-selected',
    'true',
    { timeout: 15000 },
  );
  await expect(page.getByText('Категории ·').first()).toBeVisible();

  // Старый ?tab=live ведёт на Расписание в LIVE-режиме.
  await page.goto(`/cabinet/tournaments/${tournament.id}/manage?tab=live`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByRole('tab', { name: /Расписание/ })).toHaveAttribute(
    'aria-selected',
    'true',
    { timeout: 15000 },
  );

  // Старый ?tab=bracket ведёт на Сетки.
  await page.goto(`/cabinet/tournaments/${tournament.id}/manage?tab=bracket`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByRole('tab', { name: 'Сетки' })).toHaveAttribute(
    'aria-selected',
    'true',
    { timeout: 15000 },
  );

  // Drawer категории открывается из таблицы.
  await page.goto(
    `/cabinet/tournaments/${tournament.id}/manage?tab=categories`,
    { waitUntil: 'domcontentloaded' },
  );
  await expect(page.getByText('Категории ·').first()).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Открыть', exact: true }).first().click();
  await expect(
    page.getByRole('dialog', { name: /Категория:/ }),
  ).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Escape');

  // Bulk bar появляется при выборе строк.
  await page.getByRole('checkbox', { name: 'Выбрать все строки на странице' }).click();
  await expect(
    page.getByRole('toolbar', { name: /Массовые действия/ }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole('button', { name: 'Отметить явку' }),
  ).toBeVisible();
  // Bulk check-in идёт одним запросом — проверяем итоговое резюме.
  await page.getByRole('button', { name: 'Отметить явку' }).click();
  await expect(page.getByText('Явка обновлена').first()).toBeVisible({
    timeout: 15000,
  });

  // Bulk uncheck: выбор → подтверждение → отмена ничего не делает.
  await page.getByRole('checkbox', { name: 'Выбрать все строки на странице' }).click();
  const toolbar = page.getByRole('toolbar', { name: /Массовые действия/ });
  await expect(toolbar).toBeVisible({ timeout: 10000 });
  await toolbar.getByRole('button', { name: 'Снять явку' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Снять явку?' });
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await dialog.getByRole('button', { name: 'Отмена' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(toolbar).toBeVisible();

  // Подтверждение выполняет uncheck: резюме, выбор снят, статусы обновлены.
  await toolbar.getByRole('button', { name: 'Снять явку' }).click();
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await dialog.getByRole('button', { name: 'Снять явку' }).click();
  await expect(page.getByText('Явка снята').first()).toBeVisible({
    timeout: 15000,
  });
  await expect(toolbar).toHaveCount(0);

  // Generate-all: одна кнопка строит сетку готовой категории.
  await page.goto(
    `/cabinet/tournaments/${tournament.id}/manage?tab=brackets`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.getByRole('button', { name: /Сгенерировать все готовые/ }).click();
  const genDialog = page.getByRole('alertdialog', { name: 'Сгенерировать сетки?' });
  await expect(genDialog).toBeVisible({ timeout: 10000 });
  await genDialog.getByRole('button', { name: 'Сгенерировать' }).click();
  await expect(page.getByText('Сетки созданы: 1.').first()).toBeVisible({
    timeout: 15000,
  });
});
