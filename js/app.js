/* Soulmask Planner — 앱 셸 / 라우터
   9개 뷰를 해시 라우팅으로 전환하고, 클릭·입력 이벤트를 위임합니다. */
import { VIEWS } from './data.js';
import { store, storageStatus } from './store.js';
import * as sync from './sync.js';
import { toast, openModal, closeModal } from './ui.js';
import { $, $$, esc, todayKey, dateLabel, timeLabel } from './util.js';

import dashboard from './views/dashboard.js';
import todos from './views/todos.js';
import tribesmen from './views/tribesmen.js';
import roadmap from './views/roadmap.js';
import bosses from './views/bosses.js';
import resources from './views/resources.js';
import journal from './views/journal.js';
import youtube from './views/youtube.js';
import settings from './views/settings.js';

const VIEW_MAP = { dashboard, todos, tribesmen, roadmap, bosses, resources, journal, youtube, settings };

const app = {
  view: 'dashboard'
};

let renderQueued = false;

/** 입력 blur(change) 도중 innerHTML을 갈아끼우면 브라우저가 예외를 던지므로 한 박자 미룹니다. */
function scheduleRender() {
  if (renderQueued) { return; }
  renderQueued = true;
  setTimeout(() => { renderQueued = false; render(); }, 0);
}

/* ---------- 공용 컨텍스트 ---------- */
const ctx = {
  get state() { return store.state; },
  ui: { toast, openModal, closeModal },
  sync,
  today: todayKey,
  dateLabel,
  timeLabel,

  /** 저장 + 전체 다시 그리기 */
  commit(message, opts) {
    const ok = store.save();
    scheduleRender();
    if (message) { toast(message, !!(opts && opts.error)); }
    return ok;
  },

  /** 저장만 (다시 그리기는 직접) */
  save(opts) { return store.save(opts); },

  render() { scheduleRender(); },
  renderNow() { render(); },

  setView(id) { location.hash = '#' + id; },

  /** 모달 입력값 읽기 */
  val(form, id) {
    const el = form.querySelector('#' + id);
    return el ? el.value.trim() : '';
  },
  num(form, id, fallback) {
    const el = form.querySelector('#' + id);
    const n = Number(el ? el.value : NaN);
    return isFinite(n) ? n : (fallback || 0);
  },
  check(form, id) {
    const el = form.querySelector('#' + id);
    return !!(el && el.checked);
  }
};

/* ---------- 내비게이션 ---------- */
function buildNav() {
  const side = $('#side-nav');
  const bottom = $('#bottom-nav');
  const sheet = $('#sheet-grid');
  if (side) {
    side.innerHTML = VIEWS.map((v) => `
      <button type="button" class="side-link" data-act="nav" data-view="${v.id}">
        <span class="si" aria-hidden="true">${v.icon}</span><span>${esc(v.title)}</span>
      </button>`).join('');
  }
  if (bottom) {
    const mobile = VIEWS.filter((v) => v.mobile);
    bottom.innerHTML = mobile.map((v) => `
      <button type="button" class="nav-btn" data-act="nav" data-view="${v.id}">
        <span class="nv-ico" aria-hidden="true">${v.icon}</span><span>${esc(v.title.replace('플레이 ', ''))}</span>
      </button>`).join('') + `
      <button type="button" class="nav-btn" data-act="open-sheet" id="more-btn">
        <span class="nv-ico" aria-hidden="true">⋯</span><span>더보기</span>
      </button>`;
  }
  if (sheet) {
    sheet.innerHTML = VIEWS.map((v) => `
      <button type="button" class="sheet-link" data-act="nav" data-view="${v.id}">
        <span class="si" aria-hidden="true">${v.icon}</span><span>${esc(v.title)}</span>
      </button>`).join('');
  }
}

function paintNav() {
  $$('.side-link, .nav-btn, .sheet-link').forEach((el) => {
    const v = el.getAttribute('data-view');
    el.classList.toggle('active', v === app.view);
  });
  const more = $('#more-btn');
  if (more) {
    const isMoreView = !VIEWS.find((v) => v.mobile && v.id === app.view);
    more.classList.toggle('active', !!isMoreView);
  }
}

