'use strict';
const API=(window.APP_CONFIG||{}).API_URL||'',TZ='Asia/Jerusalem',OT=9,STORE={lat:31.8667193,lng:34.7422365},RADIUS=50;
const DAYS=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const $=id=>document.getElementById(id),pad=n=>String(n).padStart(2,'0');
const fmt=(d,o)=>new Intl.DateTimeFormat('en-CA',Object.assign({timeZone:TZ},o)).format(d);
const dayKey=d=>fmt(new Date(d),{year:'numeric',month:'2-digit',day:'2-digit'});
const hm=d=>fmt(new Date(d),{hour:'2-digit',minute:'2-digit',hour12:false});
const dmy=d=>{const k=dayKey(d).split('-');return k[2]+'/'+k[1]+'/'+k[0]};
const wd=d=>DAYS[new Date(dayKey(d)+'T12:00:00Z').getUTCDay()];
const hours=p=>p.out?(new Date(p.out)-new Date(p.in))/36e5:0,ot=p=>Math.max(0,hours(p)-OT);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const curMonth=()=>dayKey(new Date()).slice(0,7);
function monthRange(m){const[y,mo]=m.split('-').map(Number);return{from:new Date(Date.UTC(y,mo-1,1)-864e5).toISOString(),to:new Date(Date.UTC(y,mo,1)+864e5).toISOString()}}
const inMonth=(p,m)=>dayKey(p.in).slice(0,7)===m;
function toast(t){const e=$('toast');e.textContent=t;e.style.display='block';clearTimeout(e._t);e._t=setTimeout(()=>e.style.display='none',3500)}
let TOKEN=localStorage.getItem('ap_token'),ME=JSON.parse(localStorage.getItem('ap_me')||'null'),USERS=[];
async function api(action,data){
 const r=await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({action,token:TOKEN},data||{})),redirect:'follow'});
 const j=await r.json();if(!j.ok&&/נדרשת התחברות|אינו פעיל/.test(j.error||'')){doLogout(true)}return j}
const show=ids=>document.querySelectorAll('main section').forEach(s=>s.hidden=!ids.includes(s.id));
function tick(){const n=new Date();$('hdrclock').textContent=hm(n);if($('bigclock'))$('bigclock').textContent=fmt(n,{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});$('today').textContent='יום '+wd(n)+', '+dmy(n)}
setInterval(tick,1000);tick();
let dp;addEventListener('beforeinstallprompt',e=>{e.preventDefault();dp=e;$('instBtn').hidden=false});$('instBtn').onclick=()=>dp&&dp.prompt();
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js');

/* ---------- login ---------- */
$('lgo').onclick=async()=>{$('lerr').textContent='';$('lgo').disabled=true;
 try{const j=await api('login',{username:$('lu').value.trim(),password:$('lp').value});
  if(!j.ok){$('lerr').textContent=j.error;return}TOKEN=j.token;ME=j.user;localStorage.setItem('ap_token',TOKEN);localStorage.setItem('ap_me',JSON.stringify(ME));start()}
 catch(e){$('lerr').textContent='שגיאת תקשורת – נסה שוב'}finally{$('lgo').disabled=false}};
$('lp').onkeydown=e=>{if(e.key==='Enter')$('lgo').click()};
function doLogout(silent){if(!silent&&TOKEN)api('logout').catch(()=>{});TOKEN=null;ME=null;localStorage.removeItem('ap_token');localStorage.removeItem('ap_me');start()}
$('logout').onclick=e=>{e.preventDefault();if(confirm('להתנתק?'))doLogout()};

/* ---------- employee ---------- */
let pos=null,geoErr=null,openP=null,watch=null;
function startGeo(){if(watch!=null||!navigator.geolocation){if(!navigator.geolocation)geoErr='המכשיר לא תומך במיקום';return}
 watch=navigator.geolocation.watchPosition(p=>{pos=p.coords;geoErr=null;renderEmp()},e=>{geoErr=e.code===1?'אין הרשאת מיקום – אפשר מיקום לאתר בהגדרות הדפדפן':'לא ניתן לאתר מיקום';renderEmp()},{enableHighAccuracy:true,maximumAge:5000,timeout:20000})}
