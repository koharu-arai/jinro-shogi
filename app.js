import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

/* ===== rules data ===== */
const T={
  king:{nm:'王様',d:'全方向に1マス。取られたら負け。',m:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]},
  wolf:{nm:'人狼',d:'前3方向・左右・真後ろに1マス。隠れている間は駒を取れないが、取りに来た駒を返り討ちにする。',m:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,0]]},
  villager:{nm:'村人',d:'前に1マス。',m:[[-1,0]]},
  seer:{nm:'占い師',d:'前に1マス。隠れている人狼も取れる。',m:[[-1,0]]},
  hunter:{nm:'狩人',d:'斜め4方向に1マス。',m:[[-1,-1],[-1,1],[1,-1],[1,1]]},
  knight:{nm:'騎士',d:'上下左右に1マス。',m:[[-1,0],[1,0],[0,-1],[0,1]]}
};
const ORDER=['king','wolf','villager','seer','hunter','knight'];
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
function newGame(setups){return{board:buildBoard(setups),hands:[[],[]],turn:0,last:null,time:[MAIN,MAIN],winner:null,reason:''}}
function targets(G,r,c){
  const P=G.board[r][c],out=[],s=P.owner===0?1:-1;
  for(const[dy,dx]of T[P.type].m){
    const nr=r+dy*s,nc=c+dx*s;
    if(nr<0||nr>4||nc<0||nc>2)continue;
    const Q=G.board[nr][nc];
    if(Q&&Q.owner===P.owner)continue;
    if(Q&&P.type==='wolf'&&!P.revealed)continue;
    out.push([nr,nc]);
  }
  return out;
}
function applyMove(G,r,c,nr,nc){
  const B=G.board,A=B[r][c],Q=B[nr][nc],me=A.owner,op=1-me;
  if(!Q){B[nr][nc]=A;B[r][c]=null;G.last={from:[r,c],to:[nr,nc],kind:'move'};return{res:'駒を動かしました。',note:'相手が駒を動かしました。'}}
  if(Q.type==='wolf'&&!Q.revealed&&A.type!=='seer'){
    B[r][c]=null;Q.revealed=true;G.hands[op].push(A.type);G.last={from:[r,c],to:[nr,nc],kind:'counter'};
    if(A.type==='king'){G.winner=op;G.reason='王様が隠れた人狼に返り討ちにされました'}
    return{res:`返り討ち！ その駒は隠れた人狼でした。あなたの${T[A.type].nm}は相手の持ち駒になります。`,note:`あなたの人狼が相手の${T[A.type].nm}を返り討ちにしました。人狼の正体が相手に知られました。`,alert:true,bad:true};
  }
  B[nr][nc]=A;B[r][c]=null;G.hands[me].push(Q.type);G.last={from:[r,c],to:[nr,nc],kind:'capture'};
  if(Q.type==='king'){G.winner=me;G.reason='王様を取りました'}
  return{res:`相手の${T[Q.type].nm}を取りました。持ち駒として打てます。`,note:`あなたの${T[Q.type].nm}が取られました。`,alert:true};
}
function applyDrop(G,i,r,c){
  const me=G.turn,t=G.hands[me].splice(i,1)[0];
  G.board[r][c]={owner:me,type:t,revealed:false};G.last={to:[r,c],kind:'drop'};
  return{res:`${T[t].nm}を打ちました。相手からは正体が見えません。`,note:'相手が持ち駒を打ちました。'};
}
function decideTap(G,v,sel,r,c){
  const P=G.board[r][c];
  if(sel){
    if(sel.hand!=null){if(!P)return{act:'drop',i:sel.hand}}
    else if(targets(G,sel.r,sel.c).some(([x,y])=>x===r&&y===c))return{act:'move',from:[sel.r,sel.c]};
  }
  return{act:'sel',sel:P&&P.owner===v&&!(sel&&sel.r===r&&sel.c===c)?{r,c}:null};
}
function shuffle(ar){for(let i=ar.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ar[i],ar[j]]=[ar[j],ar[i]]}}

