/* Soulmask Planner — GitHub Gist 동기화
   - 개인 토큰은 이 기기(localStorage)에만 저장하고, 저장소에는 아무것도 남기지 않습니다.
   - 토큰 소유자의 Gist만 사용합니다 (다른 사용자의 Gist는 거부).
   - 오프라인에서 수정하면 pendingSync 플래그를 남기고, 연결이 돌아오면 자동으로 올립니다.
*/
import { APP_ID, SCHEMA_VERSION, SYNC_KEY, SYNC_FILE } from './data.js';
import { store, normalize, deviceName } from './store.js';
import { str, timeLabel } from './util.js';

const API = 'https://api.github.com';

const sync = {
  busy: false,
  ready: false,
  timer: null,
  lastPullAt: '',
  me: null,
  listeners: new Set()
};

export function onSyncChange(fn) {
  sync.listeners.add(fn);
  return () => sync.listeners.delete(fn);
}

function notify() {
  sync.listeners.forEach((fn) => { try { fn(syncSnapshot()); } catch (e) { /* 무시 */ } });
}

export function readCfg() {
  const cfg = { token: '', gistId: '', auto: false, lastSyncAt: '', lastError: '', owner: '' };
  try {
    const raw = window.localStorage.getItem(SYNC_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object') {
        cfg.token = typeof p.token === 'string' ? p.token : '';
        cfg.gistId = typeof p.gistId === 'string' ? p.gistId : '';
        cfg.auto = !!p.auto;
        cfg.lastSyncAt = typeof p.lastSyncAt === 'string' ? p.lastSyncAt : '';
        cfg.lastError = typeof p.lastError === 'string' ? p.lastError : '';
        cfg.owner = typeof p.owner === 'string' ? p.owner : '';
      }
    }
  } catch (e) { /* 무시 */ }
  return cfg;
}

export function writeCfg(patch) {
  const cfg = Object.assign(readCfg(), patch || {});
  try {
    window.localStorage.setItem(SYNC_KEY, JSON.stringify({
      token: cfg.token || '',
      gistId: cfg.gistId || '',
      auto: !!cfg.auto,
      lastSyncAt: cfg.lastSyncAt || '',
      lastError: cfg.lastError || '',
      owner: cfg.owner || ''
    }));
  } catch (e) { /* 무시 */ }
  notify();
  return cfg;
}

export function syncSnapshot() {
  const cfg = readCfg();
  return {
    busy: sync.busy,
    connected: !!cfg.token,
    hasGist: !!cfg.gistId,
    auto: cfg.auto,
    lastSyncAt: cfg.lastSyncAt,
    lastError: cfg.lastError,
    owner: cfg.owner,
    gistId: cfg.gistId,
    pending: store.isPending(),
    label: chipLabel(cfg)
  };
}

export function chipLabel(cfg) {
  const c = cfg || readCfg();
  if (!navigator.onLine) { return c.token ? '오프라인 · 저장 대기' : '오프라인'; }
  if (!c.token) { return '동기화 꺼짐'; }
  if (sync.busy) { return '동기화 중'; }
  if (c.lastError) { return '동기화 오류'; }
  if (store.isPending()) { return navigator.onLine ? '저장 대기' : '오프라인 저장됨'; }
  if (c.lastSyncAt) { return timeLabel(c.lastSyncAt) + ' 동기화'; }
  return '연결됨';
}

function errMessage(status, msg) {
  if (status === 401) { return '토큰이 올바르지 않거나 만료됐습니다. 새 토큰을 발급해 주세요.'; }
  if (status === 403) { return '권한이 없습니다. 토큰에 gist 권한이 있는지 확인해 주세요.'; }
  if (status === 404) { return '연결된 Gist를 찾을 수 없습니다. Gist ID를 지우고 다시 시도해 보세요.'; }
  if (status === 422) { return '요청 형식이 올바르지 않습니다. (' + (msg || '') + ')'; }
  return 'GitHub 오류 ' + status + (msg ? ': ' + msg : '');
}

async function api(method, path, token, body) {
  const opts = {
    method,
    cache: 'no-store',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(API + path, opts);
  } catch (e) {
    throw new Error('인터넷 연결을 확인해 주세요 (GitHub에 연결하지 못했습니다)' + (e && e.message ? ' — ' + e.message : ''));
  }
  const text = await res.text();
  let json = null;
  if (text) { try { json = JSON.parse(text); } catch (e) { /* 무시 */ } }
  if (!res.ok) {
    const err = new Error(errMessage(res.status, json && json.message));
    err.status = res.status;
    throw err;
  }
  return json;
}

async function whoAmI(token) {
  if (sync.me && sync.me.token === token) { return sync.me.login; }
  const user = await api('GET', '/user', token);
  const login = user && user.login ? String(user.login) : '';
  sync.me = { token, login };
  return login;
}

function fileMap(content) {
  return { [SYNC_FILE]: { content } };
}

async function findGist(token) {
  const list = await api('GET', '/gists?per_page=100', token);
  if (!Array.isArray(list)) { return null; }
  return list.find((g) => g && g.files && g.files[SYNC_FILE]) || null;
}

export function syncPayload() {
  return {
    app: APP_ID,
    schema: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    device: deviceName(),
    data: store.state
  };
}

