/* 하기 로그 내레이션 스튜디오 — 앱 로직 */
import {
  DEFAULT_PROMPT,
  MODELS,
  VOICES,
  RANGE_OPTIONS,
  SPEED_OPTIONS,
  MOODS,
  buildPrompt,
  buildStyle,
  isStructuredTts,
  estimateSeconds,
  countChars,
  moodLabel,
  generateSpeech,
  testConnection,
  TtsError,
} from './tts.js';
import { SAMPLES, makeScene, scenesFromSample } from './samples.js';
import {
  CANONICAL_FORMAT,
  decodeInlineAudio,
  concatTracks,
  encodeWav,
  int16ToBytes,
  buildPeaks,
  formatDuration,
} from './wav.js';

const STORAGE_KEY = 'hagi-narration-studio:v1';
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- 상태 ---------- */

const defaults = () => ({
  apiKey: '',
  model: MODELS[0].id,
  voice: 'Orus',
  range: 'mid',
  speed: 'fast',
  gap: 650,
  prompt: DEFAULT_PROMPT,
  scenes: [makeScene({ title: '첫 장면', mood: 'daily', text: '' })],
});

let state = defaults();
let connected = false; // 이번 세션에서 연결 테스트를 통과했는지
const audioStore = new Map(); // sceneId -> { samples, peaks, duration, url, blob, compressed }
let currentSceneId = null;
let player = null;
let genController = null;
let isGenerating = false;

/* ---------- 저장 ---------- */

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 350);
}

function saveNow() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiKey: state.apiKey,
        model: state.model,
        voice: state.voice,
        range: state.range,
        speed: state.speed,
        gap: state.gap,
        prompt: state.prompt,
        scenes: state.scenes.map(({ id, title, mood, text }) => ({ id, title, mood, text })),
      }),
    );
  } catch (error) {
    toast('브라우저 저장에 실패했어요. 시크릿 모드라면 일반 창에서 열어 주세요.', { error: true });
  }
}

function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    const next = defaults();
    if (typeof saved.apiKey === 'string') next.apiKey = saved.apiKey;
    if (typeof saved.model === 'string' && saved.model.trim()) next.model = saved.model.trim();
    if (VOICES.some((v) => v.id === saved.voice)) next.voice = saved.voice;
    if (RANGE_OPTIONS.some((r) => r.id === saved.range)) next.range = saved.range;
    if (SPEED_OPTIONS.some((s) => s.id === saved.speed)) next.speed = saved.speed;
    if (Number.isFinite(saved.gap)) next.gap = Math.min(900, Math.max(0, Math.round(saved.gap)));
    if (typeof saved.prompt === 'string' && saved.prompt.trim()) next.prompt = saved.prompt;
    if (Array.isArray(saved.scenes) && saved.scenes.length) {
      next.scenes = saved.scenes.slice(0, 60).map((raw) => {
        const scene = raw && typeof raw === 'object' ? raw : {};
        const built = makeScene({
          title: typeof scene.title === 'string' ? scene.title : '',
          mood: MOODS.some((m) => m.id === scene.mood) ? scene.mood : 'daily',
          text: typeof scene.text === 'string' ? scene.text : '',
        });
        if (typeof scene.id === 'string' && scene.id) built.id = scene.id;
        return built;
      });
    }
    state = next;
  } catch {
    state = defaults();
  }
}

/* ---------- 작은 도구 ---------- */

function toast(message, { error = false, ms = 2600 } = {}) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast${error ? ' err' : ''}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .2s ease';
    setTimeout(() => el.remove(), 220);
  }, ms);
}

function safeFileName(text) {
  return String(text || '')
    .replace(/[\\/:*?"<>|\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40) || 'scene';
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function activeModel() {
  return (state.model || MODELS[0].id).trim();
}

function fmtSeconds(sec) {
  if (sec < 60) return `${Math.round(sec)}초`;
  return formatDuration(sec);
}

/** 조용한 원고도 파형이 보이도록 표시용 게인만 올린다(음성 데이터는 그대로). */
function boostPeaks(peaks) {
  const max = Math.max(...peaks, 0);
  if (!max || max >= 0.55) return peaks;
  const gain = Math.min(3.4, 0.92 / max);
  return peaks.map((p) => Math.min(1, p * gain));
}

/* ---------- 렌더: 키 / 모델 ---------- */

function renderKeyState() {
  const chip = $('#status-chip');
  const pill = $('#key-pill');
  const hasKey = Boolean(state.apiKey.trim());

  if (!hasKey) {
    chip.dataset.state = 'empty';
    $('#status-text').textContent = '키 없음';
    pill.className = 'pill';
    pill.textContent = '미연결';
  } else if (connected) {
    chip.dataset.state = 'ready';
    $('#status-text').textContent = '연결됨';
    pill.className = 'pill ok';
    pill.textContent = '연결됨';
  } else {
    chip.dataset.state = 'warn';
    $('#status-text').textContent = '키 입력됨';
    pill.className = 'pill warn';
    pill.textContent = '테스트 전';
  }
  $('#model-current').textContent = activeModel();
  $('#model-note').textContent = isStructuredTts(activeModel())
    ? '3.8 계열은 발성 지시문을 「연기 지시(style)」로 분리해 보내고 대본만 읽어요. 404가 나면 「안정 · 무료 티어」로 바꾸세요.'
    : '모델이 404로 막히면 「안정 · 무료 티어」로 바꾸거나 직접 입력해 보세요.';
  $$('#model-seg button').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.id === state.model));
  });
}

