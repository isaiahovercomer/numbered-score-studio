// 瀏覽器煙霧測試（可選的開發／CI 測試，不屬於 npm test）：
// 手機 390px 與桌面 1440px 各跑一次——頁面可載入、沒有水平捲動、主要控制項可見、可載入範例並匯出 Word／MIDI。
// 執行：npm install && npm run test:e2e（需要本機有 Chrome；或設 CHROME_PATH 指向可執行檔）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
import {startServer} from './serve.mjs';
import {readZip} from '../test-helpers.js';

const VIEWPORTS = [{name: 'mobile-390', width: 390, height: 844, isMobile: true, hasTouch: true}, {name: 'desktop-1440', width: 1440, height: 900}];
const MAIN_CONTROLS = ['#loadExample', '#tabAudio', '#tabImage', '#tabData', '#title', '#key', '#bpm', '#exportWord', '#render', '#midi', '#saveJson'];
const SHOT_DIR = process.env.E2E_SHOT_DIR;

const launch = () => chromium.launch(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {channel: 'chrome'});
const noHorizontalScroll = page => page.evaluate(() => ({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, inner: window.innerWidth}));

const externalRequests = [];
let browser, srv;
test.before(async () => { srv = await startServer(); browser = await launch(); });
test.after(async () => {
  await browser?.close(); srv?.server.close();
  assert.deepEqual(externalRequests, [], '不得發出非本機請求');
});

