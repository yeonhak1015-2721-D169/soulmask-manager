/* Soulmask Planner — 시드 데이터 & 게임 기준 정보
   - 검증된 소울마스크 정보(보스/소환 재료/의식 강도)만 고정값으로 넣습니다.
   - 사용자마다 다른 값(일차, 보유량, 권장 장비, 메모 등)은 비워 두거나 '직접 입력'으로 표시합니다.
*/

export const APP_ID = 'soulmask-planner';
export const SCHEMA_VERSION = 2;

export const STORAGE_KEY = 'soulmask_planner_v2';
export const LEGACY_STORAGE_KEY = 'hagilog_soulmask_manager_v1';
export const SYNC_KEY = 'hagilog_soulmask_sync_v1';
export const SYNC_FILE = 'hagilog-soulmask-sync.json';
export const PENDING_KEY = 'soulmask_planner_pending_v1';

export const PRIORITIES = ['높음', '보통', '낮음'];

export const CATEGORIES = [
  '메인 목표',
  '자원 채집',
  '건축 및 시설',
  '부족원 영입',
  '생산 및 자동화',
  '탐험',
  '전투 및 보스',
  '장비 강화',
  '기타'
];

export const TODO_CHECKS = {
  '메인 목표': 'main',
  '자원 채집': 'gather',
  '건축 및 시설': 'build',
  '부족원 영입': 'tribe',
  '생산 및 자동화': 'auto',
  '탐험': 'explore',
  '전투 및 보스': 'combat',
  '장비 강화': 'gear',
  '기타': 'etc'
};

export const ROLE_TONES = {
  '생산직': 'prod',
  '생활직': 'life',
  '전투직': 'combat',
  '예비': 'spare'
};

/* ---------- 담당직업 = 소울마스크 숙련도(Proficiency) ----------
   실제 게임의 숙련도 31종을 기준으로 정리했습니다.
   출처: soulmaskguide.com/proficiency(1.0 전체 31종), soulmask.fandom.com/wiki/Proficiencies,
        소울마스크 위키(한국어) — 기술명 '목공·방직·도축·무두질·재배·연마·공예술·도요' 표기 확인.
   key 는 저장용 고정 id라서 나중에 표시 이름을 고쳐도 저장된 부족원이 깨지지 않습니다.
   alt 는 게임 표기와 함께 쓰이는 통칭(대장장이·가죽 세공·직물·농업·수확·사냥). */
