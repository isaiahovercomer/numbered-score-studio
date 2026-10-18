// 官方用字對照表（台灣福音書房／水流職事站出版品用字習慣）。資料驅動：新增或調整規則只需改這個檔案。
//
// 規則原則（逐條有依據；無依據不加；不確定的只列入 PENDING、不自動替換）：
// 1. 以「詞組」為單位替換，不做單字全域替換；只有「異體字」（如 裡→裏、衆→眾）這種官方來源中一律不出現原字的才用單字，並於 note 註明依據。
// 2. 每條替換前後字數必須相同（一對一），因此歌詞逐字對位（字數＝起音數）不會被破壞；測試會檢查。
// 3. guards：notBefore／notAfter 是「不得替換」的前後文，用來避開本來就正確的詞（如 口吃、吃力、人才是）。
// 4. evidence：pdf、web 為「原字出現次數／官方字出現次數」。pdf 取自官方 PDF 文字層（約 1.4 萬字，折行已去除），
//    web 取自 TWGBR 網上新約恢復本全文（約 34.6 萬字）。0／N 表示官方來源只用官方寫法、從不使用原字。
//
// 注意：「既／即」不在此表。官方來源中「既然、即使、立即、即是」等本來就是這樣寫，沒有異體，不可替換（見測試的誤改防護）。
export const SOURCES = {
  pdf: {name: '水流職事站中文 PDF（綱目、特會）文字層統計', url: 'https://www.lsmchinese.org/outlines.html', files: 'S26FTT01zht、F26FTT01zht、F26FTT05zht、F26FTT07zht、S26FTT10zht、K25INC01zht（https://www.lsmwebcast.com/archives/<檔名>.pdf）'},
  web: {name: '台灣福音書房網上新約聖經恢復本全文統計', url: 'https://line.twgbr.org/recoveryversion/bible/40.html', note: '40～66 共 27 卷'},
  about: {name: '網上聖經恢復本「簡說」：盡力保留國語和合本語體', url: 'https://recoveryversion.twgbr.org/about'},
  twgbr: {name: '台灣福音書房官網（品名用「豫約」「豫備」）', url: 'https://www.twgbr.org.tw/'},
  guide: {name: '專案格式指南 A.8 用字（裏、着、祂、豫、甚麼、召會）', url: 'recovery-format-guide.md（本機文件，未納入 repo）'},
  hehe: {name: '和合本 1919 用字（喫、輭、餧、纔）說明', url: 'https://zh.wikisource.org/zh-hant/%E8%81%96%E7%B6%93_(%E5%92%8C%E5%90%88%E6%9C%AC)'},
  intro: {name: '新約恢復本簡介：教會→召會 等專有名詞', url: 'https://four.soqimp.com/books/4/4138-2.html'}
};

const SURNAME_GUARD = ['人', '天', '口', '奇', '英', '秀', '鬼', '偏', '剛', '方', '適', '全', '庸', '奴', '蠢', '幹', '文', '多', '通'];
const DENOMINATION_GUARD = ['天主', '羅馬', '東正', '基督', '聖公', '長老', '浸信', '衛理', '信義', '路德'];

