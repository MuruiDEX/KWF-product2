import { test, expect } from '@playwright/test';
import { API_URL, clickViaJs, unique } from './helpers';

const FOOTER_NEXT = 'div.flex.justify-between.mt-8 > button:last-child';

test.setTimeout(180000);

test('trainer journey: register → tournament → bracket → finish → publish', async ({
  page,
  request,
}) => {
  const tourName = `E2E Cup ${unique('cup')}`;
  const kidA = { first: 'TestA', last: `Fam${unique('a')}` };
  const kidB = { first: 'TestB', last: `Fam${unique('b')}` };

  // 1. Register as trainer via UI.
  const username = unique('coach');
  await page.goto('/register', { waitUntil: 'networkidle' });
  await page.getByLabel('Имя', { exact: true }).fill('E2E');
  await page.getByLabel('Фамилия', { exact: true }).fill('Coach');
  await page.getByLabel('Имя пользователя *').fill(username);
  await page.getByLabel('Email *').fill(`${username}@example.com`);
  await page.getByLabel('Пароль *').fill('Test12345!');
  await page.getByLabel('Тренер', { exact: true }).check();
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await expect(page).toHaveURL(/\/cabinet/, { timeout: 15000 });

  // 2. Wizard: info step.
  await page.goto('/cabinet/tournaments/create');
  await page.getByLabel('Название турнира').fill(tourName);
  await page.getByLabel('Дата начала *').fill('2026-10-01');
  await page.getByLabel('Дата окончания *').fill('2026-10-05');
  await page.getByRole('button', { name: 'Продолжить' }).click();

  // 3. Categories step: defaults (male 10-12, 45kg) are fine.
  // N13: автоназвание категории — формат "Мальчики / 10–12 / до 45 кг".
  // Превью в форме и карточка в списке содержат один текст — целимся в карточку.
  await page.getByRole('button', { name: 'Добавить категорию' }).click();
  await expect(
    page.getByRole('paragraph').filter({ hasText: /^Мальчики \/ 10–12 \/ до 45 кг$/ })
  ).toBeVisible();
  await clickViaJs(page, FOOTER_NEXT);

  // 4. Participants: pick category, add 2 athletes manually, select them.
  await page.locator('select').first().selectOption({ index: 1 });
  for (const kid of [kidA, kidB]) {
    await page.getByRole('button', { name: 'Добавить вручную' }).click();
    await page.getByLabel('Имя *').fill(kid.first);
    await page.getByLabel('Фамилия *').fill(kid.last);
    await page.getByLabel('Дата рождения *').fill('2015-01-15');
    await page.getByLabel('Вес (кг) *').fill('30');
    await page.getByLabel('Клуб / тренер *').fill('E2E Club');
    // Submit через Enter: на узком viewport кнопку сабмита может
    // перекрывать проскролленный контент модалки.
    await page.getByLabel('Клуб / тренер *').press('Enter');
    await expect(
      page.getByText(`${kid.last} ${kid.first}`),
    ).toBeVisible({ timeout: 15000 });
  }
  // Ручное добавление сразу отмечает атлета выбранным (toggleAthlete
  // в handleSaveManualAthlete) — кликать по строкам не нужно.
  for (const kid of [kidA, kidB]) {
    const row = page.locator('div.cursor-pointer', {
      hasText: `${kid.last} ${kid.first}`,
    });
    await expect(row).toHaveClass(/border-primary-blue/);
  }
  await clickViaJs(page, FOOTER_NEXT);

  // 5. Review → submit.
  await clickViaJs(page, FOOTER_NEXT);
  await expect(page).toHaveURL(/\/cabinet\/tournaments\/?$/, {
    timeout: 20000,
  });
  await expect(page.getByText(tourName).first()).toBeVisible();

  // Tournament id via API (same browser cookies).
  const listRes = await page.request.get(`${API_URL}/api/tournament/tournaments/`);
  expect(listRes.ok()).toBeTruthy();
  const listJson = (await listRes.json()) as
    | Array<{ id: number; name: string; slug: string }>
    | { results: Array<{ id: number; name: string; slug: string }> };
  const list = Array.isArray(listJson) ? listJson : listJson.results;
  const created = list.find((t) => t.name === tourName);
  expect(created, 'tournament created via wizard').toBeTruthy();

  // 6. Manage → readiness виден → bracket tab → start round → finish.
  await page.goto(`/cabinet/tournaments/${created!.id}/manage`);
  await expect(page.getByText('Готовность турнира')).toBeVisible({
    timeout: 15000,
  });
  // Перевес: участники → вписать заведомо большой вес → красный флаг.
  await page
    .locator('div.overflow-x-auto.rounded-2xl > button', {
      hasText: 'Участники',
    })
    .click();
  const weightInput = page.getByLabel(/Фактический вес:/).first();
  await expect(weightInput).toBeVisible({ timeout: 15000 });
  await weightInput.fill('99');
  await weightInput.press('Enter');
  await expect(page.getByText(/Перевес:/).first()).toBeVisible({
    timeout: 15000,
  });
  await page
    .locator('div.overflow-x-auto.rounded-2xl > button', { hasText: 'Сетка' })
    .click();
  await page.getByRole('button', { name: 'Старт раунда' }).first().click();
  await expect(page.getByText(/Бой|Матч|раунд/i).first()).toBeVisible({
    timeout: 15000,
  });
  await clickViaJs(
    page,
    'button:has-text("Победитель A")',
  );
  await clickViaJs(
    page,
    'button:has-text("Завершить бой")',
  );
  // Фаза 1: двухшаговый финиш — первый тап ставит на взвод.
  await clickViaJs(
    page,
    'button:has-text("Точно завершить?")',
  );
  await expect(page.getByText(/Победитель:/).first()).toBeVisible({
    timeout: 15000,
  });

  // 7. Publish (инлайн-модалка manage-страницы, role=dialog).
  await page.getByRole('button', { name: 'Опубликовать' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Опубликовать' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Снять с публикации' }),
  ).toBeVisible({ timeout: 15000 });

  await page.goto(`/tournaments/${created!.slug}`);
  await expect(page.getByText(tourName).first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(/Победитель:/).first()).toBeVisible({
    timeout: 15000,
  });

  // Sanity: auth via cookies (no localStorage tokens anymore).
  const tokens = await page.evaluate(() => ({
    access: localStorage.getItem('access_token'),
    refresh: localStorage.getItem('refresh_token'),
  }));
  expect(tokens.access).toBeNull();
  expect(tokens.refresh).toBeNull();
});
