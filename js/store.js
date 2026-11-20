/* Soulmask Planner — 저장소
   - localStorage 자동 저장 (soulmask_planner_v2)
   - 기존 hagilog_soulmask_manager_v1 데이터 1회 마이그레이션
   - JSON 내보내기 / 가져오기, 오프라인 대기 플래그(pendingSync)
*/
import {
  APP_ID, SCHEMA_VERSION, STORAGE_KEY, LEGACY_STORAGE_KEY, PENDING_KEY,
  CATEGORIES, PRIORITIES, createInitialState, seedRoles, seedBases
} from './data.js';
import { str, clampNum, todayKey, uid, num } from './util.js';

const listeners = new Set();

let storageOK = true;
let storageNote = '';

export function checkStorage() {
  try {
    const probe = '__sm_planner_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    storageOK = true;
  } catch (e) {
    storageOK = false;
    storageNote = (e && e.name) ? String(e.name) : '사용 불가';
  }
  return storageOK;
}

export function storageStatus() {
  return { ok: storageOK, note: storageNote };
}

/* ---------- 정규화 ---------- */

function normSubtask(s, i) {
  return {
    id: s && s.id ? String(s.id) : uid('st'),
    title: str(s && s.title, 200),
    done: !!(s && s.done),
    order: i
  };
}

function normTodo(t, i) {
  const title = str(t && t.title, 200);
  return {
    id: t && t.id ? String(t.id) : uid('td'),
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(t && t.date, 10)) ? str(t.date, 10) : todayKey(),
    title: title || '(제목 없음)',
    category: CATEGORIES.includes(t && t.category) ? t.category : '기타',
    priority: PRIORITIES.includes(t && t.priority) ? t.priority : '보통',
    note: str(t && t.note, 2000),
    done: !!(t && t.done),
    doneAt: t && t.doneAt ? String(t.doneAt) : null,
    createdAt: t && t.createdAt ? String(t.createdAt) : new Date().toISOString(),
    order: Number.isFinite(Number(t && t.order)) ? Number(t.order) : i,
    carriedFrom: str(t && t.carriedFrom, 10),
    subtasks: Array.isArray(t && t.subtasks) ? t.subtasks.map(normSubtask).filter((s) => s.title) : []
  };
}

function normMember(m, roles) {
  const roleName = str(m && m.role, 40);
  const roleExists = roles.some((r) => r.name === roleName);
  return {
    id: m && m.id ? String(m.id) : uid('mb'),
    name: str(m && m.name, 60) || '(이름 없음)',
    role: roleExists ? roleName : (roles[0] ? roles[0].name : '생산직'),
    gender: ['남', '여', '미입력'].includes(m && m.gender) ? m.gender : '미입력',
    recruited: m ? m.recruited !== false : true,
    skill: str(m && m.skill, 40),
    skillMax: str(m && (m.skillMax !== undefined && m.skillMax !== null && String(m.skillMax).trim() !== '' ? m.skillMax : m.maxProficiency), 40),
    goodTraits: str(m && m.goodTraits, 300),
    badTraits: str(m && m.badTraits, 300),
    combatSkill: str(m && m.combatSkill, 200),
    profession: str(m && m.profession, 24),
    jobTitle: str(m && m.jobTitle, 40),
    facility: str(m && m.facility, 60),
    duty: str(m && m.duty, 120),
    replaceNeeded: !!(m && m.replaceNeeded),
    note: str(m && m.note, 600)
  };
}

function normRole(r, i) {
  const name = str(r && r.name, 40) || ('직업 ' + (i + 1));
  return {
    id: r && r.id ? String(r.id) : uid('role'),
    name,
    target: clampNum(r && r.target, 0, 99),
    tone: str(r && r.tone, 12) || 'spare'
  };
}

