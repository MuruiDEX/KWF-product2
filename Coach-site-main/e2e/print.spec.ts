import { test, expect } from '@playwright/test';
import {
  createAthleteViaApi,
  createCategoryViaApi,
  createTournamentViaApi,
  generateBracketViaApi,
  loginViaApi,
  publishTournamentViaApi,
  registerViaApi,
} from './helpers';

test.setTimeout(180000);

test('print protocol: renders categories, fights and signatures', async ({
  page,
  request,
}) => {
  const coach = await registerViaApi(request, 'trainer');
  const coachHeaders = await loginViaApi(
    request,
    coach.username,
    coach.password,
  );
  const kid = await createAthleteViaApi(request, coachHeaders, {}, 0);
  const kid2 = await createAthleteViaApi(request, coachHeaders, {}, 1);
  const tournament = await createTournamentViaApi(request, coachHeaders);
  const category = await createCategoryViaApi(
    request,
    coachHeaders,
    tournament.id,
  );
  await generateBracketViaApi(request, coachHeaders, category.id, [
    kid.id,
    kid2.id,
  ]);
  await publishTournamentViaApi(request, coachHeaders, tournament.id);

  // Кнопка «Печать» ведёт на протокол.
  await page.goto(`/tournaments/${tournament.slug}`, {
    waitUntil: 'networkidle',
  });
  await page.getByRole('link', { name: 'Печать' }).click();
  await expect(page).toHaveURL(/\/print/, { timeout: 15000 });

  // Содержимое протокола.
  await expect(page.getByText('Протокол соревнований')).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(tournament.name).first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(category.name).first()).toBeVisible();
  await expect(page.getByText(kid.last_name).first()).toBeVisible();
  await expect(page.getByText('Главный судья')).toBeVisible();
  await expect(page.getByText('Главный секретарь')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Печать протокола' }),
  ).toBeVisible();
});
