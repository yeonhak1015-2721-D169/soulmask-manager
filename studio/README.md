# 🎙️ 하기 로그 내레이션 스튜디오

하기 로그(`@Hagi-Log`)의 생존 일지 내레이션을 **장면 단위**로 만들고, 장면 사이 호흡까지 붙여 하나의 `.wav`로 내려받는 개인용 TTS 스튜디오입니다.
Google Gemini TTS **무료 티어**를 브라우저에서 직접 호출하며, 서버·빌드·계정이 필요 없습니다(정적 파일만).

```
index.html            화면 구조
css/styles.css        옵시디언 + 앰버 테마 (모바일 우선)
js/app.js             화면·상태·재생·생성 파이프라인
js/tts.js             Gemini TTS 요청 조립, 오류 메시지, 지시문
js/wav.js             PCM → WAV, 장면 합치기(무음 간격), 파형 피크
js/samples.js         내장 샘플 3편
scripts/test-wav.mjs  WAV/PCM 로직 자동 검증 (Node)
scripts/test-ui.py    실제 브라우저 UI·생성 파이프라인 검증 (Playwright + 모의 API)
```

## 사용법

1. **[Google AI Studio → API 키](https://aistudio.google.com/apikey)** 에서 무료 키를 만듭니다.
2. 사이트의 「Gemini API 키」에 붙여넣고 **연결 테스트**를 누릅니다. (키는 `localStorage`에만 저장되고 다른 곳으로 전송되지 않습니다.)
3. **화자 음색**에서 목소리를 고릅니다. 기본은 `Orus`(중저음 바리톤, 추천).
4. **속도 및 호흡**에서 음역대·말하기 속도·장면 전환 간격(0~900ms, 기본 650ms)을 맞춥니다.
5. **고정 발성 지시문**은 모든 장면에 들어가는 연출 지시입니다. 그대로 써도 되고, 직접 고친 뒤 「원본으로 초기화」로 되돌릴 수 있습니다.
6. **장면 대본 워크벤치**에 대본을 씁니다. 샘플을 불러오거나 「통대본 자동 나누기」로 통째로 붙여넣어 장면으로 쪼갤 수 있습니다.
7. 장면별로 `음성 생성` → `▶ 듣기`로 확인하고, 마지막에 **전체 합쳐서 WAV**를 누르면 장면 사이에 설정한 무음이 들어간 하나의 파일이 저장됩니다.

### 모델

| 선택 | 모델 ID | 메모 |
| --- | --- | --- |
| 안정 · 무료 티어 | `gemini-2.5-flash-preview-tts` | 지시문과 대본을 한 덩어리 텍스트로 보냅니다. |
| 최신 · 무료 티어 | `gemini-3.8-flash-tts` | 3.8부터는 `text`가 "그대로 읽는 대본"이라, 발성 지시는 `speechMetadata.style`로 분리해 보냅니다. (`v1beta` 필요 — 앱이 이미 `v1beta`를 씁니다.) |

- 직접 입력 칸에 다른 TTS 모델 ID(`gemini-3.8-flash-lite-tts` 등)를 넣을 수 있습니다.
- 3.8 응답은 완성된 WAV로, 2.5 응답은 24kHz 16bit PCM으로 옵니다. 앱이 둘 다 해석해 24kHz 모노 WAV로 통일합니다.
- 서버가 `speechMetadata`를 모르는 경우(400) 앱이 자동으로 지시문+대본 방식으로 한 번 더 시도합니다.

### 무료 티어에서 자주 만나는 것

- **429**: 분당/일일 한도를 잠깐 넘었습니다. 1분 뒤 재시도하거나 장면을 더 짧게 나누세요. (한 번에 여러 장면을 돌리면 중간에 멈출 수 있고, 앱이 그 지점에서 멈추고 알려 줍니다.)
- **404**: 모델 ID가 계정/리전에서 열려 있지 않습니다. 「안정 · 무료 티어」로 바꾸세요.
- **400 API key not valid**: 키를 다시 복사해 붙여넣으세요(공백 포함 여부 확인).

## 개인정보

- API 키와 대본은 **이 브라우저의 localStorage**에만 저장됩니다.
- 음성 생성 요청은 브라우저에서 `generativelanguage.googleapis.com`으로 직접 나갑니다. 별도 중계 서버가 없습니다.
- 생성한 음성은 새로고침하면 사라집니다(메모리에만 유지). 필요한 파일은 WAV로 내려받아 두세요.

## 로컬 실행 / 테스트

```bash
# 정적 서버 (ES 모듈 때문에 file:// 로는 열리지 않습니다)
cd hagi-narration-studio
python3 -m http.server 8099
# → http://localhost:8099
```

**WAV/PCM 로직** (Node 20):

```bash
node scripts/test-wav.mjs      # 54 checks: 헤더, mime 해석, 리샘플, 무음 합치기, 피크
```

**브라우저 UI·생성 파이프라인** (Playwright, Gemini는 모의 응답):

```bash
# 서버를 켠 상태에서
LD_LIBRARY_PATH=/workspace/tmp/chlibs/root/usr/lib/x86_64-linux-gnu python3 scripts/test-ui.py
```

검사 항목: 390px/1366px 가로 넘침, 화자·모델·간격 기본값, 키 저장/연결 테스트, 샘플 불러오기,
단일·전체 생성, 요청 본문(화자·지시문·3.8 style 분리), 장면 WAV 헤더, 합친 WAV 프레임 수와 무음 구간,
429 한국어 안내, 새로고침 후 설정 유지, 콘솔 오류 없음.

## GitHub Pages

`main` 브랜치 루트를 그대로 서빙합니다(빌드 없음). 저장소 Settings → Pages → Source: `Deploy from a branch` → `main` / `/ (root)`.
`.nojekyll` 이 있어 Jekyll 처리를 건너뜁니다.