export const PROFICIENCY_GROUPS = [
  {
    id: 'prod',
    label: '생산직',
    hint: '제작 · 가공',
    tone: 'prod',
    role: '생산직',
    items: [
      { key: 'craftsman', name: '공예술', alt: '대장장이', en: 'Craftsman', duty: '도구·부품·생활용품 제작 · 대장장이 작업대 계열' },
      { key: 'weaponsmith', name: '무기 제작', en: 'Weaponsmithing', duty: '근접·원거리 무기와 화살 제작 · 품질 옵션' },
      { key: 'armorsmith', name: '방어구 제작', en: 'Armoursmithing', duty: '갑옷·방패·장비 제작 · 내구도·품질 옵션' },
      { key: 'kiln', name: '도요', en: 'Kiln', duty: '주괴 생산 · 숯·유리·석회·벽돌 가마 제련' },
      { key: 'pottery', name: '도예', en: 'Pottery', duty: '항아리·그릇·화분·거푸집 등 점토 제품' },
      { key: 'tanning', name: '무두질', alt: '가죽 세공', en: 'Tanning', duty: '생가죽 무두질 · 가죽·고급 가죽 생산' },
      { key: 'spinning', name: '방직', alt: '직물', en: 'Spinning', duty: '실·천·리넨·밧줄 생산' },
      { key: 'woodworking', name: '목공', en: 'Woodworking', duty: '판자·목재 가공 · 목공 작업대·가구·건축 자재' },
      { key: 'alchemy', name: '연금술', en: 'Alchemy', duty: '약물·독·연금 혼합물·특수 재료 제작' },
      { key: 'grinding', name: '연마', en: 'Grinding', duty: '분쇄기·연마 작업 · 가루·안료·분말 가공' },
      { key: 'stonecutting', name: '석공', en: 'Stonecutting', duty: '석재 절단·가공 · 건축 블록' },
      { key: 'construction', name: '건축', en: 'Construction', duty: '건물 건설·업그레이드 · 벽·바닥·지붕' },
      { key: 'jewelcrafting', name: '보석 세공', en: 'Jewelcrafting', duty: '보석·장신구 제작 · 품질 옵션' },
      { key: 'furniture', name: '가구 제작', en: 'Furniture-making', duty: '가구·장식 제작 · 품질 옵션' }
    ]
  },
  {
    id: 'life',
    label: '생활직',
    hint: '채집 · 거점 운영',
    tone: 'life',
    role: '생활직',
    items: [
      { key: 'cooking', name: '요리', en: 'Cooking', duty: '음식·음료·간식 조리 · 부족원 식량' },
      { key: 'farming', name: '재배', alt: '농업', en: 'Farming', duty: '씨앗 파종·작물 재배 · 비료·관개 관리' },
      { key: 'mining', name: '채광', en: 'Mining', duty: '광석·석재·수정 채굴' },
      { key: 'logging', name: '벌목', en: 'Logging', duty: '목재·나무껍질·수지 벌채' },
      { key: 'harvesting', name: '채집', alt: '수확', en: 'Harvesting', duty: '야생 식물·섬유·열매·약초 채집' },
      { key: 'slaughtering', name: '도축', alt: '사냥', en: 'Slaughtering', duty: '야생 사냥·도살 · 가죽·고기·뼈 확보' },
      { key: 'expedition', name: '원정 사냥', alt: '사냥터 파견', en: 'Expedition hunting', noProf: true, duty: '원정 동물 사냥 · 생가죽/고기/뼈/힘줄 자동 수급 (별도 제작 숙련도 없음 · 전투/기동력 위주)' },
      { key: 'butchering', name: '분해', en: 'Butchering', duty: '도축한 고기 손질·부위 분해' },
      { key: 'husbandry', name: '사육', alt: '축산', en: 'Animal husbandry', duty: '동물 사육·사료·번식 · 알·털·배설물' },
      { key: 'capturing', name: '포획', en: 'Capturing', duty: '야생 동물 포획·우리 관리' }
    ]
  },
  {
    id: 'combat',
    label: '전투직',
    hint: '무기 숙련도 · 경비',
    tone: 'combat',
    role: '전투직',
    items: [
      { key: 'blade', name: '검', en: 'Blade', duty: '한손검 전투 · 보스전·거점 경비' },
      { key: 'dualblade', name: '쌍검', en: 'Dual Blades', duty: '쌍검 속공 · 보스전·추격' },
      { key: 'spear', name: '창', en: 'Spear', duty: '창 견제·관통 · 거점 방어' },
      { key: 'greatsword', name: '대검', en: 'Greatsword', duty: '대검 광역 강공격 · 보스전' },
      { key: 'hammer', name: '망치', alt: '해머', en: 'Hammer', duty: '둔기 전투 · 슈퍼아머·보스전' },
      { key: 'gauntlets', name: '건틀릿', en: 'Gauntlets', duty: '건틀릿 근접 연타 · 보스전' },
      { key: 'bow', name: '활', en: 'Bow', duty: '활 원거리 사냥·보스전' },
      { key: 'shield', name: '방패', en: 'Shield', duty: '방패 방어·탱커 · 피해 감소' },
      { key: 'whip', name: '채찍', en: 'Spiked Whip', duty: '채찍 사거리 견제 · 다수 상대' }
    ]
  },
  {
    id: 'etc',
    label: '예비 / 기타',
    hint: '자리 없음 · 직접 입력',
    tone: 'spare',
    role: '예비',
    items: [
      { key: 'utility', name: '다용도 · 예비', en: 'Utility', duty: '정해진 자리 없이 빈 작업 지원 · 교체 대기' },
      { key: 'custom', name: '직접 입력', en: 'Custom', duty: '', custom: true }
    ]
  }
];

/** 위 그룹을 평평하게 편 숙련도 목록 (group·groupLabel·role 포함) */
export const PROFICIENCIES = PROFICIENCY_GROUPS.reduce((acc, g) => acc.concat(
  g.items.map((it) => Object.assign({}, it, { group: g.id, groupLabel: g.label, groupHint: g.hint, tone: g.tone, role: g.role }))
), []);

