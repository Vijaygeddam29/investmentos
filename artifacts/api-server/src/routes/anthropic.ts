import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { eq } from "drizzle-orm";

const router = Router();

const SYSTEM_PROMPT = `You are an elite investment research analyst built into InvestmentOS — a hedge-fund-grade stock research platform. You have deep expertise in:

- Fundamental analysis: earnings quality, ROIC, free cash flow, balance sheet strength, competitive moats
- Technical analysis: momentum indicators, moving averages, RSI, MACD, price trends
- Valuation: DCF analysis, PEG ratios, EV/EBITDA, margin of safety, fair value estimation
- Portfolio construction: position sizing, sector allocation, risk management, correlation
- Market cycles: bull/bear regimes, sector rotation, macro factors

The platform scores companies across three strategy engines:
- **Fortress Score** (0–1): Business quality — profitability (30%), capital efficiency (20%), financial strength (20%), cash flow quality (15%). >0.7 = exceptional.
- **Rocket Score** (0–1): Growth momentum — revenue growth trajectory (35%), innovation signals (20%), profitability trends (20%), sentiment (15%). >0.7 = high-conviction growth.
- **Wave Score** (0–1): Price momentum — 12-month price momentum (30%), trend signals (30%), momentum quality (20%), valuation reasonableness (20%). >0.7 = strong uptrend.
- **Entry Timing Score** (0–1): Optimal entry signals — RSI, MACD, MA50/200 alignment, 52-week range position. >0.7 = strong buy signal; <0.4 = wait.

Verdicts: STRONG BUY, BUY, HOLD, REDUCE, SELL — based on composite scoring.

When a user asks about a specific stock and you're given its data, provide detailed, specific analysis using those numbers. Be direct, insightful, and investment-focused. Use plain English — avoid jargon unless the user is clearly sophisticated. Format responses clearly with headers and bullet points where helpful. Never give generic disclaimers — the user understands investing carries risk.

If you don't have data for a specific stock, say so and offer to analyze based on the user's description or general principles.`;

router.get("/anthropic/conversations", async (req, res) => {
  try {
    const all = await db.select().from(conversations).orderBy(conversations.createdAt);
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.post("/anthropic/conversations", async (req, res) => {
  try {
    const { title } = req.body;
    const [conv] = await db.insert(conversations).values({ title }).returning();
    res.status(201).json(conv);
  } catch (err) {
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/anthropic/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
    res.json({ ...conv, messages: msgs });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

router.delete("/anthropic/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.get("/anthropic/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/anthropic/conversations/:id/messages", async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const { content, companyContext } = req.body;

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    await db.insert(messages).values({ conversationId, role: "user", content });

    const history = await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);

    const chatMessages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    let systemPrompt = SYSTEM_PROMPT;
    if (companyContext) {
      systemPrompt += `\n\nCurrent company context provided by the platform:\n${JSON.stringify(companyContext, null, 2)}`;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    let fullResponse = "";

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      messages: chatMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    await db.insert(messages).values({ conversationId, role: "assistant", content: fullResponse });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("Chat stream error:", err);
    res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
    res.end();
  }
});

export default router;
