(function(g){g.AutoQuizMatcher={async match(q){const exact=await g.AutoQuizDB.find(q.text,q.type,q.options);return exact?{match:exact,kind:"verified_exact"}:{match:null,kind:"none"};}}})(globalThis);
