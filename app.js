import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { ART, KEYS as C3KEYS, LR_KEYS, PROFILE, STORY, WORLD, LADDER, CHARA_ACH, EXPR_LABEL, unlocks, nextLadder, recordGame, faceIcon, fullbodyImg, lazyImg, artStyle, setArtStyle, setOwnedChars } from "./chara3.js";
import { CHARS, BANNERS, bannerOfDay, BASE_RARITY, EXP, RANKS, ITEMS, ITEM, ACH_ITEMS, ACHIEVEMENTS, DEFAULT_STAMPS, MISSIONS, RATES, REFUND, TOKEN_REFUND, TOKEN_COST, COST, RARITY_LABEL, RARITY_ORDER, KIND_LABEL, LOGIN } from "./catalog.js";

/* ===== rules data ===== */
const BASE = ['king','wolf','villager','seer','hunter','knight'];
const NEWC = Object.keys(CHARS);
const SWAP_BASE = ['villager','seer','hunter','knight'];
const T={
  king:{nm:'王様',d:'全方向に1マス。取られたら負け。',m:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]},
  wolf:{nm:'人狼',d:'前3方向・左右・真後ろに1マス。隠れている間は駒を取れないが、取りに来た駒を返り討ちにする。',m:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,0]]},
  villager:{nm:'村人',d:'前に1マス。',m:[[-1,0]]},
  seer:{nm:'占い師',d:'前に1マス。隠れている人狼も取れる。',m:[[-1,0]]},
  hunter:{nm:'狩人',d:'斜め4方向に1マス。',m:[[-1,-1],[-1,1],[1,-1],[1,1]]},
  knight:{nm:'騎士',d:'上下左右に1マス。',m:[[-1,0],[1,0],[0,-1],[0,1]]},
  ...Object.fromEntries(NEWC.map(k=>[k,{nm:CHARS[k].nm,d:CHARS[k].d,m:CHARS[k].m}]))
};
const CHAR_ITEM = Object.fromEntries(ITEMS.filter(i=>i.kind==='char').map(i=>[i.char,i]));
const PRESETS=[
  {name:'突撃',a:['villager','seer','knight','wolf','hunter','king']},
  {name:'人狼を前',a:['wolf','villager','seer','knight','hunter','king']},
  {name:'王様を前',a:['king','villager','seer','knight','hunter','wolf']}
];
const NAME=['先手','後手'];
const MAIN=120,BYO=10;
const esc=s=>String(s??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const clone=o=>JSON.parse(JSON.stringify(o));
const toAbs=(v,r,c)=>v===0?[r,c]:[4-r,2-c];
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

/* ===== engine ===== */
function buildBoard(setups){
  const b=[...Array(5)].map(()=>Array(3).fill(null));
  for(let p=0;p<2;p++)setups[p].forEach((t,i)=>{
    const front=i<3,col=i%3;
    const r=p===0?(front?3:4):(front?1:0),c=p===0?col:2-col;
    b[r][c]={owner:p,type:t,revealed:false};
  });
  return b;
}
const DEFAULT_RULES={time:0,drops:false,promote:false,reveal:false,try:true,chars:true};
const TIME_OPTS=[[0,'なし'],[60,'1分'],[180,'3分'],[300,'5分']];
const TOGGLES=[
  ['chars','新キャラ','ガチャで手に入れた新キャラを編成に入れられる'],
  ['drops','持ち駒','取った駒を空いているマスに打てる'],
  ['promote','村人の成り','村人が相手の一番奥の段に着くと騎士になる'],
  ['reveal','取った駒の正体','相手の駒を取った駒は、正体が相手に公開される'],
  ['try','トライ勝ち','王様が相手の一番奥の段に着いたら勝ち(次の手で取られる位置なら無効)']
];
const rulesOf=G=>{const r=G?.rules||{};return{time:r.time??MAIN,drops:r.drops??true,promote:!!r.promote,reveal:!!r.reveal,try:!!r.try,chars:r.chars??true}};
function rulesText(r){
  const t=r.time?((TIME_OPTS.find(x=>x[0]===r.time)||[0,Math.round(r.time/60)+'分'])[1]):'なし';
  const extra=[r.chars&&'新キャラ',r.promote&&'村人の成り',r.reveal&&'正体公開',r.try&&'トライ勝ち'].filter(Boolean);
  return`持ち時間 ${t}・持ち駒 ${r.drops?'あり':'なし'}${extra.length?'・'+extra.join('・'):''}`;
}
// 新キャラなしのルールなのに新キャラが入っていたら、空いている基本の駒に置きかえる
function sanitizeDeck(d,R){
  d=(Array.isArray(d)&&d.length===6?d:PRESETS[0].a).slice();
  if(R.chars)return d;
  const free=SWAP_BASE.filter(t=>!d.includes(t));
  return d.map(t=>NEWC.includes(t)?free.shift()||'villager':t);
}
// 対局中の出来事(キャラ別アチーブメント用)。p = その出来事を起こした側
const evPush=(G,p,e)=>{(G.ev=G.ev||[]).push({p,e})};
function newGame(setups,rules){const r={...DEFAULT_RULES,...(rules||{})};const decks=setups.map(s=>sanitizeDeck(s,r));return{decks,ev:[],board:buildBoard(decks),hands:[[],[]],turn:0,last:null,rules:r,time:[r.time,r.time],winner:null,reason:'',skip:null}}
function targets(G,r,c){
  const P=G.board[r][c],out=[],s=P.owner===0?1:-1;
  if(P.charm>0)return out;   // キューピッドの恋の矢で動けない
  for(const[dy,dx]of T[P.type].m){
    const nr=r+dy*s,nc=c+dx*s;
    if(nr<0||nr>4||nc<0||nc>2)continue;
    const Q=G.board[nr][nc];
    if(Q&&Q.owner===P.owner)continue;
    if(Q&&P.type==='wolf'&&!P.revealed)continue;
    if(Q&&G.noCap===P.owner)continue;
    out.push([nr,nc]);
  }
  return out;
}
// 取られて持ち駒になるときの姿(成った村人は村人に、変身した怪盗は怪盗に戻る)
const baseType=P=>P.orig||(P.promoted?'villager':P.type);
const backRow=owner=>owner===0?0:4;
// 次の手番。てるてるの力で相手が1回休みになることがある
// 追加の1手(G.noCap)は移動だけ。駒を取ったり噛みついたりはできない
function nextTurn(G){let n=1-G.turn;if(G.skip===n){G.skip=null;n=G.turn;G.noCap=n}return n}
function attacked(G,r,c,by){
  for(let y=0;y<5;y++)for(let x=0;x<3;x++){const P=G.board[y][x];if(P&&P.owner===by&&targets(G,y,x).some(([a,b])=>a===r&&b===c))return true}
  return false;
}
function afterMove(G,A,nr,nc,out){
  const R=rulesOf(G),me=A.owner;
  if(R.promote&&A.type==='villager'&&!A.orig&&nr===backRow(me)){A.type='knight';A.promoted=true;out.res+=' 村人が奥まで進み、騎士になりました。'}
  if(G.winner==null&&R.try&&A.type==='king'&&nr===backRow(me)){
    if(!attacked(G,nr,nc,1-me)){G.winner=me;G.reason='トライ成功。王様が相手の陣地の一番奥にたどり着きました'}
    else out.res+=' 王様が奥の段に着きましたが、取られる位置なのでトライにはなりません。';
  }
  return out;
}
function applyMove(G,r,c,nr,nc){
  G.noCap=null;
  const B=G.board,A=B[r][c],Q=B[nr][nc],me=A.owner,op=1-me,R=rulesOf(G);tickCharm(G,me);
  if(!Q){B[nr][nc]=A;B[r][c]=null;G.last={from:[r,c],to:[nr,nc],kind:'move'};return afterMove(G,A,nr,nc,{res:'駒を動かしました。',note:'相手が駒を動かしました。'})}
  const an=T[A.type].nm,qn=T[Q.type].nm;
  // 隠れた人狼の返り討ち(占い師と妖狐には効かない)
  if(Q.type==='wolf'&&!Q.revealed&&A.type!=='seer'&&A.type!=='fox'){
    B[r][c]=null;Q.revealed=true;G.last={from:[r,c],to:[nr,nc],kind:'counter'};evPush(G,op,'wolfCounter');
    let res=`返り討ち！ その駒は隠れた人狼でした。あなたの${an}は`,note=`あなたの人狼が相手の${an}を返り討ちにしました。人狼の正体が相手に知られました。`;
    if(A.type==='nekomata'){evPush(G,me,'nekoDrag');lose(G,A);lose(G,Q);B[nr][nc]=null;res+='消えましたが、猫又の道連れで人狼も消えました。';note+=' ただし猫又の道連れで、人狼も消えました。'}
    else if(A.type==='cursed'){evPush(G,me,'cursedTurn');B[r][c]=A;A.owner=op;A.shown=true;res+='消えずに、呪いで相手の駒に寝返りました。';note+=' 相手の呪われた者が、あなたの駒に寝返りました。'}
    else{lose(G,A);if(R.drops)G.hands[op].push(baseType(A));res+=R.drops?'相手の持ち駒になります。':'盤から取り除かれました。'}
    if(A.type==='teru'){evPush(G,me,'teruExtra');G.skip=op;res+=' てるてるの力で、もう1手続けて動けます。';note+=' てるてるの力で、相手がもう1手続けて動きます。'}
    if(A.type==='king'){G.winner=op;G.reason='王様が隠れた人狼に返り討ちにされました'}
    return{res,note,alert:true,bad:true};
  }
  // タフガイは1回だけ耐える
  if(Q.type==='tough'&&!Q.hurt){
    Q.hurt=true;Q.shown=true;G.last={from:[r,c],to:[nr,nc],kind:'counter'};evPush(G,op,'toughEndure');
    return{res:'取れなかった！ その駒はタフガイで、1回耐えました。次は取れます。',note:'あなたのタフガイが攻撃に耐えました。正体が相手に知られ、負傷しました。',alert:true,bad:true};
  }
  // ボディーガード:隣の味方が取られるとき、1回だけ身代わりになる
  const bg=Q.type==='bodyguard'?null:ADJ.map(([y,x])=>[nr+y,nc+x]).find(([y,x])=>inB(y,x)&&B[y][x]&&B[y][x].owner===op&&B[y][x].type==='bodyguard');
  if(bg){
    const Gd=B[bg[0]][bg[1]];B[bg[0]][bg[1]]=null;lose(G,Gd);if(R.drops)G.hands[me].push('bodyguard');G.last={from:[r,c],to:[nr,nc],kind:'counter'};
    return{res:'取れなかった！ 隣にいたボディーガードが身代わりになりました。',note:`あなたのボディーガードが身代わりになり、${qn}を守りました。`,alert:true,bad:true};
  }
  if(Q.type==='wolf'&&!Q.revealed){if(A.type==='seer')evPush(G,me,'seerWolf');else if(A.type==='fox')evPush(G,me,'foxWolf')}
  B[nr][nc]=A;B[r][c]=null;G.last={from:[r,c],to:[nr,nc],kind:'capture'};lose(G,Q);
  const mad=Q.type==='madman';   // 狂人は取られると人狼に見える
  let res=`相手の${mad?'人狼':qn}を取りました。`,note=`あなたの${qn}が取られました。${mad?'相手には人狼を取ったように見えています。':''}`;
  if(Q.type==='nekomata'){
    evPush(G,op,'nekoDrag');lose(G,A);B[nr][nc]=null;res+=' 猫又の道連れで、取った駒も消えました。';note+=` 猫又の道連れで、相手の${an}も消えました。`;
    if(A.type==='king'){G.winner=op;G.reason='王様が猫又に道連れにされました';return{res,note,alert:true,bad:true}}
  }else if(R.drops){G.hands[me].push(mad?'villager':baseType(Q));res+='持ち駒として打てます。'}
  // 墓守:盤上にいる間、味方を取った駒の正体がわかる
  if(B[nr][nc]===A&&hasOnBoard(G,op,'gravekeeper')&&!A.shown){A.shown=true;res+=' 墓守の力で、この駒の正体が相手に知られました。';note+=` 墓守の力で、取った駒が${an}だとわかりました。`}
  if(Q.type==='medium'&&B[nr][nc]===A){A.shown=true;res+=' 霊媒師の力で、この駒の正体が相手に知られました。';note+=` 霊媒師の力で、取った駒が${an}だとわかりました。`}
  if(Q.type==='teru'){evPush(G,op,'teruExtra');G.skip=me;res+=' てるてるの力で、相手がもう1手続けて動きます。';note+=' てるてるの力で、あなたはもう1手続けて動けます。'}
  if(A.type==='thief'&&Q.type!=='king'&&B[nr][nc]===A){A.orig='thief';A.type=Q.type;A.revealed=Q.type==='wolf';A.hurt=!!Q.hurt;res+=` 怪盗が${qn}に変身しました。`}
  else if(A.orig==='thief'&&Q.type!=='king'&&B[nr][nc]===A){A.type=Q.type;A.revealed=Q.type==='wolf';A.hurt=!!Q.hurt;res+=` 怪盗が${qn}に変身しました。`}
  if(R.reveal&&B[nr][nc]===A){A.shown=true;res+='この駒の正体は相手に公開されました。';note+=` 取った駒は${T[A.type].nm}です。`}
  if(Q.type==='king'){G.winner=me;G.reason='王様を取りました'}
  if(B[nr][nc]===A)return afterMove(G,A,nr,nc,{res,note,alert:true});
  return{res,note,alert:true};
}
// 吸血鬼の噛みつき:隣(8方向)の相手の駒を味方に変える。1局に1回
const ADJ=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const inB=(y,x)=>y>=0&&y<5&&x>=0&&x<3;
const canBite=P=>P&&P.type==='vampire'&&!P.bit;
// 取られて盤から消えた駒(魔女の復活に使う)
function lose(G,P){if(!P||P.type==='king')return;(G.lost||(G.lost=[[],[]]))[P.owner].push(baseType(P))}
function hasOnBoard(G,p,t){for(let r=0;r<5;r++)for(let c=0;c<3;c++){const P=G.board[r][c];if(P&&P.owner===p&&P.type===t)return true}return false}
// キューピッドの恋の矢:その持ち主が指すたびに1減る
function tickCharm(G,p){for(let r=0;r<5;r++)for(let c=0;c<3;c++){const P=G.board[r][c];if(P&&P.owner===p&&P.charm>0)P.charm--}}
// 1局に1回、手番を使う能力
const AB={
  vampire:{lb:'🦇 噛みつく',hint:'隣の相手の駒を味方に変える(王様・人狼には効かない)'},
  wolfboy:{lb:'👑 王様のふり',hint:'相手からは、この駒が王様に見えるようになる',self:true},
  detective:{lb:'🔍 調べる',hint:'隣の相手の駒1枚の正体を、自分だけ見る'},
  ninja:{lb:'💨 跳ぶ',hint:'上下左右に2マス先の空きマスへ跳ぶ(間は飛び越える)'},
  witch:{lb:'✨ 復活',hint:'取られた味方1枚を、自陣の手前2段の空きマスに戻す'},
  cupid:{lb:'💘 恋の矢',hint:'隣の相手の駒1枚を、2手番のあいだ動けなくする(王様には効かない)'},
};
const canAb=P=>!!(P&&AB[P.type]&&!(P.type==='vampire'?P.bit:P.used));
const seenBy=(P,v)=>!!(P.shown||(P.type==='wolf'&&P.revealed)||(P.seen&&P.seen[v]));
function abTargets(G,r,c){
  const P=G.board[r][c];if(!canAb(P)||G.noCap===P.owner)return[];
  const me=P.owner,adjE=ADJ.map(([y,x])=>[r+y,c+x]).filter(([y,x])=>inB(y,x)&&G.board[y][x]&&G.board[y][x].owner!==me);
  switch(P.type){
    case'vampire':return biteTargets(G,r,c);
    case'wolfboy':return P.fake?[]:[[r,c]];
    case'detective':return adjE.filter(([y,x])=>!seenBy(G.board[y][x],me));
    case'cupid':return adjE.filter(([y,x])=>G.board[y][x].type!=='king'&&!(G.board[y][x].charm>0));
    case'ninja':return[[-2,0],[2,0],[0,-2],[0,2]].map(([y,x])=>[r+y,c+x]).filter(([y,x])=>inB(y,x)&&!G.board[y][x]);
    case'witch':{if(!G.lost||!G.lost[me].length)return[];const rows=me===0?[3,4]:[0,1],out=[];for(const y of rows)for(let x=0;x<3;x++)if(!G.board[y][x])out.push([y,x]);return out}
  }
  return[];
}
function applyAbility(G,r,c,nr,nc){
  const A=G.board[r][c];if(A.type==='vampire')return applyBite(G,r,c,nr,nc);
  G.noCap=null;const me=A.owner;tickCharm(G,me);A.used=true;G.last={from:[r,c],to:[nr,nc],kind:'ab'};
  const Q=G.board[nr][nc],qn=Q?T[Q.type].nm:'';
  switch(A.type){
    case'wolfboy':A.fake='king';return{res:'王様のふりをしました。相手からは、この駒が王様に見えています。',note:'相手の駒が、王様だと名乗り出ました。',alert:true};
    case'detective':A.shown=true;(Q.seen||(Q.seen=[0,0]))[me]=1;return{res:`調べた！ その駒は${qn}でした(あなたにだけ見えます)。`,note:'相手の探偵に、駒を1枚調べられました。',alert:true};
    case'ninja':A.shown=true;G.board[nr][nc]=A;G.board[r][c]=null;return afterMove(G,A,nr,nc,{res:'忍者が跳びました。',note:'相手の忍者が2マス跳びました。',alert:true});
    case'witch':{A.shown=true;const t=G.lost[me].pop();G.board[nr][nc]={owner:me,type:t,revealed:false};return{res:`魔女の力で、${T[t].nm}が復活しました。`,note:'相手の魔女が、取られた駒を1枚復活させました。',alert:true}}
    case'cupid':A.shown=true;Q.charm=2;return{res:'恋の矢が命中！ その駒は2手番のあいだ動けません。',note:`あなたの${qn}が恋に落ちて、2手番のあいだ動けません。`,alert:true};
  }
  return{res:'',note:''};
}
function biteTargets(G,r,c){
  const P=G.board[r][c];if(!canBite(P)||G.noCap===P.owner)return[];
  return ADJ.map(([y,x])=>[r+y,c+x]).filter(([y,x])=>y>=0&&y<5&&x>=0&&x<3&&G.board[y][x]&&G.board[y][x].owner!==P.owner);
}
function applyBite(G,r,c,nr,nc){
  G.noCap=null;
  const A=G.board[r][c],Q=G.board[nr][nc];tickCharm(G,A.owner);
  A.bit=true;A.shown=true;G.last={from:[r,c],to:[nr,nc],kind:'bite'};
  if(Q.type==='king'||Q.type==='wolf'){
    Q.marked=true;
    return{res:'噛みつけなかった！ その駒は王様か人狼です(印が付きました)。吸血鬼の力は使い切りました。',note:'相手の吸血鬼が噛みつこうとしましたが、失敗しました。噛まれた駒が王様か人狼だと知られました。',alert:true,bad:true};
  }
  const qn=T[Q.type].nm;Q.owner=A.owner;Q.shown=true;evPush(G,A.owner,'bite');
  return{res:`噛みついた！ 相手の${qn}があなたの駒になりました。`,note:`相手の吸血鬼に噛まれ、あなたの${qn}が相手の駒になりました。`,alert:true};
}
function applyDrop(G,i,r,c){
  G.noCap=null;
  const me=G.turn,t=G.hands[me].splice(i,1)[0];tickCharm(G,me);
  G.board[r][c]={owner:me,type:t,revealed:false};G.last={to:[r,c],kind:'drop'};
  return{res:`${T[t].nm}を打ちました。相手からは正体が見えません。`,note:'相手が持ち駒を打ちました。'};
}
function decideTap(G,v,sel,r,c){
  const P=G.board[r][c];
  if(sel){
    if(sel.ab){if(abTargets(G,sel.r,sel.c).some(([x,y])=>x===r&&y===c))return{act:'ab',from:[sel.r,sel.c]};return{act:'sel',sel:null}}
    if(sel.hand!=null){if(!P)return{act:'drop',i:sel.hand}}
    else if(targets(G,sel.r,sel.c).some(([x,y])=>x===r&&y===c))return{act:'move',from:[sel.r,sel.c]};
  }
  return{act:'sel',sel:P&&P.owner===v&&!(sel&&sel.r===r&&sel.c===c)?{r,c}:null};
}
// 吸血鬼を選んでいるときの「噛みつく」ボタン
function abilityBar(G,sel){
  if(!sel||sel.hand!=null||sel.r==null)return'';
  const P=G.board[sel.r][sel.c];if(!canAb(P))return'';
  const ab=AB[P.type],n=abTargets(G,sel.r,sel.c).length;
  if(ab.self)return`<div class="bitebar"><button class="btn orange small" data-act="abSelf" ${n?'':'disabled'}>${ab.lb}(1局に1回)</button><span class="muted">${esc(ab.hint)}</span></div>`;
  return`<div class="bitebar"><button class="btn ${sel.ab?'danger':'orange'} small" data-act="bite" ${n?'':'disabled'}>${sel.ab?'やめる':ab.lb+'(1局に1回)'}</button><span class="muted">${n?(sel.ab?'光っているマスをタップ':esc(ab.hint)):'いまは使えません'}</span></div>`;
}


/* ===== 音(ガチャはマル制作のmp3、対局の音はその場で合成) ===== */
const SND={on:store.get('jinro-sound')!=='off',buf:{},ctx:null};
const SFX_FILES=['gacha_lever','capsule_drop','capsule_open','fanfare_ssr','fanfare_lr'];
function sfx(name){
  if(!SND.on)return;
  try{let a=SND.buf[name];if(!a){a=SND.buf[name]=new Audio(`sfx/${name}.mp3`);a.preload='auto'}
    const p=a.paused?a:a.cloneNode();p.volume=.7;p.currentTime=0;p.play().catch(()=>{})}catch(e){}
}
function sfxStop(name){const a=SND.buf[name];if(a){try{a.pause();a.currentTime=0}catch(e){}}}
function actx(){if(!SND.ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;SND.ctx=new C()}if(SND.ctx.state==='suspended')SND.ctx.resume();return SND.ctx}
function tone(f,t0,dur,{type='sine',vol=.25,to=null}={}){
  const c=actx();if(!c)return;const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+t0;
  o.type=type;o.frequency.setValueAtTime(f,t);if(to)o.frequency.exponentialRampToValueAtTime(to,t+dur);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.008);g.gain.exponentialRampToValueAtTime(.0005,t+dur);
  o.connect(g).connect(c.destination);o.start(t);o.stop(t+dur+.02);
}
function knock(t0,f=900,vol=.5){ // 駒を置く「コッ」
  const c=actx();if(!c)return;const t=c.currentTime+t0,n=c.sampleRate*.06,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,4);
  const src=c.createBufferSource(),bp=c.createBiquadFilter(),g=c.createGain();src.buffer=b;bp.type='bandpass';bp.frequency.value=f;bp.Q.value=4;g.gain.value=vol;
  src.connect(bp).connect(g).connect(c.destination);src.start(t);tone(f/5,t0,.09,{vol:.18});
}
function play(kind){
  if(!SND.on)return;
  if(kind==='move'||kind==='drop')knock(0);
  else if(kind==='capture'){knock(0,1100,.6);tone(660,.04,.12,{type:'triangle',vol:.16});tone(990,.1,.16,{type:'triangle',vol:.14})}
  else if(kind==='counter'){knock(0,500,.7);tone(220,.02,.35,{type:'sawtooth',vol:.12,to:110});tone(233,.02,.35,{type:'sawtooth',vol:.08,to:116})}
  else if(kind==='bite'){tone(880,0,.12,{type:'square',vol:.08,to:440});tone(300,.1,.3,{type:'sawtooth',vol:.1,to:150})}
  else if(kind==='win')[523,659,784,1047].forEach((f,i)=>tone(f,i*.12,.5,{type:'triangle',vol:.2}));
  else if(kind==='lose')[392,330,262,196].forEach((f,i)=>tone(f,i*.16,.5,{type:'sine',vol:.2}));
  else if(kind==='stamp')tone(700,0,.12,{vol:.18,to:1200});
  else if(kind==='tap')tone(520,0,.06,{type:'triangle',vol:.08});
}
let sndKey,sndWin=null;
function soundCheck(){
  let g=null,key,me=0;
  if(S.screen==='local'&&L&&L.G){g=L.G;key=g.last;me=L.cpu?0:-1}
  else if(S.screen==='online'&&O.game&&O.game.phase!=='setup'){g=O.game;key=g.moveNo;me=O.watch?-1:O.seat}
  if(!g){sndKey=undefined;sndWin=null;return}
  if(sndKey!==undefined&&key!==sndKey&&g.last)play(g.last.kind);
  if(g.winner!=null&&sndWin==null&&sndKey!==undefined)setTimeout(()=>play(me<0||g.winner===me?'win':'lose'),350);
  sndKey=key;sndWin=g.winner;
}
function soundBtn(){return`<button class="sndbtn" data-act="toggleSound" aria-label="音 ${SND.on?'オン':'オフ'}" aria-pressed="${SND.on}">${SND.on?'<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>':'<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="m17 9 5 6M22 9l-5 6"/></svg>'}</button>`}

