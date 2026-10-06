(()=>{var ds=Object.defineProperty;var ge=(e,t)=>{for(var a in t)ds(e,a,{get:t[a],enumerable:!0})};function u(e){return e==null?"":String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}var Jt=Symbol("raw");function r(e){return{[Jt]:!0,value:String(e??"")}}function Ut(e){return e==null?"":Array.isArray(e)?e.map(Ut).join(""):typeof e=="object"&&e[Jt]?e.value:u(e)}function h(e,...t){let a=e[0];for(let s=0;s<t.length;s++)a+=Ut(t[s])+e[s+1];return a}var U=e=>String(e).padStart(2,"0");function m(e=new Date){return`${e.getFullYear()}-${U(e.getMonth()+1)}-${U(e.getDate())}`}function Z(e=new Date){return`${m(e)}T${U(e.getHours())}:${U(e.getMinutes())}`}function V(e=new Date){return`${U(e.getHours())}:${U(e.getMinutes())}`}function Q(e){let[t,a,s]=String(e).split("-").map(Number);return new Date(t,a-1,s)}function X(e){let[t,a="00:00"]=String(e).split("T"),[s,n,o]=t.split("-").map(Number),[i,l]=a.split(":").map(Number);return new Date(s,n-1,o,i||0,l||0)}function D(e){let[t,a]=String(e).split(":").map(Number);return(t||0)*60+(a||0)}function T(e,t){let a=Q(e);return a.setDate(a.getDate()+t),m(a)}function ze(e,t){let a=Q(t)-Q(e);return Math.round(a/864e5)}function Qt(e,t=m()){let a=[];for(let s=e-1;s>=0;s--)a.push(T(t,-s));return a}var Zt=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],Xt=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],Ge=e=>Zt[e],ea=e=>Xt[e];function j(e){let[t,a]=String(e).split(":").map(Number),s=t>=12?"PM":"AM";return`${t%12===0?12:t%12}:${U(a||0)} ${s}`}function q(e,{relative:t=!0}={}){let a=m();if(t){if(e===a)return"Today";if(e===T(a,-1))return"Yesterday";if(e===T(a,1))return"Tomorrow"}let s=Q(e);return`${Xt[s.getDay()]}, ${Zt[s.getMonth()]} ${s.getDate()}`}function Ee(e){let t=Math.max(0,Math.round(e));if(t<1)return"now";if(t<60)return`${t}m`;let a=Math.floor(t/60),s=t%60;return s?`${a}h ${s}m`:`${a}h`}function be(e){let t=Math.max(0,Math.round(e));if(t<60)return`${t} sec`;let a=Math.floor(t/60),s=t%60;return s?`${a} min ${s} sec`:`${a} min`}function ta(e){let[t,a]=String(e).split("T");return`${q(t)} at ${j(a||"00:00")}`}function aa(e){let t=X(e),a=Math.round((Date.now()-t.getTime())/6e4);if(a<1)return"just now";if(a<60)return`${a}m ago`;let s=Math.round(a/60);if(s<24)return`${s}h ago`;let n=Math.round(s/24);if(n===1)return"yesterday";if(n<30)return`${n} days ago`;let o=Math.round(n/30);return o===1?"a month ago":`${o} months ago`}function N(e="id"){return`${e}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`}var Ce=(e,t,a)=>Math.min(a,Math.max(t,e));function Je(e){return`tel:${String(e).replace(/[^\d+]/g,"")}`}function Ue(e){return(String(e||"").match(/\d/g)||[]).length>=3}function De(e){return String(e||"").trim().split(/\s+/).slice(0,2).map(t=>t[0]||"").join("").toUpperCase()}function Qe(e){let t=new Map;for(let a of e)a==null||a===""||t.set(a,(t.get(a)||0)+1);return[...t.entries()].map(([a,s])=>({value:a,count:s})).sort((a,s)=>s.count-a.count)}function M(e,t,a="s"){return`${e} ${t}${e===1?"":a}`}function ve(e,t){if(e==="taken")return"Taken";if(e==="late")return"Taken late";if(e==="missed")return"Missed";let a=D(V())-D(t);return a<0?"Scheduled":a<=60?"Due now":`${Ee(a)} overdue`}var Ne="synara.v2",na=3,oa={name:"local",async read(){try{let e=localStorage.getItem(Ne);return e?JSON.parse(e):null}catch(e){return console.warn("[synara] could not read local state:",e),null}},async write(e){try{return localStorage.setItem(Ne,JSON.stringify(e)),!0}catch(t){throw console.error("[synara] could not save state:",t),new Error("save-failed")}},async clear(){try{localStorage.removeItem(Ne)}catch(e){console.warn("[synara] could not clear state:",e)}}},K=oa;function de(){return{v:na,profile:{name:"",pronouns:"",grade:"",school:"",seizureType:"",diagnosed:"",neurologist:"",neuroPhone:"",allergies:"",bloodType:""},meds:[],doses:{},seizures:[],checkins:{},contacts:[],card:{looksLike:"",during:["Stay with them and start timing the seizure.","Move anything hard or sharp out of the way.","Put something soft under their head.","Loosen anything tight around their neck.","If they are not aware or not awake, gently turn them onto their side.","Stay calm and speak normally \u2014 they may be able to hear you."],doNot:["Do NOT put anything in their mouth. They cannot swallow their tongue.","Do NOT hold them down or try to stop the movements.","Do NOT give food, drink, or pills until they are fully awake.","Do NOT crowd them \u2014 ask other people to step back."],after:["Stay with them until they are fully alert and know where they are.","Tell them calmly what happened \u2014 they may not remember.","Let them rest somewhere quiet.","Call their emergency contact.","Write down the time it started and how long it lasted."],callEms:["The seizure lasts longer than 5 minutes.","A second seizure starts soon after the first.","They do not wake up or return to normal afterwards.","They are having trouble breathing, or their lips stay blue.","They were injured, or it happened in water."],forTeacher:"",forNurse:"",forCoach:"",updated:""},settings:{theme:"system",remindersOn:!1,reminderLead:0,quietHours:null,seeded:!1}}}var us=/^[A-Za-z0-9_-]{1,64}$/,ps=/^\d{4}-\d{2}-\d{2}$/,hs=/^([01]\d|2[0-3]):[0-5]\d$/,ms=/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/,ra=new Set(["taken","late","missed"]),et=new Set(["violet","mint","amber","rose","blue"]),tt=new Set(["tablet","capsule","liquid","patch","injection","other"]),fs=new Set(["system","light","dark"]),ie=e=>typeof e=="string"&&ps.test(e),k=(e,t=4e3)=>typeof e=="string"?e.slice(0,t):"",Ae=(e,t,a,s)=>typeof e=="number"&&Number.isFinite(e)?Math.min(a,Math.max(t,e)):s,ys=e=>Array.isArray(e)?e.map(t=>k(t,600)).filter(Boolean).slice(0,30):null,at=(e,t)=>typeof e=="string"&&us.test(e)?e:N(t),Le=e=>typeof e=="string"&&hs.test(e),le=e=>typeof e=="string"&&ms.test(e);function ce(e){return Array.isArray(e)?[...new Set(e.filter(Le))].sort():[]}function gs(e,t){let a=m(),s=ie(e.added)?e.added:t||a,n;Array.isArray(e.schedule)&&e.schedule.length?n=e.schedule.filter(i=>i&&ie(i.from)).map(i=>({from:i.from,times:ce(i.times)})).sort((i,l)=>i.from<l.from?-1:i.from>l.from?1:0):n=[{from:s,times:ce(e.times)}],n.length||(n=[{from:s,times:[]}]),n[0].from=s;let o=ie(e.ended)?e.ended:null;return!o&&e.active===!1&&(o=a),{id:at(e.id,"med"),name:k(e.name,120),dose:k(e.dose,60),form:tt.has(e.form)?e.form:"tablet",notes:k(e.notes,600),color:et.has(e.color)?e.color:"violet",added:s,ended:o,schedule:n}}function bs(e,t){let a={};if(!e||typeof e!="object")return a;for(let[s,n]of Object.entries(e)){if(!ie(s)||!n||typeof n!="object")continue;let o={};for(let[i,l]of Object.entries(n)){let[d,p]=i.split("|");!t.has(d)||!Le(p)||!l||!ra.has(l.status)||(o[i]={status:l.status,at:le(l.at)?l.at:`${s}T00:00`})}Object.keys(o).length&&(a[s]=o)}return a}function st(e){return!e||!le(e.at)?null:{id:at(e.id,"sz"),at:e.at,duration:Math.round(Ae(Number(e.duration),0,7200,0)),type:k(e.type,80),trigger:k(e.trigger,80),place:k(e.place,120),aura:k(e.aura,300),injury:e.injury===!0,emsCalled:e.emsCalled===!0,notes:k(e.notes,4e3),logged:le(e.logged)?e.logged:e.at}}function vs(e){let t={};if(!e||typeof e!="object")return t;for(let[a,s]of Object.entries(e)){if(!ie(a)||!s||typeof s!="object")continue;let n=Ae(s.stress,1,5,null);t[a]={sleepHours:Ae(s.sleepHours,0,24,null),sleepQuality:["poor","ok","good"].includes(s.sleepQuality)?s.sleepQuality:null,stress:n==null?null:Math.round(n),mood:["low","ok"].includes(s.mood)?s.mood:null,notes:k(s.notes,600),at:le(s.at)?s.at:`${a}T00:00`}}return t}function $s(e){return!e||typeof e!="object"?null:{id:at(e.id,"c"),name:k(e.name,120),relation:k(e.relation,80),phone:k(e.phone,40),primary:e.primary===!0}}function ws(e){let t=new Map;if(!e||typeof e!="object")return t;for(let a of Object.keys(e).sort())for(let s of Object.keys(e[a]||{})){let n=s.split("|")[0];t.has(n)||t.set(n,a)}return t}var nt=(e,t)=>e.at<t.at?1:e.at>t.at?-1:0;function ot(e){let t=de(),a=e&&typeof e=="object"?e:{},s=ws(a.doses),n=(Array.isArray(a.meds)?a.meds:[]).filter(w=>w&&typeof w=="object").map(w=>gs(w,s.get(w.id))),o=new Set(n.map(w=>w.id)),i=(Array.isArray(a.seizures)?a.seizures:[]).map(st).filter(Boolean).sort(nt),l=(Array.isArray(a.contacts)?a.contacts:[]).map($s).filter(Boolean),d=!1;for(let w of l)w.primary&&d&&(w.primary=!1),w.primary&&(d=!0);let p={...t.profile};if(a.profile&&typeof a.profile=="object")for(let w of Object.keys(t.profile))p[w]=k(a.profile[w],200);let f={...t.card};if(a.card&&typeof a.card=="object"){for(let w of["during","doNot","after","callEms"]){let x=ys(a.card[w]);x&&(f[w]=x)}for(let w of["looksLike","forTeacher","forNurse","forCoach"])typeof a.card[w]=="string"&&(f[w]=k(a.card[w]));f.updated=ie(a.card.updated)?a.card.updated:""}let g=a.settings&&typeof a.settings=="object"?a.settings:{},E=g.quietHours,C={theme:fs.has(g.theme)?g.theme:"system",remindersOn:g.remindersOn===!0,reminderLead:Math.round(Ae(g.reminderLead,0,120,0)),quietHours:E&&Le(E.from)&&Le(E.to)?{from:E.from,to:E.to}:null,seeded:g.seeded===!0};return{v:na,profile:p,meds:n,doses:bs(a.doses,o),seizures:i,checkins:vs(a.checkins),contacts:l,card:f,settings:C}}var S=de(),Ze=new Set,rt=!1;function R(){return S}function Oe(e){return Ze.add(e),()=>Ze.delete(e)}function ue(){for(let e of Ze)try{e(S)}catch(t){console.error("[synara] listener threw:",t)}}async function A(e){if(!rt)throw new Error("not-ready");return e(S),await K.write(S),ue(),S}function it(){ue()}function ks(e){if(e.key===Ne)try{S=e.newValue?ot(JSON.parse(e.newValue)):de(),rt=!0,ue()}catch(t){console.warn("[synara] ignored an unreadable change from another tab:",t)}}var sa=!1;async function ia(){!sa&&K===oa&&typeof window<"u"&&(window.addEventListener("storage",ks),sa=!0);let e=await K.read();return rt=!0,e?(S=ot(e),await K.write(S),{state:S,firstRun:!1}):(S=de(),{state:S,firstRun:!0})}async function la(){await K.clear(),S=de(),ue()}async function $e({seedFn:e}={}){return await K.clear(),S=de(),e&&(e(S),S.settings.seeded=!0),await K.write(S),ue(),S}function Ss(e,t){if(t<e.added)return[];if(e.ended&&t>=e.ended)return[];let a=[];for(let s of e.schedule)if(s.from<=t)a=s.times;else break;return a}function G(e){let t=e.schedule[e.schedule.length-1];return t?t.times:[]}function lt(e,t=m()){return!e.ended||e.ended>t}function W(e=S){let t=m();return e.meds.filter(a=>lt(a,t))}function L(e,t=S){let a=[];for(let s of t.meds)for(let n of Ss(s,e))a.push({med:s,time:n});return a.sort((s,n)=>D(s.time)-D(n.time)||s.med.name.localeCompare(n.med.name))}function ca({name:e,dose:t="",form:a="tablet",times:s=[],notes:n="",color:o="violet"}){let i=m();return A(l=>{l.meds.push({id:N("med"),name:k(e,120).trim(),dose:k(t,60).trim(),form:tt.has(a)?a:"tablet",notes:k(n,600).trim(),color:et.has(o)?o:"violet",added:i,ended:null,schedule:[{from:i,times:ce(s)}]})})}function da(e,t){let a=m();return A(s=>{let n=s.meds.find(o=>o.id===e);if(n&&(typeof t.name=="string"&&(n.name=k(t.name,120).trim()),typeof t.dose=="string"&&(n.dose=k(t.dose,60).trim()),typeof t.notes=="string"&&(n.notes=k(t.notes,600).trim()),tt.has(t.form)&&(n.form=t.form),et.has(t.color)&&(n.color=t.color),Array.isArray(t.times))){let o=ce(t.times);if(o.join()===G(n).join())return;let i=n.schedule[n.schedule.length-1];if(i.from===a){i.times=o;let l=n.schedule[n.schedule.length-2];l&&l.times.join()===o.join()&&n.schedule.pop()}else n.schedule.push({from:a,times:o})}})}function ua(e){let t=m();return A(a=>{let s=a.meds.find(n=>n.id===e);if(s){if(s.added>=t){a.meds=a.meds.filter(n=>n.id!==e);for(let n of Object.keys(a.doses)){for(let o of Object.keys(a.doses[n]))o.startsWith(`${e}|`)&&delete a.doses[n][o];Object.keys(a.doses[n]).length||delete a.doses[n]}return}s.ended=t}})}function pa(e){let t=m();return A(a=>{let s=a.meds.find(o=>o.id===e);if(!s||!s.ended)return;let n=G(s);s.ended<t&&(s.schedule.push({from:s.ended,times:[]}),s.schedule.push({from:t,times:n})),s.ended=null})}var Xe=(e,t)=>`${e}|${t}`;function je(e,t,a,s){return A(n=>{if(s==="pending"){n.doses[e]&&(delete n.doses[e][Xe(t,a)],Object.keys(n.doses[e]).length||delete n.doses[e]);return}ra.has(s)&&(n.doses[e]||(n.doses[e]={}),n.doses[e][Xe(t,a)]={status:s,at:Z()})})}function H(e,t,a,s=S){let n=s.doses[e]&&s.doses[e][Xe(t,a)];return n?n.status:"pending"}var He=60;function we(e,t,a,s=S){let n=H(e,t,a,s);if(n!=="pending")return n;let o=m();if(e<o)return"missed";if(e>o)return"pending";let i=new Date;return i.getHours()*60+i.getMinutes()>D(a)+He?"missed":"pending"}function ha({at:e,duration:t=0,type:a="",trigger:s="",place:n="",aura:o="",injury:i=!1,emsCalled:l=!1,notes:d=""}){return A(p=>{let f=st({id:N("sz"),at:e||Z(),duration:Number(t)||0,type:a,trigger:s,place:n,aura:o,injury:!!i,emsCalled:!!l,notes:(d||"").trim(),logged:Z()});f&&(p.seizures.push(f),p.seizures.sort(nt))})}function ma(e,t){return A(a=>{let s=a.seizures.findIndex(o=>o.id===e);if(s<0)return;let n=st({...a.seizures[s],...t,id:e});n&&(a.seizures[s]=n,a.seizures.sort(nt))})}function fa(e){return A(t=>{t.seizures=t.seizures.filter(a=>a.id!==e)})}function ya(e,t){return A(a=>{a.checkins[e]={...a.checkins[e]||{},...t,at:Z()}})}function ke(e,t=S){return t.checkins[e]||null}function ga({name:e,relation:t="",phone:a,primary:s=!1}){return A(n=>{s&&n.contacts.forEach(o=>{o.primary=!1}),n.contacts.push({id:N("c"),name:k(e,120).trim(),relation:k(t,80).trim(),phone:k(a,40).trim(),primary:!!s})})}function ba(e,t){return A(a=>{let s=a.contacts.find(n=>n.id===e);s&&(t.primary&&a.contacts.forEach(n=>{n.primary=!1}),typeof t.name=="string"&&(s.name=k(t.name,120).trim()),typeof t.relation=="string"&&(s.relation=k(t.relation,80).trim()),typeof t.phone=="string"&&(s.phone=k(t.phone,40).trim()),typeof t.primary=="boolean"&&(s.primary=t.primary))})}function va(e){return A(t=>{t.contacts=t.contacts.filter(a=>a.id!==e)})}function $a(e){return A(t=>{Object.assign(t.card,e,{updated:m()})})}function wa(e){return A(t=>{for(let a of Object.keys(t.profile))typeof e[a]=="string"&&(t.profile[a]=k(e[a],200).trim())})}function qe(e){return A(t=>Object.assign(t.settings,e))}function ka(){return JSON.stringify(S,null,2)}async function Sa(e){let t;try{t=JSON.parse(e)}catch{throw new Error("not-json")}if(!(t&&typeof t=="object"&&Array.isArray(t.meds)&&Array.isArray(t.seizures)&&t.doses&&typeof t.doses=="object"))throw new Error("not-synara");return S=ot(t),await K.write(S),ue(),S}var xs=[4,12,25,26,41],Ms=[2,6,9,17,22,31],ct=45,Ts=21,zs=30,Es={3:5,4:6,11:5.5,12:6,24:4.5,25:5.5,38:6},xa={3:5,4:4,10:4,11:5,23:4,24:5,37:4,38:4},Cs=e=>Math.round(e*10)/10;function Ie(e){let t=m();e.profile={name:"Maya Ellison",pronouns:"she/her",grade:"11th grade",school:"Rosewood High School",seizureType:"Focal impaired awareness, occasional tonic-clonic",diagnosed:"2022",neurologist:"Dr. Priya Raghavan",neuroPhone:"(555) 010-4488",allergies:"Penicillin",bloodType:"O+"};let a=T(t,-ct),s=T(t,-Ts),n=T(t,-zs),o={id:N("med"),name:"Levetiracetam",dose:"500 mg",form:"tablet",notes:"Take with food. Evening dose moved to 8pm so it is done before homework.",color:"violet",added:a,ended:null,schedule:[{from:a,times:["08:00","21:00"]},{from:s,times:["08:00","20:00"]}]},i={id:N("med"),name:"Lamotrigine",dose:"100 mg",form:"tablet",notes:"Never stop suddenly \u2014 taper only with Dr. Raghavan.",color:"mint",added:a,ended:null,schedule:[{from:a,times:["08:00"]}]},l={id:N("med"),name:"Topiramate",dose:"25 mg",form:"tablet",notes:"Stopped with Dr. Raghavan \u2014 made it hard to concentrate in class.",color:"amber",added:a,ended:n,schedule:[{from:a,times:["21:00"]}]};e.meds=[o,i,l],e.doses={};for(let p=ct;p>=1;p--){let f=T(t,-p),g={},E=xs.includes(p),C=Ms.includes(p),w=f<s?"21:00":"20:00";g[`${o.id}|08:00`]={status:C?"late":"taken",at:`${f}T08:12`},g[`${i.id}|08:00`]={status:C?"late":"taken",at:`${f}T08:12`},E?g[`${o.id}|${w}`]={status:"missed",at:`${f}T23:50`}:C?g[`${o.id}|${w}`]={status:"late",at:`${f}T22:40`}:g[`${o.id}|${w}`]={status:"taken",at:`${f}T${w==="21:00"?"21:04":"20:05"}`},f<n&&(g[`${l.id}|21:00`]={status:"taken",at:`${f}T21:06`}),e.doses[f]=g}e.checkins={};for(let p=ct;p>=0;p--){let f=T(t,-p),g=Es[p],E=g??Cs(7.4+p*37%11/10),C=xa[p]!=null?xa[p]:1+p*17%3;e.checkins[f]={sleepHours:E,sleepQuality:E<6?"poor":E<7?"ok":"good",stress:C,mood:C>=4?"low":"ok",notes:"",at:`${f}T07:30`}}let d=[{back:3,time:"15:40",duration:95,type:"Focal impaired awareness",trigger:"Missed sleep",place:"School \u2014 classroom",aura:'Metallic taste, felt "far away" for about a minute',injury:!1,emsCalled:!1,notes:"Ms. Okafor followed the card. Sat with me until I came back. Missed the bus home."},{back:11,time:"21:10",duration:130,type:"Tonic-clonic",trigger:"Missed dose",place:"Home \u2014 bedroom",aura:"None that I remember",injury:!0,emsCalled:!1,notes:"Bit the inside of my cheek. Mom timed it at just over two minutes."},{back:24,time:"07:55",duration:60,type:"Focal aware",trigger:"Missed sleep",place:"Home \u2014 kitchen",aura:"Stomach-dropping feeling",injury:!1,emsCalled:!1,notes:"Stayed home first period. Was fine by lunch."},{back:38,time:"14:20",duration:150,type:"Tonic-clonic",trigger:"Flashing lights",place:"School \u2014 gym",aura:"Visual static",injury:!1,emsCalled:!0,notes:"Assembly with strobe lighting. Nurse called EMS because it went past two minutes. Did not go to hospital."}];return e.seizures=d.map(p=>({id:N("sz"),at:`${T(t,-p.back)}T${p.time}`,duration:p.duration,type:p.type,trigger:p.trigger,place:p.place,aura:p.aura,injury:p.injury,emsCalled:p.emsCalled,notes:p.notes,logged:`${T(t,-p.back)}T${p.time}`})),e.seizures.sort((p,f)=>p.at<f.at?1:-1),e.contacts=[{id:N("c"),name:"Dana Ellison",relation:"Mom",phone:"(555) 014-2007",primary:!0},{id:N("c"),name:"Marcus Ellison",relation:"Dad",phone:"(555) 014-2019",primary:!1},{id:N("c"),name:"Dr. Priya Raghavan",relation:"Neurologist",phone:"(555) 010-4488",primary:!1},{id:N("c"),name:"Nurse Ruiz",relation:"School nurse",phone:"(555) 018-8300",primary:!1},{id:N("c"),name:"Aunt Jo",relation:"Emergency pickup",phone:"(555) 016-3520",primary:!1}],e.card={looksLike:"Maya usually goes quiet and stops responding. She may stare, blink repeatedly, or pick at her clothes. She sometimes says food tastes metallic right before. Most last under two minutes. Afterwards she is confused and very tired for 20\u201330 minutes and may not remember what happened.",during:["Stay with her and start timing immediately.","Move chairs, desks, and anything hard or sharp out of the way.","Put something soft under her head.","Loosen anything tight around her neck.","If she is not aware or not awake, gently turn her onto her side.","Stay calm and speak normally \u2014 she may be able to hear you."],doNot:["Do NOT put anything in her mouth. She cannot swallow her tongue.","Do NOT hold her down or try to stop the movements.","Do NOT give food, drink, or pills until she is fully awake.","Do NOT crowd her \u2014 ask other students to step back."],after:["Stay with her until she is fully alert and knows where she is.","Tell her calmly what happened \u2014 she will not remember.","Let her rest somewhere quiet. The nurse's office is best.","Call her mom, Dana, at (555) 014-2007.","Write down the time it started and how long it lasted."],callEms:["The seizure lasts longer than 5 minutes.","A second seizure starts soon after the first.","She does not wake up or return to normal afterwards.","She is having trouble breathing, or her lips stay blue.","She was injured, or it happened in water."],forTeacher:"Do not send her to the office alone afterwards \u2014 she will be confused and may not make it there. Send another student to get Nurse Ruiz instead. She is allowed to make up any assessment missed; this is in her 504 plan.",forNurse:"No rescue medication is prescribed at school. Standard first aid only. Call Dana Ellison first, then Dr. Raghavan's office if EMS criteria are met. Maya prefers to rest in the dark side room rather than the main bay.",forCoach:"Cleared for all sports except swimming without a spotter on deck. No climbing above head height. If she has a seizure at practice she is done for the day \u2014 no returning to play, even if she says she feels fine.",updated:T(t,-6)},e.settings={theme:"system",remindersOn:!1,reminderLead:0,quietHours:null,seeded:!0},e}var v={shell:document.querySelector(".app-shell"),backdrop:document.getElementById("backdrop"),sheet:document.getElementById("sheet"),emergency:document.getElementById("emergency"),welcome:document.getElementById("welcome"),toast:document.getElementById("toast")},Ma={home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.8V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.8"/>',pill:'<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M8.8 8.8l6.4 6.4"/>',chart:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 15l3.5-4 3 2.5L18 8"/>',shield:'<path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.4-7.5 9.5-4.4-1.1-7.5-4.9-7.5-9.5V6z"/><path d="M12 9v4"/><path d="M12 16h.01"/>',user:'<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',chevron:'<path d="m9 6 6 6-6 6"/>',phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',trash:'<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-.8 14a1 1 0 0 1-1 1H6.8a1 1 0 0 1-1-1L5 6"/>',print:'<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',wave:'<path d="M2 12c2.5-3 4.5-3 7 0s4.5 3 7 0 4.5-3 6 0"/><path d="M2 17c2.5-3 4.5-3 7 0s4.5 3 7 0 4.5-3 6 0" opacity=".5"/>',bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',pin:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',"trend-up":'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',"trend-down":'<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',down:'<path d="M12 4v12"/><path d="m6 10 6 6 6-6"/><path d="M4 20h16"/>',up:'<path d="M12 20V8"/><path d="m6 14 6-6 6 6"/><path d="M4 4h16"/>',check:'<path d="M20 6 9 17l-5-5"/>',note:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5"/><path d="M10 2h4"/><path d="M12 2v3"/>',book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',school:'<path d="M3 10 12 5l9 5-9 5z"/><path d="M7 12v5c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5v-5"/><path d="M21 10v6"/>',stethoscope:'<path d="M5 3v6a5 5 0 0 0 10 0V3"/><path d="M10 14v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',run:'<circle cx="14" cy="4" r="2"/><path d="m8 21 3-6 3 2v5"/><path d="M6 12l3-3 4 1 3 3 3 1"/><path d="m11 15-2-4"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',sparkle:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6.3 6.3 2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',play:'<path d="M7 4v16l13-8z"/>',archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>'};function c(e,t=24){let a=Ma[e]||Ma.info;return`<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${a}</svg>`}var Ds=["action","id","med","time","day","tab","to","field","value","theme"];function pt(e){return!e||!e.dataset||!e.dataset.action?null:Ds.filter(t=>e.dataset[t]!=null).map(t=>`[data-${t}="${CSS.escape(e.dataset[t])}"]`).join("")}function ht(e,t=document){if(!e)return!1;let a=t.querySelector(e);return a?(a.focus({preventScroll:!0}),!0):!1}var dt=new Set;function za(e){v.shell&&(e?v.shell.setAttribute("inert",""):v.shell.removeAttribute("inert"))}function mt(e){dt.add(e),za(!0)}function ft(e){dt.delete(e),dt.size||za(!1)}function yt(e){e.hidden=!1,e.offsetHeight,e.dataset.open="true"}function Be(e,t=300){return delete e.dataset.open,new Promise(a=>{setTimeout(()=>{e.dataset.open!=="true"&&(e.hidden=!0,e.innerHTML=""),a()},t)})}var te=!1,ut=null,pe=null,Pe=null;function I({title:e,body:t,footer:a="",onMount:s,onClose:n}){te||(pe=document.activeElement,ut=pt(pe)),Pe=n||null,v.sheet.innerHTML=h`
    <div class="sheet-grip" aria-hidden="true"></div>
    <div class="sheet-head">
      <h2 id="sheet-title">${e}</h2>
      <button class="icon-btn" data-action="close-sheet" aria-label="Close">
        ${r(c("x"))}
      </button>
    </div>
    <div class="sheet-body">${r(t)}</div>
    ${r(a?`<div class="sheet-foot">${a}</div>`:"")}
  `,v.backdrop.hidden=!1,v.backdrop.offsetHeight,v.backdrop.dataset.open="true",yt(v.sheet),te=!0,mt("sheet"),(v.sheet.querySelector('.sheet-body input:not([type="hidden"]), .sheet-body textarea, .sheet-body select, .sheet-body button, .sheet-foot button')||v.sheet.querySelector('[data-action="close-sheet"]')).focus({preventScroll:!0}),s&&s(v.sheet)}function z(){if(!te)return Promise.resolve();te=!1;let e=Be(v.sheet);if(Be(v.backdrop).then(()=>{v.backdrop.hidden=!0}),ft("sheet"),pe&&pe.isConnected?pe.focus({preventScroll:!0}):ht(ut),pe=null,ut=null,Pe){let t=Pe;Pe=null,t()}return e}function P(){return v.sheet}function B(){let e={};return v.sheet.querySelectorAll("[name]").forEach(t=>{t.type==="checkbox"?e[t.name]=t.checked:e[t.name]=t.value}),e}async function _({title:e,message:t,confirmLabel:a="Delete",danger:s=!0,onConfirm:n}){te&&await z(),I({title:e,body:h`<p class="sheet-message">${t}</p>`,footer:`
      <button class="btn btn-quiet" data-action="close-sheet">Cancel</button>
      <button class="btn ${s?"btn-danger":"btn-primary"}" data-sheet-confirm>${a}</button>
    `,onMount(o){o.querySelector("[data-sheet-confirm]").addEventListener("click",async()=>{await z(),n()})}})}var Ta=null;function y(e,t="default"){clearTimeout(Ta);let a=t==="ok"?"\u2713 ":t==="bad"?"! ":"";v.toast.textContent=a+e,v.toast.dataset.tone=t,v.toast.dataset.open="true",Ta=setTimeout(()=>{delete v.toast.dataset.open},2800)}var he=!1,Re=null,Se=null;async function Ea(){try{"wakeLock"in navigator&&(Se=await navigator.wakeLock.request("screen"))}catch{Se=null}}function Ns(){try{Se&&Se.release()}catch{}Se=null}document.addEventListener("visibilitychange",()=>{he&&document.visibilityState==="visible"&&Ea()});function Ca(e,{onClose:t,onMount:a}={}){te&&z(),Re=t||null,v.emergency.innerHTML=e,yt(v.emergency),he=!0,mt("emergency");let s=v.emergency.querySelector("[data-autofocus]")||v.emergency.querySelector("button, a");s&&s.focus({preventScroll:!0}),Ea(),a&&a(v.emergency)}function me(){if(he&&(he=!1,Be(v.emergency,220),ft("emergency"),Ns(),Re)){let e=Re;Re=null,e()}}function gt(){return he}function ae(){return v.emergency}function Da(e){v.welcome.innerHTML=e,yt(v.welcome),mt("welcome");let t=v.welcome.querySelector("button");t&&t.focus({preventScroll:!0})}function bt(){Be(v.welcome,250),ft("welcome")}var As="https://fluxplanner.github.io/Flux/landing.html";function xe(e=""){let t=document.documentElement.dataset.host==="flux"?"public/synara/icons/flux-logo.png":"icons/flux-logo.png";return`<a class="powered-by ${e}" href="${As}" target="_blank" rel="noopener"><span class="powered-by-t">Powered by</span><img class="powered-by-logo" src="${t}" alt="" width="18" height="18" /><span class="powered-by-name">Flux</span></a>`}v.backdrop.addEventListener("click",()=>{z()});document.addEventListener("keydown",e=>{e.key==="Escape"&&(te?z():he&&me())});function wt(){if(!("Notification"in window))return{ok:!1,reason:"This browser does not support notifications."};if(location.protocol==="file:")return{ok:!1,reason:"Notifications need the app served over https."};let e=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===!0;return/iPad|iPhone|iPod/.test(navigator.userAgent)&&!e?{ok:!1,reason:"On iPhone, add Synara to your home screen first \u2014 Safari only allows notifications for installed apps."}:{ok:!0,reason:""}}function Fe(){return"Notification"in window?Notification.permission:"unsupported"}async function Na(){if(!("Notification"in window))return"unsupported";try{return await Notification.requestPermission()}catch{return"denied"}}var $t=[];function Ls(){$t.forEach(clearTimeout),$t=[]}function Os(e,t){let a=e.quietHours;if(!a)return!1;let s=t.getHours()*60+t.getMinutes(),n=D(a.from),o=D(a.to);return n>o?s>=n||s<o:s>=n&&s<o}function js(e,t){try{let a=new Notification("Time for your medication",{body:`${e.name} ${e.dose} \u2014 ${j(t)}`,tag:`synara-${e.id}-${t}`,icon:"icons/icon-192.png",badge:"icons/icon-192.png"});a.onclick=()=>{window.focus(),location.hash="#/meds",a.close()}}catch(a){console.warn("[synara] could not show notification:",a)}}function vt(){Ls();let e=R(),{remindersOn:t,reminderLead:a}=e.settings;if(!t||Fe()!=="granted")return 0;let s=new Date,n=m(s),o=s.getHours()*60+s.getMinutes(),i=0;for(let{med:l,time:d}of L(n,e)){let p=D(d)-(a||0);if(p<=o||H(n,l.id,d,e)!=="pending")continue;let f=(p-o)*6e4;$t.push(setTimeout(()=>{let g=R();g.settings.remindersOn&&(Os(g.settings,new Date)||H(m(),l.id,d,g)==="pending"&&js(l,d))},f)),i++}return i}function Aa(){vt(),Oe(vt),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&vt()})}function La(){if(Fe()!=="granted")return!1;try{return new Notification("Synara reminders are on",{body:"This is what a dose reminder will look like.",icon:"icons/icon-192.png",tag:"synara-test"}),!0}catch{return!1}}var Tt={};ge(Tt,{actions:()=>nn,render:()=>Js,subtitle:()=>Vs,title:()=>Ys});var ja="These are associations in your own log, not medical conclusions. Patterns can appear by chance, especially with few entries. Bring them to your neurologist rather than acting on them alone.",se=3,Me=e=>e.reduce((t,a)=>t+a,0)/e.length,ne=e=>e.at.split("T")[0];function St(e,t,a=0){let s=m(),n=0,o=0;for(let i=a+1;i<=t;i++){let l=T(s,-i);for(let{med:d,time:p}of L(l,e))o++,we(l,d.id,p,e)==="taken"&&n++}return{good:n,total:o}}function Hs(e){let t=m(),a=0;for(let s=1;s<=365;s++){let n=T(t,-s),o=L(n,e);if(!o.length||!o.every(({med:l,time:d})=>we(n,l.id,d,e)==="taken"))break;a++}return a}function xt(e){let t=e.seizures||[];return t.length<2?[]:[qs(e,t),Is(e,t),Ps(e,t),Rs(t),Bs(t),Fs(t),Ws(e),_s(t)].filter(Boolean).sort((a,s)=>s.strength-a.strength)}function Ha(e){return xt(e)[0]||null}function qs(e,t){if(t.length<se||!e.meds.length)return null;let a=0,s=0;for(let o of t){let i=ne(o),l=!1,d=!1;for(let p of[0,-1,-2]){let f=T(i,p);for(let{med:g,time:E}of L(f,e)){l=!0;let C=we(f,g.id,E,e);if(C==="missed"||C==="late"){d=!0;break}}if(d)break}l&&s++,d&&a++}if(s<se||a<2)return null;let n=Math.round(a/s*100);return n<60?null:{id:"dose-proximity",tone:"alert",icon:"pill",title:`${a} of your ${s} seizures followed a missed or late dose`,detail:`Within 48 hours before each of those ${M(a,"seizure")}, at least one scheduled dose was marked missed or late. This is the pattern most worth mentioning at your next appointment.`,evidence:`${a}/${s} seizures \xB7 ${n}%`,strength:100+n}}function qa(e,t,a){let s=new Set(t.map(ne)),n=[],o=[];for(let[i,l]of Object.entries(e.checkins||{}))typeof l[a]=="number"&&(s.has(i)?n:o).push(l[a]);return{onSeizureDays:n,onOtherDays:o}}function Is(e,t){let{onSeizureDays:a,onOtherDays:s}=qa(e,t,"sleepHours");if(a.length<se||s.length<10)return null;let n=Me(a),o=Me(s),i=o-n;return i<.75?null:{id:"sleep",tone:"alert",icon:"moon",title:`You slept ${i.toFixed(1)} hours less before seizure days`,detail:`The nights before a seizure averaged ${n.toFixed(1)} hours, against ${o.toFixed(1)} on every other night. Short sleep is one of the most commonly reported seizure triggers.`,evidence:`${a.length} seizure nights vs ${s.length} others`,strength:90+Math.min(20,i*10)}}function Ps(e,t){let{onSeizureDays:a,onOtherDays:s}=qa(e,t,"stress");if(a.length<se||s.length<10)return null;let n=Me(a),o=Me(s),i=n-o;return i<.8?null:{id:"stress",tone:"watch",icon:"wave",title:"Seizure days were higher-stress days",detail:`You rated stress ${n.toFixed(1)} out of 5 on seizure days, against ${o.toFixed(1)} otherwise. Stress rarely acts alone \u2014 it tends to travel with the things that do, like less sleep, skipped meals, and broken routine.`,evidence:`${a.length} seizure days vs ${s.length} others`,strength:70+i*10}}function Rs(e){if(e.length<se)return null;let t=Qe(e.map(n=>n.trigger).filter(n=>n&&n!=="None known"));if(!t.length||t[0].count<2)return null;let a=t[0],s=Math.round(a.count/e.length*100);return{id:"trigger",tone:"watch",icon:"bolt",title:`"${a.value}" is your most logged trigger`,detail:`You recorded it for ${M(a.count,"seizure")} out of ${e.length}. `+(t.length>1?`Next most common: ${t.slice(1,3).map(n=>`${n.value} (${n.count})`).join(", ")}.`:"It is the only trigger you have logged so far."),evidence:`${a.count}/${e.length} seizures \xB7 ${s}%`,strength:60+s/2}}var kt=[{from:0,to:4,label:"late at night (12am\u20134am)"},{from:4,to:8,label:"early in the morning (4am\u20138am)"},{from:8,to:12,label:"in the morning (8am\u201312pm)"},{from:12,to:16,label:"in the early afternoon (12pm\u20134pm)"},{from:16,to:20,label:"in the late afternoon (4pm\u20138pm)"},{from:20,to:24,label:"in the evening (8pm\u201312am)"}];function Bs(e){if(e.length<se)return null;let t=new Array(kt.length).fill(0);for(let n of e){let o=X(n.at).getHours();t[kt.findIndex(i=>o>=i.from&&o<i.to)]++}let a=0;for(let n=1;n<t.length;n++)t[n]>t[a]&&(a=n);if(t[a]<2)return null;let s=Math.round(t[a]/e.length*100);return s<50?null:{id:"time-of-day",tone:"neutral",icon:"clock",title:`Most of your seizures happen ${kt[a].label}`,detail:`${t[a]} of ${e.length} fell in that window. If it holds up, it is worth asking whether your dose timing lines up with it.`,evidence:`${t[a]}/${e.length} seizures \xB7 ${s}%`,strength:40+s/2}}function Fs(e){if(e.length<se)return null;let t=Qe(e.map(s=>s.place).filter(Boolean));if(!t.length)return null;let a=e.filter(s=>/school/i.test(s.place||"")).length;return a<2&&t[0].count<2?null:{id:"place",tone:"neutral",icon:"pin",title:a>=2?`${a} of ${e.length} happened at school`:`Most often at: ${t[0].value}`,detail:a>=2?"Worth making sure the staff actually around you \u2014 not just the front office \u2014 have seen your safety card. Printing it from the Safety tab is the easiest way.":`You logged ${M(t[0].count,"seizure")} there out of ${e.length}.`,evidence:a>=2?`${a}/${e.length} seizures`:`${t[0].count}/${e.length} seizures`,strength:35}}function Ws(e){let t=St(e,14),a=St(e,45,14);if(t.total<10||a.total<10)return null;let s=Math.round(t.good/t.total*100),n=Math.round(a.good/a.total*100),o=s-n;if(Math.abs(o)<8)return null;let i=o>0;return{id:"adherence-trend",tone:i?"good":"alert",icon:i?"trend-up":"trend-down",title:i?`Your dose consistency is up ${o} points`:`Your dose consistency has slipped ${Math.abs(o)} points`,detail:`${s}% of doses taken on time over the last 14 days, against ${n}% in the month before.`+(i?" Keep going.":" Worth a look at which dose is slipping."),evidence:`${t.good}/${t.total} recent \xB7 ${a.good}/${a.total} before`,strength:i?50:85}}function _s(e){if(e.length<4)return null;let t=m(),a=e.map(ne).sort()[0],s=ze(a,t);if(s<30)return null;let n=Math.floor(s/2),o=T(t,-n),i=e.filter(p=>ne(p)>o).length,l=e.length-i;if(i===l)return null;let d=i<l;return{id:"frequency",tone:d?"good":"alert",icon:d?"sun":"alert",title:d?"Fewer seizures in the most recent stretch":"More seizures in the most recent stretch",detail:`${M(i,"seizure")} in the last ${n} days, against ${l} in the ${n} days before. Over a window this short a change like this can easily be chance \u2014 worth watching, not concluding.`,evidence:`${i} recent vs ${l} earlier`,strength:d?45:80}}function oe(e){let t=e.seizures||[],a=m(),{good:s,total:n}=St(e,30),o=n?Math.round(s/n*100):null,i=t.length?t.map(ne).sort().pop():null,l=i?ze(i,a):null,d=t.filter(g=>ze(ne(g),a)<=30).length,p=t.map(g=>g.duration).filter(g=>g>0),f=p.length?Math.round(Me(p)):null;return{adherence:o,adherenceGood:s,adherenceTotal:n,daysSince:l,lastSeizure:i,seizuresLast30:d,totalSeizures:t.length,avgDuration:f,avgDurationLabel:f?be(f):null,streak:Hs(e)}}function Ia(e,t=28){let a=new Set((e.seizures||[]).map(ne)),s=m();return Qt(t).map(n=>{let o=0,i=0,l="none";for(let{med:d,time:p}of L(n,e)){let f=n===s?H(n,d.id,p,e):we(n,d.id,p,e);f!=="pending"&&(i++,f==="taken"&&o++,f==="missed"?l="missed":f==="late"&&l!=="missed"?l="late":l==="none"&&(l="taken"))}return{day:n,taken:o,total:i,status:i===0?"none":l,seizure:a.has(n)}})}function Pa(){let e=new Date().getHours();return e<5?"Hi":e<12?"Good morning":e<18?"Good afternoon":"Good evening"}function Ys(e){let t=(e.profile.name||"").split(" ")[0];return t?`${Pa()}, ${t}`:Pa()}function Vs(e){if(!W(e).length)return"No medications added yet";let t=Mt(e).filter(a=>a.status==="pending").length;return t?`${M(t,"dose")} left to log today`:"Every dose logged for today"}function Mt(e){let t=m();return L(t,e).map(({med:a,time:s})=>({med:a,time:s,status:H(t,a.id,s,e)}))}function Ks(e){let t=Mt(e).filter(i=>i.status==="pending");if(!t.length)return null;let a=D(V()),s=i=>a-D(i.time),n=t.find(i=>s(i)>=0&&s(i)<=He);if(n)return{...n,mode:"due",others:t.length-1};let o=t.filter(i=>s(i)>He);return o.length?{...o[o.length-1],mode:"overdue",others:t.length-1}:{...t[0],mode:"upcoming",others:t.length-1}}function Gs(e){let t=T(m(),1);return L(t,e)[0]||null}function Js(e){let t=W(e).length>0,a=oe(e),s=Ha(e),n=!!ke(m(),e);return h`
    <div class="home-grid">
      <div class="home-main">
        ${r(t?Us(e):Qs())}
        ${r(t?en(e):"")}
      </div>
      <div class="home-side">
        ${r(Zs(a))}
        ${r(n?"":tn())}
        ${r(s?an(s):"")}
        ${r(sn())}
      </div>
    </div>
  `}function Us(e){let t=Ks(e);if(!t){let i=Gs(e);return h`
      <section class="card next-dose" data-state="clear" aria-label="Today's doses">
        <span class="eyebrow">Today</span>
        <div class="next-dose-when">All done</div>
        <span class="next-dose-what">
          Every dose today is logged.${r(i?` First one tomorrow: ${u(i.med.name)} at ${j(i.time)}.`:"")}
        </span>
      </section>
    `}let a=D(t.time)-D(V()),s=t.mode==="overdue"?`${Ee(-a)} overdue`:t.mode==="due"||a<=1?"Due now":`in ${Ee(a)}`,n=t.mode==="overdue"?"Not logged yet":t.mode==="due"?"Take it now":"Next dose",o=t.mode==="overdue"?`<button class="btn btn-on-brand" data-action="dose-quick"
               data-med="${t.med.id}" data-time="${t.time}" data-status="late">
         ${c("check",18)} Took it late
       </button>
       <button class="btn btn-on-brand-ghost" data-action="dose-quick"
               data-med="${t.med.id}" data-time="${t.time}" data-status="missed">
         Missed it
       </button>`:`<button class="btn btn-on-brand" data-action="dose-quick"
               data-med="${t.med.id}" data-time="${t.time}" data-status="taken">
         ${c("check",18)} Mark taken
       </button>
       ${t.mode==="due"?`<button class="btn btn-on-brand-ghost" data-action="dose-quick"
                    data-med="${t.med.id}" data-time="${t.time}" data-status="missed">
              Skip
            </button>`:""}`;return h`
    <section class="card next-dose" data-state="${t.mode}" aria-label="Next dose">
      <span class="eyebrow">${n}</span>
      <div class="next-dose-when">${s}</div>
      <span class="next-dose-what">
        ${t.med.name}${t.med.dose?` ${t.med.dose}`:""} · ${j(t.time)}
      </span>
      <div class="next-dose-actions">${r(o)}</div>
      ${r(t.others>0?`<button class="next-dose-more" data-action="nav" data-to="meds">
             ${t.others} more ${t.mode==="upcoming"?"later today":"to log today"} ${c("chevron",14)}
           </button>`:"")}
    </section>
  `}function Qs(){return h`
    <section class="card next-dose" data-state="empty" aria-label="Get started">
      <span class="eyebrow">Get started</span>
      <div class="next-dose-when next-dose-when-sm">Add your first medication</div>
      <span class="next-dose-what">
        Name, dose, and the times you take it. About twenty seconds — then
        every dose gets tracked from today on.
      </span>
      <div class="next-dose-actions">
        <button class="btn btn-on-brand" data-action="med-open">
          ${r(c("plus",18))} Add a medication
        </button>
      </div>
    </section>
  `}function Zs(e){let t=e.adherence==null?"":e.adherence>=90?"ok":e.adherence>=75?"warn":"bad";return h`
    <div class="stats" role="list" aria-label="Your numbers">
      <div class="stat" data-tone="${t}" role="listitem">
        <span class="stat-n">${e.adherence==null?"\u2014":`${e.adherence}%`}</span>
        <span class="stat-l">${e.adherence==null?"Doses on time \u2014 from tomorrow":"Doses on time, last 30 days"}</span>
      </div>
      <div class="stat" role="listitem">
        <span class="stat-n">${e.daysSince==null?"\u2014":e.daysSince}</span>
        <span class="stat-l">Days since last seizure</span>
      </div>
      <div class="stat" data-tone="${e.streak>=7?"ok":""}" role="listitem">
        <span class="stat-n">${e.streak}</span>
        <span class="stat-l">Day streak, every dose on time</span>
      </div>
    </div>
  `}var Xs={taken:"\u2713",late:"!",missed:"\u2715",pending:""};function en(e){let t=Mt(e),a=m(),s=t.map(n=>{let o=ve(n.status,n.time);return`
      <li class="dose-row">
        <span class="med-dot" data-color="${u(n.med.color)}" aria-hidden="true">${c("pill",20)}</span>
        <span class="dose-body">
          <span class="dose-name">${u(n.med.name)} <span class="dose-amt">${u(n.med.dose)}</span></span>
          <span class="dose-meta" data-status="${n.status}">${j(n.time)} \xB7 ${o}</span>
        </span>
        <button class="tick" data-status="${n.status}" data-action="dose-cycle"
                data-med="${n.med.id}" data-time="${n.time}" data-day="${a}"
                aria-label="${u(n.med.name)} at ${j(n.time)}: ${o}. Tap to change.">
          ${Xs[n.status]}
        </button>
      </li>`}).join("");return h`
    <section class="section" aria-labelledby="today-h">
      <div class="section-head">
        <h2 id="today-h">Today</h2>
        <button class="btn btn-sm btn-quiet" data-action="nav" data-to="meds">All meds</button>
      </div>
      <div class="card card-flush">
        <ul class="rows">${r(s)}</ul>
      </div>
      <p class="hint">Tap a circle to cycle: taken → late → missed → not logged.</p>
    </section>
  `}function tn(){return h`
    <button class="card card-tap checkin-cta" data-action="checkin-open">
      <span class="row">
        <span class="med-dot" data-color="blue" aria-hidden="true">${r(c("moon",20))}</span>
        <span class="row-body">
          <span class="row-t">How did you sleep?</span>
          <span class="row-s">Ten-second check-in. Sleep and stress are what the pattern finder compares against.</span>
        </span>
        <span class="chev">${r(c("chevron"))}</span>
      </span>
    </button>
  `}function an(e){return h`
    <section class="section" aria-labelledby="insight-h">
      <div class="section-head">
        <h2 id="insight-h">Worth knowing</h2>
        <button class="btn btn-sm btn-quiet" data-action="open-patterns">All patterns</button>
      </div>
      <div class="insight" data-tone="${e.tone}">
        <span class="insight-ico" aria-hidden="true">${r(c(e.icon,20))}</span>
        <span class="insight-body">
          <span class="insight-t">${e.title}</span>
          <span class="insight-d">${e.detail}</span>
          <span class="insight-e">${e.evidence}</span>
        </span>
      </div>
    </section>
  `}function sn(){return h`
    <div class="quick-grid">
      <button class="quick" data-action="seizure-open">
        <span class="quick-ico" data-tone="violet" aria-hidden="true">${r(c("note",20))}</span>
        <span class="quick-t">Log a seizure</span>
        <span class="quick-s">Half-filled is fine</span>
      </button>
      <button class="quick" data-action="open-emergency">
        <span class="quick-ico" data-tone="rose" aria-hidden="true">${r(c("shield",20))}</span>
        <span class="quick-t">Emergency card</span>
        <span class="quick-s">With a seizure timer</span>
      </button>
    </div>
  `}var nn={async"dose-quick"(e){let{med:t,time:a,status:s}=e.dataset;await je(m(),t,a,s),y(s==="taken"?"Marked taken":s==="late"?"Marked taken late":"Marked missed",s==="missed"?"default":"ok")}};var Et={};ge(Et,{actions:()=>$n,render:()=>mn,subtitle:()=>hn,title:()=>pn});var on=["violet","mint","amber","rose","blue"],rn={violet:"Violet",mint:"Mint",amber:"Amber",rose:"Rose",blue:"Blue"},ln={violet:"brand",mint:"ok",amber:"warn",rose:"bad",blue:"info"},cn=["tablet","capsule","liquid","patch","injection","other"],dn={taken:"\u2713",late:"!",missed:"\u2715",pending:""},un={taken:"Taken",late:"Taken late",missed:"Missed",pending:"Not logged"},$=null;function pn(){return"Medications"}function hn(e){let t=W(e);if(!t.length)return"Nothing added yet";let a=t.reduce((s,n)=>s+G(n).length,0);return`${M(t.length,"medication")} \xB7 ${M(a,"dose")} a day`}function mn(e){let t=W(e),a=e.meds.filter(s=>!lt(s));return t.length?h`
    <div class="split-grid">
      <div class="split-main">
        ${r(fn(e))}
        ${r(gn(t))}
        ${r(a.length?Ra(a):"")}
      </div>
      <div class="split-side">
        ${r(yn(e))}
      </div>
    </div>
  `:h`
      <div class="card">
        <div class="empty">
          <span class="empty-ico" aria-hidden="true">${r(c("pill",32))}</span>
          <span class="empty-t">No medications yet</span>
          <span class="empty-s">
            Add what you take and when. Every dose gets tracked from today,
            building a history you can actually show a doctor.
          </span>
          <button class="btn btn-primary" data-action="med-open">
            ${r(c("plus",18))} Add a medication
          </button>
        </div>
      </div>
      ${r(a.length?Ra(a):"")}
    `}function Fa(e,t,a,s,n){return`
    <li class="dose-row">
      <span class="med-dot" data-color="${u(t.color)}" aria-hidden="true">${c("pill",20)}</span>
      <span class="dose-body">
        <span class="dose-name">${u(t.name)} <span class="dose-amt">${u(t.dose)}</span></span>
        <span class="dose-meta" data-status="${s}">${j(a)} \xB7 ${u(n)}</span>
      </span>
      <button class="tick" data-status="${s}" data-action="dose-cycle"
              data-med="${t.id}" data-time="${a}" data-day="${e}"
              aria-label="${u(t.name)} at ${j(a)}: ${u(n)}. Tap to change.">
        ${dn[s]}
      </button>
    </li>`}function fn(e){let t=m(),a=L(t,e).map(({med:s,time:n})=>{let o=H(t,s.id,n,e);return Fa(t,s,n,o,ve(o,n))}).join("");return h`
    <section class="section" aria-labelledby="meds-today-h">
      <div class="section-head">
        <h2 id="meds-today-h">Today</h2>
        <span class="t-sm ink-3">${q(t,{relative:!1})}</span>
      </div>
      <div class="card card-flush">
        <ul class="rows">${r(a)}</ul>
      </div>
      <p class="hint">Tap a circle to cycle: taken → late → missed → not logged.</p>
    </section>
  `}function yn(e){let t=Ia(e,28),a=m(),s=Q(t[0].day).getDay(),n=[0,1,2,3,4,5,6].map(l=>`<div class="cal-dow" aria-hidden="true">${ea(l).slice(0,2)}</div>`).join(""),o='<div aria-hidden="true"></div>'.repeat(s),i=t.map(l=>{let d=Q(l.day).getDate(),p=l.total?`${l.taken} of ${l.total} doses on time`:l.day===a?"nothing logged yet":"no doses scheduled",f=`${q(l.day,{relative:!1})}: ${p}`+(l.seizure?", seizure logged":"");return`
      <button class="cal-day" data-status="${l.status}" data-today="${l.day===a}"
              data-seizure="${l.seizure}" data-action="cal-day" data-day="${l.day}"
              aria-label="${u(f)}" title="${u(f)}">${d}</button>`}).join("");return h`
    <section class="section" aria-labelledby="cal-h">
      <div class="section-head">
        <h2 id="cal-h">Last four weeks</h2>
      </div>
      <div class="card">
        <div class="cal">${r(n)}${r(o)}${r(i)}</div>
        <div class="cal-legend">
          <span class="cal-key"><span class="cal-swatch" data-k="taken"></span>All on time</span>
          <span class="cal-key"><span class="cal-swatch" data-k="late"></span>Late</span>
          <span class="cal-key"><span class="cal-swatch" data-k="missed"></span>Missed</span>
          <span class="cal-key"><span class="cal-swatch" data-k="seizure"></span>Seizure</span>
        </div>
        <p class="hint cal-hint">Tap a day to see or fix what was logged.</p>
      </div>
    </section>
  `}function gn(e){let t=e.map(a=>{let s=G(a);return`
      <li>
        <button class="list-row" data-action="med-open" data-id="${a.id}">
          <span class="med-dot" data-color="${u(a.color)}" aria-hidden="true">${c("pill",20)}</span>
          <span class="row-body">
            <span class="row-t">${u(a.name)} <span class="dose-amt">${u(a.dose)}</span></span>
            <span class="row-s">${s.length?s.map(j).join(" \xB7 "):"No times set"}</span>
            ${a.notes?`<span class="row-note">${u(a.notes)}</span>`:""}
          </span>
          <span class="chev">${c("chevron")}</span>
        </button>
      </li>`}).join("");return h`
    <section class="section" aria-labelledby="meds-list-h">
      <div class="section-head">
        <h2 id="meds-list-h">Your medications</h2>
        <button class="btn btn-sm btn-soft" data-action="med-open">${r(c("plus",16))} Add</button>
      </div>
      <div class="card card-flush">
        <ul class="rows">${r(t)}</ul>
      </div>
    </section>
  `}function Ra(e){let t=e.map(a=>`
    <li class="list-row list-row-static">
      <span class="med-dot" data-color="${u(a.color)}" data-muted="true" aria-hidden="true">${c("archive",18)}</span>
      <span class="row-body">
        <span class="row-t">${u(a.name)} <span class="dose-amt">${u(a.dose)}</span></span>
        <span class="row-s">Stopped ${q(a.ended,{relative:!1})} \xB7 history kept</span>
      </span>
      <button class="btn btn-sm btn-quiet" data-action="med-restart" data-id="${a.id}">Restart</button>
    </li>`).join("");return h`
    <details class="stopped">
      <summary>
        <span>Stopped medications</span>
        <span class="pill">${e.length}</span>
      </summary>
      <div class="card card-flush">
        <ul class="rows">${r(t)}</ul>
      </div>
      <p class="hint">
        Their doses still count for the days they were being taken — stopping a
        medication shouldn't rewrite the record a neurologist will ask about.
      </p>
    </details>
  `}function Wa(){let e=$.times.map((s,n)=>`
    <div class="input-row">
      <input class="input" type="time" value="${u(s)}" data-time-index="${n}"
             aria-label="Dose time ${n+1}" required />
      ${$.times.length>1?`<button type="button" class="icon-btn" data-action="med-time-remove" data-index="${n}"
                   aria-label="Remove time ${n+1}">${c("trash",20)}</button>`:""}
    </div>`).join(""),t=on.map(s=>`
    <button type="button" class="chip chip-color" data-action="med-color" data-value="${s}"
            aria-pressed="${s===$.color}">
      <span class="cal-swatch" style="background:var(--${ln[s]})"></span>${rn[s]}
    </button>`).join(""),a=cn.map(s=>`<option value="${s}" ${s===$.form?"selected":""}>${s[0].toUpperCase()}${s.slice(1)}</option>`).join("");return h`
    <form class="stack stack-5" data-action="med-save" novalidate>
      <div class="field">
        <label class="label" for="med-name">Name</label>
        <input class="input" id="med-name" name="name" value="${$.name}"
               placeholder="e.g. Levetiracetam" autocomplete="off" required maxlength="120" />
      </div>

      <div class="input-row">
        <div class="field grow">
          <label class="label" for="med-dose">Dose</label>
          <input class="input" id="med-dose" name="dose" value="${$.dose}"
                 placeholder="500 mg" autocomplete="off" maxlength="60" />
        </div>
        <div class="field grow">
          <label class="label" for="med-form">Form</label>
          <select class="select" id="med-form" name="form">${r(a)}</select>
        </div>
      </div>

      <div class="field">
        <span class="label" id="times-label">Times each day</span>
        <div class="stack stack-2" role="group" aria-labelledby="times-label">${r(e)}</div>
        <button type="button" class="btn btn-sm btn-quiet self-start" data-action="med-time-add">
          ${r(c("plus",16))} Add another time
        </button>
        ${r($.id?'<span class="hint">Changing times applies from today. Earlier days keep the schedule they actually had.</span>':"")}
      </div>

      <div class="field">
        <span class="label" id="color-label">Colour</span>
        <div class="chips" role="group" aria-labelledby="color-label">${r(t)}</div>
      </div>

      <div class="field">
        <label class="label" for="med-notes">Notes <span class="ink-faint">(optional)</span></label>
        <textarea class="textarea" id="med-notes" name="notes" maxlength="600"
                  placeholder="Take with food">${$.notes}</textarea>
      </div>
    </form>
  `}function Te(){if(!$)return;let e=B();for(let t of["name","dose","form","notes"])e[t]!==void 0&&($[t]=e[t]);P().querySelectorAll("[data-time-index]").forEach(t=>{$.times[Number(t.dataset.timeIndex)]=t.value})}function zt(e){Te();let t=P().querySelector(".sheet-body");if(t&&(t.innerHTML=Wa()),e){let a=P().querySelector(e);a&&a.focus()}}function bn(e){$=e?{id:e.id,name:e.name,dose:e.dose,form:e.form,notes:e.notes,color:e.color,times:[...G(e)]}:{id:null,name:"",dose:"",form:"tablet",times:["08:00"],notes:"",color:"violet"},$.times.length||($.times=["08:00"]),I({title:e?"Edit medication":"Add medication",body:Wa(),footer:`
      ${e?`<button class="btn btn-danger-soft" data-action="med-stop" data-id="${e.id}">Stop taking</button>`:""}
      <button class="btn btn-primary" data-action="med-save">${e?"Save":"Add medication"}</button>
    `,onClose(){$=null}})}var vn={pending:"taken",taken:"late",late:"missed",missed:"pending"};function Ba(e,t,a){let s=L(e,t),n=(t.seizures||[]).filter(d=>d.at.startsWith(e)),o=e<m(),i=s.map(({med:d,time:p})=>{let f=H(e,d.id,p,t),g=f!=="pending"?un[f]:o?"Not logged \u2014 counts as missed":ve("pending",p);return Fa(e,d,p,f,g)}).join(""),l=h`
    <div class="stack stack-4">
      ${r(n.length?`
        <div class="insight" data-tone="alert">
          <span class="insight-ico" aria-hidden="true">${c("bolt",20)}</span>
          <span class="insight-body">
            <span class="insight-t">${M(n.length,"seizure")} logged this day</span>
          </span>
        </div>`:"")}
      ${r(s.length?`<div class="card card-flush"><ul class="rows">${i}</ul></div>`:'<p class="ink-3">No doses were scheduled on this day.</p>')}
      <p class="hint">
        Back-filling is fine — an honest record a day late beats a blank one.
      </p>
    </div>
  `;if(a){let d=P().querySelector(".sheet-body");d&&(d.innerHTML=l);return}I({title:q(e,{relative:!1}),body:l})}var $n={async"dose-cycle"(e){let{med:t,time:a,day:s}=e.dataset,n=H(s,t,a),o=!!e.closest("#sheet");await je(s,t,a,vn[n]),o&&(Ba(s,R(),!0),P().querySelector(`[data-action="dose-cycle"][data-med="${t}"][data-time="${a}"]`)?.focus())},"cal-day"(e,t){Ba(e.dataset.day,t,!1)},"med-open"(e,t){let a=e.dataset.id;bn(a?t.meds.find(s=>s.id===a):null)},"med-time-add"(){Te();let e=$.times[$.times.length-1]||"08:00",[t,a]=e.split(":").map(Number);$.times.push(`${String(((t||0)+12)%24).padStart(2,"0")}:${String(a||0).padStart(2,"0")}`),zt(`[data-time-index="${$.times.length-1}"]`)},"med-time-remove"(e){Te(),$.times.splice(Number(e.dataset.index),1),zt('[data-action="med-time-add"]')},"med-color"(e){Te(),$.color=e.dataset.value,zt(`[data-action="med-color"][data-value="${e.dataset.value}"]`)},async"med-save"(){if(Te(),!$.name.trim()){y("Give the medication a name","bad"),P().querySelector("#med-name")?.focus();return}let e=ce($.times);if(!e.length){y("Add at least one time","bad");return}let t={name:$.name,dose:$.dose,form:$.form,times:e,notes:$.notes,color:$.color},a=!!$.id;a?await da($.id,t):await ca(t),z(),y(a?"Medication updated":"Added \u2014 tracking starts today","ok")},"med-stop"(e,t){let a=e.dataset.id,s=t.meds.find(o=>o.id===a),n=s&&s.added>=m();_({title:n?"Remove this medication?":`Stop taking ${s?s.name:"this"}?`,message:n?"It was only added today, so there is no history to keep. It will be removed completely.":"It will stop appearing in today's doses and reminders. Every dose already logged stays in your history and statistics, and you can restart it later. Never stop an epilepsy medication without talking to your neurologist first.",confirmLabel:n?"Remove":"Stop taking",async onConfirm(){await ua(a),y(n?"Medication removed":"Stopped \u2014 history kept")}})},async"med-restart"(e,t){let a=t.meds.find(s=>s.id===e.dataset.id);a&&(await pa(a.id),y(`${a.name} restarted from today`,"ok"))}};var At={};ge(At,{actions:()=>Ln,logSeizure:()=>Nt,render:()=>Tn,subtitle:()=>Mn,title:()=>xn});var wn=["Focal aware","Focal impaired awareness","Tonic-clonic","Absence","Myoclonic","Atonic","Not sure"],kn=["Missed dose","Missed sleep","Stress","Illness or fever","Flashing lights","Skipped meal","Dehydration","Period","None known"],Sn=["Home","School \u2014 classroom","School \u2014 hallway","School \u2014 gym","School \u2014 cafeteria","Outside","In a car","Other"],_a=["","Calm","Fine","Busy","Stressed","Overwhelmed"],fe="log",b=null,O=null,Ya=e=>`${e} ${e===1?"entry":"entries"}`;function xn(){return"Seizures"}function Mn(e){let t=(e.seizures||[]).length;if(!t)return"Nothing logged yet";let{daysSince:a}=oe(e);return a===0?`${Ya(t)} \xB7 one today`:`${Ya(t)} \xB7 ${M(a,"day")} since the last`}function Tn(e){return h`
    <div class="subtabs" role="tablist" aria-label="Seizure views">
      <button class="subtab" role="tab" id="tab-log" aria-controls="panel-sz"
              data-action="sz-tab" data-tab="log" aria-selected="${fe==="log"}">
        ${r(c("note",18))} Log
      </button>
      <button class="subtab" role="tab" id="tab-patterns" aria-controls="panel-sz"
              data-action="sz-tab" data-tab="patterns" aria-selected="${fe==="patterns"}">
        ${r(c("sparkle",18))} Patterns
      </button>
    </div>
    <div id="panel-sz" role="tabpanel" aria-labelledby="tab-${fe}" class="stack stack-5">
      ${r(fe==="log"?Dn(e):Nn(e))}
    </div>
  `}function zn(e){let t=X(e.at),a=[];return e.duration&&a.push(`<span class="pill">${c("timer",13)} ${be(e.duration)}</span>`),e.trigger&&a.push(`<span class="pill pill-warn">${u(e.trigger)}</span>`),e.place&&a.push(`<span class="pill">${u(e.place)}</span>`),e.injury&&a.push('<span class="pill pill-bad">Injury</span>'),e.emsCalled&&a.push('<span class="pill pill-bad">911 called</span>'),`
    <li>
      <button class="log-entry" data-action="seizure-open" data-id="${e.id}">
        <span class="log-date" aria-hidden="true">
          <span class="log-mon">${Ge(t.getMonth())}</span>
          <span class="log-day">${t.getDate()}</span>
        </span>
        <span class="log-body">
          <span class="log-t">${u(e.type||"Seizure")}</span>
          <span class="row-s">${ta(e.at)} \xB7 ${aa(e.at)}</span>
          ${a.length?`<span class="log-meta">${a.join("")}</span>`:""}
          ${e.notes?`<span class="log-note">${u(e.notes)}</span>`:""}
        </span>
        <span class="chev">${c("chevron")}</span>
      </button>
    </li>`}function En(e){let t=[];for(let a of e){let s=X(a.at),n=`${s.getFullYear()}-${s.getMonth()}`,o=t[t.length-1];(!o||o.key!==n)&&(o={key:n,label:`${Ge(s.getMonth())} ${s.getFullYear()}`,items:[]},t.push(o)),o.items.push(a)}return t.map(a=>`
    <div class="month-group">
      <h3 class="eyebrow month-label">${a.label} \xB7 ${a.items.length}</h3>
      <div class="card card-flush"><ul class="rows">${a.items.map(zn).join("")}</ul></div>
    </div>`).join("")}function Cn(e){if(!e)return h`
      <button class="card card-tap" data-action="checkin-open">
        <span class="row">
          <span class="med-dot" data-color="blue" aria-hidden="true">${r(c("moon",20))}</span>
          <span class="row-body">
            <span class="row-t">Today's check-in</span>
            <span class="row-s">Sleep and stress, ten seconds. This is what the pattern finder compares seizures against.</span>
          </span>
          <span class="chev">${r(c("chevron"))}</span>
        </span>
      </button>
    `;let t=e.sleepHours==null?"\u2014":e.sleepHours,a=e.stress==null?"\u2014":e.stress;return h`
    <button class="card card-tap" data-action="checkin-open">
      <span class="row">
        <span class="med-dot" data-color="mint" aria-hidden="true">${r(c("check",20))}</span>
        <span class="row-body">
          <span class="row-t">Checked in today</span>
          <span class="row-s">${t} hours of sleep · stress ${a} of 5 · tap to change</span>
        </span>
        <span class="chev">${r(c("chevron"))}</span>
      </span>
    </button>
  `}function Dn(e){let t=e.seizures||[],a=ke(m(),e);return h`
    <button class="btn btn-primary btn-lg btn-block" data-action="seizure-open">
      ${r(c("plus",20))} Log a seizure
    </button>

    ${r(Cn(a))}

    ${r(t.length?`
      <section class="section" aria-labelledby="hist-h">
        <h2 id="hist-h">History</h2>
        ${En(t)}
      </section>`:`
      <div class="card">
        <div class="empty">
          <span class="empty-ico" aria-hidden="true">${c("note",32)}</span>
          <span class="empty-t">No seizures logged</span>
          <span class="empty-s">
            That's a good thing. When one happens, logging it here \u2014 even
            roughly \u2014 is what lets Synara spot patterns later.
          </span>
        </div>
      </div>`)}
  `}function Va(){return h`
    <div class="disclaimer">
      ${r(c("info",16))}
      <span><strong>About these patterns.</strong> ${ja}</span>
    </div>
  `}function Nn(e){let t=xt(e),a=oe(e),s=(e.seizures||[]).length,n=Object.keys(e.checkins||{}).length;if(!t.length){let i=[];return s<3&&i.push(`at least 3 seizures logged (you have ${s})`),n<13&&i.push(`about two weeks of daily check-ins (you have ${n})`),h`
      <div class="card">
        <div class="empty">
          <span class="empty-ico" aria-hidden="true">${r(c("sparkle",32))}</span>
          <span class="empty-t">Nothing to report yet</span>
          <span class="empty-s">
            Synara would rather show you nothing than a coincidence dressed up
            as a finding.${i.length?` Most patterns need ${i.join(" and ")}.`:" Nothing in your log clears the bar right now \u2014 which can be good news."}
          </span>
        </div>
      </div>
      ${r(Va())}
    `}let o=t.map(i=>`
    <li class="insight" data-tone="${i.tone}">
      <span class="insight-ico" aria-hidden="true">${c(i.icon,20)}</span>
      <span class="insight-body">
        <span class="insight-t">${u(i.title)}</span>
        <span class="insight-d">${u(i.detail)}</span>
        <span class="insight-e">${u(i.evidence)}</span>
      </span>
    </li>`).join("");return h`
    <div class="stats">
      <div class="stat">
        <span class="stat-n">${a.totalSeizures}</span>
        <span class="stat-l">Logged in total</span>
      </div>
      <div class="stat">
        <span class="stat-n">${a.seizuresLast30}</span>
        <span class="stat-l">In the last 30 days</span>
      </div>
      <div class="stat">
        <span class="stat-n stat-n-sm">${a.avgDurationLabel||"\u2014"}</span>
        <span class="stat-l">Average length</span>
      </div>
    </div>

    <section class="section" aria-labelledby="patterns-h">
      <h2 id="patterns-h">What your log shows</h2>
      <ul class="stack stack-3">${r(o)}</ul>
    </section>

    ${r(Va())}
  `}function Ct(e,t,a){let s=t.map(n=>`
    <button type="button" class="chip" data-action="sz-chip" data-field="${e}"
            data-value="${u(n)}" aria-pressed="${n===b[e]}">${u(n)}</button>`).join("");return`
    <div class="field">
      <span class="label" id="lbl-${e}">${a}</span>
      <div class="chips" role="group" aria-labelledby="lbl-${e}">${s}</div>
    </div>`}function Ga(){let e=Math.floor(b.duration/60),t=b.duration%60,a=m();return h`
    <form class="stack stack-5" data-action="seizure-save" novalidate>
      ${r(b.fromTimer?`
        <div class="insight" data-tone="good">
          <span class="insight-ico" aria-hidden="true">${c("timer",20)}</span>
          <span class="insight-body">
            <span class="insight-t">Timed at ${be(b.duration)}</span>
            <span class="insight-d">Start time and length came from the emergency timer. Everything else is optional.</span>
          </span>
        </div>`:"")}

      <div class="input-row">
        <div class="field grow">
          <label class="label" for="sz-date">Date</label>
          <input class="input" type="date" id="sz-date" name="date" value="${b.date}" max="${a}" required />
        </div>
        <div class="field grow">
          <label class="label" for="sz-time">Started at</label>
          <input class="input" type="time" id="sz-time" name="time" value="${b.time}" required />
        </div>
      </div>

      <div class="field">
        <span class="label" id="dur-label">How long did it last?</span>
        <div class="input-row duration-row" role="group" aria-labelledby="dur-label">
          <input class="input" type="number" inputmode="numeric" name="mins" min="0" max="120"
                 value="${e}" aria-label="Minutes" />
          <span class="unit">min</span>
          <input class="input" type="number" inputmode="numeric" name="secs" min="0" max="59"
                 value="${t}" aria-label="Seconds" />
          <span class="unit">sec</span>
        </div>
        <span class="hint">A guess is fine. Leave it at zero if nobody knows.</span>
      </div>

      ${r(Ct("type",wn,"Type"))}
      ${r(Ct("trigger",kn,"Possible trigger"))}
      ${r(Ct("place",Sn,"Where were you?"))}

      <div class="field">
        <label class="label" for="sz-aura">Warning signs beforehand</label>
        <input class="input" id="sz-aura" name="aura" value="${b.aura}"
               placeholder="Metallic taste, dizziness, déjà vu…" autocomplete="off" maxlength="300" />
      </div>

      <div class="card card-flush">
        <label class="toggle-row">
          <span class="row-body">
            <span class="row-t">Were you injured?</span>
            <span class="row-s">Even a bitten cheek counts</span>
          </span>
          <input type="checkbox" class="check" name="injury" ${r(b.injury?"checked":"")} />
        </label>
        <label class="toggle-row">
          <span class="row-body">
            <span class="row-t">Was 911 called?</span>
            <span class="row-s">Worth recording either way</span>
          </span>
          <input type="checkbox" class="check" name="emsCalled" ${r(b.emsCalled?"checked":"")} />
        </label>
      </div>

      <div class="field">
        <label class="label" for="sz-notes">Anything else</label>
        <textarea class="textarea" id="sz-notes" name="notes" maxlength="4000"
                  placeholder="What happened, who was there, how you felt afterwards…">${b.notes}</textarea>
      </div>
    </form>
  `}function Dt(){if(!b)return;let e=B();for(let t of["date","time","aura","notes","injury","emsCalled"])e[t]!==void 0&&(b[t]=e[t]);if(e.mins!==void 0||e.secs!==void 0){let t=Ce(Number(e.mins)||0,0,120),a=Ce(Number(e.secs)||0,0,59);b.duration=t*60+a}}function An(e){Dt();let t=P().querySelector(".sheet-body");if(!t)return;let a=t.scrollTop;t.innerHTML=Ga(),t.scrollTop=a,e&&P().querySelector(e)?.focus({preventScroll:!0})}function Ja(e,t={}){if(e){let[a,s]=e.at.split("T");b={...e,date:a,time:s,fromTimer:!1}}else{let a=t.at||`${m()}T${V()}`,[s,n]=a.split("T");b={id:null,date:s,time:n,duration:t.duration||0,type:"",trigger:"",place:"",aura:"",injury:!1,emsCalled:!1,notes:"",fromTimer:!!t.duration}}I({title:e?"Edit entry":"Log a seizure",body:Ga(),footer:`
      ${e?`<button class="btn btn-danger-soft" data-action="seizure-delete" data-id="${e.id}">Delete</button>`:""}
      <button class="btn btn-primary" data-action="seizure-save">Save</button>
    `,onClose(){b=null}})}function Nt(e){Ja(null,e)}function Ua(){let e=[1,2,3,4,5].map(t=>`
    <button type="button" class="segment" data-action="checkin-stress" data-value="${t}"
            aria-pressed="${O.stress===t}" aria-label="${t}, ${_a[t]}">${t}</button>`).join("");return h`
    <div class="stack stack-6">
      <div class="field">
        <span class="label" id="sleep-label">How many hours did you sleep last night?</span>
        <div class="stepper" role="group" aria-labelledby="sleep-label">
          <button type="button" class="stepper-btn" data-action="checkin-sleep" data-value="-0.5"
                  aria-label="Half an hour less">−</button>
          <span class="sleep-n" aria-live="polite">${O.sleepHours}<small>h</small></span>
          <button type="button" class="stepper-btn" data-action="checkin-sleep" data-value="0.5"
                  aria-label="Half an hour more">+</button>
        </div>
        <span class="hint text-center">
          Rough is fine. Short sleep is one of the most commonly reported
          seizure triggers, which is why it's asked first.
        </span>
      </div>

      <div class="field">
        <span class="label" id="stress-label">How stressed do you feel today?</span>
        <div class="segments" role="group" aria-labelledby="stress-label">${r(e)}</div>
        <span class="hint text-center">${_a[O.stress]||""}</span>
      </div>

      <div class="field">
        <label class="label" for="ci-notes">Anything worth noting</label>
        <textarea class="textarea" id="ci-notes" name="notes" maxlength="600"
                  placeholder="Sick, travelling, exams…">${O.notes}</textarea>
      </div>
    </div>
  `}function Ka(e){let t=B();t.notes!==void 0&&(O.notes=t.notes);let a=P().querySelector(".sheet-body");a&&(a.innerHTML=Ua()),e&&P().querySelector(e)?.focus({preventScroll:!0})}var Ln={"sz-tab"(e){fe=e.dataset.tab,it()},"open-patterns"(){fe="patterns",location.hash==="#/track"?it():location.hash="#/track"},"seizure-open"(e,t){let a=e.dataset.id;Ja(a?t.seizures.find(s=>s.id===a):null)},"sz-chip"(e){Dt();let{field:t,value:a}=e.dataset;b[t]=b[t]===a?"":a,An(`[data-action="sz-chip"][data-field="${t}"][data-value="${CSS.escape(a)}"]`)},async"seizure-save"(){Dt();let e=`${b.date}T${b.time}`;if(!b.date||!b.time||!le(e)){y("A date and start time are needed","bad");return}if(X(e).getTime()>Date.now()+6e4){y("That time is in the future","bad");return}let t={at:e,duration:b.duration,type:b.type,trigger:b.trigger,place:b.place,aura:b.aura,injury:!!b.injury,emsCalled:!!b.emsCalled,notes:b.notes},a=!!b.id;a?await ma(b.id,t):await ha(t),z(),y(a?"Entry updated":"Logged. Look after yourself today.","ok")},"seizure-delete"(e){let t=e.dataset.id;_({title:"Delete this entry?",message:"It will be removed from your history and from the pattern calculations. This can't be undone.",async onConfirm(){await fa(t),y("Entry deleted")}})},"checkin-open"(e,t){let a=m(),s=ke(a,t);O={sleepHours:s&&s.sleepHours!=null?s.sleepHours:8,stress:s&&s.stress!=null?s.stress:2,notes:s&&s.notes||""},I({title:`Check-in \xB7 ${q(a)}`,body:Ua(),footer:'<button class="btn btn-primary" data-action="checkin-save">Save check-in</button>',onClose(){O=null}})},"checkin-sleep"(e){let t=Number(e.dataset.value);O.sleepHours=Ce(Math.round((O.sleepHours+t)*2)/2,0,16),Ka(`[data-action="checkin-sleep"][data-value="${e.dataset.value}"]`)},"checkin-stress"(e){O.stress=Number(e.dataset.value),Ka(`[data-action="checkin-stress"][data-value="${e.dataset.value}"]`)},async"checkin-save"(){let e=B();e.notes!==void 0&&(O.notes=e.notes);let t=O.sleepHours;await ya(m(),{sleepHours:t,sleepQuality:t<6?"poor":t<7?"ok":"good",stress:O.stress,mood:O.stress>=4?"low":"ok",notes:(O.notes||"").trim()}),z(),y("Checked in","ok")}};var Ft={};ge(Ft,{actions:()=>Gn,render:()=>qn,showEmergency:()=>Ye,subtitle:()=>jn,title:()=>On});function On(){return"Safety card"}function jn(e){let t=(e.contacts||[]).length,a=`${t} ${t===1?"contact":"contacts"}`;return e.card.updated?`${a} \xB7 updated ${q(e.card.updated)}`:a}var Hn=e=>(e.name||"").trim().split(/\s+/)[0]||"";function qn(e){let{card:t,contacts:a,profile:s}=e,n=Hn(s),o=n?`If ${n} has a seizure`:"If a seizure happens";return h`
    <div class="safety-hero">
      <div class="safety-hero-ico" aria-hidden="true">${r(c("shield",26))}</div>
      <h2>${o}</h2>
      <p>
        Written for whoever is standing there — a teacher, a coach, a stranger.
        The SOS button at the top of every screen opens the big version, with
        a seizure timer.
      </p>
      <div class="safety-hero-actions">
        <button class="btn btn-on-danger" data-action="open-emergency">
          ${r(c("shield",18))} Open emergency card
        </button>
        <button class="btn btn-on-danger-ghost" data-action="print-card">
          ${r(c("print",18))} Print for school
        </button>
      </div>
    </div>

    ${r(In(e))}

    <div class="split-grid">
      <div class="split-main">
        ${r(Rn(a))}
        ${r(Bn(t))}
        ${r(Lt("What to do",t.during,"during","ok"))}
        ${r(Lt("What NOT to do",t.doNot,"doNot","bad"))}
        ${r(Fn(t))}
        ${r(Lt("Afterwards",t.after,"after",""))}
      </div>
      <div class="split-side">
        ${r(Wn(e))}
        ${r(Yn(t))}
      </div>
    </div>

    <div class="disclaimer">
      ${r(c("info",16))}
      <span>
        <strong>Check this with a doctor.</strong> The first-aid steps follow
        standard public seizure first aid, but every person's seizures are
        different. Confirm this card with your neurologist and school nurse
        before relying on it. Synara is a student project, not a medical device.
      </span>
    </div>
  `}function In(e){let t=[];if(e.contacts.length||t.push(["contact-open","","Add someone to call"]),e.profile.name||t.push(["profile-edit","","Add your name"]),e.card.looksLike||t.push(["card-edit","looksLike","Describe what your seizures look like"]),e.card.forTeacher||t.push(["card-edit","forTeacher","Add a note for teachers"]),!t.length)return"";let a=t.map(([s,n,o])=>`
    <li>
      <button class="todo-row" data-action="${s}"${n?` data-field="${n}"`:""}>
        <span class="todo-dot" aria-hidden="true"></span>
        <span class="grow">${o}</span>
        <span class="chev">${c("chevron",16)}</span>
      </button>
    </li>`).join("");return h`
    <section class="card todo-card" aria-labelledby="todo-h">
      <h2 id="todo-h" class="todo-h">${r(c("sparkle",18))} Finish your card</h2>
      <p class="t-sm ink-2">
        ${t.length===1?"One thing":`${t.length} things`} would make this
        card much more useful to whoever has to use it.
      </p>
      <ul class="todo-list">${r(a)}</ul>
    </section>
  `}function Pn(e){return`
    <li class="contact-row">
      <button class="contact-main" data-action="contact-open" data-id="${e.id}"
              aria-label="Edit ${u(e.name)}">
        <span class="avatar" aria-hidden="true">${u(De(e.name))}</span>
        <span class="contact-body">
          <span class="contact-n">${u(e.name)}</span>
          <span class="contact-r">${e.primary?'<span class="pill pill-brand">First call</span>':""}<span class="truncate">${u(e.relation)}${e.relation?" \xB7 ":""}${u(e.phone)}</span></span>
        </span>
      </button>
      ${Za(e)}
    </li>`}function Za(e){return Ue(e.phone)?`<a class="call-btn" href="${Je(e.phone)}" aria-label="Call ${u(e.name)}">${c("phone",16)} Call</a>`:'<span class="pill pill-warn">No number</span>'}function Rn(e){let t=e.length?`<ul class="rows">${e.map(Pn).join("")}</ul>`:`<div class="empty empty-sm">
         <span class="empty-t">No one to call yet</span>
         <span class="empty-s">The emergency card's biggest button calls whoever you put first.</span>
         <button class="btn btn-sm btn-primary" data-action="contact-open">${c("plus",16)} Add a contact</button>
       </div>`;return h`
    <section class="section" aria-labelledby="contacts-h">
      <div class="section-head">
        <h2 id="contacts-h">Who to call</h2>
        ${r(e.length?`<button class="btn btn-sm btn-soft" data-action="contact-open">${c("plus",16)} Add</button>`:"")}
      </div>
      <div class="card card-flush">${r(t)}</div>
    </section>
  `}function _e(e,t){return`<button class="btn btn-sm btn-quiet" data-action="card-edit" data-field="${e}"
                  aria-label="Edit ${u(t)}">${c("edit",15)} Edit</button>`}function Bn(e){let t=e.looksLike?`<p class="prose">${u(e.looksLike)}</p>`:`<p class="ink-3">Describe what happens, so somebody who has never seen one knows what they're looking at.</p>`;return h`
    <section class="section" aria-labelledby="looks-h">
      <div class="section-head">
        <h2 id="looks-h">What it looks like</h2>
        ${r(_e("looksLike","what it looks like"))}
      </div>
      <div class="card">${r(t)}</div>
    </section>
  `}function Pt(e,t){return`<ol class="steps">${e.map((a,s)=>`
    <li class="step" data-tone="${t}">
      <span class="step-n" aria-hidden="true">${t==="bad"?"\u2715":t==="ems"?"!":s+1}</span>
      <span>${u(a)}</span>
    </li>`).join("")}</ol>`}function Lt(e,t,a,s){let n=`sec-${a}`,o=t&&t.length?Pt(t,s):'<p class="ink-3">Nothing added yet.</p>';return h`
    <section class="section" aria-labelledby="${n}">
      <div class="section-head">
        <h2 id="${n}">${e}</h2>
        ${r(_e(a,e))}
      </div>
      <div class="card">${r(o)}</div>
    </section>
  `}function Fn(e){let t=e.callEms||[];return h`
    <section class="section" aria-labelledby="sec-ems">
      <div class="section-head">
        <h2 id="sec-ems">Call 911 if…</h2>
        ${r(_e("callEms","when to call 911"))}
      </div>
      <div class="card ems-card">${r(t.length?Pt(t,"ems"):'<p class="ink-3">Nothing added yet.</p>')}</div>
    </section>
  `}function Wn(e){let{profile:t}=e,a=W(e),s=[["Seizure type",t.seizureType],["Allergies",t.allergies],["Blood type",t.bloodType],["Neurologist",[t.neurologist,t.neuroPhone].filter(Boolean).join(" \xB7 ")]].filter(([,i])=>i),n=a.length?a.map(i=>`${u(i.name)}${i.dose?` ${u(i.dose)}`:""}`).join(", "):'<span class="ink-faint">None added</span>',o=s.map(([i,l])=>`<div class="kv-row"><dt class="kv-k">${i}</dt><dd class="kv-v">${u(l)}</dd></div>`).join("");return h`
    <section class="section" aria-labelledby="medical-h">
      <div class="section-head">
        <h2 id="medical-h">Medical details</h2>
        <button class="btn btn-sm btn-quiet" data-action="profile-edit">${r(c("edit",15))} Edit</button>
      </div>
      <div class="card card-flush">
        <dl class="kv">
          ${r(o)}
          <div class="kv-row"><dt class="kv-k">Current meds</dt><dd class="kv-v">${r(n)}</dd></div>
        </dl>
      </div>
      <p class="hint">Shown on the emergency card and the printed copy — it's what paramedics ask for.</p>
    </section>
  `}var _n=[{field:"forTeacher",label:"For teachers",icon:"school"},{field:"forNurse",label:"For the school nurse",icon:"stethoscope"},{field:"forCoach",label:"For coaches and PE",icon:"run"}];function Yn(e){let t=_n.map(a=>`
    <div class="card role-card">
      <div class="card-head">
        <h3>${c(a.icon,18)} ${a.label}</h3>
        ${_e(a.field,a.label)}
      </div>
      ${e[a.field]?`<p class="prose">${u(e[a.field])}</p>`:`<p class="ink-3 t-sm">Nothing added yet \u2014 what should this person know that isn't in the steps?</p>`}
    </div>`).join("");return h`
    <section class="section" aria-labelledby="roles-h">
      <h2 id="roles-h">Specific instructions</h2>
      <div class="stack stack-3">${r(t)}</div>
    </section>
  `}var qt="synara.timer",Xa=300,We=null,J=null,ye=null;function Rt(){try{let e=JSON.parse(sessionStorage.getItem(qt)||"null");if(e&&typeof e.ms=="number"&&Date.now()-e.ms<10800*1e3)return e}catch{}return null}function Ot(e){try{e?sessionStorage.setItem(qt,JSON.stringify(e)):sessionStorage.removeItem(qt)}catch{}}var jt=e=>`${Math.floor(e/60)}:${String(e%60).padStart(2,"0")}`;function es(){return`
    <section class="em-timer" data-state="idle" aria-labelledby="em-timer-h">
      <div class="em-timer-top">
        <h3 id="em-timer-h" class="em-timer-h">${c("timer",18)} Seizure timer</h3>
        <span class="em-timer-hint" data-timer-hint>Start it the moment the seizure begins</span>
      </div>
      <div class="em-timer-clock" data-timer-clock aria-hidden="true">0:00</div>
      <div class="sr-only" aria-live="assertive" data-timer-live></div>
      <div class="em-timer-actions" data-timer-actions>
        <button class="btn btn-lg btn-primary btn-block" data-action="timer-start" data-autofocus>
          ${c("play",20)} Start timer
        </button>
      </div>
    </section>`}function Bt(e,t,a){let s=e.querySelector(".em-timer");if(!s)return;let n=s.querySelector("[data-timer-clock]"),o=s.querySelector("[data-timer-hint]"),i=s.querySelector("[data-timer-actions]"),l=s.dataset.state!==t;if(s.dataset.state=t,n.textContent=jt(a),t==="running"||t==="over"){let d=t==="over";o.textContent=d?"Over 5 minutes \u2014 call 911 now":`Call 911 if it reaches 5:00 \xB7 ${jt(Math.max(0,Xa-a))} to go`,l&&(i.innerHTML=`
        ${d?`<a class="btn btn-lg btn-block btn-emergency" href="tel:911">${c("phone",20)} Call 911 now</a>`:""}
        <button class="btn btn-lg btn-block ${d?"btn-on-danger-ghost":"btn-outline"}" data-action="timer-stop">
          ${c("stop",18)} It stopped
        </button>`)}else t==="stopped"&&(o.textContent=`It lasted ${jt(a)}`,i.innerHTML=`
      <button class="btn btn-lg btn-block btn-primary" data-action="timer-log">${c("note",18)} Log this seizure</button>
      <button class="btn btn-block btn-quiet" data-action="timer-reset">Reset timer</button>`)}function ts(e){clearInterval(We);let t=e.querySelector("[data-timer-live]"),a=-1,s=!1,n=()=>{let o=Rt();if(!o)return;let i=Math.max(0,Math.floor((Date.now()-o.ms)/1e3)),l=i>=Xa;Bt(e,l?"over":"running",i);let d=Math.floor(i/60);t&&d!==a&&d>0&&(t.textContent=l&&!s?"Five minutes. Call 911 now.":`${d} ${d===1?"minute":"minutes"}`,l&&(s=!0)),a=d};n(),We=setInterval(n,1e3)}function It(){clearInterval(We),We=null}function re(e,t,a=""){return`
    <section class="em-block"${a?` data-tone="${a}"`:""}>
      <h3>${e}</h3>
      ${t}
    </section>`}function Ye(e){let{card:t,contacts:a,profile:s}=e,n=a.filter(x=>Ue(x.phone)),o=n.find(x=>x.primary)||n[0],i=a.filter(x=>x!==o),l=W(e),d=s.name||"This student",p=[s.grade,s.school].filter(Boolean).join(" \xB7 "),f=o?`
    <a class="em-call" href="${Je(o.phone)}">
      <span class="em-call-ico" aria-hidden="true">${c("phone",22)}</span>
      <span class="em-call-body">
        <span class="em-call-n">Call ${u(o.name)}</span>
        <span class="em-call-r">${u(o.relation)}${o.relation?" \xB7 ":""}${u(o.phone)}</span>
      </span>
    </a>`:"",g=i.length?re("Other contacts",`
    <ul class="rows">${i.map(x=>`
      <li class="contact-row contact-row-flat">
        <span class="contact-body">
          <span class="contact-n">${u(x.name)}</span>
          <span class="contact-r"><span class="truncate">${u(x.relation)}</span></span>
        </span>
        ${Za(x)}
      </li>`).join("")}</ul>`):"",E=[s.seizureType&&`<div class="kv-row"><dt class="kv-k">Seizure type</dt><dd class="kv-v">${u(s.seizureType)}</dd></div>`,s.allergies&&`<div class="kv-row"><dt class="kv-k">Allergies</dt><dd class="kv-v">${u(s.allergies)}</dd></div>`,l.length&&`<div class="kv-row"><dt class="kv-k">Medications</dt><dd class="kv-v">${l.map(x=>`${u(x.name)} ${u(x.dose)}`).join(", ")}</dd></div>`,s.neurologist&&`<div class="kv-row"><dt class="kv-k">Neurologist</dt><dd class="kv-v">${u(s.neurologist)}${s.neuroPhone?` \xB7 ${u(s.neuroPhone)}`:""}</dd></div>`].filter(Boolean).join(""),C=(x,cs)=>x&&x.length?Pt(x,cs):"",w=h`
    <div class="em-bar">
      <span class="em-bar-t">${r(c("shield",20))} Seizure — what to do</span>
      <button class="em-close" data-action="close-emergency">Close</button>
    </div>

    <div class="em-body">
      <div class="em-inner">
        <header class="em-who">
          <h2 class="em-name">${d}</h2>
          ${r(p?`<span class="em-sub">${u(p)}</span>`:"")}
        </header>

        ${r(es())}

        <div class="em-calls">
          ${r(f)}
          <a class="em-911" href="tel:911">${r(c("phone",22))} Call 911</a>
        </div>

        ${r(t.during&&t.during.length?re("What to do right now",C(t.during,"ok")):"")}
        ${r(t.callEms&&t.callEms.length?re("Call 911 if",C(t.callEms,"ems"),"bad"):"")}
        ${r(t.doNot&&t.doNot.length?re("Do NOT",C(t.doNot,"bad")):"")}
        ${r(t.looksLike?re("What their seizures look like",`<p class="prose">${u(t.looksLike)}</p>`):"")}
        ${r(t.after&&t.after.length?re("Afterwards",C(t.after,"")):"")}
        ${r(E?re("Medical details",`<dl class="kv kv-flat">${E}</dl>`):"")}
        ${r(g)}

        <p class="em-foot">Standard seizure first aid. If in doubt, call 911.</p>
      </div>
    </div>
  `;Ca(w,{onMount(x){Rt()?(ts(x),x.querySelector('[data-action="timer-stop"]')?.focus({preventScroll:!0})):J!=null&&Bt(x,"stopped",J)},onClose:It})}function Vn(e){let{card:t,contacts:a,profile:s}=e,n=W(e),o=(d,p="")=>d&&d.length?`<ol class="${p}">${d.map(f=>`<li>${u(f)}</li>`).join("")}</ol>`:"",i=[["Grade / school",[s.grade,s.school].filter(Boolean).join(", ")],["Seizure type",s.seizureType],["Allergies",s.allergies],["Medications",n.map(d=>`${d.name} ${d.dose} (${G(d).map(j).join(", ")})`).join("; ")],["Neurologist",[s.neurologist,s.neuroPhone].filter(Boolean).join(" \u2014 ")]].filter(([,d])=>d),l=[["forTeacher","Teachers"],["forNurse","School nurse"],["forCoach","Coaches and PE"]].filter(([d])=>t[d]);return`
    <article class="pc">
      <header class="pc-head">
        <div>
          <p class="pc-kicker">Seizure action card</p>
          <h1 class="pc-name">${u(s.name||"Student name")}</h1>
        </div>
        <div class="pc-911">In an emergency<strong>Call 911</strong></div>
      </header>

      ${i.length?`<dl class="pc-facts">${i.map(([d,p])=>`<div><dt>${d}</dt><dd>${u(p)}</dd></div>`).join("")}</dl>`:""}

      ${t.looksLike?`<section><h2>What their seizures look like</h2><p>${u(t.looksLike)}</p></section>`:""}

      <div class="pc-cols">
        <section><h2>What to do</h2>${o(t.during)}</section>
        <section><h2>Do NOT</h2>${o(t.doNot,"pc-not")}</section>
      </div>

      <section class="pc-ems"><h2>Call 911 if</h2>${o(t.callEms)}</section>

      <div class="pc-cols">
        <section><h2>Afterwards</h2>${o(t.after)}</section>
        <section>
          <h2>Who to call</h2>
          ${a.length?`<table class="pc-contacts"><tbody>${a.map(d=>`
            <tr><td><strong>${u(d.name)}</strong>${d.primary?" (call first)":""}<br>${u(d.relation)}</td><td>${u(d.phone)}</td></tr>`).join("")}
          </tbody></table>`:"<p>No contacts added.</p>"}
        </section>
      </div>

      ${l.length?`<section class="pc-roles">${l.map(([d,p])=>`<div><h3>${p}</h3><p>${u(t[d])}</p></div>`).join("")}</section>`:""}

      <footer class="pc-foot">
        Printed ${q(m(),{relative:!1})}${t.updated?` \xB7 card last updated ${q(t.updated,{relative:!1})}`:""}.
        Standard seizure first aid \u2014 confirm with the student's neurologist. Made with Synara.
      </footer>
    </article>`}var Qa=new Set(["during","doNot","after","callEms"]),Ht={looksLike:"What their seizures look like",during:"What to do",doNot:"What NOT to do",after:"Afterwards",callEms:"Call 911 if\u2026",forTeacher:"For teachers",forNurse:"For the school nurse",forCoach:"For coaches and PE"},Kn={looksLike:"Plain words beat medical terms \u2014 a substitute teacher has to recognise this.",forTeacher:"What should happen in class? Who do they send for? Anything in a 504 plan?",forNurse:"Rescue medication, who to call first, where they like to recover.",forCoach:"Activity limits, water rules, whether they can return to play the same day."},Gn={"card-edit"(e,t){let a=e.dataset.field;if(!Ht[a])return;let s=Qa.has(a),n=t.card[a],o=s?(n||[]).join(`
`):n||"";I({title:Ht[a],body:h`
        <div class="field">
          <label class="label" for="card-text">
            ${s?"One step per line":"Write it the way you would say it out loud"}
          </label>
          <textarea class="textarea textarea-tall" id="card-text" name="text" maxlength="4000">${o}</textarea>
          <span class="hint">
            ${s?"Each line becomes a numbered step on the card.":Kn[a]||""}
          </span>
        </div>
      `,footer:`<button class="btn btn-primary" data-action="card-save" data-field="${a}">Save</button>`})},async"card-save"(e){let t=e.dataset.field;if(!Ht[t])return;let a=B().text||"",s=Qa.has(t)?a.split(`
`).map(n=>n.replace(/^\s*(\d+[.)]|[-*•])\s*/,"").trim()).filter(Boolean):a.trim();await $a({[t]:s}),z(),y("Safety card updated","ok")},"contact-open"(e,t){let a=e.dataset.id,s=a?t.contacts.find(i=>i.id===a):null,n=s||{name:"",relation:"",phone:"",primary:!t.contacts.length},o=s?` data-id="${s.id}"`:"";I({title:s?"Edit contact":"Add contact",body:h`
        <form class="stack stack-5" data-action="contact-save"${r(o)} novalidate>
          <div class="field">
            <label class="label" for="c-name">Name</label>
            <input class="input" id="c-name" name="name" value="${n.name}"
                   placeholder="Dana Ellison" autocomplete="off" maxlength="120" required />
          </div>
          <div class="field">
            <label class="label" for="c-rel">Relationship</label>
            <input class="input" id="c-rel" name="relation" value="${n.relation}"
                   placeholder="Mom, school nurse, coach…" autocomplete="off" maxlength="80" />
          </div>
          <div class="field">
            <label class="label" for="c-phone">Phone</label>
            <input class="input" id="c-phone" name="phone" type="tel" inputmode="tel" value="${n.phone}"
                   placeholder="(555) 014-2007" autocomplete="off" maxlength="40" required />
          </div>
          <div class="card card-flush">
            <label class="toggle-row">
              <span class="row-body">
                <span class="row-t">Call this person first</span>
                <span class="row-s">They become the big green button on the emergency card</span>
              </span>
              <input type="checkbox" class="check" name="primary" ${r(n.primary?"checked":"")} />
            </label>
          </div>
        </form>
      `,footer:`
        ${s?`<button class="btn btn-danger-soft" data-action="contact-delete" data-id="${s.id}">Delete</button>`:""}
        <button class="btn btn-primary" data-action="contact-save"${o}>Save</button>
      `})},async"contact-save"(e){let t=e.dataset.id||null,a=B();if(!a.name||!a.name.trim()){y("A name is needed","bad");return}if((String(a.phone||"").match(/\d/g)||[]).length<3){y("That phone number doesn't look complete","bad");return}let s={name:a.name,relation:a.relation||"",phone:a.phone,primary:!!a.primary};t?await ba(t,s):await ga(s),z(),y(t?"Contact updated":"Contact added","ok")},"contact-delete"(e){let t=e.dataset.id;_({title:"Delete this contact?",message:"They will be removed from the safety card, the emergency screen, and the printed card.",async onConfirm(){await va(t),y("Contact deleted")}})},"timer-start"(){J=null,ye=Z(),Ot({ms:Date.now(),at:ye}),ts(ae()),ae().querySelector('[data-action="timer-stop"]')?.focus({preventScroll:!0})},"timer-stop"(){let e=Rt();It(),e&&(J=Math.max(1,Math.floor((Date.now()-e.ms)/1e3)),ye=e.at,Ot(null),Bt(ae(),"stopped",J),ae().querySelector('[data-action="timer-log"]')?.focus({preventScroll:!0}))},"timer-reset"(){J=null,ye=null,Ot(null),It();let e=ae().querySelector(".em-timer");e&&(e.outerHTML=es()),ae().querySelector('[data-action="timer-start"]')?.focus({preventScroll:!0})},"timer-log"(){let e=J||0,t=ye||`${m()}T${V()}`;J=null,ye=null,me(),Nt({at:t,duration:e})},"print-card"(e,t){let a=document.getElementById("print-card");if(!a)return;let s=navigator.userAgent,n=/iPad|iPhone|iPod/.test(s)||/Macintosh/.test(s)&&navigator.maxTouchPoints>1,o=window.navigator.standalone===!0||window.matchMedia("(display-mode: standalone)").matches;if(n&&o){y("To print, open this page in Safari. Home-screen apps can\u2019t print on iPhone or iPad.","bad");return}a.innerHTML=Vn(t),window.print()}};var Wt={};ge(Wt,{actions:()=>io,render:()=>Qn,subtitle:()=>Un,title:()=>Jn});function Jn(){return"You"}function Un(e){return e.profile.school||"Your details and settings"}var as=[["name","Name","Maya Ellison"],["pronouns","Pronouns","she/her"],["grade","Grade","11th grade"],["school","School","Rosewood High School"],["seizureType","Seizure type","Focal impaired awareness"],["diagnosed","Diagnosed","2022"],["neurologist","Neurologist","Dr. Raghavan"],["neuroPhone","Neurologist phone","(555) 010-4488"],["allergies","Allergies","Penicillin"],["bloodType","Blood type","O+"]];function Qn(e){return h`
    <div class="split-grid">
      <div class="split-main">
        ${r(Zn(e))}
        ${r(Xn(e))}
      </div>
      <div class="split-side">
        ${r(to(e))}
        ${r(so(e))}
        ${r(no(e))}
        ${r(oo())}
      </div>
    </div>
  `}function Zn(e){let{profile:t}=e,a=oe(e),s=[t.pronouns,t.grade].filter(Boolean).join(" \xB7 "),n=De(t.name);return h`
    <div class="card card-flush">
      <div class="profile-head">
        <span class="avatar avatar-lg" aria-hidden="true">${n||r(c("user",26))}</span>
        <span class="row-body">
          <span class="profile-n">${t.name||"Add your name"}</span>
          <span class="profile-s">${s||"Tap edit to fill in your details"}</span>
        </span>
        <button class="icon-btn" data-action="profile-edit" aria-label="Edit your details">
          ${r(c("edit"))}
        </button>
      </div>
      <div class="stats stats-inset">
        <div class="stat">
          <span class="stat-n">${a.adherence==null?"\u2014":`${a.adherence}%`}</span>
          <span class="stat-l">Doses on time</span>
        </div>
        <div class="stat">
          <span class="stat-n">${a.totalSeizures}</span>
          <span class="stat-l">Seizures logged</span>
        </div>
        <div class="stat">
          <span class="stat-n">${a.streak}</span>
          <span class="stat-l">Day streak</span>
        </div>
      </div>
    </div>
  `}function Xn(e){let{profile:t}=e,a=as.map(([s,n])=>`
    <div class="kv-row">
      <dt class="kv-k">${n}</dt>
      <dd class="kv-v">${t[s]?u(t[s]):'<span class="ink-faint">\u2014</span>'}</dd>
    </div>`).join("");return h`
    <section class="section" aria-labelledby="care-h">
      <div class="section-head">
        <h2 id="care-h">Care details</h2>
        <button class="btn btn-sm btn-quiet" data-action="profile-edit">${r(c("edit",15))} Edit</button>
      </div>
      <div class="card card-flush"><dl class="kv">${r(a)}</dl></div>
      <p class="hint">
        These appear on the emergency card and the printed card, so whoever
        helps you has them without having to ask.
      </p>
    </section>
  `}var eo=[[0,"On time"],[10,"10 min early"],[15,"15 min early"],[30,"30 min early"]];function to(e){let{remindersOn:t,reminderLead:a}=e.settings,s=wt(),n=Fe(),o=!s.ok||n==="denied",i=t&&!o,l=s.ok?n==="denied"?"Notifications are blocked for this site in your browser settings.":i?"On \u2014 while Synara is open in a tab or installed.":"A nudge at each dose time.":s.reason,d=eo.map(([p,f])=>`
    <button class="segment" data-action="reminder-lead" data-value="${p}"
            aria-pressed="${p===a}">${f}</button>`).join("");return h`
    <section class="section" aria-labelledby="rem-h">
      <h2 id="rem-h">Reminders</h2>
      <div class="card card-flush">
        <div class="list-row list-row-static">
          <span class="med-dot" data-color="amber" aria-hidden="true">${r(c("bell",20))}</span>
          <span class="row-body">
            <span class="row-t" id="rem-label">Dose reminders</span>
            <span class="row-s">${l}</span>
          </span>
          <button class="switch" data-action="reminders-toggle" role="switch"
                  aria-checked="${i}" aria-labelledby="rem-label"
                  ${r(o?"disabled":"")}></button>
        </div>
        ${r(i?`
          <div class="list-row list-row-static list-row-stack">
            <span class="row-t">When to remind you</span>
            <div class="segments segments-wrap" role="group" aria-label="Reminder timing">${d}</div>
          </div>
          <button class="list-row" data-action="reminders-test">
            <span class="row-body">
              <span class="row-t">Send a test notification</span>
              <span class="row-s">Check it actually comes through on this device</span>
            </span>
            <span class="chev">${c("chevron")}</span>
          </button>`:"")}
      </div>
      <div class="disclaimer">
        ${r(c("alert",16))}
        <span>
          <strong>Keep a phone alarm as your real backup.</strong> A website can only
          remind you while it's running. Close the browser or restart the phone and
          the reminder is gone. Dependable reminders need a native app — the strongest
          reason to build Synara's next version in React Native.
        </span>
      </div>
    </section>
  `}var ao=[["system","Match device"],["light","Light"],["dark","Dark"]];function so(e){let t=e.settings.theme||"system",a=ao.map(([s,n])=>`
    <button class="segment" data-action="theme-set" data-theme="${s}"
            aria-pressed="${s===t}">${n}</button>`).join("");return h`
    <section class="section" aria-labelledby="look-h">
      <h2 id="look-h">Appearance</h2>
      <div class="card">
        <div class="segments" role="group" aria-label="Theme">${r(a)}</div>
        <p class="hint mt-3">
          Dark mode is here for a reason: this app gets opened at 3am to log a
          seizure that just woke you. Nothing in Synara ever flashes or strobes.
        </p>
      </div>
    </section>
  `}function no(e){let t=(e.seizures||[]).length,a=Object.keys(e.doses||{}).length,s=Object.keys(e.checkins||{}).length;return h`
    <section class="section" aria-labelledby="data-h">
      <h2 id="data-h">Your data</h2>
      <div class="card card-flush">
        <ul class="rows">
          <li class="list-row list-row-static">
            <span class="med-dot" data-color="mint" aria-hidden="true">${r(c("lock",20))}</span>
            <span class="row-body">
              <span class="row-t">Stored on this device only</span>
              <span class="row-s">${M(a,"day")} of doses · ${M(t,"seizure")} · ${M(s,"check-in")}</span>
            </span>
          </li>
          <li>
            <button class="list-row" data-action="data-export">
              <span class="med-dot" data-color="violet" aria-hidden="true">${r(c("down",20))}</span>
              <span class="row-body">
                <span class="row-t">Download a backup</span>
                <span class="row-s">Everything in one file — keep it, or give it to your doctor</span>
              </span>
              <span class="chev">${r(c("chevron"))}</span>
            </button>
          </li>
          <li>
            <label class="list-row file-row">
              <span class="med-dot" data-color="blue" aria-hidden="true">${r(c("up",20))}</span>
              <span class="row-body">
                <span class="row-t">Restore from a backup</span>
                <span class="row-s">Moving to a new phone? Load the file here</span>
              </span>
              <span class="chev">${r(c("chevron"))}</span>
              <input type="file" accept="application/json,.json" class="sr-only" data-change="data-import" />
            </label>
          </li>
          <li>
            <button class="list-row" data-action="data-demo">
              <span class="med-dot" data-color="amber" aria-hidden="true">${r(c("sparkle",20))}</span>
              <span class="row-body">
                <span class="row-t">Load example data</span>
                <span class="row-s">Replaces everything with a demo record, to show someone the app</span>
              </span>
              <span class="chev">${r(c("chevron"))}</span>
            </button>
          </li>
          <li>
            <button class="list-row" data-action="data-wipe">
              <span class="med-dot" data-color="rose" aria-hidden="true">${r(c("trash",20))}</span>
              <span class="row-body">
                <span class="row-t text-bad">Delete everything</span>
                <span class="row-s">Removes all of your data from this device</span>
              </span>
              <span class="chev">${r(c("chevron"))}</span>
            </button>
          </li>
        </ul>
      </div>
      <div class="disclaimer">
        ${r(c("info",16))}
        <span>
          <strong>Nothing leaves this device.</strong> No account, no server, no
          analytics. That also means clearing your browser's data deletes it, and it
          won't follow you to a new phone on its own — download a backup now and then.
          Cloud sync is deliberately not built yet: once health data syncs to a server
          or a parent's phone, HIPAA, COPPA, and school-district rules all apply, and
          that conversation comes before the code.
        </span>
      </div>
    </section>
  `}function oo(){return h`
    <section class="section" aria-labelledby="about-h">
      <h2 id="about-h">About</h2>
      <div class="card">
        <p class="prose">
          <strong>Synara</strong> puts medication reminders, seizure tracking, and an
          emergency card in one place, built around school life rather than a clinic.
        </p>
        <hr class="hr" />
        <p class="t-sm ink-3 prose">
          Version 2.2 · a student project, not a medical device. Nothing here is
          medical advice — always confirm your care plan with your neurologist.
        </p>
        <hr class="hr" />
        <div class="about-flux">
          ${r(xe())}
          <span class="t-sm ink-3">Built and hosted by Flux, the free planner for school.</span>
        </div>
      </div>
    </section>
  `}function ro(e){let t=Array.isArray(e.meds)?e.meds.length:0,a=Array.isArray(e.seizures)?e.seizures.length:0,s=e.doses&&typeof e.doses=="object"?Object.keys(e.doses).length:0,n=e.profile&&typeof e.profile.name=="string"&&e.profile.name.trim();return`${n?`${n.slice(0,80)}'s record: `:""}${M(t,"medication")}, ${M(s,"day")} of doses, ${M(a,"seizure")}.`}var io={"profile-edit"(e,t){let a=t.profile,s=as.map(([n,o,i])=>`
      <div class="field">
        <label class="label" for="p-${n}">${o}</label>
        <input class="input" id="p-${n}" name="${n}" value="${u(a[n]||"")}"
               placeholder="${u(i)}" autocomplete="off" maxlength="200" />
      </div>`).join("");I({title:"Your details",body:h`<form class="stack stack-4" data-action="profile-save" novalidate>${r(s)}</form>`,footer:'<button class="btn btn-primary" data-action="profile-save">Save</button>'})},async"profile-save"(){await wa(B()),z(),y("Details saved","ok")},async"reminders-toggle"(e,t){let a=!t.settings.remindersOn;if(a){let s=wt();if(!s.ok){y(s.reason,"bad");return}if(await Na()!=="granted"){y("Notifications weren't allowed","bad");return}}await qe({remindersOn:a}),y(a?"Reminders on":"Reminders off",a?"ok":"default")},async"reminder-lead"(e){await qe({reminderLead:Number(e.dataset.value)||0})},"reminders-test"(){let e=La();y(e?"Test sent \u2014 check your notifications":"Couldn't send a test",e?"ok":"bad")},async"theme-set"(e){await qe({theme:e.dataset.theme})},"data-export"(e,t){let a=new Blob([ka()],{type:"application/json"}),s=URL.createObjectURL(a),n=document.createElement("a"),o=(t.profile.name||"backup").replace(/[^\w-]+/g,"-").toLowerCase();n.href=s,n.download=`synara-${o}-${m()}.json`,document.body.appendChild(n),n.click(),n.remove(),setTimeout(()=>URL.revokeObjectURL(s),1e3),y("Backup downloaded","ok")},async"data-import"(e){let t=e.files&&e.files[0];if(e.value="",!t)return;if(t.size>5*1024*1024){y("That file is too large to be a Synara backup","bad");return}let a=await t.text(),s;try{s=JSON.parse(a)}catch{y("That file isn't a Synara backup","bad");return}_({title:"Replace everything with this backup?",message:`${ro(s)} Everything currently on this device will be replaced. Download a backup of what's here first if you might need it.`,confirmLabel:"Restore backup",danger:!1,async onConfirm(){try{await Sa(a),y("Backup restored","ok")}catch(n){y(n.message==="not-synara"?"That file isn't a Synara backup":"Couldn't read that backup","bad")}}})},"data-demo"(){_({title:"Load example data?",message:"Everything on this device will be replaced with a made-up student's record. Download a backup first if any of what's here is real.",confirmLabel:"Load example data",async onConfirm(){await $e({seedFn:Ie}),y("Example data loaded","ok")}})},"data-wipe"(){_({title:"Delete everything?",message:"Every medication, dose, seizure, check-in, contact, and your safety card will be removed from this device. This can't be undone.",confirmLabel:"Delete everything",async onConfirm(){await la();try{sessionStorage.removeItem("synara.timer")}catch{}history.replaceState(null,"",location.pathname),location.reload()}})}};var Yt={home:Tt,meds:Et,track:At,safety:Ft,you:Wt},Vt=["home","meds","track","safety","you"],Kt={home:{label:"Home",icon:"home"},meds:{label:"Meds",icon:"pill"},track:{label:"Seizures",icon:"chart"},safety:{label:"Safety",icon:"shield"},you:{label:"You",icon:"user"}},ss={sos:"safety"},Y="home",F={shell:document.querySelector(".app-shell"),appbar:document.getElementById("appbar"),screen:document.getElementById("screen"),tabbar:document.getElementById("tabbar")},lo=document.documentElement.dataset.host==="flux",Ve=document.querySelector("[data-flux-hub]");function rs(){let e=(location.hash||"").replace(/^#\/?/,"").split(/[/?]/)[0];return ss[e]?{route:ss[e],sos:e==="sos"}:{route:Vt.includes(e)?e:"home",sos:!1}}function ns(e){Vt.includes(e)&&location.hash!==`#/${e}`&&(location.hash=`#/${e}`)}function is(e){let t=document.documentElement;e==="light"||e==="dark"?t.setAttribute("data-theme",e):t.removeAttribute("data-theme");let a=e==="dark"||e!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches;for(let s of document.querySelectorAll('meta[name="theme-color"]'))s.content=e==="system"?s.media.includes("dark")?"#121019":"#f6f5fa":a?"#121019":"#f6f5fa"}function ls(){return'<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 18h5l3-8 5 14 3.5-9H28" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'}function co(e){let t=m();return L(t,e).filter(({med:a,time:s})=>H(t,a.id,s,e)==="pending").length}function uo(e){let t=co(e);F.tabbar.innerHTML=h`
    <div class="sidebar-brand">
      <div class="brand-mark">${r(ls())}</div>
      <div>
        <div class="brand-name">Synara</div>
        <div class="brand-tag">Epilepsy care for school</div>
      </div>
    </div>
    ${r(Vt.map(a=>{let s=Kt[a],n=a===Y,o=a==="meds"&&t>0,i=o?`${s.label}, ${t} ${t===1?"dose":"doses"} not logged today`:s.label;return`
        <button class="tab" data-action="nav" data-to="${a}"
                ${n?'aria-current="page"':""} aria-label="${i}">
          <span class="tab-ico">${c(s.icon)}</span>
          <span class="tab-label">${s.label}</span>
          ${o?'<span class="tab-dot" aria-hidden="true"></span>':""}
        </button>`}).join(""))}
    <button class="sidebar-sos" data-action="open-emergency">
      ${r(c("shield",18))}
      <span>Open emergency card</span>
    </button>
    ${r(xe("sidebar-powered"))}
  `}function po(e){let t=Yt[Y],a=t.title?t.title(e):Kt[Y].label,s=t.subtitle?t.subtitle(e):"";F.appbar.innerHTML=h`
    <div class="appbar-title">
      <h1 class="appbar-t">${a}</h1>
      ${r(s?`<span class="appbar-s">${u(s)}</span>`:"")}
    </div>
    <button class="sos-btn" data-action="open-emergency"
            aria-label="Open the emergency seizure card">
      ${r(c("shield",16))}<span>SOS</span>
    </button>
  `,Ve&&F.appbar.insertBefore(Ve,F.appbar.querySelector(".sos-btn"))}function ho(e){F.screen.innerHTML=h`
    <div class="screen-inner" data-route="${Y}">${r(Yt[Y].render(e))}</div>
  `}function Ke(){let e=R(),t=F.screen.scrollTop,a=document.activeElement,s=Ve&&Ve.contains(a),n=a&&!s&&F.shell.contains(a)?pt(a):null;document.title=`${Kt[Y].label} \xB7 Synara`,is(e.settings.theme),uo(e),po(e),ho(e),F.screen.scrollTop=t,n?ht(n,F.shell):s&&a.focus()}function mo(){Da(h`
    <div class="welcome-inner">
      <div class="brand-mark welcome-mark">${r(ls())}</div>
      <h1 class="welcome-h1">Synara</h1>
      <p class="welcome-sub">
        Your medication, your seizures, and the card someone needs if you
        have one at school — all in one place.
      </p>

      <ul class="welcome-points">
        <li>${r(c("pill",18))}<span>Dose reminders and a history you can show your doctor</span></li>
        <li>${r(c("chart",18))}<span>A seizure log that looks for patterns for you</span></li>
        <li>${r(c("shield",18))}<span>An emergency card anyone can follow, one tap away</span></li>
      </ul>

      <div class="welcome-actions">
        <button class="btn btn-primary btn-lg btn-block" data-action="welcome-empty">
          Set it up for me
        </button>
        <button class="btn btn-outline btn-lg btn-block" data-action="welcome-demo">
          Look around with example data
        </button>
      </div>

      <p class="welcome-note">
        ${r(c("lock",14))}
        <span>Everything stays on this device — nothing is uploaded and there is
        no account. Synara is a student project, not a medical device.</span>
      </p>

      ${r(xe("welcome-powered"))}
    </div>
  `)}var _t={nav(e){ns(e.dataset.to)},"close-sheet"(){z()},"close-emergency"(){me()},"open-emergency"(){Ye(R())},async"welcome-demo"(){await $e({seedFn:Ie}),bt(),y("Loaded example data \u2014 clear it any time in You","ok")},async"welcome-empty"(){await $e(),bt(),ns("meds"),y("Start by adding your medication","ok")},reload(){location.reload()}};for(let e of Object.values(Yt))if(e.actions)for(let[t,a]of Object.entries(e.actions))_t[t]&&console.warn(`[synara] duplicate action "${t}"`),_t[t]=a;function Gt(e,t){let a=_t[e];return a?(Promise.resolve(a(t,R())).catch(s=>{console.error("[synara] action failed:",e,s),y(s&&s.message==="save-failed"?"Could not save \u2014 your browser storage may be full or blocked.":"Something went wrong. Please try that again.","bad")}),!0):!1}document.addEventListener("click",e=>{let t=e.target.closest("[data-action]");!t||t.tagName==="FORM"||Gt(t.dataset.action,t)&&e.preventDefault()});document.addEventListener("submit",e=>{let t=e.target.closest("form[data-action]");t&&(e.preventDefault(),Gt(t.dataset.action,t))});document.addEventListener("change",e=>{let t=e.target.closest("[data-change]");t&&Gt(t.dataset.change,t)});function os(){let e=rs();e.route!==Y&&(Y=e.route,gt()&&!e.sos&&me(),z(),F.screen.scrollTop=0,Ke()),e.sos&&(Ye(R()),history.replaceState(null,"","#/safety"))}function fo(){let e=m();setInterval(()=>{if(gt())return;let t=m();(Y==="home"||t!==e)&&Ke(),e=t},6e4)}function yo(){lo||!("serviceWorker"in navigator)||location.protocol==="file:"||window.addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").catch(e=>{console.warn("[synara] service worker not registered:",e)})})}async function go(){let e=rs();Y=e.route;let{firstRun:t}=await ia();Oe(Ke),Ke(),t?mo():e.sos&&os(),window.addEventListener("hashchange",os),window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>is(R().settings.theme)),Aa(),yo(),fo()}go().catch(e=>{console.error("[synara] failed to start:",e),F.screen.innerHTML=h`
    <div class="screen-inner">
      <div class="empty">
        <span class="empty-ico">${r(c("alert",32))}</span>
        <span class="empty-t">Synara couldn't start</span>
        <span class="empty-s">
          Your browser may be blocking local storage. Try turning off private
          browsing, or reload the page.
        </span>
        <button class="btn btn-primary" data-action="reload">Reload</button>
      </div>
    </div>
  `});})();
