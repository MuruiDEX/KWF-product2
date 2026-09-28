import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Изолированная БД для E2E: удаляем старый файл и накатываем миграции.
 * Локальный db.sqlite3 разработчика не затрагивается (см. SQLITE_PATH).
 */
async function globalSetup() {
  const backendDir = path.resolve(__dirname, '..', '..', 'KWF-backend', 'backend');
  const venvPython =
    process.env.PLAYWRIGHT_PYTHON ??
    path.resolve(__dirname, '..', '..', 'KWF-backend', '.venv', 'Scripts', 'python.exe');
  const dbPath = path.resolve(__dirname, '.e2e.sqlite3');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  execFileSync(venvPython, ['manage.py', 'migrate', '--noinput'], {
    cwd: backendDir,
    env: {
      ...process.env,
      SQLITE_PATH: dbPath,
      DATABASE_URL: '',
      DJANGO_DEBUG: '1',
      DJANGO_ALLOWED_HOSTS: 'localhost,127.0.0.1,testserver',
    },
    stdio: 'inherit',
    timeout: 300000,
  });
}

export default globalSetup;
