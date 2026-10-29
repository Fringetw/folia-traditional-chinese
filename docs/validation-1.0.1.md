# 1.0.1 維護版驗證紀錄

日期：2026-10-29。狀態：本機驗證完成，尚待 GitHub Actions 雲端執行與 Folium 新版本審查。

## 變更範圍

文件、版本資訊、測試執行方式、打包腳本與 CI。沒有新增轉換選項或權限；`client.mjs`、`converter.mjs` 與 `vendor/opencc-cn2t-1.4.2.mjs` 已確認與來源提交 `ecbd31205487f7aa576880915b12db94425b5525` 逐位元組一致。

## 環境與結果

Node.js 24.22.1、Vitest 4.1.11、fflate 0.8.3。

| 項目 | 結果 |
| --- | --- |
| 依 package-lock.json 執行 npm ci | 通過 |
| Folia v0.7.22，提交 1f6d0f468f5bc81b23a8b40ad7ca96ccd4b1ecbe | 模組檢查通過；41 項測試通過 |
| Folia v0.7.23，提交 c0742c0721020a1cbd603d8fbdc76e5c39131b27 | 模組檢查通過；41 項測試通過 |
| 在乾淨宿主 checkout 上直接執行新版測試流程 | 通過；無須將插件複製進宿主或安裝宿主全部依賴 |
| 真正建置 ZIP 的安裝與覆蓋安裝 | 通過 Folia 的實際 ZIP 安裝器 |
| 最終 ZIP 的原生 ESM 入口載入 | 通過 |
| 預覽圖 | 1280×720，684,762 bytes，低於 1 MiB |
| 套件內容 | 10 個檔案，含入口、轉換程式、預覽圖、引擎與完整授權 |
| 開發報告與舊簽章 | 安裝包未包含 VALIDATION.md 或 folium.sig.json |
| 重複建置與時區切換 | UTC 與 Asia/Taipei 的 ZIP SHA-256 一致 |
| 文件相對連結與 workflow YAML 結構 | 通過 |

41 項測試沿用原有案例並調整執行入口；其中安裝案例現在會執行真實打包腳本，驗證版本、預覽圖、授權檔與安裝結果，而不是只在測試內另造 ZIP。

## 打包結果

- 檔名：`opencc-traditional-lyrics-1.0.1.zip`
- 大小：1,168,583 bytes。
- SHA-256：`ccd38b731cc06cc24dce4933b084edfa505fc2ee5e69490247ba90848b87cd2c`。
- 自行建置的 ZIP 未含官方簽章。簽章由 Folium 維護者在審查後產生；不能沿用 1.0.0 的簽章。

## 驗證界線

本機測試環境為 Linux，沒有新增完整 Electron GUI 的實際播放驗證，也未在 Windows／macOS 執行本次維護版。GitHub Actions 工作流程的指令與 YAML 已在本機檢查，尚未在使用者帳號的 GitHub runner 上實際執行。

既有的純漢字日文辨識限制與其他歌詞改寫模組的處理順序限制不變，詳見 README。
