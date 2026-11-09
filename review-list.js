import {$} from './dom.js';

export const categories = ['音高', '拍數', '和弦', '歌詞'];
export function pendingItems(score) {
  if (!Array.isArray(score.reviewItems)) return [];
  const seen = new Set();
  return score.reviewItems.filter(item => {
    if (!item || typeof item.section !== 'string' || !Object.hasOwn(score.sections, item.section) ||
        !Number.isInteger(item.index) || item.index < 0 || !score.sections[item.section][item.index] ||
        !categories.includes(item.category)) return false;
    const id = JSON.stringify([item.section, item.index, item.category]);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
export function connectReviewList({state, label, jump, save}) {
  let previousSection;
  const number = $('markBar');
  function render() {
    const {score, current} = state();
    if (!score) return;
    number.max = score.sections[current].length;
    if (previousSection !== current || Number(number.value) > Number(number.max)) number.value = '1';
    previousSection = current;
    $('markSection').textContent = label(current);
    const items = pendingItems(score), marked = new Set(items.filter(m => m.section === current).map(m => m.index));
    [...$('measures').children].forEach((row, i) => row.classList.toggle('needs-review', marked.has(i)));
    $('markCount').textContent = items.length;
    $('markList').replaceChildren(...items.map(m => {
      const li = document.createElement('li');
      const go = document.createElement('button'), done = document.createElement('button');
      go.type = done.type = 'button';
      go.className = done.className = 'quiet';
      const title = label(m.section) + ' 第 ' + (m.index + 1) + ' 小節 · ' + m.category;
      go.textContent = title;
      go.onclick = () => jump(m.section, m.index, m.category);
      done.textContent = '完成';
      done.setAttribute('aria-label', '完成：' + title);
      done.onclick = () => {
        score.reviewItems = pendingItems(score).filter(item => item !== m);
        if (!score.reviewItems.length) delete score.reviewItems;
        save(); render(); $('markMessage').textContent = '已完成：' + title;
      };
      li.append(go, done);
      return li;
    }));
  }
  $('markAdd').onclick = () => {
    const {score, current} = state(), index = Number(number.value) - 1, category = $('markCategory').value;
    if (!Number.isInteger(index) || index < 0 || index >= score.sections[current].length) {
      $('markMessage').textContent = '請填入目前段落內的小節號。'; return;
    }
    const items = pendingItems(score);
    if (items.some(m => m.section === current && m.index === index && m.category === category)) {
      $('markMessage').textContent = '這個小節已有相同標記。'; return;
    }
    score.reviewItems = [...items, {section: current, index, category}];
    save(); render();
    $('markMessage').textContent = '已標記：' + label(current) + ' 第 ' + (index + 1) + ' 小節 · ' + category;
  };
  return {render, select(index) { number.value = index + 1; }};
}
