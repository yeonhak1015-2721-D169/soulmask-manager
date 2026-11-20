/* Soulmask Planner — AI 입출력
   - 복사용 텍스트(①~⑤) 생성
   - Markdown / JSON 내보내기
   - AI 체크리스트 일괄 등록 파서 (여러 줄 텍스트 · `- [ ]` 마크다운 · JSON)
*/
import { CATEGORIES, PRIORITIES } from './data.js';
import { todayKey, dateLabel, str, lines, pct, num } from './util.js';
import { PROFICIENCY_GRADES, getMemberGrade, needsReplacement, professionLabel, memberDuty } from './tribes-util.js';

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function todoLine(t) {
  const box = t.done ? 'x' : ' ';
  const meta = [t.category, t.priority ? '우선순위 ' + t.priority : ''].filter(Boolean).join(' · ');
  let s = `- [${box}] ${t.title}${meta ? ` _(${meta})_` : ''}`;
  (t.subtasks || []).forEach((st) => {
    s += `\n   - [${st.done ? 'x' : ' '}] ${st.title}`;
  });
  return s;
}

function clearedMembers(state) {
  return (state.tribes.members || []).filter((m) => m.recruited !== false);
}

function roleCounts(state) {
  const counts = {};
  (state.tribes.roles || []).forEach((r) => { counts[r.name] = 0; });
  clearedMembers(state).forEach((m) => {
    counts[m.role] = (counts[m.role] || 0) + 1;
  });
  return counts;
}

export function overallProgress(state) {
  const rm = state.roadmap || [];
  const rmDone = rm.filter((s) => s.status === '완료').length;
  const boss = state.bosses || [];
  const bossDone = boss.filter((b) => b.cleared).length;
  const todos = state.todos || [];
  const todoDone = todos.filter((t) => t.done).length;
  const roadmapPart = rm.length ? rmDone / rm.length : 0;
  const bossPart = boss.length ? bossDone / boss.length : 0;
  const todoPart = todos.length ? todoDone / todos.length : 0;
  return {
    roadmapDone: rmDone,
    roadmapTotal: rm.length,
    bossDone,
    bossTotal: boss.length,
    todoDone,
    todoTotal: todos.length,
    percent: Math.round((roadmapPart * 0.6 + bossPart * 0.25 + todoPart * 0.15) * 100)
  };
}

/* ① 현재 게임 진행 현황 */
export function buildStatus(state) {
  const p = state.profile;
  const members = clearedMembers(state);
  const capacity = state.tribes.capacity;
  const counts = roleCounts(state);
  const roleLine = (state.tribes.roles || [])
    .map((r) => `${r.name} ${counts[r.name] || 0}/${r.target}`).join(' · ');
  const cleared = (state.bosses || []).filter((b) => b.cleared).map((b) => b.name);
  const nextBoss = (state.bosses || []).find((b) => !b.cleared);
  const todayTodos = (state.todos || []).filter((t) => t.date === todayKey());
  const doing = (state.roadmap || []).filter((s) => s.status === '진행 중');

  const out = [];
  out.push('# 소울마스크 현재 진행 현황');
  out.push(`> ${stamp()} 기준 · 하기로그 Soulmask Planner`);
  out.push('');
  out.push('## 기본 정보');
  out.push(`- 거점: ${p.base || '미입력'}`);
  out.push(`- 플레이 일차: ${p.day === null ? '미입력' : p.day + '일차'}`);
  out.push(`- 의식 강도: ${p.awareness}`);
  out.push(`- 문명 발전 단계: ${p.era}`);
  out.push(`- 부족원: ${members.length}/${capacity}명 (잔여 ${Math.max(0, capacity - members.length)}자리)`);
  out.push(`- 직업별: ${roleLine}`);
  out.push('');
  out.push('## 보스');
  out.push(`- 공략 완료: ${cleared.length ? cleared.join(', ') : '없음'}`);
  if (nextBoss) {
    out.push(`- 다음 목표: ${nextBoss.name} (${nextBoss.region}, Lv ${nextBoss.level}${nextBoss.awareness !== null ? ', 의식 강도 ' + nextBoss.awareness : ''})`);
  }
  out.push('');
  out.push('## 진행 중인 단계');
  if (doing.length) {
    doing.forEach((s) => {
      const done = s.checklist.filter((c) => c.done).length;
      out.push(`- ${s.title} (${done}/${s.checklist.length})`);
    });
  } else {
    out.push('- 없음');
  }
  out.push('');
  out.push('## 오늘 할 일');
  if (todayTodos.length) {
    out.push(`${todayTodos.filter((t) => t.done).length}/${todayTodos.length} 완료`);
    todayTodos.forEach((t) => out.push(todoLine(t)));
  } else {
    out.push('- 등록된 할 일 없음');
  }
  const overall = overallProgress(state);
  out.push('');
  out.push(`## 전체 진행률: ${overall.percent}%`);
  out.push(`- 로드맵 ${overall.roadmapDone}/${overall.roadmapTotal} · 보스 ${overall.bossDone}/${overall.bossTotal} · 할 일 ${overall.todoDone}/${overall.todoTotal}`);
  return out.join('\n');
}

