// キャラ素材 chara3（フラットなアニメイラスト調・正式版）と、その解放の仕組み。
// 画像はマル（素材担当）が chara3/ に置く。盤上の駒は従来どおり顔だけのSVG（CHARS[k].icon / ICON）のまま。
// 解放状態はこの端末に保存する（使用回数・キャラ別アチーブメントの進み具合）。

export const KEYS = ['king','wolf','villager','seer','hunter','knight','medium','tough','nekomata','teru','fox','thief','vampire','cursed'];
export const LR_KEYS = ['fox','thief','vampire','cursed'];
const DIR = 'chara3';

/** 画像の場所（全14体）。LRだけ豪華版あり */
export const ART = Object.fromEntries(KEYS.map(k => [k, {
  fullbody: `${DIR}/fullbody/char3-${k}.webp`,
  icon: `${DIR}/icons/icon3-${k}.webp`,
  expr: { angry: `${DIR}/expr/expr3-${k}-angry.webp`, surprise: `${DIR}/expr/expr3-${k}-surprise.webp`, shy: `${DIR}/expr/expr3-${k}-shy.webp` },
  prop: `${DIR}/props/prop3-${k}.webp`,
  ...(LR_KEYS.includes(k) ? { fullbodyLux: `${DIR}/fullbody/char3-${k}-lux.webp`, iconLux: `${DIR}/icons/icon3-${k}-lux.webp` } : {}),
}]));

export const EXPR_LABEL = { angry: '怒り', surprise: '驚き', shy: '照れ' };

