import { test, expect } from '@playwright/test';
import {
  API_URL,
  createAthleteViaApi,
  getInviteCodeViaApi,
  loginViaApi,
  loginViaUi,
  registerViaApi,
  unique,
} from './helpers';

test.setTimeout(180000);

// P2: тренер создаёт тренировку с упражнениями и назначает спортсмену.
test('workouts: trainer creates workout, adds exercise, assigns athlete', async ({
  page,
  request,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const athlete = await createAthleteViaApi(request, headers);

  // API: workout + exercise + assignment.
  const title = `E2E Workout ${unique('wo')}`;
  const w = await request.post(`${API_URL}/api/workouts/workouts/`, {
    headers,
    data: { title, group: 'E2E' },
  });
  expect(w.ok(), `create workout: ${await w.text()}`).toBeTruthy();
  const workout = (await w.json()) as { id: number };

  const ex = await request.post(`${API_URL}/api/workouts/exercises/`, {
    headers,
    data: { workout: workout.id, name: 'Отжимания', sets: 3, reps: '15' },
  });
  expect(ex.ok(), `add exercise: ${await ex.text()}`).toBeTruthy();

  const as = await request.post(`${API_URL}/api/workouts/assignments/`, {
    headers,
    data: { workout: workout.id, athlete: athlete.id },
  });
  expect(as.ok(), `assign: ${await as.text()}`).toBeTruthy();

  // UI: конструктор показывает упражнение и назначение.
  await loginViaUi(page, coach.username, coach.password);
  await page.goto(`/cabinet/workouts/${workout.id}`);
  await expect(page.getByText('Отжимания').first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(athlete.last_name).first()).toBeVisible({
    timeout: 15000,
  });
});

// P2: родитель видит назначение и отмечает выполнение → done.
test('workouts: parent completes assignment', async ({ page, request }) => {
  const coach = await registerViaApi(request, 'trainer');
  const headers = await loginViaApi(request, coach.username, coach.password);
  const athlete = await createAthleteViaApi(request, headers);
  const code = await getInviteCodeViaApi(request, headers, athlete.id);

  const w = await request.post(`${API_URL}/api/workouts/workouts/`, {
    headers,
    data: { title: `E2E HW ${unique('hw')}` },
  });
  expect(w.ok()).toBeTruthy();
  const workout = (await w.json()) as { id: number; title: string };
  const ex = await request.post(`${API_URL}/api/workouts/exercises/`, {
    headers,
    data: { workout: workout.id, name: 'Приседания', sets: 2, reps: '20' },
  });
  expect(ex.ok()).toBeTruthy();
  const as = await request.post(`${API_URL}/api/workouts/assignments/`, {
    headers,
    data: { workout: workout.id, athlete: athlete.id, note: 'Домашка' },
  });
  expect(as.ok()).toBeTruthy();

  // Родитель привязывает ребёнка по коду.
  const parent = await registerViaApi(request, 'parent');
  const pHeaders = await loginViaApi(request, parent.username, parent.password);
  const link = await request.post(`${API_URL}/api/auth/children/link/`, {
    headers: pHeaders,
    data: { code },
  });
  expect(link.ok(), `link: ${await link.text()}`).toBeTruthy();

  // UI: кабинет → Мои тренировки → Начать → отметить → Сохранить.
  await loginViaUi(page, parent.username, parent.password);
  await page.goto('/cabinet');
  await expect(page.getByText(workout.title).first()).toBeVisible({
    timeout: 15000,
  });
  await page
    .getByRole('button', { name: 'Начать выполнение' })
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Приседания')).toBeVisible({ timeout: 15000 });
  await dialog.getByRole('checkbox').first().check();
  await dialog.getByRole('button', { name: 'Сохранить' }).first().click();
  await expect(dialog.getByText('Отмечено ✓').first()).toBeVisible({
    timeout: 15000,
  });
});
