export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp?: number;
}

export type AnalystReport = {
  name: string;
  focus: string;
  stance: "BULLISH" | "BEARISH" | "NEUTRAL";
  finding: string;
};

export function calculateEMA(closes: number[], span: number): number[] {
  const first = closes[0];
  if (first === undefined) return [];
  const alpha = 2 / (span + 1);
  const ema: number[] = new Array(closes.length);
  ema[0] = first;
  for (let i = 1; i < closes.length; i++) {
    ema[i] = alpha * (closes[i] ?? first) + (1 - alpha) * (ema[i - 1] ?? first);
  }
  return ema;
}

export function calcIndicators(candles: Candle[]) {
  const last = candles.at(-1);
  if (!last || candles.length < 30) throw new Error("At least 30 candles are required");
  const closes = candles.map((c) => c.close);
  const n = closes.length;

  const ema9Series = calculateEMA(closes, 9);
  const ema21Series = calculateEMA(closes, 21);

  // RSI 14 (rolling 14 mean of gains and losses)
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < n; i++) {
    const diff = (closes[i] ?? last.close) - (closes[i - 1] ?? last.close);
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  let rsi = 50.0;
  if (gains.length >= 14) {
    const last14Gains = gains.slice(-14);
    const last14Losses = losses.slice(-14);
    const avgGain = last14Gains.reduce((a, b) => a + b, 0) / 14;
    const avgLoss = last14Losses.reduce((a, b) => a + b, 0) / 14;

    if (avgLoss === 0) {
      rsi = 100.0;
    } else {
      const rs = avgGain / avgLoss;
      rsi = 100 - 100 / (1 + rs);
    }
  }

  // Bollinger Bands 20
  const last20Closes = closes.slice(-20);
  const mid = last20Closes.reduce((a, b) => a + b, 0) / 20;
  const variance = last20Closes.reduce((sum, val) => sum + Math.pow(val - mid, 2), 0) / 20;
  const std = Math.sqrt(variance);
  const upper = mid + 2 * std;
  const lower = mid - 2 * std;

  // High 20 & Low 20
  const last20Candles = candles.slice(-20);
  const high20 = Math.max(...last20Candles.map((c) => c.high));
  const low20 = Math.min(...last20Candles.map((c) => c.low));

  return {
    close: Number(last.close),
    ema9: Number(ema9Series[n - 1]),
    ema21: Number(ema21Series[n - 1]),
    rsi: Number.isFinite(rsi) ? Number(rsi) : 50.0,
    bb_upper: Number(upper),
    bb_mid: Number(mid),
    bb_lower: Number(lower),
    high_20: Number(high20),
    low_20: Number(low20),
    last_open: Number(last.open),
    last_high: Number(last.high),
    last_low: Number(last.low),
  };
}

export function makeSignal(
  req: {
    strategies: string[];
    symbol: string;
    market: string;
    timeframe: string;
    expiry_seconds: number;
  },
  candles: Candle[],
) {
  const x = calcIndicators(candles);
  let score = 0;
  let maxScore = 0;
  const reasons: string[] = [];

  const strategies: string[] = req.strategies || [
    "ema_rsi",
    "price_action",
    "bollinger",
    "support_resistance",
  ];

  if (strategies.includes("ema_rsi")) {
    maxScore += 2;
    if (x.ema9 > x.ema21 && x.rsi >= 52) {
      score += 2;
      reasons.push("EMA 9 is above EMA 21 and RSI confirms bullish momentum");
    } else if (x.ema9 < x.ema21 && x.rsi <= 48) {
      score -= 2;
      reasons.push("EMA 9 is below EMA 21 and RSI confirms bearish momentum");
    } else {
      reasons.push("EMA/RSI alignment is mixed");
    }
  }

  if (strategies.includes("bollinger")) {
    maxScore += 1;
    if (x.close > x.bb_mid) {
      score += 1;
      reasons.push("Price is above Bollinger midline");
    } else if (x.close < x.bb_mid) {
      score -= 1;
      reasons.push("Price is below Bollinger midline");
    }
  }

  if (strategies.includes("price_action")) {
    maxScore += 1;
    const body = x.close - x.last_open;
    if (body > 0) {
      score += 1;
      reasons.push("Latest candle is bullish");
    } else if (body < 0) {
      score -= 1;
      reasons.push("Latest candle is bearish");
    }
  }

  if (strategies.includes("support_resistance")) {
    maxScore += 1;
    const close = x.close;
    if (close <= x.low_20 * 1.0015) {
      score += 1;
      reasons.push("Price is near recent support");
    } else if (close >= x.high_20 * 0.9985) {
      score -= 1;
      reasons.push("Price is near recent resistance");
    }
  }

  const threshold = Math.max(2, Math.ceil(maxScore * 0.5));
  const direction = score >= threshold ? "CALL" : score <= -threshold ? "PUT" : "WAIT";

  let confidence =
    maxScore === 0 ? 50 : Math.round(Math.min(95, 50 + (Math.abs(score) / maxScore) * 45));
  if (direction === "WAIT") {
    confidence = Math.min(confidence, 59);
  }

  const signalId = "sig_" + Math.random().toString(36).substring(2, 14);

  return {
    signal_id: signalId,
    symbol: req.symbol,
    market: req.market,
    timeframe: req.timeframe,
    expiry_seconds: req.expiry_seconds,
    direction,
    confidence,
    score,
    max_score: maxScore,
    indicators: x,
    reasons,
    generated_at: Math.floor(Date.now() / 1000),
  };
}

