/* Soulmask Planner — 공용 유틸
   의존성 없는 순수 함수 모음 (ES6 모듈) */

export function $(sel, root) {
  return (root || document).querySelector(sel);
}

export function $$(sel, root) {
  return Array.from((root || document).querySelectorAll(sel));
}

export function esc(value) {
  return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function uid(prefix) {
  return (prefix || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

export function todayKey(d) {
  const t = d || new Date();
  return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate());
}

export function addDays(key, n) {
  const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const base = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
  base.setDate(base.getDate() + n);
  return todayKey(base);
}

export function dateLabel(key) {
  const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) { return key || ''; }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${m[1]}.${m[2]}.${m[3]} (${days[d.getDay()]})`;
}

export function shortDateLabel(key) {
  const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) { return key || ''; }
  return `${m[2]}.${m[3]}`;
}

export function nowTime() {
  const d = new Date();
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

export function timeLabel(iso) {
  if (!iso) { return ''; }
  const d = new Date(iso);
  if (isNaN(d.getTime())) { return ''; }
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  return sameDay ? hm : `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${hm}`;
}

export function clampNum(v, min, max) {
  let n = parseInt(v, 10);
  if (isNaN(n)) { n = min; }
  if (n < min) { n = min; }
  if (n > max) { n = max; }
  return n;
}

export function num(v, fallback) {
  const n = Number(v);
  return isFinite(n) ? n : (fallback || 0);
}

export function pct(part, whole) {
  const w = Number(whole) || 0;
  if (w <= 0) { return 0; }
  return Math.max(0, Math.min(100, Math.round((Number(part) || 0) / w * 100)));
}

export function str(v, max) {
  let s = (v === null || v === undefined) ? '' : String(v);
  s = s.trim();
  if (max && s.length > max) { s = s.slice(0, max); }
  return s;
}

export function lines(v) {
  return String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

export function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) { clearTimeout(t); }
    t = setTimeout(() => { t = null; fn(...args); }, ms);
  };
}

export function byId(list, id) {
  return (list || []).find((x) => x && x.id === id) || null;
}

export function sortBy(list, key) {
  return list.slice().sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0));
}

export function progressBar(value, opts) {
  const o = opts || {};
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const tone = o.tone ? ' tone-' + o.tone : '';
  const label = o.label ? `<span class="bar-label">${esc(o.label)}</span>` : '';
  return `<div class="bar${tone}" role="progressbar" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(o.aria || o.label || '진행률')}">
    <div class="bar-track"><div class="bar-fill" style="width:${v}%"></div></div>
    <div class="bar-meta"><span class="bar-val">${v}%</span>${label}</div>
  </div>`;
}

export function emptyBox(text, sub) {
  return `<div class="empty"><p class="empty-main">${esc(text)}</p>${sub ? `<p class="empty-sub">${esc(sub)}</p>` : ''}</div>`;
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fall through to legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

export function downloadText(filename, text, mime) {
  try {
    const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch (e) {
    return false;
  }
}

export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