function normalize(raw) {
  const base = createInitialState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { return base; }
  const src = (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) ? raw.data : raw;

  const out = {
    version: SCHEMA_VERSION,
    meta: {
      app: APP_ID,
      createdAt: str(src.meta && src.meta.createdAt, 40) || new Date().toISOString(),
      updatedAt: str(raw.updatedAt, 40) || str(src.meta && src.meta.updatedAt, 40) || new Date().toISOString(),
      seed: str(src.meta && src.meta.seed, 40)
    },
    profile: {
      day: (src.profile && src.profile.day !== null && src.profile.day !== '' && src.profile.day !== undefined)
        ? clampNum(src.profile.day, 0, 9999) : null,
      awareness: clampNum(src.profile && src.profile.awareness, 0, 100),
      era: str(src.profile && src.profile.era, 60) || '청동기 시대',
      base: str(src.profile && src.profile.base, 60) || '서부 우림 거점',
      capacity: clampNum(src.profile && src.profile.capacity, 1, 99),
      playHours: str(src.profile && src.profile.playHours, 20)
    },
    todos: [],
    tribes: { capacity: 0, roles: [], members: [] },
    roadmap: [],
    bosses: [],
    areas: [],
    resources: [],
    bases: [],
    facilities: [],
    journal: [],
    videos: []
  };

  const todos = Array.isArray(src.todos) ? src.todos : [];
  out.todos = todos.map(normTodo).filter((t) => t.title);

  const tribeSrc = (src.tribes && typeof src.tribes === 'object') ? src.tribes : {};
  out.tribes.roles = Array.isArray(tribeSrc.roles) && tribeSrc.roles.length
    ? tribeSrc.roles.map(normRole) : seedRoles();
  out.tribes.capacity = clampNum(tribeSrc.capacity, 1, 99);
  out.tribes.members = Array.isArray(tribeSrc.members)
    ? tribeSrc.members.map((m) => normMember(m, out.tribes.roles)) : [];
  // 프로필 정원과 부족원 정원은 같은 값입니다.
  out.profile.capacity = out.tribes.capacity;

  out.roadmap = (Array.isArray(src.roadmap) ? src.roadmap : base.roadmap).map((r, i) => ({
    id: r && r.id ? String(r.id) : 'rm-' + (i + 1),
    order: Number.isFinite(Number(r && r.order)) ? Number(r.order) : i,
    title: str(r && r.title, 80) || '단계 ' + (i + 1),
    desc: str(r && r.desc, 400),
    status: ['완료', '진행 중', '미진행'].includes(r && r.status) ? r.status : '미진행',
    prereq: Array.isArray(r && r.prereq) ? r.prereq.map(String) : [],
    checklist: Array.isArray(r && r.checklist) ? r.checklist.map((c, k) => ({
      id: c && c.id ? String(c.id) : 'rmc' + i + '-' + k,
      title: str(c && c.title, 200),
      done: !!(c && c.done)
    })).filter((c) => c.title) : []
  })).sort((a, b) => a.order - b.order);

  out.bosses = (Array.isArray(src.bosses) ? src.bosses : base.bosses).map((b, i) => ({
    id: b && b.id ? String(b.id) : 'b-' + i,
    name: str(b && b.name, 60) || '보스 ' + (i + 1),
    en: str(b && b.en, 80),
    region: str(b && b.region, 80),
    level: str(b && b.level, 20),
    awareness: (b && b.awareness !== null && b.awareness !== '' && b.awareness !== undefined)
      ? clampNum(b.awareness, 0, 100) : null,
    summon: Array.isArray(b && b.summon) ? b.summon.map((s) => ({
      name: str(s && s.name, 60),
      qty: clampNum(s && s.qty, 0, 9999)
    })).filter((s) => s.name) : [],
    cleared: !!(b && b.cleared),
    attempts: clampNum(b && b.attempts, 0, 999),
    gear: str(b && b.gear, 300),
    prep: str(b && b.prep, 500),
    rewards: str(b && b.rewards, 300),
    note: str(b && b.note, 600)
  }));

  out.areas = (Array.isArray(src.areas) ? src.areas : base.areas).map((a, i) => ({
    id: a && a.id ? String(a.id) : 'a-' + i,
    name: str(a && a.name, 80) || '지역 ' + (i + 1),
    visited: !!(a && a.visited),
    resources: str(a && a.resources, 200),
    facilities: str(a && a.facilities, 200),
    memo: str(a && a.memo, 600)
  }));

  out.resources = (Array.isArray(src.resources) ? src.resources : base.resources).map((r, i) => ({
    id: r && r.id ? String(r.id) : 'res-' + (i + 1),
    name: str(r && r.name, 60) || '자원 ' + (i + 1),
    amount: num(r && r.amount, 0),
    target: num(r && r.target, 0),
    owner: str(r && r.owner, 60),
    automated: !!(r && r.automated),
    note: str(r && r.note, 200)
  }));

  out.bases = (Array.isArray(src.bases) && src.bases.length ? src.bases : seedBases()).map((b, i) => ({
    id: b && b.id ? String(b.id) : 'base-' + i,
    name: str(b && b.name, 60) || '거점 ' + (i + 1),
    active: !!(b && b.active),
    note: str(b && b.note, 300)
  }));
  if (!out.bases.some((b) => b.active) && out.bases[0]) { out.bases[0].active = true; }

  out.facilities = (Array.isArray(src.facilities) ? src.facilities : base.facilities).map((f, i) => ({
    id: f && f.id ? String(f.id) : 'fc-' + i,
    baseId: str(f && f.baseId, 40) || out.bases[0].id,
    name: str(f && f.name, 60) || '시설 ' + (i + 1),
    status: ['완료', '건설 예정'].includes(f && f.status) ? f.status : '건설 예정',
    owner: str(f && f.owner, 60),
    product: str(f && f.product, 120),
    upgraded: !!(f && f.upgraded),
    automated: !!(f && f.automated),
    plan: str(f && f.plan, 300)
  }));

  out.journal = (Array.isArray(src.journal) ? src.journal : []).map((j, i) => ({
    id: j && j.id ? String(j.id) : uid('jr'),
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(j && j.date, 10)) ? str(j.date, 10) : todayKey(),
    day: (j && j.day !== null && j.day !== '' && j.day !== undefined) ? clampNum(j.day, 0, 9999) : null,
    hours: str(j && j.hours, 20),
    events: str(j && j.events, 4000),
    battles: str(j && j.battles, 2000),
    newMembers: str(j && j.newMembers, 600),
    newPlaces: str(j && j.newPlaces, 600),
    problems: str(j && j.problems, 2000),
    nextGoals: str(j && j.nextGoals, 2000),
    memo: str(j && j.memo, 4000),
    autoTodos: Array.isArray(j && j.autoTodos) ? j.autoTodos.map((t) => ({
      title: str(t && t.title, 200),
      done: !!(t && t.done)
    })).filter((t) => t.title) : []
  }));

  out.videos = (Array.isArray(src.videos) ? src.videos : base.videos).map((v, i) => ({
    id: v && v.id ? String(v.id) : uid('vd'),
    episode: str(v && v.episode, 40) || (i + 1) + '화',
    topic: str(v && v.topic, 200),
    scenes: str(v && v.scenes, 2000),
    timestamps: str(v && v.timestamps, 1000),
    titles: str(v && v.titles, 600),
    thumb: str(v && v.thumb, 600),
    checks: {
      cut: !!(v && v.checks && v.checks.cut),
      script: !!(v && v.checks && v.checks.script),
      tts: !!(v && v.checks && v.checks.tts),
      final: !!(v && v.checks && v.checks.final)
    },
    uploadDate: str(v && v.uploadDate, 10),
    uploaded: !!(v && v.uploaded),
    note: str(v && v.note, 600)
  }));

  return out;
}

