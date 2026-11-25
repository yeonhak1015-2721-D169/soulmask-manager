/* 하기 로그 내레이션 스튜디오 — 타임라인 대본 파서
 *
 * 아래 같은 구간 표기가 섞인 통대본을 장면 배열로 나눈다.
 *
 *   [00:00 ~ 00:10]
 *   나는 생존매니아, 하기다.
 *   소울마스크 8일차 생존을 시작했다.
 *
 *   [00:11 ~ 00:30]
 *   거점부터 한바퀴 둘러봤다.
 *
 * 지원: [00:00 ~ 00:10] / [00:00 - 00:10] / [0:00~0:10] / [00:00～00:10]
 *       [01:02:03 ~ 01:02:15] / [00:15] (단일 시점)
 *       **[00:20 ~ 00:36]** / *[00:20 ~ 00:36]* / __[00:20 ~ 00:36]__ /
 *       ## [00:20 ~ 00:36] (Markdown 볼드·기울임·제목으로 감싼 표기)
 *
 * 가장 중요한 규칙: 구간 표기는 읽을 대본에서 반드시 제거한다.
 * (Gemini TTS가 "00:00 ~ 00:10"을 소리 내어 읽지 않도록)
 * 순수 함수만 두어 Node 테스트에서 그대로 검사한다.
 */

/* ---------- 시간 표기 ---------- */

const TIME_PATTERN = '\\d{1,3}(?::\\d{1,2}){1,2}(?:[.,]\\d{1,3})?';
const DASH_PATTERN = '-->|→|->|[-~–—−〜～]';
/* 구간 표기를 감싸는 Markdown 표기: **볼드**, __볼드__, *기울임*, _기울임_, ## 제목 */
const WRAP_PATTERN = '\\*\\*|__|\\*|_|#{1,6}';
const HEADER_RE = new RegExp(
  `^\\s*(?:(?<wrap>${WRAP_PATTERN})[ \\t]*){0,3}[\\[【]\\s*(?<start>${TIME_PATTERN})\\s*` +
    `(?:(?:${DASH_PATTERN})\\s*(?<end>${TIME_PATTERN}))?\\s*[\\]】][ \\t]*(?:\\k<wrap>)?[ \\t]*(?<rest>.*)$`,
);
/* 본문에 남은 표기도 감싼 Markdown 표기째로 지운다(같은 기호로 닫혔을 때만). */
const INLINE_TAG_RE = new RegExp(
  `(${WRAP_PATTERN})?[\\[【]\\s*${TIME_PATTERN}\\s*(?:(?:${DASH_PATTERN})\\s*${TIME_PATTERN})?\\s*[\\]】](?:\\1)?`,
  'g',
);
/* 구간 표기처럼 보이지만 시각을 못 읽는 줄(예: [00:xx ~ 00:10], **[00:xx ~ 00:10]**)을 걸러내기 위한 후보 패턴. */
const CANDIDATE_RE = new RegExp(
  `^\\s*(?:(?<cwrap>${WRAP_PATTERN})[ \\t]*){0,3}[\\[【]\\s*(?<inner>[^\\]】\\n]{1,32}?)\\s*[\\]】][ \\t]*` +
    `(?:\\k<cwrap>)?[ \\t]*(?<crest>.*)$`,
);
const looksLikeTimeTag = (inner) => /\d/.test(inner) && /[:：]/.test(inner);

const pad2 = (n) => String(n).padStart(2, '0');

/** 'mm:ss' · 'h:mm:ss' · 'mm:ss.SSS' → 초(소수 3자리까지). 실패하면 null. */
export function parseTimecode(raw) {
  const text = String(raw ?? '').trim().replace(',', '.');
  if (!text) return null;
  const parts = text.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((part) => {
    const trimmed = part.trim();
    if (!/^\d+(?:\.\d{1,3})?$/.test(trimmed)) return NaN;
    return Number(trimmed);
  });
  if (nums.some((value) => !Number.isFinite(value) || value < 0)) return null;
  const sec = nums.length === 3 ? nums[0] * 3600 + nums[1] * 60 + nums[2] : nums[0] * 60 + nums[1];
  return Math.round(sec * 1000) / 1000;
}