function hav(a,b){const R=6371e3,t=Math.PI/180,x=Math.sin((a-STORE.lat)*t/2)**2+Math.cos(a*t)*Math.cos(STORE.lat*t)*Math.sin((b-STORE.lng)*t/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
function renderEmp(){const d=$('dist');let ok=false;
 if(geoErr){d.className='dist bad';d.textContent=geoErr}else if(!pos){d.className='dist';d.textContent='מאתר מיקום…'}
 else{const m=hav(pos.latitude,pos.longitude);ok=m<=RADIUS;d.className='dist '+(ok?'ok':'bad');d.textContent=(ok?'✅ בטווח החנות':'❌ מחוץ לטווח')+' · מרחק: '+(m<1000?Math.round(m)+' מ\'':(m/1000).toFixed(1)+' ק"מ')+(pos.accuracy?' (דיוק ±'+Math.round(pos.accuracy)+' מ\')':'')}
 $('bIn').disabled=!ok||!!openP;$('bOut').disabled=!ok||!openP;
 $('status').innerHTML=openP?'<span class="pill pin">בעבודה מאז '+hm(openP.in)+'</span>':'<span class="pill pout">לא במשמרת</span>'}
async function punch(type){if(!pos)return;$('bIn').disabled=$('bOut').disabled=true;
 try{const j=await api('punch',{type,lat:pos.latitude,lng:pos.longitude,acc:pos.accuracy});
  if(!j.ok){toast(j.error)}else{toast(type==='in'?'נרשמה כניסה ✔':'נרשמה יציאה ✔ ('+hours(j.punch).toFixed(2)+' ש\')');openP=type==='in'?j.punch:null}}
 catch(e){toast('שגיאת תקשורת – ההחתמה לא נרשמה')}await loadEmp()}
$('bIn').onclick=()=>punch('in');$('bOut').onclick=()=>punch('out');
async function loadEmp(){try{const j=await api('me');if(j.ok){openP=j.open;ME=j.user;$('hello').textContent='שלום, '+ME.name}
 const m=curMonth(),r=await api('myPunches',monthRange(m));if(r.ok){const ps=r.punches.filter(p=>inMonth(p,m)).sort((a,b)=>a.in<b.in?1:-1);
  $('myTbl').innerHTML=ps.map(p=>'<tr><td>'+dmy(p.in)+'</td><td>'+hm(p.in)+'</td><td>'+(p.out?hm(p.out):'—')+'</td><td>'+(p.out?hours(p).toFixed(2):'')+(ot(p)>0?' <span class="pill pot">+'+ot(p).toFixed(2)+'</span>':'')+'</td></tr>').join('')||'<tr><td colspan=4 class="muted">אין החתמות</td></tr>';
  $('myTot').textContent='סה"כ: '+new Set(ps.map(p=>dayKey(p.in))).size+' ימים · '+ps.reduce((s,p)=>s+hours(p),0).toFixed(2)+' שעות'}}catch(e){}renderEmp()}

/* ---------- manager ---------- */
const isOwner=()=>ME&&ME.role==='owner';
const uname=id=>(USERS.find(u=>u.id===id)||{name:'?'}).name;
let tab='mNow',poll=null;
function buildNav(){const t=[['mNow','עכשיו'],['mHist','היסטוריה'],['mRep','דוח ותזכורות']];if(isOwner())t.unshift(['emp','החתמה שלי']);
 $('nav').innerHTML=t.map(([id,l])=>'<button data-t="'+id+'">'+l+'</button>').join('');$('nav').hidden=false;
 $('nav').querySelectorAll('button').forEach(b=>b.onclick=()=>setTab(b.dataset.t))}
function setTab(t){tab=t;$('nav').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));show([t]);
 document.querySelectorAll('.owner').forEach(e=>e.hidden=!isOwner());
 if(t==='emp'){startGeo();loadEmp()}if(t==='mNow')loadNow();if(t==='mHist')loadHist();if(t==='mRep')loadRem()}
async function loadUsers(){const j=await api('dashboard');if(!j.ok){toast(j.error);return null}USERS=j.users;
 const sel=$('hEmp'),cur=sel.value;sel.innerHTML=USERS.filter(u=>u.role!=='accountant').map(u=>'<option value="'+u.id+'">'+esc(u.name)+(u.active?'':' (מושבת)')+'</option>').join('');if(cur)sel.value=cur;
 $('dEmp').innerHTML=sel.innerHTML;return j}
