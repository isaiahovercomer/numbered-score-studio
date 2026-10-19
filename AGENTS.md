# AGENTS.md — 譜間（numbered-score-studio）工作規則

給所有在這個儲存庫工作的人與 AI 代理人。這份文件匯總 Isaiah 的偏好、專案規則與水流職事站（LSM）官方格式標準；**改動前先讀，改動後照「完成前檢查」逐項確認**。

> 來源：Isaiah 的指示與偏好、`NOTATION_RULES.md`、官方特會／訓練綱目與標語歌 PDF 的實測規範（`recovery-format-guide.md` v2 A～B 節、`recovery-format-cheatsheet.md`；這兩份在儲存庫外，不在這裡）。本檔不取代 `NOTATION_RULES.md`（排版與用字的完整對照表以它為準）。

## 1. 語言與溝通
- **一律繁體中文**：介面文字、錯誤訊息、README／CHANGELOG、commit 訊息、PR 說明與回報。
- 時間以 Asia/Taipei（UTC+8）為準，並標明時區。
- PR 說明要寫清楚：改了什麼、為什麼、取捨、驗證方式、哪些事留給 Isaiah 決定。

## 2. Git 與 Pull Request 流程
- **所有改動走新分支＋pull request。不直接推 `main`，也不自行合併。** 合併由 Isaiah 決定。
- 分支名稱用 `cursor/<主題>`，一個主題一個 PR，保持小而專注。
- 堆疊 PR（一個基於另一個）時，在 PR 說明寫明基底與合併順序；基底合併後把下一個 PR 的 base 改回 `main`。優先用「merge 基底分支」而不是 force push 來更新。
- 先看 `gh pr list`／`gh pr view`、Bugbot 留言與 CI 狀態再開工；有新留言要在原分支修好並補回歸測試。
- 純重構要附「輸出位元組不變」的證明（見 `golden-docx.test.js`）。刻意改變輸出時，PR 說明要列出差異。
- 版本與 `CHANGELOG.md`：使用者可見的改動記在「未發佈」；發佈由 Isaiah 決定。

## 3. 絕對不可提交的內容
`repo-hygiene.test.js` 會檢查，但請自己先守住：
- **金鑰與秘密**：API key、`.env`、`.dev.vars`、`OPENAI_API_KEY`、`IP_HASH_SALT`。`config.json` 只能放公開的後端網址（`recognitionEndpoint`），**不要改這個網址**。
- **私人 01SMN 字型**及任何字型檔（`.ttf/.otf/.ttc/.woff*`）。
- **音檔**：除了 `samples.json` 登記的音色 MP3，不得有錄音、MIDI、WAV 等。
- **歌詞與私人樂譜**：測試與範例只用合成資料；範例曲〈信的路程〉由使用者提供，不宣告為公有領域。
- 匯出的 `.docx`、`private/` 資料夾。
- `worker.js` 的變更不會因合併而上線，需 Isaiah 另外 `wrangler deploy`。

## 4. 測試
- **`npm test` 必須全過**（只用 Node 內建模組，不需安裝任何東西）；新行為要補測試，修 bug 要補「修正前會失敗」的回歸測試。
- 主要測試：`music.test.js`、`studio.test.js`、`worker.test.js`、`word-layout.test.js`（鎖定兩種 Word 版式）、`word-edge.test.js`（高風險邊界）、`wording.test.js`（用字規則）、`golden-docx.test.js`（DOCX 位元組比對）、`score-edit.test.js`、`musicxml.test.js`（MusicXML 匯出）、`word-lyrics-inline.test.js`（歌詞內文整句排法）、`repo-hygiene.test.js`。新增測試檔記得加進 `package.json` 的 `test` 腳本。
- **刻意改變排版或用字規則**時，先改測試反映新規格，再 `UPDATE_GOLDEN=1 npm test` 更新 `golden-docx.json`，並在 PR 說明為何輸出改變。
- 瀏覽器煙霧測試（可選）：`npm install && npm run test:e2e`（手機 390px／桌面 1440px，檢查無水平捲動、主要控制項可見、可匯出 Word／MIDI）。需要本機 Chrome（可用 `CHROME_PATH`）。CI 有獨立的 `e2e` job，不影響 `npm test`。
- 改 UI 或拆檔時，除了測試，也用 Playwright 實際操作比對行為（重構 PR 的做法）。