export async function push(opts) {
  const o = opts || {};
  const cfg = readCfg();
  if (!cfg.token) {
    if (!o.silent) { throw new Error('GitHub 토큰을 먼저 입력해 주세요.'); }
    return false;
  }
  if (sync.busy) { return false; }
  sync.busy = true;
  notify();
  try {
    const login = await whoAmI(cfg.token);
    const payload = syncPayload();
    const content = JSON.stringify(payload, null, 2);
    let gist = null;
    if (cfg.gistId) {
      gist = await api('PATCH', '/gists/' + encodeURIComponent(cfg.gistId), cfg.token, { files: fileMap(content) });
    } else {
      const found = await findGist(cfg.token);
      if (found) {
        gist = await api('PATCH', '/gists/' + encodeURIComponent(found.id), cfg.token, { files: fileMap(content) });
      } else {
        gist = await api('POST', '/gists', cfg.token, {
          description: 'Soulmask Planner 동기화 (비공개) · 하기로그',
          public: false,
          files: fileMap(content)
        });
      }
    }
    if (gist && gist.owner && gist.owner.login && login && gist.owner.login !== login) {
      throw new Error('이 토큰 소유자의 Gist가 아닙니다. Gist ID를 확인해 주세요.');
    }
    writeCfg({
      gistId: (gist && gist.id) ? gist.id : cfg.gistId,
      owner: login || cfg.owner,
      lastSyncAt: payload.updatedAt,
      lastError: ''
    });
    store.setPending(false);
    store.touch();
    const merged = Object.assign({}, store.state, { meta: Object.assign({}, store.state.meta, { updatedAt: payload.updatedAt }) });
    store.state = merged;
    notify();
    if (!o.silent) { store.emit({ synced: 'push' }); }
    return true;
  } catch (err) {
    writeCfg({ lastError: (err && err.message) ? err.message : '클라우드 저장에 실패했습니다.' });
    if (!o.silent) { throw err; }
    return false;
  } finally {
    sync.busy = false;
    notify();
  }
}

export async function pull(opts) {
  const o = opts || {};
  const cfg = readCfg();
  if (!cfg.token) {
    if (!o.silent) { throw new Error('GitHub 토큰을 먼저 입력해 주세요.'); }
    return false;
  }
  if (sync.busy) { return false; }
  sync.busy = true;
  notify();
  try {
    const login = await whoAmI(cfg.token);
    let gist = null;
    if (cfg.gistId) {
      gist = await api('GET', '/gists/' + encodeURIComponent(cfg.gistId), cfg.token);
    } else {
      gist = await findGist(cfg.token);
      if (!gist) {
        throw new Error('클라우드에 저장된 내용이 없습니다. 먼저 "지금 저장"을 눌러 주세요.');
      }
    }
    if (gist && gist.owner && gist.owner.login && login && gist.owner.login !== login) {
      throw new Error('이 토큰 소유자의 Gist가 아닙니다. Gist ID를 확인해 주세요.');
    }
    const file = gist && gist.files ? gist.files[SYNC_FILE] : null;
    if (!file) { throw new Error('동기화 파일(' + SYNC_FILE + ')이 없습니다.'); }
    let text = file.content || '';
    if (file.truncated && file.raw_url) {
      const res = await fetch(file.raw_url, { cache: 'no-store' });
      if (!res.ok) { throw new Error('클라우드 내용을 읽지 못했습니다.'); }
      text = await res.text();
    }
    const raw = JSON.parse(text);
    const cloudAt = str(raw && raw.updatedAt, 40) || '';
    const localAt = str(store.state && store.state.meta && store.state.meta.updatedAt, 40);
    const next = normalize(raw);

    if (localAt && cloudAt && localAt > cloudAt && !o.force) {
      const localPending = store.isPending();
      if (!localPending) {
        writeCfg({ gistId: gist.id || cfg.gistId, owner: login || cfg.owner, lastError: '' });
        if (!o.silent) { throw new Error('이 기기 내용이 클라우드보다 최신입니다. "지금 저장"으로 올려 주세요.'); }
        return 'local-newer';
      }
    }

    store.state = next;
    store.save({ silent: true });
    store.setPending(false);
    sync.lastPullAt = new Date().toISOString();
    writeCfg({
      gistId: (gist && gist.id) ? gist.id : cfg.gistId,
      owner: login || cfg.owner,
      lastSyncAt: cloudAt || new Date().toISOString(),
      lastError: ''
    });
    store.emit({ synced: 'pull' });
    notify();
    return true;
  } catch (err) {
    writeCfg({ lastError: (err && err.message) ? err.message : '클라우드 내용을 불러오지 못했습니다.' });
    if (!o.silent) { throw err; }
    return false;
  } finally {
    sync.busy = false;
    notify();
  }
}

export function schedulePush(delay) {
  if (!sync.ready) { return; }
  const cfg = readCfg();
  if (!cfg.auto || !cfg.token) { return; }
  if (sync.timer) { clearTimeout(sync.timer); }
  sync.timer = setTimeout(() => {
    sync.timer = null;
    if (!navigator.onLine) { store.setPending(true); notify(); return; }
    push({ silent: true });
  }, delay || 2500);
}

export function unlink() {
  try { window.localStorage.removeItem(SYNC_KEY); } catch (e) { /* 무시 */ }
  sync.me = null;
  notify();
}

export function saveToken(opts) {
  const o = opts || {};
  const patch = {};
  if (o.token !== undefined) { patch.token = String(o.token || '').trim(); }
  if (o.gistId !== undefined) {
    const raw = String(o.gistId || '').trim();
    const m = raw.match(/gist\.github\.com\/[^/]+\/([0-9a-zA-Z]+)/i);
    patch.gistId = m ? m[1] : raw;
  }
  if (o.auto !== undefined) { patch.auto = !!o.auto; }
  return writeCfg(patch);
}

export function initSync() {
  sync.ready = true;
  window.addEventListener('online', () => {
    notify();
    const cfg = readCfg();
    if (cfg.token && store.isPending()) {
      push({ silent: true });
    }
  });
  window.addEventListener('offline', () => { notify(); });
  const cfg = readCfg();
  if (cfg.token && cfg.auto) {
    pull({ silent: true });
  }
  notify();
}

export { sync };
