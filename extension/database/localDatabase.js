(function(global){
 const DB_NAME="autoquiz-ai", STORE="answers", VERSION=1;
 function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE)){const s=db.createObjectStore(STORE,{keyPath:"id"});s.createIndex("normalizedQuestion","normalizedQuestion",{unique:false});}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
 async function transact(mode,fn){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);let result;try{result=fn(store)}catch(e){reject(e);return}tx.oncomplete=()=>resolve(result?.result);tx.onerror=()=>reject(tx.error);});}
 const normalize=t=>String(t||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,"");
 const api={
  normalize,
  async add(record){const now=new Date().toISOString();const value={id:record.id||crypto.randomUUID(),question:record.question||"",normalizedQuestion:normalize(record.question),questionType:record.questionType||"unknown",options:record.options||[],answer:record.answer,explanation:record.explanation||"",source:record.source||"unverified",verified:record.verified===true,createdAt:record.createdAt||now,updatedAt:now,lastAccessed:now};return transact("readwrite",s=>s.put(value));},
  async get(id){const db=await openDB();return new Promise((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});},
  async all(){const db=await openDB();return new Promise((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});},
  async remove(id){return transact("readwrite",s=>s.delete(id));},
  async clear(){return transact("readwrite",s=>s.clear());},
  async find(question,type,options=[]){const n=normalize(question),records=await api.all();return records.find(r=>r.verified&&r.normalizedQuestion===n&&(!type||r.questionType===type)&&(!options.length||JSON.stringify(r.options)===JSON.stringify(options)))||null;},
  async export(){return JSON.stringify(await api.all(),null,2);},
  async import(json){const records=JSON.parse(json);if(!Array.isArray(records))throw new Error("Import must be a JSON array.");for(const r of records){if(!r.question||!Object.hasOwn(r,"answer"))continue;await api.add({...r,verified:r.verified===true,source:r.verified?"imported_verified":"unverified"});}return true;}
 };
 global.AutoQuizDB=api;
})(globalThis);
