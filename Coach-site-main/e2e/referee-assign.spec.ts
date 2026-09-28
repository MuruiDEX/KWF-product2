import { test, expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test';
import {
  API_URL,
  createAthleteViaApi,
  createCategoryViaApi,
  createTournamentViaApi,
  generateBracketViaApi,
  loginViaApi,
  loginViaUi,
  publishTournamentViaApi,
  registerViaApi,
} from './helpers';

test.setTimeout(240000);

/** Staff Missing → Assign Inline: пропуски судей чинятся в контексте строки. */

interface Setup {
  tournament: { id: number };
  owner: { username: string; password: string };
  ownerName: string;
  secondName: string;
}

async function renameMe(
  request: APIRequestContext,
  headers: Record<string, string>,
  firstName: string,
  lastName: string,
) {
  const res = await request.patch(`${API_URL}/api/auth/me/`, {
    headers,
    data: { first_name: firstName, last_name: lastName },
  });
  expect(res.ok(), `rename me: ${await res.text()}`).toBeTruthy();
}

async function setupStaffTournament(request: APIRequestContext): Promise<Setup> {
  // Два тренера-кандидата. Фамилии уникальны на запуск: referee_candidates
  // глобален, БД e2e общая — имена других тестов не должны пересекаться.
  // Поведение поиска то же, что в ТЗ («иван» находит обоих).
  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const owner = await registerViaApi(request, 'trainer');
  const ownerHeaders = await loginViaApi(request, owner.username, owner.password);
  const ownerName = `Иван Петров${tag}`;
  await renameMe(request, ownerHeaders, 'Иван', `Петров${tag}`);
  const second = await registerViaApi(request, 'trainer');
  // Второй тренер — в изолированном контексте: общий jar должен остаться
  // за владельцем, иначе сетап дальше пойдёт от чужого имени.
  const isolated = await playwrightRequest.newContext();
  let secondName = '';
  try {
    const secondHeaders = await loginViaApi(isolated, second.username, second.password);
    secondName = `Артём Иванов${tag}`;
    await renameMe(isolated, secondHeaders, 'Артём', `Иванов${tag}`);
  } finally {
    await isolated.dispose();
  }

  const tournament = await createTournamentViaApi(request, ownerHeaders, {
    mats_count: 2,
  });
  const category = await createCategoryViaApi(request, ownerHeaders, tournament.id);
  const kids = [];
  for (let i = 0; i < 4; i++) {
    kids.push(await createAthleteViaApi(request, ownerHeaders, {}, i));
  }
  const addRes = await request.post(
    `${API_URL}/api/tournament/categories/${category.id}/add_athletes/`,
    { headers: ownerHeaders, data: { athlete_ids: kids.map((k) => k.id) } },
  );
  expect(addRes.ok(), `add_athletes: ${await addRes.text()}`).toBeTruthy();
  await generateBracketViaApi(
    request,
    ownerHeaders,
    category.id,
    kids.map((k) => k.id),
  );
  for (const [order, name] of ['Татами 1', 'Татами 2'].entries()) {
    const tatRes = await request.post(`${API_URL}/api/tournament/tatamis/`, {
      headers: ownerHeaders,
      data: { name, order },
    });
    expect(tatRes.ok(), `create tatami: ${await tatRes.text()}`).toBeTruthy();
  }
  const distRes = await request.post(
    `${API_URL}/api/tournament/tournaments/${tournament.id}/distribute_tatamis/`,
    { headers: ownerHeaders },
  );
  expect(distRes.ok(), `distribute: ${await distRes.text()}`).toBeTruthy();
  await publishTournamentViaApi(request, ownerHeaders, tournament.id);

  // Два боя в ACTIVE-статусе без судьи → две независимые строки «Без судьи».
  const detailRes = await request.get(
    `${API_URL}/api/tournament/tournaments/${tournament.id}/`,
    { headers: ownerHeaders },
  );
  expect(detailRes.ok()).toBeTruthy();
  const detail = (await detailRes.json()) as {
    categories: {
      rounds: { matches: { id: number; status: string; referee: number | null }[] }[];
    }[];
  };
  const openIds: number[] = [];
  for (const cat of detail.categories) {
    for (const round of cat.rounds) {
      for (const m of round.matches) {
        if (m.referee === null && (m.status === 'ready' || m.status === 'waiting')) {
          openIds.push(m.id);
        }
      }
    }
  }
  // Свежие матчи сетки уже в ACTIVE-статусе (ready) без судьи —
  // это и есть независимые строки «Без судьи». Ничего не стартуем:
  // start_match пускает только один бой на татами.
  expect(openIds.length).toBeGreaterThanOrEqual(2);
  return { tournament, owner, ownerName, secondName };
}

async function openStaffTab(page: Page, tournamentId: number, owner: Setup['owner']) {
  await loginViaUi(page, owner.username, owner.password);
  await page.goto(`/cabinet/tournaments/${tournamentId}/manage?tab=staff`, {
    waitUntil: 'networkidle',
  });
  await expect(page.getByText('Без судьи').first()).toBeVisible({ timeout: 15000 });
}

function assignButtons(page: Page) {
  return page.getByRole('button', { name: /Назначить судью/ });
}

test('referee assign: missing rows show inline action', async ({ page, request }) => {
  const { tournament, owner } = await setupStaffTournament(request);
  await openStaffTab(page, tournament.id, owner);
  // Сценарий 1: каждая строка без судьи чинится на месте.
  await expect(assignButtons(page).first()).toBeVisible();
  expect(await assignButtons(page).count()).toBeGreaterThanOrEqual(2);
  await expect(page.getByText('Судья: —').first()).toBeVisible();
});

test('referee assign: selector opens with search and candidates', async ({
  page,
  request,
}) => {
  const { tournament, owner, ownerName, secondName } = await setupStaffTournament(request);
  await openStaffTab(page, tournament.id, owner);
  // Сценарий 2: поповер открывается у строки, фокус — в поиске.
  await assignButtons(page).first().click();
  await expect(page.getByPlaceholder('Поиск судьи…')).toBeVisible();
  await expect(page.getByPlaceholder('Поиск судьи…')).toBeFocused();
  await expect(page.getByRole('option', { name: ownerName })).toBeVisible();
  await expect(page.getByRole('option', { name: secondName })).toBeVisible();
});

test('referee assign: search by first name and surname', async ({ page, request }) => {
  const { tournament, owner, ownerName, secondName } = await setupStaffTournament(request);
  await openStaffTab(page, tournament.id, owner);
  // Сценарий 3: «иван» находит обоих; точная фамилия — только своего.
  await assignButtons(page).first().click();
  const search = page.getByPlaceholder('Поиск судьи…');
  await search.fill('иван');
  await expect(page.getByRole('option', { name: ownerName })).toBeVisible();
  await expect(page.getByRole('option', { name: secondName })).toBeVisible();
  await search.fill(ownerName.split(' ')[1]);
  await expect(page.getByRole('option', { name: ownerName })).toBeVisible();
  await expect(page.getByRole('option', { name: secondName })).toHaveCount(0);
});

test('referee assign: select referee, row updates immediately', async ({
  page,
  request,
}) => {
  const { tournament, owner, ownerName } = await setupStaffTournament(request);
  await openStaffTab(page, tournament.id, owner);
  // Сценарий 4: выбор → реальный set_referee → строка сразу показывает судью.
  const before = await assignButtons(page).count();
  await assignButtons(page).first().click();
  await page.getByPlaceholder('Поиск судьи…').fill(ownerName.split(' ')[1]);
  const setReferee = page.waitForResponse(
    (r) => r.url().includes('/set_referee/') && r.request().method() === 'POST',
  );
  await page.getByRole('option', { name: ownerName }).click();
  const resp = await setReferee;
  expect(resp.ok(), `set_referee: ${await resp.text()}`).toBeTruthy();
  await expect(page.getByText(`✓ Назначено: ${ownerName}`).first()).toBeVisible();
  // Точечный патч: строка уходит из пропусков, вторая строка не тронута.
  await expect
    .poll(async () => assignButtons(page).count(), { timeout: 10000 })
    .toBe(before - 1);
  await expect(page.getByText(ownerName).first()).toBeVisible();
});

test('referee assign: api error keeps row, retry works', async ({ page, request }) => {
  const { tournament, owner, ownerName } = await setupStaffTournament(request);
  await openStaffTab(page, tournament.id, owner);
  // Сценарий 5: ошибка → строка не выглядит назначенной → повтор успешен.
  const before = await assignButtons(page).count();
  await page.route('**/set_referee/', (route) => route.abort('failed'));
  await assignButtons(page).first().click();
  await page.getByRole('option', { name: ownerName }).click();
  await expect(page.getByText('Не удалось назначить судью').first()).toBeVisible();
  expect(await assignButtons(page).count()).toBe(before);
  await page.unroute('**/set_referee/');
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByText(`✓ Назначено: ${ownerName}`).first()).toBeVisible({
    timeout: 15000,
  });
});

