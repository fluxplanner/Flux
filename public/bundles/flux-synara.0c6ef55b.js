(()=>{var cs=Object.defineProperty;var Ee=(e,t)=>{for(var a in t)cs(e,a,{get:t[a],enumerable:!0})};function u(e){return e==null?"":String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}var Ma=Symbol("raw");function o(e){return{[Ma]:!0,value:String(e??"")}}function Ta(e){return e==null?"":Array.isArray(e)?e.map(Ta).join(""):typeof e=="object"&&e[Ma]?e.value:u(e)}function h(e,...t){let a=e[0];for(let n=0;n<t.length;n++)a+=Ta(t[n])+e[n+1];return a}var ee=e=>String(e).padStart(2,"0");function f(e=new Date){return`${e.getFullYear()}-${ee(e.getMonth()+1)}-${ee(e.getDate())}`}function ae(e=new Date){return`${f(e)}T${ee(e.getHours())}:${ee(e.getMinutes())}`}function X(e=new Date){return`${ee(e.getHours())}:${ee(e.getMinutes())}`}function te(e){let[t,a,n]=String(e).split("-").map(Number);return new Date(t,a-1,n)}function ne(e){let[t,a="00:00"]=String(e).split("T"),[n,s,r]=t.split("-").map(Number),[i,l]=a.split(":").map(Number);return new Date(n,s-1,r,i||0,l||0)}function D(e){let[t,a]=String(e).split(":").map(Number);return(t||0)*60+(a||0)}function E(e,t){let a=te(e);return a.setDate(a.getDate()+t),f(a)}function Be(e,t){let a=te(t)-te(e);return Math.round(a/864e5)}function Ea(e,t=f()){let a=[];for(let n=e-1;n>=0;n--)a.push(E(t,-n));return a}var za=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],Ca=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],pt=e=>za[e],Aa=e=>Ca[e];function I(e){let[t,a]=String(e).split(":").map(Number),n=t>=12?"PM":"AM";return`${t%12===0?12:t%12}:${ee(a||0)} ${n}`}function R(e,{relative:t=!0}={}){let a=f();if(t){if(e===a)return"Today";if(e===E(a,-1))return"Yesterday";if(e===E(a,1))return"Tomorrow"}let n=te(e);return`${Ca[n.getDay()]}, ${za[n.getMonth()]} ${n.getDate()}`}function We(e){let t=Math.max(0,Math.round(e));if(t<1)return"now";if(t<60)return`${t}m`;let a=Math.floor(t/60),n=t%60;return n?`${a}h ${n}m`:`${a}h`}function ze(e){let t=Math.max(0,Math.round(e));if(t<60)return`${t} sec`;let a=Math.floor(t/60),n=t%60;return n?`${a} min ${n} sec`:`${a} min`}function Da(e){let[t,a]=String(e).split("T");return`${R(t)} at ${I(a||"00:00")}`}function Oa(e){let t=ne(e),a=Math.round((Date.now()-t.getTime())/6e4);if(a<1)return"just now";if(a<60)return`${a}m ago`;let n=Math.round(a/60);if(n<24)return`${n}h ago`;let s=Math.round(n/24);if(s===1)return"yesterday";if(s<30)return`${s} days ago`;let r=Math.round(s/30);return r===1?"a month ago":`${r} months ago`}function O(e="id"){return`${e}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`}var Ye=(e,t,a)=>Math.min(a,Math.max(t,e));function ht(e){return`tel:${String(e).replace(/[^\d+]/g,"")}`}function mt(e){return(String(e||"").match(/\d/g)||[]).length>=3}function _e(e){return String(e||"").trim().split(/\s+/).slice(0,2).map(t=>t[0]||"").join("").toUpperCase()}function ft(e){let t=new Map;for(let a of e)a==null||a===""||t.set(a,(t.get(a)||0)+1);return[...t.entries()].map(([a,n])=>({value:a,count:n})).sort((a,n)=>n.count-a.count)}function M(e,t,a="s"){return`${e} ${t}${e===1?"":a}`}function Ce(e,t){if(e==="taken")return"Taken";if(e==="late")return"Taken late";if(e==="missed")return"Missed";let a=D(X())-D(t);return a<0?"Scheduled":a<=60?"Due now":`${We(a)} overdue`}var Ke="synara.v2",La=3,ja={name:"local",async read(){try{let e=localStorage.getItem(Ke);return e?JSON.parse(e):null}catch(e){return console.warn("[synara] could not read local state:",e),null}},async write(e){try{return localStorage.setItem(Ke,JSON.stringify(e)),!0}catch(t){throw console.error("[synara] could not save state:",t),new Error("save-failed")}},async clear(){try{localStorage.removeItem(Ke)}catch(e){console.warn("[synara] could not clear state:",e)}}},G=ja;function me(){return{v:La,profile:{name:"",pronouns:"",grade:"",school:"",seizureType:"",diagnosed:"",neurologist:"",neuroPhone:"",allergies:"",bloodType:""},meds:[],doses:{},seizures:[],checkins:{},contacts:[],card:{looksLike:"",during:["Stay with them and start timing the seizure.","Move anything hard or sharp out of the way.","Put something soft under their head.","Loosen anything tight around their neck.","If they are not aware or not awake, gently turn them onto their side.","Stay calm and speak normally \u2014 they may be able to hear you."],doNot:["Do NOT put anything in their mouth. They cannot swallow their tongue.","Do NOT hold them down or try to stop the movements.","Do NOT give food, drink, or pills until they are fully awake.","Do NOT crowd them \u2014 ask other people to step back."],after:["Stay with them until they are fully alert and know where they are.","Tell them calmly what happened \u2014 they may not remember.","Let them rest somewhere quiet.","Call their emergency contact.","Write down the time it started and how long it lasted."],callEms:["The seizure lasts longer than 5 minutes.","A second seizure starts soon after the first.","They do not wake up or return to normal afterwards.","They are having trouble breathing, or their lips stay blue.","They were injured, or it happened in water."],forTeacher:"",forNurse:"",forCoach:"",updated:""},settings:{theme:"system",remindersOn:!1,reminderLead:0,quietHours:null,seeded:!1,fluxLink:!1}}}var ls=/^[A-Za-z0-9_-]{1,64}$/,ds=/^\d{4}-\d{2}-\d{2}$/,us=/^([01]\d|2[0-3]):[0-5]\d$/,ps=/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/,Ia=new Set(["taken","late","missed"]),bt=new Set(["violet","mint","amber","rose","blue"]),vt=new Set(["tablet","capsule","liquid","patch","injection","other"]),hs=new Set(["system","light","dark"]),ue=e=>typeof e=="string"&&ds.test(e),k=(e,t=4e3)=>typeof e=="string"?e.slice(0,t):"",Ve=(e,t,a,n)=>typeof e=="number"&&Number.isFinite(e)?Math.min(a,Math.max(t,e)):n,ms=e=>Array.isArray(e)?e.map(t=>k(t,600)).filter(Boolean).slice(0,30):null,wt=(e,t)=>typeof e=="string"&&ls.test(e)?e:O(t),Xe=e=>typeof e=="string"&&us.test(e),pe=e=>typeof e=="string"&&ps.test(e);function he(e){return Array.isArray(e)?[...new Set(e.filter(Xe))].sort():[]}function fs(e,t){let a=f(),n=ue(e.added)?e.added:t||a,s;Array.isArray(e.schedule)&&e.schedule.length?s=e.schedule.filter(i=>i&&ue(i.from)).map(i=>({from:i.from,times:he(i.times)})).sort((i,l)=>i.from<l.from?-1:i.from>l.from?1:0):s=[{from:n,times:he(e.times)}],s.length||(s=[{from:n,times:[]}]),s[0].from=n;let r=ue(e.ended)?e.ended:null;return!r&&e.active===!1&&(r=a),{id:wt(e.id,"med"),name:k(e.name,120),dose:k(e.dose,60),form:vt.has(e.form)?e.form:"tablet",notes:k(e.notes,600),color:bt.has(e.color)?e.color:"violet",added:n,ended:r,schedule:s}}function ys(e,t){let a={};if(!e||typeof e!="object")return a;for(let[n,s]of Object.entries(e)){if(!ue(n)||!s||typeof s!="object")continue;let r={};for(let[i,l]of Object.entries(s)){let[d,p]=i.split("|");!t.has(d)||!Xe(p)||!l||!Ia.has(l.status)||(r[i]={status:l.status,at:pe(l.at)?l.at:`${n}T00:00`})}Object.keys(r).length&&(a[n]=r)}return a}function $t(e){return!e||!pe(e.at)?null:{id:wt(e.id,"sz"),at:e.at,duration:Math.round(Ve(Number(e.duration),0,7200,0)),type:k(e.type,80),trigger:k(e.trigger,80),place:k(e.place,120),aura:k(e.aura,300),injury:e.injury===!0,emsCalled:e.emsCalled===!0,notes:k(e.notes,4e3),logged:pe(e.logged)?e.logged:e.at}}function gs(e){let t={};if(!e||typeof e!="object")return t;for(let[a,n]of Object.entries(e)){if(!ue(a)||!n||typeof n!="object")continue;let s=Ve(n.stress,1,5,null);t[a]={sleepHours:Ve(n.sleepHours,0,24,null),sleepQuality:["poor","ok","good"].includes(n.sleepQuality)?n.sleepQuality:null,stress:s==null?null:Math.round(s),mood:["low","ok"].includes(n.mood)?n.mood:null,notes:k(n.notes,600),at:pe(n.at)?n.at:`${a}T00:00`}}return t}function bs(e){return!e||typeof e!="object"?null:{id:wt(e.id,"c"),name:k(e.name,120),relation:k(e.relation,80),phone:k(e.phone,40),primary:e.primary===!0}}function vs(e){let t=new Map;if(!e||typeof e!="object")return t;for(let a of Object.keys(e).sort())for(let n of Object.keys(e[a]||{})){let s=n.split("|")[0];t.has(s)||t.set(s,a)}return t}var kt=(e,t)=>e.at<t.at?1:e.at>t.at?-1:0;function St(e){let t=me(),a=e&&typeof e=="object"?e:{},n=vs(a.doses),s=(Array.isArray(a.meds)?a.meds:[]).filter($=>$&&typeof $=="object").map($=>fs($,n.get($.id))),r=new Set(s.map($=>$.id)),i=(Array.isArray(a.seizures)?a.seizures:[]).map($t).filter(Boolean).sort(kt),l=(Array.isArray(a.contacts)?a.contacts:[]).map(bs).filter(Boolean),d=!1;for(let $ of l)$.primary&&d&&($.primary=!1),$.primary&&(d=!0);let p={...t.profile};if(a.profile&&typeof a.profile=="object")for(let $ of Object.keys(t.profile))p[$]=k(a.profile[$],200);let y={...t.card};if(a.card&&typeof a.card=="object"){for(let $ of["during","doNot","after","callEms"]){let x=ms(a.card[$]);x&&(y[$]=x)}for(let $ of["looksLike","forTeacher","forNurse","forCoach"])typeof a.card[$]=="string"&&(y[$]=k(a.card[$]));y.updated=ue(a.card.updated)?a.card.updated:""}let g=a.settings&&typeof a.settings=="object"?a.settings:{},C=g.quietHours,A={theme:hs.has(g.theme)?g.theme:"system",remindersOn:g.remindersOn===!0,reminderLead:Math.round(Ve(g.reminderLead,0,120,0)),quietHours:C&&Xe(C.from)&&Xe(C.to)?{from:C.from,to:C.to}:null,seeded:g.seeded===!0,fluxLink:g.fluxLink===!0};return{v:La,profile:p,meds:s,doses:ys(a.doses,r),seizures:i,checkins:gs(a.checkins),contacts:l,card:y,settings:A}}var S=me(),yt=new Set,xt=!1;function W(){return S}function fe(e){return yt.add(e),()=>yt.delete(e)}function ye(){for(let e of yt)try{e(S)}catch(t){console.error("[synara] listener threw:",t)}}async function N(e){if(!xt)throw new Error("not-ready");return e(S),await G.write(S),ye(),S}function Mt(){ye()}function ws(e){if(e.key===Ke)try{S=e.newValue?St(JSON.parse(e.newValue)):me(),xt=!0,ye()}catch(t){console.warn("[synara] ignored an unreadable change from another tab:",t)}}var Na=!1;async function Ha(){!Na&&G===ja&&typeof window<"u"&&(window.addEventListener("storage",ws),Na=!0);let e=await G.read();return xt=!0,e?(S=St(e),await G.write(S),{state:S,firstRun:!1}):(S=me(),{state:S,firstRun:!0})}async function Pa(){await G.clear(),S=me(),ye()}async function Ae({seedFn:e}={}){return await G.clear(),S=me(),e&&(e(S),S.settings.seeded=!0),await G.write(S),ye(),S}function $s(e,t){if(t<e.added)return[];if(e.ended&&t>=e.ended)return[];let a=[];for(let n of e.schedule)if(n.from<=t)a=n.times;else break;return a}function J(e){let t=e.schedule[e.schedule.length-1];return t?t.times:[]}function Tt(e,t=f()){return!e.ended||e.ended>t}function K(e=S){let t=f();return e.meds.filter(a=>Tt(a,t))}function L(e,t=S){let a=[];for(let n of t.meds)for(let s of $s(n,e))a.push({med:n,time:s});return a.sort((n,s)=>D(n.time)-D(s.time)||n.med.name.localeCompare(s.med.name))}function qa({name:e,dose:t="",form:a="tablet",times:n=[],notes:s="",color:r="violet"}){let i=f();return N(l=>{l.meds.push({id:O("med"),name:k(e,120).trim(),dose:k(t,60).trim(),form:vt.has(a)?a:"tablet",notes:k(s,600).trim(),color:bt.has(r)?r:"violet",added:i,ended:null,schedule:[{from:i,times:he(n)}]})})}function Ra(e,t){let a=f();return N(n=>{let s=n.meds.find(r=>r.id===e);if(s&&(typeof t.name=="string"&&(s.name=k(t.name,120).trim()),typeof t.dose=="string"&&(s.dose=k(t.dose,60).trim()),typeof t.notes=="string"&&(s.notes=k(t.notes,600).trim()),vt.has(t.form)&&(s.form=t.form),bt.has(t.color)&&(s.color=t.color),Array.isArray(t.times))){let r=he(t.times);if(r.join()===J(s).join())return;let i=s.schedule[s.schedule.length-1];if(i.from===a){i.times=r;let l=s.schedule[s.schedule.length-2];l&&l.times.join()===r.join()&&s.schedule.pop()}else s.schedule.push({from:a,times:r})}})}function Fa(e){let t=f();return N(a=>{let n=a.meds.find(s=>s.id===e);if(n){if(n.added>=t){a.meds=a.meds.filter(s=>s.id!==e);for(let s of Object.keys(a.doses)){for(let r of Object.keys(a.doses[s]))r.startsWith(`${e}|`)&&delete a.doses[s][r];Object.keys(a.doses[s]).length||delete a.doses[s]}return}n.ended=t}})}function Ba(e){let t=f();return N(a=>{let n=a.meds.find(r=>r.id===e);if(!n||!n.ended)return;let s=J(n);n.ended<t&&(n.schedule.push({from:n.ended,times:[]}),n.schedule.push({from:t,times:s})),n.ended=null})}var gt=(e,t)=>`${e}|${t}`;function Ge(e,t,a,n){return N(s=>{if(n==="pending"){s.doses[e]&&(delete s.doses[e][gt(t,a)],Object.keys(s.doses[e]).length||delete s.doses[e]);return}Ia.has(n)&&(s.doses[e]||(s.doses[e]={}),s.doses[e][gt(t,a)]={status:n,at:ae()})})}function H(e,t,a,n=S){let s=n.doses[e]&&n.doses[e][gt(t,a)];return s?s.status:"pending"}var Je=60;function De(e,t,a,n=S){let s=H(e,t,a,n);if(s!=="pending")return s;let r=f();if(e<r)return"missed";if(e>r)return"pending";let i=new Date;return i.getHours()*60+i.getMinutes()>D(a)+Je?"missed":"pending"}function Wa({at:e,duration:t=0,type:a="",trigger:n="",place:s="",aura:r="",injury:i=!1,emsCalled:l=!1,notes:d=""}){return N(p=>{let y=$t({id:O("sz"),at:e||ae(),duration:Number(t)||0,type:a,trigger:n,place:s,aura:r,injury:!!i,emsCalled:!!l,notes:(d||"").trim(),logged:ae()});y&&(p.seizures.push(y),p.seizures.sort(kt))})}function Ya(e,t){return N(a=>{let n=a.seizures.findIndex(r=>r.id===e);if(n<0)return;let s=$t({...a.seizures[n],...t,id:e});s&&(a.seizures[n]=s,a.seizures.sort(kt))})}function _a(e){return N(t=>{t.seizures=t.seizures.filter(a=>a.id!==e)})}function Ka(e,t){return N(a=>{a.checkins[e]={...a.checkins[e]||{},...t,at:ae()}})}function Oe(e,t=S){return t.checkins[e]||null}function Va({name:e,relation:t="",phone:a,primary:n=!1}){return N(s=>{n&&s.contacts.forEach(r=>{r.primary=!1}),s.contacts.push({id:O("c"),name:k(e,120).trim(),relation:k(t,80).trim(),phone:k(a,40).trim(),primary:!!n})})}function Xa(e,t){return N(a=>{let n=a.contacts.find(s=>s.id===e);n&&(t.primary&&a.contacts.forEach(s=>{s.primary=!1}),typeof t.name=="string"&&(n.name=k(t.name,120).trim()),typeof t.relation=="string"&&(n.relation=k(t.relation,80).trim()),typeof t.phone=="string"&&(n.phone=k(t.phone,40).trim()),typeof t.primary=="boolean"&&(n.primary=t.primary))})}function Ga(e){return N(t=>{t.contacts=t.contacts.filter(a=>a.id!==e)})}function Ja(e){return N(t=>{Object.assign(t.card,e,{updated:f()})})}function Ua(e){return N(t=>{for(let a of Object.keys(t.profile))typeof e[a]=="string"&&(t.profile[a]=k(e[a],200).trim())})}function Ne(e){return N(t=>Object.assign(t.settings,e))}function ge(){return JSON.stringify(S,null,2)}async function Ue(e){let t;try{t=JSON.parse(e)}catch{throw new Error("not-json")}if(!(t&&typeof t=="object"&&Array.isArray(t.meds)&&Array.isArray(t.seizures)&&t.doses&&typeof t.doses=="object"))throw new Error("not-synara");return S=St(t),await G.write(S),ye(),S}var ks=[4,12,25,26,41],Ss=[2,6,9,17,22,31],Et=45,xs=21,Ms=30,Ts={3:5,4:6,11:5.5,12:6,24:4.5,25:5.5,38:6},Qa={3:5,4:4,10:4,11:5,23:4,24:5,37:4,38:4},Es=e=>Math.round(e*10)/10;function Qe(e){let t=f();e.profile={name:"Maya Ellison",pronouns:"she/her",grade:"11th grade",school:"Rosewood High School",seizureType:"Focal impaired awareness, occasional tonic-clonic",diagnosed:"2022",neurologist:"Dr. Priya Raghavan",neuroPhone:"(555) 010-4488",allergies:"Penicillin",bloodType:"O+"};let a=E(t,-Et),n=E(t,-xs),s=E(t,-Ms),r={id:O("med"),name:"Levetiracetam",dose:"500 mg",form:"tablet",notes:"Take with food. Evening dose moved to 8pm so it is done before homework.",color:"violet",added:a,ended:null,schedule:[{from:a,times:["08:00","21:00"]},{from:n,times:["08:00","20:00"]}]},i={id:O("med"),name:"Lamotrigine",dose:"100 mg",form:"tablet",notes:"Never stop suddenly \u2014 taper only with Dr. Raghavan.",color:"mint",added:a,ended:null,schedule:[{from:a,times:["08:00"]}]},l={id:O("med"),name:"Topiramate",dose:"25 mg",form:"tablet",notes:"Stopped with Dr. Raghavan \u2014 made it hard to concentrate in class.",color:"amber",added:a,ended:s,schedule:[{from:a,times:["21:00"]}]};e.meds=[r,i,l],e.doses={};for(let p=Et;p>=1;p--){let y=E(t,-p),g={},C=ks.includes(p),A=Ss.includes(p),$=y<n?"21:00":"20:00";g[`${r.id}|08:00`]={status:A?"late":"taken",at:`${y}T08:12`},g[`${i.id}|08:00`]={status:A?"late":"taken",at:`${y}T08:12`},C?g[`${r.id}|${$}`]={status:"missed",at:`${y}T23:50`}:A?g[`${r.id}|${$}`]={status:"late",at:`${y}T22:40`}:g[`${r.id}|${$}`]={status:"taken",at:`${y}T${$==="21:00"?"21:04":"20:05"}`},y<s&&(g[`${l.id}|21:00`]={status:"taken",at:`${y}T21:06`}),e.doses[y]=g}e.checkins={};for(let p=Et;p>=0;p--){let y=E(t,-p),g=Ts[p],C=g??Es(7.4+p*37%11/10),A=Qa[p]!=null?Qa[p]:1+p*17%3;e.checkins[y]={sleepHours:C,sleepQuality:C<6?"poor":C<7?"ok":"good",stress:A,mood:A>=4?"low":"ok",notes:"",at:`${y}T07:30`}}let d=[{back:3,time:"15:40",duration:95,type:"Focal impaired awareness",trigger:"Missed sleep",place:"School \u2014 classroom",aura:'Metallic taste, felt "far away" for about a minute',injury:!1,emsCalled:!1,notes:"Ms. Okafor followed the card. Sat with me until I came back. Missed the bus home."},{back:11,time:"21:10",duration:130,type:"Tonic-clonic",trigger:"Missed dose",place:"Home \u2014 bedroom",aura:"None that I remember",injury:!0,emsCalled:!1,notes:"Bit the inside of my cheek. Mom timed it at just over two minutes."},{back:24,time:"07:55",duration:60,type:"Focal aware",trigger:"Missed sleep",place:"Home \u2014 kitchen",aura:"Stomach-dropping feeling",injury:!1,emsCalled:!1,notes:"Stayed home first period. Was fine by lunch."},{back:38,time:"14:20",duration:150,type:"Tonic-clonic",trigger:"Flashing lights",place:"School \u2014 gym",aura:"Visual static",injury:!1,emsCalled:!0,notes:"Assembly with strobe lighting. Nurse called EMS because it went past two minutes. Did not go to hospital."}];return e.seizures=d.map(p=>({id:O("sz"),at:`${E(t,-p.back)}T${p.time}`,duration:p.duration,type:p.type,trigger:p.trigger,place:p.place,aura:p.aura,injury:p.injury,emsCalled:p.emsCalled,notes:p.notes,logged:`${E(t,-p.back)}T${p.time}`})),e.seizures.sort((p,y)=>p.at<y.at?1:-1),e.contacts=[{id:O("c"),name:"Dana Ellison",relation:"Mom",phone:"(555) 014-2007",primary:!0},{id:O("c"),name:"Marcus Ellison",relation:"Dad",phone:"(555) 014-2019",primary:!1},{id:O("c"),name:"Dr. Priya Raghavan",relation:"Neurologist",phone:"(555) 010-4488",primary:!1},{id:O("c"),name:"Nurse Ruiz",relation:"School nurse",phone:"(555) 018-8300",primary:!1},{id:O("c"),name:"Aunt Jo",relation:"Emergency pickup",phone:"(555) 016-3520",primary:!1}],e.card={looksLike:"Maya usually goes quiet and stops responding. She may stare, blink repeatedly, or pick at her clothes. She sometimes says food tastes metallic right before. Most last under two minutes. Afterwards she is confused and very tired for 20\u201330 minutes and may not remember what happened.",during:["Stay with her and start timing immediately.","Move chairs, desks, and anything hard or sharp out of the way.","Put something soft under her head.","Loosen anything tight around her neck.","If she is not aware or not awake, gently turn her onto her side.","Stay calm and speak normally \u2014 she may be able to hear you."],doNot:["Do NOT put anything in her mouth. She cannot swallow her tongue.","Do NOT hold her down or try to stop the movements.","Do NOT give food, drink, or pills until she is fully awake.","Do NOT crowd her \u2014 ask other students to step back."],after:["Stay with her until she is fully alert and knows where she is.","Tell her calmly what happened \u2014 she will not remember.","Let her rest somewhere quiet. The nurse's office is best.","Call her mom, Dana, at (555) 014-2007.","Write down the time it started and how long it lasted."],callEms:["The seizure lasts longer than 5 minutes.","A second seizure starts soon after the first.","She does not wake up or return to normal afterwards.","She is having trouble breathing, or her lips stay blue.","She was injured, or it happened in water."],forTeacher:"Do not send her to the office alone afterwards \u2014 she will be confused and may not make it there. Send another student to get Nurse Ruiz instead. She is allowed to make up any assessment missed; this is in her 504 plan.",forNurse:"No rescue medication is prescribed at school. Standard first aid only. Call Dana Ellison first, then Dr. Raghavan's office if EMS criteria are met. Maya prefers to rest in the dark side room rather than the main bay.",forCoach:"Cleared for all sports except swimming without a spotter on deck. No climbing above head height. If she has a seizure at practice she is done for the day \u2014 no returning to play, even if she says she feels fine.",updated:E(t,-6)},e.settings={theme:"system",remindersOn:!1,reminderLead:0,quietHours:null,seeded:!0},e}var v={shell:document.querySelector(".app-shell"),backdrop:document.getElementById("backdrop"),sheet:document.getElementById("sheet"),emergency:document.getElementById("emergency"),welcome:document.getElementById("welcome"),toast:document.getElementById("toast")},Za={home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.8V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.8"/>',pill:'<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M8.8 8.8l6.4 6.4"/>',chart:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 15l3.5-4 3 2.5L18 8"/>',shield:'<path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.4-7.5 9.5-4.4-1.1-7.5-4.9-7.5-9.5V6z"/><path d="M12 9v4"/><path d="M12 16h.01"/>',sync:'<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',ribbon:'<path d="M12 13.5c-2.6-3-4-5.4-4-7.2a4 4 0 0 1 8 0c0 1.8-1.4 4.2-4 7.2Z"/><path d="M12 13.5 7.5 21l-2-1.2 4.4-7.3"/><path d="M12 13.5l4.5 7.5 2-1.2-4.4-7.3"/>',user:'<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',chevron:'<path d="m9 6 6 6-6 6"/>',phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',trash:'<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-.8 14a1 1 0 0 1-1 1H6.8a1 1 0 0 1-1-1L5 6"/>',print:'<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',wave:'<path d="M2 12c2.5-3 4.5-3 7 0s4.5 3 7 0 4.5-3 6 0"/><path d="M2 17c2.5-3 4.5-3 7 0s4.5 3 7 0 4.5-3 6 0" opacity=".5"/>',bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',pin:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',"trend-up":'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',"trend-down":'<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',down:'<path d="M12 4v12"/><path d="m6 10 6 6 6-6"/><path d="M4 20h16"/>',up:'<path d="M12 20V8"/><path d="m6 14 6-6 6 6"/><path d="M4 4h16"/>',check:'<path d="M20 6 9 17l-5-5"/>',note:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5"/><path d="M10 2h4"/><path d="M12 2v3"/>',book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',school:'<path d="M3 10 12 5l9 5-9 5z"/><path d="M7 12v5c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5v-5"/><path d="M21 10v6"/>',stethoscope:'<path d="M5 3v6a5 5 0 0 0 10 0V3"/><path d="M10 14v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',run:'<circle cx="14" cy="4" r="2"/><path d="m8 21 3-6 3 2v5"/><path d="M6 12l3-3 4 1 3 3 3 1"/><path d="m11 15-2-4"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',sparkle:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6.3 6.3 2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',play:'<path d="M7 4v16l13-8z"/>',archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>'};function c(e,t=24){let a=Za[e]||Za.info;return`<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${a}</svg>`}var zs=["action","id","med","time","day","tab","to","field","value","theme"];function At(e){return!e||!e.dataset||!e.dataset.action?null:zs.filter(t=>e.dataset[t]!=null).map(t=>`[data-${t}="${CSS.escape(e.dataset[t])}"]`).join("")}function Dt(e,t=document){if(!e)return!1;let a=t.querySelector(e);return a?(a.focus({preventScroll:!0}),!0):!1}var zt=new Set;function tn(e){v.shell&&(e?v.shell.setAttribute("inert",""):v.shell.removeAttribute("inert"))}function Ot(e){zt.add(e),tn(!0)}function Nt(e){zt.delete(e),zt.size||tn(!1)}function Lt(e){e.hidden=!1,e.offsetHeight,e.dataset.open="true"}function tt(e,t=300){return delete e.dataset.open,new Promise(a=>{setTimeout(()=>{e.dataset.open!=="true"&&(e.hidden=!0,e.innerHTML=""),a()},t)})}var Q=!1,Ct=null,be=null,Ze=null;function z({title:e,body:t,footer:a="",onMount:n,onClose:s}){Q||(be=document.activeElement,Ct=At(be)),Ze=s||null,v.sheet.innerHTML=h`
    <div class="sheet-grip" aria-hidden="true"></div>
    <div class="sheet-head">
      <h2 id="sheet-title">${e}</h2>
      <button class="icon-btn" data-action="close-sheet" aria-label="Close">
        ${o(c("x"))}
      </button>
    </div>
    <div class="sheet-body">${o(t)}</div>
    ${o(a?`<div class="sheet-foot">${a}</div>`:"")}
  `,v.backdrop.hidden=!1,v.backdrop.offsetHeight,v.backdrop.dataset.open="true",Lt(v.sheet),Q=!0,Ot("sheet"),(v.sheet.querySelector('.sheet-body input:not([type="hidden"]), .sheet-body textarea, .sheet-body select, .sheet-body button, .sheet-foot button')||v.sheet.querySelector('[data-action="close-sheet"]')).focus({preventScroll:!0}),n&&n(v.sheet)}function T(){if(!Q)return Promise.resolve();Q=!1;let e=tt(v.sheet);if(tt(v.backdrop).then(()=>{v.backdrop.hidden=!0}),Nt("sheet"),be&&be.isConnected?be.focus({preventScroll:!0}):Dt(Ct),be=null,Ct=null,Ze){let t=Ze;Ze=null,t()}return e}function an(){return Q}function F(){return v.sheet}function B(){let e={};return v.sheet.querySelectorAll("[name]").forEach(t=>{t.type==="checkbox"?e[t.name]=t.checked:e[t.name]=t.value}),e}async function P({title:e,message:t,confirmLabel:a="Delete",danger:n=!0,onConfirm:s}){Q&&await T(),z({title:e,body:h`<p class="sheet-message">${t}</p>`,footer:`
      <button class="btn btn-quiet" data-action="close-sheet">Cancel</button>
      <button class="btn ${n?"btn-danger":"btn-primary"}" data-sheet-confirm>${a}</button>
    `,onMount(r){r.querySelector("[data-sheet-confirm]").addEventListener("click",async()=>{await T(),s()})}})}var en=null;function m(e,t="default"){clearTimeout(en);let a=t==="ok"?"\u2713 ":t==="bad"?"! ":"";v.toast.textContent=a+e,v.toast.dataset.tone=t,v.toast.dataset.open="true",en=setTimeout(()=>{delete v.toast.dataset.open},2800)}var ve=!1,et=null,Le=null;async function nn(){try{"wakeLock"in navigator&&(Le=await navigator.wakeLock.request("screen"))}catch{Le=null}}function Cs(){try{Le&&Le.release()}catch{}Le=null}document.addEventListener("visibilitychange",()=>{ve&&document.visibilityState==="visible"&&nn()});function sn(e,{onClose:t,onMount:a}={}){Q&&T(),et=t||null,v.emergency.innerHTML=e,Lt(v.emergency),ve=!0,Ot("emergency");let n=v.emergency.querySelector("[data-autofocus]")||v.emergency.querySelector("button, a");n&&n.focus({preventScroll:!0}),nn(),a&&a(v.emergency)}function we(){if(ve&&(ve=!1,tt(v.emergency,220),Nt("emergency"),Cs(),et)){let e=et;et=null,e()}}function at(){return ve}function se(){return v.emergency}function on(e){v.welcome.innerHTML=e,Lt(v.welcome),Ot("welcome");let t=v.welcome.querySelector("button");t&&t.focus({preventScroll:!0})}function jt(){tt(v.welcome,250),Nt("welcome")}var As="https://fluxplanner.github.io/Flux/landing.html";function je(e=""){let t=document.documentElement.dataset.host==="flux"?"public/synara/icons/flux-logo.png":"icons/flux-logo.png";return`<a class="powered-by ${e}" href="${As}" target="_blank" rel="noopener"><span class="powered-by-t">Powered by</span><img class="powered-by-logo" src="${t}" alt="" width="18" height="18" /><span class="powered-by-name">Flux</span></a>`}v.backdrop.addEventListener("click",()=>{T()});document.addEventListener("keydown",e=>{e.key==="Escape"&&(Q?T():ve&&we())});function Pt(){if(!("Notification"in window))return{ok:!1,reason:"This browser does not support notifications."};if(location.protocol==="file:")return{ok:!1,reason:"Notifications need the app served over https."};let e=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===!0;return/iPad|iPhone|iPod/.test(navigator.userAgent)&&!e?{ok:!1,reason:"On iPhone, add Synara to your home screen first \u2014 Safari only allows notifications for installed apps."}:{ok:!0,reason:""}}function nt(){return"Notification"in window?Notification.permission:"unsupported"}async function rn(){if(!("Notification"in window))return"unsupported";try{return await Notification.requestPermission()}catch{return"denied"}}var Ht=[];function Ds(){Ht.forEach(clearTimeout),Ht=[]}function Os(e,t){let a=e.quietHours;if(!a)return!1;let n=t.getHours()*60+t.getMinutes(),s=D(a.from),r=D(a.to);return s>r?n>=s||n<r:n>=s&&n<r}function Ns(e,t){try{let a=new Notification("Time for your medication",{body:`${e.name} ${e.dose} \u2014 ${I(t)}`,tag:`synara-${e.id}-${t}`,icon:"icons/icon-192.png",badge:"icons/icon-192.png"});a.onclick=()=>{window.focus(),location.hash="#/meds",a.close()}}catch(a){console.warn("[synara] could not show notification:",a)}}function It(){Ds();let e=W(),{remindersOn:t,reminderLead:a}=e.settings;if(!t||nt()!=="granted")return 0;let n=new Date,s=f(n),r=n.getHours()*60+n.getMinutes(),i=0;for(let{med:l,time:d}of L(s,e)){let p=D(d)-(a||0);if(p<=r||H(s,l.id,d,e)!=="pending")continue;let y=(p-r)*6e4;Ht.push(setTimeout(()=>{let g=W();g.settings.remindersOn&&(Os(g.settings,new Date)||H(f(),l.id,d,g)==="pending"&&Ns(l,d))},y)),i++}return i}function cn(){It(),fe(It),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&It()})}function ln(){if(nt()!=="granted")return!1;try{return new Notification("Synara reminders are on",{body:"This is what a dose reminder will look like.",icon:"icons/icon-192.png",tag:"synara-test"}),!0}catch{return!1}}var qt="synara.flux";function Rt(){return typeof document<"u"&&document.documentElement.dataset.host==="flux"}function Ls(e){return{v:1,meds:e.meds.map(t=>({name:t.name,dose:t.dose,color:t.color,added:t.added,ended:t.ended,schedule:t.schedule.map(a=>({from:a.from,times:a.times.slice()}))}))}}function un(e){if(Rt())try{if(!e.settings.fluxLink){localStorage.removeItem(qt);return}let t=JSON.stringify(Ls(e));localStorage.getItem(qt)!==t&&localStorage.setItem(qt,t)}catch{}}var yn="synara.sync",Ft="0123456789ABCDEFGHJKMNPQRSTVWXYZ",js=3e3;function gn(e){let t=0,a=0,n="";for(let s of e)for(a=(a<<8|s)&65535,t+=8;t>=5;)n+=Ft[a>>>t-5&31],t-=5;return t>0&&(n+=Ft[a<<5-t&31]),n}function ot(e){let t=String(e||"").toUpperCase().replace(/[^0-9A-Z]/g,"").replace(/O/g,"0").replace(/[IL]/g,"1");if(t.length!==26)return null;let a=0,n=0,s=[];for(let r of t){let i=Ft.indexOf(r);if(i<0)return null;n=(n<<5|i)&65535,a+=5,a>=8&&(s.push(n>>>a-8&255),a-=8)}return s.length!==16||(n&(1<<a)-1)!==0?null:new Uint8Array(s)}function Is(e){return e.match(/.{1,4}/g).join("-")}function Hs(e,t,a){if(!t)return a.remoteAt?"gone":"push";let n=e!==a.hash,s=t.updated_at!==a.remoteAt;return n&&s?"conflict":s?"pull":n?"push":"none"}var hn=e=>{let t="";for(let a=0;a<e.length;a+=32768)t+=String.fromCharCode(...e.subarray(a,a+32768));return btoa(t)},mn=e=>Uint8Array.from(atob(e),t=>t.charCodeAt(0));async function bn(e){return crypto.subtle.importKey("raw",e,"AES-GCM",!1,["encrypt","decrypt"])}async function Ps(e,t){let a=crypto.getRandomValues(new Uint8Array(12)),n=new TextEncoder().encode(e),s=await crypto.subtle.encrypt({name:"AES-GCM",iv:a},await bn(t),n);return{ciphertext:hn(new Uint8Array(s)),iv:hn(a)}}async function vn(e,t){try{let a=await crypto.subtle.decrypt({name:"AES-GCM",iv:mn(e.iv)},await bn(t),mn(e.ciphertext));return new TextDecoder().decode(a)}catch{throw Object.assign(new Error("wrong-key"),{code:"wrong-key"})}}async function Yt(e){let t=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(e));return Array.from(new Uint8Array(t),a=>a.toString(16).padStart(2,"0")).join("")}var He={phase:"off",error:"",account:null},Bt=new Set,Wt=null,Ie=null,fn=!1;function q(e){He={...He,...e};for(let t of Bt)t(He)}function wn(e){return Bt.add(e),()=>Bt.delete(e)}function rt(){return He}function ke(){try{return JSON.parse(localStorage.getItem(yn)||"null")||{}}catch{return{}}}function Pe(e){try{localStorage.setItem(yn,JSON.stringify(e))}catch{}}function V(){return!!ke().key}function $n(){return ke().at||""}function _t(){let e=ke().key;return e?Is(e):""}function kn(){return typeof document<"u"&&document.documentElement.dataset.host==="flux"}function oe(){return window.FluxSynaraVault||null}function it(){return oe()||document.readyState!=="loading"?Promise.resolve(oe()):new Promise(e=>document.addEventListener("DOMContentLoaded",()=>e(oe()),{once:!0}))}function Se(e){if(!e)throw Object.assign(new Error("not-ready"),{code:"not-ready"});return e}async function Sn(){let e=await it();if(!e)return null;try{return await e.account()}catch{return null}}async function st(){return q({account:await Sn()}),He.account}function xn(e){return e&&(e.code||e.message)||"failed"}async function Kt(e,t){let a=ge(),n=await Ps(a,t),s=await Se(oe()).put(n);Pe({...e,hash:await Yt(a),remoteAt:s.updated_at,at:new Date().toISOString()})}async function Vt(e,t,a){let n=await vn(a,t);Pe({...e,remoteAt:a.updated_at}),await Ue(n),Pe({...ke(),hash:await Yt(ge()),at:new Date().toISOString()})}function $e(){return Ie||(Ie=(async()=>{let e=ke();if(!e.key||!kn())return q({phase:"off"}),"off";let t=await it();if(!t)return q({phase:"error",error:"not-ready"}),"error";q({phase:"syncing",error:""});try{let a=ot(e.key),n=await t.get(),s=Hs(await Yt(ge()),n,e);if(s==="push")await Kt(e,a);else if(s==="pull")await Vt(e,a,n);else{if(s==="gone")return Pe({}),q({phase:"off",error:"gone"}),s;if(s==="conflict")return q({phase:"conflict"}),s}return q({phase:"idle",error:""}),s}catch(a){return q({phase:"error",error:xn(a)}),"error"}})().finally(()=>{Ie=null}),Ie)}async function Mn(e){let t=ke(),a=ot(t.key);q({phase:"syncing",error:""});try{e==="cloud"?await Vt(t,a,await Se(oe()).get()):await Kt(t,a),q({phase:"idle"})}catch(n){throw q({phase:"error",error:xn(n)}),n}}async function Xt(){let e=Se(await it());if(!await Sn())throw Object.assign(new Error("signed-out"),{code:"signed-out"});if(await e.get())throw Object.assign(new Error("has-copy"),{code:"has-copy"});let t=crypto.getRandomValues(new Uint8Array(16));await Kt({key:gn(t)},t),q({phase:"idle",error:""})}async function Tn(e){let t=ot(e);if(!t)throw Object.assign(new Error("bad-key"),{code:"bad-key"});let a=await Se(await it()).get();if(!a)throw Object.assign(new Error("no-copy"),{code:"no-copy"});let n=JSON.parse(await vn(a,t));return{key:gn(t),updatedAt:a.updated_at,meds:Array.isArray(n.meds)?n.meds.length:0,seizures:Array.isArray(n.seizures)?n.seizures.length:0,name:n.profile&&typeof n.profile.name=="string"?n.profile.name:""}}async function En(e){let t=ot(e);await Vt({key:e},t,await Se(oe()).get()),q({phase:"idle",error:""})}async function xe({deleteCopy:e=!1}={}){e&&await Se(oe()).remove(),Pe({}),clearTimeout(Wt),q({phase:"off",error:""})}async function zn(){!kn()||fn||(fn=!0,fe(()=>{V()&&(clearTimeout(Wt),Wt=setTimeout($e,js))}),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&(st(),V()&&$e())}),window.addEventListener("online",()=>{V()&&$e()}),await st(),V()&&$e())}var Zt={};Ee(Zt,{actions:()=>co,render:()=>Qs,subtitle:()=>Gs,title:()=>Xs});var An="These are associations in your own log, not medical conclusions. Patterns can appear by chance, especially with few entries. Bring them to your neurologist rather than acting on them alone.",re=3,qe=e=>e.reduce((t,a)=>t+a,0)/e.length,ie=e=>e.at.split("T")[0];function Jt(e,t,a=0){let n=f(),s=0,r=0;for(let i=a+1;i<=t;i++){let l=E(n,-i);for(let{med:d,time:p}of L(l,e))r++,De(l,d.id,p,e)==="taken"&&s++}return{good:s,total:r}}function qs(e){let t=f(),a=0;for(let n=1;n<=365;n++){let s=E(t,-n),r=L(s,e);if(!r.length||!r.every(({med:l,time:d})=>De(s,l.id,d,e)==="taken"))break;a++}return a}function Ut(e){let t=e.seizures||[];return t.length<2?[]:[Rs(e,t),Fs(e,t),Bs(e,t),Ws(t),Ys(t),_s(t),Ks(e),Vs(t)].filter(Boolean).sort((a,n)=>n.strength-a.strength)}function Dn(e){return Ut(e)[0]||null}function Rs(e,t){if(t.length<re||!e.meds.length)return null;let a=0,n=0;for(let r of t){let i=ie(r),l=!1,d=!1;for(let p of[0,-1,-2]){let y=E(i,p);for(let{med:g,time:C}of L(y,e)){l=!0;let A=De(y,g.id,C,e);if(A==="missed"||A==="late"){d=!0;break}}if(d)break}l&&n++,d&&a++}if(n<re||a<2)return null;let s=Math.round(a/n*100);return s<60?null:{id:"dose-proximity",tone:"alert",icon:"pill",title:`${a} of your ${n} seizures followed a missed or late dose`,detail:`Within 48 hours before each of those ${M(a,"seizure")}, at least one scheduled dose was marked missed or late. This is the pattern most worth mentioning at your next appointment.`,evidence:`${a}/${n} seizures \xB7 ${s}%`,strength:100+s}}function On(e,t,a){let n=new Set(t.map(ie)),s=[],r=[];for(let[i,l]of Object.entries(e.checkins||{}))typeof l[a]=="number"&&(n.has(i)?s:r).push(l[a]);return{onSeizureDays:s,onOtherDays:r}}function Fs(e,t){let{onSeizureDays:a,onOtherDays:n}=On(e,t,"sleepHours");if(a.length<re||n.length<10)return null;let s=qe(a),r=qe(n),i=r-s;return i<.75?null:{id:"sleep",tone:"alert",icon:"moon",title:`You slept ${i.toFixed(1)} hours less before seizure days`,detail:`The nights before a seizure averaged ${s.toFixed(1)} hours, against ${r.toFixed(1)} on every other night. Short sleep is one of the most commonly reported seizure triggers.`,evidence:`${a.length} seizure nights vs ${n.length} others`,strength:90+Math.min(20,i*10)}}function Bs(e,t){let{onSeizureDays:a,onOtherDays:n}=On(e,t,"stress");if(a.length<re||n.length<10)return null;let s=qe(a),r=qe(n),i=s-r;return i<.8?null:{id:"stress",tone:"watch",icon:"wave",title:"Seizure days were higher-stress days",detail:`You rated stress ${s.toFixed(1)} out of 5 on seizure days, against ${r.toFixed(1)} otherwise. Stress rarely acts alone \u2014 it tends to travel with the things that do, like less sleep, skipped meals, and broken routine.`,evidence:`${a.length} seizure days vs ${n.length} others`,strength:70+i*10}}function Ws(e){if(e.length<re)return null;let t=ft(e.map(s=>s.trigger).filter(s=>s&&s!=="None known"));if(!t.length||t[0].count<2)return null;let a=t[0],n=Math.round(a.count/e.length*100);return{id:"trigger",tone:"watch",icon:"bolt",title:`"${a.value}" is your most logged trigger`,detail:`You recorded it for ${M(a.count,"seizure")} out of ${e.length}. `+(t.length>1?`Next most common: ${t.slice(1,3).map(s=>`${s.value} (${s.count})`).join(", ")}.`:"It is the only trigger you have logged so far."),evidence:`${a.count}/${e.length} seizures \xB7 ${n}%`,strength:60+n/2}}var Gt=[{from:0,to:4,label:"late at night (12am\u20134am)"},{from:4,to:8,label:"early in the morning (4am\u20138am)"},{from:8,to:12,label:"in the morning (8am\u201312pm)"},{from:12,to:16,label:"in the early afternoon (12pm\u20134pm)"},{from:16,to:20,label:"in the late afternoon (4pm\u20138pm)"},{from:20,to:24,label:"in the evening (8pm\u201312am)"}];function Ys(e){if(e.length<re)return null;let t=new Array(Gt.length).fill(0);for(let s of e){let r=ne(s.at).getHours();t[Gt.findIndex(i=>r>=i.from&&r<i.to)]++}let a=0;for(let s=1;s<t.length;s++)t[s]>t[a]&&(a=s);if(t[a]<2)return null;let n=Math.round(t[a]/e.length*100);return n<50?null:{id:"time-of-day",tone:"neutral",icon:"clock",title:`Most of your seizures happen ${Gt[a].label}`,detail:`${t[a]} of ${e.length} fell in that window. If it holds up, it is worth asking whether your dose timing lines up with it.`,evidence:`${t[a]}/${e.length} seizures \xB7 ${n}%`,strength:40+n/2}}function _s(e){if(e.length<re)return null;let t=ft(e.map(n=>n.place).filter(Boolean));if(!t.length)return null;let a=e.filter(n=>/school/i.test(n.place||"")).length;return a<2&&t[0].count<2?null:{id:"place",tone:"neutral",icon:"pin",title:a>=2?`${a} of ${e.length} happened at school`:`Most often at: ${t[0].value}`,detail:a>=2?"Worth making sure the staff actually around you \u2014 not just the front office \u2014 have seen your safety card. Printing it from the Safety tab is the easiest way.":`You logged ${M(t[0].count,"seizure")} there out of ${e.length}.`,evidence:a>=2?`${a}/${e.length} seizures`:`${t[0].count}/${e.length} seizures`,strength:35}}function Ks(e){let t=Jt(e,14),a=Jt(e,45,14);if(t.total<10||a.total<10)return null;let n=Math.round(t.good/t.total*100),s=Math.round(a.good/a.total*100),r=n-s;if(Math.abs(r)<8)return null;let i=r>0;return{id:"adherence-trend",tone:i?"good":"alert",icon:i?"trend-up":"trend-down",title:i?`Your dose consistency is up ${r} points`:`Your dose consistency has slipped ${Math.abs(r)} points`,detail:`${n}% of doses taken on time over the last 14 days, against ${s}% in the month before.`+(i?" Keep going.":" Worth a look at which dose is slipping."),evidence:`${t.good}/${t.total} recent \xB7 ${a.good}/${a.total} before`,strength:i?50:85}}function Vs(e){if(e.length<4)return null;let t=f(),a=e.map(ie).sort()[0],n=Be(a,t);if(n<30)return null;let s=Math.floor(n/2),r=E(t,-s),i=e.filter(p=>ie(p)>r).length,l=e.length-i;if(i===l)return null;let d=i<l;return{id:"frequency",tone:d?"good":"alert",icon:d?"sun":"alert",title:d?"Fewer seizures in the most recent stretch":"More seizures in the most recent stretch",detail:`${M(i,"seizure")} in the last ${s} days, against ${l} in the ${s} days before. Over a window this short a change like this can easily be chance \u2014 worth watching, not concluding.`,evidence:`${i} recent vs ${l} earlier`,strength:d?45:80}}function ce(e){let t=e.seizures||[],a=f(),{good:n,total:s}=Jt(e,30),r=s?Math.round(n/s*100):null,i=t.length?t.map(ie).sort().pop():null,l=i?Be(i,a):null,d=t.filter(g=>Be(ie(g),a)<=30).length,p=t.map(g=>g.duration).filter(g=>g>0),y=p.length?Math.round(qe(p)):null;return{adherence:r,adherenceGood:n,adherenceTotal:s,daysSince:l,lastSeizure:i,seizuresLast30:d,totalSeizures:t.length,avgDuration:y,avgDurationLabel:y?ze(y):null,streak:qs(e)}}function Nn(e,t=28){let a=new Set((e.seizures||[]).map(ie)),n=f();return Ea(t).map(s=>{let r=0,i=0,l="none";for(let{med:d,time:p}of L(s,e)){let y=s===n?H(s,d.id,p,e):De(s,d.id,p,e);y!=="pending"&&(i++,y==="taken"&&r++,y==="missed"?l="missed":y==="late"&&l!=="missed"?l="late":l==="none"&&(l="taken"))}return{day:s,taken:r,total:i,status:i===0?"none":l,seizure:a.has(s)}})}function Ln(){let e=new Date().getHours();return e<5?"Hi":e<12?"Good morning":e<18?"Good afternoon":"Good evening"}function Xs(e){let t=(e.profile.name||"").split(" ")[0];return t?`${Ln()}, ${t}`:Ln()}function Gs(e){if(!K(e).length)return"No medications added yet";let t=Qt(e).filter(a=>a.status==="pending").length;return t?`${M(t,"dose")} left to log today`:"Every dose logged for today"}function Qt(e){let t=f();return L(t,e).map(({med:a,time:n})=>({med:a,time:n,status:H(t,a.id,n,e)}))}function Js(e){let t=Qt(e).filter(i=>i.status==="pending");if(!t.length)return null;let a=D(X()),n=i=>a-D(i.time),s=t.find(i=>n(i)>=0&&n(i)<=Je);if(s)return{...s,mode:"due",others:t.length-1};let r=t.filter(i=>n(i)>Je);return r.length?{...r[r.length-1],mode:"overdue",others:t.length-1}:{...t[0],mode:"upcoming",others:t.length-1}}function Us(e){let t=E(f(),1);return L(t,e)[0]||null}function Qs(e){let t=K(e).length>0,a=ce(e),n=Dn(e),s=!!Oe(f(),e);return h`
    <div class="home-grid">
      <div class="home-main">
        ${o(t?eo(e):to())}
        ${o(t?so(e):"")}
      </div>
      <div class="home-side">
        ${o(Zs())}
        ${o(ao(a))}
        ${o(s?"":oo())}
        ${o(n?ro(n):"")}
        ${o(io())}
      </div>
    </div>
  `}function Zs(){let e=new Date;return e.getMonth()!==2||e.getDate()!==26?"":h`
    <section class="card purple-day" aria-label="Purple Day">
      <span class="purple-day-ico">${o(c("ribbon",22))}</span>
      <div class="grow">
        <span class="eyebrow">Today is Purple Day</span>
        <p class="purple-day-t">The world's day for epilepsy awareness</p>
        <p class="t-sm ink-2">
          A good day to show friends and teachers your safety card, so they
          know what to do if you have a seizure.
        </p>
        <button class="btn btn-primary mt-3" data-action="nav" data-to="safety">
          ${o(c("shield",16))} Open my safety card
        </button>
      </div>
    </section>
  `}function eo(e){let t=Js(e);if(!t){let i=Us(e);return h`
      <section class="card next-dose" data-state="clear" aria-label="Today's doses">
        <span class="eyebrow">Today</span>
        <div class="next-dose-when">All done</div>
        <span class="next-dose-what">
          Every dose today is logged.${o(i?` First one tomorrow: ${u(i.med.name)} at ${I(i.time)}.`:"")}
        </span>
      </section>
    `}let a=D(t.time)-D(X()),n=t.mode==="overdue"?`${We(-a)} overdue`:t.mode==="due"||a<=1?"Due now":`in ${We(a)}`,s=t.mode==="overdue"?"Not logged yet":t.mode==="due"?"Take it now":"Next dose",r=t.mode==="overdue"?`<button class="btn btn-on-brand" data-action="dose-quick"
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
      <span class="eyebrow">${s}</span>
      <div class="next-dose-when">${n}</div>
      <span class="next-dose-what">
        ${t.med.name}${t.med.dose?` ${t.med.dose}`:""} · ${I(t.time)}
      </span>
      <div class="next-dose-actions">${o(r)}</div>
      ${o(t.others>0?`<button class="next-dose-more" data-action="nav" data-to="meds">
             ${t.others} more ${t.mode==="upcoming"?"later today":"to log today"} ${c("chevron",14)}
           </button>`:"")}
    </section>
  `}function to(){return h`
    <section class="card next-dose" data-state="empty" aria-label="Get started">
      <span class="eyebrow">Get started</span>
      <div class="next-dose-when next-dose-when-sm">Add your first medication</div>
      <span class="next-dose-what">
        Name, dose, and the times you take it. About twenty seconds — then
        every dose gets tracked from today on.
      </span>
      <div class="next-dose-actions">
        <button class="btn btn-on-brand" data-action="med-open">
          ${o(c("plus",18))} Add a medication
        </button>
      </div>
    </section>
  `}function ao(e){let t=e.adherence==null?"":e.adherence>=90?"ok":e.adherence>=75?"warn":"bad";return h`
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
  `}var no={taken:"\u2713",late:"!",missed:"\u2715",pending:""};function so(e){let t=Qt(e),a=f(),n=t.map(s=>{let r=Ce(s.status,s.time);return`
      <li class="dose-row">
        <span class="med-dot" data-color="${u(s.med.color)}" aria-hidden="true">${c("pill",20)}</span>
        <span class="dose-body">
          <span class="dose-name">${u(s.med.name)} <span class="dose-amt">${u(s.med.dose)}</span></span>
          <span class="dose-meta" data-status="${s.status}">${I(s.time)} \xB7 ${r}</span>
        </span>
        <button class="tick" data-status="${s.status}" data-action="dose-cycle"
                data-med="${s.med.id}" data-time="${s.time}" data-day="${a}"
                aria-label="${u(s.med.name)} at ${I(s.time)}: ${r}. Tap to change.">
          ${no[s.status]}
        </button>
      </li>`}).join("");return h`
    <section class="section" aria-labelledby="today-h">
      <div class="section-head">
        <h2 id="today-h">Today</h2>
        <button class="btn btn-sm btn-quiet" data-action="nav" data-to="meds">All meds</button>
      </div>
      <div class="card card-flush">
        <ul class="rows">${o(n)}</ul>
      </div>
      <p class="hint">Tap a circle to cycle: taken → late → missed → not logged.</p>
    </section>
  `}function oo(){return h`
    <button class="card card-tap checkin-cta" data-action="checkin-open">
      <span class="row">
        <span class="med-dot" data-color="blue" aria-hidden="true">${o(c("moon",20))}</span>
        <span class="row-body">
          <span class="row-t">How did you sleep?</span>
          <span class="row-s">Ten-second check-in. Sleep and stress are what the pattern finder compares against.</span>
        </span>
        <span class="chev">${o(c("chevron"))}</span>
      </span>
    </button>
  `}function ro(e){return h`
    <section class="section" aria-labelledby="insight-h">
      <div class="section-head">
        <h2 id="insight-h">Worth knowing</h2>
        <button class="btn btn-sm btn-quiet" data-action="open-patterns">All patterns</button>
      </div>
      <div class="insight" data-tone="${e.tone}">
        <span class="insight-ico" aria-hidden="true">${o(c(e.icon,20))}</span>
        <span class="insight-body">
          <span class="insight-t">${e.title}</span>
          <span class="insight-d">${e.detail}</span>
          <span class="insight-e">${e.evidence}</span>
        </span>
      </div>
    </section>
  `}function io(){return h`
    <div class="quick-grid">
      <button class="quick" data-action="seizure-open">
        <span class="quick-ico" data-tone="violet" aria-hidden="true">${o(c("note",20))}</span>
        <span class="quick-t">Log a seizure</span>
        <span class="quick-s">Half-filled is fine</span>
      </button>
      <button class="quick" data-action="open-emergency">
        <span class="quick-ico" data-tone="rose" aria-hidden="true">${o(c("shield",20))}</span>
        <span class="quick-t">Emergency card</span>
        <span class="quick-s">With a seizure timer</span>
      </button>
    </div>
  `}var co={async"dose-quick"(e){let{med:t,time:a,status:n}=e.dataset;await Ge(f(),t,a,n),m(n==="taken"?"Marked taken":n==="late"?"Marked taken late":"Marked missed",n==="missed"?"default":"ok")}};var ta={};Ee(ta,{actions:()=>xo,render:()=>bo,subtitle:()=>go,title:()=>yo});var lo=["violet","mint","amber","rose","blue"],uo={violet:"Violet",mint:"Mint",amber:"Amber",rose:"Rose",blue:"Blue"},po={violet:"brand",mint:"ok",amber:"warn",rose:"bad",blue:"info"},ho=["tablet","capsule","liquid","patch","injection","other"],mo={taken:"\u2713",late:"!",missed:"\u2715",pending:""},fo={taken:"Taken",late:"Taken late",missed:"Missed",pending:"Not logged"},w=null;function yo(){return"Medications"}function go(e){let t=K(e);if(!t.length)return"Nothing added yet";let a=t.reduce((n,s)=>n+J(s).length,0);return`${M(t.length,"medication")} \xB7 ${M(a,"dose")} a day`}function bo(e){let t=K(e),a=e.meds.filter(n=>!Tt(n));return t.length?h`
    <div class="split-grid">
      <div class="split-main">
        ${o(vo(e))}
        ${o($o(t))}
        ${o(a.length?jn(a):"")}
      </div>
      <div class="split-side">
        ${o(wo(e))}
      </div>
    </div>
  `:h`
      <div class="card">
        <div class="empty">
          <span class="empty-ico" aria-hidden="true">${o(c("pill",32))}</span>
          <span class="empty-t">No medications yet</span>
          <span class="empty-s">
            Add what you take and when. Every dose gets tracked from today,
            building a history you can actually show a doctor.
          </span>
          <button class="btn btn-primary" data-action="med-open">
            ${o(c("plus",18))} Add a medication
          </button>
        </div>
      </div>
      ${o(a.length?jn(a):"")}
    `}function Hn(e,t,a,n,s){return`
    <li class="dose-row">
      <span class="med-dot" data-color="${u(t.color)}" aria-hidden="true">${c("pill",20)}</span>
      <span class="dose-body">
        <span class="dose-name">${u(t.name)} <span class="dose-amt">${u(t.dose)}</span></span>
        <span class="dose-meta" data-status="${n}">${I(a)} \xB7 ${u(s)}</span>
      </span>
      <button class="tick" data-status="${n}" data-action="dose-cycle"
              data-med="${t.id}" data-time="${a}" data-day="${e}"
              aria-label="${u(t.name)} at ${I(a)}: ${u(s)}. Tap to change.">
        ${mo[n]}
      </button>
    </li>`}function vo(e){let t=f(),a=L(t,e).map(({med:n,time:s})=>{let r=H(t,n.id,s,e);return Hn(t,n,s,r,Ce(r,s))}).join("");return h`
    <section class="section" aria-labelledby="meds-today-h">
      <div class="section-head">
        <h2 id="meds-today-h">Today</h2>
        <span class="t-sm ink-3">${R(t,{relative:!1})}</span>
      </div>
      <div class="card card-flush">
        <ul class="rows">${o(a)}</ul>
      </div>
      <p class="hint">Tap a circle to cycle: taken → late → missed → not logged.</p>
    </section>
  `}function wo(e){let t=Nn(e,28),a=f(),n=te(t[0].day).getDay(),s=[0,1,2,3,4,5,6].map(l=>`<div class="cal-dow" aria-hidden="true">${Aa(l).slice(0,2)}</div>`).join(""),r='<div aria-hidden="true"></div>'.repeat(n),i=t.map(l=>{let d=te(l.day).getDate(),p=l.total?`${l.taken} of ${l.total} doses on time`:l.day===a?"nothing logged yet":"no doses scheduled",y=`${R(l.day,{relative:!1})}: ${p}`+(l.seizure?", seizure logged":"");return`
      <button class="cal-day" data-status="${l.status}" data-today="${l.day===a}"
              data-seizure="${l.seizure}" data-action="cal-day" data-day="${l.day}"
              aria-label="${u(y)}" title="${u(y)}">${d}</button>`}).join("");return h`
    <section class="section" aria-labelledby="cal-h">
      <div class="section-head">
        <h2 id="cal-h">Last four weeks</h2>
      </div>
      <div class="card">
        <div class="cal">${o(s)}${o(r)}${o(i)}</div>
        <div class="cal-legend">
          <span class="cal-key"><span class="cal-swatch" data-k="taken"></span>All on time</span>
          <span class="cal-key"><span class="cal-swatch" data-k="late"></span>Late</span>
          <span class="cal-key"><span class="cal-swatch" data-k="missed"></span>Missed</span>
          <span class="cal-key"><span class="cal-swatch" data-k="seizure"></span>Seizure</span>
        </div>
        <p class="hint cal-hint">Tap a day to see or fix what was logged.</p>
      </div>
    </section>
  `}function $o(e){let t=e.map(a=>{let n=J(a);return`
      <li>
        <button class="list-row" data-action="med-open" data-id="${a.id}">
          <span class="med-dot" data-color="${u(a.color)}" aria-hidden="true">${c("pill",20)}</span>
          <span class="row-body">
            <span class="row-t">${u(a.name)} <span class="dose-amt">${u(a.dose)}</span></span>
            <span class="row-s">${n.length?n.map(I).join(" \xB7 "):"No times set"}</span>
            ${a.notes?`<span class="row-note">${u(a.notes)}</span>`:""}
          </span>
          <span class="chev">${c("chevron")}</span>
        </button>
      </li>`}).join("");return h`
    <section class="section" aria-labelledby="meds-list-h">
      <div class="section-head">
        <h2 id="meds-list-h">Your medications</h2>
        <button class="btn btn-sm btn-soft" data-action="med-open">${o(c("plus",16))} Add</button>
      </div>
      <div class="card card-flush">
        <ul class="rows">${o(t)}</ul>
      </div>
    </section>
  `}function jn(e){let t=e.map(a=>`
    <li class="list-row list-row-static">
      <span class="med-dot" data-color="${u(a.color)}" data-muted="true" aria-hidden="true">${c("archive",18)}</span>
      <span class="row-body">
        <span class="row-t">${u(a.name)} <span class="dose-amt">${u(a.dose)}</span></span>
        <span class="row-s">Stopped ${R(a.ended,{relative:!1})} \xB7 history kept</span>
      </span>
      <button class="btn btn-sm btn-quiet" data-action="med-restart" data-id="${a.id}">Restart</button>
    </li>`).join("");return h`
    <details class="stopped">
      <summary>
        <span>Stopped medications</span>
        <span class="pill">${e.length}</span>
      </summary>
      <div class="card card-flush">
        <ul class="rows">${o(t)}</ul>
      </div>
      <p class="hint">
        Their doses still count for the days they were being taken — stopping a
        medication shouldn't rewrite the record a neurologist will ask about.
      </p>
    </details>
  `}function Pn(){let e=w.times.map((n,s)=>`
    <div class="input-row">
      <input class="input" type="time" value="${u(n)}" data-time-index="${s}"
             aria-label="Dose time ${s+1}" required />
      ${w.times.length>1?`<button type="button" class="icon-btn" data-action="med-time-remove" data-index="${s}"
                   aria-label="Remove time ${s+1}">${c("trash",20)}</button>`:""}
    </div>`).join(""),t=lo.map(n=>`
    <button type="button" class="chip chip-color" data-action="med-color" data-value="${n}"
            aria-pressed="${n===w.color}">
      <span class="cal-swatch" style="background:var(--${po[n]})"></span>${uo[n]}
    </button>`).join(""),a=ho.map(n=>`<option value="${n}" ${n===w.form?"selected":""}>${n[0].toUpperCase()}${n.slice(1)}</option>`).join("");return h`
    <form class="stack stack-5" data-action="med-save" novalidate>
      <div class="field">
        <label class="label" for="med-name">Name</label>
        <input class="input" id="med-name" name="name" value="${w.name}"
               placeholder="e.g. Levetiracetam" autocomplete="off" required maxlength="120" />
      </div>

      <div class="input-row">
        <div class="field grow">
          <label class="label" for="med-dose">Dose</label>
          <input class="input" id="med-dose" name="dose" value="${w.dose}"
                 placeholder="500 mg" autocomplete="off" maxlength="60" />
        </div>
        <div class="field grow">
          <label class="label" for="med-form">Form</label>
          <select class="select" id="med-form" name="form">${o(a)}</select>
        </div>
      </div>

      <div class="field">
        <span class="label" id="times-label">Times each day</span>
        <div class="stack stack-2" role="group" aria-labelledby="times-label">${o(e)}</div>
        <button type="button" class="btn btn-sm btn-quiet self-start" data-action="med-time-add">
          ${o(c("plus",16))} Add another time
        </button>
        ${o(w.id?'<span class="hint">Changing times applies from today. Earlier days keep the schedule they actually had.</span>':"")}
      </div>

      <div class="field">
        <span class="label" id="color-label">Colour</span>
        <div class="chips" role="group" aria-labelledby="color-label">${o(t)}</div>
      </div>

      <div class="field">
        <label class="label" for="med-notes">Notes <span class="ink-faint">(optional)</span></label>
        <textarea class="textarea" id="med-notes" name="notes" maxlength="600"
                  placeholder="Take with food">${w.notes}</textarea>
      </div>
    </form>
  `}function Re(){if(!w)return;let e=B();for(let t of["name","dose","form","notes"])e[t]!==void 0&&(w[t]=e[t]);F().querySelectorAll("[data-time-index]").forEach(t=>{w.times[Number(t.dataset.timeIndex)]=t.value})}function ea(e){Re();let t=F().querySelector(".sheet-body");if(t&&(t.innerHTML=Pn()),e){let a=F().querySelector(e);a&&a.focus()}}function ko(e){w=e?{id:e.id,name:e.name,dose:e.dose,form:e.form,notes:e.notes,color:e.color,times:[...J(e)]}:{id:null,name:"",dose:"",form:"tablet",times:["08:00"],notes:"",color:"violet"},w.times.length||(w.times=["08:00"]),z({title:e?"Edit medication":"Add medication",body:Pn(),footer:`
      ${e?`<button class="btn btn-danger-soft" data-action="med-stop" data-id="${e.id}">Stop taking</button>`:""}
      <button class="btn btn-primary" data-action="med-save">${e?"Save":"Add medication"}</button>
    `,onClose(){w=null}})}var So={pending:"taken",taken:"late",late:"missed",missed:"pending"};function In(e,t,a){let n=L(e,t),s=(t.seizures||[]).filter(d=>d.at.startsWith(e)),r=e<f(),i=n.map(({med:d,time:p})=>{let y=H(e,d.id,p,t),g=y!=="pending"?fo[y]:r?"Not logged \u2014 counts as missed":Ce("pending",p);return Hn(e,d,p,y,g)}).join(""),l=h`
    <div class="stack stack-4">
      ${o(s.length?`
        <div class="insight" data-tone="alert">
          <span class="insight-ico" aria-hidden="true">${c("bolt",20)}</span>
          <span class="insight-body">
            <span class="insight-t">${M(s.length,"seizure")} logged this day</span>
          </span>
        </div>`:"")}
      ${o(n.length?`<div class="card card-flush"><ul class="rows">${i}</ul></div>`:'<p class="ink-3">No doses were scheduled on this day.</p>')}
      <p class="hint">
        Back-filling is fine — an honest record a day late beats a blank one.
      </p>
    </div>
  `;if(a){let d=F().querySelector(".sheet-body");d&&(d.innerHTML=l);return}z({title:R(e,{relative:!1}),body:l})}var xo={async"dose-cycle"(e){let{med:t,time:a,day:n}=e.dataset,s=H(n,t,a),r=!!e.closest("#sheet");await Ge(n,t,a,So[s]),r&&(In(n,W(),!0),F().querySelector(`[data-action="dose-cycle"][data-med="${t}"][data-time="${a}"]`)?.focus())},"cal-day"(e,t){In(e.dataset.day,t,!1)},"med-open"(e,t){let a=e.dataset.id;ko(a?t.meds.find(n=>n.id===a):null)},"med-time-add"(){Re();let e=w.times[w.times.length-1]||"08:00",[t,a]=e.split(":").map(Number);w.times.push(`${String(((t||0)+12)%24).padStart(2,"0")}:${String(a||0).padStart(2,"0")}`),ea(`[data-time-index="${w.times.length-1}"]`)},"med-time-remove"(e){Re(),w.times.splice(Number(e.dataset.index),1),ea('[data-action="med-time-add"]')},"med-color"(e){Re(),w.color=e.dataset.value,ea(`[data-action="med-color"][data-value="${e.dataset.value}"]`)},async"med-save"(){if(Re(),!w.name.trim()){m("Give the medication a name","bad"),F().querySelector("#med-name")?.focus();return}let e=he(w.times);if(!e.length){m("Add at least one time","bad");return}let t={name:w.name,dose:w.dose,form:w.form,times:e,notes:w.notes,color:w.color},a=!!w.id;a?await Ra(w.id,t):await qa(t),T(),m(a?"Medication updated":"Added \u2014 tracking starts today","ok")},"med-stop"(e,t){let a=e.dataset.id,n=t.meds.find(r=>r.id===a),s=n&&n.added>=f();P({title:s?"Remove this medication?":`Stop taking ${n?n.name:"this"}?`,message:s?"It was only added today, so there is no history to keep. It will be removed completely.":"It will stop appearing in today's doses and reminders. Every dose already logged stays in your history and statistics, and you can restart it later. Never stop an epilepsy medication without talking to your neurologist first.",confirmLabel:s?"Remove":"Stop taking",async onConfirm(){await Fa(a),m(s?"Medication removed":"Stopped \u2014 history kept")}})},async"med-restart"(e,t){let a=t.meds.find(n=>n.id===e.dataset.id);a&&(await Ba(a.id),m(`${a.name} restarted from today`,"ok"))}};var oa={};Ee(oa,{actions:()=>Ho,logSeizure:()=>sa,render:()=>Ao,subtitle:()=>Co,title:()=>zo});var Mo=["Focal aware","Focal impaired awareness","Tonic-clonic","Absence","Myoclonic","Atonic","Not sure"],To=["Missed dose","Missed sleep","Stress","Illness or fever","Flashing lights","Skipped meal","Dehydration","Period","None known"],Eo=["Home","School \u2014 classroom","School \u2014 hallway","School \u2014 gym","School \u2014 cafeteria","Outside","In a car","Other"],qn=["","Calm","Fine","Busy","Stressed","Overwhelmed"],Me="log",b=null,j=null,Rn=e=>`${e} ${e===1?"entry":"entries"}`;function zo(){return"Seizures"}function Co(e){let t=(e.seizures||[]).length;if(!t)return"Nothing logged yet";let{daysSince:a}=ce(e);return a===0?`${Rn(t)} \xB7 one today`:`${Rn(t)} \xB7 ${M(a,"day")} since the last`}function Ao(e){return h`
    <div class="subtabs" role="tablist" aria-label="Seizure views">
      <button class="subtab" role="tab" id="tab-log" aria-controls="panel-sz"
              data-action="sz-tab" data-tab="log" aria-selected="${Me==="log"}">
        ${o(c("note",18))} Log
      </button>
      <button class="subtab" role="tab" id="tab-patterns" aria-controls="panel-sz"
              data-action="sz-tab" data-tab="patterns" aria-selected="${Me==="patterns"}">
        ${o(c("sparkle",18))} Patterns
      </button>
    </div>
    <div id="panel-sz" role="tabpanel" aria-labelledby="tab-${Me}" class="stack stack-5">
      ${o(Me==="log"?Lo(e):jo(e))}
    </div>
  `}function Do(e){let t=ne(e.at),a=[];return e.duration&&a.push(`<span class="pill">${c("timer",13)} ${ze(e.duration)}</span>`),e.trigger&&a.push(`<span class="pill pill-warn">${u(e.trigger)}</span>`),e.place&&a.push(`<span class="pill">${u(e.place)}</span>`),e.injury&&a.push('<span class="pill pill-bad">Injury</span>'),e.emsCalled&&a.push('<span class="pill pill-bad">911 called</span>'),`
    <li>
      <button class="log-entry" data-action="seizure-open" data-id="${e.id}">
        <span class="log-date" aria-hidden="true">
          <span class="log-mon">${pt(t.getMonth())}</span>
          <span class="log-day">${t.getDate()}</span>
        </span>
        <span class="log-body">
          <span class="log-t">${u(e.type||"Seizure")}</span>
          <span class="row-s">${Da(e.at)} \xB7 ${Oa(e.at)}</span>
          ${a.length?`<span class="log-meta">${a.join("")}</span>`:""}
          ${e.notes?`<span class="log-note">${u(e.notes)}</span>`:""}
        </span>
        <span class="chev">${c("chevron")}</span>
      </button>
    </li>`}function Oo(e){let t=[];for(let a of e){let n=ne(a.at),s=`${n.getFullYear()}-${n.getMonth()}`,r=t[t.length-1];(!r||r.key!==s)&&(r={key:s,label:`${pt(n.getMonth())} ${n.getFullYear()}`,items:[]},t.push(r)),r.items.push(a)}return t.map(a=>`
    <div class="month-group">
      <h3 class="eyebrow month-label">${a.label} \xB7 ${a.items.length}</h3>
      <div class="card card-flush"><ul class="rows">${a.items.map(Do).join("")}</ul></div>
    </div>`).join("")}function No(e){if(!e)return h`
      <button class="card card-tap" data-action="checkin-open">
        <span class="row">
          <span class="med-dot" data-color="blue" aria-hidden="true">${o(c("moon",20))}</span>
          <span class="row-body">
            <span class="row-t">Today's check-in</span>
            <span class="row-s">Sleep and stress, ten seconds. This is what the pattern finder compares seizures against.</span>
          </span>
          <span class="chev">${o(c("chevron"))}</span>
        </span>
      </button>
    `;let t=e.sleepHours==null?"\u2014":e.sleepHours,a=e.stress==null?"\u2014":e.stress;return h`
    <button class="card card-tap" data-action="checkin-open">
      <span class="row">
        <span class="med-dot" data-color="mint" aria-hidden="true">${o(c("check",20))}</span>
        <span class="row-body">
          <span class="row-t">Checked in today</span>
          <span class="row-s">${t} hours of sleep · stress ${a} of 5 · tap to change</span>
        </span>
        <span class="chev">${o(c("chevron"))}</span>
      </span>
    </button>
  `}function Lo(e){let t=e.seizures||[],a=Oe(f(),e);return h`
    <button class="btn btn-primary btn-lg btn-block" data-action="seizure-open">
      ${o(c("plus",20))} Log a seizure
    </button>

    ${o(No(a))}

    ${o(t.length?`
      <section class="section" aria-labelledby="hist-h">
        <h2 id="hist-h">History</h2>
        ${Oo(t)}
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
  `}function Fn(){return h`
    <div class="disclaimer">
      ${o(c("info",16))}
      <span><strong>About these patterns.</strong> ${An}</span>
    </div>
  `}function jo(e){let t=Ut(e),a=ce(e),n=(e.seizures||[]).length,s=Object.keys(e.checkins||{}).length;if(!t.length){let i=[];return n<3&&i.push(`at least 3 seizures logged (you have ${n})`),s<13&&i.push(`about two weeks of daily check-ins (you have ${s})`),h`
      <div class="card">
        <div class="empty">
          <span class="empty-ico" aria-hidden="true">${o(c("sparkle",32))}</span>
          <span class="empty-t">Nothing to report yet</span>
          <span class="empty-s">
            Synara would rather show you nothing than a coincidence dressed up
            as a finding.${i.length?` Most patterns need ${i.join(" and ")}.`:" Nothing in your log clears the bar right now \u2014 which can be good news."}
          </span>
        </div>
      </div>
      ${o(Fn())}
    `}let r=t.map(i=>`
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
      <ul class="stack stack-3">${o(r)}</ul>
    </section>

    ${o(Fn())}
  `}function aa(e,t,a){let n=t.map(s=>`
    <button type="button" class="chip" data-action="sz-chip" data-field="${e}"
            data-value="${u(s)}" aria-pressed="${s===b[e]}">${u(s)}</button>`).join("");return`
    <div class="field">
      <span class="label" id="lbl-${e}">${a}</span>
      <div class="chips" role="group" aria-labelledby="lbl-${e}">${n}</div>
    </div>`}function Wn(){let e=Math.floor(b.duration/60),t=b.duration%60,a=f();return h`
    <form class="stack stack-5" data-action="seizure-save" novalidate>
      ${o(b.fromTimer?`
        <div class="insight" data-tone="good">
          <span class="insight-ico" aria-hidden="true">${c("timer",20)}</span>
          <span class="insight-body">
            <span class="insight-t">Timed at ${ze(b.duration)}</span>
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

      ${o(aa("type",Mo,"Type"))}
      ${o(aa("trigger",To,"Possible trigger"))}
      ${o(aa("place",Eo,"Where were you?"))}

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
          <input type="checkbox" class="check" name="injury" ${o(b.injury?"checked":"")} />
        </label>
        <label class="toggle-row">
          <span class="row-body">
            <span class="row-t">Was 911 called?</span>
            <span class="row-s">Worth recording either way</span>
          </span>
          <input type="checkbox" class="check" name="emsCalled" ${o(b.emsCalled?"checked":"")} />
        </label>
      </div>

      <div class="field">
        <label class="label" for="sz-notes">Anything else</label>
        <textarea class="textarea" id="sz-notes" name="notes" maxlength="4000"
                  placeholder="What happened, who was there, how you felt afterwards…">${b.notes}</textarea>
      </div>
    </form>
  `}function na(){if(!b)return;let e=B();for(let t of["date","time","aura","notes","injury","emsCalled"])e[t]!==void 0&&(b[t]=e[t]);if(e.mins!==void 0||e.secs!==void 0){let t=Ye(Number(e.mins)||0,0,120),a=Ye(Number(e.secs)||0,0,59);b.duration=t*60+a}}function Io(e){na();let t=F().querySelector(".sheet-body");if(!t)return;let a=t.scrollTop;t.innerHTML=Wn(),t.scrollTop=a,e&&F().querySelector(e)?.focus({preventScroll:!0})}function Yn(e,t={}){if(e){let[a,n]=e.at.split("T");b={...e,date:a,time:n,fromTimer:!1}}else{let a=t.at||`${f()}T${X()}`,[n,s]=a.split("T");b={id:null,date:n,time:s,duration:t.duration||0,type:"",trigger:"",place:"",aura:"",injury:!1,emsCalled:!1,notes:"",fromTimer:!!t.duration}}z({title:e?"Edit entry":"Log a seizure",body:Wn(),footer:`
      ${e?`<button class="btn btn-danger-soft" data-action="seizure-delete" data-id="${e.id}">Delete</button>`:""}
      <button class="btn btn-primary" data-action="seizure-save">Save</button>
    `,onClose(){b=null}})}function sa(e){Yn(null,e)}function _n(){let e=[1,2,3,4,5].map(t=>`
    <button type="button" class="segment" data-action="checkin-stress" data-value="${t}"
            aria-pressed="${j.stress===t}" aria-label="${t}, ${qn[t]}">${t}</button>`).join("");return h`
    <div class="stack stack-6">
      <div class="field">
        <span class="label" id="sleep-label">How many hours did you sleep last night?</span>
        <div class="stepper" role="group" aria-labelledby="sleep-label">
          <button type="button" class="stepper-btn" data-action="checkin-sleep" data-value="-0.5"
                  aria-label="Half an hour less">−</button>
          <span class="sleep-n" aria-live="polite">${j.sleepHours}<small>h</small></span>
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
        <div class="segments" role="group" aria-labelledby="stress-label">${o(e)}</div>
        <span class="hint text-center">${qn[j.stress]||""}</span>
      </div>

      <div class="field">
        <label class="label" for="ci-notes">Anything worth noting</label>
        <textarea class="textarea" id="ci-notes" name="notes" maxlength="600"
                  placeholder="Sick, travelling, exams…">${j.notes}</textarea>
      </div>
    </div>
  `}function Bn(e){let t=B();t.notes!==void 0&&(j.notes=t.notes);let a=F().querySelector(".sheet-body");a&&(a.innerHTML=_n()),e&&F().querySelector(e)?.focus({preventScroll:!0})}var Ho={"sz-tab"(e){Me=e.dataset.tab,Mt()},"open-patterns"(){Me="patterns",location.hash==="#/track"?Mt():location.hash="#/track"},"seizure-open"(e,t){let a=e.dataset.id;Yn(a?t.seizures.find(n=>n.id===a):null)},"sz-chip"(e){na();let{field:t,value:a}=e.dataset;b[t]=b[t]===a?"":a,Io(`[data-action="sz-chip"][data-field="${t}"][data-value="${CSS.escape(a)}"]`)},async"seizure-save"(){na();let e=`${b.date}T${b.time}`;if(!b.date||!b.time||!pe(e)){m("A date and start time are needed","bad");return}if(ne(e).getTime()>Date.now()+6e4){m("That time is in the future","bad");return}let t={at:e,duration:b.duration,type:b.type,trigger:b.trigger,place:b.place,aura:b.aura,injury:!!b.injury,emsCalled:!!b.emsCalled,notes:b.notes},a=!!b.id;a?await Ya(b.id,t):await Wa(t),T(),m(a?"Entry updated":"Logged. Look after yourself today.","ok")},"seizure-delete"(e){let t=e.dataset.id;P({title:"Delete this entry?",message:"It will be removed from your history and from the pattern calculations. This can't be undone.",async onConfirm(){await _a(t),m("Entry deleted")}})},"checkin-open"(e,t){let a=f(),n=Oe(a,t);j={sleepHours:n&&n.sleepHours!=null?n.sleepHours:8,stress:n&&n.stress!=null?n.stress:2,notes:n&&n.notes||""},z({title:`Check-in \xB7 ${R(a)}`,body:_n(),footer:'<button class="btn btn-primary" data-action="checkin-save">Save check-in</button>',onClose(){j=null}})},"checkin-sleep"(e){let t=Number(e.dataset.value);j.sleepHours=Ye(Math.round((j.sleepHours+t)*2)/2,0,16),Bn(`[data-action="checkin-sleep"][data-value="${e.dataset.value}"]`)},"checkin-stress"(e){j.stress=Number(e.dataset.value),Bn(`[data-action="checkin-stress"][data-value="${e.dataset.value}"]`)},async"checkin-save"(){let e=B();e.notes!==void 0&&(j.notes=e.notes);let t=j.sleepHours;await Ka(f(),{sleepHours:t,sleepQuality:t<6?"poor":t<7?"ok":"good",stress:j.stress,mood:j.stress>=4?"low":"ok",notes:(j.notes||"").trim()}),T(),m("Checked in","ok")}};var fa={};Ee(fa,{actions:()=>Qo,render:()=>Fo,showEmergency:()=>dt,subtitle:()=>qo,title:()=>Po});function Po(){return"Safety card"}function qo(e){let t=(e.contacts||[]).length,a=`${t} ${t===1?"contact":"contacts"}`;return e.card.updated?`${a} \xB7 updated ${R(e.card.updated)}`:a}var Ro=e=>(e.name||"").trim().split(/\s+/)[0]||"";function Fo(e){let{card:t,contacts:a,profile:n}=e,s=Ro(n),r=s?`If ${s} has a seizure`:"If a seizure happens";return h`
    <div class="safety-hero">
      <div class="safety-hero-ico" aria-hidden="true">${o(c("shield",26))}</div>
      <h2>${r}</h2>
      <p>
        Written for whoever is standing there — a teacher, a coach, a stranger.
        The SOS button at the top of every screen opens the big version, with
        a seizure timer.
      </p>
      <div class="safety-hero-actions">
        <button class="btn btn-on-danger" data-action="open-emergency">
          ${o(c("shield",18))} Open emergency card
        </button>
        <button class="btn btn-on-danger-ghost" data-action="print-card">
          ${o(c("print",18))} Print for school
        </button>
      </div>
    </div>

    ${o(Bo(e))}

    <div class="split-grid">
      <div class="split-main">
        ${o(Yo(a))}
        ${o(_o(t))}
        ${o(ra("What to do",t.during,"during","ok"))}
        ${o(ra("What NOT to do",t.doNot,"doNot","bad"))}
        ${o(Ko(t))}
        ${o(ra("Afterwards",t.after,"after",""))}
      </div>
      <div class="split-side">
        ${o(Vo(e))}
        ${o(Go(t))}
      </div>
    </div>

    <div class="disclaimer">
      ${o(c("info",16))}
      <span>
        <strong>Check this with a doctor.</strong> The first-aid steps follow
        standard public seizure first aid, but every person's seizures are
        different. Confirm this card with your neurologist and school nurse
        before relying on it. Synara is a student project, not a medical device.
      </span>
    </div>
  `}function Bo(e){let t=[];if(e.contacts.length||t.push(["contact-open","","Add someone to call"]),e.profile.name||t.push(["profile-edit","","Add your name"]),e.card.looksLike||t.push(["card-edit","looksLike","Describe what your seizures look like"]),e.card.forTeacher||t.push(["card-edit","forTeacher","Add a note for teachers"]),!t.length)return"";let a=t.map(([n,s,r])=>`
    <li>
      <button class="todo-row" data-action="${n}"${s?` data-field="${s}"`:""}>
        <span class="todo-dot" aria-hidden="true"></span>
        <span class="grow">${r}</span>
        <span class="chev">${c("chevron",16)}</span>
      </button>
    </li>`).join("");return h`
    <section class="card todo-card" aria-labelledby="todo-h">
      <h2 id="todo-h" class="todo-h">${o(c("sparkle",18))} Finish your card</h2>
      <p class="t-sm ink-2">
        ${t.length===1?"One thing":`${t.length} things`} would make this
        card much more useful to whoever has to use it.
      </p>
      <ul class="todo-list">${o(a)}</ul>
    </section>
  `}function Wo(e){return`
    <li class="contact-row">
      <button class="contact-main" data-action="contact-open" data-id="${e.id}"
              aria-label="Edit ${u(e.name)}">
        <span class="avatar" aria-hidden="true">${u(_e(e.name))}</span>
        <span class="contact-body">
          <span class="contact-n">${u(e.name)}</span>
          <span class="contact-r">${e.primary?'<span class="pill pill-brand">First call</span>':""}<span class="truncate">${u(e.relation)}${e.relation?" \xB7 ":""}${u(e.phone)}</span></span>
        </span>
      </button>
      ${Vn(e)}
    </li>`}function Vn(e){return mt(e.phone)?`<a class="call-btn" href="${ht(e.phone)}" aria-label="Call ${u(e.name)}">${c("phone",16)} Call</a>`:'<span class="pill pill-warn">No number</span>'}function Yo(e){let t=e.length?`<ul class="rows">${e.map(Wo).join("")}</ul>`:`<div class="empty empty-sm">
         <span class="empty-t">No one to call yet</span>
         <span class="empty-s">The emergency card's biggest button calls whoever you put first.</span>
         <button class="btn btn-sm btn-primary" data-action="contact-open">${c("plus",16)} Add a contact</button>
       </div>`;return h`
    <section class="section" aria-labelledby="contacts-h">
      <div class="section-head">
        <h2 id="contacts-h">Who to call</h2>
        ${o(e.length?`<button class="btn btn-sm btn-soft" data-action="contact-open">${c("plus",16)} Add</button>`:"")}
      </div>
      <div class="card card-flush">${o(t)}</div>
    </section>
  `}function lt(e,t){return`<button class="btn btn-sm btn-quiet" data-action="card-edit" data-field="${e}"
                  aria-label="Edit ${u(t)}">${c("edit",15)} Edit</button>`}function _o(e){let t=e.looksLike?`<p class="prose">${u(e.looksLike)}</p>`:`<p class="ink-3">Describe what happens, so somebody who has never seen one knows what they're looking at.</p>`;return h`
    <section class="section" aria-labelledby="looks-h">
      <div class="section-head">
        <h2 id="looks-h">What it looks like</h2>
        ${o(lt("looksLike","what it looks like"))}
      </div>
      <div class="card">${o(t)}</div>
    </section>
  `}function pa(e,t){return`<ol class="steps">${e.map((a,n)=>`
    <li class="step" data-tone="${t}">
      <span class="step-n" aria-hidden="true">${t==="bad"?"\u2715":t==="ems"?"!":n+1}</span>
      <span>${u(a)}</span>
    </li>`).join("")}</ol>`}function ra(e,t,a,n){let s=`sec-${a}`,r=t&&t.length?pa(t,n):'<p class="ink-3">Nothing added yet.</p>';return h`
    <section class="section" aria-labelledby="${s}">
      <div class="section-head">
        <h2 id="${s}">${e}</h2>
        ${o(lt(a,e))}
      </div>
      <div class="card">${o(r)}</div>
    </section>
  `}function Ko(e){let t=e.callEms||[];return h`
    <section class="section" aria-labelledby="sec-ems">
      <div class="section-head">
        <h2 id="sec-ems">Call 911 if…</h2>
        ${o(lt("callEms","when to call 911"))}
      </div>
      <div class="card ems-card">${o(t.length?pa(t,"ems"):'<p class="ink-3">Nothing added yet.</p>')}</div>
    </section>
  `}function Vo(e){let{profile:t}=e,a=K(e),n=[["Seizure type",t.seizureType],["Allergies",t.allergies],["Blood type",t.bloodType],["Neurologist",[t.neurologist,t.neuroPhone].filter(Boolean).join(" \xB7 ")]].filter(([,i])=>i),s=a.length?a.map(i=>`${u(i.name)}${i.dose?` ${u(i.dose)}`:""}`).join(", "):'<span class="ink-faint">None added</span>',r=n.map(([i,l])=>`<div class="kv-row"><dt class="kv-k">${i}</dt><dd class="kv-v">${u(l)}</dd></div>`).join("");return h`
    <section class="section" aria-labelledby="medical-h">
      <div class="section-head">
        <h2 id="medical-h">Medical details</h2>
        <button class="btn btn-sm btn-quiet" data-action="profile-edit">${o(c("edit",15))} Edit</button>
      </div>
      <div class="card card-flush">
        <dl class="kv">
          ${o(r)}
          <div class="kv-row"><dt class="kv-k">Current meds</dt><dd class="kv-v">${o(s)}</dd></div>
        </dl>
      </div>
      <p class="hint">Shown on the emergency card and the printed copy — it's what paramedics ask for.</p>
    </section>
  `}var Xo=[{field:"forTeacher",label:"For teachers",icon:"school"},{field:"forNurse",label:"For the school nurse",icon:"stethoscope"},{field:"forCoach",label:"For coaches and PE",icon:"run"}];function Go(e){let t=Xo.map(a=>`
    <div class="card role-card">
      <div class="card-head">
        <h3>${c(a.icon,18)} ${a.label}</h3>
        ${lt(a.field,a.label)}
      </div>
      ${e[a.field]?`<p class="prose">${u(e[a.field])}</p>`:`<p class="ink-3 t-sm">Nothing added yet \u2014 what should this person know that isn't in the steps?</p>`}
    </div>`).join("");return h`
    <section class="section" aria-labelledby="roles-h">
      <h2 id="roles-h">Specific instructions</h2>
      <div class="stack stack-3">${o(t)}</div>
    </section>
  `}var da="synara.timer",Xn=300,ct=null,Z=null,Te=null;function ha(){try{let e=JSON.parse(sessionStorage.getItem(da)||"null");if(e&&typeof e.ms=="number"&&Date.now()-e.ms<10800*1e3)return e}catch{}return null}function ia(e){try{e?sessionStorage.setItem(da,JSON.stringify(e)):sessionStorage.removeItem(da)}catch{}}var ca=e=>`${Math.floor(e/60)}:${String(e%60).padStart(2,"0")}`;function Gn(){return`
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
    </section>`}function ma(e,t,a){let n=e.querySelector(".em-timer");if(!n)return;let s=n.querySelector("[data-timer-clock]"),r=n.querySelector("[data-timer-hint]"),i=n.querySelector("[data-timer-actions]"),l=n.dataset.state!==t;if(n.dataset.state=t,s.textContent=ca(a),t==="running"||t==="over"){let d=t==="over";r.textContent=d?"Over 5 minutes \u2014 call 911 now":`Call 911 if it reaches 5:00 \xB7 ${ca(Math.max(0,Xn-a))} to go`,l&&(i.innerHTML=`
        ${d?`<a class="btn btn-lg btn-block btn-emergency" href="tel:911">${c("phone",20)} Call 911 now</a>`:""}
        <button class="btn btn-lg btn-block ${d?"btn-on-danger-ghost":"btn-outline"}" data-action="timer-stop">
          ${c("stop",18)} It stopped
        </button>`)}else t==="stopped"&&(r.textContent=`It lasted ${ca(a)}`,i.innerHTML=`
      <button class="btn btn-lg btn-block btn-primary" data-action="timer-log">${c("note",18)} Log this seizure</button>
      <button class="btn btn-block btn-quiet" data-action="timer-reset">Reset timer</button>`)}function Jn(e){clearInterval(ct);let t=e.querySelector("[data-timer-live]"),a=-1,n=!1,s=()=>{let r=ha();if(!r)return;let i=Math.max(0,Math.floor((Date.now()-r.ms)/1e3)),l=i>=Xn;ma(e,l?"over":"running",i);let d=Math.floor(i/60);t&&d!==a&&d>0&&(t.textContent=l&&!n?"Five minutes. Call 911 now.":`${d} ${d===1?"minute":"minutes"}`,l&&(n=!0)),a=d};s(),ct=setInterval(s,1e3)}function ua(){clearInterval(ct),ct=null}function le(e,t,a=""){return`
    <section class="em-block"${a?` data-tone="${a}"`:""}>
      <h3>${e}</h3>
      ${t}
    </section>`}function dt(e){let{card:t,contacts:a,profile:n}=e,s=a.filter(x=>mt(x.phone)),r=s.find(x=>x.primary)||s[0],i=a.filter(x=>x!==r),l=K(e),d=n.name||"This student",p=[n.grade,n.school].filter(Boolean).join(" \xB7 "),y=r?`
    <a class="em-call" href="${ht(r.phone)}">
      <span class="em-call-ico" aria-hidden="true">${c("phone",22)}</span>
      <span class="em-call-body">
        <span class="em-call-n">Call ${u(r.name)}</span>
        <span class="em-call-r">${u(r.relation)}${r.relation?" \xB7 ":""}${u(r.phone)}</span>
      </span>
    </a>`:"",g=i.length?le("Other contacts",`
    <ul class="rows">${i.map(x=>`
      <li class="contact-row contact-row-flat">
        <span class="contact-body">
          <span class="contact-n">${u(x.name)}</span>
          <span class="contact-r"><span class="truncate">${u(x.relation)}</span></span>
        </span>
        ${Vn(x)}
      </li>`).join("")}</ul>`):"",C=[n.seizureType&&`<div class="kv-row"><dt class="kv-k">Seizure type</dt><dd class="kv-v">${u(n.seizureType)}</dd></div>`,n.allergies&&`<div class="kv-row"><dt class="kv-k">Allergies</dt><dd class="kv-v">${u(n.allergies)}</dd></div>`,l.length&&`<div class="kv-row"><dt class="kv-k">Medications</dt><dd class="kv-v">${l.map(x=>`${u(x.name)} ${u(x.dose)}`).join(", ")}</dd></div>`,n.neurologist&&`<div class="kv-row"><dt class="kv-k">Neurologist</dt><dd class="kv-v">${u(n.neurologist)}${n.neuroPhone?` \xB7 ${u(n.neuroPhone)}`:""}</dd></div>`].filter(Boolean).join(""),A=(x,is)=>x&&x.length?pa(x,is):"",$=h`
    <div class="em-bar">
      <span class="em-bar-t">${o(c("shield",20))} Seizure — what to do</span>
      <button class="em-close" data-action="close-emergency">Close</button>
    </div>

    <div class="em-body">
      <div class="em-inner">
        <header class="em-who">
          <h2 class="em-name">${d}</h2>
          ${o(p?`<span class="em-sub">${u(p)}</span>`:"")}
        </header>

        ${o(Gn())}

        <div class="em-calls">
          ${o(y)}
          <a class="em-911" href="tel:911">${o(c("phone",22))} Call 911</a>
        </div>

        ${o(t.during&&t.during.length?le("What to do right now",A(t.during,"ok")):"")}
        ${o(t.callEms&&t.callEms.length?le("Call 911 if",A(t.callEms,"ems"),"bad"):"")}
        ${o(t.doNot&&t.doNot.length?le("Do NOT",A(t.doNot,"bad")):"")}
        ${o(t.looksLike?le("What their seizures look like",`<p class="prose">${u(t.looksLike)}</p>`):"")}
        ${o(t.after&&t.after.length?le("Afterwards",A(t.after,"")):"")}
        ${o(C?le("Medical details",`<dl class="kv kv-flat">${C}</dl>`):"")}
        ${o(g)}

        <p class="em-foot">Standard seizure first aid. If in doubt, call 911.</p>
      </div>
    </div>
  `;sn($,{onMount(x){ha()?(Jn(x),x.querySelector('[data-action="timer-stop"]')?.focus({preventScroll:!0})):Z!=null&&ma(x,"stopped",Z)},onClose:ua})}function Jo(e){let{card:t,contacts:a,profile:n}=e,s=K(e),r=(d,p="")=>d&&d.length?`<ol class="${p}">${d.map(y=>`<li>${u(y)}</li>`).join("")}</ol>`:"",i=[["Grade / school",[n.grade,n.school].filter(Boolean).join(", ")],["Seizure type",n.seizureType],["Allergies",n.allergies],["Medications",s.map(d=>`${d.name} ${d.dose} (${J(d).map(I).join(", ")})`).join("; ")],["Neurologist",[n.neurologist,n.neuroPhone].filter(Boolean).join(" \u2014 ")]].filter(([,d])=>d),l=[["forTeacher","Teachers"],["forNurse","School nurse"],["forCoach","Coaches and PE"]].filter(([d])=>t[d]);return`
    <article class="pc">
      <header class="pc-head">
        <div>
          <p class="pc-kicker">Seizure action card</p>
          <h1 class="pc-name">${u(n.name||"Student name")}</h1>
        </div>
        <div class="pc-911">In an emergency<strong>Call 911</strong></div>
      </header>

      ${i.length?`<dl class="pc-facts">${i.map(([d,p])=>`<div><dt>${d}</dt><dd>${u(p)}</dd></div>`).join("")}</dl>`:""}

      ${t.looksLike?`<section><h2>What their seizures look like</h2><p>${u(t.looksLike)}</p></section>`:""}

      <div class="pc-cols">
        <section><h2>What to do</h2>${r(t.during)}</section>
        <section><h2>Do NOT</h2>${r(t.doNot,"pc-not")}</section>
      </div>

      <section class="pc-ems"><h2>Call 911 if</h2>${r(t.callEms)}</section>

      <div class="pc-cols">
        <section><h2>Afterwards</h2>${r(t.after)}</section>
        <section>
          <h2>Who to call</h2>
          ${a.length?`<table class="pc-contacts"><tbody>${a.map(d=>`
            <tr><td><strong>${u(d.name)}</strong>${d.primary?" (call first)":""}<br>${u(d.relation)}</td><td>${u(d.phone)}</td></tr>`).join("")}
          </tbody></table>`:"<p>No contacts added.</p>"}
        </section>
      </div>

      ${l.length?`<section class="pc-roles">${l.map(([d,p])=>`<div><h3>${p}</h3><p>${u(t[d])}</p></div>`).join("")}</section>`:""}

      <footer class="pc-foot">
        Printed ${R(f(),{relative:!1})}${t.updated?` \xB7 card last updated ${R(t.updated,{relative:!1})}`:""}.
        Standard seizure first aid \u2014 confirm with the student's neurologist. Made with Synara.
      </footer>
    </article>`}var Kn=new Set(["during","doNot","after","callEms"]),la={looksLike:"What their seizures look like",during:"What to do",doNot:"What NOT to do",after:"Afterwards",callEms:"Call 911 if\u2026",forTeacher:"For teachers",forNurse:"For the school nurse",forCoach:"For coaches and PE"},Uo={looksLike:"Plain words beat medical terms \u2014 a substitute teacher has to recognise this.",forTeacher:"What should happen in class? Who do they send for? Anything in a 504 plan?",forNurse:"Rescue medication, who to call first, where they like to recover.",forCoach:"Activity limits, water rules, whether they can return to play the same day."},Qo={"card-edit"(e,t){let a=e.dataset.field;if(!la[a])return;let n=Kn.has(a),s=t.card[a],r=n?(s||[]).join(`
`):s||"";z({title:la[a],body:h`
        <div class="field">
          <label class="label" for="card-text">
            ${n?"One step per line":"Write it the way you would say it out loud"}
          </label>
          <textarea class="textarea textarea-tall" id="card-text" name="text" maxlength="4000">${r}</textarea>
          <span class="hint">
            ${n?"Each line becomes a numbered step on the card.":Uo[a]||""}
          </span>
        </div>
      `,footer:`<button class="btn btn-primary" data-action="card-save" data-field="${a}">Save</button>`})},async"card-save"(e){let t=e.dataset.field;if(!la[t])return;let a=B().text||"",n=Kn.has(t)?a.split(`
`).map(s=>s.replace(/^\s*(\d+[.)]|[-*•])\s*/,"").trim()).filter(Boolean):a.trim();await Ja({[t]:n}),T(),m("Safety card updated","ok")},"contact-open"(e,t){let a=e.dataset.id,n=a?t.contacts.find(i=>i.id===a):null,s=n||{name:"",relation:"",phone:"",primary:!t.contacts.length},r=n?` data-id="${n.id}"`:"";z({title:n?"Edit contact":"Add contact",body:h`
        <form class="stack stack-5" data-action="contact-save"${o(r)} novalidate>
          <div class="field">
            <label class="label" for="c-name">Name</label>
            <input class="input" id="c-name" name="name" value="${s.name}"
                   placeholder="Dana Ellison" autocomplete="off" maxlength="120" required />
          </div>
          <div class="field">
            <label class="label" for="c-rel">Relationship</label>
            <input class="input" id="c-rel" name="relation" value="${s.relation}"
                   placeholder="Mom, school nurse, coach…" autocomplete="off" maxlength="80" />
          </div>
          <div class="field">
            <label class="label" for="c-phone">Phone</label>
            <input class="input" id="c-phone" name="phone" type="tel" inputmode="tel" value="${s.phone}"
                   placeholder="(555) 014-2007" autocomplete="off" maxlength="40" required />
          </div>
          <div class="card card-flush">
            <label class="toggle-row">
              <span class="row-body">
                <span class="row-t">Call this person first</span>
                <span class="row-s">They become the big green button on the emergency card</span>
              </span>
              <input type="checkbox" class="check" name="primary" ${o(s.primary?"checked":"")} />
            </label>
          </div>
        </form>
      `,footer:`
        ${n?`<button class="btn btn-danger-soft" data-action="contact-delete" data-id="${n.id}">Delete</button>`:""}
        <button class="btn btn-primary" data-action="contact-save"${r}>Save</button>
      `})},async"contact-save"(e){let t=e.dataset.id||null,a=B();if(!a.name||!a.name.trim()){m("A name is needed","bad");return}if((String(a.phone||"").match(/\d/g)||[]).length<3){m("That phone number doesn't look complete","bad");return}let n={name:a.name,relation:a.relation||"",phone:a.phone,primary:!!a.primary};t?await Xa(t,n):await Va(n),T(),m(t?"Contact updated":"Contact added","ok")},"contact-delete"(e){let t=e.dataset.id;P({title:"Delete this contact?",message:"They will be removed from the safety card, the emergency screen, and the printed card.",async onConfirm(){await Ga(t),m("Contact deleted")}})},"timer-start"(){Z=null,Te=ae(),ia({ms:Date.now(),at:Te}),Jn(se()),se().querySelector('[data-action="timer-stop"]')?.focus({preventScroll:!0})},"timer-stop"(){let e=ha();ua(),e&&(Z=Math.max(1,Math.floor((Date.now()-e.ms)/1e3)),Te=e.at,ia(null),ma(se(),"stopped",Z),se().querySelector('[data-action="timer-log"]')?.focus({preventScroll:!0}))},"timer-reset"(){Z=null,Te=null,ia(null),ua();let e=se().querySelector(".em-timer");e&&(e.outerHTML=Gn()),se().querySelector('[data-action="timer-start"]')?.focus({preventScroll:!0})},"timer-log"(){let e=Z||0,t=Te||`${f()}T${X()}`;Z=null,Te=null,we(),sa({at:t,duration:e})},"print-card"(e,t){let a=document.getElementById("print-card");if(!a)return;let n=navigator.userAgent,s=/iPad|iPhone|iPod/.test(n)||/Macintosh/.test(n)&&navigator.maxTouchPoints>1,r=window.navigator.standalone===!0||window.matchMedia("(display-mode: standalone)").matches;if(s&&r){m("To print, open this page in Safari. Home-screen apps can\u2019t print on iPhone or iPad.","bad");return}a.innerHTML=Jo(t),window.print()}};var va={};Ee(va,{actions:()=>pr,render:()=>tr,showConflict:()=>ba,subtitle:()=>er,title:()=>Zo});function Zo(){return"You"}function er(e){return e.profile.school||"Your details and settings"}var Qn=[["name","Name","Maya Ellison"],["pronouns","Pronouns","she/her"],["grade","Grade","11th grade"],["school","School","Rosewood High School"],["seizureType","Seizure type","Focal impaired awareness"],["diagnosed","Diagnosed","2022"],["neurologist","Neurologist","Dr. Raghavan"],["neuroPhone","Neurologist phone","(555) 010-4488"],["allergies","Allergies","Penicillin"],["bloodType","Blood type","O+"]];function tr(e){return h`
    <div class="split-grid">
      <div class="split-main">
        ${o(ar(e))}
        ${o(nr(e))}
      </div>
      <div class="split-side">
        ${o(sr(e))}
        ${o(rr(e))}
        ${o(cr(e))}
        ${o(lr(e))}
        ${o(dr())}
      </div>
    </div>
  `}function ar(e){let{profile:t}=e,a=ce(e),n=[t.pronouns,t.grade].filter(Boolean).join(" \xB7 "),s=_e(t.name);return h`
    <div class="card card-flush">
      <div class="profile-head">
        <span class="avatar avatar-lg" aria-hidden="true">${s||o(c("user",26))}</span>
        <span class="row-body">
          <span class="profile-n">${t.name||"Add your name"}</span>
          <span class="profile-s">${n||"Tap edit to fill in your details"}</span>
        </span>
        <button class="icon-btn" data-action="profile-edit" aria-label="Edit your details">
          ${o(c("edit"))}
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
  `}function nr(e){let{profile:t}=e,a=Qn.map(([n,s])=>`
    <div class="kv-row">
      <dt class="kv-k">${s}</dt>
      <dd class="kv-v">${t[n]?u(t[n]):'<span class="ink-faint">\u2014</span>'}</dd>
    </div>`).join("");return h`
    <section class="section" aria-labelledby="care-h">
      <div class="section-head">
        <h2 id="care-h">Care details</h2>
        <button class="btn btn-sm btn-quiet" data-action="profile-edit">${o(c("edit",15))} Edit</button>
      </div>
      <div class="card card-flush"><dl class="kv">${o(a)}</dl></div>
      <p class="hint">
        These appear on the emergency card and the printed card, so whoever
        helps you has them without having to ask.
      </p>
    </section>
  `}function Zn(e){let t=Date.parse(e);if(!t)return"";let a=Math.round((Date.now()-t)/6e4);if(a<1)return"just now";if(a<60)return`${a} min ago`;let n=Math.round(a/60);return n<24?`${n} h ago`:new Date(t).toLocaleDateString(void 0,{month:"short",day:"numeric"})}var ga={"signed-out":"Sign in to Flux again to keep syncing.",offline:"Offline. It will sync when you\u2019re back online.","not-ready":"Sync isn\u2019t switched on for Flux yet.","wrong-key":"This device\u2019s sync key doesn\u2019t open the synced copy.",gone:"Turned off: the synced copy was deleted on another device."};function es(){let e=rt();if(!V())return e.error==="gone"?ga.gone:e.account?"Off. Encrypted on this device before it leaves, so Flux can\u2019t read it.":"Sign in to Flux to keep Synara the same on your phone and computer.";if(e.phase==="syncing")return"Syncing\u2026";if(e.phase==="conflict")return"Changed on two devices. Choose which to keep.";if(e.phase==="error")return ga[e.error]||"Couldn\u2019t sync. It will try again.";let t=$n();return t?`On \xB7 synced ${Zn(t)}`:"On"}function sr(e){return Rt()?h`
    <section class="section" aria-labelledby="flux-h">
      <h2 id="flux-h">Flux</h2>
      <div class="card card-flush">
        <div class="list-row list-row-static">
          <span class="med-dot" data-color="violet" aria-hidden="true">${o(c("calendar",20))}</span>
          <span class="row-body">
            <span class="row-t" id="fluxlink-label">Show in my Flux Planner</span>
            <span class="row-s">Dose times on your Flux calendar and a safety-card button in
              School info, on this device. Seizures, contacts and notes stay in Synara.</span>
          </span>
          <button class="switch" data-action="flux-link-toggle" role="switch"
                  aria-checked="${e.settings.fluxLink}" aria-labelledby="fluxlink-label"></button>
        </div>
        <button class="list-row" data-action="sync-open">
          <span class="med-dot" data-color="blue" aria-hidden="true">${o(c("sync",20))}</span>
          <span class="row-body">
            <span class="row-t">Sync across your devices</span>
            <span class="row-s">${es()}</span>
          </span>
          <span class="chev">${o(c("chevron"))}</span>
        </button>
      </div>
    </section>
  `:""}var Un=h`
  <ul class="sheet-list">
    <li>${o(c("lock",16))}<span>Synara encrypts everything on this device before it leaves. Flux stores
      a locked copy it can’t open — not your medication, seizures or contacts.</span></li>
    <li>${o(c("info",16))}<span>The key stays on your devices. You’ll get a <strong>sync key</strong> to
      enter on your other devices. If you lose every device and the key, the synced copy can’t be
      opened — but each device keeps its own.</span></li>
  </ul>
`;async function ya(){let e=await st();if(!V()&&!e){z({title:"Sync across your devices",body:h`
        <p class="sheet-message">Sign in to your Flux account, then come back here to keep Synara the
          same on your phone and computer.</p>
        ${o(Un)}
      `,footer:`
        <button class="btn btn-quiet" data-action="close-sheet">Not now</button>
        <a class="btn btn-primary" href="index.html">Sign in to Flux</a>
      `});return}if(!V()){z({title:"Sync across your devices",body:h`
        <p class="sheet-message">Signed in to Flux as <strong>${e.email||"your account"}</strong>.</p>
        ${o(Un)}
        <div class="stack stack-3 mt-3">
          <button class="btn btn-primary btn-block" data-action="sync-start-new">
            Start syncing from this device
          </button>
          <form class="stack stack-2" data-action="sync-join-check">
            <label class="label" for="sync-key">Already syncing on another device? Enter its sync key.</label>
            <input class="input mono" id="sync-key" name="key" autocomplete="off" autocapitalize="characters"
                   spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XX" />
            <button class="btn btn-outline btn-block" type="submit">Connect this device</button>
          </form>
        </div>
      `});return}let t=rt();z({title:"Sync is on",body:h`
      <p class="sheet-message">${es()}${o(t.account?` \xB7 ${u(t.account.email)}`:"")}</p>
      <div class="sync-key">
        <span class="label">Your sync key</span>
        <code class="mono">${_t()}</code>
        <span class="t-sm ink-3">Enter it on your other devices in You → Flux → Sync. Keep it private:
          anyone with it and your Flux sign-in could read your synced copy.</span>
      </div>
      <div class="stack stack-2 mt-3">
        <button class="btn btn-outline btn-block" data-action="sync-copy-key">Copy sync key</button>
        <button class="btn btn-outline btn-block" data-action="sync-now">Sync now</button>
        <button class="btn btn-quiet btn-block" data-action="sync-stop">Turn off on this device</button>
        <button class="btn btn-quiet btn-block text-bad" data-action="sync-stop-delete">Turn off and delete the synced copy</button>
      </div>
    `})}function ba(){z({title:"Which copy should Synara keep?",body:h`
      <p class="sheet-message">Synara changed on this device and on another one since they last
        synced. Pick the copy to keep; the other will be replaced.</p>
    `,footer:`
      <button class="btn btn-outline" data-action="sync-resolve" data-choice="cloud">Use the other device\u2019s</button>
      <button class="btn btn-primary" data-action="sync-resolve" data-choice="device">Keep this device\u2019s</button>
    `})}var or=[[0,"On time"],[10,"10 min early"],[15,"15 min early"],[30,"30 min early"]];function rr(e){let{remindersOn:t,reminderLead:a}=e.settings,n=Pt(),s=nt(),r=!n.ok||s==="denied",i=t&&!r,l=n.ok?s==="denied"?"Notifications are blocked for this site in your browser settings.":i?"On \u2014 while Synara is open in a tab or installed.":"A nudge at each dose time.":n.reason,d=or.map(([p,y])=>`
    <button class="segment" data-action="reminder-lead" data-value="${p}"
            aria-pressed="${p===a}">${y}</button>`).join("");return h`
    <section class="section" aria-labelledby="rem-h">
      <h2 id="rem-h">Reminders</h2>
      <div class="card card-flush">
        <div class="list-row list-row-static">
          <span class="med-dot" data-color="amber" aria-hidden="true">${o(c("bell",20))}</span>
          <span class="row-body">
            <span class="row-t" id="rem-label">Dose reminders</span>
            <span class="row-s">${l}</span>
          </span>
          <button class="switch" data-action="reminders-toggle" role="switch"
                  aria-checked="${i}" aria-labelledby="rem-label"
                  ${o(r?"disabled":"")}></button>
        </div>
        ${o(i?`
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
        ${o(c("alert",16))}
        <span>
          <strong>Keep a phone alarm as your real backup.</strong> A website can only
          remind you while it's running. Close the browser or restart the phone and
          the reminder is gone. Dependable reminders need a native app — the strongest
          reason to build Synara's next version in React Native.
        </span>
      </div>
    </section>
  `}var ir=[["system","Match device"],["light","Light"],["dark","Dark"]];function cr(e){let t=e.settings.theme||"system",a=ir.map(([n,s])=>`
    <button class="segment" data-action="theme-set" data-theme="${n}"
            aria-pressed="${n===t}">${s}</button>`).join("");return h`
    <section class="section" aria-labelledby="look-h">
      <h2 id="look-h">Appearance</h2>
      <div class="card">
        <div class="segments" role="group" aria-label="Theme">${o(a)}</div>
        <p class="hint mt-3">
          Dark mode is here for a reason: this app gets opened at 3am to log a
          seizure that just woke you. Nothing in Synara ever flashes or strobes.
        </p>
      </div>
    </section>
  `}function lr(e){let t=(e.seizures||[]).length,a=Object.keys(e.doses||{}).length,n=Object.keys(e.checkins||{}).length;return h`
    <section class="section" aria-labelledby="data-h">
      <h2 id="data-h">Your data</h2>
      <div class="card card-flush">
        <ul class="rows">
          <li class="list-row list-row-static">
            <span class="med-dot" data-color="mint" aria-hidden="true">${o(c("lock",20))}</span>
            <span class="row-body">
              <span class="row-t">Stored on this device only</span>
              <span class="row-s">${M(a,"day")} of doses · ${M(t,"seizure")} · ${M(n,"check-in")}</span>
            </span>
          </li>
          <li>
            <button class="list-row" data-action="data-export">
              <span class="med-dot" data-color="violet" aria-hidden="true">${o(c("down",20))}</span>
              <span class="row-body">
                <span class="row-t">Download a backup</span>
                <span class="row-s">Everything in one file — keep it, or give it to your doctor</span>
              </span>
              <span class="chev">${o(c("chevron"))}</span>
            </button>
          </li>
          <li>
            <label class="list-row file-row">
              <span class="med-dot" data-color="blue" aria-hidden="true">${o(c("up",20))}</span>
              <span class="row-body">
                <span class="row-t">Restore from a backup</span>
                <span class="row-s">Moving to a new phone? Load the file here</span>
              </span>
              <span class="chev">${o(c("chevron"))}</span>
              <input type="file" accept="application/json,.json" class="sr-only" data-change="data-import" />
            </label>
          </li>
          <li>
            <button class="list-row" data-action="data-demo">
              <span class="med-dot" data-color="amber" aria-hidden="true">${o(c("sparkle",20))}</span>
              <span class="row-body">
                <span class="row-t">Load example data</span>
                <span class="row-s">Replaces everything with a demo record, to show someone the app</span>
              </span>
              <span class="chev">${o(c("chevron"))}</span>
            </button>
          </li>
          <li>
            <button class="list-row" data-action="data-wipe">
              <span class="med-dot" data-color="rose" aria-hidden="true">${o(c("trash",20))}</span>
              <span class="row-body">
                <span class="row-t text-bad">Delete everything</span>
                <span class="row-s">Removes all of your data from this device</span>
              </span>
              <span class="chev">${o(c("chevron"))}</span>
            </button>
          </li>
        </ul>
      </div>
      <div class="disclaimer">
        ${o(c("info",16))}
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
  `}function dr(){return h`
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
          ${o(je())}
          <span class="t-sm ink-3">Built and hosted by Flux, the free planner for school.</span>
        </div>
      </div>
    </section>
  `}function ur(e){let t=Array.isArray(e.meds)?e.meds.length:0,a=Array.isArray(e.seizures)?e.seizures.length:0,n=e.doses&&typeof e.doses=="object"?Object.keys(e.doses).length:0,s=e.profile&&typeof e.profile.name=="string"&&e.profile.name.trim();return`${s?`${s.slice(0,80)}'s record: `:""}${M(t,"medication")}, ${M(n,"day")} of doses, ${M(a,"seizure")}.`}var pr={"profile-edit"(e,t){let a=t.profile,n=Qn.map(([s,r,i])=>`
      <div class="field">
        <label class="label" for="p-${s}">${r}</label>
        <input class="input" id="p-${s}" name="${s}" value="${u(a[s]||"")}"
               placeholder="${u(i)}" autocomplete="off" maxlength="200" />
      </div>`).join("");z({title:"Your details",body:h`<form class="stack stack-4" data-action="profile-save" novalidate>${o(n)}</form>`,footer:'<button class="btn btn-primary" data-action="profile-save">Save</button>'})},async"profile-save"(){await Ua(B()),T(),m("Details saved","ok")},async"reminders-toggle"(e,t){let a=!t.settings.remindersOn;if(a){let n=Pt();if(!n.ok){m(n.reason,"bad");return}if(await rn()!=="granted"){m("Notifications weren't allowed","bad");return}}await Ne({remindersOn:a}),m(a?"Reminders on":"Reminders off",a?"ok":"default")},async"reminder-lead"(e){await Ne({reminderLead:Number(e.dataset.value)||0})},"reminders-test"(){let e=ln();m(e?"Test sent \u2014 check your notifications":"Couldn't send a test",e?"ok":"bad")},async"theme-set"(e){await Ne({theme:e.dataset.theme})},"data-export"(e,t){let a=new Blob([ge()],{type:"application/json"}),n=URL.createObjectURL(a),s=document.createElement("a"),r=(t.profile.name||"backup").replace(/[^\w-]+/g,"-").toLowerCase();s.href=n,s.download=`synara-${r}-${f()}.json`,document.body.appendChild(s),s.click(),s.remove(),setTimeout(()=>URL.revokeObjectURL(n),1e3),m("Backup downloaded","ok")},async"data-import"(e){let t=e.files&&e.files[0];if(e.value="",!t)return;if(t.size>5*1024*1024){m("That file is too large to be a Synara backup","bad");return}let a=await t.text(),n;try{n=JSON.parse(a)}catch{m("That file isn't a Synara backup","bad");return}P({title:"Replace everything with this backup?",message:`${ur(n)} Everything currently on this device will be replaced. Download a backup of what's here first if you might need it.`,confirmLabel:"Restore backup",danger:!1,async onConfirm(){try{await Ue(a),m("Backup restored","ok")}catch(s){m(s.message==="not-synara"?"That file isn't a Synara backup":"Couldn't read that backup","bad")}}})},"data-demo"(){let e=V();P({title:"Load example data?",message:"Everything on this device will be replaced with a made-up student's record. Download a backup first if any of what's here is real."+(e?" Sync turns off on this device first, so the example never reaches your other devices.":""),confirmLabel:"Load example data",async onConfirm(){e&&await xe(),await Ae({seedFn:Qe}),m("Example data loaded","ok")}})},"data-wipe"(){P({title:"Delete everything?",message:"Every medication, dose, seizure, check-in, contact, and your safety card will be removed from this device. This can't be undone.",confirmLabel:"Delete everything",async onConfirm(){await xe(),await Pa();try{sessionStorage.removeItem("synara.timer")}catch{}history.replaceState(null,"",location.pathname),location.reload()}})},async"flux-link-toggle"(e,t){let a=!t.settings.fluxLink;await Ne({fluxLink:a}),m(a?"Your dose times now show in your Flux Planner":"Removed from your Flux Planner","ok")},"sync-open"(){return ya()},async"sync-start-new"(){try{await Xt(),await T(),m("Sync is on","ok"),ya()}catch(e){e.code==="has-copy"?hr():m(de(e),"bad")}},async"sync-join-check"(){let{key:e}=B(),t;try{t=await Tn(e)}catch(a){m(de(a),"bad");return}P({title:"Use your synced copy here?",message:`Your synced copy, updated ${Zn(t.updatedAt)}, has ${M(t.meds,"medication")} and ${M(t.seizures,"logged seizure")}${t.name?` for ${t.name}`:""}. It will replace what is on this device now.`,confirmLabel:"Use synced copy",danger:!1,async onConfirm(){try{await En(t.key),m("This device is synced","ok")}catch(a){m(de(a),"bad")}}})},async"sync-copy-key"(){try{await navigator.clipboard.writeText(_t()),m("Sync key copied","ok")}catch{m("Couldn\u2019t copy. Select the key and copy it instead.","bad")}},async"sync-now"(){await T();let e=await $e();e==="error"?m(de(rt()),"bad"):e!=="conflict"&&m("Synced","ok")},"sync-stop"(){P({title:"Turn off sync on this device?",message:"This device keeps everything it has. Your synced copy and your other devices are not changed.",confirmLabel:"Turn off",danger:!1,async onConfirm(){await xe(),m("Sync is off on this device","ok")}})},"sync-stop-delete"(){P({title:"Delete the synced copy?",message:"The encrypted copy in your Flux account is deleted and sync stops on every device. Each device keeps its own record.",confirmLabel:"Delete synced copy",async onConfirm(){try{await xe({deleteCopy:!0}),m("Synced copy deleted","ok")}catch(e){m(de(e),"bad")}}})},async"sync-resolve"(e){await T();try{await Mn(e.dataset.choice),m("Synced","ok")}catch(t){m(de(t),"bad")}},"sync-fresh"(){P({title:"Delete the old synced copy?",message:"Only do this if you no longer have the device or the sync key it was made with. The old copy is deleted and this device becomes the new one to sync from.",confirmLabel:"Delete and start fresh",async onConfirm(){try{await xe({deleteCopy:!0}),await Xt(),m("Sync is on","ok"),ya()}catch(e){m(de(e),"bad")}}})}};function de(e){let t=e&&(e.code||e.error||e.message)||"";return t==="bad-key"?"That isn\u2019t a sync key. It\u2019s 26 letters and numbers.":t==="no-copy"?"There\u2019s no synced copy in this Flux account yet. Turn sync on from your other device first.":t==="wrong-key"?"That key doesn\u2019t open your synced copy. Check it on your other device.":ga[t]||"Couldn\u2019t sync. Please try again."}function hr(){z({title:"You already have a synced copy",body:h`
      <p class="sheet-message">Your Flux account already has a synced copy of Synara. To use it here,
        enter the sync key from the device where you turned sync on (You → Flux → Sync).</p>
      <p class="sheet-message">Lost that device and its key? You can delete the old copy and start
        again from this one.</p>
    `,footer:`
      <button class="btn btn-quiet" data-action="sync-open">Enter a sync key</button>
      <button class="btn btn-danger" data-action="sync-fresh">Start fresh</button>
    `})}var $a={home:Zt,meds:ta,track:oa,safety:fa,you:va},ka=["home","meds","track","safety","you"],Sa={home:{label:"Home",icon:"home"},meds:{label:"Meds",icon:"pill"},track:{label:"Seizures",icon:"chart"},safety:{label:"Safety",icon:"shield"},you:{label:"You",icon:"user"}},ts={sos:"safety"},_="home",Y={shell:document.querySelector(".app-shell"),appbar:document.getElementById("appbar"),screen:document.getElementById("screen"),tabbar:document.getElementById("tabbar")},mr=document.documentElement.dataset.host==="flux",ut=document.querySelector("[data-flux-hub]");function ss(){let e=(location.hash||"").replace(/^#\/?/,"").split(/[/?]/)[0];return ts[e]?{route:ts[e],sos:e==="sos"}:{route:ka.includes(e)?e:"home",sos:!1}}function as(e){ka.includes(e)&&location.hash!==`#/${e}`&&(location.hash=`#/${e}`)}function os(e){let t=document.documentElement;e==="light"||e==="dark"?t.setAttribute("data-theme",e):t.removeAttribute("data-theme");let a=e==="dark"||e!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches;for(let n of document.querySelectorAll('meta[name="theme-color"]'))n.content=e==="system"?n.media.includes("dark")?"#121019":"#f6f5fa":a?"#121019":"#f6f5fa"}function rs(){return'<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 18h5l3-8 5 14 3.5-9H28" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'}function fr(e){let t=f();return L(t,e).filter(({med:a,time:n})=>H(t,a.id,n,e)==="pending").length}function yr(e){let t=fr(e);Y.tabbar.innerHTML=h`
    <div class="sidebar-brand">
      <div class="brand-mark">${o(rs())}</div>
      <div>
        <div class="brand-name">Synara</div>
        <div class="brand-tag">Epilepsy care for school</div>
      </div>
    </div>
    ${o(ka.map(a=>{let n=Sa[a],s=a===_,r=a==="meds"&&t>0,i=r?`${n.label}, ${t} ${t===1?"dose":"doses"} not logged today`:n.label;return`
        <button class="tab" data-action="nav" data-to="${a}"
                ${s?'aria-current="page"':""} aria-label="${i}">
          <span class="tab-ico">${c(n.icon)}</span>
          <span class="tab-label">${n.label}</span>
          ${r?'<span class="tab-dot" aria-hidden="true"></span>':""}
        </button>`}).join(""))}
    <button class="sidebar-sos" data-action="open-emergency">
      ${o(c("shield",18))}
      <span>Open emergency card</span>
    </button>
    ${o(je("sidebar-powered"))}
  `}function gr(e){let t=$a[_],a=t.title?t.title(e):Sa[_].label,n=t.subtitle?t.subtitle(e):"";Y.appbar.innerHTML=h`
    <div class="appbar-title">
      <h1 class="appbar-t">${a}</h1>
      ${o(n?`<span class="appbar-s">${u(n)}</span>`:"")}
    </div>
    <button class="sos-btn" data-action="open-emergency"
            aria-label="Open the emergency seizure card">
      ${o(c("shield",16))}<span>SOS</span>
    </button>
  `,ut&&Y.appbar.insertBefore(ut,Y.appbar.querySelector(".sos-btn"))}function br(e){Y.screen.innerHTML=h`
    <div class="screen-inner" data-route="${_}">${o($a[_].render(e))}</div>
  `}function Fe(){let e=W(),t=Y.screen.scrollTop,a=document.activeElement,n=ut&&ut.contains(a),s=a&&!n&&Y.shell.contains(a)?At(a):null;document.title=`${Sa[_].label} \xB7 Synara`,os(e.settings.theme),un(e),yr(e),gr(e),br(e),Y.screen.scrollTop=t,s?Dt(s,Y.shell):n&&a.focus()}function vr(){on(h`
    <div class="welcome-inner">
      <div class="brand-mark welcome-mark">${o(rs())}</div>
      <h1 class="welcome-h1">Synara</h1>
      <p class="welcome-sub">
        Your medication, your seizures, and the card someone needs if you
        have one at school — all in one place.
      </p>

      <ul class="welcome-points">
        <li>${o(c("pill",18))}<span>Dose reminders and a history you can show your doctor</span></li>
        <li>${o(c("chart",18))}<span>A seizure log that looks for patterns for you</span></li>
        <li>${o(c("shield",18))}<span>An emergency card anyone can follow, one tap away</span></li>
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
        ${o(c("lock",14))}
        <span>Everything stays on this device — nothing is uploaded and there is
        no account. Synara is a student project, not a medical device.</span>
      </p>

      ${o(je("welcome-powered"))}
    </div>
  `)}var wa={nav(e){as(e.dataset.to)},"close-sheet"(){T()},"close-emergency"(){we()},"open-emergency"(){dt(W())},async"welcome-demo"(){await Ae({seedFn:Qe}),jt(),m("Loaded example data \u2014 clear it any time in You","ok")},async"welcome-empty"(){await Ae(),jt(),as("meds"),m("Start by adding your medication","ok")},reload(){location.reload()}};for(let e of Object.values($a))if(e.actions)for(let[t,a]of Object.entries(e.actions))wa[t]&&console.warn(`[synara] duplicate action "${t}"`),wa[t]=a;function xa(e,t){let a=wa[e];return a?(Promise.resolve(a(t,W())).catch(n=>{console.error("[synara] action failed:",e,n),m(n&&n.message==="save-failed"?"Could not save \u2014 your browser storage may be full or blocked.":"Something went wrong. Please try that again.","bad")}),!0):!1}document.addEventListener("click",e=>{let t=e.target.closest("[data-action]");!t||t.tagName==="FORM"||xa(t.dataset.action,t)&&e.preventDefault()});document.addEventListener("submit",e=>{let t=e.target.closest("form[data-action]");t&&(e.preventDefault(),xa(t.dataset.action,t))});document.addEventListener("change",e=>{let t=e.target.closest("[data-change]");t&&xa(t.dataset.change,t)});function ns(){let e=ss();e.route!==_&&(_=e.route,at()&&!e.sos&&we(),T(),Y.screen.scrollTop=0,Fe()),e.sos&&(dt(W()),history.replaceState(null,"","#/safety"))}function wr(){let e=f();setInterval(()=>{if(at())return;let t=f();(_==="home"||t!==e)&&Fe(),e=t},6e4)}function $r(){mr||!("serviceWorker"in navigator)||location.protocol==="file:"||window.addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").catch(e=>{console.warn("[synara] service worker not registered:",e)})})}async function kr(){let e=ss();_=e.route;let{firstRun:t}=await Ha();fe(Fe),Fe(),t?vr():e.sos&&ns(),window.addEventListener("hashchange",ns),window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>os(W().settings.theme)),cn(),$r(),wr(),wn(a=>{_==="you"&&Fe(),a.phase==="conflict"&&!an()&&!at()&&ba()}),zn()}kr().catch(e=>{console.error("[synara] failed to start:",e),Y.screen.innerHTML=h`
    <div class="screen-inner">
      <div class="empty">
        <span class="empty-ico">${o(c("alert",32))}</span>
        <span class="empty-t">Synara couldn't start</span>
        <span class="empty-s">
          Your browser may be blocking local storage. Try turning off private
          browsing, or reload the page.
        </span>
        <button class="btn btn-primary" data-action="reload">Reload</button>
      </div>
    </div>
  `});})();