/* ② 오늘의 할 일 */
export function buildTodayTodos(state, date) {
  const d = date || todayKey();
  const list = (state.todos || []).filter((t) => t.date === d).sort((a, b) => a.order - b.order);
  const done = list.filter((t) => t.done).length;
  const out = [];
  out.push(`# 오늘의 할 일 · ${dateLabel(d)}`);
  out.push('');
  if (!list.length) {
    out.push('- 등록된 할 일이 없습니다.');
    return out.join('\n');
  }
  out.push(`진행률: ${done}/${list.length} (${pct(done, list.length)}%)`);
  out.push('');
  CATEGORIES.forEach((cat) => {
    const items = list.filter((t) => t.category === cat);
    if (!items.length) { return; }
    out.push(`## ${cat}`);
    items.forEach((t) => out.push(todoLine(t)));
    out.push('');
  });
  const others = list.filter((t) => !CATEGORIES.includes(t.category));
  if (others.length) {
    out.push('## 기타');
    others.forEach((t) => out.push(todoLine(t)));
  }
  return out.join('\n').trim();
}

/* ③ 부족원 현황 */
export function buildTribes(state) {
  const members = clearedMembers(state);
  const capacity = state.tribes.capacity;
  const counts = roleCounts(state);
  const out = [];
  out.push('# 부족원 현황');
  out.push('');
  out.push(`- 정원: ${capacity}명 / 현재 ${members.length}명 / 잔여 ${Math.max(0, capacity - members.length)}자리`);
  const gradeTally = { must: 0, need: 0, review: 0, done: 0, none: 0 };
  members.forEach((m) => { const t = getMemberGrade(m).tier; gradeTally[t] = (gradeTally[t] || 0) + 1; });
  if (members.length) {
    out.push('- 숙련도 등급: ' + PROFICIENCY_GRADES.map((g) => `${g.label} ${gradeTally[g.tier] || 0}명`).join(' · ')
      + (gradeTally.none ? ` · 미입력 ${gradeTally.none}명` : ''));
  }
  out.push('');
  out.push('## 직업별 목표');
  (state.tribes.roles || []).forEach((r) => {
    const c = counts[r.name] || 0;
    out.push(`- ${r.name}: ${c}/${r.target}${c < r.target ? ` (${r.target - c}명 부족)` : ''}`);
  });
  out.push('');
  out.push('## 명단');
  if (!members.length) {
    out.push('- 등록된 부족원이 없습니다.');
    return out.join('\n');
  }
  out.push('| 이름 | 담당직업 | 직업 구분 | 현재/최대 숙련도 | 등급 | 긍정 특성 | 부정 특성 | 담당업무 | 교체 |');
  out.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  members.forEach((m) => {
    const grade = getMemberGrade(m).label;
    out.push(`| ${m.name} | ${professionLabel(m) || '-'} | ${m.role} | ${m.skill || '-'}${m.skillMax ? '/' + m.skillMax : ''} | ${grade} | ${m.goodTraits || '-'} | ${m.badTraits || '-'} | ${memberDuty(m) || '-'} | ${needsReplacement(m) ? '필요' : '-'} |`);
  });
  const replace = members.filter((m) => needsReplacement(m));
  if (replace.length) {
    out.push('');
    out.push(`교체 대상 ${replace.length}명: ${replace.map((m) => `${m.name}(${getMemberGrade(m).label})`).join(', ')}`);
  }
  return out.join('\n');
}

