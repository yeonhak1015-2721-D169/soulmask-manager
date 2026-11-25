/* 하기 로그 내레이션 스튜디오 — Gemini TTS 호출과 프롬프트 조립 */

export const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const DEFAULT_PROMPT = `젊고 낮은 남성 목소리의 한국어 게임 생존 일지 내레이션.

차분하고 건조한 독백 톤으로 읽는다.
감정을 과장하지 않고 담담하게 전달한다.
말투는 자연스러운 반말이며, 친근하지만 가볍지 않게 유지한다.
전체 구간에서 동일한 목소리의 정체성, 음색, 말투, 높낮이를 유지한다.

속도는 약간 빠르지만 서두르거나 급하게 읽지 않는다.
문장과 문장 사이에는 짧고 자연스러운 호흡을 둔다.
쉼표에서는 짧게 쉬고, 마침표에서는 문장을 단단하게 끝낸다.
문장 끝을 흐리거나 올리지 말고 또렷하게 마무리한다.

낮고 안정적인 피치와 일정한 말하기 속도를 유지한다.
갑자기 밝아지거나, 지나치게 힘을 주거나, 아나운서처럼 읽지 않는다.
예능식 과장, 큰 리액션, 웃음 섞인 연기, 속삭임, 숨소리 섞인 발성은 사용하지 않는다.

전투 장면에서도 긴장감은 아주 조금만 높이고,
기본적으로는 차분한 생존 기록을 읽는 느낌을 유지한다.
드립이 있는 문장은 웃기려고 과장하지 말고,
건조한 허탈감이 느껴지도록 짧고 담담하게 읽는다.

모든 문장을 정확한 한국어 발음으로 읽고,
문장마다 음량과 속도를 일정하게 유지한다.`;

export const MODELS = [
  {
    id: 'gemini-2.5-flash-preview-tts',
    short: '2.5-flash-preview-tts',
    label: '안정 · 무료 티어',
    note: '2.5 Flash TTS — 검증된 기본 엔진',
  },
  {
    id: 'gemini-3.8-flash-tts',
    short: '3.8-flash-tts',
    label: '최신 · 무료 티어',
    note: '3.8 Flash TTS — 최신 음성 엔진',
  },
];

export const VOICES = [
  {
    id: 'Orus',
    name: 'Orus',
    range: '중저음 바리톤',
    desc: 'Charon과 Fenrir 사이 · 또렷하고 단단한 젊은 남성 바리톤',
    badge: '추천',
  },
  {
    id: 'Alnilam',
    name: 'Alnilam',
    range: '중저음 바리톤',
    desc: 'Charon과 Fenrir 사이 · 차분하고 안정적인 무게감의 바리톤',
  },
  { id: 'Iapetus', name: 'Iapetus', range: '건조한 중저음', desc: '담백하고 감정 절제가 잘 드러나는 차분한 중저음' },
  { id: 'Umbriel', name: 'Umbriel', range: '부드러운 중저음', desc: '톤 기복이 적고 편안하게 내려앉은 중저음' },
  { id: 'Charon', name: 'Charon', range: '중음', desc: '비교적 가볍고 밝은 편에 가까운 단정한 남성 톤' },
  { id: 'Fenrir', name: 'Fenrir', range: '깊은 저음', desc: '묵직하고 가장 낮은 베이스 톤의 남성 목소리' },
  { id: 'Puck', name: 'Puck', range: '중음', desc: '또렷하고 가벼운 호흡의 중음 톤' },
  { id: 'Kore', name: 'Kore', range: '중성', desc: '차분하고 단정한 중성 톤' },
  { id: 'Zephyr', name: 'Zephyr', range: '중고음', desc: '부드럽고 고른 내레이션 톤' },
];

export const RANGE_OPTIONS = [
  { id: 'light', label: '가벼운 중저음', hint: '목에 힘을 빼고 살짝 가볍게 얹은 높낮이' },
  { id: 'mid', label: '중간 바리톤', hint: '가장 편안한 기본 높낮이 (샘플 기준)' },
  { id: 'deep', label: '묵직한 저음', hint: '가슴에서 울리는 낮은 높낮이' },
];

export const SPEED_OPTIONS = [
  { id: 'fast', label: '약간 빠르게 (기본)', cps: 5.7 },
  { id: 'normal', label: '일정한 보통 속도', cps: 5.0 },
  { id: 'slow', label: '차분하고 여유 있게', cps: 4.3 },
];

