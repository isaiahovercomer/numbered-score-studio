# 譜間 · 簡譜音樂工作室

公開網址：https://isaiahovercomer.github.io/numbered-score-studio/

上傳簡譜圖片，以 AI 轉錄後核對音符、和弦及歌詞，調整速度、反覆與聲部，再試聽或輸出 MP3、MIDI、JSON。AI 辨識可能有錯誤，請核對原譜。本版支援單張 PNG/JPG/WebP；不支援 PDF、多頁、自動網頁擷取、跨小節連音及段內轉調。

前端使用瀏覽器音訊合成；AI 透過獨立 Cloudflare Worker 與站長的 OpenAI API。金鑰只存於 Cloudflare Secret，請勿提交至儲存庫。2026-10-03 已成功完成一次真實 API 讀譜；歌詞及音符仍須人工核對。

## 檔案與維護

此儲存庫採扁平目錄，網站與音色在根目錄。GitHub Settings → Pages 設為 Deploy from a branch → main → / (root)。更新檔案後自動發布。config.json 設定後端網址。

worker.js 是後端原始碼，wrangler.toml 包含環境變數與 QUOTA Durable Object migration。部署後端可執行 wrangler deploy；OPENAI_API_KEY 與 IP_HASH_SALT 必須另外設定為秘密。不可將網站 config.json 放入 API 金鑰。

執行 npm test 驗證樂譜、MIDI、後端驗證與額度邏輯；本機以 HTTP 靜態伺服器開啟 index.html。

## 使用限制

預設每來源每日 2 次、全站每日 20 次、每月 100 次，採 UTC 分界。IPv4 以完整位址計算；IPv6 以 /64 前綴合併計算。失敗辨識也計入額度。次數限制不是金額上限。每日共用 IP 的訪客共用額度。AI 結果必須人工核對。

後端不保存圖片或辨識結果，向 OpenAI 傳送圖片以辨識並設定 store:false；不代表供應商完全不保留服務紀錄。來源位址以 IP_HASH_SALT 為金鑰做 HMAC-SHA256 後儲存計數，約 35 天清除。Origin 限制不是使用者身分驗證。

## 音色

音色與授權見 credits.txt；MP3 編碼器授權見 LAME-LICENSE。範例曲〈信的路程〉來自使用者提供的簡譜，不宣告為公有領域。

## 2026-10-03 v2 本機轉譜與 Word

新增三種來源入口（錄音／譜圖／JSON），歌詞 TXT 匯入、每節字數檢查、技能資料銜接、可編輯 DOCX 匯出及適合手機的介面。

- 單音 MP3/WAV/M4A：Web Audio 解碼、降採樣至 8 kHz，Web Worker 執行自相關音高與起音分析。上限 20 MB／3 分鐘，暫按 4/4 與八分音符格線；調性、速度及弱起可指定。這是實驗性辨識，並非完整歌曲自動採譜。
- 伴奏和弦：本機頻譜 chroma 樣板估計（大／小／屬七），可下載秒數時間表；確認同調同速及譜面起點後才套入。**不是 Chordino**，不處理反覆或自由速度的自動對位。
- 建議和弦：針對空白小節依旋律配上調內候選，與音訊和弦估計分開標示；不覆蓋已有和弦。
- Word：直接產生 OOXML ZIP，不用遠端服務。原生可編輯 01SMN 文字、標楷體、深紅 Times New Roman 和弦與原生數字下標。一般資料依字寬排版；未改寫的技能 `systems` 參考資料會保留既有記譜、歌詞對位、短弧及跨小節延音，並整組置中。
- 歌詞：中文以一字一音為主、各節以空行分隔。字數不符時明確停止，不任意補刪或錯配。英文分詞及自由一字多音尚不支援。
- Word 輸出書寫段落各一次，不展開演奏 form 的全曲反覆。請在下載後依實際字型檢查頁數；長譜正常分頁，不裁切。
- 不在公開網站散布 01SMN 字型。使用者在 Word 裝置自行安裝 01SMN 與標楷體。瀏覽器編輯器以一般文字音符顯示。

目前不需新增 API key 或後端；既有圖片 AI 服務設定與限額保持原樣。僅圖片讀譜會送到既有服務，新的音訊分析和 Word 產生均在本機。程式只保留當前頁面的資料，離開前請「儲存樂譜」。

