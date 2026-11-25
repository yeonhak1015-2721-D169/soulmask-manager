/**
 * 타임라인 대본 파서 + 타임라인 싱크 WAV 합치기 자동 검증.
 * 사용: node scripts/test-timeline.mjs   (앱 폴더 기준)
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'tltest-'));
const load = async (relative) => {
  const source = readFileSync(join(here, '..', 'js', relative), 'utf8');
  const file = join(tmp, relative.replace(/\.js$/, '.mjs').replace(/[\\/]/g, '_'));
  writeFileSync(file, source);
  return import(pathToFileURL(file).href);
};

const tl = await load('timeline.js');
const wav = await load('wav.js');

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
const group = (title) => console.log(`\n${title}`);

const u16 = (bytes, offset) => new DataView(bytes.buffer, bytes.byteOffset).getUint16(offset, true);
const u32 = (bytes, offset) => new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset, true);
const ascii = (bytes, offset, len) => String.fromCharCode(...bytes.slice(offset, offset + len));

function makeSamples(seconds, rate = 24000, amplitude = 8000, freq = 440) {
  const n = Math.round(seconds * rate);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i += 1) out[i] = Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * amplitude);
  return out;
}

/* 1. 시간 표기 */
group('1. 시각 표기 변환');
{
  check('parseTimecode 00:10 = 10초', tl.parseTimecode('00:10') === 10);
  check('parseTimecode 0:00 = 0초', tl.parseTimecode('0:00') === 0);
  check('parseTimecode 01:02:03 = 3723초', tl.parseTimecode('01:02:03') === 3723);
  check('parseTimecode 00:10.5 = 10.5초', tl.parseTimecode('00:10.5') === 10.5);
  check('parseTimecode 00:10,5 (쉼표) = 10.5초', tl.parseTimecode('00:10,5') === 10.5);
  check('parseTimecode 빈 값 = null', tl.parseTimecode('') === null);
  check('parseTimecode 엉뚱한 값 = null', tl.parseTimecode('abc') === null);
  check('parseTimecode 00:00:xx = null', tl.parseTimecode('00:00:xx') === null);

  check("formatTimecode(10) = '00:10'", tl.formatTimecode(10) === '00:10');
  check("formatTimecode(65) = '01:05'", tl.formatTimecode(65) === '01:05');
  check("formatTimecode(3723) = '1:02:03'", tl.formatTimecode(3723) === '1:02:03');
  check("formatTimelineLabel(0,10) = '00:00 ~ 00:10'", tl.formatTimelineLabel(0, 10) === '00:00 ~ 00:10');
  check('formatTimelineLabel 끝 없음 = 단일 표기', tl.formatTimelineLabel(15, null) === '00:15');
  check("timelineFilePart(0,10) = '00-00_00-10'", tl.timelineFilePart(0, 10) === '00-00_00-10');
  check("timelineFilePart(15,null) = '00-15'", tl.timelineFilePart(15, null) === '00-15');
}

