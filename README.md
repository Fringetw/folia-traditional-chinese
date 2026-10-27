# Folia OpenCC 繁體字幕

將 Folia 的簡體歌詞與中文譯文轉成繁體，保留原本的逐字時間軸。

預設採用臺灣字形。字典已附在插件內，可以離線使用，不需要 API 金鑰或另外安裝 OpenCC。

這是適用於 [Folia](https://github.com/chthollyphile/folia-major) 的第三方 Folium 插件，使用 [opencc-js](https://github.com/nk2028/opencc-js) 執行 [OpenCC](https://github.com/BYVoid/OpenCC) 簡繁轉換。

## 安裝

目前驗證版本：**Folia 桌面版 0.7.22**。插件清單允許 `>=0.7.22 <0.8.0`，其他版本未實測。

1. 在本儲存庫的 **Releases** 下載 `opencc-traditional-lyrics-1.0.0.zip`。
2. 開啟 Folia 的「設定 → 模組」，啟用「模組系統」。
3. 將安裝 ZIP 拖到模組面板，不必解壓縮。
4. 啟用「OpenCC 繁體字幕」並完成 Folia 的確認。

本插件尚未經 Folium 官方簽署，因此會顯示「未驗證／未验证」。

Releases 的安裝 ZIP 與 GitHub 自動產生的 Source code 壓縮包用途不同。手動安裝時，也可以把本儲存庫的 `mods/opencc-traditional-lyrics/` 資料夾放入 Folia 的使用者模組目錄，再重新載入並啟用。

## 功能

- 轉換原文歌詞、和聲與中文譯文，可分別開關。
- 可選臺灣繁體或 OpenCC 標準繁體。
- 整句轉換後再對回逐字時間軸，保留詞語上下文。
- 設定變更會立即套用；停用時還原原始顯示資料。
- 命令面板提供「切換繁體字幕」。

只影響顯示資料，不覆寫原始歌詞檔。

日文歌若只需要轉換中文字幕，可關閉「轉換原文歌詞與和聲」，保留「轉換中文譯文」。

## 驗證與限制

初版在 Folia `v0.7.22` 和開發分支通過 **41 項自動測試**，包括逐字同步、資料重建、啟停還原、安裝與覆蓋安裝。

尚未完成完整 Electron 介面的實際播放驗證。

預設保留含假名或韓文的整行文字；純漢字日文無法自動辨識。本插件不做跨語言翻譯，也不套用會改變字數的臺灣詞彙替換。

完整檢查範圍見 [VALIDATION.md](mods/opencc-traditional-lyrics/VALIDATION.md)，測試方式見 [DEVELOPMENT.md](DEVELOPMENT.md)。

## 上游專案與致謝

| 專案 | 在本插件中的用途 |
| --- | --- |
| [chthollyphile/folia-major](https://github.com/chthollyphile/folia-major) | 提供 Folia 播放器、Folium 模組介面與歌詞轉換鉤子 |
| [BYVoid/OpenCC](https://github.com/BYVoid/OpenCC) | 中文簡繁轉換的原始專案與字典體系 |
| [nk2028/opencc-js](https://github.com/nk2028/opencc-js) | 實際使用的 JavaScript 轉換引擎，固定版本 1.4.2 |
| [nk2028/opencc-data](https://github.com/nk2028/opencc-data) | opencc-js 內附字典的資料來源，版本 1.4.2 |

感謝上述專案的作者與貢獻者。這份清單表示本插件使用或依賴的來源，不表示本插件的維護者曾向這些上游專案提交程式碼。

完整來源、版本與授權標示見 [CREDITS.md](CREDITS.md)。

## 維護與開發

- 專案維護與發布：[Fringetw](https://github.com/Fringetw)。
- 初版程式碼、測試與文件使用 ChatGPT／Codex 協助製作。

## 授權

本專案自行撰寫的插件程式碼與測試採用 [MIT License](LICENSE)。第三方引擎與字典保留各自的授權和著作權聲明，詳見 [CREDITS.md](CREDITS.md) 與插件的 `vendor/` 目錄。
