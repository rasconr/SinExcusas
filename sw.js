// Sin Excusas · service worker: funciona sin internet y arma los avisos que manda tu servidor.
const V='sinexcusas-v8';
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

function fill(t,h,v,S,c){
  const target=h.type==='check'?1:h.target,sk=/\{racha\}/.test(t||'')?c.streak(h):0,wk=h.freq?c.weekDone(h,c.ld,true):0;
  const rutina=((S.gym||{})[c.dow]||[]).join(', ')||'descanso';
  const lines=String(t||'').split('\n').map(x=>x.trim()).filter(Boolean);
  const line=pick(lines.filter(x=>sk>=2||!/\{racha\}/.test(x)))||pick(lines)||'Te falta {nombre}.';
  let out=line.replace(/\{nombre\}/g,h.name).replace(/\{falta\}/g,fmt(Math.max(0,target-v))).replace(/\{meta\}/g,fmt(target))
    .replace(/\{unidad\}/g,h.unit||'').replace(/\{hecho\}/g,fmt(v)).replace(/\{rutina\}/g,rutina).replace(/\{racha\}/g,sk)
    .replace(/\{semana\}/g,h.freq?wk+' de '+h.freq.n:'').replace(/\{yo\}/g,(S.settings||{}).name||'')
    .replace(/\s+/g,' ').replace(/\s([.,!?])/g,'$1').trim();
  if(h.freq&&!/\{semana\}/.test(line))out+=' Llevas '+wk+' de '+h.freq.n+' esta semana.';
  return out;
}

/* mismo motor de días que la app: fin del día, vacaciones, saltar hoy, veces por semana y silencio */
function ctx(S,now){
  const st=S.settings||{},g=st.gender||'h',tone=st.tone||'brutal',off=Number(st.dayEnd)||0;
  const ld=new Date(now.getTime()-off*3600e3);
  const k=dkey(ld),dow=ld.getDay(),m=now.getHours()*60+now.getMinutes();
  const valOn=(h,key)=>Number(((S.log||{})[key]||{})[h.id]||0);
  const doneV=(h,v)=>h.type==='avoid'?v<1:h.type==='check'?v>=1:v>=h.target;
  const val=h=>valOn(h,k);
  const done=h=>doneV(h,val(h));
  const inVac=key=>(S.vacations||[]).some(x=>key>=x.from&&key<=x.to);
  const bad=key=>!!((S.badDays||{})[key]);
  const isSkip=(h,key)=>!!(((S.skips||{})[key]||{})[h.id])||(bad(key)&&h.type==='check'&&!h.essential);
  const monday=d=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
  const weekDone=(h,d,incl)=>{let n=0;const end=dkey(d);for(let x=monday(d);;x=addDays(x,1)){const kk=dkey(x);if(kk>end||(!incl&&kk===end))break;if(doneV(h,valOn(h,kk)))n++}return n};
  const weekNeed=(h,d)=>{const n=h.freq.n,before=weekDone(h,d,false);if(before>=n)return false;return n-before>=7-((d.getDay()+6)%7)};
  const baseOn=(h,d)=>!h.paused&&!(st.examMode&&!h.essential)&&!inVac(dkey(d))&&!isSkip(h,dkey(d));
  const onDay=(h,d)=>{if(!baseOn(h,d))return false;if(h.freq)return h.type!=='avoid'&&((doneV(h,valOn(h,dkey(d)))&&weekDone(h,d,false)<h.freq.n)||weekNeed(h,d));return(h.days||[]).includes(d.getDay())};
  const visibleOn=(h,d)=>{if(!baseOn(h,d))return false;if(h.freq)return weekDone(h,d,false)<h.freq.n||doneV(h,valOn(h,dkey(d)));return(h.days||[]).includes(d.getDay())};
  const schedRaw=(h,d)=>!inVac(dkey(d))&&!isSkip(h,dkey(d))&&!h.freq&&(h.days||[]).includes(d.getDay());
  const active=(S.habits||[]).filter(h=>onDay(h,ld));
  const visible=(S.habits||[]).filter(h=>visibleOn(h,ld));
  const say=(b,d,c)=>gfix(tone==='brutal'?b:tone==='duro'?d:c,g);
  const quiet=t=>{if(!st.quietOn||!t)return false;const f=st.quietFrom||'23:00',to=st.quietTo||'07:00';return f<to?(t>=f&&t<to):(t>=f||t<to)};
  const streak=h=>{
    if(h.freq){let n=0;const mo=monday(ld);if(weekDone(h,addDays(mo,6),true)>=h.freq.n)n++;
      for(let w=1;w<120;w++){const mm=addDays(mo,-7*w);if(h.created&&dkey(addDays(mm,6))<h.created)break;let v=0;for(let i=0;i<7;i++)if(inVac(dkey(addDays(mm,i))))v++;if(v>=3)continue;if(weekDone(h,addDays(mm,6),true)>=h.freq.n)n++;else break}
      return n}
    let n=0,d=new Date(ld);if(!doneV(h,valOn(h,dkey(d))))d=addDays(d,-1);
    for(let i=0;i<730;i++){const kk=dkey(d);if(h.created&&kk<h.created)break;if(schedRaw(h,d)){if(doneV(h,valOn(h,kk)))n++;else break}d=addDays(d,-1)}
    return n};
  return{st,g,tone,ld,k,dow,m,val,valOn,doneV,done,onDay,visibleOn,schedRaw,active,visible,vac:inVac(k),bad,quiet,weekDone,say,streak};
}

