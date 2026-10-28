import {connectAudioReview} from './audio-review.js';
// 工作室面板：把錄音分析、Word 匯出、歌詞、和弦四個功能區接到 app.js 提供的樂譜操作。
import {connectAnalysis} from './studio-analysis.js';
import {connectWordExport} from './studio-word.js';
import {connectLyrics} from './studio-lyrics.js';
import {connectChords} from './studio-chords.js';

export function connectStudio({getScore, installScore, status, download, lock, isBusy}) {
  connectAudioReview(document.getElementById('sourcePlayer'));
  const chordState = {timeline: []};
  connectAnalysis({installScore, status, lock, isBusy, chordState});
  connectWordExport({getScore, status, download});
  const {updateCount} = connectLyrics({getScore, installScore, status});
  connectChords({getScore, installScore, status, download, chordState});
  return {updateCount};
}
