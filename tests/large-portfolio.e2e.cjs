// Large portfolios in the workspace: the 1,000-product scale test is planned in a background Web Worker,
// the page stays usable while it runs, results are shown progressively, and nothing overflows on small screens.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = process.env.TEST_BASE || 'http://127.0.0.1:3173';
const assert = (ok, message) => { if (!ok) throw new Error(message); };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(base + '/inventory');
    await page.locator('.data-row').first().waitFor({ timeout: 120000 });
    assert(await page.locator('#background-plan-status').count() === 0, 'the 8-product demo is planned synchronously (no background banner)');
    await page.locator('a[href="/inventory/data"]:visible').first().click();
    await page.waitForURL('**/inventory/data');
    await page.locator('#load-scale-test').click();
    await page.locator('.workspace-breadcrumb a').click();
    await page.waitForURL(/\/inventory$/);
    const status = page.locator('#background-plan-status');
    await status.waitFor({ timeout: 30000 });
    // Usable while planning: the workspace menu opens promptly even though the worker is busy.
    if (/Planning/.test(await status.innerText())) {
      const t0 = Date.now(); await page.locator('details.workspace-menu > summary').click(); await page.locator('nav[aria-label="Inventory workspace pages"]').waitFor({ state: 'visible' });
      const ms = Date.now() - t0; assert(ms < 1500, `menu took ${ms} ms to open while planning`);
      await page.locator('details.workspace-menu > summary').click();
    }
    await page.waitForFunction(() => /Planned 1,000 products/.test(document.querySelector('#background-plan-status')?.textContent || ''), null, { timeout: 180000 });
    const text = await status.innerText();
    assert(/proven to be within \d+\.\d+% of the best plan/.test(text), `certified gap shown: ${text}`);
    assert(await page.locator('.data-row').count() === 50, 'the overview shows the top 50 rows');
    assert(/Showing 50 of 1,000/.test(await page.locator('.table-foot').innerText()), 'the table says how many rows are hidden');
    await page.locator('#show-more-rows').click();
    await page.waitForFunction(() => document.querySelectorAll('.data-row').length === 250);
    assert(await page.locator('#engine option[value="scenario-grid-v4"]').isDisabled(), 'v4 is disabled above 100 products');
    assert(Number(await page.inputValue('#budget')) > 1e8, 'the scale test suggests a budget in proportion to the portfolio');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const x = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, inner: innerWidth }));
      assert(x.doc <= x.inner + 1, `no horizontal overflow at ${width}px (${x.doc} > ${x.inner})`);
    }
    assert(!errors.length, `page errors: ${errors.join(' | ')}`);
    console.log('PASS large-portfolio: ' + text.slice(0, 120));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