export const MOODS = [
  { id: 'daily', label: '일상', hint: '하루를 정리하듯 담담하게' },
  { id: 'explore', label: '탐색', hint: '주변을 살피는 낮은 시선, 호기심은 아주 조금' },
  { id: 'combat', label: '전투', hint: '긴장은 아주 조금만, 목소리는 낮게 유지' },
  { id: 'crisis', label: '위기', hint: '숨이 조금 가빠지는 느낌만, 비명은 없다' },
  { id: 'deflate', label: '허탈', hint: '힘을 뺀 건조한 납득의 톤' },
  { id: 'gag', label: '드립', hint: '웃기려 하지 말고 건조하게 툭 던진다' },
];

const RANGE_DIRECTION = {
  light: '음역대는 가볍고 편안한 중저음으로, 목에 힘을 빼고 살짝 가볍게 얹어 읽는다.',
  mid: '음역대는 중간 바리톤으로, 가장 편안한 기본 높낮이를 처음부터 끝까지 유지한다.',
  deep: '음역대는 묵직한 저음으로, 가슴에서 울리는 낮은 높낮이를 유지한다.',
};

const SPEED_DIRECTION = {
  fast: '말하기 속도는 약간 빠르게. 문장 사이 호흡은 짧게 두되, 단어를 뭉개거나 서두르지 않는다.',
  normal: '말하기 속도는 보통. 일정한 간격으로 또박또박 읽는다.',
  slow: '말하기 속도는 차분하고 여유 있게. 문장 사이에 충분한 호흡을 두되 늘어지지 않는다.',
};

const MOOD_DIRECTION = {
  daily: '이 장면은 일상 기록이다. 하루를 정리하듯 담담하게 읽는다.',
  explore: '이 장면은 탐색이다. 주변을 살피는 낮은 시선으로, 호기심은 아주 조금만 담는다.',
  combat: '이 장면은 전투다. 긴장감은 아주 조금만 올리고 목소리는 낮게 유지한다.',
  crisis: '이 장면은 위기다. 숨이 조금 가빠지는 느낌만 넣고, 비명이나 큰 리액션은 하지 않는다.',
  deflate: '이 장면은 허탈이다. 힘을 뺀 건조한 납득의 톤으로 읽는다.',
  gag: '이 장면은 드립이다. 웃기려고 과장하지 말고 건조하게 짧게 툭 던진다.',
};

export function moodLabel(id) {
  return (MOODS.find((m) => m.id === id) || MOODS[0]).label;
}

export function speedCps(id) {
  return (SPEED_OPTIONS.find((s) => s.id === id) || SPEED_OPTIONS[0]).cps;
}

/** 글자수 기반 예상 길이(초). 실제 생성 후에는 실측 길이로 대체된다. */
export function estimateSeconds(text, speedId) {
  const plain = String(text || '').replace(/\s+/g, ' ').trim();
  if (!plain) return 0;
  return plain.length / speedCps(speedId);
}

export function countChars(text) {
  return String(text || '').replace(/\s+/g, '').length;
}

/**
 * 최종 요청 프롬프트: 고정 발성 지시문 + 이번 장면 조정 + 대본.
 * (2.5 / 3.1 계열처럼 지시문을 텍스트에 섞어 보내는 모델용)
 */
export function buildPrompt({ basePrompt, mood, range, speed, gapMs, text }) {
  const base = String(basePrompt || '').trim();
  const script = String(text || '').trim();
  const lines = [
    base,
    '',
    '[이번 장면 지시]',
    `- ${RANGE_DIRECTION[range] || RANGE_DIRECTION.mid}`,
    `- ${SPEED_DIRECTION[speed] || SPEED_DIRECTION.fast}`,
    `- 마지막 문장 뒤에 장면 전환을 위한 약 ${Math.round(Number(gapMs) || 0)}ms 길이의 짧은 침묵을 남긴다.`,
    `- ${MOOD_DIRECTION[mood] || MOOD_DIRECTION.daily}`,
    '- 지시문은 읽지 않는다. 아래 대본만 소리 내어 읽는다.',
    '',
    '[대본]',
    script,
  ];
  return lines.join('\n');
}

