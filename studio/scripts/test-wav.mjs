/**
 * WAV / PCM 로직 자동 검증.
 * 앱은 GitHub Pages에서 ES 모듈로 바로 돌고, 이 스크립트는 같은 파일을 Node에서 검사한다.
 * 사용: node scripts/test-wav.mjs   (앱 폴더 기준)
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'js', 'wav.js'), 'utf8');
const tmp = mkdtempSync(join(tmpdir(), 'wavtest-'));
const tmpFile = join(tmp, 'wav.mjs');
writeFileSync(tmpFile, source);
const wav = await import(pathToFileURL(tmpFile).href);

let passed = 0;
const failures = [];
function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
function group(title) {
  console.log(`\n${title}`);
}

const ascii = (bytes, offset, len) => String.fromCharCode(...bytes.slice(offset, offset + len));
const u16 = (bytes, offset) => new DataView(bytes.buffer, bytes.byteOffset).getUint16(offset, true);
const u32 = (bytes, offset) => new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset, true);

function makeSamples(seconds, rate, amplitude = 8000, freq = 440) {
  const n = Math.round(seconds * rate);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i += 1) out[i] = Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * amplitude);
  return out;
}

/* 1. 헤더 */
group('1. WAV 헤더 (24kHz · 16bit · 모노)');
{
  const samples = makeSamples(0.5, 24000);
  const pcm = wav.int16ToBytes(samples);
  const bytes = wav.encodeWav(pcm, wav.CANONICAL_FORMAT);
  check('RIFF/WAVE 시그니처', ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE');
  check('fmt 청크', ascii(bytes, 12, 4) === 'fmt ' && u32(bytes, 16) === 16);
  check('PCM 포맷 코드 = 1', u16(bytes, 20) === 1);
  check('채널 = 1', u16(bytes, 22) === 1);
  check('샘플레이트 = 24000', u32(bytes, 24) === 24000);
  check('byteRate = 48000', u32(bytes, 28) === 48000);
  check('blockAlign = 2', u16(bytes, 32) === 2);
  check('bitsPerSample = 16', u16(bytes, 34) === 16);
  check('data 청크', ascii(bytes, 36, 4) === 'data');
  check('data 크기 = 샘플수*2', u32(bytes, 40) === samples.length * 2);
  check('전체 길이 = 44 + data', bytes.length === 44 + samples.length * 2);
  check('RIFF 크기 = 36 + data', u32(bytes, 4) === 36 + samples.length * 2);
  check('PCM 본문 보존', u16(bytes, 44) === (samples[0] & 0xffff));
}

/* 2. 인코딩/디코딩 */
group('2. WAV 디코딩 왕복');
{
  const samples = makeSamples(0.25, 22050, 12000);
  const bytes = wav.encodeWav(wav.int16ToBytes(samples), { sampleRate: 22050, channels: 1, bitsPerSample: 16 });
  const decoded = wav.decodeWav(bytes);
  check('샘플레이트 복원', decoded.format.sampleRate === 22050);
  check('샘플 수 복원', decoded.pcmBytes.length === samples.length * 2);
  const back = wav.bytesToInt16(decoded.pcmBytes);
  check('샘플 값 복원', back.length === samples.length && back[100] === samples[100]);
}

/* 3. mimeType 해석 */
group('3. mimeType 해석');
{
  const a = wav.parseAudioMime('audio/L16;codec=pcm;rate=24000');
  check('L16 → pcm', a.kind === 'pcm' && a.sampleRate === 24000 && a.channels === 1);
  const b = wav.parseAudioMime('audio/pcm;rate=48000');
  check('audio/pcm rate 파싱', b.kind === 'pcm' && b.sampleRate === 48000);
  const c = wav.parseAudioMime('audio/pcm');
  check('rate 없으면 24000 기본', c.kind === 'pcm' && c.sampleRate === 24000);
  const d = wav.parseAudioMime('audio/wav');
  check('audio/wav 구분', d.kind === 'wav');
  const e = wav.parseAudioMime('audio/mpeg');
  check('audio/mpeg 구분', e.kind === 'mp3');
  const f = wav.parseAudioMime('audio/L16;codec=pcm;rate=44100;channels=2');
  check('채널·레이트 동시 파싱', f.channels === 2 && f.sampleRate === 44100);
}

/* 4. base64 */
group('4. base64 → 바이트');
{
  const original = Uint8Array.from([1, 2, 3, 250, 255, 0]);
  const b64 = Buffer.from(original).toString('base64');
  const decoded = wav.base64ToBytes(b64);
  check('바이트 일치', decoded.length === original.length && original.every((v, i) => decoded[i] === v));
  check('공백/줄바꿈 허용', wav.base64ToBytes(`${b64.slice(0, 4)}\n${b64.slice(4)}`).length === original.length);
}

/* 5. 모노 변환 / 리샘플 */
group('5. 모노 변환 · 리샘플');
{
  const stereo = Int16Array.from([100, 300, 200, -200, 0, 1000]);
  const mono = wav.toMono(stereo, 2);
  check('스테레오 다운믹스', mono.length === 3 && mono[0] === 200 && mono[2] === 500);

  const oneSec48k = makeSamples(1, 48000);
  const resampled = wav.resampleInt16(oneSec48k, 48000, 24000);
  check('48k→24k 길이 절반', Math.abs(resampled.length - 24000) <= 1, `len=${resampled.length}`);

  const same = wav.resampleInt16(oneSec48k, 48000, 48000);
  check('같은 레이트는 원본 유지', same === oneSec48k);
}

/* 6. 합치기 + 무음 */
group('6. 장면 합치기 (무음 간격)');
{
  const a = makeSamples(1, 24000);
  const b = makeSamples(0.5, 24000);
  const result = wav.concatTracks([a, b], 650);
  const expected = 24000 + 12000 + Math.round(0.65 * 24000);
  check('총 샘플 수 = A + B + 650ms', result.totalSamples === expected, `${result.totalSamples} vs ${expected}`);
  check('gapSamples 계산', result.gapSamples === 15600);

  const decoded = wav.decodeWav(result.bytes);
  check('헤더 data 크기 일치', decoded.pcmBytes.length === expected * 2);
  check('포맷 24k 모노 16bit', decoded.format.sampleRate === 24000 && decoded.format.channels === 1 && decoded.format.bitsPerSample === 16);
  check('총 길이 2.15초', Math.abs(wav.pcmDurationSec(result.bytes.length - 44) - 2.15) < 0.001);

  const merged = wav.bytesToInt16(decoded.pcmBytes);
  check('두 번째 장면 시작점 값', merged[24000 + 15600 + 10] === b[10], `${merged[24000 + 15600 + 10]} vs ${b[10]}`);
  let silent = true;
  for (let i = 24000; i < 24000 + 15600; i += 1) {
    if (merged[i] !== 0) { silent = false; break; }
  }
  check('간격 구간은 완전 무음', silent);
}

group('7. 간격 0ms / 900ms / 장면 1개');
{
  const a = makeSamples(0.2, 24000);
  const b = makeSamples(0.2, 24000);
  const zero = wav.concatTracks([a, b], 0);
  check('0ms 이면 합 그대로', zero.totalSamples === a.length + b.length);

  const long = wav.concatTracks([a, b], 900);
  check('900ms 무음 21600 샘플', long.totalSamples === a.length + b.length + 21600);

  const single = wav.concatTracks([a], 650);
  check('장면 1개면 무음 없음', single.totalSamples === a.length);

  const three = wav.concatTracks([a, b, a], 650);
  check('3장면은 무음 2번', three.totalSamples === a.length * 3 + a.length * 0 + 15600 * 2);
  check('빈 배열 방어', wav.concatTracks([], 650).totalSamples === 0);
  check('null 트랙 무시', wav.concatTracks([a, null, b], 650).totalSamples === a.length + b.length + 15600);
}

group('8. 엣지 케이스');
{
  const odd = Uint8Array.from([1, 2, 3]);
  const bytes = wav.encodeWav(odd, wav.CANONICAL_FORMAT);
  check('홀수 바이트는 블록 정렬로 절삭', u32(bytes, 40) === 2 && bytes.length === 46);

  const empty = wav.encodeWav(new Uint8Array(0), wav.CANONICAL_FORMAT);
  check('빈 오디오도 유효한 헤더', empty.length === 44 && u32(empty, 40) === 0 && ascii(empty, 0, 4) === 'RIFF');

  const peaks = wav.buildPeaks(makeSamples(0.2, 24000, 32767), 40);
  check('피크 개수', peaks.length === 40);
  check('피크 0~1 범위', peaks.every((p) => p >= 0 && p <= 1.0001));
  check('큰 소리 피크 근접 1', Math.max(...peaks) > 0.98);
  check('무음 피크 0', wav.buildPeaks(new Int16Array(1000), 10).every((p) => p === 0));
  check('빈 샘플 피크 0', wav.buildPeaks(new Int16Array(0), 8).every((p) => p === 0));

  const stereo = new Int16Array(48000);
  const decodedStereo = wav.decodeInlineAudio(
    Buffer.from(wav.int16ToBytes(stereo)).toString('base64'),
    'audio/L16;codec=pcm;rate=24000;channels=2',
  );
  check('스테레오 PCM → 모노 표준화', decodedStereo.canonical.length === 24000);

  const pcm48 = makeSamples(0.1, 48000);
  const decoded48 = wav.decodeInlineAudio(
    Buffer.from(wav.int16ToBytes(pcm48)).toString('base64'),
    'audio/L16;codec=pcm;rate=48000',
  );
  check('48k 응답도 24k로 정규화', Math.abs(decoded48.canonical.length - 2400) <= 1);

  const wavSamples = makeSamples(0.1, 24000);
  const wavBytes = wav.encodeWav(wav.int16ToBytes(wavSamples), wav.CANONICAL_FORMAT);
  const decodedWav = wav.decodeInlineAudio(Buffer.from(wavBytes).toString('base64'), 'audio/wav');
  check('WAV 응답 디코딩', decodedWav.canonical.length === wavSamples.length);

  const decodedMp3 = wav.decodeInlineAudio(Buffer.from([1, 2, 3]).toString('base64'), 'audio/mpeg');
  check('mp3 응답은 압축으로 표시', decodedMp3.kind === 'compressed' && decodedMp3.canonical === null);
}

group('9. 길이 표기');
{
  check('formatDuration 0:00', wav.formatDuration(0) === '0:00');
  check('formatDuration 2:05', wav.formatDuration(125) === '2:05');
  check('pcmDurationSec 24k 1초', Math.abs(wav.pcmDurationSec(48000) - 1) < 1e-9);
}

console.log(`\n결과: ${passed}개 통과, ${failures.length}개 실패`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
