export function connectMobileWorkspace() {
  const links = [...document.querySelectorAll('.mobile-nav a')];
  const sections = links.map(a => document.querySelector(a.hash));
  let frame = 0;
  const update = () => {
    frame = 0;
    const threshold = Math.min(160, innerHeight / 3);
    let active = 0;
    sections.forEach((panel, i) => { if (panel.getBoundingClientRect().top <= threshold) active = i; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) active = sections.length - 1;
    links.forEach((a, i) => {
      if (i === active) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', schedule);
  links.forEach((link, i) => link.addEventListener('click', e => {
    e.preventDefault();
    sections[i].scrollIntoView({behavior: 'instant', block: 'start'});
    sections[i].focus({preventScroll: true});
    update();
  }));
  update();

  const install = document.getElementById('installStudio'), hint = document.getElementById('installHint');
  let deferred;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
  });
  const installed = () => {
    install.textContent = '已從主畫面開啟';
    hint.textContent = '這是獨立工作室視窗。';
  };
  window.addEventListener('appinstalled', () => {
    deferred = null;
    hint.textContent = '已安裝，可從主畫面開啟譜間。';
  });
  install.onclick = async () => {
    if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) { installed(); return; }
    if (deferred) {
      const prompt = deferred;
      deferred = null;
      try {
        await prompt.prompt();
        const {outcome} = await prompt.userChoice;
        hint.textContent = outcome === 'accepted' ? '已接受安裝。' : '已取消，仍可在瀏覽器使用。';
        return;
      } catch {}
    }
    hint.textContent = 'Android Chrome：開啟瀏覽器選單，選「加到主畫面」或「安裝應用程式」。' +
      'iPhone Safari：點「分享」→「加入主畫面」，若出現「以網頁 App 開啟」請開啟。';
  };
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) installed();
  connectOffline();
}
function connectOffline() {
  const status = document.getElementById('offlineStatus');
  if (!document.documentElement.hasAttribute('data-offline-build')) return;
  if (!('serviceWorker' in navigator)) { status.textContent = '此瀏覽器不支援離線啟動。'; return; }
  let ready = false, failed = false;
  const update = () => {
    if (ready) status.textContent = navigator.onLine ? '可離線使用' : '目前離線 · 可編輯與匯出 Word';
    else if (failed) status.textContent = '尚未備妥離線檔案，請連網後重新整理。';
    else status.textContent = '正在準備離線工作室與內建音色…';
  };
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  navigator.serviceWorker.register('./sw.js').then(reg => {
    const sync = () => {
      ready = reg.active?.state === 'activated';
      update();
    };
    const observe = worker => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'redundant' && !reg.active) failed = true;
        sync();
      });
    };
    observe(reg.installing || reg.waiting || reg.active);
    reg.addEventListener('updatefound', () => observe(reg.installing));
    navigator.serviceWorker.ready.then(() => { ready = true; update(); });
    sync();
  }).catch(() => { failed = true; update(); });
}
