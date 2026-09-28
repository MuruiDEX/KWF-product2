import { test, expect } from '@playwright/test';
import {
  API_URL,
  createCategoryViaApi,
  createTournamentViaApi,
  csrfHeaders,
  generateBracketViaApi,
  loginViaApi,
  loginViaUi,
  publishTournamentViaApi,
  registerViaApi,
} from './helpers';

test.setTimeout(180000);

const CSV = [
  'first_name,last_name,birth_date,weight,gender,height,club',
  'Иван,Иванов,2012-05-14,52.5,male,165,Киокушин Павлодар',
  'Айгерим,Сатова,2013-03-02,44,ж,,Киокушин Павлодар',
].join('\n');

test('auth flow: login → CSV → bracket → schedule → expired access heals', async ({
  page,
  request,
  context,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  await loginViaUi(page, coach.username, coach.password);
  const headers = await loginViaApi(request, coach.username, coach.password);

  // 1. CSV-импорт через браузерный контекст (куки, как у пользователя).
  const uiHeaders = await csrfHeaders(page);
  const dryRes = await page.request.post(
    `${API_URL}/api/tournament/athletes/import_csv/`,
    {
      headers: uiHeaders,
      multipart: {
        file: { name: 'kids.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf-8') },
        dry_run: '1',
      },
    },
  );
  expect(dryRes.ok(), `csv dry-run: ${await dryRes.text()}`).toBeTruthy();
  expect(((await dryRes.json()) as { errors: unknown[] }).errors).toEqual([]);
  const impRes = await page.request.post(
    `${API_URL}/api/tournament/athletes/import_csv/`,
    {
      headers: uiHeaders,
      multipart: {
        file: { name: 'kids.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf-8') },
      },
    },
  );
  expect(impRes.ok(), `csv import: ${await impRes.text()}`).toBeTruthy();
  const imported = (await impRes.json()) as { created: { id: number }[] };
  expect(imported.created).toHaveLength(2);

  // 2. Турнир → категория → сетка → публикация.
  const tournament = await createTournamentViaApi(request, headers);
  const category = await createCategoryViaApi(request, headers, tournament.id);
  await generateBracketViaApi(
    request,
    headers,
    category.id,
    imported.created.map((a) => a.id),
  );
  await publishTournamentViaApi(request, headers, tournament.id);

  // 3. Расписание создаётся без ложных 401.
  const schedRes = await page.request.post(`${API_URL}/api/schedule/sessions/`, {
    headers: uiHeaders,
    data: {
      day: 1,
      start_time: '18:00',
      end_time: '19:30',
      group: 'E2E Группа',
      kind: 'Кекушинкай',
    },
  });
  expect(schedRes.ok(), `schedule create: ${await schedRes.text()}`).toBeTruthy();

  // 4. Протухаем access-куку, refresh оставляем: reload должен
  // молча восстановить сессию через refresh (без «сессия истекла»).
  await context.addCookies([
    {
      name: 'access_token',
      value: 'expired',
      domain: 'localhost',
      path: '/',
      expires: Math.floor(Date.now() / 1000) - 3600,
    },
  ]);
  await page.goto('/cabinet', { waitUntil: 'networkidle' });
  // Сессия восстановлена через refresh: видно имя из /me/, редиректа
  // на /login нет, ложного «сессия истекла» — тоже.
  await expect(page).toHaveURL(/\/cabinet/, { timeout: 15000 });
  await expect(page.getByText('E2E User').first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText('Сессия истекла')).toHaveCount(0);
  // Импортированные дети на месте, работа продолжается.
  await expect(page.getByText('Иванов').first()).toBeVisible({
    timeout: 15000,
  });
});