export const assets = [
  {
    name: "EUR/USD OTC",
    short: "EU",
    payout: 91,
    base: 1.0852,
    precision: 4,
    type: "Currency",
  },
  {
    name: "Bitcoin / Gold",
    short: "₿",
    payout: 90,
    base: 31.45,
    precision: 2,
    type: "Turbo",
  },
  {
    name: "Crypto Index",
    short: "CI",
    payout: 84,
    base: 4180.5,
    precision: 2,
    type: "Index",
  },
  {
    name: "Asia Growth Index",
    short: "AG",
    payout: 81,
    base: 1845.2,
    precision: 2,
    type: "Index",
  },
  {
    name: "AI Index",
    short: "AI",
    payout: 90,
    base: 2635.8,
    precision: 2,
    type: "Index",
  },
  {
    name: "Natural Gas Index",
    short: "NG",
    payout: 91,
    base: 2.455,
    precision: 3,
    type: "Commodity",
  },
  {
    name: "BTC / USDT",
    short: "₿",
    payout: 85,
    base: 65000,
    precision: 2,
    type: "Crypto",
  },
  {
    name: "ETH / USDT",
    short: "Ξ",
    payout: 85,
    base: 2480,
    precision: 2,
    type: "Crypto",
  },
  {
    name: "BNB / USDT",
    short: "BN",
    payout: 80,
    base: 585,
    precision: 2,
    type: "Crypto",
  },
  {
    name: "EUR / USDT",
    short: "EU",
    payout: 82,
    base: 1.085,
    precision: 4,
    type: "Crypto",
  },
] as const;
export function demoCandles(base: number, timeframe = 1, seed = 0): Candle[] {
  let current = base * 0.996;
  let s = (seed * 2654435761) >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const drift = seed ? (rand() - 0.5) * 0.9 : 0.14;
  return Array.from({ length: 76 }, (_, i) => {
    const open = current;
    const noise = seed ? (rand() - 0.5) * 2.2 : 0;
    const delta =
      (Math.sin(i * 1.79 + timeframe + seed) * 0.7 +
        Math.cos(i * 0.39 + seed * 0.5) * 0.6 +
        drift +
        noise) *
      base *
      0.00035;
    const close = open + delta;
    current = close;
    return {
      open,
      close,
      high: Math.max(open, close) + base * (0.00012 + Math.abs(Math.sin(i)) * 0.00015),
      low: Math.min(open, close) - base * (0.00012 + Math.abs(Math.cos(i)) * 0.00013),
      timestamp: Date.now() - (75 - i) * timeframe * 60000,
    };
  });
}