async function loadNow(){try{const j=await loadUsers();if(!j)return;
 $('nowCnt').textContent='('+j.open.length+')';$('nowList').innerHTML=j.open.map(p=>'<div style="padding:6px 0">🟢 <b>'+esc(uname(p.userId))+'</b> <span class="muted">מאז '+hm(p.in)+' ('+dmy(p.in)+')</span></div>').join('')||'<div class="muted">אין אף אחד בחנות</div>';
 $('upd').textContent='עודכן '+hm(new Date());const m=curMonth();$('curMonthLbl').textContent=m;
 const r=await api('punches',monthRange(m));const ps=r.ok?r.punches.filter(p=>inMonth(p,m)&&p.out):[];
 $('empTbl').innerHTML=USERS.filter(u=>u.role!=='accountant').map(u=>{const x=ps.filter(p=>p.userId===u.id);
  return '<tr'+(u.active?'':' style="opacity:.5"')+'><td>'+esc(u.name)+'<div class="muted" dir="ltr" style="text-align:right">'+esc(u.username)+'</div></td><td>'+new Set(x.map(p=>dayKey(p.in))).size+'</td><td>'+x.reduce((s,p)=>s+hours(p),0).toFixed(1)+'</td><td style="color:#b35c00;font-weight:700">'+x.reduce((s,p)=>s+ot(p),0).toFixed(1)+'</td>'+
  (isOwner()?'<td>'+(u.id===ME.id?'':'<button class="btn s g" onclick="toggleUser(\''+u.id+'\','+!u.active+')">'+(u.active?'השבת':'הפעל')+'</button> <button class="btn s g" onclick="resetPw(\''+u.id+'\')">סיסמה</button>')+'</td>':'')+'</tr>'}).join('')}catch(e){$('upd').textContent='שגיאת תקשורת'}}
window.toggleUser=async(id,active)=>{if(!confirm(active?'להפעיל משתמש?':'להשבית משתמש? הוא ינותק ולא יוכל להחתים.'))return;const j=await api('setActive',{userId:id,active});toast(j.ok?'עודכן':j.error);loadNow()};
window.resetPw=async id=>{if(!confirm('ליצור סיסמה חדשה ל'+uname(id)+'? הסיסמה הישנה תפסיק לעבוד.'))return;const j=await api('resetPassword',{userId:id});if(j.ok)prompt('הסיסמה החדשה (העתק ומסור לעובד):',j.password);else toast(j.error)};
$('addUserBtn').onclick=()=>{$('uName').value=$('uUser').value='';$('uRes').innerHTML='';$('uSave').disabled=false;$('uDlg').showModal()};
$('uClose').onclick=()=>{$('uDlg').close();loadNow()};
$('uSave').onclick=async()=>{$('uSave').disabled=true;const j=await api('addUser',{name:$('uName').value,username:$('uUser').value,role:$('uRole').value});
 if(j.ok)$('uRes').innerHTML='✅ נוצר. שם משתמש: <b dir="ltr">'+esc(j.user.username)+'</b><br>סיסמה: <b dir="ltr">'+esc(j.password)+'</b><br><span class="muted">העתק עכשיו – הסיסמה לא תוצג שוב.</span>';else{$('uRes').innerHTML='<span class="err">'+esc(j.error)+'</span>';$('uSave').disabled=false}};
$('hMonth').value=$('rMonth').value=curMonth();$('hEmp').onchange=loadHist;$('hMonth').onchange=loadHist;
let HP=[];
async function loadHist(){if(!USERS.length)await loadUsers();const m=$('hMonth').value,uid=$('hEmp').value;if(!m||!uid)return;
 $('hTbl').innerHTML='<tr><td colspan=6 class="muted">טוען…</td></tr>';const j=await api('punches',Object.assign({userId:uid},monthRange(m)));
 HP=j.ok?j.punches.filter(p=>inMonth(p,m)).sort((a,b)=>a.in<b.in?1:-1):[];
 $('hTbl').innerHTML=HP.map(p=>'<tr><td>'+dmy(p.in).slice(0,5)+'</td><td>'+wd(p.in)+'</td><td>'+hm(p.in)+'</td><td>'+(p.out?hm(p.out):'<span class="pill pin">פתוח</span>')+'</td><td>'+(p.out?hours(p).toFixed(2):'')+(ot(p)>0?' <span class="pill pot">+'+ot(p).toFixed(2)+' נוספות</span>':'')+(p.edited?' <span class="pill ped" title="'+esc(p.note)+'">תוקן</span>':'')+'</td><td>'+(isOwner()?'<button class="btn s" onclick="editP(\''+p.id+'\')">תקן</button>':'')+'</td></tr>').join('')||'<tr><td colspan=6 class="muted">אין החתמות</td></tr>';
 $('hTot').textContent='סה"כ: '+new Set(HP.map(p=>dayKey(p.in))).size+' ימי עבודה · '+HP.reduce((s,p)=>s+hours(p),0).toFixed(2)+' שעות · נוספות '+HP.reduce((s,p)=>s+ot(p),0).toFixed(2)}
const toLocal=iso=>iso?dayKey(iso)+'T'+hm(iso):'';
let cur=null;
window.editP=id=>{cur=HP.find(p=>p.id===id);$('dTitle').textContent='תיקון החתמה';$('dInfo').textContent=uname(cur.userId);$('dEmpWrap').hidden=true;$('dDel').hidden=false;
 $('dIn').value=toLocal(cur.in);$('dOut').value=toLocal(cur.out);$('dNote').value=cur.note||'';$('dlg').showModal()};