## 5. 專案結構
| 檔案 | 用途 |
|---|---|
| `index.html`、`style.css`、`app.js` | 頁面、樣式、主程式（樂譜狀態、編輯器、試聽、匯入匯出） |
| `studio.js` → `studio-analysis.js`、`studio-word.js`、`studio-lyrics.js`、`studio-chords.js` | 錄音分析、Word 匯出面板、歌詞、和弦四個功能區 |
| `dom.js`、`mixer.js`、`score-edit.js`、`webmcp.js` | DOM 小工具、混音滑桿、移調與曲式（純函式）、WebMCP 工具 |
| `word-export.js` → `word-options.js`、`word-notation.js`、`word-docx.js` | Word：版面計算與 `wordBlob`；版式選項；簡譜記號與歌詞解析；DOCX／ZIP 底層 |
| `wording.js`、`wording-rules.js`、`gen-wording-doc.mjs` | 官方用字替換（資料驅動）與 `NOTATION_RULES.md` 對照表產生器 |
| `music.js`、`score-bridge.js`、`font-metrics.js` | 音樂理論與 MIDI、錄音／JSON 轉樂譜、01SMN 字寬表 |
| `musicxml.js` | MusicXML 4.0 匯出（單一旋律聲部、歌詞、和弦；黃金檔在 `fixtures/`） |
| `audio.js`、`audio-analysis.js`、`analysis-worker.js`、`encode-worker.js`、`lame.min.js` | 試聽與 MP3、音高與和弦分析、背景 Worker |
| `worker.js`、`wrangler.toml` | Cloudflare Worker 後端（AI 讀譜、額度防護） |

- 重構時 `word-export.js` 的公開 API 不變：其他檔案與測試仍從它匯入 `wordBlob`、`PRESETS`、`PAPERS`、`resolveOptions`、`layout`、`parseVerses` 等。
- 程式碼用 `.prettierrc.json` 的風格（單引號、寬 120）；新檔案請照此排版，不要寫超長單行。

## 6. 輸出與使用者偏好
- 輸出：**可編輯的 DOCX**＋**MP3**＋**MIDI**＋**MusicXML**＋**JSON**（儲存樂譜）。Word 由瀏覽器本機產生，不經遠端服務；只有圖片讀譜會送到後端。
- **全部繁體中文、手機友善**：390px 寬不得水平捲動，觸控目標至少 40px 高；介面要能在手機操作。
- 簡譜字型 **01SMN 是私人字型**，Word 裝置自行安裝；網頁以一般文字預覽，不內嵌字型。
- 和弦：Times New Roman、深紅 `#9C2323`，數字用 **Word 原生下標**；音符數字不可下標。
- 簡譜 01SMN 14 pt；整組詞譜置中、各行共同左緣；優先一頁，放不下正常分頁，**不縮小、不刪內容**；每個詞譜行 `keepLines`。
- 歌詞逐字對位：各節字數＝起音數，不符就**明確報錯**，不補刪、不錯配；所有文字與標點保留。
- 建議和弦、音訊和弦估計、使用者確認和弦要分開標示；單音配和弦不可說成「錄音伴奏辨識」。
- 不要改排版規則或輸出行為，**除非是明確的 bug**；規則變動要先列為「需 Isaiah 決定」。

