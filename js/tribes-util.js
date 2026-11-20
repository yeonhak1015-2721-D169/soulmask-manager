/* 부족원 정원 · 직업 · 숙련도 등급 계산 (대시보드와 부족원 화면이 함께 사용) */
import { pct, esc, clampNum } from './util.js';
import { findProfession, professionTitle, PROFICIENCIES } from './data.js';

/* ---------- 숙련도 등급 자동 판정 ----------
   기준: 부족원의 '직업 최고 숙련도(최대 숙련도)' 값
   ≤100 교체필수(빨강) · 101~110 교체필요(주황) · 111~119 교체검토(노랑) · ≥120 영입완료(초록)
   값이 비어 있거나 0이면 등급을 매기지 않고 '숙련도 미입력'으로 중립 표시합니다. */
export const PROFICIENCY_GRADES = [
  { tier: 'must', label: '교체필수', min: 1, max: 100, range: '100 이하', colorClass: 'grade-red', color: '#d9534f' },
  { tier: 'need', label: '교체필요', min: 101, max: 110, range: '101~110', colorClass: 'grade-orange', color: '#e67e22' },
  { tier: 'review', label: '교체검토', min: 111, max: 119, range: '111~119', colorClass: 'grade-yellow', color: '#eab308' },
  { tier: 'done', label: '영입완료', min: 120, max: Infinity, range: '120 이상', colorClass: 'grade-green', color: '#4caf75' }
];

/** 교체를 서둘러야 하는 등급 */
export const REPLACE_TIERS = ['must', 'need'];

/** 필터·정렬에 쓰는 등급 이름 (교체가 급한 순서) */
export const GRADE_LABELS = PROFICIENCY_GRADES.map((g) => g.label);

export const NO_GRADE_LABEL = '숙련도 미입력';

/**
 * 최대 숙련도 입력값 → 숫자 (못 읽으면 null).
 * '103', ' 103점 ', '100/103' 같은 표기도 받아들이며, '/'가 있으면 뒤쪽(최대) 값을 씁니다.
 * 비어 있거나 0 이하이면 아직 입력하지 않은 것으로 봅니다.
 */
export function parseProficiency(value) {
  if (value === null || value === undefined) { return null; }
  const raw = String(value).trim();
  if (!raw) { return null; }
  const parts = raw.split('/');
  let m = parts[parts.length - 1].match(/\d+(?:\.\d+)?/);
  if (!m) { m = raw.match(/\d+(?:\.\d+)?/); }
  if (!m) { return null; }
  const n = Number(m[0]);
  if (!isFinite(n) || n <= 0) { return null; }
  return Math.round(n);
}

/** 최대 숙련도 → { label, tier, range, colorClass, color, value, hasValue, needsReplace } */
export function getProficiencyGrade(maxProficiency) {
  const n = parseProficiency(maxProficiency);
  if (n === null) {
    return {
      label: NO_GRADE_LABEL, tier: 'none', range: '', colorClass: 'grade-none', color: '#8b93a7',
      value: null, hasValue: false, needsReplace: false
    };
  }
  const g = PROFICIENCY_GRADES.find((x) => n >= x.min && n <= x.max) || PROFICIENCY_GRADES[PROFICIENCY_GRADES.length - 1];
  return {
    label: g.label, tier: g.tier, range: g.range, colorClass: g.colorClass, color: g.color,
    value: n, hasValue: true, needsReplace: REPLACE_TIERS.includes(g.tier)
  };
}

/** 부족원의 최대 숙련도 값 (skillMax, 예전/외부 데이터의 maxProficiency 모두 허용) */
export function memberProficiency(m) {
  if (!m) { return ''; }
  const v = (m.skillMax !== undefined && m.skillMax !== null && String(m.skillMax).trim() !== '')
    ? m.skillMax
    : m.maxProficiency;
  return v === null || v === undefined ? '' : v;
}

