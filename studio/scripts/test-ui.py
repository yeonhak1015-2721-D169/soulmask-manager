"""하기 로그 내레이션 스튜디오 — 로컬 UI·생성 파이프라인 검증 (Playwright)

실행:
  cd hagi-narration-studio
  LD_LIBRARY_PATH=/workspace/tmp/chlibs/root/usr/lib/x86_64-linux-gnu python3 scripts/test-ui.py
사전: python3 -m http.server 8099 (앱 폴더에서)

Gemini API는 page.route로 가짜 응답(24kHz 16bit 모노 1초 사인파)을 돌려주어,
키 없이도 요청 본문·PCM→WAV 변환·합치기·다운로드까지 실제 코드 경로를 검사한다.
"""

import base64
import json
import math
import os
import struct
import sys
import urllib.request
import wave
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8099/index.html'
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT.parent / 'downloads'
OUT.mkdir(exist_ok=True)

results = []
console_errors = []
page_errors = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS  ' if ok else 'FAIL  ') + name + (('  — ' + str(detail)) if detail else ''))


def tone_pcm_b64(seconds=1.0, rate=24000, freq=220.0, amp=9000):
    n = int(seconds * rate)
    samples = [int(amp * math.sin(2 * math.pi * freq * i / rate)) for i in range(n)]
    return base64.b64encode(struct.pack('<%dh' % n, *samples)).decode()


AUDIO_B64 = tone_pcm_b64()
request_log = []
mode = {'status': 'ok'}


def tts_handler(route):
    req = route.request
    if req.method == 'OPTIONS':
        route.fulfill(status=204, headers={
            'access-control-allow-origin': '*',
            'access-control-allow-headers': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
        })
        return
    request_log.append(json.loads(req.post_data or '{}'))
    headers = {'access-control-allow-origin': '*', 'content-type': 'application/json'}
    if mode['status'] == 'reject_metadata':
        part = (request_log[-1].get('contents') or [{}])[0].get('parts', [{}])[0]
        if 'speechMetadata' in part:
            route.fulfill(status=400, headers=headers, body=json.dumps({
                'error': {'code': 400, 'status': 'INVALID_ARGUMENT', 'message': 'Unknown name "speechMetadata": Cannot find field.'}
            }))
            return
    if mode['status'] == 'rate':
        route.fulfill(status=429, headers=headers, body=json.dumps({
            'error': {'code': 429, 'status': 'RESOURCE_EXHAUSTED', 'message': 'Quota exceeded for free tier.'}
        }))
        return
    route.fulfill(status=200, headers=headers, body=json.dumps({
        'candidates': [{
            'content': {'parts': [{'inlineData': {
                'mimeType': 'audio/L16;codec=pcm;rate=24000', 'data': AUDIO_B64,
            }}], 'role': 'model'},
            'finishReason': 'STOP',
        }],
        'usageMetadata': {'totalTokenCount': 120},
    }))


def wait_until(page, fn, timeout=8000, step=100):
    import time
    end = time.time() + timeout / 1000
    while time.time() < end:
        if fn():
            return True
        page.wait_for_timeout(step)
    return fn()


def no_overflow(page, label):
    m = page.evaluate("""() => {
        const de = document.documentElement;
        const wide = [...document.querySelectorAll('body *')]
            .filter(el => {
                const r = el.getBoundingClientRect();
                if (r.width === 0 || r.height === 0) return false;
                if (r.right <= innerWidth + 1.5) return false;
                let p = el.parentElement;
                while (p && p !== document.body) {
                    const st = getComputedStyle(p);
                    if ((st.overflowX === 'auto' || st.overflowX === 'scroll') && p.scrollWidth > p.clientWidth) return false;
                    p = p.parentElement;
                }
                return true;
            })
            .slice(0, 5)
            .map(el => el.className || el.tagName);
        return { sw: de.scrollWidth, cw: de.clientWidth, wide };
    }""")
    ok = m['sw'] <= m['cw'] + 1 and not m['wide']
    check(f'{label}: 가로 넘침 없음 (scrollWidth {m["sw"]} / client {m["cw"]})', ok, m['wide'])
    return ok


def scene_count(page):
    return page.locator('#scene-list .scene').count()