/** ストーリー設定『月夜の盤上』（story.md より） */
export const PROFILE = {
  king:     { name: 'レオン王', alias: '満月を継ぐ若王', role: '王様', profile: 'ルナリアの若き王。月が欠け始めた異変にいち早く気づき、盤上儀式の開催を決断した。威厳を保ちながらも、身内を疑う苦しさに悩む。', ties: 'セラは直属の騎士、ノワールは宮廷占い師。ガロはかつて王を守った騎士団員だった。', line: '疑うための儀式ではない。信じ直すための儀式だ', intro: '月が欠ける異変に立ち向かう若き王。身内の中にいるという影を暴くため、盤上儀式の開催を宣言した。' },
  wolf:     { name: 'ガロ', alias: '月に吠える元騎士', role: '人狼', profile: '元騎士団員。古城で吸血鬼ヴァレンに噛まれ、人狼の呪いを受けた。満月が近づくと狼の姿と衝動に苦しむが、人を襲った記憶はない。', ties: 'セラの元同僚、カイトの旧友。ヴァレンに呪いを移された。', line: '月が……近い。頼む、俺を盤の外に出してくれ', intro: '吸血鬼に噛まれ、人狼の呪いを背負った元騎士。月に吠える発作に苦しみながら、身の潔白を証明しようとする。' },
  villager: { name: 'ミーア', alias: '夜道を照らす村娘', role: '村人', profile: 'ランタンを手に夜の村を見回る村娘。狼の影の目撃者であり、事件の発端を作った。臆病に見えて、真実を知ることを恐れない芯の強さがある。', ties: 'カイトの妹、ゴウの幼なじみ。', line: '私、見たんです。月より大きな、狼の影を', intro: '狼の影を目撃した村娘。兄の狩人カイトとともに、村を覆う影の正体を追う。' },
  seer:     { name: 'ノワール', alias: '星詠みの預言者', role: '占い師', profile: '王宮付きの占い師。「影は身内の中にいる」という予言で物語を動かした張本人。すべてを見通すような態度の裏で、妹ユエの身を案じている。', ties: 'ユエの姉。チャチャはかつての使い魔。', line: 'カードは嘘をつかない。嘘をつくのは、いつも人よ', intro: '「影は身内の中にいる」と予言した星詠みの占い師。その水晶玉は、盤上の嘘さえも映し出す。' },
  hunter:   { name: 'カイト', alias: '霧の森の追跡者', role: '狩人', profile: '村一番の狩人。狼の足跡を追ううちに、正体が旧友ガロである可能性に辿り着き、弓を引く手が鈍る。妹ミーアを守ることが何よりの使命。', ties: 'ミーアの兄、ゴウの相棒、ガロの旧友。', line: '足跡は消せても、匂いは消せない。……なあ、ガロ？', intro: '村を守る狩人。狼の正体が旧友だと知りながらも、妹と村のために弓を取り続ける。' },
  knight:   { name: 'セラ', alias: '王に誓う銀の騎士', role: '騎士', profile: '王直属の女性騎士。行方不明だった元同僚ガロを救うため、剣ではなく真実で戦おうとする。凛々しさと情の厚さを併せ持つ。', ties: 'レオンの直属、ガロの元同僚。', line: '私の剣は、斬るためじゃない。守るものを、間違えないためだ', intro: '王に仕える女性騎士。人狼となった元同僚ガロを救うため、盤上で真実を掴もうとする。' },
  fox:      { name: 'タマモ', alias: '神社に棲む千年の狐', role: '妖狐', profile: '月の欠片を祀る神社の主。千年生きる妖狐で、呪いの歴史をすべて知っている。人を試すような言動が多いが、王国の行く末を静かに見守る。', ties: 'ユエは仕える霊媒師。チャチャとは古い知り合い。', line: 'ふふ、人の世はいつも同じ。月が欠けると、まず隣人を疑う', intro: '神社に棲む千年の妖狐。月の欠片の番人であり、すべての呪いの出どころを知る者。' },
  medium:   { name: 'ユエ', alias: '死者の声を聞く巫女', role: '霊媒師', profile: '神社の霊媒師。死者の最期の声を聞く力で、事件の手がかりを掴んだ。姉ノワールとは違う方法で、同じ真実に近づいていく。', ties: 'ノワールの妹、タマモに仕える。', line: '死んだ人は、嘘をつけません。だから私が、代わりに伝えます', intro: '死者の声を聞く霊媒師。その力は、隠れた人狼の痕跡さえも静かに暴き出す。' },
  tough:    { name: 'ゴウ', alias: '村の鉄腕用心棒', role: 'タフガイ', profile: '村の鍛冶屋で用心棒。腕っぷしと面倒見の良さで村の誰からも頼られる。頭を使う勝負は苦手だが、盤上ではその真っ直ぐさが嘘を崩す。', ties: 'ミーアの幼なじみ、カイトの相棒。', line: '難しいことはわかんねえ。でも、嘘つく奴の顔はわかる！', intro: '村の用心棒で鍛冶屋。怪力と真っ直ぐな勘で、盤上の嘘を力ずくで打ち砕く。' },
  nekomata: { name: 'チャチャ', alias: '祭りを駆ける情報屋', role: '猫又', profile: '占い師ノワールの元使い魔の猫又。今は神社と村と城を行き来し、あらゆる噂を運ぶ情報屋。誰の味方かは、最後まで分からない。', ties: 'ノワールの元使い魔、タマモの古い知り合い。', line: 'にゃはは、その秘密、鈴3つ分で売ってあげる', intro: '村と城と神社を駆け回る猫又の情報屋。その耳は、盤上の小さな嘘も聞き逃さない。' },
  teru:     { name: 'ヒナ', alias: '晴れを呼ぶ少女', role: 'てるてる', profile: '怪盗レイヴンの妹。雨を晴らす不思議な力を持つが、月の光を浴びないと衰弱してしまう。月の欠片と共鳴する力が、物語の鍵になる。', ties: 'レイヴンの妹。', line: '大丈夫、私が晴れにしてみせる。だからお兄ちゃん、もう盗まないで', intro: '晴れを呼ぶ力を持つ少女。月の欠片と共鳴するその力が、呪いを解く鍵になる。' },
  thief:    { name: 'レイヴン', alias: '月下の大怪盗', role: '怪盗', profile: '月の欠片を盗んだ張本人。だが目的は金ではなく、衰弱する妹ヒナを救うこと。華麗な手口と裏腹に、家族思いの兄。', ties: 'ヒナの兄。ヴァレンの城から欠片を盗んだ。', line: 'お宝は頂いた。……だが、返しに来るのも悪くない', intro: '月の欠片を盗んだ大怪盗。その盗みが事件の引き金となったが、理由は妹を救うためだった。' },
  vampire:  { name: 'ヴァレン', alias: '古城の孤独な主', role: '吸血鬼', profile: '古城に棲む吸血鬼。ガロを噛み人狼の呪いを移したが、彼自身もまた、百年前から呪いに縛られている。呪いを移すことでしか生き延びられなかった。', ties: 'ガロを噛んだ張本人。ルカの家系の呪いと関わる。', line: '私は呪いを作ってはいない。ただ、逃げ続けてきただけだ', intro: '古城の主である吸血鬼。人狼の呪いを移した張本人だが、彼自身も呪いの連鎖の被害者だった。' },
  cursed:   { name: 'ルカ', alias: '鎖に縛られた末裔', role: '呪われた者', profile: '呪いの起源となった家系の末裔。先祖が月の欠片を私物化しようとした罪で、一族は鎖の呪いを受けた。影のように生きてきたが、満月の決戦で運命が動く。', ties: 'ヴァレンの呪いと同根。ヒナの力が鎖を解く鍵になる。', line: 'この鎖は、僕の罪じゃない。でも、断ち切るのは僕でありたい', intro: '呪いの家系に生まれた青年。先祖の罪で受けた鎖の呪いを、自分の手で断ち切ろうとする。' },
};