/**
 * Gemini 3.8 이상 TTS는 text를 '그대로 읽는 대본'으로만 취급하고,
 * 연기 지시는 part의 speechMetadata.style로 받는다.
 */
export function isStructuredTts(model) {
  const id = String(model || '');
  if (!/tts/i.test(id)) return false;
  const match = id.match(/gemini-(\d+)(?:\.(\d+))?/i);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2] || 0);
  return major > 3 || (major === 3 && minor >= 8);
}

/** 3.8 계열용 연기 지시(style) 문자열. */
export function buildStyle({ basePrompt, mood, range, speed, gapMs }) {
  return [
    String(basePrompt || '').trim(),
    RANGE_DIRECTION[range] || RANGE_DIRECTION.mid,
    SPEED_DIRECTION[speed] || SPEED_DIRECTION.fast,
    MOOD_DIRECTION[mood] || MOOD_DIRECTION.daily,
    `마지막 문장 뒤에 약 ${Math.round(Number(gapMs) || 0)}ms의 짧은 침묵을 남긴다.`,
  ]
    .filter(Boolean)
    .join(' ');
}

/* ---------- 오류 ---------- */

export class TtsError extends Error {
  constructor(message, { status = 0, detail = '', kind = 'api' } = {}) {
    super(message);
    this.name = 'TtsError';
    this.status = status;
    this.detail = detail;
    this.kind = kind;
  }
}

function apiMessage(status, payload, rawText) {
  const err = payload && payload.error ? payload.error : null;
  const apiStatus = err && err.status ? String(err.status) : '';
  const apiText = err && err.message ? String(err.message) : String(rawText || '');
  const lower = apiText.toLowerCase();
  const detail = `HTTP ${status}${apiStatus ? ` ${apiStatus}` : ''} · ${apiText.slice(0, 400)}`;

  if (status === 400 && (lower.includes('api key not valid') || lower.includes('api_key_invalid'))) {
    return ['API 키가 올바르지 않아요. AI Studio에서 키를 다시 복사해 붙여넣어 주세요.', detail];
  }
  if (status === 400 && lower.includes('no matching speaker voice')) {
    return ['이 모델이 모르는 화자 이름이에요. 화자 음색 목록에서 다시 골라 주세요.', detail];
  }
  if (status === 400 && (lower.includes('api key') || lower.includes('key'))) {
    return ['API 키에 문제가 있어요. 키를 다시 확인해 주세요(공백·줄바꿈 포함).', detail];
  }
  if (status === 400) {
    return ['요청 형식이 거부됐어요. 대본이 비어 있지 않은지, 지시문이 지나치게 길지 않은지 확인해 주세요.', detail];
  }
  if (status === 401) {
    return ['API 키 인증에 실패했어요. 키를 새로 발급해 다시 넣어 주세요.', detail];
  }
  if (status === 403) {
    return [
      '이 키로는 요청이 막혔어요(403). 키에 Generative Language API 사용이 허용됐는지, 결제/지역 제한이 없는지 확인해 주세요.',
      detail,
    ];
  }
  if (status === 404) {
    return [
      '모델 ID를 찾지 못했어요(404). 모델 선택에서 「안정 · 무료 티어」를 고르거나 직접 입력한 ID를 확인해 주세요.',
      detail,
    ];
  }
  if (status === 429) {
    return [
      '무료 티어 사용량을 잠깐 넘었어요(429). 1분 정도 뒤에 다시 시도하거나, 장면을 조금 더 짧게 나눠 생성해 보세요.',
      detail,
    ];
  }
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return ['구글 쪽이 잠시 응답하지 않아요. 30초쯤 뒤에 다시 시도해 주세요.', detail];
  }
  return [`음성 생성에 실패했어요. (${detail})`, detail];
}

/* ---------- 실제 호출 ---------- */

