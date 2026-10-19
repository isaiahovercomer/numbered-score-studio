// 歌詞：匯入 TXT 與「起音／節數／字數」即時統計。
import {writtenEvents} from './score-bridge.js';
import {parseVerses} from './word-export.js';
import {$} from './dom.js';

export function connectLyrics({getScore, installScore, status}) {
  $('lyricFile').onchange = async e => {
    try {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 100000) throw Error('歌詞檔請小於 100 KB。');
      let text = (await f.text()).replace(/^\uFEFF/, '');
      const s = getScore();
      if (text.trimStart().startsWith(s.title + '\n') || text.trimStart().startsWith(s.title + '\r\n'))
        text = text.trimStart().slice(s.title.length).trimStart();
      s.lyrics = text;
      installScore(s);
      updateCount();
    } catch (e) {
      status(e.message, true);
    } finally {
      e.target.value = '';
    }
  };
  function updateCount() {
    try {
      const s = getScore(),
        count = writtenEvents(s).events.filter(e => e.midi !== null).length,
        verses = parseVerses(s.lyrics);
      $('lyricCount').textContent =
        `${count} 個起音` +
        (verses.length
          ? ` · ${verses.length} 節歌詞 · 各節 ${verses.map(v => v.length).join('／')} 字`
          : ' · 尚未加入歌詞');
    } catch {}
  }
  $('lyrics').addEventListener('input', updateCount);
  document.addEventListener('scorechange', updateCount);
  return {updateCount};
}
