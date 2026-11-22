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
  // ---- 日曜限定ガチャの8体(アイコンはマル制作) ----
  madman:    { nm: '狂人', band: '#b45309', m: [[-1, 0],[0, -1],[0, 1]], d: '前・左右に1マス。取られると、取った側には「人狼を取った」と表示される(持ち駒になるときは村人として渡る)。',
    icon: `<g fill="none" stroke="#232838" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21 L6 9 L13 13 L15 4 L20 11 L24 3 L27 11 L34 6 L34 14 L38 19 Q20 10 9 21Z" fill="#b45309"/><circle cx="20" cy="24" r="10.5" fill="#ffe3c2"/><circle cx="15.5" cy="23" r="3.1" fill="#ffffff"/><circle cx="15.5" cy="23" r="1.2" fill="#232838" stroke="none"/><circle cx="25.5" cy="23" r="1.9" fill="#232838" stroke="none"/><path d="M12 30 L16 28.6 L20 30 L24 28.6 L28 30"/><path d="M35 15 L34 8 L38.5 11 L42.5 8 L43 15 Q45.5 19 43.5 24 L40 30 L36 24 Q34 19 35 15Z" fill="#9aa3b2"/><ellipse cx="39" cy="25" rx="2.8" ry="2.1" fill="#c7cedb"/><circle cx="37" cy="19.5" r="1.1" fill="#232838" stroke="none"/><circle cx="41.5" cy="19.5" r="1.1" fill="#232838" stroke="none"/></g>` },
  wolfboy:   { nm: '狼少年', band: '#65a30d', m: [[-1, -1],[-1, 0],[-1, 1]], d: '前3方向に1マス。1局に1回、手番を使って「王様のふり」ができる。相手からは王様に見えるようになる。',
    icon: `<g fill="none" stroke="#232838" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 11 L17 4 L22 9 L27 3 L30 10 L32 13 L14.5 14.5Z" fill="#f5c542"/><path d="M11 21 Q10 9 24 9 Q38 9 37 21 L33 16 L30 20.5 L26 15.5 L21 19.5 L17 15 L14 19.5Z" fill="#6b4f2a"/><circle cx="24" cy="25" r="10" fill="#ffe3c2"/><path d="M15.5 23.5 Q18 21.5 20.5 23.5"/><circle cx="29.5" cy="23.5" r="1.8" fill="#232838" stroke="none"/><path d="M19 30.5 Q24 33 29 30.5"/><path d="M21.5 32.5 Q24 37.5 26.5 32.5 L26.5 31 L21.5 31Z" fill="#f28bb4"/><path d="M13.5 36 Q24 31.5 34.5 36Z" fill="#65a30d"/></g>` },
  detective: { nm: '探偵', band: '#1e3a8a', m: [[-1, 0],[1, 0],[0, -1],[0, 1]], d: '上下左右に1マス。1局に1回、手番を使って隣の相手の駒1枚の正体を自分だけ見られる。',
    icon: `<g fill="none" stroke="#232838" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 16 Q24 5 38 16 L38 19 L10 19Z" fill="#1e3a8a"/><path d="M5 19 L43 19 L38.5 22.5 L9.5 22.5Z" fill="#1e3a8a"/><path d="M13.5 22.5 L34.5 22.5 L34.5 27 Q34.5 35 24 35 Q13.5 35 13.5 27Z" fill="#ffe3c2"/><path d="M16.5 26.5 L21 26.5"/><circle cx="18.8" cy="28.3" r="1.3" fill="#232838" stroke="none"/><path d="M27 26.5 L31.5 26.5"/><circle cx="29.2" cy="28.3" r="1.3" fill="#232838" stroke="none"/><path d="M21 32.5 L27 32.5"/><circle cx="36" cy="28" r="6.2" fill="#bcd8ff" fill-opacity="0.55"/><path d="M40.3 32.8 L43.5 36"/></g>` },
  gravekeeper: { nm: '墓守', band: '#475569', m: [[-1, 0],[1, 0],[1, -1],[1, 1]], d: '前・後ろ・斜め後ろに1マス。盤上にいる間、味方を取った相手の駒は正体がこちらに知られる。',
    icon: `<g fill="none" stroke="#232838" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M24 3.5 Q38 5.5 38 19 L38 29 Q38 36 31.5 36 L16.5 36 Q10 36 10 29 L10 19 Q10 5.5 24 3.5Z" fill="#475569"/><circle cx="24" cy="21.5" r="8.6" fill="#f2e8d8"/><path d="M18 20.5 L22.5 20.5"/><circle cx="20.2" cy="22.3" r="1.2" fill="#232838" stroke="none"/><path d="M25.5 20.5 L30 20.5"/><circle cx="27.8" cy="22.3" r="1.2" fill="#232838" stroke="none"/><path d="M21.5 27.5 L26.5 27.5"/><path d="M39.5 23.5 Q41.5 20.5 43.5 23.5" fill="#475569"/><rect x="37.5" y="23.5" width="8" height="9.5" rx="2" fill="#ffd34d"/><path d="M41.5 25.5 L41.5 31"/></g>` },
  bodyguard: { nm: 'ボディーガード', band: '#0f766e', m: [[0, -1],[0, 1],[1, 0]], d: '左右・後ろに1マス。隣の味方が取られるとき、1回だけ身代わりになって消える(味方は無事)。',
    icon: `<g fill="none" stroke="#232838" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="20" cy="22" r="10.5" fill="#ffe3c2"/><path d="M9.5 20 Q9.5 9.5 20 9.5 Q30.5 9.5 30.5 20 L28.5 14.5 L12 15.5Z" fill="#2f2a26"/><path d="M10 19.5 L30 19.5 L28.6 25.5 Q24.8 27 22.3 25 L20 23 L17.7 25 Q15.2 27 11.4 25.5Z" fill="#111827"/><path d="M15.5 30.5 L23 30.5"/><path d="M12 36 L30 36 L30 33.5 Q21 31 12 33.5Z" fill="#1f2937"/><path d="M31.5 22.5 L41.5 20 L41.5 27.5 Q41.5 33.5 36.5 36 Q31.5 33.5 31.5 27.5Z" fill="#0f766e"/><path d="M34 25.5 L39 24 L39 28 Q39 31.5 36.5 33 Q34 31.5 34 28Z" fill="#99e5dd" stroke="none"/></g>` },
  ninja:     { nm: '忍者', band: '#111827', m: [[-1, -1],[-1, 1],[1, 0]], d: '斜め前・真後ろに1マス。1局に1回、手番を使って上下左右に2マス先の空きマスへ跳べる(間の駒は飛び越える)。',
    icon: `<g fill="none" stroke="#232838" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M34.5 11 L43 7.5 L41.5 14.5 L35 15.5Z" fill="#1f2937"/><circle cx="24" cy="21" r="11.5" fill="#1f2937"/><path d="M13.5 17.5 L34.5 17.5 L34.5 23.5 Q24 26.5 13.5 23.5Z" fill="#ffe3c2"/><path d="M16.5 19.8 L21 19"/><circle cx="19" cy="21" r="1.4" fill="#232838" stroke="none"/><path d="M27 19 L31.5 19.8"/><circle cx="29" cy="21" r="1.4" fill="#232838" stroke="none"/><path d="M33 29.5 Q40 31.5 43.5 28 L42.5 34.5 Q37 35.5 32 32.5Z" fill="#b91c1c"/><rect x="5.5" y="26.5" width="8" height="8" fill="#9aa3b2"/><rect x="5.5" y="26.5" width="8" height="8" fill="#9aa3b2" transform="rotate(45 9.5 30.5)"/><circle cx="9.5" cy="30.5" r="1.4" fill="#ffffff"/></g>` },
  witch:     { nm: '魔女', band: '#7e22ce', m: [[-1, -1],[-1, 1],[1, -1],[1, 1]], d: '斜め4方向に1マス。1局に1回、手番を使って取られた味方1枚(最後に取られた駒)を自陣の手前2段の空きマスに復活させる。',
    icon: `<g fill="none" stroke="#232838" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 20 L13.5 33 L17.5 33 L17.5 21Z" fill="#a855f7"/><path d="M33 20 L34.5 33 L30.5 33 L30.5 21Z" fill="#a855f7"/><circle cx="24" cy="26" r="8.6" fill="#ffe3c2"/><path d="M24.5 2 Q31 8 29.5 13.5 L41 19.5 L7 19.5 L19 13.5 Q20 5.5 24.5 2Z" fill="#7e22ce"/><path d="M12.5 16.8 L35.5 16.8 L37.5 19.5 L10.5 19.5Z" fill="#f5c542"/><path d="M27 7.5 L28 10 L30.5 10.8 L28.4 12.3 L29 14.8 L27 13.4 L25 14.8 L25.6 12.3 L23.5 10.8 L26 10Z" fill="#ffd34d"/><circle cx="18.8" cy="25.5" r="1.6" fill="#232838" stroke="none"/><circle cx="29.2" cy="25.5" r="1.6" fill="#232838" stroke="none"/><path d="M20.5 30.5 Q24 32.5 27.5 30.5"/><circle cx="41" cy="30.5" r="4.2" fill="#4ade80"/><path d="M39.3 26.8 L39.3 23.8 L42.7 23.8 L42.7 26.8Z" fill="#c7cedb"/><path d="M35.5 21 L36.2 23 L38.2 23.7 L36.2 24.4 L35.5 26.4 L34.8 24.4 L32.8 23.7 L34.8 23Z" fill="#ffd34d"/></g>` },
  cupid:     { nm: 'キューピッド', band: '#db2777', m: [[-1, 0],[0, -1],[0, 1],[1, -1],[1, 1]], d: '前・左右・斜め後ろに1マス。1局に1回、手番を使って隣の相手の駒1枚を2手番のあいだ動けなくする(王様には効かない)。',
    icon: `<g fill="none" stroke="#232838" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 17 Q3 11 5 20.5 Q2 25.5 8 27.5 Q13.5 28.5 14.5 23Z" fill="#ffffff"/><path d="M34.5 17 Q45 11 43 20.5 Q46 25.5 40 27.5 Q34.5 28.5 33.5 23Z" fill="#ffffff"/><circle cx="24" cy="23.5" r="9.5" fill="#ffe3c2"/><circle cx="15.5" cy="13" r="4.6" fill="#ffd34d"/><circle cx="24" cy="9.8" r="5.2" fill="#ffd34d"/><circle cx="32.5" cy="13" r="4.6" fill="#ffd34d"/><circle cx="16" cy="19" r="3.4" fill="#ffd34d"/><circle cx="32" cy="19" r="3.4" fill="#ffd34d"/><path d="M17.5 23 Q19.5 21 21.5 23"/><path d="M26.5 23 Q28.5 21 30.5 23"/><circle cx="17" cy="27.5" r="1.9" fill="#f9a8d4" stroke="none"/><circle cx="31" cy="27.5" r="1.9" fill="#f9a8d4" stroke="none"/><path d="M21.5 28.5 Q24 30 26.5 28.5"/><path d="M24 35.5 Q16.5 30 18.8 26.2 Q21.2 23.2 24 26.8 Q26.8 23.2 29.2 26.2 Q31.5 30 24 35.5Z" fill="#db2777"/><path d="M15.5 36.5 L34 24.5" stroke="#f5c542"/><path d="M34 24.5 L29.8 25.3 L32.6 28.6Z" fill="#f5c542"/><path d="M8 33.5 L8.7 35.7 L10.9 36.4 L8.7 37.1 L8 39.3 L7.3 37.1 L5.1 36.4 L7.3 35.7Z" fill="#ffd34d"/></g>` },
};
// キャラ素材 chara3(正式版)。CHARS[k] に全身・顔アイコン・表情・リアクション道具の参照を足す。
// 盤上の駒は従来どおり icon(SVG)のまま。顔アイコン画像は iconImg(icon は駒SVGで使っているため)。
// 基本の6体(王様・人狼など)の参照は chara3.js の ART にある。
import { ART } from './chara3.js';
for (const k of Object.keys(CHARS)) {
  const a = ART[k];
  if (!a) continue;
  Object.assign(CHARS[k], { fullbody: a.fullbody, iconImg: a.icon, expr: a.expr, prop: a.prop });
  if (a.fullbodyLux) Object.assign(CHARS[k], { fullbodyLux: a.fullbodyLux, iconLux: a.iconLux });
}

