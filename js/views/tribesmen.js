/* 부족원 — 정원·직업 목표·명단 관리 */
import { ROLE_TONES, PROFICIENCY_GROUPS, findProfession, professionTitle, professionSearchText } from '../data.js';
import {
  capacityEditorHTML, tribeStats, paintCapacity, setCapacity, members as recruitedMembers,
  PROFICIENCY_GRADES, NO_GRADE_LABEL, getProficiencyGrade, getMemberGrade, memberGradeBadge,
  needsReplacement, gradeRank, proficiencyText, gradeCounts, replaceTargets, gradeBadge, memberProficiency,
  professionLabel, memberDuty, professionRank
} from '../tribes-util.js';
import { buildTribes } from '../ai-io.js';
import { progressBar, pct, esc, uid, copyText, clampNum, debounce } from '../util.js';
import { field, textInput, textArea, selectInput, openModal, confirmAction, toast } from '../ui.js';

const uiState = {
  query: '',
  role: '전체',
  grade: '전체',
  sort: '직업순',
  onlyReplace: false
};

const GRADE_FILTERS = ['전체'].concat(PROFICIENCY_GRADES.map((g) => g.label), ['미입력']);

function memberMatchesGrade(m, filter) {
  if (filter === '전체') { return true; }
  const g = getMemberGrade(m);
  if (filter === '미입력') { return !g.hasValue; }
  return g.label === filter;
}

const SORTS = ['직업순', '이름순', '숙련도순', '최대 숙련도순', '교체 필요 우선'];
const GENDERS = ['남', '여', '미입력'];
const TONES = [
  { value: 'prod', label: '생산직 색 (호박)' },
  { value: 'life', label: '생활직 색 (청록)' },
  { value: 'combat', label: '전투직 색 (진홍)' },
  { value: 'spare', label: '예비 색 (회청)' }
];

function sortMembers(list) {
  const arr = list.slice();
  if (uiState.sort === '이름순') { arr.sort((a, b) => a.name.localeCompare(b.name, 'ko')); }
  else if (uiState.sort === '숙련도순') { arr.sort((a, b) => Number(b.skill) - Number(a.skill)); }
  else if (uiState.sort === '최대 숙련도순') { arr.sort((a, b) => Number(b.skillMax) - Number(a.skillMax)); }
  else if (uiState.sort === '교체 필요 우선') {
    arr.sort((a, b) => (gradeRank(a) - gradeRank(b))
      || (Number(needsReplacement(b)) - Number(needsReplacement(a)))
      || String(a.name).localeCompare(String(b.name), 'ko'));
  }
  else {
    const order = {};
    (state0 ? state0.tribes.roles : []).forEach((r, i) => { order[r.name] = i; });
    arr.sort((a, b) => (order[a.role] || 0) - (order[b.role] || 0)
      || (professionRank(a) - professionRank(b))
      || String(a.name).localeCompare(String(b.name), 'ko'));
  }
  return arr;
}

let state0 = null;

