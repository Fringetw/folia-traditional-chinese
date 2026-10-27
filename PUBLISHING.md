# 上傳到 GitHub

建議儲存庫名稱：`folia-opencc-traditional-lyrics`。

## 建立儲存庫

1. 前往 https://github.com/new ，Owner 選擇 `Fringetw`。
2. Repository name 填入 `folia-opencc-traditional-lyrics`。
3. Description 可填「基於 OpenCC 的 Folia 離線繁體字幕插件，保留逐字時間軸。」
4. 如果希望公開分享，選擇 Public。
5. 本套件已經包含 README 與 LICENSE，建立時無須另外產生。
6. 按 Create repository。

## 上傳原始碼

1. 解壓縮這份 GitHub 原始碼包。
2. 在新儲存庫的頁面選擇上傳現有檔案；已有檔案時可用 Add file → Upload files。
3. 將解壓後的 `folia-opencc-traditional-lyrics` 資料夾內所有檔案與資料夾拖進上傳區。
4. 確認 README.md、CREDITS.md、LICENSE、DEVELOPMENT.md、mods/、test/、dev/ 都位於儲存庫根目錄。
5. 提交訊息可填 `Add OpenCC traditional lyrics plugin`，完成提交。

根目錄的 README.md 會成為儲存庫首頁的說明。

## 發布安裝包

1. 開啟儲存庫的 Releases 頁面，建立新的 release。
2. Tag 填 `v1.0.0`，Target 選擇包含上述檔案的分支。
3. Title 可填 `OpenCC 繁體字幕 v1.0.0`。
4. 將先前取得的 `opencc-traditional-lyrics-1.0.0.zip` 作為附件上傳；這是可直接拖進 Folia 的安裝檔。
5. 發布說明可使用下面的內容，檢查附件後按 Publish release。

```markdown
Folia 的離線簡轉繁插件，預設使用臺灣繁體，保留逐字時間軸。

- 適用並驗證於 Folia 桌面版 0.7.22。
- 支援原文歌詞、和聲與中文譯文。
- 設定變更立即套用，停用時還原原始顯示資料。
- 初版通過 41 項自動測試，尚未完成完整 Electron 介面的播放驗證。

請下載附件 opencc-traditional-lyrics-1.0.0.zip，拖入 Folia 的「設定 → 模組」。

感謝 folia-major、OpenCC、opencc-js 和 opencc-data 的作者與貢獻者。
詳細來源與授權見儲存庫的 CREDITS.md。
```

GitHub 自動提供的 Source code 壓縮包包含整個儲存庫；使用者安裝插件時，請選你附上的專用安裝 ZIP。

## 官方操作文件

- 建立儲存庫：https://docs.github.com/en/repositories/creating-and-managing-repositories/quickstart-for-repositories
- 上傳檔案：https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- 建立 release：https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository
