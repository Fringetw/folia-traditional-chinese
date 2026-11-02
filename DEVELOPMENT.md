# 開發、測試與打包

需要 Node.js 24 或以上。以下操作在本儲存庫根目錄執行；Folia 原始碼只用於測試，不會打包進插件。

## 首次準備

取得本儲存庫原始碼並進入資料夾後執行：

```bash
npm ci
git clone --depth 1 --branch v0.7.25 https://github.com/chthollyphile/folia-major.git .test-host/folia-major
```

測試主機預設位於 `.test-host/folia-major`。也可以使用既有 Folia checkout，將 `FOLIA_SOURCE_ROOT` 設成它的根目錄：

```powershell
$env:FOLIA_SOURCE_ROOT = 'C:\Projects\folia-major'
```

Bash 對應為 `export FOLIA_SOURCE_ROOT=/path/to/folia-major`。不需要將插件檔案複製進 Folia，也不需要替 Folia 安裝完整 Electron 開發依賴。

## 檢查與測試

```bash
npm run check
npm test
```

`check` 使用 Folia 自己的模組檢查工具。`test` 使用真正的 Folia DTO、重建流程與 ZIP 安裝器；目前為 224 項測試。

測試啟動器會透過子程序的 `NODE_PATH`，讓外部 Folia checkout 的 CommonJS 安裝器讀到本儲存庫已安裝的 fflate。它只讀取宿主原始碼，不修改宿主 checkout。

## 打包

```bash
npm run build
```

1.1.6 的輸出為：

- `dist/opencc-traditional-lyrics-1.1.6.zip`
- `dist/SHA256SUMS.txt`

打包來源只有 `mods/opencc-traditional-lyrics/`。預覽圖、完整轉換引擎及第三方授權會包含在 ZIP；原始碼倉庫的 `docs/`、測試、腳本和開發依賴不會包含在 ZIP。

建置會檢查兩份版本號是否一致、入口與預覽圖是否存在，以及預覽圖是否低於 1 MiB。輸入檔案使用固定排序與 ZIP 時間戳；SHA-256 可用於檢查附件是否為同一份建置。

測試中的 ZIP 安裝案例也會執行這個真實打包腳本，再交給 Folia 的安裝器驗證安裝與覆蓋安裝。

## GitHub Actions

`.github/workflows/ci.yml` 在 push、pull request 或手動啟動時執行：

1. 分別取 Folia v0.7.22、v0.7.23、v0.7.25。
2. 使用鎖定檔執行 `npm ci`。
3. 執行模組檢查與 224 項測試。
4. 兩個版本都成功後，建置 ZIP 與 SHA-256 校驗檔，提供為 workflow artifact。

此流程只做檢查、測試和打包；不自動建立 Release、不傳送 issue 留言，也不簽章。完整 GitHub Actions 雲端流程需在檔案上傳後由 GitHub 實際執行確認。

## 版本更新

更新時同步修改根目錄 `package.json` 與模組的 `mod.json` 版本號，再執行上述檢查、測試與建置。Release、原始碼 tag、送審 commit 與 ZIP 應對應同一版本。

市場簽章由 Folium 維護者產生。不要將其他版本的 `folium.sig.json` 複製進新版本。

## 自動選字幕的程式入口

- `client.mjs`：設定、事件與命令註冊，先選字幕再簡轉繁。
- `selectChinese.mjs`：公開 Omni 查詢、候選迭代、逾時／取消、暫存與請求上限。
- `songMatch.mjs`：跨文字歌名副標題、假名／Hepburn 藝名、版本與時長檢查，以及查詢退路。
- `lyricQuality.mjs`：中文覆蓋率、原詞與固定時間差核對、分行補中文及無效逐字資料的逐行退路；整份替換只用於空白／無效字幕。
- `diagnostics.mjs`：有上限的逐筆紀錄、公開錯誤碼、安全欄位與文字報告。
- `diagnosticsUi.mjs`：宿主管理的設定區、可選取文字、複製失敗退路與 JSON 下載。
- `test/unit/mod-system/diagnosticsUi.test.ts`：使用固定 jsdom 24.1.3 驗證報告操作與匯出；不是 Chromium 畫面驗證。
- `test/unit/mod-system/chineseSubtitles.test.ts`：匹配、選擇、備援、生命週期及真實 Omni 邊界的離線回歸測試。

選字幕沒有使用未公開的宿主欄位、平台原始端點、帳號憑證或 AI 語意模型。測試資料不能代表真實平台的網路可用性或翻譯語意品質。字幕選擇、品質、比對與診斷程式的依賴 URL 都會承接 client 的版本指紋，避免重新載入後沿用舊程式。

