import "dotenv/config";
import express from "express";
import cors from "cors";
import answerRoutes from "./routes/answerRoutes.js";
const app=express();
app.use(cors({origin:true,methods:["GET","POST"],allowedHeaders:["Content-Type"]}));
app.use(express.json({limit:"32kb"}));
app.get("/api/health",(req,res)=>res.json({
  ok:true,
  service:"autoquiz-ai",
  provider:process.env.AUTOQUIZ_AI_PROVIDER||"ollama_first",
  ollamaModel:process.env.OLLAMA_MODEL||"qwen2.5:3b",
  geminiModel:process.env.GEMINI_MODEL||"gemini-3.8-flash",
  fallback:"gemini"
}));
app.use("/api",answerRoutes);
app.use((err,req,res,next)=>{console.error("Request failed:",err.message);res.status(err.status||500).json({error:err.status?err.message:"Internal server error"});});
const host=process.env.HOST||"127.0.0.1",port=Number(process.env.PORT||3030);
if(host!=="127.0.0.1"&&host!=="localhost")throw new Error("For safety, HOST must be localhost or 127.0.0.1.");
app.listen(port,host,()=>console.log(`AutoQuiz AI backend listening at http://${host}:${port}`));