/** Independent rule-based candle analysts. Runs locally in the browser; no LLM or backend. */
export async function runAnalystAgents(candles: Candle[]): Promise<AnalystReport[]> {
  const x = calcIndicators(candles);
  const recent = candles.slice(-6);
  const first = recent[0]?.close ?? x.close;
  const last = recent.at(-1) ?? candles.at(-1)!;
  const prior = candles.at(-2) ?? last;
  const widthPct = x.bb_mid ? ((x.bb_upper - x.bb_lower) / x.bb_mid) * 100 : 0;
  const reports = await Promise.all([
    Promise.resolve<AnalystReport>({
      name: "Trend agent",
      focus: "EMA structure",
      stance:
        x.ema9 > x.ema21 && x.close >= x.ema21
          ? "BULLISH"
          : x.ema9 < x.ema21 && x.close <= x.ema21
            ? "BEARISH"
            : "NEUTRAL",
      finding: `EMA 9 ${x.ema9 > x.ema21 ? "above" : x.ema9 < x.ema21 ? "below" : "at"} EMA 21; close ${x.close >= x.ema21 ? "above" : "below"} EMA 21.`,
    }),
    Promise.resolve<AnalystReport>({
      name: "Momentum agent",
      focus: "RSI (14)",
      stance: x.rsi >= 55 ? "BULLISH" : x.rsi <= 45 ? "BEARISH" : "NEUTRAL",
      finding: `RSI is ${x.rsi.toFixed(1)}${x.rsi >= 70 ? " (elevated)" : x.rsi <= 30 ? " (depressed)" : ""}.`,
    }),
    Promise.resolve<AnalystReport>({
      name: "Range agent",
      focus: "Bollinger bands",
      stance:
        widthPct < 0.15
          ? "NEUTRAL"
          : x.close > x.bb_upper
            ? "BULLISH"
            : x.close < x.bb_lower
              ? "BEARISH"
              : "NEUTRAL",
      finding:
        widthPct < 0.15
          ? `Band width ${widthPct.toFixed(2)}%; range is compressed.`
          : x.close > x.bb_upper
            ? "Close is above the upper band."
            : x.close < x.bb_lower
              ? "Close is below the lower band."
              : `Close remains inside the bands (${widthPct.toFixed(2)}% width).`,
    }),
    Promise.resolve<AnalystReport>({
      name: "Price action agent",
      focus: "Last 5 candle closes",
      stance:
        last.close > first && last.close > prior.close
          ? "BULLISH"
          : last.close < first && last.close < prior.close
            ? "BEARISH"
            : "NEUTRAL",
      finding: `${last.close > first ? "Higher" : last.close < first ? "Lower" : "Flat"} close over the last ${recent.length} candles; latest candle ${last.close >= last.open ? "closed up" : "closed down"}.`,
    }),
  ]);
  return reports;
}
export type Signal = ReturnType<typeof makeSignal>;
export type Trade = {
  id: number;
  asset: string;
  direction: "CALL" | "PUT";
  source: "BINANCE" | "SIMULATED";
  timeframe: number;
  stake: number;
  entry: number;
  expiry: number;
  payout: number;
  precision: number;
  exit?: number;
  profit?: number;
  outcome?: "won" | "lost" | "flat" | "unavailable";
};
export function tradeError(
  stake: number,
  balance: number,
  count: number,
  lastTrade: number,
  now: number,
) {
  if (!Number.isFinite(stake) || stake <= 0 || stake > 1)
    return "Stake must be between $0.01 and $1.00.";
  if (stake > balance) return "Insufficient paper balance.";
  if (count >= 20) return "Daily paper-trade cap reached.";
  if (now - lastTrade < 60000) return "Please wait 60 seconds between paper trades.";
  return "";
}

/** Public Binance symbols for assets that have a free live feed. */
export const liveSymbols: Record<string, string> = {
  "BTC / USDT": "BTCUSDT",
  "ETH / USDT": "ETHUSDT",
  "BNB / USDT": "BNBUSDT",
  "EUR / USDT": "EURUSDT",
};
export async function fetchLiveCandles(
  assetName: string,
  timeframe: number,
): Promise<Candle[] | null> {
  const symbol = liveSymbols[assetName];
  if (!symbol) return null;
  const path = `/api/v3/klines?symbol=${symbol}&interval=${timeframe}m&limit=100`;
  for (const host of ["https://data-api.binance.vision", "https://api.binance.com"]) {
    try {
      const res = await fetch(host + path);
      if (!res.ok) continue;
      const rows = (await res.json()) as [number, string, string, string, string][];
      if (rows.length >= 30)
        return rows.map((r) => ({
          timestamp: r[0],
          open: +r[1],
          high: +r[2],
          low: +r[3],
          close: +r[4],
        }));
    } catch {
      /* try next host */
    }
  }
  throw new Error("Live feed unavailable");
}
