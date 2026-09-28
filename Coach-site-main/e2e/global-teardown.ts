import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown() {
  const dbPath = path.resolve(__dirname, '.e2e.sqlite3');
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  } catch {
    /* ignore */
  }
}

export default globalTeardown;
