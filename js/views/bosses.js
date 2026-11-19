/* 보스 & 탐험 */
import { progressBar, pct, esc, uid } from '../util.js';
import { field, textInput, textArea, openModal, confirmAction, toast } from '../ui.js';

const bosses = {
  title: '보스 · 탐험',

  sub(ctx, state) {
    const cleared = state.bosses.filter((b) => b.cleared).length;
    return `보스 ${cleared}/${state.bosses.length} 공략 · 탐험 지역 ${state.areas.filter((a) => a.visited).length}/${state.areas.length} 방문`;
  },

  render(ctx, state) {
    const cleared = state.bosses.filter((b) => b.cleared).length;
    const next = state.bosses.find((b) => !b.cleared);
    return `
    <div class="card">
      <div class="card-head"><h2>보스 공략 현황</h2><span class="sub">${cleared}/${state.bosses.length}</span></div>
      ${progressBar(pct(cleared, state.bosses.length), { tone: 'green', label: cleared === state.bosses.length ? '모두 공략' : (next ? '다음: ' + next.name : '') })}
      <p class="hint">소환 재료·의식 강도는 검증된 게임 정보입니다. 권장 장비/준비물/보상은 직접 채워 넣으세요.</p>
    </div>

    <div class="grid two">
      ${state.bosses.map((b) => `
        <div class="boss-card${b.cleared ? ' cleared' : ''}">
          <div class="boss-head">
            <div class="grow">
              <div class="boss-name">${esc(b.name)} ${b.cleared ? '<span class="chip green">공략 완료</span>' : ''}</div>
              ${b.en ? `<div class="boss-en">${esc(b.en)}</div>` : ''}
              <div class="boss-chips">
                ${b.region ? `<span class="chip">${esc(b.region)}</span>` : ''}
                ${b.level ? `<span class="chip">Lv ${esc(b.level)}</span>` : ''}
                ${b.awareness !== null ? `<span class="chip gold">의식 강도 ${b.awareness}</span>` : '<span class="chip">의식 강도 -</span>'}
              </div>
            </div>
            <button type="button" class="check-btn${b.cleared ? ' on' : ''}" data-act="toggle-cleared" data-id="${esc(b.id)}" aria-label="공략 여부">✓</button>
          </div>
          ${b.summon.length ? `<div class="mats">${b.summon.map((s) => `<span class="mat">${esc(s.name)} ×${s.qty}</span>`).join('')}</div>` : ''}
          ${b.gear ? `<p class="boss-note">장비: ${esc(b.gear)}</p>` : ''}
          ${b.prep ? `<p class="boss-note">준비물: ${esc(b.prep)}</p>` : ''}
          ${b.rewards ? `<p class="boss-note">보상: ${esc(b.rewards)}</p>` : ''}
          ${b.note ? `<p class="boss-note">${esc(b.note)}</p>` : ''}
          <div class="flex between mt8">
            <span class="attempts">도전
              <button type="button" class="step-btn" data-act="attempts-dec" data-id="${esc(b.id)}" aria-label="도전 횟수 줄이기">−</button>
              <b class="mono">${b.attempts}</b>
              <button type="button" class="step-btn" data-act="attempts-inc" data-id="${esc(b.id)}" aria-label="도전 횟수 늘리기">+</button>
              회
            </span>
            <span class="flex">
              <button type="button" class="btn small ghost" data-act="edit-boss" data-id="${esc(b.id)}">수정</button>
              <button type="button" class="btn small ghost" data-act="delete-boss" data-id="${esc(b.id)}">삭제</button>
            </span>
          </div>
        </div>`).join('')}
    </div>
    <div class="btn-row mt12">
      <button type="button" class="btn small primary" data-act="add-boss">+ 보스 추가</button>
    </div>

    <div class="card mt12">
      <div class="card-head">
        <h2>탐험 지역</h2>
        <button type="button" class="btn small" data-act="add-area">+ 지역 추가</button>
      </div>
      <div class="list">
        ${state.areas.length ? state.areas.map((a) => `
          <div class="row-item">
            <button type="button" class="check-btn${a.visited ? ' on' : ''}" data-act="toggle-visited" data-id="${esc(a.id)}" aria-label="방문 여부">✓</button>
            <div class="row-main">
              <div class="row-title">${esc(a.name)} ${a.visited ? '<span class="chip green">방문</span>' : '<span class="chip">미방문</span>'}</div>
              ${a.resources ? `<p class="row-note">자원: ${esc(a.resources)}</p>` : ''}
              ${a.facilities ? `<p class="row-note">시설/유적: ${esc(a.facilities)}</p>` : ''}
              ${a.memo ? `<p class="row-note">${esc(a.memo)}</p>` : ''}
            </div>
            <div class="row-actions">
              <button type="button" class="btn icon small" data-act="edit-area" data-id="${esc(a.id)}" aria-label="수정">✎</button>
              <button type="button" class="btn icon small" data-act="delete-area" data-id="${esc(a.id)}" aria-label="삭제">🗑</button>
            </div>
          </div>`).join('') : '<div class="empty"><p class="empty-main">등록된 지역이 없습니다</p></div>'}
      </div>
    </div>`;
  },

  actions: {
    'toggle-cleared'(el, ctx) {
      const b = ctx.state.bosses.find((x) => x.id === el.getAttribute('data-id'));
      if (!b) { return; }
      b.cleared = !b.cleared;
      if (b.cleared) { b.attempts = Math.max(1, b.attempts); }
      ctx.commit(b.cleared ? `${b.name} 공략 완료로 표시했습니다` : `${b.name}을 미공략으로 되돌렸습니다`);
    },
    'attempts-inc'(el, ctx) {
      const b = ctx.state.bosses.find((x) => x.id === el.getAttribute('data-id'));
      if (!b) { return; }
      b.attempts = Math.min(999, b.attempts + 1);
      ctx.commit();
    },
    'attempts-dec'(el, ctx) {
      const b = ctx.state.bosses.find((x) => x.id === el.getAttribute('data-id'));
      if (!b) { return; }
      b.attempts = Math.max(0, b.attempts - 1);
      ctx.commit();
    },
    'add-boss'(el, ctx) { editBoss(null, ctx); },
    'edit-boss'(el, ctx) {
      const b = ctx.state.bosses.find((x) => x.id === el.getAttribute('data-id'));
      if (b) { editBoss(b, ctx); }
    },
    'delete-boss'(el, ctx) {
      const b = ctx.state.bosses.find((x) => x.id === el.getAttribute('data-id'));
      if (!b) { return; }
      confirmAction(`"${b.name}" 보스를 목록에서 삭제할까요?`, { title: '보스 삭제', confirmLabel: '삭제', danger: true })
        .then((ok) => {
          if (!ok) { return; }
          ctx.state.bosses = ctx.state.bosses.filter((x) => x.id !== b.id);
          ctx.commit('삭제했습니다');
        });
    },
    'add-area'(el, ctx) { editArea(null, ctx); },
    'edit-area'(el, ctx) {
      const a = ctx.state.areas.find((x) => x.id === el.getAttribute('data-id'));
      if (a) { editArea(a, ctx); }
    },
    'delete-area'(el, ctx) {
      const a = ctx.state.areas.find((x) => x.id === el.getAttribute('data-id'));
      if (!a) { return; }
      confirmAction(`"${a.name}" 지역을 삭제할까요?`, { title: '지역 삭제', confirmLabel: '삭제', danger: true })
        .then((ok) => {
          if (!ok) { return; }
          ctx.state.areas = ctx.state.areas.filter((x) => x.id !== a.id);
          ctx.commit('삭제했습니다');
        });
    },
    'toggle-visited'(el, ctx) {
      const a = ctx.state.areas.find((x) => x.id === el.getAttribute('data-id'));
      if (!a) { return; }
      a.visited = !a.visited;
      ctx.commit();
    }
  }
};

