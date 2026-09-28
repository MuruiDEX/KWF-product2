import { test, expect } from '@playwright/test';
import { loginViaUi, registerViaApi, unique } from './helpers';

test.setTimeout(120000);

test('schedule: trainer CRUD → public visibility', async ({
  page,
  request,
}, testInfo) => {
  // Сетка и мобильный список дублируют контент (md-брейкпоинт) —
  // работаем только с видимым вариантом.
  const scope =
    testInfo.project.name === 'mobile'
      ? page.getByTestId('timetable-list')
      : page.getByTestId('timetable-grid');
  const group = `E2E Group ${unique('grp')}`;
  const coach = await registerViaApi(request, 'trainer');
  await loginViaUi(page, coach.username, coach.password);

  // 1. Cabinet schedule: add a session.
  await page.goto('/cabinet/schedule');
  await page.getByRole('button', { name: 'Занятие' }).click();
  await page.getByLabel('Группа *').fill(group);
  await page.getByLabel('Начало *').fill('18:00');
  await page.getByLabel('Конец *').fill('19:30');
  await page.getByLabel('Тренер').fill('E2E Coach');
  await page.getByLabel('Зал').fill('Зал 1');
  await page
    .locator('form')
    .getByRole('button', { name: 'Добавить', exact: true })
    .click();
  await expect(page.getByText(group).first()).toBeVisible({
    timeout: 15000,
  });

  // 2. Public schedule page shows it; details reveal the trainer.
  await page.goto('/schedule');
  await expect(scope.getByText(group).first()).toBeVisible({
    timeout: 15000,
  });
  await scope
    .locator('button', { hasText: group })
    .first()
    .click();
  // Детали — в модалке (role=dialog); текстовые дубликаты сетки/списка
  // игнорируем осознанно.
  await expect(
    page.getByRole('dialog').getByText('E2E Coach')
  ).toBeVisible({
    timeout: 15000,
  });
});
