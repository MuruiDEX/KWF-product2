import { test, expect } from '@playwright/test';
import {
  API_URL,
  createAthleteViaApi,
  createCategoryViaApi,
  createTournamentViaApi,
  generateBracketViaApi,
  loginViaApi,
  publishTournamentViaApi,
  registerViaApi,
} from './helpers';

test.setTimeout(180000);

test('tournament board: live tablo, tatami filter, announce banner', async ({
  page,
  request,
}) => {
  // Setup via API: trainer + 2 athletes + tatami + published bracket.
  const coach = await registerViaApi(request, 'trainer');
  const coachHeaders = await loginViaApi(
    request,
    coach.username,
    coach.password,
  );
  const kid = await createAthleteViaApi(request, coachHeaders, {}, 0);
  const kid2 = await createAthleteViaApi(request, coachHeaders, {}, 1);
  const tournament = await createTournamentViaApi(request, coachHeaders, {
    mats_count: 1,
  });
  const category = await createCategoryViaApi(
    request,
    coachHeaders,
    tournament.id,
  );
  await generateBracketViaApi(request, coachHeaders, category.id, [
    kid.id,
    kid2.id,
  ]);
  // Татами + распределение, иначе очередь пуста.
  const tatamiRes = await request.post(`${API_URL}/api/tournament/tatamis/`, {
    headers: coachHeaders,
    data: { name: 'Татами 1', order: 0 },
  });
  expect(tatamiRes.ok(), `create tatami: ${await tatamiRes.text()}`).toBeTruthy();
  const tatami = (await tatamiRes.json()) as { id: number; name: string };
  const distRes = await request.post(
    `${API_URL}/api/tournament/tournaments/${tournament.id}/distribute_tatamis/`,
    { headers: coachHeaders },
  );
  expect(distRes.ok(), `distribute: ${await distRes.text()}`).toBeTruthy();
  await publishTournamentViaApi(request, coachHeaders, tournament.id);

  // 1. Кнопка «Табло» ведёт на board.
  await page.goto(`/tournaments/${tournament.slug}`, {
    waitUntil: 'networkidle',
  });
  await page.getByRole('link', { name: 'Табло' }).click();
  await expect(page).toHaveURL(/\/board/, { timeout: 15000 });

  // 2. Табло: название, татами, оба спортсмена в «Далее».
  await expect(page.getByText('Табло турнира')).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(tournament.name).first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText('Татами 1').first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(kid.last_name).first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText('Пауза между боями')).toBeVisible({
    timeout: 15000,
  });

  // 3. Фильтр ?tatami=: чужое татами — пустая очередь.
  await page.goto(`/tournaments/${tournament.slug}/board?tatami=999999`);
  await expect(page.getByText('Очередь пуста')).toBeVisible({
    timeout: 15000,
  });
  await page.goto(
    `/tournaments/${tournament.slug}/board?tatami=${tatami.id}`,
  );
  await expect(page.getByText('Татами 1').first()).toBeVisible({
    timeout: 15000,
  });

  // 4. Объявление организатора — баннером на табло.
  const announceText = `Финал через пять минут ${Date.now().toString(36)}`;
  const annRes = await request.post(
    `${API_URL}/api/tournament/tournaments/${tournament.id}/announce/`,
    { headers: coachHeaders, data: { text: announceText } },
  );
  expect(annRes.ok(), `announce: ${await annRes.text()}`).toBeTruthy();
  await page.goto(`/tournaments/${tournament.slug}/board`);
  await expect(page.getByText(announceText)).toBeVisible({ timeout: 20000 });
});