/* ===== views ===== */
const D='#232838';
const ICON={
  king:`<path d="M8 33 L10 13 L18 22 L24 9 L30 22 L38 13 L40 33 Z" fill="#f7c948" stroke="${D}" stroke-width="2.4" stroke-linejoin="round"/><rect x="8" y="33" width="32" height="6" rx="1.5" fill="#e3a924" stroke="${D}" stroke-width="2.4"/><circle cx="24" cy="26" r="2.8" fill="#e5484d" stroke="${D}" stroke-width="1.6"/><circle cx="16" cy="28.5" r="1.9" fill="#3aa0e0"/><circle cx="32" cy="28.5" r="1.9" fill="#3aa0e0"/>`,
  wolf:`<path d="M9 7 L18 17 H30 L39 7 L40 25 Q40 37 24 42 Q8 37 8 25 Z" fill="#8b93a7" stroke="${D}" stroke-width="2.4" stroke-linejoin="round"/><path d="M12 12 L17 18 L13 20 Z M36 12 L31 18 L35 20 Z" fill="${D}"/><path d="M17 29 L24 39 L31 29 Q24 25 17 29 Z" fill="#eef0f5" stroke="${D}" stroke-width="1.8" stroke-linejoin="round"/><path d="M21.5 34 H26.5 L24 37 Z" fill="${D}"/><path d="M13 23.5 L20.5 25.5 L15 27.5 Z M35 23.5 L27.5 25.5 L33 27.5 Z" fill="#ffd34d" stroke="${D}" stroke-width="1.2" stroke-linejoin="round"/>`,
  villager:`<path d="M6 24 L24 8 L42 24 Z" fill="#d0583e" stroke="${D}" stroke-width="2.4" stroke-linejoin="round"/><rect x="11" y="23" width="26" height="17" fill="#f3dfb6" stroke="${D}" stroke-width="2.4"/><rect x="21" y="29" width="7" height="11" fill="#8a5a2b" stroke="${D}" stroke-width="1.6"/><rect x="13.5" y="27" width="5" height="5" fill="#7cc4f0" stroke="${D}" stroke-width="1.4"/><rect x="30" y="27" width="5" height="5" fill="#7cc4f0" stroke="${D}" stroke-width="1.4"/>`,
  seer:`<path d="M24 4 V9 M12 7 L15.5 11.5 M36 7 L32.5 11.5" stroke="${D}" stroke-width="2.4" stroke-linecap="round"/><path d="M4 27 Q24 10 44 27 Q24 44 4 27 Z" fill="#fff" stroke="${D}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="24" cy="27" r="8.5" fill="#7c5cd6" stroke="${D}" stroke-width="2"/><circle cx="24" cy="27" r="3.6" fill="${D}"/><circle cx="26.6" cy="24.4" r="1.5" fill="#fff"/>`,
  hunter:`<path d="M15 6 Q39 24 15 42" fill="none" stroke="${D}" stroke-width="6" stroke-linecap="round"/><path d="M15 6 Q39 24 15 42" fill="none" stroke="#b06a33" stroke-width="3" stroke-linecap="round"/><path d="M15 6 V42" stroke="${D}" stroke-width="1.6"/><path d="M8 24 H37" stroke="${D}" stroke-width="2.6" stroke-linecap="round"/><path d="M43 24 L35 19 V29 Z" fill="#e8823f" stroke="${D}" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 24 L5.5 19.5 M9 24 L5.5 28.5 M13 24 L9.5 19.5 M13 24 L9.5 28.5" stroke="#e8823f" stroke-width="2.2" stroke-linecap="round"/>`,
  knight:`<path d="M24 9 Q31 1 38 5 Q32 6 29 11" fill="#e5484d" stroke="${D}" stroke-width="1.8" stroke-linejoin="round"/><path d="M11 41 V23 Q11 9 24 9 Q37 9 37 23 V41 Z" fill="#aebccd" stroke="${D}" stroke-width="2.4" stroke-linejoin="round"/><path d="M15.5 22.5 H32.5" stroke="${D}" stroke-width="3.2" stroke-linecap="round"/><path d="M24 26 V38" stroke="#7d8ea3" stroke-width="2.4" stroke-linecap="round"/><circle cx="18" cy="32" r="1.4" fill="${D}"/><circle cx="30" cy="32" r="1.4" fill="${D}"/>`
};
const BAND={king:'#d99a12',wolf:'#ff6f93',villager:'#b8733a',seer:'#6a4fd0',hunter:'#d9692a',knight:'#5f7894'};
function arrows(t){
  return'<svg class="arw" viewBox="0 0 100 100" aria-hidden="true">'+T[t].m.map(([dy,dx])=>{
    const x=50+dx*43.5,y=50+dy*43.5,ang=Math.atan2(dx,-dy)*180/Math.PI;
    return`<path transform="translate(${x} ${y}) rotate(${ang})" d="M0 -5 L5.5 3 L-5.5 3 Z" fill="${D}" stroke-linejoin="round"/>`;
  }).join('')+'</svg>';
}
function tile(type,{enemy=false,hidden=false,wolf='hid'}={}){
  if(hidden)return`<span class="pc hidden enemy" aria-label="正体不明の駒"><svg class="back" viewBox="0 0 48 48" aria-hidden="true"><text x="24" y="36" text-anchor="middle" font-size="34" font-weight="800" fill="currentColor" font-family="sans-serif">?</text></svg></span>`;
  const w=type==='wolf'?(wolf==='open'?' wolf-open':' wolf-hid'):'';
  const band=type==='wolf'&&wolf==='open'?'var(--wolf-open)':BAND[type];
  return`<span class="pc${w}${enemy?' enemy':''}" style="--band:${band}" aria-label="${T[type].nm}"><span class="face"><svg class="ico" viewBox="0 0 48 48" aria-hidden="true">${ICON[type]}</svg><span class="band">${T[type].nm}</span></span>${arrows(type)}</span>`;
}
function boardHTML(G,v,{sel=null,interactive=false,reveal=false}={}){
  const tg=new Set();
  if(interactive&&sel){
    if(sel.hand!=null){for(let r=0;r<5;r++)for(let c=0;c<3;c++)if(!G.board[r][c])tg.add(r+','+c)}
    else targets(G,sel.r,sel.c).forEach(([a,b])=>tg.add(a+','+b));
  }
  let h='<div class="boardwrap"><div class="board" aria-label="盤面">';
  for(let dr=0;dr<5;dr++)for(let dc=0;dc<3;dc++){
    const[r,c]=toAbs(v,dr,dc),P=G.board[r][c],L=G.last;let cls='cell';
    if(L&&!reveal){
      const isTo=L.to[0]===r&&L.to[1]===c,isFrom=L.from&&L.from[0]===r&&L.from[1]===c;
      if(isTo||isFrom)cls+=L.kind==='counter'?' counter':' last';
    }
    if(interactive&&sel&&sel.hand==null&&sel.r===r&&sel.c===c)cls+=' sel';
    if(tg.has(r+','+c))cls+=' tgt'+(P?' hasp':'');
    let inner='';
    if(P){
      const mine=P.owner===v,vis=mine||reveal||(P.type==='wolf'&&P.revealed);
      inner=vis?tile(P.type,{enemy:!mine,wolf:P.revealed?'open':'hid'}):tile(null,{hidden:true});
    }
    h+=`<button class="${cls}" data-act="cell" data-r="${dr}" data-c="${dc}" ${interactive?'':'tabindex="-1"'} aria-label="${dr+1}段目 ${dc+1}列目">${inner}</button>`;
  }
  return h+'</div></div>';
}
function handHTML(G,v,sel,enabled){
  const h=G.hands[v];
  return`<div class="hand" aria-label="あなたの持ち駒">${h.length?h.map((t,i)=>`<button class="handbtn${sel&&sel.hand===i?' sel':''}" data-act="hand" data-i="${i}" ${enabled?'':'disabled'}>${tile(t)}</button>`).join(''):'<span class="empty">持ち駒なし</span>'}</div>`;
}
function clocksHTML(me,op,meLabel,opLabel){
  return`<div class="clocks"><div class="clk me" data-ck="${me}"><span class="who">${meLabel}</span><b data-clock="${me}">2:00</b><span class="meter"><i data-meter="${me}"></i></span></div>
  <div class="clk op" data-ck="${op}"><span class="who">${opLabel}</span><b data-clock="${op}">2:00</b><span class="meter"><i data-meter="${op}"></i></span></div></div>`;
}
function setupBoardHTML(arr,sel){
  let b='<div class="boardwrap"><div class="board">';
  for(let dr=0;dr<5;dr++)for(let dc=0;dc<3;dc++){
    if(dr<3){b+=`<div class="cell zone">${dr===1&&dc===1?'<span class="lbl">相手の陣地</span>':''}</div>`;continue}
    const i=(dr===3?0:3)+dc;
    b+=`<button class="cell${sel===i?' sel':''}" data-act="swap" data-i="${i}" aria-label="${T[arr[i]].nm}">${tile(arr[i])}</button>`;
  }
  return b+'</div></div>';
}
function setupControls(){return`<div class="row">${PRESETS.map((x,k)=>`<button class="btn ghost small" data-act="preset" data-k="${k}">${x.name}</button>`).join('')}<button class="btn ghost small" data-act="shuffle">ランダム</button></div>`}
function rulesHTML(open=false){
  return`<details class="rules"${open?' open':''}><summary>ルールと駒の動き</summary>
  <ul>
    <li>3×5の盤で、お互い6枚の駒を指し合います。相手の<b>王様を取れば勝ち</b>です。</li>
    <li>対局前に手前2段へ6枚を自由に配置します。相手の駒は灰色で正体が見えません。</li>
    <li><b>隠れた人狼</b>(ピンク)は駒を取れません。占い師以外の駒が取りに来ると<b>返り討ち</b>にして、その駒を奪います。返り討ちにした人狼は正体が明かされ(青)、普通に取ったり取られたりします。</li>
    <li>取った駒は持ち駒になり、空いているマスならどこにでも打てます。打った駒は相手から見えません。打った人狼は隠れた状態に戻ります。</li>
    <li>持ち時間は2分。使い切ると1手10秒の秒読みで、間に合わなければ負けです。</li>
  </ul>
  <div class="ptable">${ORDER.map(t=>`<div class="prow">${tile(t)}<div><b>${T[t].nm}</b><span class="d">${T[t].d}</span></div></div>`).join('')}</div></details>`;
}

