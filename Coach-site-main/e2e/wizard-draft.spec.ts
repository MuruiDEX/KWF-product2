import { test, expect } from '@playwright/test';
import { clickViaJs, loginViaUi, registerViaApi, unique, API_URL } from './helpers';

const FOOTER_NEXT = 'div.flex.justify-between.mt-8 > button:last-child';

test.setTimeout(180000);

test('wizard blocks empty submit with inline field errors', async ({
  page,
  request,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  await loginViaUi(page, coach.username, coach.password);

  await page.goto('/cabinet/tournaments/create', { waitUntil: 'networkidle' });
  await clickViaJs(page, FOOTER_NEXT);
  // Inline ошибка у поля + общий алерт шага.
  await expect(page.getByText('Укажите название турнира')).toBeVisible();
  await expect(page.getByText('Проверьте подсвеченные поля')).toBeVisible();
  // Шаг не сменился.
  await expect(
    page.getByRole('heading', { name: 'Основная информация' }),
  ).toBeVisible();

  // Заполняем минимум — переход разрешён.
  const tourName = `E2E Cup ${unique('cup')}`;
  await page.getByLabel('Название турнира').fill(tourName);
  await page.getByLabel('Дата начала *').fill('2026-10-01');
  await page.getByLabel('Дата окончания *').fill('2026-10-05');
  await clickViaJs(page, FOOTER_NEXT);
  await expect(
    page.getByRole('heading', { name: 'Настройка категорий' }),
  ).toBeVisible({ timeout: 15000 });
});

test('draft survives reload and can be discarded', async ({
  page,
  request,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  await loginViaUi(page, coach.username, coach.password);

  await page.goto('/cabinet/tournaments/create', { waitUntil: 'networkidle' });
  const tourName = `E2E Draft ${unique('cup')}`;
  await page.getByLabel('Название турнира').fill(tourName);
  await page.getByLabel('Дата начала *').fill('2026-10-01');
  await page.getByLabel('Дата окончания *').fill('2026-10-05');
  // Автосейв черновика — debounce 600мс, ждём с запасом.
  await page.waitForTimeout(1500);

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByText('Восстановлен черновик')).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByLabel('Название турнира')).toHaveValue(tourName);

  // Отказ от черновика чистит форму.
  await page.getByRole('button', { name: 'Начать заново' }).click();
  await expect(page.getByLabel('Название турнира')).toHaveValue('');
});

test('save draft exits without creating, publish toggle exists', async ({
  page,
  request,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  await loginViaUi(page, coach.username, coach.password);

  await page.goto('/cabinet/tournaments/create', { waitUntil: 'networkidle' });
  const tourName = `E2E SaveDraft ${unique('cup')}`;
  await page.getByLabel('Название турнира').fill(tourName);
  await page.getByLabel('Дата начала *').fill('2026-10-01');
  await page.getByLabel('Дата окончания *').fill('2026-10-05');
  await clickViaJs(page, FOOTER_NEXT);

  await page.getByRole('button', { name: 'Добавить категорию' }).click();
  await expect(
    page.getByRole('paragraph').filter({ hasText: /^Мальчики \/ 10–12 \/ до 45 кг$/ }),
  ).toBeVisible();
  await clickViaJs(page, FOOTER_NEXT);

  // Participants: категория автовыбрана, просто идём дальше.
  await clickViaJs(page, FOOTER_NEXT);

  // Review: итог + публикация + Save Draft.
  await expect(
    page.getByRole('heading', { name: 'Проверка и запуск' }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(tourName)).toBeVisible();
  await expect(page.getByLabel('Сразу опубликовать')).toBeVisible();
  await page.getByRole('button', { name: 'Сохранить черновик' }).first().click();
  await expect(page).toHaveURL(/\/cabinet\/tournaments\/?$/, {
    timeout: 15000,
  });

  // Турнир НЕ создан (черновик только в localStorage).
  const listRes = await page.request.get(`${API_URL}/api/tournament/tournaments/`);
  expect(listRes.ok()).toBeTruthy();
  const listJson = (await listRes.json()) as
    | { results: { name: string }[] }
    | { name: string }[];
  const names = Array.isArray(listJson)
    ? listJson.map((t) => t.name)
    : listJson.results.map((t) => t.name);
  expect(names).not.toContain(tourName);

  // Черновик обязан лежать в storage до ухода со страницы.
  const keysBefore = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith('kwf-tournament-draft-')),
  );
  expect(keysBefore, 'draft key persisted before exit').toHaveLength(1);

  // Возврат в wizard — черновик восстановлен.
  await page.goto('/cabinet/tournaments/create', { waitUntil: 'networkidle' });
  const keysAfter = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith('kwf-tournament-draft-')),
  );
  expect(keysAfter, 'draft key present after return').toHaveLength(1);
  await expect(page.getByText('Восстановлен черновик')).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByLabel('Название турнира')).toHaveValue(tourName);
});
