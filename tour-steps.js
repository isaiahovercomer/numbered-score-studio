// 新功能導覽：增加版本號，新增 since 同版本的步驟；既有訪客只會看到新增步驟。
export const TOUR_VERSION = 4;
export const TOUR_KEY = 'numbered-score-studio.tour-version';
export const TOUR_STEPS = [
  {since: 1, target: '.source-tabs', title: '先選擇你的創作來源',
    text: '錄音可分析單音旋律或估計伴奏和弦；譜圖可供對照與 AI 讀譜；資料可匯入已保存的 JSON。辨識後仍要逐小節校對。'},
  {since: 1, target: '.song-settings', title: '設定曲名、調性與速度',
    text: '在這裡設定曲名、拍號與 BPM。修改調性會移調樂譜；請先確認錄音原調與想輸出的調性。'},
  {since: 1, target: '.measures .measure', title: '逐小節核對音符與和弦',
    text: '音符用空格分開，例如 1 2 3；1:0.5 是半拍。和弦可用 C7@2 指定拍點。右邊的拍數可幫助檢查小節是否完整。'},
  {since: 1, target: '#lyrics', title: '加入歌詞與節次',
    text: '直接貼上歌詞，或匯入 TXT。每節之間空一行，可加一、二、三；下方會檢查歌詞字數與旋律起音是否相符。'},
  {since: 1, target: '.project-tools', title: '保留靈感，也能回到舊版本',
    text: '有效詞譜會自動儲存於此瀏覽器。復原／重做可退回修改；保留版本最多存 20 份。請定期下載 JSON，換裝置時也能接續。'},
  {since: 1, target: '#exportWord', title: '下載可編輯的 Word 詞譜',
    text: '展開上方「Word 版式」可選紙張與歌詞排法，再下載 Word。請在開啟 Word 的裝置安裝 01SMN 與標楷體；長譜會自動分頁。'},
  {since: 1, target: '#preview', title: '先試聽，再帶走完整作品',
    text: '先聽前 8 小節確認旋律與編曲，再產生完整 MP3。下方也能下載 MIDI、MusicXML 和 JSON。隨時可從頁首「使用教學」重看。'},
  {since: 2, target: '#appTools', title: '把譜間放到手機主畫面',
    text: '點「加入主畫面」開啟安裝或查看步驟。手機底部可切換匯入、校對、匯出；看到「可離線使用」後，沒有網路也能開啟詞譜、修改並下載 Word。'},
  {since: 3, target: '#barGuide', title: '點小節號，聽原錄音',
    text: '選取錄音後，點校對區左邊的小節號即可對聽。在「小節對聽」設定前奏起點、段落遍次，或循環同一小節。'},
  {since: 4, target: '#reviewGuide', title: '記下待校對的小節',
    text: '先點小節號或音符欄，在清單選音高、拍數、和弦或歌詞。點清單項目即可跳回，改好按「完成」。遇到間奏，可在「小節對聽」設定本段本遍的錄音起點。'}
];
export function tourSteps(seen, version = TOUR_VERSION, steps = TOUR_STEPS) {
  const previous = Number.isInteger(seen) && seen >= 0 ? seen : 0;
  return previous >= version ? [] : steps.filter(step => step.since > previous && step.since <= version);
}
export function readTourVersion(storage) {
  try {
    const value = Number(storage.getItem(TOUR_KEY));
    return Number.isInteger(value) && value >= 0 ? value : 0;
  } catch { return 0; }
}
