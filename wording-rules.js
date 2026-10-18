// 官方用字對照表（台灣福音書房／水流職事站出版品用字習慣）。資料驅動：新增或調整規則只需改這個檔案。
//
// 規則原則（逐條有依據；無依據不加；不確定的只列入 PENDING、不自動替換）：
// 1. 以「詞組」為單位替換，不做單字全域替換；只有「異體字」（如 裡→裏、衆→眾）這種官方來源中一律不出現原字的才用單字，並於 note 註明依據。
// 2. 每條替換前後字數必須相同（一對一），因此歌詞逐字對位（字數＝起音數）不會被破壞；測試會檢查。
// 3. guards：notBefore／notAfter 是「不得替換」的前後文，用來避開本來就正確的詞（如 口吃、吃力、人才是）。
// 4. evidence：pdf、web 為「原字出現次數／官方字出現次數」。pdf 取自官方 PDF 文字層（約 1.4 萬字，折行已去除），
//    web 取自 TWGBR 網上新約恢復本全文（約 34.6 萬字）。0／N 表示官方來源只用官方寫法、從不使用原字。
//
// 詩歌證據：hn＝hymnal.net 詩歌（大本＋補充本）、ft＝北投詩歌 PDF 抽樣，格式同為「原字／官方字」。
// 衝突處理：詩歌用字與新約網頁經文衝突時，詩歌輸出以詩歌來源為準——因此「詩歌多半不用」的舊字（輭、躭、譭、羣、大衞、啓…）不替換。
// 唯一例外是使用者（Isaiah）明確決定「依官方 PDF」的三條：裡→裏、因著→因着、為著→為着。詩歌多寫「裡」「著」，
// 但仍預設替換；證據（hn、ft 次數）如實列在規則中，備註已註明。
//
// 注意：「既／即」不在此表。官方來源中「既然、即使、立即、即是」等本來就是這樣寫，沒有異體，不可替換（見測試的誤改防護）。
export const SOURCES = {
  pdf: {name: '水流職事站中文 PDF（綱目、特會）文字層統計', url: 'https://www.lsmchinese.org/outlines.html', files: 'S26FTT01zht、F26FTT01zht、F26FTT05zht、F26FTT07zht、S26FTT10zht、K25INC01zht（https://www.lsmwebcast.com/archives/<檔名>.pdf）'},
  web: {name: '台灣福音書房網上新約聖經恢復本全文統計', url: 'https://line.twgbr.org/recoveryversion/bible/40.html', note: '40～66 共 27 卷'},
  about: {name: '網上聖經恢復本「簡說」：盡力保留國語和合本語體', url: 'https://recoveryversion.twgbr.org/about'},
  twgbr: {name: '台灣福音書房官網（品名用「豫約」「豫備」）', url: 'https://www.twgbr.org.tw/'},
  guide: {name: '專案格式指南 A.8 用字（裏、着、祂、豫、甚麼、召會）', url: 'recovery-format-guide.md（本機文件，未納入 repo）'},
  hehe: {name: '和合本 1919 用字（喫、輭、餧、纔）說明', url: 'https://zh.wikisource.org/zh-hant/%E8%81%96%E7%B6%93_(%E5%92%8C%E5%90%88%E6%9C%AC)'},
  hymnal: {name: 'hymnal.net 中文詩歌 1–780 與中文補充本 1–513 歌詞用字統計（只統計用字，不存歌詞）', url: 'https://www.hymnal.net/zh/hymn/ch/9', note: '兩本約 32.4 萬字；北投網站 HTML 歌詞（大本約 780 首、補充本約 490 首，約 41 萬字）與其高度一致，不另列'},
  ft: {name: '「北投活水湧流」（湧流北投 flowingstream.org）詩歌 PDF 抽樣 291 首（大本約 129、補充本約 97、其他約 65）文字層統計', url: 'https://flowingstream.org/hymns/', note: '約 10.3 萬字；PDF 範例 https://flowingstream.org/wp-content/uploads/2020/05/Hymn_大本詩歌001頌讚三一神－祂的計劃.pdf'},
  intro: {name: '新約恢復本簡介：教會→召會 等專有名詞', url: 'https://four.soqimp.com/books/4/4138-2.html'}
};

const SURNAME_GUARD = ['人', '天', '口', '奇', '英', '秀', '鬼', '偏', '剛', '方', '適', '全', '庸', '奴', '蠢', '幹', '文', '多', '通'];
const DENOMINATION_GUARD = ['天主', '羅馬', '東正', '基督', '聖公', '長老', '浸信', '衛理', '信義', '路德'];