// 曜日ごとのガチャ(1=月 … 7=日、日本時間)
export const BANNERS = {
  A: { name: '通常ガチャ',   days: [1, 3, 6], lr: ['fox', 'thief'],       desc: 'レジェンドレアの妖狐・怪盗が出る' },
  B: { name: '新キャラガチャ', days: [2, 4, 5], lr: ['vampire', 'cursed'], desc: 'レジェンドレアの吸血鬼・呪われた者が出る' },
  S: { name: '日曜限定ガチャ', days: [7], lr: ['witch', 'cupid'], desc: '日曜だけ！ 探偵・忍者・魔女など、ここでしか出ない8体が登場' },
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
  { id: 'c_witch',    kind: 'char',  rarity: 'LR',  name: '魔女',     char: 'witch',  banner: 'S' },
  { id: 'c_cupid',    kind: 'char',  rarity: 'LR',  name: 'キューピッド', char: 'cupid', banner: 'S' },
  { id: 'c_detective', kind: 'char', rarity: 'SSR', name: '探偵',     char: 'detective', banner: 'S' },
  { id: 'c_bodyguard', kind: 'char', rarity: 'SSR', name: 'ボディーガード', char: 'bodyguard', banner: 'S' },
  { id: 'c_ninja',    kind: 'char',  rarity: 'SSR', name: '忍者',     char: 'ninja',  banner: 'S' },
  { id: 'c_madman',   kind: 'char',  rarity: 'SSR', name: '狂人',     char: 'madman', banner: 'S' },
  { id: 'c_gravekeeper', kind: 'char', rarity: 'SSR', name: '墓守',   char: 'gravekeeper', banner: 'S' },
  { id: 'c_wolfboy',  kind: 'char',  rarity: 'SSR', name: '狼少年',   char: 'wolfboy', banner: 'S' },
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
  { id: 'f_lv10',     kind: 'frame', rarity: 'R',   name: '村人の枠', color: '#65a30d', gacha: false },
  { id: 'f_lv20',     kind: 'frame', rarity: 'SR',  name: '騎士の枠', color: '#0ea5e9', gacha: false },
  { id: 'f_lv30',     kind: 'frame', rarity: 'SSR', name: '占い師の枠', color: '#7c3aed', gacha: false },
  { id: 'f_lv50',     kind: 'frame', rarity: 'SSR', name: '長老の枠', color: '#d97706', gacha: false },
  { id: 'f_lv80',     kind: 'frame', rarity: 'LR',  name: '伝説の枠', color: '#e2e8f0', gacha: false },
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
  { id: 't_grandmaster', kind: 'title', rarity: 'LR', name: 'グランドマスター', gacha: false },
  { id: 't_lv10', kind: 'title', rarity: 'R',   name: '村人',       gacha: false },
  { id: 't_lv20', kind: 'title', rarity: 'SR',  name: '騎士',       gacha: false },
  { id: 't_lv30', kind: 'title', rarity: 'SSR', name: '占い師',     gacha: false },
  { id: 't_lv50', kind: 'title', rarity: 'SSR', name: '長老',       gacha: false },
  { id: 't_lv80', kind: 'title', rarity: 'LR',  name: '伝説の棋士', gacha: false },
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
  { id: 'a_charall', name: '新キャラを全部集める',   stat: 'chars',   goal: 16,   coins: 3000, tokens: 5, item: 't_charall' },
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
// プレイヤーレベル(Lv1〜99)。経験値はサーバー側(jinro_wallets.exp)で管理し、RPC経由でだけ増える
// 次のレベルに必要な経験値 = 100 + (今のレベル - 1) × 20
export const EXP_GAIN = { onlineWin: 50, onlineLose: 20, cpuWin: { easy: 10, normal: 20, hard: 30 }, cpuLose: 5, story: 100, storyBoss: 200 };
export const lvNeed = lv => 100 + (lv - 1) * 20;                                   // レベルlv→lv+1 に必要な経験値
export const lvTotal = lv => (lv - 1) * 100 + 10 * (lv - 1) * (lv - 2);            // レベルlv到達までの累計
export function levelOf(exp) { let lv = 1; while (lv < 99 && exp >= lvTotal(lv + 1)) lv++; return lv }
export const lvProgress = exp => { const lv = levelOf(exp); return lv >= 99 ? { lv, into: 0, need: 0, pct: 100 } : { lv, into: exp - lvTotal(lv), need: lvNeed(lv), pct: Math.min(100, (exp - lvTotal(lv)) / lvNeed(lv) * 100) } };
export const LV_RANK_NAME = [[80, '伝説の棋士'], [50, '長老'], [30, '占い師'], [20, '騎士'], [10, '村人'], [1, '見習い']];
export const lvRankName = lv => (LV_RANK_NAME.find(([m]) => lv >= m) || [1, '見習い'])[1];
// 王様・人狼の光り方(旧ランク)はプレイヤーレベルに一本化: Lv5でR、15でSR、30でSSR、50でLR
export const pieceRankOfLv = lv => lv >= 50 ? 'LR' : lv >= 30 ? 'SSR' : lv >= 15 ? 'SR' : lv >= 5 ? 'R' : 'C';
export const LV_MILESTONES = [10, 20, 30, 50, 80];
