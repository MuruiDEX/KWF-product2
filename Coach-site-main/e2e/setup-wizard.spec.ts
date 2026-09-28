import { test, expect } from '@playwright/test';
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

test('setup wizard: categories → brackets → tatamis → schedule → review', async ({
  page,
  request,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const tournament = await createTournamentViaApi(request, headers, { mats_count: 2 });
  const category = await createCategoryViaApi(request, headers, tournament.id);
  const kids = [];
  for (let i = 0; i < 4; i++) {
    kids.push(await createAthleteViaApi(request, headers, {}, i));
  }
  const addRes = await request.post(
    `${API_URL}/api/tournament/categories/${category.id}/add_athletes/`,
    { headers, data: { athlete_ids: kids.map((k) => k.id) } },
  );
  expect(addRes.ok(), `add athletes: ${await addRes.text()}`).toBeTruthy();

  await loginViaUi(page, coach.username, coach.password);
  await page.goto(`/cabinet/tournaments/${tournament.id}/manage`, {
    waitUntil: 'networkidle',
  });

  // Открываем мастер через CTA в шапке (подсказка «Следующее действие» дублирует его ниже).
  await expect(page.getByText('Следующее действие:').first()).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Подготовить турнир' }).first().click();
  await expect(
    page.getByRole('dialog', { name: 'Автоматическая подготовка турнира' }),
  ).toBeVisible({ timeout: 15000 });

  // Step 1: категория предвыбрана (4 спортсмена, сетки нет).
  const dialog = page.getByRole('dialog', { name: 'Автоматическая подготовка турнира' });
  await expect(dialog.getByText(/Boys /).first()).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByText('Нет сетки').first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Далее', exact: true }).click();

  // Step 2: прогноз сетки + создание (клик строго внутри диалога визарда —
  // фоновая страница может показывать одноимённую кнопку IssuesCenter).
  await expect(page.getByText(/сетка на 4/).first()).toBeVisible({ timeout: 15000 });
  await dialog.getByRole('button', { name: 'Создать сетки', exact: true }).click();
  await expect(page.getByText(/Сетка построена/).first()).toBeVisible({ timeout: 30000 });
  await dialog.getByRole('button', { name: 'Далее', exact: true }).click();

  // Step 3: обеспечить (идемпотентно — татами глобальные, изоляции нет) → предпросмотр → применить.
  await expect(page.getByText(/Сейчас татами: \d+/).first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Обеспечить' }).click();
  await expect(
    page.getByText(/Татами уже достаточно|Создано татами/).first()
  ).toBeVisible({ timeout: 30000 });
  await dialog.getByRole('button', { name: 'Предпросмотр' }).click();
  await expect(page.getByText('Предложение системы').first()).toBeVisible({ timeout: 15000 });
  await dialog.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(page.getByText('Распределение применено').first()).toBeVisible({ timeout: 30000 });
  await dialog.getByRole('button', { name: 'Далее', exact: true }).click();

  // Step 4: расписание.
  await dialog.getByRole('button', { name: 'Предпросмотр' }).click();
  await expect(page.getByText(/Дорожки/).first()).toBeVisible({ timeout: 15000 });
  await dialog.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(page.getByText(/Время проставлено/).first()).toBeVisible({ timeout: 30000 });
  await dialog.getByRole('button', { name: 'Далее', exact: true }).click();

  // Step 5: итог + готово.
  await expect(page.getByText('итог подготовки').first()).toBeVisible();
  await expect(page.getByText('Сетки построены').first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Готово' }).click();

  // Управляющая страница отразила результат: сетка построена.
  // Таба «Управление» нет — результат смотрим во вкладке «Сетки».
  await page.getByRole('tab', { name: 'Сетки' }).click();
  await expect(page.getByText(/3 боёв/).first()).toBeVisible({ timeout: 15000 });
});
