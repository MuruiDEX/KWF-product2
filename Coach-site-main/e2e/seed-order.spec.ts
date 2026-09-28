import { test, expect } from '@playwright/test';
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

interface SeedSetup {
  coach: { username: string; password: string };
  tournamentId: number;
  categoryId: number;
  lasts: string[];
}

async function seedFixture(
  request: import('@playwright/test').APIRequestContext,
): Promise<SeedSetup> {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const tournament = await createTournamentViaApi(request, headers);
  const category = await createCategoryViaApi(request, headers, tournament.id, {
    age_min: 8,
    age_max: 14,
    weight_max: '100',
    gender: 'male',
  });
  const lasts = [unique('SeedA'), unique('SeedB'), unique('SeedC')];
  const ids: number[] = [];
  for (let i = 0; i < 3; i++) {
    const a = await createAthleteViaApi(
      request,
      headers,
      {
        first_name: `Seed${i}`,
        last_name: lasts[i],
        birth_date: '2014-06-01',
        weight: 30 + i,
        gender: 'male',
      },
      i,
    );
    ids.push(a.id);
  }
  const add = await request.post(
    `${API_URL}/api/tournament/categories/${category.id}/add_athletes/`,
    { headers, data: { athlete_ids: ids } },
  );
  expect(add.ok(), `add athletes: ${await add.text()}`).toBeTruthy();
  return { coach, tournamentId: tournament.id, categoryId: category.id, lasts };
}

function seedRow(page: import('@playwright/test').Page, lastName: string) {
  return page.locator('ol[aria-label="Порядок посева (первый — топ)"] > li', {
    hasText: lastName,
  });
}

test('seed list renders, move persists after reload', async ({
  page,
  request,
}) => {
  const { coach, tournamentId, lasts } = await seedFixture(request);
  await loginViaUi(page, coach.username, coach.password);

  await page.goto(`/cabinet/tournaments/${tournamentId}/manage?tab=participants`, {
    waitUntil: 'networkidle',
  });
  const list = page.locator('ol[aria-label="Порядок посева (первый — топ)"]');
  await expect(list).toBeVisible({ timeout: 15000 });
  await expect(list.locator('> li')).toHaveCount(3);

  // Исходный порядок — по добавлению.
  const firstBefore = await list.locator('> li').first().innerText();
  expect(firstBefore).toContain(lasts[0]);

  // Кнопка «ниже» у первого меняет порядок (optimistic + POST).
  // Ждём именно ответ save (а не только optimistic render): иначе живой
  // realtime-рефетч manage-страницы может обогнать и показать старый
  // порядок в окне гонки.
  const saveResponse = page.waitForResponse('**/set_seed_order/');
  await page
    .getByRole('button', { name: `Ниже в посеве: ${lasts[0]}` })
    .click();
  const saved = await saveResponse;
  expect(saved.ok(), 'set_seed_order saved').toBeTruthy();
  await expect(list.locator('> li').first()).toContainText(lasts[1], {
    timeout: 15000,
  });

  // Порядок пережил reload — сервер сохранил.
  await page.reload({ waitUntil: 'networkidle' });
  await expect(
    page.locator('ol[aria-label="Порядок посева (первый — топ)"] > li').first(),
  ).toContainText(lasts[1], { timeout: 15000 });
  await expect(seedRow(page, lasts[0])).toBeVisible();
});

test('seed drag-and-drop reorders via handle', async ({ page, request }) => {
  const { coach, tournamentId, lasts } = await seedFixture(request);
  await loginViaUi(page, coach.username, coach.password);

  await page.goto(`/cabinet/tournaments/${tournamentId}/manage?tab=participants`, {
    waitUntil: 'networkidle',
  });
  const list = page.locator('ol[aria-label="Порядок посева (первый — топ)"]');
  await expect(list.locator('> li')).toHaveCount(3);

  // Desktop: тянуть за ручку. Mobile: ручка скрыта (hidden sm:flex) —
  // там работают кнопки ↑/↓ (два шага вверх = на первое место).
  const handle = seedRow(page, lasts[2]).locator('span[draggable="true"]');
  if (await handle.isVisible()) {
    await handle.dragTo(list.locator('> li').first());
  } else {
    const up = page.getByRole('button', {
      name: `Выше в посеве: ${lasts[2]}`,
    });
    await expect(up).toBeVisible();
    await up.click();
    await up.click();
  }
  await expect(list.locator('> li').first()).toContainText(lasts[2], {
    timeout: 15000,
  });

  await page.reload({ waitUntil: 'networkidle' });
  await expect(
    page.locator('ol[aria-label="Порядок посева (первый — топ)"] > li').first(),
  ).toContainText(lasts[2], { timeout: 15000 });
});

test('seed server rejection rolls back with error', async ({
  page,
  request,
}) => {
  const { coach, tournamentId, categoryId, lasts } =
    await seedFixture(request);
  const headers = await loginViaApi(request, coach.username, coach.password);
  await loginViaUi(page, coach.username, coach.password);

  await page.goto(`/cabinet/tournaments/${tournamentId}/manage?tab=participants`, {
    waitUntil: 'networkidle',
  });
  const list = page.locator('ol[aria-label="Порядок посева (первый — топ)"]');
  await expect(list.locator('> li')).toHaveCount(3);

  // Гонка «состав изменился, пока страница открыта»: убираем третьего
  // напрямую через API (manage-страница не ресинкается на CATEGORY_MEMBERS
  // без bracket/queue-событий — UI остаётся с протухшим составом).
  // NOTE: route.abort() для set_seed_order здесь не используется — на webkit
  // перехват route молча не срабатывал и save уходил на сервер (200),
  // делая тест ложно-красным. Реальный 400 от сервера детерминирован везде.
  const athletesRes = await request.get(
    `${API_URL}/api/tournament/tournaments/${tournamentId}/`,
    { headers },
  );
  expect(athletesRes.ok()).toBeTruthy();
  const detail = (await athletesRes.json()) as {
    categories: { id: number; athletes: { id: number }[] }[];
  };
  const cat = detail.categories.find((c) => c.id === categoryId);
  expect(cat).toBeTruthy();
  const removedId = cat!.athletes[2].id;
  const removed = await request.post(
    `${API_URL}/api/tournament/categories/${categoryId}/remove_athlete/`,
    { headers, data: { athlete_id: removedId } },
  );
  expect(removed.ok(), `remove athlete: ${await removed.text()}`).toBeTruthy();

  // UI шлёт протухший набор из 3 id → backend 400 → rollback + рефетч.
  await page
    .getByRole('button', { name: `Ниже в посеве: ${lasts[0]}` })
    .click();
  await expect(page.getByText(/ровно текущий состав/)).toBeVisible({
    timeout: 15000,
  });
  await expect(list.locator('> li')).toHaveCount(2, { timeout: 15000 });
  await expect(list.locator('> li').first()).toContainText(lasts[0], {
    timeout: 15000,
  });
});

test('seed order endpoint requires auth', async ({ request }) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const tournament = await createTournamentViaApi(request, headers);
  const category = await createCategoryViaApi(request, headers, tournament.id);

  const anon = await request.post(
    `${API_URL}/api/tournament/categories/${category.id}/set_seed_order/`,
    { data: { athlete_ids: [1, 2] } },
  );
  expect([401, 403]).toContain(anon.status());
});
