const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../public/job-tracker-icon.svg'), 'utf8');
  const html = `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;background:transparent}</style></head><body>${svg}</body></html>`;
  const tmpHtml = path.join(__dirname, '_favicon_tmp.html');
  fs.writeFileSync(tmpHtml, html);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 64, height: 64 });
  await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'));
  const png = await page.locator('svg').screenshot({ type: 'png' });
  const outPath = path.join(__dirname, '../public/favicon-64.png');
  fs.writeFileSync(outPath, png);
  await browser.close();
  fs.unlinkSync(tmpHtml);
  console.log('Written', outPath, png.length, 'bytes');
})();
