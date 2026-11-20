/* 설정 — AI 입출력 · 클라우드 동기화 · 백업/복원 */
import { store, exportJSON, parseImportText, storageStatus } from '../store.js';
import * as sync from '../sync.js';
import { buildStatus, buildTodayTodos, buildTribes, buildJournal, buildFull, markdownExport, parseBulkImport } from '../ai-io.js';
import { esc, copyText, downloadText, todayKey, timeLabel, uid } from '../util.js';
import { field, textArea, selectInput, openModal, confirmAction, toast } from '../ui.js';
import { CATEGORIES } from '../data.js';

const settings = {
  title: '설정 · 백업',

  sub(ctx, state) {
    return 'AI 입출력 · 클라우드 동기화 · 백업';
  },

  render(ctx, state) {
    const cfg = sync.readCfg();
    const snap = sync.syncSnapshot();
    const counts = {
      todos: state.todos.length,
      members: state.tribes.members.length,
      bosses: state.bosses.length,
      journal: state.journal.length,
      videos: state.videos.length
    };
    const st = storageStatus();
    const last = timeLabel(store.lastSavedAt || state.meta.updatedAt);

    return `
    <div class="card" id="sync-block">
      <div class="card-head">
        <div class="card-title-row"><h2>☁ 클라우드 동기화 (폰 ↔ 컴)</h2></div>
        <span class="chip ${snap.connected ? (snap.lastError ? 'red' : 'green') : ''}">${esc(snap.label)}</span>
      </div>
      <ul class="kv">
        <li><span>상태</span><b>${esc(!cfg.token ? '연동 안 됨' : cfg.lastError ? '오류' : (cfg.auto ? '연동됨 · 자동 동기화 켜짐' : '연동됨 · 자동 동기화 꺼짐'))}</b></li>
        <li><span>마지막 동기화</span><b>${esc(cfg.lastSyncAt ? timeLabel(cfg.lastSyncAt) : '없음')}</b></li>
        <li><span>Gist ID</span><b>${esc(cfg.gistId || '아직 없음 (자동 생성)')}</b></li>
        <li><span>계정</span><b>${esc(cfg.owner || '확인 전')}</b></li>
        <li><span>오프라인 변경</span><b>${snap.pending ? '있음 (연결되면 자동 업로드)' : '없음'}</b></li>
      </ul>
      ${cfg.lastError ? `<p class="form-error">${esc(cfg.lastError)}</p>` : ''}
      <div class="field" style="margin-top:12px">
        <label for="f-sync-token">GitHub 토큰 (gist 권한)</label>
        <input id="f-sync-token" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="ghp_… 또는 github_pat_…" value="${esc(cfg.token)}" data-field="sync-token">
      </div>
      <div class="field">
        <label for="f-sync-gist">Gist ID (선택)</label>
        <input id="f-sync-gist" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="비워 두면 처음 저장할 때 자동으로 만듭니다" value="${esc(cfg.gistId)}" data-field="sync-gist">
      </div>
      <label class="switch-row"><input type="checkbox" id="f-sync-auto" ${cfg.auto ? 'checked' : ''} data-field="sync-auto"><span>자동 동기화 — 화면을 열 때 최신 내용을 확인하고, 수정하면 잠시 뒤 클라우드에 저장합니다</span></label>
      <div class="btn-row mt12">
        <button type="button" class="btn primary" data-act="sync-push" ${snap.busy ? 'disabled' : ''}>지금 저장 (Push)</button>
        <button type="button" class="btn" data-act="sync-pull" ${snap.busy ? 'disabled' : ''}>지금 불러오기 (Pull)</button>
        <button type="button" class="btn ghost" data-act="sync-unlink">연동 해제</button>
      </div>
      <p class="hint">토큰은 이 기기 브라우저에만 저장되고, 동기화할 때 GitHub에만 직접 요청합니다. 저장소나 페이지에는 아무것도 남지 않습니다.</p>
      <details class="sync-guide">
        <summary>토큰 발급 방법 (1분 · 폰과 컴에서 한 번씩)</summary>
        <ol class="guide-steps">
          <li><b>토큰 만들기</b> — <a href="https://github.com/settings/tokens/new?scopes=gist&amp;description=Soulmask%20Planner" target="_blank" rel="noopener noreferrer">토큰 발급 페이지 열기 ↗</a> (gist 권한이 미리 체크되어 있습니다). 맨 아래 <i>Generate token</i>을 누릅니다.</li>
          <li><b>복사</b> — 한 번만 보이는 <span class="code-inline">ghp_…</span> 값을 복사해 위 토큰 칸에 붙여넣습니다.</li>
          <li><b>연결</b> — <i>지금 저장 (Push)</i>를 누르면 비공개 Gist가 자동으로 만들어집니다. 다른 기기에서는 같은 토큰을 넣고 <i>지금 불러오기 (Pull)</i>만 누르면 이어집니다.</li>
        </ol>
        <p class="hint">Fine-grained 토큰은 <i>Gists</i> 권한만 켜면 됩니다. 공용 기기에서는 <i>연동 해제</i>로 토큰을 지워 두세요.</p>
      </details>
    </div>

    <div class="card">
      <div class="card-head"><h2>🤖 AI 입출력</h2><span class="sub">복사해서 AI에게 붙여넣기</span></div>
      <div class="io-grid">
        <button type="button" class="io-btn" data-act="copy-status"><span class="n">1</span><span>현재 게임 진행 현황<small>거점·의식 강도·부족원·보스 요약</small></span></button>
        <button type="button" class="io-btn" data-act="copy-today"><span class="n">2</span><span>오늘의 할 일<small>카테고리별 체크리스트</small></span></button>
        <button type="button" class="io-btn" data-act="copy-tribes"><span class="n">3</span><span>부족원 현황<small>정원·직업별 목표·명단 표</small></span></button>
        <button type="button" class="io-btn" data-act="copy-journal"><span class="n">4</span><span>플레이 일지<small>최근 기록 요약</small></span></button>
        <button type="button" class="io-btn" data-act="copy-full"><span class="n">5</span><span>전체 진행 현황<small>로드맵·보스·자원·유튜브까지</small></span></button>
        <button type="button" class="io-btn" data-act="bulk-import"><span class="n">＋</span><span>AI 체크리스트 일괄 등록<small>여러 줄·마크다운·JSON 붙여넣기</small></span></button>
      </div>
      <div class="btn-row mt12">
        <button type="button" class="btn small" data-act="export-md">Markdown 내보내기</button>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>💾 백업 / 복원</h2></div>
      <p class="lead">내려받기로 지금 내용을 파일로 보관하고, 백업 파일을 불러오면 지금 내용을 덮어씁니다. 가져오기 전에 현재 내용을 먼저 내려받아 두세요.</p>
      <div class="btn-row">
        <button type="button" class="btn primary" data-act="export-json">JSON 백업 내려받기</button>
        <button type="button" class="btn" data-act="copy-json">JSON 백업 복사</button>
      </div>
      <div class="btn-row mt12">
        <button type="button" class="btn" data-act="import-file">백업 파일 선택</button>
        <button type="button" class="btn" data-act="import-paste">JSON 붙여넣기</button>
      </div>
      <p class="hint">내려받기는 파일로, 복사는 클립보드로 JSON 전체를 담습니다 (핸드폰 메모·메신저에 붙여넣어 보관).</p>
      <div class="data-counts">
        <span class="chip">할 일 ${counts.todos}</span>
        <span class="chip">부족원 ${counts.members}</span>
        <span class="chip">보스 ${counts.bosses}</span>
        <span class="chip">일지 ${counts.journal}</span>
        <span class="chip">영상 ${counts.videos}</span>
      </div>
      <p class="hint">자동 저장: ${st.ok ? '켜짐' : '꺼짐(' + esc(st.note) + ')'} · 마지막 저장 ${esc(last || '-')} · 저장 위치 이 브라우저 (${esc('localStorage')})</p>
    </div>

    <div class="card">
      <div class="card-head"><h2>🧹 초기화</h2></div>
      <p class="lead">모든 기록을 지우고 처음 상태(청동기 · 의식 강도 30 · 정원 23명)로 되돌립니다.</p>
      <div class="btn-row">
        <button type="button" class="btn danger" data-act="reset-all">전체 초기화</button>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>📱 홈 화면에 설치</h2></div>
      <ol class="guide-steps">
        <li><b>안드로이드 Chrome</b> — 주소창 오른쪽 ⋮ → <i>홈 화면에 추가</i> (또는 <i>앱 설치</i>).</li>
        <li><b>아이폰 Safari</b> — 공유 버튼 → <i>홈 화면에 추가</i>.</li>
        <li>설치 후에는 오프라인에서도 열리고, 마지막으로 본 내용이 그대로 남습니다.</li>
      </ol>
    </div>`;
  },

  actions: {
    async 'copy-status'(el, ctx) {
      const ok = await copyText(buildStatus(ctx.state));
      toast(ok ? '① 현재 진행 현황을 복사했습니다' : '복사하지 못했습니다', !ok);
    },
    async 'copy-today'(el, ctx) {
      const ok = await copyText(buildTodayTodos(ctx.state, todayKey()));
      toast(ok ? '② 오늘의 할 일을 복사했습니다' : '복사하지 못했습니다', !ok);
    },
    async 'copy-tribes'(el, ctx) {
      const ok = await copyText(buildTribes(ctx.state));
      toast(ok ? '③ 부족원 현황을 복사했습니다' : '복사하지 못했습니다', !ok);
    },
    async 'copy-journal'(el, ctx) {
      const ok = await copyText(buildJournal(ctx.state, null));
      toast(ok ? '④ 플레이 일지를 복사했습니다' : '복사하지 못했습니다', !ok);
    },
    async 'copy-full'(el, ctx) {
      const ok = await copyText(buildFull(ctx.state));
      toast(ok ? '⑤ 전체 진행 현황을 복사했습니다' : '복사하지 못했습니다', !ok);
    },
    'export-md'(el, ctx) {
      const ok = downloadText(`soulmask-planner-${todayKey()}.md`, markdownExport(ctx.state), 'text/markdown');
      toast(ok ? 'Markdown 파일을 내려받았습니다' : '내보내지 못했습니다', !ok);
    },
    'export-json'(el, ctx) {
      const ok = downloadText(`soulmask-planner-backup-${todayKey()}.json`, exportJSON(ctx.state), 'application/json');
      toast(ok ? 'JSON 백업을 내려받았습니다' : '내보내지 못했습니다', !ok);
    },
    async 'copy-json'(el, ctx) {
      const ok = await copyText(exportJSON(ctx.state));
      toast(ok ? 'JSON 백업을 복사했습니다 (붙여넣어 보관하세요)' : '복사하지 못했습니다', !ok);
    },
    'import-file'(el, ctx) {
      const input = document.querySelector('#import-file');
      if (input) {
        input.value = '';
        input.click();
      }
    },
    'import-paste'(el, ctx) {
      openModal({
        title: 'JSON 붙여넣기',
        wide: true,
        bodyHTML: `${field('백업 JSON', textArea('imp-text', '', 10, 'placeholder="{ \"app\": \"soulmask-planner\", ... }"'))}<p class="form-error" hidden></p>`,
        submitLabel: '가져오기',
        danger: true,
        onSubmit: (form) => {
          const text = ctx.val(form, 'imp-text');
          const next = parseImportText(text);
          // 바깥 모달이 닫힌 뒤에 확인 창을 띄웁니다.
          setTimeout(() => { applyImport(ctx, next); }, 40);
        }
      });
    },
    'bulk-import'(el, ctx) {
      openModal({
        title: 'AI 체크리스트 일괄 등록',
        wide: true,
        bodyHTML:
          `${field('붙여넣기', textArea('bulk-text', '', 8, 'placeholder="- [ ] 광물 채집 자동화\\n- [ ] 요리 시설 건설 [건축 및 시설]\\n- [ ] 안개 개구리 도전 (높음) #보스"'), '`- [ ]`, `1.`, `[카테고리]`, `(높음)`, `#보스` 표기를 인식합니다. JSON 배열도 됩니다.')}
          <div class="field-row">
            <div class="field"><label for="bulk-date">날짜</label><input id="bulk-date" type="date" value="${esc(todayKey())}"></div>
            <div class="field"><label for="bulk-category">기본 카테고리</label>${selectInput('bulk-category', CATEGORIES, '기타')}</div>
          </div>
          <p class="form-error" hidden></p>`,
        submitLabel: '등록',
        onSubmit: (form) => {
          const text = ctx.val(form, 'bulk-text');
          const date = ctx.val(form, 'bulk-date') || todayKey();
          const category = ctx.val(form, 'bulk-category');
          const items = parseBulkImport(text, { category });
          if (!items.length) { throw new Error('인식된 항목이 없습니다.'); }
          const startOrder = ctx.state.todos.filter((t) => t.date === date).length;
          items.forEach((it, i) => {
            ctx.state.todos.push({
              id: uid('td'),
              date,
              title: it.title,
              category: it.category || category,
              priority: it.priority || '보통',
              note: it.note || '',
              done: false,
              doneAt: null,
              createdAt: new Date().toISOString(),
              order: startOrder + i,
              carriedFrom: '',
              subtasks: (it.subtasks || []).map((s) => ({ id: uid('st'), title: s.title, done: !!s.done }))
            });
          });
          ctx.commit(`${items.length}개 항목을 등록했습니다`);
        }
      });
    },
    async 'sync-push'(el, ctx) {
      try {
        await sync.push({});
        toast('클라우드에 저장했습니다');
        ctx.render();
      } catch (err) {
        toast(err && err.message ? err.message : '클라우드 저장에 실패했습니다', true);
        ctx.render();
      }
    },
    async 'sync-pull'(el, ctx) {
      const ok = await confirmAction('클라우드 내용으로 이 기기를 덮어쓸까요?\n이 기기에서 아직 올리지 않은 수정은 사라질 수 있습니다.', { title: '불러오기 확인', confirmLabel: '불러오기' });
      if (!ok) { return; }
      try {
        await sync.pull({ force: true });
        toast('클라우드에서 불러왔습니다');
        ctx.render();
      } catch (err) {
        toast(err && err.message ? err.message : '불러오지 못했습니다', true);
        ctx.render();
      }
    },
    'sync-unlink'(el, ctx) {
      confirmAction('이 기기의 토큰과 Gist 연결 정보를 지웁니다.\n클라우드(Gist)에 저장된 내용은 그대로 남습니다.', { title: '연동 해제', confirmLabel: '해제', danger: true })
        .then((ok) => {
          if (!ok) { return; }
          sync.unlink();
          ctx.commit('연동을 해제했습니다');
        });
    },
    'reset-all'(el, ctx) {
      confirmAction('모든 기록을 지우고 처음 상태로 되돌립니다.\n이 작업은 되돌릴 수 없습니다. 먼저 JSON 백업을 받아 두세요.', { title: '전체 초기화', confirmLabel: '초기화', danger: true })
        .then((ok) => {
          if (!ok) { return; }
          store.reset();
          ctx.render();
          toast('처음 상태로 초기화했습니다');
        });
    }
  },

  fields: {
    'sync-token'(el, ctx) {
      sync.saveToken({ token: el.value });
      ctx.render();
    },
    'sync-gist'(el, ctx) {
      sync.saveToken({ gistId: el.value });
      ctx.render();
    },
    'sync-auto'(el, ctx) {
      sync.saveToken({ auto: el.checked });
      if (el.checked && sync.readCfg().token) { sync.pull({ silent: true }); }
      ctx.render();
    }
  },

  afterRender(root, ctx) {
    const input = document.querySelector('#import-file');
    if (input && !input.dataset.bound) {
      input.dataset.bound = '1';
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) { return; }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const next = parseImportText(String(reader.result || ''));
            applyImport(ctx, next);
          } catch (err) {
            toast(err && err.message ? err.message : '가져오지 못했습니다', true);
          }
        };
        reader.onerror = () => toast('파일을 읽지 못했습니다', true);
        reader.readAsText(file);
      });
    }
  }
};

function applyImport(ctx, next) {
  const counts = `할 일 ${next.todos.length} · 부족원 ${next.tribes.members.length} · 일지 ${next.journal.length}`;
  openModal({
    title: '가져오기 확인',
    bodyHTML: `<p class="confirm-msg">현재 내용을 백업 파일 내용으로 덮어씁니다.<br><b>${esc(counts)}</b><br><br>계속할까요?</p>`,
    submitLabel: '덮어쓰기',
    danger: true,
    onSubmit: () => {
      store.replace(next);
      ctx.render();
      toast('백업을 불러왔습니다');
    }
  });
}

export default settings;
