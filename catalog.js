// 景品(ガチャ)と新キャラの一覧。アプリ表示とデータベース(SQL)の両方がこのファイルを元にする。
// rarity: N / R / SR / SSR / LR(レジェンドレア)   kind: char(新キャラ) / skin(駒の着せ替え) / wolf(人狼の毛色) / back(駒裏) / title(称号) / stamp(スタンプ)

export const RATES = { LR: 0.5, SSR: 2.5, SR: 9, R: 28, N: 60 }; // %
export const REFUND = { N: 1, R: 5, SR: 10 };                   // 持っている景品が出たときに戻るコイン
export const TOKEN_REFUND = { SSR: 1, LR: 2 };                  // 持っているキャラが出たときにもらえる特別コイン
export const TOKEN_COST = 5;                                    // 特別コイン5枚でSSRキャラ1体と交換
export const COST = { single: 100, ten: 900 };
export const RARITY_LABEL = { N: 'ノーマル', R: 'レア', SR: 'スーパーレア', SSR: '超激レア', LR: 'レジェンドレア' };
export const RARITY_ORDER = ['LR', 'SSR', 'SR', 'R', 'N'];
export const KIND_LABEL = { char: '新キャラ', skin: '着せ替え', frame: '枠の色', wolf: '人狼の毛色', back: '駒裏デザイン', title: '称号', stamp: 'スタンプ' };