/* ---------- 구버전(v1) 변환 ---------- */
const LEGACY_CATEGORY = {
  '거점/생산': '생산 및 자동화',
  '탐험/전투': '탐험',
  '부족/업로드': '부족원 영입'
};

function migrateLegacy(legacy) {
  const next = normalize(legacy);
  const src = (legacy && legacy.data) ? legacy.data : legacy;
  const today = todayKey();

  next.todos = (Array.isArray(src.tasks) ? src.tasks : []).map((t, i) => ({
    id: t.id ? 'legacy-' + t.id : uid('td'),
    date: (t.doneAt ? String(t.doneAt).slice(0, 10) : today),
    title: str(t.title, 200) || '(제목 없음)',
    category: LEGACY_CATEGORY[t.category] || '기타',
    priority: PRIORITIES.includes(t.priority) ? t.priority : '보통',
    note: str(t.note, 2000),
    done: !!t.done,
    doneAt: t.doneAt ? String(t.doneAt) : null,
    createdAt: t.createdAt ? String(t.createdAt) : new Date().toISOString(),
    order: i,
    carriedFrom: '',
    subtasks: []
  }));

  const roles = next.tribes.roles.slice();
  (Array.isArray(src.recruits) ? src.recruits : []).forEach((r) => {
    const name = str(r.role, 40);
    if (!name) { return; }
    const hit = roles.find((x) => x.name === name);
    if (hit) {
      hit.target = clampNum(r.target, 0, 99);
    } else {
      roles.push({ id: uid('role'), name, target: clampNum(r.target, 0, 99), tone: 'spare' });
    }
  });
  next.tribes.roles = roles;

  next.tribes.members = (Array.isArray(src.workers) ? src.workers : []).map((w) => ({
    id: w.id ? 'legacy-' + w.id : uid('mb'),
    name: str(w.name, 60) || '(이름 없음)',
    role: roles.some((r) => r.name === str(w.role, 40)) ? str(w.role, 40) : roles[0].name,
    gender: '미입력',
    recruited: true,
    skill: '',
    skillMax: '',
    goodTraits: str(w.traits, 300),
    badTraits: '',
    combatSkill: '',
    facility: '',
    duty: str(w.status, 40),
    replaceNeeded: false,
    note: str(w.note, 600)
  }));

  next.journal = (Array.isArray(src.logs) ? src.logs : []).map((l, i) => ({
    id: l.id ? 'legacy-' + l.id : uid('jr'),
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(l.date, 10)) ? str(l.date, 10) : today,
    day: (() => {
      const m = String(l.episode || '').match(/(\d+)/);
      return m ? Number(m[1]) : null;
    })(),
    hours: '',
    events: str(l.summary, 4000),
    battles: '',
    newMembers: '',
    newPlaces: '',
    problems: '',
    nextGoals: '',
    memo: str(l.highlight, 2000),
    autoTodos: []
  }));

  next.meta.seed = 'migrated-v1';
  return next;
}