/* ===== app state ===== */
const S={screen:'home'};
let L=null;
const O={code:null,seat:null,game:null,players:{},draft:PRESETS[0].a.slice(),sel:null,seenMove:-1,seenAt:Date.now(),toast:null,err:'',busy:false,ready:false,noConfig:false,loadFail:false,uid:null,ch:null,timeoutSent:false,starting:false,resignArm:false};

/* ===== local mode (one device) ===== */
function localNew(){L={phase:'cover',cover:{p:0,next:'setup'},setup:[PRESETS[0].a.slice(),PRESETS[0].a.slice()],setupP:0,sel:null,G:null,byo:BYO,out:null,notice:'',noticeAlert:false,resignArm:false}}
function localEnd(out){L.sel=null;L.byo=BYO;if(L.G.winner!=null)L.phase='over';else{L.out=out;L.phase='result'}}
function renderLocal(){
  if(L.phase==='cover'){
    const p=L.cover.p,setup=L.cover.next==='setup';
    return`<div class="cover"><h2>${NAME[p]}の番</h2><p>${setup?`${NAME[p]}が駒の配置を決めます。相手に画面を見せないでください。`:`スマホを${NAME[p]}に渡してください。`}</p><button class="btn orange" data-act="uncover">${NAME[p]}です。画面を開く</button><button class="btn ghost small" data-act="home">タイトルに戻る</button></div>`;
  }
  if(L.phase==='setup'){
    return`<div class="side"><span class="who">${NAME[L.setupP]}の配置</span><span class="badge">2マスを順にタップで入れ替え</span></div>
      ${setupBoardHTML(L.setup[L.setupP],L.sel?.i)}${setupControls()}<button class="btn orange" data-act="confirm">この配置で決定</button>${rulesHTML()}`;
  }
  const G=L.G;
  if(L.phase==='over'){
    return`<section class="hero"><h1 class="over-h">${NAME[G.winner]}の勝ち</h1><p>${esc(G.reason)}。すべての駒を公開しています。</p></section>
      ${boardHTML(G,0,{reveal:true})}<div class="row"><button class="btn orange" data-act="localAgain">もう一度遊ぶ</button><button class="btn ghost" data-act="home">タイトルへ</button></div>`;
  }
  const v=G.turn,op=1-v,play=L.phase==='play';
  return`<div class="top"><button class="btn ghost small" data-act="home">退出</button>${clocksHTML(v,op,NAME[v]+'(あなた)',NAME[op])}</div>
    <div class="side"><span class="who">${NAME[op]}</span><span class="badge">持ち駒 ${G.hands[op].length}枚</span></div>
    ${boardHTML(G,v,{sel:L.sel,interactive:play})}
    <div class="side"><span class="who">${NAME[v]}</span><span class="badge turn">あなたの番</span></div>
    ${handHTML(G,v,L.sel,play)}
    ${play&&L.notice?`<div class="status${L.noticeAlert?' alert':''}">${esc(L.notice)}</div>`:''}
    ${play?`<div class="row"><span class="spacer"></span><button class="btn ${L.resignArm?'danger':'ghost'} small" data-act="resign">${L.resignArm?'もう一度押すと投了':'投了'}</button></div>${rulesHTML()}`
      :`<div class="sheet"><p>${esc(L.out.res)}</p><button class="btn orange" data-act="pass">${NAME[op]}に渡す</button></div><div style="height:140px"></div>`}`;
}
function localAct(a,el){
  if(a!=='resign')L.resignArm=false;
  if(a==='uncover'){L.phase=L.cover.next;L.sel=null;lastT=null}
  else if(a==='swap'){const i=+el.dataset.i,ar=L.setup[L.setupP];if(L.sel&&L.sel.i!=null){[ar[L.sel.i],ar[i]]=[ar[i],ar[L.sel.i]];L.sel=null}else L.sel={i}}
  else if(a==='preset'){L.setup[L.setupP]=PRESETS[+el.dataset.k].a.slice();L.sel=null}
  else if(a==='shuffle'){shuffle(L.setup[L.setupP]);L.sel=null}
  else if(a==='confirm'){L.sel=null;if(L.setupP===0){L.setupP=1;L.cover={p:1,next:'setup'}}else{L.G=newGame(L.setup);L.notice='対局開始。先手から指します。';L.noticeAlert=false;L.cover={p:0,next:'play'}}L.phase='cover'}
  else if(a==='hand'){const i=+el.dataset.i;L.sel=L.sel&&L.sel.hand===i?null:{hand:i}}
  else if(a==='cell'&&L.phase==='play'){
    const G=L.G,[r,c]=toAbs(G.turn,+el.dataset.r,+el.dataset.c),d=decideTap(G,G.turn,L.sel,r,c);
    if(d.act==='sel')L.sel=d.sel;
    else localEnd(d.act==='drop'?applyDrop(G,d.i,r,c):applyMove(G,d.from[0],d.from[1],r,c));
  }
  else if(a==='pass'){const G=L.G;G.turn=1-G.turn;L.notice=L.out.note;L.noticeAlert=!!L.out.alert;L.cover={p:G.turn,next:'play'};L.phase='cover'}
  else if(a==='resign'){if(L.resignArm){L.G.winner=1-L.G.turn;L.G.reason=`${NAME[L.G.turn]}が投了しました`;L.phase='over'}else L.resignArm=true}
  else if(a==='localAgain')localNew();
}

