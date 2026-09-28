import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  API_URL,
  createAthleteViaApi,
  createCategoryViaApi,
  createTournamentViaApi,
  loginViaApi,
  loginViaUi,
  registerViaApi,
} from './helpers';

/** Generate All guardrail (J1/J2/J3): bulk-генерация проходит тот же
 * preflight, что per-category (planBulkGenerate поверх getBracketBlockers).
 * Backend остаётся source of truth; здесь только UX-гейт. */

test.setTimeout(300000);

interface NetCtx {
  errors: string[];
  failedReqs: string[];
  genBracketPosts: number;
}

function watch(page: Page): NetCtx {
  const ctx: NetCtx = { errors: [], failedReqs: [], genBracketPosts: 0 };
  page.on('console', (m) => {
    if (m.type() === 'error') ctx.errors.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => ctx.errors.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on('requestfailed', (r) => {
    ctx.failedReqs.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText ?? '?'}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) {
      ctx.failedReqs.push(`${r.status()} ${r.request().method()} ${r.url()}`);
    }
    if (r.url().includes('/generate_bracket/') && r.request().method() === 'POST') {
      ctx.genBracketPosts += 1;
    }
  });
  return ctx;
}

/** Заведомо benign шум (pre-existing, не manage-регрессия):
 * 401-пробы /api/auth/* до логина, обрыв SSE при навигации,
 * отмены RSC-prefetch (?_rsc=) роутером Next при переходах. */
function expectClean(ctx: NetCtx) {
  const realNet = ctx.failedReqs.filter(
    (u) => !/\/api\/auth\//.test(u) && !/events\/stream/.test(u) && !/[?&]_rsc=/.test(u),
  );
  expect(realNet, `network failures: ${realNet.join(' | ')}`).toEqual([]);
  const realConsole =
    realNet.length === 0
      ? ctx.errors.filter((t) => !t.startsWith('Failed to load resource'))
      : ctx.errors;
  expect(realConsole, `console errors: ${realConsole.join(' | ')}`).toEqual([]);
}

async function setupTournament(request: APIRequestContext, opts: { extraReg?: boolean; tatami?: boolean }) {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const a1 = await createAthleteViaApi(request, headers, { first_name: 'G1', weight: 30 }, 1);
  const a2 = await createAthleteViaApi(request, headers, { first_name: 'G2', weight: 31 }, 2);
  const tournament = await createTournamentViaApi(request, headers);
  const category = await createCategoryViaApi(request, headers, tournament.id);
  const add = await request.post(
    `${API_URL}/api/tournament/categories/${category.id}/add_athletes/`,
    { headers, data: { athlete_ids: [a1.id, a2.id] } },
  );
  expect(add.ok(), `add_athletes: ${await add.text()}`).toBeTruthy();
  if (opts.extraReg) {
    const a3 = await createAthleteViaApi(request, headers, { first_name: 'G3', weight: 32 }, 3);
    const reg = await request.post(
      `${API_URL}/api/tournament/tournaments/${tournament.id}/register_athlete/`,
      { headers, data: { athlete_id: a3.id } },
    );
    expect(reg.ok(), `register: ${await reg.text()}`).toBeTruthy();
  }
  if (opts.tatami) {
    const tat = await request.post(`${API_URL}/api/tournament/tatamis/`, {
      headers,
      data: { name: 'Guard Tatami', order: 1 },
    });
    expect(tat.ok(), `tatami: ${await tat.text()}`).toBeTruthy();
  }
  return { coach, tournament };
}

async function openBrackets(page: Page, id: number) {
  await page.goto(`/cabinet/tournaments/${id}/manage?tab=brackets`, { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('tablist', { name: 'Разделы управления турниром' }).first(),
  ).toBeVisible({ timeout: 30000 });
}

test('J1: bulk с blockers → guardrail, генерация НЕ вызывается', async ({ page, request }) => {
  const ctx = watch(page);
  // Участник без категории + нет татами: два разных блокера.
  const { coach, tournament } = await setupTournament(request, { extraReg: true });
  await loginViaUi(page, coach.username, coach.password);
  await openBrackets(page, tournament.id);

  await page.getByRole('button', { name: /Сгенерировать все готовые/ }).click();
  const guard = page.getByRole('dialog', { name: /Нельзя создать сетку пока/ });
  await expect(guard).toBeVisible({ timeout: 15000 });
  // Оба блокера видны ровно по одному разу (дедуп глобальных).
  await expect(guard).toContainText(/без категории/);
  await expect(guard).toContainText(/татами/i);
  // Пауза: ни один POST generate_bracket не должен уйти.
  await page.waitForTimeout(2500);
  expect(ctx.genBracketPosts, 'generation API must not be called').toBe(0);
  // Bulk ConfirmDialog при блокерах не открывается.
  await expect(page.getByRole('alertdialog', { name: 'Сгенерировать сетки?' })).toHaveCount(0);
  expectClean(ctx);
});

test('J2: bulk без blockers → confirm → генерация → persistence', async ({ page, request }) => {
  const ctx = watch(page);
  const { coach, tournament } = await setupTournament(request, { tatami: true });
  await loginViaUi(page, coach.username, coach.password);
  await openBrackets(page, tournament.id);

  await page.getByRole('button', { name: /Сгенерировать все готовые/ }).click();
  // Guardrail молчит — открывается существующий bulk ConfirmDialog, один раз.
  const genDialog = page.getByRole('alertdialog', { name: 'Сгенерировать сетки?' });
  await expect(genDialog).toBeVisible({ timeout: 15000 });
  expect(ctx.genBracketPosts).toBe(0);
  await genDialog.getByRole('button', { name: 'Сгенерировать' }).click();
  await expect(page.getByText(/Сетки созданы/).first()).toBeVisible({ timeout: 30000 });
  expect(ctx.genBracketPosts).toBeGreaterThan(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('tablist', { name: 'Разделы управления турниром' }).first(),
  ).toBeVisible({ timeout: 30000 });
  expectClean(ctx);
});

test('J3: «Исправить проблемы» ведёт в правильную вкладку', async ({ page, request }) => {
  const ctx = watch(page);
  const { coach, tournament } = await setupTournament(request, { extraReg: true });
  await loginViaUi(page, coach.username, coach.password);
  await openBrackets(page, tournament.id);

  await page.getByRole('button', { name: /Сгенерировать все готовые/ }).click();
  const guard = page.getByRole('dialog', { name: /Нельзя создать сетку пока/ });
  await expect(guard).toBeVisible({ timeout: 15000 });
  // Первый blocker — участники без категории → таб participants.
  await guard.getByRole('button', { name: 'Исправить проблемы' }).click();
  await expect(page).toHaveURL(/tab=participants/, { timeout: 10000 });
  expectClean(ctx);
});