/* ---------- 상태 ---------- */

export const store = {
  state: null,
  lastSavedAt: '',

  load() {
    checkStorage();
    if (!storageOK) {
      this.state = createInitialState();
      this.state.meta.updatedAt = new Date().toISOString();
      return this.state;
    }
    let raw = null;
    try { raw = window.localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        this.state = normalize(parsed);
        this.state.meta.updatedAt = str(parsed && parsed.savedAt, 40) || this.state.meta.updatedAt;
        return this.state;
      } catch (e) {
        this.state = createInitialState();
        return this.state;
      }
    }

    let legacy = null;
    try { legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY); } catch (e) { legacy = null; }
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        this.state = migrateLegacy(parsed);
        this.save({ silent: true, noPending: true });
        this.migratedFromLegacy = true;
        return this.state;
      } catch (e) { /* 손상된 구버전 데이터는 건너뜁니다 */ }
    }

    this.state = createInitialState();
    this.save({ silent: true, noPending: true });
    return this.state;
  },

  /** 현재 상태를 localStorage에 저장하고 변경 이벤트를 알립니다. */
  save(opts) {
    const o = opts || {};
    const now = new Date().toISOString();
    this.state.meta = this.state.meta || {};
    this.state.meta.updatedAt = now;
    this.state.meta.app = APP_ID;
    this.state.version = SCHEMA_VERSION;
    this.lastSavedAt = now;
    if (!storageOK) {
      if (!o.silent) { this.emit({ storageError: true }); }
      return false;
    }
    try {
      const payload = {
        app: APP_ID,
        schema: SCHEMA_VERSION,
        savedAt: now,
        updatedAt: now,
        device: deviceName(),
        data: this.state
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      if (!o.noPending) { setPending(true); }
      if (!o.silent) { this.emit(); }
      return true;
    } catch (e) {
      storageOK = false;
      storageNote = (e && e.name) ? String(e.name) : '저장 실패';
      this.emit({ storageError: true });
      return false;
    }
  },

  /** 동기화 후 서버와 같은 상태를 다시 씁니다 (내용 변경 없음). */
  touch() {
    this.lastSavedAt = new Date().toISOString();
  },

  replace(next, opts) {
    this.state = normalize(next);
    this.save(opts);
  },

  setPending(v) { setPending(v); },
  isPending,

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  emit(extra) {
    const info = extra || {};
    listeners.forEach((fn) => { try { fn(this.state, info); } catch (e) { /* 무시 */ } });
  },

  reset() {
    this.state = createInitialState();
    this.save();
  }
};

export function deviceName() {
  const ua = navigator.userAgent || '';
  const mobile = /Android|iPhone|iPad|iPod/i.test(ua);
  return (mobile ? '모바일' : 'PC') + ' · ' + (navigator.platform || 'web');
}

/* ---------- 오프라인 대기 플래그 ---------- */
export function setPending(v) {
  try {
    if (v) { window.localStorage.setItem(PENDING_KEY, String(Date.now())); }
    else { window.localStorage.removeItem(PENDING_KEY); }
  } catch (e) { /* 저장 불가 환경 */ }
}

export function isPending() {
  try { return !!window.localStorage.getItem(PENDING_KEY); } catch (e) { return false; }
}

/* ---------- 내보내기 / 가져오기 ---------- */
export function exportPayload(state) {
  return {
    app: APP_ID,
    schema: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    device: deviceName(),
    data: state || store.state
  };
}

export function exportJSON(state) {
  return JSON.stringify(exportPayload(state), null, 2);
}

export function parseImportText(text) {
  const raw = String(text || '').trim();
  if (!raw) { throw new Error('가져올 내용이 비어 있습니다.'); }
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) {
    throw new Error('JSON 형식이 아닙니다. 백업 파일(.json)인지 확인해 주세요.');
  }
  const src = (parsed && parsed.data && typeof parsed.data === 'object') ? parsed.data : parsed;
  const kinds = ['todos', 'tribes', 'roadmap', 'bosses', 'resources', 'journal', 'videos', 'profile'];
  if (!kinds.some((k) => src[k] !== undefined)) {
    throw new Error('Soulmask Planner 백업 형식이 아닙니다 (알 수 있는 항목 없음).');
  }
  return normalize(parsed);
}

export { normalize, migrateLegacy };