/* 2. 사용자 예시 그대로 */
group('2. 사용자 예시 형식');
{
  const input = [
    '[00:00 ~ 00:10]',
    '나는 생존매니아, 하기다.',
    '소울마스크 8일차 생존을 시작했다.',
    '',
    '[00:11 ~ 00:30]',
    '거점부터 한바퀴 둘러봤다.',
    '여전히 평화롭고, 부족원들은 여유롭다',
  ].join('\n');
  const result = tl.parseTimelineText(input);
  check('장면 2개', result.scenes.length === 2, result.scenes.length);
  check('hasTimeline = true', result.hasTimeline === true);
  check('1번 구간 = 00:00 ~ 00:10', result.scenes[0].timelineLabel === '00:00 ~ 00:10');
  check('1번 startSec = 0', result.scenes[0].startSec === 0);
  check('1번 endSec = 10', result.scenes[0].endSec === 10);
  check('2번 startSec = 11', result.scenes[1].startSec === 11);
  check('2번 endSec = 30', result.scenes[1].endSec === 30);
  check(
    '1번 본문에 구간 표기 없음',
    !result.scenes[0].text.includes('00:00') && !result.scenes[0].text.includes('['),
    result.scenes[0].text,
  );
  check(
    '1번 본문 = 대사 두 줄',
    result.scenes[0].text === '나는 생존매니아, 하기다.\n소울마스크 8일차 생존을 시작했다.',
    JSON.stringify(result.scenes[0].text),
  );
  check(
    '2번 본문에 시각 없음',
    result.scenes[1].text === '거점부터 한바퀴 둘러봤다.\n여전히 평화롭고, 부족원들은 여유롭다',
    JSON.stringify(result.scenes[1].text),
  );
  check('경고 없음', result.warnings.length === 0, result.warnings);
  check('전체 구간 = 0~30', result.spanStartSec === 0 && result.spanEndSec === 30);
  check('모든 본문에서 숫자:숫자 사라짐', result.scenes.every((s) => !/\d{1,2}:\d{2}/.test(s.text)));
}

/* 3. 다양한 표기 */
group('3. 유연한 구간 표기');
{
  const variants = [
    ['[00:00 ~ 00:10]\n가', 0, 10],
    ['[00:00 - 00:10]\n가', 0, 10],
    ['[0:00~0:10]\n가', 0, 10],
    ['[00:00～00:10]\n가', 0, 10],
    ['[00:00〜00:10]\n가', 0, 10],
    ['[00:00–00:10]\n가', 0, 10],
    ['[00:00 — 00:10]\n가', 0, 10],
    ['[01:02:03 ~ 01:02:15]\n가', 3723, 3735],
  ];
  variants.forEach(([text, start, end]) => {
    const result = tl.parseTimelineText(text);
    const scene = result.scenes[0];
    check(`「${text.split('\n')[0]}」 파싱`, Boolean(scene) && scene.startSec === start && scene.endSec === end,
      scene ? `${scene.startSec}~${scene.endSec}` : 'none');
    check(`「${text.split('\n')[0]}」 본문은 '가'`, scene && scene.text === '가', scene && scene.text);
  });

  const single = tl.parseTimelineText('[00:15]\n한 줄');
  check('단일 시점 [00:15] startSec', single.scenes[0].startSec === 15);
  check('단일 시점 endSec = null', single.scenes[0].endSec === null);
  check('단일 시점 label = 00:15', single.scenes[0].timelineLabel === '00:15');

  const inline = tl.parseTimelineText('[00:00 ~ 00:05] 같은 줄 대사\n다음 줄 대사');
  check('구간과 같은 줄 대사도 본문으로', inline.scenes[0].text === '같은 줄 대사\n다음 줄 대사', inline.scenes[0].text);

  const spaced = tl.parseTimelineText('  [ 00:00~00:10 ]  \n가');
  check('공백이 많은 표기', spaced.scenes.length === 1 && spaced.scenes[0].startSec === 0, spaced.scenes.length);
}

/* 4. CRLF / BOM */
group('4. CRLF · UTF-8 BOM');
{
  const crlf = '[00:00 ~ 00:10]\r\n첫 줄\r\n둘째 줄\r\n\r\n[00:11 ~ 00:20]\r\n셋째 줄\r\n';
  const result = tl.parseTimelineText(crlf);
  check('CRLF 2장면', result.scenes.length === 2, result.scenes.length);
  check('CRLF 본문에 \\r 없음', !result.scenes[0].text.includes('\r'), JSON.stringify(result.scenes[0].text));
  check('CRLF 본문 줄바꿈 유지', result.scenes[0].text === '첫 줄\n둘째 줄', JSON.stringify(result.scenes[0].text));

  const bom = `\uFEFF[00:00 ~ 00:10]\n보이는 대사`;
  const bomResult = tl.parseTimelineText(bom);
  check('BOM 있어도 첫 구간 인식', bomResult.hasTimeline && bomResult.scenes.length === 1, bomResult.scenes.length);
  check('BOM이 본문에 남지 않음', bomResult.scenes[0].text === '보이는 대사', JSON.stringify(bomResult.scenes[0].text));
  check('BOM 앞 공백 경고 없음', bomResult.warnings.length === 0, bomResult.warnings);
}

