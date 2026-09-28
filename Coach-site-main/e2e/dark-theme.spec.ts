import { test, expect, type Page } from '@playwright/test';
import {
  API_URL,
  createAthleteViaApi,
  createCategoryViaApi,
  createTournamentViaApi,
  loginViaApi,
  loginViaUi,
  registerViaApi,
} from './helpers';

test.setTimeout(180000);
test.use({ colorScheme: 'dark' });

/** Возвращает элементы-карточки с почти белым НЕпрозрачным фоном.
 * Полупрозрачные glass-поверхности (bg-white/5 и т.п.) — легитимны. */
async function findWhiteSurfaces(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bad: string[] = [];
    const els = document.querySelectorAll(
      '.rounded-2xl.border, .rounded-xl.border, .rounded-full.border, table',
    );
    els.forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const m = getComputedStyle(el)
        .backgroundColor.match(/[\d.]+/g)
        ?.map(Number);
      if (!m || m.length < 3) return;
      const alpha = m.length >= 4 ? m[3] : 1;
      if (alpha >= 0.5 && m[0] > 200 && m[1] > 200 && m[2] > 200) {
        bad.push(
          `${(el as HTMLElement).tagName}.${((el as HTMLElement).className as string)
            .split(' ')
            .slice(0, 4)
            .join('.')} :: ${((el as HTMLElement).innerText || '').slice(0, 60)}`,
        );
      }
    });
    return bad;
  });
}

async function expectDarkRoot(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => document.documentElement.classList.contains('dark')),
    )
    .toBe(true);
}

test('dark theme: homepage has no stray white surfaces, text stays readable', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expectDarkRoot(page);
  // Тело страницы тёмное, основной текст светлый.
  const body = await page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    return { bg: cs.backgroundColor, fg: cs.color };
  });
  expect(body.bg).not.toMatch(/255,\s*255,\s*255/);
  expect(await page.locator('h1').first().isVisible()).toBe(true);
  const bad = await findWhiteSurfaces(page);
  expect(bad).toEqual([]);
});

test('dark theme: manage + setup wizard stay navy with readable text', async ({
  page,
  request,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const kid = await createAthleteViaApi(request, headers, {}, 0);
  const kid2 = await createAthleteViaApi(request, headers, {}, 1);
  const tournament = await createTournamentViaApi(request, headers);
  const category = await createCategoryViaApi(request, headers, tournament.id);
  const addRes = await request.post(
    `${API_URL}/api/tournament/categories/${category.id}/add_athletes/`,
    { headers, data: { athlete_ids: [kid.id, kid2.id] } },
  );
  expect(addRes.ok(), `add_athletes: ${await addRes.text()}`).toBeTruthy();

  await loginViaUi(page, coach.username, coach.password);
  await page.goto(`/cabinet/tournaments/${tournament.id}/manage`, {
    waitUntil: 'networkidle',
  });
  await expectDarkRoot(page);
  await expect(page.getByText('Control Center').first()).toBeVisible({
    timeout: 15000,
  });

  // Хедер, таблицы, табы — без белых поверхностей.
  expect(await findWhiteSurfaces(page)).toEqual([]);

  // Визард подготовки: модалка тёмная, шаги читаемы.
  await page.getByRole('button', { name: 'Подготовить турнир' }).first().click();
  await expect(
    page.getByRole('dialog', { name: 'Автоматическая подготовка турнира' }),
  ).toBeVisible({ timeout: 10000 });
  expect(await findWhiteSurfaces(page)).toEqual([]);
  // Таблица категорий в визарде читаема (заголовок-контейнер тёмный).
  await expect(page.getByText('Выбрать все').first()).toBeVisible();
  await page.keyboard.press('Escape');

  // Таб «Категории»: таблица без белых панелей.
  await page.getByRole('tab', { name: 'Категории' }).click();
  await expect(page.getByText('Категории ·').first()).toBeVisible({
    timeout: 10000,
  });
  expect(await findWhiteSurfaces(page)).toEqual([]);
});
