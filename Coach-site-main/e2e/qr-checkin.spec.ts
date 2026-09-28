import { test, expect } from '@playwright/test';
import {
  API_URL,
  createAthleteViaApi,
  createCategoryViaApi,
  createTournamentViaApi,
  getInviteCodeViaApi,
  loginViaApi,
  loginViaUi,
  registerViaApi,
  unique,
} from './helpers';

test.setTimeout(180000);

interface QrSetup {
  coach: { username: string; password: string };
  tournamentId: number;
  firstName: string;
  lastName: string;
  code: string;
}

async function qrFixture(
  request: import('@playwright/test').APIRequestContext,
): Promise<QrSetup> {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const tournament = await createTournamentViaApi(request, headers);
  const category = await createCategoryViaApi(request, headers, tournament.id, {
    age_min: 8,
    age_max: 14,
    weight_max: '100',
    gender: 'male',
  });
  const firstName = 'Qr';
  const lastName = unique('Qrfam');
  const athlete = await createAthleteViaApi(request, headers, {
    first_name: firstName,
    last_name: lastName,
    birth_date: '2014-06-01',
    weight: 32,
    gender: 'male',
  });
  const code = await getInviteCodeViaApi(request, headers, athlete.id);
  const add = await request.post(
    `${API_URL}/api/tournament/categories/${category.id}/add_athletes/`,
    { headers, data: { athlete_ids: [athlete.id] } },
  );
  expect(add.ok(), `add athlete: ${await add.text()}`).toBeTruthy();
  return { coach, tournamentId: tournament.id, firstName, lastName, code };
}

async function openQrModal(
  page: import('@playwright/test').Page,
  tournamentId: number,
) {
  await page.goto(`/cabinet/tournaments/${tournamentId}/manage?tab=participants`, {
    waitUntil: 'networkidle',
  });
  await page.getByRole('button', { name: 'Сканировать QR' }).click();
  await expect(
    page.getByRole('dialog', { name: 'QR check-in спортсмена' }),
  ).toBeVisible({ timeout: 15000 });
}

test('qr manual flow: invalid format, unknown code, success', async ({
  page,
  request,
}) => {
  const { coach, tournamentId, firstName, lastName, code } =
    await qrFixture(request);
  await loginViaUi(page, coach.username, coach.password);
  await openQrModal(page, tournamentId);

  const dialog = page.getByRole('dialog', { name: 'QR check-in спортсмена' });
  // Ручной ввод доступен всегда (fallback без камеры).
  const input = dialog.getByLabel('Код явки вручную');
  await expect(input).toBeVisible();

  // Мусор отклоняется до запроса.
  await input.fill('!!');
  await dialog.getByRole('button', { name: 'Найти' }).click();
  await expect(dialog.getByText(/не распознан/)).toBeVisible();

  // Неизвестный код корректного формата — confirm, затем 404.
  await input.fill('ZZZZ9999');
  await dialog.getByRole('button', { name: 'Найти' }).click();
  await expect(dialog.getByText('Отметить явку?')).toBeVisible();
  await dialog.getByRole('button', { name: 'Отметить явку' }).click();
  await expect(dialog.getByText(/Код не найден/)).toBeVisible();

  // Ошибка сбрасывается — возврат к вводу без закрытия модалки.
  await dialog.getByRole('button', { name: 'Ввести другой код' }).click();
  await expect(dialog.getByLabel('Код явки вручную')).toBeVisible();

  // Валидный код — подтверждение с именем, затем успех.
  await dialog.getByLabel('Код явки вручную').fill(code);
  await dialog.getByRole('button', { name: 'Найти' }).click();
  await expect(dialog.getByText(`${lastName} ${firstName}`)).toBeVisible({
    timeout: 15000,
  });
  await dialog.getByRole('button', { name: 'Отметить явку' }).click();
  await expect(dialog.getByText('Явка отмечена')).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByText(`${lastName} ${firstName}`)).toBeVisible();

  // Сервер подтверждает явку.
  const regs = await page.request.get(
    `${API_URL}/api/tournament/tournaments/${tournamentId}/registrations/`,
  );
  expect(regs.ok()).toBeTruthy();
  const list = (await regs.json()) as { athlete_id: number; checked_in: boolean }[];
  expect(list.some((r) => r.checked_in)).toBe(true);

  await dialog.getByRole('button', { name: 'Готово' }).click();
  await expect(
    page.getByRole('dialog', { name: 'QR check-in спортсмена' }),
  ).toBeHidden();
});

test('qr already checked-in is reported, not hidden', async ({
  page,
  request,
}) => {
  const { coach, tournamentId, firstName, lastName, code } =
    await qrFixture(request);
  const headers = await loginViaApi(request, coach.username, coach.password);
  // Явка заранее через API.
  const pre = await request.post(
    `${API_URL}/api/tournament/tournaments/${tournamentId}/checkin/`,
    { headers, data: { link_code: code } },
  );
  expect(pre.ok(), `pre-checkin: ${await pre.text()}`).toBeTruthy();

  await loginViaUi(page, coach.username, coach.password);
  await openQrModal(page, tournamentId);

  const dialog = page.getByRole('dialog', { name: 'QR check-in спортсмена' });
  await dialog.getByLabel('Код явки вручную').fill(code);
  await dialog.getByRole('button', { name: 'Найти' }).click();
  await expect(dialog.getByText(`${lastName} ${firstName}`)).toBeVisible({
    timeout: 15000,
  });
  await expect(dialog.getByText(/уже была отмечена/)).toBeVisible();
});

test('qr scanner fallback when unsupported', async ({ page, request }) => {
  const { coach, tournamentId } = await qrFixture(request);
  await loginViaUi(page, coach.username, coach.password);
  await openQrModal(page, tournamentId);

  const dialog = page.getByRole('dialog', { name: 'QR check-in спортсмена' });
  // Либо кнопка сканирования, либо честный fallback — ручной ввод есть всегда.
  const scanBtn = dialog.getByRole('button', { name: 'Сканировать QR' });
  const fallback = dialog.getByText(/не поддерживается на этом устройстве/);
  await expect
    .poll(async () => (await scanBtn.count()) + (await fallback.count()), {
      timeout: 15000,
    })
    .toBeGreaterThan(0);
  await expect(dialog.getByLabel('Код явки вручную')).toBeVisible();
});