/* 5. 본문 정리 */
group('5. 대본 본문 정리');
{
  const body = '[00:00 ~ 00:10]\n\n\n첫 문단\n\n\n\n둘째 문단\n\n';
  const result = tl.parseTimelineText(body);
  check('앞뒤 빈 줄 제거', result.scenes[0].text === '첫 문단\n\n둘째 문단', JSON.stringify(result.scenes[0].text));
  check('빈 줄 3개 이상은 1개로', !/\n{3,}/.test(result.scenes[0].text));

  const sneaky = '[00:00 ~ 00:10]\n앞 대사 [00:05 ~ 00:06] 뒤 대사';
  const stripped = tl.parseTimelineText(sneaky);
  check('본문 속 구간 표기도 제거', !/\d{1,2}:\d{2}/.test(stripped.scenes[0].text), stripped.scenes[0].text);
  check('본문 속 표기 자리에 공백', stripped.scenes[0].text === '앞 대사   뒤 대사', JSON.stringify(stripped.scenes[0].text));

  const marker = tl.parseTimelineText('[00:00 ~ 00:10]\n[웃음] 그냥 웃었다');
  check('일반 대괄호 표기는 보존', marker.scenes[0].text === '[웃음] 그냥 웃었다', marker.scenes[0].text);
  check('일반 대괄호 표기는 경고 없음', marker.warnings.length === 0, marker.warnings);

  const broken = tl.parseTimelineText('[00:00 ~ 00:10]\n앞 대사\n[00:12 ~ 한참 뒤]\n뒤 대사');
  check('망가진 구간 표기는 본문에서 제거', !broken.scenes[0].text.includes('한참'), JSON.stringify(broken.scenes[0].text));
  check('망가진 구간 표기 경고', broken.warnings.some((w) => w.includes('읽지 못해')), broken.warnings);
}

/* 6. 애매한 입력 */
group('6. 애매한 입력 처리');
{
  const reversed = tl.parseTimelineText('[00:20 ~ 00:10]\n가');
  check('끝이 시작보다 빠르면 경고', reversed.warnings.length === 1, reversed.warnings);
  check('끝이 시작보다 빠르면 단일 시점', reversed.scenes[0].endSec === null && reversed.scenes[0].startSec === 20);
  check('단일 시점 label', reversed.scenes[0].timelineLabel === '00:20');

  const empty = tl.parseTimelineText('[00:00 ~ 00:10]\n\n[00:11 ~ 00:20]\n본문');
  check('대본 없는 구간도 장면으로 유지', empty.scenes.length === 2, empty.scenes.length);
  check('대본 없는 구간은 빈 본문', empty.scenes[0].text === '');
  check('대본 없는 구간 경고', empty.warnings.some((w) => w.includes('대본이 없어')), empty.warnings);

  const preamble = tl.parseTimelineText('머리말 대사\n\n[00:00 ~ 00:10]\n본문');
  check('구간 앞 대본 경고', preamble.warnings.some((w) => w.includes('구간 없는 첫 장면')), preamble.warnings);
  check('구간 앞 대본은 preambleText로', preamble.preambleText === '머리말 대사', preamble.preambleText);
  check('구간 장면은 1개', preamble.scenes.length === 1);

  const plain = tl.parseTimelineText('그냥 대본입니다.\n\n두 번째 문단.');
  check('구간 표기 없으면 hasTimeline false', plain.hasTimeline === false);
  check('구간 표기 없으면 scenes 비어 있음', plain.scenes.length === 0);
  check('구간 표기 없으면 preambleText에 보존', plain.preambleText.includes('그냥 대본입니다'));

  const badTime = tl.parseTimelineText('[00:xx ~ 00:10]\n가');
  check('시각을 못 읽는 표기는 경고', badTime.warnings.some((w) => w.includes('시작 시각')), badTime.warnings);

  const narrative = tl.parseTimelineText('00:10에 문을 열었다.\n10:30쯤 돌아왔다.');
  check('대사 속 시각은 구간으로 오인하지 않음', narrative.hasTimeline === false, narrative.headerCount);

  const thousands = tl.parseTimelineText('[00:00 ~ 00:10]\n1,000원짜리 통조림을 샀다');
  check('본문의 쉼표 숫자 보존', thousands.scenes[0].text === '1,000원짜리 통조림을 샀다', thousands.scenes[0].text);
}