export const WORLD = '月光が魔力を運ぶ王国ルナリア。都の神社には、満月の力を宿す宝珠「月の欠片」が祀られ、その加護で王国の月はいつも満ち、古い呪いは眠り続けていた。\nこの国では、王が代替わりする年に「盤上儀式」が行われる。月の加護を受けた者たちが駒に魂を宿し、将棋の盤の上で影の正体を暴き合う、神聖な裁きの儀式である。\n――ある年、満月が欠け始めた。欠片が盗まれたのだ。眠っていた呪いが目を覚まし、「人狼」が村に紛れ込んだ。若き王レオンは、真実を暴くため盤上儀式の開催を宣言する。';

/**
 * メインストーリー（3章）。text は story.md の本文。
 * scene は「ストーリー再生」用の場面：本文の流れに沿って、各キャラの公式セリフを表情つきで出す。
 */
export const STORY = [
  { title: '第一章「欠ける月」',
    text: '月が欠け始めて三月。村では夜な夜な家畜が襲われ、村娘ミーアが大きな狼の影を目撃する。王レオンは宮廷占い師ノワールに占わせる。出た予言は「影は、身内の中にいる」。王は盤上儀式の開催を決め、騎士セラ、狩人カイトら信頼できる者たちを集める。一方、神社の霊媒師ユエは、襲われた者の死の間際の声を聞いていた。「城……城の主が、笑っていた」と。',
    scene: [['villager', 'surprise'], ['seer', 'shy'], ['king', 'angry'], ['knight', 'angry'], ['medium', 'surprise']] },
  { title: '第二章「影の正体」',
    text: 'カイトと用心棒ゴウは狼の足跡を追い、古城の吸血鬼ヴァレンのもとへ辿り着く。だがヴァレンは言う。「私は噛んだだけだ。呪いを作ったのは、私ではない」。追い詰められた狼の正体は、行方不明だった元騎士団員ガロだった。セラは剣を震わせる。ガロは月に吠える発作に苦しみながらも、人を襲った記憶がないと訴えた。霊媒師ユエと妖狐タマモは告げる。すべての呪いの根は一つ、「月の欠片」を失ったことにあるのだと。そして欠片を盗んだ怪盗レイヴンが、満月の夜に再び姿を現す。',
    scene: [['hunter', 'angry'], ['tough', 'angry'], ['vampire', 'shy'], ['wolf', 'surprise'], ['fox', 'shy'], ['thief', 'surprise']] },
  { title: '第三章「満月の決戦」',
    text: 'レイヴンの狙いは金ではなかった。月の光を浴びないと衰弱する妹ヒナを救うため、欠片の力が必要だったのだ。ヒナの「晴れを呼ぶ力」は欠片と共鳴し、呪いの鎖に縛られた青年ルカの鎖を震わせる。呪いの起源は、百年前に欠片を私物化しようとしたルカの先祖の罪だった。満月が最も欠ける夜、全員が盤上に集う。対局そのものが儀式となり、影の本体――呪いそのものと決戦する。ヒナが晴らした空に欠片が戻り、月は再び満ちる。ガロの呪いは解け、ルカの鎖は砕け、ヴァレンは百年ぶりに月明かりを浴びた。',
    scene: [['thief', 'shy'], ['teru', 'shy'], ['cursed', 'angry'], ['nekomata', 'surprise'], ['king', 'shy']] },
];

