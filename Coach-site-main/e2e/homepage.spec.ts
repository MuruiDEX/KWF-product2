import { test, expect } from '@playwright/test';

test.setTimeout(180000);

/** Homepage: клуб + Tournament Platform (все платформенные секции сохранены). */
test('homepage renders platform IA (hero, live, upcoming, directory, cta)', async ({
  page,
}) => {
  // SSE держит соединение открытым — networkidle не наступает.
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Hero: один H1 клубной тематики + фрейм-фото + CTA (Telegram, #about).
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toContainText(/сила/i, { timeout: 15000 });
  await expect(page.locator('#hero img').first()).toBeAttached();
  await expect(page.getByRole('button', { name: 'Записаться на тренировку' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Узнать о клубе' })).toHaveAttribute(
    'href',
    '#about',
  );
  // Платформенные CTA живут в platform-блоке (те же маршруты).
  await expect(page.getByRole('link', { name: 'Календарь турниров' }).first()).toHaveAttribute(
    'href',
    '/tournaments',
  );
  await expect(page.getByRole('link', { name: 'Смотреть LIVE' }).first()).toHaveAttribute(
    'href',
    '/live',
  );

  // Секции домашней ленты присутствуют (данные или честные empty-states).
  await expect(page.getByText('Ближайшие турниры').first()).toBeVisible();
  await expect(page.getByText('Последние результаты').first()).toBeVisible();
  await expect(page.getByText('Рейтинги, клубы и спортсмены').first()).toBeVisible();

  // CTA placeholders существуют и ведут на tournaments.
  await expect(page.getByRole('link', { name: 'Все рейтинги' })).toHaveAttribute(
    'href',
    '/rankings',
  );
  await expect(page.getByRole('link', { name: 'Найти турнир' })).toHaveAttribute(
    'href',
    '/tournaments',
  );

  // Клубная история интегрирована, платформенные секции на месте.
  await expect(page.getByText('О клубе').first()).toBeVisible();
  await expect(page.getByText('Бакыт Алмаз').first()).toBeVisible();
  await expect(page.getByText('Жизнь нашего клуба').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Смотреть LIVE' }).first()).toBeVisible();
  // Клуб идёт раньше турнирной ленты (естественный порядок истории).
  const aboutTop = await page.getByText('О клубе').first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  const upcomingTop = await page.getByText('Ближайшие турниры').first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  expect(aboutTop).toBeLessThan(upcomingTop);
  // Клубный CTA ведёт на запись, платформенный — на турниры.
  await expect(page.getByRole('button', { name: 'Записаться на пробное' }).first()).toBeVisible();
  // Декоративная система: варианты разделителей и сдержанные кандзи-акценты.
  for (const mark of ['極真', '押忍', '空手']) {
    await expect(
      page.getByText(mark, { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible();
  }

  // Placeholder-маршруты: честные empty-states, без fake-данных.
  await page.goto('/rankings', { waitUntil: 'networkidle' });
  await expect(page.getByText('Рейтинг будет доступен').first()).toBeVisible();
  await page.goto('/clubs', { waitUntil: 'networkidle' });
  await expect(page.getByText('Каталог клубов скоро появится').first()).toBeVisible();
  await page.goto('/athletes', { waitUntil: 'networkidle' });
  await expect(page.getByText('Каталог спортсменов скоро появится').first()).toBeVisible();

  // Нет горизонтального overflow на текущем вьюпорте.
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
});
