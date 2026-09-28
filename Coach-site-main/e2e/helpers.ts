import {
  APIRequestContext,
  Page,
  expect,
  request as playwrightRequest,
} from '@playwright/test';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

let counter = 0;

/** Уникальные имена — спеки делят одну E2E-БД и бегут параллельно. */
export function unique(prefix: string): string {
  counter += 1;
  const clean = prefix.replace(/[^a-z]/gi, '').slice(0, 12) || 'e2e';
  return `${clean}_${Date.now().toString(36)}_${counter}_${Math.floor(
    Math.random() * 1e6,
  )}`.slice(0, 40);
}

export interface TestUser {
  username: string;
  password: string;
  email: string;
}

export async function registerViaApi(
  request: APIRequestContext,
  role: 'trainer' | 'parent',
): Promise<TestUser> {
  // Изолированный контекст: в общем jar уже могут лежать чужие JWT-куки,
  // и тогда register пойдёт как cookie-flow с проверкой CSRF.
  void request;
  const ctx = await playwrightRequest.newContext();
  try {
    const username = unique(role);
    const user = {
      username,
      password: 'Test12345!',
      email: `${username}@example.com`,
    };
    const res = await ctx.post(`${API_URL}/api/auth/register/`, {
      data: {
        ...user,
        first_name: 'E2E',
        last_name: 'User',
        role,
      },
    });
    expect(res.ok(), `register ${role}: ${await res.text()}`).toBeTruthy();
    return user;
  } finally {
    await ctx.dispose();
  }
}

export async function loginViaUi(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  // networkidle: в dev-режиме ждём компиляцию + гидратацию,
  // иначе клик уйдёт в нативный submit до готовности React.
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Имя пользователя').fill(username);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/cabinet/, { timeout: 15000 });
}

/**
 * Клик мимо hit-test (evaluate): для случаев, когда элемент перекрыт
 * соседним блоком при прокрутке (mobile). Сначала ждём видимости.
 */
export async function clickViaJs(
  page: Page,
  locator: Parameters<Page['locator']>[0],
): Promise<void> {
  const el = page.locator(locator);
  await expect(el.first()).toBeVisible({ timeout: 15000 });
  await el.first().evaluate((node) => {
    (node as HTMLElement).click();
  });
}
export async function csrfHeaders(page: Page): Promise<Record<string, string>> {
  await page.request.get(`${API_URL}/api/auth/csrf/`);
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === 'csrftoken')?.value;
  expect(csrf, 'csrftoken cookie set').toBeTruthy();
  return { 'X-CSRFToken': csrf as string };
}

/**
 * Логин через API. Возвращает headers с CSRF-токеном для небезопасных
 * методов (cookie-flow требует X-CSRFToken; куки хранит сам контекст).
 */
export async function loginViaApi(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<Record<string, string>> {
  // Сначала CSRF-cookie: контекст уже может нести JWT-куки (например,
  // после register), и тогда login идёт как cookie-flow с проверкой CSRF.
  await request.get(`${API_URL}/api/auth/csrf/`);
  const preState = await request.storageState();
  const preCsrf = preState.cookies.find((c) => c.name === 'csrftoken')?.value;
  const login = await request.post(`${API_URL}/api/auth/token/`, {
    data: { username, password },
    headers: preCsrf ? { 'X-CSRFToken': preCsrf } : {},
  });
  expect(login.ok(), `api login: ${await login.text()}`).toBeTruthy();
  await request.get(`${API_URL}/api/auth/csrf/`);
  const state = await request.storageState();
  const csrf = state.cookies.find((c) => c.name === 'csrftoken')?.value;
  expect(csrf, 'csrftoken cookie set').toBeTruthy();
  return { 'X-CSRFToken': csrf as string };
}

export interface AthleteFixture {
  id: number;
  first_name: string;
  last_name: string;
}

export async function createAthleteViaApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  overrides: Record<string, unknown> = {},
  index = 0,
): Promise<AthleteFixture> {
  const res = await request.post(`${API_URL}/api/tournament/athletes/`, {
    headers,
    data: {
      first_name: `Athlete${index}`,
      last_name: unique('Fam'),
      birth_date: '2015-01-15',
      weight: 30 + index,
      gender: 'male',
      club: 'E2E Club',
      ...overrides,
    },
  });
  expect(res.ok(), `create athlete: ${await res.text()}`).toBeTruthy();
  return (await res.json()) as AthleteFixture;
}

export async function getInviteCodeViaApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  athleteId: number,
): Promise<string> {
  const res = await request.post(
    `${API_URL}/api/tournament/athletes/${athleteId}/invite/`,
    { headers },
  );
  expect(res.ok(), `invite code: ${await res.text()}`).toBeTruthy();
  const data = (await res.json()) as { code: string };
  expect(data.code).toBeTruthy();
  return data.code;
}

export async function createTournamentViaApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  overrides: Record<string, unknown> = {},
): Promise<{ id: number; slug: string; name: string }> {
  const name = `E2E Cup ${unique('cup')}`;
  const res = await request.post(`${API_URL}/api/tournament/tournaments/`, {
    headers,
    data: {
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      start_date: '2026-10-01',
      end_date: '2026-10-05',
      mats_count: 1,
      status: 'draft',
      ...overrides,
    },
  });
  expect(res.ok(), `create tournament: ${await res.text()}`).toBeTruthy();
  return (await res.json()) as { id: number; slug: string; name: string };
}

export async function generateBracketViaApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  categoryId: number,
  athleteIds: number[],
): Promise<void> {
  const res = await request.post(
    `${API_URL}/api/tournament/categories/${categoryId}/generate_bracket/`,
    { headers, data: { athlete_ids: athleteIds } },
  );
  expect(res.ok(), `generate bracket: ${await res.text()}`).toBeTruthy();
}

export async function publishTournamentViaApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  tournamentId: number,
): Promise<void> {
  const res = await request.patch(
    `${API_URL}/api/tournament/tournaments/${tournamentId}/`,
    { headers, data: { status: 'published' } },
  );
  expect(res.ok(), `publish: ${await res.text()}`).toBeTruthy();
}
export async function createCategoryViaApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  tournamentId: number,
  overrides: Record<string, unknown> = {},
): Promise<{ id: number; name: string }> {
  const res = await request.post(`${API_URL}/api/tournament/categories/`, {
    headers,
    data: {
      tournament: tournamentId,
      name: `Boys ${unique('cat')}`,
      age_min: 8,
      age_max: 14,
      weight_max: '100',
      gender: 'male',
      order: 0,
      ...overrides,
    },
  });
  expect(res.ok(), `create category: ${await res.text()}`).toBeTruthy();
  return (await res.json()) as { id: number; name: string };
}
