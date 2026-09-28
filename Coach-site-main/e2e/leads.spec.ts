import { test, expect } from '@playwright/test';
import { API_URL, loginViaUi, registerViaApi, unique } from './helpers';

test.setTimeout(120000);

// P1: заявка с лендинга → инбокс тренера → смена статуса.
test('leads: public submit → trainer inbox → status change', async ({
  page,
  request,
}) => {
  const name = `E2E Lead ${unique('lead')}`;

  // 1. Анонимная заявка через API (эквивалент LeadModal submit).
  const created = await request.post(`${API_URL}/api/leads/`, {
    data: {
      name,
      phone: '+79990001122',
      plan: 'trial',
      source: 'e2e',
    },
  });
  expect(created.ok()).toBeTruthy();

  // 2. Тренер видит заявку в кабинете.
  const coach = await registerViaApi(request, 'trainer');
  await loginViaUi(page, coach.username, coach.password);
  await page.goto('/cabinet');
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 });

  // 3. Смена статуса сохраняется.
  const statusSelect = page.getByLabel(`Статус заявки ${name}`);
  await statusSelect.selectOption('contacted');
  await expect(page.getByText('Статус заявки обновлён').first()).toBeVisible({
    timeout: 15000,
  });
  await expect(statusSelect).toHaveValue('contacted');
});

// P1: страницы восстановления пароля рендерятся без авторизации.
test('password reset: pages render for anonymous', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(
    page.getByRole('heading', { name: 'Восстановление пароля' })
  ).toBeVisible();
  await page.goto('/reset-password?uid=bad&token=bad');
  await expect(
    page.getByRole('heading', { name: 'Новый пароль' })
  ).toBeVisible();
});