/* ===== online mode (Supabase) ===== */
let sb=null;
function getUid(){
  let u=store.get('jinro-uid');
  if(!u){u=(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));store.set('jinro-uid',u)}
  return u;
}
async function onlineInit(){
  if(O.ready)return;O.ready=true;O.uid=getUid();
  if(!SUPABASE_URL||!SUPABASE_ANON_KEY){O.noConfig=true;render();return}
  try{
    const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  }catch(e){O.loadFail=true}
  render();
  const q=new URLSearchParams(location.search).get('room');
  if(sb&&q&&!O.code)joinRoom(q);
}
function genCode(){const A='ABCDEFGHJKMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<4;i++)s+=A[Math.floor(Math.random()*A.length)];return s}
function errText(e){console.error(e);return'通信できませんでした。電波の良いところで、もう一度試してください。'}
function blankGame(code,moveNo){return{code,phase:'setup',moveNo,board:null,hands:[[],[]],turn:0,time:[MAIN,MAIN],last:null,note:null,winner:null,reason:''}}
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
    const {error}=await sb.from('jinro_seats').insert({code,seat:0,uid:O.uid});
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
        const {error:e3}=await sb.from('jinro_seats').insert({code,seat:1,uid:O.uid});
        if(e3&&e3.code==='23505')O.err='この部屋はもう2人そろっています。';
        else if(e3)throw e3;
        else await enterRoom(code,1);
      }
    }
  }catch(e){O.err=errText(e)}
  O.busy=false;render();
}
async function enterRoom(code,seat){
  leaveRoom(true);
  Object.assign(O,{code,seat,game:null,players:{},sel:null,toast:null,seenMove:-1,draft:PRESETS[0].a.slice(),timeoutSent:false,resignArm:false});
  store.set('jinro-room',code);
  history.replaceState(null,'','?room='+code);
  O.ch=sb.channel('room-'+code)
    .on('postgres_changes',{event:'*',schema:'public',table:'jinro_rooms',filter:'code=eq.'+code},p=>{if(p.new&&p.new.game)setGame(p.new.game)})
    .on('postgres_changes',{event:'*',schema:'public',table:'jinro_seats',filter:'code=eq.'+code},p=>{if(p.new&&p.new.seat!=null){O.players[p.new.seat]=p.new;maybeStart();render()}})
    .subscribe(st=>{if(st==='SUBSCRIBED')fetchAll()});
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
  if(r.data)setGame(r.data.game);else{O.game=null;render()}
}
function setGame(g){
  if(O.game&&g.moveNo<O.game.moveNo)return;
  O.game=g;
  if(g.moveNo!==O.seenMove){O.seenMove=g.moveNo;O.seenAt=g.turnAt?Math.min(Date.now(),g.turnAt):Date.now();O.sel=null;O.timeoutSent=false;if(O.toast&&O.toast.move!==g.moveNo)O.toast=null}
  maybeStart();render();
}
function leaveRoom(silent){
  if(O.ch&&sb){try{sb.removeChannel(O.ch)}catch(e){}}
  O.ch=null;O.code=null;O.seat=null;O.game=null;O.players={};
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
  const G=newGame([p[0].setup,p[1].setup]);
  await saveGame({...g,...G,phase:'play',moveNo:g.moveNo+1,turnAt:Date.now(),note:{for:0,text:'対局開始。あなたは先手です。',alert:false}});
  O.starting=false;
}
async function commit(apply){
  if(O.busy)return;
  const g=clone(O.game),t=g.turn,el=(Date.now()-O.seenAt)/1000,rem=g.time[t]-el;
  if(rem<-BYO){g.winner=1-t;g.reason=`${NAME[t]}の時間切れ`;g.phase='over'}
  else{
    g.time[t]=Math.max(0,rem);
    const out=apply(g);
    if(g.winner!=null)g.phase='over';
    else{g.turn=1-t;g.note={for:1-t,text:out.note,alert:!!out.alert}}
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
function renderOnline(){
  if(!O.ready)return`<div class="card"><p class="muted">接続しています…</p></div>`;
  const back=`<div class="top"><button class="btn ghost small" data-act="home">戻る</button><h2 style="font-size:22px">オンライン対戦</h2></div>`;
  if(O.noConfig)return`${back}<div class="card"><b>オンライン対戦の準備がまだです</b><p class="muted">サイトを公開した人が config.js に Supabase の URL とキーを設定すると使えるようになります。それまでは1台で対戦で遊べます。</p><button class="btn orange" data-act="local">1台で対戦する</button></div>`;
  if(O.loadFail||!sb)return`${back}<div class="card"><b>サーバーに接続できませんでした</b><p class="muted">通信環境を確認して、ページを読み込み直してください。</p><button class="btn orange" data-act="local">1台で対戦する</button></div>`;
  if(!O.code){
    const pre=new URLSearchParams(location.search).get('room')||store.get('jinro-room')||'';
    return`${back}
      <div class="card"><b>部屋を作る</b><p class="muted">あなたが先手になります。表示されるコードかリンクを相手に送ってください。</p><button class="btn orange" data-act="create" ${O.busy?'disabled':''}>部屋を作る</button></div>
      <div class="card"><b>部屋に入る</b><p class="muted">相手から届いた4文字のコードを入力します。あなたは後手になります。</p>
        <div class="row"><input id="code" class="codein" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="ABCD" value="${esc(pre)}"><button class="btn" data-act="join" ${O.busy?'disabled':''}>入る</button></div></div>
      ${O.err?`<p class="err">${esc(O.err)}</p>`:''}${rulesHTML()}`;
  }
  const g=O.game,me=O.seat,op=1-me;
  if(!g)return`<div class="card"><p class="muted">部屋を読み込んでいます…</p><button class="btn ghost small" data-act="leave">退出</button></div>`;
  const opIn=!!O.players[op];
  const head=`<div class="top"><button class="btn ghost small" data-act="leave">退出</button>${g.phase==='setup'?`<span class="badge">部屋 ${esc(O.code)}</span>`:clocksHTML(me,op,'あなた','相手')}</div>`;
  const err=O.err?`<p class="err">${esc(O.err)}</p>`:'';
  if(g.phase==='setup'){
    const mine=O.players[me];
    const wait=!opIn?`<div class="card" style="text-align:center"><p class="muted">相手を待っています。このコードかリンクを送ってください</p><div class="code">${esc(O.code)}</div><div class="row" style="justify-content:center"><button class="btn ghost small" data-act="copyLink">招待リンクをコピー</button><button class="btn ghost small" data-act="copy">コードをコピー</button></div></div>`:'';
    if(mine&&mine.ready)return`${head}${wait}<div class="card"><b>配置を決めました</b><p class="muted">${opIn?'相手が配置を決めるのを待っています。':'相手が入ってくるのを待っています。'}そろったら自動で対局が始まります。</p></div>${err}${rulesHTML()}`;
    return`${head}${wait}<div class="side"><span class="who">あなた(${NAME[me]})の配置</span><span class="badge">2マスを順にタップで入れ替え</span></div>
      ${setupBoardHTML(O.draft,O.sel?.i)}${setupControls()}<button class="btn orange" data-act="ready" ${O.busy?'disabled':''}>この配置で決定</button>${err}${rulesHTML()}`;
  }
  if(g.phase==='over'){
    const win=g.winner===me;
    return`<div class="top"><button class="btn ghost small" data-act="leave">退出</button></div>
      <section class="hero"><h1 class="over-h">${win?'あなたの勝ち':'あなたの負け'}</h1><p>${esc(g.reason)}。すべての駒を公開しています。</p></section>
      ${boardHTML(g,me,{reveal:true})}
      ${me===0?`<button class="btn orange" data-act="rematch" ${O.busy?'disabled':''}>同じ相手ともう一度</button>`:`<p class="muted">先手(部屋を作った人)が「もう一度」を押すと次の対局の配置に進みます。</p>`}${err}`;
  }
  const myTurn=g.turn===me&&!O.busy;
  let status;
  if(O.toast&&g.turn!==me)status=`<div class="status${O.toast.bad?' alert':''}">${esc(O.toast.text)}</div><div class="status wait">相手の番です。</div>`;
  else if(g.turn===me){const n=g.note&&g.note.for===me?g.note:null;status=`<div class="status${n&&n.alert?' alert':''}">${n?esc(n.text)+' ':''}あなたの番です。</div>`}
  else status=`<div class="status wait">相手の番です。</div>`;
  return`${head}
    <div class="side"><span class="who">相手(${NAME[op]})</span><span class="badge">持ち駒 ${g.hands[op].length}枚</span>${g.turn===op?'<span class="badge turn">考え中</span>':''}</div>
    ${boardHTML(g,me,{sel:O.sel,interactive:myTurn})}
    <div class="side"><span class="who">あなた(${NAME[me]})</span>${g.turn===me?'<span class="badge turn">あなたの番</span>':''}</div>
    ${handHTML(g,me,O.sel,myTurn)}
    ${status}${err}
    <div class="row"><span class="spacer"></span><button class="btn ${O.resignArm?'danger':'ghost'} small" data-act="oresign">${O.resignArm?'もう一度押すと投了':'投了'}</button></div>${rulesHTML()}`;
}
async function copyText(text,el){
  try{await navigator.clipboard.writeText(text);el.textContent='コピーしました'}
  catch(e){el.textContent=text}
}
async function onlineAct(a,el){
  if(a!=='oresign')O.resignArm=false;
  if(a==='create')return createRoom();
  if(a==='join')return joinRoom(document.getElementById('code')?.value);
  if(a==='leave'){leaveRoom();return}
  if(a==='copy')return copyText(O.code,el);
  if(a==='copyLink')return copyText(roomLink(O.code),el);
  if(a==='swap'){const i=+el.dataset.i,ar=O.draft;if(O.sel&&O.sel.i!=null){[ar[O.sel.i],ar[i]]=[ar[i],ar[O.sel.i]];O.sel=null}else O.sel={i}}
  else if(a==='preset'){O.draft=PRESETS[+el.dataset.k].a.slice();O.sel=null}
  else if(a==='shuffle'){shuffle(O.draft);O.sel=null}
  else if(a==='ready'){
    O.busy=true;O.err='';
    const row={code:O.code,seat:O.seat,uid:O.uid,ready:true,setup:O.draft.slice()};
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
    else return commit(G=>d.act==='drop'?applyDrop(G,d.i,r,c):applyMove(G,d.from[0],d.from[1],r,c));
  }
  else if(a==='oresign'){if(O.resignArm){O.resignArm=false;return writeEnd(1-O.seat,`${NAME[O.seat]}が投了しました`)}O.resignArm=true}
  else if(a==='rematch'){
    O.busy=true;render();
    const {error}=await sb.from('jinro_seats').update({ready:false}).eq('code',O.code);
    if(error)O.err=errText(error);
    for(const s of [0,1])if(O.players[s])O.players[s]={...O.players[s],ready:false};
    await saveGame(blankGame(O.code,O.game.moveNo+1));
    O.busy=false;
  }
  render();
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&O.code)fetchAll()});
setInterval(()=>{if(S.screen==='online'&&O.code)fetchAll()},15000);

