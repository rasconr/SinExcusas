// Sin Excusas · service worker: funciona sin internet y arma los avisos que manda tu servidor.
const V='sinexcusas-v6';
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

/* ---------- utilidades ---------- */
const pad=n=>String(n).padStart(2,'0');
const dkey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const fromKey=k=>new Date(k+'T12:00:00');
const toMin=t=>{const[a,b]=(t||'0:0').split(':').map(Number);return a*60+b};
const fmt=n=>{const r=Math.round(n*100)/100;return Math.abs(r)>=1000?r.toLocaleString('es-MX'):String(r)};
const pick=a=>a[Math.floor(Math.random()*a.length)];

/* ---------- género y tono ---------- */
const GW=[['puto huevón','puta huevona','flojera con patas'],['huevón','huevona','flojera'],['cabrón','cabrona','crack'],['campeón','campeona','crack'],['pendejo','pendeja','menso'],['perro','fiera','fiera'],['bastardo','bastarda','criatura'],['abogado','abogada','profesional del Derecho']];
const reEsc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function gfix(t,g){
  if(!t)return t;let out=String(t);
  try{GW.forEach(([m,f,n])=>{const to=g==='m'?f:g==='n'?n:m;
    out=out.replace(new RegExp('(?<![\\p{L}])('+reEsc(m)+'|'+reEsc(f)+')(?![\\p{L}])','giu'),w=>(w[0]!==w[0].toLowerCase())?to[0].toUpperCase()+to.slice(1):to)})}catch(e){}
  return out;
}

function fill(t,h,v,S,dow,sk){sk=sk||0;
  const target=h.type==='check'?1:h.target;
  const rutina=((S.gym||{})[dow]||[]).join(', ')||'descanso';
  const lines=String(t||'').split('\n').map(x=>x.trim()).filter(Boolean);
  const line=pick(lines.filter(x=>sk>=2||!/\{racha\}/.test(x)))||pick(lines)||'Te falta {nombre}.';
  return line.replace(/\{nombre\}/g,h.name).replace(/\{falta\}/g,fmt(Math.max(0,target-v))).replace(/\{meta\}/g,fmt(target))
    .replace(/\{unidad\}/g,h.unit||'').replace(/\{hecho\}/g,fmt(v)).replace(/\{rutina\}/g,rutina).replace(/\{racha\}/g,sk).replace(/\{yo\}/g,(S.settings||{}).name||'')
    .replace(/\s+/g,' ').replace(/\s([.,!?])/g,'$1').trim();
}

function ctx(S,now){
  const st=S.settings||{},g=st.gender||'h',tone=st.tone||'brutal';
  const k=dkey(now),dow=now.getDay(),m=now.getHours()*60+now.getMinutes();
  const valOn=(h,key)=>Number(((S.log||{})[key]||{})[h.id]||0);
  const doneV=(h,v)=>h.type==='avoid'?v<1:h.type==='check'?v>=1:v>=h.target;
  const val=h=>valOn(h,k);
  const done=h=>doneV(h,val(h));
  const onDay=(h,d)=>!h.paused&&(h.days||[]).includes(d)&&!(st.examMode&&!h.essential);
  const active=(S.habits||[]).filter(h=>onDay(h,dow));
  const say=(b,d,c)=>gfix(tone==='brutal'?b:tone==='duro'?d:c,g);
  const streak=h=>{let n=0,d=new Date(now);if(!doneV(h,valOn(h,dkey(d))))d=addDays(d,-1);
    for(let i=0;i<500;i++){if(h.created&&dkey(d)<h.created)break;if((h.days||[]).includes(d.getDay())){if(doneV(h,valOn(h,dkey(d))))n++;else break}d=addDays(d,-1)}return n};
  return{st,g,tone,k,dow,m,val,valOn,doneV,done,onDay,active,say,streak};
}

