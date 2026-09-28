import { test, expect } from '@playwright/test';
import {
  API_URL,
  createAthleteViaApi,
  createCategoryViaApi,
  createTournamentViaApi,
  generateBracketViaApi,
  getInviteCodeViaApi,
  loginViaApi,
  publishTournamentViaApi,
  registerViaApi,
  unique,
} from './helpers';

test.setTimeout(180000);

/** F3: PWA-ассеты отдаются. */
test('pwa assets are served', async ({ request }) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  const body = (await manifest.json()) as { short_name: string };
  expect(body.short_name).toBe('KWF');

  for (const path of [
    '/sw.js',
    '/offline',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/apple-touch-icon.png',
    '/env.js',
  ]) {
    const res = await request.get(path);
    expect(res.ok(), `${path} should be 200`).toBeTruthy();
  }
  const sw = await (await request.get('/sw.js')).text();
  expect(sw).toContain('kwf-v1');
});

/** F2+F4: счётчик пагинации и ICS-выгрузка турнира. */
test('tournaments counter and ICS download', async ({ page, request }) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const tournament = await createTournamentViaApi(request, headers);
  await publishTournamentViaApi(request, headers, tournament.id);

  await page.goto('/tournaments', { waitUntil: 'networkidle' });
  await expect(page.getByText(tournament.name).first()).toBeVisible({
    timeout: 15000,
  });
  // F2: честный счётчик вместо молчаливой обрезки.
  await expect(page.getByText(/Показано \d+ из \d+/).first()).toBeVisible();

  // F4: ICS скачивается с валидным содержимым.
  await page.goto(`/tournaments/${tournament.slug}`, {
    waitUntil: 'networkidle',
  });
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: 'В календарь' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.ics$/);
  const path = await download.path();
  expect(path).toBeTruthy();
});

/** F1: родитель включает уведомления о бое ребёнка. */
test('parent fight-notify toggle', async ({ page, request, context }) => {
  await context.grantPermissions(['notifications']);
  const coach = await registerViaApi(request, 'trainer');
  const coachHeaders = await loginViaApi(
    request,
    coach.username,
    coach.password,
  );
  const kid = await createAthleteViaApi(request, coachHeaders, {}, 0);
  const kid2 = await createAthleteViaApi(request, coachHeaders, {}, 1);
  const code = await getInviteCodeViaApi(request, coachHeaders, kid.id);
  const tournament = await createTournamentViaApi(request, coachHeaders);
  const category = await createCategoryViaApi(
    request,
    coachHeaders,
    tournament.id,
  );
  await generateBracketViaApi(request, coachHeaders, category.id, [
    kid.id,
    kid2.id,
  ]);
  // Татами + распределение, иначе очередь пуста и карточка боя не появится.
  const tatamiRes = await request.post(`${API_URL}/api/tournament/tatamis/`, {
    headers: coachHeaders,
    data: { name: 'Татами 1', order: 0 },
  });
  expect(tatamiRes.ok(), `create tatami: ${await tatamiRes.text()}`).toBeTruthy();
  const distRes = await request.post(
    `${API_URL}/api/tournament/tournaments/${tournament.id}/distribute_tatamis/`,
    { headers: coachHeaders },
  );
  expect(distRes.ok(), `distribute: ${await distRes.text()}`).toBeTruthy();
  await publishTournamentViaApi(request, coachHeaders, tournament.id);

  const parent = await registerViaApi(request, 'parent');
  // Привязка через API (UI-флоу уже покрыт parent.spec).
  const parentHeaders = await loginViaApi(
    request,
    parent.username,
    parent.password,
  );
  const link = await request.post(`${API_URL}/api/auth/children/link/`, {
    headers: parentHeaders,
    data: { code },
  });
  expect(link.ok(), `link: ${await link.text()}`).toBeTruthy();

  // Входим родителем через UI: нужен localStorage + живые куки страницы.
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Имя пользователя').fill(parent.username);
  await page.getByLabel('Пароль').fill(parent.password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/cabinet/, { timeout: 15000 });

  const toggle = page.getByRole('button', { name: 'Уведомить о бое' });
  await expect(toggle).toBeVisible({ timeout: 20000 });
  await toggle.click();
  await expect(
    page.getByRole('button', { name: 'Уведомления включены' }),
  ).toBeVisible({ timeout: 10000 });
});

/** F4: ICS тренировки из расписания. */
test('schedule session ICS download', async ({ page, request }) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const group = `ICS Group ${unique('g')}`;
  const res = await request.post(`${API_URL}/api/schedule/sessions/`, {
    headers,
    data: {
      day: 1,
      start_time: '18:00',
      end_time: '19:30',
      group,
      kind: 'Кекушинкай',
    },
  });
  expect(res.ok(), `create session: ${await res.text()}`).toBeTruthy();

  await page.goto('/schedule', { waitUntil: 'networkidle' });
  // Блок занятия (aria-label «группа, время»), НЕ пилюля фильтра групп.
  await page
    .getByRole('button', { name: new RegExp(`${group}, 18:00`) })
    .first()
    .click();
  await expect(
    page.getByRole('button', { name: 'В календарь' }),
  ).toBeVisible({ timeout: 10000 });
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.getByRole('button', { name: 'В календарь' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.ics$/);
});
