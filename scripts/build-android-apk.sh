#!/usr/bin/env bash
# Soulmask Planner → 안드로이드 디버그 APK 빌드
# ─────────────────────────────────────────────────────────────
# GitHub Actions(ubuntu-latest)에서 실행되는 것을 전제로 합니다.
#   · www/ 스테이징 → Capacitor 6 안드로이드 프로젝트 생성
#   · 생성된 아이콘(icons/icon-1024.png)을 런처·적응형·스플래시에 적용
#   · ./gradlew assembleDebug → dist/Soulmask-Planner.apk
#   · `latest-apk` 릴리스에 APK 첨부 (휴대폰에서 한 번에 내려받기)
#
# 필요한 환경: node 20+, JDK 17, Android SDK, gh(GITHUB_TOKEN)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

APP_ID="com.hagilog.soulmaskplanner"
APP_NAME="Soulmask Planner"
APK_NAME="Soulmask-Planner.apk"
MIN_SDK_PLATFORM="android-34"
BUILD_TOOLS="34.0.0"

step() { printf '\n=== %s ===\n' "$*"; }

# ── 1. 툴체인 ────────────────────────────────────────────────
step "toolchain"
node -v
if [ -n "${JAVA_HOME_17_X64:-}" ]; then export JAVA_HOME="$JAVA_HOME_17_X64"; fi
export PATH="$JAVA_HOME/bin:$PATH"
java -version

export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
echo "ANDROID_HOME=$ANDROID_HOME"

if command -v sdkmanager > /dev/null 2>&1; then
  (yes 2>/dev/null | sdkmanager --licenses > /dev/null 2>&1) || true
  installed_list="$(sdkmanager --list_installed 2>/dev/null | awk '{print $1}')" || installed_list=""
  for pkg in "platform-tools" "platforms;$MIN_SDK_PLATFORM" "build-tools;$BUILD_TOOLS"; do
    if printf '%s\n' "$installed_list" | grep -Fxq "$pkg"; then
      echo "ok: $pkg"
    else
      echo "install: $pkg"
      sdkmanager --install "$pkg" > /dev/null 2>&1 \
        || sudo -n env "ANDROID_HOME=$ANDROID_HOME" "ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT" sdkmanager --install "$pkg" > /dev/null 2>&1 \
        || echo "warning: $pkg 설치 실패 (이미 있는 패키지로 계속 진행)"
    fi
  done
fi

if ! python3 -c "import PIL" > /dev/null 2>&1; then
  python3 -m pip install --quiet --upgrade Pillow 2>/dev/null \
    || python3 -m pip install --quiet --break-system-packages --upgrade Pillow 2>/dev/null \
    || true
fi
if ! python3 -c "import PIL" > /dev/null 2>&1; then
  echo "Pillow: venv 사용"
  python3 -m venv .icon-venv
  . .icon-venv/bin/activate
  pip install --quiet Pillow
fi
python3 -c "import PIL" || { echo "error: Pillow가 필요합니다"; exit 1; }

# ── 2. 웹 자산 스테이징 ─────────────────────────────────────
step "stage www/"
rm -rf www
mkdir -p www
cp -R index.html manifest.json sw.js css js icons www/
ls -la www

# ── 3. Capacitor 설정 + 안드로이드 프로젝트 ─────────────────
step "capacitor"
cat > capacitor.config.json <<JSON
{
  "appId": "$APP_ID",
  "appName": "$APP_NAME",
  "webDir": "www",
  "bundledWebRuntime": false,
  "android": {
    "backgroundColor": "#14110e",
    "allowMixedContent": false
  },
  "server": {
    "androidScheme": "https"
  }
}
JSON
cat capacitor.config.json

npm init -y > /dev/null
npm install --no-fund --no-audit --no-progress \
  @capacitor/core@6 @capacitor/cli@6 @capacitor/android@6
npx cap add android

# ── 4. 앱 아이콘 / 스플래시 ─────────────────────────────────
step "android launcher icons"
python3 - <<'PY'
import glob, os
from PIL import Image, ImageDraw, ImageFilter

RES = "android/app/src/main/res"
MASTER = "icons/icon-1024.png"
BG = (20, 17, 14)  # #14110e
master = Image.open(MASTER).convert("RGB")

def radial_alpha(px, solid=0.86):
    """가운데는 불투명, 가장자리는 투명으로 부드럽게 사라지는 알파."""
    m = Image.new("L", (px, px), 0)
    d = ImageDraw.Draw(m)
    steps = 48
    for i in range(steps, -1, -1):
        f = i / steps
        r = (px / 2) * f
        val = 255 if f <= solid else int(255 * (1 - (f - solid) / (1 - solid)))
        d.ellipse([px / 2 - r, px / 2 - r, px / 2 + r, px / 2 + r], fill=val)
    return m.filter(ImageFilter.GaussianBlur(px / 60))

def circle_mask(px):
    m = Image.new("L", (px, px), 0)
    ImageDraw.Draw(m).ellipse([0, 0, px - 1, px - 1], fill=255)
    return m