/** key → 숙련도 항목 (없으면 null) */
export function findProfession(key) {
  if (!key) { return null; }
  return PROFICIENCIES.find((p) => p.key === key) || null;
}

/** 표시용 이름: '도요', '무두질 · 가죽 세공' 처럼 통칭을 함께 */
export function professionTitle(item) {
  if (!item) { return ''; }
  return item.alt ? `${item.name} (${item.alt})` : item.name;
}

export const VIEWS = [
  { id: 'dashboard', title: '대시보드', mobile: true },
  { id: 'todos', title: '할 일', mobile: true },
  { id: 'tribesmen', title: '부족원', mobile: true },
  { id: 'bosses', title: '보스·탐험', mobile: true },
  { id: 'journal', title: '플레이 일지', mobile: true },
  { id: 'roadmap', title: '로드맵', mobile: false },
  { id: 'resources', title: '자원·거점', mobile: false },
  { id: 'youtube', title: '유튜브', mobile: false },
  { id: 'settings', title: '설정·백업', mobile: false }
];

/* ---------- 검증된 보스 정보 ---------- */
export function seedBosses() {
  return [
    {
      id: 'b-sabertooth',
      name: '검치호',
      en: 'Fierce Saber-toothed Predator',
      region: '우림 피라미드',
      level: '20',
      awareness: 5,
      summon: [
        { name: '상급 생고기', qty: 5 },
        { name: '짐승 뼈', qty: 5 },
        { name: '짐승 피', qty: 5 },
        { name: '제사용 그릇', qty: 1 }
      ],
      cleared: true,
      attempts: 1,
      gear: '',
      prep: '',
      rewards: '',
      note: '초기 상태에서 공략 완료.'
    },
    {
      id: 'b-x',
      name: 'X',
      en: '고대 유적 기계 코어 X',
      region: '고대·신성 유적 던전',
      level: '25~30',
      awareness: null,
      summon: [],
      cleared: true,
      attempts: 1,
      gear: '',
      prep: '',
      rewards: '',
      note: '사용자 지정 보스. 초기 상태에서 공략 완료.'
    },
    {
      id: 'b-fogfrog',
      name: '안개 개구리',
      en: 'Poison Fogfrog',
      region: '언덕 피라미드 (화산 숲)',
      level: '30',
      awareness: 30,
      summon: [
        { name: '알로에 진액', qty: 5 },
        { name: '산성 액체', qty: 5 },
        { name: '활혈 크림', qty: 2 },
        { name: '제사용 그릇', qty: 1 }
      ],
      cleared: false,
      attempts: 0,
      gear: '',
      prep: '',
      rewards: '모방 · 포탈 해금',
      note: '공략 시 모방과 포탈이 열립니다.'
    },
    {
      id: 'b-ape',
      name: '바즈라 유인원',
      en: 'Almighty Vajra Ape',
      region: '고원 피라미드',
      level: '40',
      awareness: 35,
      summon: [
        { name: '상급 스테이크', qty: 5 },
        { name: '과실주', qty: 5 },
        { name: '과일 꼬치', qty: 5 },
        { name: '제사용 그릇', qty: 1 }
      ],
      cleared: false,
      attempts: 0,
      gear: '',
      prep: '',
      rewards: '',
      note: ''
    },
    {
      id: 'b-griffin',
      name: '폭풍 그리핀',
      en: 'Sky-shading Tempest Griffin',
      region: '사막 피라미드',
      level: '50',
      awareness: 45,
      summon: [
        { name: '해산물 퀴노아 밥', qty: 5 },
        { name: '흥분제', qty: 2 },
        { name: '상급 생고기', qty: 5 },
        { name: '제사용 그릇', qty: 1 }
      ],
      cleared: false,
      attempts: 0,
      gear: '',
      prep: '',
      rewards: '',
      note: ''
    },
    {
      id: 'b-mammoth',
      name: '매머드',
      en: 'Titan Mammoth',
      region: '설산 피라미드',
      level: '60',
      awareness: 50,
      summon: [
        { name: '튀긴 타코', qty: 5 },
        { name: '구운 버섯', qty: 5 },
        { name: '구운 호박', qty: 5 },
        { name: '제사용 그릇', qty: 1 }
      ],
      cleared: false,
      attempts: 0,
      gear: '',
      prep: '',
      rewards: '',
      note: ''
    }
  ];
}