for (const vp of VIEWPORTS) {
  test(`[${vp.name}] 載入、無水平捲動、主要控制項可見、可匯出`, async () => {
    const context = await browser.newContext({viewport: {width: vp.width, height: vp.height}, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, acceptDownloads: true});
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', e => problems.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
    // 只允許本機請求；任何外部請求（如辨識後端）一律擋下，測試不得送出真實資料。
    await context.route(url => !url.href.startsWith(srv.url), route => {
    externalRequests.push(route.request().url());
    return route.abort();
  });

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

      assert.equal(await page.locator('#wordPaper').inputValue(), 'a4');
      // 匯出 Word（DOCX 為 ZIP：開頭 PK）與 MIDI（開頭 MThd）
      const [docx] = await Promise.all([page.waitForEvent('download'), page.click('#exportWord')]);
      assert.match(docx.suggestedFilename(), /_A4\.docx$/);
      assert.equal(fs.readFileSync(await docx.path()).subarray(0, 2).toString('latin1'), 'PK');
      await page.locator('.word-options summary').click();
      await page.selectOption('#wordPaper', 'letter');
      const [letter] = await Promise.all([page.waitForEvent('download'), page.click('#exportWord')]);
      assert.match(letter.suggestedFilename(), /_Letter\.docx$/);
      w = await noHorizontalScroll(page);
      assert.ok(w.scroll <= w.client, '切換 Letter 後不得水平捲動');
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

// E1：一字一音診斷（手機 390px）。歌詞為自擬示意文字。
test('[mobile-390] 歌詞字數不符時顯示診斷，匯出 Word／MusicXML 附上診斷且不下載', async () => {
  const ly = n => Array.from({length: n}, (_, i) => '甲乙丙丁戊己庚辛'[i % 8]).join('');
  const context = await browser.newContext({
    viewport: {width: 390, height: 844},
    isMobile: true,
    hasTouch: true,
    acceptDownloads: true
  });
  await context.route(url => !url.href.startsWith(srv.url), route => {
    externalRequests.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error') problems.push('console: ' + m.text());
  });
  let downloads = 0;
  page.on('download', () => downloads++);
  try {
    await page.goto(srv.url);
    await page.click('#loadExample');
    await page.waitForFunction(() => document.querySelectorAll('#measures .measure').length > 0);
    await page.fill('#lyrics', ly(75));
    const diag = await page.textContent('#lyricDiag');
    assert.match(diag, /少 1 字/);
    assert.match(diag, /副歌第 16 小節/);
    const w = await noHorizontalScroll(page);
    assert.ok(w.scroll <= w.client, `診斷顯示後水平捲動：scrollWidth ${w.scroll} > ${w.client}`);
    for (const btn of ['#exportWord', '#musicxml']) {
      await page.locator(btn).scrollIntoViewIfNeeded();
      await page.click(btn);
      const st = await page.textContent('#status');
      assert.match(st, /^歌詞需逐字對位/, btn);
      assert.match(st, /第 1 節少 1 字/, btn);
      assert.match((await page.getAttribute('#status', 'class')) || '', /error/, btn);
    }
    await page.waitForTimeout(5000);
    assert.equal(downloads, 0, '字數不符時不應下載');
    await page.fill('#lyrics', ly(76));
    assert.equal(await page.textContent('#lyricDiag'), '');
    await page.fill('#lyrics', '');
    assert.equal(await page.textContent('#lyricDiag'), '');
    if (SHOT_DIR) {
      await page.fill('#lyrics', ly(75));
      await page.locator('#lyricDiag').scrollIntoViewIfNeeded();
      await page.screenshot({path: `${SHOT_DIR}/lyric-diag-390.png`});
    }
    assert.deepEqual(problems, []);
  } finally {
    await context.close();
  }
});

// 歌詞「內文整句」排法（手機 390px）：選項可選、下載的 DOCX 歌詞為內文定位點段落，切換版式時回到該版式預設。歌詞為自擬示意文字。
test('[mobile-390] Word 歌詞排法：內文整句', async () => {
  const syl = '甲乙丙丁戊己庚辛壬癸';
  const lyr = [0, 1]
    .map(k => `${k + 1}、\n` + Array.from({length: 76}, (_, i) => syl[(i + k) % 10]).join(''))
    .join('\n\n');
  const context = await browser.newContext({
    viewport: {width: 390, height: 844},
    isMobile: true,
    hasTouch: true,
    acceptDownloads: true
  });
  await context.route(url => !url.href.startsWith(srv.url), route => route.abort());
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error') problems.push('console: ' + m.text());
  });
  try {
    await page.goto(srv.url);
    await page.click('#loadExample');
    await page.waitForFunction(() => document.querySelectorAll('#measures .measure').length > 0);
    await page.fill('#lyrics', lyr);
    await page.evaluate(() => (document.querySelector('.word-options').open = true));
    await page.selectOption('#wordLyricLayout', 'inline');
    const box = await page.locator('#wordLyricLayout').boundingBox();
    assert.ok(box.height >= 40, `歌詞排法選單觸控目標太小（${box.height}px）`);
    const w = await noHorizontalScroll(page);
    assert.ok(w.scroll <= w.client, `水平捲動：scrollWidth ${w.scroll} > ${w.client}`);
    const [docx] = await Promise.all([page.waitForEvent('download'), page.click('#exportWord')]);
    const bytes = new Uint8Array(fs.readFileSync(await docx.path()));
    assert.equal(Buffer.from(bytes.subarray(0, 2)).toString('latin1'), 'PK');
    const xml = readZip(bytes)['word/document.xml'];
    assert.match(xml, /<w:tab w:val="left"/);
    for (const t of xml.matchAll(/<wps:txbx>.*?<\/wps:txbx>/gs)) assert.doesNotMatch(t[0], /甲|乙|丙/);
    for (const preset of ['classic', 'lsm']) {
      await page.selectOption('#wordPreset', preset);
      const want = await page.evaluate(async p => (await import('./word-export.js')).PRESETS[p].lyricLayout, preset);
      assert.equal(await page.inputValue('#wordLyricLayout'), want);
    }
    assert.deepEqual(problems, []);
  } finally {
    await context.close();
  }
});

// 和弦過密：只使用合成譜，直接連接匯出面板以驗證提示與匯出回呼。
test('[mobile-390] 和弦過密顯示行號、仍可匯出，下一次正常匯出清除警告', async () => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  await context.route(url => !url.href.startsWith(srv.url), route => route.abort());
  const page = await context.newPage();
  try {
    await page.goto(srv.url);
    await page.evaluate(async () => {
      const {connectWordExport} = await import('./studio-word.js');
      const {fromTranscription} = await import('./score-bridge.js');
      const s = fromTranscription({
        title: '合成過密和弦', target_key: 'C',
        notes: [{q: 0, duration: 16, midi: 60}],
        chords: Array.from({length: 20}, (_, i) => ({q: i * 0.8, text: 'Ebsus4/Bb'}))
      });
      window.chordTest = {s, downloads: 0};
      connectWordExport({
        getScore: () => window.chordTest.s,
        status: text => { document.querySelector('#status').textContent = text; },
        download: blob => {
          if (blob.size > 0) window.chordTest.downloads++;
        }
      });
    });
    await page.click('#exportWord');
    assert.match(await page.textContent('#wordHint'), /和弦過密：第 1 行/);
    assert.equal(await page.evaluate(() => window.chordTest.downloads), 1);
    let w = await noHorizontalScroll(page);
    assert.ok(w.scroll <= w.client, '和弦警告不得造成水平捲動');
    await page.evaluate(() => {
      window.chordTest.s.sections.verse[0].chordChanges = [{beat: 0, text: 'C'}];
    });
    await page.click('#exportWord');
    assert.doesNotMatch(await page.textContent('#wordHint'), /和弦過密/);
    assert.equal(await page.evaluate(() => window.chordTest.downloads), 2);
    w = await noHorizontalScroll(page);
    assert.ok(w.scroll <= w.client);
  } finally {
    await context.close();
  }
});