def statuses(page):
    return page.eval_on_selector_all('.scene [data-role="status"]', 'els => els.map(e => e.textContent.trim())')


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                                  is_mobile=True, has_touch=True, accept_downloads=True,
                                  locale='ko-KR')
        page = ctx.new_page()
        page.on('console', lambda msg: console_errors.append(f'{msg.type}: {msg.text}') if msg.type == 'error' else None)
        page.on('pageerror', lambda err: page_errors.append(str(err)))
        page.on('dialog', lambda d: d.accept())
        page.route('**/generativelanguage.googleapis.com/**', tts_handler)

        page.goto(BASE, wait_until='load')
        page.wait_for_timeout(600)

        # 1. 초기 렌더
        check('화자 9종 렌더', page.locator('#voice-list .voice-opt').count() == 9)
        check('기본 화자 Orus', page.locator('.voice-opt[aria-checked="true"] .v-name').inner_text() == 'Orus')
        check('Orus에 추천 배지', page.locator('.voice-opt[data-id="Orus"] .v-badge').count() == 1)
        check('모델 2종 + 직접 입력', page.locator('#model-seg button').count() == 2
              and page.locator('#model-custom').count() == 1)
        check('기본 간격 650ms', page.locator('#gap-value').inner_text() == '650ms')
        check('기본 속도: 약간 빠르게', page.locator('#speed-seg button[aria-pressed="true"]').inner_text().startswith('약간 빠르게'))
        check('기본 음역: 중간 바리톤', '중간 바리톤' in page.locator('#range-seg button[aria-pressed="true"]').inner_text())
        prompt_text = page.locator('#prompt-text').input_value()
        check('고정 지시문 기본값 로드', '젊고 낮은 남성 목소리' in prompt_text and '드립이 있는 문장은' in prompt_text,
              f'{len(prompt_text)}자')
        check('장면 1개로 시작', scene_count(page) == 1)
        no_overflow(page, '390px 초기 화면')

        # 2. API 키 입력 + 연결 테스트
        page.fill('#api-key', 'AIzaTESTKEY_123')
        check('키 입력 시 상태 표시', page.locator('#status-text').inner_text() == '키 입력됨')
        page.click('#test-conn')
        ok = wait_until(page, lambda: '연결 성공' in page.locator('#key-msg').inner_text(), 6000)
        check('연결 테스트 성공 메시지', ok, page.locator('#key-msg').inner_text())
        check('연결 후 상태칩 = 연결됨', page.locator('#status-text').inner_text() == '연결됨')
        check('연결 테스트 요청에 AUDIO 모달리티', request_log and request_log[0]['generationConfig']['responseModalities'] == ['AUDIO'])

        # 3. 샘플 불러오기
        page.click('#sample-list .sample-card[data-id="ruins-day14"]')
        page.wait_for_timeout(400)
        check('샘플 3장면 로드', scene_count(page) == 3, scene_count(page))
        summary = page.locator('#wb-summary').inner_text()
        check('요약에 장면·글자·예상 길이', '장면 3개' in summary and '자' in summary and '예상' in summary, summary)

        # 4. 음색 / 톤 조정
        page.click('.voice-opt[data-id="Alnilam"]')
        page.click('#range-seg button:has-text("묵직한 저음")')
        page.click('#speed-seg button:has-text("차분하고 여유 있게")')
        page.locator('#gap-range').fill('900')
        page.locator('#gap-range').dispatch_event('input')
        page.wait_for_timeout(150)
        check('간격 900ms 반영', page.locator('#gap-value').inner_text() == '900ms')
        check('모니터 힌트 갱신', '900ms' in page.locator('#mon-hint').inner_text())

        # 5. 단일 장면 생성 (요청 본문 검사)
        request_log.clear()
        page.click('.scene:first-child [data-act="gen"]')
        ok = wait_until(page, lambda: statuses(page)[0] == '완료', 10000)
        check('장면1 생성 완료', ok, statuses(page))
        body = request_log[-1]
        prompt_sent = body['contents'][0]['parts'][0]['text']
        check('요청 화자 = Alnilam', body['generationConfig']['speechConfig']['voiceConfig']['prebuiltVoiceConfig']['voiceName'] == 'Alnilam')
        check('지시문에 음역·속도·호흡 반영',
              '묵직한 저음' in prompt_sent and '차분하고 여유 있게' in prompt_sent and '900ms' in prompt_sent)
        check('지시문에 장면 분위기(일상)', '이 장면은 일상' in prompt_sent)
        check('대본이 프롬프트에 포함', '폐허 도시 14일차' in prompt_sent)
        check('지시문 읽지 말라는 규칙 포함', '지시문은 읽지 않는다' in prompt_sent)
        check('파형 표시됨', page.evaluate("() => document.querySelector('#mon-idle').hidden && document.querySelector('#mon-canvas').width > 10"))
        check('재생 시간 표시', '0:01' in page.locator('#mon-sub').inner_text() or '0:01' in page.locator('#mon-time').inner_text(),
              page.locator('#mon-sub').inner_text())

        # 6. 전체 생성
        page.click('#generate-all')
        ok = wait_until(page, lambda: statuses(page) == ['완료', '완료', '완료'], 15000)
        check('3장면 모두 완료', ok, statuses(page))
        check('생성 진행 메시지', '완료 3/3' in page.locator('#gen-msg').inner_text(), page.locator('#gen-msg').inner_text())

        # 7. 장면 WAV 다운로드
        with page.expect_download() as dl:
            page.click('.scene:first-child [data-act="wav"]')
        d1 = dl.value
        path1 = OUT / 'studio-scene1.wav'
        d1.save_as(path1)
        with wave.open(str(path1)) as w:
            check('장면 WAV: 24kHz 모노 16bit 1초',
                  w.getframerate() == 24000 and w.getnchannels() == 1 and w.getsampwidth() == 2 and w.getnframes() == 24000,
                  (w.getframerate(), w.getnchannels(), w.getnframes()))

        # 8. 전체 합치기
        with page.expect_download() as dl:
            page.click('#mon-merge')
        path_all = OUT / 'studio-merged.wav'
        dl.value.save_as(path_all)
        with wave.open(str(path_all)) as w:
            frames = w.getnframes()
            expected = 3 * 24000 + 2 * int(0.9 * 24000)
            check('합친 WAV 프레임 = 3장면 + 900ms 무음 2회',
                  abs(frames - expected) <= 2 and w.getframerate() == 24000 and w.getnchannels() == 1,
                  f'{frames} vs {expected}')
            data = w.readframes(frames)
        gap_start = 24000 * 2
        silent = all(b == 0 for b in data[gap_start:gap_start + int(0.9 * 24000) * 2])
        check('장면 사이 무음 구간 확인', silent)
        check('합친 파일 이름 규칙', d1.suggested_filename.endswith('.wav') and 'scene' in d1.suggested_filename
              or d1.suggested_filename.startswith('hagilog-'), d1.suggested_filename)

        # 9. 재생 동작 (두 번 눌러 확실히 멈춘 뒤 재생)
        page.click('.scene:first-child [data-act="play"]')
        page.wait_for_timeout(500)
        if '일시정지' in page.locator('#mon-play').inner_text():
            page.click('#mon-play')
            page.wait_for_timeout(200)
        check('일시정지 상태 확인', '▶ 재생' in page.locator('#mon-play').inner_text(), page.locator('#mon-play').inner_text())
        page.click('.scene:first-child [data-act="play"]')
        ok = wait_until(page, lambda: '일시정지' in page.locator('#mon-play').inner_text(), 400, 50)
        check('재생 상태 표시', ok, page.locator('#mon-play').inner_text())
        check('재생 시간이 흐름', page.locator('#mon-time').inner_text() != '0:00 / 0:01', page.locator('#mon-time').inner_text())
        page.click('#mon-play')
        page.wait_for_timeout(200)

        page.screenshot(path=str(OUT / 'studio-390.png'), full_page=True)

        # 10. 통대본 자동 나누기
        page.click('#open-split')
        page.wait_for_timeout(200)
        text = '첫 번째 장면입니다. 물을 확인한다.\n\n두 번째 장면입니다. 건물을 살핀다.\n\n세 번째 장면입니다. 돌아온다.'
        page.fill('#split-input', text)
        page.wait_for_timeout(150)
        check('나누기 미리보기 3장면', '3장면' in page.locator('#split-preview').inner_text(),
              page.locator('#split-preview').inner_text())
        no_overflow(page, '390px 나누기 시트')
        page.click('#split-replace')
        page.wait_for_timeout(300)
        check('통대본 3장면으로 교체', scene_count(page) == 3, scene_count(page))
        check('교체 후 음성 초기화', statuses(page) == ['대기', '대기', '대기'], statuses(page))

        # 11. 429 오류 메시지
        mode['status'] = 'rate'
        page.click('.scene:first-child [data-act="gen"]')
        ok = wait_until(page, lambda: '무료 티어' in page.locator('.scene:first-child [data-role="error"]').inner_text(), 6000)
        check('429 → 한국어 안내', ok, page.locator('.scene:first-child [data-role="error"]').inner_text())
        check('오류 상태 표시', statuses(page)[0] == '실패', statuses(page))
        mode['status'] = 'ok'
        page.click('.scene:first-child [data-act="gen"]')
        ok = wait_until(page, lambda: statuses(page)[0] == '완료', 8000)
        check('재시도 성공', ok, statuses(page))
        page.wait_for_timeout(1200)
        page.screenshot(path=str(OUT / 'studio-390-full.png'), full_page=True)

        # 12. 새로고침 후 설정 유지
        page.reload(wait_until='load')
        page.wait_for_timeout(700)
        check('새로고침 후 장면 유지', scene_count(page) == 3, scene_count(page))
        check('새로고침 후 화자 유지', page.locator('#voice-pill').inner_text() == 'Alnilam')
        check('새로고침 후 간격 유지', page.locator('#gap-value').inner_text() == '900ms')
        check('새로고침 후 키 유지', page.locator('#api-key').input_value() == 'AIzaTESTKEY_123')
        check('음성은 새로고침 후 초기화(예상)', statuses(page)[0] != '완료')

        # 13. Gemini 3.8 TTS — speechMetadata.style 경로
        page.click('#model-seg button[data-id="gemini-3.8-flash-tts"]')
        page.wait_for_timeout(150)
        check('모델 전환 표시', page.locator('#model-current').inner_text() == 'gemini-3.8-flash-tts')
        check('3.8 안내 문구', '연기 지시' in page.locator('#model-note').inner_text(), page.locator('#model-note').inner_text())
        request_log.clear()
        page.click('.scene:first-child [data-act="gen"]')
        ok = wait_until(page, lambda: statuses(page)[0] == '완료', 10000)
        body = request_log[-1]
        part = body['contents'][0]['parts'][0]
        style_text = (part.get('speechMetadata') or {}).get('style', '')
        check('3.8: 지시를 speechMetadata.style로 전달',
              '묵직한 저음' in style_text and '차분하고 여유 있게' in style_text and '이 장면은 일상' in style_text, style_text[:120])
        scene_text = page.locator('.scene:first-child textarea').input_value().strip()
        check('3.8: 텍스트는 대본만', part['text'].strip() == scene_text and '[대본]' not in part['text'], part['text'][:60])
        check('언어 코드 ko-KR', body['generationConfig']['speechConfig'].get('languageCode') == 'ko-KR')
        check('3.8 생성 완료', ok, statuses(page))

        # 13b. speechMetadata 거부 시 기존 방식으로 자동 재시도
        mode['status'] = 'reject_metadata'
        request_log.clear()
        page.click('.scene:nth-child(2) [data-act="gen"]')
        ok = wait_until(page, lambda: statuses(page)[1] == '완료', 10000)
        check('speechMetadata 거부 → 지시문+대본으로 재시도',
              ok and len(request_log) >= 2 and '[대본]' in request_log[-1]['contents'][0]['parts'][0]['text'],
              len(request_log))
        mode['status'] = 'ok'

        # 13c. 2.5 모델로 돌아가면 한 덩어리 프롬프트
        page.click('#model-seg button[data-id="gemini-2.5-flash-preview-tts"]')
        request_log.clear()
        page.click('.scene:nth-child(3) [data-act="gen"]')
        ok = wait_until(page, lambda: statuses(page)[2] == '완료', 10000)
        part25 = request_log[-1]['contents'][0]['parts'][0]
        check('2.5: 지시문+대본 한 덩어리',
              ok and '[대본]' in part25['text'] and 'speechMetadata' not in part25, list(part25))

        # 14. 데스크톱 레이아웃
        desktop = ctx.new_page()
        desktop.on('pageerror', lambda e: page_errors.append('desktop: ' + str(e)))
        desktop.on('console', lambda m: console_errors.append(f'desktop {m.type}: {m.text}') if m.type == 'error' else None)
        desktop.route('**/generativelanguage.googleapis.com/**', tts_handler)
        desktop.set_viewport_size({'width': 1366, 'height': 900})
        desktop.goto(BASE, wait_until='load')
        desktop.wait_for_timeout(700)
        no_overflow(desktop, '1366px 데스크톱')
        cols = desktop.evaluate("() => getComputedStyle(document.querySelector('.layout')).gridTemplateColumns")
        check('데스크톱 2단 그리드', len(cols.split()) == 2, cols)
        check('데스크톱에서 모니터 고정', desktop.evaluate("() => getComputedStyle(document.querySelector('#monitor')).position") == 'fixed')
        desktop.screenshot(path=str(OUT / 'studio-1366.png'), full_page=True)

        # 14. 콘솔 오류 (429 모의 응답에 따른 네트워크 오류는 의도된 것)
        unexpected = [e for e in console_errors if not any(code in e for code in ('429', '400'))]
        check('콘솔 오류 없음', not unexpected, unexpected[:3])
        check('페이지 예외 없음', not page_errors, page_errors[:3])

        browser.close()

    failed = [r for r in results if not r[1]]
    print(f'\n결과: {len(results) - len(failed)}개 통과, {len(failed)}개 실패')
    for name, _, detail in failed:
        print(f'  - {name} {detail}')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