/* ===== CPU(相手の駒の正体は見ない。見えない駒は「ありそうな駒」を何通りも仮定して読む) ===== */
const CPU_LV={easy:{nm:'やさしい',coin:3,depth:1,k:3,noise:3,rand:.35},normal:{nm:'ふつう',coin:5,depth:2,k:6,noise:.8,rand:0},hard:{nm:'つよい',coin:10,depth:3,k:10,noise:.1,rand:0}};
const VAL={king:0,wolf:7,seer:4,knight:4,hunter:4,villager:2,fox:7,thief:5,vampire:6,cursed:5,medium:3,tough:5,nekomata:4,teru:3};
function genMoves(G,p,limitDrops){
  const B=G.board,mv=[];
  for(let r=0;r<5;r++)for(let c=0;c<3;c++){const P=B[r][c];if(!P||P.owner!==p)continue;
    for(const[nr,nc]of targets(G,r,c))mv.push({k:'m',r,c,nr,nc});
    for(const[nr,nc]of abTargets(G,r,c))mv.push({k:'a',r,c,nr,nc});}
  if(rulesOf(G).drops&&G.hands[p].length){
    const seen=new Set(),emp=[];for(let r=0;r<5;r++)for(let c=0;c<3;c++)if(!B[r][c])emp.push([r,c]);
    G.hands[p].forEach((t,i)=>{if(seen.has(t))return;seen.add(t);let e=emp;if(limitDrops&&e.length>4)e=e.slice().sort(()=>Math.random()-.5).slice(0,4);e.forEach(([nr,nc])=>mv.push({k:'d',i,nr,nc}))});
  }
  return mv;
}
function playMove(G,m){
  const out=m.k==='m'?applyMove(G,m.r,m.c,m.nr,m.nc):m.k==='a'?applyAbility(G,m.r,m.c,m.nr,m.nc):applyDrop(G,m.i,m.nr,m.nc);
  if(G.winner==null)G.turn=nextTurn(G);
  return out;
}
function evalFor(G,c){
  if(G.winner!=null)return G.winner===c?1e4:-1e4;
  let s=0;const R=rulesOf(G);
  for(let r=0;r<5;r++)for(let x=0;x<3;x++){const P=G.board[r][x];if(!P)continue;const v=VAL[P.type]??3,sg=P.owner===c?1:-1;
    s+=sg*v;if(P.owner===c&&!P.shown&&!(P.type==='wolf'&&P.revealed))s+=.3;if(P.type==='wolf'&&!P.revealed)s+=sg*1.5;
    if(P.type==='king'&&R.try){const prog=P.owner===0?4-r:r;s+=sg*prog*.4}
    if(P.type==='tough'&&P.hurt)s-=sg*2;
    if(P.charm>0)s-=sg*1.2;if(P.owner!==c&&P.seen&&P.seen[c])s+=.4;if(P.owner===c&&P.fake)s+=.5;}
  if(G.lost&&G.lost[c].length&&hasOnBoard(G,c,'witch'))s+=1;
  if(R.drops)for(const p of[0,1])for(const t of G.hands[p])s+=(p===c?1:-1)*(VAL[t]??3)*.6;
  // 王様が取られそう
  for(const p of[0,1]){let kr=-1,kc=-1;for(let r=0;r<5;r++)for(let x=0;x<3;x++){const P=G.board[r][x];if(P&&P.owner===p&&P.type==='king'){kr=r;kc=x}}
    if(kr>=0&&attacked(G,kr,kc,1-p))s+=(p===c?-1:1)*(G.turn===p?3:40);}
  return s;
}
// 見えない相手の駒に、ありそうな正体を割り当てる
function determinize(G,c){
  const D=clone(G),pool=[...SWAP_BASE,...(rulesOf(G).chars?NEWC:[])];const unk=[],known=new Set();
  for(let r=0;r<5;r++)for(let x=0;x<3;x++){const P=D.board[r][x];if(!P||P.owner===c)continue;
    if(P.fake&&!(P.seen&&P.seen[c])){P.type='king';known.add('king');continue}   // 王様のふりはCPUもだまされる
    if(P.shown||(P.type==='wolf'&&P.revealed)||(P.seen&&P.seen[c]))known.add(P.type);else unk.push(P);}
  const bag=[];if(!known.has('king'))bag.push('king');if(!known.has('wolf')&&Math.random()<.75)bag.push('wolf');
  const rest=pool.filter(t=>!known.has(t)).sort(()=>Math.random()-.5);
  while(bag.length<unk.length)bag.push(rest.length?rest.pop():'villager');
  bag.length=unk.length;bag.sort(()=>Math.random()-.5);
  // 王様は必ず盤上にいる
  if(!known.has('king')&&unk.length&&!bag.includes('king'))bag[0]='king';
  unk.forEach((P,i)=>{P.type=bag[i];P.revealed=false;delete P.orig});
  return D;
}
function search(G,d,c,alpha,beta){
  if(G.winner!=null||d===0)return evalFor(G,c)*(G.winner!=null?1+d*.01:1);
  const p=G.turn,ms=genMoves(G,p,true);if(!ms.length)return evalFor(G,c);
  if(p===c){let best=-Infinity;for(const m of ms){const H=clone(G);playMove(H,m);best=Math.max(best,search(H,d-1,c,alpha,beta));alpha=Math.max(alpha,best);if(alpha>=beta)break}return best}
  let best=Infinity;for(const m of ms){const H=clone(G);playMove(H,m);best=Math.min(best,search(H,d-1,c,alpha,beta));beta=Math.min(beta,best);if(alpha>=beta)break}return best;
}
function cpuChoose(G,c,level){
  const L2=CPU_LV[level]||CPU_LV.normal,ms=genMoves(G,c,false);if(!ms.length)return null;
  if(Math.random()<L2.rand){const caps=ms.filter(m=>m.k==='m'&&G.board[m.nr][m.nc]),pool=caps.length&&Math.random()<.5?caps:ms;return pool[Math.floor(Math.random()*pool.length)]}
  const t0=Date.now(),score=new Array(ms.length).fill(0);let k=0;
  for(;k<L2.k;k++){const D=determinize(G,c);ms.forEach((m,i)=>{const H=clone(D);H.turn=c;playMove(H,m);score[i]+=search(H,L2.depth-1,c,-Infinity,Infinity)});if(Date.now()-t0>1500)break}
  let bi=0,bv=-Infinity;score.forEach((v,i)=>{const x=v/(k+1)+(Math.random()-.5)*L2.noise*2;if(x>bv){bv=x;bi=i}});
  return ms[bi];
}
function cpuDeck(level,rules){
  const base=['villager','seer','knight','hunter'];shuffle(base);
  const a=['king','wolf',...base];
  if(level==='hard'&&rules.chars){const nc=NEWC.slice();shuffle(nc);a[4]=nc[0];a[5]=nc[1]}
  // 前列3つ・後列3つ。王様は後列、人狼は前列寄り
  const front=[a[1],a[2],a[3]],back=[a[4],a[5],a[0]];shuffle(front);shuffle(back);
  return[...front,...back];
}
function shuffle(ar){for(let i=ar.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ar[i],ar[j]]=[ar[j],ar[i]]}}
function shuffleDeck(ar){shuffle(ar);return ar}

