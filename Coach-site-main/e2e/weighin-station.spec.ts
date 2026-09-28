import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  API_URL,
  createAthleteViaApi,
  createCategoryViaApi,
  createTournamentViaApi,
  loginViaApi,
  loginViaUi,
  registerViaApi,
  unique,
} from './helpers';

test.setTimeout(180000);

/** Weigh-in теперь — отдельная вкладка (?tab=weighin, WeighInSection):
 * таблица, инлайн-редактирование веса, фильтры, счётчик прогресса.
 * Старого station-режима с очередью больше нет — тесты проверяют
 * тот же пользовательский смысл на актуальном UI. */

async function seedWeighin(request: APIRequestContext, headers: Record<string, string>) {
  const tag = unique('w');
  const mk = (first: string, last: string, i: number) =>
    createAthleteViaApi(request, headers, { first_name: first, last_name: `${last}${tag}` }, i);
  const a = await mk('Ivan', 'Petrov', 0);
  const b = await mk('Artem', 'Ivanov', 1);
  const c = await mk('Kim', 'Sidorov', 2);
  const tournament = await createTournamentViaApi(request, headers);
  const category = await createCategoryViaApi(request, headers, tournament.id);
  const addRes = await request.post(
    `${API_URL}/api/tournament/categories/${category.id}/add_athletes/`,
    { headers, data: { athlete_ids: [a.id, b.id, c.id] } },
  );
  expect(addRes.ok(), `add_athletes: ${await addRes.text()}`).toBeTruthy();
  return { tournament, tag };
}

async function openWeighin(page: Page, tournamentId: number) {
  await page.goto(`/cabinet/tournaments/${tournamentId}/manage?tab=weighin`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByText('Взвешено 0/3').first()).toBeVisible({ timeout: 15000 });
}

async function weighAthlete(page: Page, name: string, weight: string) {
  await page.getByRole('button', { name: `Взвесить: ${name}` }).click();
  await page.getByLabel(`Вес: ${name}`).fill(weight);
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
}

test('weigh-in tab: open, weigh flow, progress', async ({ page, request }) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const { tournament, tag } = await seedWeighin(request, headers);
  await loginViaUi(page, coach.username, coach.password);
  await openWeighin(page, tournament.id);

  // Scenario 1: таблица с тремя строками, все без веса.
  await expect(page.getByText(`Petrov${tag} Ivan`).first()).toBeVisible();
  await expect(page.getByText('Без веса').first()).toBeVisible();

  // Scenario 2: валидный вес сохраняется, счётчик растёт.
  await weighAthlete(page, `Ivanov${tag} Artem`, '30');
  await expect(page.getByText('Взвешено 1/3').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Взвешен').first()).toBeVisible();
  await weighAthlete(page, `Petrov${tag} Ivan`, '31');
  await expect(page.getByText('Взвешено 2/3').first()).toBeVisible({ timeout: 10000 });

  // Scenario 8: всех взвесили — счётчик полный.
  await weighAthlete(page, `Sidorov${tag} Kim`, '32');
  await expect(page.getByText('Взвешено 3/3').first()).toBeVisible({ timeout: 10000 });
});

test('weigh-in tab: search by first and last name', async ({ page, request }) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const { tournament, tag } = await seedWeighin(request, headers);
  await loginViaUi(page, coach.username, coach.password);
  await openWeighin(page, tournament.id);

  // Scenario 3: поиск сужает таблицу (debounce 300мс).
  await page.getByLabel('Поиск участника по имени').fill('sidorov');
  await expect(page.getByText(`Sidorov${tag} Kim`).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(`Petrov${tag} Ivan`).first()).toHaveCount(0);
  await expect(page.getByText(`Ivanov${tag} Artem`).first()).toHaveCount(0);

  // Scenario 4: поиск по другому имени.
  await page.getByLabel('Поиск участника по имени').fill(`Ivanov${tag}`);
  await expect(page.getByText(`Ivanov${tag} Artem`).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(`Sidorov${tag} Kim`).first()).toHaveCount(0);

  // Очистка возвращает всех.
  await page.getByRole('button', { name: 'Очистить поиск' }).click();
  await expect(page.getByText(`Petrov${tag} Ivan`).first()).toBeVisible({ timeout: 10000 });
});

test('weigh-in tab: invalid weight keeps athlete unweighed', async ({ page, request }) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const { tournament, tag } = await seedWeighin(request, headers);
  await loginViaUi(page, coach.username, coach.password);
  await openWeighin(page, tournament.id);

  // Scenario 5: невалидный вес — ошибка, вес не сохранён, счётчик на месте.
  await page.getByRole('button', { name: `Взвесить: Ivanov${tag} Artem` }).click();
  await page.getByLabel(`Вес: Ivanov${tag} Artem`).fill('-3');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Укажите корректный вес больше нуля.').first()).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('Взвешено 0/3').first()).toBeVisible();
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
});

test('weigh-in tab: api error shows retry, weight not saved', async ({
  page,
  request,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const { tournament, tag } = await seedWeighin(request, headers);
  await loginViaUi(page, coach.username, coach.password);
  await openWeighin(page, tournament.id);

  // Scenario 6: обрыв сети → FriendlyError + повтор, вес не сохранён.
  await page.route('**/checkin/', (r) => r.abort());
  await page.getByRole('button', { name: `Взвесить: Ivanov${tag} Artem` }).click();
  await page.getByLabel(`Вес: Ivanov${tag} Artem`).fill('30');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('alert').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Взвешено 0/3').first()).toBeVisible();
  await page.unroute('**/checkin/');
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByText('Взвешено 0/3').first()).toBeVisible({ timeout: 15000 });
});

test('weigh-in tab: overweight warns and stays visible', async ({
  page,
  request,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const { tournament, tag } = await seedWeighin(request, headers);
  await loginViaUi(page, coach.username, coach.password);
  await openWeighin(page, tournament.id);

  // Scenario 7: перевес (лимит категории 100) — статус и счётчик.
  await weighAthlete(page, `Ivanov${tag} Artem`, '150');
  await expect(page.getByText('Перевес').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Взвешено 1/3').first()).toBeVisible();
  // Фильтр «Перевес» оставляет только его.
  await page.getByLabel('Фильтр по статусу взвешивания').selectOption('overweight');
  await expect(page.getByText(`Petrov${tag} Ivan`).first()).toHaveCount(0);
  await expect(page.getByText('Перевес').first()).toBeVisible();
});

test('weigh-in tab: dark surfaces stay navy', async ({ page, request }) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const { tournament } = await seedWeighin(request, headers);
  // Scenario 9: тёмная тема применяется при загрузке (init-скрипт).
  await page.emulateMedia({ colorScheme: 'dark' });
  await loginViaUi(page, coach.username, coach.password);
  await openWeighin(page, tournament.id);
  await expect
    .poll(async () =>
      page.evaluate(() => document.documentElement.classList.contains('dark')),
    )
    .toBe(true);
  const bad: string[] = await page.evaluate(() => {
    const out: string[] = [];
    document
      .querySelectorAll('.rounded-2xl.border, .rounded-xl.border')
      .forEach((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        const m = getComputedStyle(el)
          .backgroundColor.match(/[\d.]+/g)
          ?.map(Number);
        if (!m || m.length < 3) return;
        const alpha = m.length >= 4 ? m[3] : 1;
        if (alpha >= 0.5 && m[0] > 200 && m[1] > 200 && m[2] > 200) {
          out.push((el as HTMLElement).className as string);
        }
      });
    return out;
  });
  expect(bad).toEqual([]);
});