/* ④ 플레이 일지 */
export function buildJournal(state, date) {
  const d = date || null;
  const list = (state.journal || [])
    .filter((j) => !d || j.date === d)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!list.length) { return '# 플레이 일지\n\n- 기록이 없습니다.'; }
  const out = [];
  out.push('# 플레이 일지');
  list.slice(0, d ? 1 : 5).forEach((j) => {
    out.push('');
    out.push(`## ${dateLabel(j.date)}${j.day !== null ? ` · ${j.day}일차` : ''}${j.hours ? ` · 플레이 ${j.hours}` : ''}`);
    if (j.events) { out.push(`**주요 사건**: ${j.events}`); }
    if (j.battles) { out.push(`**전투/보스**: ${j.battles}`); }
    if (j.newMembers) { out.push(`**신규 부족원**: ${j.newMembers}`); }
    if (j.newPlaces) { out.push(`**새 장소**: ${j.newPlaces}`); }
    if (j.problems) { out.push(`**문제점**: ${j.problems}`); }
    if (j.nextGoals) { out.push(`**다음 목표**: ${j.nextGoals}`); }
    if (j.autoTodos && j.autoTodos.length) {
      out.push('**완료한 체크리스트**');
      j.autoTodos.forEach((t) => out.push(`- [${t.done ? 'x' : ' '}] ${t.title}`));
    }
    if (j.memo) { out.push(`**메모**: ${j.memo}`); }
  });
  return out.join('\n');
}

/* ⑤ 전체 진행 현황 (전 항목) */
export function buildFull(state) {
  const out = [];
  out.push(buildStatus(state));
  out.push('');
  out.push('---');
  out.push('');
  out.push(buildTribes(state));
  out.push('');
  out.push('---');
  out.push('');
  out.push('## 로드맵');
  (state.roadmap || []).forEach((s) => {
    const done = s.checklist.filter((c) => c.done).length;
    out.push(`- [${s.status === '완료' ? 'x' : ' '}] ${s.order}. ${s.title} — ${s.status} (${done}/${s.checklist.length})`);
    s.checklist.filter((c) => !c.done).forEach((c) => out.push(`   - [ ] ${c.title}`));
  });
  out.push('');
  out.push('## 보스');
  (state.bosses || []).forEach((b) => {
    out.push(`- [${b.cleared ? 'x' : ' '}] ${b.name} (${b.region}, Lv ${b.level}${b.awareness !== null ? ', 의식 강도 ' + b.awareness : ''}) — 도전 ${b.attempts}회`);
    if (b.summon.length) { out.push(`   - 소환: ${b.summon.map((s) => `${s.name}×${s.qty}`).join(', ')}`); }
  });
  out.push('');
  out.push('## 자원');
  (state.resources || []).forEach((r) => {
    const lack = num(r.amount) < num(r.target) ? ' (부족)' : '';
    out.push(`- ${r.name}: ${r.amount}/${r.target}${lack}${r.automated ? ' · 자동화' : ''}${r.owner ? ' · 담당 ' + r.owner : ''}`);
  });
  out.push('');
  out.push('## 시설');
  (state.facilities || []).forEach((f) => {
    out.push(`- ${f.name} (${f.status})${f.product ? ' · ' + f.product : ''}${f.automated ? ' · 자동화' : ''}`);
  });
  out.push('');
  out.push('## 유튜브');
  (state.videos || []).forEach((v) => {
    const checks = [
      v.checks.cut ? '컷편집' : '', v.checks.script ? '대본' : '',
      v.checks.tts ? 'TTS' : '', v.checks.final ? '최종편집' : ''
    ].filter(Boolean).join('·') || '준비 전';
    out.push(`- ${v.episode} ${v.topic || ''} — ${v.uploaded ? '업로드 완료' : '업로드 전'} (${checks})`);
  });
  return out.join('\n');
}

export function markdownExport(state) {
  return buildFull(state) + '\n\n---\n\n' + buildJournal(state, null);
}

/* ---------- AI 체크리스트 일괄 등록 파서 ---------- */

const HASH_CATEGORY = {
  '#메인': '메인 목표', '#자원': '자원 채집', '#건축': '건축 및 시설', '#부족원': '부족원 영입',
  '#생산': '생산 및 자동화', '#탐험': '탐험', '#전투': '전투 및 보스', '#보스': '전투 및 보스',
  '#장비': '장비 강화', '#기타': '기타'
};

function matchCategory(token) {
  const t = str(token).replace(/^[\[\(]|[\]\)]$/g, '').trim();
  if (!t) { return ''; }
  if (CATEGORIES.includes(t)) { return t; }
  const found = CATEGORIES.find((c) => c.replace(/\s/g, '') === t.replace(/\s/g, ''));
  return found || '';
}

/**
 * 여러 줄 텍스트 / `- [ ]` 마크다운 / JSON 배열을 할 일 목록으로 변환합니다.
 * 반환: [{ title, category, priority, note, subtasks:[{title,done}] }]
 */
