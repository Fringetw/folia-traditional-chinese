# OpenCC 繁體字幕

將 Folia 的簡體歌詞與中文譯文轉成繁體，預設採用臺灣字形，保留逐字時間軸。內附字典，可完全離線使用。

## 安裝與簽章

建議從 [Folium 模組市場](https://folium-compound.cielaniska.top/#mod-opencc-traditional-lyrics) 安裝已審查的簽章版本，再到 Folia「設定 → 模組」啟用。

GitHub 自行打包的安裝 ZIP 命名為 `opencc-traditional-lyrics-<版本>.zip`，可拖入模組面板手動安裝；這類建置沒有官方簽章，可能顯示「未驗證」。市場簽章只適用於已審查的指定版本，更新後的檔案需重新送審，不能沿用其他版本的簽章。

支援範圍：Folia 桌面版 `>=0.7.22 <0.8.0`。已針對 v0.7.22 與 v0.7.23 執行自動測試。

## 設定

- 「轉換原文歌詞與和聲」與「轉換中文譯文」可分別控制。
- 可選臺灣繁體或 OpenCC 標準繁體。
- 設定變更立即套用，停用時還原原始顯示資料。
- 命令面板可搜尋「切換繁體字幕」。

日文歌若只想轉換中文譯文，請關閉「轉換原文歌詞與和聲」。

## 限制

預設保留含假名或韓文的整行文字；純漢字日文無法可靠辨識。只做簡繁轉換，不做跨語言翻譯，也不套用會改變字數的臺灣地區詞彙替換。

本插件不覆寫原始歌詞檔。與其他歌詞改寫模組並用時，結果可能受處理順序影響。

## 測試與來源

使用 OpenCC 字典的 JavaScript 實作 opencc-js 1.4.2；`vendor/opencc-cn2t-1.4.2.mjs` 原樣取自該版本 npm 發布檔，僅更改檔名與副檔名。引擎 MIT、字典 Apache-2.0 與第三方授權說明均保留於 `vendor/`。

詳細 [驗證紀錄](https://github.com/Fringetw/folia-traditional-chinese/blob/main/docs/validation-1.0.1.md) 與 [來源致謝](https://github.com/Fringetw/folia-traditional-chinese/blob/main/CREDITS.md) 留在原始碼倉庫，不另附於安裝包。自寫程式碼採 MIT 授權，見本目錄 LICENSE。
