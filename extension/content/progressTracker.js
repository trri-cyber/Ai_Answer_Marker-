(function(g){
 const KEY="autoQuizProgress";
 async function read(){return new Promise(r=>chrome.storage.local.get(KEY,v=>r(v[KEY]||{})));}
 async function save(p){return new Promise(r=>chrome.storage.local.set({[KEY]:p},r));}
 async function update(questions){const p=await read();for(const q of questions){p[q.id]={...p[q.id],id:q.id,type:q.type,text:q.text,detected:true,updatedAt:Date.now()};}await save(p);return p;}
 async function mark(id,state){const p=await read();if(p[id])p[id].state=state;await save(p);return p;}
 async function summary(){const p=await read(),a=Object.values(p);return{total:a.length,applied:a.filter(x=>x.state==="applied").length,needsReview:a.filter(x=>x.state==="needs_review").length,unanswered:a.filter(x=>!["applied","reviewed"].includes(x.state)).length};}
 g.AutoQuizProgress={read,save,update,mark,summary};
})(globalThis);