/* ===== views: pieces ===== */
const D='#232838';
const ICON={
  king:`<path d="M8 33 L10 13 L18 22 L24 9 L30 22 L38 13 L40 33 Z" fill="#f7c948" stroke="${D}" stroke-width="2.4" stroke-linejoin="round"/><rect x="8" y="33" width="32" height="6" rx="1.5" fill="#e3a924" stroke="${D}" stroke-width="2.4"/><circle cx="24" cy="26" r="2.8" fill="#e5484d" stroke="${D}" stroke-width="1.6"/><circle cx="16" cy="28.5" r="1.9" fill="#3aa0e0"/><circle cx="32" cy="28.5" r="1.9" fill="#3aa0e0"/>`,
  wolf:`<path d="M9 7 L18 17 H30 L39 7 L40 25 Q40 37 24 42 Q8 37 8 25 Z" fill="#8b93a7" stroke="${D}" stroke-width="2.4" stroke-linejoin="round"/><path d="M12 12 L17 18 L13 20 Z M36 12 L31 18 L35 20 Z" fill="${D}"/><path d="M17 29 L24 39 L31 29 Q24 25 17 29 Z" fill="#eef0f5" stroke="${D}" stroke-width="1.8" stroke-linejoin="round"/><path d="M21.5 34 H26.5 L24 37 Z" fill="${D}"/><path d="M13 23.5 L20.5 25.5 L15 27.5 Z M35 23.5 L27.5 25.5 L33 27.5 Z" fill="#ffd34d" stroke="${D}" stroke-width="1.2" stroke-linejoin="round"/>`,
  villager:`<path d="M6 24 L24 8 L42 24 Z" fill="#d0583e" stroke="${D}" stroke-width="2.4" stroke-linejoin="round"/><rect x="11" y="23" width="26" height="17" fill="#f3dfb6" stroke="${D}" stroke-width="2.4"/><rect x="21" y="29" width="7" height="11" fill="#8a5a2b" stroke="${D}" stroke-width="1.6"/><rect x="13.5" y="27" width="5" height="5" fill="#7cc4f0" stroke="${D}" stroke-width="1.4"/><rect x="30" y="27" width="5" height="5" fill="#7cc4f0" stroke="${D}" stroke-width="1.4"/>`,
  seer:`<path d="M24 4 V9 M12 7 L15.5 11.5 M36 7 L32.5 11.5" stroke="${D}" stroke-width="2.4" stroke-linecap="round"/><path d="M4 27 Q24 10 44 27 Q24 44 4 27 Z" fill="#fff" stroke="${D}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="24" cy="27" r="8.5" fill="#7c5cd6" stroke="${D}" stroke-width="2"/><circle cx="24" cy="27" r="3.6" fill="${D}"/><circle cx="26.6" cy="24.4" r="1.5" fill="#fff"/>`,
  hunter:`<path d="M15 6 Q39 24 15 42" fill="none" stroke="${D}" stroke-width="6" stroke-linecap="round"/><path d="M15 6 Q39 24 15 42" fill="none" stroke="#b06a33" stroke-width="3" stroke-linecap="round"/><path d="M15 6 V42" stroke="${D}" stroke-width="1.6"/><path d="M8 24 H37" stroke="${D}" stroke-width="2.6" stroke-linecap="round"/><path d="M43 24 L35 19 V29 Z" fill="#e8823f" stroke="${D}" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 24 L5.5 19.5 M9 24 L5.5 28.5 M13 24 L9.5 19.5 M13 24 L9.5 28.5" stroke="#e8823f" stroke-width="2.2" stroke-linecap="round"/>`,
  knight:`<path d="M24 9 Q31 1 38 5 Q32 6 29 11" fill="#e5484d" stroke="${D}" stroke-width="1.8" stroke-linejoin="round"/><path d="M11 41 V23 Q11 9 24 9 Q37 9 37 23 V41 Z" fill="#aebccd" stroke="${D}" stroke-width="2.4" stroke-linejoin="round"/><path d="M15.5 22.5 H32.5" stroke="${D}" stroke-width="3.2" stroke-linecap="round"/><path d="M24 26 V38" stroke="#7d8ea3" stroke-width="2.4" stroke-linecap="round"/><circle cx="18" cy="32" r="1.4" fill="${D}"/><circle cx="30" cy="32" r="1.4" fill="${D}"/>`,
  ...Object.fromEntries(NEWC.map(k=>[k,CHARS[k].icon]))
};
const BAND={king:'#d99a12',wolf:'#ff6f93',villager:'#b8733a',seer:'#6a4fd0',hunter:'#d9692a',knight:'#5f7894',...Object.fromEntries(NEWC.map(k=>[k,CHARS[k].band]))};
function arrows(t){
  return'<svg class="arw" viewBox="0 0 100 100" aria-hidden="true">'+T[t].m.map(([dy,dx])=>{
    const k=dx&&dy?39:43.5,x=50+dx*k,y=50+dy*k,ang=Math.atan2(dx,-dy)*180/Math.PI;
    return`<path transform="translate(${x} ${y}) rotate(${ang})" d="M0 -5 L5.5 3 L-5.5 3 Z" fill="${D}" stroke-linejoin="round"/>`;
  }).join('')+'</svg>';
}
function iconSvg(type,look){
  let s=ICON[type];
  const c=type==='wolf'&&look&&look.wolf&&ITEM[look.wolf]?.color;
  if(c)s=s.replace('#8b93a7',c);
  return`<svg class="ico" viewBox="0 0 48 48" aria-hidden="true">${s}</svg>`;
}
// 駒1枚。look = {skin, back, wolf}(着せ替え)
function tile(type,o={}){
  const look=o.look||{};
  if(o.hidden){const b=look.back&&ITEM[look.back];return`<span class="pc hidden${b?' back-'+look.back:''}" aria-label="正体不明の駒"><span class="q">${b?b.glyph:'?'}</span></span>`}
  const wolf=o.wolf||'hid';
  const w=type==='wolf'?(wolf==='open'?' wolf-open':' wolf-hid'):'';
  const band=type==='wolf'&&wolf==='open'?'var(--wolf-open)':BAND[type];
  const skin=look.skin&&ITEM[look.skin]?` skin-${look.skin}`:'';
  const fr=look.frame&&ITEM[look.frame];
  const rk=(type==='king'||type==='wolf')&&look.rk&&look.rk!=='C'?` rk-${look.rk}`:'';
  return`<span class="pc${w}${skin}${rk}${fr?' framed':''}${o.enemy?' enemy':''}" style="--band:${band}${fr?`;--frame:${fr.color}`:''}" aria-label="${T[type].nm}"><span class="face">${iconSvg(type,look)}<span class="band">${T[type].nm}</span></span>${arrows(type)}${o.hurt?'<span class="hurt">負傷</span>':''}</span>`;
}
function boardHTML(G,v,{sel=null,interactive=false,reveal=false,looks=[{},{}],watch=false}={}){
  const tg=new Set();
  if(interactive&&sel){
    if(sel.hand!=null){for(let r=0;r<5;r++)for(let c=0;c<3;c++)if(!G.board[r][c])tg.add(r+','+c)}
    else if(sel.ab)abTargets(G,sel.r,sel.c).forEach(([a,b])=>tg.add(a+','+b));
    else targets(G,sel.r,sel.c).forEach(([a,b])=>tg.add(a+','+b));
  }
  let h='<div class="boardwrap"><div class="board" aria-label="盤面">';
  for(let dr=0;dr<5;dr++)for(let dc=0;dc<3;dc++){
    const[r,c]=toAbs(v,dr,dc),P=G.board[r][c],L=G.last;let cls='cell';
    if(L&&!reveal){
      const isTo=L.to[0]===r&&L.to[1]===c,isFrom=L.from&&L.from[0]===r&&L.from[1]===c;
      if(isTo||isFrom)cls+=L.kind==='counter'||L.kind==='bite'||L.kind==='ab'?' counter':' last';
    }
    if(interactive&&sel&&sel.hand==null&&sel.r===r&&sel.c===c)cls+=' sel';
    if(tg.has(r+','+c))cls+=' tgt'+(P?' hasp':'')+(sel.ab?' bitet':'');
    if(P&&P.marked&&P.owner!==v&&!reveal)cls+=' marked';
    let inner='';
    if(P){
      const mine=!watch&&P.owner===v,peek=!watch&&P.seen&&P.seen[v],vis=mine||reveal||P.shown||(P.type==='wolf'&&P.revealed)||peek;
      const fake=!mine&&!reveal&&!peek&&P.fake;   // 狼少年の「王様のふり」
      if(watch&&P.owner!==v&&vis){inner=tile(P.type,{enemy:true,wolf:P.revealed?'open':'hid',look:looks[P.owner]||{},hurt:P.hurt});h+=`<button class="${cls}" tabindex="-1" aria-label="${dr+1}段目 ${dc+1}列目">${inner}</button>`;continue}
      const look=looks[P.owner]||{};
      inner=fake?tile(P.fake,{enemy:true,look}):vis?tile(P.type,{enemy:!mine,wolf:P.revealed?'open':'hid',look,hurt:P.hurt}):tile(null,{hidden:true,look});
      if(P.charm>0)inner+=`<span class="cbadge" title="恋の矢で動けない">💘${P.charm}</span>`;
      if(peek&&!mine&&!reveal)inner+='<span class="pbadge" title="探偵で調べた駒">🔍</span>';
      if(mine&&P.fake)inner+='<span class="pbadge" title="王様のふりをしている">👑</span>';
    }
    h+=`<button class="${cls}" data-act="cell" data-r="${dr}" data-c="${dc}" ${interactive?'':'tabindex="-1"'} aria-label="${dr+1}段目 ${dc+1}列目">${inner}</button>`;
  }
  return h+'</div></div>';
}
function rulesCard(r,editable,local){
  if(!editable)return`<div class="card rulesbox"><b>部屋のルール</b><p class="muted">${rulesText(r)}(部屋を作った人が決めます)</p></div>`;
  const chip=(act,val,label,on)=>`<button class="chip${on?' on':''}" data-act="${act}" data-v="${val}" aria-pressed="${on}">${label}</button>`;
  return`<div class="card rulesbox"><b>部屋のルール</b>
    <div class="ruleline"><span class="muted">持ち時間</span><div class="row">${TIME_OPTS.map(([v,l])=>chip('setTime',v,l,r.time===v)).join('')}</div></div>
    ${TOGGLES.map(([k,label,desc])=>`<div class="ruleline"><span class="muted">${label}</span><div class="row">${chip('setRule',k+':1',k==='reveal'?'公開':'あり',r[k])}${chip('setRule',k+':0',k==='reveal'?'しない':'なし',!r[k])}</div><span class="ruledesc">${k==='chars'&&local?'1台で対戦では、持っていない新キャラもお試しで使える':desc}</span></div>`).join('')}
    <p class="muted">${r.time?'持ち時間を使い切ると1手10秒の秒読みです。':'時間制限なしで考えられます。'}</p></div>`;
}
function handHTML(G,v,sel,enabled,look){
  if(!rulesOf(G).drops)return'';
  const h=G.hands[v];
  return`<div class="hand" aria-label="あなたの持ち駒">${h.length?h.map((t,i)=>`<button class="handbtn${sel&&sel.hand===i?' sel':''}" data-act="hand" data-i="${i}" ${enabled?'':'disabled'}>${tile(t,{look})}</button>`).join(''):'<span class="empty">持ち駒なし</span>'}</div>`;
}
function clocksHTML(me,op,meLabel,opLabel,G){
  if(G&&!rulesOf(G).time)return`<div class="clocks notime"><span class="vsrow"><b>${meLabel}</b><i>VS</i><b>${opLabel}</b></span><small>持ち時間なし</small></div>`;
  return`<div class="clocks"><div class="clk me" data-ck="${me}"><span class="who">${meLabel}</span><b data-clock="${me}">2:00</b><span class="meter"><i data-meter="${me}"></i></span></div>
  <div class="clk op" data-ck="${op}"><span class="who">${opLabel}</span><b data-clock="${op}">2:00</b><span class="meter"><i data-meter="${op}"></i></span></div></div>`;
}
// 配置と編成。pool = 入れ替えに使える駒
function setupHTML(arr,sel,pool,look,msg,compact){
  let b=`<div class="boardwrap"><div class="board${compact?' compact':''}">`;
  for(let dr=compact?3:0;dr<5;dr++)for(let dc=0;dc<3;dc++){
    if(dr<3){b+=`<div class="cell zone">${dr===1&&dc===1?'<span class="lbl">相手の陣地</span>':''}</div>`;continue}
    const i=(dr===3?0:3)+dc;
    b+=`<button class="cell${sel===i?' sel':''}" data-act="swap" data-i="${i}" aria-label="${T[arr[i]].nm}">${tile(arr[i],{look})}</button>`;
  }
  b+='</div></div>';
  const pal=`<div class="card deckpal"><div class="row"><b>編成</b><span class="muted">駒をタップしてから、下の駒を選ぶと入れ替わります(王様と人狼は外せません)</span></div>
    <div class="palrow">${pool.map(t=>{const used=arr.includes(t),r=rarOf(t);return`<button class="palbtn${used?' used':''}" data-act="pick" data-t="${t}" ${used?'disabled':''}>${tile(t,{look})}<span class="rar r-${r}">${r}</span></button>`}).join('')}</div>
    ${msg?`<p class="err">${esc(msg)}</p>`:''}</div>`;
  return b+pal;
}
function pickInto(arr,sel,t){
  if(sel==null)return'先に入れ替えたい駒をタップしてください。';
  if(arr[sel]==='king'||arr[sel]==='wolf')return'王様と人狼は外せません。ほかの駒をタップしてください。';
  if(arr.includes(t))return'同じ駒は1枚までです。';
  arr[sel]=t;return'';
}
function rankCard(){
  const R=rankOf(M.st?.stats),look=myLook(),nx=R.next;
  const pct=nx?Math.min(100,(R.exp-R.cur.exp)/(nx.exp-R.cur.exp)*100):100;
  const need=nx?`次の${nx.r}まで あと${Math.max(0,nx.exp-R.exp)}経験値${nx.wr?`・勝率${nx.wr}%以上`:''}`:'最高ランクに到達！';
  const base=Object.entries(BASE_RARITY).map(([t,r])=>`<div class="bp">${tile(t,{look})}<span class="rar r-${r}">${r}</span></div>`).join('');
  return`<div class="card rankcard"><div class="row"><b>王様・人狼のランク</b><span class="spacer"></span><span class="rar big r-${R.r}">${R.r}</span></div>
    <div class="rkrow"><div class="bp">${tile('king',{look})}<span class="rar r-${R.r}">${R.r}</span></div><div class="bp">${tile('wolf',{look})}<span class="rar r-${R.r}">${R.r}</span></div>
      <div class="rkinfo"><span class="qbar"><i style="width:${pct}%"></i></span><small>経験値 ${R.exp}・勝率 ${R.wr}%</small><small class="need">${need}</small></div></div>
    <p class="muted">対戦するほど経験値がたまり(勝ち+${EXP.win}・負け+${EXP.lose})、C→R→SR→SSR→LRと昇格します。SSRは勝率${RANKS[3].wr}%以上、LRは勝率${RANKS[4].wr}%以上が条件。ランクが上がると、王様と人狼の駒が光ります。</p>
    <b class="left">初期の駒</b><div class="rkrow">${base}</div></div>`;
}
// デフォルト編成(コレクションの「編成」で変更。端末に保存)
function validDeck(a){return Array.isArray(a)&&a.length===6&&a.every(t=>T[t])&&a.filter(t=>t==='king').length===1&&a.filter(t=>t==='wolf').length===1&&new Set(a).size===6}
function savedDeck(){try{const a=JSON.parse(store.get('jinro-deck')||'null');if(validDeck(a))return a.slice()}catch(e){}return PRESETS[0].a.slice()}
// 使えないキャラ(持っていない・ルールでオフ)を基本の駒に置き換える
function fitDeck(a,allowed){const out=a.slice();out.forEach((t,i)=>{if(NEWC.includes(t)&&!allowed.includes(t)){out[i]=SWAP_BASE.find(b=>!out.includes(b))||'villager'}});return out}
function setupControls(){return`<div class="row">${PRESETS.map((x,k)=>`<button class="btn ghost small" data-act="preset" data-k="${k}">${x.name}</button>`).join('')}<button class="btn ghost small" data-act="shuffle">並びをランダム</button></div>`}
function rulesHTML(open=false){
  return`<details class="rules"${open?' open':''}><summary>ルールと駒の動き</summary>
  <ul>
    <li>3×5の盤で、お互い6枚の駒を指し合います。相手の<b>王様を取れば勝ち</b>です。</li>
    <li>対局前に手前2段へ6枚を自由に配置します。相手の駒は灰色で正体が見えません。</li>
    <li><b>隠れた人狼</b>(ピンク)は駒を取れません。占い師と妖狐以外の駒が取りに来ると<b>返り討ち</b>にして、その駒を奪います。返り討ちにした人狼は正体が明かされ(青)、普通に取ったり取られたりします。</li>
    <li>持ち駒ありのときは、取った駒を空いているマスに打てます。打った駒は相手から見えず、打った人狼は隠れた状態に戻ります。持ち駒なしのときは、取った駒は盤から消えます。</li>
    <li>持ち時間・新キャラ・持ち駒・村人の成り・取った駒の正体公開・トライ勝ちは、部屋を作った人が対局前に決めます。</li>
    <li><b>新キャラ</b>はガチャで手に入ります。編成で王様・人狼以外の駒と入れ替えて使います。</li>
  </ul>
  <div class="ptable">${BASE.map(t=>`<div class="prow">${tile(t)}<div><b>${T[t].nm}</b><span class="d">${T[t].d}</span></div></div>`).join('')}
  <b class="ptitle">新キャラ(ガチャで手に入る)</b>
  ${NEWC.map(t=>`<div class="prow">${tile(t)}<div><b>${T[t].nm}</b> <span class="rar r-${CHAR_ITEM[t].rarity}">${CHAR_ITEM[t].rarity}</span>${whereTag(t)}<span class="d">${T[t].d}</span></div></div>`).join('')}</div>
  ${S.screen!=='local'&&!(S.screen==='online'&&O.code)&&S.screen!=='pieces'?'<button class="btn ghost small" data-act="go" data-to="pieces">駒の一覧ページで見る</button>':''}</details>`;
}

/* ===== app state ===== */
const S={screen:'home'};
let L=null;
const O={watch:false,watchers:0,code:null,seat:null,game:null,players:{},draft:PRESETS[0].a.slice(),sel:null,deckMsg:'',seenMove:-1,seenAt:Date.now(),toast:null,err:'',busy:false,uid:null,ch:null,timeoutSent:false,starting:false,resignArm:false,stampOpen:false,bubbles:{}};
// M = コイン・持ち物・フレンドなど(ホーム画面まわり)
const M={st:null,loading:false,err:'',modal:null,gacha:null,tab:'deck',deck:null,toast:'',friendErr:'',inviteSent:{}};
let sb=null,sbFail=false;

/* ===== player identity ===== */
function getUid(){
  let u=store.get('jinro-uid');
  if(!u){u=(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));store.set('jinro-uid',u)}
  return u;
}
function getSecret(){
  let s=store.get('jinro-secret');
  if(!s){const a=new Uint8Array(24);crypto.getRandomValues(a);s=[...a].map(x=>x.toString(16).padStart(2,'0')).join('');store.set('jinro-secret',s)}
  return s;
}
const myName=()=>store.get('jinro-name')||'';
// 王様・人狼のランク(経験値＋勝率で昇格)
function rankOf(stats){
  const w=stats?.wins||0,n=stats?.games||0,exp=w*EXP.win+(n-w)*EXP.lose,wr=n?Math.round(w/n*100):0;
  let k=0;RANKS.forEach((x,i)=>{if(exp>=x.exp&&wr>=x.wr)k=i});
  return{r:RANKS[k].r,exp,wr,next:RANKS[k+1]||null,cur:RANKS[k]};
}
const myLook=()=>({...(M.st?.look||{}),rk:rankOf(M.st?.stats).r});
const rarOf=t=>(t==='king'||t==='wolf')?rankOf(M.st?.stats).r:CHAR_ITEM[t]?.rarity||BASE_RARITY[t]||'C';
const owned=()=>new Set(M.st?.items||[]);
const ownedChars=()=>NEWC.filter(k=>owned().has(CHAR_ITEM[k].id));
const myStamps=()=>[...DEFAULT_STAMPS,...ITEMS.filter(i=>i.kind==='stamp'&&owned().has(i.id))];
const P={names:{},titles:{},avatars:{},stats:{},editing:false,recorded:new Set()};
const nameOf=(uid,fb)=>P.names[uid]||fb;
function statText(uid){const st=P.stats[uid];if(!st||!st.n)return'戦績なし';return`勝率 ${Math.round(st.w/st.n*100)}%・${st.n}戦${st.w}勝`}
const AV_BG=['#ff6f93','#ff9f1c','#3f86f0','#22b573','#a855f7','#1d2232','#f5b82e','#8b93a7'];
const avOf=uid=>P.avatars[uid]||(uid===O.uid?localAvatar():null)||{c:'wolf',bg:0};
// アイコン。av.s = 'img'(顔イラスト) / 'gold'(金フレーム) / 'lux'(LRの豪華版)。未設定は駒のSVG
function avatar(av,cls=''){av=av||{c:'wolf',bg:0};const c=T[av.c]?av.c:'wolf';const svg=iconSvg(c,c==='wolf'?myLookFor(av):null);
  const st=['img','gold','lux'].includes(av.s)&&ART[c]?av.s:null;
  if(st){const src=st==='lux'&&ART[c].iconLux?ART[c].iconLux:ART[c].icon;return`<span class="av img ${st} ${cls}" style="--avbg:${AV_BG[av.bg]||AV_BG[0]}">${svg}${lazyImg(src,T[c].nm)}</span>`}
  return`<span class="av ${cls}" style="--avbg:${AV_BG[av.bg]||AV_BG[0]}">${svg}</span>`}
// 自分のアイコンに使える一番良い見た目
function bestStyle(c){const u=unlocks(c);return u.lux?'lux':u.gold?'gold':u.icon?'img':null}
// サーバー側の保存(jinro_set_avatar)は見た目(s)を保存できないため、選んだ見た目をこの端末にも覚えておき、
// サーバーから読み直したときにキャラと背景が一致していれば見た目を付け直す(他端末で変えた場合はサーバー側を優先)
function localAvatar(){try{return JSON.parse(store.get('jinro-avatar')||'null')}catch(e){return null}}
function mergeAvatar(av){if(!av)return av;const l=localAvatar();if(l&&l.c===av.c&&l.bg===av.bg&&l.s)return{...av,s:l.s};return av}
function myLookFor(av){return av&&av.wolf?{wolf:av.wolf}:null}
function titleTag(id){const it=id&&ITEM[id];return it?`<span class="ttl r-${it.rarity}">${esc(it.name)}</span>`:''}

const ERR={tokens:'特別コインが足りません。',exchange:'そのキャラとは交換できません。',auth:'この端末の合言葉が一致しません。前に使っていた端末で開いてください。',already:'もう受け取り済みです。',coins:'コインが足りません。',notyet:'まだ達成していません。',notfound:'そのフレンドコードの人が見つかりません。',self:'自分のコードです。',notfriend:'フレンドになってから誘えます。',slow:'少し待ってから送ってください。',notowned:'持っていない景品です。',name:'名前は1〜12文字で入力してください。',pick:'日曜日はピックアップするキャラを選んでから引いてください。',fast:'開始から20秒以上たってから勝つとコインがもらえます。',level:'難易度が正しくありません。'};
async function rpc(fn,args={}){
  if(!sb)throw new Error('offline');
  const {data,error}=await sb.rpc(fn,{p_uid:O.uid,p_secret:getSecret(),...args});
  if(error){const m=(error.message||'').trim();const e=new Error(ERR[m]||'通信できませんでした。電波の良いところで、もう一度試してください。');e.code=m;console.error(fn,error);throw e}
  return data;
}
function toast(t){M.toast=t;render();clearTimeout(toast.h);toast.h=setTimeout(()=>{M.toast='';render()},2600)}

async function refreshState(){
  if(!sb||!myName())return;
  try{
    const st=await rpc('jinro_state');
    if(!st.name){await rpc('jinro_set_name',{p_name:myName()});return refreshState()}
    const same=M.st&&JSON.stringify(M.st)===JSON.stringify(st);if(same&&!M.err)return;   // 変化がなければ描き直さない
    const first=!M.st;M.st=st;setOwnedChars(ownedChars());P.names[O.uid]=st.name;P.titles[O.uid]=st.title;if(st.avatar){st.avatar=mergeAvatar(st.avatar);P.avatars[O.uid]=st.avatar}
    if(first&&st.login_claimable&&!M.modal)M.modal={type:'login'};
    loadPeople([O.uid]);
  }catch(e){M.err=e.message}
  render();
}
async function saveName(raw){
  const n=String(raw||'').trim().slice(0,12);
  if(!n){M.err=ERR.name;render();return}
  store.set('jinro-name',n);P.names[O.uid]=n;P.editing=false;M.err='';render();
  if(sb){try{await rpc('jinro_set_name',{p_name:n});await refreshState()}catch(e){M.err=e.message;render()}}
  const q=new URLSearchParams(location.search).get('room');
  if(sb&&q&&!O.code){S.screen='online';joinRoom(q)}
}
async function loadPeople(uids){
  uids=[...new Set(uids.filter(Boolean))];if(!sb||!uids.length)return;
  const [a,b]=await Promise.all([
    sb.from('jinro_players').select('uid,name,title,avatar').in('uid',uids),
    sb.from('jinro_results').select('uid,win').in('uid',uids)
  ]);
  (a.data||[]).forEach(r=>{P.names[r.uid]=r.name;P.titles[r.uid]=r.title;if(r.avatar)P.avatars[r.uid]=r.uid===O.uid?mergeAvatar(r.avatar):r.avatar});
  const st={};uids.forEach(u=>st[u]={w:0,n:0});
  (b.data||[]).forEach(r=>{st[r.uid].n++;if(r.win)st[r.uid].w++});
  Object.assign(P.stats,st);render();
}
async function recordResult(g){
  const key=`jinro-rec-${O.uid}-${O.code}-${g.startNo}`;
  if(P.recorded.has(key)||store.get(key))return;
  P.recorded.add(key);
  try{await rpc('jinro_record_result',{p_code:O.code,p_game_no:g.startNo});store.set(key,'1')}catch(e){P.recorded.delete(key)}
  loadPeople([O.players[0]?.uid,O.players[1]?.uid,O.uid]);refreshState();
}

