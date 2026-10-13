import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const candleSchema = z.object({
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  timestamp: z.number().optional(),
});
const inputSchema = z.object({
  symbol: z.string().max(40),
  timeframe: z.string().max(8),
  candles: z.array(candleSchema).min(30).max(120),
  indicators: z.record(z.string(), z.number()),
});

export type AiSignal = {
  direction: "CALL" | "PUT" | "WAIT";
  confidence: number;
  rationale: string;
  configured: boolean;
  error?: string;
};

export const analyzeWithAi = createServerFn({ method: "POST" })
  .validator((value: unknown) => inputSchema.parse(value))
  .handler(async ({ data }): Promise<AiSignal> => {
    // Keep provider credentials on the server. Any OpenAI-compatible chat endpoint can be used.
    const apiKey = process.env["AI_API_KEY"] ?? process.env["OPENAI_API_KEY"];
    const baseURL = process.env["AI_BASE_URL"];
    const model = process.env["AI_MODEL"];
    if (!apiKey || !baseURL || !model) {
      return {
        direction: "WAIT",
        confidence: 0,
        rationale: "",
        configured: false,
      };
    }

    try {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const { generateText } = await import("ai");
      const provider = createOpenAI({ apiKey, baseURL });
      const rows = data.candles
        .slice(-60)
        .map((c) => {
          const time = c.timestamp ? new Date(c.timestamp).toISOString() : "unknown time";
          return `${time} O${c.open} H${c.high} L${c.low} C${c.close}`;
        })
        .join("\n");
      const result = await generateText({
        model: provider.chat(model),
        temperature: 0.2,
        system:
          'You are one technical research analyst in a paper-trading terminal. Return only JSON with keys "direction" (CALL, PUT, or WAIT), "confidence" (0 to 100), and "rationale" (2 or 3 concise sentences). Cite the supplied candle evidence, prefer WAIT when evidence conflicts, and never imply certainty or personalized advice.',
        prompt: `Market: ${data.symbol}\nTimeframe: ${data.timeframe}\nIndicators: ${JSON.stringify(data.indicators)}\nCandles, oldest first:\n${rows}`,
      });
      const objectText = result.text.match(/\{[\s\S]*\}/)?.[0];
      if (!objectText) throw new Error("The model did not return a JSON analysis.");
      const output = z
        .object({
          direction: z.enum(["CALL", "PUT", "WAIT"]),
          confidence: z.number(),
          rationale: z.string().min(1).max(700),
        })
        .parse(JSON.parse(objectText));
      return {
        ...output,
        confidence: Math.max(0, Math.min(100, Math.round(output.confidence))),
        configured: true,
      };
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      const friendly =
        status === 429
          ? "The configured model is rate limited. Try again shortly."
          : status === 401 || status === 403
            ? "The configured model rejected its API credentials."
            : "The configured AI provider could not complete this analysis.";
      console.error(
        "AI analyst failed",
        status,
        error instanceof Error ? error.name : "UnknownError",
      );
      return {
        direction: "WAIT",
        confidence: 0,
        rationale: "",
        configured: true,
        error: friendly,
      };
    }
  });