// 規則順序即套用順序。conf：高＝PDF 與網頁一致且無反例；中＝來源單薄或兩種官方媒體不完全一致，仍列入自動替換並於 PR 說明。
export const AUTO_RULES = [
  {id: 'li', from: '裡', to: '裏', conf: '高', pdf: [0, 139], web: [0, 1917], src: ['pdf', 'web', 'guide'], note: '異體字：官方來源 0 次「裡」；單字替換有明確依據（裏面、在…裏、那裏皆同）'},
  {id: 'chi-jing', from: '吃驚', to: '喫驚', conf: '中', pdf: [0, 0], web: [0, 1], src: ['web', 'hehe'], note: '和合本舊寫法「喫驚」'},
  {id: 'chi', from: '吃', to: '喫', conf: '高', pdf: [0, 1], web: [0, 229], src: ['pdf', 'web', 'hehe'], note: '「吃」在官方來源 0 次；排除非「進食」詞：口吃、小吃、吃吃、吃力、吃虧、吃苦、吃香、吃醋、吃重、吃緊、吃素、吃得消（官方無用例，保持原樣）', notBefore: ['口', '小', '吃'], notAfter: ['力', '虧', '苦', '香', '醋', '重', '緊', '素', '得消', '不消', '吃']},
  {id: 'shenme', from: '什麼', to: '甚麼', conf: '高', pdf: [0, 5], web: [0, 493], src: ['pdf', 'web', 'guide']},
  {id: 'shenme2', from: '什麽', to: '甚麼', conf: '高', pdf: [0, 5], web: [0, 493], src: ['pdf', 'web', 'guide'], note: '「麽」異體寫法'},
  {id: 'yu-bei', from: '預備', to: '豫備', conf: '高', pdf: [0, 1], web: [0, 91], src: ['pdf', 'web', 'twgbr', 'guide']},
  {id: 'yu-ding', from: '預定', to: '豫定', conf: '高', pdf: [0, 2], web: [0, 10], src: ['pdf', 'web', 'guide']},
  {id: 'yu-yan', from: '預言', to: '豫言', conf: '高', pdf: [0, 2], web: [0, 31], src: ['pdf', 'web', 'guide']},
  {id: 'yu-biao', from: '預表', to: '豫表', conf: '高', pdf: [0, 1], web: [0, 3], src: ['pdf', 'web']},
  {id: 'yu-xian', from: '預先', to: '豫先', conf: '中', pdf: [0, 1], web: [0, 24], src: ['pdf', 'web']},
  {id: 'yu-fang', from: '預防', to: '豫防', conf: '中', pdf: [0, 0], web: [0, 4], src: ['web']},
  {id: 'yu-gao', from: '預告', to: '豫告', conf: '中', pdf: [0, 0], web: [0, 2], src: ['web']},
  {id: 'yu-zhi', from: '預知', to: '豫知', conf: '中', pdf: [0, 0], web: [0, 1], src: ['web']},
  {id: 'yu-yue', from: '預約', to: '豫約', conf: '中', pdf: [0, 0], web: [0, 0], src: ['twgbr'], note: '依據：台灣福音書房官網「豫約再版倪柝聲文集」'},
  {id: 'zhaohui', from: '教會', to: '召會', conf: '高', pdf: [0, 62], web: [0, 182], src: ['pdf', 'web', 'guide', 'intro'], note: '排除其他宗派／傳統名稱（天主教會、羅馬教會、基督教會等），官方亦不改動它們', notBefore: DENOMINATION_GUARD},
  {id: 'yin-zhe', from: '因著', to: '因着', conf: '中', pdf: [0, 2], web: [50, 0], src: ['pdf', 'guide'], note: '兩種官方媒體不一致：PDF 為「因着」、網頁為「因著」；Word 輸出屬印刷品，依 PDF。排除著名、著作、著稱', notAfter: ['名', '作', '稱']},
  {id: 'wei-zhe', from: '為著', to: '為着', conf: '中', pdf: [0, 1], web: [84, 0], src: ['pdf', 'guide'], note: '同上（PDF「為着」、網頁「為著」）；排除著名、著作、著稱', notAfter: ['名', '作', '稱']},
  {id: 'cai-ke', from: '才可', to: '纔可', conf: '中', pdf: [0, 0], web: [0, 8], src: ['web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-shi', from: '才是', to: '纔是', conf: '高', pdf: [0, 1], web: [0, 7], src: ['pdf', 'web', 'hehe'], note: '「纔」表「方始」；排除人才、天才、口才、剛才等詞中的「才」', notBefore: SURNAME_GUARD},
  {id: 'cai-suan', from: '才算', to: '纔算', conf: '中', pdf: [0, 0], web: [0, 4], src: ['web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-you', from: '才有', to: '纔有', conf: '高', pdf: [0, 2], web: [0, 4], src: ['pdf', 'web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-de', from: '才得', to: '纔得', conf: '中', pdf: [0, 0], web: [0, 4], src: ['web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-hao', from: '才好', to: '纔好', conf: '中', pdf: [0, 0], web: [0, 4], src: ['web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-yong', from: '才用', to: '纔用', conf: '中', pdf: [0, 0], web: [0, 3], src: ['web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-ba', from: '才把', to: '纔把', conf: '中', pdf: [0, 0], web: [0, 3], src: ['web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-ling', from: '才領', to: '纔領', conf: '中', pdf: [0, 0], web: [0, 2], src: ['web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-yao', from: '才要', to: '纔要', conf: '中', pdf: [0, 0], web: [0, 2], src: ['web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-hui', from: '才會', to: '纔會', conf: '中', pdf: [0, 1], web: [0, 0], src: ['pdf', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'neng-gou', from: '能夠', to: '能彀', conf: '高', pdf: [0, 2], web: [0, 2], src: ['pdf', 'web', 'hehe']},
  {id: 'bu-gou', from: '不夠', to: '不彀', conf: '中', pdf: [0, 0], web: [0, 3], src: ['web', 'hehe']},
  {id: 'gou-le', from: '夠了', to: '彀了', conf: '中', pdf: [0, 0], web: [0, 6], src: ['web', 'hehe']},
  {id: 'gou-yong', from: '夠用', to: '彀用', conf: '中', pdf: [0, 0], web: [0, 1], src: ['web', 'hehe']},
  {id: 'gou-zige', from: '夠資格', to: '彀資格', conf: '中', pdf: [0, 0], web: [0, 5], src: ['web', 'hehe']},
  {id: 'wei-yang', from: '餵養', to: '餧養', conf: '高', pdf: [0, 4], web: [0, 7], src: ['pdf', 'web', 'hehe']},
  {id: 'zu-zhou', from: '詛咒', to: '咒詛', conf: '高', pdf: [0, 9], web: [0, 22], src: ['pdf', 'web']},
  {id: 'tan-xi', from: '嘆息', to: '歎息', conf: '高', pdf: [0, 1], web: [0, 10], src: ['pdf', 'web']},
  {id: 'wei-yi', from: '唯一', to: '惟一', conf: '高', pdf: [0, 2], web: [0, 1], src: ['pdf', 'web'], note: '只換「唯一」；「唯美、唯物」等其他「唯」詞無依據，不動'},
  {id: 'wei-you', from: '唯有', to: '惟有', conf: '高', pdf: [0, 4], web: [0, 38], src: ['pdf', 'web']},
  {id: 'wei-du', from: '唯獨', to: '惟獨', conf: '中', pdf: [0, 0], web: [0, 24], src: ['web']},
  {id: 'wei-kong', from: '唯恐', to: '惟恐', conf: '中', pdf: [0, 0], web: [0, 3], src: ['web']},
  {id: 'ao-mi', from: '奧秘', to: '奧祕', conf: '高', pdf: [0, 1], web: [0, 42], src: ['pdf', 'web']},
  {id: 'mi-jue', from: '秘訣', to: '祕訣', conf: '高', pdf: [0, 1], web: [0, 3], src: ['pdf', 'web']},
  {id: 'mi-mi', from: '秘密', to: '祕密', conf: '中', pdf: [0, 0], web: [0, 1], src: ['web']},
  {id: 'zhong', from: '衆', to: '眾', conf: '高', pdf: [0, 2], web: [0, 614], src: ['pdf', 'web'], note: '異體字：官方來源 0 次「衆」'}
];

// 待確認：官方來源彼此不一致、只在聖經經文出現、或無法由字面判斷；只提醒、不自動替換。
// pattern 以字串列表比對（任一出現即提示）。
export const PENDING = [
  {id: 'ta', match: ['他'], message: '若「他」指神或主，官方寫「祂」（需人工判斷，不自動替換）', basis: 'PDF 祂 113 次、指人的「他」41 次；同一字形需看語意'},
  {id: 'zhe', match: ['著'], message: '「著」若為助詞，官方 PDF 寫「着」、網頁寫「著」，兩者不一致，除「因著、為著」外待確認（顯著、著作等不改）', basis: 'PDF 着 3、著 0；網頁 著 1578、着 0'},
  {id: 'cai-neng', match: ['才能'], message: '「才能」若表「方始可以」，官方寫「纔能」；若表才幹則不改（需人工判斷）', basis: 'PDF 纔能 1、網頁 纔能 7，兩者皆未見才幹義的「才能」'},
  {id: 'zuo', match: ['做'], message: '官方一律寫「作」（作事、作工、作王；PDF 做 0／作 68，網頁 做 0／作 837），但「做」用法廣，待確認後再自動替換', basis: 'PDF 與網頁一致，惟需決定是否全面改'},
  {id: 'ma', match: ['嗎'], message: '疑問語氣詞官方經文寫「麼」（豈不是…麼？；網頁 嗎 僅見於「嗎哪」），印刷出版品未驗證，待確認', basis: '網頁 麼 962（含甚麼 493）；PDF 嗎 0'},
  {id: 'yu-other', match: ['預期', '預算', '預計', '預料', '預測', '預設', '預覽', '預習', '預感', '預兆', '預見'], message: '「預」字的其他詞官方似寫「豫」（豫備、豫言、豫約皆是），但這些詞官方來源未見用例，待確認', basis: '官方來源 預 0 次；其他詞無用例'},
  {id: 'qi-shi', match: ['啓示', '啟示'], message: '「啟示／啓示」兩種官方媒體不一致（PDF 啟示 12、網頁 啓示 57），待確認', basis: 'PDF 啟 vs 網頁 啓'},
  {id: 'old-orth', match: ['軟弱', '耽延', '毀謗', '大衛', '燈台', '群眾'], message: '和合本舊字（輭弱、躭延、譭謗、大衞、燈臺、羣眾）只見於網頁聖經經文；PDF 實見「軟弱」，印刷用字待確認', basis: '網頁 輭弱 51、躭延 9、譭謗 28、大衞 65、燈臺 13、羣眾 167；PDF 軟弱 1'},
  {id: 'prophet', match: ['先知'], message: '恢復本專有名詞「先知」寫「申言者」（網頁 申言者 169），歌詞用語需人工判斷', basis: '新約恢復本術語；非字形差異'}
];

export const CONFIDENCE_NOTE = '高＝PDF 與網頁一致且無反例；中＝僅單一來源或兩種官方媒體不完全一致，仍列入自動替換並於 PR 說明；待確認＝列在 PENDING，只提醒。';
