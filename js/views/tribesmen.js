/* 부족원 — 정원·직업 목표·명단 관리 */
import { ROLE_TONES } from '../data.js';
import { capacityEditorHTML, tribeStats, paintCapacity, setCapacity, members as recruitedMembers } from '../tribes-util.js';
import { buildTribes } from '../ai-io.js';
import { progressBar, pct, esc, uid, copyText, clampNum, debounce } from '../util.js';
import { field, textInput, textArea, selectInput, openModal, confirmAction, toast } from '../ui.js';

const uiState = {
  query: '',
  role: '전체',
  sort: '직업순',
  onlyReplace: false
};

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
  else if (uiState.sort === '교체 필요 우선') { arr.sort((a, b) => Number(b.replaceNeeded) - Number(a.replaceNeeded)); }
  else {
    const order = {};
    (state0 ? state0.tribes.roles : []).forEach((r, i) => { order[r.name] = i; });
    arr.sort((a, b) => (order[a.role] || 0) - (order[b.role] || 0));
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
    const all = state.tribes.members;
    const query = uiState.query.trim().toLowerCase();
    let list = all.filter((m) => {
      if (uiState.role !== '전체' && m.role !== uiState.role) { return false; }
      if (uiState.onlyReplace && !m.replaceNeeded) { return false; }
      if (!query) { return true; }
      return [m.name, m.goodTraits, m.badTraits, m.skill, m.skillMax, m.facility, m.duty, m.note, m.combatSkill]
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
      <input class="search-input grow" type="search" placeholder="이름·특성·숙련도·담당 검색" value="${esc(uiState.query)}" data-live="member-search" aria-label="부족원 검색">
      <select class="search-input" style="width:auto" data-field="role-filter" aria-label="직업 필터">
        <option value="전체">전체 직업</option>
        ${state.tribes.roles.map((r) => `<option value="${esc(r.name)}"${uiState.role === r.name ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}
      </select>
      <select class="search-input" style="width:auto" data-field="sort" aria-label="정렬">
        ${SORTS.map((s) => `<option value="${esc(s)}"${uiState.sort === s ? ' selected' : ''}>${esc(s)}</option>`).join('')}
      </select>
      <label class="check-row" style="min-height:40px"><input type="checkbox" data-field="only-replace" ${uiState.onlyReplace ? 'checked' : ''}><span>교체 대상만</span></label>
    </div>

    <div class="list" id="member-list">
      ${list.length ? list.map((m) => memberCard(m, state)).join('') : `<div class="empty">
        <p class="empty-main">${all.length ? '조건에 맞는 부족원이 없습니다' : '아직 등록된 부족원이 없습니다'}</p>
        <p class="empty-sub">+ 부족원 등록으로 이름·직업·숙련도·특성을 기록하면 정원 대비 영입률이 채워집니다.</p>
      </div>`}
    </div>
    <p class="hint">정원 ${st.capacity}명 중 ${st.current}명 등록 · 교체 대상 ${st.replaceCount}명 · 영입 여부를 끄면 명단에는 남지만 집계에서 빠집니다.</p>`;
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
  const search = [m.name, m.goodTraits, m.badTraits, m.skill, m.skillMax, m.facility, m.duty, m.note, m.combatSkill, m.role].join(' ').toLowerCase();
  return `<div class="member-card" data-member-card data-search="${esc(search)}">
    <div class="member-top">
      <div class="grow">
        <div class="member-name">${esc(m.name)}
          <span class="chip ${esc(tone)}">${esc(m.role)}</span>
          ${m.recruited ? '' : '<span class="chip red">미영입</span>'}
          ${m.replaceNeeded ? '<span class="chip gold">교체 대상</span>' : ''}
        </div>
        <div class="member-meta">
          <span>성별 <b>${esc(m.gender)}</b></span>
          <span>숙련도 <b>${esc(m.skill || '-')}${m.skillMax ? ' / ' + esc(m.skillMax) : ''}</b></span>
          ${m.facility ? `<span>담당 시설 <b>${esc(m.facility)}</b></span>` : ''}
          ${m.duty ? `<span>담당 업무 <b>${esc(m.duty)}</b></span>` : ''}
        </div>
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
      <button type="button" class="btn small ${m.recruited ? 'primary' : ''}" data-act="toggle-recruited" data-id="${esc(m.id)}">${m.recruited ? '영입 완료' : '미영입'}</button>
      <button type="button" class="btn small ${m.replaceNeeded ? 'danger' : ''}" data-act="toggle-replace" data-id="${esc(m.id)}">${m.replaceNeeded ? '교체 필요' : '교체 표시'}</button>
    </div>
  </div>`;
}

function editMember(member, ctx) {
  const isNew = !member;
  const roles = ctx.state.tribes.roles;
  const m = member || {
    name: '', role: roles[0] ? roles[0].name : '생산직', gender: '미입력', recruited: true,
    skill: '', skillMax: '', goodTraits: '', badTraits: '', combatSkill: '', facility: '', duty: '',
    replaceNeeded: false, note: ''
  };
  openModal({
    title: isNew ? '부족원 등록' : '부족원 수정',
    wide: true,
    bodyHTML:
      `<div class="field-row">
        <div class="field"><label for="mb-name">이름</label><input id="mb-name" type="text" value="${esc(m.name)}" maxlength="60" placeholder="부족원 이름"></div>
        <div class="field"><label for="mb-role">직업</label>${selectInput('mb-role', roles.map((r) => r.name), m.role)}</div>
      </div>
      <div class="field-row three">
        <div class="field"><label for="mb-gender">성별</label>${selectInput('mb-gender', GENDERS, m.gender)}</div>
        <div class="field"><label for="mb-skill">현재 숙련도</label><input id="mb-skill" type="text" value="${esc(m.skill)}" placeholder="예: 62"></div>
        <div class="field"><label for="mb-skillmax">최대 숙련도</label><input id="mb-skillmax" type="text" value="${esc(m.skillMax)}" placeholder="예: 85"></div>
      </div>
      ${field('긍정 특성', textInput('mb-good', m.goodTraits, 'placeholder="예: 손재주, 야간 작업"'), '쉼표로 구분해도 됩니다.')}
      ${field('부정 특성', textInput('mb-bad', m.badTraits, 'placeholder="예: 겁이 많음"'))}
      <div class="field-row">
        <div class="field"><label for="mb-combat">전투 스킬</label><input id="mb-combat" type="text" value="${esc(m.combatSkill)}" placeholder="예: 도끼 B, 활 C"></div>
        <div class="field"><label for="mb-facility">담당 시설</label><input id="mb-facility" type="text" value="${esc(m.facility)}" placeholder="예: 제련기"></div>
      </div>
      ${field('담당 업무', textInput('mb-duty', m.duty, 'placeholder="예: 청동 주괴 생산"'))}
      <label class="switch-row"><input type="checkbox" id="mb-recruited" ${m.recruited ? 'checked' : ''}><span>영입 완료 (체크를 끄면 집계에서 제외)</span></label>
      <label class="switch-row"><input type="checkbox" id="mb-replace" ${m.replaceNeeded ? 'checked' : ''}><span>교체 대상</span></label>
      ${field('비고', textArea('mb-note', m.note, 2, 'placeholder="자유 메모"'))}
      <p class="form-error" hidden></p>`,
    submitLabel: isNew ? '등록' : '저장',
    onSubmit: (form) => {
      const name = ctx.val(form, 'mb-name');
      if (!name) { throw new Error('이름을 입력해 주세요.'); }
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
        facility: ctx.val(form, 'mb-facility'),
        duty: ctx.val(form, 'mb-duty'),
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
