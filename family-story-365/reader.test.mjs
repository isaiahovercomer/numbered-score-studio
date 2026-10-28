import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// 執行實際發布的單檔程式；替代瀏覽器 DOM 與語音引擎邊界。
// 真實捲動位置、影片解碼與字幕另以瀏覽器驗證。
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const code = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];

function launch(hash = '#story/theatre/0') {
  const handlers = new Map();
  const elements = new Map();
  const effects = [];
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      innerHTML: '', textContent: '', value: '', disabled: false, open: false,
      classList: {toggle() {}},
      addEventListener(type, listener) {handlers.set(`${selector}:${type}`, listener);},
      querySelectorAll() {return [];},
      focus() {effects.push(['focus', selector]);},
      scrollIntoView() {effects.push(['scroll', selector]);},
      pause() {effects.push(['pause', selector]);},
      setAttribute() {}, removeAttribute() {}
    });
    return elements.get(selector);
  }
  const document = {
    hidden: false,
    documentElement: {style: {setProperty() {}}},
    querySelector: element, querySelectorAll: () => [],
    addEventListener(type, listener) {handlers.set(`document:${type}`, listener);}
  };
  const location = {hash};
  const context = vm.createContext({
    document, location,
    window: {
      speechSynthesis: {cancel() {effects.push(['cancel']);}, getVoices: () => [], addEventListener() {}},
      addEventListener(type, listener) {handlers.set(`window:${type}`, listener);},
      getSelection: () => ''
    },
    localStorage: {getItem: () => null, setItem() {}},
    history: {replaceState(_state, _title, hash) {location.hash = hash;}},
    setTimeout() {return 1;}, clearTimeout() {effects.push(['clearTimer']);},
    console
  });
  vm.runInContext(code, context);
  effects.length = 0;
  return {
    context, effects, location, document, element,
    run: expression => vm.runInContext(expression, context),
    emit: (target, type, event = {}) => handlers.get(`${target}:${type}`)?.(event)
  };
}

test('影片方向鍵保留快轉，不切換故事頁', () => {
  const app = launch();
  let prevented = false;
  const video = {closest: selector => selector.split(',').includes('video') ? video : null};
  app.emit('document', 'keydown', {
    key: 'ArrowRight', target: video, preventDefault() {prevented = true;}
  });
  assert.equal(app.location.hash, '#story/theatre/0');
  assert.equal(prevented, false);
});

test('一般閱讀區仍可用方向鍵翻頁', () => {
  const app = launch('#story/comic/0');
  app.emit('document', 'keydown', {key: 'ArrowRight', target: {closest: () => null}, preventDefault() {}});
  assert.equal(app.location.hash, '#story/comic/1');
});

test('影片只在劇場第一頁顯示，不在後續章節重建播放器', () => {
  assert.match(launch().element('#main').innerHTML, /<video\b/);
  for (const hash of ['#story/theatre/1', '#story/theatre/5', '#story/comic/0']) {
    assert.doesNotMatch(launch(hash).element('#main').innerHTML, /<video\b/);
  }
});

test('手動翻頁把焦點與捲動移到新場景', () => {
  const app = launch('#story/comic/0');
  app.location.hash = '#story/comic/1';
  app.emit('window', 'hashchange');
  assert.ok(app.effects.some(([action, selector]) => action === 'scroll' && selector === '.reader-main'));
  assert.ok(app.effects.some(([action, selector]) => action === 'focus' && selector === '#book'));
});

test('自動翻頁也將新場景帶入視窗', () => {
  const app = launch();
  app.run('finishedPage()');
  assert.equal(app.location.hash, '#story/theatre/1');
  assert.ok(app.effects.some(([action, selector]) => action === 'scroll' && selector === '.reader-main'));
});

test('開始影片時停止逐頁播放，避免計時器中途換頁', () => {
  const app = launch();
  app.run('playPage()');
  assert.equal(app.run('silentState'), 'playing');
  app.emit('#main', 'play', {target: {matches: selector => selector === '#story-video'}});
  assert.equal(app.run('silentState'), 'idle');
});

test('開始逐頁播放及離開可見畫面時會暫停影片', () => {
  const app = launch();
  app.run('playPage()');
  assert.ok(app.effects.some(([action, selector]) => action === 'pause' && selector === '#story-video'));
  app.effects.length = 0;
  app.document.hidden = true;
  app.emit('document', 'visibilitychange');
  assert.ok(app.effects.some(([action, selector]) => action === 'pause' && selector === '#story-video'));
});
