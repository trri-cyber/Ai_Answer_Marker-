chrome.runtime.onInstalled.addListener(()=>chrome.storage.local.set({autoQuizInstalled:true}));
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(message?.type==="AQ_BACKEND_STATUS"){
    fetch("http://127.0.0.1:3030/api/health").then(r=>r.json()).then(sendResponse).catch(()=>sendResponse({ok:false}));
    return true;
  }
});