const D = '#232838';
// 新キャラ。m = 動けるマス([前後, 左右]、-1が前)
export const CHARS = {
  medium:   { nm: '霊媒師',   band: '#5b6bd6', m: [[-1,0],[0,-1],[0,1]],          d: '前・左右に1マス。取られると、取った駒の正体が相手に公開される。',
    icon: `<path d="M12 40 V22 Q12 8 24 8 Q36 8 36 22 V40 L32 36 L28 40 L24 36 L20 40 L16 36 Z" fill="#eef3ff" stroke="${D}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="19" cy="21" r="2.6" fill="${D}"/><circle cx="29" cy="21" r="2.6" fill="${D}"/><ellipse cx="24" cy="28.5" rx="3.2" ry="2.2" fill="${D}"/><circle cx="38" cy="10" r="3" fill="#a5b4fc" stroke="${D}" stroke-width="1.4"/>` },
  tough:    { nm: 'タフガイ', band: '#c2410c', m: [[-1,0],[1,0]],                 d: '前・後ろに1マス。1回だけ取られずに耐える(耐えると正体がバレて負傷する)。',
    icon: `<rect x="6" y="15" width="8" height="18" rx="2" fill="#4b5563" stroke="${D}" stroke-width="2.2"/><rect x="34" y="15" width="8" height="18" rx="2" fill="#4b5563" stroke="${D}" stroke-width="2.2"/><rect x="2" y="19" width="4" height="10" rx="1.5" fill="#6b7280" stroke="${D}" stroke-width="1.8"/><rect x="42" y="19" width="4" height="10" rx="1.5" fill="#6b7280" stroke="${D}" stroke-width="1.8"/><rect x="14" y="21" width="20" height="6" rx="1" fill="#d1d5db" stroke="${D}" stroke-width="2.2"/><path d="M19 9 L24 4 L29 9" fill="none" stroke="#f97316" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` },
  nekomata: { nm: '猫又',     band: '#7c3aed', m: [[-1,-1],[-1,1],[1,0]],         d: '斜め前・真後ろに1マス。取られると、取った駒を道連れにする。',
    icon: `<path d="M38 36 Q47 30 43 21" fill="none" stroke="${D}" stroke-width="2.4" stroke-linecap="round"/><path d="M38 39 Q47 40 46 31" fill="none" stroke="${D}" stroke-width="2.4" stroke-linecap="round"/><path d="M8 40 Q6 22 10 9 L18 17 H28 L36 9 Q40 22 38 40 Z" fill="#c4b5fd" stroke="${D}" stroke-width="2.4" stroke-linejoin="round"/><path d="M14 25 Q17 22 20 25 M26 25 Q29 22 32 25" fill="none" stroke="${D}" stroke-width="2.2" stroke-linecap="round"/><path d="M21 31 L23 33 L25 31" fill="none" stroke="${D}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` },
  teru:     { nm: 'てるてる', band: '#0ea5e9', m: [[-1,0],[1,-1],[1,1]],          d: '前・斜め後ろに1マス。取られるか返り討ちにされると、持ち主がもう1手続けて動ける(追加の1手は移動だけ)。',
    icon: `<path d="M14 24 Q24 31 34 24 L39 42 H9 Z" fill="#fff" stroke="${D}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="24" cy="16" r="10" fill="#fff" stroke="${D}" stroke-width="2.4"/><circle cx="20" cy="15" r="1.6" fill="${D}"/><circle cx="28" cy="15" r="1.6" fill="${D}"/><path d="M20 19 Q24 22 28 19" fill="none" stroke="${D}" stroke-width="1.8" stroke-linecap="round"/><path d="M16 25 Q24 29 32 25" fill="none" stroke="#e5484d" stroke-width="2.4" stroke-linecap="round"/>` },
  fox:      { nm: '妖狐',     band: '#ea580c', m: [[-1,-1],[-1,0],[-1,1]],        d: '前3方向に1マス。人狼の返り討ちが効かず、隠れた人狼も取れる。',
    icon: `<path d="M7 7 L18 17 H30 L41 7 L39 26 L24 42 L9 26 Z" fill="#fb923c" stroke="${D}" stroke-width="2.4" stroke-linejoin="round"/><path d="M24 42 L16 30 H32 Z" fill="#fff7ed" stroke="${D}" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 23 L20 25 M34 23 L28 25" stroke="${D}" stroke-width="2.4" stroke-linecap="round"/><path d="M22 36 H26 L24 38.5 Z" fill="${D}"/><path d="M10 10 L15 15 M38 10 L33 15" stroke="#fff7ed" stroke-width="2" stroke-linecap="round"/>` },
  thief:    { nm: '怪盗',     band: '#334155', m: [[-1,-1],[-1,1],[0,-1],[0,1]],  d: '斜め前・左右に1マス。相手の駒を取ると、その駒に変身して動きを奪う。',
    icon: `<rect x="15" y="5" width="18" height="14" rx="1.5" fill="${D}"/><rect x="15" y="14" width="18" height="3" fill="#e5484d"/><rect x="8" y="18" width="32" height="4" rx="2" fill="${D}"/><path d="M5 28 Q24 21 43 28 Q39 39 30 35 L24 32 L18 35 Q9 39 5 28 Z" fill="#475569" stroke="${D}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="16" cy="30" r="2.8" fill="#fff"/><circle cx="32" cy="30" r="2.8" fill="#fff"/><path d="M18 41 Q24 44 30 41" fill="none" stroke="${D}" stroke-width="2" stroke-linecap="round"/>` },
  vampire:  { nm: '吸血鬼',   band: '#9f1239', m: [[-1,-1],[-1,1],[1,-1],[1,1]], d: '斜め4方向に1マス。1局に1回、動く代わりに隣の相手の駒を味方に変えられる(王様と人狼には効かない)。', ability: 'bite',
    icon: `<path d="M6 40 L10 20 Q24 12 38 20 L42 40 L33 34 L24 40 L15 34 Z" fill="#4c0519" stroke="${D}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="24" cy="19" r="10" fill="#f5e6ef" stroke="${D}" stroke-width="2.4"/><path d="M14 13 Q24 3 34 13 L30 12 L24 15 L18 12 Z" fill="${D}"/><path d="M19 18 L22 19 M29 18 L26 19" stroke="#e11d48" stroke-width="2.4" stroke-linecap="round"/><path d="M20 23 Q24 26 28 23" fill="none" stroke="${D}" stroke-width="1.8" stroke-linecap="round"/><path d="M21.5 24 L22.5 27 L23.5 24.5 M24.5 24.5 L25.5 27 L26.5 24" fill="#fff" stroke="${D}" stroke-width="1" stroke-linejoin="round"/>` },
  cursed:   { nm: '呪われた者', band: '#4c1d95', m: [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]], d: '全方向に1マス。ただし隠れた人狼に返り討ちにされると、消えずに相手の駒に寝返る。',
    icon: `<circle cx="24" cy="24" r="17" fill="#c4b5fd" stroke="${D}" stroke-width="2.4"/><path d="M24 9 L27 19 L37 19 L29 25 L32 35 L24 29 L16 35 L19 25 L11 19 L21 19 Z" fill="none" stroke="#4c1d95" stroke-width="1.6" stroke-linejoin="round" opacity=".55"/><circle cx="18" cy="22" r="3.4" fill="#fff" stroke="${D}" stroke-width="1.8"/><circle cx="30" cy="22" r="3.4" fill="#fff" stroke="${D}" stroke-width="1.8"/><circle cx="18" cy="22" r="1.2" fill="${D}"/><circle cx="30" cy="22" r="1.2" fill="${D}"/><path d="M18 31 Q24 28 30 31" fill="none" stroke="${D}" stroke-width="2" stroke-linecap="round"/><path d="M6 38 Q12 34 16 38 M32 38 Q36 34 42 38" fill="none" stroke="${D}" stroke-width="2.2" stroke-linecap="round"/>` },
};

