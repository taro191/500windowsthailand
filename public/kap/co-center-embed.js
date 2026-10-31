/* ===== KAP Co Center — ส่วน Co Center ในการ์ด Kapsulep & Co (แท็บ Co Store / Co Center) =====
   แหล่งจริงเพียงที่เดียว: co-center-embed.js  (ห้ามแก้บล็อกที่ฝังใน index.html / demo ด้วยมือ — รัน python3 tools/sync-co-center.py)
   สัญญาข้อมูลและอีเวนต์เหมือน co-center.html (ดู docs/CO-CENTER-SPEC.md)  */
(function(){'use strict';
if(window.KAP_CO_EMBED)return;
const H=36e5,TZ=7*H;
const CFG=Object.assign({slotHours:2,laneBMax:7,refreshMin:10,ok:['active','expiring']},window.KAP_CO_CONFIG||{});
const SLOT=CFG.slotHours*H;

/*SCHED-START — ตัวสุ่มแบบ deterministic (ไม่ใช้ Math.random) */
function hash(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function shuffle(arr,seed){const a=arr.slice(),r=rng(hash(seed));for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function slotIdx(ms){return Math.floor((ms+TZ)/SLOT)}
function dayKey(ms){return new Date(ms+TZ).toISOString().slice(0,10)}
function status(w){return(w.plan&&w.plan.status)||'active'}
function eligible(w){return !!(w&&w.id&&w.group&&CFG.ok.includes(status(w)))}
function ord(L,k,c){const n=L.length,m={};L.forEach(w=>m[w.id]=w);
  const o=shuffle(L.map(w=>w.id),'A|'+k+'|'+c);
  if(n>2&&c>0){const p=shuffle(L.map(w=>w.id),'A|'+k+'|'+(c-1));if(o[0]===p[n-1])[o[0],o[1]]=[o[1],o[0]]}
  return o.map(id=>m[id])}
function laneA(el,ms){const g={},s=slotIdx(ms);
  el.forEach(w=>(g[w.group]=g[w.group]||[]).push(w));
  return Object.keys(g).sort((a,b)=>((g[a][0].gOrder??99)-(g[b][0].gOrder??99))||(a<b?-1:1)).map(k=>{
    const L=g[k].sort((x,y)=>x.id<y.id?-1:1),n=L.length;
    return ord(L,k,Math.floor(s/n))[s%n]})}
function upd(w,d){const t=Date.parse(w.updatedAt);return t===t&&dayKey(t)===d}
function laneB(el,ms,ex){const d=dayKey(ms);let pool=el.filter(w=>upd(w,d)),key=d,fb=false;
  if(!pool.length){key=dayKey(ms-24*H);pool=el.filter(w=>upd(w,key));fb=pool.length>0}
  pool=pool.map(w=>[hash(key+'|'+w.id),w]).sort((a,b)=>a[0]-b[0]||(a[1].id<b[1].id?-1:1)).map(x=>x[1]);
  const n=pool.length,ds=Math.floor(((ms+TZ)%(24*H))/SLOT),M=CFG.laneBMax,items=[];
  for(let k=0;k<n&&items.length<M;k++){const w=pool[(ds*M+k)%n];if(!ex.has(w.id))items.push(w)}
  return{items,fallback:fb}}
function pick(wins,ms){const el=wins.filter(eligible),a=laneA(el,ms);return{a,b:laneB(el,ms,new Set(a.map(w=>w.id))),n:el.length}}
/*SCHED-END*/

const CSS='.kco{margin-top:2px}.kco[hidden]{display:none}'+
'.kco .kt0{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px}'+
'.kco .kr{display:flex;gap:6px}.kco .kr .btn{min-height:32px;padding:3px 13px;font-size:12.5px;border-radius:99px;border-color:var(--line);color:var(--mu)}'+
'.kco .kr .btn.on{background:transparent;color:var(--tx);border-color:var(--ac2t);font-weight:600}'+
'.kco .kst{display:flex;align-items:center;gap:8px;color:var(--mu);font-size:12px}'+
'.kco .kd{width:8px;height:8px;border-radius:50%;background:#3fd49a;flex:none;animation:kp 2s infinite}@keyframes kp{0%{box-shadow:0 0 0 0 #3fd49a88}70%,100%{box-shadow:0 0 0 7px #3fd49a00}}'+
'.kco .kbar{height:4px;border-radius:99px;background:color-mix(in srgb,var(--tx) 10%,transparent);overflow:hidden;margin:10px 0 12px}'+
'.kco .kbar i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,var(--ac2),var(--ac));transition:width 1s linear}'+
'.kco .kf{margin:0 0 10px;color:var(--mu);font-size:12px}.kco .kf[hidden]{display:none}.kco .kf2{margin:12px 0 0;color:var(--mu);font-size:11.5px;text-align:center}'+
'.kco .kg{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;transition:opacity .22s}.kco .kg.out{opacity:0}'+
'.kco .kc{display:flex;flex-direction:column;min-width:0;border:1px solid var(--line);border-radius:14px;overflow:hidden;color:var(--tx);text-decoration:none;background:color-mix(in srgb,var(--tx) 3%,transparent);transition:transform .2s,border-color .2s,box-shadow .2s}'+
'a.kc:hover{transform:translateY(-2px);border-color:var(--ac2t);box-shadow:0 6px 16px #0004}a.kc:focus-visible{outline:2px solid var(--ac2t);outline-offset:2px}'+
'.kco .kv{position:relative;aspect-ratio:16/9;overflow:hidden;background:linear-gradient(135deg,hsl(var(--h,200) 50% 38%),hsl(calc(var(--h,200) + 45) 55% 24%))}'+
'.kco .kw{position:absolute;inset:0;display:grid;place-items:center;font-size:44px;font-weight:600;color:#ffffff30}'+
'.kco .ki{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .35s}.kco img.ok{opacity:1}'+
'.kco .kz{position:absolute;top:6px;font-size:10.5px;line-height:1.55;border-radius:99px;padding:0 8px;color:#fff;background:#000a;max-width:calc(100% - 54px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
'.kco .kq{left:6px}.kco .kk{right:6px;max-width:none;background:var(--ac);color:#1d1400;font-weight:600}'+
'.kco .kb2{padding:0 10px 10px;display:flex;flex-direction:column;gap:2px;flex:1}'+
'.kco .kl{width:38px;height:38px;border-radius:11px;margin-top:-19px;position:relative;border:2px solid var(--card);box-shadow:0 2px 8px #0005;background:#fff;overflow:hidden;display:grid;place-items:center;font-weight:600;font-size:16px;color:#fff;flex:none}'+
'.kco .kl.ini{background:hsl(var(--h,200) 45% 34%)}.kco .kl img{width:100%;height:100%;object-fit:contain;display:block;opacity:0;transition:opacity .3s}.kco .kl img.ok{opacity:1}'+
'.kco .kx{font-weight:600;font-size:13px;line-height:1.3;margin-top:5px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'+
'.kco .ks{color:var(--mu);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
'.kco .ku{margin-top:auto;padding-top:5px;font-size:11.5px;color:var(--ac2t);display:flex;align-items:center;gap:6px}.kco .ku::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}'+
'.kco .ke{grid-column:1/-1;color:var(--mu);font-size:13px;padding:8px 0;margin:0}'+
'@media(max-width:520px){.kco .kg{grid-template-columns:repeat(2,minmax(0,1fr))}.kco .kc:last-child:nth-child(odd){grid-column:1/-1}.kco .kc:last-child:nth-child(odd) .kv{aspect-ratio:16/7}.kco .kt0{align-items:flex-start;flex-direction:column}}'+
'@media(prefers-reduced-motion:reduce){.kco .kd{animation:none}}';

let wins=[],offset=0,sim=0,demo=false,opt={},inited=false,cur=null,P=null,lane='A',root=null,grid=null,nxEl=null,pgEl=null,noteEl=null,tabs={},pf=null,swapping=false,lastTouch=0,heldSince=0,hadData=false,shown=false;
const seen=new Set(),pre=new Set(),dc={},reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const now=()=>Date.now()+offset+sim;
function emit(n,d,cancel){const ev=new CustomEvent('kap:'+n,{detail:d,cancelable:!!cancel});document.dispatchEvent(ev);return ev.defaultPrevented}
function el(t,c,x){const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function safeUrl(u){u=String(u||'');return/^(https:\/\/\S+|\/(?!\/)\S*|[^\s:\/][^\s:]*)$/.test(u)?u:''}
function safeImg(u){u=String(u||'');return/^(https:\/\/\S+|\/(?!\/)\S+|data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+\/=]+)$/.test(u)?u:''}
function dm(k){if(dc[k])return dc[k];const p=k.split(':'),cv=p[1]==='c',h=+p[2]||0,c=document.createElement('canvas');c.width=cv?480:96;c.height=cv?270:96;const x=c.getContext('2d');
  if(cv){const g=x.createLinearGradient(0,0,480,270);g.addColorStop(0,'hsl('+h+' 60% 45%)');g.addColorStop(1,'hsl('+(h+50)%360+' 65% 30%)');x.fillStyle=g;x.fillRect(0,0,480,270);x.fillStyle='rgba(255,255,255,.16)';x.beginPath();x.arc(380,60,100,0,7);x.fill();x.beginPath();x.arc(90,260,120,0,7);x.fill()}
  else{x.fillStyle='hsl('+h+' 55% 92%)';x.fillRect(0,0,96,96);x.fillStyle='hsl('+h+' 55% 38%)';x.beginPath();x.arc(48,48,32,0,7);x.fill();x.fillStyle='#fff';x.font='600 34px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(String.fromCharCode(65+h%26),48,50)}
  return dc[k]=c.toDataURL('image/png')}
function imgOf(v){if(v&&typeof v==='object')v=v.t||v.src;v=String(v||'');return demo&&v.slice(0,5)==='demo:'?dm(v):safeImg(v)}
function hm(t){return new Date(t+TZ).toISOString().slice(11,16)}
function pic(src,cls,fail,ok){const i=new Image();i.className=cls;i.alt='';i.decoding='async';i.onload=()=>{i.classList.add('ok');if(ok)ok()};i.onerror=()=>{i.remove();if(fail)fail()};i.src=src;return i}

function tile(w,ln,slot){const url=safeUrl(w.url),c=el(url?'a':'div','kc'),name=String(w.name||w.id).slice(0,80),ini=Array.from(name)[0]||'W';
  c.style.setProperty('--h',hash(String(w.id))%360);if(url)c.href=url;
  const v=el('div','kv');v.appendChild(el('span','kw',ini));
  const cs=imgOf(w.cover);if(cs)v.appendChild(pic(cs,'ki'));
  if(w.groupName)v.appendChild(el('span','kz kq','📍 '+String(w.groupName).slice(0,40)));
  if(Number.isFinite(+w.rank))v.appendChild(el('span','kz kk','#'+(+w.rank)));
  const b=el('div','kb2'),l=el('div','kl'),ls=imgOf(w.logo),fb=()=>{l.replaceChildren();l.classList.add('ini');l.textContent=ini};
  if(ls){const i=pic(ls,'',fb);i.alt='โลโก้ '+name;l.appendChild(i)}else fb();
  b.append(l,el('div','kx',name));
  if(w.tag)b.appendChild(el('div','ks',String(w.tag).slice(0,80)));
  const t=Date.parse(w.updatedAt);
  if(ln==='B'&&t===t)b.appendChild(el('div','ku','อัปเดต'+(dayKey(t)===dayKey(now())?'วันนี้':'เมื่อวาน')+' '+hm(t)+' น.'));
  c.append(v,b);c.addEventListener('click',e=>{if(emit('co-click',{id:w.id,lane:ln,url},true))e.preventDefault()});
  const k=slot+'|'+ln+'|'+w.id;if(!seen.has(k)){seen.add(k);emit('co-view',{id:w.id,lane:ln,slot})}
  return c}

function build(){if(root)return root;
  root=el('div','kco');root.id='cosub';root.hidden=true;
  const top=el('div','kt0'),r=el('div','kr'),st=el('div','kst');r.setAttribute('role','group');r.setAttribute('aria-label','เลือกรายการ');
  [['A','🌏 ทั่วไทย'],['B','🔥 อัปเดตวันนี้']].forEach(([k,t])=>{const x=el('button','btn',t);x.type='button';x.onclick=()=>{lane=k;paint()};tabs[k]=x;r.appendChild(x)});
  nxEl=el('span');st.append(el('span','kd'),nxEl);top.append(r,st);
  const bar=el('div','kbar');pgEl=el('i');bar.appendChild(pgEl);
  noteEl=el('p','kf');noteEl.hidden=true;grid=el('div','kg');
  ['pointerdown','touchstart','wheel'].forEach(t=>grid.addEventListener(t,()=>{lastTouch=Date.now()},{passive:true}));
  root.append(top,bar,noteEl,grid,el('p','kf2','สุ่มโดยระบบ ไม่ใช่โฆษณาแบบจ่ายเงิน · ทุกคนเห็นรายการเดียวกันในรอบเวลาเดียวกัน'));return root}

function paint(){if(!P||!root)return;
  if(lane==='B'&&!P.b.items.length)lane='A';
  tabs.B.hidden=!P.b.items.length;
  ['A','B'].forEach(k=>{tabs[k].classList.toggle('on',lane===k);tabs[k].setAttribute('aria-pressed',lane===k)});
  if(root.hidden)return;
  const items=lane==='B'?P.b.items:P.a;grid.replaceChildren();
  noteEl.hidden=!(lane==='B'&&P.b.fallback);noteEl.textContent='วันนี้ยังไม่มีอัปเดต แสดงของเมื่อวานแทน';
  if(!items.length)grid.appendChild(el('p','ke','ยังไม่มีหน้าต่างที่มีสิทธิ์แสดงในรอบนี้'));
  else items.forEach(w=>grid.appendChild(tile(w,lane,cur)))}

function held(){return !!grid&&(grid.matches(':hover')||grid.contains(document.activeElement)||Date.now()-lastTouch<8000)}
function clock(ms){if(!nxEl)return;const nx=(slotIdx(ms)+1)*SLOT-TZ,left=Math.max(0,nx-ms),hh=Math.floor(left/H),mm=Math.ceil((left%H)/6e4);
  nxEl.textContent='รอบถัดไป '+hm(nx)+' น. · อีก '+(hh?hh+' ชม. ':'')+mm+' นาที';pgEl.style.width=(((ms+TZ)%SLOT)/SLOT*100).toFixed(1)+'%'}
function compute(ms){P=pick(wins,ms);cur=slotIdx(ms)}
function prefetch(ms){const p=pick(wins,ms);p.a.concat(p.b.items).forEach(w=>[w.logo,w.cover].forEach(v=>{const s=imgOf(v);if(s&&s.slice(0,5)!=='data:'&&!pre.has(s)){pre.add(s);new Image().src=s}}))}
function tick(){if(!root||!wins.length)return;const ms=now(),s=slotIdx(ms);
  if(cur===null){compute(ms);paint()}
  else if(s!==cur){
    if(!root.hidden&&held()&&Date.now()-(heldSince||(heldSince=Date.now()))<6e5){}
    else if(!swapping){heldSince=0;
      if(root.hidden||reduce){compute(ms);paint()}
      else{swapping=true;grid.classList.add('out');setTimeout(()=>{compute(now());paint();grid.classList.remove('out');swapping=false},230)}}}
  if(pf!==s+1&&(s+1)*SLOT-TZ-ms<15*6e4){pf=s+1;prefetch(ms+SLOT)}
  if(!root.hidden)clock(ms)}

function demoData(){const G=[['central','ส่วนกลาง'],['north','ภาคเหนือ'],['northeast','ภาคตะวันออกเฉียงเหนือ'],['mid','ภาคกลาง'],['east','ภาคตะวันออก'],['west','ภาคตะวันตก'],['south','ภาคใต้']],out=[],t0=now(),day0=Math.floor((t0+TZ)/(24*H))*24*H-TZ;
  G.forEach(([g,gn],gi)=>{for(let i=1;i<=14;i++){const id='DEMO-'+g.toUpperCase()+'-'+String(i).padStart(2,'0'),h=hash(id),hue=h%360,
    w={id,rank:i,group:g,gOrder:gi,groupName:gn,name:'หน้าต่างตัวอย่าง '+gn+' '+i,tag:'ตัวอย่าง · ธุรกิจ '+i,url:'',plan:{status:'active',type:i%3?'paid':'trial'},
       logo:i%5===0?'':i%7===0?'https://invalid.example/logo.png':'demo:l:'+hue,cover:i%4===0?'':i%6===0?'https://invalid.example/cover.jpg':'demo:c:'+hue};
    if(i===13)w.plan={status:'expired',type:'paid'};if(i===14)w.plan={status:'suspended',type:'paid'};
    w.updatedAt=new Date(h%100<35?day0+(h%Math.max(1,t0-day0)):day0-(1+h%20)*H).toISOString();out.push(w)}});return out}

async function load(){const ad=window.KAP_CO_ADAPTER;
  if(ad&&ad.load){const d=await ad.load();if(d&&d.serverTime){const t=Date.parse(d.serverTime);if(t===t)offset=t-Date.now()}demo=false;return Array.isArray(d)?d:(d&&d.windows)||[]}
  if(opt.demo){demo=true;return wins.length?wins:demoData()}
  return[]}
async function refresh(){try{wins=await load()}catch(e){console.warn('[KAP_CO] load failed',e)}
  const has=wins.some(eligible);build();tick();if(has!==hadData){hadData=has;if(opt.onchange)try{opt.onchange()}catch(e){}}}

window.KAP_CO_EMBED={
  init(o){if(inited)return;inited=true;opt=o||{};
    const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
    refresh().then(()=>{setInterval(tick,1000);if(!demo&&window.KAP_CO_ADAPTER)setInterval(refresh,CFG.refreshMin*6e4)})},
  has(){return hadData},
  node(){return build()},
  show(v){const r=build();r.hidden=!v;if(v){paint();clock(now());if(!shown)emit('co-open',{})}shown=!!v},
  pick(ms){return pick(wins,ms==null?now():ms)},
  skip(n){sim+=(n||1)*SLOT;tick()},
  config:CFG};
})();
