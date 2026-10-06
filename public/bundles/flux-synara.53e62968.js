(()=>{var Aa=Object.defineProperty;var me=(e,t)=>{for(var n in t)Aa(e,n,{get:t[n],enumerable:!0})};function d(e){return e==null?"":String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}var Kn=Symbol("raw");function o(e){return{[Kn]:!0,value:String(e??"")}}function Vn(e){return e==null?"":Array.isArray(e)?e.map(Vn).join(""):typeof e=="object"&&e[Kn]?e.value:d(e)}function p(e,...t){let n=e[0];for(let s=0;s<t.length;s++)n+=Vn(t[s])+e[s+1];return n}var se=e=>String(e).padStart(2,"0");function f(e=new Date){return`${e.getFullYear()}-${se(e.getMonth()+1)}-${se(e.getDate())}`}function oe(e=new Date){return`${f(e)}T${se(e.getHours())}:${se(e.getMinutes())}`}function G(e=new Date){return`${se(e.getHours())}:${se(e.getMinutes())}`}function ae(e){let[t,n,s]=String(e).split("-").map(Number);return new Date(t,n-1,s)}function re(e){let[t,n="00:00"]=String(e).split("T"),[s,a,r]=t.split("-").map(Number),[i,l]=n.split(":").map(Number);return new Date(s,a-1,r,i||0,l||0)}function N(e){let[t,n]=String(e).split(":").map(Number);return(t||0)*60+(n||0)}function z(e,t){let n=ae(e);return n.setDate(n.getDate()+t),f(n)}function Ue(e,t){let n=ae(t)-ae(e);return Math.round(n/864e5)}function Un(e,t=f()){let n=[];for(let s=e-1;s>=0;s--)n.push(z(t,-s));return n}var Xn=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],Jn=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],Tt=e=>Xn[e],Gn=e=>Jn[e];function P(e){let[t,n]=String(e).split(":").map(Number),s=t>=12?"PM":"AM";return`${t%12===0?12:t%12}:${se(n||0)} ${s}`}function B(e,{relative:t=!0}={}){let n=f();if(t){if(e===n)return"Today";if(e===z(n,-1))return"Yesterday";if(e===z(n,1))return"Tomorrow"}let s=ae(e);return`${Jn[s.getDay()]}, ${Xn[s.getMonth()]} ${s.getDate()}`}function Xe(e){let t=Math.max(0,Math.round(e));if(t<1)return"now";if(t<60)return`${t}m`;let n=Math.floor(t/60),s=t%60;return s?`${n}h ${s}m`:`${n}h`}function Ne(e){let t=Math.max(0,Math.round(e));if(t<60)return`${t} sec`;let n=Math.floor(t/60),s=t%60;return s?`${n} min ${s} sec`:`${n} min`}function Qn(e){let[t,n]=String(e).split("T");return`${B(t)} at ${P(n||"00:00")}`}function Zn(e){let t=re(e),n=Math.round((Date.now()-t.getTime())/6e4);if(n<1)return"just now";if(n<60)return`${n}m ago`;let s=Math.round(n/60);if(s<24)return`${s}h ago`;let a=Math.round(s/24);if(a===1)return"yesterday";if(a<30)return`${a} days ago`;let r=Math.round(a/30);return r===1?"a month ago":`${r} months ago`}function L(e="id"){return`${e}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`}var Je=(e,t,n)=>Math.min(n,Math.max(t,e));function Et(e){return`tel:${String(e).replace(/[^\d+]/g,"")}`}function zt(e){return(String(e||"").match(/\d/g)||[]).length>=3}function Ge(e){return String(e||"").trim().split(/\s+/).slice(0,2).map(t=>t[0]||"").join("").toUpperCase()}function Ct(e){let t=new Map;for(let n of e)n==null||n===""||t.set(n,(t.get(n)||0)+1);return[...t.entries()].map(([n,s])=>({value:n,count:s})).sort((n,s)=>s.count-n.count)}function T(e,t,n="s"){return`${e} ${t}${e===1?"":n}`}function Le(e,t){if(e==="taken")return"Taken";if(e==="late")return"Taken late";if(e==="missed")return"Missed";let n=N(G())-N(t);return n<0?"Scheduled":n<=60?"Due now":`${Xe(n)} overdue`}var Qe="synara.v2",ts=3,ns={name:"local",async read(){try{let e=localStorage.getItem(Qe);return e?JSON.parse(e):null}catch(e){return console.warn("[synara] could not read local state:",e),null}},async write(e){try{return localStorage.setItem(Qe,JSON.stringify(e)),!0}catch(t){throw console.error("[synara] could not save state:",t),new Error("save-failed")}},async clear(){try{localStorage.removeItem(Qe)}catch(e){console.warn("[synara] could not clear state:",e)}}},Q=ns;function ge(){return{v:ts,profile:{name:"",pronouns:"",grade:"",school:"",seizureType:"",diagnosed:"",neurologist:"",neuroPhone:"",allergies:"",bloodType:""},meds:[],doses:{},seizures:[],checkins:{},contacts:[],card:{looksLike:"",during:["Stay with them and start timing the seizure.","Move anything hard or sharp out of the way.","Put something soft under their head.","Loosen anything tight around their neck.","If they are not aware or not awake, gently turn them onto their side.","Stay calm and speak normally \u2014 they may be able to hear you."],doNot:["Do NOT put anything in their mouth. They cannot swallow their tongue.","Do NOT hold them down or try to stop the movements.","Do NOT give food, drink, or pills until they are fully awake.","Do NOT crowd them \u2014 ask other people to step back."],after:["Stay with them until they are fully alert and know where they are.","Tell them calmly what happened \u2014 they may not remember.","Let them rest somewhere quiet.","Call their emergency contact.","Write down the time it started and how long it lasted."],callEms:["The seizure lasts longer than 5 minutes.","A second seizure starts soon after the first.","They do not wake up or return to normal afterwards.","They are having trouble breathing, or their lips stay blue.","They were injured, or it happened in water."],forTeacher:"",forNurse:"",forCoach:"",updated:""},settings:{theme:"system",remindersOn:!1,reminderLead:0,quietHours:null,seeded:!1,fluxLink:!1,noMeds:!1,setupHidden:!1}}}var Da=/^[A-Za-z0-9_-]{1,64}$/,Oa=/^\d{4}-\d{2}-\d{2}$/,Na=/^([01]\d|2[0-3]):[0-5]\d$/,La=/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/,ss=new Set(["taken","late","missed"]),Ot=new Set(["violet","mint","amber","rose","blue"]),Nt=new Set(["tablet","capsule","liquid","patch","injection","other"]),ja=new Set(["system","light","dark"]),fe=e=>typeof e=="string"&&Oa.test(e),k=(e,t=4e3)=>typeof e=="string"?e.slice(0,t):"",Ze=(e,t,n,s)=>typeof e=="number"&&Number.isFinite(e)?Math.min(n,Math.max(t,e)):s,Ia=e=>Array.isArray(e)?e.map(t=>k(t,600)).filter(Boolean).slice(0,30):null,Lt=(e,t)=>typeof e=="string"&&Da.test(e)?e:L(t),et=e=>typeof e=="string"&&Na.test(e),ye=e=>typeof e=="string"&&La.test(e);function be(e){return Array.isArray(e)?[...new Set(e.filter(et))].sort():[]}function Ha(e,t){let n=f(),s=fe(e.added)?e.added:t||n,a;Array.isArray(e.schedule)&&e.schedule.length?a=e.schedule.filter(i=>i&&fe(i.from)).map(i=>({from:i.from,times:be(i.times)})).sort((i,l)=>i.from<l.from?-1:i.from>l.from?1:0):a=[{from:s,times:be(e.times)}],a.length||(a=[{from:s,times:[]}]),a[0].from=s;let r=fe(e.ended)?e.ended:null;return!r&&e.active===!1&&(r=n),{id:Lt(e.id,"med"),name:k(e.name,120),dose:k(e.dose,60),form:Nt.has(e.form)?e.form:"tablet",notes:k(e.notes,600),color:Ot.has(e.color)?e.color:"violet",added:s,ended:r,schedule:a}}function Pa(e,t){let n={};if(!e||typeof e!="object")return n;for(let[s,a]of Object.entries(e)){if(!fe(s)||!a||typeof a!="object")continue;let r={};for(let[i,l]of Object.entries(a)){let[u,h]=i.split("|");!t.has(u)||!et(h)||!l||!ss.has(l.status)||(r[i]={status:l.status,at:ye(l.at)?l.at:`${s}T00:00`})}Object.keys(r).length&&(n[s]=r)}return n}function jt(e){return!e||!ye(e.at)?null:{id:Lt(e.id,"sz"),at:e.at,duration:Math.round(Ze(Number(e.duration),0,7200,0)),type:k(e.type,80),trigger:k(e.trigger,80),place:k(e.place,120),aura:k(e.aura,300),injury:e.injury===!0,emsCalled:e.emsCalled===!0,notes:k(e.notes,4e3),logged:ye(e.logged)?e.logged:e.at}}function qa(e){let t={};if(!e||typeof e!="object")return t;for(let[n,s]of Object.entries(e)){if(!fe(n)||!s||typeof s!="object")continue;let a=Ze(s.stress,1,5,null);t[n]={sleepHours:Ze(s.sleepHours,0,24,null),sleepQuality:["poor","ok","good"].includes(s.sleepQuality)?s.sleepQuality:null,stress:a==null?null:Math.round(a),mood:["low","ok"].includes(s.mood)?s.mood:null,notes:k(s.notes,600),at:ye(s.at)?s.at:`${n}T00:00`}}return t}function Ra(e){return!e||typeof e!="object"?null:{id:Lt(e.id,"c"),name:k(e.name,120),relation:k(e.relation,80),phone:k(e.phone,40),primary:e.primary===!0}}function Fa(e){let t=new Map;if(!e||typeof e!="object")return t;for(let n of Object.keys(e).sort())for(let s of Object.keys(e[n]||{})){let a=s.split("|")[0];t.has(a)||t.set(a,n)}return t}var It=(e,t)=>e.at<t.at?1:e.at>t.at?-1:0;function Ht(e){let t=ge(),n=e&&typeof e=="object"?e:{},s=Fa(n.doses),a=(Array.isArray(n.meds)?n.meds:[]).filter($=>$&&typeof $=="object").map($=>Ha($,s.get($.id))),r=new Set(a.map($=>$.id)),i=(Array.isArray(n.seizures)?n.seizures:[]).map(jt).filter(Boolean).sort(It),l=(Array.isArray(n.contacts)?n.contacts:[]).map(Ra).filter(Boolean),u=!1;for(let $ of l)$.primary&&u&&($.primary=!1),$.primary&&(u=!0);let h={...t.profile};if(n.profile&&typeof n.profile=="object")for(let $ of Object.keys(t.profile))h[$]=k(n.profile[$],200);let y={...t.card};if(n.card&&typeof n.card=="object"){for(let $ of["during","doNot","after","callEms"]){let M=Ia(n.card[$]);M&&(y[$]=M)}for(let $ of["looksLike","forTeacher","forNurse","forCoach"])typeof n.card[$]=="string"&&(y[$]=k(n.card[$]));y.updated=fe(n.card.updated)?n.card.updated:""}let b=n.settings&&typeof n.settings=="object"?n.settings:{},A=b.quietHours,D={theme:ja.has(b.theme)?b.theme:"system",remindersOn:b.remindersOn===!0,reminderLead:Math.round(Ze(b.reminderLead,0,120,0)),quietHours:A&&et(A.from)&&et(A.to)?{from:A.from,to:A.to}:null,seeded:b.seeded===!0,fluxLink:b.fluxLink===!0,noMeds:b.noMeds===!0,setupHidden:b.setupHidden===!0};return{v:ts,profile:h,meds:a,doses:Pa(n.doses,r),seizures:i,checkins:qa(n.checkins),contacts:l,card:y,settings:D}}var S=ge(),At=new Set,Pt=!1;function O(){return S}function ve(e){return At.add(e),()=>At.delete(e)}function we(){for(let e of At)try{e(S)}catch(t){console.error("[synara] listener threw:",t)}}async function j(e){if(!Pt)throw new Error("not-ready");return e(S),await Q.write(S),we(),S}function qt(){we()}function Ba(e){if(e.key===Qe)try{S=e.newValue?Ht(JSON.parse(e.newValue)):ge(),Pt=!0,we()}catch(t){console.warn("[synara] ignored an unreadable change from another tab:",t)}}var es=!1;async function as(){!es&&Q===ns&&typeof window<"u"&&(window.addEventListener("storage",Ba),es=!0);let e=await Q.read();return Pt=!0,e?(S=Ht(e),await Q.write(S),{state:S,firstRun:!1}):(S=ge(),{state:S,firstRun:!0})}async function os(){await Q.clear(),S=ge(),we()}async function je({seedFn:e}={}){return await Q.clear(),S=ge(),e&&(e(S),S.settings.seeded=!0),await Q.write(S),we(),S}function Wa(e,t){if(t<e.added)return[];if(e.ended&&t>=e.ended)return[];let n=[];for(let s of e.schedule)if(s.from<=t)n=s.times;else break;return n}function Z(e){let t=e.schedule[e.schedule.length-1];return t?t.times:[]}function Rt(e,t=f()){return!e.ended||e.ended>t}function W(e=S){let t=f();return e.meds.filter(n=>Rt(n,t))}function I(e,t=S){let n=[];for(let s of t.meds)for(let a of Wa(s,e))n.push({med:s,time:a});return n.sort((s,a)=>N(s.time)-N(a.time)||s.med.name.localeCompare(a.med.name))}function rs({name:e,dose:t="",form:n="tablet",times:s=[],notes:a="",color:r="violet"}){let i=f();return j(l=>{l.meds.push({id:L("med"),name:k(e,120).trim(),dose:k(t,60).trim(),form:Nt.has(n)?n:"tablet",notes:k(a,600).trim(),color:Ot.has(r)?r:"violet",added:i,ended:null,schedule:[{from:i,times:be(s)}]})})}function is(e,t){let n=f();return j(s=>{let a=s.meds.find(r=>r.id===e);if(a&&(typeof t.name=="string"&&(a.name=k(t.name,120).trim()),typeof t.dose=="string"&&(a.dose=k(t.dose,60).trim()),typeof t.notes=="string"&&(a.notes=k(t.notes,600).trim()),Nt.has(t.form)&&(a.form=t.form),Ot.has(t.color)&&(a.color=t.color),Array.isArray(t.times))){let r=be(t.times);if(r.join()===Z(a).join())return;let i=a.schedule[a.schedule.length-1];if(i.from===n){i.times=r;let l=a.schedule[a.schedule.length-2];l&&l.times.join()===r.join()&&a.schedule.pop()}else a.schedule.push({from:n,times:r})}})}function cs(e){let t=f();return j(n=>{let s=n.meds.find(a=>a.id===e);if(s){if(s.added>=t){n.meds=n.meds.filter(a=>a.id!==e);for(let a of Object.keys(n.doses)){for(let r of Object.keys(n.doses[a]))r.startsWith(`${e}|`)&&delete n.doses[a][r];Object.keys(n.doses[a]).length||delete n.doses[a]}return}s.ended=t}})}function ls(e){let t=f();return j(n=>{let s=n.meds.find(r=>r.id===e);if(!s||!s.ended)return;let a=Z(s);s.ended<t&&(s.schedule.push({from:s.ended,times:[]}),s.schedule.push({from:t,times:a})),s.ended=null})}var Dt=(e,t)=>`${e}|${t}`;function tt(e,t,n,s){return j(a=>{if(s==="pending"){a.doses[e]&&(delete a.doses[e][Dt(t,n)],Object.keys(a.doses[e]).length||delete a.doses[e]);return}ss.has(s)&&(a.doses[e]||(a.doses[e]={}),a.doses[e][Dt(t,n)]={status:s,at:oe()})})}function q(e,t,n,s=S){let a=s.doses[e]&&s.doses[e][Dt(t,n)];return a?a.status:"pending"}var nt=60;function Ie(e,t,n,s=S){let a=q(e,t,n,s);if(a!=="pending")return a;let r=f();if(e<r)return"missed";if(e>r)return"pending";let i=new Date;return i.getHours()*60+i.getMinutes()>N(n)+nt?"missed":"pending"}function ds({at:e,duration:t=0,type:n="",trigger:s="",place:a="",aura:r="",injury:i=!1,emsCalled:l=!1,notes:u=""}){return j(h=>{let y=jt({id:L("sz"),at:e||oe(),duration:Number(t)||0,type:n,trigger:s,place:a,aura:r,injury:!!i,emsCalled:!!l,notes:(u||"").trim(),logged:oe()});y&&(h.seizures.push(y),h.seizures.sort(It))})}function us(e,t){return j(n=>{let s=n.seizures.findIndex(r=>r.id===e);if(s<0)return;let a=jt({...n.seizures[s],...t,id:e});a&&(n.seizures[s]=a,n.seizures.sort(It))})}function ps(e){return j(t=>{t.seizures=t.seizures.filter(n=>n.id!==e)})}function hs(e,t){return j(n=>{n.checkins[e]={...n.checkins[e]||{},...t,at:oe()}})}function He(e,t=S){return t.checkins[e]||null}function ms({name:e,relation:t="",phone:n,primary:s=!1}){return j(a=>{s&&a.contacts.forEach(r=>{r.primary=!1}),a.contacts.push({id:L("c"),name:k(e,120).trim(),relation:k(t,80).trim(),phone:k(n,40).trim(),primary:!!s})})}function fs(e,t){return j(n=>{let s=n.contacts.find(a=>a.id===e);s&&(t.primary&&n.contacts.forEach(a=>{a.primary=!1}),typeof t.name=="string"&&(s.name=k(t.name,120).trim()),typeof t.relation=="string"&&(s.relation=k(t.relation,80).trim()),typeof t.phone=="string"&&(s.phone=k(t.phone,40).trim()),typeof t.primary=="boolean"&&(s.primary=t.primary))})}function ys(e){return j(t=>{t.contacts=t.contacts.filter(n=>n.id!==e)})}function bs(e){return j(t=>{Object.assign(t.card,e,{updated:f()})})}function st(e){return j(t=>{for(let n of Object.keys(t.profile))typeof e[n]=="string"&&(t.profile[n]=k(e[n],200).trim())})}function ee(e){return j(t=>Object.assign(t.settings,e))}function at(){return JSON.stringify(S,null,2)}async function ot(e){let t;try{t=JSON.parse(e)}catch{throw new Error("not-json")}if(!(t&&typeof t=="object"&&Array.isArray(t.meds)&&Array.isArray(t.seizures)&&t.doses&&typeof t.doses=="object"))throw new Error("not-synara");return S=Ht(t),await Q.write(S),we(),S}var g={shell:document.querySelector(".app-shell"),backdrop:document.getElementById("backdrop"),sheet:document.getElementById("sheet"),emergency:document.getElementById("emergency"),welcome:document.getElementById("welcome"),toast:document.getElementById("toast")},gs={home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.8V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.8"/>',pill:'<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M8.8 8.8l6.4 6.4"/>',chart:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 15l3.5-4 3 2.5L18 8"/>',shield:'<path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.4-7.5 9.5-4.4-1.1-7.5-4.9-7.5-9.5V6z"/><path d="M12 9v4"/><path d="M12 16h.01"/>',sync:'<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',ribbon:'<path d="M12 13.5c-2.6-3-4-5.4-4-7.2a4 4 0 0 1 8 0c0 1.8-1.4 4.2-4 7.2Z"/><path d="M12 13.5 7.5 21l-2-1.2 4.4-7.3"/><path d="M12 13.5l4.5 7.5 2-1.2-4.4-7.3"/>',user:'<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',chevron:'<path d="m9 6 6 6-6 6"/>',phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',trash:'<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-.8 14a1 1 0 0 1-1 1H6.8a1 1 0 0 1-1-1L5 6"/>',print:'<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',wave:'<path d="M2 12c2.5-3 4.5-3 7 0s4.5 3 7 0 4.5-3 6 0"/><path d="M2 17c2.5-3 4.5-3 7 0s4.5 3 7 0 4.5-3 6 0" opacity=".5"/>',bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',pin:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',"trend-up":'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',"trend-down":'<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',down:'<path d="M12 4v12"/><path d="m6 10 6 6 6-6"/><path d="M4 20h16"/>',up:'<path d="M12 20V8"/><path d="m6 14 6-6 6 6"/><path d="M4 4h16"/>',check:'<path d="M20 6 9 17l-5-5"/>',note:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5"/><path d="M10 2h4"/><path d="M12 2v3"/>',book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',school:'<path d="M3 10 12 5l9 5-9 5z"/><path d="M7 12v5c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5v-5"/><path d="M21 10v6"/>',stethoscope:'<path d="M5 3v6a5 5 0 0 0 10 0V3"/><path d="M10 14v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',run:'<circle cx="14" cy="4" r="2"/><path d="m8 21 3-6 3 2v5"/><path d="M6 12l3-3 4 1 3 3 3 1"/><path d="m11 15-2-4"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',sparkle:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6.3 6.3 2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',play:'<path d="M7 4v16l13-8z"/>',archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>'};function c(e,t=24){let n=gs[e]||gs.info;return`<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${n}</svg>`}var Ya=["action","id","med","time","day","tab","to","field","value","theme"];function Bt(e){return!e||!e.dataset||!e.dataset.action?null:Ya.filter(t=>e.dataset[t]!=null).map(t=>`[data-${t}="${CSS.escape(e.dataset[t])}"]`).join("")}function Wt(e,t=document){if(!e)return!1;let n=t.querySelector(e);return n?(n.focus({preventScroll:!0}),!0):!1}var ct=new Set;function ws(e){g.shell&&(e?g.shell.setAttribute("inert",""):g.shell.removeAttribute("inert"))}function Yt(e){ct.add(e),ws(!0)}function _t(e){ct.delete(e),ct.size||ws(!1)}function Kt(e){e.hidden=!1,e.offsetHeight,e.dataset.open="true"}function lt(e,t=300){return delete e.dataset.open,new Promise(n=>{setTimeout(()=>{e.dataset.open!=="true"&&(e.hidden=!0,e.innerHTML=""),n()},t)})}var te=!1,Ft=null,$e=null,rt=null;function C({title:e,body:t,footer:n="",onMount:s,onClose:a}){te||($e=document.activeElement,Ft=Bt($e)),rt=a||null,g.sheet.innerHTML=p`
    <div class="sheet-grip" aria-hidden="true"></div>
    <div class="sheet-head">
      <h2 id="sheet-title">${e}</h2>
      <button class="icon-btn" data-action="close-sheet" aria-label="Close">
        ${o(c("x"))}
      </button>
    </div>
    <div class="sheet-body">${o(t)}</div>
    ${o(n?`<div class="sheet-foot">${n}</div>`:"")}
  `,g.backdrop.hidden=!1,g.backdrop.offsetHeight,g.backdrop.dataset.open="true",Kt(g.sheet),te=!0,Yt("sheet"),(g.sheet.querySelector('.sheet-body input:not([type="hidden"]), .sheet-body textarea, .sheet-body select, .sheet-body button, .sheet-foot button')||g.sheet.querySelector('[data-action="close-sheet"]')).focus({preventScroll:!0}),s&&s(g.sheet)}function E(){if(!te)return Promise.resolve();te=!1;let e=lt(g.sheet);if(lt(g.backdrop).then(()=>{g.backdrop.hidden=!0}),_t("sheet"),$e&&$e.isConnected?$e.focus({preventScroll:!0}):Wt(Ft),$e=null,Ft=null,rt){let t=rt;rt=null,t()}return e}function $s(){return te}function Y(){return g.sheet}function _(){let e={};return g.sheet.querySelectorAll("[name]").forEach(t=>{t.type==="checkbox"?e[t.name]=t.checked:e[t.name]=t.value}),e}async function R({title:e,message:t,confirmLabel:n="Delete",danger:s=!0,onConfirm:a}){te&&await E(),C({title:e,body:p`<p class="sheet-message">${t}</p>`,footer:`
      <button class="btn btn-quiet" data-action="close-sheet">Cancel</button>
      <button class="btn ${s?"btn-danger":"btn-primary"}" data-sheet-confirm>${n}</button>
    `,onMount(r){r.querySelector("[data-sheet-confirm]").addEventListener("click",async()=>{await E(),a()})}})}var vs=null;function m(e,t="default"){clearTimeout(vs);let n=t==="ok"?"\u2713 ":t==="bad"?"! ":"";g.toast.textContent=n+e,g.toast.dataset.tone=t,g.toast.dataset.open="true",vs=setTimeout(()=>{delete g.toast.dataset.open},2800)}var ke=!1,it=null,Pe=null;async function ks(){try{"wakeLock"in navigator&&(Pe=await navigator.wakeLock.request("screen"))}catch{Pe=null}}function _a(){try{Pe&&Pe.release()}catch{}Pe=null}document.addEventListener("visibilitychange",()=>{ke&&document.visibilityState==="visible"&&ks()});function Ss(e,{onClose:t,onMount:n}={}){te&&E(),it=t||null,g.emergency.innerHTML=e,Kt(g.emergency),ke=!0,Yt("emergency");let s=g.emergency.querySelector("[data-autofocus]")||g.emergency.querySelector("button, a");s&&s.focus({preventScroll:!0}),ks(),n&&n(g.emergency)}function Se(){if(ke&&(ke=!1,lt(g.emergency,220),_t("emergency"),_a(),it)){let e=it;it=null,e()}}function dt(){return ke}function ie(){return g.emergency}function xs(e){g.welcome.innerHTML=e,Kt(g.welcome),Yt("welcome");let t=g.welcome.querySelector("button");t&&t.focus({preventScroll:!0})}function qe(){lt(g.welcome,250),_t("welcome")}function Ms(e){g.welcome.innerHTML=e,g.welcome.scrollTop=0;let t=g.welcome.querySelector("[data-intro-focus]")||g.welcome.querySelector("button");t&&t.focus({preventScroll:!0})}function Ts(){return ct.has("welcome")}function ut(){return'<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 18h5l3-8 5 14 3.5-9H28" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'}var Ka="https://fluxplanner.github.io/Flux/landing.html";function xe(e=""){let t=document.documentElement.dataset.host==="flux"?"public/synara/icons/flux-logo.png":"icons/flux-logo.png";return`<a class="powered-by ${e}" href="${Ka}" target="_blank" rel="noopener"><span class="powered-by-t">Powered by</span><img class="powered-by-logo" src="${t}" alt="" width="18" height="18" /><span class="powered-by-name">Flux</span></a>`}g.backdrop.addEventListener("click",()=>{E()});document.addEventListener("keydown",e=>{e.key==="Escape"&&(te?E():ke&&Se())});function Re(){if(!("Notification"in window))return{ok:!1,reason:"This browser does not support notifications."};if(location.protocol==="file:")return{ok:!1,reason:"Notifications need the app served over https."};let e=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===!0;return/iPad|iPhone|iPod/.test(navigator.userAgent)&&!e?{ok:!1,reason:"On iPhone, add Synara to your home screen first \u2014 Safari only allows notifications for installed apps."}:{ok:!0,reason:""}}function Me(){return"Notification"in window?Notification.permission:"unsupported"}async function Es(){if(!("Notification"in window))return"unsupported";try{return await Notification.requestPermission()}catch{return"denied"}}var Ut=[];function Va(){Ut.forEach(clearTimeout),Ut=[]}function Ua(e,t){let n=e.quietHours;if(!n)return!1;let s=t.getHours()*60+t.getMinutes(),a=N(n.from),r=N(n.to);return a>r?s>=a||s<r:s>=a&&s<r}function Xa(e,t){try{let n=new Notification("Time for your medication",{body:`${e.name} ${e.dose} \u2014 ${P(t)}`,tag:`synara-${e.id}-${t}`,icon:"icons/icon-192.png",badge:"icons/icon-192.png"});n.onclick=()=>{window.focus(),location.hash="#/meds",n.close()}}catch(n){console.warn("[synara] could not show notification:",n)}}function Vt(){Va();let e=O(),{remindersOn:t,reminderLead:n}=e.settings;if(!t||Me()!=="granted")return 0;let s=new Date,a=f(s),r=s.getHours()*60+s.getMinutes(),i=0;for(let{med:l,time:u}of I(a,e)){let h=N(u)-(n||0);if(h<=r||q(a,l.id,u,e)!=="pending")continue;let y=(h-r)*6e4;Ut.push(setTimeout(()=>{let b=O();b.settings.remindersOn&&(Ua(b.settings,new Date)||q(f(),l.id,u,b)==="pending"&&Xa(l,u))},y)),i++}return i}function zs(){Vt(),ve(Vt),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&Vt()})}function Cs(){if(Me()!=="granted")return!1;try{return new Notification("Synara reminders are on",{body:"This is what a dose reminder will look like.",icon:"icons/icon-192.png",tag:"synara-test"}),!0}catch{return!1}}var Jt="synara.flux";function Gt(){return typeof document<"u"&&document.documentElement.dataset.host==="flux"}function Ja(e){return{v:1,meds:e.meds.map(t=>({name:t.name,dose:t.dose,color:t.color,added:t.added,ended:t.ended,schedule:t.schedule.map(n=>({from:n.from,times:n.times.slice()}))}))}}function As(e){if(Gt())try{if(!e.settings.fluxLink){localStorage.removeItem(Jt);return}let t=JSON.stringify(Ja(e));localStorage.getItem(Jt)!==t&&localStorage.setItem(Jt,t)}catch{}}var js="synara.sync",Qt="0123456789ABCDEFGHJKMNPQRSTVWXYZ",Ga=3e3;function Is(e){let t=0,n=0,s="";for(let a of e)for(n=(n<<8|a)&65535,t+=8;t>=5;)s+=Qt[n>>>t-5&31],t-=5;return t>0&&(s+=Qt[n<<5-t&31]),s}function ht(e){let t=String(e||"").toUpperCase().replace(/[^0-9A-Z]/g,"").replace(/O/g,"0").replace(/[IL]/g,"1");if(t.length!==26)return null;let n=0,s=0,a=[];for(let r of t){let i=Qt.indexOf(r);if(i<0)return null;s=(s<<5|i)&65535,n+=5,n>=8&&(a.push(s>>>n-8&255),n-=8)}return a.length!==16||(s&(1<<n)-1)!==0?null:new Uint8Array(a)}function Qa(e){return e.match(/.{1,4}/g).join("-")}var Hs=["remindersOn","fluxLink"];function Za(e){let t=JSON.parse(e);if(t.settings)for(let n of Hs)delete t.settings[n];return JSON.stringify(t)}function eo(e,t){let n=JSON.parse(e);n.settings={...n.settings||{}};for(let s of Hs)n.settings[s]=t.settings[s];return JSON.stringify(n)}function to(e,t,n){if(!t)return n.remoteAt?"gone":"push";let s=e!==n.hash,a=t.updated_at!==n.remoteAt;return s&&a?"conflict":a?"pull":s?"push":"none"}var Os=e=>{let t="";for(let n=0;n<e.length;n+=32768)t+=String.fromCharCode(...e.subarray(n,n+32768));return btoa(t)},Ns=e=>Uint8Array.from(atob(e),t=>t.charCodeAt(0));async function Ps(e){return crypto.subtle.importKey("raw",e,"AES-GCM",!1,["encrypt","decrypt"])}async function no(e,t){let n=crypto.getRandomValues(new Uint8Array(12)),s=new TextEncoder().encode(e),a=await crypto.subtle.encrypt({name:"AES-GCM",iv:n},await Ps(t),s);return{ciphertext:Os(new Uint8Array(a)),iv:Os(n)}}async function qs(e,t){try{let n=await crypto.subtle.decrypt({name:"AES-GCM",iv:Ns(e.iv)},await Ps(t),Ns(e.ciphertext));return new TextDecoder().decode(n)}catch{throw Object.assign(new Error("wrong-key"),{code:"wrong-key"})}}async function tn(e){let t=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(e));return Array.from(new Uint8Array(t),n=>n.toString(16).padStart(2,"0")).join("")}var Be={phase:"off",error:"",account:null},Zt=new Set,en=null,Fe=null,Ls=!1;function F(e){Be={...Be,...e};for(let t of Zt)t(Be)}function Rs(e){return Zt.add(e),()=>Zt.delete(e)}function mt(){return Be}function Ee(){try{return JSON.parse(localStorage.getItem(js)||"null")||{}}catch{return{}}}function We(e){try{localStorage.setItem(js,JSON.stringify(e))}catch{}}function X(){return!!Ee().key}function Fs(){return Ee().at||""}function nn(){let e=Ee().key;return e?Qa(e):""}function Bs(){return typeof document<"u"&&document.documentElement.dataset.host==="flux"}function ce(){return window.FluxSynaraVault||null}function ft(){return ce()||document.readyState!=="loading"?Promise.resolve(ce()):new Promise(e=>document.addEventListener("DOMContentLoaded",()=>e(ce()),{once:!0}))}function ze(e){if(!e)throw Object.assign(new Error("not-ready"),{code:"not-ready"});return e}async function Ws(){let e=await ft();if(!e)return null;try{return await e.account()}catch{return null}}async function pt(){return F({account:await Ws()}),Be.account}function Ys(e){return e&&(e.code||e.message)||"failed"}var sn=()=>Za(at());async function an(e,t){let n=sn(),s=await no(n,t),a=await ze(ce()).put(s);We({...e,hash:await tn(n),remoteAt:a.updated_at,at:new Date().toISOString()})}async function on(e,t,n){let s=await qs(n,t);We({...e,remoteAt:n.updated_at}),await ot(eo(s,O())),We({...Ee(),hash:await tn(sn()),at:new Date().toISOString()})}function Te(){return Fe||(Fe=(async()=>{let e=Ee();if(!e.key||!Bs())return F({phase:"off"}),"off";let t=await ft();if(!t)return F({phase:"error",error:"not-ready"}),"error";F({phase:"syncing",error:""});try{let n=ht(e.key),s=await t.get(),a=to(await tn(sn()),s,e);if(a==="push")await an(e,n);else if(a==="pull")await on(e,n,s);else{if(a==="gone")return We({}),F({phase:"off",error:"gone"}),a;if(a==="conflict")return F({phase:"conflict"}),a}return F({phase:"idle",error:""}),a}catch(n){return F({phase:"error",error:Ys(n)}),"error"}})().finally(()=>{Fe=null}),Fe)}async function _s(e){let t=Ee(),n=ht(t.key);F({phase:"syncing",error:""});try{e==="cloud"?await on(t,n,await ze(ce()).get()):await an(t,n),F({phase:"idle"})}catch(s){throw F({phase:"error",error:Ys(s)}),s}}async function rn(){let e=ze(await ft());if(!await Ws())throw Object.assign(new Error("signed-out"),{code:"signed-out"});if(await e.get())throw Object.assign(new Error("has-copy"),{code:"has-copy"});let t=crypto.getRandomValues(new Uint8Array(16));await an({key:Is(t)},t),F({phase:"idle",error:""})}async function Ks(e){let t=ht(e);if(!t)throw Object.assign(new Error("bad-key"),{code:"bad-key"});let n=await ze(await ft()).get();if(!n)throw Object.assign(new Error("no-copy"),{code:"no-copy"});let s=JSON.parse(await qs(n,t));return{key:Is(t),updatedAt:n.updated_at,meds:Array.isArray(s.meds)?s.meds.length:0,seizures:Array.isArray(s.seizures)?s.seizures.length:0,name:s.profile&&typeof s.profile.name=="string"?s.profile.name:""}}async function Vs(e){let t=ht(e);await on({key:e},t,await ze(ce()).get()),F({phase:"idle",error:""})}async function Ce({deleteCopy:e=!1}={}){e&&await ze(ce()).remove(),We({}),clearTimeout(en),F({phase:"off",error:""})}async function Us(){!Bs()||Ls||(Ls=!0,ve(()=>{X()&&(clearTimeout(en),en=setTimeout(Te,Ga))}),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&(pt(),X()&&Te())}),window.addEventListener("online",()=>{X()&&Te()}),await pt(),X()&&Te())}var yn={};me(yn,{actions:()=>bo,setupCard:()=>mn,setupList:()=>hn,show:()=>fn});var so=[4,12,25,26,41],ao=[2,6,9,17,22,31],cn=45,oo=21,ro=30,io={3:5,4:6,11:5.5,12:6,24:4.5,25:5.5,38:6},Js={3:5,4:4,10:4,11:5,23:4,24:5,37:4,38:4},co=e=>Math.round(e*10)/10;function yt(e){let t=f();e.profile={name:"Maya Ellison",pronouns:"she/her",grade:"11th grade",school:"Rosewood High School",seizureType:"Focal impaired awareness, occasional tonic-clonic",diagnosed:"2022",neurologist:"Dr. Priya Raghavan",neuroPhone:"(555) 010-4488",allergies:"Penicillin",bloodType:"O+"};let n=z(t,-cn),s=z(t,-oo),a=z(t,-ro),r={id:L("med"),name:"Levetiracetam",dose:"500 mg",form:"tablet",notes:"Take with food. Evening dose moved to 8pm so it is done before homework.",color:"violet",added:n,ended:null,schedule:[{from:n,times:["08:00","21:00"]},{from:s,times:["08:00","20:00"]}]},i={id:L("med"),name:"Lamotrigine",dose:"100 mg",form:"tablet",notes:"Never stop suddenly \u2014 taper only with Dr. Raghavan.",color:"mint",added:n,ended:null,schedule:[{from:n,times:["08:00"]}]},l={id:L("med"),name:"Topiramate",dose:"25 mg",form:"tablet",notes:"Stopped with Dr. Raghavan \u2014 made it hard to concentrate in class.",color:"amber",added:n,ended:a,schedule:[{from:n,times:["21:00"]}]};e.meds=[r,i,l],e.doses={};for(let h=cn;h>=1;h--){let y=z(t,-h),b={},A=so.includes(h),D=ao.includes(h),$=y<s?"21:00":"20:00";b[`${r.id}|08:00`]={status:D?"late":"taken",at:`${y}T08:12`},b[`${i.id}|08:00`]={status:D?"late":"taken",at:`${y}T08:12`},A?b[`${r.id}|${$}`]={status:"missed",at:`${y}T23:50`}:D?b[`${r.id}|${$}`]={status:"late",at:`${y}T22:40`}:b[`${r.id}|${$}`]={status:"taken",at:`${y}T${$==="21:00"?"21:04":"20:05"}`},y<a&&(b[`${l.id}|21:00`]={status:"taken",at:`${y}T21:06`}),e.doses[y]=b}e.checkins={};for(let h=cn;h>=0;h--){let y=z(t,-h),b=io[h],A=b??co(7.4+h*37%11/10),D=Js[h]!=null?Js[h]:1+h*17%3;e.checkins[y]={sleepHours:A,sleepQuality:A<6?"poor":A<7?"ok":"good",stress:D,mood:D>=4?"low":"ok",notes:"",at:`${y}T07:30`}}let u=[{back:3,time:"15:40",duration:95,type:"Focal impaired awareness",trigger:"Missed sleep",place:"School \u2014 classroom",aura:'Metallic taste, felt "far away" for about a minute',injury:!1,emsCalled:!1,notes:"Ms. Okafor followed the card. Sat with me until I came back. Missed the bus home."},{back:11,time:"21:10",duration:130,type:"Tonic-clonic",trigger:"Missed dose",place:"Home \u2014 bedroom",aura:"None that I remember",injury:!0,emsCalled:!1,notes:"Bit the inside of my cheek. Mom timed it at just over two minutes."},{back:24,time:"07:55",duration:60,type:"Focal aware",trigger:"Missed sleep",place:"Home \u2014 kitchen",aura:"Stomach-dropping feeling",injury:!1,emsCalled:!1,notes:"Stayed home first period. Was fine by lunch."},{back:38,time:"14:20",duration:150,type:"Tonic-clonic",trigger:"Flashing lights",place:"School \u2014 gym",aura:"Visual static",injury:!1,emsCalled:!0,notes:"Assembly with strobe lighting. Nurse called EMS because it went past two minutes. Did not go to hospital."}];return e.seizures=u.map(h=>({id:L("sz"),at:`${z(t,-h.back)}T${h.time}`,duration:h.duration,type:h.type,trigger:h.trigger,place:h.place,aura:h.aura,injury:h.injury,emsCalled:h.emsCalled,notes:h.notes,logged:`${z(t,-h.back)}T${h.time}`})),e.seizures.sort((h,y)=>h.at<y.at?1:-1),e.contacts=[{id:L("c"),name:"Dana Ellison",relation:"Mom",phone:"(555) 014-2007",primary:!0},{id:L("c"),name:"Marcus Ellison",relation:"Dad",phone:"(555) 014-2019",primary:!1},{id:L("c"),name:"Dr. Priya Raghavan",relation:"Neurologist",phone:"(555) 010-4488",primary:!1},{id:L("c"),name:"Nurse Ruiz",relation:"School nurse",phone:"(555) 018-8300",primary:!1},{id:L("c"),name:"Aunt Jo",relation:"Emergency pickup",phone:"(555) 016-3520",primary:!1}],e.card={looksLike:"Maya usually goes quiet and stops responding. She may stare, blink repeatedly, or pick at her clothes. She sometimes says food tastes metallic right before. Most last under two minutes. Afterwards she is confused and very tired for 20\u201330 minutes and may not remember what happened.",during:["Stay with her and start timing immediately.","Move chairs, desks, and anything hard or sharp out of the way.","Put something soft under her head.","Loosen anything tight around her neck.","If she is not aware or not awake, gently turn her onto her side.","Stay calm and speak normally \u2014 she may be able to hear you."],doNot:["Do NOT put anything in her mouth. She cannot swallow her tongue.","Do NOT hold her down or try to stop the movements.","Do NOT give food, drink, or pills until she is fully awake.","Do NOT crowd her \u2014 ask other students to step back."],after:["Stay with her until she is fully alert and knows where she is.","Tell her calmly what happened \u2014 she will not remember.","Let her rest somewhere quiet. The nurse's office is best.","Call her mom, Dana, at (555) 014-2007.","Write down the time it started and how long it lasted."],callEms:["The seizure lasts longer than 5 minutes.","A second seizure starts soon after the first.","She does not wake up or return to normal afterwards.","She is having trouble breathing, or her lips stay blue.","She was injured, or it happened in water."],forTeacher:"Do not send her to the office alone afterwards \u2014 she will be confused and may not make it there. Send another student to get Nurse Ruiz instead. She is allowed to make up any assessment missed; this is in her 504 plan.",forNurse:"No rescue medication is prescribed at school. Standard first aid only. Call Dana Ellison first, then Dr. Raghavan's office if EMS criteria are met. Maya prefers to rest in the dark side room rather than the main bay.",forCoach:"Cleared for all sports except swimming without a spotter on deck. No climbing above head height. If she has a seizure at practice she is done for the day \u2014 no returning to play, even if she says she feels fine.",updated:z(t,-6)},e.settings={theme:"system",remindersOn:!1,reminderLead:0,quietHours:null,seeded:!0},e}function lo(e,{reminders:t=!0}={}){let{profile:n,settings:s,card:a,contacts:r}=e,i=[{id:"details",icon:"user",title:"Your details",todo:"School, grade, neurologist and allergies",done:!!(n.name.trim()&&n.school.trim()),action:"profile-edit"},{id:"meds",icon:"pill",title:"Your medication",todo:"Each one, with the times you take it",done:s.noMeds||W(e).length>0,action:"med-open"},{id:"looksLike",icon:"note",title:"What your seizures look like",todo:"So someone watching knows what\u2019s happening",done:!!a.looksLike.trim(),action:"card-edit",data:{field:"looksLike"}},{id:"contacts",icon:"phone",title:"Emergency contacts",todo:"Who to call, and their number",done:r.length>0,action:"contact-open"}];return t&&!s.noMeds&&i.push({id:"reminders",icon:"bell",title:"Dose reminders",todo:"A nudge at each dose time",done:s.remindersOn,action:"nav",data:{to:"you"}}),i}function Ae(e,t){let n=lo(e,t),s=n.filter(a=>a.done).length;return{items:n,done:s,total:n.length,complete:s===n.length}}function Gs(e,t){return!e.settings.setupHidden&&!e.settings.seeded&&!Ae(e,t).complete}var uo=[["Tonic-clonic","Stiffening, then jerking; not aware during it"],["Absence","Brief blank stares, usually a few seconds"],["Focal aware","Awake and aware, with odd feelings or movements"],["Focal impaired awareness","Not fully aware; may stare, fumble or wander"],["Myoclonic","Sudden, quick jerks"],["Atonic","Sudden loss of muscle tone; may drop or fall"]],Ye="Not sure yet",pn=[{text:"Purple Day was started in 2008 by Cassidy Megan, a 9-year-old in Nova Scotia, Canada, who wanted kids with epilepsy to know they aren\u2019t alone. Now people around the world mark it every March 26.",source:"Purple Day"},{text:"With the right treatment, up to 70% of people with epilepsy can live without seizures.",source:"World Health Organization"},{text:"About 50 million people around the world have epilepsy. It\u2019s one of the most common conditions of the brain.",source:"World Health Organization"},{text:"In the US, about 1 in 26 people will develop epilepsy at some point in their life.",source:"Epilepsy Foundation"},{text:"Epilepsy is one of the oldest known conditions. Written records of it go back thousands of years.",source:"World Health Organization"},{text:"Purple is the color of epilepsy awareness. It comes from lavender, a flower linked with solitude: a reminder that no one with epilepsy should feel alone.",source:"Purple Day"},{text:"Seizure first aid fits in three words: Stay, Safe, Side. Stay with them, keep them safe, and turn them on their side if they aren\u2019t awake.",source:"Epilepsy Foundation"}],dn=4,J=0,x=Qs(),un=!1,gt=0;function Qs(){return{name:"",types:[],diagnosed:"",meds:"yes",error:""}}function vt(){return Re().ok&&Me()!=="denied"}function hn(e){let{items:t}=Ae(e,{reminders:vt()});return t.map(n=>{let s=Object.entries(n.data||{}).map(([a,r])=>` data-${a}="${d(r)}"`).join("");return`
      <li>
        <button type="button" class="setup-row" data-action="setup-go" data-target="${n.action}"${s}
                data-done="${n.done}">
          <span class="setup-ico" aria-hidden="true">${c(n.done?"check":n.icon,18)}</span>
          <span class="row-body">
            <span class="row-t">${d(n.title)}</span>
            <span class="row-s">${n.done?"Done":d(n.todo)}</span>
          </span>
          <span class="chev" aria-hidden="true">${c("chevron")}</span>
        </button>
      </li>`}).join("")}function mn(e){let t={reminders:vt()};if(!Gs(e,t))return"";let{done:n,total:s}=Ae(e,t);return p`
    <section class="card setup-card" aria-labelledby="setup-h">
      <div class="setup-head">
        <div class="grow">
          <span class="eyebrow">Finish setting up</span>
          <h2 class="setup-h" id="setup-h">${n} of ${s} sections done</h2>
        </div>
        <button class="icon-btn" data-action="setup-hide" aria-label="Hide this list">${o(c("x"))}</button>
      </div>
      <progress class="setup-bar" max="${s}" value="${n}" aria-label="Setup progress"></progress>
      <ul class="setup-list">${o(hn(e))}</ul>
    </section>
  `}function wt(){return`<div class="intro-dots" aria-hidden="true">${Array.from({length:dn},(t,n)=>`<span class="intro-dot" data-state="${n<J?"done":n===J?"on":"next"}"></span>`).join("")}</div>
          <span class="sr-only">Step ${J+1} of ${dn}</span>`}function po(){return p`
    <div class="welcome-inner intro-step">
      ${o(wt())}
      <div class="brand-mark welcome-mark">${o(ut())}</div>
      <h1 class="welcome-h1" tabindex="-1" data-intro-focus>Synara</h1>
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
        <button class="btn btn-primary btn-lg btn-block" data-action="intro-next">
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

      ${o(xe("welcome-powered"))}
    </div>
  `}function ho(){let e=[...uo,[Ye,"That\u2019s fine \u2014 you can add it later"]].map(([n,s])=>{let a=x.types.includes(n);return`
      <button type="button" class="intro-choice" data-action="intro-type" data-value="${d(n)}"
              aria-pressed="${a}">
        <span class="intro-choice-body">
          <span class="intro-choice-t">${d(n)}</span>
          <span class="intro-choice-s">${d(s)}</span>
        </span>
        <span class="intro-tick" aria-hidden="true">${c("check",16)}</span>
      </button>`}).join(""),t=[["yes","Yes"],["no","Not right now"]].map(([n,s])=>`<button type="button" class="segment" data-action="intro-meds" data-value="${n}"
             aria-pressed="${x.meds===n}">${s}</button>`).join("");return p`
    <form class="intro intro-step" data-action="intro-answers" novalidate>
      ${o(wt())}
      <span class="intro-ico" aria-hidden="true">${o(c("user",26))}</span>
      <h1 class="intro-h" tabindex="-1" data-intro-focus>First, a little about you</h1>
      <p class="intro-sub">It fills in your details and your safety card. Everything is optional,
        and you can change it any time in You.</p>

      <div class="field">
        <label class="label" for="intro-name">What should we call you?</label>
        <input class="input" id="intro-name" name="name" value="${x.name}" placeholder="Your first name"
               autocomplete="given-name" maxlength="60" />
      </div>

      <fieldset class="intro-fieldset">
        <legend class="label">What kind of seizures do you have? <span class="ink-3">Pick any</span></legend>
        <div class="intro-choices">${o(e)}</div>
      </fieldset>

      <div class="field">
        <label class="label" for="intro-diagnosed">What year were you diagnosed?</label>
        <input class="input intro-year" id="intro-diagnosed" name="diagnosed" value="${x.diagnosed}"
               inputmode="numeric" maxlength="4" placeholder="e.g. 2021" autocomplete="off"
               aria-describedby="intro-year-error" />
        <span class="hint text-bad" id="intro-year-error" role="alert">${x.error}</span>
      </div>

      <div class="field">
        <span class="label" id="intro-meds-l">Do you take medication for your seizures?</span>
        <div class="segments" role="group" aria-labelledby="intro-meds-l">${o(t)}</div>
      </div>

      <div class="intro-actions">
        <button class="btn btn-primary btn-lg btn-block" type="submit">Continue</button>
        <button class="btn btn-quiet btn-block" type="button" data-action="intro-back">Back</button>
      </div>
    </form>
  `}function mo(){let e=pn[gt],t=x.name.trim().split(" ")[0];return p`
    <div class="intro intro-step">
      ${o(wt())}
      <span class="intro-ico" aria-hidden="true">${o(c("sparkle",26))}</span>
      <h1 class="intro-h" tabindex="-1" data-intro-focus>You’re not alone${t?`, ${t}`:""}</h1>
      <p class="intro-sub">Here’s something worth knowing about epilepsy.</p>

      <figure class="intro-fact" aria-live="polite">
        <span class="eyebrow">Did you know?</span>
        <blockquote class="intro-fact-t">${e.text}</blockquote>
        <figcaption class="t-sm ink-3">Source: ${e.source}</figcaption>
      </figure>
      <button class="btn btn-quiet" type="button" data-action="intro-fact">
        ${o(c("sparkle",16))} Another fact
      </button>

      <div class="intro-actions">
        <button class="btn btn-primary btn-lg btn-block" data-action="intro-next">Continue</button>
        <button class="btn btn-quiet btn-block" type="button" data-action="intro-back">Back</button>
      </div>
    </div>
  `}function fo(){let e=O(),{done:t,total:n}=Ae(e,{reminders:vt()});return p`
    <div class="intro intro-step">
      ${o(wt())}
      <span class="intro-ico" aria-hidden="true">${o(c("shield",26))}</span>
      <h1 class="intro-h" tabindex="-1" data-intro-focus>Now, fill in your sections</h1>
      <p class="intro-sub">These are what make your safety card useful when someone needs it.
        Tap one to start. This list stays on Home until it’s done.</p>
      <p class="t-sm ink-3 intro-count">${t} of ${n} done</p>

      <ul class="setup-list intro-sections">${o(hn(e))}</ul>

      <div class="intro-actions">
        <button class="btn btn-primary btn-lg btn-block" data-action="intro-finish">Go to Synara</button>
        <button class="btn btn-quiet btn-block" type="button" data-action="intro-back">Back</button>
      </div>
    </div>
  `}var Zs=[po,ho,mo,fo];function bt(e){J=Math.max(0,Math.min(dn-1,e)),Ms(Zs[J]())}function fn(){J=0,x=Qs(),un=!1,gt=Math.floor(Math.random()*pn.length),xs(Zs[0]())}function ln(){let e=document.querySelector("#welcome form.intro");e&&(x.name=e.elements.name.value.trim(),x.diagnosed=e.elements.diagnosed.value.trim())}function yo(e){if(!e)return"";let t=Number(e),n=new Date().getFullYear();return/^\d{4}$/.test(e)&&t>=1900&&t<=n?"":`Enter a year like ${n-2}, or leave it blank.`}var bo={"intro-next"(){ln(),bt(J+1)},"intro-back"(){ln(),bt(J-1)},"intro-type"(e){let t=e.dataset.value,n=x.types.includes(t);t===Ye?x.types=n?[]:[Ye]:(x.types=x.types.filter(s=>s!==Ye&&s!==t),n||x.types.push(t)),e.closest(".intro-choices").querySelectorAll(".intro-choice").forEach(s=>{s.setAttribute("aria-pressed",String(x.types.includes(s.dataset.value)))})},"intro-meds"(e){x.meds=e.dataset.value,e.parentElement.querySelectorAll(".segment").forEach(t=>{t.setAttribute("aria-pressed",String(t===e))})},async"intro-answers"(){if(ln(),x.error=yo(x.diagnosed),x.error){let e=document.getElementById("intro-year-error");e&&(e.textContent=x.error),document.getElementById("intro-diagnosed")?.focus();return}un||(await je(),un=!0),await st({name:x.name,seizureType:x.types.filter(e=>e!==Ye).join(", "),diagnosed:x.diagnosed}),await ee({noMeds:x.meds==="no"}),bt(2)},"intro-fact"(){gt=(gt+1)%pn.length,bt(J)},"intro-finish"(){qe();let{complete:e}=Ae(O(),{reminders:vt()});m(e?"You\u2019re all set":"Your sections are on Home whenever you\u2019re ready","ok")},async"welcome-demo"(){await je({seedFn:yt}),qe(),m("Loaded example data \u2014 clear it any time in You","ok")},async"setup-hide"(){await ee({setupHidden:!0}),m("Hidden. Everything on it is in You and Safety.","ok")}};var $n={};me($n,{actions:()=>Fo,render:()=>Do,subtitle:()=>zo,title:()=>Eo});var ea="These are associations in your own log, not medical conclusions. Patterns can appear by chance, especially with few entries. Bring them to your neurologist rather than acting on them alone.",le=3,_e=e=>e.reduce((t,n)=>t+n,0)/e.length,de=e=>e.at.split("T")[0];function gn(e,t,n=0){let s=f(),a=0,r=0;for(let i=n+1;i<=t;i++){let l=z(s,-i);for(let{med:u,time:h}of I(l,e))r++,Ie(l,u.id,h,e)==="taken"&&a++}return{good:a,total:r}}function go(e){let t=f(),n=0;for(let s=1;s<=365;s++){let a=z(t,-s),r=I(a,e);if(!r.length||!r.every(({med:l,time:u})=>Ie(a,l.id,u,e)==="taken"))break;n++}return n}function vn(e){let t=e.seizures||[];return t.length<2?[]:[vo(e,t),wo(e,t),$o(e,t),ko(t),So(t),xo(t),Mo(e),To(t)].filter(Boolean).sort((n,s)=>s.strength-n.strength)}function ta(e){return vn(e)[0]||null}function vo(e,t){if(t.length<le||!e.meds.length)return null;let n=0,s=0;for(let r of t){let i=de(r),l=!1,u=!1;for(let h of[0,-1,-2]){let y=z(i,h);for(let{med:b,time:A}of I(y,e)){l=!0;let D=Ie(y,b.id,A,e);if(D==="missed"||D==="late"){u=!0;break}}if(u)break}l&&s++,u&&n++}if(s<le||n<2)return null;let a=Math.round(n/s*100);return a<60?null:{id:"dose-proximity",tone:"alert",icon:"pill",title:`${n} of your ${s} seizures followed a missed or late dose`,detail:`Within 48 hours before each of those ${T(n,"seizure")}, at least one scheduled dose was marked missed or late. This is the pattern most worth mentioning at your next appointment.`,evidence:`${n}/${s} seizures \xB7 ${a}%`,strength:100+a}}function na(e,t,n){let s=new Set(t.map(de)),a=[],r=[];for(let[i,l]of Object.entries(e.checkins||{}))typeof l[n]=="number"&&(s.has(i)?a:r).push(l[n]);return{onSeizureDays:a,onOtherDays:r}}function wo(e,t){let{onSeizureDays:n,onOtherDays:s}=na(e,t,"sleepHours");if(n.length<le||s.length<10)return null;let a=_e(n),r=_e(s),i=r-a;return i<.75?null:{id:"sleep",tone:"alert",icon:"moon",title:`You slept ${i.toFixed(1)} hours less before seizure days`,detail:`The nights before a seizure averaged ${a.toFixed(1)} hours, against ${r.toFixed(1)} on every other night. Short sleep is one of the most commonly reported seizure triggers.`,evidence:`${n.length} seizure nights vs ${s.length} others`,strength:90+Math.min(20,i*10)}}function $o(e,t){let{onSeizureDays:n,onOtherDays:s}=na(e,t,"stress");if(n.length<le||s.length<10)return null;let a=_e(n),r=_e(s),i=a-r;return i<.8?null:{id:"stress",tone:"watch",icon:"wave",title:"Seizure days were higher-stress days",detail:`You rated stress ${a.toFixed(1)} out of 5 on seizure days, against ${r.toFixed(1)} otherwise. Stress rarely acts alone \u2014 it tends to travel with the things that do, like less sleep, skipped meals, and broken routine.`,evidence:`${n.length} seizure days vs ${s.length} others`,strength:70+i*10}}function ko(e){if(e.length<le)return null;let t=Ct(e.map(a=>a.trigger).filter(a=>a&&a!=="None known"));if(!t.length||t[0].count<2)return null;let n=t[0],s=Math.round(n.count/e.length*100);return{id:"trigger",tone:"watch",icon:"bolt",title:`"${n.value}" is your most logged trigger`,detail:`You recorded it for ${T(n.count,"seizure")} out of ${e.length}. `+(t.length>1?`Next most common: ${t.slice(1,3).map(a=>`${a.value} (${a.count})`).join(", ")}.`:"It is the only trigger you have logged so far."),evidence:`${n.count}/${e.length} seizures \xB7 ${s}%`,strength:60+s/2}}var bn=[{from:0,to:4,label:"late at night (12am\u20134am)"},{from:4,to:8,label:"early in the morning (4am\u20138am)"},{from:8,to:12,label:"in the morning (8am\u201312pm)"},{from:12,to:16,label:"in the early afternoon (12pm\u20134pm)"},{from:16,to:20,label:"in the late afternoon (4pm\u20138pm)"},{from:20,to:24,label:"in the evening (8pm\u201312am)"}];function So(e){if(e.length<le)return null;let t=new Array(bn.length).fill(0);for(let a of e){let r=re(a.at).getHours();t[bn.findIndex(i=>r>=i.from&&r<i.to)]++}let n=0;for(let a=1;a<t.length;a++)t[a]>t[n]&&(n=a);if(t[n]<2)return null;let s=Math.round(t[n]/e.length*100);return s<50?null:{id:"time-of-day",tone:"neutral",icon:"clock",title:`Most of your seizures happen ${bn[n].label}`,detail:`${t[n]} of ${e.length} fell in that window. If it holds up, it is worth asking whether your dose timing lines up with it.`,evidence:`${t[n]}/${e.length} seizures \xB7 ${s}%`,strength:40+s/2}}function xo(e){if(e.length<le)return null;let t=Ct(e.map(s=>s.place).filter(Boolean));if(!t.length)return null;let n=e.filter(s=>/school/i.test(s.place||"")).length;return n<2&&t[0].count<2?null:{id:"place",tone:"neutral",icon:"pin",title:n>=2?`${n} of ${e.length} happened at school`:`Most often at: ${t[0].value}`,detail:n>=2?"Worth making sure the staff actually around you \u2014 not just the front office \u2014 have seen your safety card. Printing it from the Safety tab is the easiest way.":`You logged ${T(t[0].count,"seizure")} there out of ${e.length}.`,evidence:n>=2?`${n}/${e.length} seizures`:`${t[0].count}/${e.length} seizures`,strength:35}}function Mo(e){let t=gn(e,14),n=gn(e,45,14);if(t.total<10||n.total<10)return null;let s=Math.round(t.good/t.total*100),a=Math.round(n.good/n.total*100),r=s-a;if(Math.abs(r)<8)return null;let i=r>0;return{id:"adherence-trend",tone:i?"good":"alert",icon:i?"trend-up":"trend-down",title:i?`Your dose consistency is up ${r} points`:`Your dose consistency has slipped ${Math.abs(r)} points`,detail:`${s}% of doses taken on time over the last 14 days, against ${a}% in the month before.`+(i?" Keep going.":" Worth a look at which dose is slipping."),evidence:`${t.good}/${t.total} recent \xB7 ${n.good}/${n.total} before`,strength:i?50:85}}function To(e){if(e.length<4)return null;let t=f(),n=e.map(de).sort()[0],s=Ue(n,t);if(s<30)return null;let a=Math.floor(s/2),r=z(t,-a),i=e.filter(h=>de(h)>r).length,l=e.length-i;if(i===l)return null;let u=i<l;return{id:"frequency",tone:u?"good":"alert",icon:u?"sun":"alert",title:u?"Fewer seizures in the most recent stretch":"More seizures in the most recent stretch",detail:`${T(i,"seizure")} in the last ${a} days, against ${l} in the ${a} days before. Over a window this short a change like this can easily be chance \u2014 worth watching, not concluding.`,evidence:`${i} recent vs ${l} earlier`,strength:u?45:80}}function ue(e){let t=e.seizures||[],n=f(),{good:s,total:a}=gn(e,30),r=a?Math.round(s/a*100):null,i=t.length?t.map(de).sort().pop():null,l=i?Ue(i,n):null,u=t.filter(b=>Ue(de(b),n)<=30).length,h=t.map(b=>b.duration).filter(b=>b>0),y=h.length?Math.round(_e(h)):null;return{adherence:r,adherenceGood:s,adherenceTotal:a,daysSince:l,lastSeizure:i,seizuresLast30:u,totalSeizures:t.length,avgDuration:y,avgDurationLabel:y?Ne(y):null,streak:go(e)}}function sa(e,t=28){let n=new Set((e.seizures||[]).map(de)),s=f();return Un(t).map(a=>{let r=0,i=0,l="none";for(let{med:u,time:h}of I(a,e)){let y=a===s?q(a,u.id,h,e):Ie(a,u.id,h,e);y!=="pending"&&(i++,y==="taken"&&r++,y==="missed"?l="missed":y==="late"&&l!=="missed"?l="late":l==="none"&&(l="taken"))}return{day:a,taken:r,total:i,status:i===0?"none":l,seizure:n.has(a)}})}function aa(){let e=new Date().getHours();return e<5?"Hi":e<12?"Good morning":e<18?"Good afternoon":"Good evening"}function Eo(e){let t=(e.profile.name||"").split(" ")[0];return t?`${aa()}, ${t}`:aa()}function zo(e){if(!W(e).length)return"No medications added yet";let t=wn(e).filter(n=>n.status==="pending").length;return t?`${T(t,"dose")} left to log today`:"Every dose logged for today"}function wn(e){let t=f();return I(t,e).map(({med:n,time:s})=>({med:n,time:s,status:q(t,n.id,s,e)}))}function Co(e){let t=wn(e).filter(i=>i.status==="pending");if(!t.length)return null;let n=N(G()),s=i=>n-N(i.time),a=t.find(i=>s(i)>=0&&s(i)<=nt);if(a)return{...a,mode:"due",others:t.length-1};let r=t.filter(i=>s(i)>nt);return r.length?{...r[r.length-1],mode:"overdue",others:t.length-1}:{...t[0],mode:"upcoming",others:t.length-1}}function Ao(e){let t=z(f(),1);return I(t,e)[0]||null}function Do(e){let t=W(e).length>0,n=ue(e),s=ta(e),a=!!He(f(),e);return p`
    <div class="home-grid">
      <div class="home-main">
        ${o(t?No(e):Lo(e))}
        ${o(mn(e))}
        ${o(t?Ho(e):"")}
      </div>
      <div class="home-side">
        ${o(Oo())}
        ${o(jo(n))}
        ${o(a?"":Po())}
        ${o(s?qo(s):"")}
        ${o(Ro())}
      </div>
    </div>
  `}function Oo(){let e=new Date;return e.getMonth()!==2||e.getDate()!==26?"":p`
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
  `}function No(e){let t=Co(e);if(!t){let i=Ao(e);return p`
      <section class="card next-dose" data-state="clear" aria-label="Today's doses">
        <span class="eyebrow">Today</span>
        <div class="next-dose-when">All done</div>
        <span class="next-dose-what">
          Every dose today is logged.${o(i?` First one tomorrow: ${d(i.med.name)} at ${P(i.time)}.`:"")}
        </span>
      </section>
    `}let n=N(t.time)-N(G()),s=t.mode==="overdue"?`${Xe(-n)} overdue`:t.mode==="due"||n<=1?"Due now":`in ${Xe(n)}`,a=t.mode==="overdue"?"Not logged yet":t.mode==="due"?"Take it now":"Next dose",r=t.mode==="overdue"?`<button class="btn btn-on-brand" data-action="dose-quick"
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
            </button>`:""}`;return p`
    <section class="card next-dose" data-state="${t.mode}" aria-label="Next dose">
      <span class="eyebrow">${a}</span>
      <div class="next-dose-when">${s}</div>
      <span class="next-dose-what">
        ${t.med.name}${t.med.dose?` ${t.med.dose}`:""} · ${P(t.time)}
      </span>
      <div class="next-dose-actions">${o(r)}</div>
      ${o(t.others>0?`<button class="next-dose-more" data-action="nav" data-to="meds">
             ${t.others} more ${t.mode==="upcoming"?"later today":"to log today"} ${c("chevron",14)}
           </button>`:"")}
    </section>
  `}function Lo(e){return e.settings.noMeds?"":p`
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
  `}function jo(e){let t=e.adherence==null?"":e.adherence>=90?"ok":e.adherence>=75?"warn":"bad";return p`
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
  `}var Io={taken:"\u2713",late:"!",missed:"\u2715",pending:""};function Ho(e){let t=wn(e),n=f(),s=t.map(a=>{let r=Le(a.status,a.time);return`
      <li class="dose-row">
        <span class="med-dot" data-color="${d(a.med.color)}" aria-hidden="true">${c("pill",20)}</span>
        <span class="dose-body">
          <span class="dose-name">${d(a.med.name)} <span class="dose-amt">${d(a.med.dose)}</span></span>
          <span class="dose-meta" data-status="${a.status}">${P(a.time)} \xB7 ${r}</span>
        </span>
        <button class="tick" data-status="${a.status}" data-action="dose-cycle"
                data-med="${a.med.id}" data-time="${a.time}" data-day="${n}"
                aria-label="${d(a.med.name)} at ${P(a.time)}: ${r}. Tap to change.">
          ${Io[a.status]}
        </button>
      </li>`}).join("");return p`
    <section class="section" aria-labelledby="today-h">
      <div class="section-head">
        <h2 id="today-h">Today</h2>
        <button class="btn btn-sm btn-quiet" data-action="nav" data-to="meds">All meds</button>
      </div>
      <div class="card card-flush">
        <ul class="rows">${o(s)}</ul>
      </div>
      <p class="hint">Tap a circle to cycle: taken → late → missed → not logged.</p>
    </section>
  `}function Po(){return p`
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
  `}function qo(e){return p`
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
  `}function Ro(){return p`
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
  `}var Fo={async"dose-quick"(e){let{med:t,time:n,status:s}=e.dataset;await tt(f(),t,n,s),m(s==="taken"?"Marked taken":s==="late"?"Marked taken late":"Marked missed",s==="missed"?"default":"ok")}};var Sn={};me(Sn,{actions:()=>nr,render:()=>Jo,subtitle:()=>Xo,title:()=>Uo});var Bo=["violet","mint","amber","rose","blue"],Wo={violet:"Violet",mint:"Mint",amber:"Amber",rose:"Rose",blue:"Blue"},Yo={violet:"brand",mint:"ok",amber:"warn",rose:"bad",blue:"info"},_o=["tablet","capsule","liquid","patch","injection","other"],Ko={taken:"\u2713",late:"!",missed:"\u2715",pending:""},Vo={taken:"Taken",late:"Taken late",missed:"Missed",pending:"Not logged"},w=null;function Uo(){return"Medications"}function Xo(e){let t=W(e);if(!t.length)return"Nothing added yet";let n=t.reduce((s,a)=>s+Z(a).length,0);return`${T(t.length,"medication")} \xB7 ${T(n,"dose")} a day`}function Jo(e){let t=W(e),n=e.meds.filter(s=>!Rt(s));return t.length?p`
    <div class="split-grid">
      <div class="split-main">
        ${o(Go(e))}
        ${o(Zo(t))}
        ${o(n.length?oa(n):"")}
      </div>
      <div class="split-side">
        ${o(Qo(e))}
      </div>
    </div>
  `:p`
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
      ${o(n.length?oa(n):"")}
    `}function ia(e,t,n,s,a){return`
    <li class="dose-row">
      <span class="med-dot" data-color="${d(t.color)}" aria-hidden="true">${c("pill",20)}</span>
      <span class="dose-body">
        <span class="dose-name">${d(t.name)} <span class="dose-amt">${d(t.dose)}</span></span>
        <span class="dose-meta" data-status="${s}">${P(n)} \xB7 ${d(a)}</span>
      </span>
      <button class="tick" data-status="${s}" data-action="dose-cycle"
              data-med="${t.id}" data-time="${n}" data-day="${e}"
              aria-label="${d(t.name)} at ${P(n)}: ${d(a)}. Tap to change.">
        ${Ko[s]}
      </button>
    </li>`}function Go(e){let t=f(),n=I(t,e).map(({med:s,time:a})=>{let r=q(t,s.id,a,e);return ia(t,s,a,r,Le(r,a))}).join("");return p`
    <section class="section" aria-labelledby="meds-today-h">
      <div class="section-head">
        <h2 id="meds-today-h">Today</h2>
        <span class="t-sm ink-3">${B(t,{relative:!1})}</span>
      </div>
      <div class="card card-flush">
        <ul class="rows">${o(n)}</ul>
      </div>
      <p class="hint">Tap a circle to cycle: taken → late → missed → not logged.</p>
    </section>
  `}function Qo(e){let t=sa(e,28),n=f(),s=ae(t[0].day).getDay(),a=[0,1,2,3,4,5,6].map(l=>`<div class="cal-dow" aria-hidden="true">${Gn(l).slice(0,2)}</div>`).join(""),r='<div aria-hidden="true"></div>'.repeat(s),i=t.map(l=>{let u=ae(l.day).getDate(),h=l.total?`${l.taken} of ${l.total} doses on time`:l.day===n?"nothing logged yet":"no doses scheduled",y=`${B(l.day,{relative:!1})}: ${h}`+(l.seizure?", seizure logged":"");return`
      <button class="cal-day" data-status="${l.status}" data-today="${l.day===n}"
              data-seizure="${l.seizure}" data-action="cal-day" data-day="${l.day}"
              aria-label="${d(y)}" title="${d(y)}">${u}</button>`}).join("");return p`
    <section class="section" aria-labelledby="cal-h">
      <div class="section-head">
        <h2 id="cal-h">Last four weeks</h2>
      </div>
      <div class="card">
        <div class="cal">${o(a)}${o(r)}${o(i)}</div>
        <div class="cal-legend">
          <span class="cal-key"><span class="cal-swatch" data-k="taken"></span>All on time</span>
          <span class="cal-key"><span class="cal-swatch" data-k="late"></span>Late</span>
          <span class="cal-key"><span class="cal-swatch" data-k="missed"></span>Missed</span>
          <span class="cal-key"><span class="cal-swatch" data-k="seizure"></span>Seizure</span>
        </div>
        <p class="hint cal-hint">Tap a day to see or fix what was logged.</p>
      </div>
    </section>
  `}function Zo(e){let t=e.map(n=>{let s=Z(n);return`
      <li>
        <button class="list-row" data-action="med-open" data-id="${n.id}">
          <span class="med-dot" data-color="${d(n.color)}" aria-hidden="true">${c("pill",20)}</span>
          <span class="row-body">
            <span class="row-t">${d(n.name)} <span class="dose-amt">${d(n.dose)}</span></span>
            <span class="row-s">${s.length?s.map(P).join(" \xB7 "):"No times set"}</span>
            ${n.notes?`<span class="row-note">${d(n.notes)}</span>`:""}
          </span>
          <span class="chev">${c("chevron")}</span>
        </button>
      </li>`}).join("");return p`
    <section class="section" aria-labelledby="meds-list-h">
      <div class="section-head">
        <h2 id="meds-list-h">Your medications</h2>
        <button class="btn btn-sm btn-soft" data-action="med-open">${o(c("plus",16))} Add</button>
      </div>
      <div class="card card-flush">
        <ul class="rows">${o(t)}</ul>
      </div>
    </section>
  `}function oa(e){let t=e.map(n=>`
    <li class="list-row list-row-static">
      <span class="med-dot" data-color="${d(n.color)}" data-muted="true" aria-hidden="true">${c("archive",18)}</span>
      <span class="row-body">
        <span class="row-t">${d(n.name)} <span class="dose-amt">${d(n.dose)}</span></span>
        <span class="row-s">Stopped ${B(n.ended,{relative:!1})} \xB7 history kept</span>
      </span>
      <button class="btn btn-sm btn-quiet" data-action="med-restart" data-id="${n.id}">Restart</button>
    </li>`).join("");return p`
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
  `}function ca(){let e=w.times.map((s,a)=>`
    <div class="input-row">
      <input class="input" type="time" value="${d(s)}" data-time-index="${a}"
             aria-label="Dose time ${a+1}" required />
      ${w.times.length>1?`<button type="button" class="icon-btn" data-action="med-time-remove" data-index="${a}"
                   aria-label="Remove time ${a+1}">${c("trash",20)}</button>`:""}
    </div>`).join(""),t=Bo.map(s=>`
    <button type="button" class="chip chip-color" data-action="med-color" data-value="${s}"
            aria-pressed="${s===w.color}">
      <span class="cal-swatch" style="background:var(--${Yo[s]})"></span>${Wo[s]}
    </button>`).join(""),n=_o.map(s=>`<option value="${s}" ${s===w.form?"selected":""}>${s[0].toUpperCase()}${s.slice(1)}</option>`).join("");return p`
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
          <select class="select" id="med-form" name="form">${o(n)}</select>
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
  `}function Ke(){if(!w)return;let e=_();for(let t of["name","dose","form","notes"])e[t]!==void 0&&(w[t]=e[t]);Y().querySelectorAll("[data-time-index]").forEach(t=>{w.times[Number(t.dataset.timeIndex)]=t.value})}function kn(e){Ke();let t=Y().querySelector(".sheet-body");if(t&&(t.innerHTML=ca()),e){let n=Y().querySelector(e);n&&n.focus()}}function er(e){w=e?{id:e.id,name:e.name,dose:e.dose,form:e.form,notes:e.notes,color:e.color,times:[...Z(e)]}:{id:null,name:"",dose:"",form:"tablet",times:["08:00"],notes:"",color:"violet"},w.times.length||(w.times=["08:00"]),C({title:e?"Edit medication":"Add medication",body:ca(),footer:`
      ${e?`<button class="btn btn-danger-soft" data-action="med-stop" data-id="${e.id}">Stop taking</button>`:""}
      <button class="btn btn-primary" data-action="med-save">${e?"Save":"Add medication"}</button>
    `,onClose(){w=null}})}var tr={pending:"taken",taken:"late",late:"missed",missed:"pending"};function ra(e,t,n){let s=I(e,t),a=(t.seizures||[]).filter(u=>u.at.startsWith(e)),r=e<f(),i=s.map(({med:u,time:h})=>{let y=q(e,u.id,h,t),b=y!=="pending"?Vo[y]:r?"Not logged \u2014 counts as missed":Le("pending",h);return ia(e,u,h,y,b)}).join(""),l=p`
    <div class="stack stack-4">
      ${o(a.length?`
        <div class="insight" data-tone="alert">
          <span class="insight-ico" aria-hidden="true">${c("bolt",20)}</span>
          <span class="insight-body">
            <span class="insight-t">${T(a.length,"seizure")} logged this day</span>
          </span>
        </div>`:"")}
      ${o(s.length?`<div class="card card-flush"><ul class="rows">${i}</ul></div>`:'<p class="ink-3">No doses were scheduled on this day.</p>')}
      <p class="hint">
        Back-filling is fine — an honest record a day late beats a blank one.
      </p>
    </div>
  `;if(n){let u=Y().querySelector(".sheet-body");u&&(u.innerHTML=l);return}C({title:B(e,{relative:!1}),body:l})}var nr={async"dose-cycle"(e){let{med:t,time:n,day:s}=e.dataset,a=q(s,t,n),r=!!e.closest("#sheet");await tt(s,t,n,tr[a]),r&&(ra(s,O(),!0),Y().querySelector(`[data-action="dose-cycle"][data-med="${t}"][data-time="${n}"]`)?.focus())},"cal-day"(e,t){ra(e.dataset.day,t,!1)},"med-open"(e,t){let n=e.dataset.id;er(n?t.meds.find(s=>s.id===n):null)},"med-time-add"(){Ke();let e=w.times[w.times.length-1]||"08:00",[t,n]=e.split(":").map(Number);w.times.push(`${String(((t||0)+12)%24).padStart(2,"0")}:${String(n||0).padStart(2,"0")}`),kn(`[data-time-index="${w.times.length-1}"]`)},"med-time-remove"(e){Ke(),w.times.splice(Number(e.dataset.index),1),kn('[data-action="med-time-add"]')},"med-color"(e){Ke(),w.color=e.dataset.value,kn(`[data-action="med-color"][data-value="${e.dataset.value}"]`)},async"med-save"(){if(Ke(),!w.name.trim()){m("Give the medication a name","bad"),Y().querySelector("#med-name")?.focus();return}let e=be(w.times);if(!e.length){m("Add at least one time","bad");return}let t={name:w.name,dose:w.dose,form:w.form,times:e,notes:w.notes,color:w.color},n=!!w.id;n?await is(w.id,t):await rs(t),E(),m(n?"Medication updated":"Added \u2014 tracking starts today","ok")},"med-stop"(e,t){let n=e.dataset.id,s=t.meds.find(r=>r.id===n),a=s&&s.added>=f();R({title:a?"Remove this medication?":`Stop taking ${s?s.name:"this"}?`,message:a?"It was only added today, so there is no history to keep. It will be removed completely.":"It will stop appearing in today's doses and reminders. Every dose already logged stays in your history and statistics, and you can restart it later. Never stop an epilepsy medication without talking to your neurologist first.",confirmLabel:a?"Remove":"Stop taking",async onConfirm(){await cs(n),m(a?"Medication removed":"Stopped \u2014 history kept")}})},async"med-restart"(e,t){let n=t.meds.find(s=>s.id===e.dataset.id);n&&(await ls(n.id),m(`${n.name} restarted from today`,"ok"))}};var En={};me(En,{actions:()=>fr,logSeizure:()=>Tn,render:()=>cr,subtitle:()=>ir,title:()=>rr});var sr=["Focal aware","Focal impaired awareness","Tonic-clonic","Absence","Myoclonic","Atonic","Not sure"],ar=["Missed dose","Missed sleep","Stress","Illness or fever","Flashing lights","Skipped meal","Dehydration","Period","None known"],or=["Home","School \u2014 classroom","School \u2014 hallway","School \u2014 gym","School \u2014 cafeteria","Outside","In a car","Other"],la=["","Calm","Fine","Busy","Stressed","Overwhelmed"],De="log",v=null,H=null,da=e=>`${e} ${e===1?"entry":"entries"}`;function rr(){return"Seizures"}function ir(e){let t=(e.seizures||[]).length;if(!t)return"Nothing logged yet";let{daysSince:n}=ue(e);return n===0?`${da(t)} \xB7 one today`:`${da(t)} \xB7 ${T(n,"day")} since the last`}function cr(e){return p`
    <div class="subtabs" role="tablist" aria-label="Seizure views">
      <button class="subtab" role="tab" id="tab-log" aria-controls="panel-sz"
              data-action="sz-tab" data-tab="log" aria-selected="${De==="log"}">
        ${o(c("note",18))} Log
      </button>
      <button class="subtab" role="tab" id="tab-patterns" aria-controls="panel-sz"
              data-action="sz-tab" data-tab="patterns" aria-selected="${De==="patterns"}">
        ${o(c("sparkle",18))} Patterns
      </button>
    </div>
    <div id="panel-sz" role="tabpanel" aria-labelledby="tab-${De}" class="stack stack-5">
      ${o(De==="log"?pr(e):hr(e))}
    </div>
  `}function lr(e){let t=re(e.at),n=[];return e.duration&&n.push(`<span class="pill">${c("timer",13)} ${Ne(e.duration)}</span>`),e.trigger&&n.push(`<span class="pill pill-warn">${d(e.trigger)}</span>`),e.place&&n.push(`<span class="pill">${d(e.place)}</span>`),e.injury&&n.push('<span class="pill pill-bad">Injury</span>'),e.emsCalled&&n.push('<span class="pill pill-bad">911 called</span>'),`
    <li>
      <button class="log-entry" data-action="seizure-open" data-id="${e.id}">
        <span class="log-date" aria-hidden="true">
          <span class="log-mon">${Tt(t.getMonth())}</span>
          <span class="log-day">${t.getDate()}</span>
        </span>
        <span class="log-body">
          <span class="log-t">${d(e.type||"Seizure")}</span>
          <span class="row-s">${Qn(e.at)} \xB7 ${Zn(e.at)}</span>
          ${n.length?`<span class="log-meta">${n.join("")}</span>`:""}
          ${e.notes?`<span class="log-note">${d(e.notes)}</span>`:""}
        </span>
        <span class="chev">${c("chevron")}</span>
      </button>
    </li>`}function dr(e){let t=[];for(let n of e){let s=re(n.at),a=`${s.getFullYear()}-${s.getMonth()}`,r=t[t.length-1];(!r||r.key!==a)&&(r={key:a,label:`${Tt(s.getMonth())} ${s.getFullYear()}`,items:[]},t.push(r)),r.items.push(n)}return t.map(n=>`
    <div class="month-group">
      <h3 class="eyebrow month-label">${n.label} \xB7 ${n.items.length}</h3>
      <div class="card card-flush"><ul class="rows">${n.items.map(lr).join("")}</ul></div>
    </div>`).join("")}function ur(e){if(!e)return p`
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
    `;let t=e.sleepHours==null?"\u2014":e.sleepHours,n=e.stress==null?"\u2014":e.stress;return p`
    <button class="card card-tap" data-action="checkin-open">
      <span class="row">
        <span class="med-dot" data-color="mint" aria-hidden="true">${o(c("check",20))}</span>
        <span class="row-body">
          <span class="row-t">Checked in today</span>
          <span class="row-s">${t} hours of sleep · stress ${n} of 5 · tap to change</span>
        </span>
        <span class="chev">${o(c("chevron"))}</span>
      </span>
    </button>
  `}function pr(e){let t=e.seizures||[],n=He(f(),e);return p`
    <button class="btn btn-primary btn-lg btn-block" data-action="seizure-open">
      ${o(c("plus",20))} Log a seizure
    </button>

    ${o(ur(n))}

    ${o(t.length?`
      <section class="section" aria-labelledby="hist-h">
        <h2 id="hist-h">History</h2>
        ${dr(t)}
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
  `}function ua(){return p`
    <div class="disclaimer">
      ${o(c("info",16))}
      <span><strong>About these patterns.</strong> ${ea}</span>
    </div>
  `}function hr(e){let t=vn(e),n=ue(e),s=(e.seizures||[]).length,a=Object.keys(e.checkins||{}).length;if(!t.length){let i=[];return s<3&&i.push(`at least 3 seizures logged (you have ${s})`),a<13&&i.push(`about two weeks of daily check-ins (you have ${a})`),p`
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
      ${o(ua())}
    `}let r=t.map(i=>`
    <li class="insight" data-tone="${i.tone}">
      <span class="insight-ico" aria-hidden="true">${c(i.icon,20)}</span>
      <span class="insight-body">
        <span class="insight-t">${d(i.title)}</span>
        <span class="insight-d">${d(i.detail)}</span>
        <span class="insight-e">${d(i.evidence)}</span>
      </span>
    </li>`).join("");return p`
    <div class="stats">
      <div class="stat">
        <span class="stat-n">${n.totalSeizures}</span>
        <span class="stat-l">Logged in total</span>
      </div>
      <div class="stat">
        <span class="stat-n">${n.seizuresLast30}</span>
        <span class="stat-l">In the last 30 days</span>
      </div>
      <div class="stat">
        <span class="stat-n stat-n-sm">${n.avgDurationLabel||"\u2014"}</span>
        <span class="stat-l">Average length</span>
      </div>
    </div>

    <section class="section" aria-labelledby="patterns-h">
      <h2 id="patterns-h">What your log shows</h2>
      <ul class="stack stack-3">${o(r)}</ul>
    </section>

    ${o(ua())}
  `}function xn(e,t,n){let s=t.map(a=>`
    <button type="button" class="chip" data-action="sz-chip" data-field="${e}"
            data-value="${d(a)}" aria-pressed="${a===v[e]}">${d(a)}</button>`).join("");return`
    <div class="field">
      <span class="label" id="lbl-${e}">${n}</span>
      <div class="chips" role="group" aria-labelledby="lbl-${e}">${s}</div>
    </div>`}function ha(){let e=Math.floor(v.duration/60),t=v.duration%60,n=f();return p`
    <form class="stack stack-5" data-action="seizure-save" novalidate>
      ${o(v.fromTimer?`
        <div class="insight" data-tone="good">
          <span class="insight-ico" aria-hidden="true">${c("timer",20)}</span>
          <span class="insight-body">
            <span class="insight-t">Timed at ${Ne(v.duration)}</span>
            <span class="insight-d">Start time and length came from the emergency timer. Everything else is optional.</span>
          </span>
        </div>`:"")}

      <div class="input-row">
        <div class="field grow">
          <label class="label" for="sz-date">Date</label>
          <input class="input" type="date" id="sz-date" name="date" value="${v.date}" max="${n}" required />
        </div>
        <div class="field grow">
          <label class="label" for="sz-time">Started at</label>
          <input class="input" type="time" id="sz-time" name="time" value="${v.time}" required />
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

      ${o(xn("type",sr,"Type"))}
      ${o(xn("trigger",ar,"Possible trigger"))}
      ${o(xn("place",or,"Where were you?"))}

      <div class="field">
        <label class="label" for="sz-aura">Warning signs beforehand</label>
        <input class="input" id="sz-aura" name="aura" value="${v.aura}"
               placeholder="Metallic taste, dizziness, déjà vu…" autocomplete="off" maxlength="300" />
      </div>

      <div class="card card-flush">
        <label class="toggle-row">
          <span class="row-body">
            <span class="row-t">Were you injured?</span>
            <span class="row-s">Even a bitten cheek counts</span>
          </span>
          <input type="checkbox" class="check" name="injury" ${o(v.injury?"checked":"")} />
        </label>
        <label class="toggle-row">
          <span class="row-body">
            <span class="row-t">Was 911 called?</span>
            <span class="row-s">Worth recording either way</span>
          </span>
          <input type="checkbox" class="check" name="emsCalled" ${o(v.emsCalled?"checked":"")} />
        </label>
      </div>

      <div class="field">
        <label class="label" for="sz-notes">Anything else</label>
        <textarea class="textarea" id="sz-notes" name="notes" maxlength="4000"
                  placeholder="What happened, who was there, how you felt afterwards…">${v.notes}</textarea>
      </div>
    </form>
  `}function Mn(){if(!v)return;let e=_();for(let t of["date","time","aura","notes","injury","emsCalled"])e[t]!==void 0&&(v[t]=e[t]);if(e.mins!==void 0||e.secs!==void 0){let t=Je(Number(e.mins)||0,0,120),n=Je(Number(e.secs)||0,0,59);v.duration=t*60+n}}function mr(e){Mn();let t=Y().querySelector(".sheet-body");if(!t)return;let n=t.scrollTop;t.innerHTML=ha(),t.scrollTop=n,e&&Y().querySelector(e)?.focus({preventScroll:!0})}function ma(e,t={}){if(e){let[n,s]=e.at.split("T");v={...e,date:n,time:s,fromTimer:!1}}else{let n=t.at||`${f()}T${G()}`,[s,a]=n.split("T");v={id:null,date:s,time:a,duration:t.duration||0,type:"",trigger:"",place:"",aura:"",injury:!1,emsCalled:!1,notes:"",fromTimer:!!t.duration}}C({title:e?"Edit entry":"Log a seizure",body:ha(),footer:`
      ${e?`<button class="btn btn-danger-soft" data-action="seizure-delete" data-id="${e.id}">Delete</button>`:""}
      <button class="btn btn-primary" data-action="seizure-save">Save</button>
    `,onClose(){v=null}})}function Tn(e){ma(null,e)}function fa(){let e=[1,2,3,4,5].map(t=>`
    <button type="button" class="segment" data-action="checkin-stress" data-value="${t}"
            aria-pressed="${H.stress===t}" aria-label="${t}, ${la[t]}">${t}</button>`).join("");return p`
    <div class="stack stack-6">
      <div class="field">
        <span class="label" id="sleep-label">How many hours did you sleep last night?</span>
        <div class="stepper" role="group" aria-labelledby="sleep-label">
          <button type="button" class="stepper-btn" data-action="checkin-sleep" data-value="-0.5"
                  aria-label="Half an hour less">−</button>
          <span class="sleep-n" aria-live="polite">${H.sleepHours}<small>h</small></span>
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
        <span class="hint text-center">${la[H.stress]||""}</span>
      </div>

      <div class="field">
        <label class="label" for="ci-notes">Anything worth noting</label>
        <textarea class="textarea" id="ci-notes" name="notes" maxlength="600"
                  placeholder="Sick, travelling, exams…">${H.notes}</textarea>
      </div>
    </div>
  `}function pa(e){let t=_();t.notes!==void 0&&(H.notes=t.notes);let n=Y().querySelector(".sheet-body");n&&(n.innerHTML=fa()),e&&Y().querySelector(e)?.focus({preventScroll:!0})}var fr={"sz-tab"(e){De=e.dataset.tab,qt()},"open-patterns"(){De="patterns",location.hash==="#/track"?qt():location.hash="#/track"},"seizure-open"(e,t){let n=e.dataset.id;ma(n?t.seizures.find(s=>s.id===n):null)},"sz-chip"(e){Mn();let{field:t,value:n}=e.dataset;v[t]=v[t]===n?"":n,mr(`[data-action="sz-chip"][data-field="${t}"][data-value="${CSS.escape(n)}"]`)},async"seizure-save"(){Mn();let e=`${v.date}T${v.time}`;if(!v.date||!v.time||!ye(e)){m("A date and start time are needed","bad");return}if(re(e).getTime()>Date.now()+6e4){m("That time is in the future","bad");return}let t={at:e,duration:v.duration,type:v.type,trigger:v.trigger,place:v.place,aura:v.aura,injury:!!v.injury,emsCalled:!!v.emsCalled,notes:v.notes},n=!!v.id;n?await us(v.id,t):await ds(t),E(),m(n?"Entry updated":"Logged. Look after yourself today.","ok")},"seizure-delete"(e){let t=e.dataset.id;R({title:"Delete this entry?",message:"It will be removed from your history and from the pattern calculations. This can't be undone.",async onConfirm(){await ps(t),m("Entry deleted")}})},"checkin-open"(e,t){let n=f(),s=He(n,t);H={sleepHours:s&&s.sleepHours!=null?s.sleepHours:8,stress:s&&s.stress!=null?s.stress:2,notes:s&&s.notes||""},C({title:`Check-in \xB7 ${B(n)}`,body:fa(),footer:'<button class="btn btn-primary" data-action="checkin-save">Save check-in</button>',onClose(){H=null}})},"checkin-sleep"(e){let t=Number(e.dataset.value);H.sleepHours=Je(Math.round((H.sleepHours+t)*2)/2,0,16),pa(`[data-action="checkin-sleep"][data-value="${e.dataset.value}"]`)},"checkin-stress"(e){H.stress=Number(e.dataset.value),pa(`[data-action="checkin-stress"][data-value="${e.dataset.value}"]`)},async"checkin-save"(){let e=_();e.notes!==void 0&&(H.notes=e.notes);let t=H.sleepHours;await hs(f(),{sleepHours:t,sleepQuality:t<6?"poor":t<7?"ok":"good",stress:H.stress,mood:H.stress>=4?"low":"ok",notes:(H.notes||"").trim()}),E(),m("Checked in","ok")}};var Hn={};me(Hn,{actions:()=>Ar,render:()=>vr,showEmergency:()=>St,subtitle:()=>br,title:()=>yr});function yr(){return"Safety card"}function br(e){let t=(e.contacts||[]).length,n=`${t} ${t===1?"contact":"contacts"}`;return e.card.updated?`${n} \xB7 updated ${B(e.card.updated)}`:n}var gr=e=>(e.name||"").trim().split(/\s+/)[0]||"";function vr(e){let{card:t,contacts:n,profile:s}=e,a=gr(s),r=a?`If ${a} has a seizure`:"If a seizure happens";return p`
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

    ${o(wr(e))}

    <div class="split-grid">
      <div class="split-main">
        ${o(kr(n))}
        ${o(Sr(t))}
        ${o(zn("What to do",t.during,"during","ok"))}
        ${o(zn("What NOT to do",t.doNot,"doNot","bad"))}
        ${o(xr(t))}
        ${o(zn("Afterwards",t.after,"after",""))}
      </div>
      <div class="split-side">
        ${o(Mr(e))}
        ${o(Er(t))}
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
  `}function wr(e){let t=[];if(e.contacts.length||t.push(["contact-open","","Add someone to call"]),e.profile.name||t.push(["profile-edit","","Add your name"]),e.card.looksLike||t.push(["card-edit","looksLike","Describe what your seizures look like"]),e.card.forTeacher||t.push(["card-edit","forTeacher","Add a note for teachers"]),!t.length)return"";let n=t.map(([s,a,r])=>`
    <li>
      <button class="todo-row" data-action="${s}"${a?` data-field="${a}"`:""}>
        <span class="todo-dot" aria-hidden="true"></span>
        <span class="grow">${r}</span>
        <span class="chev">${c("chevron",16)}</span>
      </button>
    </li>`).join("");return p`
    <section class="card todo-card" aria-labelledby="todo-h">
      <h2 id="todo-h" class="todo-h">${o(c("sparkle",18))} Finish your card</h2>
      <p class="t-sm ink-2">
        ${t.length===1?"One thing":`${t.length} things`} would make this
        card much more useful to whoever has to use it.
      </p>
      <ul class="todo-list">${o(n)}</ul>
    </section>
  `}function $r(e){return`
    <li class="contact-row">
      <button class="contact-main" data-action="contact-open" data-id="${e.id}"
              aria-label="Edit ${d(e.name)}">
        <span class="avatar" aria-hidden="true">${d(Ge(e.name))}</span>
        <span class="contact-body">
          <span class="contact-n">${d(e.name)}</span>
          <span class="contact-r">${e.primary?'<span class="pill pill-brand">First call</span>':""}<span class="truncate">${d(e.relation)}${e.relation?" \xB7 ":""}${d(e.phone)}</span></span>
        </span>
      </button>
      ${ba(e)}
    </li>`}function ba(e){return zt(e.phone)?`<a class="call-btn" href="${Et(e.phone)}" aria-label="Call ${d(e.name)}">${c("phone",16)} Call</a>`:'<span class="pill pill-warn">No number</span>'}function kr(e){let t=e.length?`<ul class="rows">${e.map($r).join("")}</ul>`:`<div class="empty empty-sm">
         <span class="empty-t">No one to call yet</span>
         <span class="empty-s">The emergency card's biggest button calls whoever you put first.</span>
         <button class="btn btn-sm btn-primary" data-action="contact-open">${c("plus",16)} Add a contact</button>
       </div>`;return p`
    <section class="section" aria-labelledby="contacts-h">
      <div class="section-head">
        <h2 id="contacts-h">Who to call</h2>
        ${o(e.length?`<button class="btn btn-sm btn-soft" data-action="contact-open">${c("plus",16)} Add</button>`:"")}
      </div>
      <div class="card card-flush">${o(t)}</div>
    </section>
  `}function kt(e,t){return`<button class="btn btn-sm btn-quiet" data-action="card-edit" data-field="${e}"
                  aria-label="Edit ${d(t)}">${c("edit",15)} Edit</button>`}function Sr(e){let t=e.looksLike?`<p class="prose">${d(e.looksLike)}</p>`:`<p class="ink-3">Describe what happens, so somebody who has never seen one knows what they're looking at.</p>`;return p`
    <section class="section" aria-labelledby="looks-h">
      <div class="section-head">
        <h2 id="looks-h">What it looks like</h2>
        ${o(kt("looksLike","what it looks like"))}
      </div>
      <div class="card">${o(t)}</div>
    </section>
  `}function Ln(e,t){return`<ol class="steps">${e.map((n,s)=>`
    <li class="step" data-tone="${t}">
      <span class="step-n" aria-hidden="true">${t==="bad"?"\u2715":t==="ems"?"!":s+1}</span>
      <span>${d(n)}</span>
    </li>`).join("")}</ol>`}function zn(e,t,n,s){let a=`sec-${n}`,r=t&&t.length?Ln(t,s):'<p class="ink-3">Nothing added yet.</p>';return p`
    <section class="section" aria-labelledby="${a}">
      <div class="section-head">
        <h2 id="${a}">${e}</h2>
        ${o(kt(n,e))}
      </div>
      <div class="card">${o(r)}</div>
    </section>
  `}function xr(e){let t=e.callEms||[];return p`
    <section class="section" aria-labelledby="sec-ems">
      <div class="section-head">
        <h2 id="sec-ems">Call 911 if…</h2>
        ${o(kt("callEms","when to call 911"))}
      </div>
      <div class="card ems-card">${o(t.length?Ln(t,"ems"):'<p class="ink-3">Nothing added yet.</p>')}</div>
    </section>
  `}function Mr(e){let{profile:t}=e,n=W(e),s=[["Seizure type",t.seizureType],["Allergies",t.allergies],["Blood type",t.bloodType],["Neurologist",[t.neurologist,t.neuroPhone].filter(Boolean).join(" \xB7 ")]].filter(([,i])=>i),a=n.length?n.map(i=>`${d(i.name)}${i.dose?` ${d(i.dose)}`:""}`).join(", "):'<span class="ink-faint">None added</span>',r=s.map(([i,l])=>`<div class="kv-row"><dt class="kv-k">${i}</dt><dd class="kv-v">${d(l)}</dd></div>`).join("");return p`
    <section class="section" aria-labelledby="medical-h">
      <div class="section-head">
        <h2 id="medical-h">Medical details</h2>
        <button class="btn btn-sm btn-quiet" data-action="profile-edit">${o(c("edit",15))} Edit</button>
      </div>
      <div class="card card-flush">
        <dl class="kv">
          ${o(r)}
          <div class="kv-row"><dt class="kv-k">Current meds</dt><dd class="kv-v">${o(a)}</dd></div>
        </dl>
      </div>
      <p class="hint">Shown on the emergency card and the printed copy — it's what paramedics ask for.</p>
    </section>
  `}var Tr=[{field:"forTeacher",label:"For teachers",icon:"school"},{field:"forNurse",label:"For the school nurse",icon:"stethoscope"},{field:"forCoach",label:"For coaches and PE",icon:"run"}];function Er(e){let t=Tr.map(n=>`
    <div class="card role-card">
      <div class="card-head">
        <h3>${c(n.icon,18)} ${n.label}</h3>
        ${kt(n.field,n.label)}
      </div>
      ${e[n.field]?`<p class="prose">${d(e[n.field])}</p>`:`<p class="ink-3 t-sm">Nothing added yet \u2014 what should this person know that isn't in the steps?</p>`}
    </div>`).join("");return p`
    <section class="section" aria-labelledby="roles-h">
      <h2 id="roles-h">Specific instructions</h2>
      <div class="stack stack-3">${o(t)}</div>
    </section>
  `}var On="synara.timer",ga=300,$t=null,ne=null,Oe=null;function jn(){try{let e=JSON.parse(sessionStorage.getItem(On)||"null");if(e&&typeof e.ms=="number"&&Date.now()-e.ms<10800*1e3)return e}catch{}return null}function Cn(e){try{e?sessionStorage.setItem(On,JSON.stringify(e)):sessionStorage.removeItem(On)}catch{}}var An=e=>`${Math.floor(e/60)}:${String(e%60).padStart(2,"0")}`;function va(){return`
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
    </section>`}function In(e,t,n){let s=e.querySelector(".em-timer");if(!s)return;let a=s.querySelector("[data-timer-clock]"),r=s.querySelector("[data-timer-hint]"),i=s.querySelector("[data-timer-actions]"),l=s.dataset.state!==t;if(s.dataset.state=t,a.textContent=An(n),t==="running"||t==="over"){let u=t==="over";r.textContent=u?"Over 5 minutes \u2014 call 911 now":`Call 911 if it reaches 5:00 \xB7 ${An(Math.max(0,ga-n))} to go`,l&&(i.innerHTML=`
        ${u?`<a class="btn btn-lg btn-block btn-emergency" href="tel:911">${c("phone",20)} Call 911 now</a>`:""}
        <button class="btn btn-lg btn-block ${u?"btn-on-danger-ghost":"btn-outline"}" data-action="timer-stop">
          ${c("stop",18)} It stopped
        </button>`)}else t==="stopped"&&(r.textContent=`It lasted ${An(n)}`,i.innerHTML=`
      <button class="btn btn-lg btn-block btn-primary" data-action="timer-log">${c("note",18)} Log this seizure</button>
      <button class="btn btn-block btn-quiet" data-action="timer-reset">Reset timer</button>`)}function wa(e){clearInterval($t);let t=e.querySelector("[data-timer-live]"),n=-1,s=!1,a=()=>{let r=jn();if(!r)return;let i=Math.max(0,Math.floor((Date.now()-r.ms)/1e3)),l=i>=ga;In(e,l?"over":"running",i);let u=Math.floor(i/60);t&&u!==n&&u>0&&(t.textContent=l&&!s?"Five minutes. Call 911 now.":`${u} ${u===1?"minute":"minutes"}`,l&&(s=!0)),n=u};a(),$t=setInterval(a,1e3)}function Nn(){clearInterval($t),$t=null}function pe(e,t,n=""){return`
    <section class="em-block"${n?` data-tone="${n}"`:""}>
      <h3>${e}</h3>
      ${t}
    </section>`}function St(e){let{card:t,contacts:n,profile:s}=e,a=n.filter(M=>zt(M.phone)),r=a.find(M=>M.primary)||a[0],i=n.filter(M=>M!==r),l=W(e),u=s.name||"This student",h=[s.grade,s.school].filter(Boolean).join(" \xB7 "),y=r?`
    <a class="em-call" href="${Et(r.phone)}">
      <span class="em-call-ico" aria-hidden="true">${c("phone",22)}</span>
      <span class="em-call-body">
        <span class="em-call-n">Call ${d(r.name)}</span>
        <span class="em-call-r">${d(r.relation)}${r.relation?" \xB7 ":""}${d(r.phone)}</span>
      </span>
    </a>`:"",b=i.length?pe("Other contacts",`
    <ul class="rows">${i.map(M=>`
      <li class="contact-row contact-row-flat">
        <span class="contact-body">
          <span class="contact-n">${d(M.name)}</span>
          <span class="contact-r"><span class="truncate">${d(M.relation)}</span></span>
        </span>
        ${ba(M)}
      </li>`).join("")}</ul>`):"",A=[s.seizureType&&`<div class="kv-row"><dt class="kv-k">Seizure type</dt><dd class="kv-v">${d(s.seizureType)}</dd></div>`,s.allergies&&`<div class="kv-row"><dt class="kv-k">Allergies</dt><dd class="kv-v">${d(s.allergies)}</dd></div>`,l.length&&`<div class="kv-row"><dt class="kv-k">Medications</dt><dd class="kv-v">${l.map(M=>`${d(M.name)} ${d(M.dose)}`).join(", ")}</dd></div>`,s.neurologist&&`<div class="kv-row"><dt class="kv-k">Neurologist</dt><dd class="kv-v">${d(s.neurologist)}${s.neuroPhone?` \xB7 ${d(s.neuroPhone)}`:""}</dd></div>`].filter(Boolean).join(""),D=(M,Ca)=>M&&M.length?Ln(M,Ca):"",$=p`
    <div class="em-bar">
      <span class="em-bar-t">${o(c("shield",20))} Seizure — what to do</span>
      <button class="em-close" data-action="close-emergency">Close</button>
    </div>

    <div class="em-body">
      <div class="em-inner">
        <header class="em-who">
          <h2 class="em-name">${u}</h2>
          ${o(h?`<span class="em-sub">${d(h)}</span>`:"")}
        </header>

        ${o(va())}

        <div class="em-calls">
          ${o(y)}
          <a class="em-911" href="tel:911">${o(c("phone",22))} Call 911</a>
        </div>

        ${o(t.during&&t.during.length?pe("What to do right now",D(t.during,"ok")):"")}
        ${o(t.callEms&&t.callEms.length?pe("Call 911 if",D(t.callEms,"ems"),"bad"):"")}
        ${o(t.doNot&&t.doNot.length?pe("Do NOT",D(t.doNot,"bad")):"")}
        ${o(t.looksLike?pe("What their seizures look like",`<p class="prose">${d(t.looksLike)}</p>`):"")}
        ${o(t.after&&t.after.length?pe("Afterwards",D(t.after,"")):"")}
        ${o(A?pe("Medical details",`<dl class="kv kv-flat">${A}</dl>`):"")}
        ${o(b)}

        <p class="em-foot">Standard seizure first aid. If in doubt, call 911.</p>
      </div>
    </div>
  `;Ss($,{onMount(M){jn()?(wa(M),M.querySelector('[data-action="timer-stop"]')?.focus({preventScroll:!0})):ne!=null&&In(M,"stopped",ne)},onClose:Nn})}function zr(e){let{card:t,contacts:n,profile:s}=e,a=W(e),r=(u,h="")=>u&&u.length?`<ol class="${h}">${u.map(y=>`<li>${d(y)}</li>`).join("")}</ol>`:"",i=[["Grade / school",[s.grade,s.school].filter(Boolean).join(", ")],["Seizure type",s.seizureType],["Allergies",s.allergies],["Medications",a.map(u=>`${u.name} ${u.dose} (${Z(u).map(P).join(", ")})`).join("; ")],["Neurologist",[s.neurologist,s.neuroPhone].filter(Boolean).join(" \u2014 ")]].filter(([,u])=>u),l=[["forTeacher","Teachers"],["forNurse","School nurse"],["forCoach","Coaches and PE"]].filter(([u])=>t[u]);return`
    <article class="pc">
      <header class="pc-head">
        <div>
          <p class="pc-kicker">Seizure action card</p>
          <h1 class="pc-name">${d(s.name||"Student name")}</h1>
        </div>
        <div class="pc-911">In an emergency<strong>Call 911</strong></div>
      </header>

      ${i.length?`<dl class="pc-facts">${i.map(([u,h])=>`<div><dt>${u}</dt><dd>${d(h)}</dd></div>`).join("")}</dl>`:""}

      ${t.looksLike?`<section><h2>What their seizures look like</h2><p>${d(t.looksLike)}</p></section>`:""}

      <div class="pc-cols">
        <section><h2>What to do</h2>${r(t.during)}</section>
        <section><h2>Do NOT</h2>${r(t.doNot,"pc-not")}</section>
      </div>

      <section class="pc-ems"><h2>Call 911 if</h2>${r(t.callEms)}</section>

      <div class="pc-cols">
        <section><h2>Afterwards</h2>${r(t.after)}</section>
        <section>
          <h2>Who to call</h2>
          ${n.length?`<table class="pc-contacts"><tbody>${n.map(u=>`
            <tr><td><strong>${d(u.name)}</strong>${u.primary?" (call first)":""}<br>${d(u.relation)}</td><td>${d(u.phone)}</td></tr>`).join("")}
          </tbody></table>`:"<p>No contacts added.</p>"}
        </section>
      </div>

      ${l.length?`<section class="pc-roles">${l.map(([u,h])=>`<div><h3>${h}</h3><p>${d(t[u])}</p></div>`).join("")}</section>`:""}

      <footer class="pc-foot">
        Printed ${B(f(),{relative:!1})}${t.updated?` \xB7 card last updated ${B(t.updated,{relative:!1})}`:""}.
        Standard seizure first aid \u2014 confirm with the student's neurologist. Made with Synara.
      </footer>
    </article>`}var ya=new Set(["during","doNot","after","callEms"]),Dn={looksLike:"What their seizures look like",during:"What to do",doNot:"What NOT to do",after:"Afterwards",callEms:"Call 911 if\u2026",forTeacher:"For teachers",forNurse:"For the school nurse",forCoach:"For coaches and PE"},Cr={looksLike:"Plain words beat medical terms \u2014 a substitute teacher has to recognise this.",forTeacher:"What should happen in class? Who do they send for? Anything in a 504 plan?",forNurse:"Rescue medication, who to call first, where they like to recover.",forCoach:"Activity limits, water rules, whether they can return to play the same day."},Ar={"card-edit"(e,t){let n=e.dataset.field;if(!Dn[n])return;let s=ya.has(n),a=t.card[n],r=s?(a||[]).join(`
`):a||"";C({title:Dn[n],body:p`
        <div class="field">
          <label class="label" for="card-text">
            ${s?"One step per line":"Write it the way you would say it out loud"}
          </label>
          <textarea class="textarea textarea-tall" id="card-text" name="text" maxlength="4000">${r}</textarea>
          <span class="hint">
            ${s?"Each line becomes a numbered step on the card.":Cr[n]||""}
          </span>
        </div>
      `,footer:`<button class="btn btn-primary" data-action="card-save" data-field="${n}">Save</button>`})},async"card-save"(e){let t=e.dataset.field;if(!Dn[t])return;let n=_().text||"",s=ya.has(t)?n.split(`
`).map(a=>a.replace(/^\s*(\d+[.)]|[-*•])\s*/,"").trim()).filter(Boolean):n.trim();await bs({[t]:s}),E(),m("Safety card updated","ok")},"contact-open"(e,t){let n=e.dataset.id,s=n?t.contacts.find(i=>i.id===n):null,a=s||{name:"",relation:"",phone:"",primary:!t.contacts.length},r=s?` data-id="${s.id}"`:"";C({title:s?"Edit contact":"Add contact",body:p`
        <form class="stack stack-5" data-action="contact-save"${o(r)} novalidate>
          <div class="field">
            <label class="label" for="c-name">Name</label>
            <input class="input" id="c-name" name="name" value="${a.name}"
                   placeholder="Dana Ellison" autocomplete="off" maxlength="120" required />
          </div>
          <div class="field">
            <label class="label" for="c-rel">Relationship</label>
            <input class="input" id="c-rel" name="relation" value="${a.relation}"
                   placeholder="Mom, school nurse, coach…" autocomplete="off" maxlength="80" />
          </div>
          <div class="field">
            <label class="label" for="c-phone">Phone</label>
            <input class="input" id="c-phone" name="phone" type="tel" inputmode="tel" value="${a.phone}"
                   placeholder="(555) 014-2007" autocomplete="off" maxlength="40" required />
          </div>
          <div class="card card-flush">
            <label class="toggle-row">
              <span class="row-body">
                <span class="row-t">Call this person first</span>
                <span class="row-s">They become the big green button on the emergency card</span>
              </span>
              <input type="checkbox" class="check" name="primary" ${o(a.primary?"checked":"")} />
            </label>
          </div>
        </form>
      `,footer:`
        ${s?`<button class="btn btn-danger-soft" data-action="contact-delete" data-id="${s.id}">Delete</button>`:""}
        <button class="btn btn-primary" data-action="contact-save"${r}>Save</button>
      `})},async"contact-save"(e){let t=e.dataset.id||null,n=_();if(!n.name||!n.name.trim()){m("A name is needed","bad");return}if((String(n.phone||"").match(/\d/g)||[]).length<3){m("That phone number doesn't look complete","bad");return}let s={name:n.name,relation:n.relation||"",phone:n.phone,primary:!!n.primary};t?await fs(t,s):await ms(s),E(),m(t?"Contact updated":"Contact added","ok")},"contact-delete"(e){let t=e.dataset.id;R({title:"Delete this contact?",message:"They will be removed from the safety card, the emergency screen, and the printed card.",async onConfirm(){await ys(t),m("Contact deleted")}})},"timer-start"(){ne=null,Oe=oe(),Cn({ms:Date.now(),at:Oe}),wa(ie()),ie().querySelector('[data-action="timer-stop"]')?.focus({preventScroll:!0})},"timer-stop"(){let e=jn();Nn(),e&&(ne=Math.max(1,Math.floor((Date.now()-e.ms)/1e3)),Oe=e.at,Cn(null),In(ie(),"stopped",ne),ie().querySelector('[data-action="timer-log"]')?.focus({preventScroll:!0}))},"timer-reset"(){ne=null,Oe=null,Cn(null),Nn();let e=ie().querySelector(".em-timer");e&&(e.outerHTML=va()),ie().querySelector('[data-action="timer-start"]')?.focus({preventScroll:!0})},"timer-log"(){let e=ne||0,t=Oe||`${f()}T${G()}`;ne=null,Oe=null,Se(),Tn({at:t,duration:e})},"print-card"(e,t){let n=document.getElementById("print-card");if(!n)return;let s=navigator.userAgent,a=/iPad|iPhone|iPod/.test(s)||/Macintosh/.test(s)&&navigator.maxTouchPoints>1,r=window.navigator.standalone===!0||window.matchMedia("(display-mode: standalone)").matches;if(a&&r){m("To print, open this page in Safari. Home-screen apps can\u2019t print on iPhone or iPad.","bad");return}n.innerHTML=zr(t),window.print()}};var Fn={};me(Fn,{actions:()=>Yr,render:()=>Nr,showConflict:()=>Rn,subtitle:()=>Or,title:()=>Dr});function Dr(){return"You"}function Or(e){return e.profile.school||"Your details and settings"}var ka=[["name","Name","Maya Ellison"],["pronouns","Pronouns","she/her"],["grade","Grade","11th grade"],["school","School","Rosewood High School"],["seizureType","Seizure type","Focal impaired awareness"],["diagnosed","Diagnosed","2022"],["neurologist","Neurologist","Dr. Raghavan"],["neuroPhone","Neurologist phone","(555) 010-4488"],["allergies","Allergies","Penicillin"],["bloodType","Blood type","O+"]];function Nr(e){return p`
    <div class="split-grid">
      <div class="split-main">
        ${o(Lr(e))}
        ${o(jr(e))}
      </div>
      <div class="split-side">
        ${o(Ir(e))}
        ${o(Pr(e))}
        ${o(Rr(e))}
        ${o(Fr(e))}
        ${o(Br())}
      </div>
    </div>
  `}function Lr(e){let{profile:t}=e,n=ue(e),s=[t.pronouns,t.grade].filter(Boolean).join(" \xB7 "),a=Ge(t.name);return p`
    <div class="card card-flush">
      <div class="profile-head">
        <span class="avatar avatar-lg" aria-hidden="true">${a||o(c("user",26))}</span>
        <span class="row-body">
          <span class="profile-n">${t.name||"Add your name"}</span>
          <span class="profile-s">${s||"Tap edit to fill in your details"}</span>
        </span>
        <button class="icon-btn" data-action="profile-edit" aria-label="Edit your details">
          ${o(c("edit"))}
        </button>
      </div>
      <div class="stats stats-inset">
        <div class="stat">
          <span class="stat-n">${n.adherence==null?"\u2014":`${n.adherence}%`}</span>
          <span class="stat-l">Doses on time</span>
        </div>
        <div class="stat">
          <span class="stat-n">${n.totalSeizures}</span>
          <span class="stat-l">Seizures logged</span>
        </div>
        <div class="stat">
          <span class="stat-n">${n.streak}</span>
          <span class="stat-l">Day streak</span>
        </div>
      </div>
    </div>
  `}function jr(e){let{profile:t}=e,n=ka.map(([s,a])=>`
    <div class="kv-row">
      <dt class="kv-k">${a}</dt>
      <dd class="kv-v">${t[s]?d(t[s]):'<span class="ink-faint">\u2014</span>'}</dd>
    </div>`).join("");return p`
    <section class="section" aria-labelledby="care-h">
      <div class="section-head">
        <h2 id="care-h">Care details</h2>
        <button class="btn btn-sm btn-quiet" data-action="profile-edit">${o(c("edit",15))} Edit</button>
      </div>
      <div class="card card-flush"><dl class="kv">${o(n)}</dl></div>
      <p class="hint">
        These appear on the emergency card and the printed card, so whoever
        helps you has them without having to ask.
      </p>
    </section>
  `}function Sa(e){let t=Date.parse(e);if(!t)return"";let n=Math.round((Date.now()-t)/6e4);if(n<1)return"just now";if(n<60)return`${n} min ago`;let s=Math.round(n/60);return s<24?`${s} h ago`:new Date(t).toLocaleDateString(void 0,{month:"short",day:"numeric"})}var qn={"signed-out":"Sign in to Flux again to keep syncing.",offline:"Offline. It will sync when you\u2019re back online.","not-ready":"Sync isn\u2019t switched on for Flux yet.","wrong-key":"This device\u2019s sync key doesn\u2019t open the synced copy.",gone:"Turned off: the synced copy was deleted on another device."};function xa(){let e=mt();if(!X())return e.error==="gone"?qn.gone:e.account?"Off. Encrypted on this device before it leaves, so Flux can\u2019t read it.":"Sign in to Flux to keep Synara the same on your phone and computer.";if(e.phase==="syncing")return"Syncing\u2026";if(e.phase==="conflict")return"Changed on two devices. Choose which to keep.";if(e.phase==="error")return qn[e.error]||"Couldn\u2019t sync. It will try again.";let t=Fs();return t?`On \xB7 synced ${Sa(t)}`:"On"}function Ir(e){return Gt()?p`
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
            <span class="row-s">${xa()}</span>
          </span>
          <span class="chev">${o(c("chevron"))}</span>
        </button>
      </div>
    </section>
  `:""}var $a=p`
  <ul class="sheet-list">
    <li>${o(c("lock",16))}<span>Synara encrypts everything on this device before it leaves. Flux stores
      a locked copy it can’t open — not your medication, seizures or contacts.</span></li>
    <li>${o(c("info",16))}<span>The key stays on your devices. You’ll get a <strong>sync key</strong> to
      enter on your other devices. If you lose every device and the key, the synced copy can’t be
      opened — but each device keeps its own.</span></li>
  </ul>
`;async function Pn(){let e=await pt();if(!X()&&!e){C({title:"Sync across your devices",body:p`
        <p class="sheet-message">Sign in to your Flux account, then come back here to keep Synara the
          same on your phone and computer.</p>
        ${o($a)}
      `,footer:`
        <button class="btn btn-quiet" data-action="close-sheet">Not now</button>
        <a class="btn btn-primary" href="index.html">Sign in to Flux</a>
      `});return}if(!X()){C({title:"Sync across your devices",body:p`
        <p class="sheet-message">Signed in to Flux as <strong>${e.email||"your account"}</strong>.</p>
        ${o($a)}
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
      `});return}let t=mt();C({title:"Sync is on",body:p`
      <p class="sheet-message">${xa()}${o(t.account?` \xB7 ${d(t.account.email)}`:"")}</p>
      <div class="sync-key">
        <span class="label">Your sync key</span>
        <code class="mono">${nn()}</code>
        <span class="t-sm ink-3">Enter it on your other devices in You → Flux → Sync. Keep it private:
          anyone with it and your Flux sign-in could read your synced copy.</span>
      </div>
      <div class="stack stack-2 mt-3">
        <button class="btn btn-outline btn-block" data-action="sync-copy-key">Copy sync key</button>
        <button class="btn btn-outline btn-block" data-action="sync-now">Sync now</button>
        <button class="btn btn-quiet btn-block" data-action="sync-stop">Turn off on this device</button>
        <button class="btn btn-quiet btn-block text-bad" data-action="sync-stop-delete">Turn off and delete the synced copy</button>
      </div>
    `})}function Rn(){C({title:"Which copy should Synara keep?",body:p`
      <p class="sheet-message">Synara changed on this device and on another one since they last
        synced. Pick the copy to keep; the other will be replaced.</p>
    `,footer:`
      <button class="btn btn-outline" data-action="sync-resolve" data-choice="cloud">Use the other device\u2019s</button>
      <button class="btn btn-primary" data-action="sync-resolve" data-choice="device">Keep this device\u2019s</button>
    `})}var Hr=[[0,"On time"],[10,"10 min early"],[15,"15 min early"],[30,"30 min early"]];function Pr(e){let{remindersOn:t,reminderLead:n}=e.settings,s=Re(),a=Me(),r=!s.ok||a==="denied",i=t&&!r,l=s.ok?a==="denied"?"Notifications are blocked for this site in your browser settings.":i?"On \u2014 while Synara is open in a tab or installed.":"A nudge at each dose time.":s.reason,u=Hr.map(([h,y])=>`
    <button class="segment" data-action="reminder-lead" data-value="${h}"
            aria-pressed="${h===n}">${y}</button>`).join("");return p`
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
            <div class="segments segments-wrap" role="group" aria-label="Reminder timing">${u}</div>
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
  `}var qr=[["system","Match device"],["light","Light"],["dark","Dark"]];function Rr(e){let t=e.settings.theme||"system",n=qr.map(([s,a])=>`
    <button class="segment" data-action="theme-set" data-theme="${s}"
            aria-pressed="${s===t}">${a}</button>`).join("");return p`
    <section class="section" aria-labelledby="look-h">
      <h2 id="look-h">Appearance</h2>
      <div class="card">
        <div class="segments" role="group" aria-label="Theme">${o(n)}</div>
        <p class="hint mt-3">
          Dark mode is here for a reason: this app gets opened at 3am to log a
          seizure that just woke you. Nothing in Synara ever flashes or strobes.
        </p>
      </div>
    </section>
  `}function Fr(e){let t=(e.seizures||[]).length,n=Object.keys(e.doses||{}).length,s=Object.keys(e.checkins||{}).length;return p`
    <section class="section" aria-labelledby="data-h">
      <h2 id="data-h">Your data</h2>
      <div class="card card-flush">
        <ul class="rows">
          <li class="list-row list-row-static">
            <span class="med-dot" data-color="mint" aria-hidden="true">${o(c("lock",20))}</span>
            <span class="row-body">
              <span class="row-t">Stored on this device only</span>
              <span class="row-s">${T(n,"day")} of doses · ${T(t,"seizure")} · ${T(s,"check-in")}</span>
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
  `}function Br(){return p`
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
          ${o(xe())}
          <span class="t-sm ink-3">Built and hosted by Flux, the free planner for school.</span>
        </div>
      </div>
    </section>
  `}function Wr(e){let t=Array.isArray(e.meds)?e.meds.length:0,n=Array.isArray(e.seizures)?e.seizures.length:0,s=e.doses&&typeof e.doses=="object"?Object.keys(e.doses).length:0,a=e.profile&&typeof e.profile.name=="string"&&e.profile.name.trim();return`${a?`${a.slice(0,80)}'s record: `:""}${T(t,"medication")}, ${T(s,"day")} of doses, ${T(n,"seizure")}.`}var Yr={"profile-edit"(e,t){let n=t.profile,s=ka.map(([a,r,i])=>`
      <div class="field">
        <label class="label" for="p-${a}">${r}</label>
        <input class="input" id="p-${a}" name="${a}" value="${d(n[a]||"")}"
               placeholder="${d(i)}" autocomplete="off" maxlength="200" />
      </div>`).join("");C({title:"Your details",body:p`<form class="stack stack-4" data-action="profile-save" novalidate>${o(s)}</form>`,footer:'<button class="btn btn-primary" data-action="profile-save">Save</button>'})},async"profile-save"(){await st(_()),E(),m("Details saved","ok")},async"reminders-toggle"(e,t){let n=!t.settings.remindersOn;if(n){let s=Re();if(!s.ok){m(s.reason,"bad");return}if(await Es()!=="granted"){m("Notifications weren't allowed","bad");return}}await ee({remindersOn:n}),m(n?"Reminders on":"Reminders off",n?"ok":"default")},async"reminder-lead"(e){await ee({reminderLead:Number(e.dataset.value)||0})},"reminders-test"(){let e=Cs();m(e?"Test sent \u2014 check your notifications":"Couldn't send a test",e?"ok":"bad")},async"theme-set"(e){await ee({theme:e.dataset.theme})},"data-export"(e,t){let n=new Blob([at()],{type:"application/json"}),s=URL.createObjectURL(n),a=document.createElement("a"),r=(t.profile.name||"backup").replace(/[^\w-]+/g,"-").toLowerCase();a.href=s,a.download=`synara-${r}-${f()}.json`,document.body.appendChild(a),a.click(),a.remove(),setTimeout(()=>URL.revokeObjectURL(s),1e3),m("Backup downloaded","ok")},async"data-import"(e){let t=e.files&&e.files[0];if(e.value="",!t)return;if(t.size>5*1024*1024){m("That file is too large to be a Synara backup","bad");return}let n=await t.text(),s;try{s=JSON.parse(n)}catch{m("That file isn't a Synara backup","bad");return}R({title:"Replace everything with this backup?",message:`${Wr(s)} Everything currently on this device will be replaced. Download a backup of what's here first if you might need it.`,confirmLabel:"Restore backup",danger:!1,async onConfirm(){try{await ot(n),m("Backup restored","ok")}catch(a){m(a.message==="not-synara"?"That file isn't a Synara backup":"Couldn't read that backup","bad")}}})},"data-demo"(){let e=X();R({title:"Load example data?",message:"Everything on this device will be replaced with a made-up student's record. Download a backup first if any of what's here is real."+(e?" Sync turns off on this device first, so the example never reaches your other devices.":""),confirmLabel:"Load example data",async onConfirm(){e&&await Ce(),await je({seedFn:yt}),m("Example data loaded","ok")}})},"data-wipe"(){R({title:"Delete everything?",message:"Every medication, dose, seizure, check-in, contact, and your safety card will be removed from this device. This can't be undone.",confirmLabel:"Delete everything",async onConfirm(){await Ce(),await os();try{sessionStorage.removeItem("synara.timer")}catch{}history.replaceState(null,"",location.pathname),location.reload()}})},async"flux-link-toggle"(e,t){let n=!t.settings.fluxLink;await ee({fluxLink:n}),m(n?"Your dose times now show in your Flux Planner":"Removed from your Flux Planner","ok")},"sync-open"(){return Pn()},async"sync-start-new"(){try{await rn(),await E(),m("Sync is on","ok"),Pn()}catch(e){e.code==="has-copy"?_r():m(he(e),"bad")}},async"sync-join-check"(){let{key:e}=_(),t;try{t=await Ks(e)}catch(n){m(he(n),"bad");return}R({title:"Use your synced copy here?",message:`Your synced copy, updated ${Sa(t.updatedAt)}, has ${T(t.meds,"medication")} and ${T(t.seizures,"logged seizure")}${t.name?` for ${t.name}`:""}. It will replace what is on this device now.`,confirmLabel:"Use synced copy",danger:!1,async onConfirm(){try{await Vs(t.key),m("This device is synced","ok")}catch(n){m(he(n),"bad")}}})},async"sync-copy-key"(){try{await navigator.clipboard.writeText(nn()),m("Sync key copied","ok")}catch{m("Couldn\u2019t copy. Select the key and copy it instead.","bad")}},async"sync-now"(){await E();let e=await Te();e==="error"?m(he(mt()),"bad"):e!=="conflict"&&m("Synced","ok")},"sync-stop"(){R({title:"Turn off sync on this device?",message:"This device keeps everything it has. Your synced copy and your other devices are not changed.",confirmLabel:"Turn off",danger:!1,async onConfirm(){await Ce(),m("Sync is off on this device","ok")}})},"sync-stop-delete"(){R({title:"Delete the synced copy?",message:"The encrypted copy in your Flux account is deleted and sync stops on every device. Each device keeps its own record.",confirmLabel:"Delete synced copy",async onConfirm(){try{await Ce({deleteCopy:!0}),m("Synced copy deleted","ok")}catch(e){m(he(e),"bad")}}})},async"sync-resolve"(e){await E();try{await _s(e.dataset.choice),m("Synced","ok")}catch(t){m(he(t),"bad")}},"sync-fresh"(){R({title:"Delete the old synced copy?",message:"Only do this if you no longer have the device or the sync key it was made with. The old copy is deleted and this device becomes the new one to sync from.",confirmLabel:"Delete and start fresh",async onConfirm(){try{await Ce({deleteCopy:!0}),await rn(),m("Sync is on","ok"),Pn()}catch(e){m(he(e),"bad")}}})}};function he(e){let t=e&&(e.code||e.error||e.message)||"";return t==="bad-key"?"That isn\u2019t a sync key. It\u2019s 26 letters and numbers.":t==="no-copy"?"There\u2019s no synced copy in this Flux account yet. Turn sync on from your other device first.":t==="wrong-key"?"That key doesn\u2019t open your synced copy. Check it on your other device.":qn[t]||"Couldn\u2019t sync. Please try again."}function _r(){C({title:"You already have a synced copy",body:p`
      <p class="sheet-message">Your Flux account already has a synced copy of Synara. To use it here,
        enter the sync key from the device where you turned sync on (You → Flux → Sync).</p>
      <p class="sheet-message">Lost that device and its key? You can delete the old copy and start
        again from this one.</p>
    `,footer:`
      <button class="btn btn-quiet" data-action="sync-open">Enter a sync key</button>
      <button class="btn btn-danger" data-action="sync-fresh">Start fresh</button>
    `})}var Wn={home:$n,meds:Sn,track:En,safety:Hn,you:Fn},Yn=["home","meds","track","safety","you"],_n={home:{label:"Home",icon:"home"},meds:{label:"Meds",icon:"pill"},track:{label:"Seizures",icon:"chart"},safety:{label:"Safety",icon:"shield"},you:{label:"You",icon:"user"}},Ma={sos:"safety"},V="home",K={shell:document.querySelector(".app-shell"),appbar:document.getElementById("appbar"),screen:document.getElementById("screen"),tabbar:document.getElementById("tabbar")},Kr=document.documentElement.dataset.host==="flux",xt=document.querySelector("[data-flux-hub]");function Ea(){let e=(location.hash||"").replace(/^#\/?/,"").split(/[/?]/)[0];return Ma[e]?{route:Ma[e],sos:e==="sos"}:{route:Yn.includes(e)?e:"home",sos:!1}}function Vr(e){Yn.includes(e)&&location.hash!==`#/${e}`&&(location.hash=`#/${e}`)}function za(e){let t=document.documentElement;e==="light"||e==="dark"?t.setAttribute("data-theme",e):t.removeAttribute("data-theme");let n=e==="dark"||e!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches;for(let s of document.querySelectorAll('meta[name="theme-color"]'))s.content=e==="system"?s.media.includes("dark")?"#121019":"#f6f5fa":n?"#121019":"#f6f5fa"}function Ur(e){let t=f();return I(t,e).filter(({med:n,time:s})=>q(t,n.id,s,e)==="pending").length}function Xr(e){let t=Ur(e);K.tabbar.innerHTML=p`
    <div class="sidebar-brand">
      <div class="brand-mark">${o(ut())}</div>
      <div>
        <div class="brand-name">Synara</div>
        <div class="brand-tag">Epilepsy care for school</div>
      </div>
    </div>
    ${o(Yn.map(n=>{let s=_n[n],a=n===V,r=n==="meds"&&t>0,i=r?`${s.label}, ${t} ${t===1?"dose":"doses"} not logged today`:s.label;return`
        <button class="tab" data-action="nav" data-to="${n}"
                ${a?'aria-current="page"':""} aria-label="${i}">
          <span class="tab-ico">${c(s.icon)}</span>
          <span class="tab-label">${s.label}</span>
          ${r?'<span class="tab-dot" aria-hidden="true"></span>':""}
        </button>`}).join(""))}
    <button class="sidebar-sos" data-action="open-emergency">
      ${o(c("shield",18))}
      <span>Open emergency card</span>
    </button>
    ${o(xe("sidebar-powered"))}
  `}function Jr(e){let t=Wn[V],n=t.title?t.title(e):_n[V].label,s=t.subtitle?t.subtitle(e):"";K.appbar.innerHTML=p`
    <div class="appbar-title">
      <h1 class="appbar-t">${n}</h1>
      ${o(s?`<span class="appbar-s">${d(s)}</span>`:"")}
    </div>
    <button class="sos-btn" data-action="open-emergency"
            aria-label="Open the emergency seizure card">
      ${o(c("shield",16))}<span>SOS</span>
    </button>
  `,xt&&K.appbar.insertBefore(xt,K.appbar.querySelector(".sos-btn"))}function Gr(e){K.screen.innerHTML=p`
    <div class="screen-inner" data-route="${V}">${o(Wn[V].render(e))}</div>
  `}function Ve(){let e=O(),t=K.screen.scrollTop,n=document.activeElement,s=xt&&xt.contains(n),a=n&&!s&&K.shell.contains(n)?Bt(n):null;document.title=`${_n[V].label} \xB7 Synara`,za(e.settings.theme),As(e),Xr(e),Jr(e),Gr(e),K.screen.scrollTop=t,a?Wt(a,K.shell):s&&n.focus()}var Bn={nav(e){Vr(e.dataset.to)},"close-sheet"(){E()},"close-emergency"(){Se()},"open-emergency"(){St(O())},"setup-go"(e){Ts()&&qe(),Mt(e.dataset.target,e)},reload(){location.reload()}};for(let e of[...Object.values(Wn),yn])if(e.actions)for(let[t,n]of Object.entries(e.actions))Bn[t]&&console.warn(`[synara] duplicate action "${t}"`),Bn[t]=n;function Mt(e,t){let n=Bn[e];return n?(Promise.resolve(n(t,O())).catch(s=>{console.error("[synara] action failed:",e,s),m(s&&s.message==="save-failed"?"Could not save \u2014 your browser storage may be full or blocked.":"Something went wrong. Please try that again.","bad")}),!0):!1}document.addEventListener("click",e=>{let t=e.target.closest("[data-action]");!t||t.tagName==="FORM"||Mt(t.dataset.action,t)&&e.preventDefault()});document.addEventListener("submit",e=>{let t=e.target.closest("form[data-action]");t&&(e.preventDefault(),Mt(t.dataset.action,t))});document.addEventListener("change",e=>{let t=e.target.closest("[data-change]");t&&Mt(t.dataset.change,t)});function Ta(){let e=Ea();e.route!==V&&(V=e.route,dt()&&!e.sos&&Se(),E(),K.screen.scrollTop=0,Ve()),e.sos&&(St(O()),history.replaceState(null,"","#/safety"))}function Qr(){let e=f();setInterval(()=>{if(dt())return;let t=f();(V==="home"||t!==e)&&Ve(),e=t},6e4)}function Zr(){Kr||!("serviceWorker"in navigator)||location.protocol==="file:"||window.addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").catch(e=>{console.warn("[synara] service worker not registered:",e)})})}async function ei(){let e=Ea();V=e.route;let{firstRun:t}=await as();ve(Ve),Ve(),t?fn():e.sos&&Ta(),window.addEventListener("hashchange",Ta),window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>za(O().settings.theme)),zs(),Zr(),Qr(),Rs(n=>{V==="you"&&Ve(),n.phase==="conflict"&&!$s()&&!dt()&&Rn()}),Us()}ei().catch(e=>{console.error("[synara] failed to start:",e),K.screen.innerHTML=p`
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
