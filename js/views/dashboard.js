/* 대시보드 — 오늘의 현황 한눈에 보기 */
import { store } from '../store.js';
import { capacityEditorHTML, tribeStats, paintCapacity, setCapacity } from '../tribes-util.js';
import { overallProgress, buildStatus } from '../ai-io.js';
import { progressBar, pct, esc, todayKey, dateLabel, debounce, copyText, clampNum } from '../util.js';
import { field, textInput, selectInput, openModal, toast } from '../ui.js';

const saveSoon = debounce((ctx) => { ctx.save({ silent: true }); }, 400);

const dashboard = {
  title: '대시보드',

  sub(ctx, state) {
    const p = state.profile;
    return `${p.base || '거점 미입력'} · 의식 강도 ${p.awareness} · ${p.era || '단계 미입력'}`;
  },

  render(ctx, state) {
    const today = todayKey();
    const todays = state.todos.filter((t) => t.date === today).sort((a, b) => a.order - b.order);
    const done = todays.filter((t) => t.done).length;
    const st = tribeStats(state);
    const overall = overallProgress(state);
    const doing = state.roadmap.filter((s) => s.status === '진행 중');
    const nextSteps = state.roadmap.filter((s) => s.status !== '완료').slice(0, 3);
    const nextBoss = state.bosses.find((b) => !b.cleared) || null;
    const journals = state.journal.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
    const openFacilities = state.facilities.filter((f) => f.status !== '완료');
    const pending = todays.filter((t) => !t.done).slice(0, 4);

    return `
    <div class="card hero">
      <div class="flex between" style="align-items:flex-start">
        <div class="grow">
          <p class="tiny muted">오늘 · ${esc(dateLabel(today))}</p>
          <h2 style="font-size:19px;font-weight:800;margin-top:2px">${esc(state.profile.base || '거점 미입력')}</h2>
          <p class="small muted mt4">${esc(state.profile.era || '문명 단계 미입력')} · 부족원 ${st.current}/${st.capacity}명</p>
        </div>
        <button type="button" class="btn small" data-act="edit-profile">상태 수정</button>
      </div>
      <div class="grid stats mt12">
        <div class="stat">
          <div class="k">플레이 일차</div>
          <div class="v">${state.profile.day === null ? '<span class="muted" style="font-size:14px">미입력</span>' : esc(state.profile.day) + '<small>일차</small>'}</div>
        </div>
        <div class="stat">
          <div class="k">의식 강도</div>
          <div class="v">${esc(state.profile.awareness)}</div>
        </div>
        <div class="stat">
          <div class="k">문명 단계</div>
          <div class="v" style="font-size:14px;line-height:1.4">${esc(state.profile.era || '미입력')}</div>
        </div>
        <div class="stat">
          <div class="k">오늘 달성률</div>
          <div class="v" data-dash-today-pct>${pct(done, todays.length)}<small>%</small></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title-row"><h2>부족원 영입 현황</h2></div>
        <button type="button" class="link-btn" data-act="goto" data-view="tribesmen">부족원 관리 →</button>
      </div>
      ${capacityEditorHTML(state, { id: 'dash-capacity-box', inputId: 'dash-capacity-input' })}
      <div class="tribe-summary mt12">
        ${st.roles.map((r) => `<span class="role-pill ${r.short ? 'short' : ''}">
          <span class="chip ${esc(r.tone)}" style="border:0;background:none;padding:0">${esc(r.name)}</span>
          <span class="cnt">${r.count}/${r.target}</span>
          ${r.short ? `<span class="warn-dot" title="${r.short}명 부족"></span>` : ''}
        </span>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title-row"><h2>오늘의 목표</h2><span class="sub">${done}/${todays.length} 완료</span></div>
        <button type="button" class="link-btn" data-act="goto" data-view="todos">할 일 전체 →</button>
      </div>
      ${progressBar(pct(done, todays.length), { label: '달성률', tone: done === todays.length && todays.length ? 'green' : '' })}
      <div class="list mt12">
        ${pending.length ? pending.map((t) => `
          <div class="row-item">
            <button type="button" class="check-btn" data-act="toggle-todo" data-id="${esc(t.id)}" aria-label="완료 체크">✓</button>
            <div class="row-main">
              <div class="row-title">${esc(t.title)}</div>
              <div class="row-sub"><span class="chip">${esc(t.category)}</span><span class="prio-${t.priority === '높음' ? 'high' : t.priority === '낮음' ? 'low' : 'mid'}">${esc(t.priority)}</span></div>
            </div>
          </div>`).join('') : `<div class="empty"><p class="empty-main">${todays.length ? '오늘 할 일을 모두 끝냈습니다' : '오늘 등록된 할 일이 없습니다'}</p><p class="empty-sub">할 일 화면에서 추가하거나 AI 체크리스트를 붙여넣어 일괄 등록할 수 있습니다.</p></div>`}
      </div>
      <div class="btn-row mt12">
        <button type="button" class="btn small primary" data-act="quick-add-todo">+ 할 일 추가</button>
        <button type="button" class="btn small" data-act="copy-status">현황 복사</button>
      </div>
    </div>

    <div class="grid two">
      <div class="card">
        <div class="card-head"><h2>진행 중인 프로젝트</h2><span class="sub">${doing.length + openFacilities.length}개</span></div>
        ${doing.length || openFacilities.length ? `<div class="list">
          ${doing.map((s) => {
            const d = s.checklist.filter((c) => c.done).length;
            return `<div class="row-item">
              <div class="row-main">
                <div class="row-title">${esc(s.title)}</div>
                <div class="row-sub">로드맵 ${s.order}단계 · ${d}/${s.checklist.length}</div>
                <div class="bar mt8"><div class="bar-track"><div class="bar-fill" style="width:${pct(d, s.checklist.length)}%"></div></div></div>
              </div>
            </div>`;
          }).join('')}
          ${openFacilities.map((f) => `<div class="row-item">
            <div class="row-main">
              <div class="row-title">${esc(f.name)}</div>
              <div class="row-sub"><span class="chip">${esc(f.status)}</span>${f.product ? `<span>${esc(f.product)}</span>` : ''}</div>
            </div>
          </div>`).join('')}
        </div>` : '<p class="small muted">진행 중인 프로젝트가 없습니다. 로드맵에서 단계를 "진행 중"으로 바꿔 보세요.</p>'}
      </div>

      <div class="card">
        <div class="card-head"><h2>다음 주요 목표</h2></div>
        <div class="list">
          ${nextBoss ? `<div class="row-item">
            <div class="row-main">
              <div class="row-title">${esc(nextBoss.name)} 공략</div>
              <div class="row-sub"><span class="chip">${esc(nextBoss.region)}</span><span class="chip">Lv ${esc(nextBoss.level)}</span>${nextBoss.awareness !== null ? `<span class="chip">의식 강도 ${nextBoss.awareness}</span>` : ''}</div>
            </div>
          </div>` : ''}
          ${nextSteps.map((s) => `<div class="row-item">
            <div class="row-main">
              <div class="row-title">${esc(s.title)}</div>
              <div class="row-sub">로드맵 ${s.order}단계 · ${esc(s.status)}</div>
            </div>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>전체 진행률</h2><span class="sub">가중 합산</span></div>
      ${progressBar(overall.percent, { label: '전체', tone: 'blue' })}
      <div class="row-sub mt8" style="font-size:12px;color:var(--muted)">
        <span class="chip">로드맵 ${overall.roadmapDone}/${overall.roadmapTotal}</span>
        <span class="chip">보스 ${overall.bossDone}/${overall.bossTotal}</span>
        <span class="chip">할 일 ${overall.todoDone}/${overall.todoTotal}</span>
        <span class="chip">부족원 ${st.current}/${st.capacity}</span>
      </div>
      <p class="hint">로드맵 60% · 보스 25% · 할 일 15% 비중으로 계산합니다.</p>
    </div>

    <div class="card">
      <div class="card-head">
        <h2>최근 플레이 기록</h2>
        <button type="button" class="link-btn" data-act="goto" data-view="journal">일지 전체 →</button>
      </div>
      ${journals.length ? `<div class="list">
        ${journals.map((j) => `<div class="journal-item">
          <div class="flex between"><span class="journal-date">${esc(dateLabel(j.date))}${j.day !== null ? ' · ' + j.day + '일차' : ''}</span></div>
          <p class="journal-body">${esc((j.events || j.memo || '').slice(0, 160))}${(j.events || j.memo || '').length > 160 ? '…' : ''}</p>
        </div>`).join('')}
      </div>` : '<p class="small muted">아직 기록이 없습니다.</p>'}
    </div>`;
  },

  actions: {
    'edit-profile'(el, ctx) {
      const p = ctx.state.profile;
      openModal({
        title: '게임 상태 수정',
        bodyHTML:
          `<div class="field-row">
            <div class="field"><label for="pf-day">플레이 일차</label><input id="pf-day" type="number" min="0" max="9999" value="${p.day === null ? '' : p.day}" placeholder="예: 12"></div>
            <div class="field"><label for="pf-awareness">의식 강도</label><input id="pf-awareness" type="number" min="0" max="100" value="${p.awareness}"></div>
          </div>
          ${field('문명 발전 단계', textInput('pf-era', p.era, 'placeholder="예: 청동기 시대"'))}
          ${field('정착 거점', textInput('pf-base', p.base, 'placeholder="예: 서부 우림 거점"'))}
          <p class="hint">일차는 비워 두면 "미입력"으로 표시됩니다. 정원은 대시보드의 정원 칸에서 바로 바꿀 수 있습니다.</p>
          <p class="form-error" hidden></p>`,
        submitLabel: '저장',
        onSubmit: (form) => {
          const dayVal = ctx.val(form, 'pf-day');
          ctx.state.profile.day = dayVal === '' ? null : clampNum(dayVal, 0, 9999);
          ctx.state.profile.awareness = clampNum(ctx.val(form, 'pf-awareness'), 0, 100);
          ctx.state.profile.era = ctx.val(form, 'pf-era') || '청동기 시대';
          ctx.state.profile.base = ctx.val(form, 'pf-base');
          ctx.commit('게임 상태를 저장했습니다');
        }
      });
    },
    'capacity-inc'(el, ctx) {
      const box = el.closest('[data-capacity-box]');
      const next = setCapacity(ctx.state, ctx.state.tribes.capacity + 1);
      const input = box && box.querySelector('.capacity-input');
      if (input) { input.value = next; }
      ctx.save();
      paintCapacity(box, ctx.state);
    },
    'capacity-dec'(el, ctx) {
      const box = el.closest('[data-capacity-box]');
      const next = setCapacity(ctx.state, ctx.state.tribes.capacity - 1);
      const input = box && box.querySelector('.capacity-input');
      if (input) { input.value = next; }
      ctx.save();
      paintCapacity(box, ctx.state);
    },
    'toggle-todo'(el, ctx) {
      const id = el.getAttribute('data-id');
      const t = ctx.state.todos.find((x) => x.id === id);
      if (!t) { return; }
      t.done = !t.done;
      t.doneAt = t.done ? new Date().toISOString() : null;
      ctx.commit();
      toast(t.done ? '완료로 표시했습니다' : '다시 진행 중으로 바꿨습니다');
    },
    'quick-add-todo'(el, ctx) {
      location.hash = '#todos';
      setTimeout(() => {
        const btn = document.querySelector('[data-act="add-todo"]');
        if (btn) { btn.click(); }
      }, 120);
    },
    'goto'(el) {
      location.hash = '#' + el.getAttribute('data-view');
    },
    async 'copy-status'(el, ctx) {
      const ok = await copyText(buildStatus(ctx.state));
      toast(ok ? '현재 진행 현황을 복사했습니다 — AI에게 붙여넣어 보세요' : '복사하지 못했습니다', !ok);
    }
  },

  fields: {
    capacity(el, ctx) {
      const box = el.closest('[data-capacity-box]');
      const n = setCapacity(ctx.state, el.value);
      el.value = n;
      ctx.save();
      paintCapacity(box, ctx.state);
    }
  },

  live: {
    /** 정원을 입력하는 즉시 진행률·잔여 자리를 다시 계산하고, 저장은 잠깐 모아서 합니다. */
    capacity(el, ctx) {
      const raw = String(el.value || '').trim();
      if (raw === '') { return; }
      const n = Number(raw);
      if (!isFinite(n) || n < 1 || n > 99) { return; }
      setCapacity(ctx.state, n);
      paintCapacity(el.closest('[data-capacity-box]'), ctx.state);
      saveSoon(ctx);
    }
  }
};

export default dashboard;