/* 7. 목표 길이 / 길이 비교 */
group('7. 목표 길이와 실측 비교');
{
  check('targetDurationSec 0~10 = 10', tl.targetDurationSec({ startSec: 0, endSec: 10 }) === 10);
  check('targetDurationSec 단일 시점 = null', tl.targetDurationSec({ startSec: 5, endSec: null }) === null);
  check('targetDurationSec 0초 구간 = null', tl.targetDurationSec({ startSec: 5, endSec: 5 }) === null);
  check('targetDurationSec 구간 없음 = null', tl.targetDurationSec({}) === null);
  check('hasTimeline 0초 시작도 true', tl.hasTimeline({ startSec: 0 }) === true);
  check('hasTimeline 필드 없으면 false', tl.hasTimeline({}) === false);

  const short = tl.compareDuration(7.2, 10);
  check('여유 문구', short && short.text === '생성 7.2초 (여유 2.8초)', short && short.text);
  check('여유 tone = fit', short && short.tone === 'fit');

  const over = tl.compareDuration(11.4, 10);
  check('초과 문구', over && over.text === '생성 11.4초 (+1.4초 초과)', over && over.text);
  check('큰 초과는 over-major', over && over.tone === 'over-major');

  const tiny = tl.compareDuration(10.2, 10);
  check('작은 초과는 over', tiny && tiny.tone === 'over', tiny && tiny.tone);

  const exact = tl.compareDuration(10, 10);
  check('거의 같음 문구', exact && exact.text.includes('거의 같아요'), exact && exact.text);

  check('목표 없으면 null', tl.compareDuration(3, null) === null);
  check('길이 0이면 null', tl.compareDuration(0, 10) === null);
}

/* 8. 타임라인 싱크 합치기 */
group('8. 타임라인 싱크 WAV');
{
  const a = makeSamples(1);
  const b = makeSamples(1, 24000, 8000, 660);
  const result = wav.buildTimelineTrack([
    { samples: a, startSec: 0, index: 0 },
    { samples: b, startSec: 11, index: 1 },
  ], { totalSec: 21 });

  check('총 길이 = 마지막 구간 끝 21초', result.totalSamples === 21 * 24000, result.totalSamples);
  check('실제 총 초 = 21', Math.abs(result.totalSec - 21) < 1e-9);
  check('1번 구간 0초 시작', result.segments[0].startSec === 0);
  check('2번 구간 11초 시작', result.segments[1].startSec === 11, result.segments[1].startSec);
  check('밀린 장면 없음', result.shifted.length === 0);
  check('WAV 헤더 24kHz 모노 16bit',
    u32(result.bytes, 24) === 24000 && u16(result.bytes, 22) === 1 && u16(result.bytes, 34) === 16);
  check('data 크기 = 총 샘플*2', u32(result.bytes, 40) === 21 * 24000 * 2, u32(result.bytes, 40));
  check('RIFF 시그니처', ascii(result.bytes, 0, 4) === 'RIFF' && ascii(result.bytes, 8, 4) === 'WAVE');

  const decoded = wav.decodeWav(result.bytes);
  const merged = wav.bytesToInt16(decoded.pcmBytes);
  let silent = true;
  for (let i = 1 * 24000 + 100; i < 11 * 24000 - 100; i += 97) {
    if (merged[i] !== 0) { silent = false; break; }
  }
  check('1초 이후 ~ 11초 사이는 무음', silent);
  check('11초 지점부터 2번 음성', merged[11 * 24000 + 50] === b[50], merged[11 * 24000 + 50]);
  check('마지막 구간 뒤는 무음 패딩', merged[20 * 24000 + 5000] === 0);
  check('0초 지점은 1번 음성', merged[30] === a[30]);
}

