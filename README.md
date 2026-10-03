# 譜間 · 簡譜音樂工作室

公開網址：https://isaiahovercomer.github.io/numbered-score-studio/

上傳簡譜圖片，以 AI 轉錄後核對音符、和弦及歌詞，調整速度、反覆與聲部，再試聽或輸出 MP3、MIDI、JSON。AI 辨識可能有錯誤，請核對原譜。本版支援單張 PNG/JPG/WebP；不支援 PDF、多頁、自動網頁擷取、跨小節連音及段內轉調。

前端使用瀏覽器音訊合成；AI 透過獨立 Cloudflare Worker 與站長的 OpenAI API。金鑰只存於 Cloudflare Secret，請勿提交至儲存庫。2026-10-03 已成功完成一次真實 API 讀譜；歌詞及音符仍須人工核對。

## 檔案與維護

此儲存庫採扁平目錄，網站與音色在根目錄。GitHub Settings → Pages 設為 Deploy from a branch → main → / (root)。更新檔案後自動發布。config.json 設定後端網址。

worker.js 是後端原始碼，wrangler.toml 包含環境變數與 QUOTA Durable Object migration。部署後端可執行 wrangler deploy；OPENAI_API_KEY 與 IP_HASH_SALT 必須另外設定為秘密。不可將網站 config.json 放入 API 金鑰。

執行 npm test 驗證樂譜、MIDI、後端驗證與額度邏輯；本機以 HTTP 靜態伺服器開啟 index.html。

## 使用限制

預設每來源 IP 每日 2 次、全站每日 20 次、每月 100 次，採 UTC 分界。失敗辨識也計入額度。次數限制不是金額上限。每日共用 IP 的訪客共用額度。AI 結果必須人工核對。

後端不保存圖片或辨識結果，向 OpenAI 傳送圖片以辨識並設定 store:false；不代表供應商完全不保留服務紀錄。來源以加鹽雜湊儲存計數，約 35 天清除。Origin 限制不是使用者身分驗證。

## 音色

音色與授權見 credits.txt；MP3 編碼器授權見 LAME-LICENSE。範例曲〈信的路程〉來自使用者提供的簡譜，不宣告為公有領域。
