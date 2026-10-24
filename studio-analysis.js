// 錄音來源與分析：選檔、解碼、背景 Worker 辨識旋律或估計和弦，並處理取消。
import {audioLimitError} from './audio-analysis.js';
import {SCORE_LIMITS} from './music.js';
import {fromTranscription} from './score-bridge.js';
import {$} from './dom.js';

// 優先直接降採樣解碼；不支援的裝置重新讀檔並沿用渲染降採樣。
async function decodeMono8k(file) {
  let decoded;
  try {
    decoded = await new OfflineAudioContext(1, 1, 8000).decodeAudioData(await file.arrayBuffer());
  } catch {
    let context;
    try {
      context = new AudioContext();
      decoded = await context.decodeAudioData(await file.arrayBuffer());
    } catch {
      throw Error('這個檔案無法在此裝置解碼，請剪短錄音，或改用 MP3／M4A。');
    } finally {
      await context?.close().catch(() => {});
    }
  }
  const error = audioLimitError({seconds: decoded.duration});
  if (error) throw Error(error);
  try {
    if (decoded.sampleRate !== 8000) {
      const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 8000), 8000);
      const source = offline.createBufferSource();
      source.buffer = decoded;
      source.connect(offline.destination);
      source.start();
      decoded = await offline.startRendering();
    }
    const samples = new Float32Array(decoded.length);
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      const data = decoded.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) samples[i] += data[i] / decoded.numberOfChannels;
    }
    return samples;
  } catch {
    throw Error('這個檔案無法在此裝置解碼，請剪短錄音，或改用 MP3／M4A。');
  }
}
function recordingError(error) {
  if (/單次輸出上限|樂譜段落格式不正確/.test(error.message)) {
    return `辨識出的樂譜超過 ${SCORE_LIMITS.seconds / 60} 分鐘或 ${SCORE_LIMITS.bars} 小節，請剪短錄音後再試。`;
  }
  return error.message;
}

// chordState.timeline：估計出的和弦時間表，與 studio-chords.js 共用。
export function connectAnalysis({installScore, status, lock, isBusy, chordState}) {
  let audioFile,
    sourceUrl,
    durationInvalid = false,
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
    durationInvalid = false;
    $('analyze').disabled = true;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    $('sourcePlayer').removeAttribute('src');
    $('sourcePlayer').hidden = true;
    $('audioName').textContent = audioFile?.name || '尚未選擇音訊';
    $('analysisStatus').textContent = '';
    if (!audioFile) return;
    const error = audioLimitError({bytes: audioFile.size});
    if (error) {
      audioFile = null;
      e.target.value = '';
      $('analysisStatus').textContent = error;
      return;
    }
    sourceUrl = URL.createObjectURL(audioFile);
    $('sourcePlayer').src = sourceUrl;
    $('sourcePlayer').hidden = false;
    $('audioName').textContent = audioFile.name;
    $('analyze').disabled = false;
  };
  $('sourcePlayer').onloadedmetadata = () => {
    if (!audioFile) return;
    const seconds = $('sourcePlayer').duration;
    const error = Number.isFinite(seconds) ? audioLimitError({seconds}) : '';
    durationInvalid = !!error;
    if (error) $('analysisStatus').textContent = error;
    $('analyze').disabled = isBusy() || durationInvalid;
  };
  $('analysisMode').onchange = () => {
    $('analyze').textContent = $('analysisMode').value === 'chords' ? '估計伴奏和弦' : '辨識旋律';
  };
  const done = () => {
    lock(false);
    $('analyze').disabled = !audioFile || durationInvalid;
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
    if (!audioFile || durationInvalid || isBusy()) return;
    const operation = ++generation;
    try {
      lock(true);
      $('cancelAnalysis').hidden = false;
      $('cancelAnalysis').disabled = false;
      $('analysisProgress').hidden = false;
      $('analysisProgress').value = 0;
      $('analysisStatus').textContent = '正在解碼音訊，檔案不會上傳…';
      const sr = 8000,
        samples = await decodeMono8k(audioFile);
      if (operation !== generation) return;
      const mode = $('analysisMode').value,
        bpm = Number($('sourceBpm').value) || 0;
      if (mode === 'chords' && !bpm) throw Error('伴奏和弦估計請先輸入 BPM，以決定分析區間。');
      analysisWorker = new Worker(new URL('./analysis-worker.js', import.meta.url), {type: 'module'});
      $('analysisStatus').textContent =
        mode === 'chords' ? '正在分析和弦，請保留此頁面…' : '正在辨識音高與節奏，請保留此頁面…';
      analysisWorker.onerror = () => {
        $('analysisStatus').textContent = '分析中斷，請剪短錄音後再試。';
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
          $('analysisStatus').textContent = recordingError(e);
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
        $('analysisStatus').textContent = recordingError(e);
        done();
      }
    }
  };
}
