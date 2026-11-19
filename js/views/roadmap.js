/* 로드맵 — 14단계 진행과 세부 체크리스트 */
import { progressBar, pct, esc, uid } from '../util.js';
import { field, textInput, textArea, openModal, confirmAction, toast } from '../ui.js';

const STATUSES = ['완료', '진행 중', '미진행'];

const roadmap = {
  title: '로드맵',

  sub(ctx, state) {
    const done = state.roadmap.filter((s) => s.status === '완료').length;
    return `${done}/${state.roadmap.length}단계 완료 · ${state.roadmap.filter((s) => s.status === '진행 중').length}단계 진행 중`;
  },

  render(ctx, state) {
    const list = state.roadmap.slice().sort((a, b) => a.order - b.order);
    const done = list.filter((s) => s.status === '완료').length;
    const doing = list.filter((s) => s.status === '진행 중').length;
    const checksTotal = list.reduce((a, s) => a + s.checklist.length, 0);
    const checksDone = list.reduce((a, s) => a + s.checklist.filter((c) => c.done).length, 0);
    const doneIds = new Set(list.filter((s) => s.status === '완료').map((s) => s.id));

    return `
    <div class="card">
      <div class="card-head"><h2>전체 단계 진행</h2><span class="sub">${checksDone}/${checksTotal} 체크</span></div>
      ${progressBar(pct(done, list.length), { label: `${done}/${list.length}단계`, tone: 'blue' })}
      <div class="row-sub mt8">
        <span class="chip green">완료 ${done}</span>
        <span class="chip gold">진행 중 ${doing}</span>
        <span class="chip">미진행 ${list.length - done - doing}</span>
      </div>
    </div>

    <div class="rm-list">
      ${list.map((s) => {
        const cDone = s.checklist.filter((c) => c.done).length;
        const blocked = (s.prereq || []).filter((id) => !doneIds.has(id));
        return `<div class="rm-step ${s.status === '완료' ? 'done' : s.status === '진행 중' ? 'doing' : ''}">
          <span class="rm-dot" aria-hidden="true"></span>
          <div class="rm-card">
            <div class="rm-head">
              <div class="grow">
                <div class="rm-title"><span class="num">${s.order}.</span>${esc(s.title)}</div>
                ${s.desc ? `<p class="rm-desc">${esc(s.desc)}</p>` : ''}
              </div>
              <div class="flex" style="flex-direction:column;align-items:flex-end;gap:4px">
                <select class="status-select ${s.status === '완료' ? 'done' : s.status === '진행 중' ? 'doing' : ''}"
                        data-field="status" data-id="${esc(s.id)}" aria-label="${esc(s.title)} 상태">
                  ${STATUSES.map((x) => `<option value="${x}"${s.status === x ? ' selected' : ''}>${x}</option>`).join('')}
                </select>
                <span class="tiny muted">${cDone}/${s.checklist.length}</span>
              </div>
            </div>
            ${blocked.length ? `<p class="hint">선행 조건 미완료: ${blocked.map((id) => {
              const p = list.find((x) => x.id === id);
              return p ? esc(p.title) : '';
            }).filter(Boolean).join(', ')}</p>` : ''}
            <div class="rm-checks">
              ${s.checklist.map((c) => `<label class="sub-item${c.done ? ' done' : ''}">
                <input type="checkbox" ${c.done ? 'checked' : ''} data-act="toggle-check" data-id="${esc(c.id)}" data-step="${esc(s.id)}">
                <span class="grow">${esc(c.title)}</span>
                <button type="button" class="mini-x" data-act="delete-check" data-id="${esc(c.id)}" data-step="${esc(s.id)}" aria-label="항목 삭제">✕</button>
              </label>`).join('')}
            </div>
            <div class="btn-row mt8">
              <button type="button" class="btn small ghost" data-act="add-check" data-id="${esc(s.id)}">+ 세부 항목</button>
              <button type="button" class="btn small ghost" data-act="edit-step" data-id="${esc(s.id)}">단계 수정</button>
              <button type="button" class="btn small ghost" data-act="edit-prereq" data-id="${esc(s.id)}">선행 조건</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  },

  actions: {
    'toggle-check'(el, ctx) {
      const step = ctx.state.roadmap.find((s) => s.id === el.getAttribute('data-step'));
      if (!step) { return; }
      const c = step.checklist.find((x) => x.id === el.getAttribute('data-id'));
      if (!c) { return; }
      c.done = !c.done;
      ctx.commit();
    },
    'add-check'(el, ctx) {
      const stepId = el.getAttribute('data-id');
      const step = ctx.state.roadmap.find((s) => s.id === stepId);
      if (!step) { return; }
      openModal({
        title: '세부 체크리스트 추가',
        bodyHTML: `${field('항목', textInput('ck-title', '', 'placeholder="예: 철광 위치 표시" maxlength="200"'))}<p class="form-error" hidden></p>`,
        submitLabel: '추가',
        onSubmit: (form) => {
          const title = ctx.val(form, 'ck-title');
          if (!title) { throw new Error('항목을 입력해 주세요.'); }
          step.checklist.push({ id: uid('rmc'), title, done: false });
          ctx.commit('추가했습니다');
        }
      });
    },
    'delete-check'(el, ctx) {
      const stepId = el.getAttribute('data-step');
      const checkId = el.getAttribute('data-id');
      const step = ctx.state.roadmap.find((s) => s.id === stepId);
      if (!step) { return; }
      const c = step.checklist.find((x) => x.id === checkId);
      if (!c) { return; }
      confirmAction(`"${c.title}" 항목을 삭제할까요?`, { title: '항목 삭제', confirmLabel: '삭제', danger: true })
        .then((ok) => {
          if (!ok) { return; }
          step.checklist = step.checklist.filter((x) => x.id !== checkId);
          ctx.commit('삭제했습니다');
        });
    },
    'edit-step'(el, ctx) {
      const step = ctx.state.roadmap.find((s) => s.id === el.getAttribute('data-id'));
      if (!step) { return; }
      openModal({
        title: `로드맵 ${step.order}단계 수정`,
        bodyHTML:
          `${field('단계 제목', textInput('rs-title', step.title, 'maxlength="80"'))}
          ${field('설명', textArea('rs-desc', step.desc, 3))}
          <p class="form-error" hidden></p>`,
        submitLabel: '저장',
        onSubmit: (form) => {
          const title = ctx.val(form, 'rs-title');
          if (!title) { throw new Error('제목을 입력해 주세요.'); }
          step.title = title;
          step.desc = ctx.val(form, 'rs-desc');
          ctx.commit('저장했습니다');
        }
      });
    },
    'edit-prereq'(el, ctx) {
      const step = ctx.state.roadmap.find((s) => s.id === el.getAttribute('data-id'));
      if (!step) { return; }
      const others = ctx.state.roadmap.filter((s) => s.id !== step.id).sort((a, b) => a.order - b.order);
      openModal({
        title: `${step.order}단계 선행 조건`,
        bodyHTML:
          `<p class="hint">먼저 끝내야 하는 단계를 고르세요. 로드맵에서 안내 문구로만 쓰입니다.</p>
          <div class="field">${others.map((s) => `<label class="check-row">
            <input type="checkbox" class="prereq-cb" value="${esc(s.id)}" ${step.prereq.includes(s.id) ? 'checked' : ''}>
            <span>${s.order}. ${esc(s.title)} <span class="tiny muted">(${esc(s.status)})</span></span>
          </label>`).join('')}</div>
          <p class="form-error" hidden></p>`,
        submitLabel: '저장',
        onSubmit: (form) => {
          step.prereq = Array.from(form.querySelectorAll('.prereq-cb')).filter((c) => c.checked).map((c) => c.value);
          ctx.commit('선행 조건을 저장했습니다');
        }
      });
    }
  },

  fields: {
    status(el, ctx) {
      const step = ctx.state.roadmap.find((s) => s.id === el.getAttribute('data-id'));
      if (!step) { return; }
      step.status = el.value;
      if (el.value === '완료') {
        step.checklist.forEach((c) => { c.done = true; });
      }
      ctx.commit(`${step.order}단계를 "${el.value}"로 바꿨습니다`);
    }
  }
};

export default roadmap;