function editBoss(boss, ctx) {
  const isNew = !boss;
  const b = boss || {
    name: '', en: '', region: '', level: '', awareness: null, summon: [], cleared: false,
    attempts: 0, gear: '', prep: '', rewards: '', note: ''
  };
  const mats = (b.summon || []).map((s) => `${s.name} x${s.qty}`).join('\n');
  openModal({
    title: isNew ? '보스 추가' : '보스 수정',
    wide: true,
    bodyHTML:
      `<div class="field-row">
        <div class="field"><label for="bs-name">이름</label><input id="bs-name" type="text" value="${esc(b.name)}" maxlength="60"></div>
        <div class="field"><label for="bs-en">영문명</label><input id="bs-en" type="text" value="${esc(b.en)}" maxlength="80"></div>
      </div>
      <div class="field-row three">
        <div class="field"><label for="bs-region">지역</label><input id="bs-region" type="text" value="${esc(b.region)}" placeholder="예: 우림 피라미드"></div>
        <div class="field"><label for="bs-level">레벨</label><input id="bs-level" type="text" value="${esc(b.level)}" placeholder="예: 30"></div>
        <div class="field"><label for="bs-aware">의식 강도</label><input id="bs-aware" type="number" min="0" max="100" value="${b.awareness === null ? '' : b.awareness}" placeholder="예: 30"></div>
      </div>
      ${field('소환 재료', textArea('bs-mats', mats, 4, 'placeholder="상급 생고기 x5&#10;짐승 뼈 x5"'), '한 줄에 "재료명 x수량" 형식으로 적습니다.')}
      ${field('권장 장비', textInput('bs-gear', b.gear, 'placeholder="직접 입력"'))}
      ${field('공략 준비물', textArea('bs-prep', b.prep, 2))}
      ${field('주요 보상', textInput('bs-rewards', b.rewards))}
      ${field('메모', textArea('bs-note', b.note, 2))}
      <label class="switch-row"><input type="checkbox" id="bs-cleared" ${b.cleared ? 'checked' : ''}><span>공략 완료</span></label>
      <p class="form-error" hidden></p>`,
    submitLabel: isNew ? '추가' : '저장',
    onSubmit: (form) => {
      const name = ctx.val(form, 'bs-name');
      if (!name) { throw new Error('보스 이름을 입력해 주세요.'); }
      const summon = ctx.val(form, 'bs-mats').split('\n').map((line) => {
        const m = line.trim().match(/^(.+?)\s*[xX×*]\s*(\d+)$/);
        if (!m) { return line.trim() ? { name: line.trim(), qty: 1 } : null; }
        return { name: m[1].trim(), qty: Number(m[2]) };
      }).filter(Boolean);
      const aware = ctx.val(form, 'bs-aware');
      const data = {
        name,
        en: ctx.val(form, 'bs-en'),
        region: ctx.val(form, 'bs-region'),
        level: ctx.val(form, 'bs-level'),
        awareness: aware === '' ? null : Number(aware),
        summon,
        gear: ctx.val(form, 'bs-gear'),
        prep: ctx.val(form, 'bs-prep'),
        rewards: ctx.val(form, 'bs-rewards'),
        note: ctx.val(form, 'bs-note'),
        cleared: ctx.check(form, 'bs-cleared')
      };
      if (isNew) {
        ctx.state.bosses.push(Object.assign({ id: uid('b'), attempts: 0 }, data));
      } else {
        Object.assign(boss, data);
      }
      ctx.commit(isNew ? '보스를 추가했습니다' : '저장했습니다');
    }
  });
}