export function seedAreas() {
  return [
    { id: 'a-rainforest', name: '우림 피라미드', visited: true, resources: '목재 · 섬유 · 약초', facilities: '검치호 제단', memo: '' },
    { id: 'a-ruins', name: '고대·신성 유적 던전', visited: true, resources: '기계 부품 · 고대 유물', facilities: '기계 코어 X', memo: 'X 공략 완료' },
    { id: 'a-hill', name: '언덕 피라미드 (화산 숲)', visited: false, resources: '', facilities: '안개 개구리 제단', memo: '' },
    { id: 'a-highland', name: '고원 피라미드', visited: false, resources: '', facilities: '바즈라 유인원 제단', memo: '' },
    { id: 'a-desert', name: '사막 피라미드', visited: false, resources: '', facilities: '폭풍 그리핀 제단', memo: '' },
    { id: 'a-snow', name: '설산 피라미드', visited: false, resources: '', facilities: '매머드 제단', memo: '' }
  ];
}

/* ---------- 14단계 로드맵 ---------- */
export function seedRoadmap() {
  const step = (i, title, desc, status, checklist, prereq) => ({
    id: 'rm-' + (i < 10 ? '0' + i : i),
    order: i,
    title,
    desc,
    status,
    prereq: prereq || [],
    checklist: (checklist || []).map((t, k) => ({ id: 'rm-' + i + '-c' + (k + 1), title: t, done: status === '완료' }))
  });
  return [
    step(1, '초기 생존', '맨몸으로 시작해 도구·불·임시 거처를 확보하는 단계.', '완료', ['돌 도구 제작', '모닥불 피우기', '임시 거처 확보'], []),
    step(2, '기초 정착', '작업대·상자·침대를 두고 거점 형태를 갖추는 단계.', '완료', ['작업대 건설', '보관 상자 확보', '기본 방어 시설'], ['rm-01']),
    step(3, '부족원 첫 영입', '제단 의식으로 첫 부족원을 맞이하고 작업을 나눠 맡기는 단계.', '완료', ['제단 건설', '첫 부족원 영입', '작업 할당'], ['rm-02']),
    step(4, '청동기 진입', '구리·주석을 캐 청동 주괴를 만들어 장비와 시설을 확장하는 단계.', '완료', ['구리 광맥 확보', '주석 광맥 확보', '청동 주괴 생산'], ['rm-03']),
    step(5, '첫 보스 · 검치호', '우림 피라미드에서 검치호를 공략해 다음 성장의 발판을 만드는 단계.', '완료', ['소환 재료 준비', '검치호 공략'], ['rm-04']),
    step(6, '부활·포탈 시스템', '부활 시스템과 포탈을 구축해 이동과 재기를 자동화하는 단계.', '완료', ['부활 시스템 구축', '포탈 시스템 구축'], ['rm-05']),
    step(7, '자동화 기초', '부족원을 직업별로 배치해 채집·생산을 자동으로 돌리는 단계.', '진행 중', ['직업별 인력 확보', '사냥 자동화', '광물 채집 자동화'], ['rm-06']),
    step(8, '생산 시설 최적화', '제련·요리·재봉 등 생산 라인을 정리하고 업그레이드하는 단계.', '진행 중', ['생산 시설 정리', '시설 업그레이드'], ['rm-07']),
    step(9, '철기 진입', '철광을 확보해 철제 도구·장비로 전투력을 끌어올리는 단계.', '미진행', ['철광 확보', '철 주괴 생산', '철제 장비 제작'], ['rm-08']),
    step(10, '화산 숲 · 안개 개구리', '언덕 피라미드의 안개 개구리를 공략하는 단계. (의식 강도 30)', '미진행', ['의식 강도 30 확인', '소환 재료 준비', '안개 개구리 공략'], ['rm-09']),
    step(11, '고원 · 바즈라 유인원', '고원 피라미드의 바즈라 유인원을 공략하는 단계. (의식 강도 35)', '미진행', ['의식 강도 35 확인', '소환 재료 준비', '바즈라 유인원 공략'], ['rm-10']),
    step(12, '사막 · 폭풍 그리핀', '사막 피라미드의 폭풍 그리핀을 공략하는 단계. (의식 강도 45)', '미진행', ['의식 강도 45 확인', '소환 재료 준비', '폭풍 그리핀 공략'], ['rm-11']),
    step(13, '설산 · 매머드', '설산 피라미드의 매머드를 공략하는 단계. (의식 강도 50)', '미진행', ['의식 강도 50 확인', '소환 재료 준비', '매머드 공략'], ['rm-12']),
    step(14, '후반 콘텐츠 · 다중 거점', '마스크 강화와 다중 거점 운영으로 후반 콘텐츠를 소화하는 단계.', '미진행', ['마스크 강화', '두 번째 거점 운영', '전투 부족원 장비 강화'], ['rm-13'])
  ];
}

