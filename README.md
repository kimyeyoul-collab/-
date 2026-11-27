# 🎤 Karaoke Cover Studio (`karaoke-app`)

9:16 세로형 **커버 영상**을 만들고, 크리에이터의 MR을 사고팔 수 있는 노래방 앱 MVP입니다.
Expo + React Native + TypeScript로 만들었고 **iOS / Android / Web**에서 같은 코드로 동작합니다.

- 브랜드: 딥 차콜·네이비 배경 + 코랄 레드 `#FF4D4F` 포인트 (보라색 계열 없음)
- 모든 결과물·촬영 화면은 **9:16 세로 비율** 기준
- 서버 없이 **Mock 데이터**로 전체 플로우가 실제로 동작합니다 (검색·필터·재생·녹음·믹싱·생성·업로드)

---

## 실행 방법

```bash
cd karaoke-app
npm install          # 최초 1회
npm run web          # 웹 개발 서버 (http://localhost:8081)
npm run ios          # iOS 시뮬레이터 (macOS) / Expo Go
npm run android      # 안드로이드
```

빌드·검증:

```bash
npm run typecheck    # tsc --noEmit
npm run build:web    # expo export --platform web → dist/
npm run serve:web    # dist/ 를 8080 포트로 서빙 (빌드 결과 확인용)
```

## 화면 (MVP 1~6단계)

| 단계 | 화면 | 파일 | 핵심 |
| --- | --- | --- | --- |
| ① | **Home — 곡 탐색** | `src/screens/HomeScreen.tsx` | 최신곡/인기곡 정렬, MR 검색(제목·아티스트·크리에이터), 장르 필터(발라드/K-POP/인디/R&B/힙합/트로트), 최근 사용한 MR, 인기 크리에이터 MR 추천, 크리에이터 수익 배너 |
| ② | **Song Detail — 곡 상세** | `src/screens/SongDetailScreen.tsx` | 곡 정보(길이·커버 구간·키·BPM·난이도), MR 제작자 카드, **MR 미리 듣기**(재생/일시정지·구간 이동), 가사 전체 미리보기, `커버 촬영 시작` |
| ③ | **Recording — 촬영/녹음** | `src/screens/RecordingScreen.tsx` | 9:16 뷰포트, **전면 카메라(getUserMedia)** + 권한/데스크톱 **모의 프리뷰 fallback**, 3초 카운트다운, MR 타이머와 동기화된 **싱크 가사 하이라이트**, 보컬 입력 레벨 미터, MR/VOCAL 트랙 인디케이터, 시작·일시정지·다시찍기·녹음 완료 |
| ④ | **Result — 결과물 편집** | `src/screens/ResultScreen.tsx` | 9:16 커버 미리보기(재생/일시정지 + 자막 오버레이), 보컬·MR 음량, Echo, Reverb, **영상-음원 싱크(-500~+500ms)** 슬라이더, 프리셋 4종, **최종 영상 생성**(진행률 모달) → 저장/SNS(Shorts·Reels) 공유 시트 |
| ⑤ | **Creator Upload — MR 업로드** | `src/screens/CreatorUploadScreen.tsx` | MR 파일 선택(웹 `input[type=file]`, 네이티브 샘플), 곡 제목/아티스트/장르/가격, **플랫폼 50% · 크리에이터 50% 자동 계산**, 내 MR 목록과 누적 판매·수익 대시보드 |
| – | 내비게이션/스토어 | `App.tsx`, `src/store.tsx` | 스택 내비게이션, 업로드 목록 유지, 토스트, 하단 탭(홈/크리에이터) |

## 구조

```
karaoke-app/
├── App.tsx                     # 앱 셸: 폰 프레임(웹), 라우팅, 탭바, 토스트
├── index.ts                    # registerRootComponent
├── app.json                    # Expo 설정 (다크 UI, 카메라/마이크 권한 문구)
├── src/
│   ├── theme.ts                # 색·간격·타이포 토큰 (코랄 포인트, 보라 없음)
│   ├── types.ts                # Song / LyricLine / Creator / UploadedMr / TakeSettings
│   ├── store.tsx               # 라우트 스택, 업로드 목록, 즐겨찾기, 토스트
│   ├── data/mock.ts            # 곡 12곡 + 가사 타임스탬프, 크리에이터 4명, 업로드 3건
│   ├── audio/synth.ts          # Web Audio 기반 MR 신스(패드/베이스/멜로디/킥)
│   ├── hooks/
│   │   ├── useClock.ts         # 재생 클럭(일시정지·시크) + 3-2-1 카운트다운
│   │   └── useCameraStream.ts  # getUserMedia 전면 카메라 + 마이크 레벨 분석
│   ├── components/             # UI 키트, 아이콘(도형), 커버 아트, 슬라이더, 파형, 토스트
│   └── screens/                # 위 5개 화면
├── assets/                     # 아이콘/스플래시 (Expo 템플릿)
├── dist/                       # `npm run build:web` 결과 (git 제외)
└── README.md
```

## 웹에서의 동작 방식

- **MR 미리 듣기 / 녹음 반주**: `AudioContext`로 만든 신스(코드 진행 + 멜로디 + 킥)를 재생합니다.
  오디오를 지원하지 않는 환경에서는 같은 타이머·파형 UI로 자연스럽게 대체됩니다.
- **카메라**: `navigator.mediaDevices.getUserMedia({ video, audio })` 로 전면 카메라를 요청하고,
  성공하면 `<video>` 를 9:16 뷰포트에 붙이고 마이크 레벨을 AnalyserNode로 읽어 보컬 미터에 반영합니다.
  권한 거부·장치 없음·데스크톱 테스트 환경에서는 디자인된 **모의 프리뷰**로 계속 진행됩니다.
- **슬라이더**: 네이티브 모듈 없이 `PanResponder`로 구현해 iOS/Android/Web에서 동일하게 드래그됩니다.

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| `npx tsc --noEmit` | 통과 (strict) |
| `npx expo export --platform web` | 성공 · `dist/` (671KB 번들, 303 모듈) |
| Playwright(Chromium) 웹 렌더링 | 5개 화면 모두 렌더링, 콘솔 에러 0건 |
| 인터랙션 | 검색(“Neon” → 1곡), 장르 필터, 인기순 정렬, MR 미리듣기 재생(시간 진행 확인), 녹음 시작→가사 하이라이트, 프리셋 적용(96/24), 최종 영상 생성 완료, MR 업로드 폼/수익 분배 |
| 모바일 뷰포트(390×844) | 홈·녹음 화면 레이아웃 정상 |

스크린샷: `downloads/karaoke-app-preview.png` (홈), `karaoke-02*`, `karaoke-03`, `karaoke-04`, `karaoke-05*`, `karaoke-06`, `karaoke-07`, `karaoke-08`, `karaoke-10`, `karaoke-11`.

## MVP 범위와 제약

- 곡·가사·크리에이터는 **모두 가상 데이터**입니다(저작권 문제 없도록 자체 작성). 실제 음원 스트리밍은 없습니다.
- 최종 영상 생성은 **인코딩 진행률 모션과 완료 카드**까지이며 실제 파일 인코딩/다운로드는 데모입니다.
- SNS 공유는 업로드 화면으로 이동하는 피드백만 제공합니다(계정 연동 필요).
- 업로드한 MR은 앱 메모리에만 유지되어 새로고침하면 초기 3건으로 돌아갑니다.