function renderModels() {
  const seg = $('#model-seg');
  seg.innerHTML = MODELS.map(
    (m) => `<button type="button" data-id="${m.id}" aria-pressed="false">
      <b>${m.label}</b><small>${m.short || m.id}</small>
    </button>`,
  ).join('');
  seg.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-id]');
    if (!btn) return;
    state.model = btn.dataset.id;
    $('#model-custom').value = '';
    renderKeyState();
    scheduleSave();
  });
}

/* ---------- 렌더: 화자 / 세그먼트 ---------- */

function renderVoices() {
  const list = $('#voice-list');
  list.innerHTML = VOICES.map(
    (voice) => `<button type="button" class="voice-opt" role="radio" aria-checked="${voice.id === state.voice}" data-id="${voice.id}">
      <span class="v-top">
        <span class="v-name">${voice.name}</span>
        <span class="v-range">· ${voice.range}</span>
        ${voice.badge ? `<span class="v-badge">${voice.badge}</span>` : ''}
      </span>
      <span class="v-desc">${voice.desc}</span>
    </button>`,
  ).join('');
  $('#voice-pill').textContent = state.voice;

  list.addEventListener('click', (event) => {
    const btn = event.target.closest('.voice-opt');
    if (!btn) return;
    state.voice = btn.dataset.id;
    $$('.voice-opt', list).forEach((el) => el.setAttribute('aria-checked', String(el === btn)));
    $('#voice-pill').textContent = state.voice;
    scheduleSave();
  });
}

function renderSegGroup(target, options, current, key) {
  const el = typeof target === 'string' ? $(target) : target;
  el.innerHTML = options
    .map(
      (option) =>
        `<button type="button" data-id="${option.id}" aria-pressed="${option.id === current}">${option.label}</button>`,
    )
    .join('');
  el.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-id]');
    if (!btn) return;
    state[key] = btn.dataset.id;
    $$('button[data-id]', el).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    if (key === 'speed') renderSceneListMeta();
    scheduleSave();
  });
}

function renderGap() {
  const range = $('#gap-range');
  range.value = String(state.gap);
  $('#gap-value').textContent = `${state.gap}ms`;
  const percent = (state.gap / 900) * 100;
  range.style.setProperty('--fill', `${percent}%`);
  $('#mon-hint').textContent = `전환 무음 ${state.gap}ms · 생성된 장면 ${audioStore.size}/${state.scenes.length}`;
}

/* ---------- 렌더: 지시문 ---------- */

function renderPrompt() {
  const area = $('#prompt-text');
  if (area.value !== state.prompt) area.value = state.prompt;
  $('#prompt-count').textContent = `${state.prompt.length.toLocaleString('ko-KR')}자`;
  $('#prompt-state').textContent = state.prompt.trim() === DEFAULT_PROMPT.trim() ? '원본' : '수정됨';
}

/* ---------- 렌더: 샘플 ---------- */

