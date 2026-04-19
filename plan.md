# Nahida Mod Manager (Linux) 재작성 계획

## 0. 개요

나히다 데스크탑(Windows/Mac 겸용 Electron 앱, v2.24.3)에서 **모드 매니저 기능만** 떼어내어 Linux 전용의 독립 Electron 앱으로 재작성한다. 원본 로직을 최대한 유지하면서 Windows 전용 코드(DLL 인젝터, Win32 API, RestartManager 등)와 Linux에서 불필요한 기능(drive, transfer, xxmi, mod-tools, auth, custom-downloader, **F10 전송**, **이전 포커스 게임 감지** 등)을 제거한다.

- **기준 소스**: `origin/main` 브랜치. 다른 브랜치 수정사항 무시.
- **작업 브랜치**: `main`에서 신규 브랜치(`linux-rewrite`) 생성.
- **결과물 위치**: 리포지토리 루트의 신규 디렉토리 `linux/`. 원본 트리를 레퍼런스로 유지하고 신규 프로젝트는 `linux/`에 독립 패키지로 구성 (독립 `package.json`, 독립 빌드).
  - 이유: diff 추적 용이, 원본 참조 즉시 가능.

---

## 1. 최종 스택

| 영역 | 유지 | 비고 |
|---|---|---|
| Electron 40.x + electron-vite | ✅ | |
| React 19 + TanStack Router + Tailwind 4 | ✅ | |
| Drizzle ORM + better-sqlite3 | ✅ | 스키마 슬림화 |
| electron-builder | ✅ | AppImage + pacman(AUR용) |
| electron-updater | ⚠️ | 초기엔 비활성 |
| Hono 서버 / WebSocket | ❌ | drive/transfer 전용 |
| koffi / dll-injector / extractor | ❌ | Windows 전용 |
| **native-mod** (Rust) | ✅ | Linux 빌드, Windows 의존 제거 |
| **native-fs** (Rust) | ✅ | Linux 빌드, RestartManager → procfs |
| **native-util** (Rust) | ❌ | **크레이트 전체 제거** (아래 §4-3) |

---

## 2. 유지할 모드 매니저 경로 (`src/main`)

### 2-1. `src/main/services/mod-manager/`

```
index.ts        # 파사드 — F10 래퍼 제거
library.ts      # 게임 DB/프로필 관리 — previousFocusedGame/gamePid 제거
mod-actions.ts  # enable/disable/toggle/rename — 그대로
path-utils.ts   # DISABLED_PREFIX 처리 — 그대로
presets.ts      # 프리셋 CRUD — 그대로
imports.ts      # 폴더/아카이브 import — 그대로
ini.ts          # ini toggleKey 편집 — 그대로
shader-fixes.ts # ShaderFixes 처리 — 그대로
watchers.ts     # notify(Rust) 기반 — Linux 빌드로 동작
f10.ts          # ❌ 삭제
```

### 2-2. Main 부속 모듈

- `internal/db/schema.ts`: `setting`, `appState`, `gamePaths`, `modPresets`, `modPresetItems`, `imageCache`만 유지. `script*`, drive 관련 테이블 제거. drizzle 마이그레이션은 0번부터 신규 생성.
- `lib/fs.ts`: Windows 게임용 파일명 검증(WINDOWS_INVALID_CHARS 등)은 **모드 폴더가 Windows 게임에 마운트되므로 유지**. `getLockingProcesses`는 native-fs Linux 구현 사용.
- `lib/native.ts`: native-util에 의존 → **파일 자체 삭제**. 호출부(library.ts의 previousFocusedGame/gamePid)도 제거.
- `lib/watcher.ts`: native-fs 래퍼, 그대로.
- `services/archive.ts`: 아카이브 해제. Linux 호환성 확인 후 유지 (7zip 라이브러리 의존).
- `ipc/handlers/mod.ts`: 유지. F10 관련 핸들러(`mod:triggerF10`)와 `previousFocusedGame`/`gamePid` 핸들러 제거.
- `ipc/handlers/{path-selector,setting,logger,window,util}.ts`: 유지.
- `services/protocol`, `startup-cleanup.ts`: 유지 (경량).

### 2-3. 제거 대상

