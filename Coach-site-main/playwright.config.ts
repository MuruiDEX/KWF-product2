import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

const FRONTEND_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
// Backend запускается из своего каталога штатным venv проекта.
const BACKEND_DIR = path.resolve(__dirname, '..', 'KWF-backend', 'backend');
const VENV_PYTHON =
  process.env.PLAYWRIGHT_PYTHON ??
  path.resolve(__dirname, '..', 'KWF-backend', '.venv', 'Scripts', 'python.exe');
const E2E_DB = path.resolve(__dirname, 'e2e', '.e2e.sqlite3');

/** process.env без undefined — тип, требуемый webServer.env. */
function strEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export default defineConfig({
  testDir: './e2e',
  globalSetup: require.resolve('./e2e/global-setup'),
  globalTeardown: require.resolve('./e2e/global-teardown'),
  // Серийно: спеки делят одну SQLite-БД (dev runserver) — параллельные
  // длинные write-транзакции (сетка) дают database is locked.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // Миграции делает global-setup; здесь только runserver на изолированной БД.
      command: `"${VENV_PYTHON}" manage.py runserver localhost:8000 --noreload`,
      cwd: BACKEND_DIR,
      url: `${API_URL}/api/health/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        ...strEnv(),
        SQLITE_PATH: E2E_DB,
        DATABASE_URL: '',
        DJANGO_DEBUG: '1',
        DJANGO_ALLOWED_HOSTS: 'localhost,127.0.0.1,testserver',
        CORS_EXTRA_ORIGINS: FRONTEND_URL,
        CSRF_TRUSTED_ORIGINS: FRONTEND_URL,
        NEXT_PUBLIC_API_URL: API_URL,
      },
    },
    {
      // E2E гоняем против production-сборки: dev-режим в этом окружении
      // не завершает гидратацию (битый HMR/компиляция), плюс это ближе к проду.
      // NEXT_PUBLIC_API_URL запекается на этапе build из env ниже.
      command: `npm run build && npm run start -- --port 3000 --hostname localhost`,
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 600 * 1000,
      env: {
        ...strEnv(),
        NEXT_PUBLIC_API_URL: API_URL,
      },
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
