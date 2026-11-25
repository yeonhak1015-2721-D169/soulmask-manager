/* 하기 로그 내레이션 스튜디오 — PCM / WAV 유틸리티
 * Gemini TTS가 돌려주는 16bit PCM(base64)을 브라우저에서 바로 재생 가능한 WAV로 만들고,
 * 여러 장면을 '장면 전환 호흡 간격'만큼의 무음을 넣어 하나의 WAV로 합친다.
 * 외부 라이브러리 없이 동작하도록 순수 함수로만 구성했다. (Node 테스트에서도 그대로 쓴다)
 */

export const CANONICAL_FORMAT = Object.freeze({
  sampleRate: 24000,
  channels: 1,
  bitsPerSample: 16,
});

const WAV_HEADER_BYTES = 44;

/* ---------- base64 ---------- */

export function base64ToBytes(base64) {
  const clean = String(base64 || '').replace(/\s+/g, '');
  if (!clean) return new Uint8Array(0);
  if (typeof atob === 'function') {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }
  // Node 테스트 경로
  return new Uint8Array(Buffer.from(clean, 'base64'));
}

/* ---------- mimeType 해석 ---------- */

export function parseAudioMime(mimeType) {
  const raw = String(mimeType || '').trim();
  const mime = raw.toLowerCase();
  const rateMatch = mime.match(/rate\s*=\s*(\d+)/);
  const channelMatch = mime.match(/channels\s*=\s*(\d+)/);
  const bitsMatch = mime.match(/(?:bits|bitdepth|bitspersample)\s*=\s*(\d+)/);
  const base = mime.split(';')[0];

  let kind = 'unknown';
  if (base.includes('wav') || base.includes('wave') || base.includes('x-wav')) kind = 'wav';
  else if (base.includes('mpeg') || base.includes('mp3')) kind = 'mp3';
  else if (base.includes('ogg') || base.includes('opus')) kind = 'mp3'; // 브라우저가 그대로 재생 가능
  else if (base.includes('l16') || base.includes('pcm') || base.includes('linear')) kind = 'pcm';

  return {
    kind,
    mimeType: raw,
    base,
    sampleRate: rateMatch ? Number(rateMatch[1]) : 24000,
    channels: channelMatch ? Number(channelMatch[1]) : 1,
    bitsPerSample: bitsMatch ? Number(bitsMatch[1]) : 16,
  };
}

/* ---------- 16bit 정수 <-> 바이트 ---------- */

export function bytesToInt16(bytes) {
  const count = Math.floor(bytes.length / 2);
  const out = new Int16Array(count);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < count; i += 1) out[i] = view.getInt16(i * 2, true);
  return out;
}

export function int16ToBytes(samples) {
  const out = new Uint8Array(samples.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < samples.length; i += 1) view.setInt16(i * 2, samples[i], true);
  return out;
}

/* ---------- 변환 ---------- */

export function toMono(samples, channels) {
  const ch = Math.max(1, Number(channels) || 1);
  if (ch === 1) return samples;
  const frames = Math.floor(samples.length / ch);
  const out = new Int16Array(frames);
  for (let i = 0; i < frames; i += 1) {
    let sum = 0;
    for (let c = 0; c < ch; c += 1) sum += samples[i * ch + c];
    out[i] = Math.round(sum / ch);
  }
  return out;
}

export function resampleInt16(samples, fromRate, toRate) {
  const from = Number(fromRate) || 24000;
  const to = Number(toRate) || 24000;
  if (from === to || samples.length === 0) return samples;
  const ratio = from / to;
  const outLength = Math.max(1, Math.round(samples.length / ratio));
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const pos = i * ratio;
    const i0 = Math.min(Math.floor(pos), samples.length - 1);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const t = pos - i0;
    out[i] = Math.round(samples[i0] * (1 - t) + samples[i1] * t);
  }
  return out;
}

/** 어떤 포맷이든 합성용 표준(24kHz·모노·16bit) Int16Array로 맞춘다. */
export function toCanonicalSamples(samples, format = CANONICAL_FORMAT) {
  const mono = toMono(samples, format.channels || 1);
  return resampleInt16(mono, format.sampleRate || CANONICAL_FORMAT.sampleRate, CANONICAL_FORMAT.sampleRate);
}

/* ---------- WAV 헤더 ---------- */

export function encodeWav(pcmBytes, format = CANONICAL_FORMAT) {
  const channels = Math.max(1, Number(format.channels) || 1);
  const sampleRate = Math.max(8000, Number(format.sampleRate) || CANONICAL_FORMAT.sampleRate);
  const bitsPerSample = Number(format.bitsPerSample) === 8 ? 8 : 16;
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;

  // 블록 정렬에 맞게 끝을 잘라낸다(홀수 바이트 방어).
  const dataLength = pcmBytes.length - (pcmBytes.length % blockAlign);
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  const writeAscii = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt 청크 크기
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataLength, true);

  if (bitsPerSample === 8) {
    // 8bit PCM은 unsigned — 아주 드문 경우지만 맞춰 둔다.
    for (let i = 0; i < dataLength; i += 1) bytes[WAV_HEADER_BYTES + i] = pcmBytes[i];
  } else {
    bytes.set(pcmBytes.subarray(0, dataLength), WAV_HEADER_BYTES);
  }
  return bytes;
}