densities = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for dens, size in densities.items():
    folder = os.path.join(RES, f"mipmap-{dens}")
    os.makedirs(folder, exist_ok=True)

    flat = master.resize((size, size), Image.LANCZOS)
    flat.save(os.path.join(folder, "ic_launcher.png"))

    rnd = flat.convert("RGBA")
    rnd.putalpha(circle_mask(size))
    rnd.save(os.path.join(folder, "ic_launcher_round.png"))

    layer = int(round(size * 108 / 48))  # 적응형 아이콘은 108dp 레이어
    fg = Image.new("RGBA", (layer, layer), (0, 0, 0, 0))
    art_px = int(layer * 0.94)
    art = master.resize((art_px, art_px), Image.LANCZOS).convert("RGBA")
    art.putalpha(radial_alpha(art_px))
    off = (layer - art_px) // 2
    fg.paste(art, (off, off), art)
    fg.save(os.path.join(folder, "ic_launcher_foreground.png"))
    print(f"mipmap-{dens}: launcher {size}px, foreground {layer}px")

anydpi = os.path.join(RES, "mipmap-anydpi-v26")
os.makedirs(anydpi, exist_ok=True)
adaptive = "\n".join([
    '<?xml version="1.0" encoding="utf-8"?>',
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">',
    '    <background android:drawable="@color/ic_launcher_background" />',
    '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />',
    '</adaptive-icon>',
    '',
])
for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
    with open(os.path.join(anydpi, name), "w", encoding="utf-8") as fh:
        fh.write(adaptive)

values = os.path.join(RES, "values")
os.makedirs(values, exist_ok=True)
bg_xml = "\n".join([
    '<?xml version="1.0" encoding="utf-8"?>',
    '<resources>',
    '    <color name="ic_launcher_background">#14110E</color>',
    '</resources>',
    '',
])
with open(os.path.join(values, "ic_launcher_background.xml"), "w", encoding="utf-8") as fh:
    fh.write(bg_xml)

for path in glob.glob(os.path.join(RES, "**", "splash.png"), recursive=True):
    with Image.open(path) as prev:
        w, h = prev.size
    canvas = Image.new("RGB", (w, h), BG)
    s = int(min(w, h) * 0.34)
    art = master.resize((s, s), Image.LANCZOS).convert("RGBA")
    art.putalpha(radial_alpha(s))
    canvas.paste(art, ((w - s) // 2, (h - s) // 2), art)
    canvas.save(path)
    print("splash:", path, w, "x", h)
PY

npx cap sync android

# ── 5. 빌드 ─────────────────────────────────────────────────
step "gradle assembleDebug"
(
  cd android
  chmod +x gradlew
  ./gradlew assembleDebug --no-daemon --stacktrace
)

mkdir -p dist
cp android/app/build/outputs/apk/debug/app-debug.apk "dist/$APK_NAME"
ls -lh dist
APK_BYTES="$(stat -c %s "dist/$APK_NAME")"
echo "APK: dist/$APK_NAME ($((APK_BYTES / 1024 / 1024)) MB)"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "APK_BYTES=$APK_BYTES" >> "$GITHUB_ENV"
fi

# ── 6. latest-apk 릴리스 ────────────────────────────────────
if [ -n "${GITHUB_REPOSITORY:-}" ] && command -v gh > /dev/null 2>&1; then
  step "publish release: latest-apk"
  export GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
  cat > RELEASE_NOTES.md <<'MD'
## Soulmask Planner · 안드로이드 앱 (디버그 빌드)

소울마스크 기획 보드를 휴대폰에 앱처럼 설치해서 쓰는 빌드입니다.
웹 버전(GitHub Pages)과 같은 화면·같은 데이터 구조를 쓰고, 기록은 기기 안에 저장됩니다.

**설치 방법**
1. 아래 `Soulmask-Planner.apk` 파일을 휴대폰에서 내려받습니다.
2. 파일을 열고 "출처를 알 수 없는 앱 설치" 알림이 뜨면 허용합니다.
3. 설치 후 홈 화면의 **Soulmask Planner** 아이콘으로 실행합니다.

> 디버그 빌드라서 서명이 매번 새로 만들어집니다. 새 버전을 설치할 때 기존 앱을 지우고 설치해야 할 수 있습니다.
MD
  gh release delete latest-apk --repo "$GITHUB_REPOSITORY" --yes --cleanup-tag || true
  gh release create latest-apk "dist/$APK_NAME" \
    --repo "$GITHUB_REPOSITORY" \
    --title "Soulmask Planner · 최신 APK" \
    --notes-file RELEASE_NOTES.md \
    --latest
  echo "download: https://github.com/$GITHUB_REPOSITORY/releases/download/latest-apk/$APK_NAME"

  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "### Soulmask Planner APK 빌드 완료"
      echo ""
      echo "- APK: \`$APK_NAME\` ($((APK_BYTES / 1024 / 1024)) MB)"
      echo "- 내려받기: https://github.com/$GITHUB_REPOSITORY/releases/download/latest-apk/$APK_NAME"
    } >> "$GITHUB_STEP_SUMMARY"
  fi
else
  echo "skip release publish (GITHUB_REPOSITORY/gh 없음)"
fi

step "done"
