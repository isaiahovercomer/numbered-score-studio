// 瀏覽器煙霧測試（可選的開發／CI 測試，不屬於 npm test）：
// 手機 390px 與桌面 1440px 各跑一次——頁面可載入、沒有水平捲動、主要控制項可見、可載入範例並匯出 Word／MIDI。
// 執行：npm install && npm run test:e2e（需要本機有 Chrome；或設 CHROME_PATH 指向可執行檔）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {startServer} from './serve.mjs';

const VIEWPORTS = [{name: 'mobile-390', width: 390, height: 844, isMobile: true, hasTouch: true}, {name: 'desktop-1440', width: 1440, height: 900}];
const MAIN_CONTROLS = ['#loadExample', '#tabAudio', '#tabImage', '#tabData', '#title', '#key', '#bpm', '#exportWord', '#render', '#midi', '#saveJson'];
const SHOT_DIR = process.env.E2E_SHOT_DIR;

const launch = () => chromium.launch(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {channel: 'chrome'});
const noHorizontalScroll = page => page.evaluate(() => ({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, inner: window.innerWidth}));

let browser, srv;
test.before(async () => { srv = await startServer(); browser = await launch(); });
test.after(async () => { await browser?.close(); srv?.server.close(); });

for (const vp of VIEWPORTS) {
  test(`[${vp.name}] 載入、無水平捲動、主要控制項可見、可匯出`, async () => {
    const context = await browser.newContext({viewport: {width: vp.width, height: vp.height}, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, acceptDownloads: true});
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', e => problems.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
    // 只允許本機請求；任何外部請求（如辨識後端）一律擋下，測試不得送出真實資料。
    await context.route(url => !url.href.startsWith(srv.url), route => route.abort());

    try {
      await page.goto(srv.url);
      await page.waitForSelector('#exportWord');
      assert.equal(await page.evaluate(() => document.documentElement.lang), 'zh-Hant');

      // 範例載入前後都不得出現水平捲動
      let w = await noHorizontalScroll(page);
      assert.ok(w.scroll <= w.client, `載入後水平捲動：scrollWidth ${w.scroll} > ${w.client}`);
      await page.click('#loadExample');
      await page.waitForFunction(() => document.querySelectorAll('#measures .measure').length > 0);
      w = await noHorizontalScroll(page);
      assert.ok(w.scroll <= w.client, `載入範例後水平捲動：scrollWidth ${w.scroll} > ${w.client}`);

      // 主要控制項存在、可見、有實際大小
      for (const sel of MAIN_CONTROLS) {
        await page.locator(sel).scrollIntoViewIfNeeded();
        assert.ok(await page.locator(sel).isVisible(), `${sel} 不可見`);
        const box = await page.locator(sel).boundingBox();
        assert.ok(box && box.width > 8 && box.height > 8, `${sel} 大小異常`);
        assert.ok(box.x >= -1 && box.x + box.width <= vp.width + 1, `${sel} 超出視窗寬度（x=${box?.x}, w=${box?.width}）`);
      }
      // 手機：分頁按鈕觸控目標至少 40px 高
      if (vp.isMobile) for (const sel of ['#tabAudio', '#tabImage', '#tabData']) {
        const box = await page.locator(sel).boundingBox();
        assert.ok(box.height >= 40, `${sel} 觸控目標太小（${box.height}px）`);
      }

      // Word 版式摺疊選單在深色面板內仍可讀（文字顏色與面板背景不同）
      const contrast = await page.evaluate(() => {
        const s = document.querySelector('.word-options summary'), p = document.querySelector('.mix-panel');
        return {text: getComputedStyle(s).color, bg: getComputedStyle(p).backgroundColor};
      });
      assert.notEqual(contrast.text, contrast.bg, 'Word 版式選單文字與面板背景同色');

      // 匯出 Word（DOCX 為 ZIP：開頭 PK）與 MIDI（開頭 MThd）
      const [docx] = await Promise.all([page.waitForEvent('download'), page.click('#exportWord')]);
      assert.match(docx.suggestedFilename(), /\.docx$/);
      assert.equal(fs.readFileSync(await docx.path()).subarray(0, 2).toString('latin1'), 'PK');
      const [midi] = await Promise.all([page.waitForEvent('download'), page.click('#midi')]);
      assert.match(midi.suggestedFilename(), /\.mid$/);
      assert.equal(fs.readFileSync(await midi.path()).subarray(0, 4).toString('latin1'), 'MThd');

      assert.deepEqual(problems, [], '頁面不應有 JavaScript 錯誤或 console error');
    } finally {
      // 不論成功或失敗都存截圖，失敗時 CI 的 Artifacts 才看得到壞掉的畫面。
      if (SHOT_DIR) {
        fs.mkdirSync(SHOT_DIR, {recursive: true});
        await page.screenshot({path: `${SHOT_DIR}/${vp.name}.png`, fullPage: true}).catch(() => {});
      }
      await context.close();
    }
  });
}
