import { test, expect } from '@playwright/test';
import {
  API_URL,
  createAthleteViaApi,
  createCategoryViaApi,
  createTournamentViaApi,
  csrfHeaders,
  generateBracketViaApi,
  loginViaApi,
  loginViaUi,
  publishTournamentViaApi,
  registerViaApi,
} from './helpers';

test.setTimeout(120000);

test('trainer B cannot read or mutate tournament A', async ({
  page,
  request,
}) => {
  // Fixtures as trainer A.
  const coachA = await registerViaApi(request, 'trainer');
  const headersA = await loginViaApi(request, coachA.username, coachA.password);
  const kidA = await createAthleteViaApi(request, headersA, {}, 0);
  const kidA2 = await createAthleteViaApi(request, headersA, {}, 1);
  const tournamentA = await createTournamentViaApi(request, headersA);
  const categoryA = await createCategoryViaApi(
    request,
    headersA,
    tournamentA.id,
  );
  await generateBracketViaApi(request, headersA, categoryA.id, [
    kidA.id,
    kidA2.id,
  ]);
  const stateRes = await request.get(
    `${API_URL}/api/tournament/tournaments/${tournamentA.id}/bracket_state/`,
    { headers: headersA },
  );
  const state = (await stateRes.json()) as {
    categories: Array<{ rounds: Array<{ matches: Array<{ id: number }> }> }>;
  };
  const matchId = state.categories[0].rounds[0].matches[0].id;

  // Trainer B works through the browser session (isolated cookies).
  const coachB = await registerViaApi(request, 'trainer');
  await loginViaUi(page, coachB.username, coachB.password);

  // 1. B's cabinet list must not contain A's tournament.
  await page.goto('/cabinet/tournaments');
  await expect(page.getByText(tournamentA.name)).toHaveCount(0, {
    timeout: 15000,
  });

  // 2. Draft tournament A: mutations forbidden, objects invisible.
  const csrf = await csrfHeaders(page);
  const draftChecks: Array<[string, string, Record<string, unknown>?]> = [
    ['PATCH', `${API_URL}/api/tournament/tournaments/${tournamentA.id}/`, { status: 'published' }],
    ['DELETE', `${API_URL}/api/tournament/tournaments/${tournamentA.id}/`],
  ];
  for (const [method, url, data] of draftChecks) {
    const res = await page.request.fetch(url, {
      method,
      data,
      headers: { 'Content-Type': 'application/json', ...csrf },
    });
    expect(
      res.status(),
      `${method} ${url} must be forbidden for trainer B`,
    ).toBe(403);
  }
  const invisible: Array<[string, string, Record<string, unknown>?]> = [
    ['PATCH', `${API_URL}/api/tournament/categories/${categoryA.id}/`, { name: 'Hacked' }],
    [
      'POST',
      `${API_URL}/api/tournament/matches/${matchId}/finish_match/`,
      { winner_id: kidA.id },
    ],
  ];
  for (const [method, url, data] of invisible) {
    const res = await page.request.fetch(url, {
      method,
      data,
      headers: { 'Content-Type': 'application/json', ...csrf },
    });
    expect(
      res.status(),
      `${method} ${url} must not leak draft tournament A to trainer B`,
    ).toBe(404);
  }

  // 3. Published tournament A: objects visible, mutations still forbidden.
  // (Before that: draft bracket_state is invisible to B, not leaked.)
  const draftRes = await page.request.get(
    `${API_URL}/api/tournament/tournaments/${tournamentA.id}/bracket_state/`,
  );
  expect(draftRes.status()).toBe(404);
  await publishTournamentViaApi(request, headersA, tournamentA.id);
  const publishedForbidden: Array<[string, string, Record<string, unknown>?]> = [
    ['PATCH', `${API_URL}/api/tournament/categories/${categoryA.id}/`, { name: 'Hacked' }],
  ];
  for (const [method, url, data] of publishedForbidden) {
    const res = await page.request.fetch(url, {
      method,
      data,
      headers: { 'Content-Type': 'application/json', ...csrf },
    });
    expect(
      res.status(),
      `${method} ${url} must be forbidden for trainer B`,
    ).toBe(403);
  }
  // Matches of a foreign tournament stay invisible even when published.
  const publishedInvisible: Array<[string, string, Record<string, unknown>?]> = [
    [
      'POST',
      `${API_URL}/api/tournament/matches/${matchId}/finish_match/`,
      { winner_id: kidA.id },
    ],
  ];
  for (const [method, url, data] of publishedInvisible) {
    const res = await page.request.fetch(url, {
      method,
      data,
      headers: { 'Content-Type': 'application/json', ...csrf },
    });
    expect(
      res.status(),
      `${method} ${url} must not leak foreign matches to trainer B`,
    ).toBe(404);
  }
});
