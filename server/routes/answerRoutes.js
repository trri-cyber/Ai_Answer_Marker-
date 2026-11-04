import {Router} from "express";
import {z} from "zod";
import {getAnswer} from "../openaiService.js";
const router=Router();
const schema=z.object({question:z.string().min(3).max(12000),questionType:z.string().max(80).default("unknown"),options:z.array(z.string().max(2000)).max(100).default([])});
router.post("/answer",async(req,res,next)=>{try{const parsed=schema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:"Invalid question payload",details:parsed.error.flatten()});const answer=await getAnswer(parsed.data);res.json(answer);}catch(e){next(e);}});
router.post("/validate",(req,res)=>{const ok=req.body&&typeof req.body.suggestedAnswer==="string";res.json({valid:ok});});
export default router;
