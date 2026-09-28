import { test, expect, APIRequestContext } from '@playwright/test';
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

test.setTimeout(240000);

interface Setup {
  tournament: { id: number; slug: string; name: string };
  headers: Record<string, string>;
}

async function setupLiveTournament(
  request: APIRequestContext,
  tatamiNames: string[] = ['Татами 1'],
): Promise<Setup> {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const kid = await createAthleteViaApi(request, headers, {}, 0);
  const kid2 = await createAthleteViaApi(request, headers, {}, 1);
  const tournament = await createTournamentViaApi(request, headers, {
    mats_count: tatamiNames.length,
  });
  const category = await createCategoryViaApi(request, headers, tournament.id);
  await generateBracketViaApi(request, headers, category.id, [kid.id, kid2.id]);
  for (const [order, name] of tatamiNames.entries()) {
    const tatamiRes = await request.post(`${API_URL}/api/tournament/tatamis/`, {
      headers,
      data: { name, order },
    });
    expect(tatamiRes.ok(), `create tatami: ${await tatamiRes.text()}`).toBeTruthy();
  }
  const distRes = await request.post(
    `${API_URL}/api/tournament/tournaments/${tournament.id}/distribute_tatamis/`,
    { headers },
  );
  expect(distRes.ok(), `distribute: ${await distRes.text()}`).toBeTruthy();
  await publishTournamentViaApi(request, headers, tournament.id);
  return { tournament, headers };
}

async function firstOpenMatchId(
  request: APIRequestContext,
  headers: Record<string, string>,
  tournamentId: number,
): Promise<number> {
  const res = await request.get(`${API_URL}/api/tournament/tournaments/${tournamentId}/`, {
    headers,
  });
  expect(res.ok()).toBeTruthy();
  const detail = (await res.json()) as {
    categories: { rounds: { matches: { id: number; status: string }[] }[] }[];
  };
  for (const cat of detail.categories) {
    for (const round of cat.rounds) {
      for (const m of round.matches) {
        if (m.status === 'ready' || m.status === 'waiting') return m.id;
      }
    }
  }
  throw new Error('no open match found');
}

/** Phase 6: публичный live-маршрут — LIVE-статус и живое состояние. */
// SSE держит соединение открытым — networkidle на live-страницах не наступает.
const LIVE_LOAD = { waitUntil: 'domcontentloaded' } as const;

test('tournament live page shows LIVE state', async ({ page, request }) => {
  const { tournament } = await setupLiveTournament(request);
  await page.goto(`/tournaments/${tournament.slug}/live`, LIVE_LOAD);
  await expect(page.getByText(`${tournament.name}: live`).first()).toBeVisible({
    timeout: 15000,
  });
  const badge = page.getByTestId('sync-state');
  await expect(badge).toContainText('LIVE', { timeout: 20000 });
});

/** Phase 6: событие backend меняет UI без перезагрузки + замер задержки. */
test('live update arrives without reload (latency measured)', async ({
  page,
  request,
}) => {
  const { tournament, headers } = await setupLiveTournament(request);
  await page.goto(`/tournaments/${tournament.slug}/live`, LIVE_LOAD);
  await expect(page.getByTestId('sync-state')).toContainText('LIVE', { timeout: 20000 });

  // Старт боя через API → табло показывает «Бой идёт» без reload.
  const matchId = await firstOpenMatchId(request, headers, tournament.id);
  const startRes = await request.post(`${API_URL}/api/tournament/matches/${matchId}/start_match/`, {
    headers,
  });
  expect(startRes.ok(), `start_match: ${await startRes.text()}`).toBeTruthy();
  await expect(page.getByText('Бой идёт').first()).toBeVisible({ timeout: 30000 });

  // Задержка announce→баннер (честный замер тестового окружения).
  const text = `Замер задержки ${Date.now().toString(36)}`;
  const t0 = Date.now();
  const annRes = await request.post(
    `${API_URL}/api/tournament/tournaments/${tournament.id}/announce/`,
    { headers, data: { text } },
  );
  expect(annRes.ok(), `announce: ${await annRes.text()}`).toBeTruthy();
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 30000 });
  const dt = Date.now() - t0;
  console.log(`live-latency-announce-ms=${dt}`);
  expect(dt).toBeLessThan(60000);
});

/** Phase 6: обрыв SSE → переподключение → polling-fallback → восстановление. */
test('sse break falls back to polling and recovers', async ({ page, request }) => {
  const { tournament } = await setupLiveTournament(request);
  await page.goto(`/tournaments/${tournament.slug}/live`, LIVE_LOAD);
  const badge = page.getByTestId('sync-state');
  await expect(badge).toContainText('LIVE', { timeout: 20000 });
  // SSE-first: основной транспорт — sse, а не polling.
  await expect(badge).toHaveAttribute('data-transport', 'sse', { timeout: 20000 });

  // Ломаем SSE-транспорт и перезагружаем: коннект падает сразу,
  // идут reconnect-попытки с backoff. (Регекс: glob '**/events/stream*'
  // query-строку в этой версии Playwright не матчит.)
  const streamPattern = /\/events\/stream\//;
  await page.route(streamPattern, (route) => route.abort());
  await page.reload(LIVE_LOAD);
  await expect(badge).toContainText('Переподключение', { timeout: 30000 });
  // После исчерпания reconnect-попыток — polling-fallback (LIVE через опрос).
  await expect(badge).toHaveAttribute('data-transport', 'polling', { timeout: 90000 });
  await expect(badge).toContainText('LIVE');

  // Чиним транспорт: synthetic online будит тот же код, что реальный возврат сети.
  await page.unroute(streamPattern);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(badge).toHaveAttribute('data-transport', 'sse', { timeout: 30000 });
  await expect(badge).toContainText('LIVE');
});

/** Phase 6: TV-табло — рендер, overflow, фильтр татами. */
test('tv scoreboard renders, filters, no overflow', async ({ page, request }) => {
  const { tournament } = await setupLiveTournament(request, ['Татами 1', 'Татами 2']);
  await page.goto(`/live/tv?slug=${tournament.slug}`, LIVE_LOAD);
  await expect(page.getByText('Табло турнира').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(tournament.name).first()).toBeVisible({ timeout: 15000 });

  // Фильтр татами: видимая фильтрация секций (URL-синхронизация best-effort).
  const tatamiBtn = page.getByRole('button', { name: 'Татами 2' }).first();
  await expect(tatamiBtn).toBeVisible({ timeout: 15000 });
  await tatamiBtn.click();
  await expect(page.getByRole('region', { name: 'Татами 2' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('region', { name: 'Татами 1' })).toHaveCount(0);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