$('addPunchBtn').onclick=()=>{cur=null;$('dTitle').textContent='הוספת החתמה ידנית';$('dInfo').textContent='';$('dEmpWrap').hidden=false;$('dEmp').value=$('hEmp').value;$('dDel').hidden=true;$('dIn').value=$('dOut').value=$('dNote').value='';$('dlg').showModal()};
$('dCancel').onclick=()=>$('dlg').close();
$('dSave').onclick=async()=>{if(!$('dIn').value)return toast('חסרה שעת כניסה');const i=new Date($('dIn').value).toISOString(),o=$('dOut').value?new Date($('dOut').value).toISOString():'';
 if(o&&o<=i)return toast('יציאה חייבת להיות אחרי כניסה');
 const j=cur?await api('editPunch',{id:cur.id,in:i,out:o,note:$('dNote').value}):await api('addPunch',{userId:$('dEmp').value,in:i,out:o,note:$('dNote').value});
 if(j.ok){$('dlg').close();toast('נשמר');loadHist()}else toast(j.error)};
$('dDel').onclick=async()=>{if(!confirm('למחוק את ההחתמה?'))return;const j=await api('deletePunch',{id:cur.id});if(j.ok){$('dlg').close();toast('נמחק');loadHist()}else toast(j.error)};
async function loadRem(){const j=await api('reminderLog');if(!j.ok)return;
 $('remLog').innerHTML='<b>יומן תזכורות (אחרונות):</b><br>'+(j.log.map(l=>esc(dmy(l.time)+' '+hm(l.time)+' · '+l.kind+' · '+l.name+' · '+String(l.status).split(' | ')[0])).join('<br>')||'<span class="muted">ריק</span>')}
$('xls').onclick=async()=>{const m=$('rMonth').value;if(!m)return;$('xls').disabled=true;
 try{if(!USERS.length)await loadUsers();const j=await api('punches',monthRange(m));if(!j.ok)return toast(j.error);
  const ps=j.punches.filter(p=>inMonth(p,m));XLSX.writeFile(buildWorkbook(m,ps),'דוח_נוכחות_'+m+'.xlsx')}finally{$('xls').disabled=false}};
function buildWorkbook(m,ps){const aoa=[['דוח נוכחות חודשי – Auto Point, האומן 1 יבנה – '+m],['הופק: '+dmy(new Date())+' '+hm(new Date())],[],['עובד','תאריך','יום','כניסה','יציאה','שעות ביום','שעות נוספות (מעל 9)']];
 const sum=[[],['סיכום לפי עובד'],['עובד','סה"כ ימי עבודה','סה"כ שעות','סה"כ שעות נוספות']];
 USERS.filter(u=>u.role!=='accountant').forEach(u=>{const r=ps.filter(p=>p.userId===u.id).sort((a,b)=>a.in<b.in?-1:1);if(!r.length&&!u.active)return;let t=0,to=0;
  r.forEach(p=>{const h=hours(p);t+=h;to+=ot(p);aoa.push([u.name,dmy(p.in),wd(p.in),hm(p.in),p.out?hm(p.out):'חסר',p.out?+h.toFixed(2):'',ot(p)>0?+ot(p).toFixed(2):''])});
  const days=new Set(r.map(p=>dayKey(p.in))).size;aoa.push(['סה"כ – '+u.name,'','','','סה"כ ימי עבודה: '+days,'סה"כ שעות: '+t.toFixed(2),'סה"כ נוספות: '+to.toFixed(2)],[]);sum.push([u.name,days,+t.toFixed(2),+to.toFixed(2)])});
 const ws=XLSX.utils.aoa_to_sheet(aoa.concat(sum));ws['!cols']=[{wch:18},{wch:12},{wch:8},{wch:8},{wch:18},{wch:16},{wch:18}];
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'דוח '+m);wb.Workbook={Views:[{RTL:true}]};return wb}

/* ---------- boot ---------- */
function start(){clearInterval(poll);$('logout').hidden=!TOKEN;$('nav').hidden=true;
 if(!/^https:\/\/script\.google(usercontent)?\.com\//.test(API)&&!/^http:\/\/localhost/.test(API)){show(['cfg']);return}
 if(!TOKEN||!ME){show(['login']);return}
 if(ME.role==='employee'){show(['emp']);startGeo();loadEmp();poll=setInterval(loadEmp,60000);return}
 buildNav();setTab(isOwner()?'mNow':'mNow');poll=setInterval(()=>{if(tab==='mNow'&&!document.hidden)loadNow()},15000)}
start();
