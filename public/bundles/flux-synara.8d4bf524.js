(()=>{var Oo=Object.defineProperty;var Me=(e,t)=>{for(var n in t)Oo(e,n,{get:t[n],enumerable:!0})};function u(e){return e==null?"":String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}var zs=Symbol("raw");function r(e){return{[zs]:!0,value:String(e??"")}}function Ds(e){return e==null?"":Array.isArray(e)?e.map(Ds).join(""):typeof e=="object"&&e[zs]?e.value:u(e)}function m(e,...t){let n=e[0];for(let s=0;s<t.length;s++)n+=Ds(t[s])+e[s+1];return n}var pe=e=>String(e).padStart(2,"0");function g(e=new Date){return`${e.getFullYear()}-${pe(e.getMonth()+1)}-${pe(e.getDate())}`}function se(e=new Date){return`${g(e)}T${pe(e.getHours())}:${pe(e.getMinutes())}`}function he(e=new Date){return`${pe(e.getHours())}:${pe(e.getMinutes())}`}function ne(e){let[t,n,s]=String(e).split("-").map(Number);return new Date(t,n-1,s)}function W(e){let[t,n="00:00"]=String(e).split("T"),[s,a,o]=t.split("-").map(Number),[i,c]=n.split(":").map(Number);return new Date(s,a-1,o,i||0,c||0)}function B(e){let[t,n]=String(e).split(":").map(Number);return(t||0)*60+(n||0)}function S(e,t){let n=ne(e);return n.setDate(n.getDate()+t),g(n)}function Ye(e,t){let n=ne(t)-ne(e);return Math.round(n/864e5)}function Ns(e,t=g()){let n=[];for(let s=e-1;s>=0;s--)n.push(S(t,-s));return n}var Ls=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],js=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],Ke=e=>Ls[e],Is=e=>js[e];function q(e){let[t,n]=String(e).split(":").map(Number),s=t>=12?"PM":"AM";return`${t%12===0?12:t%12}:${pe(n||0)} ${s}`}function X(e,{relative:t=!0}={}){let n=g();if(t){if(e===n)return"Today";if(e===S(n,-1))return"Yesterday";if(e===S(n,1))return"Tomorrow"}let s=ne(e);return`${js[s.getDay()]}, ${Ls[s.getMonth()]} ${s.getDate()}`}function gt(e){let t=Math.max(0,Math.round(e));if(t<1)return"now";if(t<60)return`${t}m`;let n=Math.floor(t/60),s=t%60;return s?`${n}h ${s}m`:`${n}h`}function Ue(e){let t=Math.max(0,Math.round(e));if(t<60)return`${t} sec`;let n=Math.floor(t/60),s=t%60;return s?`${n} min ${s} sec`:`${n} min`}function Rs(e){let[t,n]=String(e).split("T");return`${X(t)} at ${q(n||"00:00")}`}function Ps(e,t=new Date){let n=W(e),s=Math.round((t.getTime()-n.getTime())/6e4);if(s<1)return"just now";if(s<60)return`${s}m ago`;let a=Ye(g(n),g(t));if(s<1440||a<1)return`${Math.floor(s/60)}h ago`;if(a===1)return"yesterday";if(a<30)return`${a} days ago`;let o=Math.round(a/30);return o===1?"a month ago":`${o} months ago`}function I(e="id"){return`${e}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`}var bt=(e,t,n)=>Math.min(n,Math.max(t,e)),zo=/^(.*\d.*?)\s*(?:ext(?:ension)?\.?|x|#)\s*(\d+)\s*$/i,Do=/^\s*(?:ext(?:ension)?\.?|x|#)\s*\d+\s*$/i;function qs(e){let t=String(e||"");if(Do.test(t))return{main:"",ext:t.replace(/\D/g,"")};let n=t.match(zo);return n?{main:n[1],ext:n[2]}:{main:t,ext:""}}function cn(e){let{main:t,ext:n}=qs(e);return`tel:${t.replace(/[^\d+]/g,"")}${n?`,${n}`:""}`}function vt(e){return(qs(e).main.match(/\d/g)||[]).length>=3}function wt(e){return String(e||"").trim().split(/\s+/).slice(0,2).map(t=>t[0]||"").join("").toUpperCase()}function ln(e){let t=new Map;for(let n of e)n==null||n===""||t.set(n,(t.get(n)||0)+1);return[...t.entries()].map(([n,s])=>({value:n,count:s})).sort((n,s)=>s.count-n.count)}function T(e,t,n="s"){return`${e} ${t}${e===1?"":n}`}function Je(e,t){if(e==="taken")return"Taken";if(e==="late")return"Taken late";if(e==="missed")return"Missed";let n=B(he())-B(t);return n<0?"Scheduled":n<=60?"Due now":`${gt(n)} overdue`}var $t="synara.v2",Hs=3,Bs={name:"local",async read(){try{let e=localStorage.getItem($t);return e?JSON.parse(e):null}catch(e){return console.warn("[synara] could not read local state:",e),null}},async write(e){try{return localStorage.setItem($t,JSON.stringify(e)),!0}catch(t){throw console.error("[synara] could not save state:",t),new Error("save-failed")}},async clear(){try{localStorage.removeItem($t)}catch(e){console.warn("[synara] could not clear state:",e)}}},Ve=Bs;function fe(){return{v:Hs,profile:{name:"",pronouns:"",grade:"",school:"",seizureType:"",diagnosed:"",neurologist:"",neuroPhone:"",allergies:"",bloodType:"",rescueMed:""},meds:[],doses:{},seizures:[],checkins:{},contacts:[],card:{looksLike:"",during:["Stay with them and start timing the seizure.","If they are stiffening or shaking, gently help them down to the floor.","Move anything hard or sharp out of the way.","If they are on the floor, put something soft under their head.","Loosen anything tight around their neck.","If they are not aware or not awake, gently turn them onto their side.","If they are confused or wandering, stay beside them and gently guide them away from danger, like stairs, roads, or water. Don't grab or hold them.","If they have a seizure action plan, follow it. Only give rescue medicine if you are trained to.","Stay calm and speak normally \u2014 they may be able to hear you."],doNot:["Do NOT put anything in their mouth. They cannot swallow their tongue.","Do NOT hold them down or try to stop the movements.","Do NOT give food, drink, or pills until they are fully awake.","Do NOT crowd them \u2014 ask other people to step back."],after:["Stay with them until they are fully alert and know where they are.","Tell them calmly what happened \u2014 they may not remember.","Let them rest somewhere quiet.","Call their emergency contact.","Write down the time it started and how long it lasted."],callEms:["The seizure lasts longer than 5 minutes.","A second seizure starts soon after the first.","They do not wake up or return to normal afterwards.","They are having trouble breathing, or their lips stay blue.","They were injured, or it happened in water.","It looks different from their usual seizures.","They have diabetes or a heart condition, or are pregnant.","Rescue medicine was given, or their seizure plan says to call."],forTeacher:"",forNurse:"",forCoach:"",updated:""},settings:{theme:"system",remindersOn:!1,reminderLead:0,quietHours:null,seeded:!1,fluxLink:!1,noMeds:!1,setupHidden:!1}}}var No=/^[A-Za-z0-9_-]{1,64}$/,Lo=/^\d{4}-\d{2}-\d{2}$/,jo=/^([01]\d|2[0-3]):[0-5]\d$/,Io=/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/,Ws=new Set(["taken","late","missed"]),hn=new Set(["violet","mint","amber","rose","blue"]),mn=new Set(["tablet","capsule","liquid","patch","injection","other"]),Ro=new Set(["system","light","dark"]),Te=e=>typeof e=="string"&&Lo.test(e),x=(e,t=4e3)=>typeof e=="string"?e.slice(0,t):"",Ae=600,Po={rescueMed:Ae},_s=(e,t)=>x(t,Po[e]||200),kt=(e,t,n,s)=>typeof e=="number"&&Number.isFinite(e)?Math.min(n,Math.max(t,e)):s,qo=e=>Array.isArray(e)?e.map(t=>x(t,600)).filter(Boolean).slice(0,30):null,fn=(e,t)=>typeof e=="string"&&No.test(e)?e:I(t),Xe=e=>typeof e=="string"&&jo.test(e),Ee=e=>typeof e=="string"&&Io.test(e);function Ce(e){return Array.isArray(e)?[...new Set(e.filter(Xe))].sort():[]}function Fo(e,t){let n=g(),s=Te(e.added)?e.added:t||n,a;Array.isArray(e.schedule)&&e.schedule.length?a=e.schedule.filter(i=>i&&Te(i.from)).map(i=>({from:i.from,times:Ce(i.times)})).sort((i,c)=>i.from<c.from?-1:i.from>c.from?1:0):a=[{from:s,times:Ce(e.times)}],a.length||(a=[{from:s,times:[]}]),a[0].from=s;let o=Te(e.ended)?e.ended:null;return!o&&e.active===!1&&(o=n),{id:fn(e.id,"med"),name:x(e.name,120),dose:x(e.dose,60),form:mn.has(e.form)?e.form:"tablet",notes:x(e.notes,600),color:hn.has(e.color)?e.color:"violet",added:s,addedAt:Xe(e.addedAt)?e.addedAt:null,ended:o,schedule:a}}function Ho(e,t){let n={};if(!e||typeof e!="object")return n;for(let[s,a]of Object.entries(e)){if(!Te(s)||!a||typeof a!="object")continue;let o={};for(let[i,c]of Object.entries(a)){let[f,l]=i.split("|");!t.has(f)||!Xe(l)||!c||!Ws.has(c.status)||(o[i]={status:c.status,at:Ee(c.at)?c.at:`${s}T00:00`})}Object.keys(o).length&&(n[s]=o)}return n}function yn(e){return!e||!Ee(e.at)?null:{id:fn(e.id,"sz"),at:e.at,duration:Math.round(kt(Number(e.duration),0,7200,0)),type:x(e.type,80),trigger:x(e.trigger,80),place:x(e.place,120),aura:x(e.aura,300),injury:e.injury===!0,emsCalled:e.emsCalled===!0,notes:x(e.notes,4e3),logged:Ee(e.logged)?e.logged:e.at}}function Bo(e){let t={};if(!e||typeof e!="object")return t;for(let[n,s]of Object.entries(e)){if(!Te(n)||!s||typeof s!="object")continue;let a=kt(s.stress,1,5,null);t[n]={sleepHours:kt(s.sleepHours,0,24,null),sleepQuality:["poor","ok","good"].includes(s.sleepQuality)?s.sleepQuality:null,stress:a==null?null:Math.round(a),mood:["low","ok"].includes(s.mood)?s.mood:null,notes:x(s.notes,600),at:Ee(s.at)?s.at:`${n}T00:00`}}return t}function Wo(e){return!e||typeof e!="object"?null:{id:fn(e.id,"c"),name:x(e.name,120),relation:x(e.relation,80),phone:x(e.phone,40),primary:e.primary===!0}}function _o(e){let t=new Map;if(!e||typeof e!="object")return t;for(let n of Object.keys(e).sort())for(let s of Object.keys(e[n]||{})){let a=s.split("|")[0];t.has(a)||t.set(a,n)}return t}var gn=(e,t)=>e.at<t.at?1:e.at>t.at?-1:0,xt=new Set(["during","doNot","callEms"]);function Ys(e){return[...fe().card[e]||[]]}var dn={during:["Stay with them and start timing the seizure.","Move anything hard or sharp out of the way.","Put something soft under their head.","Loosen anything tight around their neck.","If they are not aware or not awake, gently turn them onto their side.","Stay calm and speak normally \u2014 they may be able to hear you."],doNot:["Do NOT put anything in their mouth. They cannot swallow their tongue.","Do NOT hold them down or try to stop the movements.","Do NOT give food, drink, or pills until they are fully awake.","Do NOT crowd them \u2014 ask other people to step back."],callEms:["The seizure lasts longer than 5 minutes.","A second seizure starts soon after the first.","They do not wake up or return to normal afterwards.","They are having trouble breathing, or their lips stay blue.","They were injured, or it happened in water."]},Yo={during:[dn.during],doNot:[dn.doNot,["Do NOT put anything in their mouth \u2014 they cannot swallow their tongue. Rescue medicine from their seizure plan is the only exception.","Do NOT hold them down or try to stop the movements.","Do NOT give food, drink, or pills until they are fully awake.","Do NOT crowd them \u2014 ask other people to step back."]],callEms:[dn.callEms]},Ko=(e,t)=>e.length===t.length&&e.every((n,s)=>n===t[s]),Uo=(e,t)=>(Yo[e]||[]).some(n=>Ko(t,n));function Oe(e){let t=fe(),n=e&&typeof e=="object"?e:{},s=_o(n.doses),a=(Array.isArray(n.meds)?n.meds:[]).filter($=>$&&typeof $=="object").map($=>Fo($,s.get($.id))),o=new Set(a.map($=>$.id)),i=(Array.isArray(n.seizures)?n.seizures:[]).map(yn).filter(Boolean).sort(gn),c=(Array.isArray(n.contacts)?n.contacts:[]).map(Wo).filter(Boolean),f=!1;for(let $ of c)$.primary&&f&&($.primary=!1),$.primary&&(f=!0);let l={...t.profile};if(n.profile&&typeof n.profile=="object")for(let $ of Object.keys(t.profile))l[$]=_s($,n.profile[$]);let h={...t.card};if(n.card&&typeof n.card=="object"){for(let $ of["during","doNot","after","callEms"]){let te=qo(n.card[$]);te&&(!te.length&&xt.has($)||Uo($,te)||(h[$]=te))}for(let $ of["looksLike","forTeacher","forNurse","forCoach"])typeof n.card[$]=="string"&&(h[$]=x(n.card[$]));h.updated=Te(n.card.updated)?n.card.updated:""}let p=n.settings&&typeof n.settings=="object"?n.settings:{},b=p.quietHours,z={theme:Ro.has(p.theme)?p.theme:"system",remindersOn:p.remindersOn===!0,reminderLead:Math.round(kt(p.reminderLead,0,120,0)),quietHours:b&&Xe(b.from)&&Xe(b.to)?{from:b.from,to:b.to}:null,seeded:p.seeded===!0,fluxLink:p.fluxLink===!0,noMeds:p.noMeds===!0,setupHidden:p.setupHidden===!0};return{v:Hs,profile:l,meds:a,doses:Ho(n.doses,o),seizures:i,checkins:Bo(n.checkins),contacts:c,card:h,settings:z}}var A=fe(),un=new Set,Ze=!1;function O(){return A}function ae(e){return un.add(e),()=>un.delete(e)}function Ge(){for(let e of un)try{e(A)}catch(t){console.error("[synara] listener threw:",t)}}var me=!1,Qe=!1,St=!1;function Ks(){return Qe?"memory":St?"failing":"ok"}var Jo=e=>JSON.parse(JSON.stringify(e));async function bn(e){try{await Ve.write(e),me=!0,Qe=!1,St=!1}catch(t){if(St=!0,me)throw Ge(),t;Qe=!0}return A=e,Ge(),A}async function R(e){if(!Ze)throw new Error("not-ready");let t=Jo(A);return e(t),bn(t)}function vn(){Ge()}function Vo(e){if(e.key===$t)try{A=e.newValue?Oe(JSON.parse(e.newValue)):fe(),me=!!e.newValue,me&&(Qe=!1),Ze=!0,Ge()}catch(t){console.warn("[synara] ignored an unreadable change from another tab:",t)}}var Fs=!1,Us=null;function Js(){return Us}function wn(){return me||Qe}async function Vs(){!Fs&&Ve===Bs&&typeof window<"u"&&(window.addEventListener("storage",Vo),Fs=!0);let e=await Ve.read();if(Ze=!0,!e)return A=fe(),{state:A,firstRun:!0};if(me=!0,A=Oe(e),JSON.stringify(A)!==JSON.stringify(e)){Us=JSON.stringify(e);try{await Ve.write(A)}catch(t){console.warn("[synara] could not save the upgraded record:",t),St=!0}}return{state:A,firstRun:!1}}async function Xs(){await Ve.clear(),me=!1,A=fe(),Ge()}async function et({seedFn:e}={}){if(!Ze)throw new Error("not-ready");let t=fe();return e&&(e(t),t.settings.seeded=!0),bn(Oe(t))}function Xo(e,t){if(t<e.added)return[];if(e.ended&&t>=e.ended)return[];let n=[];for(let s of e.schedule)if(s.from<=t)n=s.times;else break;if(t===e.added&&e.addedAt){let s=B(e.addedAt)-tt;n=n.filter(a=>B(a)>=s)}return n}function ie(e){let t=e.schedule[e.schedule.length-1];return t?t.times:[]}function $n(e,t=g()){return!e.ended||e.ended>t}function _(e=A){let t=g();return e.meds.filter(n=>$n(n,t))}function L(e,t=A){let n=[];for(let s of t.meds)for(let a of Xo(s,e))n.push({med:s,time:a});return n.sort((s,a)=>B(s.time)-B(a.time)||s.med.name.localeCompare(a.med.name))}function Gs({name:e,dose:t="",form:n="tablet",times:s=[],notes:a="",color:o="violet"}){let i=g();return R(c=>{c.meds.push({id:I("med"),name:x(e,120).trim(),dose:x(t,60).trim(),form:mn.has(n)?n:"tablet",notes:x(a,600).trim(),color:hn.has(o)?o:"violet",added:i,addedAt:he(),ended:null,schedule:[{from:i,times:Ce(s)}]})})}function Qs(e,t){let n=g();return R(s=>{let a=s.meds.find(o=>o.id===e);if(a&&(typeof t.name=="string"&&(a.name=x(t.name,120).trim()),typeof t.dose=="string"&&(a.dose=x(t.dose,60).trim()),typeof t.notes=="string"&&(a.notes=x(t.notes,600).trim()),mn.has(t.form)&&(a.form=t.form),hn.has(t.color)&&(a.color=t.color),Array.isArray(t.times))){let o=Ce(t.times);if(o.join()===ie(a).join())return;let i=a.schedule[a.schedule.length-1];if(i.from===n){i.times=o;let c=a.schedule[a.schedule.length-2];c&&c.times.join()===o.join()&&a.schedule.pop()}else a.schedule.push({from:n,times:o})}})}function Zs(e){let t=g();return R(n=>{let s=n.meds.find(a=>a.id===e);if(s){if(s.added>=t){n.meds=n.meds.filter(a=>a.id!==e);for(let a of Object.keys(n.doses)){for(let o of Object.keys(n.doses[a]))o.startsWith(`${e}|`)&&delete n.doses[a][o];Object.keys(n.doses[a]).length||delete n.doses[a]}return}s.ended=t}})}function ea(e){let t=g();return R(n=>{let s=n.meds.find(o=>o.id===e);if(!s||!s.ended)return;let a=ie(s);s.ended<t&&(s.schedule.push({from:s.ended,times:[]}),s.schedule.push({from:t,times:a})),s.ended=null})}var pn=(e,t)=>`${e}|${t}`;function Mt(e,t,n,s){return R(a=>{if(s==="pending"){a.doses[e]&&(delete a.doses[e][pn(t,n)],Object.keys(a.doses[e]).length||delete a.doses[e]);return}Ws.has(s)&&(a.doses[e]||(a.doses[e]={}),a.doses[e][pn(t,n)]={status:s,at:se()})})}function P(e,t,n,s=A){let a=s.doses[e]&&s.doses[e][pn(t,n)];return a?a.status:"pending"}var tt=60;function ze(e,t,n,s=A){let a=P(e,t,n,s);return a!=="pending"?a:Tt(e,n)>tt?"missed":"pending"}function Tt(e,t){return Math.round((W(se())-W(`${e}T${t}`))/6e4)}function ta({at:e,duration:t=0,type:n="",trigger:s="",place:a="",aura:o="",injury:i=!1,emsCalled:c=!1,notes:f=""}){return R(l=>{let h=yn({id:I("sz"),at:e||se(),duration:Number(t)||0,type:n,trigger:s,place:a,aura:o,injury:!!i,emsCalled:!!c,notes:(f||"").trim(),logged:se()});h&&(l.seizures.push(h),l.seizures.sort(gn))})}function na(e,t){return R(n=>{let s=n.seizures.findIndex(o=>o.id===e);if(s<0)return;let a=yn({...n.seizures[s],...t,id:e});a&&(n.seizures[s]=a,n.seizures.sort(gn))})}function sa(e){return R(t=>{t.seizures=t.seizures.filter(n=>n.id!==e)})}function aa(e,t){return R(n=>{n.checkins[e]={...n.checkins[e]||{},...t,at:se()}})}function nt(e,t=A){return t.checkins[e]||null}function oa({name:e,relation:t="",phone:n,primary:s=!1}){return R(a=>{s&&a.contacts.forEach(o=>{o.primary=!1}),a.contacts.push({id:I("c"),name:x(e,120).trim(),relation:x(t,80).trim(),phone:x(n,40).trim(),primary:!!s})})}function ra(e,t){return R(n=>{let s=n.contacts.find(a=>a.id===e);s&&(t.primary&&n.contacts.forEach(a=>{a.primary=!1}),typeof t.name=="string"&&(s.name=x(t.name,120).trim()),typeof t.relation=="string"&&(s.relation=x(t.relation,80).trim()),typeof t.phone=="string"&&(s.phone=x(t.phone,40).trim()),typeof t.primary=="boolean"&&(s.primary=t.primary))})}function ia(e){return R(t=>{t.contacts=t.contacts.filter(n=>n.id!==e)})}function ca(e){return R(t=>{Object.assign(t.card,e,{updated:g()})})}function Et(e){return R(t=>{for(let n of Object.keys(t.profile))typeof e[n]=="string"&&(t.profile[n]=_s(n,e[n].trim()))})}function ce(e){return R(t=>Object.assign(t.settings,e))}function Ct(){return JSON.stringify(A,null,2)}function kn(e){return!!e&&typeof e=="object"&&Array.isArray(e.meds)&&Array.isArray(e.seizures)&&!!e.doses&&typeof e.doses=="object"}async function At(e){let t;try{t=JSON.parse(e)}catch{throw new Error("not-json")}if(!kn(t))throw new Error("not-synara");if(!Ze)throw new Error("not-ready");return bn(Oe(t))}var v={shell:document.querySelector(".app-shell"),backdrop:document.getElementById("backdrop"),sheet:document.getElementById("sheet"),emergency:document.getElementById("emergency"),welcome:document.getElementById("welcome"),toast:document.getElementById("toast")},la={home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.8V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.8"/>',pill:'<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M8.8 8.8l6.4 6.4"/>',chart:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 15l3.5-4 3 2.5L18 8"/>',shield:'<path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.4-7.5 9.5-4.4-1.1-7.5-4.9-7.5-9.5V6z"/><path d="M12 9v4"/><path d="M12 16h.01"/>',sync:'<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',ribbon:'<path d="M12 13.5c-2.6-3-4-5.4-4-7.2a4 4 0 0 1 8 0c0 1.8-1.4 4.2-4 7.2Z"/><path d="M12 13.5 7.5 21l-2-1.2 4.4-7.3"/><path d="M12 13.5l4.5 7.5 2-1.2-4.4-7.3"/>',user:'<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',chevron:'<path d="m9 6 6 6-6 6"/>',phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',trash:'<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-.8 14a1 1 0 0 1-1 1H6.8a1 1 0 0 1-1-1L5 6"/>',print:'<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',wave:'<path d="M2 12c2.5-3 4.5-3 7 0s4.5 3 7 0 4.5-3 6 0"/><path d="M2 17c2.5-3 4.5-3 7 0s4.5 3 7 0 4.5-3 6 0" opacity=".5"/>',bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',pin:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',"trend-up":'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',"trend-down":'<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',down:'<path d="M12 4v12"/><path d="m6 10 6 6 6-6"/><path d="M4 20h16"/>',up:'<path d="M12 20V8"/><path d="m6 14 6-6 6 6"/><path d="M4 4h16"/>',check:'<path d="M20 6 9 17l-5-5"/>',note:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5"/><path d="M10 2h4"/><path d="M12 2v3"/>',book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',school:'<path d="M3 10 12 5l9 5-9 5z"/><path d="M7 12v5c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5v-5"/><path d="M21 10v6"/>',stethoscope:'<path d="M5 3v6a5 5 0 0 0 10 0V3"/><path d="M10 14v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',run:'<circle cx="14" cy="4" r="2"/><path d="m8 21 3-6 3 2v5"/><path d="M6 12l3-3 4 1 3 3 3 1"/><path d="m11 15-2-4"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',sparkle:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6.3 6.3 2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',play:'<path d="M7 4v16l13-8z"/>',archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>'};function d(e,t=24){let n=la[e]||la.info;return`<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${n}</svg>`}var Go=["action","id","med","time","day","tab","to","field","value","theme"];function It(e){return!e||!e.dataset||!e.dataset.action?null:Go.filter(t=>e.dataset[t]!=null).map(t=>`[data-${t}="${CSS.escape(e.dataset[t])}"]`).join("")}function Mn(e,t=document){if(!e)return!1;for(let n of t.querySelectorAll(e))if(n.focus({preventScroll:!0}),document.activeElement===n)return!0;return!1}function Tn(e,t){e&&e.isConnected?e.focus({preventScroll:!0}):Mn(t),v.shell&&!v.shell.contains(document.activeElement)&&document.getElementById("screen")?.focus({preventScroll:!0})}var Dt=new Set;function ua(e){v.shell&&(e?v.shell.setAttribute("inert",""):v.shell.removeAttribute("inert"))}function En(e){Dt.add(e),ua(!0)}function Cn(e){Dt.delete(e),Dt.size||ua(!1)}function An(e){e.hidden=!1,e.offsetHeight,e.dataset.open="true"}function Nt(e,t=300){return delete e.dataset.open,new Promise(n=>{setTimeout(()=>{e.dataset.open!=="true"&&(e.hidden=!0,e.innerHTML=""),n()},t)})}var le=!1,Sn=null,Lt=null,Ot=null;function D({title:e,body:t,footer:n="",onMount:s,onClose:a}){le||(Lt=document.activeElement,Sn=It(Lt)),Ot=a||null,v.sheet.innerHTML=m`
    <div class="sheet-grip" aria-hidden="true"></div>
    <div class="sheet-head">
      <h2 id="sheet-title">${e}</h2>
      <button class="icon-btn" data-action="close-sheet" aria-label="Close">
        ${r(d("x"))}
      </button>
    </div>
    <div class="sheet-body">${r(t)}</div>
    ${r(n?`<div class="sheet-foot">${n}</div>`:"")}
  `,v.backdrop.hidden=!1,v.backdrop.offsetHeight,v.backdrop.dataset.open="true",An(v.sheet),le=!0,En("sheet"),(v.sheet.querySelector('.sheet-body input:not([type="hidden"]), .sheet-body textarea, .sheet-body select, .sheet-body button, .sheet-foot button')||v.sheet.querySelector('[data-action="close-sheet"]')).focus({preventScroll:!0}),s&&s(v.sheet)}function C(){if(!le)return Promise.resolve();le=!1;let e=Nt(v.sheet);if(Nt(v.backdrop),Cn("sheet"),Tn(Lt,Sn),Lt=null,Sn=null,Ot){let t=Ot;Ot=null,t()}return e}function Rt(){return le}function Y(){return v.sheet}function J(){let e={};return v.sheet.querySelectorAll("[name]").forEach(t=>{t.type==="checkbox"?e[t.name]=t.checked:e[t.name]=t.value}),e}async function F({title:e,message:t,confirmLabel:n="Delete",danger:s=!0,onConfirm:a}){le&&await C(),D({title:e,body:m`<p class="sheet-message">${t}</p>`,footer:`
      <button class="btn btn-quiet" data-action="close-sheet">Cancel</button>
      <button class="btn ${s?"btn-danger":"btn-primary"}" data-sheet-confirm>${n}</button>
    `,onMount(o){o.querySelector("[data-sheet-confirm]").addEventListener("click",async()=>{await C(),a()})}})}var da=null;function y(e,t="default"){clearTimeout(da);let n=t==="ok"?"\u2713 ":t==="bad"?"! ":"";v.toast.textContent=n+e,v.toast.dataset.tone=t,v.toast.dataset.open="true",da=setTimeout(()=>{delete v.toast.dataset.open},2800)}var ye=!1,zt=null,jt=null,xn=null,st=null;async function pa(){try{"wakeLock"in navigator&&(st=await navigator.wakeLock.request("screen"))}catch{st=null}}function Qo(){try{st&&st.release()}catch{}st=null}document.addEventListener("visibilitychange",()=>{ye&&document.visibilityState==="visible"&&pa()});function ha(e,{onClose:t,onMount:n}={}){le&&C(),ye||(jt=document.activeElement,xn=It(jt)),zt=t||null,v.emergency.innerHTML=e,An(v.emergency),ye=!0,En("emergency");let s=v.emergency.querySelector("[data-autofocus]")||v.emergency.querySelector("button, a");s&&s.focus({preventScroll:!0}),pa(),n&&n(v.emergency)}function De(){if(ye&&(ye=!1,Nt(v.emergency,220),Cn("emergency"),Qo(),Tn(jt,xn),jt=null,xn=null,zt)){let e=zt;zt=null,e()}}function Ne(){return ye}function re(){return v.emergency}function ma(e){v.welcome.innerHTML=e,An(v.welcome),En("welcome");let t=v.welcome.querySelector("button");t&&t.focus({preventScroll:!0})}function ge(){Nt(v.welcome,250),Cn("welcome"),Tn(null,null)}function fa(e){v.welcome.innerHTML=e,v.welcome.scrollTop=0;let t=v.welcome.querySelector("[data-intro-focus]")||v.welcome.querySelector("button");t&&t.focus({preventScroll:!0})}function Le(){return Dt.has("welcome")}function Pt(){return'<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 18h5l3-8 5 14 3.5-9H28" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'}var Zo="https://fluxplanner.github.io/Flux/landing.html";function je(e=""){let t=document.documentElement.dataset.host==="flux"?"public/synara/icons/flux-logo.png":"icons/flux-logo.png";return`<a class="powered-by ${e}" href="${Zo}" target="_blank" rel="noopener"><span class="powered-by-t">Powered by</span><img class="powered-by-logo" src="${t}" alt="" width="18" height="18" /><span class="powered-by-name">Flux</span></a>`}v.backdrop.addEventListener("click",()=>{C()});document.addEventListener("keydown",e=>{e.key==="Escape"&&(le?C():ye&&De())});var ya=typeof document<"u"&&document.documentElement.dataset.host==="flux"?"public/synara/icons/icon-192.png":"icons/icon-192.png";function Re(){if(!("Notification"in window))return{ok:!1,reason:"This browser does not support notifications."};if(location.protocol==="file:")return{ok:!1,reason:"Notifications need the app served over https."};let e=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===!0;return/iPad|iPhone|iPod/.test(navigator.userAgent)&&!e?{ok:!1,reason:"On iPhone, add Synara to your Home Screen first (Share, then Add to Home Screen) and open it from there. Safari only allows notifications for those."}:/Android/i.test(navigator.userAgent)&&!("serviceWorker"in navigator)?{ok:!1,reason:"This browser can\u2019t show reminders on Android. Open Synara in Chrome, or keep a phone alarm."}:{ok:!0,reason:""}}function de(){return"Notification"in window?Notification.permission:"unsupported"}async function ga(){if(!("Notification"in window))return"unsupported";try{return await Notification.requestPermission()}catch{return"denied"}}var qt=[];function er(){qt.forEach(clearTimeout),qt=[]}function tr(e,t){let n=e.quietHours;if(!n)return!1;let s=t.getHours()*60+t.getMinutes(),a=B(n.from),o=B(n.to);return a>o?s>=a||s<o:s>=a&&s<o}var On=!1;function ba(){return On}async function va(e,t,n=""){if(de()!=="granted")return!1;let s={icon:ya,badge:ya,...t,data:{url:location.href.split("#")[0]+n}};try{let a="serviceWorker"in navigator?await navigator.serviceWorker.getRegistration():null;if(a&&a.active)return await a.showNotification(e,s),!0}catch(a){console.warn("[synara] the service worker could not show a notification:",a)}try{let a=new Notification(e,s);return a.onclick=()=>{window.focus(),n&&(location.hash=n),a.close()},!0}catch(a){return console.warn("[synara] could not show notification:",a),!1}}async function nr(e,t,n){let s=O();s.settings.remindersOn&&(tr(s.settings,new Date)||P(e,t.id,n,s)==="pending"&&(On=!await va("Time for your medication",{body:`${[t.name,t.dose].filter(Boolean).join(" ")} \u2014 ${q(n)}`,tag:`synara-${t.id}-${n}`},"#/meds")))}function Ie(){er();let e=O(),{remindersOn:t,reminderLead:n}=e.settings;if(!t||de()!=="granted")return 0;let s=new Date,a=g(s),o=S(a,1),i=0;for(let c of[a,o])for(let{med:f,time:l}of L(c,e)){if(P(c,f.id,l,e)!=="pending")continue;let h=W(`${c}T${l}`);h.setMinutes(h.getMinutes()-(n||0)),!(h<=s)&&(qt.push(setTimeout(()=>nr(c,f,l),h-s)),i++)}return qt.push(setTimeout(Ie,W(`${o}T00:00`)-s+5e3)),i}function wa(){Ie(),ae(Ie),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&Ie()})}async function $a(){if(de()!=="granted")return"not-allowed";let e=await va("Synara reminders are on",{body:"This is what a dose reminder will look like.",tag:"synara-test"});return On=!e,e?"sent":"failed"}var Dn="synara.flux";function Nn(){return typeof document<"u"&&document.documentElement.dataset.host==="flux"}function sr(e){return{v:1,meds:e.meds.map(t=>({name:t.name,dose:t.dose,color:t.color,added:t.added,ended:t.ended,schedule:t.schedule.map(n=>({from:n.from,times:n.times.slice()}))}))}}function ka(e){if(Nn())try{if(!e.settings.fluxLink){localStorage.removeItem(Dn);return}let t=JSON.stringify(sr(e));localStorage.getItem(Dn)!==t&&localStorage.setItem(Dn,t)}catch{}}var Ca="synara.sync",Ln="0123456789ABCDEFGHJKMNPQRSTVWXYZ",ar=3e3,or=3e4;function Aa(e){let t=0,n=0,s="";for(let a of e)for(n=(n<<8|a)&65535,t+=8;t>=5;)s+=Ln[n>>>t-5&31],t-=5;return t>0&&(s+=Ln[n<<5-t&31]),s}function rt(e){let t=String(e||"").toUpperCase().replace(/[^0-9A-Z]/g,"").replace(/O/g,"0").replace(/[IL]/g,"1");if(t.length!==26)return null;let n=0,s=0,a=[];for(let o of t){let i=Ln.indexOf(o);if(i<0)return null;s=(s<<5|i)&65535,n+=5,n>=8&&(a.push(s>>>n-8&255),n-=8)}return a.length!==16||(s&(1<<n)-1)!==0?null:new Uint8Array(a)}function rr(e){return e.match(/.{1,4}/g).join("-")}var Oa=["remindersOn","fluxLink"];function Rn(e){let t=JSON.parse(e);if(t.settings)for(let n of Oa)delete t.settings[n];return JSON.stringify(t)}function ir(e,t){let n=JSON.parse(e);n.settings={...n.settings||{}};for(let s of Oa)n.settings[s]=t.settings[s];return JSON.stringify(n)}function cr(e,t,n){if(!t)return n.remoteAt?"gone":"push";let s=e!==n.hash,a=t.updated_at!==n.remoteAt;return s&&a?"conflict":a?"pull":s?"push":"none"}var xa=e=>{let t="";for(let n=0;n<e.length;n+=32768)t+=String.fromCharCode(...e.subarray(n,n+32768));return btoa(t)},Ma=e=>Uint8Array.from(atob(e),t=>t.charCodeAt(0));async function za(e){return crypto.subtle.importKey("raw",e,"AES-GCM",!1,["encrypt","decrypt"])}async function lr(e,t){let n=crypto.getRandomValues(new Uint8Array(12)),s=new TextEncoder().encode(e),a=await crypto.subtle.encrypt({name:"AES-GCM",iv:n},await za(t),s);return{ciphertext:xa(new Uint8Array(a)),iv:xa(n)}}async function Ht(e,t){try{let n=await crypto.subtle.decrypt({name:"AES-GCM",iv:Ma(e.iv)},await za(t),Ma(e.ciphertext));return new TextDecoder().decode(n)}catch{throw Object.assign(new Error("wrong-key"),{code:"wrong-key"})}}async function Pe(e){let t=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(e));return Array.from(new Uint8Array(t),n=>n.toString(16).padStart(2,"0")).join("")}var be={phase:"off",error:"",account:null},jn=new Set,In=null,at=null,Ta=!1;function N(e){be={...be,...e};for(let t of jn)t(be)}function Da(e){return jn.add(e),()=>jn.delete(e)}function Fe(){return be}function Q(){try{return JSON.parse(localStorage.getItem(Ca)||"null")||{}}catch{return{}}}function G(e){try{localStorage.setItem(Ca,JSON.stringify(e))}catch{}}function K(){return!!Q().key}function Na(){return Q().at||""}function Bt(){let e=Q().key;return e?rr(e):""}function it(){return typeof document<"u"&&document.documentElement.dataset.host==="flux"}function ve(){return window.FluxSynaraVault||null}function ct(){return ve()||document.readyState!=="loading"?Promise.resolve(ve()):new Promise(e=>document.addEventListener("DOMContentLoaded",()=>e(ve()),{once:!0}))}function we(e){if(!e)throw Object.assign(new Error("not-ready"),{code:"not-ready"});return e}async function lt(){let e=await ct();if(!e)return null;try{return await e.account()}catch{return null}}async function ot(){return N({account:await lt()}),be.account}function Pn(e){return e&&(e.code||e.message)||"failed"}function La(e,t){if(e.user&&t&&t.id!==e.user)throw Object.assign(new Error("other-account"),{code:"other-account"})}var qe=()=>Rn(Ct()),Ea=e=>Rn(JSON.stringify(Oe(JSON.parse(e))));async function dr(){let e=Js();if(!e)return!1;let t=Q();if(!t.key||!t.hash)return!1;try{return await Pe(Rn(e))!==t.hash?!1:(G({...Q(),hash:await Pe(qe())}),!0)}catch{return!1}}async function ur(e,t){try{return Ea(await Ht(e,t))===Ea(qe())}catch{return!1}}async function qn(e,t){let n=qe(),s=await lr(n,t),a=await we(ve()).put({...s,key:e.key});G({...e,hash:await Pe(n),remoteAt:a.updated_at,at:new Date().toISOString(),keyed:!0})}async function Fn(e,t,n){let s=await Ht(n,t);G({...e,remoteAt:n.updated_at});try{await At(ir(s,O()))}catch(a){throw G(e),a}G({...Q(),hash:await Pe(qe()),at:new Date().toISOString()})}function dt(){return at||(at=(async()=>{let e=Q();if(!e.key||!it())return N({phase:"off"}),"off";let t=await ct();if(!t)return N({phase:"error",error:"not-ready"}),"error";N({phase:"syncing",error:""});try{let n=rt(e.key),s=await lt();La(e,s);let a=await t.get(),o=cr(await Pe(qe()),a,e);if(o==="conflict"&&await ur(a,n)&&(G({...e,hash:await Pe(qe()),remoteAt:a.updated_at,at:new Date().toISOString()}),o="none"),o==="none"&&a&&!a.key&&!e.keyed&&(o="push"),o==="push")await qn(e,n);else if(o==="pull")await Fn(e,n,a);else{if(o==="gone")return G({}),N({phase:"off",error:"gone"}),o;if(o==="conflict")return N({phase:"conflict"}),o}return!e.user&&s&&G({...Q(),user:s.id}),N({phase:"idle",error:""}),o}catch(n){return N({phase:"error",error:Pn(n)}),"error"}})().finally(()=>{at=null}),at)}async function ja(e){let t=Q(),n=rt(t.key);N({phase:"syncing",error:""});try{La(t,await lt());let s=await we(ve()).get();e==="cloud"?await Fn(t,n,s):(s&&await Ht(s,n),await qn(t,n)),N({phase:"idle"})}catch(s){throw N({phase:"error",error:Pn(s)}),s}}async function Wt(){let e=we(await ct()),t=await lt();if(!t)throw Object.assign(new Error("signed-out"),{code:"signed-out"});if(await e.get())throw Object.assign(new Error("has-copy"),{code:"has-copy"});let n=crypto.getRandomValues(new Uint8Array(16));await qn({key:Aa(n),user:t.id},n),N({phase:"idle",error:""})}async function Ia(e){let t=rt(e);if(!t)throw Object.assign(new Error("bad-key"),{code:"bad-key"});let n=await we(await ct()).get();if(!n)throw Object.assign(new Error("no-copy"),{code:"no-copy"});let s=JSON.parse(await Ht(n,t));return{key:Aa(t),updatedAt:n.updated_at,meds:Array.isArray(s.meds)?s.meds.length:0,seizures:Array.isArray(s.seizures)?s.seizures.length:0,name:s.profile&&typeof s.profile.name=="string"?s.profile.name:""}}async function Hn(e){let t=rt(e),n=await lt();await Fn({key:e,...n?{user:n.id}:{}},t,await we(ve()).get()),N({phase:"idle",error:""})}async function He({deleteCopy:e=!1,optOut:t=!0}={}){e&&await we(ve()).remove(),G(t?{off:!0}:{}),clearTimeout(In),N({phase:"off",error:""})}async function pr(){if(!it()||K()||Q().off)return"off";let e=be.account||await ot();if(!e)return"off";try{let n=await we(await ct()).get(),s=O(),a=!s.settings.seeded&&(s.meds.length||s.seizures.length||s.contacts.length);return n&&n.key&&rt(n.key)?a?(G({key:n.key,user:e.id}),dt()):(await Hn(n.key),"joined"):n?(N({phase:"needs-key",error:""}),"needs-key"):a?(await Wt(),"started"):"off"}catch(t){return t.code==="has-copy"?(N({phase:"needs-key",error:""}),"needs-key"):(N({phase:"error",error:Pn(t)}),"error")}}var Ft=()=>K()?dt():pr();async function Ra(){if(await dr(),!it()||Ta)return;Ta=!0,ae(()=>{clearTimeout(In),In=setTimeout(Ft,ar)}),document.addEventListener("visibilitychange",async()=>{document.visibilityState==="visible"&&(await ot(),Ft())}),window.addEventListener("online",Ft),setInterval(()=>{document.visibilityState==="visible"&&K()&&be.phase!=="conflict"&&dt()},or).unref?.(),await ot(),Ft()}var Qn={};Me(Qn,{actions:()=>Tr,cameFromCard:()=>Gn,setupCard:()=>Xn,setupList:()=>Vn,show:()=>Vt});var hr=[4,12,25,26],mr=[2,9],Wn=45,fr=21,yr=30,gr={3:5,4:6,11:5.5,12:6,24:4.5,25:5.5,38:6},Pa={3:5,4:4,10:4,11:5,23:4,24:5,37:4,38:4},br=e=>Math.round(e*10)/10;function _t(e){let t=g();e.profile={name:"Maya Ellison",pronouns:"she/her",grade:"11th grade",school:"Rosewood High School",seizureType:"Focal impaired awareness, occasional tonic-clonic",diagnosed:"2022",neurologist:"Dr. Priya Raghavan",neuroPhone:"(555) 010-4488",allergies:"Penicillin",bloodType:"O+",rescueMed:""};let n=S(t,-Wn),s=S(t,-fr),a=S(t,-yr),o={id:I("med"),name:"Levetiracetam",dose:"500 mg",form:"tablet",notes:"Take with food. Evening dose moved to 8pm so it is done before homework.",color:"violet",added:n,ended:null,schedule:[{from:n,times:["08:00","21:00"]},{from:s,times:["08:00","20:00"]}]},i={id:I("med"),name:"Lamotrigine",dose:"100 mg",form:"tablet",notes:"Never stop suddenly \u2014 taper only with Dr. Raghavan.",color:"mint",added:n,ended:null,schedule:[{from:n,times:["08:00"]}]},c={id:I("med"),name:"Topiramate",dose:"25 mg",form:"tablet",notes:"Stopped with Dr. Raghavan \u2014 made it hard to concentrate in class.",color:"amber",added:n,ended:a,schedule:[{from:n,times:["21:00"]}]};e.meds=[o,i,c],e.doses={};for(let l=Wn;l>=1;l--){let h=S(t,-l),p={},b=hr.includes(l),z=mr.includes(l),$=h<s?"21:00":"20:00";p[`${o.id}|08:00`]={status:z?"late":"taken",at:`${h}T08:12`},p[`${i.id}|08:00`]={status:z?"late":"taken",at:`${h}T08:12`},b?p[`${o.id}|${$}`]={status:"missed",at:`${h}T23:50`}:z?p[`${o.id}|${$}`]={status:"late",at:`${h}T22:40`}:p[`${o.id}|${$}`]={status:"taken",at:`${h}T${$==="21:00"?"21:04":"20:05"}`},h<a&&(p[`${c.id}|21:00`]={status:"taken",at:`${h}T21:06`}),e.doses[h]=p}e.checkins={};for(let l=Wn;l>=0;l--){let h=S(t,-l),p=gr[l],b=p??br(7.4+l*37%11/10),z=Pa[l]!=null?Pa[l]:1+l*17%3;e.checkins[h]={sleepHours:b,sleepQuality:b<6?"poor":b<7?"ok":"good",stress:z,mood:z>=4?"low":"ok",notes:"",at:`${h}T07:30`}}let f=[{back:3,time:"15:40",duration:95,type:"Focal impaired awareness",trigger:"Missed sleep",place:"School \u2014 classroom",aura:'Metallic taste, felt "far away" for about a minute',injury:!1,emsCalled:!1,notes:"Ms. Okafor followed the card. Sat with me until I came back. Missed the bus home."},{back:11,time:"21:10",duration:130,type:"Tonic-clonic",trigger:"Missed dose",place:"Home \u2014 bedroom",aura:"None that I remember",injury:!0,emsCalled:!1,notes:"Bit the inside of my cheek. Mom timed it at just over two minutes."},{back:24,time:"07:55",duration:60,type:"Focal aware",trigger:"Missed sleep",place:"Home \u2014 kitchen",aura:"Stomach-dropping feeling",injury:!1,emsCalled:!1,notes:"Stayed home first period. Was fine by lunch."},{back:38,time:"14:20",duration:150,type:"Tonic-clonic",trigger:"Flashing lights",place:"School \u2014 gym",aura:"Visual static",injury:!1,emsCalled:!0,notes:"Assembly with strobe lighting. Nurse called EMS because it went past two minutes. Did not go to hospital."}];return e.seizures=f.map(l=>({id:I("sz"),at:`${S(t,-l.back)}T${l.time}`,duration:l.duration,type:l.type,trigger:l.trigger,place:l.place,aura:l.aura,injury:l.injury,emsCalled:l.emsCalled,notes:l.notes,logged:`${S(t,-l.back)}T${l.time}`})),e.seizures.sort((l,h)=>l.at<h.at?1:-1),e.contacts=[{id:I("c"),name:"Dana Ellison",relation:"Mom",phone:"(555) 014-2007",primary:!0},{id:I("c"),name:"Marcus Ellison",relation:"Dad",phone:"(555) 014-2019",primary:!1},{id:I("c"),name:"Dr. Priya Raghavan",relation:"Neurologist",phone:"(555) 010-4488",primary:!1},{id:I("c"),name:"Nurse Ruiz",relation:"School nurse",phone:"(555) 018-8300",primary:!1},{id:I("c"),name:"Aunt Jo",relation:"Emergency pickup",phone:"(555) 016-3520",primary:!1}],e.card={looksLike:"Maya usually goes quiet and stops responding. She may stare, blink repeatedly, or pick at her clothes. She sometimes says food tastes metallic right before. Most last under two minutes. Afterwards she is confused and very tired for 20\u201330 minutes and may not remember what happened.",during:["Stay with her and start timing immediately.","If she is stiffening or shaking, gently help her down to the floor.","Move chairs, desks, and anything hard or sharp out of the way.","If she is on the floor, put something soft under her head.","Loosen anything tight around her neck.","If she is not aware or not awake, gently turn her onto her side.","If she is confused or wandering, stay beside her and gently guide her away from danger, like stairs or the road. Don't grab or hold her.","Stay calm and speak normally \u2014 she may be able to hear you."],doNot:["Do NOT put anything in her mouth. She cannot swallow her tongue.","Do NOT hold her down or try to stop the movements.","Do NOT give food, drink, or pills until she is fully awake.","Do NOT crowd her \u2014 ask other students to step back."],after:["Stay with her until she is fully alert and knows where she is.","Tell her calmly what happened \u2014 she will not remember.","Let her rest somewhere quiet. The nurse's office is best.","Call her mom, Dana, at (555) 014-2007.","Write down the time it started and how long it lasted."],callEms:["The seizure lasts longer than 5 minutes.","A second seizure starts soon after the first.","She does not wake up or return to normal afterwards.","She is having trouble breathing, or her lips stay blue.","She was injured, or it happened in water.","It looks different from her usual seizures.","She has diabetes or a heart condition, or is pregnant."],forTeacher:"Do not send her to the office alone afterwards \u2014 she will be confused and may not make it there. Send another student to get Nurse Ruiz instead. She is allowed to make up any assessment missed; this is in her 504 plan.",forNurse:`No rescue medication is prescribed at school. Standard first aid only. If any "Call 911" sign applies, call 911 first, then Dana Ellison. Otherwise call Dana Ellison; Dr. Raghavan's office can advise afterwards. Maya prefers to rest in the dark side room rather than the main bay.`,forCoach:"Cleared for all sports except swimming without a spotter on deck. No climbing above head height. If she has a seizure at practice she is done for the day \u2014 no returning to play, even if she says she feels fine.",updated:S(t,-6)},e.settings={theme:"system",remindersOn:!1,reminderLead:0,quietHours:null,seeded:!0},e}function vr(e,{reminders:t=!0}={}){let{profile:n,settings:s,card:a,contacts:o}=e,i=[{id:"details",icon:"user",title:"Your details",todo:"School, grade, neurologist and allergies",done:!!(n.name.trim()&&n.school.trim()),action:"profile-edit"},{id:"meds",icon:"pill",title:"Your medication",todo:"Each one, with the times you take it",done:s.noMeds||_(e).length>0,action:"med-open"},{id:"looksLike",icon:"note",title:"What your seizures look like",todo:"So someone watching knows what\u2019s happening",done:!!a.looksLike.trim(),action:"card-edit",data:{field:"looksLike"}},{id:"contacts",icon:"phone",title:"Emergency contacts",todo:"Who to call, and their number",done:o.length>0,action:"contact-open"}];return t&&!s.noMeds&&i.push({id:"reminders",icon:"bell",title:"Dose reminders",todo:"A nudge at each dose time",done:s.remindersOn,action:"nav",data:{to:"you"}}),i}function Be(e,t){let n=vr(e,t),s=n.filter(a=>a.done).length;return{items:n,done:s,total:n.length,complete:s===n.length}}function qa(e,t){return!e.settings.setupHidden&&!e.settings.seeded&&!Be(e,t).complete}var wr=[["Tonic-clonic","Stiffening, then jerking; not aware during it"],["Absence","Brief blank stares, usually a few seconds"],["Focal aware","Awake and aware, with odd feelings or movements"],["Focal impaired awareness","Not fully aware; may stare, fumble or wander"],["Myoclonic","Sudden, quick jerks"],["Atonic","Sudden loss of muscle tone; may drop or fall"]],ut="Not sure yet",Un=[{text:"Purple Day was started in 2008 by Cassidy Megan, a 9-year-old in Nova Scotia, Canada, who wanted kids with epilepsy to know they aren\u2019t alone. Now people around the world mark it every March 26.",source:"Purple Day"},{text:"With the right treatment, up to 70% of people with epilepsy can live without seizures.",source:"World Health Organization"},{text:"About 50 million people around the world have epilepsy. It\u2019s one of the most common conditions of the brain.",source:"World Health Organization"},{text:"In the US, about 1 in 26 people will develop epilepsy at some point in their life.",source:"Epilepsy Foundation"},{text:"Epilepsy is one of the oldest known conditions. Written records of it go back thousands of years.",source:"World Health Organization"},{text:"Purple is the color of epilepsy awareness. It comes from lavender, a flower linked with solitude: a reminder that no one with epilepsy should feel alone.",source:"Purple Day"},{text:"Seizure first aid fits in three words: Stay, Safe, Side. Stay with them, keep them safe, and turn them on their side if they aren\u2019t awake.",source:"Epilepsy Foundation"}],Yn=4,Z=0,M=Fa(),Kn=!1,Kt=0,Jn=!1;function Fa(){return{name:"",types:[],diagnosed:"",meds:"yes",error:""}}function Ut(){return Re().ok&&de()!=="denied"}function Vn(e){let{items:t}=Be(e,{reminders:Ut()});return t.map(n=>{let s=Object.entries(n.data||{}).map(([a,o])=>` data-${a}="${u(o)}"`).join("");return`
      <li>
        <button type="button" class="setup-row" data-action="setup-go" data-target="${n.action}"${s}
                data-done="${n.done}">
          <span class="setup-ico" aria-hidden="true">${d(n.done?"check":n.icon,18)}</span>
          <span class="row-body">
            <span class="row-t">${u(n.title)}</span>
            <span class="row-s">${n.done?"Done":u(n.todo)}</span>
          </span>
          <span class="chev" aria-hidden="true">${d("chevron")}</span>
        </button>
      </li>`}).join("")}function Xn(e){let t={reminders:Ut()};if(!qa(e,t))return"";let{done:n,total:s}=Be(e,t);return m`
    <section class="card setup-card" aria-labelledby="setup-h">
      <div class="setup-head">
        <div class="grow">
          <span class="eyebrow">Finish setting up</span>
          <h2 class="setup-h" id="setup-h">${n} of ${s} sections done</h2>
        </div>
        <button class="icon-btn" data-action="setup-hide" aria-label="Hide this list">${r(d("x"))}</button>
      </div>
      <progress class="setup-bar" max="${s}" value="${n}" aria-label="Setup progress"></progress>
      <ul class="setup-list">${r(Vn(e))}</ul>
    </section>
  `}function Jt(){return`<div class="intro-dots" aria-hidden="true">${Array.from({length:Yn},(t,n)=>`<span class="intro-dot" data-state="${n<Z?"done":n===Z?"on":"next"}"></span>`).join("")}</div>
          <span class="sr-only">Step ${Z+1} of ${Yn}</span>`}function $r(){return m`
    <div class="welcome-inner intro-step">
      ${r(Jt())}
      <div class="brand-mark welcome-mark">${r(Pt())}</div>
      <h1 class="welcome-h1" tabindex="-1" data-intro-focus>Synara</h1>
      <p class="welcome-sub">
        Your medication, your seizures, and the card someone needs if you
        have one at school — all in one place.
      </p>

      <ul class="welcome-points">
        <li>${r(d("pill",18))}<span>Dose reminders and a history you can show your doctor</span></li>
        <li>${r(d("chart",18))}<span>A seizure log that looks for patterns for you</span></li>
        <li>${r(d("shield",18))}<span>An emergency card anyone can follow, one tap away</span></li>
      </ul>

      <div class="welcome-actions">
        <button class="btn btn-primary btn-lg btn-block" data-action="intro-next">
          Set it up for me
        </button>
        <button class="btn btn-outline btn-lg btn-block" data-action="welcome-demo">
          Look around with example data
        </button>
        <button class="btn btn-quiet btn-block welcome-sos" data-action="intro-sos">
          ${r(d("shield",18))} ${Jn?"Back to the emergency card":"Open emergency card"}
        </button>
      </div>

      <p class="welcome-note">
        ${r(d("lock",14))}
        <span>Everything stays on this device. No account needed. Signed in to Flux,
        it syncs your devices through your Flux account. Synara is not a medical device.</span>
      </p>
      ${r(document.documentElement.dataset.host==="flux"?`
        <p class="welcome-links">
          <a href="index.html" data-return="synara">Sign in or create a Flux account</a>
          <span aria-hidden="true">\xB7</span>
          <a href="synara-welcome.html">About Synara</a>
        </p>`:"")}

      ${r(je("welcome-powered"))}
    </div>
  `}function kr(){let e=[...wr,[ut,"That\u2019s fine \u2014 you can add it later"]].map(([n,s])=>{let a=M.types.includes(n);return`
      <button type="button" class="intro-choice" data-action="intro-type" data-value="${u(n)}"
              aria-pressed="${a}">
        <span class="intro-choice-body">
          <span class="intro-choice-t">${u(n)}</span>
          <span class="intro-choice-s">${u(s)}</span>
        </span>
        <span class="intro-tick" aria-hidden="true">${d("check",16)}</span>
      </button>`}).join(""),t=[["yes","Yes"],["no","Not right now"]].map(([n,s])=>`<button type="button" class="segment" data-action="intro-meds" data-value="${n}"
             aria-pressed="${M.meds===n}">${s}</button>`).join("");return m`
    <form class="intro intro-step" data-action="intro-answers" novalidate>
      ${r(Jt())}
      <span class="intro-ico" aria-hidden="true">${r(d("user",26))}</span>
      <h1 class="intro-h" tabindex="-1" data-intro-focus>First, a little about you</h1>
      <p class="intro-sub">It fills in your details and your safety card. Everything is optional,
        and you can change it any time in You.</p>

      <div class="field">
        <label class="label" for="intro-name">What should we call you?</label>
        <input class="input" id="intro-name" name="name" value="${M.name}" placeholder="Your first name"
               autocomplete="given-name" maxlength="60" />
      </div>

      <fieldset class="intro-fieldset">
        <legend class="label">What kind of seizures do you have? <span class="ink-3">Pick any</span></legend>
        <div class="intro-choices">${r(e)}</div>
      </fieldset>

      <div class="field">
        <label class="label" for="intro-diagnosed">What year were you diagnosed?</label>
        <input class="input intro-year" id="intro-diagnosed" name="diagnosed" value="${M.diagnosed}"
               inputmode="numeric" maxlength="4" placeholder="e.g. 2021" autocomplete="off"
               aria-describedby="intro-year-error" />
        <span class="hint text-bad" id="intro-year-error" role="alert">${M.error}</span>
      </div>

      <div class="field">
        <span class="label" id="intro-meds-l">Do you take medication for your seizures?</span>
        <div class="segments" role="group" aria-labelledby="intro-meds-l">${r(t)}</div>
      </div>

      <div class="intro-actions">
        <button class="btn btn-primary btn-lg btn-block" type="submit">Continue</button>
        <button class="btn btn-quiet btn-block" type="button" data-action="intro-back">Back</button>
      </div>
    </form>
  `}function Sr(){let e=Un[Kt],t=M.name.trim().split(" ")[0];return m`
    <div class="intro intro-step">
      ${r(Jt())}
      <span class="intro-ico" aria-hidden="true">${r(d("sparkle",26))}</span>
      <h1 class="intro-h" tabindex="-1" data-intro-focus>You’re not alone${t?`, ${t}`:""}</h1>
      <p class="intro-sub">Here’s something worth knowing about epilepsy.</p>

      <figure class="intro-fact" aria-live="polite">
        <span class="eyebrow">Did you know?</span>
        <blockquote class="intro-fact-t">${e.text}</blockquote>
        <figcaption class="t-sm ink-3">Source: ${e.source}</figcaption>
      </figure>
      <button class="btn btn-quiet" type="button" data-action="intro-fact">
        ${r(d("sparkle",16))} Another fact
      </button>

      <div class="intro-actions">
        <button class="btn btn-primary btn-lg btn-block" data-action="intro-next">Continue</button>
        <button class="btn btn-quiet btn-block" type="button" data-action="intro-back">Back</button>
      </div>
    </div>
  `}function xr(){let e=O(),{done:t,total:n}=Be(e,{reminders:Ut()});return m`
    <div class="intro intro-step">
      ${r(Jt())}
      <span class="intro-ico" aria-hidden="true">${r(d("shield",26))}</span>
      <h1 class="intro-h" tabindex="-1" data-intro-focus>Now, fill in your sections</h1>
      <p class="intro-sub">These are what make your safety card useful when someone needs it.
        Tap one to start. This list stays on Home until it’s done.</p>
      <p class="t-sm ink-3 intro-count">${t} of ${n} done</p>

      <ul class="setup-list intro-sections">${r(Vn(e))}</ul>

      <div class="intro-actions">
        <button class="btn btn-primary btn-lg btn-block" data-action="intro-finish">Go to Synara</button>
        <button class="btn btn-quiet btn-block" type="button" data-action="intro-back">Back</button>
      </div>
    </div>
  `}var Ha=[$r,kr,Sr,xr];function Yt(e){Z=Math.max(0,Math.min(Yn-1,e)),fa(Ha[Z]())}function Vt({fromCard:e=!1}={}){Z=0,M=Fa(),Kn=!1,Jn=e,Kt=Math.floor(Math.random()*Un.length),ma(Ha[0]())}function Gn(){return Jn&&Z===0}function _n(){let e=document.querySelector("#welcome form.intro");e&&(M.name=e.elements.name.value.trim(),M.diagnosed=e.elements.diagnosed.value.trim())}function Mr(e){if(!e)return"";let t=Number(e),n=new Date().getFullYear();return/^\d{4}$/.test(e)&&t>=1900&&t<=n?"":`Enter a year like ${n-2}, or leave it blank.`}var Tr={"intro-next"(){_n(),Yt(Z+1)},"intro-back"(){_n(),Yt(Z-1)},"intro-type"(e){let t=e.dataset.value,n=M.types.includes(t);t===ut?M.types=n?[]:[ut]:(M.types=M.types.filter(s=>s!==ut&&s!==t),n||M.types.push(t)),e.closest(".intro-choices").querySelectorAll(".intro-choice").forEach(s=>{s.setAttribute("aria-pressed",String(M.types.includes(s.dataset.value)))})},"intro-meds"(e){M.meds=e.dataset.value,e.parentElement.querySelectorAll(".segment").forEach(t=>{t.setAttribute("aria-pressed",String(t===e))})},async"intro-answers"(){if(_n(),M.error=Mr(M.diagnosed),M.error){let e=document.getElementById("intro-year-error");e&&(e.textContent=M.error),document.getElementById("intro-diagnosed")?.focus();return}Kn||(await et(),Kn=!0),await Et({name:M.name,seizureType:M.types.filter(e=>e!==ut).join(", "),diagnosed:M.diagnosed}),await ce({noMeds:M.meds==="no"}),Yt(2)},"intro-fact"(){Kt=(Kt+1)%Un.length,Yt(Z)},"intro-finish"(){ge();let{complete:e}=Be(O(),{reminders:Ut()});y(e?"You\u2019re all set":"Your sections are on Home whenever you\u2019re ready","ok")},async"welcome-demo"(){await et({seedFn:_t}),ge(),y("Loaded example data \u2014 clear it any time in You","ok")},async"setup-hide"(){await ce({setupHidden:!0}),y("Hidden. Everything on it is in You and Safety.","ok")}};var ss={};Me(ss,{actions:()=>ni,render:()=>Kr,subtitle:()=>Hr,title:()=>Fr});var Ba="These are associations in your own log, not medical conclusions. Patterns can appear by chance, especially with few entries. Bring them to your neurologist rather than acting on them alone.",$e=3,pt=e=>e.reduce((t,n)=>t+n,0)/e.length,V=e=>e.at.split("T")[0];function es(e,t,n=0){let s=g(),a=0,o=0;for(let i=n+1;i<=t;i++){let c=S(s,-i);for(let{med:f,time:l}of L(c,e))o++,ze(c,f.id,l,e)==="taken"&&a++}return{good:a,total:o}}function Er(e){let t=g(),n=0;for(let s=1;s<=365;s++){let a=S(t,-s),o=L(a,e);if(!o.length||!o.every(({med:c,time:f})=>ze(a,c.id,f,e)==="taken"))break;n++}return n}function ts(e){let t=e.seizures||[];return t.length<2?[]:[Dr(e,t),Nr(e,t),Lr(e,t),jr(t),Ir(t),Rr(t),Pr(e),qr(t)].filter(Boolean).sort((n,s)=>s.strength-n.strength)}function Wa(e){return ts(e)[0]||null}var Cr=new Set(["missed","late"]);function _a(e,t,n){let s=n.get(t);return s||(s=L(t,e).map(({med:a,time:o})=>({mins:B(o),slipped:Cr.has(P(t,a.id,o,e))})),n.set(t,s)),s}function Ar(e,t,n){let[s,a]=t.at.split("T"),o=B(a),i=!1,c=!1,f=(l,h)=>{for(let p of _a(e,l,n))h(p.mins)&&(i=!0,p.slipped&&(c=!0))};return f(S(s,-2),l=>l>=o),f(S(s,-1),()=>!0),f(s,l=>l<o),{due:i,slipped:c}}function Or(e,t,n){let s=g(),a=S(s,-366),o=e.meds.reduce((p,b)=>b.added<p?b.added:p,s),i=p=>{let b=_a(e,p,n);return{due:b.length>0,slipped:b.some(z=>z.slipped)}},c=o>a?o:a,f=i(c),l=0,h=0;for(let p=S(c,1);p<s;p=S(p,1)){let b=i(p);!t.has(p)&&!t.has(c)&&(f.due||b.due)&&(l++,(f.slipped||b.slipped)&&h++),c=p,f=b}return{stretches:l,slipped:h}}function zr(e,t,n){let s=t*Math.log(1-n),a=Math.log(n/(1-n)),o=0;for(let i=0;i<=t;i++)i>=e&&(o+=Math.exp(s)),s+=Math.log((t-i)/(i+1))+a;return Math.min(1,o)}function Dr(e,t){if(t.length<$e||!e.meds.length)return null;let n=0,s=0,a=new Set,o=new Map;for(let h of t){let{due:p,slipped:b}=Ar(e,h,o);p&&(s++,b&&(n++,a.add(V(h))))}if(s<$e||n<2||a.size<2)return null;let i=Math.round(n/s*100);if(i<60)return null;let c=Or(e,new Set(t.map(V)),o);if(c.stretches<14)return null;let f=(c.slipped+1)/(c.stretches+2);if(zr(n,s,f)>=.05)return null;let l=c.slipped?Math.max(1,Math.round(c.slipped/c.stretches*100)):0;return{id:"dose-proximity",tone:"alert",icon:"pill",title:`${n} of your ${s} seizures came after a missed or late dose`,detail:`Each of those ${T(n,"seizure")} came less than 48 hours after a dose marked missed or late. `+(c.slipped?`Only ${l}% of your 48-hour stretches without a seizure had one. `:"None of your 48-hour stretches without a seizure had one. ")+"That doesn't show the dose caused the seizure. Talk it over with your neurologist, and don't change how you take your medicine on your own.",evidence:`${n}/${s} seizures \xB7 ${i}% vs ${l}% otherwise`,strength:100+i}}function Ya(e,t,n){let s=new Set(t.map(V)),a=[],o=[];for(let[i,c]of Object.entries(e.checkins||{}))typeof c[n]=="number"&&(s.has(i)?a:o).push(c[n]);return{onSeizureDays:a,onOtherDays:o}}function Nr(e,t){let{onSeizureDays:n,onOtherDays:s}=Ya(e,t,"sleepHours");if(n.length<$e||s.length<10)return null;let a=pt(n),o=pt(s),i=o-a;return i<.75?null:{id:"sleep",tone:"alert",icon:"moon",title:`You slept ${i.toFixed(1)} hours less before seizure days`,detail:`The nights before a seizure averaged ${a.toFixed(1)} hours, against ${o.toFixed(1)} on every other night. Short sleep is one of the most commonly reported seizure triggers.`,evidence:`${n.length} seizure nights vs ${s.length} others`,strength:90+Math.min(20,i*10)}}function Lr(e,t){let{onSeizureDays:n,onOtherDays:s}=Ya(e,t,"stress");if(n.length<$e||s.length<10)return null;let a=pt(n),o=pt(s),i=a-o;return i<.8?null:{id:"stress",tone:"watch",icon:"wave",title:"Seizure days were higher-stress days",detail:`You rated stress ${a.toFixed(1)} out of 5 on seizure days, against ${o.toFixed(1)} otherwise. Stress often shows up alongside other commonly reported triggers, like short sleep and skipped meals.`,evidence:`${n.length} seizure days vs ${s.length} others`,strength:70+i*10}}function jr(e){if(e.length<$e)return null;let t=ln(e.map(a=>a.trigger).filter(a=>a&&a!=="None known"));if(!t.length||t[0].count<2)return null;let n=t[0],s=Math.round(n.count/e.length*100);return{id:"trigger",tone:"watch",icon:"bolt",title:`"${n.value}" is your most logged trigger`,detail:`You recorded it for ${T(n.count,"seizure")} out of ${e.length}. `+(t.length>1?`Next most common: ${t.slice(1,3).map(a=>`${a.value} (${a.count})`).join(", ")}.`:"It is the only trigger you have logged so far."),evidence:`${n.count}/${e.length} seizures \xB7 ${s}%`,strength:60+s/2}}var Zn=[{from:0,to:4,label:"late at night (12am\u20134am)"},{from:4,to:8,label:"early in the morning (4am\u20138am)"},{from:8,to:12,label:"in the morning (8am\u201312pm)"},{from:12,to:16,label:"in the early afternoon (12pm\u20134pm)"},{from:16,to:20,label:"in the late afternoon (4pm\u20138pm)"},{from:20,to:24,label:"in the evening (8pm\u201312am)"}];function Ir(e){if(e.length<$e)return null;let t=new Array(Zn.length).fill(0);for(let a of e){let o=W(a.at).getHours();t[Zn.findIndex(i=>o>=i.from&&o<i.to)]++}let n=0;for(let a=1;a<t.length;a++)t[a]>t[n]&&(n=a);if(t[n]<2||t[n]*2<=e.length)return null;let s=Math.round(t[n]/e.length*100);return{id:"time-of-day",tone:"neutral",icon:"clock",title:`Most of your seizures happened ${Zn[n].label}`,detail:`${t[n]} of ${e.length} were in that window. Timing can line up by chance. If it keeps happening, mention it to your neurologist.`,evidence:`${t[n]}/${e.length} seizures \xB7 ${s}%`,strength:40+s/2}}function Rr(e){if(e.length<$e)return null;let t=ln(e.map(s=>s.place).filter(Boolean));if(!t.length)return null;let n=e.filter(s=>/school/i.test(s.place||"")).length;return n<2&&t[0].count<2?null:{id:"place",tone:"neutral",icon:"pin",title:n>=2?`${n} of ${e.length} happened at school`:`Most often at: ${t[0].value}`,detail:n>=2?"Worth making sure the staff actually around you \u2014 not just the front office \u2014 have seen your safety card. Printing it from the Safety tab is the easiest way.":`You logged ${T(t[0].count,"seizure")} there out of ${e.length}.`,evidence:n>=2?`${n}/${e.length} seizures`:`${t[0].count}/${e.length} seizures`,strength:35}}function Pr(e){let t=es(e,14),n=es(e,45,14);if(t.total<10||n.total<10)return null;let s=Math.round(t.good/t.total*100),a=Math.round(n.good/n.total*100),o=s-a;if(Math.abs(o)<8)return null;let i=o>0;return{id:"adherence-trend",tone:i?"good":"alert",icon:i?"trend-up":"trend-down",title:i?`Your dose consistency is up ${o} points`:`Your dose consistency has slipped ${Math.abs(o)} points`,detail:`${s}% of doses taken on time over the last 14 days, against ${a}% in the month before.`+(i?" Keep going.":" Worth a look at which dose is slipping."),evidence:`${t.good}/${t.total} recent \xB7 ${n.good}/${n.total} before`,strength:i?50:85}}function qr(e){if(e.length<4)return null;let t=g(),n=e.map(V).sort()[0],s=Ye(n,t);if(s<30)return null;let a=Math.floor(s/2),o=S(t,-a),i=S(t,-2*a),c=e.filter(h=>V(h)>o&&V(h)<=t).length,f=e.filter(h=>V(h)>i&&V(h)<=o).length;if(c+f<4||c===f)return null;let l=c<f;return{id:"frequency",tone:l?"good":"alert",icon:l?"sun":"alert",title:l?"Fewer seizures in the most recent stretch":"More seizures in the most recent stretch",detail:`${T(c,"seizure")} in the last ${a} days, against ${f} in the ${a} days before. Over a window this short a change like this can easily be chance \u2014 worth watching, not concluding.`,evidence:`${c} recent vs ${f} earlier`,strength:l?45:80}}function ke(e){let t=e.seizures||[],n=g(),{good:s,total:a}=es(e,30),o=a?Math.round(s/a*100):null,i=t.length?t.map(V).sort().pop():null,c=i?Math.max(0,Ye(i,n)):null,f=t.filter(p=>{let b=Ye(V(p),n);return b>=0&&b<30}).length,l=t.map(p=>p.duration).filter(p=>p>0),h=l.length?Math.round(pt(l)):null;return{adherence:o,adherenceGood:s,adherenceTotal:a,daysSince:c,lastSeizure:i,seizuresLast30:f,totalSeizures:t.length,avgDuration:h,avgDurationLabel:h?Ue(h):null,streak:Er(e)}}function Ka(e,t=28){let n=new Set((e.seizures||[]).map(V)),s=g();return Ns(t).map(a=>{let o=0,i=0,c="none";for(let{med:f,time:l}of L(a,e)){let h=a===s?P(a,f.id,l,e):ze(a,f.id,l,e);h!=="pending"&&(i++,h==="taken"&&o++,h==="missed"?c="missed":h==="late"&&c!=="missed"?c="late":c==="none"&&(c="taken"))}return{day:a,taken:o,total:i,status:i===0?"none":c,seizure:n.has(a)}})}function Ua(){let e=new Date().getHours();return e<5?"Hi":e<12?"Good morning":e<18?"Good afternoon":"Good evening"}function Fr(e){let t=(e.profile.name||"").split(" ")[0];return t?`${Ua()}, ${t}`:Ua()}function Hr(e){if(!_(e).length)return"No medications added yet";let t=ns(e).filter(n=>n.status==="pending").length;return t?`${T(t,"dose")} left to log today`:"Every dose logged for today"}function ns(e){let t=g();return L(t,e).map(({med:n,time:s})=>({med:n,time:s,status:P(t,n.id,s,e)}))}function Br(e){let t=g(),n=S(t,-1),s=L(n,e).filter(({med:l,time:h})=>ze(n,l.id,h,e)==="pending").map(({med:l,time:h})=>({med:l,time:h,day:n})),a=ns(e).filter(l=>l.status==="pending").map(l=>({...l,day:t}));if(!a.length&&!s.length)return null;let o=l=>Tt(l.day,l.time),i=a.length+s.length-1,c=[...s,...a].find(l=>o(l)>=0&&o(l)<=tt);if(c)return{...c,mode:"due",others:i};let f=a.filter(l=>o(l)>tt);return f.length?{...f[f.length-1],mode:"overdue",others:i}:a.length?{...a[0],mode:"upcoming",others:i}:null}var Wr=60;function _r(e){let t=S(g(),1);return L(t,e)[0]||null}function Yr(){return Fe().phase!=="needs-key"?"":m`
    <section class="card sync-prompt" aria-labelledby="sync-prompt-h">
      <span class="med-dot" data-color="blue" aria-hidden="true">${r(d("sync",20))}</span>
      <div class="grow">
        <h2 class="setup-h" id="sync-prompt-h">Synara is synced on another device</h2>
        <p class="t-sm ink-3">Enter its sync key to see the same medication, seizures and contacts here.</p>
      </div>
      <button class="btn btn-primary" data-action="sync-open">Enter sync key</button>
    </section>
  `}function Kr(e){let t=_(e).length>0,n=ke(e),s=Wa(e),a=!!nt(g(),e);return m`
    <div class="home-grid">
      <div class="home-main">
        ${r(Yr())}
        ${r(t?Jr(e):Vr(e))}
        ${r(Xn(e))}
        ${r(t?Qr(e):"")}
      </div>
      <div class="home-side">
        ${r(Ur())}
        ${r(Xr(n))}
        ${r(a?"":Zr())}
        ${r(s?ei(s):"")}
        ${r(ti())}
      </div>
    </div>
  `}function Ur(){let e=new Date;return e.getMonth()!==2||e.getDate()!==26?"":m`
    <section class="card purple-day" aria-label="Purple Day">
      <span class="purple-day-ico">${r(d("ribbon",22))}</span>
      <div class="grow">
        <span class="eyebrow">Today is Purple Day</span>
        <p class="purple-day-t">The world's day for epilepsy awareness</p>
        <p class="t-sm ink-2">
          A good day to show friends and teachers your safety card, so they
          know what to do if you have a seizure.
        </p>
        <button class="btn btn-primary mt-3" data-action="nav" data-to="safety">
          ${r(d("shield",16))} Open my safety card
        </button>
      </div>
    </section>
  `}function Jr(e){let t=Br(e);if(!t){let c=_r(e);return m`
      <section class="card next-dose" data-state="clear" aria-label="Today's doses">
        <span class="eyebrow">Today</span>
        <div class="next-dose-when">All done</div>
        <span class="next-dose-what">
          Every dose today is logged.${r(c?` First one tomorrow: ${u(c.med.name)} at ${q(c.time)}.`:"")}
        </span>
      </section>
    `}let n=-Tt(t.day,t.time),s=t.mode==="overdue"?`${gt(-n)} overdue`:t.mode==="due"||n<=1?"Due now":`in ${gt(n)}`,a=t.mode==="overdue"?"Not logged yet":t.mode==="due"?"Take it now":"Next dose",o=(c,f,l)=>`
    <button class="btn ${l}" data-action="dose-quick" data-day="${t.day}"
            data-med="${t.med.id}" data-time="${t.time}" data-status="${c}">${f}</button>`,i=t.mode==="overdue"?o("late",`${d("check",18)} Took it late`,"btn-on-brand")+o("missed","Missed it","btn-on-brand-ghost"):t.mode==="due"?o("taken",`${d("check",18)} Mark taken`,"btn-on-brand")+o("missed","Missed it","btn-on-brand-ghost"):n<=Wr?o("taken",`${d("check",18)} Mark taken`,"btn-on-brand"):"";return m`
    <section class="card next-dose" data-state="${t.mode}" aria-label="Next dose">
      <span class="eyebrow">${a}</span>
      <div class="next-dose-when">${s}</div>
      <span class="next-dose-what">
        ${t.med.name}${t.med.dose?` ${t.med.dose}`:""} · ${q(t.time)}
      </span>
      ${r(i?`<div class="next-dose-actions">${i}</div>`:"")}
      ${r(t.others>0?`<button class="next-dose-more" data-action="nav" data-to="meds">
             ${t.others} more ${t.mode==="upcoming"?"later today":"to log today"} ${d("chevron",14)}
           </button>`:"")}
    </section>
  `}function Vr(e){return e.settings.noMeds?"":m`
    <section class="card next-dose" data-state="empty" aria-label="Get started">
      <span class="eyebrow">Get started</span>
      <div class="next-dose-when next-dose-when-sm">Add your first medication</div>
      <span class="next-dose-what">
        Name, dose, and the times you take it. About twenty seconds — then
        every dose gets tracked from today on.
      </span>
      <div class="next-dose-actions">
        <button class="btn btn-on-brand" data-action="med-open">
          ${r(d("plus",18))} Add a medication
        </button>
      </div>
    </section>
  `}function Xr(e){let t=e.adherence==null?"":e.adherence>=90?"ok":e.adherence>=75?"warn":"bad";return m`
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
        <span class="stat-n">${e.adherence==null?"\u2014":e.streak}</span>
        <span class="stat-l">Day streak, every dose on time</span>
      </div>
    </div>
  `}var Gr={taken:"\u2713",late:"!",missed:"\u2715",pending:""};function Qr(e){let t=ns(e),n=g(),s=t.map(a=>{let o=Je(a.status,a.time);return`
      <li class="dose-row">
        <span class="med-dot" data-color="${u(a.med.color)}" aria-hidden="true">${d("pill",20)}</span>
        <span class="dose-body">
          <span class="dose-name">${u(a.med.name)} <span class="dose-amt">${u(a.med.dose)}</span></span>
          <span class="dose-meta" data-status="${a.status}">${q(a.time)} \xB7 ${o}</span>
        </span>
        <button class="tick" data-status="${a.status}" data-action="dose-cycle"
                data-med="${a.med.id}" data-time="${a.time}" data-day="${n}"
                aria-label="${u(a.med.name)} at ${q(a.time)}: ${o}. Tap to change.">
          ${Gr[a.status]}
        </button>
      </li>`}).join("");return m`
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
  `}function Zr(){return m`
    <button class="card card-tap checkin-cta" data-action="checkin-open">
      <span class="row">
        <span class="med-dot" data-color="blue" aria-hidden="true">${r(d("moon",20))}</span>
        <span class="row-body">
          <span class="row-t">How did you sleep?</span>
          <span class="row-s">Ten-second check-in. Sleep and stress are what the pattern finder compares against.</span>
        </span>
        <span class="chev">${r(d("chevron"))}</span>
      </span>
    </button>
  `}function ei(e){return m`
    <section class="section" aria-labelledby="insight-h">
      <div class="section-head">
        <h2 id="insight-h">Worth knowing</h2>
        <button class="btn btn-sm btn-quiet" data-action="open-patterns">All patterns</button>
      </div>
      <div class="insight" data-tone="${e.tone}">
        <span class="insight-ico" aria-hidden="true">${r(d(e.icon,20))}</span>
        <span class="insight-body">
          <span class="insight-t">${e.title}</span>
          <span class="insight-d">${e.detail}</span>
          <span class="insight-e">${e.evidence}</span>
        </span>
      </div>
      <p class="hint">A pattern in your log, not proof of a cause. Talk it over with your neurologist.</p>
    </section>
  `}function ti(){return m`
    <div class="quick-grid">
      <button class="quick" data-action="seizure-open">
        <span class="quick-ico" data-tone="violet" aria-hidden="true">${r(d("note",20))}</span>
        <span class="quick-t">Log a seizure</span>
        <span class="quick-s">Half-filled is fine</span>
      </button>
      <button class="quick" data-action="open-emergency">
        <span class="quick-ico" data-tone="rose" aria-hidden="true">${r(d("shield",20))}</span>
        <span class="quick-t">Emergency card</span>
        <span class="quick-s">With a seizure timer</span>
      </button>
    </div>
  `}var ni={async"dose-quick"(e){let{med:t,time:n,status:s,day:a}=e.dataset;await Mt(a||g(),t,n,s),y(s==="taken"?"Marked taken":s==="late"?"Marked taken late":"Marked missed",s==="missed"?"default":"ok")}};var os={};Me(os,{actions:()=>gi,render:()=>ui,subtitle:()=>di,title:()=>li});var si=["violet","mint","amber","rose","blue"],ai={violet:"Violet",mint:"Mint",amber:"Amber",rose:"Rose",blue:"Blue"},oi={violet:"brand",mint:"ok",amber:"warn",rose:"bad",blue:"info"},ri=["tablet","capsule","liquid","patch","injection","other"],ii={taken:"\u2713",late:"!",missed:"\u2715",pending:""},ci={taken:"Taken",late:"Taken late",missed:"Missed",pending:"Not logged"},k=null;function li(){return"Medications"}function di(e){let t=_(e);if(!t.length)return"Nothing added yet";let n=t.reduce((s,a)=>s+ie(a).length,0);return`${T(t.length,"medication")} \xB7 ${T(n,"dose")} a day`}function ui(e){let t=_(e),n=e.meds.filter(s=>!$n(s));return t.length?m`
    <div class="split-grid">
      <div class="split-main">
        ${r(pi(e))}
        ${r(mi(t))}
        ${r(n.length?Ja(n):"")}
      </div>
      <div class="split-side">
        ${r(hi(e))}
      </div>
    </div>
  `:m`
      <div class="card">
        <div class="empty">
          <span class="empty-ico" aria-hidden="true">${r(d("pill",32))}</span>
          <span class="empty-t">No medications yet</span>
          <span class="empty-s">
            Add what you take and when. Every dose gets tracked from today,
            building a history you can actually show a doctor.
          </span>
          <button class="btn btn-primary" data-action="med-open">
            ${r(d("plus",18))} Add a medication
          </button>
        </div>
      </div>
      ${r(n.length?Ja(n):"")}
    `}function Xa(e,t,n,s,a){return`
    <li class="dose-row">
      <span class="med-dot" data-color="${u(t.color)}" aria-hidden="true">${d("pill",20)}</span>
      <span class="dose-body">
        <span class="dose-name">${u(t.name)} <span class="dose-amt">${u(t.dose)}</span></span>
        <span class="dose-meta" data-status="${s}">${q(n)} \xB7 ${u(a)}</span>
      </span>
      <button class="tick" data-status="${s}" data-action="dose-cycle"
              data-med="${t.id}" data-time="${n}" data-day="${e}"
              aria-label="${u(t.name)} at ${q(n)}: ${u(a)}. Tap to change.">
        ${ii[s]}
      </button>
    </li>`}function pi(e){let t=g(),n=L(t,e).map(({med:s,time:a})=>{let o=P(t,s.id,a,e);return Xa(t,s,a,o,Je(o,a))}).join("");return m`
    <section class="section" aria-labelledby="meds-today-h">
      <div class="section-head">
        <h2 id="meds-today-h">Today</h2>
        <span class="t-sm ink-3">${X(t,{relative:!1})}</span>
      </div>
      <div class="card card-flush">
        <ul class="rows">${r(n)}</ul>
      </div>
      <p class="hint">Tap a circle to cycle: taken → late → missed → not logged.</p>
    </section>
  `}function hi(e){let t=Ka(e,28),n=g(),s=ne(t[0].day).getDay(),a=[0,1,2,3,4,5,6].map(c=>`<div class="cal-dow" aria-hidden="true">${Is(c).slice(0,2)}</div>`).join(""),o='<div aria-hidden="true"></div>'.repeat(s),i=t.map(c=>{let f=ne(c.day).getDate(),l=c.total?`${c.taken} of ${c.total} doses on time`:c.day===n?"nothing logged yet":"no doses scheduled",h=`${X(c.day,{relative:!1})}: ${l}`+(c.seizure?", seizure logged":"");return`
      <button class="cal-day" data-status="${c.status}" data-today="${c.day===n}"
              data-seizure="${c.seizure}" data-action="cal-day" data-day="${c.day}"
              aria-label="${u(h)}" title="${u(h)}">${f}</button>`}).join("");return m`
    <section class="section" aria-labelledby="cal-h">
      <div class="section-head">
        <h2 id="cal-h">Last four weeks</h2>
      </div>
      <div class="card">
        <div class="cal">${r(a)}${r(o)}${r(i)}</div>
        <div class="cal-legend">
          <span class="cal-key"><span class="cal-swatch" data-k="taken"></span>All on time</span>
          <span class="cal-key"><span class="cal-swatch" data-k="late"></span>Late</span>
          <span class="cal-key"><span class="cal-swatch" data-k="missed"></span>Missed</span>
          <span class="cal-key"><span class="cal-swatch" data-k="seizure"></span>Seizure</span>
        </div>
        <p class="hint cal-hint">Tap a day to see or fix what was logged.</p>
      </div>
    </section>
  `}function mi(e){let t=e.map(n=>{let s=ie(n);return`
      <li>
        <button class="list-row" data-action="med-open" data-id="${n.id}">
          <span class="med-dot" data-color="${u(n.color)}" aria-hidden="true">${d("pill",20)}</span>
          <span class="row-body">
            <span class="row-t">${u(n.name)} <span class="dose-amt">${u(n.dose)}</span></span>
            <span class="row-s">${s.length?s.map(q).join(" \xB7 "):"No times set"}</span>
            ${n.notes?`<span class="row-note">${u(n.notes)}</span>`:""}
          </span>
          <span class="chev">${d("chevron")}</span>
        </button>
      </li>`}).join("");return m`
    <section class="section" aria-labelledby="meds-list-h">
      <div class="section-head">
        <h2 id="meds-list-h">Your medications</h2>
        <button class="btn btn-sm btn-soft" data-action="med-open">${r(d("plus",16))} Add</button>
      </div>
      <div class="card card-flush">
        <ul class="rows">${r(t)}</ul>
      </div>
    </section>
  `}function Ja(e){let t=e.map(n=>`
    <li class="list-row list-row-static">
      <span class="med-dot" data-color="${u(n.color)}" data-muted="true" aria-hidden="true">${d("archive",18)}</span>
      <span class="row-body">
        <span class="row-t">${u(n.name)} <span class="dose-amt">${u(n.dose)}</span></span>
        <span class="row-s">Stopped ${X(n.ended,{relative:!1})} \xB7 history kept</span>
      </span>
      <button class="btn btn-sm btn-quiet" data-action="med-restart" data-id="${n.id}">Restart</button>
    </li>`).join("");return m`
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
  `}function Ga(){let e=k.times.map((s,a)=>`
    <div class="input-row">
      <input class="input" type="time" value="${u(s)}" data-time-index="${a}"
             aria-label="Dose time ${a+1}" required />
      ${k.times.length>1?`<button type="button" class="icon-btn" data-action="med-time-remove" data-index="${a}"
                   aria-label="Remove time ${a+1}">${d("trash",20)}</button>`:""}
    </div>`).join(""),t=si.map(s=>`
    <button type="button" class="chip chip-color" data-action="med-color" data-value="${s}"
            aria-pressed="${s===k.color}">
      <span class="cal-swatch" style="background:var(--${oi[s]})"></span>${ai[s]}
    </button>`).join(""),n=ri.map(s=>`<option value="${s}" ${s===k.form?"selected":""}>${s[0].toUpperCase()}${s.slice(1)}</option>`).join("");return m`
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
          <select class="select" id="med-form" name="form">${r(n)}</select>
        </div>
      </div>

      <div class="field">
        <span class="label" id="times-label">Times each day</span>
        <div class="stack stack-2" role="group" aria-labelledby="times-label">${r(e)}</div>
        <button type="button" class="btn btn-sm btn-quiet self-start" data-action="med-time-add">
          ${r(d("plus",16))} Add another time
        </button>
        ${r(k.id?'<span class="hint">Changing times applies from today. Earlier days keep the schedule they actually had.</span>':"")}
      </div>

      <div class="field">
        <span class="label" id="color-label">Colour</span>
        <div class="chips" role="group" aria-labelledby="color-label">${r(t)}</div>
      </div>

      <div class="field">
        <label class="label" for="med-notes">Notes <span class="ink-faint">(optional)</span></label>
        <textarea class="textarea" id="med-notes" name="notes" maxlength="600"
                  placeholder="Take with food">${k.notes}</textarea>
      </div>
    </form>
  `}function ht(){if(!k)return;let e=J();for(let t of["name","dose","form","notes"])e[t]!==void 0&&(k[t]=e[t]);Y().querySelectorAll("[data-time-index]").forEach(t=>{k.times[Number(t.dataset.timeIndex)]=t.value})}function as(e){ht();let t=Y().querySelector(".sheet-body");if(t&&(t.innerHTML=Ga()),e){let n=Y().querySelector(e);n&&n.focus()}}function fi(e){k=e?{id:e.id,name:e.name,dose:e.dose,form:e.form,notes:e.notes,color:e.color,times:[...ie(e)]}:{id:null,name:"",dose:"",form:"tablet",times:["08:00"],notes:"",color:"violet"},k.times.length||(k.times=["08:00"]),D({title:e?"Edit medication":"Add medication",body:Ga(),footer:`
      ${e?`<button class="btn btn-danger-soft" data-action="med-stop" data-id="${e.id}">Stop taking</button>`:""}
      <button class="btn btn-primary" data-action="med-save">${e?"Save":"Add medication"}</button>
    `,onClose(){k=null}})}var yi={pending:"taken",taken:"late",late:"missed",missed:"pending"};function Va(e,t,n){let s=L(e,t),a=(t.seizures||[]).filter(f=>f.at.startsWith(e)),o=e<g(),i=s.map(({med:f,time:l})=>{let h=P(e,f.id,l,t),p=h!=="pending"?ci[h]:o?"Not logged \u2014 counts as missed":Je("pending",l);return Xa(e,f,l,h,p)}).join(""),c=m`
    <div class="stack stack-4">
      ${r(a.length?`
        <div class="insight" data-tone="alert">
          <span class="insight-ico" aria-hidden="true">${d("bolt",20)}</span>
          <span class="insight-body">
            <span class="insight-t">${T(a.length,"seizure")} logged this day</span>
          </span>
        </div>`:"")}
      ${r(s.length?`<div class="card card-flush"><ul class="rows">${i}</ul></div>`:'<p class="ink-3">No doses were scheduled on this day.</p>')}
      <p class="hint">
        Back-filling is fine — an honest record a day late beats a blank one.
      </p>
    </div>
  `;if(n){let f=Y().querySelector(".sheet-body");f&&(f.innerHTML=c);return}D({title:X(e,{relative:!1}),body:c})}var gi={async"dose-cycle"(e){let{med:t,time:n,day:s}=e.dataset,a=P(s,t,n),o=!!e.closest("#sheet");await Mt(s,t,n,yi[a]),o&&(Va(s,O(),!0),Y().querySelector(`[data-action="dose-cycle"][data-med="${t}"][data-time="${n}"]`)?.focus())},"cal-day"(e,t){Va(e.dataset.day,t,!1)},"med-open"(e,t){let n=e.dataset.id;fi(n?t.meds.find(s=>s.id===n):null)},"med-time-add"(){ht();let e=k.times[k.times.length-1]||"08:00",[t,n]=e.split(":").map(Number);k.times.push(`${String(((t||0)+12)%24).padStart(2,"0")}:${String(n||0).padStart(2,"0")}`),as(`[data-time-index="${k.times.length-1}"]`)},"med-time-remove"(e){ht(),k.times.splice(Number(e.dataset.index),1),as('[data-action="med-time-add"]')},"med-color"(e){ht(),k.color=e.dataset.value,as(`[data-action="med-color"][data-value="${e.dataset.value}"]`)},async"med-save"(){if(ht(),!k.name.trim()){y("Give the medication a name","bad"),Y().querySelector("#med-name")?.focus();return}let e=Ce(k.times);if(!e.length){y("Add at least one time","bad");return}let t={name:k.name,dose:k.dose,form:k.form,times:e,notes:k.notes,color:k.color},n=!!k.id;n?await Qs(k.id,t):await Gs(t),C(),y(n?"Medication updated":"Added \u2014 tracking starts today","ok")},"med-stop"(e,t){let n=e.dataset.id,s=t.meds.find(o=>o.id===n),a=s&&s.added>=g();F({title:a?"Remove this medication?":`Stop taking ${s?s.name:"this"}?`,message:a?"It was only added today, so there is no history to keep. It will be removed completely.":"It will stop appearing in today's doses and reminders. Every dose already logged stays in your history and statistics, and you can restart it later. Never stop an epilepsy medication without talking to your neurologist first.",confirmLabel:a?"Remove":"Stop taking",async onConfirm(){await Zs(n),y(a?"Medication removed":"Stopped \u2014 history kept")}})},async"med-restart"(e,t){let n=t.meds.find(s=>s.id===e.dataset.id);n&&(await ea(n.id),y(`${n.name} restarted from today`,"ok"))}};var ds={};Me(ds,{actions:()=>zi,logSeizure:()=>ls,render:()=>Si,subtitle:()=>ki,title:()=>$i});var bi=["Focal aware","Focal impaired awareness","Tonic-clonic","Absence","Myoclonic","Atonic","Not sure"],vi=["Missed dose","Missed sleep","Stress","Illness or fever","Flashing lights","Skipped meal","Dehydration","Period","None known"],wi=["Home","School \u2014 classroom","School \u2014 hallway","School \u2014 gym","School \u2014 cafeteria","Outside","In a car","Other"],is=["","Calm","Fine","Busy","Stressed","Overwhelmed"],mt="log",w=null,j=null,Qa=e=>`${e} ${e===1?"entry":"entries"}`;function $i(){return"Seizures"}function ki(e){let t=(e.seizures||[]).length;if(!t)return"Nothing logged yet";let{daysSince:n}=ke(e);return n===0?`${Qa(t)} \xB7 one today`:`${Qa(t)} \xB7 ${T(n,"day")} since the last`}function Si(e){return m`
    <div class="subtabs" role="group" aria-label="Seizure views">
      <button class="subtab" aria-controls="panel-sz"
              data-action="sz-tab" data-tab="log" aria-pressed="${mt==="log"}">
        ${r(d("note",18))} Log
      </button>
      <button class="subtab" aria-controls="panel-sz"
              data-action="sz-tab" data-tab="patterns" aria-pressed="${mt==="patterns"}">
        ${r(d("sparkle",18))} Patterns
      </button>
    </div>
    <div id="panel-sz" class="stack stack-5">
      ${r(mt==="log"?Ei(e):Ci(e))}
    </div>
  `}function xi(e){let t=W(e.at),n=[];return e.duration&&n.push(`<span class="pill">${d("timer",13)} ${Ue(e.duration)}</span>`),e.trigger&&n.push(`<span class="pill pill-warn">${u(e.trigger)}</span>`),e.place&&n.push(`<span class="pill">${u(e.place)}</span>`),e.injury&&n.push('<span class="pill pill-bad">Injury</span>'),e.emsCalled&&n.push('<span class="pill pill-bad">911 called</span>'),`
    <li>
      <button class="log-entry" data-action="seizure-open" data-id="${e.id}">
        <span class="log-date" aria-hidden="true">
          <span class="log-mon">${Ke(t.getMonth())}</span>
          <span class="log-day">${t.getDate()}</span>
        </span>
        <span class="log-body">
          <span class="log-t">${u(e.type||"Seizure")}</span>
          <span class="row-s">${Rs(e.at)} \xB7 ${Ps(e.at)}</span>
          ${n.length?`<span class="log-meta">${n.join("")}</span>`:""}
          ${e.notes?`<span class="log-note">${u(e.notes)}</span>`:""}
        </span>
        <span class="chev">${d("chevron")}</span>
      </button>
    </li>`}function Mi(e){let t=[];for(let n of e){let s=W(n.at),a=`${s.getFullYear()}-${s.getMonth()}`,o=t[t.length-1];(!o||o.key!==a)&&(o={key:a,label:`${Ke(s.getMonth())} ${s.getFullYear()}`,items:[]},t.push(o)),o.items.push(n)}return t.map(n=>`
    <div class="month-group">
      <h3 class="eyebrow month-label">${n.label} \xB7 ${n.items.length}</h3>
      <div class="card card-flush"><ul class="rows">${n.items.map(xi).join("")}</ul></div>
    </div>`).join("")}function Ti(e){if(!e)return m`
      <button class="card card-tap" data-action="checkin-open">
        <span class="row">
          <span class="med-dot" data-color="blue" aria-hidden="true">${r(d("moon",20))}</span>
          <span class="row-body">
            <span class="row-t">Today's check-in</span>
            <span class="row-s">Sleep and stress, ten seconds. This is what the pattern finder compares seizures against.</span>
          </span>
          <span class="chev">${r(d("chevron"))}</span>
        </span>
      </button>
    `;let t=e.sleepHours==null?"\u2014":e.sleepHours,n=e.stress==null?"\u2014":e.stress;return m`
    <button class="card card-tap" data-action="checkin-open">
      <span class="row">
        <span class="med-dot" data-color="mint" aria-hidden="true">${r(d("check",20))}</span>
        <span class="row-body">
          <span class="row-t">Checked in today</span>
          <span class="row-s">${t} hours of sleep · stress ${n} of 5 · tap to change</span>
        </span>
        <span class="chev">${r(d("chevron"))}</span>
      </span>
    </button>
  `}function Ei(e){let t=e.seizures||[],n=nt(g(),e);return m`
    <button class="btn btn-primary btn-lg btn-block" data-action="seizure-open">
      ${r(d("plus",20))} Log a seizure
    </button>

    ${r(Ti(n))}

    ${r(t.length?`
      <section class="section" aria-labelledby="hist-h">
        <h2 id="hist-h">History</h2>
        ${Mi(t)}
      </section>`:`
      <div class="card">
        <div class="empty">
          <span class="empty-ico" aria-hidden="true">${d("note",32)}</span>
          <span class="empty-t">No seizures logged</span>
          <span class="empty-s">
            That's a good thing. When one happens, logging it here \u2014 even
            roughly \u2014 is what lets Synara spot patterns later.
          </span>
        </div>
      </div>`)}
  `}function Za(){return m`
    <div class="disclaimer">
      ${r(d("info",16))}
      <span><strong>About these patterns.</strong> ${Ba}</span>
    </div>
  `}function Ci(e){let t=ts(e),n=ke(e),s=(e.seizures||[]).length,a=Object.keys(e.checkins||{}).length;if(!t.length){let i=[];return s<3&&i.push(`at least 3 seizures logged (you have ${s})`),a<13&&i.push(`about two weeks of daily check-ins (you have ${a})`),m`
      <div class="card">
        <div class="empty">
          <span class="empty-ico" aria-hidden="true">${r(d("sparkle",32))}</span>
          <span class="empty-t">Nothing to report yet</span>
          <span class="empty-s">
            Synara would rather show you nothing than a coincidence dressed up
            as a finding.${i.length?` Most patterns need ${i.join(" and ")}.`:" Nothing in your log clears the bar right now \u2014 which can be good news."}
          </span>
        </div>
      </div>
      ${r(Za())}
    `}let o=t.map(i=>`
    <li class="insight" data-tone="${i.tone}">
      <span class="insight-ico" aria-hidden="true">${d(i.icon,20)}</span>
      <span class="insight-body">
        <span class="insight-t">${u(i.title)}</span>
        <span class="insight-d">${u(i.detail)}</span>
        <span class="insight-e">${u(i.evidence)}</span>
      </span>
    </li>`).join("");return m`
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
      <ul class="stack stack-3">${r(o)}</ul>
    </section>

    ${r(Za())}
  `}function rs(e,t,n){let s=t.map(a=>`
    <button type="button" class="chip" data-action="sz-chip" data-field="${e}"
            data-value="${u(a)}" aria-pressed="${a===w[e]}">${u(a)}</button>`).join("");return`
    <div class="field">
      <span class="label" id="lbl-${e}">${n}</span>
      <div class="chips" role="group" aria-labelledby="lbl-${e}">${s}</div>
    </div>`}function eo(){let e=Math.floor(w.duration/60),t=w.duration%60,n=g();return m`
    <form class="stack stack-5" data-action="seizure-save" novalidate>
      ${r(w.fromTimer?`
        <div class="insight" data-tone="good">
          <span class="insight-ico" aria-hidden="true">${d("timer",20)}</span>
          <span class="insight-body">
            <span class="insight-t">Timed at ${Ue(w.duration)}</span>
            <span class="insight-d">Start time and length came from the emergency timer. Everything else is optional.</span>
          </span>
        </div>`:"")}

      <div class="input-row">
        <div class="field grow">
          <label class="label" for="sz-date">Date</label>
          <input class="input" type="date" id="sz-date" name="date" value="${w.date}" max="${n}" required />
        </div>
        <div class="field grow">
          <label class="label" for="sz-time">Started at</label>
          <input class="input" type="time" id="sz-time" name="time" value="${w.time}" required />
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

      ${r(rs("type",bi,"Type"))}
      ${r(rs("trigger",vi,"Possible trigger"))}
      ${r(rs("place",wi,"Where were you?"))}

      <div class="field">
        <label class="label" for="sz-aura">Warning signs beforehand</label>
        <input class="input" id="sz-aura" name="aura" value="${w.aura}"
               placeholder="Metallic taste, dizziness, déjà vu…" autocomplete="off" maxlength="300" />
      </div>

      <div class="card card-flush">
        <label class="toggle-row">
          <span class="row-body">
            <span class="row-t">Were you injured?</span>
            <span class="row-s">Even a bitten cheek counts</span>
          </span>
          <input type="checkbox" class="check" name="injury" ${r(w.injury?"checked":"")} />
        </label>
        <label class="toggle-row">
          <span class="row-body">
            <span class="row-t">Was 911 called?</span>
            <span class="row-s">Worth recording either way</span>
          </span>
          <input type="checkbox" class="check" name="emsCalled" ${r(w.emsCalled?"checked":"")} />
        </label>
      </div>

      <div class="field">
        <label class="label" for="sz-notes">Anything else</label>
        <textarea class="textarea" id="sz-notes" name="notes" maxlength="4000"
                  placeholder="What happened, who was there, how you felt afterwards…">${w.notes}</textarea>
      </div>
    </form>
  `}function cs(){if(!w)return;let e=J();for(let t of["date","time","aura","notes","injury","emsCalled"])e[t]!==void 0&&(w[t]=e[t]);if(e.mins!==void 0||e.secs!==void 0){let t=bt(Number(e.mins)||0,0,120),n=bt(Number(e.secs)||0,0,59);w.duration=t*60+n}}function Ai(e){cs();let t=Y().querySelector(".sheet-body");if(!t)return;let n=t.scrollTop;t.innerHTML=eo(),t.scrollTop=n,e&&Y().querySelector(e)?.focus({preventScroll:!0})}function to(e,t={}){if(e){let[n,s]=e.at.split("T");w={...e,date:n,time:s,fromTimer:!1}}else{let n=t.at||`${g()}T${he()}`,[s,a]=n.split("T");w={id:null,date:s,time:a,duration:t.duration||0,type:"",trigger:"",place:"",aura:"",injury:!1,emsCalled:!1,notes:"",fromTimer:!!t.duration}}D({title:e?"Edit entry":"Log a seizure",body:eo(),footer:`
      ${e?`<button class="btn btn-danger-soft" data-action="seizure-delete" data-id="${e.id}">Delete</button>`:""}
      <button class="btn btn-primary" data-action="seizure-save">Save</button>
    `,onClose(){w=null}})}function ls(e){to(null,e)}function Oi(){let e=[1,2,3,4,5].map(t=>`
    <button type="button" class="segment" data-action="checkin-stress" data-value="${t}"
            aria-pressed="${j.stress===t}" aria-label="${t}, ${is[t]}">${t}</button>`).join("");return m`
    <div class="stack stack-6">
      <div class="field">
        <span class="label" id="sleep-label">How many hours did you sleep last night?</span>
        <div class="stepper" role="group" aria-labelledby="sleep-label">
          <button type="button" class="stepper-btn" data-action="checkin-sleep" data-value="-0.5"
                  aria-label="Half an hour less">−</button>
          <span class="sleep-n" aria-live="polite" aria-atomic="true"><span data-sleep-hours>${j.sleepHours}</span><small aria-hidden="true">h</small><span class="sr-only"> hours</span></span>
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
        <span class="hint text-center" data-stress-hint>${is[j.stress]||""}</span>
      </div>

      <div class="field">
        <label class="label" for="ci-notes">Anything worth noting</label>
        <textarea class="textarea" id="ci-notes" name="notes" maxlength="600"
                  placeholder="Sick, travelling, exams…">${j.notes}</textarea>
      </div>
    </div>
  `}var zi={"sz-tab"(e){mt=e.dataset.tab,vn()},"open-patterns"(){mt="patterns",location.hash==="#/track"?vn():location.hash="#/track"},"seizure-open"(e,t){let n=e.dataset.id;to(n?t.seizures.find(s=>s.id===n):null)},"sz-chip"(e){cs();let{field:t,value:n}=e.dataset;w[t]=w[t]===n?"":n,Ai(`[data-action="sz-chip"][data-field="${t}"][data-value="${CSS.escape(n)}"]`)},async"seizure-save"(){cs();let e=`${w.date}T${w.time}`;if(!w.date||!w.time||!Ee(e)){y("A date and start time are needed","bad");return}if(W(e).getTime()>Date.now()+6e4){y("That time is in the future","bad");return}let t={at:e,duration:w.duration,type:w.type,trigger:w.trigger,place:w.place,aura:w.aura,injury:!!w.injury,emsCalled:!!w.emsCalled,notes:w.notes},n=!!w.id;n?await na(w.id,t):await ta(t),C(),y(n?"Entry updated":"Logged. Look after yourself today.","ok")},"seizure-delete"(e){let t=e.dataset.id;F({title:"Delete this entry?",message:"It will be removed from your history and from the pattern calculations. This can't be undone.",async onConfirm(){await sa(t),y("Entry deleted")}})},"checkin-open"(e,t){let n=g(),s=nt(n,t);j={sleepHours:s&&s.sleepHours!=null?s.sleepHours:8,stress:s&&s.stress!=null?s.stress:2,notes:s&&s.notes||""},D({title:`Check-in \xB7 ${X(n)}`,body:Oi(),footer:'<button class="btn btn-primary" data-action="checkin-save">Save check-in</button>',onClose(){j=null}})},"checkin-sleep"(e){let t=Number(e.dataset.value);j.sleepHours=bt(Math.round((j.sleepHours+t)*2)/2,0,16);let n=Y().querySelector("[data-sleep-hours]");n&&(n.textContent=String(j.sleepHours))},"checkin-stress"(e){j.stress=Number(e.dataset.value),e.parentElement.querySelectorAll(".segment").forEach(n=>{n.setAttribute("aria-pressed",String(n===e))});let t=Y().querySelector("[data-stress-hint]");t&&(t.textContent=is[j.stress]||"")},async"checkin-save"(){let e=J();e.notes!==void 0&&(j.notes=e.notes);let t=j.sleepHours;await aa(g(),{sleepHours:t,sleepQuality:t<6?"poor":t<7?"ok":"good",stress:j.stress,mood:j.stress>=4?"low":"ok",notes:(j.notes||"").trim()}),C(),y("Checked in","ok")}};var ws={};Me(ws,{actions:()=>Ji,render:()=>ji,showEmergency:()=>an,subtitle:()=>Ni,timerPending:()=>sn,title:()=>Di});function Di(){return"Safety card"}function Ni(e){let t=(e.contacts||[]).length,n=`${t} ${t===1?"contact":"contacts"}`;return e.card.updated?`${n} \xB7 updated ${X(e.card.updated)}`:n}var Li=e=>(e.name||"").trim().split(/\s+/)[0]||"";function ji(e){let{card:t,contacts:n,profile:s}=e,a=Li(s),o=a?`If ${a} has a seizure`:"If a seizure happens";return m`
    <div class="safety-hero">
      <div class="safety-hero-ico" aria-hidden="true">${r(d("shield",26))}</div>
      <h2>${o}</h2>
      <p>
        Written for whoever is standing there — a teacher, a coach, a stranger.
        The SOS button at the top of every screen opens the big version, with
        a seizure timer.
      </p>
      <div class="safety-hero-actions">
        <button class="btn btn-on-danger" data-action="open-emergency">
          ${r(d("shield",18))} Open emergency card
        </button>
        <button class="btn btn-on-danger-ghost" data-action="print-card">
          ${r(d("print",18))} Print for school
        </button>
      </div>
    </div>

    ${r(Ii(e))}

    <div class="split-grid">
      <div class="split-main">
        ${r(Pi(n))}
        ${r(qi(t))}
        ${r(us("What to do",t.during,"during","ok"))}
        ${r(us("What NOT to do",t.doNot,"doNot","bad"))}
        ${r(Fi(t))}
        ${r(us("Afterwards",t.after,"after",""))}
      </div>
      <div class="split-side">
        ${r(Hi(e))}
        ${r(Wi(t))}
      </div>
    </div>

    <div class="disclaimer">
      ${r(d("info",16))}
      <span>
        <strong>Check this with a doctor.</strong> The first-aid steps follow
        standard public seizure first aid, but every person's seizures are
        different. Confirm this card with your neurologist and school nurse
        before relying on it. Synara is not a medical device.
      </span>
    </div>
  `}function Ii(e){let t=[];if(e.contacts.length||t.push(["contact-open","","Add someone to call"]),e.profile.name||t.push(["profile-edit","","Add your name"]),e.card.looksLike||t.push(["card-edit","looksLike","Describe what your seizures look like"]),e.card.forTeacher||t.push(["card-edit","forTeacher","Add a note for teachers"]),!t.length)return"";let n=t.map(([s,a,o])=>`
    <li>
      <button class="todo-row" data-action="${s}"${a?` data-field="${a}"`:""}>
        <span class="todo-dot" aria-hidden="true"></span>
        <span class="grow">${o}</span>
        <span class="chev">${d("chevron",16)}</span>
      </button>
    </li>`).join("");return m`
    <section class="card todo-card" aria-labelledby="todo-h">
      <h2 id="todo-h" class="todo-h">${r(d("sparkle",18))} Finish your card</h2>
      <p class="t-sm ink-2">
        ${t.length===1?"One thing":`${t.length} things`} would make this
        card much more useful to whoever has to use it.
      </p>
      <ul class="todo-list">${r(n)}</ul>
    </section>
  `}function oo(e){return`<span class="contact-rt">${u(e.relation)}${e.relation&&e.phone?" \xB7 ":""}<span class="contact-ph">${u(e.phone)}</span></span>`}function Ri(e){return`
    <li class="contact-row">
      <button class="contact-main" data-action="contact-open" data-id="${e.id}"
              aria-label="Edit ${u(e.name)}">
        <span class="avatar" aria-hidden="true">${u(wt(e.name))}</span>
        <span class="contact-body">
          <span class="contact-n">${u(e.name)}</span>
          <span class="contact-r">${e.primary?'<span class="pill pill-brand">First call</span>':""}${oo(e)}</span>
        </span>
      </button>
      ${ro(e)}
    </li>`}function ro(e){return vt(e.phone)?`<a class="call-btn" href="${cn(e.phone)}" aria-label="Call ${u(e.name)}">${d("phone",16)} Call</a>`:'<span class="pill pill-warn">No number</span>'}function Pi(e){let t=e.length?`<ul class="rows">${e.map(Ri).join("")}</ul>`:`<div class="empty empty-sm">
         <span class="empty-t">No one to call yet</span>
         <span class="empty-s">The emergency card's biggest button calls whoever you put first.</span>
         <button class="btn btn-sm btn-primary" data-action="contact-open">${d("plus",16)} Add a contact</button>
       </div>`;return m`
    <section class="section" aria-labelledby="contacts-h">
      <div class="section-head">
        <h2 id="contacts-h">Who to call</h2>
        ${r(e.length?`<button class="btn btn-sm btn-soft" data-action="contact-open">${d("plus",16)} Add</button>`:"")}
      </div>
      <div class="card card-flush">${r(t)}</div>
    </section>
  `}function nn(e,t){return`<button class="btn btn-sm btn-quiet" data-action="card-edit" data-field="${e}"
                  aria-label="Edit ${u(t)}">${d("edit",15)} Edit</button>`}function qi(e){let t=e.looksLike?`<p class="prose">${u(e.looksLike)}</p>`:`<p class="ink-3">Describe what happens, so somebody who has never seen one knows what they're looking at.</p>`;return m`
    <section class="section" aria-labelledby="looks-h">
      <div class="section-head">
        <h2 id="looks-h">What it looks like</h2>
        ${r(nn("looksLike","what it looks like"))}
      </div>
      <div class="card">${r(t)}</div>
    </section>
  `}function gs(e,t){return`<ol class="steps">${e.map((n,s)=>`
    <li class="step" data-tone="${t}">
      <span class="step-n" aria-hidden="true">${t==="bad"?"\u2715":t==="ems"?"!":s+1}</span>
      <span>${u(n)}</span>
    </li>`).join("")}</ol>`}function us(e,t,n,s){let a=`sec-${n}`,o=t&&t.length?gs(t,s):'<p class="ink-3">Nothing added yet.</p>';return m`
    <section class="section" aria-labelledby="${a}">
      <div class="section-head">
        <h2 id="${a}">${e}</h2>
        ${r(nn(n,e))}
      </div>
      <div class="card">${r(o)}</div>
    </section>
  `}function Fi(e){let t=e.callEms||[];return m`
    <section class="section" aria-labelledby="sec-ems">
      <div class="section-head">
        <h2 id="sec-ems">Call 911 if…</h2>
        ${r(nn("callEms","when to call 911"))}
      </div>
      <div class="card ems-card">${r(t.length?gs(t,"ems"):'<p class="ink-3">Nothing added yet.</p>')}</div>
    </section>
  `}function Hi(e){let{profile:t}=e,n=_(e),s=[["Seizure type",t.seizureType],["Rescue medication",t.rescueMed],["Allergies",t.allergies],["Blood type",t.bloodType],["Neurologist",[t.neurologist,t.neuroPhone].filter(Boolean).join(" \xB7 ")]].filter(([,i])=>i),a=n.length?n.map(i=>`${u(i.name)}${i.dose?` ${u(i.dose)}`:""}`).join(", "):'<span class="ink-faint">None added</span>',o=s.map(([i,c])=>`<div class="kv-row"><dt class="kv-k">${i}</dt><dd class="kv-v">${u(c)}</dd></div>`).join("");return m`
    <section class="section" aria-labelledby="medical-h">
      <div class="section-head">
        <h2 id="medical-h">Medical details</h2>
        <button class="btn btn-sm btn-quiet" data-action="profile-edit">${r(d("edit",15))} Edit</button>
      </div>
      <div class="card card-flush">
        <dl class="kv">
          ${r(o)}
          <div class="kv-row"><dt class="kv-k">Current meds</dt><dd class="kv-v">${r(a)}</dd></div>
        </dl>
      </div>
      <p class="hint">Shown on the emergency card and the printed copy — it's what paramedics ask for.</p>
    </section>
  `}var Bi=[{field:"forTeacher",label:"For teachers",icon:"school"},{field:"forNurse",label:"For the school nurse",icon:"stethoscope"},{field:"forCoach",label:"For coaches and PE",icon:"run"}];function Wi(e){let t=Bi.map(n=>`
    <div class="card role-card">
      <div class="card-head">
        <h3>${d(n.icon,18)} ${n.label}</h3>
        ${nn(n.field,n.label)}
      </div>
      ${e[n.field]?`<p class="prose">${u(e[n.field])}</p>`:`<p class="ink-3 t-sm">Nothing added yet \u2014 what should this person know that isn't in the steps?</p>`}
    </div>`).join("");return m`
    <section class="section" aria-labelledby="roles-h">
      <h2 id="roles-h">Specific instructions</h2>
      <div class="stack stack-3">${r(t)}</div>
    </section>
  `}var ms="synara.timer",en=300,tn=null,ee=null,We=null,io=null;function _e(){let e=io;if(!e)try{e=JSON.parse(sessionStorage.getItem(ms)||"null")}catch{}return e&&typeof e.ms=="number"&&Date.now()-e.ms<10800*1e3?e:null}function Xt(e){io=e;try{e?sessionStorage.setItem(ms,JSON.stringify(e)):sessionStorage.removeItem(ms)}catch{}ho()}var co="From their seizure action plan. Only give it if you are trained to.",Gt=e=>`${Math.floor(e/60)}:${String(e%60).padStart(2,"0")}`,no=700,_i='.em-timer [data-action="timer-stop"], .em-timer [data-action="timer-log"], .em-timer [data-action="timer-reset"], [data-action="close-emergency"]',lo=0,so=null;function Zt(){lo=Date.now()+no;let e=re();e&&(e.dataset.settling="true"),clearTimeout(so),so=setTimeout(()=>{e&&delete e.dataset.settling},no)}document.addEventListener("click",e=>{if(Date.now()>=lo)return;let t=e.target instanceof Element?e.target.closest(_i):null;!t||!t.closest("#emergency")||(e.preventDefault(),e.stopImmediatePropagation())},!0);var Yi=e=>`<a class="btn btn-lg btn-block btn-emergency em-timer-911" href="tel:911" data-timer-911>${d("phone",20)} <span data-timer-911-label>${u(e)}</span></a>`;function uo(){return`
    <section class="em-timer" data-state="idle" aria-labelledby="em-timer-h">
      <div class="em-timer-top">
        <h3 id="em-timer-h" class="em-timer-h">${d("timer",18)} Seizure timer</h3>
      </div>
      <div class="em-timer-slot" data-timer-slot>
        <span class="em-timer-hint" data-timer-hint>Start it now. If the seizure began earlier, you can add the minutes you missed.</span>
      </div>
      <div class="em-timer-clock" data-timer-clock aria-hidden="true">0:00</div>
      <div class="sr-only" aria-live="assertive" data-timer-live></div>
      <div class="em-timer-actions" data-timer-actions>
        <button class="btn btn-lg btn-primary btn-block" data-action="timer-start" data-autofocus>
          ${d("play",20)} Start timer
        </button>
      </div>
    </section>`}function Qt(e,t,n){let s=e.querySelector("[data-timer-slot]");if(!s)return;if(t==="text"){let o=s.querySelector("[data-timer-hint]");o||(s.innerHTML='<span class="em-timer-hint" data-timer-hint></span>',o=s.querySelector("[data-timer-hint]")),o.textContent!==n&&(o.textContent=n);return}let a=s.querySelector("[data-timer-911-label]");a?a.textContent!==n&&(a.textContent=n):s.innerHTML=Yi(n)}function bs(e,t,n){let s=e.querySelector(".em-timer");if(!s)return;let a=s.querySelector("[data-timer-clock]"),o=s.querySelector("[data-timer-actions]"),i=s.querySelector("[data-timer-live]"),c=s.dataset.state,f=o.getBoundingClientRect().top;if(a.textContent=Gt(n),t==="running"||t==="over"){let l=t==="over";s.dataset.state=t,l?Qt(s,"911","Over 5 minutes \u2014 call 911 now"):Qt(s,"text",`Call 911 at 5 minutes from when it began \xB7 ${Gt(Math.max(0,en-n))} to go`);let h=o.querySelector('[data-action="timer-stop"]'),p=o.querySelector('[data-action="timer-earlier"]');(!h||!p)&&(o.innerHTML=`
        <button class="btn btn-lg btn-block" data-action="timer-stop">${d("stop",18)} It stopped</button>
        <button class="btn btn-block" data-action="timer-earlier">+1 min \u2014 it began earlier</button>`,h=o.querySelector('[data-action="timer-stop"]'),p=o.querySelector('[data-action="timer-earlier"]'),Zt()),h.className=`btn btn-lg btn-block ${l?"btn-on-danger-ghost":"btn-outline"}`,p.className=`btn btn-block ${l?"btn-on-danger-ghost":"btn-quiet"}`}else if(t==="stopped"){let l=n>=en;s.dataset.state=l?"over":"stopped";let h=l?`It lasted ${Gt(n)}. That is 5 minutes or longer, so call 911 if no one has yet.`:`It lasted ${Gt(n)}`;l?Qt(s,"911","Call 911"):Qt(s,"text",h),o.innerHTML=`
      ${l?`<p class="em-timer-hint em-timer-said" data-timer-hint>${u(h)}</p>`:""}
      <button class="btn btn-lg btn-block ${l?"btn-on-danger-ghost":"btn-primary"}" data-action="timer-log">${d("note",18)} Log this seizure</button>
      <button class="btn btn-block ${l?"btn-on-danger-ghost":"btn-quiet"}" data-action="timer-reset">Reset timer</button>`,i&&(i.textContent=h),Zt()}c!==s.dataset.state&&Math.abs(o.getBoundingClientRect().top-f)>1&&Zt()}function po(e){((ee||0)>=en?e.querySelector("[data-timer-911]"):e.querySelector('[data-action="timer-log"]'))?.focus({preventScroll:!0})}function fs(e){clearInterval(tn);let t=e.querySelector("[data-timer-live]"),n=-1,s=!1,a=()=>{let o=_e();if(!o)return;let i=Math.max(0,Math.floor((Date.now()-o.ms)/1e3)),c=i>=en;bs(e,c?"over":"running",i);let f=Math.floor(i/60);t&&f!==n&&f>0&&(t.textContent=c&&!s?`${f} minutes. Call 911 now.`:`${f} ${f===1?"minute":"minutes"}`,c&&(s=!0)),n=f};a(),tn=setInterval(a,1e3)}function ys(){clearInterval(tn),tn=null}function sn(){return!!_e()||ee!=null}function ho(){_e()?document.documentElement.dataset.timer="running":delete document.documentElement.dataset.timer}ho();function ue(e,t,n=""){return`
    <section class="em-block"${n?` data-tone="${n}"`:""}>
      <h3>${e}</h3>
      ${t}
    </section>`}function an(e,{onClose:t}={}){let{card:n,contacts:s,profile:a}=e,o=s.filter(E=>vt(E.phone)),i=o.find(E=>E.primary)||o[0],c=s.filter(E=>E!==i),f=_(e),l=a.name||"This student",h=[a.pronouns,a.grade,a.school].filter(Boolean).join(" \xB7 "),p=i?`
    <a class="em-call" href="${cn(i.phone)}">
      <span class="em-call-ico" aria-hidden="true">${d("phone",22)}</span>
      <span class="em-call-body">
        <span class="em-call-n">Call ${u(i.name)}</span>
        <span class="em-call-r">${u(i.relation)}${i.relation?" \xB7 ":""}${u(i.phone)}</span>
      </span>
    </a>`:"",b=c.length?ue("Other contacts",`
    <ul class="rows">${c.map(E=>`
      <li class="contact-row contact-row-flat">
        <span class="contact-body">
          <span class="contact-n">${u(E.name)}</span>
          <span class="contact-r">${oo(E)}</span>
        </span>
        ${ro(E)}
      </li>`).join("")}</ul>`):"",z=[a.seizureType&&`<div class="kv-row"><dt class="kv-k">Seizure type</dt><dd class="kv-v">${u(a.seizureType)}</dd></div>`,a.allergies&&`<div class="kv-row"><dt class="kv-k">Allergies</dt><dd class="kv-v">${u(a.allergies)}</dd></div>`,f.length&&`<div class="kv-row"><dt class="kv-k">Medications</dt><dd class="kv-v">${f.map(E=>`${u(E.name)} ${u(E.dose)}`).join(", ")}</dd></div>`,a.bloodType&&`<div class="kv-row"><dt class="kv-k">Blood type</dt><dd class="kv-v">${u(a.bloodType)}</dd></div>`,a.neurologist&&`<div class="kv-row"><dt class="kv-k">Neurologist</dt><dd class="kv-v">${u(a.neurologist)}${a.neuroPhone?` \xB7 ${u(a.neuroPhone)}`:""}</dd></div>`].filter(Boolean).join(""),$=a.rescueMed?ue("Rescue medication",`
    <div class="stack stack-2">
      <p class="prose em-rescue">${u(a.rescueMed)}</p>
      <p class="t-sm ink-2">${u(co)}</p>
    </div>`):"",te=(E,Ao)=>E&&E.length?gs(E,Ao):"",Co=m`
    <div class="em-bar">
      <span class="em-bar-t">${r(d("shield",20))} Seizure — what to do</span>
      <button class="em-close" data-action="close-emergency">Close</button>
    </div>

    <div class="em-body">
      <div class="em-inner">
        <header class="em-who">
          <h2 class="em-name">${l}</h2>
          ${r(h?`<span class="em-sub">${u(h)}</span>`:"")}
        </header>

        ${r(uo())}

        <div class="em-calls">
          ${r(p)}
          <a class="em-911" href="tel:911">${r(d("phone",22))} Call 911</a>
        </div>

        ${r(n.during&&n.during.length?ue("What to do right now",te(n.during,"ok")):"")}
        ${r($)}
        ${r(n.callEms&&n.callEms.length?ue("Call 911 if",te(n.callEms,"ems"),"bad"):"")}
        ${r(n.doNot&&n.doNot.length?ue("Do NOT",te(n.doNot,"bad")):"")}
        ${r(n.looksLike?ue("What their seizures look like",`<p class="prose">${u(n.looksLike)}</p>`):"")}
        ${r(n.after&&n.after.length?ue("Afterwards",te(n.after,"")):"")}
        ${r(z?ue("Medical details",`<dl class="kv kv-flat">${z}</dl>`):"")}
        ${r(b)}

        <p class="em-foot">Standard seizure first aid. If in doubt, call 911.</p>
      </div>
    </div>
  `;ha(Co,{onMount(E){_e()?(fs(E),E.querySelector('[data-action="timer-stop"]')?.focus({preventScroll:!0})):ee!=null&&(bs(E,"stopped",ee),po(E)),Zt()},onClose(){ys(),t&&t()}})}function ps(e){let t=ne(e);return`${Ke(t.getMonth())} ${t.getDate()}, ${t.getFullYear()}`}function Ki(e){let{card:t,contacts:n,profile:s}=e,a=_(e),o=(p,b)=>`<ol${b?` class="${b}"`:""}>${p.map(z=>`<li>${u(z)}</li>`).join("")}</ol>`,i=(p,b,z)=>b&&b.length?`<section><h2>${p}</h2>${o(b,z)}</section>`:"",c=[s.pronouns,s.grade,s.school].filter(Boolean).join(" \xB7 "),f=[["Seizure type",s.seizureType],["Allergies",s.allergies],["Blood type",s.bloodType],["Medications",a.map(p=>{let b=ie(p).map(q).join(", ");return`${p.name}${p.dose?` ${p.dose}`:""}${b?` (${b})`:""}`}).join("; ")],["Neurologist",[s.neurologist,s.neuroPhone].filter(Boolean).join(" \u2014 ")]].filter(([,p])=>p),l=[...n].sort((p,b)=>Number(b.primary)-Number(p.primary)),h=[["forTeacher","Teachers"],["forNurse","School nurse"],["forCoach","Coaches and PE"]].filter(([p])=>t[p]);return`
    <article class="pc">
      <header class="pc-head">
        <div>
          <p class="pc-kicker">Seizure action card</p>
          <h1 class="pc-name">${u(s.name||"Student name")}</h1>
          ${c?`<p class="pc-sub">${u(c)}</p>`:""}
          <p class="pc-dated">Printed ${ps(g())}${t.updated?` \xB7 card last updated ${ps(t.updated)}`:""}.
            Standard seizure first aid \u2014 confirm with the student's neurologist.</p>
        </div>
        <div class="pc-911">In an emergency<strong>Call 911</strong></div>
      </header>

      ${f.length?`<dl class="pc-facts">${f.map(([p,b])=>`<div${p==="Medications"?' class="pc-wide"':""}><dt>${p}</dt><dd>${u(b)}</dd></div>`).join("")}</dl>`:""}

      <section class="pc-who">
        <h2>Who to call</h2>
        ${l.length?`<table class="pc-contacts"><tbody>${l.map(p=>`
          <tr>
            <td><strong>${u(p.name)}</strong>${p.primary?' <span class="pc-first">Call first</span>':""}</td>
            <td>${u(p.relation)}</td>
            <td>${u(p.phone)}</td>
          </tr>`).join("")}
        </tbody></table>`:"<p>No contacts added yet.</p>"}
      </section>

      ${s.rescueMed?`<section class="pc-rescue"><h2>Rescue medication</h2>
        <p>${u(s.rescueMed)}</p><p class="pc-note">${u(co)}</p></section>`:""}

      ${t.looksLike?`<section><h2>What their seizures look like</h2><p>${u(t.looksLike)}</p></section>`:""}

      <div class="pc-cols">
        <div>
          ${i("What to do",t.during)}
          ${i("Afterwards",t.after)}
        </div>
        <div>
          ${i("Do NOT",t.doNot,"pc-not")}
          ${t.callEms&&t.callEms.length?`<section class="pc-ems"><h2>Call 911 if</h2>${o(t.callEms,"pc-if")}</section>`:""}
        </div>
      </div>

      ${h.length?`<section class="pc-roles">${h.map(([p,b])=>`<div><h3>${b}</h3><p>${u(t[p])}</p></div>`).join("")}</section>`:""}

      <footer class="pc-foot">
        ${s.name?`${u(s.name)}\u2019s seizure action card, printed ${ps(g())}. `:""}Made with Synara.
      </footer>
    </article>`}function vs(e=O()){let t=document.getElementById("print-card");t&&(t.innerHTML=Ki(e))}ae(vs);window.addEventListener("beforeprint",()=>vs());var ao=new Set(["during","doNot","after","callEms"]),hs={looksLike:"What their seizures look like",during:"What to do",doNot:"What NOT to do",after:"Afterwards",callEms:"Call 911 if\u2026",forTeacher:"For teachers",forNurse:"For the school nurse",forCoach:"For coaches and PE"},Ui={looksLike:"Plain words beat medical terms \u2014 a substitute teacher has to recognise this.",forTeacher:"What should happen in class? Who do they send for? Anything in a 504 plan?",forNurse:"Rescue medication, who to call after 911, where they like to recover.",forCoach:"Activity limits, water rules, whether they can return to play the same day."},Ji={"card-edit"(e,t){let n=e.dataset.field;if(!hs[n])return;let s=ao.has(n),a=t.card[n],o=s?(a||[]).join(`
`):a||"";D({title:hs[n],body:m`
        <div class="field">
          <label class="label" for="card-text">
            ${s?"One step per line":"Write it the way you would say it out loud"}
          </label>
          <textarea class="textarea textarea-tall" id="card-text" name="text" maxlength="4000">${o}</textarea>
          <span class="hint">
            ${s?`Each line becomes one step on the card.${xt.has(n)?" Clear it all to go back to the standard steps.":""}`:Ui[n]||""}
          </span>
        </div>
      `,footer:`<button class="btn btn-primary" data-action="card-save" data-field="${n}">Save</button>`})},async"card-save"(e){let t=e.dataset.field;if(!hs[t])return;let n=J().text||"",s=ao.has(t)?n.split(`
`).map(o=>o.replace(/^\s*(\d+[.)]|[-*•])\s*/,"").trim()).filter(Boolean):n.trim(),a=xt.has(t)&&!s.length;a&&(s=Ys(t)),await ca({[t]:s}),C(),y(a?"The standard steps are back \u2014 the emergency card always needs these":"Safety card updated","ok")},"contact-open"(e,t){let n=e.dataset.id,s=n?t.contacts.find(i=>i.id===n):null,a=s||{name:"",relation:"",phone:"",primary:!t.contacts.length},o=s?` data-id="${s.id}"`:"";D({title:s?"Edit contact":"Add contact",body:m`
        <form class="stack stack-5" data-action="contact-save"${r(o)} novalidate>
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
              <input type="checkbox" class="check" name="primary" ${r(a.primary?"checked":"")} />
            </label>
          </div>
        </form>
      `,footer:`
        ${s?`<button class="btn btn-danger-soft" data-action="contact-delete" data-id="${s.id}">Delete</button>`:""}
        <button class="btn btn-primary" data-action="contact-save"${o}>Save</button>
      `})},async"contact-save"(e){let t=e.dataset.id||null,n=J();if(!n.name||!n.name.trim()){y("A name is needed","bad");return}if(!vt(n.phone)){y("That phone number doesn't look complete","bad");return}let s={name:n.name,relation:n.relation||"",phone:n.phone,primary:!!n.primary};t?await ra(t,s):await oa(s),C(),y(t?"Contact updated":"Contact added","ok")},"contact-delete"(e){let t=e.dataset.id;F({title:"Delete this contact?",message:"They will be removed from the safety card, the emergency screen, and the printed card.",async onConfirm(){await ia(t),y("Contact deleted")}})},"timer-start"(){ee=null,We=se(),Xt({ms:Date.now(),at:We}),fs(re()),re().querySelector('[data-action="timer-stop"]')?.focus({preventScroll:!0})},"timer-earlier"(){let e=_e();if(!e)return;let t=e.ms-60*1e3;Xt({ms:t,at:se(new Date(t))}),fs(re())},"timer-stop"(){let e=_e();ys(),e&&(ee=Math.max(1,Math.floor((Date.now()-e.ms)/1e3)),We=e.at,Xt(null),bs(re(),"stopped",ee),po(re()))},"timer-reset"(){ee=null,We=null,Xt(null),ys();let e=re().querySelector(".em-timer");e&&(e.outerHTML=uo()),re().querySelector('[data-action="timer-start"]')?.focus({preventScroll:!0})},"timer-log"(){let e=ee||0,t=We||`${g()}T${he()}`;ee=null,We=null,De(),ls({at:t,duration:e})},"print-card"(e,t){if(!document.getElementById("print-card"))return;let n=navigator.userAgent,s=/iPad|iPhone|iPod/.test(n)||/Macintosh/.test(n)&&navigator.maxTouchPoints>1,a=window.navigator.standalone===!0||window.matchMedia("(display-mode: standalone)").matches;if(s&&a){y("To print, open this page in Safari. Home-screen apps can\u2019t print on iPhone or iPad.","bad");return}vs(t),window.print()}};var xs={};Me(xs,{actions:()=>dc,askToJoin:()=>on,render:()=>Gi,showConflict:()=>Ss,subtitle:()=>Xi,title:()=>Vi});function Vi(){return"You"}function Xi(e){return e.profile.school||"Your details and settings"}var yo=[["name","Name","Maya Ellison"],["pronouns","Pronouns","she/her"],["grade","Grade","11th grade"],["school","School","Rosewood High School"],["seizureType","Seizure type","Focal impaired awareness"],["diagnosed","Diagnosed","2022"],["neurologist","Neurologist","Dr. Raghavan"],["neuroPhone","Neurologist phone","(555) 010-4488"],["allergies","Allergies","Penicillin"],["bloodType","Blood type","O+"],["rescueMed","Rescue medication","From your seizure action plan","Only if your seizure action plan has one: what it is, when it is given, and where it is kept. Copy it from the plan your doctor or school nurse gave you. Leave it blank if you don\u2019t have one."]];function Gi(e){return m`
    <div class="split-grid">
      <div class="split-main">
        ${r(Qi(e))}
        ${r(Zi(e))}
      </div>
      <div class="split-side">
        ${r(ec(e))}
        ${r(sc(e))}
        ${r(oc(e))}
        ${r(rc(e))}
        ${r(ic())}
      </div>
    </div>
  `}function Qi(e){let{profile:t}=e,n=ke(e),s=[t.pronouns,t.grade].filter(Boolean).join(" \xB7 "),a=wt(t.name);return m`
    <div class="card card-flush">
      <div class="profile-head">
        <span class="avatar avatar-lg" aria-hidden="true">${a||r(d("user",26))}</span>
        <span class="row-body">
          <span class="profile-n">${t.name||"Add your name"}</span>
          <span class="profile-s">${s||"Tap edit to fill in your details"}</span>
        </span>
        <button class="icon-btn" data-action="profile-edit" aria-label="Edit your details">
          ${r(d("edit"))}
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
  `}function Zi(e){let{profile:t}=e,n=yo.map(([s,a])=>`
    <div class="kv-row">
      <dt class="kv-k">${a}</dt>
      <dd class="kv-v">${t[s]?u(t[s]):'<span class="ink-faint">\u2014</span>'}</dd>
    </div>`).join("");return m`
    <section class="section" aria-labelledby="care-h">
      <div class="section-head">
        <h2 id="care-h">Care details</h2>
        <button class="btn btn-sm btn-quiet" data-action="profile-edit">${r(d("edit",15))} Edit</button>
      </div>
      <div class="card card-flush"><dl class="kv">${r(n)}</dl></div>
      <p class="hint">
        These appear on the emergency card and the printed card, so whoever
        helps you has them without having to ask.
      </p>
    </section>
  `}function go(e){let t=Date.parse(e);if(!t)return"";let n=Math.round((Date.now()-t)/6e4);if(n<1)return"just now";if(n<60)return`${n} min ago`;let s=Math.round(n/60);return s<24?`${s} h ago`:new Date(t).toLocaleDateString(void 0,{month:"short",day:"numeric"})}var ks={"signed-out":"Sign in to Flux again to keep syncing.",offline:"Offline. It will sync when you\u2019re back online.","not-ready":"Sync isn\u2019t switched on for Flux yet.","wrong-key":"This device\u2019s sync key doesn\u2019t open the synced copy.",gone:"Turned off: the synced copy was deleted on another device.","other-account":"Paused: a different Flux account is signed in on this device than the one it syncs with.","save-failed":"This device\u2019s storage is full or blocked, so the synced changes couldn\u2019t be saved here yet."};function bo(){let e=Fe();if(!K())return e.error==="gone"?ks.gone:e.phase==="needs-key"?"Synced on another device. Enter its sync key to connect this one.":e.account?"Off. Turn it on to keep Synara the same on every device you sign in to.":"Sign in to Flux to keep Synara the same on your phone and computer.";if(e.phase==="syncing")return"Syncing\u2026";if(e.phase==="conflict")return"Changed on two devices. Choose which to keep.";if(e.phase==="error")return ks[e.error]||"Couldn\u2019t sync. It will try again.";let t=Na();return t?`On \xB7 synced ${go(t)}`:"On"}function ec(e){return Nn()?m`
    <section class="section" aria-labelledby="flux-h">
      <h2 id="flux-h">Flux</h2>
      <div class="card card-flush">
        <div class="list-row list-row-static">
          <span class="med-dot" data-color="violet" aria-hidden="true">${r(d("calendar",20))}</span>
          <span class="row-body">
            <span class="row-t" id="fluxlink-label">Show in my Flux Planner</span>
            <span class="row-s">Dose times on your Flux calendar and a safety-card button in
              School info, on this device. Seizures, contacts and notes stay in Synara.</span>
          </span>
          <button class="switch" data-action="flux-link-toggle" role="switch"
                  aria-checked="${!!e.settings.fluxLink}" aria-labelledby="fluxlink-label"></button>
        </div>
        <button class="list-row" data-action="sync-open">
          <span class="med-dot" data-color="blue" aria-hidden="true">${r(d("sync",20))}</span>
          <span class="row-body">
            <span class="row-t">Sync across your devices</span>
            <span class="row-s">${bo()}</span>
          </span>
          <span class="chev">${r(d("chevron"))}</span>
        </button>
      </div>
    </section>
  `:""}var mo=m`
  <ul class="sheet-list">
    <li>${r(d("lock",16))}<span>Synara encrypts everything on this device before it leaves. Flux keeps
      a locked copy it can’t open. It can see that your account uses Synara and when the copy last
      changed, but never your medication, seizures or contacts.</span></li>
    <li>${r(d("info",16))}<span>The key stays on your devices. You’ll get a <strong>sync key</strong> to
      enter on your other devices. If you lose every device and the key, the synced copy can’t be
      opened — but each device keeps its own.</span></li>
  </ul>
`;async function $s(){let e=await ot();if(!K()&&!e){D({title:"Sync across your devices",body:m`
        <p class="sheet-message">Sign in to your Flux account, then come back here to keep Synara the
          same on your phone and computer.</p>
        ${r(mo)}
      `,footer:`
        <button class="btn btn-quiet" data-action="close-sheet">Not now</button>
        <a class="btn btn-primary" href="index.html" data-return="synara">Sign in to Flux</a>
      `});return}if(!K()){D({title:"Sync across your devices",body:m`
        <p class="sheet-message">Signed in to Flux as <strong>${e.email||"your account"}</strong>.</p>
        ${r(mo)}
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
      `});return}let t=Fe();D({title:"Sync is on",body:m`
      <p class="sheet-message">${bo()}${r(t.account?` \xB7 ${u(t.account.email)}`:"")}</p>
      <div class="sync-key">
        <span class="label">Your sync key</span>
        <code class="mono">${Bt()}</code>
        <span class="t-sm ink-3">Your other devices sync on their own once you sign in to Flux there. The key and sync link are only needed for a copy made before that, and both should stay private.</span>
      </div>
      <div class="stack stack-2 mt-3">
        <button class="btn btn-primary btn-block" data-action="sync-copy-link">Copy sync link</button>
        <button class="btn btn-outline btn-block" data-action="sync-copy-key">Copy sync key</button>
        <button class="btn btn-outline btn-block" data-action="sync-now">Sync now</button>
        <button class="btn btn-quiet btn-block" data-action="sync-stop">Turn off on this device</button>
        <button class="btn btn-quiet btn-block text-bad" data-action="sync-stop-delete">Turn off and delete the synced copy</button>
      </div>
    `})}function Ss(){D({title:"Which copy should Synara keep?",body:m`
      <p class="sheet-message">Synara changed on this device and on another one since they last
        synced. Pick the copy to keep; the other will be replaced.</p>
    `,footer:`
      <button class="btn btn-outline" data-action="sync-resolve" data-choice="cloud">Use the other device\u2019s</button>
      <button class="btn btn-primary" data-action="sync-resolve" data-choice="device">Keep this device\u2019s</button>
    `})}var tc=[[0,"On time"],[10,"10 min early"],[15,"15 min early"],[30,"30 min early"]];function vo(e){return e.settings.remindersOn&&Re().ok&&de()==="granted"}function nc(e,t,n,s){return t.ok?n==="denied"?"Notifications are blocked for this site in your browser settings.":e.settings.remindersOn&&!s?"Not allowed on this device yet. Turn this on to allow notifications.":s&&ba()?"Your last reminder didn\u2019t show on this device. Keep a phone alarm for your doses.":s?"On \u2014 only while Synara is open.":"A nudge at each dose time.":t.reason}function sc(e){let{reminderLead:t}=e.settings,n=Re(),s=de(),a=!n.ok||s==="denied",o=vo(e),i=nc(e,n,s,o),c=tc.map(([f,l])=>`
    <button class="segment" data-action="reminder-lead" data-value="${f}"
            aria-pressed="${f===t}">${l}</button>`).join("");return m`
    <section class="section" aria-labelledby="rem-h">
      <h2 id="rem-h">Reminders</h2>
      <div class="card card-flush">
        <div class="list-row list-row-static">
          <span class="med-dot" data-color="amber" aria-hidden="true">${r(d("bell",20))}</span>
          <span class="row-body">
            <span class="row-t" id="rem-label">Dose reminders</span>
            <span class="row-s">${i}</span>
          </span>
          <button class="switch" data-action="reminders-toggle" role="switch"
                  aria-checked="${o}" aria-labelledby="rem-label"
                  ${r(a?"disabled":"")}></button>
        </div>
        ${r(o?`
          <div class="list-row list-row-static list-row-stack">
            <span class="row-t">When to remind you</span>
            <div class="segments segments-wrap" role="group" aria-label="Reminder timing">${c}</div>
          </div>
          <button class="list-row" data-action="reminders-test">
            <span class="row-body">
              <span class="row-t">Send a test notification</span>
              <span class="row-s">Check it actually comes through on this device</span>
            </span>
            <span class="chev">${d("chevron")}</span>
          </button>`:"")}
      </div>
      <div class="disclaimer">
        ${r(d("alert",16))}
        <span>
          <strong>Keep a phone alarm as your real backup.</strong> Synara can only
          remind you while it's open, in a browser tab or from your home screen.
          Close it or restart your phone and no reminder comes. On iPhone,
          switching to another app can stop it too.
        </span>
      </div>
    </section>
  `}var ac=[["system","Match device"],["light","Light"],["dark","Dark"]];function oc(e){let t=e.settings.theme||"system",n=ac.map(([s,a])=>`
    <button class="segment" data-action="theme-set" data-theme="${s}"
            aria-pressed="${s===t}">${a}</button>`).join("");return m`
    <section class="section" aria-labelledby="look-h">
      <h2 id="look-h">Appearance</h2>
      <div class="card">
        <div class="segments" role="group" aria-label="Theme">${r(n)}</div>
        <p class="hint mt-3">
          Dark mode is here for a reason: this app gets opened at 3am to log a
          seizure that just woke you. Nothing in Synara ever flashes or strobes.
        </p>
      </div>
    </section>
  `}function rc(e){let t=(e.seizures||[]).length,n=Object.keys(e.doses||{}).length,s=Object.keys(e.checkins||{}).length;return m`
    <section class="section" aria-labelledby="data-h">
      <h2 id="data-h">Your data</h2>
      <div class="card card-flush">
        <ul class="rows">
          <li class="list-row list-row-static">
            <span class="med-dot" data-color="mint" aria-hidden="true">${r(d("lock",20))}</span>
            <span class="row-body">
              <span class="row-t">${K()?"On this device, with encrypted sync":"Stored on this device"}</span>
              <span class="row-s">${T(n,"day")} of doses · ${T(t,"seizure")} · ${T(s,"check-in")}</span>
            </span>
          </li>
          <li>
            <button class="list-row" data-action="data-export">
              <span class="med-dot" data-color="violet" aria-hidden="true">${r(d("down",20))}</span>
              <span class="row-body">
                <span class="row-t">Download a backup</span>
                <span class="row-s">Everything in one file — keep it, or give it to your doctor</span>
              </span>
              <span class="chev">${r(d("chevron"))}</span>
            </button>
          </li>
          <li>
            <label class="list-row file-row">
              <span class="med-dot" data-color="blue" aria-hidden="true">${r(d("up",20))}</span>
              <span class="row-body">
                <span class="row-t">Restore from a backup</span>
                <span class="row-s">Moving to a new phone? Load the file here</span>
              </span>
              <span class="chev">${r(d("chevron"))}</span>
              <input type="file" accept="application/json,.json" class="sr-only" data-change="data-import" />
            </label>
          </li>
          <li>
            <button class="list-row" data-action="data-demo">
              <span class="med-dot" data-color="amber" aria-hidden="true">${r(d("sparkle",20))}</span>
              <span class="row-body">
                <span class="row-t">Load example data</span>
                <span class="row-s">Replaces everything with a demo record, to show someone the app</span>
              </span>
              <span class="chev">${r(d("chevron"))}</span>
            </button>
          </li>
          <li>
            <button class="list-row" data-action="data-wipe">
              <span class="med-dot" data-color="rose" aria-hidden="true">${r(d("trash",20))}</span>
              <span class="row-body">
                <span class="row-t text-bad">Delete everything</span>
                <span class="row-s">Removes all of your data from this device</span>
              </span>
              <span class="chev">${r(d("chevron"))}</span>
            </button>
          </li>
        </ul>
      </div>
      <div class="disclaimer">
        ${r(d("info",16))}
        <span>
          <strong>Your record stays on this device.</strong> No account needed, and
          no analytics.${it()?" Signed in to Flux, an encrypted copy and its key are kept in your Flux account unless you turn Sync off, so any device you sign in to can open it. Only you can reach it through Flux, but Flux\u2019s own staff and systems could read it.":""}
          Clearing your browser's data deletes what's here, and it won't move to a new
          phone on its own, so download a backup now and then. The font comes from
          Google Fonts, so Google can see the page was opened, but never what's in it.
        </span>
      </div>
    </section>
  `}function ic(){return m`
    <section class="section" aria-labelledby="about-h">
      <h2 id="about-h">About</h2>
      <div class="card">
        <p>
          <strong>Synara</strong> puts medication reminders, seizure tracking, and an
          emergency card in one place, built around school life rather than a clinic.
        </p>
        <hr class="hr" />
        <p class="t-sm ink-3">
          Version 2.2. Synara is not a medical device, and nothing here is medical
          advice. Always check your care plan with your neurologist or school nurse.
        </p>
        <hr class="hr" />
        <div class="about-flux">
          ${r(je())}
          <span class="t-sm ink-3">Built and hosted by Flux, the free planner for school.</span>
        </div>
      </div>
    </section>
  `}function fo(e){let t=Ae;return e>t?`${e} of ${t} characters: ${e-t} too many to save`:`${e} of ${t} characters`}function cc(e){let t=Array.isArray(e.meds)?e.meds.length:0,n=Array.isArray(e.seizures)?e.seizures.length:0,s=e.doses&&typeof e.doses=="object"?Object.keys(e.doses).length:0,a=e.profile&&typeof e.profile.name=="string"&&e.profile.name.trim();return`${a?`${a.slice(0,80)}'s record: `:""}${T(t,"medication")}, ${T(s,"day")} of doses, ${T(n,"seizure")}.`}function lc(){return location.origin+location.pathname+"#/home?sync="+Bt().replace(/-/g,"")}async function on(e){let t;try{t=await Ia(e)}catch(n){y(Se(n),"bad");return}F({title:"Use your synced copy here?",message:`Your synced copy, updated ${go(t.updatedAt)}, has ${T(t.meds,"medication")} and ${T(t.seizures,"logged seizure")}${t.name?` for ${t.name}`:""}. It will replace what is on this device now.`,confirmLabel:"Use synced copy",danger:!1,async onConfirm(){try{await Hn(t.key),y("This device is synced","ok")}catch(n){y(Se(n),"bad")}}})}var dc={"profile-edit"(e,t){let n=t.profile,s=yo.map(([a,o,i,c])=>{let f=c?` aria-describedby="p-${a}-hint${a==="rescueMed"?" p-rescueMed-count":""}"`:"",l=a==="rescueMed"?`<textarea class="textarea" id="p-${a}" name="${a}" rows="4"
                     placeholder="${u(i)}" autocomplete="off"${f}>${u(n[a]||"")}</textarea>
           <span class="hint" id="p-rescueMed-count" data-rescue-count>${fo((n[a]||"").length)}</span>`:`<input class="input" id="p-${a}" name="${a}" value="${u(n[a]||"")}"
                  placeholder="${u(i)}" autocomplete="off" maxlength="200"${f} />`;return`
      <div class="field">
        <label class="label" for="p-${a}">${o}</label>
        ${l}
        ${c?`<span class="hint" id="p-${a}-hint">${u(c)}</span>`:""}
      </div>`}).join("");D({title:"Your details",body:m`<form class="stack stack-4" data-action="profile-save" novalidate>${r(s)}</form>`,footer:'<button class="btn btn-primary" data-action="profile-save">Save</button>',onMount(a){let o=a.querySelector("#p-rescueMed"),i=a.querySelector("[data-rescue-count]");!o||!i||o.addEventListener("input",()=>{i.textContent=fo(o.value.trim().length),i.classList.toggle("text-bad",o.value.trim().length>Ae)})}})},async"profile-save"(){let e=J(),t=(e.rescueMed||"").trim();if(t.length>Ae){let n=t.length-Ae;y(`The rescue medication is ${n} ${n===1?"character":"characters"} too long to save. Shorten it, or keep the details in the action plan.`,"bad"),document.getElementById("p-rescueMed")?.focus();return}await Et(e),C(),y("Details saved","ok")},async"reminders-toggle"(e,t){let n=!vo(t);if(n){let s=Re();if(!s.ok){y(s.reason,"bad");return}if(await ga()!=="granted"){y("Notifications weren't allowed","bad");return}}await ce({remindersOn:n}),y(n?"Reminders on":"Reminders off",n?"ok":"default")},async"reminder-lead"(e){await ce({reminderLead:Number(e.dataset.value)||0})},async"reminders-test"(){let e=await $a();e==="sent"?y("Test sent \u2014 check your notifications","ok"):e==="not-allowed"?y("Notifications aren\u2019t allowed for Synara on this device","bad"):y("This browser didn\u2019t show it. Keep a phone alarm for your doses.","bad")},async"theme-set"(e){await ce({theme:e.dataset.theme})},"data-export"(e,t){let n=new Blob([Ct()],{type:"application/json"}),s=URL.createObjectURL(n),a=document.createElement("a"),o=(t.profile.name||"backup").replace(/[^\w-]+/g,"-").toLowerCase();a.href=s,a.download=`synara-${o}-${g()}.json`,document.body.appendChild(a),a.click(),a.remove(),setTimeout(()=>URL.revokeObjectURL(s),1e3),y("Backup downloaded","ok")},async"data-import"(e){let t=e.files&&e.files[0];if(e.value="",!t)return;if(t.size>5*1024*1024){y("That file is too large to be a Synara backup","bad");return}let n=await t.text(),s=null;try{s=JSON.parse(n)}catch{}if(!kn(s)){y("That file isn't a Synara backup","bad");return}F({title:"Replace everything with this backup?",message:`${cc(s)} Everything currently on this device will be replaced. Download a backup of what's here first if you might need it.`,confirmLabel:"Restore backup",danger:!1,async onConfirm(){try{await At(n),y("Backup restored","ok")}catch(a){y(a.message==="save-failed"?"Couldn\u2019t restore it \u2014 your browser storage may be full or blocked.":"Couldn't read that backup","bad")}}})},"data-demo"(){let e=K();F({title:"Load example data?",message:"Everything on this device will be replaced with a made-up student's record. Download a backup first if any of what's here is real."+(e?" Sync turns off on this device first, so the example never reaches your other devices.":""),confirmLabel:"Load example data",async onConfirm(){e&&await He(),await et({seedFn:_t}),y("Example data loaded","ok")}})},"data-wipe"(){F({title:"Delete everything?",message:"Every medication, dose, seizure, check-in, contact, and your safety card will be removed from this device. This can't be undone.",confirmLabel:"Delete everything",async onConfirm(){await He(),await Xs();try{sessionStorage.removeItem("synara.timer")}catch{}history.replaceState(null,"",location.pathname),location.reload()}})},async"flux-link-toggle"(e,t){let n=!t.settings.fluxLink;await ce({fluxLink:n}),y(n?"Your dose times now show in your Flux Planner":"Removed from your Flux Planner","ok")},"sync-open"(){return $s()},async"sync-start-new"(){try{await Wt(),await C(),y("Sync is on","ok"),$s()}catch(e){e.code==="has-copy"?uc():y(Se(e),"bad")}},async"sync-join-check"(){let{key:e}=J();await on(e)},async"sync-copy-link"(){try{await navigator.clipboard.writeText(lc()),y("Sync link copied. Open it on your other device.","ok")}catch{y("Couldn\u2019t copy. Use the sync key instead.","bad")}},async"sync-copy-key"(){try{await navigator.clipboard.writeText(Bt()),y("Sync key copied","ok")}catch{y("Couldn\u2019t copy. Select the key and copy it instead.","bad")}},async"sync-now"(){await C();let e=await dt();e==="error"?y(Se(Fe()),"bad"):e!=="conflict"&&y("Synced","ok")},"sync-stop"(){F({title:"Turn off sync on this device?",message:"This device keeps everything it has. Your synced copy and your other devices are not changed.",confirmLabel:"Turn off",danger:!1,async onConfirm(){await He(),y("Sync is off on this device","ok")}})},"sync-stop-delete"(){F({title:"Delete the synced copy?",message:"The encrypted copy in your Flux account is deleted and sync stops on every device. Each device keeps its own record.",confirmLabel:"Delete synced copy",async onConfirm(){try{await He({deleteCopy:!0}),y("Synced copy deleted","ok")}catch(e){y(Se(e),"bad")}}})},async"sync-resolve"(e){await C();try{await ja(e.dataset.choice),y("Synced","ok")}catch(t){y(Se(t),"bad")}},"sync-fresh"(){F({title:"Delete the old synced copy?",message:"Only do this if you no longer have the device or the sync key it was made with. The old copy is deleted and this device becomes the new one to sync from.",confirmLabel:"Delete and start fresh",async onConfirm(){try{await He({deleteCopy:!0}),await Wt(),y("Sync is on","ok"),$s()}catch(e){y(Se(e),"bad")}}})}};function Se(e){let t=e&&(e.code||e.error||e.message)||"";return t==="bad-key"?"That isn\u2019t a sync key. It\u2019s 26 letters and numbers.":t==="no-copy"?"There\u2019s no synced copy in this Flux account yet. Turn sync on from your other device first.":t==="wrong-key"?"That key doesn\u2019t open your synced copy. Check it on your other device.":ks[t]||"Couldn\u2019t sync. Please try again."}function uc(){D({title:"You already have a synced copy",body:m`
      <p class="sheet-message">Your Flux account already has a synced copy of Synara. To use it here,
        enter the sync key from the device where you turned sync on (You → Flux → Sync).</p>
      <p class="sheet-message">Lost that device and its key? You can delete the old copy and start
        again from this one.</p>
    `,footer:`
      <button class="btn btn-quiet" data-action="sync-open">Enter a sync key</button>
      <button class="btn btn-danger" data-action="sync-fresh">Start fresh</button>
    `})}var Ts={home:ss,meds:os,track:ds,safety:ws,you:xs},Es=["home","meds","track","safety","you"],Cs={home:{label:"Home",icon:"home"},meds:{label:"Meds",icon:"pill"},track:{label:"Seizures",icon:"chart"},safety:{label:"Safety",icon:"shield"},you:{label:"You",icon:"user"}},wo={sos:"safety"},H="home",U={shell:document.querySelector(".app-shell"),appbar:document.getElementById("appbar"),screen:document.getElementById("screen"),tabbar:document.getElementById("tabbar")},$o=document.documentElement.dataset.host==="flux",rn=document.querySelector("[data-flux-hub]");function As(){let e=(location.hash||"").replace(/^#\/?/,"").split(/[/?]/)[0];return wo[e]?{route:wo[e],sos:e==="sos"}:{route:Es.includes(e)?e:"home",sos:!1}}function pc(e){Es.includes(e)&&location.hash!==`#/${e}`&&(location.hash=`#/${e}`)}function xo(e){let t=document.documentElement;e==="light"||e==="dark"?t.setAttribute("data-theme",e):t.removeAttribute("data-theme");let n=e==="dark"||e!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches;for(let s of document.querySelectorAll('meta[name="theme-color"]'))s.content=e==="system"?s.media.includes("dark")?"#121019":"#f6f5fa":n?"#121019":"#f6f5fa"}function hc(e){let t=g();return L(t,e).filter(({med:n,time:s})=>P(t,n.id,s,e)==="pending").length}function mc(e){let t=hc(e);U.tabbar.innerHTML=m`
    <div class="sidebar-brand">
      <div class="brand-mark">${r(Pt())}</div>
      <div>
        <div class="brand-name">Synara</div>
        <div class="brand-tag">Epilepsy care for school</div>
      </div>
    </div>
    ${r(Es.map(n=>{let s=Cs[n],a=n===H,o=n==="meds"&&t>0,i=o?`${s.label}, ${t} ${t===1?"dose":"doses"} not logged today`:s.label;return`
        <button class="tab" data-action="nav" data-to="${n}"
                ${a?'aria-current="page"':""} aria-label="${i}">
          <span class="tab-ico">${d(s.icon)}</span>
          <span class="tab-label">${s.label}</span>
          ${o?'<span class="tab-dot" aria-hidden="true"></span>':""}
        </button>`}).join(""))}
    <button class="sidebar-sos" data-action="open-emergency">
      ${r(d("shield",18))}
      <span>Open emergency card</span>
    </button>
    ${r(je("sidebar-powered"))}
  `}function fc(e){let t=Ts[H],n=t.title?t.title(e):Cs[H].label,s=t.subtitle?t.subtitle(e):"";U.appbar.innerHTML=m`
    <div class="appbar-title">
      <h1 class="appbar-t">${n}</h1>
      ${r(s?`<span class="appbar-s">${u(s)}</span>`:"")}
    </div>
    <button class="sos-btn" data-action="open-emergency"
            aria-label="Open the emergency seizure card">
      ${r(d("shield",16))}<span>SOS</span>
    </button>
  `,rn&&U.appbar.insertBefore(rn,U.appbar.querySelector(".sos-btn"))}function yc(){let e=Ks();if(e==="ok")return"";let t=e==="memory";return m`
    <div class="insight save-notice" data-tone="watch">
      <span class="insight-ico" aria-hidden="true">${r(d("alert",20))}</span>
      <span class="insight-body">
        <span class="insight-t">${t?"Not saving on this device":"Changes aren\u2019t saving right now"}</span>
        <span class="insight-d">${t?"Your browser isn\u2019t letting Synara save, so what you add will be gone when you close it. Download a backup to keep it. The emergency card still works.":"Your browser\u2019s storage is full or blocked. What you see is what was last saved. The emergency card still works."}</span>
        ${r(t?'<button class="btn btn-sm btn-outline mt-3" data-action="data-export">Download a backup</button>':"")}
      </span>
    </div>
  `}var ko="";function gc(e){let t=H!==ko?" route-enter":"";ko=H,U.screen.innerHTML=m`
    <div class="screen-inner${t}" data-route="${H}">${r(yc())}${r(Ts[H].render(e))}</div>
  `}function ft(){let e=O(),t=U.screen.scrollTop,n=document.activeElement,s=rn&&rn.contains(n),a=n&&!s&&U.shell.contains(n)?It(n):null;document.title=`${Cs[H].label} \xB7 Synara`,xo(e.settings.theme),ka(e),mc(e),fc(e),gc(e),U.screen.scrollTop=t,a?Mn(a,U.shell):s&&n.focus()}var Ms={nav(e){pc(e.dataset.to)},"close-sheet"(){C()},"close-emergency"(){De()},"skip-to-content"(){U.screen.focus()},"open-emergency"(){an(O(),xe?{onClose:Eo}:void 0)},"intro-sos"(){Le()&&ge(),To()},"setup-go"(e){Le()&&ge(),yt(e.dataset.target,e)},reload(){location.reload()}};for(let e of[...Object.values(Ts),Qn])if(e.actions)for(let[t,n]of Object.entries(e.actions))Ms[t]&&console.warn(`[synara] duplicate action "${t}"`),Ms[t]=n;function yt(e,t){let n=Ms[e];return n?(Promise.resolve(n(t,O())).catch(s=>{console.error("[synara] action failed:",e,s),y(s&&s.message==="save-failed"?"Could not save \u2014 your browser storage may be full or blocked.":"Something went wrong. Please try that again.","bad")}),!0):!1}document.addEventListener("click",e=>{let t=e.target.closest("[data-action]");!t||t.tagName==="FORM"||yt(t.dataset.action,t)&&e.preventDefault()});document.addEventListener("submit",e=>{let t=e.target.closest("form[data-action]");t&&(e.preventDefault(),yt(t.dataset.action,t))});document.addEventListener("change",e=>{let t=e.target.closest("[data-change]");t&&yt(t.dataset.change,t)});function So(){let e=As();e.route!==H&&(H=e.route,Ne()&&!e.sos&&De(),C(),U.screen.scrollTop=0,ft()),e.sos&&Mo()}function Mo(e){an(O(),e),xe||Os()}function Os(){As().sos&&history.replaceState(null,"","#/safety")}var xe=!1;function To(){xe=!0,Mo({onClose:Eo})}function Eo(){setTimeout(()=>{if(xe){if(wn()){xe=!1,Os();return}Rt()||Ne()||Le()||sn()||(xe=!1,Vt({fromCard:!0}))}})}document.addEventListener("keydown",e=>{e.key!=="Escape"||!Le()||!Gn()||Rt()||Ne()||yt("intro-sos")});ae(()=>{wn()&&(xe=!1,Os())});function bc(){let e=g();setInterval(()=>{if(Ne())return;let t=g();t!==e&&Ie(),(H==="home"||t!==e)&&ft(),e=t},6e4)}function vc(){let e=[...document.querySelectorAll('script[src], link[rel="stylesheet"][href]')].map(t=>t.getAttribute("src")||t.getAttribute("href")).filter(t=>!/^([a-z]+:)?\/\//i.test(t));for(let t of[location.pathname,...e])fetch(t).catch(()=>{})}function wc(){if(!("serviceWorker"in navigator)||location.protocol==="file:")return;let e=()=>{($o?navigator.serviceWorker.register(new URL("service-worker.js",location.href),{updateViaCache:"none"}):navigator.serviceWorker.register("sw.js")).catch(n=>{console.warn("[synara] service worker not registered:",n)})};$o&&navigator.serviceWorker.addEventListener("controllerchange",vc),document.readyState==="complete"?e():window.addEventListener("load",e,{once:!0})}async function $c(){let e=/[?&]sync=([0-9A-Za-z-]+)/.exec(location.hash);e&&history.replaceState(null,"",location.pathname+location.search+location.hash.replace(/[?&]sync=[^&]*/,""));let t=As();H=t.route;let{firstRun:n}=await Vs();ae(ft),ft(),n&&(t.sos||sn())?To():n&&!e?Vt():t.sos&&So(),window.addEventListener("hashchange",So),window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>xo(O().settings.theme)),document.addEventListener("click",a=>{if(a.target.closest('[data-return="synara"]'))try{sessionStorage.setItem("flux_return_to","synara.html")}catch{}}),wa(),wc(),bc();let s=!1;Da(a=>{let o=a.phase==="needs-key";(H==="you"||H==="home"&&o!==s)&&ft(),s=o,a.phase==="conflict"&&!Rt()&&!Ne()&&Ss(),n&&a.phase==="idle"&&K()&&Le()&&ge()}),Ra().then(()=>{e&&!K()&&on(e[1])})}$c().catch(e=>{console.error("[synara] failed to start:",e),U.screen.innerHTML=m`
    <div class="screen-inner">
      <div class="empty">
        <span class="empty-ico">${r(d("alert",32))}</span>
        <span class="empty-t">Synara couldn't start</span>
        <span class="empty-s">
          Reloading the page usually fixes it. The emergency card still opens from here.
        </span>
        <button class="btn btn-primary" data-action="open-emergency">
          ${r(d("shield",18))} Open emergency card
        </button>
        <button class="btn btn-outline" data-action="reload">Reload</button>
      </div>
    </div>
  `});})();