排版偏好見 `NOTATION_RULES.md`。測試包含合成音高／和弦、連結延音、小節內和弦時點、歌詞字數、DOCX 原生下標與 XML escaping。另以私人歌曲實際測試 Chromium 390px／1440px、錄音解碼到 Word 下載、五節詞譜一頁渲染；私人音檔、歌詞與字型不納入 repository。

## 測試與 CI

`npm test` 另含 `wording.test.js`（官方用字規則的資料一致性、誤改防護、只改輸出不改原稿、逐字對位不變）與 `word-layout.test.js`（鎖定兩種 Word 版式：原版式 classic 的 A4、標楷體 22pt／01SMN 14pt／歌詞 13.5pt，以及預設的水流職事站官方版式 lsm 的 Letter、32.5 pt 邊界、①②③ 節次、調號左拍號右、版權行；兩者共通的深紅 #9C2323 和弦與原生下標、DOCX 封包完整性）與 `repo-hygiene.test.js`（確認儲存庫沒有字型、私人音檔、歌詞、金鑰，`.gitignore` 與 config.json 符合規範）。`.github/workflows/test.yml` 會在每個 pull request 與推送到 main 時自動執行 `npm test`；工作流程不使用任何 secret。

### 更多測試與開發規則

`word-edge.test.js` 鎖定高風險邊界（特殊字元、空輸入、多節、超出一頁、和弦靠近），`golden-docx.test.js` 以位元組比對確保重構不改變 DOCX 輸出（刻意改版時用 `UPDATE_GOLDEN=1 npm test` 更新）。另有可選的瀏覽器煙霧測試：`npm install && npm run test:e2e`（Playwright，手機 390px／桌面 1440px，需要本機 Chrome；CI 有獨立 job，不影響 `npm test`）。專案的工作規則、檔案結構與官方格式標準匯總在 `AGENTS.md`。

## Word 版式（水流職事站官方 ／ 原版式）

匯出 Word 前可在「Word 版式」選單選擇：預設為水流職事站官方標語歌版式（US Letter、32.5 pt 邊界、明體、①②③ 節次、左「D大調」右「4/4」、不顯示速度、可選末頁版權行）；也可切回原版式（A4、標楷體、一、二、三、），或個別覆寫紙張、節次樣式、是否顯示速度。完整對照見 `NOTATION_RULES.md`。程式介面：`wordBlob(score, {preset, paper, verseMarks, tempo, copyright, wording})`。

### 官方用字（匯出時自動套用）

「匯出時套用官方用字」開關會在 Word 輸出時把標題與歌詞改成台灣福音書房／水流職事站的用字，例如 吃→喫、什麼→甚麼、預備→豫備、教會→召會、能夠→能彀、唯一→惟一、做→作。lsm 版式預設開啟，classic 版式預設關閉，可隨時切換。**只改輸出**：編輯器裡的歌詞稿、JSON、MIDI 都不會被改，狀態列會列出替換了哪些詞。

規則在 `wording-rules.js`（資料驅動，一條規則一個詞組，標明依據來源、官方綱目 PDF、網上新約恢復本、hymnal.net 詩歌與北投詩歌 PDF 的出現次數、信心度與不替換的前後文）。**詩歌用字與新約經文衝突時以詩歌為準**：詩歌多半不用的和合本舊字（輭、躭、譭、羣、大衞）不替換。唯一例外是依 Isaiah 的決定、以官方綱目 PDF 為準的「裡→裏」「因著→因着」「為著→為着」：詩歌其實多寫「裡」「著」，但仍預設替換（lsm 版式；classic 版式整體預設關閉，可手動開啟）。已沒有「詩歌爭議」項，因此沒有爭議用字開關。「既／即」等本來就正確的字不會被動；歧義處一律保守不改、只提示：「才能」排除人才、天才、口才、剛才等詞（人才能興起不會被改）與才幹義，「嗎」只換句末後接標點者（是什麼嗎、這嗎、嗎哪不動）；狀態列的替換次數不重複計算 notationLayout 匯入的音節，已替換的因著、為著也不會再被列為待確認。無法由字面判斷的項目（他／祂、其他「著」、啟示／啓示…）只提醒、不替換。完整對照表與來源見 `NOTATION_RULES.md`「官方用字」（由 `node gen-wording-doc.mjs` 依規則表產生，測試會檢查兩者同步）。調整規則只需改 `wording-rules.js`、重跑產生器並在 `wording.test.js` 補測試。
