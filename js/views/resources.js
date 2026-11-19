/* 자원 & 거점 · 시설 */
import { num, pct, esc, uid, clampNum, $ } from '../util.js';
import { field, textInput, textArea, selectInput, openModal, confirmAction, toast } from '../ui.js';

const resources = {
  title: '자원 · 거점',

  sub(ctx, state) {
    const base = state.bases.find((b) => b.active) || state.bases[0];
    const short = state.resources.filter((r) => num(r.amount) < num(r.target)).length;
    return `${base ? base.name : '거점 없음'} · 부족 자원 ${short}종`;
  },

  render(ctx, state) {
    const base = state.bases.find((b) => b.active) || state.bases[0] || { id: '', name: '거점' };
    const short = state.resources.filter((r) => num(r.amount) < num(r.target));
    const facilities = state.facilities.filter((f) => !base.id || f.baseId === base.id);
    const owners = state.tribes.members.filter((m) => m.recruited !== false).map((m) => m.name);

    return `
    <div class="tabs" role="tablist" aria-label="거점 선택">
      ${state.bases.map((b) => `<button type="button" class="tab ${b.active ? 'active' : ''}" data-act="switch-base" data-id="${esc(b.id)}">${esc(b.name)}</button>`).join('')}
      <button type="button" class="tab" data-act="add-base">+ 거점</button>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="grow">
          <h2>${esc(base.name)}</h2>
          ${base.note ? `<p class="small muted mt4">${esc(base.note)}</p>` : ''}
        </div>
        <button type="button" class="btn small" data-act="edit-base" data-id="${esc(base.id)}">거점 수정</button>
      </div>
      <p class="small muted">자원 보유량과 목표를 적으면 부족한 자원이 자동으로 표시됩니다.</p>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title-row"><h2>자원</h2><span class="sub">${state.resources.length}종 · 부족 ${short.length}</span></div>
        <button type="button" class="btn small" data-act="add-resource">+ 자원</button>
      </div>
      <div class="res-head"><span>자원</span><span>보유</span><span>목표</span><span></span></div>
      <div class="res-table">
        ${state.resources.map((r) => {
          const isShort = num(r.amount) < num(r.target);
          const gap = Math.max(0, num(r.target) - num(r.amount));
          const hasExtra = !!(r.owner || r.automated || r.note);
          return `<div class="res-row${isShort ? ' short' : ''}" data-res-row="${esc(r.id)}">
            <div class="res-cell-name">
              <span class="res-name">${esc(r.name)}</span>
              ${isShort ? `<span class="res-short">-${gap}</span>` : '<span class="res-ok">OK</span>'}
            </div>
            <input type="number" inputmode="numeric" min="0" step="1" value="${num(r.amount)}" data-field="res-amount" data-id="${esc(r.id)}" aria-label="${esc(r.name)} 보유량">
            <input type="number" inputmode="numeric" min="0" step="1" value="${num(r.target)}" data-field="res-target" data-id="${esc(r.id)}" aria-label="${esc(r.name)} 목표량">
            <button type="button" class="icon-btn" data-act="edit-resource" data-id="${esc(r.id)}" aria-label="${esc(r.name)} 상세">⚙</button>
            ${hasExtra ? `<div class="res-extra">
              ${r.owner ? `<span class="chip">담당 ${esc(r.owner)}</span>` : ''}
              ${r.automated ? '<span class="chip green">자동화</span>' : ''}
              ${r.note ? `<span class="tiny muted">${esc(r.note)}</span>` : ''}
            </div>` : ''}
          </div>`;
        }).join('')}
      </div>
      ${owners.length ? '' : '<p class="hint">부족원을 등록하면 담당자를 지정할 수 있습니다.</p>'}
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title-row"><h2>시설</h2><span class="sub">${facilities.length}개</span></div>
        <button type="button" class="btn small" data-act="add-facility">+ 시설</button>
      </div>
      <div class="list">
        ${facilities.length ? facilities.map((f) => `
          <div class="row-item">
            <button type="button" class="check-btn${f.status === '완료' ? ' on' : ''}" data-act="toggle-facility" data-id="${esc(f.id)}" aria-label="건설 완료 여부">✓</button>
            <div class="row-main">
              <div class="row-title">${esc(f.name)} <span class="chip ${f.status === '완료' ? 'green' : 'gold'}">${esc(f.status)}</span></div>
              <div class="row-sub">
                ${f.product ? `<span>생산 ${esc(f.product)}</span>` : ''}
                ${f.owner ? `<span>담당 ${esc(f.owner)}</span>` : ''}
                ${f.upgraded ? '<span class="chip blue">업그레이드</span>' : ''}
                ${f.automated ? '<span class="chip green">자동화</span>' : ''}
              </div>
              ${f.plan ? `<p class="row-note">계획: ${esc(f.plan)}</p>` : ''}
            </div>
            <div class="row-actions">
              <button type="button" class="btn icon small" data-act="edit-facility" data-id="${esc(f.id)}" aria-label="수정">✎</button>
              <button type="button" class="btn icon small" data-act="delete-facility" data-id="${esc(f.id)}" aria-label="삭제">🗑</button>
            </div>
          </div>`).join('') : '<div class="empty"><p class="empty-main">이 거점에 등록된 시설이 없습니다</p></div>'}
      </div>
    </div>`;
  },

  actions: {
    'switch-base'(el, ctx) {
      const id = el.getAttribute('data-id');
      ctx.state.bases.forEach((b) => { b.active = b.id === id; });
      ctx.commit();
    },
    'add-base'(el, ctx) { editBase(null, ctx); },
    'edit-base'(el, ctx) {
      const b = ctx.state.bases.find((x) => x.id === el.getAttribute('data-id'));
      if (b) { editBase(b, ctx); }
    },
    'add-resource'(el, ctx) { editResource(null, ctx); },
    'edit-resource'(el, ctx) {
      const r = ctx.state.resources.find((x) => x.id === el.getAttribute('data-id'));
      if (r) { editResource(r, ctx); }
    },
    'add-facility'(el, ctx) { editFacility(null, ctx); },
    'edit-facility'(el, ctx) {
      const f = ctx.state.facilities.find((x) => x.id === el.getAttribute('data-id'));
      if (f) { editFacility(f, ctx); }
    },
    'toggle-facility'(el, ctx) {
      const f = ctx.state.facilities.find((x) => x.id === el.getAttribute('data-id'));
      if (!f) { return; }
      f.status = f.status === '완료' ? '건설 예정' : '완료';
      ctx.commit();
    },
    'delete-facility'(el, ctx) {
      const f = ctx.state.facilities.find((x) => x.id === el.getAttribute('data-id'));
      if (!f) { return; }
      confirmAction(`"${f.name}" 시설을 삭제할까요?`, { title: '시설 삭제', confirmLabel: '삭제', danger: true })
        .then((ok) => {
          if (!ok) { return; }
          ctx.state.facilities = ctx.state.facilities.filter((x) => x.id !== f.id);
          ctx.commit('삭제했습니다');
        });
    }
  },

  fields: {
    'res-amount'(el, ctx) {
      const r = ctx.state.resources.find((x) => x.id === el.getAttribute('data-id'));
      if (!r) { return; }
      r.amount = Math.max(0, num(el.value, 0));
      ctx.commit();
    },
    'res-target'(el, ctx) {
      const r = ctx.state.resources.find((x) => x.id === el.getAttribute('data-id'));
      if (!r) { return; }
      r.target = Math.max(0, num(el.value, 0));
      ctx.commit();
    }
  }
};