function weekly(S,c,now){
  let sum=0,cnt=0;
  for(let i=0;i<7;i++){const d=addDays(now,-i),dk=dkey(d),hs=(S.habits||[]).filter(h=>c.onDay(h,d.getDay()));if(!hs.length)continue;cnt++;sum+=hs.filter(h=>c.doneV(h,c.valOn(h,dk))).length/hs.length*100}
  const avg=cnt?Math.round(sum/cnt):0;
  const rates=(S.habits||[]).filter(h=>!h.paused).map(h=>{let ok=0,tot=0;for(let i=0;i<7;i++){const d=addDays(now,-i);if(!(h.days||[]).includes(d.getDay()))continue;tot++;if(c.doneV(h,c.valOn(h,dkey(d))))ok++}return{h,r:tot?ok/tot:1}}).sort((a,b)=>b.r-a.r);
  let body='Cumpliste '+avg+'% esta semana.';
  if(rates.length>1&&rates[0].r!==rates[rates.length-1].r)body+=' Mejor: '+rates[0].h.name.toLowerCase()+'. Peor: '+rates[rates.length-1].h.name.toLowerCase()+'.';
  body+=' '+(avg>=85?c.say('Semanón, cabrón.','Gran semana.','¡Semanón!'):avg>=60?c.say('Nada mal, pero se puede más, huevón.','Bien, pero se puede más.','Buen trabajo, vamos por más.'):c.say('Semana floja, huevón. La que viene sin excusas.','Semana floja. Corrige la próxima.','Semana difícil. La próxima es tuya.'));
  return{title:'Resumen semanal',body};
}