/* ===== local mode (one device) ===== */
function localNew(cpu=null){L={cpu,phase:'rules',rules:{...DEFAULT_RULES},cover:{p:0,next:'setup'},setup:[savedDeck(),savedDeck()],setupP:0,sel:null,msg:'',G:null,byo:BYO,out:null,notice:'',noticeAlert:false,resignArm:false}}
function localEnd(out){L.sel=null;L.byo=BYO;if(L.G.winner!=null)L.phase='over';else{L.out=out;L.phase='result'}}
const localLooks=()=>[myLook(),{}];
const pName=p=>L&&L.cpu?(p===0?'あなた':'CPU'):NAME[p];
// CPUの手番:少し考えてから指す
function cpuTurn(){
  const my=L;if(!my||!my.cpu||!my.G||my.G.winner!=null||my.G.turn!==1||my.phase!=='play')return;
  my.thinking=true;render();
  setTimeout(()=>{
    if(L!==my||my.phase!=='play'||my.G.winner!=null)return;
    const G=my.G,t0=Date.now(),m=cpuChoose(G,1,my.cpu.level);
    const wait=Math.max(0,700-(Date.now()-t0));
    setTimeout(()=>{
      if(L!==my||my.phase!=='play')return;
      my.thinking=false;
      if(!m){G.winner=0;G.reason='CPUが動ける駒がなくなりました';return cpuOver()}
      const out=m.k==='m'?applyMove(G,m.r,m.c,m.nr,m.nc):m.k==='a'?applyAbility(G,m.r,m.c,m.nr,m.nc):applyDrop(G,m.i,m.nr,m.nc);
      if(G.winner!=null)return cpuOver();
      const n=nextTurn(G);G.turn=n;my.byo=BYO;
      my.notice=out.note.replace(/相手/g,'CPU')+(n===1?' CPUがもう1手続けて指します。':'');my.noticeAlert=!!out.alert;my.sel=null;
      render();if(n===1)cpuTurn();
    },wait);
  },60);
}
async function cpuOver(){
  L.phase='over';L.sel=null;L.thinking=false;render();
  if(L.G.winner!==0||!L.cpu.game)return;
  try{const r=await rpc('jinro_cpu_win',{p_game:L.cpu.game});L.cpu.reward=r.reward;L.cpu.today=r.today;if(M.st)M.st.coins=r.coins}
  catch(e){L.cpu.rewardErr=e.message}
  render();
}
async function cpuStartServer(){
  const my=L;try{const r=await rpc('jinro_cpu_start',{p_level:my.cpu.level});my.cpu.game=r.game;my.cpu.today=r.today}catch(e){my.cpu.game=null}
}
function renderLocal(){
  if(L.phase==='rules')return`<div class="top"><button class="btn ghost small" data-act="home">戻る</button><h2 class="ttlh">${L.cpu?`CPU対戦・${CPU_LV[L.cpu.level].nm}`:'1台で対戦'}</h2></div>${L.cpu?`<div class="card"><b>勝つと ${CPU_LV[L.cpu.level].coin}コイン</b><p class="muted">あなたが先手です。コインは1日50枚まで、開始から20秒以上たって勝ったときにもらえます(CPU戦は戦績・ランクには入りません)。</p></div>`:''}${rulesCard(L.rules,true,true)}<button class="btn orange" data-act="localStart">配置へ進む</button>${rulesHTML()}`;
  if(L.phase==='cover'){
    const p=L.cover.p,setup=L.cover.next==='setup';
    return`<div class="cover"><h2>${NAME[p]}の番</h2><p>${setup?`${NAME[p]}が駒の配置を決めます。相手に画面を見せないでください。`:`スマホを${NAME[p]}に渡してください。`}</p><button class="btn orange" data-act="uncover">${NAME[p]}です。画面を開く</button><button class="btn ghost small" data-act="home">ホームに戻る</button></div>`;
  }
  if(L.phase==='setup'){
    const pool=[...SWAP_BASE,...(L.rules.chars?NEWC:[])];
    return`<div class="top"><button class="btn ghost small" data-act="home">退出</button><h2 class="ttlh">${L.cpu?'あなた':NAME[L.setupP]}の配置</h2></div><div class="side"><span class="badge">2マスを順にタップで入れ替え</span></div>
      ${setupHTML(L.setup[L.setupP],L.sel?.i,pool,localLooks()[L.setupP],L.msg)}${setupControls()}<button class="btn orange" data-act="confirm">この配置で決定</button>${rulesHTML()}`;
  }
  const G=L.G;
  if(L.phase==='over'){
    const cr=L.cpu,rw=cr&&G.winner===0?(cr.reward!=null?`<div class="card reward"><b>${cr.reward>0?`+${cr.reward}コイン獲得！`:'今日のCPU戦コインは上限(50枚)に達しました'}</b><small class="muted">今日のCPU戦 ${cr.today??0}/50コイン</small></div>`:cr.rewardErr?`<p class="muted">${esc(cr.rewardErr==='開始から20秒以上たってから勝つとコインがもらえます。'?cr.rewardErr:'コインは受け取れませんでした('+cr.rewardErr+')')}</p>`:cr.game?'<p class="muted">コインを受け取っています…</p>':'<p class="muted">名前を決めてオンラインにつながると、勝ったときにコインがもらえます。</p>'):'';
    if(cr&&!L.c3)L.c3=charaEnd(G,0,'cpu-'+(L.c3key||(L.c3key=Date.now())));
    return`<section class="hero"><h1 class="over-h">${cr?(G.winner===0?'あなたの勝ち！':'CPUの勝ち'):NAME[G.winner]+'の勝ち'}</h1><p>${esc(G.reason)}。すべての駒を公開しています。</p></section>${rw}${cr?unlockNotice(L.c3,G.decks?.[0]):''}
      ${boardHTML(G,0,{reveal:true,looks:localLooks()})}<div class="row"><button class="btn orange" data-act="localAgain">もう一度遊ぶ</button><button class="btn ghost" data-act="home">ホームへ</button></div>`;
  }
  const v=L.cpu?0:G.turn,op=1-v,play=L.phase==='play'&&!(L.cpu&&G.turn===1);
  const again=!play&&L.out&&L.out.same;
  return`<div class="top"><button class="btn ghost small" data-act="home">退出</button>${clocksHTML(v,op,pName(v)+(L.cpu?'':'(あなた)'),pName(op),G)}</div>
    <div class="side"><span class="who">${pName(op)}</span>${L.cpu&&G.turn===1?'<span class="badge turn">考え中…</span>':''}${rulesOf(G).drops?`<span class="badge">持ち駒 ${G.hands[op].length}枚</span>`:''}</div>
    ${boardHTML(G,v,{sel:L.sel,interactive:play,looks:localLooks()})}
    <div class="side"><span class="who">${pName(v)}</span>${G.turn===v?'<span class="badge turn">あなたの番</span>':''}</div>
    ${play?abilityBar(G,L.sel):''}
    ${handHTML(G,v,L.sel,play,localLooks()[v])}
    ${L.cpu&&L.myRes?`<div class="status mine"><b>あなた</b>${esc(L.myRes)}</div>`:''}
    ${(play||L.cpu)&&L.notice?`<div class="status${L.noticeAlert?' alert':''}">${L.cpu&&L.myRes?'<b>CPU</b>':''}${esc(L.notice)}</div>`:''}
    ${L.cpu&&G.turn===1&&L.phase==='play'?'<div class="status wait">CPUが考えています…</div>':''}
    ${play||L.cpu?`<div class="row"><span class="spacer"></span><button class="btn ${L.resignArm?'danger':'ghost'} small" data-act="resign">${L.resignArm?'もう一度押すと投了':'投了'}</button></div>${rulesHTML()}`
      :`<div class="sheet"><p>${esc(L.out.res)}</p><button class="btn orange" data-act="pass">${again?'続けてもう1手指す':NAME[op]+'に渡す'}</button></div><div style="height:140px"></div>`}`;
}
function localAct(a,el){
  if(a!=='resign')L.resignArm=false;
  if(a==='setTime'){L.rules.time=+el.dataset.v}
  else if(a==='setRule'){const [k,v]=el.dataset.v.split(':');L.rules[k]=v==='1'}
  else if(a==='localStart'){if(L.cpu){L.phase='setup';L.setupP=0;L.sel=null;cpuStartServer()}else{L.phase='cover';L.cover={p:0,next:'setup'}}}
  else if(a==='uncover'){L.phase=L.cover.next;L.sel=null;L.msg='';lastT=null}
  else if(a==='swap'){const i=+el.dataset.i,ar=L.setup[L.setupP];L.msg='';if(L.sel&&L.sel.i!=null&&L.sel.i!==i){[ar[L.sel.i],ar[i]]=[ar[i],ar[L.sel.i]];L.sel=null}else L.sel=L.sel&&L.sel.i===i?null:{i}}
  else if(a==='pick'){L.msg=pickInto(L.setup[L.setupP],L.sel?.i,el.dataset.t);if(!L.msg)L.sel=null}
  else if(a==='preset'){L.setup[L.setupP]=PRESETS[+el.dataset.k].a.slice();L.sel=null}
  else if(a==='shuffle'){shuffle(L.setup[L.setupP]);L.sel=null}
  else if(a==='confirm'&&L.cpu){L.sel=null;L.msg='';L.setup[1]=cpuDeck(L.cpu.level,L.rules);L.G=newGame(L.setup,L.rules);L.notice='対局開始。あなたが先手です。';L.noticeAlert=false;L.phase='play';lastT=null}
  else if(a==='confirm'){L.sel=null;L.msg='';if(L.setupP===0){L.setupP=1;L.cover={p:1,next:'setup'}}else{L.G=newGame(L.setup,L.rules);L.notice='対局開始。先手から指します。';L.noticeAlert=false;L.cover={p:0,next:'play'}}L.phase='cover'}
  else if(a==='hand'){const i=+el.dataset.i;L.sel=L.sel&&L.sel.hand===i?null:{hand:i}}
  else if(a==='bite'){if(L.sel)L.sel={r:L.sel.r,c:L.sel.c,ab:!L.sel.ab}}
  else if(a==='abSelf'&&L.phase==='play'&&L.sel){const G=L.G,[r,c]=[L.sel.r,L.sel.c];L.sel={r,c,ab:true};const v=L.cpu?0:G.turn;const[dr,dc]=v===0?[r,c]:[4-r,2-c];return localAct('cell',{dataset:{r:String(dr),c:String(dc)}})}
  else if(a==='cell'&&L.phase==='play'){
    const G=L.G,[r,c]=toAbs(G.turn,+el.dataset.r,+el.dataset.c),d=decideTap(G,G.turn,L.sel,r,c);
    if(d.act==='sel')L.sel=d.sel;
    else if(L.cpu){if(G.turn!==0)return;const out=d.act==='drop'?applyDrop(G,d.i,r,c):d.act==='ab'?applyAbility(G,d.from[0],d.from[1],r,c):applyMove(G,d.from[0],d.from[1],r,c);L.sel=null;L.byo=BYO;
      if(G.winner!=null){cpuOver();return}
      const n=nextTurn(G);G.turn=n;L.myRes=out.res;L.notice=n===0?'てるてるの力で、もう1手続けて指せます(移動だけ)。':'';L.noticeAlert=!!out.alert;if(n===1)setTimeout(cpuTurn,0)}
    else{const out=d.act==='drop'?applyDrop(G,d.i,r,c):d.act==='ab'?applyAbility(G,d.from[0],d.from[1],r,c):applyMove(G,d.from[0],d.from[1],r,c);if(G.winner==null){const save=G.skip,nc=G.noCap;const n=nextTurn(G);G.skip=save;G.noCap=nc;out.same=n===G.turn}localEnd(out)}
  }
  else if(a==='pass'){const G=L.G;const n=nextTurn(G);const same=n===G.turn;G.turn=n;L.notice=same?'てるてるの力で、もう1手続けて指せます(移動だけ。駒は取れません)。':L.out.note;L.noticeAlert=!!L.out.alert;if(same){L.phase='play'}else{L.cover={p:G.turn,next:'play'};L.phase='cover'}}
  else if(a==='resign'){if(L.resignArm){if(L.cpu){L.G.winner=1;L.G.reason='あなたが投了しました';L.phase='over'}else{L.G.winner=1-L.G.turn;L.G.reason=`${NAME[L.G.turn]}が投了しました`;L.phase='over'}}else L.resignArm=true}
  else if(a==='localAgain')localNew(L.cpu?{level:L.cpu.level}:null);
}

