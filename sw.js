/* Soulmask Planner · 오프라인 우선 서비스 워커
   - 화면(HTML) 요청: 네트워크 먼저, 실패하면 캐시
   - 모듈·스타일·아이콘: 캐시 먼저, 뒤에서 최신 버전으로 갱신
   - /studio/(내레이션 스튜디오)는 이 워커가 아예 다루지 않고 그대로 통과:
     플래너의 HTML 대체(fallback)·캐시가 스튜디오 화면을 덮어쓰지 않도록 합니다.
   - 다른 출처(api.github.com, Pretendard CDN 폰트 CSS 등)는 그대로 통과:
     오프라인에서는 폰트 CSS만 실패하고 --font-sans의 시스템 한글 폰트로 자연스럽게 대체됩니다. */
'use strict';

var CACHE = 'soulmask-planner-v10';
var CACHE_PREFIX = 'soulmask-planner-';
/* 이 워커의 범위(예: /soulmask-manager/)와 그 아래 스튜디오 경로(예: /soulmask-manager/studio/) */
var SCOPE_PATH = new URL('./', self.location.href).pathname;
var STUDIO_PATH = SCOPE_PATH + 'studio/';
var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/icons.js',
  './js/data.js',
  './js/store.js',
  './js/sync.js',
  './js/ai-io.js',
  './js/ui.js',
  './js/util.js',
  './js/tribes-util.js',
  './js/views/dashboard.js',
  './js/views/todos.js',
  './js/views/tribesmen.js',
  './js/views/roadmap.js',
  './js/views/bosses.js',
  './js/views/resources.js',
  './js/views/journal.js',
  './js/views/youtube.js',
  './js/views/settings.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './icons/icon-maskable.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(ASSETS.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () { return null; });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        /* 같은 출처의 다른 앱 캐시(스튜디오 등)는 건드리지 않고,
           플래너가 만든 예전 버전 캐시만 정리합니다. */
        return (key === CACHE || key.indexOf(CACHE_PREFIX) !== 0) ? null : caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') { return; }

  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) { return; }

  /* 내레이션 스튜디오(/studio/)는 통째로 통과시킵니다.
     - 플래너 캐시에 스튜디오 파일이 섞이지 않게
     - 스튜디오 화면 요청에 플래너 index.html 대체 응답이 나가지 않게
     (오프라인일 때 스튜디오는 네트워크 오류 화면이 되지만, TTS 특성상 어차피 온라인 필요) */
  if (url.pathname === STUDIO_PATH.slice(0, -1) || url.pathname.indexOf(STUDIO_PATH) === 0) {
    return;
  }

  if (req.mode === 'navigate') {
    /* 앱 셸 요청만 '플래너 화면'으로 캐시합니다. (다른 경로의 탐색이 셸을 덮어쓰지 않게) */
    var isShell = url.pathname === SCOPE_PATH || url.pathname === SCOPE_PATH + 'index.html';
    event.respondWith(
      fetch(req).then(function (res) {
        if (isShell && res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put('./index.html', copy); }).catch(function () {});
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function (hit) {
      var network = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); }).catch(function () {});
        }
        return res;
      }).catch(function () { return hit; });
      return hit || network;
    })
  );
});
