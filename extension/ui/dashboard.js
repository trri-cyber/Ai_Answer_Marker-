const $=id=>document.getElementById(id);
async function render(){const rows=await AutoQuizDB.all();$("records").innerHTML=rows.map(r=>`<div class="record"><strong>${esc(r.question)}</strong><p>${esc(String(r.answer))}</p><div class="muted">${esc(r.questionType)} · ${r.verified?"Verified":"Unverified"} · ${esc(r.source)}</div><button data-delete="${r.id}">Delete</button></div>`).join("")||"<p>No saved answers yet.</p>";}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
$("add").onclick=async()=>{if(!$("question").value.trim()||!$("answer").value.trim())return alert("Enter both question and answer.");await AutoQuizDB.add({question:$("question").value,questionType:$("type").value,answer:$("answer").value,explanation:$("explanation").value,verified:$("verified").checked,source:$("verified").checked?"user_verified":"unverified"});$("question").value=$("answer").value=$("explanation").value="";await render();};
$("records").onclick=async e=>{const id=e.target.dataset.delete;if(id){await AutoQuizDB.remove(id);render();}};
$("export").onclick=async()=>{const blob=new Blob([await AutoQuizDB.export()],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="autoquiz-answers.json";a.click();URL.revokeObjectURL(a.href);};
$("import").onchange=async e=>{const f=e.target.files[0];if(f){try{await AutoQuizDB.import(await f.text());await render();alert("Import completed.");}catch(err){alert(err.message);}}};
render();