測試額外固定 `@applemusic-like-lyrics/ttml@1.0.1` 與 `@xmldom/xmldom@0.9.12`（與驗證用 Folia 鎖定版本一致），讓本儲存庫可載入宿主真正的 `parseLRC`，不需要安裝宿主完整依賴。jsdom@24.1.3 也列入本儲存庫鎖定的開發依賴，供報告 DOM 與匯出測試使用。這些依賴只供開發測試，不會打包進模組。測試設定將它們解析到本儲存庫的 node_modules。

## 瀏覽器渲染與防止無限等待

這是額外的整合測試。先在外部 Folia checkout 執行 `npm ci --ignore-scripts`、`npx playwright install chromium`，再回到本儲存庫執行：

```bash
npm run test:browser
```

使用真正的 Folium client API、事件、歌詞 setter 及 Partita／Sonnet／Diorama；來源回覆為合成資料。會測中文實際 DOM、主歌詞可見性、動畫畫面、分詞重建、切歌競態、失敗保留、還原、重試與停用。

啟動器使用全新瀏覽器 context，不讀既有 profile。瀏覽器 HTTP／WebSocket 只允許本輪的本機測試埠，封鎖宿主歌詞代理；Vite 子程序的 fetch 也只允許本機，避免啟動時連向版本名稱服務。這些限制只用於測試，不會加入插件。

會暫時新增唯一命名的宿主 dev/probes 檔與 test-results/ 檔，結束後清理，不修改宿主正式程式。測試請依序跑。若上次程序被強制終止，啟動器會列出殘留的 openccRecovery*.probe.tsx 並停止；先將列出的暫存頁及對應 test-results/opencc-browser-* 移到備份目錄，再重跑。不要刪除宿主其他探針。

每階段會輸出 `PHASE`、每項輸出 `PASS/FAIL`，逐步更新 `test-results/browser/report.json`，並保留 Vite 日誌及內部驗證截圖。也記錄瀏覽器請求失敗、阻擋項目及字型／插件載入階段。個別操作有逾時，預設整輪最多 180 秒；可用 `OPENCC_BROWSER_TIMEOUT_MS` 設定 30000–600000 毫秒。程序異常時報告記錄失敗階段，沒有完成的項目不算通過。

可設定 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指向既有 Chromium。無 CJK 字型的 Linux 可將 `OPENCC_TEST_FONT_ROOT` 指向另行解壓的 `@fontsource/noto-sans-jp` 目錄（含 400.css、700.css 和 files/）。測試字型不打包進插件。

舊版對照：`npm run test:browser -- --baseline=/path/to/old-repo`。對照模式允許檢查失敗，報告仍明確列出失敗；程序啟動或逾時錯誤仍回傳非零。正式模式任何檢查失敗都回傳非零。

如果瀏覽器啟動仍受環境限制，可先執行 `npm run check`、`npm test`、`npm run build`，用真正宿主 DTO、重建與 ZIP 安裝器驗證邏輯及安裝。但這不能取代動畫實際可見性檢查，應將瀏覽器項目標為未完成，保留報告後在可用 Chromium 重跑。

## 原始碼更新包

```bash
npm run package:source
```

產生 `dist/folia-traditional-chinese-1.1.6-update.zip`，與可安裝的 `opencc-traditional-lyrics-1.1.6.zip` 分開。保留 `.github/` 與 `.gitignore`，排除 Git 資料、node_modules、測試主機、測試輸出與安裝產物。解壓後將 folia-traditional-chinese/ 內的內容放到儲存庫根目錄。

## 覆蓋安裝與新診斷模組載入

```bash
node scripts/verifyUpgrade.mjs /path/to/folia /path/to/this-project /path/to/old.zip /path/to/new.zip /path/to/report.json
```

使用宿主官方 ZIP 安裝器、內容摘要與原生 ESM 載入，檢查舊版覆蓋、新的診斷依賴載入、設定保留與停用清理。來源服務是離線 fixture，不能當 Windows 實播結果。


## 從已交付 ZIP 驗證覆蓋更新

`verifyUpgrade.mjs` 使用官方安裝器、內容摘要與原生 ESM 載入，需傳入先前實際交付的 1.1.5 安裝 ZIP：

```bash
NODE_PATH="$PWD/node_modules" node scripts/verifyUpgrade.mjs /absolute/path/opencc-traditional-lyrics-1.1.5.zip
```

沿用前述 `FOLIA_SOURCE_ROOT` 指向驗證用宿主。先執行 `npm run build` 產生本版 ZIP。這項為隔離的 API fixture，不能當作 Windows GUI 或真實音源實播。
