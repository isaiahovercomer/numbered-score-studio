// 混音器：每個聲部一支音量滑桿。
const PARTS = {
  melody: '鋼琴旋律',
  arpeggio: '鋼琴伴奏',
  cello: '大提琴',
  violin: '弦樂',
  flute: '長笛'
};

// 在 container 內建立各聲部音量滑桿；滑桿改變時更新 mix 並呼叫 onChange（讓舊的試聽失效）。
export function buildMixer(container, mix, onChange) {
  for (const [part, title] of Object.entries(PARTS)) {
    const div = document.createElement('div');
    div.className = 'channel';
    const lab = document.createElement('label');
    lab.htmlFor = 'mix-' + part;
    lab.textContent = title;
    const val = document.createElement('output');
    val.textContent = '100%';
    const range = document.createElement('input');
    range.id = 'mix-' + part;
    range.type = 'range';
    range.min = 0;
    range.max = 150;
    range.value = 100;
    range.oninput = () => {
      mix[part] = Number(range.value) / 100;
      val.textContent = range.value + '%';
      onChange();
    };
    lab.append(val);
    div.append(lab, range);
    container.append(div);
  }
}