function editArea(area, ctx) {
  const isNew = !area;
  const a = area || { name: '', visited: false, resources: '', facilities: '', memo: '' };
  openModal({
    title: isNew ? '지역 추가' : '지역 수정',
    bodyHTML:
      `${field('지역 이름', textInput('ar-name', a.name, 'maxlength="80" placeholder="예: 언덕 피라미드"'))}
      ${field('발견 자원', textInput('ar-res', a.resources, 'placeholder="예: 구리, 주석"'))}
      ${field('주요 시설 및 유적', textInput('ar-fac', a.facilities, 'placeholder="예: 안개 개구리 제단"'))}
      ${field('개인 공략 메모', textArea('ar-memo', a.memo, 3))}
      <label class="switch-row"><input type="checkbox" id="ar-visited" ${a.visited ? 'checked' : ''}><span>방문 완료</span></label>
      <p class="form-error" hidden></p>`,
    submitLabel: isNew ? '추가' : '저장',
    onSubmit: (form) => {
      const name = ctx.val(form, 'ar-name');
      if (!name) { throw new Error('지역 이름을 입력해 주세요.'); }
      const data = {
        name,
        resources: ctx.val(form, 'ar-res'),
        facilities: ctx.val(form, 'ar-fac'),
        memo: ctx.val(form, 'ar-memo'),
        visited: ctx.check(form, 'ar-visited')
      };
      if (isNew) { ctx.state.areas.push(Object.assign({ id: uid('a') }, data)); }
      else { Object.assign(area, data); }
      ctx.commit(isNew ? '지역을 추가했습니다' : '저장했습니다');
    }
  });
}

export default bosses;
