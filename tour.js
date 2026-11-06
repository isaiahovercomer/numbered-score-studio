import {TOUR_KEY, TOUR_VERSION, TOUR_STEPS, tourSteps, readTourVersion} from './tour-steps.js';

export function connectTour() {
  const help = document.getElementById('showTutorial');
  const dialog = document.createElement('dialog');
  dialog.className = 'feature-tour';
  dialog.setAttribute('aria-labelledby', 'tourTitle');
  dialog.setAttribute('aria-describedby', 'tourText');
  dialog.innerHTML = `
    <div class="tour-spot" aria-hidden="true"></div>
    <section class="tour-card">
      <p class="tour-progress" id="tourProgress"></p>
      <h2 id="tourTitle" tabindex="-1"></h2><p id="tourText"></p>
      <div class="tour-actions">
        <button type="button" id="tourSkip">跳過教學</button>
        <button type="button" id="tourPrevious">上一步</button>
        <button type="button" id="tourNext">下一步</button>
      </div>
    </section>`;
  document.body.append(dialog);
  const find = id => dialog.querySelector('#' + id);
  const spot = dialog.querySelector('.tour-spot');
  const card = dialog.querySelector('.tour-card');
  let steps = [], index = 0, originY = 0, previousFocus, frame, seen = 0;
  const openedDetails = new Set();
  const scrolledContainers = new Map();
  try { seen = readTourVersion(localStorage); } catch {}
  const position = () => {
    if (!dialog.open) return;
    const target = document.querySelector(steps[index].target);
    if (!target) { spot.hidden = true; dialog.classList.add('no-spot'); return; }
    const r = target.getBoundingClientRect();
    const bottom = Math.min(r.bottom + 6, card.getBoundingClientRect().top - 14);
    const top = Math.max(8, r.top - 6);
    spot.hidden = bottom <= top || r.width === 0;
    dialog.classList.toggle('no-spot', spot.hidden);
    Object.assign(spot.style, {
      left: Math.max(8, r.left - 6) + 'px', top: top + 'px',
      width: Math.max(0, Math.min(innerWidth - 8, r.right + 6) - Math.max(8, r.left - 6)) + 'px',
      height: Math.max(0, bottom - top) + 'px'
    });
  };
  const show = () => {
    const step = steps[index];
    find('tourProgress').textContent = `${seen > 0 ? '功能教學' : '歡迎使用譜間'} · ${index + 1} / ${steps.length}`;
    find('tourTitle').textContent = step.title;
    find('tourText').textContent = step.text;
    find('tourPrevious').disabled = index === 0;
    find('tourNext').textContent = index === steps.length - 1 ? '開始使用' : '下一步';
    const target = document.querySelector(step.target);
    if (target) {
      for (let parent = target.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName === 'DETAILS' && !parent.open) { openedDetails.add(parent); parent.open = true; }
        if (parent !== document.body && parent !== document.documentElement && !scrolledContainers.has(parent))
          scrolledContainers.set(parent, {top: parent.scrollTop, left: parent.scrollLeft});
      }
      target.scrollIntoView({block: 'start', inline: 'nearest', behavior: 'instant'});
      window.scrollTo({top: Math.max(0, scrollY + target.getBoundingClientRect().top - 32), behavior: 'instant'});
    }
    position();
    find('tourTitle').focus({preventScroll: true});
  };
  const finish = () => {
    try { localStorage.setItem(TOUR_KEY, String(Math.max(seen, TOUR_VERSION))); } catch {}
    seen = Math.max(seen, TOUR_VERSION);
    dialog.close();
    for (const details of openedDetails) details.open = false;
    openedDetails.clear();
    for (const [el, scroll] of scrolledContainers) el.scrollTo(scroll);
    scrolledContainers.clear();
    cancelAnimationFrame(frame);
    window.scrollTo({top: originY, behavior: 'instant'});
    (previousFocus?.isConnected ? previousFocus : help).focus({preventScroll: true});
  };
  const start = list => {
    if (dialog.open || !list.length) return;
    steps = list.filter(s => document.querySelector(s.target));
    if (!steps.length) return;
    originY = scrollY;
    previousFocus = document.activeElement;
    index = 0;
    dialog.showModal();
    show();
  };
  find('tourSkip').onclick = finish;
  find('tourNext').onclick = () => { if (index === steps.length - 1) finish(); else { index++; show(); } };
  find('tourPrevious').onclick = () => { if (index > 0) { index--; show(); } };
  dialog.addEventListener('cancel', e => { e.preventDefault(); finish(); });
  const reposition = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(position); };
  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition, {passive: true});
  help.onclick = () => start(TOUR_STEPS);
  start(tourSteps(seen));
}