function renderSamples() {
  const list = $('#sample-list');
  list.innerHTML = SAMPLES.map(
    (sample) => `<button type="button" class="sample-card" data-id="${sample.id}">
      <span class="s-ico" aria-hidden="true">📼</span>
      <span class="s-body">
        <span class="s-title">${sample.title}</span>
        <span class="s-desc">${sample.desc} · ${sample.scenes.length}장면</span>
      </span>
      <span class="s-go">불러오기</span>
    </button>`,
  ).join('');

  list.addEventListener('click', (event) => {
    const btn = event.target.closest('.sample-card');
    if (!btn) return;
    const sample = SAMPLES.find((s) => s.id === btn.dataset.id);
    if (!sample) return;
    const hasText = state.scenes.some((scene) => scene.text.trim());
    if (hasText && !confirm('지금 대본을 샘플로 바꿀까요? 작성 중인 장면은 사라집니다.')) return;
    resetAudio();
    state.scenes = scenesFromSample(sample);
    renderScenes();
    saveNow();
    toast(`「${sample.title}」 ${sample.scenes.length}장면을 불러왔어요.`);
    $('#sec-script').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ---------- 렌더: 장면 ---------- */

const moodOptionsHtml = () => MOODS.map((m) => `<option value="${m.id}">${m.label}</option>`).join('');

function sceneStatus(scene) {
  const audio = audioStore.get(scene.id);
  if (genController && scene._generating) return { label: '생성 중', cls: 'warn', dot: '#f59e0b' };
  if (scene._error) return { label: '실패', cls: 'bad', dot: '#f87171' };
  if (audio) return { label: audio.compressed ? '완료(MP3)' : '완료', cls: 'ok', dot: '#4ade80' };
  return { label: '대기', cls: '', dot: '#6c7789' };
}

function sceneCardHtml(scene, index) {
  const status = sceneStatus(scene);
  return `<article class="scene" data-id="${scene.id}" data-active="${currentSceneId === scene.id}">
    <div class="scene-head">
      <span class="scene-no">${index + 1}</span>
      <input class="scene-title" data-field="title" type="text" value="${escapeAttr(scene.title)}" placeholder="장면 제목" aria-label="${index + 1}번 장면 제목">
      <div class="scene-tools">
        <select data-field="mood" aria-label="${index + 1}번 장면 분위기">${moodOptionsHtml()}</select>
        <button type="button" class="tool-btn" data-act="up" aria-label="위로" title="위로">↑</button>
        <button type="button" class="tool-btn" data-act="down" aria-label="아래로" title="아래로">↓</button>
        <button type="button" class="tool-btn" data-act="dup" aria-label="복제" title="복제">⧉</button>
        <button type="button" class="tool-btn" data-act="del" aria-label="삭제" title="삭제">✕</button>
      </div>
    </div>
    <div class="scene-body">
      <div class="scene-meta">
        <span class="st"><span class="dot" style="background:${status.dot}"></span><span data-role="status">${status.label}</span></span>
        <span class="sep">·</span>
        <span><b data-role="chars">${countChars(scene.text)}</b>자</span>
        <span class="sep">·</span>
        <span><i data-role="dur-prefix" class="dur-prefix">약 </i><b data-role="dur">${fmtSeconds(estimateSeconds(scene.text, state.speed))}</b></span>
        <span class="sep">·</span>
        <span data-role="mood-label">${moodLabel(scene.mood)}</span>
      </div>
      <textarea data-field="text" rows="4" placeholder="이 장면에서 읽을 대본을 적으세요. 빈 줄로 문단을 나누면 호흡이 자연스러워집니다." aria-label="${index + 1}번 장면 대본">${escapeHtml(scene.text)}</textarea>
      <div class="scene-foot">
        <button type="button" class="btn sm" data-act="play">▶ 듣기</button>
        <button type="button" class="btn sm gen" data-act="gen">음성 생성</button>
        <button type="button" class="btn sm ghost" data-act="wav">WAV</button>
      </div>
      <p class="scene-error" data-role="error" hidden></p>
    </div>
  </article>`;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

function autoGrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  const max = 320;
  const next = Math.min(el.scrollHeight + 2, max);
  el.style.height = `${next}px`;
  el.style.overflowY = el.scrollHeight + 2 > max ? 'auto' : 'hidden';
}

function renderScenes() {
  const list = $('#scene-list');
  if (!state.scenes.length) {
    list.innerHTML = '';
  } else {
    list.innerHTML = state.scenes.map((scene, index) => sceneCardHtml(scene, index)).join('');
  }
  state.scenes.forEach((scene) => {
    const card = list.querySelector(`.scene[data-id="${scene.id}"]`);
    const sel = card && card.querySelector('select[data-field="mood"]');
    if (sel) sel.value = scene.mood;
  });
  $('#scene-empty').hidden = state.scenes.length > 0;
  $('#scene-pill').textContent = `${state.scenes.length}장면`;
  $$('#scene-list textarea').forEach(autoGrow);
  renderSummary();
  renderMonitor();
}

function renderSummary() {
  const chars = state.scenes.reduce((sum, scene) => sum + countChars(scene.text), 0);
  const est = state.scenes.reduce((sum, scene) => sum + estimateSeconds(scene.text, state.speed), 0);
  const gaps = Math.max(0, state.scenes.length - 1) * (state.gap / 1000);
  const done = state.scenes.filter((s) => audioStore.has(s.id)).length;
  const realSec = state.scenes.reduce((sum, s) => {
    const audio = audioStore.get(s.id);
    return sum + (audio && audio.duration ? audio.duration : 0);
  }, 0);
  const parts = [
    `장면 <b>${state.scenes.length}</b>개`,
    `글자 <b>${chars.toLocaleString('ko-KR')}</b>자`,
    `예상 <b>${fmtSeconds(est + gaps)}</b>`,
    `생성 <b>${done}/${state.scenes.length}</b>`,
  ];
  if (realSec > 0) parts.push(`실측 <b>${fmtSeconds(realSec + gaps)}</b>`);
  $('#wb-summary').innerHTML = parts
    .map((part) => `<span class="m">${part}</span>`)
    .join('<span class="sep">·</span>');
  $('#scene-pill').textContent = `${state.scenes.length}장면`;
}

function renderSceneListMeta() {
  state.scenes.forEach((scene) => {
    const card = $('#scene-list').querySelector(`.scene[data-id="${scene.id}"]`);
    if (!card) return;
    card.querySelector('[data-role="chars"]').textContent = String(countChars(scene.text));
    card.querySelector('[data-role="dur"]').textContent = fmtSeconds(estimateSeconds(scene.text, state.speed));
  });
  renderSummary();
}

function updateSceneCard(id) {
  const scene = state.scenes.find((s) => s.id === id);
  if (!scene) return;
  const card = $('#scene-list').querySelector(`.scene[data-id="${id}"]`);
  if (!card) return;
  const status = sceneStatus(scene);
  const statusEl = card.querySelector('[data-role="status"]');
  statusEl.textContent = status.label;
  statusEl.parentElement.querySelector('.dot').style.background = status.dot;
  card.querySelector('[data-role="chars"]').textContent = String(countChars(scene.text));
  const audio = audioStore.get(id);
  const durEl = card.querySelector('[data-role="dur"]');
  const prefixEl = card.querySelector('[data-role="dur-prefix"]');
  if (audio && audio.duration) {
    prefixEl.textContent = '';
    durEl.textContent = fmtSeconds(audio.duration);
  } else {
    prefixEl.textContent = '약 ';
    durEl.textContent = fmtSeconds(estimateSeconds(scene.text, state.speed));
  }
  card.querySelector('[data-role="mood-label"]').textContent = moodLabel(scene.mood);
  const playBtn = card.querySelector('[data-act="play"]');
  const wavBtn = card.querySelector('[data-act="wav"]');
  playBtn.disabled = !audio;
  wavBtn.disabled = !audio || Boolean(audio.compressed);
  playBtn.textContent = currentSceneId === id && player && !player.paused ? '❚❚ 일시정지' : '▶ 듣기';
  const genBtn = card.querySelector('[data-act="gen"]');
  genBtn.disabled = isGenerating;
  genBtn.innerHTML = scene._generating ? '<span class="spinner"></span> 생성 중' : '음성 생성';
  const errorEl = card.querySelector('[data-role="error"]');
  if (scene._error) {
    errorEl.textContent = scene._error;
    errorEl.hidden = false;
  } else {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }
  card.dataset.active = String(currentSceneId === id);
}

function refreshAllCards() {
  state.scenes.forEach((scene) => updateSceneCard(scene.id));
  renderSummary();
  renderMonitor();
}

/* ---------- 장면 편집 이벤트 ---------- */

function invalidateSceneAudio(id) {
  const audio = audioStore.get(id);
  if (!audio) return false;
  if (audio.url) URL.revokeObjectURL(audio.url);
  audioStore.delete(id);
  if (currentSceneId === id) {
    currentSceneId = null;
    stopPlayer();
  }
  renderMonitor();
  return true;
}

function bindScenes() {
  const list = $('#scene-list');

  list.addEventListener('input', (event) => {
    const card = event.target.closest('.scene');
    if (!card) return;
    const scene = state.scenes.find((s) => s.id === card.dataset.id);
    if (!scene) return;
    const field = event.target.dataset.field;
    if (!field) return;
    scene[field] = event.target.value;
    if (field === 'text') {
      invalidateSceneAudio(scene.id);
      autoGrow(event.target);
      card.querySelector('[data-role="chars"]').textContent = String(countChars(scene.text));
      card.querySelector('[data-role="dur"]').textContent = fmtSeconds(estimateSeconds(scene.text, state.speed));
      card.querySelector('[data-role="dur-prefix"]').textContent = '약 ';
      renderSummary();
      updateSceneCard(scene.id);
    }
    if (field === 'title') {
      renderSummary();
    }
    scheduleSave();
  });

  list.addEventListener('change', (event) => {
    const card = event.target.closest('.scene');
    if (!card) return;
    const scene = state.scenes.find((s) => s.id === card.dataset.id);
    if (!scene) return;
    if (event.target.dataset.field === 'mood') {
      scene.mood = event.target.value;
      invalidateSceneAudio(scene.id);
      card.querySelector('[data-role="mood-label"]').textContent = moodLabel(scene.mood);
      updateSceneCard(scene.id);
      scheduleSave();
    }
  });

  list.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-act]');
    if (!btn) return;
    const card = btn.closest('.scene');
    const scene = state.scenes.find((s) => s.id === card.dataset.id);
    if (!scene) return;
    const index = state.scenes.indexOf(scene);
    switch (btn.dataset.act) {
      case 'up':
        if (index > 0) moveScene(index, index - 1);
        break;
      case 'down':
        if (index < state.scenes.length - 1) moveScene(index, index + 1);
        break;
      case 'dup': {
        const copy = makeScene({ title: `${scene.title || '장면'} 복사`, mood: scene.mood, text: scene.text });
        state.scenes.splice(index + 1, 0, copy);
        renderScenes();
        saveNow();
        break;
      }
      case 'del':
        if (state.scenes.length === 1 && !scene.text.trim()) {
          toast('장면이 최소 하나는 있어야 해요.');
          break;
        }
        state.scenes.splice(index, 1);
        audioStore.delete(scene.id);
        if (currentSceneId === scene.id) {
          currentSceneId = null;
          stopPlayer();
        }
        renderScenes();
        saveNow();
        break;
      case 'play':
        togglePlay(scene.id);
        break;
      case 'gen':
        generateOne(scene);
        break;
      case 'wav':
        downloadSceneWav(scene);
        break;
      default:
        break;
    }
  });

  list.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      const card = event.target.closest('.scene');
      if (!card) return;
      const scene = state.scenes.find((s) => s.id === card.dataset.id);
      if (scene) {
        event.preventDefault();
        generateOne(scene);
      }
    }
  });
}

