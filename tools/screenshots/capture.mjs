// Drives the screenshot stack (see docker-compose.yml) with a real browser and writes
// the PNGs listed in features.json to ../../screenshots. Each feature id in features.json
// needs a scenario below. Env: BASE_URL (default http://127.0.0.1:18080),
// CHROMIUM_PATH (use an installed browser instead of playwright's).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? `http://127.0.0.1:${process.env.SCREENSHOT_PORT ?? 18080}`;
const OUT = path.resolve(import.meta.dirname, '../../screenshots');
const PASSWORD = 'screenshots';
const features = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'features.json'), 'utf8'));

const shot = async (page, file, opts = {}) => {
	await page.waitForTimeout(400); // let transitions and lazily loaded thumbnails settle
	await page.screenshot({ path: path.join(OUT, file), ...opts });
	console.log('  wrote', file);
};

async function adminLogin(page) {
	await page.goto(`${BASE}/admin`);
	await page.evaluate(() => localStorage.setItem('adminTab', 'content'));
	await page.getByLabel('Admin password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.getByRole('tab', { name: 'What to show' }).waitFor();
}

// Waits until every tile thumbnail has loaded so the screenshot never shows blank covers.
const imagesLoaded = (page) =>
	page.waitForFunction(() => {
		const imgs = [...document.querySelectorAll('img')].filter((i) => i.closest('[role=checkbox]'));
		return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
	});

const tile = (page, name) => page.getByRole('checkbox', { name: new RegExp(name) });

const scenarios = {
	async 'visual-pickers'({ page }) {
		await adminLogin(page);
		await page.getByRole('tab', { name: 'Albums', exact: true }).click();
		await imagesLoaded(page);
		for (const a of ['Family Christmas 2025', 'Grandkids', 'Summer at the Lake']) await tile(page, a).click();
		await shot(page, 'pickers-albums.png');

		await page.getByRole('tab', { name: 'Albums to hide' }).click();
		await imagesLoaded(page);
		await tile(page, 'Garden Projects').click();
		await shot(page, 'pickers-hide-albums.png');

		await page.getByRole('tab', { name: 'People' }).click();
		await imagesLoaded(page);
		for (const p of ['Emma', 'Lucas']) await tile(page, p).click();
		await shot(page, 'pickers-people.png');

		await page.getByRole('tab', { name: 'Tags' }).click();
		await page.getByRole('checkbox', { name: /Family\/Kids/ }).click();
		await shot(page, 'pickers-tags.png');
	},

	async 'named-accounts'({ page }) {
		await adminLogin(page);
		await shot(page, 'named-accounts-switcher.png');
		await page.getByRole('tab', { name: 'Settings' }).click();
		await page.getByText('Interval (seconds)').waitFor();
		// The Accounts card is open by default, below the fold.
		await page.getByText('Just a label so you can tell accounts apart.').first().scrollIntoViewIfNeeded();
		await page.evaluate(() => window.scrollBy(0, -120));
		await shot(page, 'named-accounts.png');
	},

	async 'admin-tabs'({ page }) {
		await adminLogin(page);
		await page.getByRole('tab', { name: 'Settings' }).click();
		await page.getByText('Display', { exact: true }).first().waitFor();
		await shot(page, 'admin-settings-tab.png');
		await page.getByRole('button', { name: 'Save' }).click();
		await page.getByText('Changes are applied live').waitFor();
		await shot(page, 'admin-saved-notice.png');
	},

	async 'admin-dark-mode'({ page }) {
		await adminLogin(page);
		await imagesLoaded(page);
		await page.getByRole('switch').click(); // sun/moon button in the header
		await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
		await shot(page, 'admin-dark-mode.png');
	},

	async 'refresh-photos'({ page }) {
		await adminLogin(page);
		await imagesLoaded(page);
		await page.getByRole('button', { name: 'Refresh photos now' }).click();
		await page.getByText(/Frames will switch to fresh photos/).waitFor();
		await shot(page, 'refresh-photos.png', { clip: { x: 0, y: 0, width: 1280, height: 420 } });
	},

	async 'tap-zones'({ page }) {
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto(`${BASE}/`);
		await page.locator('#zoneback').waitFor({ state: 'attached' });
		await page.locator('img').first().waitFor();
		await page.waitForTimeout(2500); // first photo + transition
		// The zones are invisible in real use; outline and label them for the screenshot.
		await page.addStyleTag({
			content: `#zoneback,#zonepause,#zonenext{outline:3px dashed rgba(255,255,255,.85);outline-offset:-6px;
				display:flex;align-items:flex-end;justify-content:center;padding-bottom:18vh;
				color:#fff;font:600 28px system-ui;text-shadow:0 1px 6px #000;background:rgba(0,0,0,.18)!important}
				#zoneback::after{content:'◀  Back'}#zonepause::after{content:'⏯  Pause / play'}#zonenext::after{content:'Next  ▶'}`
		});
		await shot(page, 'tap-zones.png');
	}
};

const launch = () =>
	chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

const only = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
let failed = false;
for (const feature of features) {
	if (only && only !== feature.id) continue;
	const scenario = scenarios[feature.id];
	if (!scenario) {
		console.error(`No scenario for feature "${feature.id}" in capture.mjs`);
		failed = true;
		continue;
	}
	console.log(feature.id);
	const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
	const page = await context.newPage();
	try {
		await scenario({ page });
	} catch (e) {
		console.error(`  FAILED: ${e.message}`);
		await page.screenshot({ path: path.join(OUT, `_failed-${feature.id}.png`) }).catch(() => {});
		failed = true;
	}
	await context.close();
}
await browser.close();
for (const f of features.flatMap((f) => f.screenshots))
	if (!only && !fs.existsSync(path.join(OUT, f.file))) {
		console.error(`Missing screenshot ${f.file} listed in features.json`);
		failed = true;
	}
process.exit(failed ? 1 : 0);