/* ===== online mode (Supabase) ===== */
function genCode(){const A='ABCDEFGHJKMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<4;i++)s+=A[Math.floor(Math.random()*A.length)];return s}
function errText(e){console.error(e);return'通信できませんでした。電波の良いところで、もう一度試してください。'}
function blankGame(code,moveNo,rules){const r={...DEFAULT_RULES,...(rules||{})};return{code,phase:'setup',moveNo,board:null,hands:[[],[]],turn:0,rules:r,time:[r.time,r.time],last:null,note:null,winner:null,reason:''}}
function roomLink(code){return location.origin+location.pathname+'?room='+code}

async function createRoom(){
  O.err='';O.busy=true;render();
  try{
    let code=null;
    for(let k=0;k<6&&!code;k++){
      const c=genCode();
      const {error}=await sb.from('jinro_rooms').insert({code:c,game:blankGame(c,0)});
      if(!error)code=c;else if(error.code!=='23505')throw error;
    }
    if(!code)throw new Error('no code');
    const {error}=await sb.from('jinro_seats').insert({code,seat:0,uid:O.uid,look:myLook()});
    if(error)throw error;
    await enterRoom(code,0);
  }catch(e){O.err=errText(e)}
  O.busy=false;render();
}
async function joinRoom(raw){
  const code=String(raw||'').trim().toUpperCase();
  if(!/^[A-Z0-9]{4}$/.test(code)){O.err='4文字の部屋コードを入力してください。';render();return}
  O.err='';O.busy=true;render();
  try{
    const {data:room,error}=await sb.from('jinro_rooms').select('code').eq('code',code).maybeSingle();
    if(error)throw error;
    if(!room){O.err=`部屋「${code}」が見つかりません。コードを確認してください。`}
    else{
      const {data:seats,error:e2}=await sb.from('jinro_seats').select('seat,uid').eq('code',code);
      if(e2)throw e2;
      const s0=seats.find(s=>s.seat===0),s1=seats.find(s=>s.seat===1);
      if(s0&&s0.uid===O.uid)await enterRoom(code,0);
      else if(s1&&s1.uid===O.uid)await enterRoom(code,1);
      else if(s1)O.err='この部屋はもう2人そろっています。';
      else{
        const {error:e3}=await sb.from('jinro_seats').insert({code,seat:1,uid:O.uid,look:myLook()});
        if(e3&&e3.code==='23505')O.err='この部屋はもう2人そろっています。';
        else if(e3)throw e3;
        else await enterRoom(code,1);
      }
    }
  }catch(e){O.err=errText(e)}
  O.busy=false;render();
}
async function watchRoom(raw){
  const code=String(raw||'').trim().toUpperCase();
  if(!/^[A-Z0-9]{4}$/.test(code)){O.err='4文字の部屋コードを入力してください。';render();return}
  O.err='';O.busy=true;render();
  try{const {data,error}=await sb.from('jinro_rooms').select('code').eq('code',code).maybeSingle();if(error)throw error;
    if(!data)O.err=`部屋「${code}」が見つかりません。`;else await enterRoom(code,null,true)}
  catch(e){O.err=errText(e)}
  O.busy=false;render();
}
async function enterRoom(code,seat,watch=false){
  leaveRoom(true);
  Object.assign(O,{watch,watchers:0,code,seat,game:null,players:{},sel:null,deckMsg:'',toast:null,seenMove:-1,draft:fitDeck(savedDeck(),ownedChars()),timeoutSent:false,resignArm:false,stampOpen:false,bubbles:{}});
  if(!watch)store.set('jinro-room',code);
  history.replaceState(null,'',(watch?'?watch=':'?room=')+code);
  O.ch=sb.channel('room-'+code,{config:{presence:{key:O.uid}}})
    .on('presence',{event:'sync'},()=>{const st=O.ch.presenceState();O.watchers=Object.values(st).filter(a=>a.some(x=>x.role==='watch')).length;render()})
    .on('postgres_changes',{event:'*',schema:'public',table:'jinro_rooms',filter:'code=eq.'+code},p=>{if(p.new&&p.new.game)setGame(p.new.game)})
    .on('postgres_changes',{event:'*',schema:'public',table:'jinro_seats',filter:'code=eq.'+code},p=>{if(p.new&&p.new.seat!=null){const nu=!O.players[p.new.seat];O.players[p.new.seat]=p.new;if(nu)loadPeople([O.players[0]?.uid,O.players[1]?.uid]);maybeStart();render()}})
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'jinro_chat',filter:'code=eq.'+code},p=>{if(p.new)showBubble(p.new.uid,p.new.item)})
    .subscribe(st=>{if(st==='SUBSCRIBED'){fetchAll();O.ch.track({role:watch?'watch':'play'}).catch(()=>{})}});
  await fetchAll();
}
async function fetchAll(){
  const code=O.code;if(!code||!sb)return;
  const [r,s]=await Promise.all([
    sb.from('jinro_rooms').select('game').eq('code',code).maybeSingle(),
    sb.from('jinro_seats').select('*').eq('code',code)
  ]);
  if(code!==O.code)return;
  if(r.error||s.error){O.err=errText(r.error||s.error);render();return}
  const p={};(s.data||[]).forEach(x=>p[x.seat]=x);O.players=p;
  loadPeople([p[0]?.uid,p[1]?.uid]);
  if(r.data)setGame(r.data.game);else{O.game=null;render()}
}
function setGame(g){
  if(O.game&&g.moveNo<O.game.moveNo)return;
  O.game=g;
  if(g.moveNo!==O.seenMove){O.seenMove=g.moveNo;O.seenAt=g.turnAt?Math.min(Date.now(),g.turnAt):Date.now();O.sel=null;O.timeoutSent=false;if(O.toast&&O.toast.move!==g.moveNo)O.toast=null}
  if(g.phase==='over'&&g.startNo!=null&&O.seat!=null)recordResult(g);
  maybeStart();render();
}
function leaveRoom(silent){
  if(O.ch&&sb){try{sb.removeChannel(O.ch)}catch(e){}}
  O.ch=null;O.code=null;O.seat=null;O.watch=false;O.watchers=0;O.game=null;O.players={};
  history.replaceState(null,'',location.pathname);
  if(!silent)render();
}
async function saveGame(g){
  setGame(g);
  const {error}=await sb.from('jinro_rooms').update({game:g,updated_at:new Date().toISOString()}).eq('code',O.code);
  if(error){O.err=errText(error);O.toast=null;fetchAll()}
}
async function maybeStart(){
  const g=O.game,p=O.players;
  if(O.seat==null||!g||g.phase!=='setup'||O.starting)return;
  if(!(p[0]?.ready&&p[1]?.ready&&p[0].setup&&p[1].setup))return;
  O.starting=true;
  const G=newGame([p[0].setup,p[1].setup],rulesOf(g));
  await saveGame({...g,...G,phase:'play',moveNo:g.moveNo+1,startNo:g.moveNo+1,turnAt:Date.now(),note:{for:0,text:'対局開始。あなたは先手です。',alert:false}});
  O.starting=false;
}
async function commit(apply){
  if(O.busy)return;
  const g=clone(O.game),t=g.turn,timed=rulesOf(g).time>0,el=(Date.now()-O.seenAt)/1000,rem=g.time[t]-el;
  if(timed&&rem<-BYO){g.winner=1-t;g.reason=`${NAME[t]}の時間切れ`;g.phase='over'}
  else{
    if(timed)g.time[t]=Math.max(0,rem);
    const out=apply(g);
    if(g.winner!=null)g.phase='over';
    else{
      const n=nextTurn(g);
      if(n===t){g.note={for:t,text:out.note+' てるてるの力で、もう1手続けて指せます(移動だけ。駒は取れません)。',alert:!!out.alert};g.note.extra=true}
      else g.note={for:n,text:out.note,alert:!!out.alert};
      g.turn=n;
    }
    O.toast={text:out.res,bad:!!out.bad,move:g.moveNo+1};
  }
  g.moveNo++;g.turnAt=Date.now();O.sel=null;O.busy=true;
  await saveGame(g);
  O.busy=false;render();
}
async function writeEnd(winner,reason){
  const g=clone(O.game);g.winner=winner;g.reason=reason;g.phase='over';g.moveNo++;
  await saveGame(g);
}
/* ---- in-game stamps ---- */
// リアクション道具(キャラ素材)。id は r_<キャラ>
const REACT=k=>'r_'+k;
const myReactions=()=>C3KEYS.filter(k=>ART[k]&&ART[k].prop&&unlocks(k).prop);
function showBubble(uid,item){
  const rk=typeof item==='string'&&item.startsWith('r_')?item.slice(2):null;
  const it=ITEM[item];if(!it&&!(rk&&ART[rk]))return;
  O.bubbles[uid]=rk?{react:rk,at:Date.now()}:{text:it.name,at:Date.now()};play('stamp');render();
  setTimeout(()=>{const b=O.bubbles[uid];if(b&&Date.now()-b.at>=3900){delete O.bubbles[uid];render()}},4000);
}
async function sendStamp(item){
  O.stampOpen=false;showBubble(O.uid,item);
  try{await rpc('jinro_send_stamp',{p_code:O.code,p_item:item})}catch(e){if(e.code!=='slow')O.err=e.message;render()}
}
function stampBar(){
  if(!O.code)return'';
  const rs=myReactions();
  return`<div class="stampbar">${O.stampOpen?`<div class="stamps">${rs.length?`<div class="reacts">${rs.map(k=>`<button class="react" data-act="stamp" data-id="${REACT(k)}" aria-label="${esc(T[k].nm)}のリアクション">${lazyImg(ART[k].prop,T[k].nm)}</button>`).join('')}</div>`:'<small class="muted">リアクション道具は、そのキャラを手に入れると解放されます</small>'}${myStamps().map(s=>`<button class="stamp" data-act="stamp" data-id="${s.id}">${esc(s.name)}</button>`).join('')}</div>`:''}
    <button class="btn ghost small stampbtn" data-act="stampToggle" aria-expanded="${O.stampOpen}">💬 スタンプ</button></div>`;
}
function bubble(uid){const b=uid&&O.bubbles[uid];return b?(b.react?`<span class="bubble react">${lazyImg(ART[b.react].prop,T[b.react].nm)}</span>`:`<span class="bubble">${esc(b.text)}</span>`):''}
function playerRow(uid,fb,seat,extra){
  return`<div class="side pl">${uid?avatar(avOf(uid),'sm'):''}${titleTag(P.titles[uid])}<span class="who">${esc(nameOf(uid,fb))}</span><span class="badge">${NAME[seat]}</span>${uid?`<span class="stat">${statText(uid)}</span>`:''}${extra||''}${bubble(uid)}</div>`;
}
function renderWatch(g){
  const u0=O.players[0]?.uid,u1=O.players[1]?.uid,looks=[O.players[0]?.look||{},O.players[1]?.look||{}];
  const head=`<div class="top"><button class="btn ghost small" data-act="leave">退出</button><span class="badge turn">観戦中</span><span class="badge">部屋 ${esc(O.code)}</span>${O.watchers>1?`<span class="badge">👀 ${O.watchers}人</span>`:''}</div>`;
  if(g.phase==='setup')return`${head}<div class="card"><b>対局の準備中です</b><p class="muted">2人が配置を決めると対局が始まります。このまま待っていてください。</p>${u0?playerRow(u0,'先手',0):''}${u1?playerRow(u1,'後手',1):'<p class="muted">後手の参加を待っています</p>'}</div>`;
  const over=g.phase==='over';
  return`${head}${over?`<section class="hero"><h1 class="over-h">${esc(nameOf(O.players[g.winner]?.uid,NAME[g.winner]))}の勝ち</h1><p>${esc(g.reason)}。</p></section>`:''}
    ${playerRow(u1,'後手',1,!over&&g.turn===1?'<span class="badge turn">考え中</span>':'')}
    ${boardHTML(g,0,{watch:!over,reveal:over,looks})}
    ${playerRow(u0,'先手',0,!over&&g.turn===0?'<span class="badge turn">考え中</span>':'')}
    <div class="status wait">${over?'すべての駒を公開しています。':'観戦中は、どちらの駒も正体が分からないまま見られます(バレた駒だけ表示)。'}</div>
    <p class="muted">${rulesText(rulesOf(g))}</p>`;
}
function renderOnline(){
  const back=`<div class="top"><button class="btn ghost small" data-act="go" data-to="battle">‹ 戻る</button><h2 class="ttlh">オンライン対戦</h2></div>`;
  if(!SUPABASE_URL||!SUPABASE_ANON_KEY)return`${back}<div class="card"><b>オンライン対戦の準備がまだです</b><p class="muted">サイトを公開した人が config.js に Supabase の URL とキーを設定すると使えるようになります。</p><button class="btn orange" data-act="local">1台で対戦する</button></div>`;
  if(sbFail)return`${back}<div class="card"><b>サーバーに接続できませんでした</b><p class="muted">通信環境を確認して、ページを読み込み直してください。</p><button class="btn orange" data-act="local">1台で対戦する</button></div>`;
  if(!sb)return`<div class="card"><p class="muted">接続しています…</p></div>`;
  if(!O.code&&!myName())return`${back}${nameCard()}${M.err?`<p class="err">${esc(M.err)}</p>`:''}`;
  if(!O.code){
    const pre=new URLSearchParams(location.search).get('room')||store.get('jinro-room')||'';
    return`${back}
      <div class="card"><b>部屋を作る</b><p class="muted">あなたが先手になります。表示されるコードかリンクを相手に送ってください。フレンドなら「フレンド」画面から直接誘えます。</p><button class="btn orange" data-act="create" ${O.busy?'disabled':''}>部屋を作る</button></div>
      <div class="card"><b>部屋に入る・観戦する</b><p class="muted">相手から届いた4文字のコードを入力します。対戦するとあなたは後手です。観戦は見るだけで、どちらの駒の正体も見えません。</p>
        <div class="row"><input id="code" class="codein" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="ABCD" value="${esc(pre)}"><button class="btn" data-act="join" ${O.busy?'disabled':''}>対戦</button><button class="btn ghost" data-act="watch" ${O.busy?'disabled':''}>観戦</button></div></div>
      ${O.err?`<p class="err">${esc(O.err)}</p>`:''}${rulesHTML()}`;
  }
  const g=O.game,me=O.seat,op=1-me;
  if(!g)return`<div class="card"><p class="muted">部屋を読み込んでいます…</p><button class="btn ghost small" data-act="leave">退出</button></div>`;
  if(O.watch)return renderWatch(g);
  const opIn=!!O.players[op],myUid=O.uid,opUid=O.players[op]?.uid;
  const looks=[O.players[0]?.look||{},O.players[1]?.look||{}];looks[me]=myLook();
  const head=`<div class="top"><button class="btn ghost small" data-act="leave">退出</button>${g.phase==='setup'?`<span class="badge">部屋 ${esc(O.code)}</span>`:clocksHTML(me,op,esc(nameOf(myUid,'あなた')),esc(nameOf(opUid,'相手')),g)}</div>${O.watchers?`<div class="watchers">👀 ${O.watchers}人が観戦中</div>`:''}`;
  const err=O.err?`<p class="err">${esc(O.err)}</p>`:'';
  if(g.phase==='setup'){
    const mine=O.players[me],R=rulesOf(g);
    const rc=rulesCard(R,me===0);
    const vs=opIn?`<div class="card vs">${playerRow(opUid,'相手',op)}<span class="muted">が入りました</span></div>`:'';
    const wait=!opIn?`<div class="card" style="text-align:center"><p class="muted">相手を待っています。このコードかリンクを送ってください</p><div class="code">${esc(O.code)}</div><div class="row" style="justify-content:center"><button class="btn ghost small" data-act="copyLink">招待リンクをコピー</button><button class="btn ghost small" data-act="copy">コードをコピー</button></div></div>`:'';
    const watchLink=`<p class="muted">観戦用リンク:<button class="linkbtn" data-act="copyWatch">コピー</button></p>`;
    if(mine&&mine.ready)return`${head}${wait}${vs}${rc}<div class="card"><b>配置を決めました</b><p class="muted">${opIn?'相手が配置を決めるのを待っています。':'相手が入ってくるのを待っています。'}そろったら自動で対局が始まります。</p></div>${err}${opIn?stampBar():''}${rulesHTML()}`;
    const pool=[...SWAP_BASE,...(R.chars?ownedChars():[])];
    const note=R.chars&&!ownedChars().length?'<p class="muted">新キャラはガチャで手に入ります。</p>':'';
    return`${head}${wait}${watchLink}${vs}${rc}<div class="side"><span class="who">あなた(${NAME[me]})の配置</span><span class="badge">2マスを順にタップで入れ替え</span></div>
      ${setupHTML(O.draft,O.sel?.i,pool,myLook(),O.deckMsg)}${note}${setupControls()}<button class="btn orange" data-act="ready" ${O.busy?'disabled':''}>この配置で決定</button>${err}${opIn?stampBar():''}${rulesHTML()}`;
  }
  if(g.phase==='over'){
    const win=g.winner===me,c3k=`${O.code}-${g.startNo}-${me}`;
    if(!O.c3||O.c3.key!==c3k)O.c3={key:c3k,news:charaEnd(g,me,'on-'+c3k)};
    return`<div class="top"><button class="btn ghost small" data-act="leave">退出</button></div>
      <section class="hero"><h1 class="over-h">${win?'あなたの勝ち':'あなたの負け'}</h1><p>${esc(g.reason)}。すべての駒を公開しています。</p></section>
      ${unlockNotice(O.c3.news,g.decks?.[me])}
      <div class="card">${playerRow(myUid,'あなた',me,g.winner===me?'<span class="badge turn">勝ち</span>':'')}${playerRow(opUid,'相手',op,g.winner===op?'<span class="badge turn">勝ち</span>':'')}</div>
      ${boardHTML(g,me,{reveal:true,looks})}
      ${stampBar()}
      ${me===0?`<button class="btn orange" data-act="rematch" ${O.busy?'disabled':''}>同じ相手ともう一度</button>`:`<p class="muted">先手(部屋を作った人)が「もう一度」を押すと次の対局の配置に進みます。</p>`}${err}`;
  }
  const myTurn=g.turn===me&&!O.busy;
  let status;
  if(O.toast&&g.turn!==me)status=`<div class="status${O.toast.bad?' alert':''}">${esc(O.toast.text)}</div><div class="status wait">相手の番です。</div>`;
  else if(g.turn===me){const n=g.note&&g.note.for===me?g.note:null;status=`${n&&n.extra&&O.toast?`<div class="status${O.toast.bad?' alert':''}">${esc(O.toast.text)}</div>`:''}<div class="status${n&&n.alert?' alert':''}">${n?esc(n.text)+' ':''}あなたの番です。</div>`}
  else status=`<div class="status wait">相手の番です。</div>`;
  return`${head}
    ${playerRow(opUid,'相手',op,`${rulesOf(g).drops?`<span class="badge">持ち駒 ${g.hands[op].length}枚</span>`:''}${g.turn===op?'<span class="badge turn">考え中</span>':''}`)}
    ${boardHTML(g,me,{sel:O.sel,interactive:myTurn,looks})}
    ${playerRow(myUid,'あなた',me,g.turn===me?'<span class="badge turn">あなたの番</span>':'')}
    ${myTurn?abilityBar(g,O.sel):''}
    ${handHTML(g,me,O.sel,myTurn,myLook())}
    ${status}${err}
    ${stampBar()}
    <div class="row"><span class="muted">${rulesText(rulesOf(g))}</span><span class="spacer"></span><button class="btn ${O.resignArm?'danger':'ghost'} small" data-act="oresign">${O.resignArm?'もう一度押すと投了':'投了'}</button></div>${rulesHTML()}`;
}
async function copyText(text,el){
  try{await navigator.clipboard.writeText(text);el.textContent='コピーしました'}
  catch(e){el.textContent=text}
}
async function onlineAct(a,el){
  if(a!=='oresign')O.resignArm=false;
  if(a==='saveName')return saveName(document.getElementById('pname')?.value);
  if(a==='create')return createRoom();
  if(a==='join')return joinRoom(document.getElementById('code')?.value);
  if(a==='watch')return watchRoom(document.getElementById('code')?.value);
  if(a==='leave'){leaveRoom();return}
  if(a==='copy')return copyText(O.code,el);
  if(a==='copyLink')return copyText(roomLink(O.code),el);
  if(a==='copyWatch')return copyText(location.origin+location.pathname+'?watch='+O.code,el);
  if(a==='stampToggle'){O.stampOpen=!O.stampOpen;render();return}
  if(a==='stamp')return sendStamp(el.dataset.id);
  if(a==='setTime'||a==='setRule'){
    const g=O.game;if(!g||g.phase!=='setup'||O.seat!==0)return;
    const r=rulesOf(g);if(a==='setTime')r.time=+el.dataset.v;else{const [k,v]=el.dataset.v.split(':');r[k]=v==='1'}
    await saveGame({...clone(g),rules:r,time:[r.time,r.time]});render();return;
  }
  if(a==='swap'){const i=+el.dataset.i,ar=O.draft;O.deckMsg='';if(O.sel&&O.sel.i!=null&&O.sel.i!==i){[ar[O.sel.i],ar[i]]=[ar[i],ar[O.sel.i]];O.sel=null}else O.sel=O.sel&&O.sel.i===i?null:{i}}
  else if(a==='pick'){O.deckMsg=pickInto(O.draft,O.sel?.i,el.dataset.t);if(!O.deckMsg)O.sel=null}
  else if(a==='preset'){O.draft=PRESETS[+el.dataset.k].a.slice();O.sel=null}
  else if(a==='shuffle'){shuffle(O.draft);O.sel=null}
  else if(a==='ready'){
    const R=rulesOf(O.game),mine=new Set(ownedChars());
    if(O.draft.some(t=>NEWC.includes(t)&&(!R.chars||!mine.has(t)))){O.draft=sanitizeDeck(O.draft,{chars:false});O.deckMsg='このルールでは使えない新キャラを基本の駒に戻しました。もう一度確認してください。';render();return}
    O.busy=true;O.err='';
    const row={code:O.code,seat:O.seat,uid:O.uid,ready:true,setup:O.draft.slice(),look:myLook()};
    O.players[O.seat]=row;render();
    const {error}=await sb.from('jinro_seats').upsert(row);
    if(error){O.err=errText(error);fetchAll()}
    O.busy=false;maybeStart();
  }
  else if(a==='hand'){const i=+el.dataset.i;O.sel=O.sel&&O.sel.hand===i?null:{hand:i}}
  else if(a==='cell'){
    const g=O.game;if(!g||g.phase!=='play'||g.turn!==O.seat||O.busy)return;
    const[r,c]=toAbs(O.seat,+el.dataset.r,+el.dataset.c),d=decideTap(g,O.seat,O.sel,r,c);
    if(d.act==='sel')O.sel=d.sel;
    else return commit(G=>d.act==='drop'?applyDrop(G,d.i,r,c):d.act==='ab'?applyAbility(G,d.from[0],d.from[1],r,c):applyMove(G,d.from[0],d.from[1],r,c));
  }
  else if(a==='bite'){if(O.sel)O.sel={r:O.sel.r,c:O.sel.c,ab:!O.sel.ab}}
  else if(a==='abSelf'&&O.sel){const s2=O.sel;return commit(G=>applyAbility(G,s2.r,s2.c,s2.r,s2.c))}
  else if(a==='oresign'){if(O.resignArm){O.resignArm=false;return writeEnd(1-O.seat,`${NAME[O.seat]}が投了しました`)}O.resignArm=true}
  else if(a==='rematch'){
    O.busy=true;render();
    const {error}=await sb.from('jinro_seats').update({ready:false}).eq('code',O.code);
    if(error)O.err=errText(error);
    for(const s of [0,1])if(O.players[s])O.players[s]={...O.players[s],ready:false};
    await saveGame(blankGame(O.code,O.game.moveNo+1,rulesOf(O.game)));
    O.busy=false;
  }
  render();
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')return;if(O.code)fetchAll();else refreshState()});
setInterval(()=>{if(S.screen==='online'&&O.code)fetchAll();else if(['home','friends'].includes(S.screen)&&document.visibilityState==='visible')refreshState()},15000);

/* ===== clocks ===== */
let lastT=null;
function clockState(p){
  if(S.screen==='local'&&L&&L.G){const G=L.G,tot=rulesOf(G).time;if(!tot)return null;return{main:G.time[p],tot,byo:p===G.turn?L.byo:BYO,on:p===G.turn&&(L.phase==='play'||L.phase==='result')}}
  if(S.screen==='online'&&O.game&&O.game.time){
    const g=O.game,tot=rulesOf(g).time;if(!tot)return null;let rem=g.time[p],byo=BYO;const on=g.phase==='play'&&p===g.turn;
    if(on){rem-=(Date.now()-O.seenAt)/1000;if(rem<0){byo=BYO+rem;rem=0}}
    return{main:Math.max(0,rem),tot,byo,on};
  }
  return null;
}
function updateClocks(){
  document.querySelectorAll('[data-clock]').forEach(el=>{
    const p=+el.dataset.clock,st=clockState(p);if(!st)return;
    let txt;if(st.main>0){const s=Math.ceil(st.main);txt=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}else txt=`秒読み ${Math.max(0,Math.ceil(st.byo))}`;
    el.textContent=txt;el.classList.toggle('byo',st.main<=0);
    const m=document.querySelector(`[data-meter="${p}"]`);if(m)m.style.width=(st.main>0?st.main/st.tot*100:Math.max(0,st.byo)/BYO*100)+'%';
    const box=document.querySelector(`[data-ck="${p}"]`);if(box)box.classList.toggle('on',st.on);
  });
}
setInterval(()=>{
  if(S.screen==='local'&&L&&L.phase==='play'&&rulesOf(L.G).time>0){
    const now=performance.now();if(lastT==null){lastT=now;return}
    let dt=(now-lastT)/1000;lastT=now;const G=L.G,t=G.turn;
    if(G.time[t]>0){const u=Math.min(dt,G.time[t]);G.time[t]-=u;dt-=u}
    if(dt>0&&G.time[t]<=0){L.byo-=dt;if(L.byo<=0){G.winner=1-t;G.reason=`${NAME[t]}の時間切れ`;L.phase='over';render();return}}
  }else lastT=null;
  if(S.screen==='online'&&O.game&&O.game.phase==='play'&&!O.timeoutSent){
    const g=O.game,st=clockState(g.turn),grace=g.turn===O.seat?0:3;
    if(!O.watch&&st&&st.main<=0&&st.byo<-grace){O.timeoutSent=true;writeEnd(1-g.turn,`${NAME[g.turn]}の時間切れ`)}
  }
  updateClocks();
},200);

/* ===== home & meta screens ===== */
const coinIcon='<span class="cn" aria-hidden="true"></span>';
function nameCard(){
  const n=myName();
  return`<div class="card"><b>${n?'名前を変更':'プレイヤー名を決めよう'}</b><p class="muted">対戦相手やフレンドに表示される名前です(12文字まで)。</p>
    <div class="row"><input id="pname" class="namein" maxlength="12" autocomplete="nickname" placeholder="なまえ" value="${esc(n)}"><button class="btn" data-act="saveName">保存</button>${n?'<button class="btn ghost small" data-act="cancelName">やめる</button>':''}</div></div>`;
}
function headerBar(){
  const st=M.st;
  return`<header class="hbar"><button class="avbtn" data-act="openAvatar" aria-label="アイコンを変える">${avatar(avOf(O.uid),'lg')}<i>変更</i></button>
    <button class="hname" data-act="editName" aria-label="名前を変更">${titleTag(st?.title)}<b>${esc(myName())}</b><span class="stat">${statText(O.uid)}</span></button>
    ${soundBtn()}<button class="coin" data-act="go" data-to="gacha" aria-label="コイン ${st?st.coins:0}枚">${coinIcon}<b>${st?st.coins:'…'}</b></button></header>`;
}
function achReady(){if(!M.st||!M.st.stats)return 0;const c=new Set(M.st.ach_claimed||[]);return ACHIEVEMENTS.filter(a=>!c.has(a.id)&&(M.st.stats[a.stat]||0)>=a.goal).length}
function missionsReady(){if(!M.st)return 0;const c=new Set(M.st.claimed);return MISSIONS.filter(m=>!c.has(m.id)&&(M.st.missions[m.id]||0)>0).length+achReady()}
function friendBadge(){if(!M.st)return 0;return M.st.friends.filter(f=>f.incoming).length+M.st.invites.length}
function inviteBanner(){
  if(!M.st||!M.st.invites.length)return'';
  return M.st.invites.slice(0,2).map(i=>`<div class="card invite"><div><b>${esc(i.name||'フレンド')}</b>さんが対戦に誘っています</div><button class="btn orange small" data-act="acceptInvite" data-code="${esc(i.code)}">入る</button></div>`).join('');
}
function renderHome(){
  if(!myName()||P.editing){
    return`<section class="hero stage solo"><div class="moon" aria-hidden="true"></div><div class="stage-in"><span class="eyebrow">月夜の心理戦</span><h1 class="logo">人狼<span>将棋</span></h1><p class="tagline">正体を隠した6枚の駒で、相手の王様を狙う心理戦。</p></div></section>
      ${nameCard()}${M.err?`<p class="err">${esc(M.err)}</p>`:''}
      <button class="mode-card m-local" data-act="local"><span class="mico">${UI.phone}</span><span class="mtxt"><b>1台で対戦</b><small>名前を決めなくても、スマホ1台ですぐ遊べます</small></span><span class="marr">›</span></button>${rulesHTML()}`;
  }
  const st=M.st,done=st?MISSIONS.filter(m=>st.claimed.includes(m.id)).length:0,mr=missionsReady();
  const bk=todayBanner(),BN=BANNERS[bk],feat=bannerItems(bk).filter(i=>bk==='S'?true:i.rarity==='LR');
  const own=owned(),allItems=[...ITEMS,...ACH_ITEMS],have=allItems.filter(i=>own.has(i.id)).length;
  return`${headerBar()}${inviteBanner()}
    <section class="stage">
      <div class="moon" aria-hidden="true"></div>
      <div class="stage-in">
        <span class="eyebrow">月夜の心理戦</span>
        <h1 class="logo">人狼<span>将棋</span></h1>
        <p class="tagline">正体を隠した6枚で、相手の王様を狙え。</p>
        <button class="btn gold xl" data-act="go" data-to="battle">${UI.sword}対戦する</button>
      </div>
      <div class="stage-pcs" aria-hidden="true">${['wolf','king','seer'].map((t,i)=>`<span class="spc spc${i}">${tile(t,{look:myLook()})}</span>`).join('')}</div>
    </section>
    <button class="feature b-${bk}" data-act="go" data-to="gacha">
      <span class="ftag">${bk==='S'?'日曜限定':'本日のガチャ'}</span>
      <b class="fname">${esc(BN.name)}</b><small class="fdesc">${esc(BN.desc)}</small>
      <span class="fchars">${feat.slice(0,8).map(i=>`<span class="fc">${tile(i.char)}</span>`).join('')}</span>
      <span class="fgo">ガチャへ ›</span>
    </button>
    <div class="quick">
      <button class="qcard" data-act="go" data-to="missions">${mr?`<i class="dot">${mr}</i>`:''}<span class="qico">${UI.mission}</span><b>デイリー</b>
        <span class="qbar"><i style="width:${done/MISSIONS.length*100}%"></i></span><small>今日 ${done}/${MISSIONS.length} 達成</small></button>
      <button class="qcard" data-act="zukan"><span class="qico">📖</span><b>図鑑・物語</b>
        <span class="qbar"><i style="width:${C3KEYS.filter(k=>unlocks(k).icon).length/C3KEYS.length*100}%"></i></span><small>${C3KEYS.filter(k=>unlocks(k).icon).length}/${C3KEYS.length}体 解放</small></button>
      <button class="qcard" data-act="go" data-to="pieces"><span class="qico">♟️</span><b>駒の一覧</b>
        <span class="qbar"><i style="width:100%"></i></span><small>全${BASE.length+NEWC.length}種類の動きと能力</small></button>
      <button class="qcard" data-act="go" data-to="collection"><span class="qico">${UI.coll}</span><b>コレクション</b>
        <span class="qbar"><i style="width:${allItems.length?have/allItems.length*100:0}%"></i></span><small>${have}/${allItems.length} 所持</small></button>
    </div>
    ${M.err?`<p class="err">${esc(M.err)}</p>`:''}
    ${rulesHTML()}`;
}
// 駒の一覧:すべての駒の動き・能力・手に入れ方をだれでも見られる
function pieceRow(k){
  const it=CHAR_ITEM[k],r=rarOfChar(k),own=hasChar(k),ab=AB[k];
  return`<button class="piece-row r-${r}" data-act="charInfo" data-c="${k}">
    <span class="pr-tile">${tile(k,{})}</span>
    <span class="pr-body"><span class="pr-head"><b>${esc(T[k].nm)}</b><span class="rar r-${r}">${r}</span>${it?(own?'<span class="ownd2">所持</span>':''):''}${ab?'<span class="abtag">1局1回の能力</span>':''}</span>
      <span class="pr-d">${esc(T[k].d)}</span>${whereTag(k)}</span></button>`;
}
function renderPieces(){
  const ssrBase=ITEMS.filter(i=>i.kind==='char'&&i.rarity==='SSR'&&!i.banner).map(i=>i.char);
  const sec=(t,sub,keys)=>`<section class="psec"><h3>${t}</h3>${sub?`<p class="muted">${sub}</p>`:''}${keys.map(pieceRow).join('')}</section>`;
  const lrOf=b=>ITEMS.filter(i=>i.kind==='char'&&i.rarity==='LR'&&i.banner===b).map(i=>i.char);
  const sunSSR=ITEMS.filter(i=>i.kind==='char'&&i.rarity==='SSR'&&i.banner==='S').map(i=>i.char);
  return`${backBar('駒の一覧','home')}
    <div class="card"><p class="muted">ゲームに出てくる駒は全部で${BASE.length+NEWC.length}種類。動ける方向は駒の三角の印で、どれも1マスずつです。タップするとキャラの詳細が見られます。</p></div>
    ${sec('最初から使える駒','王様と人狼はかならず編成に入ります。',BASE)}
    ${sec('毎日(月〜土)のガチャで出る駒','SSR。特別コイン5枚で交換もできます。',ssrBase)}
    ${sec('月・水・土のガチャで出る駒','LR(レジェンドレア)',lrOf('A'))}
    ${sec('火・木・金のガチャで出る駒','LR(レジェンドレア)',lrOf('B'))}
    ${sec('日曜限定ガチャで出る駒','日曜にしか出ない8体。LR 2体・SSR 6体',[...lrOf('S'),...sunSSR])}
    ${rulesHTML()}`;
}
// 対戦の入り口
function renderBattle(){
  const fr=M.st?M.st.friends.filter(f=>f.status==='accepted').length:0;
  return`${backBar('対戦')}
    <button class="mode-card m-online" data-act="online"><span class="mico">${UI.globe}</span><span class="mtxt"><b>オンライン対戦</b><small>部屋コードで、それぞれのスマホから対戦。観戦もここから</small></span><span class="marr">›</span></button>
    <div class="mode-card m-cpu"><span class="mico">${UI.cpu}</span><span class="mtxt"><b>CPU対戦</b><small>ひとりで練習。勝つと難易度に応じてコイン(1日50枚まで)</small>
      <span class="lvrow">${Object.entries(CPU_LV).map(([k,v])=>`<button class="lvbtn lv-${k}" data-act="cpu" data-lv="${k}"><b>${v.nm}</b><small>${coinIcon}${v.coin}</small></button>`).join('')}</span></span></div>
    <button class="mode-card m-local" data-act="local"><span class="mico">${UI.phone}</span><span class="mtxt"><b>1台で対戦</b><small>スマホを交代で渡して、2人で遊ぶ</small></span><span class="marr">›</span></button>
    ${myName()?`<button class="mode-card m-friend" data-act="go" data-to="friends"><span class="mico">${UI.friend}</span><span class="mtxt"><b>フレンドを誘う</b><small>フレンド ${fr}人。誘うとすぐ部屋ができます</small></span><span class="marr">›</span></button>`:''}
    <button class="btn ghost" data-act="go" data-to="pieces">♟️ 駒の一覧(全${BASE.length+NEWC.length}種類の動き・能力・手に入れ方)</button>
    ${rulesHTML()}`;
}
// 画面下のタブ
const UI={
  home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11 12 3.8l8.5 7.2V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/></svg>',
  gacha:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="5.8"/><path d="M5.5 13.2h13V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/><circle cx="12" cy="17" r="1.7"/><path d="M9 7.2a3.3 3.3 0 0 1 2.4-2"/></svg>',
  friend:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.4"/><path d="M2.6 20.5c.6-3.7 3.2-5.7 6.4-5.7s5.8 2 6.4 5.7z"/><circle cx="17.2" cy="9" r="2.7"/><path d="M16.2 14.3c2.8.2 4.8 2 5.3 5.2"/></svg>',
  mission:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="3" width="15" height="18" rx="2.2"/><path d="m8 9.3 2.1 2.1L14.6 7M8 15.5h8"/></svg>',
  coll:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><path d="m17 13.3 1.1 2.3 2.5.4-1.8 1.8.4 2.5-2.2-1.2-2.2 1.2.4-2.5-1.8-1.8 2.5-.4z"/></svg>',
  sword:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 3.5H20.5V9.5L9 21 3 15zM6 12l6 6M3.5 20.5l3-3"/></svg>',
  globe:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3.6 3.2 14.4 0 18M12 3c-3.2 3.6-3.2 14.4 0 18"/></svg>',
  cpu:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="7" width="14" height="12" rx="3"/><path d="M12 7V4M9.5 12h.01M14.5 12h.01M9.5 15.5h5M2.5 12v3M21.5 12v3"/><circle cx="12" cy="3.5" r="1"/></svg>',
  phone:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.8 18.4h2.4M3 9l2 2-2 2M21 9l-2 2 2 2"/></svg>',
};
const NAV=[['home','ホーム','home'],['gacha','ガチャ','gacha'],['friends','フレンド','friend'],['missions','ミッション','mission']];
const NAV_OF={pieces:'home',home:'home',battle:'home',collection:'home',story:'home',online:'home',gacha:'gacha',friends:'friends',missions:'missions'};
function showNav(){const s=S.screen;if(!myName()||P.editing)return false;if(s==='local')return false;if(s==='online')return !O.code;return s in NAV_OF}
function navBar(){
  const cur=NAV_OF[S.screen],badge={missions:missionsReady(),friends:friendBadge()};
  return`<nav class="bnav" aria-label="メニュー">${NAV.map(([k,l,ic])=>`<button class="bn${cur===k?' on':''}" data-act="go" data-to="${k}" ${cur===k?'aria-current="page"':''}><span class="bni">${UI[ic]}</span><span class="bnl">${l}</span>${badge[k]?`<i class="dot">${badge[k]}</i>`:''}</button>`).join('')}</nav>`;
}
function backBar(t,back){return`<div class="top">${back?`<button class="btn ghost small" data-act="go" data-to="${back}">‹ 戻る</button>`:''}<h2 class="ttlh">${t}</h2><span class="spacer"></span>${soundBtn()}<span class="coin static">${coinIcon}<b>${M.st?M.st.coins:'…'}</b></span></div>`}

/* ---- avatar ---- */
function avatarModal(){
  const m=M.modal,av=m.av,pool=[...BASE,...ownedChars()];
  const st=m.illus!==false?bestStyle(av.c):null;
  return`<div class="modal"><div class="mbox"><span class="tag">アイコン</span><div class="avprev">${avatar({...av,s:st},'xl')}</div>
    <label class="illus"><input type="checkbox" data-act="avIllus" ${m.illus!==false?'checked':''}> 顔イラストを使う(そのキャラを1回使うと解放)</label>
    <b class="left">キャラ</b><div class="avgrid">${pool.map(c=>`<button class="avpick${av.c===c?' on':''}" data-act="avChar" data-c="${c}" aria-label="${T[c].nm}">${avatar({c,bg:av.bg,s:m.illus!==false?bestStyle(c):null},'md')}<small>${T[c].nm}</small></button>`).join('')}</div>
    ${NEWC.some(c=>!ownedChars().includes(c))?'<p class="muted left">新キャラはガチャで手に入れるとアイコンにできます。</p>':''}
    <b class="left">背景の色</b><div class="avcolors">${AV_BG.map((c,i)=>`<button class="avc${av.bg===i?' on':''}" style="background:${c}" data-act="avBg" data-i="${i}" aria-label="色${i+1}"></button>`).join('')}</div>
    <div class="row center"><button class="btn ghost" data-act="closeModal">やめる</button><button class="btn orange" data-act="saveAvatar" ${m.busy?'disabled':''}>保存</button></div></div></div>`;
}
async function saveAvatar(){
  const av=M.modal.av,s=M.modal.illus!==false?bestStyle(av.c):null;M.modal.busy=true;render();
  try{
    try{await rpc('jinro_set_avatar2',{p_char:av.c,p_bg:av.bg,p_style:s||'svg'})}
    catch(e){if(e.code==='notowned'||e.code==='avatar')throw e;await rpc('jinro_set_avatar',{p_char:av.c,p_bg:av.bg})}
    store.set('jinro-avatar',JSON.stringify({c:av.c,bg:av.bg,s:s||null}));
    P.avatars[O.uid]={c:av.c,bg:av.bg,...(s?{s}:{})};if(M.st)M.st.avatar=P.avatars[O.uid];M.modal=null;toast('アイコンを変えました')}
  catch(e){M.modal.busy=false;M.err=e.message;render()}
}

/* ---- login bonus ---- */
function loginModal(){
  const m=M.modal;
  if(!m.result)return`<div class="modal"><div class="mbox"><span class="tag">ログインボーナス</span><h2>今日もようこそ！</h2><p class="muted">毎日${LOGIN.daily}コイン。7日連続ログインで+${LOGIN.weekBonus}コイン。</p>
    <button class="btn orange" data-act="claimLogin" ${m.busy?'disabled':''}>受け取る</button></div></div>`;
  const r=m.result,day=((r.streak-1)%7)+1;
  const days=[1,2,3,4,5,6,7].map(d=>`<div class="lday${d<=day?' got':''}${d===day?' today':''}"><small>${d}日目</small><b>${d===7?LOGIN.daily+LOGIN.weekBonus:LOGIN.daily}</b></div>`).join('');
  return`<div class="modal"><div class="mbox"><span class="tag">ログインボーナス</span><h2>+${r.reward}コイン</h2><p class="muted">連続${r.streak}日目</p><div class="ldays">${days}</div>
    ${r.welcome?`<div class="welcome"><b>はじめてボーナス +${r.welcome}コイン</b><span>さっそく10連ガチャが引けます！</span></div><button class="btn orange" data-act="go" data-to="gacha">ガチャへ行く</button>`:''}
    <button class="btn ${r.welcome?'ghost':'orange'}" data-act="closeModal">閉じる</button></div></div>`;
}

/* ---- gacha ---- */
// 全身イラスト。画像がまだ無いときは駒アイコンを出す
// 解放済みなら全身(50回)→顔アイコン(1回)の順で画像、未解放は駒アイコン
function portrait(k,cls=''){const a=ART[k],u=a?unlocks(k):null;const src=!u?null:u.full?(u.lux&&a.fullbodyLux?a.fullbodyLux:a.fullbody):u.icon?(u.lux&&a.iconLux?a.iconLux:a.icon):null;
  return`<span class="portrait ${cls}${u&&!u.full&&u.icon?' faceonly':''}">${tile(k,{})}${src?lazyImg(src,T[k].nm):''}</span>`}
function itemArt(it,big){
  if(!it)return'';
  if(it.kind==='char')return portrait(it.char);
  if(it.kind==='skin')return tile('king',{look:{skin:it.id}});
  if(it.kind==='frame')return tile('knight',{look:{frame:it.id}});
  if(it.kind==='wolf')return tile('wolf',{look:{wolf:it.id}});
  if(it.kind==='back')return tile(null,{hidden:true,look:{back:it.id}});
  if(it.kind==='title')return`<span class="art-title">称号</span>`;
  return`<span class="art-stamp">💬</span>`;
}
function itemCard(it,o={}){
  return`<div class="icard r-${it.rarity}${o.locked?' locked':''}${o.on?' on':''}" style="${o.delay!=null?`animation-delay:${o.delay}ms`:''}">
    <span class="rar r-${it.rarity}">${it.rarity}</span><div class="iart">${o.locked?'<span class="art-lock">?</span>':itemArt(it)}</div>
    <b class="iname">${o.locked?'？？？':esc(it.name)}</b><small>${KIND_LABEL[it.kind]}</small>${o.extra||''}</div>`;
}
const CAP_COLOR={N:'#e9ecf4',R:'#3f86f0',SR:'#a855f7',SSR:'#f5b82e',LR:'#ff6f93'};
// 今日のガチャ(サーバーの日本時間を優先)
const WD='日月火水木金土';
function todayBanner(){if(M.st?.banner)return M.st.banner;const d=new Date(Date.now()+9*3600e3).getUTCDay();return bannerOfDay(d||7)}
// そのガチャで出るキャラ:LRは曜日のキャラ。SSRは月〜土が基本の4体、日曜は日曜限定の6体
const inBanner=(i,k)=>i.kind==='char'&&(i.rarity==='LR'?i.banner===k:k==='S'?i.banner==='S':!i.banner);
const bannerItems=k=>ITEMS.filter(i=>inBanner(i,k));
// 出るキャラを1体ずつスライドで見る
// スライド:画面の中央に来たキャラを登場させ、指でなぞると少し傾く
let slideIO=null;
function setupSlides(){
  const box=document.querySelector('.slides');if(!box)return;
  if(slideIO)slideIO.disconnect();
  if(!('IntersectionObserver' in window)){box.querySelectorAll('.slide').forEach(x=>x.classList.add('on'));return}
  slideIO=new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('on',e.intersectionRatio>.6)),{root:box,threshold:[0,.6,1]});
  box.querySelectorAll('.slide').forEach(x=>slideIO.observe(x));
}
function tiltArt(e){
  const art=e.target.closest&&e.target.closest('.sl-art');if(!art)return;
  const r=art.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
  art.style.setProperty('--rx',(-y*10).toFixed(1)+'deg');art.style.setProperty('--ry',(x*12).toFixed(1)+'deg');
}
document.addEventListener('pointermove',tiltArt,{passive:true});
document.addEventListener('pointerleave',e=>{const a=e.target.closest&&e.target.closest('.sl-art');if(a){a.style.removeProperty('--rx');a.style.removeProperty('--ry')}},true);
function charSlides(list){
  return`<div class="slides" aria-label="このガチャで出るキャラ">${list.map((i,n)=>{const k=i.char,pf=PROFILE[k]||{},own=owned().has(i.id);
    return`<article class="slide r-${i.rarity}">
      <div class="sl-top"><span class="rar big r-${i.rarity}">${i.rarity}</span><small class="sl-n">${n+1}/${list.length}</small>${own?'<span class="ownd2">所持</span>':''}</div>
      <div class="sl-art" data-act="artTap">${i.rarity==='LR'||i.rarity==='SSR'?`<span class="aura a-${i.rarity}"></span>`:''}<span class="sl-shadow"></span><span class="sl-bg" style="background-image:url('${ART[k]?.fullbody||''}')"></span><span class="sl-chara">${fullbodyImg(k,{cls:'sl',silhouetteIfLocked:false})}<span class="sl-fallback">${tile(k,{})}</span></span>${'<i class="spk"></i>'.repeat(i.rarity==='LR'?8:5)}<span class="sl-shine"></span></div>
      <h3>${esc(T[k].nm)}${pf.name?`<small>${esc(pf.name)}</small>`:''}</h3>
      ${pf.alias?`<p class="sl-alias">${esc(pf.alias)}</p>`:''}
      <p class="wherebox">${whereTag(k)}</p>
      ${pf.intro?`<p class="sl-story">${esc(pf.intro)}</p>`:''}
      <div class="sl-piece">${tile(k,{})}<div><b>どんな駒？</b><p>${esc(T[k].d)}</p></div></div>
      <button class="btn ghost small" data-act="charInfo" data-c="${k}">くわしく見る</button>
    </article>`}).join('')}</div><p class="muted center swipehint">← 左右にスワイプして1体ずつ見られます →</p>`;
}
function renderGacha(){
  const c=M.st?.coins??0,busy=!!M.anim,tk=M.st?.tokens??0,bk=todayBanner(),BN=BANNERS[bk],sun=bk==='S';
  const pick=bannerItems(bk).sort((a,b)=>RARITY_ORDER.indexOf(a.rarity)-RARITY_ORDER.indexOf(b.rarity));
  const ssr=ITEMS.filter(i=>i.kind==='char'&&i.rarity==='SSR'),own=owned();
  const days=Object.entries(BANNERS).map(([k,b])=>`<span class="wday${k===bk?' on':''}">${b.days.map(d=>WD[d%7]).join('')}<small>${k==='A'?'通常':k==='B'?'新キャラ':'日曜限定'}</small></span>`).join('');
  return`${backBar('ガチャ')}
    <section class="gbanner b-${bk}"><span class="tag">${sun?'日曜限定':'本日のガチャ'}</span><h2>${esc(BN.name)}</h2><p>${esc(BN.desc)}</p>
      <div class="gpick">${pick.map(i=>`<div class="gp">${tile(i.char)}<span class="rar r-${i.rarity}">${i.rarity}</span></div>`).join('')}</div>
      <div class="wdays" aria-label="曜日ごとのガチャ">${days}</div></section>
    <h3 class="sechead">このガチャで出るキャラ</h3>
    ${charSlides(pick)}
    <div class="gbtns">
      <button class="btn ghost gbtn" data-act="pull" data-n="1" ${busy||c<COST.single?'disabled':''}><b>1回引く</b><small>${coinIcon}${COST.single}</small></button>
      <button class="btn orange gbtn" data-act="pull" data-n="10" ${busy||c<COST.ten?'disabled':''}><b>10連ガチャ</b><small>${coinIcon}${COST.ten}・SR以上1つ確定</small></button>
    </div>
    ${c<COST.single?`<p class="muted">コインはログインボーナス・デイリーミッション・CPU戦の勝利で貯まります。</p>`:''}
    ${M.err?`<p class="err">${esc(M.err)}</p>`:''}
    <div class="card tokens"><div class="row"><span class="tkn" aria-hidden="true">★</span><b>特別コイン ${tk}/${TOKEN_COST}枚</b></div>
      <p class="muted">持っているキャラが出ると特別コインがもらえます(SSR ${TOKEN_REFUND.SSR}枚・LR ${TOKEN_REFUND.LR}枚)。${TOKEN_COST}枚で、好きなSSRキャラ1体と交換できます。</p>
      <div class="exrow">${ssr.map(i=>{const has=own.has(i.id);return`<div class="ex">${tile(i.char)}<b>${esc(i.name)}</b><button class="btn ${has?'ghost':'orange'} small" data-act="exchange" data-id="${i.id}" ${has||tk<TOKEN_COST?'disabled':''}>${has?'所持':'交換'}</button></div>`}).join('')}</div></div>
    <details class="card rates"><summary><b>出る確率と景品</b></summary>
      ${RARITY_ORDER.map(r=>{const list=ITEMS.filter(i=>i.rarity===r&&i.gacha!==false&&(i.kind!=='char'||inBanner(i,bk)));return`<div class="rate"><div class="row"><span class="rar r-${r}">${r}</span><b>${RARITY_LABEL[r]}</b><span class="spacer"></span><b>${RATES[r]}%</b></div><p class="muted">${list.map(i=>esc(i.name)).join('・')}</p></div>`}).join('')}
      <p class="muted">持っている景品が出たときは、N ${REFUND.N}・R ${REFUND.R}・SR ${REFUND.SR}コインが戻ります。キャラ(SSR・LR)は特別コインになります。</p>
    </details>`;
}
// ガチャガチャの機械(SVG)
function machineSVG(A){
  const deco=[[70,105,'#3f86f0'],[100,112,'#ff9f1c'],[130,104,'#a855f7'],[84,128,'#22b573'],[116,128,'#ff6f93'],[58,126,'#f5b82e'],[142,126,'#3f86f0'],[100,88,'#e5484d'],[78,82,'#16a36b'],[123,84,'#f5b82e']];
  return`<svg viewBox="0 0 200 270" class="msvg" aria-hidden="true">
    <circle cx="100" cy="92" r="72" class="dome"/>
    ${deco.map(([x,y,c])=>`<g transform="translate(${x} ${y})"><g class="dcap"><circle r="13" fill="#fff" stroke="#1d2232" stroke-width="2.5"/><path d="M-13 0 A13 13 0 0 1 13 0 Z" fill="${c}" stroke="#1d2232" stroke-width="2.5"/></g></g>`).join('')}
    <path d="M52 50 Q70 30 96 26" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".7"/>
    <rect x="30" y="150" width="140" height="108" rx="16" class="body"/>
    <rect x="44" y="160" width="112" height="22" rx="8" fill="#1d2232"/>
    <text x="100" y="176" text-anchor="middle" class="mlabel">人狼ガチャ</text>
    ${[0,1,2,3,4,5].map(k=>`<circle cx="${44+k*22.4}" cy="252" r="4" class="lamp" style="animation-delay:${k*120}ms"/>`).join('')}
    <g class="knob${A.phase==='turn'||A.phase==='kakutei'?' turn':''}"><circle cx="100" cy="207" r="22" fill="#fff" stroke="#1d2232" stroke-width="3"/><rect x="95" y="189" width="10" height="36" rx="5" fill="#1d2232"/></g>
    <rect x="132" y="220" width="30" height="22" rx="6" fill="#1d2232"/>
  </svg>`;
}
function gachaOverlay(){
  const A=M.anim,best=A.best||'N';
  if(A.phase==='open'&&A.hero!=null){
    const cs=heroChars(A),r=cs[A.hero],it=ITEM[r.item],k=it.char,pf=PROFILE[k],u=unlocks(k);
    return`<div class="modal ghero r-${it.rarity}"><div class="hbg">${fullbodyImg(k,{cls:'hfull'})}</div>
      <div class="hinfo"><span class="rar big r-${it.rarity}">${it.rarity}</span>${r.dup?'':'<span class="new big">NEW</span>'}
        <h2>${esc(it.name)}<small>${esc(pf.name)}</small></h2><p class="alias">${esc(pf.alias)}</p><p class="intro">${esc(pf.intro)}</p>
        ${!u.full?`<small class="muted">全身イラストは、このキャラを手に入れると解放されます</small>`:''}
        <div class="row center">${cs.length>1?`<button class="btn ghost" data-act="heroNext">次のキャラ(${A.hero+1}/${cs.length})</button>`:''}<button class="btn orange" data-act="heroDone">結果を見る</button></div></div></div>`;
  }
  if(A.phase==='open'){
    const tokens=A.results.reduce((s,r)=>s+(r.token||0),0),coins=A.results.reduce((s,r)=>s+(r.refund||0),0);
    return`<div class="modal gmodal best-${best}"><div class="mbox wide"><span class="tag">ガチャ結果</span>${best==='LR'||best==='SSR'?`<h2 class="shout s-${best}">${best==='LR'?'レジェンドレア！！':'超激レア！'}</h2>`:''}
      ${(()=>{const cs=[...new Map(A.results.filter(r=>ITEM[r.item]?.kind==='char').map(r=>[r.item,r])).values()];return cs.length?`<div class="spot">${cs.map(r=>{const it=ITEM[r.item];return`<button class="spotc r-${it.rarity}" data-act="charInfo" data-c="${it.char}">${portrait(it.char,'big')}<span class="rar r-${it.rarity}">${it.rarity}</span><b>${esc(it.name)}</b>${r.dup?'':'<small class="new">NEW</small>'}</button>`}).join('')}</div>`:''})()}
      <div class="gres n${A.results.length}">${A.results.map((r,i)=>itemCard(ITEM[r.item],{delay:i*110,extra:r.token?`<small class="dup tk">被り → 特別コイン+${r.token}</small>`:r.dup?`<small class="dup">被り → +${r.refund}コイン</small>`:'<small class="new">NEW</small>'})).join('')}</div>
      ${coins||tokens?`<p class="muted center">被りの分 ${coins?`+${coins}コイン`:''}${coins&&tokens?'・':''}${tokens?`特別コイン+${tokens}枚(いま${M.st.tokens}/${TOKEN_COST}枚)`:''}</p>`:''}
      <div class="row center"><button class="btn ghost" data-act="go" data-to="collection">コレクション</button>
      <button class="btn ghost" data-act="pull" data-n="${A.n}" ${(M.st.coins<(A.n===10?COST.ten:COST.single))?'disabled':''}>もう一度引く</button>
      <button class="btn orange" data-act="closeGacha">OK</button></div></div></div>`;
  }
  const k=A.phase!=='turn'&&A.kakutei;
  return`<div class="modal gacha-ov ph-${A.phase}${k?' k-'+A.kakutei:''}"><div class="gstage">
    ${k?`<div class="kbanner k-${A.kakutei}">${A.kakutei==='LR'?'レジェンドレア確定！！':'超激レア確定！'}</div>`:'<div class="kbanner ghost"></div>'}
    ${k?'<div class="flash"></div>':''}
    <div class="mach${A.phase!=='drop'?' shake':''}">${machineSVG(A)}</div>
    <div class="tray n${A.n}">${A.phase==='drop'?A.results.map((r,i)=>`<button class="cap c-${r.rarity}" style="animation-delay:${i*140}ms;--cap:${CAP_COLOR[r.rarity]}" data-act="openCaps" aria-label="カプセル"></button>`).join(''):''}</div>
    ${A.phase==='drop'?'<button class="btn orange" data-act="openCaps">カプセルを開ける</button>':'<p class="turning">ガチャガチャを回しています…</p>'}
    <button class="btn ghost small skip" data-act="skipGacha">スキップ</button></div></div>`;
}
const RANK=r=>RARITY_ORDER.indexOf(r);
// ガチャで当たったキャラ(レア度の高い順・重複なし)
function heroChars(A){return[...new Map((A.results||[]).filter(r=>ITEM[r.item]?.kind==='char').map(r=>[r.item,r])).values()].sort((a,b)=>RANK(a.rarity)-RANK(b.rarity))}
async function pull(n){
  if(M.anim&&M.anim.phase!=='open')return;
  M.err='';const t0=Date.now();
  M.anim={phase:'turn',n,results:null};render();sfx('gacha_lever');
  let r;
  try{r=await rpc('jinro_gacha',{p_count:n,p_pick:null})}
  catch(e){M.anim=null;M.err=e.message;render();return}
  M.st.coins=r.coins;M.st.tokens=r.tokens;r.results.forEach(x=>{if(!M.st.items.includes(x.item))M.st.items.push(x.item)});setOwnedChars(ownedChars());
  const best=r.results.reduce((b,x)=>RANK(x.rarity)<RANK(b)?x.rarity:b,'N');
  const A={phase:'turn',n,results:r.results,best,kakutei:(best==='LR'||best==='SSR')?best:null};
  await new Promise(res=>setTimeout(res,Math.max(0,1500-(Date.now()-t0))));
  if(M.anim?.phase!=='turn')return;   // スキップ済み
  if(A.kakutei){A.phase='kakutei';M.anim=A;render();sfx(A.kakutei==='LR'?'fanfare_lr':'fanfare_ssr');A.fanfare=true;await new Promise(res=>setTimeout(res,1700));if(M.anim!==A||A.phase!=='kakutei')return}
  A.phase='drop';M.anim=A;render();sfx('capsule_drop');
}
async function exchange(id){
  try{const r=await rpc('jinro_exchange',{p_item:id});M.st.tokens=r.tokens;M.st.items.push(id);setOwnedChars(ownedChars());toast(`${ITEM[id].name}を手に入れました！`)}
  catch(e){M.err=e.message;render()}
}

