import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { loginViaUi, registerViaApi } from './helpers';

test.setTimeout(180000);

const FIXTURES = path.resolve(__dirname, 'fixtures');

async function openWizard(page: Page) {
  await page.goto('/cabinet', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Импорт из файла' }).click();
  const dialog = page.getByRole('dialog', { name: 'Импорт спортсменов из файла' });
  await expect(dialog).toBeVisible({ timeout: 10000 });
  return dialog;
}

async function runImport(
  page: Page,
  filename: string,
  lastName: string,
  mapLabel = 'Поле для колонки Фамилия',
) {
  const dialog = await openWizard(page);
  await dialog.locator('input[type="file"]').setInputFiles(path.join(FIXTURES, filename));
  // Шаг маппинга: автоколоны распознаны.
  await expect(dialog.getByText('Строк: 2')).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByLabel(mapLabel)).toHaveValue('last_name');
  await dialog.getByRole('button', { name: 'Проверить' }).click();
  // Dry-run: превью без записи.
  await expect(dialog.getByText('Будет добавлено: 2')).toBeVisible({ timeout: 15000 });
  await dialog.getByRole('button', { name: 'Импортировать (2)' }).click();
  // Подтверждение обязательно.
  const confirm = page.getByRole('alertdialog', { name: 'Импортировать спортсменов?' });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByText('Будет импортировано: 2')).toBeVisible();
  await confirm.getByRole('button', { name: 'Импортировать (2)' }).click();
  await expect(dialog.getByText('Импортировано спортсменов: 2')).toBeVisible({
    timeout: 15000,
  });
  await dialog.getByRole('button', { name: 'Закрыть' }).click();
  // Спортсмен реально создан и виден в кабинете.
  await expect(page.getByText(lastName).first()).toBeVisible({ timeout: 15000 });
}

test('import xlsx: mapping → dry-run → confirm → created', async ({ page, request }) => {
  const coach = await registerViaApi(request, 'trainer');
  await loginViaUi(page, coach.username, coach.password);
  await runImport(page, 'kids.xlsx', 'Муратов');
});

test('import docx: table → mapping → dry-run → confirm → created', async ({
  page,
  request,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  await loginViaUi(page, coach.username, coach.password);
  await runImport(page, 'kids.docx', 'Муратов');
});

test('import csv regression: mapping → dry-run → confirm → created', async ({
  page,
  request,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  await loginViaUi(page, coach.username, coach.password);
  await runImport(page, 'kids.csv', 'Муратов', 'Поле для колонки last_name');
});