function due(S,now){
  const c=ctx(S,now),W=5,out=[],st=c.st;
  const hit=t=>{const x=toMin(t);return x<=c.m&&x>c.m-W};
  // hábitos
  c.active.forEach(h=>{const fire=h.type==='avoid'?c.val(h)<1:!c.done(h);if((h.reminders||[]).some(hit)&&fire)out.push({title:((h.emoji||'')+' '+h.name).trim(),body:fill(h.hate,h,c.val(h),S,c.dow,c.streak(h))})});
  // eventos y exámenes
  (S.events||[]).forEach(e=>{
    if(e.type==='examen'&&e.pre&&hit(e.preTime||'19:00')){
      const n=Math.round((fromKey(e.date)-fromKey(c.k))/864e5);
      if(n>=1&&n<=e.pre){const t=n===1?'mañana':'en '+n+' días';
        out.push({title:'Examen '+t,body:c.say('Examen de '+e.title+' '+t+'. ¿Ya estudiaste o vas a improvisar, huevón?','Examen de '+e.title+' '+t+'. Repasa hoy.','Examen de '+e.title+' '+t+'. Un repaso hoy y llegas con todo.')})}
    }
    if(!e.remind)return;if(e.date?e.date!==c.k:!(e.days||[]).includes(c.dow))return;
    const t=toMin(e.start)-e.remind;
    if(t<=c.m&&t>c.m-W)out.push({title:({clase:'Clase',personal:'Personal',examen:'Examen'}[e.type]||'Evento')+' en '+Math.max(1,toMin(e.start)-c.m)+' min',body:e.title+(e.place?' · '+e.place:'')+' a las '+e.start+'.'});
  });
  // revisión nocturna + racha en peligro
  if(st.nightOn&&st.night&&hit(st.night)&&c.active.length){
    const pend=c.active.filter(h=>!c.done(h));
    out.push(pend.length
      ?{title:'Revisión del día',body:(st.nightHate||'Te faltan: {pendientes}.').replace(/\{hora\}/g,st.night).replace(/\{pendientes\}/g,pend.map(h=>h.type==='qty'?h.name.toLowerCase()+' ('+fmt(Math.max(0,h.target-c.val(h)))+' '+h.unit+')':h.name.toLowerCase()).join(', '))}
      :{title:'Revisión del día',body:st.nightOk||'Cumpliste todo hoy.'});
    pend.filter(h=>h.type!=='avoid').map(h=>({h,s:c.streak(h)})).filter(x=>x.s>=3).forEach(({h,s})=>out.push({title:'Racha en peligro',
      body:c.say('Vas a perder tu racha de '+s+' días de '+h.name.toLowerCase()+', huevón. Todavía estás a tiempo.','Tu racha de '+s+' días de '+h.name.toLowerCase()+' está en riesgo. Hazlo hoy.','¡No pierdas tu racha de '+s+' días de '+h.name.toLowerCase()+'! Aún estás a tiempo.')}));
  }
  // briefing de la mañana
  if(st.briefOn&&hit(st.briefTime||'07:00')&&((S.habits||[]).length||(S.events||[]).length))out.push(briefing(S,c,now));
  // resumen semanal
  if(st.weeklyOn&&c.dow===Number(st.weeklyDay)&&hit(st.weeklyTime||'20:00')&&(S.habits||[]).length)out.push(weekly(S,c,now));
  // pesaje semanal
  const b=S.body||{};
  if(b.weighOn&&c.dow===Number(b.weighDay)&&hit(b.weighTime||'08:00')&&((S.weights||[]).length||b.goal)&&!(S.weights||[]).some(w=>w.date>dkey(addDays(now,-6))))
    out.push({title:'Hora de pesarte',body:c.say('Ya pasó una semana y no te has pesado, huevón. Súbete a la báscula.','Toca pesarte. Registra tu peso hoy.','Hoy toca pesarte. Registra cómo vas.')});
  return out;
}
function briefing(S,c,now){
  const st=c.st,name=(st.name||'').split(' ')[0],parts=[],k=c.k,dow=c.dow;
  const ev=(S.events||[]).filter(e=>e.date?e.date===k:(e.days||[]).includes(dow)).sort((a,b)=>a.start.localeCompare(b.start));
  if(ev.length)parts.push('Hoy: '+ev.slice(0,4).map(e=>(e.subject||e.title)+' '+e.start).join(', ')+'.');
  const g=(S.gym||{})[dow]||[];if(g.length)parts.push('Gym: '+g.join(', ')+((S.gymTime||{})[dow]?' a las '+S.gymTime[dow]:'')+'.');
  const ex=(S.events||[]).filter(e=>e.type==='examen'&&e.date>=k).sort((a,b)=>a.date.localeCompare(b.date))[0];
  if(ex){const n=Math.round((fromKey(ex.date)-fromKey(k))/864e5);if(n<=3)parts.push('Examen de '+(ex.subject||ex.title)+(n===0?' hoy':n===1?' mañana':' en '+n+' días')+'.')}
  const y=addDays(now,-1),yk=dkey(y),miss=(S.habits||[]).filter(h=>c.onDay(h,y.getDay())&&!c.doneV(h,c.valOn(h,yk)));
  if(miss.length)parts.push('Ayer fallaste: '+miss.slice(0,3).map(h=>h.name.toLowerCase()).join(', ')+'.');
  if(c.active.length)parts.push(c.active.length+(c.active.length===1?' hábito':' hábitos')+' para hoy.');
  parts.push(c.say(miss.length?'Hoy no la cagues, cabrón.':'Sin excusas, cabrón.',miss.length?'Hoy se corrige.':'A darle.',miss.length?'Hoy es un nuevo día. ¡Tú puedes!':'¡Que sea un gran día!'));
  return{title:'Buenos días'+(name?', '+name:''),body:parts.join(' ')};
}
function fallback(S,now){
  const c=ctx(S,now);const pend=c.active.filter(h=>h.type!=='avoid'&&!c.done(h));
  if(pend.length){const h=pick(pend);return{title:((h.emoji||'')+' '+h.name).trim(),body:fill(h.hate,h,c.val(h),S,c.dow,c.streak(h))}}
  if(c.active.length)return{title:'Día perfecto',body:(S.settings||{}).nightOk||'Cumpliste todo hoy.'};
  return{title:'Sin Excusas',body:'Hoy no tienes hábitos pendientes.'};
}
async function onPush(e){
  let S=null;
  try{const c=await caches.open('se-data');const r=await c.match('state.json');if(r)S=await r.json()}catch(x){}
  let list=[];
  if(e.data){try{const d=e.data.json();if(d&&d.title)list=[d]}catch(x){}}
  const st=S&&S.settings||{};
  if(st.pushUrl&&st.syncKey){
    try{const ctl=new AbortController();const tm=setTimeout(()=>ctl.abort(),4000);
      const r=await fetch(st.pushUrl.trim().replace(/\/+$/,'')+'/inbox',{headers:{'x-key':st.syncKey},signal:ctl.signal});clearTimeout(tm);
      if(r.ok){const d=await r.json();(d.msgs||[]).forEach(m=>list.push({title:m.title,body:m.body}));
        const k=dkey(new Date()),n=Number((d.steps||{})[k]||0),h=(S.habits||[]).find(x=>x.type==='qty'&&/pasos/i.test(x.unit||''));
        if(n&&h){S.log=S.log||{};S.log[k]=S.log[k]||{};if(n>Number(S.log[k][h.id]||0))S.log[k][h.id]=n}}
    }catch(x){}
  }
  const now=new Date();
  if(S){const extra=due(S,now);list=list.concat(extra)}
  if(!list.length&&S)list=[fallback(S,now)];
  if(!list.length)list=[{title:'Sin Excusas',body:'Abre la app y revisa tus hábitos de hoy.'}];
  await Promise.all(list.slice(0,4).map((n,i)=>self.registration.showNotification(n.title,{body:n.body,icon:'icon-192.png',badge:'icon-192.png',tag:'se-'+Date.now()+'-'+i,data:{url:'./'}})));
}
self.addEventListener('push',e=>e.waitUntil(onPush(e)));
self.addEventListener('notificationclick',e=>{e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>l.length?l[0].focus():self.clients.openWindow('./')))});
if(typeof module!=='undefined')module.exports={due,fallback,gfix};