/** 초 → '00:10' (한 시간이 넘으면 '1:02:03'). 구간 배지·파일 이름에 쓴다. */
export function formatTimecode(totalSec) {
  const sec = Math.max(0, Number(totalSec) || 0);
  const whole = Math.floor(sec + 1e-9);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${pad2(minutes)}:${pad2(seconds)}`;
}

/** '00:00 ~ 00:10' 형태의 장면 배지 문구. */
export function formatTimelineLabel(startSec, endSec) {
  const start = formatTimecode(startSec);
  if (endSec === null || endSec === undefined || !Number.isFinite(Number(endSec))) return start;
  return `${start} ~ ${formatTimecode(endSec)}`;
}

/** 파일 이름에 넣을 수 있게 ':'를 '-'로 바꾼 구간 문자열. ('00-00_00-10') */
export function timelineFilePart(startSec, endSec) {
  if (!Number.isFinite(Number(startSec))) return '';
  const start = formatTimecode(startSec).replace(/:/g, '-');
  if (endSec === null || endSec === undefined || !Number.isFinite(Number(endSec))) return start;
  return `${start}_${formatTimecode(endSec).replace(/:/g, '-')}`;
}

/** 구간 목표 길이(초). 끝 시점이 없으면 null. */
export function targetDurationSec(scene) {
  if (!scene) return null;
  const start = Number(scene.startSec);
  const end = Number(scene.endSec);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const target = end - start;
  return target > 0 ? Math.round(target * 1000) / 1000 : null;
}

/** 장면에 구간이 붙어 있는지. */
export function hasTimeline(scene) {
  return Boolean(scene) && Number.isFinite(Number(scene.startSec)) && Number(scene.startSec) >= 0;
}

/* ---------- 본문 정리 ---------- */

/** BOM 제거 + CRLF/CR → LF. */
export function normalizeScript(rawText) {
  return String(rawText ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n');
}

/** 본문에 남은 구간 표기를 제거한다(절대 소리 내어 읽지 않도록). */
export function stripTimecodeTags(text) {
  return String(text ?? '').replace(INLINE_TAG_RE, ' ');
}

function tidyBody(lines) {
  const raw = stripTimecodeTags(lines.join('\n'))
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, ''))
    // 구간 표기만 지우고 남은 Markdown 기호뿐인 줄(** **, ## 등)은 소리 내어 읽을 게 없으니 버린다.
    .filter((line) => !/^[*_#][*_#\s]*$/.test(line))
    .join('\n');
  return raw
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
}

/* ---------- 파서 ---------- */

/**
 * 타임라인 통대본 → 장면 배열.
 * @param {string} rawText
 * @returns {{
 *   scenes: Array<{timelineLabel: (string|null), startSec: (number|null), endSec: (number|null), text: string}>,
 *   warnings: string[],
 *   headerCount: number,
 *   hasTimeline: boolean,
 *   preambleText: string,
 *   spanStartSec: (number|null),
 *   spanEndSec: (number|null),
 * }}
 */
export function parseTimelineText(rawText) {
  const text = normalizeScript(rawText);
  const lines = text.split('\n');
  const warnings = [];
  const scenes = [];
  const preamble = [];
  let current = null;
  let headerCount = 0;

  lines.forEach((line, lineIndex) => {
    const match = line.match(HEADER_RE);
    if (match) {
      headerCount += 1;
      const { wrap, start, end, rest } = match.groups;
      const startSec = parseTimecode(start);
      let endSec = end ? parseTimecode(end) : null;
      if (startSec === null) {
        warnings.push(`${lineIndex + 1}행: 「${start}」 시작 시각을 읽지 못해 건너뛰었어요.`);
        current = null;
        return;
      }
      if (endSec !== null && endSec <= startSec) {
        warnings.push(
          `${lineIndex + 1}행: 끝(${end})이 시작(${start})보다 빠르거나 같아 단일 시점으로 처리했어요.`,
        );
        endSec = null;
      }
      current = {
        timelineLabel: formatTimelineLabel(startSec, endSec),
        startSec,
        endSec,
        body: [],
        line: lineIndex + 1,
      };
      let inline = (rest || '').trim();
      // **\[00:00 ~ 00:10\] 대사** 처럼 감싼 표기가 줄 끝까지 이어지면 닫는 기호도 걷어낸다.
      if (wrap && inline.endsWith(wrap)) inline = inline.slice(0, -wrap.length).trim();
      if (inline) current.body.push(inline);
      scenes.push(current);
      return;
    }
    const candidate = line.match(CANDIDATE_RE);
    if (candidate && looksLikeTimeTag(candidate.groups.inner)) {
      // 시각을 읽지 못한 구간 표기는 본문에서 제거한다(그대로 읽히면 안 되므로).
      warnings.push(
        `${lineIndex + 1}행: 「[${candidate.groups.inner}]」 구간 표기의 시작 시각을 읽지 못해 그 표기만 지웠어요.`,
      );
      const rest = (candidate.groups.crest || '').trim();
      if (rest) {
        if (current) current.body.push(rest);
        else preamble.push(rest);
      }
      return;
    }
    if (current) current.body.push(line);
    else if (line.trim()) preamble.push(line.replace(/\s+$/, ''));
  });

  const built = scenes.map((scene) => {
    const body = tidyBody(scene.body);
    if (!body) {
      warnings.push(`${scene.line}행(${scene.timelineLabel}) 구간에 대본이 없어 빈 장면으로 넣었어요.`);
    }
    return {
      timelineLabel: scene.timelineLabel,
      startSec: scene.startSec,
      endSec: scene.endSec,
      text: body,
    };
  });

  const preambleText = tidyBody(preamble);
  if (preambleText) {
    warnings.unshift(`구간 표기 앞의 대본 ${preamble.length}줄은 구간 없는 첫 장면으로 넣었어요.`);
  }

  const timed = built.filter((scene) => Number.isFinite(scene.startSec));
  const spanStartSec = timed.length ? Math.min(...timed.map((scene) => scene.startSec)) : null;
  const spanEndSec = timed.length
    ? Math.max(...timed.map((scene) => (Number.isFinite(scene.endSec) ? scene.endSec : scene.startSec)))
    : null;

  return {
    scenes: built,
    warnings,
    headerCount,
    hasTimeline: headerCount > 0,
    preambleText,
    spanStartSec,
    spanEndSec,
  };
}

/** 타임라인을 붙인 장면인지에 따라 붙는 배지 문구. */
export function describeTimeline(scene) {
  if (!hasTimeline(scene)) return '';
  const span = formatTimelineLabel(scene.startSec, scene.endSec);
  const target = targetDurationSec(scene);
  return target === null ? span : `${span} · 목표 ${target.toFixed(1)}초`;
}

/**
 * 실제 생성 길이를 목표 구간과 비교한 표시값.
 * @param {number} actualSec 실제 음성 길이
 * @param {number|null} targetSec 목표 길이(end - start)
 * @returns {{text: string, tone: 'fit'|'over'|'over-major'} | null}
 */
export function compareDuration(actualSec, targetSec) {
  const actual = Number(actualSec);
  const target = Number(targetSec);
  if (!Number.isFinite(actual) || actual <= 0) return null;
  if (!Number.isFinite(target) || target <= 0) return null;
  const diff = actual - target;
  if (Math.abs(diff) <= 0.05) {
    return { text: `생성 ${actual.toFixed(1)}초 · 목표와 거의 같아요`, tone: 'fit' };
  }
  if (diff < 0) {
    return { text: `생성 ${actual.toFixed(1)}초 (여유 ${(-diff).toFixed(1)}초)`, tone: 'fit' };
  }
  return {
    text: `생성 ${actual.toFixed(1)}초 (+${diff.toFixed(1)}초 초과)`,
    tone: diff <= 0.4 ? 'over' : 'over-major',
  };
}