/** 使用回数ラダー（unlock-spec.md・たたき台） */
export const LADDER = [
  { n: 1, key: 'icon', label: '顔アイコン' },
  { n: 10, key: 'expr', label: '表情3種' },
  { n: 25, key: 'prop', label: 'リアクション道具' },
  { n: 50, key: 'full', label: '全身イラスト' },
];

/**
 * キャラ別アチーブメント（unlock-spec.md・たたき台）。stat は数える出来事。
 * てるてる：追加の1手では駒を取れないルールのため「追加の1手を得た回数」に調整。
 */
export const CHARA_ACH = {
  king:     { stat: 'wins',        goal: 50, label: '王様を編成して50勝' },
  wolf:     { stat: 'wolfCounter', goal: 20, label: '人狼の返り討ちを20回成功させる' },
  villager: { stat: 'wins',        goal: 30, label: '村人を編成して30勝' },
  seer:     { stat: 'seerWolf',    goal: 20, label: '占い師で隠れた人狼を20回取る' },
  hunter:   { stat: 'wins',        goal: 30, label: '狩人を編成して30勝' },
  knight:   { stat: 'wins',        goal: 30, label: '騎士を編成して30勝' },
  fox:      { stat: 'foxWolf',     goal: 15, label: '妖狐で隠れた人狼を15回取る' },
  medium:   { stat: 'uses',        goal: 50, label: '霊媒師を編成して50戦' },
  tough:    { stat: 'toughEndure', goal: 20, label: '取られる場面で耐えることに20回成功する' },
  nekomata: { stat: 'nekoDrag',    goal: 15, label: '道連れを15回成功させる' },
  teru:     { stat: 'teruExtra',   goal: 20, label: 'てるてるの力で追加の1手を20回得る' },
  thief:    { stat: 'thiefWin',    goal: 15, label: '変身した状態で15勝' },
  vampire:  { stat: 'bite',        goal: 10, label: '噛みつきを10回成功させる' },
  cursed:   { stat: 'cursedTurn',  goal: 10, label: '人狼に寝返ることに10回成功する' },
};

/* ===== 保存（この端末） ===== */
const SKEY = 'jinro-chara3';
function loadAll() {
  try { return JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; } catch (e) { return {}; }
}
function saveAll(d) {
  try { localStorage.setItem(SKEY, JSON.stringify(d)); } catch (e) { /* noop */ }
}
function blank() { return { uses: 0, wins: 0, ev: {}, ach: false }; }
export function progressOf(k) {
  const d = loadAll()[k];
  return { ...blank(), ...(d || {}), ev: { ...(d?.ev || {}) } };
}
function statValue(k, p) {
  const a = CHARA_ACH[k];
  if (!a) return 0;
  if (a.stat === 'uses') return p.uses;
  if (a.stat === 'wins') return p.wins;
  return p.ev[a.stat] || 0;
}

/** いま使える素材 */
export function unlocks(k) {
  const p = progressOf(k);
  const lr = LR_KEYS.includes(k);
  return {
    uses: p.uses,
    icon: p.uses >= 1,
    expr: p.uses >= 10,
    prop: p.uses >= 25,
    full: p.uses >= 50,
    ach: !!p.ach,
    lux: lr && !!p.ach,        // LR：豪華版の全身・アイコン
    gold: !lr && !!p.ach,      // それ以外：金フレームのアイコン
    achValue: Math.min(statValue(k, p), CHARA_ACH[k]?.goal ?? 0),
    achGoal: CHARA_ACH[k]?.goal ?? 0,
  };
}

/** 次に解放されるもの（「あと○回で表情3種」など） */
export function nextLadder(k) {
  const u = progressOf(k).uses;
  const nx = LADDER.find(x => u < x.n);
  return nx ? { ...nx, left: nx.n - u } : null;
}

/**
 * 1局終わったときに呼ぶ。deck = 自分の編成（6体）、won = 勝ったか、
 * ev = この対局の自分の出来事 { wolfCounter: 2, ... }、thiefWin = 変身したまま勝ったか。
 * 新しく解放されたものの一覧を返す（リザルトで通知する）。
 */
