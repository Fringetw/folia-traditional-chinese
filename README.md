# Folia OpenCC 繁體字幕

將 Folia 的簡體歌詞與中文譯文轉成繁體，保留原本的逐字時間軸。預設採用臺灣字形，內附 OpenCC 字典，可完全離線使用。

目前市場正式版為 **1.0.0，已簽章收錄**；本分支準備的 **1.0.1** 是文件與發布流程維護版，尚待更新審查。

## 安裝（建議使用模組市場）

1. 開啟 Folia 桌面版的「設定 → 模組」，啟用「模組系統」。
2. 前往 [Folium 模組市場：OpenCC 繁體字幕](https://folium-compound.cielaniska.top/#mod-opencc-traditional-lyrics)，依頁面指示安裝。
3. 回到 Folia 模組面板，啟用「OpenCC 繁體字幕」。

市場的 1.0.0 已通過維護者的安全與功能審查，詳見 [收錄紀錄](https://github.com/chthollyphile/folium-compound/issues/98#issuecomment-6475429658)。

### GitHub 手動安裝

在 [Releases](https://github.com/Fringetw/folia-traditional-chinese/releases) 下載該版本的專用安裝 ZIP，拖入 Folia 模組面板即可。1.0.1 起統一使用檔名 `opencc-traditional-lyrics-<版本>.zip`；舊版 1.0.0 的附件名稱為 `traditional-lyrics-1.0.0.zip`。

**本儲存庫自行打包的 ZIP 未包含 Folium 官方簽章，可能顯示「未驗證」。** 市場版的簽章只涵蓋送審時的指定檔案，不能沿用到修改後的版本。

GitHub 自動產生的 Source code 壓縮包用於開發。若要從原始碼手動安裝，可將 `mods/opencc-traditional-lyrics/` 整個資料夾放進 Folia 的使用者模組目錄，再重新載入並啟用。

## 功能與設定

- 原文歌詞、和聲與中文譯文可以分別開關。
- 可選臺灣繁體或 OpenCC 標準繁體。
- 先整句轉換，再對回逐字、音節與分詞邊界，保留詞語上下文與時間戳。
- 設定變更立即套用；停用時還原原始顯示資料。
- 命令面板提供「切換繁體字幕」。

只影響歌詞顯示資料，不覆寫原始歌詞檔。使用者不需要安裝 Python、OpenCC 或提供 API 金鑰。

日文歌若只希望轉換中文字幕，請關閉「轉換原文歌詞與和聲」，保留「轉換中文譯文」。

## 相容性與限制

支援的版本範圍為 `>=0.7.22 <0.8.0`。目前對 **Folia v0.7.22 與 v0.7.23** 各執行 41 項自動測試，其他版本未驗證。這些測試不等於完整 Electron 介面的實際播放驗證。

- 預設保留含假名或韓文的整行文字；純漢字日文無法可靠自動辨識。
- 只做中文簡繁轉換，不做跨語言翻譯。
- 不套用會改變字數的臺灣地區詞彙替換；例如「软件」轉為「軟件」，不會改寫成「軟體」。
- 與其他會改寫歌詞的模組並用時，結果可能受處理順序影響。

檢查範圍見 [1.0.1 驗證紀錄](docs/validation-1.0.1.md) 與 [首版歷史紀錄](docs/validation-1.0.0.md)。

## 開發與發布

本次維護沒有新增轉換功能。新增的 GitHub Actions 會在 Folia v0.7.22、v0.7.23 上檢查與測試，通過後產生安裝 ZIP 和 SHA-256 校驗檔；不會自動發布 GitHub Release 或替模組簽章。

本機測試與打包方式見 [DEVELOPMENT.md](DEVELOPMENT.md)，更新步驟見 [1.0.1 更新說明](docs/update-guide-1.0.1.md)，版本差異見 [CHANGELOG.md](CHANGELOG.md)。

## 上游專案與致謝

| 專案 | 用途 |
| --- | --- |
| [chthollyphile/folia-major](https://github.com/chthollyphile/folia-major) | Folia 播放器、Folium 模組介面與歌詞轉換鉤子 |
| [BYVoid/OpenCC](https://github.com/BYVoid/OpenCC) | 中文簡繁轉換的上游專案與字典體系 |
| [nk2028/opencc-js](https://github.com/nk2028/opencc-js) | 實際使用的 JavaScript 轉換引擎，固定版本 1.4.2 |
| [nk2028/opencc-data](https://github.com/nk2028/opencc-data) | opencc-js 內附字典的來源，版本 1.4.2 |

感謝上述專案的作者與貢獻者。這份清單表示使用的來源，不表示本專案維護者曾向這些上游專案提交程式碼。完整來源與授權見 [CREDITS.md](CREDITS.md)。

## 維護與授權

維護與發布：[Fringetw](https://github.com/Fringetw)。初版程式碼、測試與文件使用 ChatGPT／Codex 協助製作。

自行撰寫的插件程式碼、測試與建置腳本採用 [MIT License](LICENSE)；第三方引擎與字典保留各自授權，詳見插件的 `vendor/` 目錄。