// 錄音限制 E1–E5：所有音訊與樂譜皆為記憶體內的合成資料。
function wav(seconds) {
  const sr = 8000, count = seconds * sr, bytes = Buffer.alloc(44 + count * 2);
  bytes.write('RIFF');bytes.writeUInt32LE(bytes.length - 8, 4);bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);bytes.writeUInt16LE(1, 20);bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sr, 24);bytes.writeUInt32LE(sr * 2, 28);
  bytes.writeUInt16LE(2, 32);bytes.writeUInt16LE(16, 34);bytes.write('data', 36);
  bytes.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) {
    const t = i / sr, local = t % .3, midi = 60 + Math.floor(t / .3) % 5;
    const value = .4 * Math.sin(2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) * local) * Math.exp(-local * 18);
    bytes.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  return {name: 'synthetic.wav', mimeType: 'audio/wav', buffer: bytes};
}
function longScore() {
  return {
    title: '合成長譜', key: 'C', bpm: 200, meter: [4, 4],
    sections: {verse: Array.from({length: 650}, (_, i) => ({
      notes: (i % 2 ? [.5, .5, .5, .5, 1, 1] : [1, .5, .5, 1, 1]).map((d, j) => [60 + j % 3 * 2, d]),
      chord: 'C'
    }))},
    form: [{section: 'verse'}], lyrics: ''
  };
}
async function recordingPage(vp, run) {
  const context = await browser.newContext({
    viewport: {width: vp.width, height: vp.height}, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch
  });
  await context.route(url => !url.href.startsWith(srv.url), route => {
    externalRequests.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(srv.url);
    await run(page);
    const width = await noHorizontalScroll(page);
    assert.ok(width.scroll <= width.client, '不得水平捲動');
    assert.deepEqual(errors, [], '不得有未處理例外');
  } finally {
    await context.close();
  }
}
async function importLongScore(page) {
  await page.click('#tabData');
  await page.setInputFiles('#jsonFile', {
    name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(longScore()))
  });
  await page.waitForFunction(() => document.querySelectorAll('#measures .measure').length === 650);
  assert.equal(await page.inputValue('#bpm'), '200');
}
for (const vp of VIEWPORTS) {
  test(`[${vp.name}] 錄音 E1：四秒 WAV 可辨識`, async () => recordingPage(vp, async page => {
    await page.setInputFiles('#audioFile', wav(4));
    await page.fill('#sourceBpm', '200');
    await page.click('#analyze');
    await page.waitForFunction(() => document.querySelector('#analysisStatus').textContent.includes('旋律校對稿已載入'));
  }));
  test(`[${vp.name}] 錄音 E2：metadata 先拒絕 601 秒`, async () => recordingPage(vp, async page => {
    await page.setInputFiles('#audioFile', wav(601));
    await page.waitForFunction(() => document.querySelector('#analysisStatus').textContent.includes('10 分鐘'));
    assert.match(await page.textContent('#analysisStatus'), /請剪短錄音/);
    assert.ok(await page.isDisabled('#analyze'));
  }));
  test(`[${vp.name}] 錄音 E3：超過 120 MB 清除選檔並停用`, async () => recordingPage(vp, async page => {
    await page.setInputFiles('#audioFile', wav(4));
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(125829121)], 'big.wav'));
      const input = document.querySelector('#audioFile');
      input.files = transfer.files;input.dispatchEvent(new Event('change'));
    });
    assert.match(await page.textContent('#analysisStatus'), /120 MB/);
    assert.ok(await page.isDisabled('#analyze'));
    assert.equal(await page.inputValue('#audioFile'), '');
  }));
  test(`[${vp.name}] 錄音 E4：新上限與校對提醒可見`, async () => recordingPage(vp, async page => {
    assert.match(await page.textContent('#sourceAudio'), /MP3、WAV、M4A · 120 MB／10 分鐘內/);
    assert.match(await page.textContent('#sourceAudio'), /錄音越長越需逐小節校對；速度若有變化，建議分段。/);
    for (const selector of ['#analyze', '#tabAudio', '#preview', '#render']) {
      assert.ok((await page.locator(selector).boundingBox()).height >= 40);
    }
  }));
  test(`[${vp.name}] 錄音 E5：650 小節可匯入並完成試聽`, {timeout: 90000},
    async () => recordingPage(vp, async page => {
      await importLongScore(page);
      await page.click('#preview');
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('前 8 小節已完成'),
        null, {timeout: 60000});
      assert.ok(await page.isVisible('#player'));
      const duration = await page.evaluate(() => new Promise(resolve => {
        const player = document.querySelector('#player');
        if (Number.isFinite(player.duration)) resolve(player.duration);
        else player.onloadedmetadata = () => resolve(player.duration);
      }));
      assert.ok(Math.abs(duration - 11.6) < .1, `試聽長度 ${duration}`);
    }));
}