test('referee assign: rows are independent', async ({ page, request }) => {
  const { tournament, owner, secondName } = await setupStaffTournament(request);
  await openStaffTab(page, tournament.id, owner);
  // Сценарий 6: чиним первую строку — вторая остаётся без судьи.
  const secondLabel =
    (await assignButtons(page).nth(1).getAttribute('aria-label')) ?? '';
  await assignButtons(page).first().click();
  await page.getByRole('option', { name: secondName }).click();
  await expect(page.getByText(`✓ Назначено: ${secondName}`).first()).toBeVisible();
  await expect
    .poll(async () => assignButtons(page).count(), { timeout: 10000 })
    .toBe(1);
  await expect(assignButtons(page).first()).toHaveAttribute('aria-label', secondLabel);
});

test('referee assign: dark selector stays navy', async ({ page, request }) => {
  const { tournament, owner, ownerName } = await setupStaffTournament(request);
  // Тема применяется один раз при загрузке — эмулируем до навигации.
  await page.emulateMedia({ colorScheme: 'dark' });
  await openStaffTab(page, tournament.id, owner);
  // Сценарий 7: тёмная тема — без белых карточек в поповере.
  await assignButtons(page).first().click();
  const popover = page.getByRole('listbox', { name: 'Кандидаты в судьи' }).locator('..');
  await expect
    .poll(async () =>
      popover.evaluate((el) => {
        const m = getComputedStyle(el as HTMLElement)
          .backgroundColor.match(/[\d.]+/g)
          ?.map(Number);
        return m ? m.slice(0, 3).join(',') : '';
      }),
    )
    .not.toMatch(/^255,255,255/);
  await expect(page.getByRole('option', { name: ownerName })).toBeVisible();
});