/** WAV 바이트에서 헤더를 읽어 data 청크만 뽑는다. */
export function decodeWav(bytes) {
  if (bytes.length < 44) throw new Error('WAV 파일이 너무 짧습니다.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset) => String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('WAV 형식이 아닙니다.');

  let format = { ...CANONICAL_FORMAT };
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ' && body + 16 <= bytes.length) {
      format = {
        channels: view.getUint16(body + 2, true) || 1,
        sampleRate: view.getUint32(body + 4, true) || CANONICAL_FORMAT.sampleRate,
        bitsPerSample: view.getUint16(body + 14, true) || 16,
      };
    } else if (id === 'data') {
      const end = Math.min(bytes.length, body + size);
      return { pcmBytes: bytes.subarray(body, end), format };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('WAV data 청크를 찾지 못했습니다.');
}

/* ---------- 무음 / 합치기 ---------- */

export function silenceBytes(ms, format = CANONICAL_FORMAT) {
  const length = Math.max(0, Math.round(((Number(ms) || 0) / 1000) * format.sampleRate));
  const blockAlign = (format.channels || 1) * ((format.bitsPerSample || 16) / 8);
  return new Uint8Array(length * blockAlign);
}

export function pcmDurationSec(byteLength, format = CANONICAL_FORMAT) {
  const blockAlign = (format.channels || 1) * ((format.bitsPerSample || 16) / 8);
  return byteLength / blockAlign / (format.sampleRate || CANONICAL_FORMAT.sampleRate);
}

/**
 * 표준 포맷 Int16Array 여러 개를 무음 간격과 함께 이어 붙인다.
 * @param {Int16Array[]} tracks 각 장면의 24kHz 모노 샘플
 * @param {number} gapMs 장면 사이 무음(ms)
 * @returns {{ bytes: Uint8Array, totalSamples: number, gapSamples: number }}
 */
export function concatTracks(tracks, gapMs = 0) {
  const list = (tracks || []).filter((t) => t && t.length);
  const gapSamples = Math.max(0, Math.round(((Number(gapMs) || 0) / 1000) * CANONICAL_FORMAT.sampleRate));
  let total = 0;
  list.forEach((track, index) => {
    total += track.length;
    if (index < list.length - 1) total += gapSamples;
  });
  const merged = new Int16Array(total);
  let cursor = 0;
  list.forEach((track, index) => {
    merged.set(track, cursor);
    cursor += track.length;
    if (index < list.length - 1) cursor += gapSamples; // 0으로 채워진 무음
  });
  return { bytes: encodeWav(int16ToBytes(merged), CANONICAL_FORMAT), totalSamples: total, gapSamples };
}

/** 재생/모니터용 파형 피크. 0~1 사이 값 배열. */
export function buildPeaks(samples, buckets = 160) {
  const count = Math.max(1, Math.floor(buckets));
  if (!samples || samples.length === 0) return new Array(count).fill(0);
  const step = samples.length / count;
  const peaks = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor(i * step);
    const end = Math.min(samples.length, Math.max(start + 1, Math.floor((i + 1) * step)));
    let peak = 0;
    for (let j = start; j < end; j += 1) {
      const v = Math.abs(samples[j]);
      if (v > peak) peak = v;
    }
    peaks[i] = Math.min(1, peak / 32768);
  }
  return peaks;
}

/** base64 inlineData 하나를 재생 가능한 형태로 푼다. */
export function decodeInlineAudio(base64, mimeType) {
  const meta = parseAudioMime(mimeType);
  const rawBytes = base64ToBytes(base64);

  if (meta.kind === 'wav') {
    const { pcmBytes, format } = decodeWav(rawBytes);
    const samples = bytesToInt16(pcmBytes);
    return {
      kind: 'pcm',
      source: 'wav',
      mimeType: meta.mimeType,
      format,
      samples,
      canonical: toCanonicalSamples(samples, format),
      bytes: rawBytes,
    };
  }

  if (meta.kind === 'pcm') {
    const samples = bytesToInt16(rawBytes);
    return {
      kind: 'pcm',
      source: 'pcm',
      mimeType: meta.mimeType,
      format: { sampleRate: meta.sampleRate, channels: meta.channels, bitsPerSample: meta.bitsPerSample },
      samples,
      canonical: toCanonicalSamples(samples, meta),
      bytes: rawBytes,
    };
  }

  // mp3/ogg 등은 디코딩하지 않고 그대로 재생한다.
  return {
    kind: meta.kind === 'mp3' ? 'compressed' : 'unknown',
    source: meta.kind,
    mimeType: meta.mimeType,
    format: null,
    samples: null,
    canonical: null,
    bytes: rawBytes,
  };
}

export function formatDuration(sec) {
  const total = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatMs(ms) {
  return `${Math.round(Number(ms) || 0)}ms`;
}
