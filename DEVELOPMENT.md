# 開發、測試與打包

需要 Node.js 24 或以上。以下操作在本儲存庫根目錄執行；Folia 原始碼只用於測試，不會打包進插件。

## 首次準備

取得本儲存庫原始碼並進入資料夾後執行：

```bash
npm ci
git clone --depth 1 --branch v0.7.23 https://github.com/chthollyphile/folia-major.git .test-host/folia-major
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

`check` 使用 Folia 自己的模組檢查工具。`test` 使用真正的 Folia DTO、重建流程與 ZIP 安裝器；目前為 128 項測試。

測試啟動器會透過子程序的 `NODE_PATH`，讓外部 Folia checkout 的 CommonJS 安裝器讀到本儲存庫已安裝的 fflate。它只讀取宿主原始碼，不修改宿主 checkout。

## 打包

```bash
npm run build
```

1.1.1 的輸出為：

- `dist/opencc-traditional-lyrics-1.1.1.zip`
- `dist/SHA256SUMS.txt`

打包來源只有 `mods/opencc-traditional-lyrics/`。預覽圖、完整轉換引擎及第三方授權會包含在 ZIP；原始碼倉庫的 `docs/`、測試、腳本和開發依賴不會包含在 ZIP。

建置會檢查兩份版本號是否一致、入口與預覽圖是否存在，以及預覽圖是否低於 1 MiB。輸入檔案使用固定排序與 ZIP 時間戳；SHA-256 可用於檢查附件是否為同一份建置。

測試中的 ZIP 安裝案例也會執行這個真實打包腳本，再交給 Folia 的安裝器驗證安裝與覆蓋安裝。

## GitHub Actions

`.github/workflows/ci.yml` 在 push、pull request 或手動啟動時執行：

1. 分別取 Folia v0.7.22、v0.7.23。
2. 使用鎖定檔執行 `npm ci`。
3. 執行模組檢查與 128 項測試。
4. 兩個版本都成功後，建置 ZIP 與 SHA-256 校驗檔，提供為 workflow artifact。

此流程只做檢查、測試和打包；不自動建立 Release、不傳送 issue 留言，也不簽章。完整 GitHub Actions 雲端流程需在檔案上傳後由 GitHub 實際執行確認。

## 版本更新

更新時同步修改根目錄 `package.json` 與模組的 `mod.json` 版本號，再執行上述檢查、測試與建置。Release、原始碼 tag、送審 commit 與 ZIP 應對應同一版本。

市場簽章由 Folium 維護者產生。不要將其他版本的 `folium.sig.json` 複製進新版本。

## 自動選字幕的程式入口

- `client.mjs`：設定、事件與命令註冊，先選字幕再簡轉繁。
- `selectChinese.mjs`：公開 Omni 查詢、候選迭代、逾時／取消、暫存與請求上限。
- `lyricQuality.mjs`：歌曲版本核對、中文覆蓋率與格式檢查、保留原時間軸的譯文合併。
- `test/unit/mod-system/chineseSubtitles.test.ts`：匹配、選擇、備援、生命週期及真實 Omni 邊界的離線回歸測試。

選字幕沒有使用未公開的宿主欄位、平台原始端點、帳號憑證或 AI 語意模型。測試資料不能代表真實平台的網路可用性或翻譯語意品質。執行時載入的三個本地模組都會承接 client 的版本指紋，避免重新載入後沿用舊程式。