function moveScene(from, to) {
  const [scene] = state.scenes.splice(from, 1);
  state.scenes.splice(to, 0, scene);
  renderScenes();
  saveNow();
}

/* ---------- 생성 ---------- */

function resetAudio() {
  stopPlayer();
  audioStore.forEach((audio) => {
    if (audio.url) URL.revokeObjectURL(audio.url);
  });
  audioStore.clear();
  currentSceneId = null;
  state.scenes.forEach((scene) => {
    delete scene._error;
    delete scene._generating;
  });
}

async function generateOne(scene) {
  if (isGenerating) {
    toast('이미 생성 중이에요. 끝난 뒤에 다시 눌러 주세요.');
    return;
  }
  if (!state.apiKey.trim()) {
    toast('먼저 Gemini API 키를 넣어 주세요.', { error: true });
    $('#api-key').focus();
    $('#sec-key').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (!scene.text.trim()) {
    toast('이 장면의 대본이 비어 있어요.', { error: true });
    return;
  }

  isGenerating = true;
  genController = new AbortController();
  scene._generating = true;
  delete scene._error;
  refreshAllCards();
  $('#cancel-all').hidden = false;
  $('#gen-msg').textContent = '음성을 만들고 있어요…';
  const progress = $('#gen-progress');
  progress.hidden = false;
  progress.querySelector('i').style.width = '8%';

  try {
    await synthScene(scene, genController.signal);
    connected = true;
    renderKeyState();
    progress.querySelector('i').style.width = '100%';
    $('#gen-msg').textContent = `${scene.title || '장면'} 완료 · ${formatDuration(audioStore.get(scene.id)?.duration || 0)}`;
    if (!currentSceneId) setCurrentScene(scene.id, { autoplay: true });
  } catch (error) {
    scene._error = error.message || '생성에 실패했어요.';
    if (error.kind === 'cancel') {
      $('#gen-msg').textContent = '생성을 중지했어요.';
    } else {
      $('#gen-msg').textContent = '';
      toast(scene._error, { error: true, ms: 4200 });
    }
  } finally {
    scene._generating = false;
    isGenerating = false;
    genController = null;
    $('#cancel-all').hidden = true;
    setTimeout(() => {
      if (!$('#gen-msg').textContent.includes('완료')) progress.hidden = true;
    }, 900);
    refreshAllCards();
  }
}

async function synthScene(scene, signal) {
  const prompt = buildPrompt({
    basePrompt: state.prompt,
    mood: scene.mood,
    range: state.range,
    speed: state.speed,
    gapMs: state.gap,
    text: scene.text,
  });
  const style = buildStyle({
    basePrompt: state.prompt,
    mood: scene.mood,
    range: state.range,
    speed: state.speed,
    gapMs: state.gap,
  });
  const result = await generateSpeech({
    apiKey: state.apiKey.trim(),
    model: activeModel(),
    voiceName: state.voice,
    prompt,
    transcript: scene.text,
    style,
    signal,
  });
  const decoded = decodeInlineAudio(result.base64, result.mimeType);
  if (!decoded.samples || !decoded.samples.length) {
    throw new TtsError(
      '음성 데이터를 해석하지 못했어요(예상치 못한 형식). 모델을 바꿔 다시 시도해 주세요.',
      { kind: 'format', detail: decoded.mimeType },
    );
  }

  const samples = decoded.canonical;
  const duration = samples.length / CANONICAL_FORMAT.sampleRate;
  const wavBytes = encodeWav(int16ToBytes(samples), CANONICAL_FORMAT);
  const blob = new Blob([wavBytes], { type: 'audio/wav' });
  const previous = audioStore.get(scene.id);
  if (previous && previous.url) URL.revokeObjectURL(previous.url);

  audioStore.set(scene.id, {
    samples,
    peaks: boostPeaks(buildPeaks(samples, 260)),
    duration,
    blob,
    url: URL.createObjectURL(blob),
    compressed: false,
    mimeType: decoded.mimeType,
  });
  renderSummary();
  renderMonitor();
}

async function generateAll() {
  if (isGenerating) {
    toast('이미 생성 중이에요.');
    return;
  }
  if (!state.apiKey.trim()) {
    toast('먼저 Gemini API 키를 넣어 주세요.', { error: true });
    $('#sec-key').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const targets = state.scenes.filter((scene) => scene.text.trim());
  if (!targets.length) {
    toast('대본이 있는 장면이 없어요.', { error: true });
    return;
  }

  isGenerating = true;
  genController = new AbortController();
  const progress = $('#gen-progress');
  progress.hidden = false;
  $('#cancel-all').hidden = false;
  refreshAllCards();

  let done = 0;
  let failed = 0;
  for (let i = 0; i < targets.length; i += 1) {
    if (genController.signal.aborted) break;
    const scene = targets[i];
    scene._generating = true;
    delete scene._error;
    updateSceneCard(scene.id);
    $('#gen-msg').textContent = `장면 ${i + 1}/${targets.length} · ${scene.title || '제목 없음'} 생성 중…`;
    progress.querySelector('i').style.width = `${Math.round(((i + 0.15) / targets.length) * 100)}%`;
    try {
      await synthScene(scene, genController.signal);
      connected = true;
      renderKeyState();
      done += 1;
      if (!currentSceneId) setCurrentScene(scene.id, { autoplay: false });
    } catch (error) {
      if (error.kind === 'cancel') {
        scene._generating = false;
        updateSceneCard(scene.id);
        break;
      }
      scene._error = error.message;
      failed += 1;
      if (error.status === 429) {
        // 무료 티어 한도: 남은 장면은 건너뛰고 바로 알린다.
        scene._generating = false;
        updateSceneCard(scene.id);
        toast(scene._error, { error: true, ms: 5000 });
        break;
      }
    } finally {
      scene._generating = false;
      updateSceneCard(scene.id);
    }
    progress.querySelector('i').style.width = `${Math.round(((i + 1) / targets.length) * 100)}%`;
  }

  isGenerating = false;
  genController = null;
  $('#cancel-all').hidden = true;
  $('#gen-msg').textContent = failed
    ? `완료 ${done} · 실패 ${failed} — 실패한 장면은 따로 다시 생성해 주세요.`
    : `완료 ${done}/${targets.length} · 전환 무음 ${state.gap}ms`;
  refreshAllCards();
  if (done) toast(`${done}개 장면 음성을 만들었어요.`);
}

function cancelGeneration() {
  if (genController) genController.abort();
}

/* ---------- 재생 / 모니터 ---------- */

function setCurrentScene(id, { autoplay = false } = {}) {
  const audio = audioStore.get(id);
  if (!audio) return;
  currentSceneId = id;
  if (!player) {
    player = new Audio();
    player.preload = 'auto';
    player.addEventListener('timeupdate', onTimeUpdate);
    player.addEventListener('ended', onEnded);
    player.addEventListener('play', () => refreshAllCards());
    player.addEventListener('pause', () => refreshAllCards());
    player.addEventListener('loadedmetadata', onTimeUpdate);
  }
  player.src = audio.url;
  $('#mon-title').textContent = state.scenes.find((s) => s.id === id)?.title || '장면';
  $('#mon-idle').hidden = true;
  $('#mon-play').disabled = false;
  $('#mon-download').disabled = false;
  if (autoplay) {
    player.play().catch(() => {});
  }
  drawWave(0);
  refreshAllCards();
  renderMonitor();
}

function togglePlay(id) {
  if (id && currentSceneId !== id) {
    setCurrentScene(id, { autoplay: true });
    return;
  }
  if (!player || !currentSceneId) return;
  if (player.paused) player.play().catch(() => {});
  else player.pause();
}

function stopPlayer() {
  if (player) {
    player.pause();
    player.removeAttribute('src');
    player.load();
  }
}

function onTimeUpdate() {
  const duration = currentSceneId ? audioStore.get(currentSceneId)?.duration || 0 : 0;
  const time = player?.currentTime || 0;
  $('#mon-time').textContent = `${formatDuration(time)} / ${formatDuration(duration)}`;
  drawWave(duration ? time / duration : 0);
  const card = currentSceneId && $('#scene-list').querySelector(`.scene[data-id="${currentSceneId}"]`);
  if (card) {
    const btn = card.querySelector('[data-act="play"]');
    btn.textContent = player && !player.paused ? '❚❚ 일시정지' : '▶ 듣기';
  }
  $('#mon-play').textContent = player && !player.paused ? '❚❚ 일시정지' : '▶ 재생';
}

function onEnded() {
  $('#mon-play').textContent = '▶ 재생';
  refreshAllCards();
}

function renderMonitor() {
  const done = state.scenes.filter((s) => audioStore.has(s.id)).length;
  $('#mon-hint').textContent = `전환 무음 ${state.gap}ms · 생성된 장면 ${done}/${state.scenes.length}`;
  const audio = currentSceneId ? audioStore.get(currentSceneId) : null;
  if (audio) {
    $('#mon-idle').hidden = true;
    $('#mon-title').textContent = state.scenes.find((s) => s.id === currentSceneId)?.title || '장면';
    $('#mon-sub').textContent = formatDuration(audio.duration);
    $('#mon-play').disabled = false;
    $('#mon-download').disabled = false;
  } else {
    $('#mon-idle').hidden = false;
    $('#mon-title').textContent = '오디오 모니터 대기 중';
    $('#mon-sub').textContent = `장면 ${state.scenes.length}개`;
    $('#mon-play').disabled = true;
    $('#mon-download').disabled = true;
    $('#mon-time').textContent = '0:00';
    drawWave(0);
  }
  $('#mon-dot').style.background = audio ? '#4ade80' : '#6c7789';
  $('#mon-merge').disabled = done === 0;
  $('#mon-merge').textContent = done > 1 ? '전체 합쳐서 WAV' : 'WAV 합치기';
}

/* ---------- 파형 ---------- */

function drawWave(progress = 0) {
  const canvas = $('#mon-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.round(rect.height) || 46;
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const audio = currentSceneId ? audioStore.get(currentSceneId) : null;
  const peaks = audio?.peaks || null;
  const bars = Math.max(24, Math.floor(width / 3.4));
  const barWidth = width / bars;
  const mid = height / 2;

  for (let i = 0; i < bars; i += 1) {
    let value = 0;
    if (peaks && peaks.length) {
      const at = Math.min(peaks.length - 1, Math.floor((i / bars) * peaks.length));
      value = peaks[at];
    } else {
      continue; // 대기 중에는 잔물결 없이 빈 판으로 둔다
    }
    const h = Math.max(2, value * (height - 8));
    const x = i * barWidth;
    const played = peaks ? i / bars <= progress : false;
    ctx.fillStyle = peaks ? (played ? '#f59e0b' : '#3a4354') : '#232a36';
    ctx.fillRect(x + 1, mid - h / 2, Math.max(1.5, barWidth - 2), h);
  }

  if (peaks && progress > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, .55)';
    ctx.fillRect(Math.min(width - 1, progress * width), 0, 1, height);
  }
}

function bindWaveSeek() {
  const wrap = $('#mon-wave');
  const seek = (event) => {
    const audio = currentSceneId ? audioStore.get(currentSceneId) : null;
    if (!audio || !player) return;
    const rect = wrap.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    player.currentTime = ratio * audio.duration;
    drawWave(ratio);
  };
  let dragging = false;
  wrap.addEventListener('pointerdown', (event) => {
    dragging = true;
    wrap.setPointerCapture?.(event.pointerId);
    seek(event);
  });
  wrap.addEventListener('pointermove', (event) => {
    if (dragging) seek(event);
  });
  wrap.addEventListener('pointerup', (event) => {
    dragging = false;
    wrap.releasePointerCapture?.(event.pointerId);
  });
  wrap.addEventListener('pointercancel', () => {
    dragging = false;
  });
  window.addEventListener('resize', () => drawWave(player && currentSceneId ? (player.currentTime || 0) / (audioStore.get(currentSceneId)?.duration || 1) : 0));
}

/* ---------- WAV ---------- */

function downloadSceneWav(scene) {
  const audio = audioStore.get(scene.id);
  if (!audio || !audio.blob) return;
  const index = String(state.scenes.indexOf(scene) + 1).padStart(2, '0');
  download(audio.blob, `hagilog-${index}-${safeFileName(scene.title)}.wav`);
}

function mergeAll() {
  const ready = state.scenes.filter((scene) => audioStore.get(scene.id));
  if (!ready.length) {
    toast('먼저 장면 음성을 생성해 주세요.', { error: true });
    return;
  }
  const missing = state.scenes.filter((scene) => scene.text.trim() && !audioStore.get(scene.id));
  if (missing.length) {
    toast(`${missing.length}개 장면이 아직 생성되지 않았어요. 합치기 전에 생성해 주세요.`, { error: true, ms: 3200 });
    return;
  }
  const tracks = state.scenes.map((scene) => audioStore.get(scene.id).samples);
  const { bytes, totalSamples } = concatTracks(tracks, state.gap);
  const blob = new Blob([bytes], { type: 'audio/wav' });
  download(blob, `hagilog-narration-${stamp()}.wav`);
  toast(`장면 ${tracks.length}개 · ${formatDuration(totalSamples / CANONICAL_FORMAT.sampleRate)} · ${Math.round(blob.size / 1024)}KB 저장 중`);
}

/* ---------- 연결 테스트 ---------- */

async function runConnectionTest() {
  const btn = $('#test-conn');
  const msg = $('#key-msg');
  if (!state.apiKey.trim()) {
    msg.textContent = 'API 키를 먼저 붙여넣어 주세요.';
    $('#api-key').focus();
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 확인 중';
  msg.textContent = `${activeModel()} · ${state.voice} 로 짧게 합성해 보는 중…`;
  try {
    const result = await testConnection({
      apiKey: state.apiKey.trim(),
      model: activeModel(),
      voiceName: state.voice,
    });
    const decoded = decodeInlineAudio(result.base64, result.mimeType);
    const sec = decoded.samples ? decoded.samples.length / (decoded.format?.sampleRate || 24000) : 0;
    connected = true;
    renderKeyState();
    msg.textContent = `연결 성공 · ${state.voice} · 약 ${sec.toFixed(2)}초 음성 · ${(result.ms / 1000).toFixed(1)}초 소요`;
  } catch (error) {
    connected = false;
    renderKeyState();
    msg.textContent = error.message || '연결 테스트에 실패했어요.';
    toast(error.message || '연결 테스트 실패', { error: true, ms: 4200 });
  } finally {
    btn.disabled = false;
    btn.textContent = '연결 테스트';
  }
}

/* ---------- 통대본 나누기 ---------- */

function openSplitSheet() {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-backdrop">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="split-title">
      <div class="sheet-head">
        <h3 id="split-title">통대본 자동 나누기</h3>
        <button type="button" class="tool-btn" data-close aria-label="닫기">✕</button>
      </div>
      <p class="hint">에피소드 대본을 통째로 붙여넣으면 장면으로 나눠 담아요. 나뉜 장면은 워크벤치에서 제목·분위기를 다듬으면 됩니다.</p>
      <div class="split-opt" role="group" aria-label="나누는 기준">
        <button type="button" data-mode="blank" aria-pressed="true">빈 줄로 나누기</button>
        <button type="button" data-mode="line" aria-pressed="false">줄마다 나누기</button>
      </div>
      <textarea id="split-input" rows="10" placeholder="예)&#10;폐허 도시 14일차.&#10;눈을 뜨자마자 물부터 확인한다.&#10;&#10;건물 사이를 천천히 훑는다.&#10;3층 창가에 뭔가 반짝여서 올라가 봤다."></textarea>
      <p class="subtle" id="split-preview" style="margin-top:8px">0장면 · 0자</p>
      <div class="sheet-actions">
        <button type="button" class="btn" data-close>취소</button>
        <button type="button" class="btn" id="split-append">뒤에 추가</button>
        <button type="button" class="btn primary" id="split-replace">대본 비우고 넣기</button>
      </div>
    </div>
  </div>`;

  const backdrop = root.querySelector('.sheet-backdrop');
  const input = root.querySelector('#split-input');
  const preview = root.querySelector('#split-preview');
  let mode = 'blank';

  const split = () => {
    const text = input.value.replace(/\r\n?/g, '\n');
    const chunks =
      mode === 'blank'
        ? text.split(/\n\s*\n+/)
        : text.split(/\n+/);
    return chunks.map((chunk) => chunk.trim()).filter(Boolean);
  };

  const updatePreview = () => {
    const scenes = split();
    const chars = scenes.reduce((sum, s) => sum + countChars(s), 0);
    preview.textContent = `${scenes.length}장면 · ${chars.toLocaleString('ko-KR')}자 · 예상 ${fmtSeconds(estimateSeconds(scenes.join(' '), state.speed))}`;
  };

  input.addEventListener('input', updatePreview);
  root.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      root.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      updatePreview();
    });
  });

  const close = () => {
    root.innerHTML = '';
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  root.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', close));
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });

  const insert = (replace) => {
    const scenes = split();
    if (!scenes.length) {
      toast('나눌 내용이 없어요.', { error: true });
      return;
    }
    const built = scenes.map((text, index) => makeScene({ title: `장면 ${index + 1}`, mood: 'daily', text }));
    if (replace) {
      resetAudio();
      state.scenes = built;
    } else {
      state.scenes = state.scenes.filter((s) => s.text.trim() || s.title.trim()).concat(built);
      if (!state.scenes.length) state.scenes = built;
    }
    renderScenes();
    saveNow();
    close();
    toast(`${built.length}장면으로 나눴어요.`);
  };
  root.querySelector('#split-replace').addEventListener('click', () => insert(true));
  root.querySelector('#split-append').addEventListener('click', () => insert(false));
  setTimeout(() => input.focus(), 60);
  updatePreview();
}

/* ---------- 초기화 ---------- */

function bindStatic() {
  $('#api-key').addEventListener('input', (event) => {
    state.apiKey = event.target.value.trim();
    connected = false;
    renderKeyState();
    scheduleSave();
  });

  $('#toggle-key').addEventListener('click', () => {
    const input = $('#api-key');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('#toggle-key').textContent = show ? '숨기기' : '보기';
    $('#toggle-key').setAttribute('aria-label', show ? '키 숨기기' : '키 보이기');
  });

  $('#test-conn').addEventListener('click', runConnectionTest);

  $('#clear-key').addEventListener('click', () => {
    if (!state.apiKey) return;
    if (!confirm('저장된 API 키를 지울까요?')) return;
    state.apiKey = '';
    connected = false;
    $('#api-key').value = '';
    $('#key-msg').textContent = '';
    renderKeyState();
    saveNow();
    toast('API 키를 지웠어요.');
  });

  $('#model-apply').addEventListener('click', () => {
    const value = $('#model-custom').value.trim();
    if (!value) {
      toast('모델 ID를 입력해 주세요.', { error: true });
      return;
    }
    state.model = value;
    renderKeyState();
    scheduleSave();
    toast(`모델을 ${value} 로 바꿨어요.`);
  });

  $('#gap-range').addEventListener('input', (event) => {
    state.gap = Number(event.target.value);
    $('#gap-value').textContent = `${state.gap}ms`;
    event.target.style.setProperty('--fill', `${(state.gap / 900) * 100}%`);
    renderSummary();
    renderMonitor();
    scheduleSave();
  });

  $('#prompt-text').addEventListener('input', (event) => {
    state.prompt = event.target.value;
    $('#prompt-count').textContent = `${state.prompt.length.toLocaleString('ko-KR')}자`;
    $('#prompt-state').textContent = state.prompt.trim() === DEFAULT_PROMPT.trim() ? '원본' : '수정됨';
    scheduleSave();
  });

  $('#reset-prompt').addEventListener('click', () => {
    state.prompt = DEFAULT_PROMPT;
    renderPrompt();
    saveNow();
    toast('발성 지시문을 원본으로 되돌렸어요.');
  });

  $('#add-scene').addEventListener('click', () => {
    const index = state.scenes.length;
    state.scenes.push(makeScene({ title: `장면 ${index + 1}`, mood: 'daily', text: '' }));
    renderScenes();
    saveNow();
    const card = $('#scene-list').querySelector('.scene:last-child textarea');
    card?.focus();
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('#clear-scenes').addEventListener('click', () => {
    if (!state.scenes.some((s) => s.text.trim())) {
      state.scenes = [makeScene({ title: '첫 장면', mood: 'daily', text: '' })];
      renderScenes();
      saveNow();
      return;
    }
    if (!confirm('장면을 모두 비울까요? 만든 음성도 함께 사라집니다.')) return;
    resetAudio();
    state.scenes = [makeScene({ title: '첫 장면', mood: 'daily', text: '' })];
    renderScenes();
    saveNow();
  });

  $('#open-split').addEventListener('click', openSplitSheet);
  $('#generate-all').addEventListener('click', generateAll);
  $('#cancel-all').addEventListener('click', cancelGeneration);

  $('#mon-play').addEventListener('click', () => togglePlay());
  $('#mon-download').addEventListener('click', () => {
    const scene = state.scenes.find((s) => s.id === currentSceneId);
    if (scene) downloadSceneWav(scene);
  });
  $('#mon-merge').addEventListener('click', mergeAll);
  $('#status-chip').addEventListener('click', () => {
    $('#sec-key').scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => $('#api-key').focus(), 320);
  });

  $('#quicknav')?.addEventListener('click', () => {});
  bindWaveSeek();
  window.addEventListener('resize', () => drawWave(0));
}

function init() {
  loadState();
  renderModels();
  renderVoices();
  renderSegGroup('#range-seg', RANGE_OPTIONS, state.range, 'range');
  renderSegGroup('#speed-seg', SPEED_OPTIONS, state.speed, 'speed');
  renderSamples();
  renderPrompt();
  renderGap();
  renderScenes();
  renderKeyState();
  bindStatic();
  bindScenes();
  $('#api-key').value = state.apiKey;
  renderMonitor();
  if (!state.apiKey) {
    $('#key-msg').textContent = '아직 키가 없어요. 위 링크에서 무료 키를 발급해 붙여넣으면 바로 생성할 수 있어요.';
  }
  requestAnimationFrame(() => drawWave(0));
}

init();
