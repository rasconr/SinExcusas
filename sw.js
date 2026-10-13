// Sin Excusas · service worker: funciona sin internet y muestra los avisos que manda tu servidor.
const V='sinexcusas-v3';
const CORE=['./','index.html','manifest.json','icon-192.png','icon-512.png','apple-touch-icon.png'];

self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)))});
self.addEventListener('message',e=>{if(e.data==='skipWaiting')self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!=='se-data').map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});

self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){
    e.respondWith(caches.open(V).then(c=>c.match(r).then(hit=>hit||fetch(r).then(res=>{c.put(r,res.clone());return res}))));return;
  }
  if(u.origin!==location.origin)return;
  if(r.mode==='navigate'||u.pathname.endsWith('.html')||u.pathname.endsWith('/')){
    e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put('index.html',cp));return res})
      .catch(()=>caches.match('index.html').then(x=>x||caches.match('./'))));return;
  }
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));return res})));
});

/* ---------- avisos ---------- */
const pad=n=>String(n).padStart(2,'0');
const dkey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const toMin=t=>{const[a,b]=(t||'0:0').split(':').map(Number);return a*60+b};
const fmt=n=>{const r=Math.round(n*100)/100;return Math.abs(r)>=1000?r.toLocaleString('es-MX'):String(r)};
const pick=a=>a[Math.floor(Math.random()*a.length)];

function fill(t,h,v,S,dow){
  const target=h.type==='check'?1:h.target;
  const rutina=((S.gym||{})[dow]||[]).join(', ')||'descanso';
  const line=pick(String(t||'').split('\n').map(x=>x.trim()).filter(Boolean))||'Te falta {nombre}.';
  return line.replace(/\{nombre\}/g,h.name).replace(/\{falta\}/g,fmt(Math.max(0,target-v))).replace(/\{meta\}/g,fmt(target))
    .replace(/\{unidad\}/g,h.unit||'').replace(/\{hecho\}/g,fmt(v)).replace(/\{rutina\}/g,rutina).replace(/\{yo\}/g,(S.settings||{}).name||'')
    .replace(/\s+/g,' ').replace(/\s([.,!?])/g,'$1').trim();
}
function ctx(S,now){
  const k=dkey(now),dow=now.getDay(),m=now.getHours()*60+now.getMinutes();
  const val=h=>Number(((S.log||{})[k]||{})[h.id]||0);
  const done=h=>h.type==='check'?val(h)>=1:val(h)>=h.target;
  const active=(S.habits||[]).filter(h=>!h.paused&&(h.days||[]).includes(dow));
  return{k,dow,m,val,done,active};
}
function due(S,now){
  const c=ctx(S,now),W=5,out=[];
  const hit=t=>{const x=toMin(t);return x<=c.m&&x>c.m-W};
  c.active.forEach(h=>{if((h.reminders||[]).some(hit)&&!c.done(h))out.push({title:((h.emoji||'')+' '+h.name).trim(),body:fill(h.hate,h,c.val(h),S,c.dow)})});
  (S.events||[]).forEach(e=>{
    if(!e.remind)return;if(e.date?e.date!==c.k:!(e.days||[]).includes(c.dow))return;
    const t=toMin(e.start)-e.remind;
    if(t<=c.m&&t>c.m-W)out.push({title:(e.type==='clase'?'Clase':'Personal')+' en '+Math.max(1,toMin(e.start)-c.m)+' min',body:e.title+(e.place?' · '+e.place:'')+' a las '+e.start+'.'});
  });
  const st=S.settings||{};
  if(st.nightOn&&st.night&&hit(st.night)&&c.active.length){
    const pend=c.active.filter(h=>!c.done(h));
    out.push(pend.length
      ?{title:'Revisión del día',body:(st.nightHate||'Te faltan: {pendientes}.').replace(/\{hora\}/g,st.night).replace(/\{pendientes\}/g,pend.map(h=>h.type==='qty'?h.name.toLowerCase()+' ('+fmt(Math.max(0,h.target-c.val(h)))+' '+h.unit+')':h.name.toLowerCase()).join(', '))}
      :{title:'Revisión del día',body:st.nightOk||'Cumpliste todo hoy.'});
  }
  return out;
}
function fallback(S,now){
  const c=ctx(S,now);const pend=c.active.filter(h=>!c.done(h));
  if(pend.length){const h=pick(pend);return{title:((h.emoji||'')+' '+h.name).trim(),body:fill(h.hate,h,c.val(h),S,c.dow)}}
  if(c.active.length)return{title:'Día perfecto',body:(S.settings||{}).nightOk||'Cumpliste todo hoy.'};
  return{title:'Sin Excusas',body:'Hoy no tienes hábitos pendientes.'};
}
async function onPush(e){
  let S=null;
  try{const c=await caches.open('se-data');const r=await c.match('state.json');if(r)S=await r.json()}catch(x){}
  let list=[];
  if(e.data){try{const d=e.data.json();if(d&&d.title)list=[d]}catch(x){}}
  const now=new Date();
  if(!list.length&&S)list=due(S,now);
  if(!list.length&&S)list=[fallback(S,now)];
  if(!list.length)list=[{title:'Sin Excusas',body:'Abre la app y revisa tus hábitos de hoy.'}];
  await Promise.all(list.slice(0,3).map((n,i)=>self.registration.showNotification(n.title,{body:n.body,icon:'icon-192.png',badge:'icon-192.png',tag:'se-'+Date.now()+'-'+i,data:{url:'./'}})));
}
self.addEventListener('push',e=>e.waitUntil(onPush(e)));
self.addEventListener('notificationclick',e=>{e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>l.length?l[0].focus():self.clients.openWindow('./')))});
// exportado solo para pruebas en Node
if(typeof module!=='undefined')module.exports={due,fallback};
