/* 부족원 정원 · 직업 계산 (대시보드와 부족원 화면이 함께 사용) */
import { pct, esc, clampNum } from './util.js';

export function members(state) {
  return (state.tribes.members || []).filter((m) => m.recruited !== false);
}

export function allMembers(state) {
  return state.tribes.members || [];
}

export function roleCounts(state) {
  const counts = {};
  (state.tribes.roles || []).forEach((r) => { counts[r.name] = 0; });
  members(state).forEach((m) => { counts[m.role] = (counts[m.role] || 0) + 1; });
  return counts;
}

export function tribeStats(state) {
  const capacity = clampNum(state.tribes.capacity, 1, 99);
  const current = members(state).length;
  const counts = roleCounts(state);
  const roles = (state.tribes.roles || []).map((r) => ({
    ...r,
    count: counts[r.name] || 0,
    short: Math.max(0, r.target - (counts[r.name] || 0))
  }));
  const targetSum = roles.reduce((a, r) => a + r.target, 0);
  return {
    capacity,
    current,
    remaining: Math.max(0, capacity - current),
    percent: pct(current, capacity),
    roles,
    targetSum,
    targetGap: targetSum - capacity,
    shortRoles: roles.filter((r) => r.short > 0),
    replaceCount: allMembers(state).filter((m) => m.replaceNeeded).length
  };
}

export function rolePill(role, cls) {
  return `<span class="chip ${esc(cls || role.tone || 'spare')}">${esc(role.name)}</span>`;
}

/**
 * 정원 편집기 — 숫자 입력 + − / + 버튼.
 * 값이 바뀌면 화면의 진행률·잔여 자리를 즉시 다시 계산합니다.
 */
export function capacityEditorHTML(state, opts) {
  const o = opts || {};
  const st = tribeStats(state);
  return `
  <div class="capacity-box" id="${esc(o.id || 'capacity-box')}" data-capacity-box>
    <div class="cap-left">
      <div class="capacity-label">부족원 수용 정원</div>
      <div class="capacity-edit">
        <button type="button" class="step-btn big" data-act="capacity-dec" aria-label="정원 1명 줄이기">−</button>
        <input class="capacity-input" id="${esc(o.inputId || 'capacity-input')}" type="number" inputmode="numeric"
               min="1" max="99" step="1" value="${st.capacity}"
               data-live="capacity" data-field="capacity" aria-label="부족원 수용 정원">
        <button type="button" class="step-btn big" data-act="capacity-inc" aria-label="정원 1명 늘리기">+</button>
        <span class="tiny muted">명</span>
      </div>
    </div>
    <div class="capacity-meta" data-capacity-meta>
      <div class="cap-line">
        <b class="cap-num" data-cap-current>${st.current} / ${st.capacity}명</b>
        <span class="cap-sub" data-cap-remaining>잔여 ${st.remaining}자리</span>
      </div>
      <div class="bar mt8" data-cap-bar>
        <div class="bar-track"><div class="bar-fill" style="width:${st.percent}%"></div></div>
        <div class="bar-meta"><span>영입 진행률</span><span class="bar-val">${st.percent}%</span></div>
      </div>
    </div>
  </div>
  ${st.targetGap !== 0 ? `<p class="hint">직업별 목표 합계 ${st.targetSum}명 · 정원 ${st.capacity}명 — 목표를 정원에 맞춰 조정해 보세요.</p>` : ''}
  ${o.hideShort ? '' : `<p class="hint" data-cap-short>${shortText(st)}</p>`}`;
}

export function shortText(st) {
  if (!st.shortRoles.length) { return '직업별 목표를 모두 채웠습니다.'; }
  return '부족한 직업: ' + st.shortRoles.map((r) => `${r.name} ${r.short}명`).join(' · ');
}

/** 정원이 바뀌었을 때 화면 숫자를 다시 그립니다 (전체 렌더 없이). */
export function paintCapacity(box, state) {
  if (!box) { return; }
  const st = tribeStats(state);
  const cur = box.querySelector('[data-cap-current]');
  const rem = box.querySelector('[data-cap-remaining]');
  const fill = box.querySelector('[data-cap-bar] .bar-fill');
  const val = box.querySelector('[data-cap-bar] .bar-val');
  if (cur) { cur.textContent = `${st.current} / ${st.capacity}명`; }
  if (rem) { rem.textContent = `잔여 ${st.remaining}자리`; }
  if (fill) { fill.style.width = st.percent + '%'; }
  if (val) { val.textContent = st.percent + '%'; }
  const bar = box.querySelector('[data-cap-bar]');
  if (bar) {
    const track = bar.querySelector('.bar-track');
    if (track && track.parentElement) { track.parentElement.setAttribute('aria-valuenow', String(st.percent)); }
  }
  const shortEl = document.querySelector('[data-cap-short]');
  if (shortEl) { shortEl.textContent = shortText(st); }
}

/** 정원 변경 (모든 화면에서 같은 규칙) */
export function setCapacity(state, value) {
  const n = clampNum(value, 1, 99);
  state.tribes.capacity = n;
  state.profile.capacity = n;
  return n;
}