/* ===== clocks ===== */
let lastT=null;
function clockState(p){
  if(S.screen==='local'&&L&&L.G){const G=L.G;return{main:G.time[p],byo:p===G.turn?L.byo:BYO,on:p===G.turn&&(L.phase==='play'||L.phase==='result')}}
  if(S.screen==='online'&&O.game&&O.game.time){
    const g=O.game;let rem=g.time[p],byo=BYO;const on=g.phase==='play'&&p===g.turn;
    if(on){rem-=(Date.now()-O.seenAt)/1000;if(rem<0){byo=BYO+rem;rem=0}}
    return{main:Math.max(0,rem),byo,on};
  }
  return null;
}
function updateClocks(){
  document.querySelectorAll('[data-clock]').forEach(el=>{
    const p=+el.dataset.clock,st=clockState(p);if(!st)return;
    let txt;if(st.main>0){const s=Math.ceil(st.main);txt=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}else txt=`秒読み ${Math.max(0,Math.ceil(st.byo))}`;
    el.textContent=txt;el.classList.toggle('byo',st.main<=0);
    const m=document.querySelector(`[data-meter="${p}"]`);if(m)m.style.width=(st.main>0?st.main/MAIN*100:Math.max(0,st.byo)/BYO*100)+'%';
    const box=document.querySelector(`[data-ck="${p}"]`);if(box)box.classList.toggle('on',st.on);
  });
}
setInterval(()=>{
  if(S.screen==='local'&&L&&L.phase==='play'){
    const now=performance.now();if(lastT==null){lastT=now;return}
    let dt=(now-lastT)/1000;lastT=now;const G=L.G,t=G.turn;
    if(G.time[t]>0){const u=Math.min(dt,G.time[t]);G.time[t]-=u;dt-=u}
    if(dt>0&&G.time[t]<=0){L.byo-=dt;if(L.byo<=0){G.winner=1-t;G.reason=`${NAME[t]}の時間切れ`;L.phase='over';render();return}}
  }else lastT=null;
  if(S.screen==='online'&&O.game&&O.game.phase==='play'&&!O.timeoutSent){
    const g=O.game,st=clockState(g.turn),grace=g.turn===O.seat?0:3;
    if(st&&st.main<=0&&st.byo<-grace){O.timeoutSent=true;writeEnd(1-g.turn,`${NAME[g.turn]}の時間切れ`)}
  }
  updateClocks();
},200);

