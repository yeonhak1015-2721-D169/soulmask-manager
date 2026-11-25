/* 하기 로그 내레이션 스튜디오 — 내장 샘플 대본 */

export const SAMPLES = [
  {
    id: 'ruins-day14',
    title: '폐허 도시 14일차',
    desc: '일상 · 허탈 · 담담한 하루 정리',
    scenes: [
      {
        title: '14일차 아침',
        mood: 'daily',
        text: '폐허 도시 14일차.\n\n눈을 뜨자마자 물부터 확인한다. 어제 아껴 둔 한 병이 아직 남아 있다. 이게 오늘 하루를 버티는 전부라는 게 조금 웃기지만, 어쨌든 버틴다.\n\n마스크를 쓰고, 배낭을 메고, 문을 연다. 오늘도 살아 있는 사람의 하루가 시작됐다.',
      },
      {
        title: '3층 창가의 반짝임',
        mood: 'explore',
        text: '건물 사이를 천천히 훑는다.\n\n3층 창가에 뭔가 반짝여서 계단을 올라가 봤다. 기대를 아주 조금 했다. 문을 열자마자 알았다. 그냥 깨진 거울이었다.\n\n오늘의 첫 번째 수확은 나 자신이다. 반짝이는 건 대체로 나를 닮았다.',
      },
      {
        title: '끊어진 가방 끈',
        mood: 'deflate',
        text: '돌아오는 길에 가방 끈이 끊어졌다. 주운 건 붕대 두 개다.\n\n붕대로 가방을 묶고 걸어왔다. 남은 붕대는 하나. 다친 곳이 없어서 다행인지, 붕대를 아낀 게 다행인지 모르겠다.\n\n생존은 원래 이렇게 허무한 거다. 그리고 오늘도 그걸로 충분하다.',
      },
    ],
  },
  {
    id: 'supply-box',
    title: '보급 상자 해프닝',
    desc: '드립 · 일상 · 건조한 허탈',
    scenes: [
      {
        title: '상자 안의 것',
        mood: 'gag',
        text: '보급 상자를 발견했다.\n\n뚜껑을 열기 전까지는 기대가 컸다. 약품일 수도 있고, 탄약일 수도 있고, 어쩌면 라면일 수도 있었다.\n\n열었다. 양말이었다. 왼쪽 양말만 세 켤레. 누군가 이 도시에서 오른쪽 발을 아주 알뜰하게 쓰고 있나 보다.',
      },
      {
        title: '양말은 챙긴다',
        mood: 'daily',
        text: '양말은 챙겼다. 버리기에는 아깝다.\n\n발이 시린 밤에는 왼쪽만 신어도 절반은 따뜻하다. 오늘 저녁은 통조림 콩이다. 양말은 신고, 콩은 먹는다. 순서가 중요하다.\n\n이 정도면 굳이 따지자면 이득이다. 마음은 안 따뜻하지만 발은 따뜻해질 예정이다.',
      },
    ],
  },
  {
    id: 'soulmask-test',
    title: '소울마스크 스타일 테스트',
    desc: '전투 · 위기 톤 확인용 2장면',
    scenes: [
      {
        title: '북쪽 폐광',
        mood: 'combat',
        text: '부족원 셋을 데리고 북쪽 폐광으로 간다.\n\n마스크가 방전되기 전에 광석을 캐야 한다. 횃불이 흔들린다. 뒤에서 무언가 내 발소리에 맞춰 걸어온다. 돌아보지 않는다. 돌아보면 늦는다.\n\n곡괭이를 한 번 더 내리친다. 소리는 생각보다 크게 났다.',
      },
      {
        title: '불빛이 꺼졌다',
        mood: 'crisis',
        text: '마스크 불빛이 꺼졌다. 어둠 속에서 숨을 참는다.\n\n옆에 있던 부족원이 앞으로 나선다. 나는 뒤에서 겁이 났다는 말을 삼킨다. 지금은 그 말을 할 자리가 아니다.\n\n살아 돌아가면 그때 웃자. 그때까지는 아무 말도 하지 않는다.',
      },
    ],
  },
];

export function makeScene(source = {}) {
  const scene = {
    id: `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title: source.title || '',
    mood: source.mood || 'daily',
    text: source.text || '',
  };
  // 타임라인 .txt에서 온 장면이면 구간을 함께 보관한다(대본 본문에는 표기를 넣지 않는다).
  if (Number.isFinite(Number(source.startSec)) && source.startSec !== null && source.startSec !== undefined) {
    scene.startSec = Math.max(0, Number(source.startSec));
    scene.endSec = Number.isFinite(Number(source.endSec)) && source.endSec !== null ? Number(source.endSec) : null;
    scene.timelineLabel =
      typeof source.timelineLabel === 'string' && source.timelineLabel
        ? source.timelineLabel
        : null;
  }
  return scene;
}

export function scenesFromSample(sample) {
  return sample.scenes.map((scene) => makeScene(scene));
}
