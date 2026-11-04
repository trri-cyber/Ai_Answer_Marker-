const $ = id => document.getElementById(id);
async function activeTab(){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});return tab}
async function send(action){const tab=await activeTab();if(!tab?.id)throw new Error("No active tab.");return chrome.tabs.sendMessage(tab.id,{action})}
async function refresh(){try{const tab=await activeTab();const result=await chrome.tabs.sendMessage(tab.id,{action:"AQ_GET_PROGRESS"});$("status").textContent=result?.isMoodle?"Moodle detected":"Not detected";const p=result?.progress||{};$("total").textContent=p.total||0;$("answered").textContent=p.applied||0;$("review").textContent=p.needsReview||0;const pct=p.total?Math.round((p.applied/p.total)*100):0;$("progressBar").style.width=pct+"%";$("progressText").textContent=p.total?`${pct}% applied · ${p.unanswered||0} unanswered`:"Scan a Moodle quiz page to begin."}catch{$("status").textContent="Open Moodle";}}
$("scan").addEventListener("click",async()=>{try{const r=await send("AQ_SCAN");$("message").textContent=r.message||`Detected ${r.questions?.length||0} questions.`;await refresh()}catch(e){$("message").textContent="Could not scan this page. Open a Moodle quiz attempt first."}});
$("suggest").addEventListener("click",async()=>{try{const r=await send("AQ_SUGGEST_VISIBLE");$("message").textContent=r.message||"Suggestions are ready in the question panel."}catch(e){$("message").textContent=e.message}});
$("reviewBtn").addEventListener("click",()=>chrome.tabs.create({url:chrome.runtime.getURL("ui/review.html")}));
$("databaseBtn").addEventListener("click",()=>chrome.tabs.create({url:chrome.runtime.getURL("ui/dashboard.html")}));
$("settingsBtn").addEventListener("click",()=>chrome.tabs.create({url:chrome.runtime.getURL("ui/settings.html")}));
refresh();