export function recordGame({ deck, won, ev = {}, thiefWin = false }) {
  const all = loadAll();
  const news = [];
  for (const k of new Set(deck)) {
    if (!KEYS.includes(k)) continue;
    const before = unlocks(k);
    const p = { ...blank(), ...(all[k] || {}) };
    p.ev = { ...(p.ev || {}) };
    p.uses += 1;
    if (won) p.wins += 1;
    const stat = CHARA_ACH[k]?.stat;
    if (stat && !['uses', 'wins', 'thiefWin'].includes(stat) && ev[stat]) p.ev[stat] = (p.ev[stat] || 0) + ev[stat];
    if (k === 'thief' && won && thiefWin) p.ev.thiefWin = (p.ev.thiefWin || 0) + 1;
    all[k] = p;
    saveAll(all);
    if (!p.ach && statValue(k, p) >= (CHARA_ACH[k]?.goal ?? Infinity)) { p.ach = true; all[k] = p; saveAll(all); }
    const after = unlocks(k);
    for (const x of LADDER) if (!before[x.key] && after[x.key]) news.push({ k, what: x.key, label: x.label });
    if (!before.ach && after.ach) news.push({ k, what: after.lux ? 'lux' : 'gold', label: after.lux ? '豪華版の全身イラスト・アイコン' : '金フレームのアイコン' });
  }
  return news;
}

/* ===== 表示用 ===== */
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/** 遅延読み込みの画像。読めなかったら消す（代わりの見た目は親要素側） */
export function lazyImg(src, alt, cls = '') {
  return `<img class="${cls}" src="${src}" alt="${esc(alt)}" loading="lazy" decoding="async" onload="this.parentNode&&this.parentNode.classList.add('hasimg')" onerror="this.remove()">`;
}

/** 顔アイコン（解放済みなら画像、未解放なら fallback = 駒SVG）。gold/lux を反映 */
export function faceIcon(k, fallbackHtml, { cls = '', force = null } = {}) {
  const u = force || unlocks(k);
  const a = ART[k];
  if (!a || !u.icon) return `<span class="face ${cls}">${fallbackHtml}</span>`;
  const src = u.lux && a.iconLux ? a.iconLux : a.icon;
  return `<span class="face img ${u.gold ? 'gold' : ''} ${u.lux ? 'lux' : ''} ${cls}">${fallbackHtml}${lazyImg(src, PROFILE[k]?.name || k)}</span>`;
}

/** 全身イラスト。未解放はシルエット */
export function fullbodyImg(k, { cls = '', silhouetteIfLocked = true } = {}) {
  const u = unlocks(k);
  const a = ART[k];
  if (!a) return '';
  const src = u.lux && a.fullbodyLux ? a.fullbodyLux : a.fullbody;
  const locked = !u.full && silhouetteIfLocked;
  return `<span class="fullbody ${locked ? 'locked' : ''} ${u.lux ? 'lux' : ''} ${cls}">${lazyImg(src, PROFILE[k]?.name || k)}${locked ? '<span class="lockmark">？？？</span>' : ''}</span>`;
}