test('referee assign: mobile layout has no overflow', async ({ page, request }) => {
  const { tournament, owner, ownerName } = await setupStaffTournament(request);
  await openStaffTab(page, tournament.id, owner);
  // Сценарий 8 (мобайл-проект Pixel 7): поповер в пределах вьюпорта, опции тапабельны.
  await assignButtons(page).first().click();
  const option = page.getByRole('option', { name: ownerName });
  await expect(option).toBeVisible();
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    return de.scrollWidth - de.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
  await option.click();
  await expect(page.getByText(`✓ Назначено: ${ownerName}`).first()).toBeVisible();
});

test('referee assign: keyboard flow', async ({ page, request }) => {
  const { tournament, owner, ownerName } = await setupStaffTournament(request);
  const ownerSurname = ownerName.split(' ')[1];
  await openStaffTab(page, tournament.id, owner);
  // Сценарий 9: Enter открывает → ввод ищет → Enter назначает; Escape закрывает.
  await assignButtons(page).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByPlaceholder('Поиск судьи…')).toBeFocused();
  await page.keyboard.type(ownerSurname);
  await expect(page.getByRole('option', { name: ownerName })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText(`✓ Назначено: ${ownerName}`).first()).toBeVisible();
  // Дожидаемся точечного патча: осталась одна строка — её поповер и закрываем.
  await expect
    .poll(async () => assignButtons(page).count(), { timeout: 10000 })
    .toBe(1);
  // Escape на оставшейся строке закрывает поповер и возвращает фокус.
  await assignButtons(page).first().click();
  await expect(page.getByPlaceholder('Поиск судьи…')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByPlaceholder('Поиск судьи…')).toHaveCount(0);
  await expect(assignButtons(page).first()).toBeFocused();
});