function viewFromHash() {
  const id = String(location.hash || '').replace(/^#\/?/, '').split('?')[0];
  return VIEW_MAP[id] ? id : 'dashboard';
}

function setView(id) {
  if (!VIEW_MAP[id]) { id = 'dashboard'; }
  app.view = id;
  render();
  const root = $('#view-root');
  if (root) { root.scrollTop = 0; }
  window.scrollTo(0, 0);
}

/* ---------- 렌더 ---------- */
function render() {
  const view = VIEW_MAP[app.view];
  const title = $('#view-title');
  const sub = $('#view-sub');
  const root = $('#view-root');
  if (!root || !view) { return; }
  const st = store.state;
  title.textContent = view.title;
  sub.textContent = view.sub ? view.sub(ctx, st) : '';
  root.innerHTML = `<div class="view view-${app.view}">${view.render(ctx, st)}</div>`;
  paintNav();
  paintStatus();
  if (view.afterRender) {
    try { view.afterRender(root, ctx); } catch (e) { /* 뷰별 후처리는 실패해도 화면은 유지 */ }
  }
  const today = $('#today-chip');
  if (today) { today.textContent = dateLabel(todayKey()); }
}

/* ---------- 상태 표시 ---------- */
function paintStatus() {
  const s = storageStatus();
  const banner = $('#storage-banner');
  const dot = $('#side-dot');
  const sideText = $('#side-storage');
  if (banner) { banner.hidden = s.ok; }
  if (banner && !s.ok) {
    $('#storage-banner-text').textContent =
      `브라우저 저장소를 사용할 수 없습니다(${s.note}). 변경 내용은 이 화면에서만 유지되니 설정에서 백업을 내려받아 두세요.`;
  }
  if (dot) { dot.className = 'dot' + (s.ok ? '' : ' warn'); }
  if (sideText) { sideText.textContent = s.ok ? '자동 저장 켜짐' : '자동 저장 꺼짐'; }
  paintSync();
}

function paintSync() {
  const snap = sync.syncSnapshot();
  const chip = $('#sync-chip');
  const text = $('#sync-chip-text');
  if (text) { text.textContent = snap.label; }
  if (chip) {
    chip.className = 'sync-chip' + (snap.busy ? ' busy' : '') + (snap.lastError ? ' err' : (snap.connected && snap.lastSyncAt && !snap.pending ? ' ok' : ''));
    chip.title = snap.lastError ? '동기화 오류 · ' + snap.lastError : (snap.connected ? '클라우드 동기화 · 눌러서 설정' : '클라우드 동기화 꺼짐 · 눌러서 연결');
  }
}

/* ---------- 시트 ---------- */
function openSheet() {
  const b = $('#sheet-backdrop');
  if (!b) { return; }
  b.hidden = false;
  document.body.classList.add('sheet-open');
  paintNav();
}
function closeSheet() {
  const b = $('#sheet-backdrop');
  if (!b) { return; }
  b.hidden = true;
  document.body.classList.remove('sheet-open');
}

/* ---------- 이벤트 ---------- */
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) { return; }
  const act = el.getAttribute('data-act');
  const id = el.getAttribute('data-id');

  if (act === 'nav') {
    closeSheet();
    const v = el.getAttribute('data-view');
    if (location.hash === '#' + v) { setView(v); } else { location.hash = '#' + v; }
    return;
  }
  if (act === 'open-sheet') { openSheet(); return; }
  if (act === 'close-sheet') { closeSheet(); return; }
  if (act === 'open-sync' || act === 'open-settings') {
    closeSheet();
    if (location.hash === '#settings') { setView('settings'); }
    else { location.hash = '#settings'; }
    setTimeout(() => {
      const block = $('#sync-block');
      if (block && block.scrollIntoView) { block.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }, 60);
    return;
  }
  if (act === 'close-modal') { closeModal(); return; }

  const view = VIEW_MAP[app.view];
  if (view && view.actions && typeof view.actions[act] === 'function') {
    ev.preventDefault();
    view.actions[act](el, ctx, { id, ev });
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (!el || !el.getAttribute) { return; }
  const name = el.getAttribute('data-field');
  if (!name) { return; }
  const view = VIEW_MAP[app.view];
  if (view && view.fields && typeof view.fields[name] === 'function') {
    view.fields[name](el, ctx, { ev });
  }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (!el || !el.getAttribute) { return; }
  const name = el.getAttribute('data-live');
  if (!name) { return; }
  const view = VIEW_MAP[app.view];
  if (view && view.live && typeof view.live[name] === 'function') {
    view.live[name](el, ctx, { ev });
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    if (!$('#sheet-backdrop').hidden) { closeSheet(); }
  }
});

const sheetEl = $('#sheet-backdrop');
if (sheetEl) {
  sheetEl.addEventListener('click', (ev) => {
    if (ev.target && ev.target.id === 'sheet-backdrop') { closeSheet(); }
  });
}

/* ---------- 시작 ---------- */
function boot() {
  store.load();
  buildNav();
  app.view = viewFromHash();
  render();

  store.subscribe(() => {
    if (store.isPending()) { sync.schedulePush(); }
    paintStatus();
  });
  sync.onSyncChange(() => { paintSync(); });
  sync.initSync();

  window.addEventListener('hashchange', () => {
    setView(viewFromHash());
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  const migrated = store.migratedFromLegacy;
  if (migrated) {
    setTimeout(() => { toast('기존 "소울마스크 관리 보드" 데이터를 Planner로 옮겼습니다'); }, 400);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export { ctx, render, app };