/* ---- missions ---- */
function renderMissions(){
  const st=M.st;if(!st)return`${backBar('ミッション')}<div class="card"><p class="muted">読み込み中…</p></div>`;
  const tab=M.mtab||'daily',ar=achReady();
  const tabs=`<div class="tabs" role="tablist"><button class="tab${tab==='daily'?' on':''}" data-act="mtab" data-tab="daily" role="tab" aria-selected="${tab==='daily'}">デイリー</button><button class="tab${tab==='ach'?' on':''}" data-act="mtab" data-tab="ach" role="tab" aria-selected="${tab==='ach'}">アチーブメント${ar?` (${ar})`:''}</button></div>`;
  if(tab==='ach'){
    const c=new Set(st.ach_claimed||[]),stats=st.stats||{};
    const unit={wins:'勝',games:'局',ssr:'体',chars:'体',friends:'人'};
    return`${backBar('アチーブメント')}${tabs}
      <p class="muted">通算 ${stats.wins||0}勝・${stats.games||0}局。条件を達成すると、コインや限定の称号がもらえます。</p>
      ${ACHIEVEMENTS.map(x=>{const v=stats[x.stat]||0,done=c.has(x.id),ok=v>=x.goal;const it=x.item&&ITEM[x.item];
        const rw=[x.coins?`${coinIcon}${x.coins}`:'',x.tokens?`<span class="tkn sm">★</span>${x.tokens}`:'',it?titleTag(x.item):''].filter(Boolean).join(' ');
        return`<div class="card mission${done?' done':''}"><div class="mrow"><div><b>${esc(x.name)}</b><small class="rw">${rw}</small></div>
        ${done?'<span class="badge">受け取り済み</span>':ok?`<button class="btn orange small" data-act="claimAch" data-id="${x.id}">受け取る</button>`:`<span class="badge">${Math.min(v,x.goal)}/${x.goal}${unit[x.stat]}</span>`}</div>
        <span class="meter"><i style="width:${Math.min(1,v/x.goal)*100}%"></i></span></div>`}).join('')}
      ${M.err?`<p class="err">${esc(M.err)}</p>`:''}`;
  }
  const claimed=new Set(st.claimed);
  return`${backBar('デイリーミッション')}${tabs}
    <p class="muted">毎日0時(日本時間)にリセット。ぜんぶ達成すると1日${MISSIONS.reduce((s,m)=>s+m.reward,0)}コイン。</p>
    ${MISSIONS.map(m=>{const p=Math.min(1,st.missions[m.id]||0),c=claimed.has(m.id);return`<div class="card mission${c?' done':''}">
      <div class="mrow"><div><b>${m.name}</b><small>${coinIcon}${m.reward}コイン</small></div>
      ${c?'<span class="badge">受け取り済み</span>':p?`<button class="btn orange small" data-act="claimMission" data-id="${m.id}">受け取る</button>`:'<span class="badge">未達成</span>'}</div>
      <span class="meter"><i style="width:${p*100}%"></i></span></div>`}).join('')}
    <div class="card"><b>ログインボーナス</b><p class="muted">連続${st.streak}日目。毎日${LOGIN.daily}コイン、7日連続で+${LOGIN.weekBonus}コイン。</p>
      ${st.login_claimable?'<button class="btn orange small" data-act="openLogin">今日のボーナスを受け取る</button>':'<span class="badge">今日は受け取り済み</span>'}</div>
    ${M.err?`<p class="err">${esc(M.err)}</p>`:''}`;
}
async function claimAch(id){
  try{const r=await rpc('jinro_claim_achievement',{p_ach:id});M.st.coins=r.coins;M.st.tokens=r.tokens;(M.st.ach_claimed=M.st.ach_claimed||[]).push(id);if(r.item&&!M.st.items.includes(r.item))M.st.items.push(r.item);
    const x=ACHIEVEMENTS.find(a=>a.id===id);toast(`達成！ +${x.coins}コイン${x.tokens?`・特別コイン+${x.tokens}`:''}${r.item?`・称号「${ITEM[r.item].name}」`:''}`)}
  catch(e){M.err=e.message;render()}
}