test('長 MP3：650 小節、782 秒合奏可完整編碼', {
  skip: process.env.LONG_MP3 !== '1', timeout: 600000
}, async () => recordingPage(VIEWPORTS[1], async page => {
  await importLongScore(page);
  await page.selectOption('#mode', 'ensemble');
  await page.evaluate(() => {
    window.longWarningSeen = false;
    new MutationObserver(() => {
      if (document.querySelector('#status').textContent.includes('長樂譜合成約需')) window.longWarningSeen = true;
    }).observe(document.querySelector('#status'), {childList: true});
  });
  await page.click('#render');
  await page.waitForFunction(() => window.longWarningSeen);
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('完整演奏已完成'),
    null, {timeout: 580000});
  const result = await page.evaluate(async () => {
    const player = document.querySelector('#player');
    if (!Number.isFinite(player.duration)) await new Promise(resolve => player.onloadedmetadata = resolve);
    return {duration: player.duration, bytes: (await (await fetch(player.src)).blob()).size};
  });
  assert.ok(Math.abs(result.duration - 782) < .1, `完整長度 ${result.duration}`);
  assert.ok(result.bytes > 18000000 && result.bytes < 20000000, `192 kbps 大小 ${result.bytes}`);
}));

for (const vp of VIEWPORTS) {
  test(`[${vp.name}] 解碼後備：8 kHz 解碼失敗仍可辨識`, async () => recordingPage(vp, async page => {
    await page.evaluate(() => {
      OfflineAudioContext.prototype.decodeAudioData = () => Promise.reject(new Error('不支援直接解碼'));
    });
    await page.setInputFiles('#audioFile', wav(4));
    await page.click('#analyze');
    await page.waitForFunction(() => document.querySelector('#analysisStatus').textContent.includes('旋律校對稿已載入'));
  }));
  test(`[${vp.name}] metadata 不明時由解碼拒絕過長音訊`, async () => recordingPage(vp, async page => {
    await page.evaluate(() => {
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', {get: () => Infinity});
    });
    await page.setInputFiles('#audioFile', wav(601));
    await page.click('#analyze');
    await page.waitForFunction(() => document.querySelector('#analysisStatus').textContent.includes('10 分鐘'));
    assert.match(await page.textContent('#analysisStatus'), /請剪短錄音/);
  }));
  test(`[${vp.name}] 雙路解碼失敗時顯示友善訊息`, async () => recordingPage(vp, async page => {
    await page.evaluate(() => {
      const fail = () => Promise.reject(new Error('解碼失敗'));
      OfflineAudioContext.prototype.decodeAudioData = fail;
      AudioContext.prototype.decodeAudioData = fail;
    });
    await page.setInputFiles('#audioFile', wav(4));
    await page.click('#analyze');
    await page.waitForFunction(() => document.querySelector('#analysisStatus').textContent.includes('無法在此裝置解碼'));
    assert.equal(await page.textContent('#analysisStatus'),
      '這個檔案無法在此裝置解碼，請剪短錄音，或改用 MP3／M4A。');
  }));
}
for (const kind of ['throw', 'reject']) {
  test(`MP3：suspend ${kind} 時退回完整排程`, {timeout: 90000},
    async () => recordingPage(VIEWPORTS[1], async page => {
      await page.evaluate(kind => {
        OfflineAudioContext.prototype.suspend = () => {
          if (kind === 'throw') throw new Error('不支援暫停');
          return Promise.reject(new Error('不支援暫停'));
        };
      }, kind);
      await importLongScore(page);
      await page.click('#preview');
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('前 8 小節已完成'),
        null, {timeout: 60000});
      assert.ok(await page.isVisible('#player'));
    }));
}

