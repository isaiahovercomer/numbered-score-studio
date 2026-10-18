// 錄音來源與分析：選檔、解碼、背景 Worker 辨識旋律或估計和弦，並處理取消。
import {fromTranscription} from './score-bridge.js';
import {$} from './dom.js';

// chordState.timeline：估計出的和弦時間表，與 studio-chords.js 共用。
export function connectAnalysis({installScore, status, lock, isBusy, chordState}) {
  let audioFile,
    sourceUrl,
    analysisWorker,
    generation = 0;
  for (const mode of ['Audio', 'Image', 'Data'])
    $('tab' + mode).onclick = () => {
      for (const m of ['Audio', 'Image', 'Data']) {
        $('source' + m).hidden = m !== mode;
        $('tab' + m).setAttribute('aria-selected', String(m === mode));
      }
    };
  $('audioFile').onchange = e => {
    audioFile = e.target.files[0];
    if (!audioFile) return;
    if (audioFile.size > 20 * 1024 * 1024) {
      audioFile = null;
      $('analysisStatus').textContent = '請選擇 20 MB 以內的音訊。';
      return;
    }
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(audioFile);
    $('sourcePlayer').src = sourceUrl;
    $('sourcePlayer').hidden = false;
    $('audioName').textContent = audioFile.name;
    $('analyze').disabled = false;
  };
  $('analysisMode').onchange = () => {
    $('analyze').textContent = $('analysisMode').value === 'chords' ? '估計伴奏和弦' : '辨識旋律';
  };
  const done = () => {
    lock(false);
    $('analyze').disabled = !audioFile;
    $('cancelAnalysis').hidden = true;
    $('analysisProgress').hidden = true;
    analysisWorker = null;
  };
  $('cancelAnalysis').onclick = () => {
    generation++;
    analysisWorker?.terminate();
    done();
    $('analysisStatus').textContent = '分析已取消，原樂譜保留。';
  };
  $('analyze').onclick = async () => {
    if (!audioFile || isBusy()) return;
    const operation = ++generation;
    try {
      lock(true);
      $('cancelAnalysis').hidden = false;
      $('cancelAnalysis').disabled = false;
      $('analysisProgress').hidden = false;
      $('analysisProgress').value = 0;
      $('analysisStatus').textContent = '正在解碼音訊，檔案不會上傳…';
      const context = new AudioContext();
      let decoded;
      try {
        decoded = await context.decodeAudioData(await audioFile.arrayBuffer());
      } finally {
        await context.close();
      }
      if (decoded.duration > 180) throw Error('請使用 3 分鐘內的音訊片段。');
      const sr = 8000,
        offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * sr), sr),
        source = offline.createBufferSource();
      source.buffer = decoded;
      source.connect(offline.destination);
      source.start();
      const samples = (await offline.startRendering()).getChannelData(0);
      if (operation !== generation) return;
      const mode = $('analysisMode').value,
        bpm = Number($('sourceBpm').value) || 0;
      if (mode === 'chords' && !bpm) throw Error('伴奏和弦估計請先輸入 BPM，以決定分析區間。');
      analysisWorker = new Worker(new URL('./analysis-worker.js', import.meta.url), {type: 'module'});
      $('analysisStatus').textContent =
        mode === 'chords' ? '正在分析和弦，請保留此頁面…' : '正在辨識音高與節奏，請保留此頁面…';
      analysisWorker.onerror = () => {
        $('analysisStatus').textContent = '分析中斷，請改用較短錄音。';
        analysisWorker?.terminate();
        done();
      };
      analysisWorker.onmessage = ({data}) => {
        if (data.progress !== undefined) {
          $('analysisProgress').value = data.progress * 100;
          return;
        }
        try {
          if (data.error) throw Error(data.error);
          if (mode === 'chords') {
            chordState.timeline = data.result;
            $('chordTimeline').textContent = chordState.timeline
              .map(c => `${c.time.toFixed(2)} s　${c.text}`)
              .join('\n');
            $('chordResults').hidden = false;
            $('analysisStatus').textContent = '和弦估計完成，尚未覆蓋樂譜。請確認起點、速度及調性後套用。';
          } else {
            const s = fromTranscription(data.result);
            installScore(s);
            $('mode').value = 'melody';
            $('analysisStatus').textContent = '旋律校對稿已載入。請先試聽，校正長音、休止與弱起，再加入歌詞。';
            status('單音辨識完成，請逐小節核對。');
          }
        } catch (e) {
          $('analysisStatus').textContent = e.message;
        } finally {
          analysisWorker?.terminate();
          done();
        }
      };
      analysisWorker.postMessage(
        {
          samples,
          sampleRate: sr,
          mode,
          options: {
            key: $('sourceKey').value,
            bpm,
            pickup: Number($('pickup').value),
            title: audioFile.name.replace(/\.[^.]+$/, '')
          }
        },
        [samples.buffer]
      );
    } catch (e) {
      if (operation === generation) {
        $('analysisStatus').textContent = e.message;
        done();
      }
    }
  };
}
