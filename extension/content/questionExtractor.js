(function(g){
 function extract(el,index){const qtext=el.querySelector(".qtext");const text=(qtext||el).innerText?.trim()||"";const type=g.AutoQuizClassifier.classify(el);const inputs=[...el.querySelectorAll("input,textarea,select")];const options=[...el.querySelectorAll("label")].map(l=>l.innerText.trim()).filter(Boolean);const qid=el.id||el.getAttribute("data-questionid")||`fallback-${index}-${g.AutoQuizDB.normalize(text).slice(0,48)}`;const current=inputs.map(i=>({type:i.type||i.tagName.toLowerCase(),value:i.value,checked:!!i.checked}));return{id:qid,number:index+1,type,text,options,inputs:inputs.length,currentAnswer:current,page:location.pathname};}
 g.AutoQuizExtractor={extract};
})(globalThis);