## 7. Word 版式（`word-options.js` 的 `PRESETS`）
| 項目 | `lsm`（預設，官方標語歌） | `classic`（原版式） |
|---|---|---|
| 紙張／邊界 | US Letter 612×792 pt；左右 32.5 pt | A4；四邊 1 cm |
| 標題 | 明體 14 pt 置中 | 標楷體 22 pt 置中 |
| 調號／拍號 | 同一行，左「D大調」右「4/4」；降調「降B大調」；預設不顯示速度 | 靠右一行「1=C　4/4　♩ = 88」 |
| 節次 | ①②③…（緊貼第一字左側） | 一、二、三、 |
| 歌詞 | 預設內文整句（`lyricLayout:'inline'`，依 Isaiah 2026-10-19 指示）：標楷體 14 pt、每節一行、以定位點對準音符，阿拉伯數字 Times New Roman；舊版逐字方塊（`'boxes'`）為明體 12 pt | 預設內文整句：標楷體 14 pt（英數也用標楷體）；`'boxes'` 為標楷體 13.5 pt |
| 系統行距 | inline（預設，依 Isaiah 2026-10-19 指示）：譜行 38 pt + 每節 20 pt + 段後 5 pt，單節 63 pt、兩節 83 pt；boxes：單節約 58 pt（34 + 節數 × 19 + 段後 5 pt），每多一節 +19 pt | inline：譜行 38 pt + 每節 20 pt + 段後 15 pt，單節 73 pt、兩節 93 pt；boxes：單節約 68 pt（44 + 節數 × 19 + 段後 5 pt） |
| 頁首／頁碼 | 無 | 無 |
| 版權行 | 可選，末頁置中斜體 10 pt；預設不加 | 同 |
| 官方用字替換 | 預設開 | 預設關 |

- **官方量測不到的項目維持現狀**：01SMN 14 pt、和弦字型字級顏色與下標、音符間距。
- 紙張預設 Letter 或 A4、速度顯示、版權行等是否調整，由 Isaiah 決定。

## 8. 官方用字（只改輸出，規則在 `wording-rules.js`）
- 匯出時才替換標題與歌詞；編輯器稿、JSON、MIDI、MP3 不動。所有規則**前後等長**，逐字對位不受影響。
- 例：裡→裏、吃→喫、什麼→甚麼、預備→豫備、教會→召會、能夠→能彀、做→作、因著→因着、為著→為着、衆→眾。
- **以詞組為單位**，不做單字全域替換；「既／即」「才能（人才、天才、口才、剛才）」「嗎哪」等不可誤改；歧義一律保守不改、只提示（他→祂、其他「著」、啟示／啓示…）。
- **衝突原則**：詩歌用字與新約經文衝突時以詩歌來源（hymnal.net、北投詩歌 PDF）為準；Isaiah 明確決定依官方 PDF 的 裡→裏、因著→因着、為著→為着除外。
- 新增或修改規則：改 `wording-rules.js`，`node gen-wording-doc.mjs` 重新產生 `NOTATION_RULES.md` 表格，並在 `wording.test.js` 補誤改防護測試。

## 9. 官方引用與出處格式（輸出若涉及經文、出處時依此）
目前專案沒有經文或出處輸出；未來若新增，依 LSM 官方綱目實測：
- 出處接法：文字＋**長破折號 ─（U+2500）**＋出處＋「。」，**無空格，不用「－」**。
- 經文寫法：`太五3`、`弗三16～19`；章用中文數字（二一、二八、三二，逐位），節用阿拉伯數字；連續用「～」、不連續用「，」；半節 `十五45下`；只有節 `1，4節`；參看用「參」。
- 括號為全形、**標點在括號內**：`（帖前一1，3～4，）子拯救我們`。引號用『 』。
- 書卷簡稱：約翰福音＝約、約翰一書＝**約壹**（不是約一）；帖前、帖後、林前、林後、提前、提後、彼前、彼後等。
- 全形標點 ，。、；：？！（）『』～…〔〕；無頁首、無頁碼；末頁版權行 © 2026 Living Stream Ministry（英文斜體 10 pt，置中）。
- 官方中文字：**裏**、**着**、**祂**、**豫**定、甚**麼**、召會、綱目。

## 10. 完成前檢查
- [ ] 在新分支、已開 PR；沒有推 main、沒有合併
- [ ] `npm test` 全過；新行為與 bug 修正有測試
- [ ] 沒有 secrets、字型、音檔、歌詞、`.docx` 進 repo；`config.json` 未改
- [ ] 沒有改排版規則或輸出行為（或已明確標為需 Isaiah 決定）
- [ ] 介面文字、錯誤訊息、PR 說明皆為繁體中文；手機 390px 無水平捲動
- [ ] 改 `worker.js` 時，PR 說明提醒需另外部署
- [ ] 回報包含：PR 連結、改了什麼、測試結果、CI／Bugbot 狀態、發現但未改的問題、需要 Isaiah 決定的事
