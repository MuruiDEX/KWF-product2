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
} from './helpers';

test.setTimeout(180000);

test('parent journey: link child → cabinet → bracket/queue', async ({
  page,
  request,
}) => {
  // Setup via API: trainer + 2 athletes + published tournament with bracket.
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
  await publishTournamentViaApi(request, coachHeaders, tournament.id);

  // 1. Register as parent via UI, link child by code.
  const parentUsername = `parent_${Date.now().toString(36)}`;
  await page.goto('/register', { waitUntil: 'networkidle' });
  await page.getByLabel('Имя', { exact: true }).fill('E2E');
  await page.getByLabel('Фамилия', { exact: true }).fill('Parent');
  await page.getByLabel('Имя пользователя *').fill(parentUsername);
  await page
    .getByLabel('Email *')
    .fill(`${parentUsername}@example.com`);
  await page.getByLabel('Пароль *').fill('Test12345!');
  await page.getByLabel('Родитель', { exact: true }).check();
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await expect(page).toHaveURL(/\/cabinet/, { timeout: 15000 });

  await page.getByRole('button', { name: 'Привязать ребёнка' }).first().click();
  await page.getByLabel('Код привязки *').fill(code);
  await page
    .locator('form')
    .getByRole('button', { name: 'Привязать', exact: true })
    .click();
  await expect(page.getByText(kid.last_name).first()).toBeVisible({
    timeout: 15000,
  });

  // 2. Cabinet shows the tournament.
  await expect(page.getByText(tournament.name).first()).toBeVisible({
    timeout: 15000,
  });

  // 3. Public bracket shows the category and both athletes.
  await page.goto(`/tournaments/${tournament.slug}`);
  await expect(page.getByText(category.name).first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(kid.last_name).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Расписание' })).toBeVisible();

  // 3b. Public search enriches hits with category/round/status (no ETA).
  // Freshly generated bracket → status "ready" ("Готов").
  await page.getByLabel('Найти спортсмена на турнире').fill(kid.last_name);
  await expect(
    page.getByRole('button', { name: new RegExp(`${kid.last_name}.*Готов`, 's') }).first()
  ).toBeVisible({ timeout: 10000 });

  // 4. Queue + history endpoints readable for own child's data.
  const stateRes = await page.request.get(
    `${API_URL}/api/tournament/tournaments/${tournament.id}/bracket_state/`,
  );
  expect(stateRes.ok()).toBeTruthy();
  const state = (await stateRes.json()) as {
    categories: Array<{
      rounds: Array<{ matches: Array<{ id: number; athlete1_id: number | null }> }>;
    }>;
  };
  const match = state.categories[0].rounds[0].matches.find(
    (m) => m.athlete1_id === kid.id,
  );
  expect(match, 'match with linked child exists').toBeTruthy();
  const queueRes = await page.request.get(
    `${API_URL}/api/tournament/tournaments/${tournament.id}/tatami_queue/`,
  );
  expect(queueRes.ok()).toBeTruthy();
  const histRes = await page.request.get(
    `${API_URL}/api/tournament/matches/${match!.id}/history/`,
  );
  expect(histRes.ok()).toBeTruthy();
});