// 曜日ごとのガチャ(1=月 … 7=日、日本時間)
export const BANNERS = {
  A: { name: '通常ガチャ',   days: [1, 3, 6], lr: ['fox', 'thief'],       desc: 'レジェンドレアの妖狐・怪盗が出る' },
  B: { name: '新キャラガチャ', days: [2, 4, 5], lr: ['vampire', 'cursed'], desc: 'レジェンドレアの吸血鬼・呪われた者が出る' },
  S: { name: 'えらべるピックアップガチャ', days: [7], lr: [],            desc: '好きなキャラを1体選んで引ける。キャラが当たる3%がすべて選んだキャラになる' },
};
export const bannerOfDay = dow => Object.keys(BANNERS).find(k => BANNERS[k].days.includes(dow)) || 'A';

// ガチャの景品
export const ITEMS = [
  // LR / SSR 新キャラ
  { id: 'c_medium',   kind: 'char',  rarity: 'SSR', name: '霊媒師',   char: 'medium' },
  { id: 'c_tough',    kind: 'char',  rarity: 'SSR', name: 'タフガイ', char: 'tough' },
  { id: 'c_nekomata', kind: 'char',  rarity: 'SSR', name: '猫又',     char: 'nekomata' },
  { id: 'c_teru',     kind: 'char',  rarity: 'SSR', name: 'てるてる', char: 'teru' },
  { id: 'c_fox',      kind: 'char',  rarity: 'LR',  name: '妖狐',     char: 'fox',   banner: 'A' },
  { id: 'c_thief',    kind: 'char',  rarity: 'LR',  name: '怪盗',     char: 'thief', banner: 'A' },
  { id: 'c_vampire',  kind: 'char',  rarity: 'LR',  name: '吸血鬼',   char: 'vampire', banner: 'B' },
  { id: 'c_cursed',   kind: 'char',  rarity: 'LR',  name: '呪われた者', char: 'cursed', banner: 'B' },
  // SR
  { id: 'k_pop',      kind: 'skin',  rarity: 'SR',  name: 'ポップ' },
  { id: 'k_neon',     kind: 'skin',  rarity: 'SR',  name: 'ネオン' },
  { id: 'k_gold',     kind: 'skin',  rarity: 'SR',  name: 'ゴールド' },
  { id: 'f_gold',     kind: 'frame', rarity: 'SR',  name: '金の枠',   color: '#e8a90c' },
  { id: 'f_purple',   kind: 'frame', rarity: 'SR',  name: '紫の枠',   color: '#9b4dff' },
  { id: 'f_pink',     kind: 'frame', rarity: 'SR',  name: 'ネオンピンクの枠', color: '#ff3d9a' },
  { id: 'w_gold',     kind: 'wolf',  rarity: 'SR',  name: '金狼',     color: '#f5b82e' },
  { id: 'w_blue',     kind: 'wolf',  rarity: 'SR',  name: '蒼狼',     color: '#4f8df7' },
  { id: 'b_moon',     kind: 'back',  rarity: 'SR',  name: '満月',     glyph: '🌕' },
  { id: 'b_star',     kind: 'back',  rarity: 'SR',  name: '星空',     glyph: '✦' },
  { id: 'b_paw',      kind: 'back',  rarity: 'SR',  name: '肉球',     glyph: '🐾' },
  { id: 't_legend',   kind: 'title', rarity: 'SR',  name: '伝説の占い師' },
  { id: 't_lord',     kind: 'title', rarity: 'SR',  name: '闇夜の支配者' },
  { id: 't_unbeaten', kind: 'title', rarity: 'SR',  name: '無敗の王' },
  { id: 's_all',      kind: 'stamp', rarity: 'SR',  name: '全部お見通し🔮' },
  { id: 's_night',    kind: 'stamp', rarity: 'SR',  name: '狼の時間だ🌕' },
  // R
  { id: 'k_mint',     kind: 'skin',  rarity: 'R',   name: 'ミント' },
  { id: 'k_sakura',   kind: 'skin',  rarity: 'R',   name: 'サクラ' },
  { id: 'k_sky',      kind: 'skin',  rarity: 'R',   name: 'スカイ' },
  { id: 'k_night',    kind: 'skin',  rarity: 'R',   name: 'ミッドナイト' },
  { id: 'f_red',      kind: 'frame', rarity: 'R',   name: '赤の枠',   color: '#e5484d' },
  { id: 'f_blue',     kind: 'frame', rarity: 'R',   name: '青の枠',   color: '#2f7bf0' },
  { id: 'f_green',    kind: 'frame', rarity: 'R',   name: '緑の枠',   color: '#16a36b' },
  { id: 'w_black',    kind: 'wolf',  rarity: 'R',   name: '黒狼',     color: '#3b3f4c' },
  { id: 'w_white',    kind: 'wolf',  rarity: 'R',   name: '白狼',     color: '#f1f3f8' },
  { id: 'b_check',    kind: 'back',  rarity: 'R',   name: 'チェック', glyph: '◆' },
  { id: 't_hunter',   kind: 'title', rarity: 'R',   name: '人狼ハンター' },
  { id: 't_guard',    kind: 'title', rarity: 'R',   name: '王様の守り手' },
  { id: 't_doubt',    kind: 'title', rarity: 'R',   name: '疑い深い人' },
  { id: 't_counter',  kind: 'title', rarity: 'R',   name: '返り討ち職人' },
  { id: 't_bluff',    kind: 'title', rarity: 'R',   name: 'ブラフの名人' },
  { id: 's_read',     kind: 'stamp', rarity: 'R',   name: '読めてるよ👀' },
  { id: 's_trap',     kind: 'stamp', rarity: 'R',   name: '罠だよ？🪤' },
  { id: 's_give',     kind: 'stamp', rarity: 'R',   name: '降参する？🏳️' },
  { id: 's_fast',     kind: 'stamp', rarity: 'R',   name: 'はやく〜⏰' },
  // N
  { id: 't_novice',   kind: 'title', rarity: 'N',   name: '見習い村人' },
  { id: 't_fan',      kind: 'title', rarity: 'N',   name: '将棋好き' },
  { id: 't_owl',      kind: 'title', rarity: 'N',   name: '夜ふかし' },
  { id: 't_rookie',   kind: 'title', rarity: 'N',   name: 'ルーキー' },
  { id: 's_wolf',     kind: 'stamp', rarity: 'N',   name: 'それ人狼でしょ？🐺' },
  { id: 's_no',       kind: 'stamp', rarity: 'N',   name: 'うそでしょ…😱' },
  { id: 's_more',     kind: 'stamp', rarity: 'N',   name: 'まだまだ！🔥' },
  { id: 's_fufu',     kind: 'stamp', rarity: 'N',   name: 'ふふふ😏' },
  { id: 's_gg',       kind: 'stamp', rarity: 'N',   name: 'GG！🤝' },
  { id: 's_oops',     kind: 'stamp', rarity: 'N',   name: 'しまった！💦' },
];
// アチーブメント限定の称号(ガチャからは出ない)
export const ACH_ITEMS = [
  { id: 't_win10',   kind: 'title', rarity: 'R',   name: '十勝の挑戦者',     gacha: false },
  { id: 't_win25',   kind: 'title', rarity: 'SR',  name: '盤上の策士',       gacha: false },
  { id: 't_win50',   kind: 'title', rarity: 'SSR', name: '歴戦の勇者',       gacha: false },
  { id: 't_win100',  kind: 'title', rarity: 'LR',  name: '人狼将棋マスター', gacha: false },
  { id: 't_ssrall',  kind: 'title', rarity: 'SSR', name: '超激レアコレクター', gacha: false },
  { id: 't_charall', kind: 'title', rarity: 'LR',  name: '伝説のコレクター', gacha: false },
];
// stat: wins(通算勝利) / games(通算対局) / ssr(SSRキャラ所持数) / chars(新キャラ所持数) / friends(フレンド数)
export const ACHIEVEMENTS = [
  { id: 'a_first',   name: 'はじめての勝利',       stat: 'wins',    goal: 1,   coins: 100 },
  { id: 'a_games10', name: '10局遊ぶ',             stat: 'games',   goal: 10,  coins: 200 },
  { id: 'a_friend',  name: 'フレンドを作る',       stat: 'friends', goal: 1,   coins: 100 },
  { id: 'a_win10',   name: '10勝する',             stat: 'wins',    goal: 10,  coins: 300,  item: 't_win10' },
  { id: 'a_win25',   name: '25勝する',             stat: 'wins',    goal: 25,  coins: 500,  tokens: 1, item: 't_win25' },
  { id: 'a_win50',   name: '50勝する',             stat: 'wins',    goal: 50,  coins: 1000, tokens: 2, item: 't_win50' },
  { id: 'a_win100',  name: '100勝する',            stat: 'wins',    goal: 100, coins: 2000, tokens: 5, item: 't_win100' },
  { id: 'a_ssrall',  name: 'SSRキャラを全部集める', stat: 'ssr',     goal: 4,   coins: 1000, item: 't_ssrall' },
  { id: 'a_charall', name: '新キャラを全部集める',   stat: 'chars',   goal: 8,   coins: 3000, tokens: 5, item: 't_charall' },
];

