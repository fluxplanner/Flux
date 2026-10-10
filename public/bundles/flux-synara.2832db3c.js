(()=>{var to=Object.defineProperty;var be=(e,t)=>{for(var n in t)to(e,n,{get:t[n],enumerable:!0})};function d(e){return e==null?"":String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}var os=Symbol("raw");function o(e){return{[os]:!0,value:String(e??"")}}function rs(e){return e==null?"":Array.isArray(e)?e.map(rs).join(""):typeof e=="object"&&e[os]?e.value:d(e)}function p(e,...t){let n=e[0];for(let s=0;s<t.length;s++)n+=rs(t[s])+e[s+1];return n}var le=e=>String(e).padStart(2,"0");function g(e=new Date){return`${e.getFullYear()}-${le(e.getMonth()+1)}-${le(e.getDate())}`}function G(e=new Date){return`${g(e)}T${le(e.getHours())}:${le(e.getMinutes())}`}function de(e=new Date){return`${le(e.getHours())}:${le(e.getMinutes())}`}function X(e){let[t,n,s]=String(e).split("-").map(Number);return new Date(t,n-1,s)}function F(e){let[t,n="00:00"]=String(e).split("T"),[s,a,r]=t.split("-").map(Number),[i,l]=n.split(":").map(Number);return new Date(s,a-1,r,i||0,l||0)}function V(e){let[t,n]=String(e).split(":").map(Number);return(t||0)*60+(n||0)}function M(e,t){let n=X(e);return n.setDate(n.getDate()+t),g(n)}function nt(e,t){let n=X(t)-X(e);return Math.round(n/864e5)}function is(e,t=g()){let n=[];for(let s=e-1;s>=0;s--)n.push(M(t,-s));return n}var cs=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],ls=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],Ie=e=>cs[e],ds=e=>ls[e];function P(e){let[t,n]=String(e).split(":").map(Number),s=t>=12?"PM":"AM";return`${t%12===0?12:t%12}:${le(n||0)} ${s}`}function J(e,{relative:t=!0}={}){let n=g();if(t){if(e===n)return"Today";if(e===M(n,-1))return"Yesterday";if(e===M(n,1))return"Tomorrow"}let s=X(e);return`${ls[s.getDay()]}, ${cs[s.getMonth()]} ${s.getDate()}`}function st(e){let t=Math.max(0,Math.round(e));if(t<1)return"now";if(t<60)return`${t}m`;let n=Math.floor(t/60),s=t%60;return s?`${n}h ${s}m`:`${n}h`}function Pe(e){let t=Math.max(0,Math.round(e));if(t<60)return`${t} sec`;let n=Math.floor(t/60),s=t%60;return s?`${n} min ${s} sec`:`${n} min`}function us(e){let[t,n]=String(e).split("T");return`${J(t)} at ${P(n||"00:00")}`}function ps(e){let t=F(e),n=Math.round((Date.now()-t.getTime())/6e4);if(n<1)return"just now";if(n<60)return`${n}m ago`;let s=Math.round(n/60);if(s<24)return`${s}h ago`;let a=Math.round(s/24);if(a===1)return"yesterday";if(a<30)return`${a} days ago`;let r=Math.round(a/30);return r===1?"a month ago":`${r} months ago`}function L(e="id"){return`${e}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`}var at=(e,t,n)=>Math.min(n,Math.max(t,e)),hs=/\s*(?:ext\.?|x|#)\s*/i;function Bt(e){let[t,n]=String(e).split(hs),s=(n||"").replace(/\D/g,"");return`tel:${t.replace(/[^\d+]/g,"")}${s?`,${s}`:""}`}function ot(e){return(String(e||"").split(hs)[0].match(/\d/g)||[]).length>=3}function rt(e){return String(e||"").trim().split(/\s+/).slice(0,2).map(t=>t[0]||"").join("").toUpperCase()}function Wt(e){let t=new Map;for(let n of e)n==null||n===""||t.set(n,(t.get(n)||0)+1);return[...t.entries()].map(([n,s])=>({value:n,count:s})).sort((n,s)=>s.count-n.count)}function T(e,t,n="s"){return`${e} ${t}${e===1?"":n}`}function Re(e,t){if(e==="taken")return"Taken";if(e==="late")return"Taken late";if(e==="missed")return"Missed";let n=V(de())-V(t);return n<0?"Scheduled":n<=60?"Due now":`${st(n)} overdue`}var it="synara.v2",ys=3,gs={name:"local",async read(){try{let e=localStorage.getItem(it);return e?JSON.parse(e):null}catch(e){return console.warn("[synara] could not read local state:",e),null}},async write(e){try{return localStorage.setItem(it,JSON.stringify(e)),!0}catch(t){throw console.error("[synara] could not save state:",t),new Error("save-failed")}},async clear(){try{localStorage.removeItem(it)}catch(e){console.warn("[synara] could not clear state:",e)}}},He=gs;function ue(){return{v:ys,profile:{name:"",pronouns:"",grade:"",school:"",seizureType:"",diagnosed:"",neurologist:"",neuroPhone:"",allergies:"",bloodType:"",rescueMed:""},meds:[],doses:{},seizures:[],checkins:{},contacts:[],card:{looksLike:"",during:["Stay with them and start timing the seizure.","If they are stiffening or shaking, gently help them down to the floor.","Move anything hard or sharp out of the way.","If they are on the floor, put something soft under their head.","Loosen anything tight around their neck.","If they are not aware or not awake, gently turn them onto their side.","If they are confused or wandering, stay beside them and gently guide them away from danger, like stairs, roads, or water. Don't grab or hold them.","If they have a seizure action plan, follow it. Only give rescue medicine if you are trained to.","Stay calm and speak normally \u2014 they may be able to hear you."],doNot:["Do NOT put anything in their mouth \u2014 they cannot swallow their tongue. Rescue medicine from their seizure plan is the only exception.","Do NOT hold them down or try to stop the movements.","Do NOT give food, drink, or pills until they are fully awake.","Do NOT crowd them \u2014 ask other people to step back."],after:["Stay with them until they are fully alert and know where they are.","Tell them calmly what happened \u2014 they may not remember.","Let them rest somewhere quiet.","Call their emergency contact.","Write down the time it started and how long it lasted."],callEms:["The seizure lasts longer than 5 minutes.","A second seizure starts soon after the first.","They do not wake up or return to normal afterwards.","They are having trouble breathing, or their lips stay blue.","They were injured, or it happened in water.","It looks different from their usual seizures.","They have diabetes or a heart condition, or are pregnant.","Rescue medicine was given, or their seizure plan says to call."],forTeacher:"",forNurse:"",forCoach:"",updated:""},settings:{theme:"system",remindersOn:!1,reminderLead:0,quietHours:null,seeded:!1,fluxLink:!1,noMeds:!1,setupHidden:!1}}}var no=/^[A-Za-z0-9_-]{1,64}$/,so=/^\d{4}-\d{2}-\d{2}$/,ao=/^([01]\d|2[0-3]):[0-5]\d$/,oo=/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/,bs=new Set(["taken","late","missed"]),Kt=new Set(["violet","mint","amber","rose","blue"]),Vt=new Set(["tablet","capsule","liquid","patch","injection","other"]),ro=new Set(["system","light","dark"]),ve=e=>typeof e=="string"&&so.test(e),S=(e,t=4e3)=>typeof e=="string"?e.slice(0,t):"",ct=(e,t,n,s)=>typeof e=="number"&&Number.isFinite(e)?Math.min(n,Math.max(t,e)):s,io=e=>Array.isArray(e)?e.map(t=>S(t,600)).filter(Boolean).slice(0,30):null,Jt=(e,t)=>typeof e=="string"&&no.test(e)?e:L(t),qe=e=>typeof e=="string"&&ao.test(e),we=e=>typeof e=="string"&&oo.test(e);function $e(e){return Array.isArray(e)?[...new Set(e.filter(qe))].sort():[]}function co(e,t){let n=g(),s=ve(e.added)?e.added:t||n,a;Array.isArray(e.schedule)&&e.schedule.length?a=e.schedule.filter(i=>i&&ve(i.from)).map(i=>({from:i.from,times:$e(i.times)})).sort((i,l)=>i.from<l.from?-1:i.from>l.from?1:0):a=[{from:s,times:$e(e.times)}],a.length||(a=[{from:s,times:[]}]),a[0].from=s;let r=ve(e.ended)?e.ended:null;return!r&&e.active===!1&&(r=n),{id:Jt(e.id,"med"),name:S(e.name,120),dose:S(e.dose,60),form:Vt.has(e.form)?e.form:"tablet",notes:S(e.notes,600),color:Kt.has(e.color)?e.color:"violet",added:s,addedAt:qe(e.addedAt)?e.addedAt:null,ended:r,schedule:a}}function lo(e,t){let n={};if(!e||typeof e!="object")return n;for(let[s,a]of Object.entries(e)){if(!ve(s)||!a||typeof a!="object")continue;let r={};for(let[i,l]of Object.entries(a)){let[h,u]=i.split("|");!t.has(h)||!qe(u)||!l||!bs.has(l.status)||(r[i]={status:l.status,at:we(l.at)?l.at:`${s}T00:00`})}Object.keys(r).length&&(n[s]=r)}return n}function Ut(e){return!e||!we(e.at)?null:{id:Jt(e.id,"sz"),at:e.at,duration:Math.round(ct(Number(e.duration),0,7200,0)),type:S(e.type,80),trigger:S(e.trigger,80),place:S(e.place,120),aura:S(e.aura,300),injury:e.injury===!0,emsCalled:e.emsCalled===!0,notes:S(e.notes,4e3),logged:we(e.logged)?e.logged:e.at}}function uo(e){let t={};if(!e||typeof e!="object")return t;for(let[n,s]of Object.entries(e)){if(!ve(n)||!s||typeof s!="object")continue;let a=ct(s.stress,1,5,null);t[n]={sleepHours:ct(s.sleepHours,0,24,null),sleepQuality:["poor","ok","good"].includes(s.sleepQuality)?s.sleepQuality:null,stress:a==null?null:Math.round(a),mood:["low","ok"].includes(s.mood)?s.mood:null,notes:S(s.notes,600),at:we(s.at)?s.at:`${n}T00:00`}}return t}function po(e){return!e||typeof e!="object"?null:{id:Jt(e.id,"c"),name:S(e.name,120),relation:S(e.relation,80),phone:S(e.phone,40),primary:e.primary===!0}}function ho(e){let t=new Map;if(!e||typeof e!="object")return t;for(let n of Object.keys(e).sort())for(let s of Object.keys(e[n]||{})){let a=s.split("|")[0];t.has(a)||t.set(a,n)}return t}var Xt=(e,t)=>e.at<t.at?1:e.at>t.at?-1:0,ut=new Set(["during","doNot","callEms"]);function vs(e){return[...ue().card[e]||[]]}var ms={during:["Stay with them and start timing the seizure.","Move anything hard or sharp out of the way.","Put something soft under their head.","Loosen anything tight around their neck.","If they are not aware or not awake, gently turn them onto their side.","Stay calm and speak normally \u2014 they may be able to hear you."],doNot:["Do NOT put anything in their mouth. They cannot swallow their tongue.","Do NOT hold them down or try to stop the movements.","Do NOT give food, drink, or pills until they are fully awake.","Do NOT crowd them \u2014 ask other people to step back."],callEms:["The seizure lasts longer than 5 minutes.","A second seizure starts soon after the first.","They do not wake up or return to normal afterwards.","They are having trouble breathing, or their lips stay blue.","They were injured, or it happened in water."]},mo=(e,t)=>e.length===t.length&&e.every((n,s)=>n===t[s]);function pt(e){let t=ue(),n=e&&typeof e=="object"?e:{},s=ho(n.doses),a=(Array.isArray(n.meds)?n.meds:[]).filter($=>$&&typeof $=="object").map($=>co($,s.get($.id))),r=new Set(a.map($=>$.id)),i=(Array.isArray(n.seizures)?n.seizures:[]).map(Ut).filter(Boolean).sort(Xt),l=(Array.isArray(n.contacts)?n.contacts:[]).map(po).filter(Boolean),h=!1;for(let $ of l)$.primary&&h&&($.primary=!1),$.primary&&(h=!0);let u={...t.profile};if(n.profile&&typeof n.profile=="object")for(let $ of Object.keys(t.profile))u[$]=S(n.profile[$],200);let y={...t.card};if(n.card&&typeof n.card=="object"){for(let $ of["during","doNot","after","callEms"]){let U=io(n.card[$]);U&&(!U.length&&ut.has($)||ms[$]&&mo(U,ms[$])||(y[$]=U))}for(let $ of["looksLike","forTeacher","forNurse","forCoach"])typeof n.card[$]=="string"&&(y[$]=S(n.card[$]));y.updated=ve(n.card.updated)?n.card.updated:""}let f=n.settings&&typeof n.settings=="object"?n.settings:{},w=f.quietHours,A={theme:ro.has(f.theme)?f.theme:"system",remindersOn:f.remindersOn===!0,reminderLead:Math.round(ct(f.reminderLead,0,120,0)),quietHours:w&&qe(w.from)&&qe(w.to)?{from:w.from,to:w.to}:null,seeded:f.seeded===!0,fluxLink:f.fluxLink===!0,noMeds:f.noMeds===!0,setupHidden:f.setupHidden===!0};return{v:ys,profile:u,meds:a,doses:lo(n.doses,r),seizures:i,checkins:uo(n.checkins),contacts:l,card:y,settings:A}}var C=ue(),Yt=new Set,Be=!1;function O(){return C}function te(e){return Yt.add(e),()=>Yt.delete(e)}function Fe(){for(let e of Yt)try{e(C)}catch(t){console.error("[synara] listener threw:",t)}}var ke=!1,lt=!1,dt=!1;function ws(){return lt?"memory":dt?"failing":"ok"}var fo=e=>JSON.parse(JSON.stringify(e));async function Gt(e){try{await He.write(e),ke=!0,lt=!1,dt=!1}catch(t){if(dt=!0,ke)throw Fe(),t;lt=!0}return C=e,Fe(),C}async function j(e){if(!Be)throw new Error("not-ready");let t=fo(C);return e(t),Gt(t)}function Qt(){Fe()}function yo(e){if(e.key===it)try{C=e.newValue?pt(JSON.parse(e.newValue)):ue(),ke=!!e.newValue,ke&&(lt=!1),Be=!0,Fe()}catch(t){console.warn("[synara] ignored an unreadable change from another tab:",t)}}var fs=!1;async function $s(){!fs&&He===gs&&typeof window<"u"&&(window.addEventListener("storage",yo),fs=!0);let e=await He.read();if(Be=!0,!e)return C=ue(),{state:C,firstRun:!0};if(ke=!0,C=pt(e),JSON.stringify(C)!==JSON.stringify(e))try{await He.write(C)}catch(t){console.warn("[synara] could not save the upgraded record:",t),dt=!0}return{state:C,firstRun:!1}}async function ks(){await He.clear(),ke=!1,C=ue(),Fe()}async function We({seedFn:e}={}){if(!Be)throw new Error("not-ready");let t=ue();return e&&(e(t),t.settings.seeded=!0),Gt(pt(t))}function go(e,t){if(t<e.added)return[];if(e.ended&&t>=e.ended)return[];let n=[];for(let s of e.schedule)if(s.from<=t)n=s.times;else break;if(t===e.added&&e.addedAt){let s=V(e.addedAt)-Ye;n=n.filter(a=>V(a)>=s)}return n}function ne(e){let t=e.schedule[e.schedule.length-1];return t?t.times:[]}function Zt(e,t=g()){return!e.ended||e.ended>t}function B(e=C){let t=g();return e.meds.filter(n=>Zt(n,t))}function D(e,t=C){let n=[];for(let s of t.meds)for(let a of go(s,e))n.push({med:s,time:a});return n.sort((s,a)=>V(s.time)-V(a.time)||s.med.name.localeCompare(a.med.name))}function Ss({name:e,dose:t="",form:n="tablet",times:s=[],notes:a="",color:r="violet"}){let i=g();return j(l=>{l.meds.push({id:L("med"),name:S(e,120).trim(),dose:S(t,60).trim(),form:Vt.has(n)?n:"tablet",notes:S(a,600).trim(),color:Kt.has(r)?r:"violet",added:i,addedAt:de(),ended:null,schedule:[{from:i,times:$e(s)}]})})}function xs(e,t){let n=g();return j(s=>{let a=s.meds.find(r=>r.id===e);if(a&&(typeof t.name=="string"&&(a.name=S(t.name,120).trim()),typeof t.dose=="string"&&(a.dose=S(t.dose,60).trim()),typeof t.notes=="string"&&(a.notes=S(t.notes,600).trim()),Vt.has(t.form)&&(a.form=t.form),Kt.has(t.color)&&(a.color=t.color),Array.isArray(t.times))){let r=$e(t.times);if(r.join()===ne(a).join())return;let i=a.schedule[a.schedule.length-1];if(i.from===n){i.times=r;let l=a.schedule[a.schedule.length-2];l&&l.times.join()===r.join()&&a.schedule.pop()}else a.schedule.push({from:n,times:r})}})}function Ms(e){let t=g();return j(n=>{let s=n.meds.find(a=>a.id===e);if(s){if(s.added>=t){n.meds=n.meds.filter(a=>a.id!==e);for(let a of Object.keys(n.doses)){for(let r of Object.keys(n.doses[a]))r.startsWith(`${e}|`)&&delete n.doses[a][r];Object.keys(n.doses[a]).length||delete n.doses[a]}return}s.ended=t}})}function Ts(e){let t=g();return j(n=>{let s=n.meds.find(r=>r.id===e);if(!s||!s.ended)return;let a=ne(s);s.ended<t&&(s.schedule.push({from:s.ended,times:[]}),s.schedule.push({from:t,times:a})),s.ended=null})}var _t=(e,t)=>`${e}|${t}`;function ht(e,t,n,s){return j(a=>{if(s==="pending"){a.doses[e]&&(delete a.doses[e][_t(t,n)],Object.keys(a.doses[e]).length||delete a.doses[e]);return}bs.has(s)&&(a.doses[e]||(a.doses[e]={}),a.doses[e][_t(t,n)]={status:s,at:G()})})}function R(e,t,n,s=C){let a=s.doses[e]&&s.doses[e][_t(t,n)];return a?a.status:"pending"}var Ye=60;function pe(e,t,n,s=C){let a=R(e,t,n,s);return a!=="pending"?a:mt(e,n)>Ye?"missed":"pending"}function mt(e,t){return Math.round((F(G())-F(`${e}T${t}`))/6e4)}function Es({at:e,duration:t=0,type:n="",trigger:s="",place:a="",aura:r="",injury:i=!1,emsCalled:l=!1,notes:h=""}){return j(u=>{let y=Ut({id:L("sz"),at:e||G(),duration:Number(t)||0,type:n,trigger:s,place:a,aura:r,injury:!!i,emsCalled:!!l,notes:(h||"").trim(),logged:G()});y&&(u.seizures.push(y),u.seizures.sort(Xt))})}function zs(e,t){return j(n=>{let s=n.seizures.findIndex(r=>r.id===e);if(s<0)return;let a=Ut({...n.seizures[s],...t,id:e});a&&(n.seizures[s]=a,n.seizures.sort(Xt))})}function Cs(e){return j(t=>{t.seizures=t.seizures.filter(n=>n.id!==e)})}function As(e,t){return j(n=>{n.checkins[e]={...n.checkins[e]||{},...t,at:G()}})}function _e(e,t=C){return t.checkins[e]||null}function Os({name:e,relation:t="",phone:n,primary:s=!1}){return j(a=>{s&&a.contacts.forEach(r=>{r.primary=!1}),a.contacts.push({id:L("c"),name:S(e,120).trim(),relation:S(t,80).trim(),phone:S(n,40).trim(),primary:!!s})})}function Ns(e,t){return j(n=>{let s=n.contacts.find(a=>a.id===e);s&&(t.primary&&n.contacts.forEach(a=>{a.primary=!1}),typeof t.name=="string"&&(s.name=S(t.name,120).trim()),typeof t.relation=="string"&&(s.relation=S(t.relation,80).trim()),typeof t.phone=="string"&&(s.phone=S(t.phone,40).trim()),typeof t.primary=="boolean"&&(s.primary=t.primary))})}function Ds(e){return j(t=>{t.contacts=t.contacts.filter(n=>n.id!==e)})}function Ls(e){return j(t=>{Object.assign(t.card,e,{updated:g()})})}function ft(e){return j(t=>{for(let n of Object.keys(t.profile))typeof e[n]=="string"&&(t.profile[n]=S(e[n],200).trim())})}function se(e){return j(t=>Object.assign(t.settings,e))}function yt(){return JSON.stringify(C,null,2)}function en(e){return!!e&&typeof e=="object"&&Array.isArray(e.meds)&&Array.isArray(e.seizures)&&!!e.doses&&typeof e.doses=="object"}async function gt(e){let t;try{t=JSON.parse(e)}catch{throw new Error("not-json")}if(!en(t))throw new Error("not-synara");if(!Be)throw new Error("not-ready");return Gt(pt(t))}var b={shell:document.querySelector(".app-shell"),backdrop:document.getElementById("backdrop"),sheet:document.getElementById("sheet"),emergency:document.getElementById("emergency"),welcome:document.getElementById("welcome"),toast:document.getElementById("toast")},js={home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.8V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.8"/>',pill:'<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M8.8 8.8l6.4 6.4"/>',chart:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 15l3.5-4 3 2.5L18 8"/>',shield:'<path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.4-7.5 9.5-4.4-1.1-7.5-4.9-7.5-9.5V6z"/><path d="M12 9v4"/><path d="M12 16h.01"/>',sync:'<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',ribbon:'<path d="M12 13.5c-2.6-3-4-5.4-4-7.2a4 4 0 0 1 8 0c0 1.8-1.4 4.2-4 7.2Z"/><path d="M12 13.5 7.5 21l-2-1.2 4.4-7.3"/><path d="M12 13.5l4.5 7.5 2-1.2-4.4-7.3"/>',user:'<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',chevron:'<path d="m9 6 6 6-6 6"/>',phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',trash:'<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-.8 14a1 1 0 0 1-1 1H6.8a1 1 0 0 1-1-1L5 6"/>',print:'<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',wave:'<path d="M2 12c2.5-3 4.5-3 7 0s4.5 3 7 0 4.5-3 6 0"/><path d="M2 17c2.5-3 4.5-3 7 0s4.5 3 7 0 4.5-3 6 0" opacity=".5"/>',bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',pin:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',"trend-up":'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',"trend-down":'<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',down:'<path d="M12 4v12"/><path d="m6 10 6 6 6-6"/><path d="M4 20h16"/>',up:'<path d="M12 20V8"/><path d="m6 14 6-6 6 6"/><path d="M4 4h16"/>',check:'<path d="M20 6 9 17l-5-5"/>',note:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5"/><path d="M10 2h4"/><path d="M12 2v3"/>',book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',school:'<path d="M3 10 12 5l9 5-9 5z"/><path d="M7 12v5c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5v-5"/><path d="M21 10v6"/>',stethoscope:'<path d="M5 3v6a5 5 0 0 0 10 0V3"/><path d="M10 14v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',run:'<circle cx="14" cy="4" r="2"/><path d="m8 21 3-6 3 2v5"/><path d="M6 12l3-3 4 1 3 3 3 1"/><path d="m11 15-2-4"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',sparkle:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6.3 6.3 2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',play:'<path d="M7 4v16l13-8z"/>',archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>'};function c(e,t=24){let n=js[e]||js.info;return`<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${n}</svg>`}var bo=["action","id","med","time","day","tab","to","field","value","theme"];function nn(e){return!e||!e.dataset||!e.dataset.action?null:bo.filter(t=>e.dataset[t]!=null).map(t=>`[data-${t}="${CSS.escape(e.dataset[t])}"]`).join("")}function sn(e,t=document){if(!e)return!1;let n=t.querySelector(e);return n?(n.focus({preventScroll:!0}),!0):!1}var wt=new Set;function Ps(e){b.shell&&(e?b.shell.setAttribute("inert",""):b.shell.removeAttribute("inert"))}function an(e){wt.add(e),Ps(!0)}function on(e){wt.delete(e),wt.size||Ps(!1)}function rn(e){e.hidden=!1,e.offsetHeight,e.dataset.open="true"}function $t(e,t=300){return delete e.dataset.open,new Promise(n=>{setTimeout(()=>{e.dataset.open!=="true"&&(e.hidden=!0,e.innerHTML=""),n()},t)})}var ae=!1,tn=null,Se=null,bt=null;function N({title:e,body:t,footer:n="",onMount:s,onClose:a}){ae||(Se=document.activeElement,tn=nn(Se)),bt=a||null,b.sheet.innerHTML=p`
    <div class="sheet-grip" aria-hidden="true"></div>
    <div class="sheet-head">
      <h2 id="sheet-title">${e}</h2>
      <button class="icon-btn" data-action="close-sheet" aria-label="Close">
        ${o(c("x"))}
      </button>
    </div>
    <div class="sheet-body">${o(t)}</div>
    ${o(n?`<div class="sheet-foot">${n}</div>`:"")}
  `,b.backdrop.hidden=!1,b.backdrop.offsetHeight,b.backdrop.dataset.open="true",rn(b.sheet),ae=!0,an("sheet"),(b.sheet.querySelector('.sheet-body input:not([type="hidden"]), .sheet-body textarea, .sheet-body select, .sheet-body button, .sheet-foot button')||b.sheet.querySelector('[data-action="close-sheet"]')).focus({preventScroll:!0}),s&&s(b.sheet)}function E(){if(!ae)return Promise.resolve();ae=!1;let e=$t(b.sheet);if($t(b.backdrop).then(()=>{b.backdrop.hidden=!0}),on("sheet"),Se&&Se.isConnected?Se.focus({preventScroll:!0}):sn(tn),Se=null,tn=null,bt){let t=bt;bt=null,t()}return e}function cn(){return ae}function W(){return b.sheet}function Y(){let e={};return b.sheet.querySelectorAll("[name]").forEach(t=>{t.type==="checkbox"?e[t.name]=t.checked:e[t.name]=t.value}),e}async function H({title:e,message:t,confirmLabel:n="Delete",danger:s=!0,onConfirm:a}){ae&&await E(),N({title:e,body:p`<p class="sheet-message">${t}</p>`,footer:`
      <button class="btn btn-quiet" data-action="close-sheet">Cancel</button>
      <button class="btn ${s?"btn-danger":"btn-primary"}" data-sheet-confirm>${n}</button>
    `,onMount(r){r.querySelector("[data-sheet-confirm]").addEventListener("click",async()=>{await E(),a()})}})}var Is=null;function m(e,t="default"){clearTimeout(Is);let n=t==="ok"?"\u2713 ":t==="bad"?"! ":"";b.toast.textContent=n+e,b.toast.dataset.tone=t,b.toast.dataset.open="true",Is=setTimeout(()=>{delete b.toast.dataset.open},2800)}var xe=!1,vt=null,Ke=null;async function Rs(){try{"wakeLock"in navigator&&(Ke=await navigator.wakeLock.request("screen"))}catch{Ke=null}}function vo(){try{Ke&&Ke.release()}catch{}Ke=null}document.addEventListener("visibilitychange",()=>{xe&&document.visibilityState==="visible"&&Rs()});function Hs(e,{onClose:t,onMount:n}={}){ae&&E(),vt=t||null,b.emergency.innerHTML=e,rn(b.emergency),xe=!0,an("emergency");let s=b.emergency.querySelector("[data-autofocus]")||b.emergency.querySelector("button, a");s&&s.focus({preventScroll:!0}),Rs(),n&&n(b.emergency)}function Me(){if(xe&&(xe=!1,$t(b.emergency,220),on("emergency"),vo(),vt)){let e=vt;vt=null,e()}}function Ve(){return xe}function oe(){return b.emergency}function qs(e){b.welcome.innerHTML=e,rn(b.welcome),an("welcome");let t=b.welcome.querySelector("button");t&&t.focus({preventScroll:!0})}function Je(){$t(b.welcome,250),on("welcome")}function Fs(e){b.welcome.innerHTML=e,b.welcome.scrollTop=0;let t=b.welcome.querySelector("[data-intro-focus]")||b.welcome.querySelector("button");t&&t.focus({preventScroll:!0})}function Bs(){return wt.has("welcome")}function kt(){return'<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 18h5l3-8 5 14 3.5-9H28" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'}var wo="https://fluxplanner.github.io/Flux/landing.html";function Te(e=""){let t=document.documentElement.dataset.host==="flux"?"public/synara/icons/flux-logo.png":"icons/flux-logo.png";return`<a class="powered-by ${e}" href="${wo}" target="_blank" rel="noopener"><span class="powered-by-t">Powered by</span><img class="powered-by-logo" src="${t}" alt="" width="18" height="18" /><span class="powered-by-name">Flux</span></a>`}b.backdrop.addEventListener("click",()=>{E()});document.addEventListener("keydown",e=>{e.key==="Escape"&&(ae?E():xe&&Me())});var Ws=typeof document<"u"&&document.documentElement.dataset.host==="flux"?"public/synara/icons/icon-192.png":"icons/icon-192.png";function ze(){if(!("Notification"in window))return{ok:!1,reason:"This browser does not support notifications."};if(location.protocol==="file:")return{ok:!1,reason:"Notifications need the app served over https."};let e=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===!0;return/iPad|iPhone|iPod/.test(navigator.userAgent)&&!e?{ok:!1,reason:"On iPhone, add Synara to your home screen first \u2014 Safari only allows notifications for installed apps."}:/Android/i.test(navigator.userAgent)&&!("serviceWorker"in navigator)?{ok:!1,reason:"This browser can\u2019t show reminders on Android. Open Synara in Chrome, or keep a phone alarm."}:{ok:!0,reason:""}}function re(){return"Notification"in window?Notification.permission:"unsupported"}async function Ys(){if(!("Notification"in window))return"unsupported";try{return await Notification.requestPermission()}catch{return"denied"}}var St=[];function $o(){St.forEach(clearTimeout),St=[]}function ko(e,t){let n=e.quietHours;if(!n)return!1;let s=t.getHours()*60+t.getMinutes(),a=V(n.from),r=V(n.to);return a>r?s>=a||s<r:s>=a&&s<r}var ln=!1;function _s(){return ln}async function Ks(e,t,n=""){if(re()!=="granted")return!1;let s={icon:Ws,badge:Ws,...t,data:{url:location.href.split("#")[0]+n}};try{let a="serviceWorker"in navigator?await navigator.serviceWorker.getRegistration():null;if(a&&a.active)return await a.showNotification(e,s),!0}catch(a){console.warn("[synara] the service worker could not show a notification:",a)}try{let a=new Notification(e,s);return a.onclick=()=>{window.focus(),n&&(location.hash=n),a.close()},!0}catch(a){return console.warn("[synara] could not show notification:",a),!1}}async function So(e,t,n){let s=O();s.settings.remindersOn&&(ko(s.settings,new Date)||R(e,t.id,n,s)==="pending"&&(ln=!await Ks("Time for your medication",{body:`${[t.name,t.dose].filter(Boolean).join(" ")} \u2014 ${P(n)}`,tag:`synara-${t.id}-${n}`},"#/meds")))}function Ee(){$o();let e=O(),{remindersOn:t,reminderLead:n}=e.settings;if(!t||re()!=="granted")return 0;let s=new Date,a=g(s),r=M(a,1),i=0;for(let l of[a,r])for(let{med:h,time:u}of D(l,e)){if(R(l,h.id,u,e)!=="pending")continue;let y=F(`${l}T${u}`);y.setMinutes(y.getMinutes()-(n||0)),!(y<=s)&&(St.push(setTimeout(()=>So(l,h,u),y-s)),i++)}return St.push(setTimeout(Ee,F(`${r}T00:00`)-s+5e3)),i}function Vs(){Ee(),te(Ee),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&Ee()})}async function Js(){if(re()!=="granted")return"not-allowed";let e=await Ks("Synara reminders are on",{body:"This is what a dose reminder will look like.",tag:"synara-test"});return ln=!e,e?"sent":"failed"}var un="synara.flux";function pn(){return typeof document<"u"&&document.documentElement.dataset.host==="flux"}function xo(e){return{v:1,meds:e.meds.map(t=>({name:t.name,dose:t.dose,color:t.color,added:t.added,ended:t.ended,schedule:t.schedule.map(n=>({from:n.from,times:n.times.slice()}))}))}}function Us(e){if(pn())try{if(!e.settings.fluxLink){localStorage.removeItem(un);return}let t=JSON.stringify(xo(e));localStorage.getItem(un)!==t&&localStorage.setItem(un,t)}catch{}}var ea="synara.sync",hn="0123456789ABCDEFGHJKMNPQRSTVWXYZ",Mo=3e3;function ta(e){let t=0,n=0,s="";for(let a of e)for(n=(n<<8|a)&65535,t+=8;t>=5;)s+=hn[n>>>t-5&31],t-=5;return t>0&&(s+=hn[n<<5-t&31]),s}function Mt(e){let t=String(e||"").toUpperCase().replace(/[^0-9A-Z]/g,"").replace(/O/g,"0").replace(/[IL]/g,"1");if(t.length!==26)return null;let n=0,s=0,a=[];for(let r of t){let i=hn.indexOf(r);if(i<0)return null;s=(s<<5|i)&65535,n+=5,n>=8&&(a.push(s>>>n-8&255),n-=8)}return a.length!==16||(s&(1<<n)-1)!==0?null:new Uint8Array(a)}function To(e){return e.match(/.{1,4}/g).join("-")}var na=["remindersOn","fluxLink"];function Eo(e){let t=JSON.parse(e);if(t.settings)for(let n of na)delete t.settings[n];return JSON.stringify(t)}function zo(e,t){let n=JSON.parse(e);n.settings={...n.settings||{}};for(let s of na)n.settings[s]=t.settings[s];return JSON.stringify(n)}function Co(e,t,n){if(!t)return n.remoteAt?"gone":"push";let s=e!==n.hash,a=t.updated_at!==n.remoteAt;return s&&a?"conflict":a?"pull":s?"push":"none"}var Gs=e=>{let t="";for(let n=0;n<e.length;n+=32768)t+=String.fromCharCode(...e.subarray(n,n+32768));return btoa(t)},Qs=e=>Uint8Array.from(atob(e),t=>t.charCodeAt(0));async function sa(e){return crypto.subtle.importKey("raw",e,"AES-GCM",!1,["encrypt","decrypt"])}async function Ao(e,t){let n=crypto.getRandomValues(new Uint8Array(12)),s=new TextEncoder().encode(e),a=await crypto.subtle.encrypt({name:"AES-GCM",iv:n},await sa(t),s);return{ciphertext:Gs(new Uint8Array(a)),iv:Gs(n)}}async function aa(e,t){try{let n=await crypto.subtle.decrypt({name:"AES-GCM",iv:Qs(e.iv)},await sa(t),Qs(e.ciphertext));return new TextDecoder().decode(n)}catch{throw Object.assign(new Error("wrong-key"),{code:"wrong-key"})}}async function yn(e){let t=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(e));return Array.from(new Uint8Array(t),n=>n.toString(16).padStart(2,"0")).join("")}var Xe={phase:"off",error:"",account:null},mn=new Set,fn=null,Ue=null,Zs=!1;function q(e){Xe={...Xe,...e};for(let t of mn)t(Xe)}function oa(e){return mn.add(e),()=>mn.delete(e)}function Tt(){return Xe}function Ae(){try{return JSON.parse(localStorage.getItem(ea)||"null")||{}}catch{return{}}}function Ge(e){try{localStorage.setItem(ea,JSON.stringify(e))}catch{}}function Z(){return!!Ae().key}function ra(){return Ae().at||""}function gn(){let e=Ae().key;return e?To(e):""}function ia(){return typeof document<"u"&&document.documentElement.dataset.host==="flux"}function he(){return window.FluxSynaraVault||null}function Et(){return he()||document.readyState!=="loading"?Promise.resolve(he()):new Promise(e=>document.addEventListener("DOMContentLoaded",()=>e(he()),{once:!0}))}function Oe(e){if(!e)throw Object.assign(new Error("not-ready"),{code:"not-ready"});return e}async function ca(){let e=await Et();if(!e)return null;try{return await e.account()}catch{return null}}async function xt(){return q({account:await ca()}),Xe.account}function la(e){return e&&(e.code||e.message)||"failed"}var bn=()=>Eo(yt());async function vn(e,t){let n=bn(),s=await Ao(n,t),a=await Oe(he()).put(s);Ge({...e,hash:await yn(n),remoteAt:a.updated_at,at:new Date().toISOString()})}async function wn(e,t,n){let s=await aa(n,t);Ge({...e,remoteAt:n.updated_at}),await gt(zo(s,O())),Ge({...Ae(),hash:await yn(bn()),at:new Date().toISOString()})}function Ce(){return Ue||(Ue=(async()=>{let e=Ae();if(!e.key||!ia())return q({phase:"off"}),"off";let t=await Et();if(!t)return q({phase:"error",error:"not-ready"}),"error";q({phase:"syncing",error:""});try{let n=Mt(e.key),s=await t.get(),a=Co(await yn(bn()),s,e);if(a==="push")await vn(e,n);else if(a==="pull")await wn(e,n,s);else{if(a==="gone")return Ge({}),q({phase:"off",error:"gone"}),a;if(a==="conflict")return q({phase:"conflict"}),a}return q({phase:"idle",error:""}),a}catch(n){return q({phase:"error",error:la(n)}),"error"}})().finally(()=>{Ue=null}),Ue)}async function da(e){let t=Ae(),n=Mt(t.key);q({phase:"syncing",error:""});try{e==="cloud"?await wn(t,n,await Oe(he()).get()):await vn(t,n),q({phase:"idle"})}catch(s){throw q({phase:"error",error:la(s)}),s}}async function $n(){let e=Oe(await Et());if(!await ca())throw Object.assign(new Error("signed-out"),{code:"signed-out"});if(await e.get())throw Object.assign(new Error("has-copy"),{code:"has-copy"});let t=crypto.getRandomValues(new Uint8Array(16));await vn({key:ta(t)},t),q({phase:"idle",error:""})}async function ua(e){let t=Mt(e);if(!t)throw Object.assign(new Error("bad-key"),{code:"bad-key"});let n=await Oe(await Et()).get();if(!n)throw Object.assign(new Error("no-copy"),{code:"no-copy"});let s=JSON.parse(await aa(n,t));return{key:ta(t),updatedAt:n.updated_at,meds:Array.isArray(s.meds)?s.meds.length:0,seizures:Array.isArray(s.seizures)?s.seizures.length:0,name:s.profile&&typeof s.profile.name=="string"?s.profile.name:""}}async function pa(e){let t=Mt(e);await wn({key:e},t,await Oe(he()).get()),q({phase:"idle",error:""})}async function Ne({deleteCopy:e=!1}={}){e&&await Oe(he()).remove(),Ge({}),clearTimeout(fn),q({phase:"off",error:""})}async function ha(){!ia()||Zs||(Zs=!0,te(()=>{Z()&&(clearTimeout(fn),fn=setTimeout(Ce,Mo))}),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&(xt(),Z()&&Ce())}),window.addEventListener("online",()=>{Z()&&Ce()}),await xt(),Z()&&Ce())}var Cn={};be(Cn,{actions:()=>Yo,setupCard:()=>zn,setupList:()=>En,show:()=>Dt});var Oo=[4,12,25,26,41],No=[2,6,9,17,22,31],kn=45,Do=21,Lo=30,jo={3:5,4:6,11:5.5,12:6,24:4.5,25:5.5,38:6},fa={3:5,4:4,10:4,11:5,23:4,24:5,37:4,38:4},Io=e=>Math.round(e*10)/10;function zt(e){let t=g();e.profile={name:"Maya Ellison",pronouns:"she/her",grade:"11th grade",school:"Rosewood High School",seizureType:"Focal impaired awareness, occasional tonic-clonic",diagnosed:"2022",neurologist:"Dr. Priya Raghavan",neuroPhone:"(555) 010-4488",allergies:"Penicillin",bloodType:"O+",rescueMed:""};let n=M(t,-kn),s=M(t,-Do),a=M(t,-Lo),r={id:L("med"),name:"Levetiracetam",dose:"500 mg",form:"tablet",notes:"Take with food. Evening dose moved to 8pm so it is done before homework.",color:"violet",added:n,ended:null,schedule:[{from:n,times:["08:00","21:00"]},{from:s,times:["08:00","20:00"]}]},i={id:L("med"),name:"Lamotrigine",dose:"100 mg",form:"tablet",notes:"Never stop suddenly \u2014 taper only with Dr. Raghavan.",color:"mint",added:n,ended:null,schedule:[{from:n,times:["08:00"]}]},l={id:L("med"),name:"Topiramate",dose:"25 mg",form:"tablet",notes:"Stopped with Dr. Raghavan \u2014 made it hard to concentrate in class.",color:"amber",added:n,ended:a,schedule:[{from:n,times:["21:00"]}]};e.meds=[r,i,l],e.doses={};for(let u=kn;u>=1;u--){let y=M(t,-u),f={},w=Oo.includes(u),A=No.includes(u),$=y<s?"21:00":"20:00";f[`${r.id}|08:00`]={status:A?"late":"taken",at:`${y}T08:12`},f[`${i.id}|08:00`]={status:A?"late":"taken",at:`${y}T08:12`},w?f[`${r.id}|${$}`]={status:"missed",at:`${y}T23:50`}:A?f[`${r.id}|${$}`]={status:"late",at:`${y}T22:40`}:f[`${r.id}|${$}`]={status:"taken",at:`${y}T${$==="21:00"?"21:04":"20:05"}`},y<a&&(f[`${l.id}|21:00`]={status:"taken",at:`${y}T21:06`}),e.doses[y]=f}e.checkins={};for(let u=kn;u>=0;u--){let y=M(t,-u),f=jo[u],w=f??Io(7.4+u*37%11/10),A=fa[u]!=null?fa[u]:1+u*17%3;e.checkins[y]={sleepHours:w,sleepQuality:w<6?"poor":w<7?"ok":"good",stress:A,mood:A>=4?"low":"ok",notes:"",at:`${y}T07:30`}}let h=[{back:3,time:"15:40",duration:95,type:"Focal impaired awareness",trigger:"Missed sleep",place:"School \u2014 classroom",aura:'Metallic taste, felt "far away" for about a minute',injury:!1,emsCalled:!1,notes:"Ms. Okafor followed the card. Sat with me until I came back. Missed the bus home."},{back:11,time:"21:10",duration:130,type:"Tonic-clonic",trigger:"Missed dose",place:"Home \u2014 bedroom",aura:"None that I remember",injury:!0,emsCalled:!1,notes:"Bit the inside of my cheek. Mom timed it at just over two minutes."},{back:24,time:"07:55",duration:60,type:"Focal aware",trigger:"Missed sleep",place:"Home \u2014 kitchen",aura:"Stomach-dropping feeling",injury:!1,emsCalled:!1,notes:"Stayed home first period. Was fine by lunch."},{back:38,time:"14:20",duration:150,type:"Tonic-clonic",trigger:"Flashing lights",place:"School \u2014 gym",aura:"Visual static",injury:!1,emsCalled:!0,notes:"Assembly with strobe lighting. Nurse called EMS because it went past two minutes. Did not go to hospital."}];return e.seizures=h.map(u=>({id:L("sz"),at:`${M(t,-u.back)}T${u.time}`,duration:u.duration,type:u.type,trigger:u.trigger,place:u.place,aura:u.aura,injury:u.injury,emsCalled:u.emsCalled,notes:u.notes,logged:`${M(t,-u.back)}T${u.time}`})),e.seizures.sort((u,y)=>u.at<y.at?1:-1),e.contacts=[{id:L("c"),name:"Dana Ellison",relation:"Mom",phone:"(555) 014-2007",primary:!0},{id:L("c"),name:"Marcus Ellison",relation:"Dad",phone:"(555) 014-2019",primary:!1},{id:L("c"),name:"Dr. Priya Raghavan",relation:"Neurologist",phone:"(555) 010-4488",primary:!1},{id:L("c"),name:"Nurse Ruiz",relation:"School nurse",phone:"(555) 018-8300",primary:!1},{id:L("c"),name:"Aunt Jo",relation:"Emergency pickup",phone:"(555) 016-3520",primary:!1}],e.card={looksLike:"Maya usually goes quiet and stops responding. She may stare, blink repeatedly, or pick at her clothes. She sometimes says food tastes metallic right before. Most last under two minutes. Afterwards she is confused and very tired for 20\u201330 minutes and may not remember what happened.",during:["Stay with her and start timing immediately.","If she is stiffening or shaking, gently help her down to the floor.","Move chairs, desks, and anything hard or sharp out of the way.","If she is on the floor, put something soft under her head.","Loosen anything tight around her neck.","If she is not aware or not awake, gently turn her onto her side.","If she is confused or wandering, stay beside her and gently guide her away from danger, like stairs or the road. Don't grab or hold her.","Stay calm and speak normally \u2014 she may be able to hear you."],doNot:["Do NOT put anything in her mouth. She cannot swallow her tongue.","Do NOT hold her down or try to stop the movements.","Do NOT give food, drink, or pills until she is fully awake.","Do NOT crowd her \u2014 ask other students to step back."],after:["Stay with her until she is fully alert and knows where she is.","Tell her calmly what happened \u2014 she will not remember.","Let her rest somewhere quiet. The nurse's office is best.","Call her mom, Dana, at (555) 014-2007.","Write down the time it started and how long it lasted."],callEms:["The seizure lasts longer than 5 minutes.","A second seizure starts soon after the first.","She does not wake up or return to normal afterwards.","She is having trouble breathing, or her lips stay blue.","She was injured, or it happened in water.","It looks different from her usual seizures.","She has diabetes or a heart condition, or is pregnant."],forTeacher:"Do not send her to the office alone afterwards \u2014 she will be confused and may not make it there. Send another student to get Nurse Ruiz instead. She is allowed to make up any assessment missed; this is in her 504 plan.",forNurse:`No rescue medication is prescribed at school. Standard first aid only. If any "Call 911" sign applies, call 911 first, then Dana Ellison. Otherwise call Dana Ellison; Dr. Raghavan's office can advise afterwards. Maya prefers to rest in the dark side room rather than the main bay.`,forCoach:"Cleared for all sports except swimming without a spotter on deck. No climbing above head height. If she has a seizure at practice she is done for the day \u2014 no returning to play, even if she says she feels fine.",updated:M(t,-6)},e.settings={theme:"system",remindersOn:!1,reminderLead:0,quietHours:null,seeded:!0},e}function Po(e,{reminders:t=!0}={}){let{profile:n,settings:s,card:a,contacts:r}=e,i=[{id:"details",icon:"user",title:"Your details",todo:"School, grade, neurologist and allergies",done:!!(n.name.trim()&&n.school.trim()),action:"profile-edit"},{id:"meds",icon:"pill",title:"Your medication",todo:"Each one, with the times you take it",done:s.noMeds||B(e).length>0,action:"med-open"},{id:"looksLike",icon:"note",title:"What your seizures look like",todo:"So someone watching knows what\u2019s happening",done:!!a.looksLike.trim(),action:"card-edit",data:{field:"looksLike"}},{id:"contacts",icon:"phone",title:"Emergency contacts",todo:"Who to call, and their number",done:r.length>0,action:"contact-open"}];return t&&!s.noMeds&&i.push({id:"reminders",icon:"bell",title:"Dose reminders",todo:"A nudge at each dose time",done:s.remindersOn,action:"nav",data:{to:"you"}}),i}function De(e,t){let n=Po(e,t),s=n.filter(a=>a.done).length;return{items:n,done:s,total:n.length,complete:s===n.length}}function ya(e,t){return!e.settings.setupHidden&&!e.settings.seeded&&!De(e,t).complete}var Ro=[["Tonic-clonic","Stiffening, then jerking; not aware during it"],["Absence","Brief blank stares, usually a few seconds"],["Focal aware","Awake and aware, with odd feelings or movements"],["Focal impaired awareness","Not fully aware; may stare, fumble or wander"],["Myoclonic","Sudden, quick jerks"],["Atonic","Sudden loss of muscle tone; may drop or fall"]],Qe="Not sure yet",Tn=[{text:"Purple Day was started in 2008 by Cassidy Megan, a 9-year-old in Nova Scotia, Canada, who wanted kids with epilepsy to know they aren\u2019t alone. Now people around the world mark it every March 26.",source:"Purple Day"},{text:"With the right treatment, up to 70% of people with epilepsy can live without seizures.",source:"World Health Organization"},{text:"About 50 million people around the world have epilepsy. It\u2019s one of the most common conditions of the brain.",source:"World Health Organization"},{text:"In the US, about 1 in 26 people will develop epilepsy at some point in their life.",source:"Epilepsy Foundation"},{text:"Epilepsy is one of the oldest known conditions. Written records of it go back thousands of years.",source:"World Health Organization"},{text:"Purple is the color of epilepsy awareness. It comes from lavender, a flower linked with solitude: a reminder that no one with epilepsy should feel alone.",source:"Purple Day"},{text:"Seizure first aid fits in three words: Stay, Safe, Side. Stay with them, keep them safe, and turn them on their side if they aren\u2019t awake.",source:"Epilepsy Foundation"}],xn=4,ee=0,x=ga(),Mn=!1,At=0;function ga(){return{name:"",types:[],diagnosed:"",meds:"yes",error:""}}function Ot(){return ze().ok&&re()!=="denied"}function En(e){let{items:t}=De(e,{reminders:Ot()});return t.map(n=>{let s=Object.entries(n.data||{}).map(([a,r])=>` data-${a}="${d(r)}"`).join("");return`
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
      </li>`}).join("")}function zn(e){let t={reminders:Ot()};if(!ya(e,t))return"";let{done:n,total:s}=De(e,t);return p`
    <section class="card setup-card" aria-labelledby="setup-h">
      <div class="setup-head">
        <div class="grow">
          <span class="eyebrow">Finish setting up</span>
          <h2 class="setup-h" id="setup-h">${n} of ${s} sections done</h2>
        </div>
        <button class="icon-btn" data-action="setup-hide" aria-label="Hide this list">${o(c("x"))}</button>
      </div>
      <progress class="setup-bar" max="${s}" value="${n}" aria-label="Setup progress"></progress>
      <ul class="setup-list">${o(En(e))}</ul>
    </section>
  `}function Nt(){return`<div class="intro-dots" aria-hidden="true">${Array.from({length:xn},(t,n)=>`<span class="intro-dot" data-state="${n<ee?"done":n===ee?"on":"next"}"></span>`).join("")}</div>
          <span class="sr-only">Step ${ee+1} of ${xn}</span>`}function Ho(){return p`
    <div class="welcome-inner intro-step">
      ${o(Nt())}
      <div class="brand-mark welcome-mark">${o(kt())}</div>
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

      ${o(Te("welcome-powered"))}
    </div>
  `}function qo(){let e=[...Ro,[Qe,"That\u2019s fine \u2014 you can add it later"]].map(([n,s])=>{let a=x.types.includes(n);return`
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
      ${o(Nt())}
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
  `}function Fo(){let e=Tn[At],t=x.name.trim().split(" ")[0];return p`
    <div class="intro intro-step">
      ${o(Nt())}
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
  `}function Bo(){let e=O(),{done:t,total:n}=De(e,{reminders:Ot()});return p`
    <div class="intro intro-step">
      ${o(Nt())}
      <span class="intro-ico" aria-hidden="true">${o(c("shield",26))}</span>
      <h1 class="intro-h" tabindex="-1" data-intro-focus>Now, fill in your sections</h1>
      <p class="intro-sub">These are what make your safety card useful when someone needs it.
        Tap one to start. This list stays on Home until it’s done.</p>
      <p class="t-sm ink-3 intro-count">${t} of ${n} done</p>

      <ul class="setup-list intro-sections">${o(En(e))}</ul>

      <div class="intro-actions">
        <button class="btn btn-primary btn-lg btn-block" data-action="intro-finish">Go to Synara</button>
        <button class="btn btn-quiet btn-block" type="button" data-action="intro-back">Back</button>
      </div>
    </div>
  `}var ba=[Ho,qo,Fo,Bo];function Ct(e){ee=Math.max(0,Math.min(xn-1,e)),Fs(ba[ee]())}function Dt(){ee=0,x=ga(),Mn=!1,At=Math.floor(Math.random()*Tn.length),qs(ba[0]())}function Sn(){let e=document.querySelector("#welcome form.intro");e&&(x.name=e.elements.name.value.trim(),x.diagnosed=e.elements.diagnosed.value.trim())}function Wo(e){if(!e)return"";let t=Number(e),n=new Date().getFullYear();return/^\d{4}$/.test(e)&&t>=1900&&t<=n?"":`Enter a year like ${n-2}, or leave it blank.`}var Yo={"intro-next"(){Sn(),Ct(ee+1)},"intro-back"(){Sn(),Ct(ee-1)},"intro-type"(e){let t=e.dataset.value,n=x.types.includes(t);t===Qe?x.types=n?[]:[Qe]:(x.types=x.types.filter(s=>s!==Qe&&s!==t),n||x.types.push(t)),e.closest(".intro-choices").querySelectorAll(".intro-choice").forEach(s=>{s.setAttribute("aria-pressed",String(x.types.includes(s.dataset.value)))})},"intro-meds"(e){x.meds=e.dataset.value,e.parentElement.querySelectorAll(".segment").forEach(t=>{t.setAttribute("aria-pressed",String(t===e))})},async"intro-answers"(){if(Sn(),x.error=Wo(x.diagnosed),x.error){let e=document.getElementById("intro-year-error");e&&(e.textContent=x.error),document.getElementById("intro-diagnosed")?.focus();return}Mn||(await We(),Mn=!0),await ft({name:x.name,seizureType:x.types.filter(e=>e!==Qe).join(", "),diagnosed:x.diagnosed}),await se({noMeds:x.meds==="no"}),Ct(2)},"intro-fact"(){At=(At+1)%Tn.length,Ct(ee)},"intro-finish"(){Je();let{complete:e}=De(O(),{reminders:Ot()});m(e?"You\u2019re all set":"Your sections are on Home whenever you\u2019re ready","ok")},async"welcome-demo"(){await We({seedFn:zt}),Je(),m("Loaded example data \u2014 clear it any time in You","ok")},async"setup-hide"(){await se({setupHidden:!0}),m("Hidden. Everything on it is in You and Safety.","ok")}};var Ln={};be(Ln,{actions:()=>fr,render:()=>or,subtitle:()=>tr,title:()=>er});var va="These are associations in your own log, not medical conclusions. Patterns can appear by chance, especially with few entries. Bring them to your neurologist rather than acting on them alone.",me=3,Ze=e=>e.reduce((t,n)=>t+n,0)/e.length,fe=e=>e.at.split("T")[0];function On(e,t,n=0){let s=g(),a=0,r=0;for(let i=n+1;i<=t;i++){let l=M(s,-i);for(let{med:h,time:u}of D(l,e))r++,pe(l,h.id,u,e)==="taken"&&a++}return{good:a,total:r}}function _o(e){let t=g(),n=0;for(let s=1;s<=365;s++){let a=M(t,-s),r=D(a,e);if(!r.length||!r.every(({med:l,time:h})=>pe(a,l.id,h,e)==="taken"))break;n++}return n}function Nn(e){let t=e.seizures||[];return t.length<2?[]:[Ko(e,t),Vo(e,t),Jo(e,t),Uo(t),Xo(t),Go(t),Qo(e),Zo(t)].filter(Boolean).sort((n,s)=>s.strength-n.strength)}function wa(e){return Nn(e)[0]||null}function Ko(e,t){if(t.length<me||!e.meds.length)return null;let n=0,s=0;for(let r of t){let i=fe(r),l=!1,h=!1;for(let u of[0,-1,-2]){let y=M(i,u);for(let{med:f,time:w}of D(y,e)){l=!0;let A=pe(y,f.id,w,e);if(A==="missed"||A==="late"){h=!0;break}}if(h)break}l&&s++,h&&n++}if(s<me||n<2)return null;let a=Math.round(n/s*100);return a<60?null:{id:"dose-proximity",tone:"alert",icon:"pill",title:`${n} of your ${s} seizures followed a missed or late dose`,detail:`Within 48 hours before each of those ${T(n,"seizure")}, at least one scheduled dose was marked missed or late. This is the pattern most worth mentioning at your next appointment.`,evidence:`${n}/${s} seizures \xB7 ${a}%`,strength:100+a}}function $a(e,t,n){let s=new Set(t.map(fe)),a=[],r=[];for(let[i,l]of Object.entries(e.checkins||{}))typeof l[n]=="number"&&(s.has(i)?a:r).push(l[n]);return{onSeizureDays:a,onOtherDays:r}}function Vo(e,t){let{onSeizureDays:n,onOtherDays:s}=$a(e,t,"sleepHours");if(n.length<me||s.length<10)return null;let a=Ze(n),r=Ze(s),i=r-a;return i<.75?null:{id:"sleep",tone:"alert",icon:"moon",title:`You slept ${i.toFixed(1)} hours less before seizure days`,detail:`The nights before a seizure averaged ${a.toFixed(1)} hours, against ${r.toFixed(1)} on every other night. Short sleep is one of the most commonly reported seizure triggers.`,evidence:`${n.length} seizure nights vs ${s.length} others`,strength:90+Math.min(20,i*10)}}function Jo(e,t){let{onSeizureDays:n,onOtherDays:s}=$a(e,t,"stress");if(n.length<me||s.length<10)return null;let a=Ze(n),r=Ze(s),i=a-r;return i<.8?null:{id:"stress",tone:"watch",icon:"wave",title:"Seizure days were higher-stress days",detail:`You rated stress ${a.toFixed(1)} out of 5 on seizure days, against ${r.toFixed(1)} otherwise. Stress rarely acts alone \u2014 it tends to travel with the things that do, like less sleep, skipped meals, and broken routine.`,evidence:`${n.length} seizure days vs ${s.length} others`,strength:70+i*10}}function Uo(e){if(e.length<me)return null;let t=Wt(e.map(a=>a.trigger).filter(a=>a&&a!=="None known"));if(!t.length||t[0].count<2)return null;let n=t[0],s=Math.round(n.count/e.length*100);return{id:"trigger",tone:"watch",icon:"bolt",title:`"${n.value}" is your most logged trigger`,detail:`You recorded it for ${T(n.count,"seizure")} out of ${e.length}. `+(t.length>1?`Next most common: ${t.slice(1,3).map(a=>`${a.value} (${a.count})`).join(", ")}.`:"It is the only trigger you have logged so far."),evidence:`${n.count}/${e.length} seizures \xB7 ${s}%`,strength:60+s/2}}var An=[{from:0,to:4,label:"late at night (12am\u20134am)"},{from:4,to:8,label:"early in the morning (4am\u20138am)"},{from:8,to:12,label:"in the morning (8am\u201312pm)"},{from:12,to:16,label:"in the early afternoon (12pm\u20134pm)"},{from:16,to:20,label:"in the late afternoon (4pm\u20138pm)"},{from:20,to:24,label:"in the evening (8pm\u201312am)"}];function Xo(e){if(e.length<me)return null;let t=new Array(An.length).fill(0);for(let a of e){let r=F(a.at).getHours();t[An.findIndex(i=>r>=i.from&&r<i.to)]++}let n=0;for(let a=1;a<t.length;a++)t[a]>t[n]&&(n=a);if(t[n]<2)return null;let s=Math.round(t[n]/e.length*100);return s<50?null:{id:"time-of-day",tone:"neutral",icon:"clock",title:`Most of your seizures happen ${An[n].label}`,detail:`${t[n]} of ${e.length} fell in that window. If it holds up, it is worth asking whether your dose timing lines up with it.`,evidence:`${t[n]}/${e.length} seizures \xB7 ${s}%`,strength:40+s/2}}function Go(e){if(e.length<me)return null;let t=Wt(e.map(s=>s.place).filter(Boolean));if(!t.length)return null;let n=e.filter(s=>/school/i.test(s.place||"")).length;return n<2&&t[0].count<2?null:{id:"place",tone:"neutral",icon:"pin",title:n>=2?`${n} of ${e.length} happened at school`:`Most often at: ${t[0].value}`,detail:n>=2?"Worth making sure the staff actually around you \u2014 not just the front office \u2014 have seen your safety card. Printing it from the Safety tab is the easiest way.":`You logged ${T(t[0].count,"seizure")} there out of ${e.length}.`,evidence:n>=2?`${n}/${e.length} seizures`:`${t[0].count}/${e.length} seizures`,strength:35}}function Qo(e){let t=On(e,14),n=On(e,45,14);if(t.total<10||n.total<10)return null;let s=Math.round(t.good/t.total*100),a=Math.round(n.good/n.total*100),r=s-a;if(Math.abs(r)<8)return null;let i=r>0;return{id:"adherence-trend",tone:i?"good":"alert",icon:i?"trend-up":"trend-down",title:i?`Your dose consistency is up ${r} points`:`Your dose consistency has slipped ${Math.abs(r)} points`,detail:`${s}% of doses taken on time over the last 14 days, against ${a}% in the month before.`+(i?" Keep going.":" Worth a look at which dose is slipping."),evidence:`${t.good}/${t.total} recent \xB7 ${n.good}/${n.total} before`,strength:i?50:85}}function Zo(e){if(e.length<4)return null;let t=g(),n=e.map(fe).sort()[0],s=nt(n,t);if(s<30)return null;let a=Math.floor(s/2),r=M(t,-a),i=e.filter(u=>fe(u)>r).length,l=e.length-i;if(i===l)return null;let h=i<l;return{id:"frequency",tone:h?"good":"alert",icon:h?"sun":"alert",title:h?"Fewer seizures in the most recent stretch":"More seizures in the most recent stretch",detail:`${T(i,"seizure")} in the last ${a} days, against ${l} in the ${a} days before. Over a window this short a change like this can easily be chance \u2014 worth watching, not concluding.`,evidence:`${i} recent vs ${l} earlier`,strength:h?45:80}}function ye(e){let t=e.seizures||[],n=g(),{good:s,total:a}=On(e,30),r=a?Math.round(s/a*100):null,i=t.length?t.map(fe).sort().pop():null,l=i?nt(i,n):null,h=t.filter(f=>nt(fe(f),n)<=30).length,u=t.map(f=>f.duration).filter(f=>f>0),y=u.length?Math.round(Ze(u)):null;return{adherence:r,adherenceGood:s,adherenceTotal:a,daysSince:l,lastSeizure:i,seizuresLast30:h,totalSeizures:t.length,avgDuration:y,avgDurationLabel:y?Pe(y):null,streak:_o(e)}}function ka(e,t=28){let n=new Set((e.seizures||[]).map(fe)),s=g();return is(t).map(a=>{let r=0,i=0,l="none";for(let{med:h,time:u}of D(a,e)){let y=a===s?R(a,h.id,u,e):pe(a,h.id,u,e);y!=="pending"&&(i++,y==="taken"&&r++,y==="missed"?l="missed":y==="late"&&l!=="missed"?l="late":l==="none"&&(l="taken"))}return{day:a,taken:r,total:i,status:i===0?"none":l,seizure:n.has(a)}})}function Sa(){let e=new Date().getHours();return e<5?"Hi":e<12?"Good morning":e<18?"Good afternoon":"Good evening"}function er(e){let t=(e.profile.name||"").split(" ")[0];return t?`${Sa()}, ${t}`:Sa()}function tr(e){if(!B(e).length)return"No medications added yet";let t=Dn(e).filter(n=>n.status==="pending").length;return t?`${T(t,"dose")} left to log today`:"Every dose logged for today"}function Dn(e){let t=g();return D(t,e).map(({med:n,time:s})=>({med:n,time:s,status:R(t,n.id,s,e)}))}function nr(e){let t=g(),n=M(t,-1),s=D(n,e).filter(({med:u,time:y})=>pe(n,u.id,y,e)==="pending").map(({med:u,time:y})=>({med:u,time:y,day:n})),a=Dn(e).filter(u=>u.status==="pending").map(u=>({...u,day:t}));if(!a.length&&!s.length)return null;let r=u=>mt(u.day,u.time),i=a.length+s.length-1,l=[...s,...a].find(u=>r(u)>=0&&r(u)<=Ye);if(l)return{...l,mode:"due",others:i};let h=a.filter(u=>r(u)>Ye);return h.length?{...h[h.length-1],mode:"overdue",others:i}:a.length?{...a[0],mode:"upcoming",others:i}:null}var sr=60;function ar(e){let t=M(g(),1);return D(t,e)[0]||null}function or(e){let t=B(e).length>0,n=ye(e),s=wa(e),a=!!_e(g(),e);return p`
    <div class="home-grid">
      <div class="home-main">
        ${o(t?ir(e):cr(e))}
        ${o(zn(e))}
        ${o(t?ur(e):"")}
      </div>
      <div class="home-side">
        ${o(rr())}
        ${o(lr(n))}
        ${o(a?"":pr())}
        ${o(s?hr(s):"")}
        ${o(mr())}
      </div>
    </div>
  `}function rr(){let e=new Date;return e.getMonth()!==2||e.getDate()!==26?"":p`
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
  `}function ir(e){let t=nr(e);if(!t){let l=ar(e);return p`
      <section class="card next-dose" data-state="clear" aria-label="Today's doses">
        <span class="eyebrow">Today</span>
        <div class="next-dose-when">All done</div>
        <span class="next-dose-what">
          Every dose today is logged.${o(l?` First one tomorrow: ${d(l.med.name)} at ${P(l.time)}.`:"")}
        </span>
      </section>
    `}let n=-mt(t.day,t.time),s=t.mode==="overdue"?`${st(-n)} overdue`:t.mode==="due"||n<=1?"Due now":`in ${st(n)}`,a=t.mode==="overdue"?"Not logged yet":t.mode==="due"?"Take it now":"Next dose",r=(l,h,u)=>`
    <button class="btn ${u}" data-action="dose-quick" data-day="${t.day}"
            data-med="${t.med.id}" data-time="${t.time}" data-status="${l}">${h}</button>`,i=t.mode==="overdue"?r("late",`${c("check",18)} Took it late`,"btn-on-brand")+r("missed","Missed it","btn-on-brand-ghost"):t.mode==="due"?r("taken",`${c("check",18)} Mark taken`,"btn-on-brand")+r("missed","Missed it","btn-on-brand-ghost"):n<=sr?r("taken",`${c("check",18)} Mark taken`,"btn-on-brand"):"";return p`
    <section class="card next-dose" data-state="${t.mode}" aria-label="Next dose">
      <span class="eyebrow">${a}</span>
      <div class="next-dose-when">${s}</div>
      <span class="next-dose-what">
        ${t.med.name}${t.med.dose?` ${t.med.dose}`:""} · ${P(t.time)}
      </span>
      ${o(i?`<div class="next-dose-actions">${i}</div>`:"")}
      ${o(t.others>0?`<button class="next-dose-more" data-action="nav" data-to="meds">
             ${t.others} more ${t.mode==="upcoming"?"later today":"to log today"} ${c("chevron",14)}
           </button>`:"")}
    </section>
  `}function cr(e){return e.settings.noMeds?"":p`
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
  `}function lr(e){let t=e.adherence==null?"":e.adherence>=90?"ok":e.adherence>=75?"warn":"bad";return p`
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
  `}var dr={taken:"\u2713",late:"!",missed:"\u2715",pending:""};function ur(e){let t=Dn(e),n=g(),s=t.map(a=>{let r=Re(a.status,a.time);return`
      <li class="dose-row">
        <span class="med-dot" data-color="${d(a.med.color)}" aria-hidden="true">${c("pill",20)}</span>
        <span class="dose-body">
          <span class="dose-name">${d(a.med.name)} <span class="dose-amt">${d(a.med.dose)}</span></span>
          <span class="dose-meta" data-status="${a.status}">${P(a.time)} \xB7 ${r}</span>
        </span>
        <button class="tick" data-status="${a.status}" data-action="dose-cycle"
                data-med="${a.med.id}" data-time="${a.time}" data-day="${n}"
                aria-label="${d(a.med.name)} at ${P(a.time)}: ${r}. Tap to change.">
          ${dr[a.status]}
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
  `}function pr(){return p`
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
  `}function hr(e){return p`
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
  `}function mr(){return p`
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
  `}var fr={async"dose-quick"(e){let{med:t,time:n,status:s,day:a}=e.dataset;await ht(a||g(),t,n,s),m(s==="taken"?"Marked taken":s==="late"?"Marked taken late":"Marked missed",s==="missed"?"default":"ok")}};var In={};be(In,{actions:()=>Ar,render:()=>xr,subtitle:()=>Sr,title:()=>kr});var yr=["violet","mint","amber","rose","blue"],gr={violet:"Violet",mint:"Mint",amber:"Amber",rose:"Rose",blue:"Blue"},br={violet:"brand",mint:"ok",amber:"warn",rose:"bad",blue:"info"},vr=["tablet","capsule","liquid","patch","injection","other"],wr={taken:"\u2713",late:"!",missed:"\u2715",pending:""},$r={taken:"Taken",late:"Taken late",missed:"Missed",pending:"Not logged"},k=null;function kr(){return"Medications"}function Sr(e){let t=B(e);if(!t.length)return"Nothing added yet";let n=t.reduce((s,a)=>s+ne(a).length,0);return`${T(t.length,"medication")} \xB7 ${T(n,"dose")} a day`}function xr(e){let t=B(e),n=e.meds.filter(s=>!Zt(s));return t.length?p`
    <div class="split-grid">
      <div class="split-main">
        ${o(Mr(e))}
        ${o(Er(t))}
        ${o(n.length?xa(n):"")}
      </div>
      <div class="split-side">
        ${o(Tr(e))}
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
      ${o(n.length?xa(n):"")}
    `}function Ta(e,t,n,s,a){return`
    <li class="dose-row">
      <span class="med-dot" data-color="${d(t.color)}" aria-hidden="true">${c("pill",20)}</span>
      <span class="dose-body">
        <span class="dose-name">${d(t.name)} <span class="dose-amt">${d(t.dose)}</span></span>
        <span class="dose-meta" data-status="${s}">${P(n)} \xB7 ${d(a)}</span>
      </span>
      <button class="tick" data-status="${s}" data-action="dose-cycle"
              data-med="${t.id}" data-time="${n}" data-day="${e}"
              aria-label="${d(t.name)} at ${P(n)}: ${d(a)}. Tap to change.">
        ${wr[s]}
      </button>
    </li>`}function Mr(e){let t=g(),n=D(t,e).map(({med:s,time:a})=>{let r=R(t,s.id,a,e);return Ta(t,s,a,r,Re(r,a))}).join("");return p`
    <section class="section" aria-labelledby="meds-today-h">
      <div class="section-head">
        <h2 id="meds-today-h">Today</h2>
        <span class="t-sm ink-3">${J(t,{relative:!1})}</span>
      </div>
      <div class="card card-flush">
        <ul class="rows">${o(n)}</ul>
      </div>
      <p class="hint">Tap a circle to cycle: taken → late → missed → not logged.</p>
    </section>
  `}function Tr(e){let t=ka(e,28),n=g(),s=X(t[0].day).getDay(),a=[0,1,2,3,4,5,6].map(l=>`<div class="cal-dow" aria-hidden="true">${ds(l).slice(0,2)}</div>`).join(""),r='<div aria-hidden="true"></div>'.repeat(s),i=t.map(l=>{let h=X(l.day).getDate(),u=l.total?`${l.taken} of ${l.total} doses on time`:l.day===n?"nothing logged yet":"no doses scheduled",y=`${J(l.day,{relative:!1})}: ${u}`+(l.seizure?", seizure logged":"");return`
      <button class="cal-day" data-status="${l.status}" data-today="${l.day===n}"
              data-seizure="${l.seizure}" data-action="cal-day" data-day="${l.day}"
              aria-label="${d(y)}" title="${d(y)}">${h}</button>`}).join("");return p`
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
  `}function Er(e){let t=e.map(n=>{let s=ne(n);return`
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
  `}function xa(e){let t=e.map(n=>`
    <li class="list-row list-row-static">
      <span class="med-dot" data-color="${d(n.color)}" data-muted="true" aria-hidden="true">${c("archive",18)}</span>
      <span class="row-body">
        <span class="row-t">${d(n.name)} <span class="dose-amt">${d(n.dose)}</span></span>
        <span class="row-s">Stopped ${J(n.ended,{relative:!1})} \xB7 history kept</span>
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
  `}function Ea(){let e=k.times.map((s,a)=>`
    <div class="input-row">
      <input class="input" type="time" value="${d(s)}" data-time-index="${a}"
             aria-label="Dose time ${a+1}" required />
      ${k.times.length>1?`<button type="button" class="icon-btn" data-action="med-time-remove" data-index="${a}"
                   aria-label="Remove time ${a+1}">${c("trash",20)}</button>`:""}
    </div>`).join(""),t=yr.map(s=>`
    <button type="button" class="chip chip-color" data-action="med-color" data-value="${s}"
            aria-pressed="${s===k.color}">
      <span class="cal-swatch" style="background:var(--${br[s]})"></span>${gr[s]}
    </button>`).join(""),n=vr.map(s=>`<option value="${s}" ${s===k.form?"selected":""}>${s[0].toUpperCase()}${s.slice(1)}</option>`).join("");return p`
    <form class="stack stack-5" data-action="med-save" novalidate>
      <div class="field">
        <label class="label" for="med-name">Name</label>
        <input class="input" id="med-name" name="name" value="${k.name}"
               placeholder="e.g. Levetiracetam" autocomplete="off" required maxlength="120" />
      </div>

      <div class="input-row">
        <div class="field grow">
          <label class="label" for="med-dose">Dose</label>
          <input class="input" id="med-dose" name="dose" value="${k.dose}"
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
        ${o(k.id?'<span class="hint">Changing times applies from today. Earlier days keep the schedule they actually had.</span>':"")}
      </div>

      <div class="field">
        <span class="label" id="color-label">Colour</span>
        <div class="chips" role="group" aria-labelledby="color-label">${o(t)}</div>
      </div>

      <div class="field">
        <label class="label" for="med-notes">Notes <span class="ink-faint">(optional)</span></label>
        <textarea class="textarea" id="med-notes" name="notes" maxlength="600"
                  placeholder="Take with food">${k.notes}</textarea>
      </div>
    </form>
  `}function et(){if(!k)return;let e=Y();for(let t of["name","dose","form","notes"])e[t]!==void 0&&(k[t]=e[t]);W().querySelectorAll("[data-time-index]").forEach(t=>{k.times[Number(t.dataset.timeIndex)]=t.value})}function jn(e){et();let t=W().querySelector(".sheet-body");if(t&&(t.innerHTML=Ea()),e){let n=W().querySelector(e);n&&n.focus()}}function zr(e){k=e?{id:e.id,name:e.name,dose:e.dose,form:e.form,notes:e.notes,color:e.color,times:[...ne(e)]}:{id:null,name:"",dose:"",form:"tablet",times:["08:00"],notes:"",color:"violet"},k.times.length||(k.times=["08:00"]),N({title:e?"Edit medication":"Add medication",body:Ea(),footer:`
      ${e?`<button class="btn btn-danger-soft" data-action="med-stop" data-id="${e.id}">Stop taking</button>`:""}
      <button class="btn btn-primary" data-action="med-save">${e?"Save":"Add medication"}</button>
    `,onClose(){k=null}})}var Cr={pending:"taken",taken:"late",late:"missed",missed:"pending"};function Ma(e,t,n){let s=D(e,t),a=(t.seizures||[]).filter(h=>h.at.startsWith(e)),r=e<g(),i=s.map(({med:h,time:u})=>{let y=R(e,h.id,u,t),f=y!=="pending"?$r[y]:r?"Not logged \u2014 counts as missed":Re("pending",u);return Ta(e,h,u,y,f)}).join(""),l=p`
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
  `;if(n){let h=W().querySelector(".sheet-body");h&&(h.innerHTML=l);return}N({title:J(e,{relative:!1}),body:l})}var Ar={async"dose-cycle"(e){let{med:t,time:n,day:s}=e.dataset,a=R(s,t,n),r=!!e.closest("#sheet");await ht(s,t,n,Cr[a]),r&&(Ma(s,O(),!0),W().querySelector(`[data-action="dose-cycle"][data-med="${t}"][data-time="${n}"]`)?.focus())},"cal-day"(e,t){Ma(e.dataset.day,t,!1)},"med-open"(e,t){let n=e.dataset.id;zr(n?t.meds.find(s=>s.id===n):null)},"med-time-add"(){et();let e=k.times[k.times.length-1]||"08:00",[t,n]=e.split(":").map(Number);k.times.push(`${String(((t||0)+12)%24).padStart(2,"0")}:${String(n||0).padStart(2,"0")}`),jn(`[data-time-index="${k.times.length-1}"]`)},"med-time-remove"(e){et(),k.times.splice(Number(e.dataset.index),1),jn('[data-action="med-time-add"]')},"med-color"(e){et(),k.color=e.dataset.value,jn(`[data-action="med-color"][data-value="${e.dataset.value}"]`)},async"med-save"(){if(et(),!k.name.trim()){m("Give the medication a name","bad"),W().querySelector("#med-name")?.focus();return}let e=$e(k.times);if(!e.length){m("Add at least one time","bad");return}let t={name:k.name,dose:k.dose,form:k.form,times:e,notes:k.notes,color:k.color},n=!!k.id;n?await xs(k.id,t):await Ss(t),E(),m(n?"Medication updated":"Added \u2014 tracking starts today","ok")},"med-stop"(e,t){let n=e.dataset.id,s=t.meds.find(r=>r.id===n),a=s&&s.added>=g();H({title:a?"Remove this medication?":`Stop taking ${s?s.name:"this"}?`,message:a?"It was only added today, so there is no history to keep. It will be removed completely.":"It will stop appearing in today's doses and reminders. Every dose already logged stays in your history and statistics, and you can restart it later. Never stop an epilepsy medication without talking to your neurologist first.",confirmLabel:a?"Remove":"Stop taking",async onConfirm(){await Ms(n),m(a?"Medication removed":"Stopped \u2014 history kept")}})},async"med-restart"(e,t){let n=t.meds.find(s=>s.id===e.dataset.id);n&&(await Ts(n.id),m(`${n.name} restarted from today`,"ok"))}};var qn={};be(qn,{actions:()=>Wr,logSeizure:()=>Hn,render:()=>Ir,subtitle:()=>jr,title:()=>Lr});var Or=["Focal aware","Focal impaired awareness","Tonic-clonic","Absence","Myoclonic","Atonic","Not sure"],Nr=["Missed dose","Missed sleep","Stress","Illness or fever","Flashing lights","Skipped meal","Dehydration","Period","None known"],Dr=["Home","School \u2014 classroom","School \u2014 hallway","School \u2014 gym","School \u2014 cafeteria","Outside","In a car","Other"],za=["","Calm","Fine","Busy","Stressed","Overwhelmed"],Le="log",v=null,I=null,Ca=e=>`${e} ${e===1?"entry":"entries"}`;function Lr(){return"Seizures"}function jr(e){let t=(e.seizures||[]).length;if(!t)return"Nothing logged yet";let{daysSince:n}=ye(e);return n===0?`${Ca(t)} \xB7 one today`:`${Ca(t)} \xB7 ${T(n,"day")} since the last`}function Ir(e){return p`
    <div class="subtabs" role="tablist" aria-label="Seizure views">
      <button class="subtab" role="tab" id="tab-log" aria-controls="panel-sz"
              data-action="sz-tab" data-tab="log" aria-selected="${Le==="log"}">
        ${o(c("note",18))} Log
      </button>
      <button class="subtab" role="tab" id="tab-patterns" aria-controls="panel-sz"
              data-action="sz-tab" data-tab="patterns" aria-selected="${Le==="patterns"}">
        ${o(c("sparkle",18))} Patterns
      </button>
    </div>
    <div id="panel-sz" role="tabpanel" aria-labelledby="tab-${Le}" class="stack stack-5">
      ${o(Le==="log"?qr(e):Fr(e))}
    </div>
  `}function Pr(e){let t=F(e.at),n=[];return e.duration&&n.push(`<span class="pill">${c("timer",13)} ${Pe(e.duration)}</span>`),e.trigger&&n.push(`<span class="pill pill-warn">${d(e.trigger)}</span>`),e.place&&n.push(`<span class="pill">${d(e.place)}</span>`),e.injury&&n.push('<span class="pill pill-bad">Injury</span>'),e.emsCalled&&n.push('<span class="pill pill-bad">911 called</span>'),`
    <li>
      <button class="log-entry" data-action="seizure-open" data-id="${e.id}">
        <span class="log-date" aria-hidden="true">
          <span class="log-mon">${Ie(t.getMonth())}</span>
          <span class="log-day">${t.getDate()}</span>
        </span>
        <span class="log-body">
          <span class="log-t">${d(e.type||"Seizure")}</span>
          <span class="row-s">${us(e.at)} \xB7 ${ps(e.at)}</span>
          ${n.length?`<span class="log-meta">${n.join("")}</span>`:""}
          ${e.notes?`<span class="log-note">${d(e.notes)}</span>`:""}
        </span>
        <span class="chev">${c("chevron")}</span>
      </button>
    </li>`}function Rr(e){let t=[];for(let n of e){let s=F(n.at),a=`${s.getFullYear()}-${s.getMonth()}`,r=t[t.length-1];(!r||r.key!==a)&&(r={key:a,label:`${Ie(s.getMonth())} ${s.getFullYear()}`,items:[]},t.push(r)),r.items.push(n)}return t.map(n=>`
    <div class="month-group">
      <h3 class="eyebrow month-label">${n.label} \xB7 ${n.items.length}</h3>
      <div class="card card-flush"><ul class="rows">${n.items.map(Pr).join("")}</ul></div>
    </div>`).join("")}function Hr(e){if(!e)return p`
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
  `}function qr(e){let t=e.seizures||[],n=_e(g(),e);return p`
    <button class="btn btn-primary btn-lg btn-block" data-action="seizure-open">
      ${o(c("plus",20))} Log a seizure
    </button>

    ${o(Hr(n))}

    ${o(t.length?`
      <section class="section" aria-labelledby="hist-h">
        <h2 id="hist-h">History</h2>
        ${Rr(t)}
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
  `}function Aa(){return p`
    <div class="disclaimer">
      ${o(c("info",16))}
      <span><strong>About these patterns.</strong> ${va}</span>
    </div>
  `}function Fr(e){let t=Nn(e),n=ye(e),s=(e.seizures||[]).length,a=Object.keys(e.checkins||{}).length;if(!t.length){let i=[];return s<3&&i.push(`at least 3 seizures logged (you have ${s})`),a<13&&i.push(`about two weeks of daily check-ins (you have ${a})`),p`
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
      ${o(Aa())}
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

    ${o(Aa())}
  `}function Pn(e,t,n){let s=t.map(a=>`
    <button type="button" class="chip" data-action="sz-chip" data-field="${e}"
            data-value="${d(a)}" aria-pressed="${a===v[e]}">${d(a)}</button>`).join("");return`
    <div class="field">
      <span class="label" id="lbl-${e}">${n}</span>
      <div class="chips" role="group" aria-labelledby="lbl-${e}">${s}</div>
    </div>`}function Na(){let e=Math.floor(v.duration/60),t=v.duration%60,n=g();return p`
    <form class="stack stack-5" data-action="seizure-save" novalidate>
      ${o(v.fromTimer?`
        <div class="insight" data-tone="good">
          <span class="insight-ico" aria-hidden="true">${c("timer",20)}</span>
          <span class="insight-body">
            <span class="insight-t">Timed at ${Pe(v.duration)}</span>
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

      ${o(Pn("type",Or,"Type"))}
      ${o(Pn("trigger",Nr,"Possible trigger"))}
      ${o(Pn("place",Dr,"Where were you?"))}

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
  `}function Rn(){if(!v)return;let e=Y();for(let t of["date","time","aura","notes","injury","emsCalled"])e[t]!==void 0&&(v[t]=e[t]);if(e.mins!==void 0||e.secs!==void 0){let t=at(Number(e.mins)||0,0,120),n=at(Number(e.secs)||0,0,59);v.duration=t*60+n}}function Br(e){Rn();let t=W().querySelector(".sheet-body");if(!t)return;let n=t.scrollTop;t.innerHTML=Na(),t.scrollTop=n,e&&W().querySelector(e)?.focus({preventScroll:!0})}function Da(e,t={}){if(e){let[n,s]=e.at.split("T");v={...e,date:n,time:s,fromTimer:!1}}else{let n=t.at||`${g()}T${de()}`,[s,a]=n.split("T");v={id:null,date:s,time:a,duration:t.duration||0,type:"",trigger:"",place:"",aura:"",injury:!1,emsCalled:!1,notes:"",fromTimer:!!t.duration}}N({title:e?"Edit entry":"Log a seizure",body:Na(),footer:`
      ${e?`<button class="btn btn-danger-soft" data-action="seizure-delete" data-id="${e.id}">Delete</button>`:""}
      <button class="btn btn-primary" data-action="seizure-save">Save</button>
    `,onClose(){v=null}})}function Hn(e){Da(null,e)}function La(){let e=[1,2,3,4,5].map(t=>`
    <button type="button" class="segment" data-action="checkin-stress" data-value="${t}"
            aria-pressed="${I.stress===t}" aria-label="${t}, ${za[t]}">${t}</button>`).join("");return p`
    <div class="stack stack-6">
      <div class="field">
        <span class="label" id="sleep-label">How many hours did you sleep last night?</span>
        <div class="stepper" role="group" aria-labelledby="sleep-label">
          <button type="button" class="stepper-btn" data-action="checkin-sleep" data-value="-0.5"
                  aria-label="Half an hour less">−</button>
          <span class="sleep-n" aria-live="polite">${I.sleepHours}<small>h</small></span>
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
        <span class="hint text-center">${za[I.stress]||""}</span>
      </div>

      <div class="field">
        <label class="label" for="ci-notes">Anything worth noting</label>
        <textarea class="textarea" id="ci-notes" name="notes" maxlength="600"
                  placeholder="Sick, travelling, exams…">${I.notes}</textarea>
      </div>
    </div>
  `}function Oa(e){let t=Y();t.notes!==void 0&&(I.notes=t.notes);let n=W().querySelector(".sheet-body");n&&(n.innerHTML=La()),e&&W().querySelector(e)?.focus({preventScroll:!0})}var Wr={"sz-tab"(e){Le=e.dataset.tab,Qt()},"open-patterns"(){Le="patterns",location.hash==="#/track"?Qt():location.hash="#/track"},"seizure-open"(e,t){let n=e.dataset.id;Da(n?t.seizures.find(s=>s.id===n):null)},"sz-chip"(e){Rn();let{field:t,value:n}=e.dataset;v[t]=v[t]===n?"":n,Br(`[data-action="sz-chip"][data-field="${t}"][data-value="${CSS.escape(n)}"]`)},async"seizure-save"(){Rn();let e=`${v.date}T${v.time}`;if(!v.date||!v.time||!we(e)){m("A date and start time are needed","bad");return}if(F(e).getTime()>Date.now()+6e4){m("That time is in the future","bad");return}let t={at:e,duration:v.duration,type:v.type,trigger:v.trigger,place:v.place,aura:v.aura,injury:!!v.injury,emsCalled:!!v.emsCalled,notes:v.notes},n=!!v.id;n?await zs(v.id,t):await Es(t),E(),m(n?"Entry updated":"Logged. Look after yourself today.","ok")},"seizure-delete"(e){let t=e.dataset.id;H({title:"Delete this entry?",message:"It will be removed from your history and from the pattern calculations. This can't be undone.",async onConfirm(){await Cs(t),m("Entry deleted")}})},"checkin-open"(e,t){let n=g(),s=_e(n,t);I={sleepHours:s&&s.sleepHours!=null?s.sleepHours:8,stress:s&&s.stress!=null?s.stress:2,notes:s&&s.notes||""},N({title:`Check-in \xB7 ${J(n)}`,body:La(),footer:'<button class="btn btn-primary" data-action="checkin-save">Save check-in</button>',onClose(){I=null}})},"checkin-sleep"(e){let t=Number(e.dataset.value);I.sleepHours=at(Math.round((I.sleepHours+t)*2)/2,0,16),Oa(`[data-action="checkin-sleep"][data-value="${e.dataset.value}"]`)},"checkin-stress"(e){I.stress=Number(e.dataset.value),Oa(`[data-action="checkin-stress"][data-value="${e.dataset.value}"]`)},async"checkin-save"(){let e=Y();e.notes!==void 0&&(I.notes=e.notes);let t=I.sleepHours;await As(g(),{sleepHours:t,sleepQuality:t<6?"poor":t<7?"ok":"good",stress:I.stress,mood:I.stress>=4?"low":"ok",notes:(I.notes||"").trim()}),E(),m("Checked in","ok")}};var Xn={};be(Xn,{actions:()=>ai,render:()=>Vr,showEmergency:()=>Ht,subtitle:()=>_r,title:()=>Yr});function Yr(){return"Safety card"}function _r(e){let t=(e.contacts||[]).length,n=`${t} ${t===1?"contact":"contacts"}`;return e.card.updated?`${n} \xB7 updated ${J(e.card.updated)}`:n}var Kr=e=>(e.name||"").trim().split(/\s+/)[0]||"";function Vr(e){let{card:t,contacts:n,profile:s}=e,a=Kr(s),r=a?`If ${a} has a seizure`:"If a seizure happens";return p`
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

    ${o(Jr(e))}

    <div class="split-grid">
      <div class="split-main">
        ${o(Xr(n))}
        ${o(Gr(t))}
        ${o(Fn("What to do",t.during,"during","ok"))}
        ${o(Fn("What NOT to do",t.doNot,"doNot","bad"))}
        ${o(Qr(t))}
        ${o(Fn("Afterwards",t.after,"after",""))}
      </div>
      <div class="split-side">
        ${o(Zr(e))}
        ${o(ti(t))}
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
  `}function Jr(e){let t=[];if(e.contacts.length||t.push(["contact-open","","Add someone to call"]),e.profile.name||t.push(["profile-edit","","Add your name"]),e.card.looksLike||t.push(["card-edit","looksLike","Describe what your seizures look like"]),e.card.forTeacher||t.push(["card-edit","forTeacher","Add a note for teachers"]),!t.length)return"";let n=t.map(([s,a,r])=>`
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
  `}function Pa(e){return`<span class="contact-rt">${d(e.relation)}${e.relation&&e.phone?" \xB7 ":""}<span class="contact-ph">${d(e.phone)}</span></span>`}function Ur(e){return`
    <li class="contact-row">
      <button class="contact-main" data-action="contact-open" data-id="${e.id}"
              aria-label="Edit ${d(e.name)}">
        <span class="avatar" aria-hidden="true">${d(rt(e.name))}</span>
        <span class="contact-body">
          <span class="contact-n">${d(e.name)}</span>
          <span class="contact-r">${e.primary?'<span class="pill pill-brand">First call</span>':""}${Pa(e)}</span>
        </span>
      </button>
      ${Ra(e)}
    </li>`}function Ra(e){return ot(e.phone)?`<a class="call-btn" href="${Bt(e.phone)}" aria-label="Call ${d(e.name)}">${c("phone",16)} Call</a>`:'<span class="pill pill-warn">No number</span>'}function Xr(e){let t=e.length?`<ul class="rows">${e.map(Ur).join("")}</ul>`:`<div class="empty empty-sm">
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
  `}function Rt(e,t){return`<button class="btn btn-sm btn-quiet" data-action="card-edit" data-field="${e}"
                  aria-label="Edit ${d(t)}">${c("edit",15)} Edit</button>`}function Gr(e){let t=e.looksLike?`<p class="prose">${d(e.looksLike)}</p>`:`<p class="ink-3">Describe what happens, so somebody who has never seen one knows what they're looking at.</p>`;return p`
    <section class="section" aria-labelledby="looks-h">
      <div class="section-head">
        <h2 id="looks-h">What it looks like</h2>
        ${o(Rt("looksLike","what it looks like"))}
      </div>
      <div class="card">${o(t)}</div>
    </section>
  `}function Vn(e,t){return`<ol class="steps">${e.map((n,s)=>`
    <li class="step" data-tone="${t}">
      <span class="step-n" aria-hidden="true">${t==="bad"?"\u2715":t==="ems"?"!":s+1}</span>
      <span>${d(n)}</span>
    </li>`).join("")}</ol>`}function Fn(e,t,n,s){let a=`sec-${n}`,r=t&&t.length?Vn(t,s):'<p class="ink-3">Nothing added yet.</p>';return p`
    <section class="section" aria-labelledby="${a}">
      <div class="section-head">
        <h2 id="${a}">${e}</h2>
        ${o(Rt(n,e))}
      </div>
      <div class="card">${o(r)}</div>
    </section>
  `}function Qr(e){let t=e.callEms||[];return p`
    <section class="section" aria-labelledby="sec-ems">
      <div class="section-head">
        <h2 id="sec-ems">Call 911 if…</h2>
        ${o(Rt("callEms","when to call 911"))}
      </div>
      <div class="card ems-card">${o(t.length?Vn(t,"ems"):'<p class="ink-3">Nothing added yet.</p>')}</div>
    </section>
  `}function Zr(e){let{profile:t}=e,n=B(e),s=[["Seizure type",t.seizureType],["Rescue medication",t.rescueMed],["Allergies",t.allergies],["Blood type",t.bloodType],["Neurologist",[t.neurologist,t.neuroPhone].filter(Boolean).join(" \xB7 ")]].filter(([,i])=>i),a=n.length?n.map(i=>`${d(i.name)}${i.dose?` ${d(i.dose)}`:""}`).join(", "):'<span class="ink-faint">None added</span>',r=s.map(([i,l])=>`<div class="kv-row"><dt class="kv-k">${i}</dt><dd class="kv-v">${d(l)}</dd></div>`).join("");return p`
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
  `}var ei=[{field:"forTeacher",label:"For teachers",icon:"school"},{field:"forNurse",label:"For the school nurse",icon:"stethoscope"},{field:"forCoach",label:"For coaches and PE",icon:"run"}];function ti(e){let t=ei.map(n=>`
    <div class="card role-card">
      <div class="card-head">
        <h3>${c(n.icon,18)} ${n.label}</h3>
        ${Rt(n.field,n.label)}
      </div>
      ${e[n.field]?`<p class="prose">${d(e[n.field])}</p>`:`<p class="ink-3 t-sm">Nothing added yet \u2014 what should this person know that isn't in the steps?</p>`}
    </div>`).join("");return p`
    <section class="section" aria-labelledby="roles-h">
      <h2 id="roles-h">Specific instructions</h2>
      <div class="stack stack-3">${o(t)}</div>
    </section>
  `}var Wn="synara.timer",Yn=300,It=null,ce=null,je=null,Ha=null;function Pt(){let e=Ha;if(!e)try{e=JSON.parse(sessionStorage.getItem(Wn)||"null")}catch{}return e&&typeof e.ms=="number"&&Date.now()-e.ms<10800*1e3?e:null}function Lt(e){Ha=e;try{e?sessionStorage.setItem(Wn,JSON.stringify(e)):sessionStorage.removeItem(Wn)}catch{}}var qa="From their seizure action plan. Only give it if you are trained to.",jt=e=>`${Math.floor(e/60)}:${String(e%60).padStart(2,"0")}`;function Fa(){return`
    <section class="em-timer" data-state="idle" aria-labelledby="em-timer-h">
      <div class="em-timer-top">
        <h3 id="em-timer-h" class="em-timer-h">${c("timer",18)} Seizure timer</h3>
        <span class="em-timer-hint" data-timer-hint>Start it now. If the seizure began earlier, you can add the minutes you missed.</span>
      </div>
      <div class="em-timer-clock" data-timer-clock aria-hidden="true">0:00</div>
      <div class="sr-only" aria-live="assertive" data-timer-live></div>
      <div class="em-timer-actions" data-timer-actions>
        <button class="btn btn-lg btn-primary btn-block" data-action="timer-start" data-autofocus>
          ${c("play",20)} Start timer
        </button>
      </div>
    </section>`}function Jn(e,t,n){let s=e.querySelector(".em-timer");if(!s)return;let a=s.querySelector("[data-timer-clock]"),r=s.querySelector("[data-timer-hint]"),i=s.querySelector("[data-timer-actions]"),l=s.dataset.state!==t;if(s.dataset.state=t,a.textContent=jt(n),t==="running"||t==="over"){let h=t==="over";if(r.textContent=h?"Over 5 minutes \u2014 call 911 now":`Call 911 at 5 minutes from when it began \xB7 ${jt(Math.max(0,Yn-n))} to go`,l){let u=i.contains(document.activeElement);i.innerHTML=`
        ${h?`<a class="btn btn-lg btn-block btn-emergency" href="tel:911">${c("phone",20)} Call 911 now</a>`:""}
        <button class="btn btn-lg btn-block ${h?"btn-on-danger-ghost":"btn-outline"}" data-action="timer-stop">
          ${c("stop",18)} It stopped
        </button>
        ${h?"":'<button class="btn btn-block btn-quiet" data-action="timer-earlier">+1 min \u2014 it began earlier</button>'}`,u&&i.querySelector('[data-action="timer-stop"]')?.focus({preventScroll:!0})}}else if(t==="stopped"){let h=n>=Yn;s.dataset.state=h?"over":"stopped",r.textContent=h?`It lasted ${jt(n)}. That is 5 minutes or longer, so call 911 if no one has yet.`:`It lasted ${jt(n)}`,i.innerHTML=`
      ${h?`<a class="btn btn-lg btn-block btn-emergency" href="tel:911">${c("phone",20)} Call 911</a>`:""}
      <button class="btn btn-lg btn-block ${h?"btn-on-danger-ghost":"btn-primary"}" data-action="timer-log">${c("note",18)} Log this seizure</button>
      <button class="btn btn-block ${h?"btn-on-danger-ghost":"btn-quiet"}" data-action="timer-reset">Reset timer</button>`;let u=s.querySelector("[data-timer-live]");u&&(u.textContent=r.textContent)}}function _n(e){clearInterval(It);let t=e.querySelector("[data-timer-live]"),n=-1,s=!1,a=()=>{let r=Pt();if(!r)return;let i=Math.max(0,Math.floor((Date.now()-r.ms)/1e3)),l=i>=Yn;Jn(e,l?"over":"running",i);let h=Math.floor(i/60);t&&h!==n&&h>0&&(t.textContent=l&&!s?"Five minutes. Call 911 now.":`${h} ${h===1?"minute":"minutes"}`,l&&(s=!0)),n=h};a(),It=setInterval(a,1e3)}function Kn(){clearInterval(It),It=null}function ie(e,t,n=""){return`
    <section class="em-block"${n?` data-tone="${n}"`:""}>
      <h3>${e}</h3>
      ${t}
    </section>`}function Ht(e,{onClose:t}={}){let{card:n,contacts:s,profile:a}=e,r=s.filter(z=>ot(z.phone)),i=r.find(z=>z.primary)||r[0],l=s.filter(z=>z!==i),h=B(e),u=a.name||"This student",y=[a.pronouns,a.grade,a.school].filter(Boolean).join(" \xB7 "),f=i?`
    <a class="em-call" href="${Bt(i.phone)}">
      <span class="em-call-ico" aria-hidden="true">${c("phone",22)}</span>
      <span class="em-call-body">
        <span class="em-call-n">Call ${d(i.name)}</span>
        <span class="em-call-r">${d(i.relation)}${i.relation?" \xB7 ":""}${d(i.phone)}</span>
      </span>
    </a>`:"",w=l.length?ie("Other contacts",`
    <ul class="rows">${l.map(z=>`
      <li class="contact-row contact-row-flat">
        <span class="contact-body">
          <span class="contact-n">${d(z.name)}</span>
          <span class="contact-r">${Pa(z)}</span>
        </span>
        ${Ra(z)}
      </li>`).join("")}</ul>`):"",A=[a.seizureType&&`<div class="kv-row"><dt class="kv-k">Seizure type</dt><dd class="kv-v">${d(a.seizureType)}</dd></div>`,a.allergies&&`<div class="kv-row"><dt class="kv-k">Allergies</dt><dd class="kv-v">${d(a.allergies)}</dd></div>`,h.length&&`<div class="kv-row"><dt class="kv-k">Medications</dt><dd class="kv-v">${h.map(z=>`${d(z.name)} ${d(z.dose)}`).join(", ")}</dd></div>`,a.bloodType&&`<div class="kv-row"><dt class="kv-k">Blood type</dt><dd class="kv-v">${d(a.bloodType)}</dd></div>`,a.neurologist&&`<div class="kv-row"><dt class="kv-k">Neurologist</dt><dd class="kv-v">${d(a.neurologist)}${a.neuroPhone?` \xB7 ${d(a.neuroPhone)}`:""}</dd></div>`].filter(Boolean).join(""),$=a.rescueMed?ie("Rescue medication",`
    <div class="stack stack-2">
      <p class="prose em-rescue">${d(a.rescueMed)}</p>
      <p class="t-sm ink-2">${d(qa)}</p>
    </div>`):"",U=(z,eo)=>z&&z.length?Vn(z,eo):"",Za=p`
    <div class="em-bar">
      <span class="em-bar-t">${o(c("shield",20))} Seizure — what to do</span>
      <button class="em-close" data-action="close-emergency">Close</button>
    </div>

    <div class="em-body">
      <div class="em-inner">
        <header class="em-who">
          <h2 class="em-name">${u}</h2>
          ${o(y?`<span class="em-sub">${d(y)}</span>`:"")}
        </header>

        ${o(Fa())}

        <div class="em-calls">
          ${o(f)}
          <a class="em-911" href="tel:911">${o(c("phone",22))} Call 911</a>
        </div>

        ${o(n.during&&n.during.length?ie("What to do right now",U(n.during,"ok")):"")}
        ${o($)}
        ${o(n.callEms&&n.callEms.length?ie("Call 911 if",U(n.callEms,"ems"),"bad"):"")}
        ${o(n.doNot&&n.doNot.length?ie("Do NOT",U(n.doNot,"bad")):"")}
        ${o(n.looksLike?ie("What their seizures look like",`<p class="prose">${d(n.looksLike)}</p>`):"")}
        ${o(n.after&&n.after.length?ie("Afterwards",U(n.after,"")):"")}
        ${o(A?ie("Medical details",`<dl class="kv kv-flat">${A}</dl>`):"")}
        ${o(w)}

        <p class="em-foot">Standard seizure first aid. If in doubt, call 911.</p>
      </div>
    </div>
  `;Hs(Za,{onMount(z){Pt()?(_n(z),z.querySelector('[data-action="timer-stop"]')?.focus({preventScroll:!0})):ce!=null&&Jn(z,"stopped",ce)},onClose(){Kn(),t&&t()}})}function ja(e){let t=X(e);return`${Ie(t.getMonth())} ${t.getDate()}, ${t.getFullYear()}`}function ni(e){let{card:t,contacts:n,profile:s}=e,a=B(e),r=(f,w)=>`<ol${w?` class="${w}"`:""}>${f.map(A=>`<li>${d(A)}</li>`).join("")}</ol>`,i=(f,w,A)=>w&&w.length?`<section><h2>${f}</h2>${r(w,A)}</section>`:"",l=[s.pronouns,s.grade,s.school].filter(Boolean).join(" \xB7 "),h=[["Seizure type",s.seizureType],["Allergies",s.allergies],["Blood type",s.bloodType],["Medications",a.map(f=>{let w=ne(f).map(P).join(", ");return`${f.name}${f.dose?` ${f.dose}`:""}${w?` (${w})`:""}`}).join("; ")],["Neurologist",[s.neurologist,s.neuroPhone].filter(Boolean).join(" \u2014 ")]].filter(([,f])=>f),u=[...n].sort((f,w)=>Number(w.primary)-Number(f.primary)),y=[["forTeacher","Teachers"],["forNurse","School nurse"],["forCoach","Coaches and PE"]].filter(([f])=>t[f]);return`
    <article class="pc">
      <header class="pc-head">
        <div>
          <p class="pc-kicker">Seizure action card</p>
          <h1 class="pc-name">${d(s.name||"Student name")}</h1>
          ${l?`<p class="pc-sub">${d(l)}</p>`:""}
        </div>
        <div class="pc-911">In an emergency<strong>Call 911</strong></div>
      </header>

      ${h.length?`<dl class="pc-facts">${h.map(([f,w])=>`<div${f==="Medications"?' class="pc-wide"':""}><dt>${f}</dt><dd>${d(w)}</dd></div>`).join("")}</dl>`:""}

      <section class="pc-who">
        <h2>Who to call</h2>
        ${u.length?`<table class="pc-contacts"><tbody>${u.map(f=>`
          <tr>
            <td><strong>${d(f.name)}</strong>${f.primary?' <span class="pc-first">Call first</span>':""}</td>
            <td>${d(f.relation)}</td>
            <td>${d(f.phone)}</td>
          </tr>`).join("")}
        </tbody></table>`:"<p>No contacts added yet.</p>"}
      </section>

      ${s.rescueMed?`<section class="pc-rescue"><h2>Rescue medication</h2>
        <p>${d(s.rescueMed)}</p><p class="pc-note">${d(qa)}</p></section>`:""}

      ${t.looksLike?`<section><h2>What their seizures look like</h2><p>${d(t.looksLike)}</p></section>`:""}

      <div class="pc-cols">
        <div>
          ${i("What to do",t.during)}
          ${i("Afterwards",t.after)}
        </div>
        <div>
          ${i("Do NOT",t.doNot,"pc-not")}
          ${t.callEms&&t.callEms.length?`<section class="pc-ems"><h2>Call 911 if</h2>${r(t.callEms,"pc-if")}</section>`:""}
        </div>
      </div>

      ${y.length?`<section class="pc-roles">${y.map(([f,w])=>`<div><h3>${w}</h3><p>${d(t[f])}</p></div>`).join("")}</section>`:""}

      <footer class="pc-foot">
        ${s.name?`${d(s.name)}\u2019s seizure action card. `:""}
        Printed ${ja(g())}${t.updated?` \xB7 card last updated ${ja(t.updated)}`:""}.
        Standard seizure first aid \u2014 confirm with the student's neurologist. Made with Synara.
      </footer>
    </article>`}function Un(e=O()){let t=document.getElementById("print-card");t&&(t.innerHTML=ni(e))}te(Un);window.addEventListener("beforeprint",()=>Un());var Ia=new Set(["during","doNot","after","callEms"]),Bn={looksLike:"What their seizures look like",during:"What to do",doNot:"What NOT to do",after:"Afterwards",callEms:"Call 911 if\u2026",forTeacher:"For teachers",forNurse:"For the school nurse",forCoach:"For coaches and PE"},si={looksLike:"Plain words beat medical terms \u2014 a substitute teacher has to recognise this.",forTeacher:"What should happen in class? Who do they send for? Anything in a 504 plan?",forNurse:"Rescue medication, who to call after 911, where they like to recover.",forCoach:"Activity limits, water rules, whether they can return to play the same day."},ai={"card-edit"(e,t){let n=e.dataset.field;if(!Bn[n])return;let s=Ia.has(n),a=t.card[n],r=s?(a||[]).join(`
`):a||"";N({title:Bn[n],body:p`
        <div class="field">
          <label class="label" for="card-text">
            ${s?"One step per line":"Write it the way you would say it out loud"}
          </label>
          <textarea class="textarea textarea-tall" id="card-text" name="text" maxlength="4000">${r}</textarea>
          <span class="hint">
            ${s?`Each line becomes one step on the card.${ut.has(n)?" Clear it all to go back to the standard steps.":""}`:si[n]||""}
          </span>
        </div>
      `,footer:`<button class="btn btn-primary" data-action="card-save" data-field="${n}">Save</button>`})},async"card-save"(e){let t=e.dataset.field;if(!Bn[t])return;let n=Y().text||"",s=Ia.has(t)?n.split(`
`).map(r=>r.replace(/^\s*(\d+[.)]|[-*•])\s*/,"").trim()).filter(Boolean):n.trim(),a=ut.has(t)&&!s.length;a&&(s=vs(t)),await Ls({[t]:s}),E(),m(a?"The standard steps are back \u2014 the emergency card always needs these":"Safety card updated","ok")},"contact-open"(e,t){let n=e.dataset.id,s=n?t.contacts.find(i=>i.id===n):null,a=s||{name:"",relation:"",phone:"",primary:!t.contacts.length},r=s?` data-id="${s.id}"`:"";N({title:s?"Edit contact":"Add contact",body:p`
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
      `})},async"contact-save"(e){let t=e.dataset.id||null,n=Y();if(!n.name||!n.name.trim()){m("A name is needed","bad");return}if(!ot(n.phone)){m("That phone number doesn't look complete","bad");return}let s={name:n.name,relation:n.relation||"",phone:n.phone,primary:!!n.primary};t?await Ns(t,s):await Os(s),E(),m(t?"Contact updated":"Contact added","ok")},"contact-delete"(e){let t=e.dataset.id;H({title:"Delete this contact?",message:"They will be removed from the safety card, the emergency screen, and the printed card.",async onConfirm(){await Ds(t),m("Contact deleted")}})},"timer-start"(){ce=null,je=G(),Lt({ms:Date.now(),at:je}),_n(oe()),oe().querySelector('[data-action="timer-stop"]')?.focus({preventScroll:!0})},"timer-earlier"(){let e=Pt();if(!e)return;let t=e.ms-60*1e3;Lt({ms:t,at:G(new Date(t))}),_n(oe())},"timer-stop"(){let e=Pt();Kn(),e&&(ce=Math.max(1,Math.floor((Date.now()-e.ms)/1e3)),je=e.at,Lt(null),Jn(oe(),"stopped",ce),oe().querySelector('[data-action="timer-log"]')?.focus({preventScroll:!0}))},"timer-reset"(){ce=null,je=null,Lt(null),Kn();let e=oe().querySelector(".em-timer");e&&(e.outerHTML=Fa()),oe().querySelector('[data-action="timer-start"]')?.focus({preventScroll:!0})},"timer-log"(){let e=ce||0,t=je||`${g()}T${de()}`;ce=null,je=null,Me(),Hn({at:t,duration:e})},"print-card"(e,t){if(!document.getElementById("print-card"))return;let n=navigator.userAgent,s=/iPad|iPhone|iPod/.test(n)||/Macintosh/.test(n)&&navigator.maxTouchPoints>1,a=window.navigator.standalone===!0||window.matchMedia("(display-mode: standalone)").matches;if(s&&a){m("To print, open this page in Safari. Home-screen apps can\u2019t print on iPhone or iPad.","bad");return}Un(t),window.print()}};var es={};be(es,{actions:()=>vi,render:()=>ii,showConflict:()=>Zn,subtitle:()=>ri,title:()=>oi});function oi(){return"You"}function ri(e){return e.profile.school||"Your details and settings"}var Wa=[["name","Name","Maya Ellison"],["pronouns","Pronouns","she/her"],["grade","Grade","11th grade"],["school","School","Rosewood High School"],["seizureType","Seizure type","Focal impaired awareness"],["diagnosed","Diagnosed","2022"],["neurologist","Neurologist","Dr. Raghavan"],["neuroPhone","Neurologist phone","(555) 010-4488"],["allergies","Allergies","Penicillin"],["bloodType","Blood type","O+"],["rescueMed","Rescue medication","From your seizure action plan","Only if your seizure action plan has one: what it is, when it is given, and where it is kept. Copy it from the plan your doctor or school nurse gave you. Leave it blank if you don\u2019t have one."]];function ii(e){return p`
    <div class="split-grid">
      <div class="split-main">
        ${o(ci(e))}
        ${o(li(e))}
      </div>
      <div class="split-side">
        ${o(di(e))}
        ${o(hi(e))}
        ${o(fi(e))}
        ${o(yi(e))}
        ${o(gi())}
      </div>
    </div>
  `}function ci(e){let{profile:t}=e,n=ye(e),s=[t.pronouns,t.grade].filter(Boolean).join(" \xB7 "),a=rt(t.name);return p`
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
  `}function li(e){let{profile:t}=e,n=Wa.map(([s,a])=>`
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
  `}function Ya(e){let t=Date.parse(e);if(!t)return"";let n=Math.round((Date.now()-t)/6e4);if(n<1)return"just now";if(n<60)return`${n} min ago`;let s=Math.round(n/60);return s<24?`${s} h ago`:new Date(t).toLocaleDateString(void 0,{month:"short",day:"numeric"})}var Qn={"signed-out":"Sign in to Flux again to keep syncing.",offline:"Offline. It will sync when you\u2019re back online.","not-ready":"Sync isn\u2019t switched on for Flux yet.","wrong-key":"This device\u2019s sync key doesn\u2019t open the synced copy.",gone:"Turned off: the synced copy was deleted on another device."};function _a(){let e=Tt();if(!Z())return e.error==="gone"?Qn.gone:e.account?"Off. Encrypted on this device before it leaves, so Flux can\u2019t read it.":"Sign in to Flux to keep Synara the same on your phone and computer.";if(e.phase==="syncing")return"Syncing\u2026";if(e.phase==="conflict")return"Changed on two devices. Choose which to keep.";if(e.phase==="error")return Qn[e.error]||"Couldn\u2019t sync. It will try again.";let t=ra();return t?`On \xB7 synced ${Ya(t)}`:"On"}function di(e){return pn()?p`
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
                  aria-checked="${!!e.settings.fluxLink}" aria-labelledby="fluxlink-label"></button>
        </div>
        <button class="list-row" data-action="sync-open">
          <span class="med-dot" data-color="blue" aria-hidden="true">${o(c("sync",20))}</span>
          <span class="row-body">
            <span class="row-t">Sync across your devices</span>
            <span class="row-s">${_a()}</span>
          </span>
          <span class="chev">${o(c("chevron"))}</span>
        </button>
      </div>
    </section>
  `:""}var Ba=p`
  <ul class="sheet-list">
    <li>${o(c("lock",16))}<span>Synara encrypts everything on this device before it leaves. Flux stores
      a locked copy it can’t open — not your medication, seizures or contacts.</span></li>
    <li>${o(c("info",16))}<span>The key stays on your devices. You’ll get a <strong>sync key</strong> to
      enter on your other devices. If you lose every device and the key, the synced copy can’t be
      opened — but each device keeps its own.</span></li>
  </ul>
`;async function Gn(){let e=await xt();if(!Z()&&!e){N({title:"Sync across your devices",body:p`
        <p class="sheet-message">Sign in to your Flux account, then come back here to keep Synara the
          same on your phone and computer.</p>
        ${o(Ba)}
      `,footer:`
        <button class="btn btn-quiet" data-action="close-sheet">Not now</button>
        <a class="btn btn-primary" href="index.html">Sign in to Flux</a>
      `});return}if(!Z()){N({title:"Sync across your devices",body:p`
        <p class="sheet-message">Signed in to Flux as <strong>${e.email||"your account"}</strong>.</p>
        ${o(Ba)}
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
      `});return}let t=Tt();N({title:"Sync is on",body:p`
      <p class="sheet-message">${_a()}${o(t.account?` \xB7 ${d(t.account.email)}`:"")}</p>
      <div class="sync-key">
        <span class="label">Your sync key</span>
        <code class="mono">${gn()}</code>
        <span class="t-sm ink-3">Enter it on your other devices in You → Flux → Sync. Keep it private:
          anyone with it and your Flux sign-in could read your synced copy.</span>
      </div>
      <div class="stack stack-2 mt-3">
        <button class="btn btn-outline btn-block" data-action="sync-copy-key">Copy sync key</button>
        <button class="btn btn-outline btn-block" data-action="sync-now">Sync now</button>
        <button class="btn btn-quiet btn-block" data-action="sync-stop">Turn off on this device</button>
        <button class="btn btn-quiet btn-block text-bad" data-action="sync-stop-delete">Turn off and delete the synced copy</button>
      </div>
    `})}function Zn(){N({title:"Which copy should Synara keep?",body:p`
      <p class="sheet-message">Synara changed on this device and on another one since they last
        synced. Pick the copy to keep; the other will be replaced.</p>
    `,footer:`
      <button class="btn btn-outline" data-action="sync-resolve" data-choice="cloud">Use the other device\u2019s</button>
      <button class="btn btn-primary" data-action="sync-resolve" data-choice="device">Keep this device\u2019s</button>
    `})}var ui=[[0,"On time"],[10,"10 min early"],[15,"15 min early"],[30,"30 min early"]];function Ka(e){return e.settings.remindersOn&&ze().ok&&re()==="granted"}function pi(e,t,n,s){return t.ok?n==="denied"?"Notifications are blocked for this site in your browser settings.":e.settings.remindersOn&&!s?"Not allowed on this device yet. Turn this on to allow notifications.":s&&_s()?"Your last reminder didn\u2019t show on this device. Keep a phone alarm for your doses.":s?"On \u2014 while Synara is open in a tab or installed.":"A nudge at each dose time.":t.reason}function hi(e){let{reminderLead:t}=e.settings,n=ze(),s=re(),a=!n.ok||s==="denied",r=Ka(e),i=pi(e,n,s,r),l=ui.map(([h,u])=>`
    <button class="segment" data-action="reminder-lead" data-value="${h}"
            aria-pressed="${h===t}">${u}</button>`).join("");return p`
    <section class="section" aria-labelledby="rem-h">
      <h2 id="rem-h">Reminders</h2>
      <div class="card card-flush">
        <div class="list-row list-row-static">
          <span class="med-dot" data-color="amber" aria-hidden="true">${o(c("bell",20))}</span>
          <span class="row-body">
            <span class="row-t" id="rem-label">Dose reminders</span>
            <span class="row-s">${i}</span>
          </span>
          <button class="switch" data-action="reminders-toggle" role="switch"
                  aria-checked="${r}" aria-labelledby="rem-label"
                  ${o(a?"disabled":"")}></button>
        </div>
        ${o(r?`
          <div class="list-row list-row-static list-row-stack">
            <span class="row-t">When to remind you</span>
            <div class="segments segments-wrap" role="group" aria-label="Reminder timing">${l}</div>
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
  `}var mi=[["system","Match device"],["light","Light"],["dark","Dark"]];function fi(e){let t=e.settings.theme||"system",n=mi.map(([s,a])=>`
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
  `}function yi(e){let t=(e.seizures||[]).length,n=Object.keys(e.doses||{}).length,s=Object.keys(e.checkins||{}).length;return p`
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
  `}function gi(){return p`
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
          ${o(Te())}
          <span class="t-sm ink-3">Built and hosted by Flux, the free planner for school.</span>
        </div>
      </div>
    </section>
  `}function bi(e){let t=Array.isArray(e.meds)?e.meds.length:0,n=Array.isArray(e.seizures)?e.seizures.length:0,s=e.doses&&typeof e.doses=="object"?Object.keys(e.doses).length:0,a=e.profile&&typeof e.profile.name=="string"&&e.profile.name.trim();return`${a?`${a.slice(0,80)}'s record: `:""}${T(t,"medication")}, ${T(s,"day")} of doses, ${T(n,"seizure")}.`}var vi={"profile-edit"(e,t){let n=t.profile,s=Wa.map(([a,r,i,l])=>`
      <div class="field">
        <label class="label" for="p-${a}">${r}</label>
        <input class="input" id="p-${a}" name="${a}" value="${d(n[a]||"")}"
               placeholder="${d(i)}" autocomplete="off" maxlength="200"${l?` aria-describedby="p-${a}-hint"`:""} />
        ${l?`<span class="hint" id="p-${a}-hint">${d(l)}</span>`:""}
      </div>`).join("");N({title:"Your details",body:p`<form class="stack stack-4" data-action="profile-save" novalidate>${o(s)}</form>`,footer:'<button class="btn btn-primary" data-action="profile-save">Save</button>'})},async"profile-save"(){await ft(Y()),E(),m("Details saved","ok")},async"reminders-toggle"(e,t){let n=!Ka(t);if(n){let s=ze();if(!s.ok){m(s.reason,"bad");return}if(await Ys()!=="granted"){m("Notifications weren't allowed","bad");return}}await se({remindersOn:n}),m(n?"Reminders on":"Reminders off",n?"ok":"default")},async"reminder-lead"(e){await se({reminderLead:Number(e.dataset.value)||0})},async"reminders-test"(){let e=await Js();e==="sent"?m("Test sent \u2014 check your notifications","ok"):e==="not-allowed"?m("Notifications aren\u2019t allowed for Synara on this device","bad"):m("This browser didn\u2019t show it. Keep a phone alarm for your doses.","bad")},async"theme-set"(e){await se({theme:e.dataset.theme})},"data-export"(e,t){let n=new Blob([yt()],{type:"application/json"}),s=URL.createObjectURL(n),a=document.createElement("a"),r=(t.profile.name||"backup").replace(/[^\w-]+/g,"-").toLowerCase();a.href=s,a.download=`synara-${r}-${g()}.json`,document.body.appendChild(a),a.click(),a.remove(),setTimeout(()=>URL.revokeObjectURL(s),1e3),m("Backup downloaded","ok")},async"data-import"(e){let t=e.files&&e.files[0];if(e.value="",!t)return;if(t.size>5*1024*1024){m("That file is too large to be a Synara backup","bad");return}let n=await t.text(),s=null;try{s=JSON.parse(n)}catch{}if(!en(s)){m("That file isn't a Synara backup","bad");return}H({title:"Replace everything with this backup?",message:`${bi(s)} Everything currently on this device will be replaced. Download a backup of what's here first if you might need it.`,confirmLabel:"Restore backup",danger:!1,async onConfirm(){try{await gt(n),m("Backup restored","ok")}catch(a){m(a.message==="save-failed"?"Couldn\u2019t restore it \u2014 your browser storage may be full or blocked.":"Couldn't read that backup","bad")}}})},"data-demo"(){let e=Z();H({title:"Load example data?",message:"Everything on this device will be replaced with a made-up student's record. Download a backup first if any of what's here is real."+(e?" Sync turns off on this device first, so the example never reaches your other devices.":""),confirmLabel:"Load example data",async onConfirm(){e&&await Ne(),await We({seedFn:zt}),m("Example data loaded","ok")}})},"data-wipe"(){H({title:"Delete everything?",message:"Every medication, dose, seizure, check-in, contact, and your safety card will be removed from this device. This can't be undone.",confirmLabel:"Delete everything",async onConfirm(){await Ne(),await ks();try{sessionStorage.removeItem("synara.timer")}catch{}history.replaceState(null,"",location.pathname),location.reload()}})},async"flux-link-toggle"(e,t){let n=!t.settings.fluxLink;await se({fluxLink:n}),m(n?"Your dose times now show in your Flux Planner":"Removed from your Flux Planner","ok")},"sync-open"(){return Gn()},async"sync-start-new"(){try{await $n(),await E(),m("Sync is on","ok"),Gn()}catch(e){e.code==="has-copy"?wi():m(ge(e),"bad")}},async"sync-join-check"(){let{key:e}=Y(),t;try{t=await ua(e)}catch(n){m(ge(n),"bad");return}H({title:"Use your synced copy here?",message:`Your synced copy, updated ${Ya(t.updatedAt)}, has ${T(t.meds,"medication")} and ${T(t.seizures,"logged seizure")}${t.name?` for ${t.name}`:""}. It will replace what is on this device now.`,confirmLabel:"Use synced copy",danger:!1,async onConfirm(){try{await pa(t.key),m("This device is synced","ok")}catch(n){m(ge(n),"bad")}}})},async"sync-copy-key"(){try{await navigator.clipboard.writeText(gn()),m("Sync key copied","ok")}catch{m("Couldn\u2019t copy. Select the key and copy it instead.","bad")}},async"sync-now"(){await E();let e=await Ce();e==="error"?m(ge(Tt()),"bad"):e!=="conflict"&&m("Synced","ok")},"sync-stop"(){H({title:"Turn off sync on this device?",message:"This device keeps everything it has. Your synced copy and your other devices are not changed.",confirmLabel:"Turn off",danger:!1,async onConfirm(){await Ne(),m("Sync is off on this device","ok")}})},"sync-stop-delete"(){H({title:"Delete the synced copy?",message:"The encrypted copy in your Flux account is deleted and sync stops on every device. Each device keeps its own record.",confirmLabel:"Delete synced copy",async onConfirm(){try{await Ne({deleteCopy:!0}),m("Synced copy deleted","ok")}catch(e){m(ge(e),"bad")}}})},async"sync-resolve"(e){await E();try{await da(e.dataset.choice),m("Synced","ok")}catch(t){m(ge(t),"bad")}},"sync-fresh"(){H({title:"Delete the old synced copy?",message:"Only do this if you no longer have the device or the sync key it was made with. The old copy is deleted and this device becomes the new one to sync from.",confirmLabel:"Delete and start fresh",async onConfirm(){try{await Ne({deleteCopy:!0}),await $n(),m("Sync is on","ok"),Gn()}catch(e){m(ge(e),"bad")}}})}};function ge(e){let t=e&&(e.code||e.error||e.message)||"";return t==="bad-key"?"That isn\u2019t a sync key. It\u2019s 26 letters and numbers.":t==="no-copy"?"There\u2019s no synced copy in this Flux account yet. Turn sync on from your other device first.":t==="wrong-key"?"That key doesn\u2019t open your synced copy. Check it on your other device.":Qn[t]||"Couldn\u2019t sync. Please try again."}function wi(){N({title:"You already have a synced copy",body:p`
      <p class="sheet-message">Your Flux account already has a synced copy of Synara. To use it here,
        enter the sync key from the device where you turned sync on (You → Flux → Sync).</p>
      <p class="sheet-message">Lost that device and its key? You can delete the old copy and start
        again from this one.</p>
    `,footer:`
      <button class="btn btn-quiet" data-action="sync-open">Enter a sync key</button>
      <button class="btn btn-danger" data-action="sync-fresh">Start fresh</button>
    `})}var ns={home:Ln,meds:In,track:qn,safety:Xn,you:es},ss=["home","meds","track","safety","you"],as={home:{label:"Home",icon:"home"},meds:{label:"Meds",icon:"pill"},track:{label:"Seizures",icon:"chart"},safety:{label:"Safety",icon:"shield"},you:{label:"You",icon:"user"}},Va={sos:"safety"},K="home",_={shell:document.querySelector(".app-shell"),appbar:document.getElementById("appbar"),screen:document.getElementById("screen"),tabbar:document.getElementById("tabbar")},Ja=document.documentElement.dataset.host==="flux",qt=document.querySelector("[data-flux-hub]");function Xa(){let e=(location.hash||"").replace(/^#\/?/,"").split(/[/?]/)[0];return Va[e]?{route:Va[e],sos:e==="sos"}:{route:ss.includes(e)?e:"home",sos:!1}}function $i(e){ss.includes(e)&&location.hash!==`#/${e}`&&(location.hash=`#/${e}`)}function Ga(e){let t=document.documentElement;e==="light"||e==="dark"?t.setAttribute("data-theme",e):t.removeAttribute("data-theme");let n=e==="dark"||e!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches;for(let s of document.querySelectorAll('meta[name="theme-color"]'))s.content=e==="system"?s.media.includes("dark")?"#121019":"#f6f5fa":n?"#121019":"#f6f5fa"}function ki(e){let t=g();return D(t,e).filter(({med:n,time:s})=>R(t,n.id,s,e)==="pending").length}function Si(e){let t=ki(e);_.tabbar.innerHTML=p`
    <div class="sidebar-brand">
      <div class="brand-mark">${o(kt())}</div>
      <div>
        <div class="brand-name">Synara</div>
        <div class="brand-tag">Epilepsy care for school</div>
      </div>
    </div>
    ${o(ss.map(n=>{let s=as[n],a=n===K,r=n==="meds"&&t>0,i=r?`${s.label}, ${t} ${t===1?"dose":"doses"} not logged today`:s.label;return`
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
    ${o(Te("sidebar-powered"))}
  `}function xi(e){let t=ns[K],n=t.title?t.title(e):as[K].label,s=t.subtitle?t.subtitle(e):"";_.appbar.innerHTML=p`
    <div class="appbar-title">
      <h1 class="appbar-t">${n}</h1>
      ${o(s?`<span class="appbar-s">${d(s)}</span>`:"")}
    </div>
    <button class="sos-btn" data-action="open-emergency"
            aria-label="Open the emergency seizure card">
      ${o(c("shield",16))}<span>SOS</span>
    </button>
  `,qt&&_.appbar.insertBefore(qt,_.appbar.querySelector(".sos-btn"))}function Mi(){let e=ws();if(e==="ok")return"";let t=e==="memory";return p`
    <div class="insight save-notice" data-tone="watch">
      <span class="insight-ico" aria-hidden="true">${o(c("alert",20))}</span>
      <span class="insight-body">
        <span class="insight-t">${t?"Not saving on this device":"Changes aren\u2019t saving right now"}</span>
        <span class="insight-d">${t?"Your browser isn\u2019t letting Synara save, so what you add will be gone when you close it. Download a backup to keep it. The emergency card still works.":"Your browser\u2019s storage is full or blocked. What you see is what was last saved. The emergency card still works."}</span>
        ${o(t?'<button class="btn btn-sm btn-outline mt-3" data-action="data-export">Download a backup</button>':"")}
      </span>
    </div>
  `}function Ti(e){_.screen.innerHTML=p`
    <div class="screen-inner" data-route="${K}">${o(Mi())}${o(ns[K].render(e))}</div>
  `}function tt(){let e=O(),t=_.screen.scrollTop,n=document.activeElement,s=qt&&qt.contains(n),a=n&&!s&&_.shell.contains(n)?nn(n):null;document.title=`${as[K].label} \xB7 Synara`,Ga(e.settings.theme),Us(e),Si(e),xi(e),Ti(e),_.screen.scrollTop=t,a?sn(a,_.shell):s&&n.focus()}var ts={nav(e){$i(e.dataset.to)},"close-sheet"(){E()},"close-emergency"(){Me()},"open-emergency"(){Ht(O())},"setup-go"(e){Bs()&&Je(),Ft(e.dataset.target,e)},reload(){location.reload()}};for(let e of[...Object.values(ns),Cn])if(e.actions)for(let[t,n]of Object.entries(e.actions))ts[t]&&console.warn(`[synara] duplicate action "${t}"`),ts[t]=n;function Ft(e,t){let n=ts[e];return n?(Promise.resolve(n(t,O())).catch(s=>{console.error("[synara] action failed:",e,s),m(s&&s.message==="save-failed"?"Could not save \u2014 your browser storage may be full or blocked.":"Something went wrong. Please try that again.","bad")}),!0):!1}document.addEventListener("click",e=>{let t=e.target.closest("[data-action]");!t||t.tagName==="FORM"||Ft(t.dataset.action,t)&&e.preventDefault()});document.addEventListener("submit",e=>{let t=e.target.closest("form[data-action]");t&&(e.preventDefault(),Ft(t.dataset.action,t))});document.addEventListener("change",e=>{let t=e.target.closest("[data-change]");t&&Ft(t.dataset.change,t)});function Ua(){let e=Xa();e.route!==K&&(K=e.route,Ve()&&!e.sos&&Me(),E(),_.screen.scrollTop=0,tt()),e.sos&&Qa()}function Qa(e){Ht(O(),e),history.replaceState(null,"","#/safety")}function Ei(){let e=g();setInterval(()=>{if(Ve())return;let t=g();t!==e&&Ee(),(K==="home"||t!==e)&&tt(),e=t},6e4)}function zi(){let e=[...document.querySelectorAll('script[src], link[rel="stylesheet"][href]')].map(t=>t.getAttribute("src")||t.getAttribute("href")).filter(t=>!/^([a-z]+:)?\/\//i.test(t));for(let t of[location.pathname,...e])fetch(t).catch(()=>{})}function Ci(){if(!("serviceWorker"in navigator)||location.protocol==="file:")return;let e=()=>{(Ja?navigator.serviceWorker.register(new URL("service-worker.js",location.href),{updateViaCache:"none"}):navigator.serviceWorker.register("sw.js")).catch(n=>{console.warn("[synara] service worker not registered:",n)})};Ja&&navigator.serviceWorker.addEventListener("controllerchange",zi),document.readyState==="complete"?e():window.addEventListener("load",e,{once:!0})}async function Ai(){let e=Xa();K=e.route;let{firstRun:t}=await $s();te(tt),tt(),t&&e.sos?Qa({onClose:()=>setTimeout(()=>{!cn()&&!Ve()&&Dt()})}):t?Dt():e.sos&&Ua(),window.addEventListener("hashchange",Ua),window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>Ga(O().settings.theme)),Vs(),Ci(),Ei(),oa(n=>{K==="you"&&tt(),n.phase==="conflict"&&!cn()&&!Ve()&&Zn()}),ha()}Ai().catch(e=>{console.error("[synara] failed to start:",e),_.screen.innerHTML=p`
    <div class="screen-inner">
      <div class="empty">
        <span class="empty-ico">${o(c("alert",32))}</span>
        <span class="empty-t">Synara couldn't start</span>
        <span class="empty-s">
          Reloading the page usually fixes it. The emergency card still opens from here.
        </span>
        <button class="btn btn-primary" data-action="open-emergency">
          ${o(c("shield",18))} Open emergency card
        </button>
        <button class="btn btn-outline" data-action="reload">Reload</button>
      </div>
    </div>
  `});})();
