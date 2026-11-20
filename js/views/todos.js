/* 할 일 — 날짜별 체크리스트 */
import { CATEGORIES, PRIORITIES } from '../data.js';
import { buildTodayTodos, parseBulkImport } from '../ai-io.js';
import { progressBar, pct, esc, todayKey, addDays, dateLabel, uid, copyText, clampNum, shortDateLabel } from '../util.js';
import { field, textInput, textArea, selectInput, openModal, confirmAction, toast } from '../ui.js';

const uiState = {
  date: todayKey(),
  status: '전체',
  category: '전체',
  query: ''
};

function todosFor(state, date) {
  return state.todos
    .filter((t) => t.date === date)
    .sort((a, b) => a.order - b.order);
}

function normalizeOrder(list) {
  list.forEach((t, i) => { t.order = i; });
}

function nextOrderFor(state, date) {
  const list = todosFor(state, date);
  return list.length ? Math.max(...list.map((t) => t.order)) + 1 : 0;
}

const todos = {
  title: '할 일',

  sub(ctx, state) {
    const list = todosFor(state, uiState.date);
    const done = list.filter((t) => t.done).length;
    return `${dateLabel(uiState.date)} · ${done}/${list.length} 완료`;
  },

  render(ctx, state) {
    const date = uiState.date;
    const all = todosFor(state, date);
    const done = all.filter((t) => t.done).length;
    const items = all.filter((t) => {
      if (uiState.status === '미완료' && t.done) { return false; }
      if (uiState.status === '완료' && !t.done) { return false; }
      if (uiState.category !== '전체' && t.category !== uiState.category) { return false; }
      return true;
    });
    const isToday = date === todayKey();
    const carried = all.filter((t) => t.carriedFrom).length;

    return `
    <div class="card tight">
      <div class="date-nav">
        <div class="date-nav-main">
          <button type="button" class="icon-btn" data-act="date-prev" aria-label="이전 날짜">‹</button>
          <div class="date-nav-label">
            <div class="date-nav-title">${esc(dateLabel(date))}</div>
            <div class="tiny muted">${isToday ? '오늘' : '지난/예정 기록'} · ${all.length}개 항목</div>
          </div>
          <button type="button" class="icon-btn" data-act="date-next" aria-label="다음 날짜">›</button>
        </div>
        <div class="date-nav-actions">
          <input type="date" class="search-input" value="${esc(date)}" data-field="date" aria-label="날짜 선택">
          <div class="btn-row">
            ${isToday ? '' : '<button type="button" class="btn small" data-act="date-today">오늘</button>'}
            <button type="button" class="btn small primary" data-act="add-todo">+ 할 일</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title-row"><h2>오늘 달성률</h2><span class="sub">${done}/${all.length}</span></div>
        <span class="chip ${done === all.length && all.length ? 'green' : ''}">${pct(done, all.length)}%</span>
      </div>
      ${progressBar(pct(done, all.length), { tone: done === all.length && all.length ? 'green' : '', label: `${all.length - done}개 남음` })}
      <div class="btn-row mt12">
        <button type="button" class="btn small" data-act="bulk-add">여러 줄 일괄 등록</button>
        <button type="button" class="btn small" data-act="carry-over">미완료 다음 날로 이월</button>
        <button type="button" class="btn small" data-act="copy-today">AI 복사</button>
        ${done ? `<button type="button" class="btn small ghost" data-act="clear-done">완료 ${done}개 정리</button>` : ''}
      </div>
      ${carried ? `<p class="hint">이월되어 넘어온 항목 ${carried}개가 포함되어 있습니다.</p>` : ''}
    </div>

    <div class="tabs" role="tablist" aria-label="상태 필터">
      ${['전체', '미완료', '완료'].map((s) => `<button type="button" class="tab ${uiState.status === s ? 'active' : ''}" data-act="filter-status" data-id="${s}">${s} ${s === '전체' ? all.length : s === '완료' ? done : all.length - done}</button>`).join('')}
    </div>
    <div class="toolbar">
      <select class="search-input grow" data-field="category" aria-label="카테고리 필터">
        <option value="전체"${uiState.category === '전체' ? ' selected' : ''}>전체 카테고리</option>
        ${CATEGORIES.map((c) => `<option value="${esc(c)}"${uiState.category === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
      <span class="tiny muted toolbar-hint">순서는 드래그 또는 ▲▼로 바꿀 수 있습니다</span>
    </div>

    <div class="list" id="todo-list" data-date="${esc(date)}">
      ${items.length ? items.map((t) => todoRow(t, all)).join('') : `<div class="empty"><p class="empty-main">${all.length ? '조건에 맞는 항목이 없습니다' : '이 날짜에 등록된 할 일이 없습니다'}</p><p class="empty-sub">+ 할 일 버튼이나 "여러 줄 일괄 등록"으로 추가해 보세요.</p></div>`}
    </div>`;
  },

  actions: {
    'date-prev'(el, ctx) { uiState.date = addDays(uiState.date, -1); ctx.render(); },
    'date-next'(el, ctx) { uiState.date = addDays(uiState.date, 1); ctx.render(); },
    'date-today'(el, ctx) { uiState.date = todayKey(); ctx.render(); },
    'filter-status'(el, ctx) { uiState.status = el.getAttribute('data-id'); ctx.render(); },

    'add-todo'(el, ctx) { editTodo(null, uiState.date, ctx); },
    'edit-todo'(el, ctx) {
      const t = ctx.state.todos.find((x) => x.id === el.getAttribute('data-id'));
      if (t) { editTodo(t, t.date, ctx); }
    },
    'delete-todo'(el, ctx) {
      const t = ctx.state.todos.find((x) => x.id === el.getAttribute('data-id'));
      if (!t) { return; }
      confirmAction(`"${t.title}" 항목을 삭제할까요?`, { title: '할 일 삭제', confirmLabel: '삭제', danger: true })
        .then((ok) => {
          if (!ok) { return; }
          ctx.state.todos = ctx.state.todos.filter((x) => x.id !== t.id);
          ctx.commit('삭제했습니다');
        });
    },
    'toggle-todo'(el, ctx) {
      const t = ctx.state.todos.find((x) => x.id === el.getAttribute('data-id'));
      if (!t) { return; }
      t.done = !t.done;
      t.doneAt = t.done ? new Date().toISOString() : null;
      ctx.commit();
    },
    'toggle-sub'(el, ctx) {
      const todoId = el.getAttribute('data-todo');
      const subId = el.getAttribute('data-id');
      const t = ctx.state.todos.find((x) => x.id === todoId);
      if (!t) { return; }
      const s = (t.subtasks || []).find((x) => x.id === subId);
      if (!s) { return; }
      s.done = !s.done;
      ctx.commit();
    },
    'move-up'(el, ctx) {
      const id = el.getAttribute('data-id');
      const list = todosFor(ctx.state, uiState.date);
      const i = list.findIndex((t) => t.id === id);
      if (i <= 0) { return; }
      const tmp = list[i - 1];
      list[i - 1] = list[i];
      list[i] = tmp;
      normalizeOrder(list);
      ctx.commit();
    },
    'move-down'(el, ctx) {
      const id = el.getAttribute('data-id');
      const list = todosFor(ctx.state, uiState.date);
      const i = list.findIndex((t) => t.id === id);
      if (i < 0 || i >= list.length - 1) { return; }
      const tmp = list[i + 1];
      list[i + 1] = list[i];
      list[i] = tmp;
      normalizeOrder(list);
      ctx.commit();
    },
    'carry-over'(el, ctx) {
      const from = uiState.date;
      const to = addDays(from, 1);
      const undone = todosFor(ctx.state, from).filter((t) => !t.done);
      if (!undone.length) { toast('이월할 미완료 항목이 없습니다'); return; }
      let added = 0;
      undone.forEach((t) => {
        const dup = ctx.state.todos.some((x) => x.date === to && x.title === t.title && x.carriedFrom === from);
        if (dup) { return; }
        ctx.state.todos.push({
          id: uid('td'),
          date: to,
          title: t.title,
          category: t.category,
          priority: t.priority,
          note: t.note,
          done: false,
          doneAt: null,
          createdAt: new Date().toISOString(),
          order: nextOrderFor(ctx.state, to) + added,
          carriedFrom: from,
          subtasks: (t.subtasks || []).map((s) => ({ id: uid('st'), title: s.title, done: s.done }))
        });
        added += 1;
      });
      ctx.commit(added ? `${added}개를 ${shortDateLabel(to)}로 이월했습니다` : '이미 모두 이월되어 있습니다');
    },
    'clear-done'(el, ctx) {
      const done = todosFor(ctx.state, uiState.date).filter((t) => t.done);
      confirmAction(`완료된 ${done.length}개를 삭제할까요? (기록에서 사라집니다)`, { title: '완료 항목 정리', confirmLabel: '정리', danger: true })
        .then((ok) => {
          if (!ok) { return; }
          ctx.state.todos = ctx.state.todos.filter((t) => !(t.date === uiState.date && t.done));
          ctx.commit('완료 항목을 정리했습니다');
        });
    },
    'bulk-add'(el, ctx) { bulkAdd(ctx); },
    async 'copy-today'(el, ctx) {
      const ok = await copyText(buildTodayTodos(ctx.state, uiState.date));
      toast(ok ? '오늘의 할 일을 복사했습니다' : '복사하지 못했습니다', !ok);
    }
  },

  fields: {
    date(el, ctx) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(el.value)) { uiState.date = el.value; ctx.render(); }
    },
    category(el, ctx) { uiState.category = el.value; ctx.render(); }
  },

  afterRender(root, ctx) {
    const list = root.querySelector('#todo-list');
    if (!list) { return; }
    let dragId = null;
    list.querySelectorAll('[data-todo-id]').forEach((row) => {
      row.addEventListener('dragstart', (ev) => {
        dragId = row.getAttribute('data-todo-id');
        row.classList.add('dragging');
        if (ev.dataTransfer) {
          ev.dataTransfer.effectAllowed = 'move';
          try { ev.dataTransfer.setData('text/plain', dragId); } catch (e) { /* 무시 */ }
        }
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        list.querySelectorAll('.drop-before').forEach((r) => r.classList.remove('drop-before'));
      });
      row.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        if (row.getAttribute('data-todo-id') !== dragId) { row.classList.add('drop-before'); }
      });
      row.addEventListener('dragleave', () => { row.classList.remove('drop-before'); });
      row.addEventListener('drop', (ev) => {
        ev.preventDefault();
        row.classList.remove('drop-before');
        const targetId = row.getAttribute('data-todo-id');
        if (!dragId || dragId === targetId) { return; }
        const ordered = todosFor(ctx.state, uiState.date);
        const fromIdx = ordered.findIndex((t) => t.id === dragId);
        const toIdx = ordered.findIndex((t) => t.id === targetId);
        if (fromIdx < 0 || toIdx < 0) { return; }
        const [moved] = ordered.splice(fromIdx, 1);
        ordered.splice(toIdx, 0, moved);
        normalizeOrder(ordered);
        ctx.commit();
      });
    });
  }
};

function todoRow(t, all) {
  const doneSubs = (t.subtasks || []).filter((s) => s.done).length;
  const prioClass = t.priority === '높음' ? 'prio-high' : t.priority === '낮음' ? 'prio-low' : 'prio-mid';
  const index = all.findIndex((x) => x.id === t.id);
  return `<div class="row-item${t.done ? ' done' : ''}" draggable="true" data-todo-id="${esc(t.id)}">
    <div class="drag-handle" aria-hidden="true" title="끌어서 순서 바꾸기">⠿</div>
    <button type="button" class="check-btn${t.done ? ' on' : ''}" data-act="toggle-todo" data-id="${esc(t.id)}" aria-label="${t.done ? '완료 취소' : '완료'}">✓</button>
    <div class="row-main">
      <div class="row-title">${esc(t.title)}</div>
      <div class="row-sub">
        <span class="chip">${esc(t.category)}</span>
        <span class="${prioClass}">${esc(t.priority)}</span>
        ${t.subtasks && t.subtasks.length ? `<span class="chip">하위 ${doneSubs}/${t.subtasks.length}</span>` : ''}
        ${t.carriedFrom ? `<span class="chip blue">${esc(shortDateLabel(t.carriedFrom))}에서 이월</span>` : ''}
      </div>
      ${t.note ? `<p class="row-note">${esc(t.note)}</p>` : ''}
      ${t.subtasks && t.subtasks.length ? `<div class="sub-list">
        ${t.subtasks.map((s) => `<label class="sub-item${s.done ? ' done' : ''}">
          <input type="checkbox" ${s.done ? 'checked' : ''} data-act="toggle-sub" data-id="${esc(s.id)}" data-todo="${esc(t.id)}">
          <span>${esc(s.title)}</span>
        </label>`).join('')}
      </div>` : ''}
    </div>
    <div class="row-actions">
      <button type="button" class="btn icon small" data-act="move-up" data-id="${esc(t.id)}" aria-label="위로" ${index <= 0 ? 'disabled' : ''}>↑</button>
      <button type="button" class="btn icon small" data-act="move-down" data-id="${esc(t.id)}" aria-label="아래로" ${index >= all.length - 1 ? 'disabled' : ''}>↓</button>
      <button type="button" class="btn icon small" data-act="edit-todo" data-id="${esc(t.id)}" aria-label="수정">✎</button>
      <button type="button" class="btn icon small" data-act="delete-todo" data-id="${esc(t.id)}" aria-label="삭제">🗑</button>
    </div>
  </div>`;
}

function editTodo(todo, date, ctx) {
  const isNew = !todo;
  const t = todo || {
    title: '', category: CATEGORIES[0], priority: '보통', note: '', date, subtasks: []
  };
  openModal({
    title: isNew ? '할 일 추가' : '할 일 수정',
    bodyHTML:
      `${field('할 일', textInput('td-title', t.title, 'placeholder="예: 광물 채집 자동화 구축" maxlength="160"'))}
      <div class="field-row">
        <div class="field"><label for="td-category">카테고리</label>${selectInput('td-category', CATEGORIES, t.category)}</div>
        <div class="field"><label for="td-priority">우선순위</label>${selectInput('td-priority', PRIORITIES, t.priority)}</div>
      </div>
      <div class="field"><label for="td-date">날짜</label><input id="td-date" type="date" value="${esc(t.date)}"></div>
      ${field('메모', textArea('td-note', t.note, 2, 'placeholder="짧은 메모 (선택)"'))}
      ${field('하위 체크리스트', textArea('td-subs', (t.subtasks || []).map((s) => s.title).join('\n'), 3, 'placeholder="한 줄에 하나씩"'), '기존 항목은 완료 상태가 유지됩니다.')}
      <p class="form-error" hidden></p>`,
    submitLabel: isNew ? '추가' : '저장',
    onSubmit: (form) => {
      const title = ctx.val(form, 'td-title');
      if (!title) { throw new Error('할 일을 입력해 주세요.'); }
      const dateVal = ctx.val(form, 'td-date') || date;
      const subTitles = ctx.val(form, 'td-subs').split('\n').map((s) => s.trim()).filter(Boolean);
      const prev = t.subtasks || [];
      const subtasks = subTitles.map((title2) => {
        const hit = prev.find((s) => s.title === title2);
        return { id: hit ? hit.id : uid('st'), title: title2, done: hit ? hit.done : false };
      });
      if (isNew) {
        ctx.state.todos.push({
          id: uid('td'),
          date: dateVal,
          title,
          category: ctx.val(form, 'td-category'),
          priority: ctx.val(form, 'td-priority'),
          note: ctx.val(form, 'td-note'),
          done: false,
          doneAt: null,
          createdAt: new Date().toISOString(),
          order: nextOrderFor(ctx.state, dateVal),
          carriedFrom: '',
          subtasks
        });
      } else {
        t.title = title;
        t.category = ctx.val(form, 'td-category');
        t.priority = ctx.val(form, 'td-priority');
        t.note = ctx.val(form, 'td-note');
        if (dateVal !== t.date) {
          t.date = dateVal;
          t.order = nextOrderFor(ctx.state, dateVal);
        }
        t.subtasks = subtasks;
      }
      uiState.date = dateVal;
      ctx.commit(isNew ? '할 일을 추가했습니다' : '수정했습니다');
    }
  });
}

function bulkAdd(ctx) {
  openModal({
    title: '여러 줄 일괄 등록',
    wide: true,
    bodyHTML:
      `${field('할 일 목록', textArea('bulk-text', '', 8, 'placeholder="- [ ] 광물 채집 자동화\\n- [ ] 요리 시설 건설\\n사냥 자동화 구축"'), '한 줄에 하나씩. `- [ ]` 마크다운, `[카테고리] 제목`, `#전투`, JSON 배열도 인식합니다.')}
      <div class="field-row">
        <div class="field"><label for="bulk-date">날짜</label><input id="bulk-date" type="date" value="${esc(uiState.date)}"></div>
        <div class="field"><label for="bulk-category">기본 카테고리</label>${selectInput('bulk-category', CATEGORIES, '기타')}</div>
      </div>
      <p class="form-error" hidden></p>`,
    submitLabel: '등록',
    onSubmit: (form) => {
      const text = ctx.val(form, 'bulk-text');
      if (!text) { throw new Error('등록할 내용을 붙여넣어 주세요.'); }
      const date = ctx.val(form, 'bulk-date') || uiState.date;
      const category = ctx.val(form, 'bulk-category');
      const parsed = parseBulkImport(text, { category });
      if (!parsed.length) { throw new Error('인식된 항목이 없습니다.'); }
      let order = nextOrderFor(ctx.state, date);
      parsed.forEach((p) => {
        ctx.state.todos.push({
          id: uid('td'),
          date,
          title: p.title,
          category: p.category,
          priority: p.priority,
          note: '',
          done: false,
          doneAt: null,
          createdAt: new Date().toISOString(),
          order: order++,
          carriedFrom: '',
          subtasks: []
        });
      });
      uiState.date = date;
      ctx.commit(`${parsed.length}개 항목을 등록했습니다`);
    }
  });
}

export default todos;
