/* 플레이 일지 */
import { buildJournal } from '../ai-io.js';
import { esc, todayKey, dateLabel, uid, copyText, clampNum, shortDateLabel } from '../util.js';
import { field, textArea, openModal, confirmAction, toast } from '../ui.js';

const uiState = { selectedId: null };

function sorted(state) {
  return state.journal.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function current(state) {
  const list = sorted(state);
  if (!list.length) { return null; }
  const hit = list.find((j) => j.id === uiState.selectedId);
  return hit || list[0];
}

const journal = {
  title: '플레이 일지',

  sub(ctx, state) {
    return `${state.journal.length}개 기록 · 최근 ${state.journal.length ? dateLabel(sorted(state)[0].date) : '없음'}`;
  },

  render(ctx, state) {
    const list = sorted(state);
    const j = current(state);
    if (j && !uiState.selectedId) { uiState.selectedId = j.id; }
    const doneTodos = j ? state.todos.filter((t) => t.date === j.date && t.done) : [];

    return `
    <div class="flex between wrap" style="margin-bottom:12px">
      <button type="button" class="btn small primary" data-act="new-entry">+ 오늘 일지 쓰기</button>
      <div class="btn-row">
        ${j ? `<button type="button" class="btn small" data-act="copy-journal">AI 복사</button>` : ''}
        ${state.journal.length ? '<button type="button" class="btn small ghost" data-act="export-journal">Markdown 내보내기</button>' : ''}
      </div>
    </div>

    ${j ? `
    <div class="card">
      <div class="card-head">
        <div class="card-title-row"><h2>${esc(dateLabel(j.date))}</h2><span class="sub">${j.day !== null ? j.day + '일차' : '일차 미입력'}</span></div>
        <button type="button" class="btn small ghost" data-act="delete-entry" data-id="${esc(j.id)}">삭제</button>
      </div>
      <div class="field-row three">
        <div class="field"><label for="jr-date">날짜</label><input id="jr-date" type="date" value="${esc(j.date)}" data-field="date"></div>
        <div class="field"><label for="jr-day">일차</label><input id="jr-day" type="number" min="0" value="${j.day === null ? '' : j.day}" data-field="day" placeholder="예: 12"></div>
        <div class="field"><label for="jr-hours">플레이 시간</label><input id="jr-hours" type="text" value="${esc(j.hours)}" data-field="hours" placeholder="예: 2시간 30분"></div>
      </div>
      <div class="field"><label for="jr-events">주요 사건</label><textarea id="jr-events" rows="3" data-field="events" placeholder="오늘 있었던 일을 담담하게">${esc(j.events)}</textarea></div>
      <div class="field-row">
        <div class="field"><label for="jr-battles">전투 / 보스 결과</label><textarea id="jr-battles" rows="2" data-field="battles">${esc(j.battles)}</textarea></div>
        <div class="field"><label for="jr-newmembers">신규 부족원</label><textarea id="jr-newmembers" rows="2" data-field="newMembers">${esc(j.newMembers)}</textarea></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="jr-newplaces">새 장소</label><input id="jr-newplaces" type="text" value="${esc(j.newPlaces)}" data-field="newPlaces"></div>
        <div class="field"><label for="jr-problems">문제점</label><input id="jr-problems" type="text" value="${esc(j.problems)}" data-field="problems"></div>
      </div>
      <div class="field"><label for="jr-next">다음 목표</label><textarea id="jr-next" rows="2" data-field="nextGoals">${esc(j.nextGoals)}</textarea></div>
      <div class="field"><label for="jr-memo">자유 메모</label><textarea id="jr-memo" rows="3" data-field="memo" placeholder="드립 소재, 썸네일 아이디어도 여기에">${esc(j.memo)}</textarea></div>

      <div class="divider"></div>
      <div class="card-head">
        <div class="card-title-row"><h2 style="font-size:13.5px">당일 완료 체크리스트</h2><span class="sub">${doneTodos.length}개</span></div>
        <button type="button" class="btn small" data-act="auto-import" data-id="${esc(j.id)}">자동 불러오기</button>
      </div>
      ${j.autoTodos && j.autoTodos.length ? `<div class="sub-list">
        ${j.autoTodos.map((t, i) => `<label class="sub-item${t.done ? ' done' : ''}">
          <input type="checkbox" ${t.done ? 'checked' : ''} data-act="toggle-auto" data-id="${esc(j.id)}" data-index="${i}">
          <span>${esc(t.title)}</span>
        </label>`).join('')}
      </div>` : `<p class="hint">"자동 불러오기"를 누르면 이 날짜에 완료한 할 일이 그대로 들어옵니다.</p>`}
    </div>` : `<div class="card"><div class="empty"><p class="empty-main">아직 일지가 없습니다</p><p class="empty-sub">"오늘 일지 쓰기"로 첫 기록을 남겨 보세요.</p></div></div>`}

    <div class="card">
      <div class="card-head"><h2>기록 목록</h2><span class="sub">${list.length}개</span></div>
      <div class="list">
        ${list.length ? list.map((x) => `<button type="button" class="row-item" data-act="select-entry" data-id="${esc(x.id)}" style="text-align:left;width:100%;cursor:pointer;${x.id === (j && j.id) ? 'border-color:rgba(212,155,84,.45)' : ''}">
          <div class="row-main">
            <div class="row-title">${esc(dateLabel(x.date))}${x.day !== null ? ` · ${x.day}일차` : ''} ${x.id === (j && j.id) ? '<span class="chip gold">보는 중</span>' : ''}</div>
            <div class="row-sub">${esc((x.events || x.memo || '내용 없음').slice(0, 60))}${(x.events || x.memo || '').length > 60 ? '…' : ''}</div>
          </div>
        </button>`).join('') : '<p class="small muted">기록이 없습니다.</p>'}
      </div>
    </div>`;
  },

  actions: {
    'new-entry'(el, ctx) {
      const today = todayKey();
      const existing = ctx.state.journal.find((j) => j.date === today);
      if (existing) {
        uiState.selectedId = existing.id;
        ctx.render();
        toast('오늘 일지가 이미 있습니다');
        return;
      }
      const entry = {
        id: uid('jr'), date: today, day: ctx.state.profile.day, hours: '',
        events: '', battles: '', newMembers: '', newPlaces: '', problems: '', nextGoals: '', memo: '', autoTodos: []
      };
      ctx.state.journal.push(entry);
      uiState.selectedId = entry.id;
      ctx.commit('새 일지를 만들었습니다');
    },
    'select-entry'(el, ctx) {
      uiState.selectedId = el.getAttribute('data-id');
      ctx.render();
    },
    'delete-entry'(el, ctx) {
      const id = el.getAttribute('data-id');
      const j = ctx.state.journal.find((x) => x.id === id);
      if (!j) { return; }
      confirmAction(`${dateLabel(j.date)} 일지를 삭제할까요?`, { title: '일지 삭제', confirmLabel: '삭제', danger: true })
        .then((ok) => {
          if (!ok) { return; }
          ctx.state.journal = ctx.state.journal.filter((x) => x.id !== id);
          uiState.selectedId = null;
          ctx.commit('삭제했습니다');
        });
    },
    'auto-import'(el, ctx) {
      const j = ctx.state.journal.find((x) => x.id === el.getAttribute('data-id'));
      if (!j) { return; }
      const done = ctx.state.todos.filter((t) => t.date === j.date && t.done);
      if (!done.length) { toast('이 날짜에 완료한 할 일이 없습니다', true); return; }
      j.autoTodos = done.map((t) => ({ title: t.title, done: true }));
      ctx.commit(`완료한 할 일 ${done.length}개를 불러왔습니다`);
    },
    'toggle-auto'(el, ctx) {
      const j = ctx.state.journal.find((x) => x.id === el.getAttribute('data-id'));
      if (!j) { return; }
      const i = Number(el.getAttribute('data-index'));
      if (j.autoTodos[i]) { j.autoTodos[i].done = !j.autoTodos[i].done; ctx.commit(); }
    },
    async 'copy-journal'(el, ctx) {
      const j = current(ctx.state);
      if (!j) { return; }
      const ok = await copyText(buildJournal(ctx.state, j.date));
      toast(ok ? '일지를 복사했습니다' : '복사하지 못했습니다', !ok);
    },
    'export-journal'(el, ctx) {
      const md = buildJournal(ctx.state, null);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'soulmask-journal-' + todayKey() + '.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast('일지를 내보냈습니다');
    }
  },

  fields: {
    date(el, ctx) {
      const j = current(ctx.state);
      if (!j || !/^\d{4}-\d{2}-\d{2}$/.test(el.value)) { return; }
      j.date = el.value;
      ctx.commit();
    },
    day(el, ctx) {
      const j = current(ctx.state);
      if (!j) { return; }
      j.day = el.value === '' ? null : clampNum(el.value, 0, 9999);
      ctx.commit();
    },
    events(el, ctx) { saveField(ctx, 'events', el.value); },
    hours(el, ctx) { saveField(ctx, 'hours', el.value); },
    battles(el, ctx) { saveField(ctx, 'battles', el.value); },
    newMembers(el, ctx) { saveField(ctx, 'newMembers', el.value); },
    newPlaces(el, ctx) { saveField(ctx, 'newPlaces', el.value); },
    problems(el, ctx) { saveField(ctx, 'problems', el.value); },
    nextGoals(el, ctx) { saveField(ctx, 'nextGoals', el.value); },
    memo(el, ctx) { saveField(ctx, 'memo', el.value); }
  }
};

function saveField(ctx, key, value) {
  const j = current(ctx.state);
  if (!j) { return; }
  j[key] = value;
  ctx.save();
  const sub = document.querySelector('#view-sub');
  if (sub) { sub.textContent = journal.sub(ctx, ctx.state) + ' · 저장됨'; }
}

export default journal;
