import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const width = Number(process.argv[2] ?? 390);
const out = process.argv[3] ?? `scripts/_welcome-${width}.png`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
await page.goto(`${BASE}/welcome`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-welcome="signin"]');
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