function editBase(base, ctx) {
  const isNew = !base;
  const b = base || { name: '', active: false, note: '' };
  openModal({
    title: isNew ? '거점 추가' : '거점 수정',
    bodyHTML:
      `${field('거점 이름', textInput('bs2-name', b.name, 'maxlength="60" placeholder="예: 동부 호수 거점"'))}
      ${field('메모', textArea('bs2-note', b.note, 2))}
      <label class="switch-row"><input type="checkbox" id="bs2-active" ${b.active ? 'checked' : ''}><span>지금 사용하는 거점으로 지정</span></label>
      ${isNew ? '' : `<div class="btn-row"><button type="button" class="btn small danger" id="bs2-del">거점 삭제</button></div>`}
      <p class="form-error" hidden></p>`,
    submitLabel: isNew ? '추가' : '저장',
    onSubmit: (form) => {
      const name = ctx.val(form, 'bs2-name');
      if (!name) { throw new Error('거점 이름을 입력해 주세요.'); }
      if (isNew) {
        const item = { id: uid('base'), name, note: ctx.val(form, 'bs2-note'), active: ctx.check(form, 'bs2-active') };
        ctx.state.bases.push(item);
        if (item.active) { ctx.state.bases.forEach((x) => { x.active = x.id === item.id; }); }
      } else {
        base.name = name;
        base.note = ctx.val(form, 'bs2-note');
        if (ctx.check(form, 'bs2-active')) {
          ctx.state.bases.forEach((x) => { x.active = x.id === base.id; });
        }
      }
      ctx.commit(isNew ? '거점을 추가했습니다' : '저장했습니다');
    }
  });
  if (!isNew) {
    const btn = $('#bs2-del');
    if (btn) {
      btn.addEventListener('click', () => {
        if (ctx.state.bases.length <= 1) { toast('거점은 최소 1개가 필요합니다', true); return; }
        const id = base.id;
        confirmAction(`"${base.name}" 거점을 삭제할까요?`, { title: '거점 삭제', confirmLabel: '삭제', danger: true })
          .then((ok) => {
            if (!ok) { return; }
            ctx.state.bases = ctx.state.bases.filter((x) => x.id !== id);
            if (!ctx.state.bases.some((x) => x.active) && ctx.state.bases[0]) { ctx.state.bases[0].active = true; }
            ctx.state.facilities = ctx.state.facilities.filter((f) => f.baseId !== id);
            ctx.commit('거점을 삭제했습니다');
          });
      });
    }
  }
}