/* ---- collection ---- */
const TABS=[['deck','編成'],['zukan','図鑑'],['char','キャラ'],['skin','着せ替え'],['frame','枠の色'],['wolf','人狼の毛色'],['back','駒裏'],['title','称号'],['stamp','スタンプ']];
function renderCollection(){
  const st=M.st;if(!st)return`${backBar('コレクション','home')}<div class="card"><p class="muted">読み込み中…</p></div>`;
  const own=owned(),tab=M.tab,look=myLook();
  if(tab==='deck'){
    if(!M.deck)M.deck={arr:fitDeck(savedDeck(),ownedChars()),sel:null,msg:''};
    const D=M.deck,pool=[...SWAP_BASE,...ownedChars()];
    return`${backBar('コレクション','home')}
      <div class="tabs" role="tablist">${TABS.map(([k,l])=>`<button class="tab${k===tab?' on':''}" role="tab" aria-selected="${k===tab}" data-act="tab" data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="card deckhead"><b>デフォルト編成</b><p class="muted">対戦の配置画面は、最初からこの並びになります(対戦ごとに変えることもできます)。下の2段があなたの陣地で、上の段が前列です。変更は自動で保存されます。</p></div>
      ${setupHTML(D.arr,D.sel?.i,pool,look,D.msg,true)}${setupControls()}${rankCard()}
      ${NEWC.some(c=>!ownedChars().includes(c))?'<p class="muted">新キャラはガチャで手に入れると編成に入れられます。</p>':''}`;
  }
  if(tab==='zukan')return`${backBar('コレクション','home')}
      <div class="tabs" role="tablist">${TABS.map(([k,l])=>`<button class="tab${k===tab?' on':''}" role="tab" aria-selected="${k===tab}" data-act="tab" data-tab="${k}">${l}</button>`).join('')}</div>${zukanHTML()}`;
  const list=(tab==='stamp'?[...DEFAULT_STAMPS,...ITEMS.filter(i=>i.kind==='stamp')]:tab==='title'?[...ACH_ITEMS,...ITEMS.filter(i=>i.kind==='title')]:ITEMS.filter(i=>i.kind===tab)).sort((a,b)=>RARITY_ORDER.indexOf(a.rarity)-RARITY_ORDER.indexOf(b.rarity));
  const isOwned=i=>own.has(i.id)||DEFAULT_STAMPS.some(s=>s.id===i.id);
  const equipped=i=>tab==='title'?st.title===i.id:look[tab]===i.id;
  const cnt=list.filter(isOwned).length;
  const preview=`<div class="card preview"><div class="prevrow">${['king','wolf','seer'].map(t=>tile(t,{look})).join('')}${tile(null,{hidden:true,look})}</div>
    <div class="prevname">${avatar(avOf(O.uid),'sm')}${titleTag(st.title)}<b>${esc(myName())}</b><p class="muted">いまの見た目(右端が相手から見える駒裏)</p></div></div>`;
  const help={char:'持っている新キャラは、オンライン対戦の編成で使えます。',skin:'自分の駒の見た目が変わります。',frame:'自分の駒の枠の色が変わります。',wolf:'人狼の絵の色が変わります。',back:'相手から見える「？」の駒の柄が変わります。',title:'名前の前に表示されます。金色・虹色の称号はアチーブメント限定です。',stamp:'対戦中に送れます。'}[tab];
  return`${backBar('コレクション','home')}
    <div class="tabs" role="tablist">${TABS.map(([k,l])=>`<button class="tab${k===tab?' on':''}" role="tab" aria-selected="${k===tab}" data-act="tab" data-tab="${k}">${l}</button>`).join('')}</div>
    ${['skin','frame','wolf','back','title'].includes(tab)?preview:''}${tab==='char'?rankCard():''}
    <p class="muted">${help} ${cnt}/${list.length} 所持</p>
    <div class="igrid">${list.map(i=>{
      const o=isOwned(i),eq=equipped(i),canEq=o&&['skin','frame','wolf','back','title'].includes(tab);
      const extra=tab==='char'?`<small class="cwhere">${esc(whereOf(i.char).short)}</small><button class="btn ghost small" data-act="charInfo" data-c="${i.char}">詳しく</button>`:canEq?`<button class="btn ${eq?'ghost':'orange'} small" data-act="equip" data-slot="${tab}" data-id="${eq?'':i.id}">${eq?'外す':'つける'}</button>`:'';
      return itemCard(i,{locked:!o,on:eq,extra});
    }).join('')}</div>${M.err?`<p class="err">${esc(M.err)}</p>`:''}`;
}
async function equip(slot,id){
  try{await rpc('jinro_equip',{p_slot:slot,p_item:id||null});
    if(slot==='title')M.st.title=id||null;else{const l={...myLook()};if(id)l[slot]=id;else delete l[slot];M.st.look=l}
    P.titles[O.uid]=M.st.title;toast(id?'つけました':'外しました')}
  catch(e){M.err=e.message;render()}
}

/* ---- friends ---- */
function renderFriends(){
  const st=M.st;if(!st)return`${backBar('フレンド')}<div class="card"><p class="muted">読み込み中…</p></div>`;
  const inc=st.friends.filter(f=>f.incoming),out=st.friends.filter(f=>f.status==='pending'&&!f.incoming),acc=st.friends.filter(f=>f.status==='accepted');
  const online=f=>f.last_seen&&Date.now()-new Date(f.last_seen).getTime()<3*60*1000;
  const wr=f=>f.n?`勝率 ${Math.round(f.w/f.n*100)}%・${f.n}戦`:'戦績なし';
  return`${backBar('フレンド')}${inviteBanner()}
    <div class="card"><b>あなたのフレンドコード</b><div class="row"><span class="code fc">${esc(st.friend_code||'……')}</span><button class="btn ghost small" data-act="copyFc">コピー</button></div><p class="muted">このコードを友達に教えると、フレンド申請してもらえます。</p></div>
    <div class="card"><b>フレンドを追加</b><div class="row"><input id="fcode" class="codein fcin" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="ABC123"><button class="btn" data-act="addFriend">申請</button></div>${M.friendErr?`<p class="err">${esc(M.friendErr)}</p>`:''}</div>
    ${inc.length?`<div class="card"><b>フレンド申請が届いています</b>${inc.map(f=>`<div class="frow"><div>${titleTag(f.title)}<b>${esc(f.name||'名無し')}</b></div><div class="row"><button class="btn orange small" data-act="respond" data-uid="${esc(f.uid)}" data-ok="1">承認</button><button class="btn ghost small" data-act="respond" data-uid="${esc(f.uid)}" data-ok="0">断る</button></div></div>`).join('')}</div>`:''}
    <div class="card"><b>フレンド(${acc.length}人)</b>
      ${acc.length?acc.map(f=>`<div class="frow"><div class="fmain">${avatar(f.avatar,'sm')}<span class="odot${online(f)?' on':''}" title="${online(f)?'オンライン':'オフライン'}"></span>${titleTag(f.title)}<b>${esc(f.name||'名無し')}</b><span class="stat">${wr(f)}</span></div>
        <button class="btn orange small" data-act="inviteFriend" data-uid="${esc(f.uid)}" ${M.inviteSent[f.uid]?'disabled':''}>${M.inviteSent[f.uid]?'誘いました':'対戦に誘う'}</button></div>`).join(''):'<p class="muted">まだいません。フレンドコードを交換してみよう。</p>'}
      ${out.length?`<p class="muted">申請中:${out.map(f=>esc(f.name||'名無し')).join('、')}</p>`:''}</div>`;
}
async function addFriend(raw){
  const c=String(raw||'').trim().toUpperCase();
  if(!/^[A-Z0-9]{6}$/.test(c)){M.friendErr='6文字のフレンドコードを入力してください。';render();return}
  M.friendErr='';
  try{const r=await rpc('jinro_friend_request',{p_code:c});toast(r.status==='accepted'?'フレンドになりました！':'申請を送りました');await refreshState()}
  catch(e){M.friendErr=e.message;render()}
}
async function inviteFriend(uid){
  M.inviteSent[uid]=true;S.screen='online';render();
  await createRoom();
  if(!O.code){M.inviteSent[uid]=false;return}
  try{await rpc('jinro_invite',{p_to:uid,p_code:O.code});O.err='';toast(`${P.names[uid]||'フレンド'}さんを誘いました。入ってくるのを待っています。`)}
  catch(e){O.err=e.message;render()}
  setTimeout(()=>{M.inviteSent[uid]=false},60000);
}

/* ===== root ===== */
// レア度(基本の6体も含む)
const rarOfChar=k=>CHAR_ITEM[k]?.rarity||rarOf(k);
// その駒をどこで手に入れられるか(曜日のガチャなど)
function whereOf(k){
  const it=CHAR_ITEM[k];if(!it)return{short:'最初から使える',long:'最初から使える基本の駒です。',days:[1,2,3,4,5,6,7]};
  if(it.rarity==='LR'){const b=BANNERS[it.banner];const d=b.days;return{short:`${it.banner==='S'?'日曜限定':d.map(x=>WD[x%7]).join('・')}のガチャ`,long:`${it.banner==='S'?'日曜限定ガチャ':d.map(x=>WD[x%7]).join('・')+'曜日のガチャ'}でだけ出ます(LR・0.5%)。`,days:d}}
  if(it.banner==='S')return{short:'日曜限定のガチャ',long:'日曜限定ガチャでだけ出ます(SSR)。特別コイン5枚で交換もできます。',days:[7]};
  return{short:'月〜土のガチャ',long:'月曜〜土曜のガチャで出ます(SSR)。特別コイン5枚で交換もできます。',days:[1,2,3,4,5,6]};
}
const todayDow=()=>new Date(Date.now()+9*3600e3).getUTCDay()||7;
const whereTag=k=>{const w=whereOf(k),it=CHAR_ITEM[k],today=it&&w.days.includes(todayDow());return`<span class="where${today?' today':''}">${today?'今日出る！ ':''}${esc(w.short)}</span>`};
const hasChar=k=>BASE.includes(k)||owned().has(CHAR_ITEM[k]?.id);
// 解放の進み具合(図鑑・詳細で使う)
function ladderHTML(k){
  const u=unlocks(k);
  return`<ol class="ladder">${LADDER.map(x=>{const ok=u[x.key];return`<li class="${ok?'ok':''}"><span>${ok?'✓':'🔒'}</span><b>${x.label}</b><small>${ok?'解放済み':hasChar(k)?`使用${x.n}回で解放(あと${x.n-u.uses}回)`:'ガチャで手に入れると解放'}</small></li>`}).join('')}</ol>`;
}
function achHTML(k){
  const u=unlocks(k),a=CHARA_ACH[k],lr=LR_KEYS.includes(k);
  return`<div class="cach${u.ach?' done':''}"><b>キャラ別アチーブメント</b><small>${esc(a.label)}</small>
    <span class="meter"><i style="width:${Math.min(1,u.achValue/u.achGoal)*100}%"></i></span>
    <small>${u.ach?'達成！ ':''}${u.achValue}/${u.achGoal}・報酬:${lr?'豪華版の全身イラストとアイコン':'金フレームのアイコン'}</small></div>`;
}
function exprGallery(k){
  const u=unlocks(k),a=ART[k];
  if(!a||a.extra)return'';   // 日曜ガチャの8体は表情・道具の素材がまだない
  return`<div class="exprs">${Object.entries(a.expr).map(([e,src])=>u.expr?`<button class="expr" data-act="charLine" data-c="${k}" data-e="${e}">${lazyImg(src,EXPR_LABEL[e])}<small>${EXPR_LABEL[e]}</small></button>`:`<span class="expr locked"><span class="q">？</span><small>${EXPR_LABEL[e]}</small></span>`).join('')}
    ${u.prop?`<span class="expr prop">${lazyImg(a.prop,'リアクション道具')}<small>道具</small></span>`:`<span class="expr locked"><span class="q">？</span><small>道具</small></span>`}</div>`;
}
function charModal(){
  const k=M.modal.c,pf=PROFILE[k],u=unlocks(k),r=rarOfChar(k),has=hasChar(k),e=M.modal.e;
  const known=u.uses>0;
  const speaker=e&&u.expr?`<span class="spk">${lazyImg(ART[k].expr[e],EXPR_LABEL[e])}</span>`:u.icon?faceIcon(k,iconSvg(k),{cls:'spk'}):'';
  return`<div class="modal cmodal"><div class="mbox charbox r-${r}"><span class="tag">キャラ詳細</span>
    <div class="cfull">${fullbodyImg(k,{cls:'big'})}${!u.full?`<small class="lockhint">ガチャで手に入れると全身イラストが解放されます</small>`:''}</div>
    <div class="row center"><span class="rar big r-${r}">${r}</span><h2>${esc(T[k].nm)}<small class="pname">${esc(pf.name)}</small></h2></div>
    <p class="alias">${esc(pf.alias)}</p>
    <p class="wherebox">${whereTag(k)}<small>${esc(whereOf(k).long)}</small></p>
    <p class="intro">${esc(pf.intro)}</p>
    <button class="line" data-act="charLine" data-c="${k}" data-e="${u.expr?(e==='angry'?'surprise':e==='surprise'?'shy':'angry'):''}">${speaker}<span>「${esc(pf.line)}」</span></button>
    ${u.expr?'<small class="muted">表情をタップすると、セリフに合わせて表情が変わります</small>':''}
    ${exprGallery(k)}
    <details class="cprof"><summary>プロフィール</summary><p>${esc(pf.profile)}</p><p class="muted">${esc(pf.ties)}</p></details>
    <p class="cdesc2">${esc(T[k].d)}</p>
    <div class="cmove">${tile(k,{})}<small>動ける方向</small></div>
    <b class="left">解放</b><small class="muted left">使用回数 ${u.uses}回(このキャラを編成して対局した回数)</small>${ladderHTML(k)}${achHTML(k)}
    ${has?'':'<p class="muted">まだ持っていません。ガチャで手に入ります。</p>'}
    <div class="row center"><button class="btn ghost" data-act="go" data-to="story">物語を読む</button><button class="btn orange" data-act="closeModal">閉じる</button></div></div></div>`;
}

/* ---- 図鑑 ---- */
function zukanHTML(){
  const done=C3KEYS.filter(k=>unlocks(k).icon).length;
  return`<div class="card zhead"><b>キャラ図鑑</b><p class="muted">キャラを手に入れると、そのキャラの顔アイコン・表情・リアクション道具・全身イラストが全部解放されます。キャラ別アチーブメントを達成すると特別なアイコンも。${done}/${C3KEYS.length}体 解放中</p>
    <button class="btn ghost small" data-act="go" data-to="story">📖 物語『月夜の盤上』を読む</button>
    <button class="btn ghost small" data-act="artStyle">🎨 イラスト切替：${artStyle()==='flat'?'フラット版':'アニメ版'}</button></div>
    <div class="zgrid">${C3KEYS.map(k=>{const u=unlocks(k),nx=nextLadder(k),r=rarOfChar(k),has=hasChar(k);
      return`<button class="zcard r-${r}${u.icon?'':' locked'}" data-act="charInfo" data-c="${k}">
        <span class="rar r-${r}">${r}</span>
        ${u.icon?faceIcon(k,iconSvg(k),{cls:'zface'}):`<span class="face zface sil">${iconSvg(k)}</span>`}
        <b>${u.icon?esc(PROFILE[k].name):'？？？'}</b><small>${esc(T[k].nm)}</small>
        <small class="znext">${!has?whereOf(k).short:nx?`あと${nx.left}回で${nx.label}`:'全部解放'}</small>
        ${u.ach?'<span class="zach">★</span>':''}</button>`}).join('')}</div>`;
}

/* ---- 物語 ---- */
function renderStory(){
  const R=M.story;
  if(R){
    const ch=STORY[R.ch],beat=R.i<ch.scene.length?ch.scene[R.i]:null;
    if(beat){const [k,e]=beat,u=unlocks(k);
      const face=u.expr?`<span class="sface">${lazyImg(ART[k].expr[e],EXPR_LABEL[e])}</span>`:u.icon?faceIcon(k,iconSvg(k),{cls:'sface'}):`<span class="face sface sil">${iconSvg(k)}</span>`;
      return`${backBar(esc(ch.title),'story')}<div class="play" data-act="storyNext">
        <div class="pbg">${fullbodyImg(k,{cls:'pfull'})}</div>
        <div class="pbox">${face}<div><b>${u.icon?esc(PROFILE[k].name):'？？？'}<small>${esc(T[k].nm)}${u.expr?`・${EXPR_LABEL[e]}`:''}</small></b><p>「${esc(PROFILE[k].line)}」</p></div></div>
        <small class="ptap">タップで次へ(${R.i+1}/${ch.scene.length})</small></div>
        ${!u.expr?'<p class="muted center">表情はそのキャラを手に入れると解放されます</p>':''}`;
    }
    return`${backBar(esc(ch.title),'story')}<div class="card story"><p>${esc(ch.text)}</p></div>
      <div class="row center">${R.ch<STORY.length-1?`<button class="btn orange" data-act="storyPlay" data-ch="${R.ch+1}">次の章へ</button>`:''}<button class="btn ghost" data-act="storyClose">章の一覧へ</button></div>`;
  }
  return`${backBar('物語『月夜の盤上』','collection')}
    <div class="card story"><b>世界観</b>${WORLD.split('\n').map(x=>`<p>${esc(x)}</p>`).join('')}</div>
    ${STORY.map((c,i)=>`<div class="card story"><b>${esc(c.title)}</b><div class="scast">${c.scene.map(([k])=>unlocks(k).icon?faceIcon(k,iconSvg(k),{cls:'mini'}):`<span class="face mini sil">${iconSvg(k)}</span>`).join('')}</div>
      <button class="btn orange small" data-act="storyPlay" data-ch="${i}">▶ ストーリーを再生</button></div>`).join('')}
    <p class="muted">登場キャラの顔や表情は、図鑑で解放するとストーリーにも出てきます。</p>`;
}

/* ---- 対局後の解放通知 ---- */
function unlockNotice(news,deck){
  const prog=(deck||[]).filter((k,i,a)=>C3KEYS.includes(k)&&a.indexOf(k)===i).map(k=>{const nx=nextLadder(k);return nx?`<span class="prg">${tile(k,{})}<small>${esc(T[k].nm)}:あと${nx.left}回で${nx.label}</small></span>`:''}).join('');
  if(!news?.length&&!prog)return'';
  return`<div class="card unlock${news?.length?' new':''}">${news?.length?`<b>🎉 素材が解放されました！</b><div class="unews">${news.map(n=>`<button class="un" data-act="charInfo" data-c="${n.k}">${n.what==='full'||n.what==='lux'?fullbodyImg(n.k,{cls:'unfull'}):faceIcon(n.k,iconSvg(n.k),{cls:'unface'})}<span><b>${esc(PROFILE[n.k].name)}(${esc(T[n.k].nm)})</b><small>${esc(n.label)}</small></span></button>`).join('')}</div>`:''}
    ${prog?`<details class="uprog"${news?.length?'':' open'}><summary>キャラ素材の解放まで</summary><div class="prgs">${prog}</div></details>`:''}</div>`;
}
// 1局の終わりに1回だけ記録する。seat = 自分の側
function charaEnd(G,seat,key){
  const k='jinro-c3rec-'+key;
  if(store.get(k)){try{return JSON.parse(store.get(k))}catch(e){return[]}}
  const deck=(G.decks&&G.decks[seat])||[];
  if(!deck.length){store.set(k,'[]');return[]}
  const ev={};(G.ev||[]).forEach(x=>{if(x.p===seat)ev[x.e]=(ev[x.e]||0)+1});
  const won=G.winner===seat;
  const thiefWin=won&&G.board.some(row=>row.some(P=>P&&P.owner===seat&&P.orig==='thief'));
  const news=recordGame({deck,won,ev,thiefWin});
  store.set(k,JSON.stringify(news));
  return news;
}

function deckAct(a,el){
  const D=M.deck,ar=D.arr;D.msg='';
  if(a==='swap'){const i=+el.dataset.i;if(D.sel&&D.sel.i!=null&&D.sel.i!==i){[ar[D.sel.i],ar[i]]=[ar[i],ar[D.sel.i]];D.sel=null}else D.sel=D.sel&&D.sel.i===i?null:{i}}
  else if(a==='pick'){D.msg=pickInto(ar,D.sel?.i,el.dataset.t);if(!D.msg)D.sel=null}
  else if(a==='preset'){D.arr=PRESETS[+el.dataset.k].a.slice();D.sel=null}
  else if(a==='shuffle'){shuffle(ar);D.sel=null}
  if(validDeck(D.arr))store.set('jinro-deck',JSON.stringify(D.arr));
  render();
}
function render(){
  const app=document.getElementById('app');
  const ae=document.activeElement,keep=ae&&['code','pname','fcode'].includes(ae.id)?{id:ae.id,v:ae.value}:null;
  const scr=S.screen;
  let h=scr==='local'?renderLocal():scr==='online'?renderOnline():scr==='gacha'?renderGacha():scr==='missions'?renderMissions():scr==='collection'?renderCollection():scr==='friends'?renderFriends():scr==='battle'?renderBattle():scr==='pieces'?renderPieces():scr==='story'?renderStory():renderHome();
  const nav=showNav();if(nav)h+=navBar();app.classList.toggle('hasnav',nav);
  if(M.modal?.type==='login'&&scr!=='online'&&scr!=='local')h+=loginModal();
  if(M.modal?.type==='avatar')h+=avatarModal();
  if(M.modal?.type==='char')h+=charModal();
  if(M.anim&&M.anim.results!==undefined&&scr==='gacha')h+=gachaOverlay();
  if(M.toast)h+=`<div class="toast" role="status">${esc(M.toast)}</div>`;
  // 同じ画面の描き直しでは、開いている「ルールと駒の動き」などや横スクロールの位置をそのまま残す
  const same=render.last===scr,openD=same?[...app.querySelectorAll('details')].map(d=>d.open):[],hx=same?[...app.querySelectorAll('.slides,.tabs')].map(e=>e.scrollLeft):[];
  app.innerHTML=h;render.last=scr;
  if(same){app.querySelectorAll('details').forEach((d,i)=>{if(openD[i])d.open=true});app.querySelectorAll('.slides,.tabs').forEach((e,i)=>{if(hx[i])e.scrollLeft=hx[i]})}
  soundCheck();setupSlides();
  if(keep){const i=document.getElementById(keep.id);if(i){i.value=keep.v;i.focus()}}
  updateClocks();
}
async function metaAct(a,el){
  if(a==='go'){const to=el.dataset.to;if(to==='story')M.story=null;M.modal=null;M.err='';if(M.anim&&M.anim.phase==='open')M.anim=null;if(to!=='home'&&to!=='battle'&&!myName()){S.screen='home';render();return}S.screen=to;render();window.scrollTo(0,0);if(to!=='home')refreshState();return}
  if(a==='saveName')return saveName(document.getElementById('pname')?.value);
  if(a==='editName'){P.editing=true;render();return}
  if(a==='cancelName'){P.editing=false;render();return}
  if(a==='closeModal'){M.modal=null;render();return}
  if(a==='charInfo'){M.modal={type:'char',c:el.dataset.c};render();return}
  if(a==='artStyle'){setArtStyle(artStyle()==='flat'?'anime':'flat');return}
  if(a==='openLogin'){M.modal={type:'login'};render();return}
  if(a==='claimLogin'){M.modal.busy=true;render();try{const r=await rpc('jinro_claim_login');M.st.coins=r.coins;M.st.login_claimable=false;M.st.streak=r.streak;M.modal={type:'login',result:r}}catch(e){M.modal=null;M.err=e.message;refreshState()}render();return}
  if(a==='openAvatar'){M.modal={type:'avatar',av:{...avOf(O.uid)}};render();return}
  if(a==='avChar'){M.modal.av.c=el.dataset.c;render();return}
  if(a==='avBg'){M.modal.av.bg=+el.dataset.i;render();return}
  if(a==='saveAvatar')return saveAvatar();
  if(a==='pull')return pull(+el.dataset.n);
  if(a==='gpick'){M.pick=el.dataset.id;M.err='';return render()}
  if(a==='heroNext'){const A=M.anim;A.hero=(A.hero+1)%heroChars(A).length;render();return}
  if(a==='heroDone'){M.anim.hero=null;render();return}
  if(a==='charLine'){M.modal.e=el.dataset.e||null;render();return}
  if(a==='storyPlay'){M.story={ch:+el.dataset.ch,i:0};render();window.scrollTo(0,0);return}
  if(a==='storyNext'){M.story.i++;render();return}
  if(a==='storyClose'){M.story=null;render();return}
  if(a==='avIllus'){M.modal.illus=el.checked;render();return}
  if(a==='openCaps'||a==='skipGacha'){if(M.anim&&M.anim.results){const A=M.anim;sfxStop('gacha_lever');A.phase='open';if(heroChars(A).length)A.hero=0;render();sfx('capsule_open');if(A.kakutei&&!A.fanfare){A.fanfare=true;setTimeout(()=>sfx(A.kakutei==='LR'?'fanfare_lr':'fanfare_ssr'),250)}}return}
  if(a==='closeGacha'){M.anim=null;render();return}
  if(a==='exchange')return exchange(el.dataset.id);
  if(a==='claimMission'){try{const r=await rpc('jinro_claim_mission',{p_mission:el.dataset.id});M.st.coins=r.coins;M.st.claimed.push(el.dataset.id);toast('+10コイン')}catch(e){M.err=e.message;render()}return}
  if(a==='tab'){M.tab=el.dataset.tab;render();return}
  if(a==='zukan'){M.tab='zukan';S.screen='collection';render();window.scrollTo(0,0);refreshState();return}
  if(a==='mtab'){M.mtab=el.dataset.tab;M.err='';render();return}
  if(a==='claimAch')return claimAch(el.dataset.id);
  if(a==='equip')return equip(el.dataset.slot,el.dataset.id);
  if(a==='copyFc')return copyText(M.st?.friend_code||'',el);
  if(a==='addFriend')return addFriend(document.getElementById('fcode')?.value);
  if(a==='respond'){try{await rpc('jinro_friend_respond',{p_other:el.dataset.uid,p_accept:el.dataset.ok==='1'});await refreshState()}catch(e){M.friendErr=e.message;render()}return}
  if(a==='inviteFriend')return inviteFriend(el.dataset.uid);
  if(a==='acceptInvite'){S.screen='online';render();return joinRoom(el.dataset.code)}
}
const META=new Set(['artTap','zukan','heroNext','heroDone','charLine','storyPlay','storyNext','storyClose','avIllus','charInfo','artStyle','gpick','mtab','claimAch','openAvatar','avChar','avBg','saveAvatar','openCaps','skipGacha','closeGacha','exchange','go','saveName','editName','cancelName','closeModal','openLogin','claimLogin','pull','claimMission','tab','equip','copyFc','addFriend','respond','inviteFriend','acceptInvite']);
document.getElementById('app').addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');if(!el||el.disabled)return;const a=el.dataset.act;
  if(a==='home'){const wasGame=S.screen==='online'||S.screen==='local';if(S.screen==='online')leaveRoom(true);S.screen=wasGame?'battle':'home';render();refreshState();window.scrollTo(0,0);return}
  if(a==='local'){if(S.screen==='online')leaveRoom(true);localNew();S.screen='local';render();return}
  if(a==='artTap'){const c=el.querySelector('.sl-chara');if(c){c.classList.remove('hop');void c.offsetWidth;c.classList.add('hop');play('tap')}return}
  if(a==='toggleSound'){SND.on=!SND.on;store.set('jinro-sound',SND.on?'on':'off');if(SND.on){actx();play('tap')}render();return}
  if(a==='cpu'){if(S.screen==='online')leaveRoom(true);localNew({level:el.dataset.lv});S.screen='local';render();window.scrollTo(0,0);return}
  if(a==='online'){S.screen='online';O.err='';render();return}
  if(S.screen==='collection'&&M.deck&&['swap','pick','preset','shuffle'].includes(a))return deckAct(a,el);
  if(META.has(a)&&!(S.screen==='online'&&a==='saveName'))return metaAct(a,el);
  if(S.screen==='local'){localAct(a,el);render()}
  else if(S.screen==='online')onlineAct(a,el);
});
document.getElementById('app').addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.isComposing)return;
  if(e.target.id==='code')joinRoom(e.target.value);
  if(e.target.id==='pname')saveName(e.target.value);
  if(e.target.id==='fcode')addFriend(e.target.value);
});

async function boot(){
  O.uid=getUid();getSecret();
  if(myName())P.names[O.uid]=myName();
  const q=new URLSearchParams(location.search).get('room'),wq=new URLSearchParams(location.search).get('watch');
  if(q||wq)S.screen='online';
  render();
  if(!SUPABASE_URL||!SUPABASE_ANON_KEY){render();return}
  try{const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');sb=createClient(SUPABASE_URL,SUPABASE_ANON_KEY)}
  catch(e){sbFail=true;render();return}
  await refreshState();
  if(sb&&q&&!O.code&&myName())joinRoom(q);
  if(sb&&wq&&!O.code)watchRoom(wq);
  render();
}
boot();
