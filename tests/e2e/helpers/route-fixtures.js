import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const indexFixturePath = resolve(__dirname, '..', '..', '..', 'dev-fixtures', 'data', 'index.json');
const sessionFixturesDir = resolve(__dirname, '..', '..', '..', 'dev-fixtures', 'data', 'sessions');
const indexFixtureText = readFileSync(indexFixturePath, 'utf-8');
const indexFixture = JSON.parse(indexFixtureText);

export const getIndexFixture = () => indexFixture;

export const registerIndexRoute = async (page) => {
  await page.route('**/data/index.json*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: indexFixtureText,
    })
  );

  // V2: sessions/<sessionId>/<revision>.json パターン
  await page.route('**/data/sessions/*/*.json', (route) => {
    const url = new URL(route.request().url());
    const parts = url.pathname.split('/');
    const revisionFile = parts.pop(); // "0.json"
    const sessionId = parts.pop(); // ULID
    const filePath = resolve(sessionFixturesDir, sessionId, revisionFile);
    if (!existsSync(filePath)) {
      return route.fallback();
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: readFileSync(filePath, 'utf-8'),
    });
  });
};