// 規則順序即套用順序。conf：高＝PDF 與網頁一致且無反例；中＝來源單薄或兩種官方媒體不完全一致，仍列入自動替換並於 PR 說明。
export const AUTO_RULES = [
  {id: 'li', from: '裡', to: '裏', conf: '高', pdf: [0, 139], web: [0, 1917], hn: [1134, 263], ft: [143, 87], src: ['pdf', 'web', 'guide'], note: '綱目與經文 0 次「裡」；但詩歌多寫「裡」（hn 1134／263、ft 143／87）。依使用者決定以官方 PDF 為準，預設替換；單字替換'},
  {id: 'chi-jing', from: '吃驚', to: '喫驚', conf: '中', pdf: [0, 0], web: [0, 1], hn: [0, 0], ft: [0, 0], src: ['web', 'hehe'], note: '和合本舊寫法「喫驚」'},
  {id: 'chi', from: '吃', to: '喫', conf: '高', pdf: [0, 1], web: [0, 229], hn: [3, 153], ft: [1, 27], src: ['pdf', 'web', 'hehe'], note: '「吃」在官方來源 0 次；排除非「進食」詞：口吃、小吃、吃吃、吃力、吃虧、吃苦、吃香、吃醋、吃重、吃緊、吃素、吃得消（官方無用例，保持原樣）', notBefore: ['口', '小', '吃'], notAfter: ['力', '虧', '苦', '香', '醋', '重', '緊', '素', '得消', '不消', '吃']},
  {id: 'shenme', from: '什麼', to: '甚麼', conf: '高', pdf: [0, 5], web: [0, 493], hn: [0, 61], ft: [0, 10], src: ['pdf', 'web', 'guide']},
  {id: 'shenme2', from: '什麽', to: '甚麼', conf: '高', pdf: [0, 5], web: [0, 493], hn: [0, 61], ft: [3, 10], src: ['pdf', 'web', 'guide'], note: '「麽」異體寫法'},
  {id: 'yu-bei', from: '預備', to: '豫備', conf: '高', pdf: [0, 1], web: [0, 91], hn: [0, 59], ft: [3, 19], src: ['pdf', 'web', 'twgbr', 'guide']},
  {id: 'yu-ding', from: '預定', to: '豫定', conf: '高', pdf: [0, 2], web: [0, 10], hn: [0, 14], ft: [0, 1], src: ['pdf', 'web', 'guide']},
  {id: 'yu-yan', from: '預言', to: '豫言', conf: '高', pdf: [0, 2], web: [0, 31], hn: [0, 2], ft: [0, 1], src: ['pdf', 'web', 'guide']},
  {id: 'yu-biao', from: '預表', to: '豫表', conf: '高', pdf: [0, 1], web: [0, 3], hn: [0, 14], ft: [0, 8], src: ['pdf', 'web']},
  {id: 'yu-xian', from: '預先', to: '豫先', conf: '中', pdf: [0, 1], web: [0, 24], hn: [0, 0], ft: [0, 0], src: ['pdf', 'web']},
  {id: 'yu-fang', from: '預防', to: '豫防', conf: '中', pdf: [0, 0], web: [0, 4], hn: [0, 0], ft: [0, 0], src: ['web']},
  {id: 'yu-gao', from: '預告', to: '豫告', conf: '中', pdf: [0, 0], web: [0, 2], hn: [0, 0], ft: [0, 0], src: ['web']},
  {id: 'yu-zhi', from: '預知', to: '豫知', conf: '中', pdf: [0, 0], web: [0, 1], hn: [0, 3], ft: [0, 0], src: ['web']},
  {id: 'yu-yue', from: '預約', to: '豫約', conf: '中', pdf: [0, 0], web: [0, 0], hn: [0, 0], ft: [0, 0], src: ['twgbr'], note: '依據：台灣福音書房官網「豫約再版倪柝聲文集」'},
  {id: 'zhaohui', from: '教會', to: '召會', conf: '高', pdf: [0, 62], web: [0, 182], hn: [1, 536], ft: [1, 123], src: ['pdf', 'web', 'guide', 'intro'], note: '排除其他宗派／傳統名稱（天主教會、羅馬教會、基督教會等），官方亦不改動它們', notBefore: DENOMINATION_GUARD},
  {id: 'yin-zhe', from: '因著', to: '因着', conf: '中', pdf: [0, 2], web: [50, 0], hn: [31, 0], ft: [12, 0], src: ['pdf', 'guide'], note: '官方 PDF 寫「因着」、網頁寫「因著」；詩歌一律寫「著」（hn 31／0、ft 12／0）。依使用者決定以官方 PDF 為準，預設替換。排除著名、著作、著稱', notAfter: ['名', '作', '稱']},
  {id: 'wei-zhe', from: '為著', to: '為着', conf: '中', pdf: [0, 1], web: [84, 0], hn: [155, 0], ft: [32, 0], src: ['pdf', 'guide'], note: '同上（PDF「為着」、網頁「為著」、詩歌「著」hn 155／0、ft 32／0；依使用者決定以官方 PDF 為準）；排除著名、著作、著稱', notAfter: ['名', '作', '稱']},
  {id: 'cai-ke', from: '才可', to: '纔可', conf: '中', pdf: [0, 0], web: [0, 8], hn: [0, 6], ft: [0, 0], src: ['web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-shi', from: '才是', to: '纔是', conf: '高', pdf: [0, 1], web: [0, 7], hn: [0, 27], ft: [1, 2], src: ['pdf', 'web', 'hehe'], note: '「纔」表「方始」；排除人才、天才、口才、剛才等詞中的「才」', notBefore: SURNAME_GUARD},
  {id: 'cai-suan', from: '才算', to: '纔算', conf: '中', pdf: [0, 0], web: [0, 4], hn: [0, 2], ft: [0, 1], src: ['web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-you', from: '才有', to: '纔有', conf: '高', pdf: [0, 2], web: [0, 4], hn: [0, 10], ft: [0, 1], src: ['pdf', 'web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-de', from: '才得', to: '纔得', conf: '中', pdf: [0, 0], web: [0, 4], hn: [0, 11], ft: [0, 1], src: ['web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-hao', from: '才好', to: '纔好', conf: '中', pdf: [0, 0], web: [0, 4], hn: [0, 1], ft: [0, 0], src: ['web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-yong', from: '才用', to: '纔用', conf: '中', pdf: [0, 0], web: [0, 3], hn: [0, 0], ft: [0, 0], src: ['web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-ba', from: '才把', to: '纔把', conf: '中', pdf: [0, 0], web: [0, 3], hn: [0, 0], ft: [0, 0], src: ['web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-ling', from: '才領', to: '纔領', conf: '中', pdf: [0, 0], web: [0, 2], hn: [0, 0], ft: [0, 0], src: ['web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-yao', from: '才要', to: '纔要', conf: '中', pdf: [0, 0], web: [0, 2], hn: [0, 0], ft: [0, 0], src: ['web', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'cai-hui', from: '才會', to: '纔會', conf: '中', pdf: [0, 1], web: [0, 0], hn: [0, 17], ft: [0, 0], src: ['pdf', 'hehe'], notBefore: SURNAME_GUARD},
  {id: 'neng-gou', from: '能夠', to: '能彀', conf: '高', pdf: [0, 2], web: [0, 2], hn: [0, 35], ft: [3, 9], src: ['pdf', 'web', 'hehe']},
  {id: 'bu-gou', from: '不夠', to: '不彀', conf: '中', pdf: [0, 0], web: [0, 3], hn: [0, 7], ft: [0, 0], src: ['web', 'hehe']},
  {id: 'gou-le', from: '夠了', to: '彀了', conf: '中', pdf: [0, 0], web: [0, 6], hn: [0, 8], ft: [0, 0], src: ['web', 'hehe']},
  {id: 'gou-yong', from: '夠用', to: '彀用', conf: '中', pdf: [0, 0], web: [0, 1], hn: [0, 14], ft: [1, 0], src: ['web', 'hehe']},
  {id: 'gou-zige', from: '夠資格', to: '彀資格', conf: '中', pdf: [0, 0], web: [0, 5], hn: [0, 1], ft: [0, 0], src: ['web', 'hehe']},
  {id: 'wei-yang', from: '餵養', to: '餧養', conf: '高', pdf: [0, 4], web: [0, 7], hn: [0, 17], ft: [0, 2], src: ['pdf', 'web', 'hehe']},
  {id: 'zu-zhou', from: '詛咒', to: '咒詛', conf: '高', pdf: [0, 9], web: [0, 22], hn: [1, 13], ft: [0, 0], src: ['pdf', 'web']},
  {id: 'tan-xi', from: '嘆息', to: '歎息', conf: '高', pdf: [0, 1], web: [0, 10], hn: [4, 48], ft: [0, 4], src: ['pdf', 'web']},
  {id: 'wei-yi', from: '唯一', to: '惟一', conf: '高', pdf: [0, 2], web: [0, 1], hn: [0, 42], ft: [1, 12], src: ['pdf', 'web'], note: '只換「唯一」；「唯美、唯物」等其他「唯」詞無依據，不動'},
  {id: 'wei-you', from: '唯有', to: '惟有', conf: '高', pdf: [0, 4], web: [0, 38], hn: [0, 111], ft: [0, 14], src: ['pdf', 'web']},
  {id: 'wei-du', from: '唯獨', to: '惟獨', conf: '中', pdf: [0, 0], web: [0, 24], hn: [0, 12], ft: [0, 1], src: ['web']},
  {id: 'wei-kong', from: '唯恐', to: '惟恐', conf: '中', pdf: [0, 0], web: [0, 3], hn: [0, 4], ft: [0, 0], src: ['web']},
  {id: 'ao-mi', from: '奧秘', to: '奧祕', conf: '高', pdf: [0, 1], web: [0, 42], hn: [0, 66], ft: [7, 6], src: ['pdf', 'web']},
  {id: 'mi-jue', from: '秘訣', to: '祕訣', conf: '高', pdf: [0, 1], web: [0, 3], hn: [2, 19], ft: [3, 3], src: ['pdf', 'web']},
  {id: 'mi-mi', from: '秘密', to: '祕密', conf: '中', pdf: [0, 0], web: [0, 1], hn: [0, 13], ft: [3, 3], src: ['web']},
  {id: 'yu-chang', from: '預嘗', to: '豫嘗', conf: '中', pdf: [0, 0], web: [0, 0], hn: [0, 13], ft: [1, 1], src: ['hymnal', 'ft'], note: '詩歌用語（hn 豫嘗 13 次、預嘗 0 次）；北投 PDF 抽樣兩種寫法並存'},
  {id: 'cai-neng', from: '才能', to: '纔能', conf: '中', pdf: [0, 1], web: [0, 7], hn: [3, 61], ft: [1, 8], src: ['pdf', 'web', 'hymnal'], note: '「方始可以」義寫「纔能」（hn 纔能 61／才能 3，後者 3 例皆為才幹義；綱目 PDF、經文亦只見纔能）。以下情形一律不改、只提示待確認：人才、天才、口才、剛才、方才等詞後接「能」（如人才能興起、天才能做，歧義無法由字面判斷）；才幹義（有才能、不靠才能、倚靠才能，…；前接 不是／靠／憑／有／無／的／之，或後接標點、的、與、和、及、者、之）', notBefore: [...SURNAME_GUARD, '賢', '偉', '棟', '將', '專', '不是', '靠', '憑', '有', '無', '的', '之'], notAfter: ['、', '，', '。', '；', '：', '！', '？', '的', '與', '和', '及', '者', '之']},
  {id: 'zu-gou', from: '足夠', to: '足彀', conf: '中', pdf: [0, 0], web: [0, 0], hn: [0, 2], ft: [0, 0], src: ['hymnal', 'hehe']},
  {id: 'jiu-gou', from: '就夠', to: '就彀', conf: '中', pdf: [0, 0], web: [0, 0], hn: [0, 7], ft: [1, 0], src: ['hymnal', 'hehe']},
  {id: 'yi-gou', from: '已夠', to: '已彀', conf: '中', pdf: [0, 0], web: [0, 0], hn: [0, 4], ft: [0, 0], src: ['hymnal', 'hehe']},
  {id: 'ma', from: '嗎', to: '麼', conf: '中', pdf: [0, 9], web: [5, 962], hn: [14, 98], ft: [1, 16], src: ['web', 'hymnal'], note: '疑問語氣詞官方寫「麼」（經文句末「麼」364 次、hn 9、綱目 PDF 2、ft 2；非嗎哪的「嗎」詩歌僅 1 例引文）。只替換句末的「嗎」（後接 ？。，！；：」』）或全文結尾）；「嗎哪」、「甚麼嗎」「什麼嗎」（會變「甚麼麼」）、「這嗎」「那嗎」「怎嗎」「哪嗎」（會變成不同的詞「這麼」「那麼」）一律不改，只提示待確認', notBefore: ['麼', '甚', '什', '這', '那', '怎', '哪', '多'], notAfter: ['哪'], needAfter: ['？', '。', '，', '！', '；', '：', '」', '』', '）', '\n']},
  {id: 'zuo', from: '做', to: '作', conf: '中', pdf: [0, 68], web: [0, 837], hn: [0, 1170], ft: [0, 201], src: ['pdf', 'web', 'hymnal', 'ft'], note: '官方各來源（綱目、經文、詩歌合計約 78 萬字）「做」0 次、「作」逾 2200 次；排除「做作」', notBefore: ['作'], notAfter: ['作']},
  {id: 'zhong', from: '衆', to: '眾', conf: '高', pdf: [0, 2], web: [0, 614], hn: [0, 264], ft: [13, 42], src: ['pdf', 'web'], note: '異體字：官方來源 0 次「衆」'}
];

// 待確認／不替換：官方來源彼此不一致、詩歌來源與經文衝突、或無法由字面判斷；只提醒（silent:true 者連提醒也不出，僅記錄依據）。
// pattern 以字串列表比對（任一出現即提示）。
export const PENDING = [
  {id: 'ta', match: ['他'], message: '若「他」指神或主，官方寫「祂」（需人工判斷，不自動替換）', basis: '詩歌 hn 祂 3414／他 264、北投 PDF 722／55；綱目 PDF 113／41；同一字形需看語意'},
  {id: 'zhe', match: ['著'], message: '「著」：官方綱目 PDF 寫「着」，但詩歌（hn 著 1106／着 2、北投 PDF 220／2）幾乎一律寫「著」，詩歌輸出依詩歌，不替換（唯一例外：因著、為著依使用者決定以官方 PDF 為準，已自動替換）', basis: '綱目 PDF 着 3／著 0；網頁經文 著 1578／着 0；詩歌 著為主'},
  {id: 'cai-neng', match: ['才能'], message: '「才能」若表「方始可以」，官方寫「纔能」；人才、天才、口才等詞與才幹義已排除，剩下無法由字面判斷的（如「人才能…」）保持原樣，請人工確認', basis: '綱目 PDF 纔能 1、經文 7、詩歌 hn 61／才能 3（皆才幹義）；字面歧義處不自動替換'},
  {id: 'ma', match: ['嗎'], message: '疑問語氣詞「嗎」官方寫「麼」；只替換句末（後接標點）的「嗎」，行尾無標點、「甚麼嗎」「這嗎」等請人工確認（嗎哪不改）', basis: '經文句末 麼 364、hn 9、綱目 2、ft 2；非嗎哪的「嗎」僅 1 例'},
  {id: 'yu-other', match: ['預期', '預算', '預計', '預料', '預測', '預設', '預覽', '預習', '預感', '預兆', '預見'], message: '「預」字的其他詞官方似寫「豫」（豫備、豫言、豫約、豫嘗皆是），但這些詞官方來源未見足夠用例（詩歌僅見單例豫料、豫兆），待確認', basis: '詩歌 hn 預 0／豫 115，其中 豫備 59、豫定 14、豫表 14、豫嘗 13、豫知 3、豫言 2；其他詞僅單例'},
  {id: 'qi-shi', match: ['啓示', '啟示'], message: '「啟示／啓示」：詩歌多寫「啟示」（hn 66／0、北投 PDF 11／5），網頁經文寫「啓示」，兩者衝突；依詩歌，「啓示」待確認（不替換）', basis: '綱目 PDF 啟示 12／啓示 0；網頁經文 0／57；詩歌 hn 66／0、北投 PDF 11／5'},
  {id: 'deng-tai', match: ['燈台'], message: '「燈台」官方網頁經文寫「燈臺」（13／0）；詩歌 hn 2／29，但北投 PDF 4／2 並存，待確認（不替換）', basis: '網頁經文 燈臺 13；hn 燈臺 29／燈台 2；北投 PDF 燈臺 2／燈台 4'},
  {id: 'old-orth', silent: true, match: ['輭', '躭', '譭', '羣', '大衞'], message: '和合本舊字（輭弱、躭延、譭謗、羣眾、大衞）只見於網頁經文；詩歌多半不用（hn：軟 77／輭 10、耽 6／躭 1、毀 60／譭 0、群 36／羣 7、大衛 11／大衞 3；北投 PDF：軟 19／輭 0、毀 7／譭 0、群 3／羣 0），依詩歌不替換', basis: '詩歌 hn 軟弱 77／輭弱 10；網頁經文 輭弱 54'},
  {id: 'prophet', match: ['先知'], message: '恢復本專有名詞「先知」寫「申言者」（網頁 申言者 169），歌詞用語需人工判斷', basis: '新約恢復本術語；非字形差異'}
];

export const CONFIDENCE_NOTE = '高＝PDF 與網頁一致且無反例；中＝僅單一來源或兩種官方媒體不完全一致，仍列入自動替換並於 PR 說明；待確認＝列在 PENDING，只提醒。';
