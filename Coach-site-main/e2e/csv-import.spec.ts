import { test, expect } from '@playwright/test';
import { loginViaUi, registerViaApi, unique } from './helpers';

test.setTimeout(180000);

function csvFile(name: string, content: string) {
  return {
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(content, 'utf-8'),
  };
}

test('csv preview shows valid rows and imports them', async ({
  page,
  request,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  await loginViaUi(page, coach.username, coach.password);

  await page.goto('/cabinet', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Импорт CSV' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Импорт спортсменов из CSV' }),
  ).toBeVisible();

  const famA = `Fam${unique('a')}`;
  const famB = `Fam${unique('b')}`;
  await page.locator('input[type="file"]').setInputFiles(
    csvFile(
      'athletes.csv',
      `first_name,last_name,birth_date,weight,gender,club\nTestA,${famA},2015-01-15,30,male,E2E Club\nTestB,${famB},2015-03-20,32,female,E2E Club`,
    ),
  );

  // Preview: честные счётчики + таблица/карточки (видимый контейнер
  // зависит от viewport: desktop — таблица, mobile — карточки).
  await expect(page.getByText('Всего строк: 2')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Готовы: 2')).toBeVisible();
  const preview = page.locator(
    '[data-testid="csv-preview-cards"]:visible, [data-testid="csv-preview-table"]:visible',
  );
  await expect(preview.getByText(`${famA} TestA`)).toBeVisible();

  const importBtn = page.getByRole('button', { name: /Импортировать \(2\)/ });
  await expect(importBtn).toBeEnabled();
  await importBtn.click();

  // Успех: диалог закрылся, спортсмены в списке кабинета.
  await expect(
    page.getByRole('dialog', { name: 'Импорт спортсменов из CSV' }),
  ).toBeHidden({ timeout: 15000 });
  await expect(page.getByText(`${famA} TestA`).first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(`${famB} TestB`).first()).toBeVisible();
});

test('csv invalid rows are shown and commit is blocked', async ({
  page,
  request,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  await loginViaUi(page, coach.username, coach.password);

  await page.goto('/cabinet', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Импорт CSV' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Импорт спортсменов из CSV' }),
  ).toBeVisible();

  const famGood = `Fam${unique('g')}`;
  await page.locator('input[type="file"]').setInputFiles(
    csvFile(
      'bad.csv',
      `first_name,last_name,birth_date,weight,gender\nGood,${famGood},2015-01-15,30,male\nBad,${famGood}X,not-a-date,30,male\nGood,${famGood},2015-01-15,30,male`,
    ),
  );

  await expect(page.getByText('Всего строк: 3')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('С ошибками: 2')).toBeVisible();
  // Тексты backend-ошибок видны построчно (в видимом контейнере viewport).
  const preview = page.locator(
    '[data-testid="csv-preview-cards"]:visible, [data-testid="csv-preview-table"]:visible',
  );
  await expect(preview.getByText(/Дата рождения: формат/)).toBeVisible();
  await expect(preview.getByText(/Дубликат/)).toBeVisible();

  // Backend всё-или-ничего: кнопка заблокирована с объяснением.
  const importBtn = page.getByRole('button', { name: /Импортировать/ });
  await expect(importBtn).toBeDisabled();
  await expect(
    page.getByText(/Backend принимает файл целиком/),
  ).toBeVisible();
});
