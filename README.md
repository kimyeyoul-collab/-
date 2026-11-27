# 🎤 Karaoke Cover Studio (`karaoke-app`)

9:16 세로형 **커버 영상**을 만들고, 크리에이터의 MR을 사고팔 수 있는 노래방 앱 MVP입니다.
Expo + React Native + TypeScript로 만들었고 **iOS / Android / Web**에서 같은 코드로 동작합니다.

- 브랜드: 딥 차콜·네이비 배경 + 코랄 레드 `#FF4D4F` 포인트 (보라색 계열 없음)
- 모든 결과물·촬영 화면은 **9:16 세로 비율** 기준
- 서버 없이 동작하지만, 카메라·마이크 **실제 녹화**, Web Audio **실시간 믹싱**, 캔버스 **실제 영상 파일 생성**, MR 파일 **실제 업로드·재생(IndexedDB 저장)** 까지 브라우저에서 진짜로 실행됩니다

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
| ③ | **Recording — 촬영/녹음** | `src/screens/RecordingScreen.tsx` | 9:16 뷰포트, **전면 카메라(getUserMedia)** + 권한/데스크톱 **모의 프리뷰 fallback**, **MediaRecorder 실제 영상·보컬 분리 녹음**, 3초 카운트다운, MR 타이머와 동기화된 **싱크 가사 하이라이트**, 보컬 입력 레벨 미터, 시작·일시정지·다시찍기·녹음 완료 |
| ④ | **Result — 결과물 편집** | `src/screens/ResultScreen.tsx` | **녹화 영상 9:16 재생** + 싱크 자막, 보컬·MR 음량, Echo(Delay+피드백), Reverb(Convolver), **영상-음원 싱크(-500~+500ms)** 슬라이더 실시간 반영, 프리셋 4종, **캔버스 합성으로 실제 영상 파일 생성** → 기기 저장/Web Share 공유 |
| ⑤ | **Creator Upload — MR 업로드** | `src/screens/CreatorUploadScreen.tsx` | **실제 MR 파일 선택**(`input[type=file]` → IndexedDB 저장, 길이 자동 인식), 가사 타임라인 변환, 곡 제목/아티스트/장르/가격, **플랫폼 50% · 크리에이터 50% 자동 계산**, 내 MR 목록과 누적 판매·수익 대시보드 |
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
│   ├── data/mock.ts            # 곡 12곡 + 가사 타임스탬프, 크리에이터, 데모 업로드 3건
│   ├── utils/mrLibrary.ts      # 업로드 MR 메타(localStorage)·Blob(IndexedDB) 저장/복원
│   ├── audio/
│   │   ├── webaudio.ts         # 공유 AudioContext·스테레오 IR·믹스 그래프(Gain/Delay/Convolver)
│   │   ├── synth.ts            # 데모 곡용 Web Audio MR 신스
│   │   ├── mr.ts               # 실제 MR 파일/신스 재생 소스
│   │   └── mixer.ts            # 결과 화면 재생·실시간 믹싱 엔진
│   ├── media/
│   │   ├── recorder.ts         # MediaRecorder 이중 녹음 + MIME 자동 선택
│   │   ├── drawCover.ts        # 9:16 캔버스 프레임(영상+자막) 페인터
│   │   └── exportVideo.ts      # 캔버스+오디오 합성 → 실제 mp4/webm 파일
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

- **MR**: 크리에이터 스튜디오에서 올린 MR은 `input[type=file]` → IndexedDB에 원본 Blob을 저장하고
  `decodeAudioData`로 재생합니다. 새로고침해도 홈 목록 최상단과 곡 상세·촬영·결과 화면에서 같은 원음이 재생됩니다.
  데모 12곡은 업로드 파일이 없으므로 코드로 만든 Web Audio 신스 MR을 사용합니다.
- **촬영/녹음**: `getUserMedia({ video: { facingMode: 'user', width/height: 720×1280 }, audio: { echoCancellation, noiseSuppression } })`
  로 전면 카메라·마이크를 열고, `MediaRecorder` 두 개(비디오 전용 + 마이크 전용)로 **영상과 보컬을 분리 녹음**합니다.
  두 레코더가 동시에 안 되는 브라우저는 단일 녹화(영상+음성)로 자동 fallback하고, MIME은
  `video/mp4 → video/webm;codecs=vp8,opus → video/webm`, `audio/mp4 → audio/webm;codecs=opus → audio/webm` 순으로 고릅니다.
  권한 거부·장치 없음 환경은 디자인된 모의 프리뷰로 계속 진행되며, 이때도 결과 영상 파일은 실제로 생성됩니다.
- **실시간 믹싱**: 결과 화면은 녹화 영상 `<video>`(9:16 cover) + 녹음 보컬 + MR을
  `GainNode → DelayNode(피드백) → ConvolverNode(코드 생성 스테레오 IR)` 그래프로 묶어 재생 중에
  Vocal·MR·Echo·Reverb·싱크 슬라이더가 즉시 반영됩니다. 싱크(±500ms)는 오디오 시작 오프셋과 자막 시각에 함께 적용됩니다.
- **최종 영상**: 숨김 `<canvas>`(720×1280)에 영상 프레임과 싱크 가사를 30fps로 그리면서
  `MediaStreamAudioDestinationNode`의 믹스 오디오와 `canvas.captureStream(30)`을 `MediaRecorder`로 합쳐
  실제 mp4(웹은 webm 가능) 파일을 만듭니다. 저장은 `<a download>`, 공유는 Web Share API(파일 첨부)로 동작하고,
  미지원 브라우저는 다운로드로 대체합니다.
- **슬라이더**: 네이티브 모듈 없이 `PanResponder`로 구현해 iOS/Android/Web에서 동일하게 드래그됩니다.

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| `npx tsc --noEmit` | 통과 (strict) |
| `npx expo export --platform web` | 성공 · `dist/` |
| Playwright(Chromium, 가짜 카메라·마이크) | 콘솔/페이지 에러 0건 |
| 업로드 | 실제 WAV 선택 → IndexedDB·localStorage 저장 → 홈 목록 최상단 반영, 새로고침 후에도 유지 |
| 녹음 | 카메라+마이크 권한 → 3초 카운트다운 → 실제 영상/보컬 분리 녹음(CAM+MIC 모드) 확인 |
| 결과 편집 | 녹화 영상 재생·자막 이동·슬라이더 실시간 반영(AudioParam 갱신)·프리셋 적용 확인 |
| 최종 영상 | 720×1280 9:16 mp4 파일 생성(오디오 트랙 포함), 브라우저에서 재생 확인 |
| 모의 모드 | 카메라 없는 환경에서도 모의 프리뷰 → 실제 mp4 파일 생성 확인 |

## MVP 범위와 제약

- 데모 카탈로그 12곡의 곡·가사·크리에이터는 **모두 가상 데이터**입니다(저작권 문제 없도록 자체 작성).
  크리에이터 스튜디오에서 올린 MR은 사용자가 고른 실제 오디오 파일입니다.
- 실제 SNS 업로드 연동은 없습니다. Web Share API 공유 시트까지만 지원합니다.
- iOS Safari는 `video/mp4` 녹화와 캔버스 캡처를 우선 사용하도록 구현했지만, 실기기 검증은 별도로 필요합니다.