/** 부족원 → 등급 */
export function getMemberGrade(m) {
  return getProficiencyGrade(memberProficiency(m));
}

/** 자동 등급 또는 수동 표시 중 하나라도 교체 대상이면 true */
export function needsReplacement(m) {
  if (!m) { return false; }
  return !!m.replaceNeeded || getMemberGrade(m).needsReplace;
}

/** 정렬용 순위: 교체가 급한 순서 (미입력은 맨 뒤) */
export function gradeRank(m) {
  const tier = getMemberGrade(m).tier;
  const i = PROFICIENCY_GRADES.findIndex((g) => g.tier === tier);
  return i === -1 ? PROFICIENCY_GRADES.length : i;
}

/** '100/103' 처럼 보여 줄 숙련도 문자열 */
export function proficiencyText(m) {
  const cur = m && m.skill !== undefined && m.skill !== null ? String(m.skill).trim() : '';
  const max = memberProficiency(m) !== '' ? String(memberProficiency(m)).trim() : '';
  if (cur && max) { return `${cur}/${max}`; }
  return max || cur || '-';
}

/**
 * 담당직업(숙련도) 표시 이름.
 * - 새 데이터: profession 키 → 게임 숙련도 이름 ('도요')
 * - 직접 입력: jobTitle
 * - 예전 데이터: profession이 없으면 비워 두고 카드에서 직업 구분으로 대신 보여 줍니다.
 */
export function professionLabel(m) {
  if (!m) { return ''; }
  const custom = String(m.jobTitle || '').trim();
  if (m.profession === 'custom') { return custom; }
  const p = findProfession(m.profession);
  if (p) { return p.custom ? custom : professionTitle(p); }
  return custom;
}

/** 부족원의 담당업무 — 새 duty, 없으면 예전 '담당 시설' 값을 그대로 보여 줍니다. */
export function memberDuty(m) {
  if (!m) { return ''; }
  const duty = String(m.duty || '').trim();
  if (duty) { return duty; }
  return String(m.facility || '').trim();
}

/** 담당직업의 직업 구분(생산직/생활직/전투직/예비) */
export function professionRole(key) {
  const p = findProfession(key);
  return p ? p.role : '';
}

/** 직업순 정렬용 순위 (숙련도 목록 순서, 미지정은 맨 뒤) */
export function professionRank(m) {
  const i = PROFICIENCIES.findIndex((p) => p.key === (m && m.profession));
  return i === -1 ? PROFICIENCIES.length : i;
}

/** 색 배지 HTML */
export function gradeBadge(grade) {
  const g = grade || getProficiencyGrade(null);
  const title = g.hasValue
    ? `최대 숙련도 ${g.value} → ${g.label} (${g.range})`
    : '최대 숙련도를 입력하면 등급이 자동으로 정해집니다';
  return `<span class="grade-badge ${esc(g.colorClass)}" title="${esc(title)}" data-grade="${esc(g.label)}">${esc(g.label)}</span>`;
}

/** 부족원 배지 HTML */
export function memberGradeBadge(m) {
  return gradeBadge(getMemberGrade(m));
}

/** 전체 등록 부족원의 등급별 인원 */
export function gradeCounts(state) {
  const out = { must: 0, need: 0, review: 0, done: 0, none: 0, total: 0, replace: 0 };
  allMembers(state).forEach((m) => {
    const g = getMemberGrade(m);
    out[g.tier] = (out[g.tier] || 0) + 1;
    out.total += 1;
    if (needsReplacement(m)) { out.replace += 1; }
  });
  return out;
}

/** 교체가 필요한 부족원 목록 (급한 순) */
export function replaceTargets(state) {
  return allMembers(state)
    .filter((m) => needsReplacement(m))
    .sort((a, b) => (gradeRank(a) - gradeRank(b)) || String(a.name).localeCompare(String(b.name), 'ko'));
}

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
    replaceCount: allMembers(state).filter((m) => needsReplacement(m)).length
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