// 最初から持っているスタンプ
export const DEFAULT_STAMPS = [
  { id: 's_hello',  kind: 'stamp', rarity: 'N', name: 'よろしく！👋' },
  { id: 's_nice',   kind: 'stamp', rarity: 'N', name: 'いい手！👍' },
  { id: 's_thanks', kind: 'stamp', rarity: 'N', name: 'ありがとう！🙏' },
  { id: 's_hmm',    kind: 'stamp', rarity: 'N', name: '考え中…🤔' },
];
export const ITEM = Object.fromEntries([...ITEMS, ...ACH_ITEMS, ...DEFAULT_STAMPS].map(i => [i.id, i]));

export const MISSIONS = [
  { id: 'm_play',  name: 'オンラインで1局遊ぶ',     reward: 10 },
  { id: 'm_win',   name: 'オンラインで1回勝つ',     reward: 10 },
  { id: 'm_stamp', name: '対戦中にスタンプを送る',   reward: 10 },
];
export const LOGIN = { daily: 20, weekBonus: 100, welcome: 900 };

// 初期の駒のレア度(C=コモン)
export const BASE_RARITY = { villager: 'C', seer: 'R', knight: 'R', hunter: 'R' };
// 王様と人狼は対戦の経験値で昇格する。経験値 = 勝ち×30 + 負け×10。上のランクは勝率も必要
export const EXP = { win: 30, lose: 10 };
export const RANKS = [
  { r: 'C',   exp: 0,    wr: 0 },
  { r: 'R',   exp: 100,  wr: 0 },
  { r: 'SR',  exp: 300,  wr: 0 },
  { r: 'SSR', exp: 700,  wr: 40 },
  { r: 'LR',  exp: 1500, wr: 50 },
];
