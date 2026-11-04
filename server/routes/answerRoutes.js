import { Router } from "express";
import { z } from "zod";
import { getAnswer } from "../openaiService.js";

const router = Router();

const schema = z.object({
  question: z.string().optional(),
  text: z.string().optional(),
  questionType: z.string().max(80).optional(),
  type: z.string().max(80).optional(),
  options: z.array(z.any()).optional(),
  choices: z.array(z.any()).optional()
});

router.post("/answer", async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid question payload", details: parsed.error.flatten() });
    }

    const questionText = (parsed.data.question || parsed.data.text || "").trim();
    if (!questionText || questionText.length < 2) {
      return res.status(400).json({ error: "Question text is required." });
    }

    const questionType = parsed.data.questionType || parsed.data.type || "unknown";
    const rawOpts = (parsed.data.options && parsed.data.options.length ? parsed.data.options : parsed.data.choices) || [];

    const options = rawOpts
      .map(opt => {
        if (typeof opt === "string") return opt.trim();
        if (opt && typeof opt === "object") return (opt.full || opt.text || "").trim();
        return "";
      })
      .filter(Boolean);

    const answer = await getAnswer({
      question: questionText,
      questionType,
      options
    });

    res.json({
      ...answer,
      answer: answer.suggestedAnswer
    });
  } catch (e) {
    next(e);
  }
});

router.post("/validate", (req, res) => {
  const ok = req.body && (typeof req.body.suggestedAnswer === "string" || typeof req.body.answer === "string");
  res.json({ valid: ok });
});

export default router;
