/* 유튜브 — 영상 회차 기획과 제작 체크 */
import { buildVideoBrief } from '../ai-io.js';
import { pct, esc, uid, copyText, todayKey } from '../util.js';
import { field, textInput, textArea, openModal, confirmAction, toast } from '../ui.js';

const CHECKS = [
  { key: 'cut', label: '컷 편집' },
  { key: 'script', label: '나레이션 대본' },
  { key: 'tts', label: 'TTS 제작' },
  { key: 'final', label: '최종 편집' }
];

const youtube = {
  title: '유튜브',

  sub(ctx, state) {
    const uploaded = state.videos.filter((v) => v.uploaded).length;
    return `하기 로그 · ${uploaded}/${state.videos.length}회 업로드 완료`;
  },

  render(ctx, state) {
    const list = state.videos.slice().sort((a, b) => {
      const na = parseInt(String(a.episode).replace(/[^\d]/g, ''), 10) || 0;
      const nb = parseInt(String(b.episode).replace(/[^\d]/g, ''), 10) || 0;
      return na - nb;
    });
    const uploaded = list.filter((v) => v.uploaded).length;
    const inWork = list.filter((v) => !v.uploaded);

    return `
    <div class="card">
      <div class="card-head"><h2>채널 진행</h2><span class="sub">${uploaded}/${list.length}</span></div>
      <div class="bar tone-green"><div class="bar-track"><div class="bar-fill" style="width:${pct(uploaded, list.length)}%"></div></div>
        <div class="bar-meta"><span>업로드 완료</span><span class="bar-val">${pct(uploaded, list.length)}%</span></div></div>
      <div class="btn-row mt12">
        <button type="button" class="btn small primary" data-act="add-video">+ 영상 추가</button>
        ${inWork.length ? `<button type="button" class="btn small" data-act="copy-brief" data-id="${esc(inWork[0].id)}">다음 회차 AI 기획 요청</button>` : ''}
      </div>
      <p class="hint">대본·제목·썸네일 문구는 담담한 일기 톤 + 소소한 드립 기준으로 요청하면 좋습니다.</p>
    </div>

    <div class="grid two">
      ${list.map((v) => {
        const done = CHECKS.filter((c) => v.checks[c.key]).length;
        return `<div class="video-card">
          <div class="flex between" style="align-items:flex-start">
            <div class="grow">
              <div class="row-title">${esc(v.episode)} ${v.uploaded ? '<span class="chip green">업로드 완료</span>' : `<span class="chip gold">${done}/4 제작</span>`}</div>
              <div class="row-sub">${esc(v.topic || '주제 미정')}</div>
            </div>
            <div class="row-actions">
              <button type="button" class="btn icon small" data-act="edit-video" data-id="${esc(v.id)}" aria-label="수정">✎</button>
              <button type="button" class="btn icon small" data-act="delete-video" data-id="${esc(v.id)}" aria-label="삭제">🗑</button>
            </div>
          </div>
          ${v.scenes ? `<p class="row-note">장면: ${esc(v.scenes)}</p>` : ''}
          ${v.timestamps ? `<p class="row-note">타임스탬프: ${esc(v.timestamps)}</p>` : ''}
          ${v.titles ? `<p class="row-note">제목 후보: ${esc(v.titles)}</p>` : ''}
          ${v.thumb ? `<p class="row-note">썸네일: ${esc(v.thumb)}</p>` : ''}
          <div class="video-checks">
            ${CHECKS.map((c) => `<label class="check-row">
              <input type="checkbox" ${v.checks[c.key] ? 'checked' : ''} data-act="toggle-check" data-id="${esc(v.id)}" data-key="${c.key}">
              <span class="small">${c.label}</span>
            </label>`).join('')}
          </div>
          <div class="flex between mt8">
            <span class="tiny muted">${v.uploadDate ? (v.uploaded ? '업로드 ' : '예정 ') + esc(v.uploadDate) : '업로드 예정일 미정'}</span>
            <span class="flex">
              <button type="button" class="btn small ${v.uploaded ? 'primary' : ''}" data-act="toggle-uploaded" data-id="${esc(v.id)}">${v.uploaded ? '업로드 완료' : '업로드 전'}</button>
              <button type="button" class="btn small ghost" data-act="copy-brief" data-id="${esc(v.id)}">AI 요청</button>
            </span>
          </div>
          ${v.note ? `<p class="row-note">${esc(v.note)}</p>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  },

  actions: {
    'add-video'(el, ctx) { editVideo(null, ctx); },
    'edit-video'(el, ctx) {
      const v = ctx.state.videos.find((x) => x.id === el.getAttribute('data-id'));
      if (v) { editVideo(v, ctx); }
    },
    'delete-video'(el, ctx) {
      const v = ctx.state.videos.find((x) => x.id === el.getAttribute('data-id'));
      if (!v) { return; }
      confirmAction(`${v.episode} 항목을 삭제할까요?`, { title: '영상 삭제', confirmLabel: '삭제', danger: true })
        .then((ok) => {
          if (!ok) { return; }
          ctx.state.videos = ctx.state.videos.filter((x) => x.id !== v.id);
          ctx.commit('삭제했습니다');
        });
    },
    'toggle-check'(el, ctx) {
      const v = ctx.state.videos.find((x) => x.id === el.getAttribute('data-id'));
      if (!v) { return; }
      const key = el.getAttribute('data-key');
      v.checks[key] = !v.checks[key];
      ctx.commit();
    },
    'toggle-uploaded'(el, ctx) {
      const v = ctx.state.videos.find((x) => x.id === el.getAttribute('data-id'));
      if (!v) { return; }
      v.uploaded = !v.uploaded;
      if (v.uploaded && !v.uploadDate) { v.uploadDate = todayKey(); }
      ctx.commit(v.uploaded ? '업로드 완료로 표시했습니다' : '업로드 전으로 되돌렸습니다');
    },
    async 'copy-brief'(el, ctx) {
      const text = buildVideoBrief(ctx.state, el.getAttribute('data-id'));
      if (!text) { return; }
      const ok = await copyText(text);
      toast(ok ? 'AI 기획 요청서를 복사했습니다' : '복사하지 못했습니다', !ok);
    }
  }
};

function editVideo(video, ctx) {
  const isNew = !video;
  const nextEp = (ctx.state.videos.length + 1) + '화';
  const v = video || {
    episode: nextEp, topic: '', scenes: '', timestamps: '', titles: '', thumb: '',
    checks: { cut: false, script: false, tts: false, final: false }, uploadDate: '', uploaded: false, note: ''
  };
  openModal({
    title: isNew ? '영상 추가' : `${v.episode} 수정`,
    wide: true,
    bodyHTML:
      `<div class="field-row">
        <div class="field"><label for="vd-ep">회차</label><input id="vd-ep" type="text" value="${esc(v.episode)}" maxlength="40" placeholder="예: 6화"></div>
        <div class="field"><label for="vd-date">업로드 예정일</label><input id="vd-date" type="date" value="${esc(v.uploadDate)}"></div>
      </div>
      ${field('콘텐츠 주제', textInput('vd-topic', v.topic, 'placeholder="예: 청동기 진입과 부족 재건"'))}
      ${field('주요 장면', textArea('vd-scenes', v.scenes, 3))}
      ${field('하이라이트 타임스탬프', textInput('vd-stamp', v.timestamps, 'placeholder="예: 03:12 첫 청동 주괴"'))}
      ${field('제목 후보', textArea('vd-titles', v.titles, 2))}
      ${field('썸네일 아이디어', textArea('vd-thumb', v.thumb, 2))}
      ${field('메모', textArea('vd-note', v.note, 2))}
      <label class="switch-row"><input type="checkbox" id="vd-uploaded" ${v.uploaded ? 'checked' : ''}><span>업로드 완료</span></label>
      <p class="form-error" hidden></p>`,
    submitLabel: isNew ? '추가' : '저장',
    onSubmit: (form) => {
      const ep = ctx.val(form, 'vd-ep');
      if (!ep) { throw new Error('회차를 입력해 주세요.'); }
      const data = {
        episode: ep,
        topic: ctx.val(form, 'vd-topic'),
        scenes: ctx.val(form, 'vd-scenes'),
        timestamps: ctx.val(form, 'vd-stamp'),
        titles: ctx.val(form, 'vd-titles'),
        thumb: ctx.val(form, 'vd-thumb'),
        uploadDate: ctx.val(form, 'vd-date'),
        note: ctx.val(form, 'vd-note'),
        uploaded: ctx.check(form, 'vd-uploaded')
      };
      if (isNew) {
        ctx.state.videos.push(Object.assign({ id: uid('vd'), checks: { cut: false, script: false, tts: false, final: false } }, data));
      } else {
        Object.assign(video, data);
      }
      ctx.commit(isNew ? '영상을 추가했습니다' : '저장했습니다');
    }
  });
}

export default youtube;
