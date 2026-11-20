/* Soulmask Planner — 내비게이션 SVG 아이콘
   OS 이모지 대신 같은 선 두께(1.9)의 인라인 SVG를 써서
   하단 내비·사이드바·더보기 시트에서 또렷하게 보이도록 합니다. */

function svg(body) {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" `
    + `stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">`
    + body + '</svg>';
}

export const ICONS = {
  /* 대시보드 — 2×2 그리드 */
  dashboard: svg(
    '<rect x="3.6" y="3.6" width="7" height="7" rx="1.8"/>'
    + '<rect x="13.4" y="3.6" width="7" height="7" rx="1.8"/>'
    + '<rect x="3.6" y="13.4" width="7" height="7" rx="1.8"/>'
    + '<rect x="13.4" y="13.4" width="7" height="7" rx="1.8"/>'
  ),

  /* 할 일 — 체크 사각형 */
  todos: svg(
    '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4"/>'
    + '<path d="M7.8 12.3l2.9 2.9 5.5-6.1"/>'
  ),

  /* 부족원 — 사람들 */
  tribesmen: svg(
    '<path d="M16.2 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.5A3.4 3.4 0 0 0 3.1 18.4V20"/>'
    + '<circle cx="9.6" cy="7.8" r="3.4"/>'
    + '<path d="M20.9 20v-1.5a3.3 3.3 0 0 0-2.5-3.2"/>'
    + '<path d="M15.6 4.6a3.3 3.3 0 0 1 0 6.4"/>'
  ),

  /* 보스·탐험 — 교차한 검 */
  bosses: svg(
    '<path d="M14.6 17.4 3.2 6V3h3l11.4 11.4"/>'
    + '<path d="M13.1 18.9 18.9 13.1"/>'
    + '<path d="M16 16l4.2 4.2"/>'
    + '<path d="M19.4 21.2l1.8-1.8"/>'
    + '<path d="M14.6 6.6 18 3.2h3v3l-3.4 3.4"/>'
    + '<path d="M5 14l4.8 4.8"/>'
    + '<path d="M7.1 16.9 3.2 20.8"/>'
    + '<path d="M3 19l2 2"/>'
  ),

  /* 플레이 일지 — 펼친 책 */
  journal: svg(
    '<path d="M12 6.6C10.5 5.3 8.5 4.6 5.9 4.6c-1.2 0-2.1.15-2.9.44v13.1c.8-.29 1.7-.44 2.9-.44 2.6 0 4.6.7 6.1 2.04 1.5-1.34 3.5-2.04 6.1-2.04 1.2 0 2.1.15 2.9.44V5.04c-.8-.29-1.7-.44-2.9-.44-2.6 0-4.6.7-6.1 2Z"/>'
    + '<path d="M12 6.6v13.1"/>'
  ),

  /* 로드맵 — 지도 */
  roadmap: svg(
    '<path d="M9 3.8 3.4 5.9v14.3L9 18l6 2.1 5.6-2.1V3.7L15 5.8 9 3.8Z"/>'
    + '<path d="M9 3.8V18"/>'
    + '<path d="M15 5.8v14.4"/>'
  ),

  /* 자원·거점 — 상자 */
  resources: svg(
    '<path d="M20.4 8.2v7.6a2 2 0 0 1-1 1.74l-6.4 3.7a2 2 0 0 1-2 0l-6.4-3.7a2 2 0 0 1-1-1.74V8.2a2 2 0 0 1 1-1.74l6.4-3.7a2 2 0 0 1 2 0l6.4 3.7a2 2 0 0 1 1 1.74Z"/>'
    + '<path d="m3.7 7 8.3 4.6L20.3 7"/>'
    + '<path d="M12 21v-9.2"/>'
  ),

  /* 유튜브 — 재생 화면 */
  youtube: svg(
    '<rect x="2.9" y="4.6" width="18.2" height="14.8" rx="3.6"/>'
    + '<path d="m10.3 9.3 4.5 2.7-4.5 2.7V9.3Z"/>'
  ),

  /* 설정 — 슬라이더 */
  settings: svg(
    '<path d="M4 7.2h9.4"/>'
    + '<path d="M18.1 7.2h1.9"/>'
    + '<circle cx="15.8" cy="7.2" r="2.1"/>'
    + '<path d="M4 16.8h4.6"/>'
    + '<path d="M12.9 16.8h7.1"/>'
    + '<circle cx="10.7" cy="16.8" r="2.1"/>'
  ),

  /* 더보기 — 가로 점 3개 */
  more: svg(
    '<circle cx="5.2" cy="12" r="1.45" fill="currentColor" stroke="none"/>'
    + '<circle cx="12" cy="12" r="1.45" fill="currentColor" stroke="none"/>'
    + '<circle cx="18.8" cy="12" r="1.45" fill="currentColor" stroke="none"/>'
  )
};

export function iconFor(id) {
  return ICONS[id] || ICONS.more;
}