function weekly(S,c){
  const now=c.ld;let sum=0,cnt=0;
  for(let i=0;i<7;i++){const d=addDays(now,-i),dk=dkey(d),hs=(S.habits||[]).filter(h=>c.onDay(h,d));if(!hs.length)continue;cnt++;sum+=hs.filter(h=>c.doneV(h,c.valOn(h,dk))).length/hs.length*100}
  const avg=cnt?Math.round(sum/cnt):0;
  const rates=(S.habits||[]).filter(h=>!h.paused).map(h=>{let ok=0,tot=0;for(let i=0;i<7;i++){const d=addDays(now,-i);if(!(h.freq?c.onDay(h,d):c.schedRaw(h,d)))continue;tot++;if(c.doneV(h,c.valOn(h,dkey(d))))ok++}return{h,r:tot?ok/tot:1}}).sort((a,b)=>b.r-a.r);
  let body='Cumpliste '+avg+'% esta semana.';
  if(rates.length>1&&rates[0].r!==rates[rates.length-1].r)body+=' Mejor: '+rates[0].h.name.toLowerCase()+'. Peor: '+rates[rates.length-1].h.name.toLowerCase()+'.';
  body+=' '+(avg>=85?c.say('Semanón, cabrón.','Gran semana.','¡Semanón!'):avg>=60?c.say('Nada mal, pero se puede más, huevón.','Bien, pero se puede más.','Buen trabajo, vamos por más.'):c.say('Semana floja, huevón. La que viene sin excusas.','Semana floja. Corrige la próxima.','Semana difícil. La próxima es tuya.'));
  return{title:'Resumen semanal',body};
}