test('錄音 Worker 中斷時保留原譜並顯示剪短提示', async () => recordingPage(VIEWPORTS[1], async page => {
  await page.route('**/analysis-worker.js', route => route.fulfill({
    contentType: 'text/javascript', body: "self.onmessage = () => {throw Error('合成測試中斷');};"
  }));
  await importLongScore(page);
  await page.click('#tabAudio');
  await page.setInputFiles('#audioFile', wav(4));
  await page.click('#analyze');
  await page.waitForFunction(() => document.querySelector('#analysisStatus').textContent.includes('分析中斷'));
  assert.equal(await page.textContent('#analysisStatus'), '分析中斷，請剪短錄音後再試。');
  assert.equal(await page.locator('#measures .measure').count(), 650);
}));
for (const count of [2604, 4100]) {
  test(`錄音轉譜 ${count} 音超限時提供剪短提示`, async () => recordingPage(VIEWPORTS[1], async page => {
    const result = {
      bpm_estimate: 200,
      notes: Array.from({length: count}, (_, i) => ({q: i * 4, duration: 4, midi: 60}))
    };
    await page.route('**/analysis-worker.js', route => route.fulfill({
      contentType: 'text/javascript',
      body: `self.onmessage = () => self.postMessage({result:${JSON.stringify(result)}});`
    }));
    await page.setInputFiles('#audioFile', wav(4));
    await page.click('#analyze');
    await page.waitForFunction(() => document.querySelector('#analysisStatus').textContent.includes('辨識出的樂譜超過'));
    assert.equal(await page.textContent('#analysisStatus'),
      '辨識出的樂譜超過 13 分鐘或 1024 小節，請剪短錄音後再試。');
  }));
}

// 原錄音校對使用既有音色樣本，沒有私人錄音。
for (const width of [390, 1440]) {
  test(`[${width}px] 原錄音慢速與循環校對`, async () => {
    const context = await browser.newContext({viewport: {width, height: 900}});
    await context.route(url => !url.href.startsWith(srv.url), route => route.abort());
    const page = await context.newPage();
    try {
      await page.goto(srv.url);
      await page.setInputFiles('#audioFile', new URL('../piano-45.mp3', import.meta.url).pathname);
      await page.waitForSelector('#audioReview');
      await page.selectOption('#reviewRate', '0.75');
      assert.equal(await page.$eval('#sourcePlayer', p => p.playbackRate), 0.75);
      assert.equal(await page.$eval('#sourcePlayer', p => p.preservesPitch), true);
      await page.fill('#reviewStart', '0');
      await page.fill('#reviewEnd', '0.6');
      await page.click('#reviewLoop');
      await page.waitForFunction(() => !document.querySelector('#sourcePlayer').paused);
      assert.equal(await page.getAttribute('#reviewLoop', 'aria-pressed'), 'true');
      await page.evaluate(() => { document.querySelector('#sourcePlayer').currentTime = 0.7; });
      await page.waitForFunction(() => document.querySelector('#sourcePlayer').currentTime < 0.6);
      await page.click('#reviewLoop');
      assert.equal(await page.$eval('#sourcePlayer', p => p.paused), true);
      await page.fill('#reviewEnd', '0.1');
      await page.click('#reviewLoop');
      assert.match(await page.textContent('#reviewStatus'), /至少比起點晚/);
      assert.equal(await page.getAttribute('#reviewLoop', 'aria-pressed'), 'false');
      const w = await noHorizontalScroll(page);
      assert.ok(w.scroll <= w.client, '校對面板不得水平溢出');
      await page.setInputFiles('#audioFile', new URL('../piano-48.mp3', import.meta.url).pathname);
      await page.waitForSelector('#audioReview');
      assert.equal(await page.getAttribute('#reviewLoop', 'aria-pressed'), 'false');
    } finally {
      await context.close();
    }
  });
}
