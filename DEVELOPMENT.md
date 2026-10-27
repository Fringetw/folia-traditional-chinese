# OpenCC 繁體字幕：開發原始碼

安裝使用請選 `opencc-traditional-lyrics-1.0.0.zip`；這份是可合併進 Folia 原始碼樹的開發套件。

1. 取得 https://github.com/chthollyphile/folia-major ，切到 `v0.7.22`（`1f6d0f468f5bc81b23a8b40ad7ca96ccd4b1ecbe`）。
2. 將此壓縮包的 `mods/`、`test/`、`dev/` 目錄合併到該儲存庫的同名目錄。沒有變更宿主既有程式碼。
3. 依宿主 README 安裝開發依賴；需要 Node.js 24 或以上。
4. 執行 `node dev/folium/check.mjs opencc-traditional-lyrics`。
5. 執行 `npx vitest run --config dev/folium/openccTests.config.mjs`，應通過 41 項測試。

測試使用真正的宿主 DTO／重建程式與 ZIP 安裝器，沒有要求執行完整 Electron 應用或使用私人音樂帳號。
插件是未簽署的第三方模組，首次啟用仍須完成 Folia 自己的確認。

`mods/opencc-traditional-lyrics/README.md` 包含使用方法；`VALIDATION.md` 包含修正項目與驗證限制。
`vendor` 中保留 opencc-js 1.4.2 的原始發布檔案及授權。