/* ===== root ===== */
function renderHome(){
  return`<section class="hero"><img class="emblem" src="icon.svg" alt="" width="72" height="72"><h1>人狼<span>将棋</span></h1><p>正体を隠した6枚の駒で、相手の王様を狙う心理戦。</p></section>
    <button class="btn orange mode" data-act="online">オンライン対戦<small>部屋コードで、離れた相手とそれぞれのスマホで対戦</small></button>
    <button class="btn ghost mode" data-act="local">1台で対戦<small>スマホ1台を交代で渡しながら2人で遊ぶ</small></button>
    ${rulesHTML(true)}`;
}
function render(){
  const app=document.getElementById('app');
  const focused=document.activeElement&&document.activeElement.id==='code'?document.activeElement.value:null;
  app.innerHTML=S.screen==='home'?renderHome():S.screen==='local'?renderLocal():renderOnline();
  if(focused!=null){const i=document.getElementById('code');if(i){i.value=focused;i.focus()}}
  updateClocks();
}
document.getElementById('app').addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');if(!el||el.disabled)return;const a=el.dataset.act;
  if(a==='home'){if(S.screen==='online')leaveRoom(true);S.screen='home';render();return}
  if(a==='local'){if(S.screen==='online')leaveRoom(true);localNew();S.screen='local';render();return}
  if(a==='online'){S.screen='online';O.err='';render();onlineInit();return}
  if(S.screen==='local'){localAct(a,el);render()}
  else if(S.screen==='online')onlineAct(a,el);
});
document.getElementById('app').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='code')joinRoom(e.target.value)});

if(new URLSearchParams(location.search).get('room')){S.screen='online';render();onlineInit()}
else render();
