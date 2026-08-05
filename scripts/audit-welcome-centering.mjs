// Renders /welcome at several mobile widths and asserts every element's horizontal
// centre matches the viewport centre. Also reports the logo's *visual* centre, which
// differs from its box centre when the PNG has asymmetric transparent padding.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const WIDTHS = [320, 375, 390, 414, 430];
const TOLERANCE = 2;

// Opaque bounding box of each logo asset, keyed by natural width.
const LOGO_INK = {
  551: { minX: 58, maxX: 515 }, // src/assets/clicks-logo.png (uneven border)
  458: { minX: 0, maxX: 457 }, // src/assets/clicks-logo-centered.png (tight crop)
};

const TARGETS = [
  ['logo', '[data-welcome="logo"] img'],
  ['tagline', '[data-welcome="tagline"]'],
  ['cta', '[data-welcome="cta"]'],
  ['terms', '[data-welcome="terms"]'],
  ['signin', '[data-welcome="signin"]'],
];

const browser = await chromium.launch();
let failures = 0;

for (const width of WIDTHS) {
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await page.goto(`${BASE}/welcome`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-welcome="signin"]');
  await page.waitForTimeout(1200); // let entrance animations settle

  const report = await page.evaluate(
    ({ targets, logoInk }) => {
      const vw = window.innerWidth;
      const centre = vw / 2;
      const rows = targets.map(([name, sel]) => {
        const el = document.querySelector(sel);
        if (!el) return { name, missing: true };
        const r = el.getBoundingClientRect();
        const row = {
          name,
          left: +r.left.toFixed(2),
          right: +r.right.toFixed(2),
          width: +r.width.toFixed(2),
          centre: +((r.left + r.right) / 2).toFixed(2),
        };
        if (name === 'logo') {
          // Map the asset's opaque box into rendered space (object-fit: contain, full-bleed width).
          const natural = el.naturalWidth;
          const ink = logoInk[natural];
          row.asset = `${natural}x${el.naturalHeight}`;
          if (ink) {
            const scale = r.width / natural;
            const inkLeft = r.left + ink.minX * scale;
            const inkRight = r.left + (ink.maxX + 1) * scale;
            row.visualCentre = +((inkLeft + inkRight) / 2).toFixed(2);
          }
        }
        return row;
      });
      return {
        vw,
        centre,
        scrollWidth: document.documentElement.scrollWidth,
        hasHorizontalScroll: document.documentElement.scrollWidth > vw,
        rows,
      };
    },
    { targets: TARGETS, logoInk: LOGO_INK },
  );

  console.log(`\n=== viewport ${width}px  (centre ${report.centre}) ===`);
  console.log(
    `scrollWidth ${report.scrollWidth}  horizontalScroll: ${report.hasHorizontalScroll ? 'YES (BAD)' : 'no'}`,
  );
  if (report.hasHorizontalScroll) failures++;

  for (const row of report.rows) {
    if (row.missing) {
      console.log(`  ${row.name.padEnd(8)} MISSING`);
      failures++;
      continue;
    }
    const check = (label, value) => {
      const off = +(value - report.centre).toFixed(2);
      const ok = Math.abs(off) <= TOLERANCE;
      if (!ok) failures++;
      return `${label} ${String(value).padStart(7)} off ${(off > 0 ? '+' : '') + off}px ${ok ? 'OK' : 'FAIL'}`;
    };
    let line = `  ${row.name.padEnd(8)} w ${String(row.width).padStart(7)}  ${check('box', row.centre)}`;
    if (row.visualCentre !== undefined) line += `  |  ${check('ink', row.visualCentre)}`;
    if (row.asset) line += `  asset ${row.asset}`;
    console.log(line);
  }

  await page.close();
}

await browser.close();
console.log(`\n${failures === 0 ? 'ALL CENTERED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