function due(S,now){
  const c=ctx(S,now),W=5,out=[],st=c.st;
  const hit=t=>{const x=toMin(t);return x<=c.m&&x>c.m-W};
  // hábitos (los de "veces por semana" avisan mientras no cumplas la meta de la semana)
  c.visible.forEach(h=>{if(c.bad(c.k)&&!h.essential)return;const fire=h.type==='avoid'?c.val(h)<1:!c.done(h);if(fire&&(h.reminders||[]).some(r=>hit(r)&&!c.quiet(r)))out.push({title:((h.emoji||'')+' '+h.name).trim(),body:fill(h.hate,h,c.val(h),S,c)})});
  // eventos y exámenes (por fecha real)
  const rk=dkey(now),rdow=now.getDay();
  const pr=S.profile||{},school=!pr.role||['estudiante','ambos'].includes(pr.role);
  (S.events||[]).filter(e=>school||(e.type!=='clase'&&e.type!=='examen')).forEach(e=>{
    if(e.type==='examen'&&e.pre&&hit(e.preTime||'19:00')){
      const n=Math.round((fromKey(e.date)-fromKey(rk))/864e5);
      if(n>=1&&n<=e.pre){const t=n===1?'mañana':'en '+n+' días';
        out.push({title:'Examen '+t,body:c.say('Examen de '+e.title+' '+t+'. ¿Ya estudiaste o vas a improvisar, huevón?','Examen de '+e.title+' '+t+'. Repasa hoy.','Examen de '+e.title+' '+t+'. Un repaso hoy y llegas con todo.')})}
    }
    if(!e.remind)return;if(e.date?e.date!==rk:(c.vac||!(e.days||[]).includes(rdow)))return;
    const t=toMin(e.start)-e.remind;
    if(t<=c.m&&t>c.m-W)out.push({title:(e.work?'Trabajo':{clase:'Clase',personal:'Personal',examen:'Examen'}[e.type]||'Evento')+' en '+Math.max(1,toMin(e.start)-c.m)+' min',body:e.title+(e.place?' · '+e.place:'')+' a las '+e.start+'.'});
  });
  // revisión nocturna + racha en peligro (no en vacaciones)
  if(st.nightOn&&st.night&&hit(st.night)&&c.active.length&&!c.vac){
    const pend=c.active.filter(h=>!c.done(h));
    out.push(pend.length
      ?{open:'cierre',title:'Revisión del día',body:(st.nightHate||'Te faltan: {pendientes}.').replace(/\{hora\}/g,st.night).replace(/\{pendientes\}/g,pend.map(h=>h.type==='qty'?h.name.toLowerCase()+' ('+fmt(Math.max(0,h.target-c.val(h)))+' '+h.unit+')':h.name.toLowerCase()).join(', '))}
      :{open:'cierre',title:'Revisión del día',body:st.nightOk||'Cumpliste todo hoy.'});
    pend.filter(h=>h.type!=='avoid').map(h=>({h,s:c.streak(h),u:h.freq?'semanas':'días'})).filter(x=>x.s>=(x.h.freq?2:3)).forEach(({h,s,u})=>out.push({title:'Racha en peligro',
      body:c.say('Vas a perder tu racha de '+s+' '+u+' de '+h.name.toLowerCase()+', huevón. Todavía estás a tiempo.','Tu racha de '+s+' '+u+' de '+h.name.toLowerCase()+' está en riesgo. Hazlo hoy.','¡No pierdas tu racha de '+s+' '+u+' de '+h.name.toLowerCase()+'! Aún estás a tiempo.')}));
  }
  // entregas de notas
  const tmk=dkey(addDays(now,1));
  (S.notes||[]).forEach(n=>{if(n.done||!n.due)return;const t=n.title||'tu entrega';
    if(n.due===tmk&&hit('19:00'))out.push({title:'Entrega mañana',body:c.say('Mañana entregas “'+t+'”. ¿Ya la hiciste o la vas a hacer a las 3 am, huevón?','Mañana entregas “'+t+'”. Termínala hoy.','Mañana entregas “'+t+'”. Un último empujón hoy y listo.')});
    if(n.due===rk&&hit('08:00'))out.push({title:'Entrega hoy',body:c.say('Hoy entregas “'+t+'”. Sin excusas, cabrón.','Hoy entregas “'+t+'”.','¡Hoy entregas “'+t+'”! Tú puedes.')})});
  // la noche antes de tu peor día
  {const w=S.stats;if(st.nightOn&&st.night&&hit(st.night)&&!c.vac&&w&&w.ok&&w.gap>=25&&(c.dow+1)%7===w.worst){const d=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][w.worst],p=w.avg[w.worst];
    out.push({title:'Mañana es tu peor día',body:c.say('Mañana es '+d+', tu peor día ('+p+'%). Planéalo desde hoy o la vuelves a cagar, huevón.','Mañana es '+d+', tu peor día ('+p+'%). Planéalo hoy.','Mañana es '+d+', el día que más te cuesta ('+p+'%). Prepáralo desde hoy, tú puedes.')})}}
  // briefing de la mañana
  if(st.briefOn&&!c.vac&&hit(st.briefTime||'07:00')&&((S.habits||[]).length||(S.events||[]).length))out.push(briefing(S,c,now));
  // resumen semanal y pesaje (no en vacaciones)
  if(st.weeklyOn&&!c.vac&&rdow===Number(st.weeklyDay)&&hit(st.weeklyTime||'20:00')&&(S.habits||[]).length)out.push(weekly(S,c));
  const b=S.body||{};
  if(b.weighOn&&!c.vac&&rdow===Number(b.weighDay)&&hit(b.weighTime||'08:00')&&((S.weights||[]).length||b.goal)&&!(S.weights||[]).some(w=>w.date>dkey(addDays(now,-6))))
    out.push({title:'Hora de pesarte',body:c.say('Ya pasó una semana y no te has pesado, huevón. Súbete a la báscula.','Toca pesarte. Registra tu peso hoy.','Hoy toca pesarte. Registra cómo vas.')});
  return out;
}
function briefing(S,c,now){
  const st=c.st,name=(st.name||'').split(' ')[0],parts=[],k=dkey(now),dow=now.getDay();
  const ev=(S.events||[]).filter(e=>e.date?e.date===k:(e.days||[]).includes(dow)).sort((a,b)=>a.start.localeCompare(b.start));
  if(ev.length)parts.push('Hoy: '+ev.slice(0,4).map(e=>(e.subject||e.title)+' '+e.start).join(', ')+'.');
  const g=(S.gym||{})[dow]||[];if(g.length)parts.push('Gym: '+g.join(', ')+((S.gymTime||{})[dow]?' a las '+S.gymTime[dow]:'')+'.');
  const ex=(S.events||[]).filter(e=>e.type==='examen'&&e.date>=k).sort((a,b)=>a.date.localeCompare(b.date))[0];
  if(ex){const n=Math.round((fromKey(ex.date)-fromKey(k))/864e5);if(n<=3)parts.push('Examen de '+(ex.subject||ex.title)+(n===0?' hoy':n===1?' mañana':' en '+n+' días')+'.')}
  const y=addDays(c.ld,-1),yk=dkey(y),miss=(S.habits||[]).filter(h=>c.onDay(h,y)&&!c.doneV(h,c.valOn(h,yk)));
  if(miss.length)parts.push('Ayer fallaste: '+miss.slice(0,3).map(h=>h.name.toLowerCase()).join(', ')+'.');
  if(c.vac)parts.push('Estás de vacaciones: hoy tus hábitos no cuentan.');
  else if(c.active.length)parts.push(c.active.length+(c.active.length===1?' hábito':' hábitos')+' para hoy.');
  parts.push(c.say(miss.length?'Hoy no la cagues, cabrón.':'Sin excusas, cabrón.',miss.length?'Hoy se corrige.':'A darle.',miss.length?'Hoy es un nuevo día. ¡Tú puedes!':'¡Que sea un gran día!'));
  return{title:'Buenos días'+(name?', '+name:''),body:parts.join(' ')};
}
function fallback(S,now){
  const c=ctx(S,now);const pend=c.visible.filter(h=>h.type!=='avoid'&&!c.done(h));
  if(pend.length){const h=pick(pend);return{title:((h.emoji||'')+' '+h.name).trim(),body:fill(h.hate,h,c.val(h),S,c)}}
  if(c.vac)return{title:'Sin Excusas',body:'Estás de vacaciones. Tus rachas están a salvo.'};
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
        const k=dkey(new Date(Date.now()-(Number(st.dayEnd)||0)*3600e3)),n=Number((d.steps||{})[k]||0),h=(S.habits||[]).find(x=>x.type==='qty'&&/pasos/i.test(x.unit||''));
        if(n&&h){S.log=S.log||{};S.log[k]=S.log[k]||{};if(n>Number(S.log[k][h.id]||0))S.log[k][h.id]=n}}
    }catch(x){}
  }
  const now=new Date();
  if(S){const extra=due(S,now);list=list.concat(extra)}
  if(!list.length&&S)list=[fallback(S,now)];
  if(!list.length)list=[{title:'Sin Excusas',body:'Abre la app y revisa tus hábitos de hoy.'}];
  await Promise.all(list.slice(0,4).map((n,i)=>self.registration.showNotification(n.title,{body:n.body,icon:'icon-192.png',badge:'icon-192.png',tag:'se-'+Date.now()+'-'+i,data:{url:'./',open:n.open||''}})));
}
self.addEventListener('push',e=>e.waitUntil(onPush(e)));
self.addEventListener('notificationclick',e=>{e.notification.close();const o=(e.notification.data||{}).open||'';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{if(l.length){return l[0].focus().then(c=>{if(o)(c||l[0]).postMessage({open:o})})}return self.clients.openWindow('./'+(o?'#'+o:''))}))});
if(typeof module!=='undefined')module.exports={due,fallback,gfix,ctx};