function requestBody({ model, voiceName, prompt, transcript, style, structured }) {
  const part = structured
    ? { text: String(transcript || ''), speechMetadata: { style: String(style || '') } }
    : { text: String(prompt || '') };
  return {
    contents: [{ role: 'user', parts: [part] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        languageCode: 'ko-KR',
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
    },
  };
}

/**
 * 단일 장면 음성 생성.
 * 3.8 이상은 speechMetadata.style로 지시문을 분리해 보내고,
 * 서버가 그 필드를 모르면(400) 기존 방식(지시문 + 대본 한 덩어리)으로 한 번 더 시도한다.
 * @returns {Promise<{base64: string, mimeType: string, structured: boolean}>}
 */
export async function generateSpeech({
  apiKey,
  model,
  voiceName,
  prompt,
  transcript,
  style,
  signal,
  timeoutMs = 180000,
}) {
  const key = String(apiKey || '').trim();
  if (!key) {
    throw new TtsError('먼저 Gemini API 키를 넣어 주세요.', { kind: 'input' });
  }
  if (!String(prompt || '').trim() && !String(transcript || '').trim()) {
    throw new TtsError('읽을 대본이 비어 있어요. 장면 대본을 먼저 적어 주세요.', { kind: 'input' });
  }

  const url = `${API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  const onAbort = () => controller.abort(signal && signal.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  const post = async (structured) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody({ model, voiceName, prompt, transcript, style, structured })),
      signal: controller.signal,
    });
    const rawText = await res.text();
    let payload = null;
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
    return { res, rawText, payload };
  };

  try {
    let structured = isStructuredTts(model) && Boolean(String(transcript || '').trim());
    let { res, rawText, payload } = await post(structured);

    // 모델이 speechMetadata를 모르면(구버전/게이트웨이) 지시문을 텍스트에 합쳐 재시도
    if (
      !res.ok &&
      structured &&
      res.status === 400 &&
      /speech.?metadata|unknown name|invalid json payload|unknown field/i.test(rawText)
    ) {
      structured = false;
      ({ res, rawText, payload } = await post(false));
    }

    if (!res.ok) {
      const [message, detail] = apiMessage(res.status, payload, rawText);
      throw new TtsError(message, { status: res.status, detail });
    }

    if (!payload || !payload.candidates || !payload.candidates.length) {
      const block = payload && payload.promptFeedback && payload.promptFeedback.blockReason;
      throw new TtsError(
        block
          ? `요청이 안전 필터에 걸렸어요(${block}). 대본 표현을 조금 부드럽게 바꿔 보세요.`
          : '응답에 음성이 없어요. 잠시 후 다시 시도해 주세요.',
        { detail: rawText.slice(0, 400) },
      );
    }

    const candidate = payload.candidates[0];
    const parts = (candidate.content && candidate.content.parts) || [];
    const audioPart = parts.find((p) => p && p.inlineData && p.inlineData.data);
    if (!audioPart) {
      const finish = candidate.finishReason || 'UNKNOWN';
      throw new TtsError(
        `모델이 음성 대신 다른 응답을 돌려줬어요(${finish}). 대본이 너무 짧거나 지시문이 길 때 생기니, 대본을 조금 늘리거나 다시 시도해 주세요.`,
        { detail: rawText.slice(0, 400) },
      );
    }

    return {
      base64: audioPart.inlineData.data,
      mimeType: audioPart.inlineData.mimeType || 'audio/L16;codec=pcm;rate=24000',
      usage: payload.usageMetadata || null,
      structured,
    };
  } catch (error) {
    if (error instanceof TtsError) throw error;
    if (error && error.name === 'AbortError') {
      if (signal && signal.aborted) throw new TtsError('생성을 취소했어요.', { kind: 'cancel' });
      throw new TtsError('응답이 너무 오래 걸려 멈췄어요(3분). 장면을 짧게 나눠 다시 시도해 주세요.', {
        kind: 'timeout',
      });
    }
    throw new TtsError(
      '네트워크 문제로 요청이 실패했어요. 인터넷 연결을 확인하고, 광고 차단 확장이 있으면 잠시 꺼 주세요.',
      { kind: 'network', detail: String((error && error.message) || error) },
    );
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/** 연결 테스트: 짧은 문장을 실제로 합성해 키·모델·화자 조합을 확인한다. */
export async function testConnection({ apiKey, model, voiceName, signal }) {
  const started = Date.now();
  const script = '확인했습니다. 오늘도 살아 있습니다.';
  const result = await generateSpeech({
    apiKey,
    model,
    voiceName,
    prompt: '짧은 연결 확인 인사. 담담하고 차분하게, 아나운서처럼 읽지 않는다.\n\n[대본]\n' + script,
    transcript: script,
    style: '차분하고 건조한 젊은 남성 내레이션. 담담하게, 과장 없이.',
    signal,
    timeoutMs: 60000,
  });
  return { ...result, ms: Date.now() - started };
}