```
services/{auth,drive,transfer,xxmi}.ts
services/mod-tools/
worker/{drive,mod-tools}/
server/
ipc/handlers/{auth,drive,transfer,xxmi,tools,fix-tools-manager}.ts
lib/{compressor,crypto,custom-downloader,download,fingerprint,go-process,
     parallel-downloader,script-executor,toggle-viewer-core,tray,upload,native}.ts
native/{dll-injector,extractor,native-util}/
services/mod-manager/f10.ts
```

### 2-4. 렌더러 (`src/renderer`)

- **유지**: `routes/{__root,index,mod/,setting/}`, `components/mod/**`, `components/ui/**`, mod 관련 hooks/store.
- **제거**: `routes/{auth,backup,drive,report,transfer,tools}`, 관련 컴포넌트/훅/스토어.
- **수정**:
  - `WindowsOnlyRoute` 래퍼 제거 (`routes/mod/index.tsx:42`).
  - `useModShortcuts`에서 F10 트리거 훅 제거.
  - "이전 포커스 게임 자동 선택" 훅 제거 → 원본의 `mod:getLastGame` 사용해 마지막 선택 게임 복원으로 대체.
- i18n: ko/en만 유지, mod/setting 키만 남김.

### 2-5. Shared (`src/shared`)

- 유지: `mod.ts`, `platform.ts`, `schemas/`, `utils.ts`.
- `xxmi-match.ts`: previousFocusedGame/gamePid 전용이므로 **제거**.
- `ipc-keys.gen.ts`, `types.gen.ts`: mod 핸들러 기준으로 재생성.

---

## 3. DB 마이그레이션

1. `drizzle/` 전체 삭제, `drizzle-kit generate`로 단일 초기 마이그레이션 생성.
2. 설정 키는 모드 매니저 관련만 유지: `last_game`, `expanded_groups`, `mod.searchModPreview`, `mod.moveFolderInsteadOfCopy`, `mod.copyShaderFixesOnEnable`.
3. `src/main/setting.ts`에서 불필요 키 제거.
4. 기존 Windows DB 자동 이식은 범위 외 (수동 가이드 별도).

---

## 4. Rust 네이티브 모듈 Linux 빌드

### 4-1. 공통

- 각 크레이트의 `package.json` → `"targets": ["x86_64-unknown-linux-gnu"]`.
- `napi build --platform --release` 그대로 사용. 결과물: `*.linux-x64-gnu.node`.
- 빌드 요구: Rust stable 1.80+, `pkg-config`. 배포판별 의존은 README 문서화.
- `.node` 산출물은 저장소 비커밋 (`.gitignore`).

### 4-2. `native/native-mod`

현재 Windows 의존은 **오직 `sendF10` 때문**. F10 제거 시 완전히 제거 가능.

변경:
- `Cargo.toml`에서 `windows` 의존 삭제.
- `src/lib.rs`에서 `send_f10` napi 함수 및 관련 use 구문 제거.
- 남는 기능(`get_characters_folder`, `get_mods` 등 FS 스캔)은 순수 Rust로 Linux에서 그대로 빌드됨.

### 4-3. `native/native-util` → **크레이트 전체 제거**

용도 분석:
- `getProcessName`, `getPreviousPids`, `getTopmostPid`, `startTracking`, `getWindowTitle` — 모두 `previousFocusedGame`/`gamePid`/F10 타겟팅 용도.
- F10 및 이전 포커스 게임 감지를 제거하면 **모든 함수가 미사용**.

조치: 크레이트 삭제, `src/main/lib/native.ts` 삭제, `library.ts`에서 `previousFocusedGame`/`gamePid` 메서드 및 그 IPC 핸들러 제거. 렌더러에서 관련 훅 제거.

### 4-4. `native/native-fs`

Windows 의존: `Win32_System_RestartManager` (파일 잠금 프로세스 조회).

Linux 재구현:
- `getLockingProcesses(path)` → `procfs` crate로 `/proc/*/fd/*` 스캔, 대상 경로와 일치하는 프로세스 수집.
- `Cargo.toml`: `windows` 의존 삭제, `procfs = "0.16"` 추가.
- `src/lib.rs`: `#[cfg(target_os = "linux")]` 블록으로 구현. notify(`notify = "8.1.0"`) 부분은 크로스플랫폼 → 그대로.