/* ===== 日曜限定ガチャの8体(紹介文はマルのたたき台を調整。全身イラストは本人経由で届き次第 chara3/fullbody/ に置く) ===== */
export const EXTRA_KEYS = ['madman','wolfboy','detective','gravekeeper','bodyguard','witch','ninja','cupid'];
for (const k of EXTRA_KEYS) {
  if (!KEYS.includes(k)) KEYS.push(k);
  ART[k] = { fullbody: `${DIR}/fullbody/char3-${k}.webp`, icon: `${DIR}/icons/icon3-${k}.webp`, expr: {}, prop: null, extra: true };
}
Object.assign(PROFILE, {
  madman:      { name: 'ジェスター', alias: '仮面で笑う道化', role: '狂人', profile: '人狼の仮面を手に、ニヤリと笑う村人。人狼の味方なのか、ただ騒ぎを楽しんでいるだけなのか、本人にもわからない。', ties: '人狼ガロに妙に肩入れしている。', line: 'ほら、狼はここだよ。……たぶんね', intro: '人狼の仮面を手にニヤリと笑う村人。人狼のふりをして、盤上をかき乱す。' },
  wolfboy:     { name: 'ピコ', alias: '王冠をかぶった嘘つき', role: '狼少年', profile: 'おもちゃの王冠と舌出しがトレードマークの羊飼いの少年。嘘をつくのが得意で、村ではもう誰も信じてくれない。', ties: 'ミーアの羊をよく逃がしている。', line: 'ぼくが王様だよ！ ……ほんとだってば！', intro: 'おもちゃの王冠と舌出しがトレードマークの、嘘つき羊飼い。王様のふりで相手をだます。' },
  detective:   { name: 'シャール', alias: '証拠を追う名探偵', role: '探偵', profile: '虫めがねと鹿撃ち帽の探偵。勘より証拠を信じ、静かに一枚ずつ真実をめくっていく。', ties: '占い師ノワールとは、やり方の違いでよく張り合う。', line: '推理に必要なのは、予言ではなく証拠です', intro: '虫めがねと鹿撃ち帽の冷静な推理役。隣の駒の正体を、証拠でこっそり見抜く。' },
  gravekeeper: { name: 'モルグ', alias: 'ランタンを持つ墓地の番人', role: '墓守', profile: 'ランタンとスコップを携えた、物静かな墓地の番人。倒れた者が誰に倒されたのか、決して忘れない。', ties: '霊媒師ユエと、ときどき墓地で言葉を交わす。', line: '倒れた者は語らない。だから、私が覚えておく', intro: 'ランタンとスコップを携えた墓地の番人。味方を倒した駒の正体を暴く。' },
  bodyguard:   { name: 'ガイ', alias: '大盾の護衛', role: 'ボディーガード', profile: 'サングラスと大盾の護衛。守ると決めた相手は、何があっても渡さない。', ties: '若き王レオンの影の護衛と噂されている。', line: '下がってろ。ここから先は、俺の仕事だ', intro: 'サングラスと大盾の護衛。隣の味方が狙われたとき、一度だけ身代わりになる。' },
  witch:       { name: 'リリス', alias: '宝石をまとう夜の魔女', role: '魔女', profile: '金の装飾と宝石で身を飾る、いたずら好きの魔女。倒れた者を呼び戻す禁じられた魔法を、気まぐれに使う。', ties: '妖狐タマモとは、古くからの飲み友達。', line: 'あら、もう終わり？ じゃあ、もう一度はじめましょう', intro: '宝石をまとういたずら好きの魔女。取られた味方を一度だけ盤上に呼び戻し、戦況をひっくり返す。' },
  ninja:       { name: 'カゲマル', alias: '月夜を跳ぶ影', role: '忍者', profile: '月夜の屋根を跳ぶ黒装束の忍び。手裏剣の名手で、気づいたときにはもう背後にいる。', ties: '怪盗レイヴンとは、屋根の上で何度もすれ違っている。', line: '影は、跳ぶ。音もなく', intro: '月夜の屋根を跳ぶ黒装束、手裏剣の名手。一度だけ2マス先へ跳び、奇襲をかける。' },
  cupid:       { name: 'アモル', alias: '金の弓の天使', role: 'キューピッド', profile: '金の弓とハートの矢を持つ、宝石を散りばめた天使。射抜かれた者は恋に落ち、しばらく何も手につかない。', ties: '呪われた者ルカの鎖を、恋の力で解けないか試している。', line: '恋に落ちたら、戦いどころじゃないでしょ？', intro: '金の弓とハートの矢を持つ、豪華な天使。恋の矢で相手の駒を2手番のあいだ動けなくする。' },
});
Object.assign(CHARA_ACH, {
  madman: { stat: 'wins', goal: 30, label: '狂人を編成して30勝' }, wolfboy: { stat: 'wins', goal: 30, label: '狼少年を編成して30勝' },
  detective: { stat: 'wins', goal: 30, label: '探偵を編成して30勝' }, gravekeeper: { stat: 'wins', goal: 30, label: '墓守を編成して30勝' },
  bodyguard: { stat: 'wins', goal: 30, label: 'ボディーガードを編成して30勝' }, witch: { stat: 'wins', goal: 30, label: '魔女を編成して30勝' },
  ninja: { stat: 'wins', goal: 30, label: '忍者を編成して30勝' }, cupid: { stat: 'wins', goal: 30, label: 'キューピッドを編成して30勝' },
});