const tribesmen = {
  title: '부족원',

  sub(ctx, state) {
    const st = tribeStats(state);
    return `정원 ${st.capacity}명 · 현재 ${st.current}명 · 잔여 ${st.remaining}자리`;
  },

  render(ctx, state) {
    state0 = state;
    const st = tribeStats(state);
    const gc = gradeCounts(state);
    const replaceList = replaceTargets(state);
    const all = state.tribes.members;
    const query = uiState.query.trim().toLowerCase();
    let list = all.filter((m) => {
      if (uiState.role !== '전체' && m.role !== uiState.role) { return false; }
      if (!memberMatchesGrade(m, uiState.grade)) { return false; }
      if (uiState.onlyReplace && !needsReplacement(m)) { return false; }
      if (!query) { return true; }
      return [m.name, m.goodTraits, m.badTraits, m.skill, m.skillMax, m.facility, m.duty, m.note, m.combatSkill, m.role, m.jobTitle, professionLabel(m), getMemberGrade(m).label]
        .join(' ').toLowerCase().includes(query);
    });
    list = sortMembers(list);

    return `
    <div class="card">
      ${capacityEditorHTML(state, { id: 'tribe-capacity-box', inputId: 'tribe-capacity-input' })}
      <div class="btn-row mt12">
        <button type="button" class="btn small primary" data-act="add-member">+ 부족원 등록</button>
        <button type="button" class="btn small" data-act="copy-tribes">AI 복사</button>
      </div>
    </div>

    <div class="card" data-grade-summary>
      <div class="card-head">
        <div class="card-title-row"><h2>숙련도 등급</h2><span class="sub">최대 숙련도 자동 판정</span></div>
        ${gc.replace
          ? `<span class="chip red" data-replace-count>교체 대상 ${gc.replace}명</span>`
          : `<span class="chip green" data-replace-count>교체 대상 없음</span>`}
      </div>
      <div class="grade-grid">
        ${PROFICIENCY_GRADES.map((g) => `
          <button type="button" class="grade-cell ${g.colorClass}${uiState.grade === g.label ? ' on' : ''}"
                  data-act="filter-grade" data-grade="${esc(g.label)}" aria-pressed="${uiState.grade === g.label}"
                  aria-label="${esc(g.label)} ${gc[g.tier] || 0}명만 보기">
            <span class="g-count">${gc[g.tier] || 0}</span>
            <span class="g-label">${esc(g.label)}</span>
            <span class="g-range">${esc(g.range)}</span>
          </button>`).join('')}
        <button type="button" class="grade-cell grade-none${uiState.grade === '미입력' ? ' on' : ''}"
                data-act="filter-grade" data-grade="미입력" aria-pressed="${uiState.grade === '미입력'}"
                aria-label="숙련도 미입력 ${gc.none}명만 보기">
          <span class="g-count">${gc.none}</span>
          <span class="g-label">미입력</span>
          <span class="g-range">등급 없음</span>
        </button>
      </div>
      <p class="hint">최대 숙련도 기준 — 100 이하 <b>교체필수</b> · 101~110 <b>교체필요</b> · 111~119 <b>교체검토</b> · 120 이상 <b>영입완료</b>. 칸을 누르면 그 등급만 보입니다.</p>
      ${replaceList.length ? `<p class="hint" data-replace-list>교체 우선: ${replaceList.slice(0, 5).map((m) => `${esc(m.name)}(${esc(getMemberGrade(m).label)} ${esc(proficiencyText(m))})`).join(' · ')}${replaceList.length > 5 ? ` 외 ${replaceList.length - 5}명` : ''}</p>` : ''}
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title-row"><h2>직업별 목표</h2><span class="sub">합계 ${st.targetSum}명</span></div>
        <button type="button" class="btn small" data-act="add-role">+ 직업 추가</button>
      </div>
      ${st.roles.map((r) => `
        <div class="role-bar">
          <div class="role-bar-head">
            <span class="nm"><span class="chip ${esc(r.tone)}">${esc(r.name)}</span>
              <span class="mono">${r.count} / ${r.target}</span>
              ${r.short ? `<span class="chip red">${r.short}명 부족</span>` : '<span class="chip green">충족</span>'}
            </span>
            <span class="flex">
              <input class="role-target-edit" type="number" min="0" max="99" value="${r.target}"
                     data-field="role-target" data-role-id="${esc(r.id)}" aria-label="${esc(r.name)} 목표 인원">
              <button type="button" class="icon-btn" data-act="edit-role" data-id="${esc(r.id)}" aria-label="직업 수정">✎</button>
              <button type="button" class="icon-btn" data-act="delete-role" data-id="${esc(r.id)}" aria-label="직업 삭제">🗑</button>
            </span>
          </div>
          <div class="bar tone-${r.count >= r.target ? 'green' : ''}">
            <div class="bar-track"><div class="bar-fill" style="width:${pct(r.count, r.target)}%"></div></div>
          </div>
        </div>`).join('')}
      ${st.targetGap !== 0 ? `<p class="hint">직업별 목표 합계가 정원과 ${Math.abs(st.targetGap)}명 ${st.targetGap > 0 ? '많습니다' : '적습니다'}.</p>` : ''}
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title-row"><h2>영입 체크리스트</h2></div>
        <span class="chip ${st.current >= st.capacity ? 'green' : 'gold'}">${st.current}/${st.capacity} · ${st.percent}%</span>
      </div>
      ${progressBar(st.percent, { tone: st.current >= st.capacity ? 'green' : '', label: st.shortRoles.length ? `${st.shortRoles.map((r) => r.name + ' ' + r.short).join(' · ')} 부족` : '목표 충족' })}
      <div class="tribe-summary mt12">
        ${st.roles.map((r) => `<span class="role-pill ${r.short ? 'short' : ''}">
          <span class="chip ${esc(r.tone)}" style="border:0;background:none;padding:0">${esc(r.name)}</span>
          <span class="cnt">${r.count}/${r.target}</span>
          ${r.short ? '<span class="warn-dot"></span>' : ''}
        </span>`).join('')}
      </div>
    </div>

    <div class="toolbar">
      <input class="search-input grow" type="search" placeholder="이름·담당직업·숙련도·담당업무 검색" value="${esc(uiState.query)}" data-live="member-search" aria-label="부족원 검색">
      <select class="search-input" style="width:auto" data-field="role-filter" aria-label="직업 필터">
        <option value="전체">전체 직업</option>
        ${state.tribes.roles.map((r) => `<option value="${esc(r.name)}"${uiState.role === r.name ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}
      </select>
      <select class="search-input" style="width:auto" data-field="grade-filter" aria-label="숙련도 등급 필터">
        ${GRADE_FILTERS.map((g) => `<option value="${esc(g)}"${uiState.grade === g ? ' selected' : ''}>${g === '전체' ? '전체 등급' : g === '미입력' ? NO_GRADE_LABEL : g}</option>`).join('')}
      </select>
      <select class="search-input" style="width:auto" data-field="sort" aria-label="정렬">
        ${SORTS.map((s) => `<option value="${esc(s)}"${uiState.sort === s ? ' selected' : ''}>${esc(s)}</option>`).join('')}
      </select>
      <label class="check-row" style="min-height:40px"><input type="checkbox" data-field="only-replace" ${uiState.onlyReplace ? 'checked' : ''}><span>교체 대상만 (자동 포함)</span></label>
    </div>

    <div class="list" id="member-list">
      ${list.length ? list.map((m) => memberCard(m, state)).join('') : `<div class="empty">
        <p class="empty-main">${all.length ? '조건에 맞는 부족원이 없습니다' : '아직 등록된 부족원이 없습니다'}</p>
        <p class="empty-sub">+ 부족원 등록으로 담당직업(숙련도)을 고르면 담당업무가 자동으로 채워집니다. 이름·숙련도·특성도 함께 기록해 보세요.</p>
      </div>`}
    </div>
    <p class="hint">정원 ${st.capacity}명 중 ${st.current}명 등록 · 교체 대상 ${st.replaceCount}명(자동 등급 포함) · 영입 여부를 끄면 명단에는 남지만 집계에서 빠집니다.</p>`;
  },

  actions: {
    'capacity-inc'(el, ctx) {
      const box = el.closest('[data-capacity-box]');
      const input = box && box.querySelector('.capacity-input');
      if (input) { input.value = setCapacity(ctx.state, ctx.state.tribes.capacity + 1); }
      ctx.commit();
    },
    'capacity-dec'(el, ctx) {
      const box = el.closest('[data-capacity-box]');
      const input = box && box.querySelector('.capacity-input');
      if (input) { input.value = setCapacity(ctx.state, ctx.state.tribes.capacity - 1); }
      ctx.commit();
    },
    'add-member'(el, ctx) { editMember(null, ctx); },
    'edit-member'(el, ctx) {
      const m = ctx.state.tribes.members.find((x) => x.id === el.getAttribute('data-id'));
      if (m) { editMember(m, ctx); }
    },
    'delete-member'(el, ctx) {
      const m = ctx.state.tribes.members.find((x) => x.id === el.getAttribute('data-id'));
      if (!m) { return; }
      confirmAction(`"${m.name}" 부족원을 명단에서 삭제할까요?`, { title: '부족원 삭제', confirmLabel: '삭제', danger: true })
        .then((ok) => {
          if (!ok) { return; }
          ctx.state.tribes.members = ctx.state.tribes.members.filter((x) => x.id !== m.id);
          ctx.commit('삭제했습니다');
        });
    },
    'toggle-recruited'(el, ctx) {
      const m = ctx.state.tribes.members.find((x) => x.id === el.getAttribute('data-id'));
      if (!m) { return; }
      m.recruited = !m.recruited;
      ctx.commit(m.recruited ? '영입 완료로 표시했습니다' : '미영입으로 표시했습니다');
    },
    'toggle-replace'(el, ctx) {
      const m = ctx.state.tribes.members.find((x) => x.id === el.getAttribute('data-id'));
      if (!m) { return; }
      m.replaceNeeded = !m.replaceNeeded;
      ctx.commit(m.replaceNeeded ? '교체 대상으로 표시했습니다' : '교체 표시를 해제했습니다');
    },
    'add-role'(el, ctx) { editRole(null, ctx); },
    'edit-role'(el, ctx) {
      const r = ctx.state.tribes.roles.find((x) => x.id === el.getAttribute('data-id'));
      if (r) { editRole(r, ctx); }
    },
    'filter-grade'(el, ctx) {
      const g = el.getAttribute('data-grade') || '전체';
      uiState.grade = uiState.grade === g ? '전체' : g;
      ctx.render();
    },
    'delete-role'(el, ctx) {
      const r = ctx.state.tribes.roles.find((x) => x.id === el.getAttribute('data-id'));
      if (!r) { return; }
      if (ctx.state.tribes.roles.length <= 1) { toast('직업은 최소 1개가 필요합니다', true); return; }
      const used = ctx.state.tribes.members.filter((m) => m.role === r.name).length;
      confirmAction(`"${r.name}" 직업을 삭제할까요?${used ? `\n이 직업의 부족원 ${used}명은 첫 번째 직업으로 옮겨집니다.` : ''}`,
        { title: '직업 삭제', confirmLabel: '삭제', danger: true }).then((ok) => {
        if (!ok) { return; }
        ctx.state.tribes.roles = ctx.state.tribes.roles.filter((x) => x.id !== r.id);
        const fallback = ctx.state.tribes.roles[0].name;
        ctx.state.tribes.members.forEach((m) => { if (m.role === r.name) { m.role = fallback; } });
        if (uiState.role === r.name) { uiState.role = '전체'; }
        ctx.commit('직업을 삭제했습니다');
      });
    },
    async 'copy-tribes'(el, ctx) {
      const ok = await copyText(buildTribes(ctx.state));
      toast(ok ? '부족원 현황을 복사했습니다' : '복사하지 못했습니다', !ok);
    }
  },

  fields: {
    capacity(el, ctx) {
      const n = setCapacity(ctx.state, el.value);
      el.value = n;
      ctx.commit();
    },
    'role-target'(el, ctx) {
      const role = ctx.state.tribes.roles.find((r) => r.id === el.getAttribute('data-role-id'));
      if (!role) { return; }
      role.target = clampNum(el.value, 0, 99);
      ctx.commit();
    },
    'role-filter'(el, ctx) { uiState.role = el.value; ctx.render(); },
    'grade-filter'(el, ctx) { uiState.grade = el.value; ctx.render(); },
    sort(el, ctx) { uiState.sort = el.value; ctx.render(); },
    'only-replace'(el, ctx) { uiState.onlyReplace = el.checked; ctx.render(); }
  },

  live: {
    capacity(el, ctx) {
      const raw = Number(el.value);
      if (!isFinite(raw) || raw < 1 || raw > 99) { return; }
      setCapacity(ctx.state, raw);
      paintCapacity(el.closest('[data-capacity-box]'), ctx.state);
      saveSoon(ctx);
    },
    'member-search': debounce((el, ctx) => {
      uiState.query = el.value;
      const q = el.value.trim().toLowerCase();
      document.querySelectorAll('#member-list [data-member-card]').forEach((card) => {
        const hay = card.getAttribute('data-search') || '';
        card.style.display = !q || hay.includes(q) ? '' : 'none';
      });
    }, 120)
  }
};

const saveSoon = debounce((ctx) => { ctx.save({ silent: true }); }, 400);

function memberCard(m, state) {
  const tone = (state.tribes.roles.find((r) => r.name === m.role) || { tone: 'spare' }).tone;
  const g = getMemberGrade(m);
  const prof = proficiencyText(m);
  const job = professionLabel(m);
  const duty = memberDuty(m);
  const search = [m.name, m.goodTraits, m.badTraits, m.skill, m.skillMax, m.facility, m.duty, m.note, m.combatSkill, m.role, m.jobTitle, job, duty, g.label,
    professionSearchText(findProfession(m.profession))].join(' ').toLowerCase();
  return `<div class="member-card member-grade-${esc(g.tier)}" data-member-card data-grade="${esc(g.label)}" data-search="${esc(search)}">
    <div class="member-top">
      <div class="grow">
        <div class="member-name">${esc(m.name)}${job ? `<span class="member-job">· ${esc(job)}</span>` : ''}
          <span class="chip ${esc(tone)}">${esc(m.role)}</span>
          ${memberGradeBadge(m)}
          ${m.recruited ? '' : '<span class="chip red">미영입</span>'}
          ${m.replaceNeeded ? '<span class="chip gold">수동 교체 표시</span>' : ''}
        </div>
        <div class="member-meta">
          <span>성별 <b>${esc(m.gender)}</b></span>
          <span>현재/최대 숙련도 <b data-prof-text>${esc(prof)}</b></span>
        </div>
        ${duty ? `<p class="row-note member-duty"><span class="duty-label">담당업무</span> ${esc(duty)}</p>` : ''}
        ${m.goodTraits ? `<p class="row-note">＋ ${esc(m.goodTraits)}</p>` : ''}
        ${m.badTraits ? `<p class="row-note">− ${esc(m.badTraits)}</p>` : ''}
        ${m.combatSkill ? `<p class="row-note">전투: ${esc(m.combatSkill)}</p>` : ''}
        ${m.note ? `<p class="row-note">${esc(m.note)}</p>` : ''}
      </div>
      <div class="row-actions">
        <button type="button" class="btn icon small" data-act="edit-member" data-id="${esc(m.id)}" aria-label="수정">✎</button>
        <button type="button" class="btn icon small" data-act="delete-member" data-id="${esc(m.id)}" aria-label="삭제">🗑</button>
      </div>
    </div>
    <div class="member-flags">
      <button type="button" class="btn small ${m.recruited ? (g.tier === 'none' ? 'primary' : 'recruited-on ' + g.colorClass) : ''}" data-act="toggle-recruited" data-id="${esc(m.id)}">${m.recruited ? '영입 완료' : '미영입'}</button>
      <button type="button" class="btn small ${m.replaceNeeded ? 'danger' : ''}" data-act="toggle-replace" data-id="${esc(m.id)}">${m.replaceNeeded ? '교체 필요' : '교체 표시'}</button>
    </div>
  </div>`;
}

function memberProficiencyValue(m) {
  return memberProficiency(m);
}

function gradeNote(g) {
  if (!g || !g.hasValue) { return '최대 숙련도를 입력하면 등급이 자동으로 표시됩니다.'; }
  return `최대 숙련도 ${g.value} → ${g.label} (${g.range})`;
}

/* ---------- 담당직업(숙련도) 선택 UI ---------- */
function professionSelectHTML(value) {
  const groups = PROFICIENCY_GROUPS.map((g) => `
    <optgroup label="${esc(g.label)} · ${esc(g.hint)}">
      ${g.items.map((it) => `<option value="${esc(it.key)}"${it.key === value ? ' selected' : ''}>${esc(professionTitle(it))}</option>`).join('')}
    </optgroup>`).join('');
  /* 지금 목록에 없는 예전 기록은 숨기지 않고 그대로 보여 줘서, 고치기 전까지 값이 남아 있게 합니다. */
  const cur = findProfession(value);
  const legacyGroup = (cur && cur.legacy)
    ? `<optgroup label="예전 기록 (지금 숙련도 목록에 없음)">
        <option value="${esc(cur.key)}" selected>${esc(cur.name)} · 예전 기록</option>
      </optgroup>`
    : '';
  return `<select id="mb-profession" aria-describedby="mb-prof-hint">
    <option value=""${!value ? ' selected' : ''}>선택 안 함 (미지정)</option>
    ${legacyGroup}
    ${groups}
  </select>`;
}

function professionPreviewHTML() {
  return `
  <div class="prof-preview" data-prof-preview>
    <div class="pp-top">
      <span class="chip spare" data-pp-group>미지정</span>
      <b class="pp-name" data-pp-name>담당직업을 고르면 담당업무가 자동으로 채워집니다</b>
      <span class="pp-en" data-pp-en></span>
    </div>
    <div class="pp-duty"><span class="pp-label">담당업무 (자동 연결)</span><span data-pp-duty>—</span></div>
    <p class="pp-hint" id="mb-prof-hint" data-pp-hint>게임 숙련도 26종 중에서 고르면 담당업무와 직업 구분(생산직/생활직/전투직/예비)이 함께 맞춰집니다.</p>
  </div>`;
}

function editMember(member, ctx) {
  const isNew = !member;
  const roles = ctx.state.tribes.roles;
  const m = member || {
    name: '', role: roles[0] ? roles[0].name : '생산직', gender: '미입력', recruited: true,
    skill: '', skillMax: '', goodTraits: '', badTraits: '', combatSkill: '',
    profession: '', jobTitle: '', facility: '', duty: '',
    replaceNeeded: false, note: ''
  };
  /* 예전 데이터(담당 시설만 적힌 경우)도 잃지 않도록 담당업무로 이어받습니다. */
  const legacyFacility = String(m.facility || '').trim();
  const dutyValue = String(m.duty || '').trim() || legacyFacility;
  openModal({
    title: isNew ? '부족원 등록' : '부족원 수정',
    wide: true,
    bodyHTML:
      `<div class="field-row">
        <div class="field"><label for="mb-name">이름</label><input id="mb-name" type="text" value="${esc(m.name)}" maxlength="60" placeholder="부족원 이름"></div>
        <div class="field"><label for="mb-profession">담당직업 (숙련도)</label>${professionSelectHTML(m.profession || '')}</div>
      </div>
      ${professionPreviewHTML()}
      <div class="field"><label for="mb-duty">담당업무</label>${textArea('mb-duty', dutyValue, 2, 'placeholder="예: 주괴 생산 · 숯·유리·석회 가마 제련"')}
        <p class="hint">담당직업을 고르면 게임에서 하는 일이 자동으로 들어갑니다. 그대로 써도 되고, 우리 거점 상황에 맞게 고쳐도 됩니다.</p>
      </div>
      ${legacyFacility && !String(m.duty || '').trim()
        ? `<p class="hint">예전에 적어 둔 '담당 시설'(${esc(legacyFacility)})을 담당업무로 옮겨 두었습니다. 저장해도 원래 기록은 지워지지 않습니다.</p>`
        : ''}
      <div class="field-row">
        <div class="field"><label for="mb-role">직업 구분</label>${selectInput('mb-role', roles.map((r) => r.name), m.role)}</div>
        <div class="field"><label for="mb-gender">성별</label>${selectInput('mb-gender', GENDERS, m.gender)}</div>
      </div>
      <div class="field" data-custom-field hidden><label for="mb-custom-job">직접 입력 직업명</label><input id="mb-custom-job" type="text" maxlength="40" value="${esc(m.profession === 'custom' ? m.jobTitle : '')}" placeholder="예: 가마 담당"></div>
      <div class="field-row">
        <div class="field"><label for="mb-skill">현재 숙련도</label><input id="mb-skill" type="text" inputmode="numeric" value="${esc(m.skill)}" placeholder="예: 100"></div>
        <div class="field"><label for="mb-skillmax">직업 최고 숙련도(최대 숙련도)</label><input id="mb-skillmax" type="text" inputmode="numeric" value="${esc(memberProficiencyValue(m))}" placeholder="예: 103"></div>
      </div>
      <div class="grade-preview" data-grade-preview>
        <span class="gp-title">자동 등급</span>
        <span class="gp-badge">${gradeBadge(getProficiencyGrade(memberProficiencyValue(m)))}</span>
        <span class="gp-note">${esc(gradeNote(getProficiencyGrade(memberProficiencyValue(m))))}</span>
      </div>
      <p class="hint">등급 기준 — 100 이하 교체필수 · 101~110 교체필요 · 111~119 교체검토 · 120 이상 영입완료. 비워 두면 등급을 매기지 않습니다.</p>
      ${field('긍정 특성', textInput('mb-good', m.goodTraits, 'placeholder="예: 손재주, 야간 작업"'), '쉼표로 구분해도 됩니다.')}
      ${field('부정 특성', textInput('mb-bad', m.badTraits, 'placeholder="예: 겁이 많음"'))}
      <div class="field"><label for="mb-combat">전투 스킬</label><input id="mb-combat" type="text" value="${esc(m.combatSkill)}" placeholder="예: 도끼 B, 활 C"></div>
      <label class="switch-row"><input type="checkbox" id="mb-recruited" ${m.recruited ? 'checked' : ''}><span>영입 완료 (체크를 끄면 집계에서 제외)</span></label>
      <label class="switch-row"><input type="checkbox" id="mb-replace" ${m.replaceNeeded ? 'checked' : ''}><span>교체 대상</span></label>
      ${field('비고', textArea('mb-note', m.note, 2, 'placeholder="자유 메모"'))}
      <p class="form-error" hidden></p>`,
    submitLabel: isNew ? '등록' : '저장',
    onSubmit: (form) => {
      const name = ctx.val(form, 'mb-name');
      if (!name) { throw new Error('이름을 입력해 주세요.'); }
      const profKey = ctx.val(form, 'mb-profession') || '';
      const prof = findProfession(profKey);
      const customName = ctx.val(form, 'mb-custom-job');
      if (profKey === 'custom' && !customName) { throw new Error('직접 입력할 직업명을 적어 주세요.'); }
      const data = {
        name,
        role: ctx.val(form, 'mb-role'),
        gender: ctx.val(form, 'mb-gender') || '미입력',
        recruited: ctx.check(form, 'mb-recruited'),
        skill: ctx.val(form, 'mb-skill'),
        skillMax: ctx.val(form, 'mb-skillmax'),
        goodTraits: ctx.val(form, 'mb-good'),
        badTraits: ctx.val(form, 'mb-bad'),
        combatSkill: ctx.val(form, 'mb-combat'),
        profession: profKey,
        jobTitle: profKey === 'custom' ? customName : '',
        facility: (member && member.facility) || '',
        duty: ctx.val(form, 'mb-duty') || (prof && !prof.custom ? prof.duty : ''),
        replaceNeeded: ctx.check(form, 'mb-replace'),
        note: ctx.val(form, 'mb-note')
      };
      if (isNew) {
        ctx.state.tribes.members.push(Object.assign({ id: uid('mb') }, data));
      } else {
        Object.assign(member, data);
      }
      ctx.commit(isNew ? '부족원을 등록했습니다' : '수정했습니다');
    }
  });

  /* 담당직업(숙련도)을 고르면 담당업무·직업 구분을 자동으로 맞춥니다 */
  const form = document.getElementById('modal-form');
  const profSel = form && form.querySelector('#mb-profession');
  const roleSel = form && form.querySelector('#mb-role');
  const dutyEl = form && form.querySelector('#mb-duty');
  const customField = form && form.querySelector('[data-custom-field]');
  const customEl = form && form.querySelector('#mb-custom-job');
  const profPreview = form && form.querySelector('[data-prof-preview]');
  if (profSel && dutyEl && profPreview) {
    const paintProf = () => {
      const key = profSel.value;
      const p = findProfession(key);
      const isCustom = key === 'custom';
      if (customField) { customField.hidden = !isCustom; }
      profPreview.className = 'prof-preview' + (p ? ' pp-on tone-' + (p.tone || 'spare') : '');
      const groupEl = profPreview.querySelector('[data-pp-group]');
      const nameEl = profPreview.querySelector('[data-pp-name]');
      const enEl = profPreview.querySelector('[data-pp-en]');
      const dutyPrev = profPreview.querySelector('[data-pp-duty]');
      const hintEl = profPreview.querySelector('[data-pp-hint]');
      if (p) {
        if (groupEl) { groupEl.className = 'chip ' + (p.tone || 'spare'); groupEl.textContent = p.groupLabel; }
        if (nameEl) { nameEl.textContent = p.custom ? (customEl.value.trim() || '직접 입력') : professionTitle(p); }
        if (enEl) { enEl.textContent = p.en || ''; }
        if (hintEl) {
          hintEl.textContent = p.custom
            ? '직업 이름과 담당업무를 직접 적습니다. 직업 구분은 그대로 두었습니다.'
            : p.legacy
              ? '지금 숙련도 목록에 없는 예전 기록입니다. 그대로 저장해도 표시되고, 위 목록에서 새 직업을 고르면 바뀝니다.'
              : p.noProf
                ? `직업 구분을 '${p.groupLabel}'(으)로 맞췄습니다 · 전용 숙련도가 없어 최대 숙련도는 비워 두어도 됩니다.`
                : `직업 구분을 '${p.groupLabel}'(으)로 맞췄습니다 · 담당업무는 아래 칸에서 고칠 수 있습니다.`;
        }
        if (p.role && roleSel) { roleSel.value = p.role; }
      } else {
        if (groupEl) { groupEl.className = 'chip spare'; groupEl.textContent = '미지정'; }
        if (nameEl) { nameEl.textContent = '담당직업을 고르면 담당업무가 자동으로 채워집니다'; }
        if (enEl) { enEl.textContent = ''; }
        if (hintEl) { hintEl.textContent = '게임 숙련도 26종 중에서 고르면 담당업무와 직업 구분(생산직/생활직/전투직/예비)이 함께 맞춰집니다.'; }
      }
      /* 담당업무: 비어 있거나 직전 숙련도의 기본값·예전 '담당 시설' 값 그대로면 새 값으로 채우고, 직접 고쳐 쓴 글은 그대로 둡니다. */
      if (p && !p.custom) {
        const prevAuto = String(dutyEl.dataset.auto || '').trim();
        const cur = dutyEl.value.trim();
        if (!cur || cur === prevAuto || (legacyFacility && cur === legacyFacility)) { dutyEl.value = p.duty; }
        dutyEl.dataset.auto = p.duty;
      } else {
        dutyEl.dataset.auto = '';
      }
      if (dutyPrev) {
        dutyPrev.textContent = p
          ? (p.custom ? (dutyEl.value.trim() || '담당업무를 직접 적어 주세요') : p.duty)
          : '—';
      }
      const maxEl = form.querySelector('#mb-skillmax');
      if (maxEl) { maxEl.dispatchEvent(new Event('input')); }
    };
    profSel.addEventListener('change', paintProf);
    if (customEl) {
      customEl.addEventListener('input', () => { if (profSel.value === 'custom') { paintProf(); } });
    }
    dutyEl.addEventListener('input', () => {
      const dutyPrev = profPreview.querySelector('[data-pp-duty]');
      if (dutyPrev && profSel.value === 'custom') { dutyPrev.textContent = dutyEl.value.trim() || '담당업무를 직접 적어 주세요'; }
    });
    paintProf();
  }

  /* 최대 숙련도를 입력하는 동안 등급 배지를 즉시 미리 보기 */
  const maxInput = form && form.querySelector('#mb-skillmax');
  const preview = form && form.querySelector('[data-grade-preview]');
  if (maxInput && preview) {
    const paint = () => {
      const g = getProficiencyGrade(maxInput.value);
      const cur = findProfession(profSel ? profSel.value : '');
      const badge = preview.querySelector('.gp-badge');
      const note = preview.querySelector('.gp-note');
      if (badge) { badge.innerHTML = gradeBadge(g); }
      if (note) {
        note.textContent = (!g.hasValue && cur && cur.noProf)
          ? '전용 숙련도 없는 직업 — 비워 두면 등급을 매기지 않습니다.'
          : gradeNote(g);
      }
      preview.className = 'grade-preview grade-preview-' + g.tier;
    };
    maxInput.addEventListener('input', paint);
    maxInput.addEventListener('change', paint);
    paint();
    /* 이미 정해진 직업(예: 전용 숙련도 없는 원정 사냥)이면 등급 안내도 그에 맞춰 다시 칠합니다. */
    if (profSel) { profSel.dispatchEvent(new Event('change')); }
  }
}

function editRole(role, ctx) {
  const isNew = !role;
  const r = role || { name: '', target: 1, tone: 'spare' };
  openModal({
    title: isNew ? '직업 추가' : '직업 수정',
    bodyHTML:
      `${field('직업 이름', textInput('rl-name', r.name, 'placeholder="예: 채집직" maxlength="40"'))}
      ${field('목표 인원', `<input id="rl-target" type="number" min="0" max="99" value="${r.target}">`)}
      <div class="field"><label for="rl-tone">색상</label>${selectInput('rl-tone', TONES, r.tone)}</div>
      <p class="form-error" hidden></p>`,
    submitLabel: isNew ? '추가' : '저장',
    onSubmit: (form) => {
      const name = ctx.val(form, 'rl-name');
      if (!name) { throw new Error('직업 이름을 입력해 주세요.'); }
      const dup = ctx.state.tribes.roles.some((x) => x.name === name && (!role || x.id !== role.id));
      if (dup) { throw new Error('이미 같은 이름의 직업이 있습니다.'); }
      const target = clampNum(ctx.val(form, 'rl-target'), 0, 99);
      const tone = ctx.val(form, 'rl-tone');
      if (isNew) {
        ctx.state.tribes.roles.push({ id: uid('role'), name, target, tone });
      } else {
        const oldName = role.name;
        role.name = name;
        role.target = target;
        role.tone = tone;
        ctx.state.tribes.members.forEach((m) => { if (m.role === oldName) { m.role = name; } });
      }
      ctx.commit(isNew ? '직업을 추가했습니다' : '직업을 수정했습니다');
    }
  });
}

export default tribesmen;