---

## 5. 빌드 / 패키징

### 5-1. electron-builder.yml (Linux 전용)

```yaml
appId: live.nahida.desktop-linux
productName: Nahida Desktop
directories: { buildResources: build }
files:
  - "!src/**/*"
  - "!native/**/*"
  - "!{electron.vite.config.*,tsconfig*.json,pnpm-lock.yaml}"
disableDefaultIgnoredFiles: true
asarUnpack:
  - "**/*.node"
  - "node_modules/sharp"
  - "node_modules/@img"
linux:
  target: [AppImage, pacman]
  category: Utility
  maintainer: Relained <sewon7@gmail.com>
appImage:
  artifactName: ${productName}-${version}.${ext}
pacman:
  artifactName: ${productName}-${version}.${ext}
```

- `scripts/after-sign-mac.js` 삭제.
- `package.json` 스크립트 정리: mac/win 관련 전부 제거, `release:linux` 추가.

### 5-2. AUR

**`nahida-desktop-linux-bin`** PKGBUILD 작성.
- GitHub Release의 AppImage를 받아 `/opt/nahida-desktop-linux/`에 배치, `.desktop` 파일·아이콘 설치.
- 경로: `packaging/aur/PKGBUILD` + `.SRCINFO`.
- depends: `fuse2` (AppImage 실행용), optdepends 최소.
- 옵션(후순위): 소스 빌드 버전 `nahida-desktop-linux`.

### 5-3. 버전/업데이터

- `version: 0.1.0`로 리셋.
- `electron-updater`/`dev-app-update.yml`/`publish:` 초기엔 비활성. 릴리즈 채널 확립 후 재활성.

---

## 6. 작업 단계

### Phase 1: 스캐폴딩 (반나절) — ✅ 완료
- [x] `linux/` 디렉토리 생성, `package.json`/tsconfig/`electron.vite.config.ts` 복사.
- [x] drizzle 신규 초기화 (슬림 스키마).
- [x] `electron-builder.yml` Linux 전용 교체 (AppImage + pacman).
- [x] 원본 `src/`에서 화이트리스트 파일만 복사.
- [x] Windows 전용 서비스/컴포넌트 제거 (drive/transfer/xxmi/mod-tools/auth/tray/report 등).
- [x] 아카이브 해제를 `7z` CLI 서브프로세스로 치환 (native/extractor 대체).
- [x] `pnpm build` (main + preload + renderer) 통과.

### Phase 2: Rust 네이티브 Linux 빌드 (반나절~1일) — ✅ 완료
- [x] `native-util` 디렉토리 삭제, `src/main/lib/native.ts` 삭제 (Phase 1에서 선행).
- [x] `native-fs`: `getLockingProcesses` procfs 구현 (`/proc/*/fd`, `maps`, `cwd` 스캔).
- [x] `native-fs` Cargo.toml: `windows` 의존 제거, `[target.'cfg(target_os="linux")']`에 `procfs = "0.16"`.
- [x] `native-mod`: `windows` 의존 + `send_f10`/EnumWindows/FindWindow 코드 전부 삭제.
- [x] 두 크레이트 `napi build` 통과 (`native-fs.linux-x64-gnu.node`, `native-mod.linux-x64-gnu.node`).
- [x] `napi.targets` 를 `x86_64-unknown-linux-gnu` 로 변경.

### Phase 3: 메인 프로세스 이식 (1일) — 대부분 Phase 1에서 선행
- [x] mod-manager 파일(+ f10 제외) 복사 및 컴파일.
- [x] `library.ts`에서 `previousFocusedGame`/`gamePid` 제거.
- [x] IPC 핸들러 `mod.ts` 정리 (F10/포커스/다운로드 관련 핸들러 제거).
- [x] `NahidaDesktop` 클래스에서 제거된 서비스 참조 정리.
- [ ] Rust 네이티브 실제 빌드 후 런타임 연결 (Phase 2 완료에 의존).

