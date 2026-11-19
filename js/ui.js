/* Soulmask Planner — 공용 UI (토스트, 모달, 확인창, 입력 도우미) */
import { $, esc } from './util.js';

let toastTimer = null;

export function toast(message, isError) {
  const el = $('#toast');
  if (!el) { return; }
  el.textContent = message;
  el.className = 'toast show' + (isError ? ' err' : '');
  if (toastTimer) { clearTimeout(toastTimer); }
  toastTimer = setTimeout(() => {
    el.className = 'toast' + (isError ? ' err' : '');
  }, isError ? 4200 : 2400);
}

let lastFocus = null;
let onCloseHook = null;

export function openModal(opts) {
  const backdrop = $('#modal-backdrop');
  const title = $('#modal-title');
  const body = $('#modal-body');
  if (!backdrop || !body) { return; }
  lastFocus = document.activeElement;
  title.textContent = opts.title || '';
  body.innerHTML =
    `<form id="modal-form" novalidate>` +
    (opts.bodyHTML || '') +
    `<div class="modal-foot">` +
    `<button type="button" class="btn ghost" data-modal="cancel">${esc(opts.cancelLabel || '닫기')}</button>` +
    (opts.onSubmit ? `<button type="submit" class="btn ${opts.danger ? 'danger' : 'primary'}" data-modal="submit">${esc(opts.submitLabel || '저장')}</button>` : '') +
    `</div></form>`;
  backdrop.hidden = false;
  document.body.classList.add('modal-open');
  backdrop.classList.toggle('wide', !!opts.wide);

  const form = $('#modal-form');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!opts.onSubmit) { closeModal(); return; }
    const btn = form.querySelector('[data-modal="submit"]');
    if (btn) { btn.disabled = true; }
    try {
      const result = await opts.onSubmit(form);
      if (result === false) { return; }
      closeModal();
    } catch (err) {
      const box = form.querySelector('.form-error');
      if (box) { box.textContent = err && err.message ? err.message : '처리하지 못했습니다.'; box.hidden = false; }
      else { toast(err && err.message ? err.message : '처리하지 못했습니다.', true); }
    } finally {
      if (btn) { btn.disabled = false; }
    }
  });
  backdrop.querySelectorAll('[data-modal="cancel"]').forEach((b) => {
    b.addEventListener('click', closeModal);
  });
  onCloseHook = opts.onClose || null;
  const first = form.querySelector('input:not([type=hidden]), textarea, select');
  if (first) { setTimeout(() => { try { first.focus(); } catch (e) {} }, 40); }
}

export function closeModal() {
  const backdrop = $('#modal-backdrop');
  if (!backdrop) { return; }
  backdrop.hidden = true;
  document.body.classList.remove('modal-open');
  const body = $('#modal-body');
  if (body) { body.innerHTML = ''; }
  if (onCloseHook) { const fn = onCloseHook; onCloseHook = null; fn(); }
  if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  lastFocus = null;
}

export function confirmAction(message, opts) {
  const o = opts || {};
  return new Promise((resolve) => {
    let settled = false;
    openModal({
      title: o.title || '확인',
      bodyHTML: `<p class="confirm-msg">${esc(message).replace(/\n/g, '<br>')}</p>` +
        `<p class="form-error" hidden></p>`,
      submitLabel: o.confirmLabel || '확인',
      cancelLabel: '취소',
      danger: !!o.danger,
      onSubmit: () => { settled = true; resolve(true); },
      onClose: () => { if (!settled) { resolve(false); } }
    });
  });
}

export function promptText(opts) {
  const o = opts || {};
  return new Promise((resolve) => {
    let settled = false;
    let value = o.value || '';
    openModal({
      title: o.title || '입력',
      bodyHTML:
        `<div class="field"><label for="prompt-input">${esc(o.label || '내용')}</label>` +
        `<input id="prompt-input" type="text" value="${esc(o.value || '')}" placeholder="${esc(o.placeholder || '')}">` +
        `<p class="form-error" hidden></p></div>`,
      submitLabel: o.submitLabel || '저장',
      onSubmit: (form) => {
        value = form.querySelector('#prompt-input').value.trim();
        if (!value) { throw new Error('내용을 입력해 주세요.'); }
        settled = true;
        resolve(value);
      },
      onClose: () => { if (!settled) { resolve(null); } }
    });
  });
}

/* ---------- 입력 HTML 도우미 ---------- */

export function field(label, inputHTML, hint) {
  return `<div class="field"><label>${esc(label)}</label>${inputHTML}${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</div>`;
}

export function textInput(id, value, attrs) {
  return `<input id="${esc(id)}" type="text" value="${esc(value || '')}" ${attrs || ''}>`;
}

export function textArea(id, value, rows, attrs) {
  return `<textarea id="${esc(id)}" rows="${rows || 3}" ${attrs || ''}>${esc(value || '')}</textarea>`;
}

export function selectInput(id, options, value, attrs) {
  const opts = options.map((o) => {
    const v = typeof o === 'string' ? o : o.value;
    const label = typeof o === 'string' ? o : o.label;
    return `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(label)}</option>`;
  }).join('');
  return `<select id="${esc(id)}" ${attrs || ''}>${opts}</select>`;
}

export function stepper(opts) {
  const o = opts || {};
  return `<div class="stepper" data-stepper="${esc(o.key || '')}">
    <button type="button" class="step-btn" data-act="${esc(o.decAct || '')}" data-id="${esc(o.id || '')}" aria-label="줄이기">−</button>
    <span class="step-val" data-step-val>${esc(o.value)}</span>
    <button type="button" class="step-btn" data-act="${esc(o.incAct || '')}" data-id="${esc(o.id || '')}" aria-label="늘리기">+</button>
  </div>`;
}
