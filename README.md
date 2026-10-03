# 譜間 · 簡譜音樂工作室

繁體中文的簡譜編曲工作區。前端直接在瀏覽器合成取樣樂器與 MP3，不需要訪客提供 API 金鑰。

## 目前功能

- 編輯簡譜、和絃、速度、拍號、移調、反覆次數與最後副歌。
- 鋼琴單音、柱式伴奏、分解和絃、鋼琴＋大提琴＋弦樂＋長笛。
- 五聲部音量、前八小節試聽、完整 MP3、MIDI、樂譜 JSON 匯入匯出。
- 本機圖片預覽；接上後端後可 AI 讀譜。辨識須人工核對，不保證光學樂譜辨識完全正確。
- 相容先前 numbered-score-audio 的基本樂譜格式。此版尚不處理 PDF、多頁、網頁擷取、跨小節連音、段內轉調及任意 extra_events；有這些需求時先用原 skill 轉錄並整理。

## 在 GitHub Pages 發布

1. 新建 public 儲存庫 `numbered-score-studio`，可勾選 README。
2. 將本目錄的**內容**放在儲存庫根目錄：`site/`、`backend/`、`.github/`、`package.json` 等；不是把整個資料夾再包一層。
3. 儲存庫 Settings → Pages → Source 選 **GitHub Actions**。
4. 在 Actions 執行 **Publish music studio**，或推送到 `main`。工作流程會先執行測試，再發布 `site/`。
5. 完成後網址為 `https://你的帳號.github.io/numbered-score-studio/`。網站所有資源採相對網址，可部署到專案子路徑。

## 啟用網站統一提供的 AI 讀譜

GitHub Pages 是靜態主機，不能安全保存 API 金鑰。`backend/` 是獨立的 Cloudflare Worker，透過 OpenAI Responses API 讀圖；需站長自己的 OpenAI API 與 Cloudflare 帳號，費用不包含在 ChatGPT 訂閱內。未設定時前端明確顯示「AI 讀譜尚未啟用」，其他功能仍可使用。

1. 在自己的 OpenAI API 專案設定帳務與預算提示。不要把金鑰貼進聊天、前端檔案或 GitHub。
2. 安裝官方 Cloudflare Wrangler，登入自己的 Cloudflare 帳號。
3. 編輯 `backend/wrangler.toml` 的 `ALLOWED_ORIGIN`，填網站 origin（例如 `https://isaiahovercomer.github.io`，不要附儲存庫路徑）。確認模型有權使用；預設 `gpt-4.1`。
4. 在 `backend` 目錄執行 `npx wrangler secret put OPENAI_API_KEY`，透過終端機提示安全輸入金鑰；再用 `npx wrangler secret put IP_HASH_SALT` 輸入一段隨機長字串。
5. `npx wrangler deploy` 發布後端。若 Cloudflare 要求開通或付費，先確認方案費用再繼續。
6. 將後端網址加上 `/recognize` 填入 `site/config.json` 的 `recognitionEndpoint`，提交即可更新前端。
7. 用有權使用的簡短清楚圖片測試。此套件只做過後端模擬測試，未使用真實金鑰完成線上 AI 驗證。

使用量採 Durable Object 交易原子計數，預設每來源 IP 每日 2 次、全站每日 20 次、每月 100 次（UTC 分界），失敗嘗試也計入。這限制請求數，**不是金額保證**；單次最多 6 MB 圖片與 12,000 輸出 tokens。站長仍應在供應商帳務端監控費用。以 Origin 限制瀏覽器來源，但它不是身分驗證；大量或惡意公開使用建議加入 Turnstile 或登入。全站總限額會限制被濫用時的請求數。

後端不保存圖片、歌詞與模型回答；`store:false` 用於 OpenAI 請求，不代表供應商完全不保留任何服務紀錄。用量記錄只保存加鹽雜湊來源和計數，約 35 天後清除。部署前請依實際服務政策更新隱私說明。

## 本機開發與測試

```text
python -m http.server 8765 --directory site
npm test
```

開啟 `http://localhost:8765`，不要直接雙擊 HTML（模組、樣本和 Web Worker 需要 HTTP）。不需要安裝前端 npm 套件。瀏覽器需支援 Web Audio、AudioWorklet 以外的 OfflineAudioContext、Web Worker；長音檔會使用較多記憶體，上限 10 分鐘，行動裝置建議較短樂段。

## 音色與署名

見 `site/credits.txt`。音色是 CC BY 3.0；MP3 編碼器是分離載入、未修改的 lamejs/LAME（LGPL）。下載音樂再散布時請保留必要音色署名。範例曲來自使用者提供的〈信的路程〉簡譜；不將它宣告為公有領域。網站不會連接或自動操作 Suno。