### Phase 4: 렌더러 정리 (1일) — ✅ 완료
- [x] 라우트 정리, `WindowsOnlyRoute` 제거 (`mod/index.tsx`, `setting/mod.tsx`).
- [x] mod/setting 컴포넌트만 남기고 삭제 (auth/drive/transfer/backup/tools/report 루트·컴포넌트 제거).
- [x] F10/이전포커스/커스텀다운로드/아카이브추출 prompt 관련 훅·상태·UI 제거 (`modStore`, `content-header`, `__root`, `use-mod-events`).
- [x] Sidebar 재작성 (Mod + Settings만).
- [x] `character-sidebar`의 akasha 의존 제거 (인라인 파일명 검증).
- [x] i18n 슬림화: `ja.json`/`zh.json` 삭제, `i18n/index.ts`에서 ko/en만 로드, 언어 선택 UI(`setting/gen`)에서 ja/zh 옵션 제거.
- [x] locale 키 슬림화: `transfer`/`drive`/`share_drive`/`tools`/`report` 최상위 섹션 및 `components.*`, `page.setting.{transfer,xxmi,acc}` 제거.
- [x] `setting/route.tsx` 정리: XXMI/account/transfer 탭 제거, `supportsWindowsDesktopFeatures` 의존 제거.
- [x] `pnpm build` 통과.
- [ ] `pnpm dev` 스모크 테스트는 Phase 6.

### Phase 5: 빌드 파이프라인 (반나절) — ✅ 완료
- [x] AUR `-bin` PKGBUILD 작성 (`linux/packaging/aur/PKGBUILD`), `.SRCINFO` 생성.
- [x] `package.json`에 `homepage` 추가 (pacman 요구).
- [x] `electron-builder.yml`의 `artifactName`을 공백 없는 `${name}-${version}.${ext}`로 변경, PKGBUILD source URL과 정합.
- [x] `pnpm build:linux` → `dist/nahida-desktop-linux-0.1.0.AppImage` (130 MB), `dist/nahida-desktop-linux-0.1.0.pacman` (94 MB) 산출.
- [x] PKGBUILD `bash -n` 통과, `makepkg --printsrcinfo` 정상 출력.
- [ ] 실제 GitHub Release 업로드 후 `makepkg -si` end-to-end 검증은 릴리즈 시점에.

### Phase 6: 스모크 테스트 (반나절)
- [ ] 실제 모드 폴더로 Enable/Disable/Toggle/Rename.
- [ ] 프리셋 생성/적용/삭제.
- [ ] FS watcher 이벤트 UI 반영.

---

## 7. 범위 밖

- Drive, Transfer, XXMI launcher, Mod Tools 전체.
- 인증, 커스텀 다운로더, 원격 모드 다운로드 UI.
- **F10 전송** 및 외부 게임 제어.
- **이전 포커스 게임 자동 감지** (마지막 선택 게임 복원으로 대체).
- Windows/Mac 빌드, 코드 서명, 자동 업데이트 서버.
- 기존 Windows DB 자동 이식.

---

## 8. 확정 사항

- **프로젝트명**: `nahida-desktop-linux` (package.json name, appId는 `live.nahida.desktop-linux`).
- **라이선스**: 원본 `LICENSE` 그대로 승계 (리포지토리 루트 LICENSE 유지).
- **배포**: AppImage + AUR (`nahida-desktop-linux-bin` PKGBUILD 동시 작성).
- **previousFocusedGame/gamePid**: 제거 확정.

## 9. 잔여 확인 (Phase 진행 중 결정)

- 아카이브 해제: `7z` CLI 호출로 전환 확정 (runtime 의존: `p7zip`). PKGBUILD `depends`에 추가 필요.
- Rust 네이티브 빌드는 Phase 2에서 실 수행 예정 (현재 빌드는 `.node` 없이 JS 번들만 확인).

## 10. 현재 진행 요약 (2026-04-19)

- **Phase 1 / 2 / 3 / 4 / 5**: 완료. AppImage + pacman 산출물, AUR PKGBUILD + .SRCINFO 준비.
- **Phase 6**: 미착수.
- 다음 단계: `pnpm dev` 또는 `./dist/nahida-desktop-linux-0.1.0.AppImage` 실행으로 스모크 테스트.
