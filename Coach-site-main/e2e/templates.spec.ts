import { test, expect } from '@playwright/test';
import {
  API_URL,
  createCategoryViaApi,
  createTournamentViaApi,
  loginViaApi,
  loginViaUi,
  registerViaApi,
} from './helpers';

test.setTimeout(180000);

test('templates: save from manage → apply in wizard', async ({
  page,
  request,
}) => {
  // 1. Тренер + турнир с категорией через API.
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const tournament = await createTournamentViaApi(request, headers);
  await createCategoryViaApi(request, headers, tournament.id, {
    name: 'Мальчики 8-9',
    age_min: 8,
    age_max: 9,
    weight_max: '30',
    gender: 'male',
  });

  // 2. UI: login, manage → «В шаблон» → имя → успех.
  await loginViaUi(page, coach.username, coach.password);
  await page.goto(`/cabinet/tournaments/${tournament.id}/manage`);
  await page.getByRole('button', { name: 'В шаблон' }).click();
  await page
    .getByPlaceholder('Например: Городской турнир — стандарт')
    .fill('E2E шаблон');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText(/Шаблон «E2E шаблон» сохранён/)).toBeVisible({
    timeout: 15000,
  });

  // 3. UI: визард показывает шаблон, применение подставляет категории.
  const tplList = await page.request.get(
    `${API_URL}/api/tournament/templates/`
  );
  expect(tplList.ok()).toBeTruthy();
  const tplJson = (await tplList.json()) as
    | Array<{ id: number; name: string }>
    | { results: Array<{ id: number; name: string }> };
  const tplArr = Array.isArray(tplJson) ? tplJson : tplJson.results;
  const tpl = tplArr.find((t) => t.name === 'E2E шаблон');
  expect(tpl, 'template visible to owner').toBeTruthy();
  await page.goto('/cabinet/tournaments/create');
  await page.getByLabel(/Начать с шаблона/).selectOption(String(tpl!.id));
  await page.getByRole('button', { name: 'Применить' }).click();
  // Категории из шаблона видны на шаге категорий — идём дальше.
  await page.getByLabel('Название турнира').fill('Кубок из шаблона');
  await page.getByLabel('Дата начала *').fill('2026-11-01');
  await page.getByLabel('Дата окончания *').fill('2026-11-02');
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByText('Мальчики 8-9')).toBeVisible({ timeout: 15000 });
});