/* ---------- 자원 / 거점 / 시설 ---------- */
export function seedResources() {
  const names = ['목재', '석재', '점토', '구리', '주석', '청동', '철', '가죽', '섬유', '식량', '기타'];
  const targets = [500, 300, 120, 120, 120, 60, 120, 80, 120, 300, 0];
  return names.map((n, i) => ({
    id: 'res-' + (i + 1),
    name: n,
    amount: 0,
    target: targets[i],
    owner: '',
    automated: false,
    note: ''
  }));
}

export function seedBases() {
  return [
    { id: 'base-west', name: '서부 우림 거점', active: true, note: '정착 완료 · 청동 주괴 생산 가능' }
  ];
}

export function seedFacilities() {
  return [
    { id: 'fc-smelter', baseId: 'base-west', name: '제련기', status: '완료', owner: '', product: '청동 주괴', upgraded: false, automated: false, plan: '' },
    { id: 'fc-workbench', baseId: 'base-west', name: '작업대', status: '완료', owner: '', product: '도구·장비', upgraded: false, automated: false, plan: '' },
    { id: 'fc-altar', baseId: 'base-west', name: '부활 제단', status: '완료', owner: '', product: '부활 시스템', upgraded: false, automated: false, plan: '' },
    { id: 'fc-portal', baseId: 'base-west', name: '포탈', status: '완료', owner: '', product: '이동', upgraded: false, automated: false, plan: '' },
    { id: 'fc-kitchen', baseId: 'base-west', name: '요리 시설', status: '건설 예정', owner: '', product: '요리', upgraded: false, automated: false, plan: '' }
  ];
}

/* ---------- 부족원 ---------- */
export function seedRoles() {
  return [
    { id: 'role-prod', name: '생산직', target: 10, tone: 'prod' },
    { id: 'role-life', name: '생활직', target: 7, tone: 'life' },
    { id: 'role-combat', name: '전투직', target: 5, tone: 'combat' },
    { id: 'role-spare', name: '예비', target: 1, tone: 'spare' }
  ];
}

/* ---------- 할 일 ---------- */
export function seedTodos(dateKey) {
  const now = new Date().toISOString();
  const mk = (i, title, category, priority, subtasks) => ({
    id: 'td-seed-' + i,
    date: dateKey,
    title,
    category,
    priority,
    note: '',
    done: false,
    doneAt: null,
    createdAt: now,
    order: i,
    carriedFrom: '',
    subtasks: (subtasks || []).map((t, k) => ({ id: 'td-seed-' + i + '-s' + (k + 1), title: t, done: false }))
  });
  return [
    mk(1, '다음 주요 목표 정리하고 오늘 할 일 확정', '메인 목표', '높음', ['로드맵 7~9단계 확인', '오늘 할 일 3개로 줄이기']),
    mk(2, '부족원 직업별 인력 확보', '부족원 영입', '높음', ['생산직 부족 인원 확인', '제단 의식 재료 준비']),
    mk(3, '사냥 자동화 구축', '생산 및 자동화', '보통', ['사냥꾼 배치', '도축·요리 라인 연결']),
    mk(4, '광물 채집 자동화 구축', '생산 및 자동화', '보통', ['채광 담당 지정', '광석 운반 동선 정리']),
    mk(5, '생산 시설 최적화', '건축 및 시설', '보통', ['제련기 주변 정리', '요리 시설 건설']),
    mk(6, '개인·전투 부족원 장비 강화', '장비 강화', '낮음', ['청동 장비 제작', '전투직 장비 우선 지급']),
    mk(7, '다음 문명 발전 단계 준비', '메인 목표', '낮음', ['철광 위치 확인'])
  ];
}

