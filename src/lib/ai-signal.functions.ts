import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const candleSchema = z.object({ open: z.number(), high: z.number(), low: z.number(), close: z.number(), timestamp: z.number().optional() });
const inputSchema = z.object({
  symbol: z.string().max(40),
  timeframe: z.string().max(8),
  candles: z.array(candleSchema).min(30).max(120),
  indicators: z.record(z.string(), z.number()),
});

export type AiSignal = { direction: 'CALL' | 'PUT' | 'WAIT'; confidence: number; rationale: string; error?: string };

export const analyzeWithAi = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<AiSignal> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { direction: 'WAIT', confidence: 0, rationale: '', error: 'AI is not configured.' };
    const { createOpenAI } = await import('@ai-sdk/openai');
    const { streamText, Output, NoObjectGeneratedError } = await import('ai');
    const provider = createOpenAI({
      baseURL: 'https://ai.gateway.lovable.dev/v1',
      apiKey,
      headers: { 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk' },
    });
    const rows = data.candles.slice(-60).map((c) => `${new Date(c.timestamp ?? 0).toISOString().slice(11, 16)} O${c.open} H${c.high} L${c.low} C${c.close}`).join('\n');
    const result = streamText({
      model: provider.responses('openai/gpt-6-astra'),
      instructions:
        'You are a short-term technical analyst for a paper-trading terminal. Given recent candles and indicators, decide CALL (price likely higher at expiry), PUT (lower), or WAIT (no clear edge). Prefer WAIT when signals conflict. confidence is 0-100. rationale: 2-4 concise sentences citing specific evidence. Never claim certainty.',
      prompt: `Market: ${data.symbol}\nTimeframe: ${data.timeframe}\nIndicators: ${JSON.stringify(data.indicators)}\nRecent candles (oldest first):\n${rows}`,
      output: Output.object({ schema: z.object({ direction: z.enum(['CALL', 'PUT', 'WAIT']), confidence: z.number(), rationale: z.string() }) }),
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: 'low', reasoningSummary: 'auto', include: ['reasoning.encrypted_content'] } },
    });
    try {
      const o = await result.output;
      return { ...o, confidence: Math.max(0, Math.min(100, Math.round(o.confidence))) };
    } catch (e) {
      if (NoObjectGeneratedError.isInstance(e) && e.text) {
        try { const o = JSON.parse(e.text); return { direction: o.direction ?? 'WAIT', confidence: Number(o.confidence) || 0, rationale: String(o.rationale ?? '') }; } catch { /* fall through */ }
      }
      const msg = e instanceof Error ? e.message : String(e);
      const status = (e as { statusCode?: number }).statusCode;
      const friendly = status === 429 ? 'AI is busy — try again in a moment.' : status === 402 ? 'AI credits are used up for this workspace.' : `AI analysis failed: ${msg.slice(0, 160)}`;
      console.error('AI signal failed', status, msg);
      return { direction: 'WAIT', confidence: 0, rationale: '', error: friendly };
    }
  });