function editResource(res, ctx) {
  const isNew = !res;
  const r = res || { name: '', amount: 0, target: 0, owner: '', automated: false, note: '' };
  const owners = state_owners(ctx);
  openModal({
    title: isNew ? '자원 추가' : '자원 상세',
    bodyHTML:
      `${field('자원 이름', textInput('rs-name', r.name, 'maxlength="60"'))}
      <div class="field-row">
        <div class="field"><label for="rs-amount">현재 보유량</label><input id="rs-amount" type="number" min="0" value="${num(r.amount)}"></div>
        <div class="field"><label for="rs-target">목표 수량</label><input id="rs-target" type="number" min="0" value="${num(r.target)}"></div>
      </div>
      <div class="field"><label for="rs-owner">담당 부족원</label>${selectInput('rs-owner', ['(없음)'].concat(owners), r.owner || '(없음)')}</div>
      <label class="switch-row"><input type="checkbox" id="rs-auto" ${r.automated ? 'checked' : ''}><span>자동화 (부족원이 상시 채집·생산)</span></label>
      ${field('메모', textInput('rs-note', r.note, 'placeholder="예: 제련기 2대 가동"'))}
      <p class="form-error" hidden></p>`,
    submitLabel: isNew ? '추가' : '저장',
    onSubmit: (form) => {
      const name = ctx.val(form, 'rs-name');
      if (!name) { throw new Error('자원 이름을 입력해 주세요.'); }
      const owner = ctx.val(form, 'rs-owner');
      const data = {
        name,
        amount: Math.max(0, num(ctx.val(form, 'rs-amount'), 0)),
        target: Math.max(0, num(ctx.val(form, 'rs-target'), 0)),
        owner: owner === '(없음)' ? '' : owner,
        automated: ctx.check(form, 'rs-auto'),
        note: ctx.val(form, 'rs-note')
      };
      if (isNew) { ctx.state.resources.push(Object.assign({ id: uid('res') }, data)); }
      else { Object.assign(res, data); }
      ctx.commit(isNew ? '자원을 추가했습니다' : '저장했습니다');
    }
  });
}

function state_owners(ctx) {
  return ctx.state.tribes.members.filter((m) => m.recruited !== false).map((m) => m.name);
}

function editFacility(fac, ctx) {
  const isNew = !fac;
  const base = ctx.state.bases.find((b) => b.active) || ctx.state.bases[0] || { id: '' };
  const f = fac || { baseId: base.id, name: '', status: '건설 예정', owner: '', product: '', upgraded: false, automated: false, plan: '' };
  const owners = state_owners(ctx);
  openModal({
    title: isNew ? '시설 추가' : '시설 수정',
    bodyHTML:
      `${field('시설 이름', textInput('fc-name', f.name, 'maxlength="60" placeholder="예: 제련기"'))}
      <div class="field-row">
        <div class="field"><label for="fc-status">상태</label>${selectInput('fc-status', ['건설 예정', '완료'], f.status)}</div>
        <div class="field"><label for="fc-owner">담당 부족원</label>${selectInput('fc-owner', ['(없음)'].concat(owners), f.owner || '(없음)')}</div>
      </div>
      ${field('생산 품목', textInput('fc-product', f.product, 'placeholder="예: 청동 주괴"'))}
      <label class="switch-row"><input type="checkbox" id="fc-upgraded" ${f.upgraded ? 'checked' : ''}><span>업그레이드 완료</span></label>
      <label class="switch-row"><input type="checkbox" id="fc-auto" ${f.automated ? 'checked' : ''}><span>자동화</span></label>
      ${field('추가 건설 계획', textInput('fc-plan', f.plan, 'placeholder="예: 제련기 1대 더"'))}
      <p class="form-error" hidden></p>`,
    submitLabel: isNew ? '추가' : '저장',
    onSubmit: (form) => {
      const name = ctx.val(form, 'fc-name');
      if (!name) { throw new Error('시설 이름을 입력해 주세요.'); }
      const owner = ctx.val(form, 'fc-owner');
      const data = {
        name,
        baseId: isNew ? base.id : f.baseId,
        status: ctx.val(form, 'fc-status'),
        owner: owner === '(없음)' ? '' : owner,
        product: ctx.val(form, 'fc-product'),
        upgraded: ctx.check(form, 'fc-upgraded'),
        automated: ctx.check(form, 'fc-auto'),
        plan: ctx.val(form, 'fc-plan')
      };
      if (isNew) { ctx.state.facilities.push(Object.assign({ id: uid('fc') }, data)); }
      else { Object.assign(fac, data); }
      ctx.commit(isNew ? '시설을 추가했습니다' : '저장했습니다');
    }
  });
}

export default resources;
