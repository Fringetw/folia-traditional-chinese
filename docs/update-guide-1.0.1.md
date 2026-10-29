# 1.0.1 更新步驟

本更新包是尚待送審的 1.0.1 維護版，不會替換市場上已簽章的 1.0.0。

## 需要更新的檔案

| 檔案 | 處理方式 |
| --- | --- |
| README.md | 覆蓋，更新安裝入口、簽章狀態與新版說明 |
| DEVELOPMENT.md | 覆蓋，改成獨立檢查、測試和打包指令 |
| CREDITS.md | 覆蓋，補上測試主機版本 |
| mods/opencc-traditional-lyrics/README.md | 覆蓋，簡化給使用者看的說明 |
| mods/opencc-traditional-lyrics/mod.json | 覆蓋，版本改成 1.0.1 |
| mods/opencc-traditional-lyrics/VALIDATION.md | **從 GitHub 刪除**，已移至 docs/validation-1.0.0.md |
| docs/ | 新增歷史驗證、新版驗證、Release 文案與本更新步驟 |
| package.json、package-lock.json、scripts/ | 新增開發依賴、檢查與打包流程 |
| .github/workflows/ci.yml | 新增自動檢查、測試與打包 |
| .gitignore、CHANGELOG.md | 新增 |
| test/unit/mod-system/traditionalLyrics.test.ts、dev/folium/openccTests.config.mjs | 覆蓋，支援外部 Folia checkout 並檢查真實建置 ZIP |

`client.mjs`、`converter.mjs`、轉換引擎、字典、預覽圖與授權檔沒有功能變更，完整原始碼包仍包含它們。

## 上傳與檢查

1. 解壓原始碼更新包，將儲存庫資料夾裡的內容上傳到自己的 GitHub 儲存庫根目錄。
2. **另外刪除 GitHub 中舊的 `mods/opencc-traditional-lyrics/VALIDATION.md`**。瀏覽器上傳檔案不會自動替你刪除搬走的舊檔。
3. 確認 Actions 兩個測試版本與打包工作都成功；失敗時先查看日誌。
4. 既有 v1.0.0 Release 的文案可直接改貼 `docs/releases/v1.0.0.md` 的內容。保留原 v1.0.0 附件，不用新檔覆蓋舊版本。
5. 在包含本次改動、測試成功的 commit 上建立 `v1.0.1` tag，再建立對應 Release；文案使用 `docs/releases/v1.0.1.md`。
6. 從同一 commit 的 Actions artifact 或本機建置取得 `opencc-traditional-lyrics-1.0.1.zip` 與 `SHA256SUMS.txt`，作為 Release 附件。

## 送審

在 Folium 市場儲存庫建立「模組更新」issue，來源仍為自己的儲存庫，模組 id 為 `opencc-traditional-lyrics`，目錄為 `mods/opencc-traditional-lyrics`。

版本填這次測試成功、用來產生 ZIP 的完整 commit 或 `v1.0.1` tag，更新內容說明為文件與發布流程整理。新版本需由維護者重新審查與簽章。

市場確認收錄 1.0.1 後，再同步更新 README 中的市場版本狀態。不要自行複製 1.0.0 的簽章來宣稱 1.0.1 已簽章。