group('9. 타임라인 싱크 — 넘침/빈 구간 처리');
{
  const long = makeSamples(12);
  const short = makeSamples(1);
  const overrun = wav.buildTimelineTrack([
    { samples: long, startSec: 0, index: 0 },
    { samples: short, startSec: 11, index: 1 },
  ]);
  check('넘치는 장면은 잘리지 않음', overrun.segments[0].durationSec === 12);
  check('다음 장면은 앞 음성 끝(12초)에 시작', Math.abs(overrun.segments[1].startSec - 12) < 1e-9, overrun.segments[1].startSec);
  check('밀린 장면 1개', overrun.shifted.length === 1);
  check('밀린 시간 1.0초', Math.abs(overrun.shifted[0].shiftedSec - 1) < 1e-9);
  check('총 길이 = 13초', overrun.totalSamples === 13 * 24000, overrun.totalSamples);

  const noStart = wav.buildTimelineTrack([
    { samples: short, startSec: 0, index: 0 },
    { samples: short, startSec: null, index: 1 },
    { samples: short, startSec: null, index: 2 },
  ]);
  check('구간 없는 장면은 앞 장면 뒤에 붙음',
    Math.abs(noStart.segments[1].startSec - 1) < 1e-9 && Math.abs(noStart.segments[2].startSec - 2) < 1e-9,
    `${noStart.segments[1].startSec} / ${noStart.segments[2].startSec}`);
  check('구간 없는 장면은 밀림으로 세지 않음', noStart.shifted.length === 0);
  check('구간 없는 장면 3개 총 3초', noStart.totalSamples === 3 * 24000);

  const padded = wav.buildTimelineTrack([{ samples: short, startSec: 0 }], { totalSec: 30 });
  check('마지막 구간 끝까지 무음 채움', padded.totalSamples === 30 * 24000, padded.totalSamples);

  const empty = wav.buildTimelineTrack([], { totalSec: 5 });
  check('음성 없이 totalSec만 있으면 전체 무음', empty.totalSamples === 5 * 24000 && empty.segments.length === 0);

  const reversed = wav.buildTimelineTrack([
    { samples: short, startSec: 20, index: 0 },
    { samples: short, startSec: 5, index: 1 },
  ]);
  check('구간이 거꾸로면 순서 경고', reversed.ordered === false);

  const first = wav.buildTimelineTrack([{ samples: short, startSec: 3 }]);
  check('첫 장면이 3초에서 시작하면 앞은 무음', first.totalSamples === 4 * 24000, first.totalSamples);
  const firstDecoded = wav.bytesToInt16(wav.decodeWav(first.bytes).pcmBytes);
  check('3초 앞은 무음', firstDecoded.slice(0, 3 * 24000).every((v) => v === 0));
  check('3초부터 음성', firstDecoded[3 * 24000 + 20] === short[20]);
}

group('10. 기존 호흡 간격 합치기는 그대로');
{
  const a = makeSamples(1);
  const b = makeSamples(1);
  const gap = wav.concatTracks([a, b], 650);
  check('650ms 간격 합치기 유지', gap.totalSamples === 2 * 24000 + 15600, gap.totalSamples);
}

console.log(`\n결과: ${passed}개 통과, ${failures.length}개 실패`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