export function parseBulkImport(text, defaults) {
  const d = defaults || {};
  const raw = String(text || '').trim();
  if (!raw) { return []; }

  if (raw.startsWith('[') || raw.startsWith('{')) {
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    if (parsed) {
      const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.tasks) ? parsed.tasks : (Array.isArray(parsed.todos) ? parsed.todos : null));
      if (arr) {
        return arr.map((it) => {
          const title = str(typeof it === 'string' ? it : it.title, 200);
          if (!title) { return null; }
          return {
            title,
            category: CATEGORIES.includes(it.category) ? it.category : (d.category || '기타'),
            priority: PRIORITIES.includes(it.priority) ? it.priority : (d.priority || '보통'),
            note: str(it.note, 1000),
            subtasks: Array.isArray(it.subtasks)
              ? it.subtasks.map((s) => ({ title: str(typeof s === 'string' ? s : s.title, 200), done: !!(s && s.done) })).filter((s) => s.title)
              : []
          };
        }).filter(Boolean);
      }
      return [];
    }
  }

  const out = [];
  lines(raw).forEach((line) => {
    let l = line.replace(/\s+$/, '');
    if (!l) { return; }
    if (/^#{1,6}\s/.test(l)) {
      const cat = matchCategory(l.replace(/^#{1,6}\s*/, ''));
      if (cat) { d.category = cat; }
      return;
    }
    if (/^[-*•]\s*$/.test(l)) { return; }
    const m = l.match(/^(?:[-*•]|\d+[.)])\s*(?:\[( |x|X)\])?\s*(.+)$/);
    if (!m) {
      // 머리 없는 일반 문장도 할 일로 받아들입니다.
      if (l.length > 1) {
        out.push({ title: str(l, 200), category: d.category || '기타', priority: d.priority || '보통', note: '', subtasks: [] });
      }
      return;
    }
    let title = m[2].trim();
    let category = d.category || '기타';
    let priority = d.priority || '보통';
    let subtasks = [];

    const catInline = title.match(/\[([^\]]{1,20})\]\s*/);
    if (catInline) {
      const c = matchCategory(catInline[1]);
      if (c) { category = c; title = title.replace(catInline[0], '').trim(); }
    }
    // 끝에 붙은 (높음) / #보스 표기를 순서와 상관없이 모두 떼어냅니다.
    for (let guard = 0; guard < 4; guard += 1) {
      let changed = false;
      const p = title.match(/\((높음|보통|낮음)\)\s*$/);
      if (p) {
        priority = p[1];
        title = title.replace(p[0], '').trim();
        changed = true;
      }
      const h = title.match(/(^|\s)(#\S+)\s*$/);
      if (h && HASH_CATEGORY[h[2]]) {
        category = HASH_CATEGORY[h[2]];
        title = (title.slice(0, h.index) + title.slice(h.index + h[0].length)).trim();
        changed = true;
      }
      if (!changed) { break; }
    }
    if (!title) { return; }
    out.push({ title: str(title, 200), category, priority, note: '', subtasks });
  });
  return out;
}

/* ---------- 유튜브 기획 요청서 ---------- */
export function buildVideoBrief(state, videoId) {
  const v = (state.videos || []).find((x) => x.id === videoId);
  if (!v) { return ''; }
  const p = state.profile;
  const out = [];
  out.push(`# 유튜브 기획 요청 · ${v.episode}`);
  out.push('');
  out.push(`- 채널: 하기 로그 (@Hagi-Log) — 생존게임 플레이로그, 담담한 일기 톤 + 간간이 덤덤한 드립`);
  out.push(`- 콘텐츠 주제: ${v.topic || '미정'}`);
  out.push(`- 게임 진행: ${p.base || ''} · 의식 강도 ${p.awareness} · ${p.era}`);
  if (v.scenes) { out.push(`- 주요 장면: ${v.scenes}`); }
  if (v.timestamps) { out.push(`- 하이라이트 타임스탬프: ${v.timestamps}`); }
  if (v.titles) { out.push(`- 제목 후보: ${v.titles}`); }
  if (v.thumb) { out.push(`- 썸네일 아이디어: ${v.thumb}`); }
  out.push('');
  out.push('## 요청');
  out.push('1. 위 장면들을 담담한 일기 형식 나레이션 대본으로 정리해 주세요. 과장된 하이텐션은 빼고, 한두 번 덤덤한 드립을 넣어 주세요.');
  out.push('2. 클릭을 노린 과장 문구 대신 실제 플레이 흐름에 맞는 썸네일 문구 3개를 제안해 주세요.');
  out.push('3. 영상 설명란과 태그 초안을 만들어 주세요.');
  return out.join('\n');
}