/* ---------- 플레이 일지 ---------- */
export function seedJournal() {
  return [
    {
      id: 'jr-1', date: '2026-11-06', day: 1, hours: '', events: '맨몸으로 야생에 떨어져 첫 모닥불과 도구를 만들었다.',
      battles: '', newMembers: '', newPlaces: '시작 지점', problems: '무엇부터 해야 할지 몰라 한참 헤맴',
      nextGoals: '거점 후보지 찾기', memo: '', autoTodos: []
    },
    {
      id: 'jr-2', date: '2026-11-10', day: 2, hours: '', events: '죽을 고비를 넘기고 넓직한 땅으로 거점을 옮겼다.',
      battles: '', newMembers: '', newPlaces: '넓직한 새 터전', problems: '이동 중 자원 부족',
      nextGoals: '작업대·제련기 배치', memo: '', autoTodos: []
    },
    {
      id: 'jr-3', date: '2026-11-14', day: 3, hours: '', events: '방심한 사이 습격을 받아 부족이 전멸했다.',
      battles: '습격 — 부족 전멸', newMembers: '', newPlaces: '', problems: '야간 경비 부재',
      nextGoals: '야간 경비 초소와 울타리', memo: '', autoTodos: []
    },
    {
      id: 'jr-4', date: '2026-11-18', day: 4, hours: '', events: '1시간 동안 광산을 찾아 헤매다 겨우 찾은 순간 곡괭이가 파손됐다.',
      battles: '', newMembers: '', newPlaces: '광산', problems: '곡괭이 예비 부족',
      nextGoals: '곡괭이 예비 2자루 제작', memo: '', autoTodos: []
    }
  ];
}

/* ---------- 유튜브 ---------- */
export function seedVideos() {
  const mk = (i, episode, topic, scenes, stamp, titles, thumb, done, uploadDate, uploaded) => ({
    id: 'vd-' + i,
    episode,
    topic,
    scenes,
    timestamps: stamp,
    titles,
    thumb,
    checks: { cut: done, script: done, tts: done, final: done },
    uploadDate,
    uploaded,
    note: ''
  });
  return [
    mk(1, '1화', '생존의 첫 시작', '맨몸으로 야생 입성, 첫 모닥불과 도구', '', '생존의 첫 시작', '', true, '2026-11-06', true),
    mk(2, '2화', '넓직한 새 터전', '죽을 고비를 넘기고 거점 이동', '', '죽을 고비 넘기고… 넓직한 새 터전!', '', true, '2026-11-10', true),
    mk(3, '3화', '충격의 첫 전멸', '방심한 사이 습격, 부족 전멸', '', '방심하다가 결국… 충격의 첫 전멸!', '', true, '2026-11-14', true),
    mk(4, '4화', '곡괭이 파손 조기퇴근', '광산 1시간 탐색, 곡괭이 파손', '', '드디어 찾았는데… 곡괭이가…?', '', true, '2026-11-18', true),
    mk(5, '5화', '청동기 진입과 부족 재건', '청동 주괴 생산, 부족원 영입', '', '', '', false, '', false)
  ];
}

/* ---------- 전체 시드 상태 ---------- */
export function createInitialState() {
  const today = new Date();
  const key = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  return {
    version: SCHEMA_VERSION,
    meta: {
      app: APP_ID,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      seed: 'spec-v14'
    },
    profile: {
      day: null,
      awareness: 30,
      era: '청동기 시대',
      base: '서부 우림 거점',
      capacity: 23,
      playHours: ''
    },
    todos: seedTodos(key),
    tribes: {
      capacity: 23,
      roles: seedRoles(),
      members: []
    },
    roadmap: seedRoadmap(),
    bosses: seedBosses(),
    areas: seedAreas(),
    resources: seedResources(),
    bases: seedBases(),
    facilities: seedFacilities(),
    journal: seedJournal(),
    videos: seedVideos()
  };
}
