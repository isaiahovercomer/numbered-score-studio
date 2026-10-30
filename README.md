# 譜間 · 簡譜音樂工作室

公開網址：https://isaiahovercomer.github.io/numbered-score-studio/

上傳簡譜圖片，以 AI 轉錄後核對音符、和弦及歌詞，調整速度、反覆與聲部，再試聽或輸出 MP3、MIDI、JSON、MusicXML。AI 辨識可能有錯誤，請核對原譜。本版支援單張 PNG/JPG/WebP；不支援 PDF、多頁、自動網頁擷取、跨小節連音及段內轉調。

前端使用瀏覽器音訊合成；AI 透過獨立 Cloudflare Worker 與站長的 OpenAI API。金鑰只存於 Cloudflare Secret，請勿提交至儲存庫。2026-10-03 已成功完成一次真實 API 讀譜；歌詞及音符仍須人工核對。

## 原始碼與發佈

原始碼、測試、CI 與文件已移到私人倉庫 `numbered-score-studio-src`；這個公開倉庫只保留網站檔。
網站由 `gh-pages` 分支發佈（Settings → Pages → Deploy from a branch → gh-pages → / (root)），請勿直接修改。
`main` 分支只是網站檔的快照；較早的提交仍保留完整歷史。

## 使用限制

預設每來源每日 2 次、全站每日 20 次、每月 100 次，採 UTC 分界。IPv4 以完整位址計算；IPv6 以 /64 前綴合併計算。失敗辨識也計入額度。次數限制不是金額上限。每日共用 IP 的訪客共用額度。AI 結果必須人工核對。

後端不保存圖片或辨識結果，向 OpenAI 傳送圖片以辨識並設定 store:false；不代表供應商完全不保留服務紀錄。來源位址以 IP_HASH_SALT 為金鑰做 HMAC-SHA256 後儲存計數，約 35 天清除。Origin 限制不是使用者身分驗證。
