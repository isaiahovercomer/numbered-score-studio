# 更新紀錄

格式依 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本號依 [語意化版本](https://semver.org/lang/zh-TW/)。

## [2.1.0] - 2026-10-18

### 新增
- **Word 官方標語歌版式（lsm，預設）**：US Letter、邊界 32.5 pt、明體、①②③ 節次、左「調」右「拍號」、預設不顯示速度，可選末頁置中斜體版權行。原本的版式保留為 **classic**（A4、標楷體、一、二、三、），可在「Word 版式」選單切換，也可個別覆寫紙張、節次樣式與是否顯示速度。（PR #3）
- **官方用字自動替換**：資料驅動的對照表 `wording-rules.js`（例如 吃→喫、什麼→甚麼、預備→豫備、教會→召會、能夠→能彀、做→作、裡→裏、因著→因着、為著→為着）。**只改輸出**，編輯器裡的歌詞稿、JSON、MIDI 不會被改；狀態列會列出替換了哪些詞。lsm 版式預設開啟，classic 預設關閉。歧義處保守不改、只提示。（PR #4）
- **誤改防護**：「才能」排除人才、天才、口才、剛才；「嗎」只換句末後接標點者（是什麼嗎、這嗎、嗎哪不動）；替換次數不重複計算 notationLayout 音節；已替換的詞不再列為待確認。（PR #4）
- Word 版式回歸測試、儲存庫衛生測試與 GitHub Actions CI（`npm test`，不使用任何 secret）。（PR #2）
- `NOTATION_RULES.md` 新增官方用字對照，由 `gen-wording-doc.mjs` 依規則表產生，測試會檢查兩者同步。

### 變更
- Word 輸出預設改為官方版式（lsm）；要沿用舊輸出請選 classic。（PR #3）
- `npm test` 現在涵蓋 worker、Word 版式、用字規則與儲存庫衛生測試。（PR #1、#2、#4）

### 安全
- **Worker 配額與防護強化**（PR #1）：`max_output_tokens` 由 12000 降為 10000；額度對象改用 IPv6 /64；IP 雜湊改用 HMAC-SHA256；加入圖片檔頭（magic bytes）檢查；先檢查 IP 額度再讀取請求本文。
- **注意**：Cloudflare Worker 需另外執行 `wrangler deploy` 後，Worker 的變更才會在線上生效；合併到 main 並不會自動部署。

### 修正與清理
- 移除誤上傳的 `download`、`download (1)` 檔案；修正 README 與 `credits.txt` 的路徑。（PR #1）
- 衛生測試改用 `fileURLToPath`（Windows 相容）並以 git 檔案清單略過被 `.gitignore` 排除的本機檔案。（PR #2）
- 深色面板中的「Word 版式」選單文字可見；版權文字含 `$` 時不再破壞 DOCX。（PR #3）

[2.1.0]: https://github.com/isaiahovercomer/numbered-score-studio/releases/tag/v2.1.0
