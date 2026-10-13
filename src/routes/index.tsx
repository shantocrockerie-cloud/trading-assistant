import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpRight,
  AudioLines,
  CandlestickChart,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Expand,
  Gauge,
  History,
  Info,
  Layers3,
  LineChart,
  LoaderCircle,
  Maximize2,
  Minus,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PriceChart } from "@/components/trading/price-chart";
import { analyzeWithAi } from "@/lib/ai-signal.functions";
import {
  assets,
  demoCandles,
  fetchLiveCandles,
  liveSymbols,
  makeSignal,
  calcIndicators,
  tradeError,
  runAnalystAgents,
  type Signal,
  type Trade,
  type Candle,
  type AnalystReport,
} from "@/lib/trading";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trading Assistant — Market Research Terminal" },
      {
        name: "description",
        content:
          "Analyze live Binance candle data, review rule-based market agents and practice with paper trades.",
      },
      { property: "og:title", content: "Trading Assistant — Market Research Terminal" },
      {
        property: "og:description",
        content: "A focused workspace for simulated market analysis and paper trading.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Terminal,
});
const strategyOptions = [
  { id: "ema_rsi", name: "EMA + RSI" },
  { id: "price_action", name: "Price action" },
  { id: "bollinger", name: "Bollinger bands" },
  { id: "support_resistance", name: "Support & resistance" },
];
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
type FrameworkResearch = {
  ticker: string;
  analysis_date: string;
  asset_type: "stock" | "crypto";
  rating: string;
  reports: Record<string, string>;
  run_settings: Record<string, unknown>;
};
function Terminal() {
  const [assetIndex, setAssetIndex] = useState(0),
    [timeframe, setTimeframe] = useState(1),
    [expiry, setExpiry] = useState(60),
    [strategies, setStrategies] = useState(strategyOptions.map((s) => s.id));
  const [signal, setSignal] = useState<Signal | null>(null),
    [scanning, setScanning] = useState(false),
    [stake, setStake] = useState(1),
    [balance, setBalance] = useState(1000),
    [trades, setTrades] = useState<Trade[]>([]),
    [activeTrade, setActiveTrade] = useState<Trade | null>(null),
    [settlingTradeId, setSettlingTradeId] = useState<number | null>(null),
    [lastTrade, setLastTrade] = useState(0),
    [now, setNow] = useState(0),
    [error, setError] = useState("");
  const [assetsOpen, setAssetsOpen] = useState(false),
    [search, setSearch] = useState(""),
    [infoOpen, setInfoOpen] = useState(false),
    [tab, setTab] = useState("history"),
    [sound, setSound] = useState(false),
    [showIndicators, setShowIndicators] = useState(true),
    [line, setLine] = useState(false),
    [zoom, setZoom] = useState(0),
    [expanded, setExpanded] = useState(false);
  const [seed, setSeed] = useState(0),
    [scanStep, setScanStep] = useState(""),
    [live, setLive] = useState<Candle[] | null>(null),
    [sourceStatus, setSourceStatus] = useState<"loading" | "live" | "simulated">("simulated"),
    [agentReports, setAgentReports] = useState<AnalystReport[]>([]),
    [agentsRunning, setAgentsRunning] = useState(false),
    [aiRunning, setAiRunning] = useState(false),
    [aiError, setAiError] = useState("");
  const [researchTicker, setResearchTicker] = useState("AAPL");
  const [researchDate, setResearchDate] = useState(new Date().toISOString().slice(0, 10));
  const [researchType, setResearchType] = useState<"stock" | "crypto">("stock");
  const [researchBusy, setResearchBusy] = useState(false);
  const [researchError, setResearchError] = useState("");
  const [researchResult, setResearchResult] = useState<FrameworkResearch | null>(null);
  const asset = assets[assetIndex] ?? assets[0];
  const hasLiveFeed = !!liveSymbols[asset.name];
  const isLive = sourceStatus === "live" && live !== null;
  const candles = useMemo(
    () => live ?? demoCandles(asset.base, timeframe, seed),
    [live, asset.base, timeframe, seed],
  );
  useEffect(() => {
    setLive(null);
    setSourceStatus(hasLiveFeed ? "loading" : "simulated");
    let off = false;
    fetchLiveCandles(asset.name, timeframe)
      .then((c) => {
        if (!off) {
          setLive(c);
          setSourceStatus(c ? "live" : "simulated");
        }
      })
      .catch(() => {
        if (!off) setSourceStatus("simulated");
      });
    const t = setInterval(
      () =>
        fetchLiveCandles(asset.name, timeframe)
          .then((c) => {
            if (!off) {
              setLive(c);
              setSourceStatus(c ? "live" : "simulated");
            }
          })
          .catch(() => {
            if (!off) setSourceStatus("simulated");
          }),
      15000,
    );
    return () => {
      off = true;
      clearInterval(t);
    };
  }, [asset.name, timeframe, hasLiveFeed]);
  const indicators = useMemo(() => calcIndicators(candles), [candles]);
  const price = candles.at(-1)?.close ?? asset.base;
  const firstPrice = candles[0]?.close ?? price;
  const priceChangePct = firstPrice ? ((price - firstPrice) / firstPrice) * 100 : 0;
  const sourceStamp = candles.at(-1)?.timestamp;
  const sourceTime = sourceStamp ? new Date(sourceStamp).toISOString().slice(11, 19) : "—";
  const pnl = trades.reduce((a, t) => a + (t.profit ?? 0), 0);
  const direction = signal?.direction ?? "WAIT";
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!activeTrade || now < activeTrade.expiry || settlingTradeId === activeTrade.id) return;
    const trade = activeTrade;
    const tradeAsset = assets.find((item) => item.name === trade.asset);
    if (!tradeAsset) return;
    setSettlingTradeId(trade.id);
    void (async () => {
      let outcome: NonNullable<Trade["outcome"]> = "flat";
      let exit = trade.entry;
      if (trade.source === "BINANCE") {
        try {
          const finalCandles = await fetchLiveCandles(trade.asset, trade.timeframe);
          if (finalCandles?.length) exit = finalCandles.at(-1)!.close;
          else outcome = "unavailable";
        } catch {
          outcome = "unavailable";
        }
      } else {
        exit = demoCandles(tradeAsset.base, trade.timeframe, (trade.id % 1_000_000) + 1).at(
          -1,
        )!.close;
      }
      if (outcome !== "unavailable") {
        outcome =
          exit === trade.entry
            ? "flat"
            : (trade.direction === "CALL" ? exit > trade.entry : exit < trade.entry)
              ? "won"
              : "lost";
      }
      const profit =
        outcome === "won"
          ? (trade.stake * trade.payout) / 100
          : outcome === "lost"
            ? -trade.stake
            : 0;
      setBalance((balanceNow) => balanceNow + trade.stake + profit);
      setTrades((list) =>
        list.map((item) => (item.id === trade.id ? { ...item, exit, profit, outcome } : item)),
      );
      setActiveTrade(null);
      setSettlingTradeId(null);
    })();
  }, [now, activeTrade, settlingTradeId]);
  function selectAsset(i: number) {
    setAssetIndex(i);
    setSignal(null);
    setError("");
    setAssetsOpen(false);
    setAgentReports([]);
    setAiError("");
  }
  function beep() {
    if (!sound) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    gain.gain.value = 0.035;
    osc.frequency.value = 660;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => void ctx.close();
  }
  async function runFrameworkResearch() {
    if (researchBusy) return;
    setResearchBusy(true);
    setResearchError("");
    setResearchResult(null);
    const endpoint = (import.meta.env.VITE_TRADINGAGENTS_API || "http://localhost:4001").replace(
      /\/$/,
      "",
    );
    try {
      const response = await fetch(`${endpoint}/api/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: researchTicker,
          analysis_date: researchDate,
          asset_type: researchType,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.detail || `Research service returned ${response.status}.`);
      setResearchResult(body as FrameworkResearch);
    } catch (cause) {
      setResearchError(
        cause instanceof Error ? cause.message : "Could not reach TradingAgents research service.",
      );
    } finally {
      setResearchBusy(false);
    }
  }
  function scan() {
    if (scanning) return;
    setScanning(true);
    setSignal(null);
    setAgentReports([]);
    setAgentsRunning(true);
    setAiRunning(false);
    setAiError("");
    setError("");
    beep();
    const steps = [
      "Fetching latest candles…",
      "Calculating EMA & RSI…",
      "Checking Bollinger bands…",
      "Mapping support & resistance…",
      "Launching 4 analyst agents…",
    ];
    const stepMs = 900;
    steps.forEach((m, i) => setTimeout(() => setScanStep(m), i * stepMs));
    const started = Date.now();
    const req = {
      strategies,
      symbol: asset.name,
      timeframe: `${timeframe}m`,
      expiry_seconds: expiry,
    };
    (async () => {
      let fresh: Candle[];
      let freshLive = false;
      try {
        const c = await fetchLiveCandles(asset.name, timeframe);
        if (c) {
          fresh = c;
          freshLive = true;
          setLive(c);
          setSourceStatus("live");
        } else {
          const nextSeed = (Date.now() % 1000000) + 1;
          fresh = demoCandles(asset.base, timeframe, nextSeed);
          setSeed(nextSeed);
          setLive(null);
          setSourceStatus("simulated");
        }
      } catch {
        const nextSeed = (Date.now() % 1000000) + 1;
        fresh = demoCandles(asset.base, timeframe, nextSeed);
        setSeed(nextSeed);
        setLive(null);
        setSourceStatus("simulated");
      }
      const aiTask = analyzeWithAi({
        data: {
          symbol: asset.name,
          timeframe: `${timeframe}m`,
          candles: fresh,
          indicators: calcIndicators(fresh),
        },
      }).catch((cause: unknown) => ({
        direction: "WAIT" as const,
        confidence: 0,
        rationale: "",
        configured: true,
        error: cause instanceof Error ? cause.message : "AI analysis failed.",
      }));
      await new Promise((r) =>
        setTimeout(r, Math.max(0, steps.length * stepMs - (Date.now() - started))),
      );
      const reports = await runAnalystAgents(fresh);
      setSignal(makeSignal({ ...req, market: freshLive ? "BINANCE SPOT" : "SIMULATED" }, fresh));
      setAgentReports(reports);
      setAgentsRunning(false);
      setAiRunning(true);
      if (hasLiveFeed && !freshLive) {
        setError(
          "Binance could not be reached. Analysis used clearly labeled session simulation candles.",
        );
      }
      const ai = await aiTask;
      setAiRunning(false);
      if (ai.configured && !ai.error) {
        const stance =
          ai.direction === "CALL" ? "BULLISH" : ai.direction === "PUT" ? "BEARISH" : "NEUTRAL";
        setAgentReports((current) => [
          ...current,
          {
            name: "AI research agent",
            focus: "Configured language model",
            stance,
            finding: `${ai.rationale} Model assessment: ${ai.direction} · ${ai.confidence}% stated confidence.`,
          },
        ]);
      } else if (ai.configured && ai.error) {
        setAiError(ai.error);
      }
      setScanning(false);
      setScanStep("");
    })();
  }
  function execute(d: "CALL" | "PUT") {
    if (activeTrade) {
      setError("Wait for your active paper trade to settle.");
      return;
    }
    const timestamp = Date.now();
    const invalid = tradeError(stake, balance, trades.length, lastTrade, timestamp);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!signal) {
      setError("Generate a signal before placing a paper trade.");
      return;
    }
    const trade: Trade = {
      id: timestamp,
      asset: asset.name,
      direction: d,
      source: isLive ? "BINANCE" : "SIMULATED",
      timeframe,
      stake,
      entry: price,
      expiry: timestamp + expiry * 1000,
      payout: asset.payout,
      precision: asset.precision,
    };
    setTrades((list) => [trade, ...list]);
    setActiveTrade(trade);
    setBalance((b) => b - stake);
    setLastTrade(timestamp);
    setError("");
    beep();
  }
  function historyView(value: string) {
    setTab(value);
    document
      .getElementById("trade-history")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function exportHistory() {
    const csv =
      "Asset,Direction,Stake,Entry,Exit,Profit\n" +
      trades
        .map((t) =>
          [t.asset, t.direction, t.stake, t.entry, t.exit ?? "", t.profit ?? ""].join(","),
        )
        .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "codex-paper-trades.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">
            <Activity aria-hidden="true" />
          </div>
          <div>
            <div className="brand-title">
              Trading<span className="positive"> Assistant</span>
            </div>
            <div className="brand-caption">MARKET RESEARCH TERMINAL</div>
          </div>
        </div>
        <nav className="header-nav" aria-label="Main navigation">
          <Button
            variant="nav"
            className="selected"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <CandlestickChart />
            Terminal
          </Button>
          <Button variant="nav" onClick={() => setAssetsOpen(true)}>
            <Layers3 />
            Markets
          </Button>
          <Button variant="nav" onClick={() => historyView("history")}>
            <History />
            Trade history
          </Button>
          <Button variant="nav" onClick={() => historyView("risk")}>
            <ShieldCheck />
            Risk guard
          </Button>
        </nav>
        <div className="header-end">
          <span className="paper-tag">
            <Wallet size={12} />
            Paper account
          </span>
          <div className="header-balance">
            <span className="small muted">Paper balance</span>
            <strong className="mono">{money(balance)}</strong>
          </div>
          <Button
            variant="nav"
            size="icon"
            aria-label={sound ? "Mute audio" : "Enable audio"}
            title={sound ? "Mute audio" : "Enable audio"}
            onClick={() => setSound(!sound)}
          >
            {sound ? <Volume2 /> : <VolumeX />}
          </Button>
          <div className="profile">ST</div>
        </div>
      </header>
      <main className="workspace">
        <div className="intro">
          <div>
            <h1>Trading terminal</h1>
            <p>A clearer view of the market. A smarter next move.</p>
          </div>
          <div className="session">
            <span className="status-dot" />
            Paper session
            <span className="session-time">
              {" "}
              · {now ? new Date(now).toISOString().slice(11, 19) : "—"} UTC
            </span>
          </div>
        </div>
        <section aria-labelledby="markets-title">
          <div className="section-heading">
            <h2 id="markets-title">
              Featured markets <span className="muted small"> / 06</span>
            </h2>
            <Button variant="nav" onClick={() => setAssetsOpen(true)}>
              All markets <span className="mono">10</span>
              <ChevronRight size={12} />
            </Button>
          </div>
          <div className="asset-strip">
            {assets.slice(0, 6).map((a, i) => (
              <Button
                key={a.name}
                variant="nav"
                className={`asset-tile ${i === assetIndex ? "active" : ""}`}
                aria-pressed={i === assetIndex}
                onClick={() => selectAsset(i)}
              >
                <div className="asset-top">
                  <span className="asset-icon">{a.short}</span>
                  <span className="asset-name">{a.name}</span>
                </div>
                <div className="asset-bottom">
                  <div>
                    <strong>
                      {a.payout}% <span className="asset-sub">payout</span>
                    </strong>
                    <div className="asset-sub">{a.type}</div>
                  </div>
                  <span className="asset-feed-tag">
                    {liveSymbols[a.name] ? "BINANCE" : "SIMULATED"}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </section>
        <div className="main-grid">
          <div>
            <section className="chart-tool" aria-label="Price chart">
              <div className="chart-header">
                <div className="chart-asset">
                  <span className="asset-icon">{asset.short}</span>
                  <div>
                    <h2>{asset.name}</h2>
                    <p>
                      {asset.type} <span className="muted"> · </span>{" "}
                      <span className="positive">{asset.payout}% payout</span>
                    </p>
                  </div>
                  <Button
                    variant="nav"
                    size="icon"
                    aria-label="Choose chart market"
                    onClick={() => setAssetsOpen(true)}
                  >
                    <ChevronDown />
                  </Button>
                </div>
                <div className="chart-header-price">
                  <strong className="mono">{price.toFixed(asset.precision)}</strong>
                  <span className={priceChangePct >= 0 ? "positive" : "negative"}>
                    {priceChangePct >= 0 ? "+" : ""}
                    {priceChangePct.toFixed(2)}%<span className="muted"> across chart window</span>
                  </span>
                </div>
              </div>
              <div className="chart-toolbar">
                <div className="toolbar-group">
                  {[1, 5, 15].map((t) => (
                    <Button
                      variant="nav"
                      key={t}
                      className={timeframe === t ? "selected" : ""}
                      aria-pressed={timeframe === t}
                      onClick={() => {
                        setTimeframe(t);
                        setSignal(null);
                        setAgentReports([]);
                      }}
                    >
                      {t}m
                    </Button>
                  ))}
                  <span className="toolbar-divider" />
                  <Button
                    variant="nav"
                    aria-label={line ? "Show candlesticks" : "Show line chart"}
                    title={line ? "Show candlesticks" : "Show line chart"}
                    onClick={() => setLine(!line)}
                  >
                    {line ? <LineChart /> : <CandlestickChart />}
                  </Button>
                  <Button
                    variant="nav"
                    className={showIndicators ? "selected" : ""}
                    aria-pressed={showIndicators}
                    title="Toggle chart indicators"
                    aria-label="Toggle chart indicators"
                    onClick={() => setShowIndicators(!showIndicators)}
                  >
                    <SlidersHorizontal />
                  </Button>
                </div>
                <div className="toolbar-group">
                  <Button
                    variant="nav"
                    aria-label="Zoom out"
                    title="Zoom out"
                    disabled={zoom === 0}
                    onClick={() => setZoom((z) => z - 1)}
                  >
                    <Minus />
                  </Button>
                  <Button
                    variant="nav"
                    aria-label="Zoom in"
                    title="Zoom in"
                    disabled={zoom === 3}
                    onClick={() => setZoom((z) => z + 1)}
                  >
                    <Plus />
                  </Button>
                  <Button
                    variant="nav"
                    aria-label="Expand chart"
                    title="Expand chart"
                    onClick={() => setExpanded(true)}
                  >
                    <Maximize2 />
                  </Button>
                </div>
              </div>
              <div className="chart-canvas">
                <div className="chart-source">
                  <span>
                    {isLive
                      ? "LIVE · BINANCE"
                      : sourceStatus === "loading"
                        ? "CONNECTING · BINANCE"
                        : "SIMULATED"}{" "}
                    · {timeframe}M
                  </span>
                  {showIndicators && (
                    <>
                      <span className="legend">
                        <i className="legend-line" />
                        EMA 9
                      </span>
                      <span className="legend">
                        <i className="legend-line slow" />
                        EMA 21
                      </span>
                    </>
                  )}
                </div>
                <PriceChart
                  candles={candles}
                  precision={asset.precision}
                  indicators={showIndicators}
                  line={line}
                  zoom={zoom}
                  expanded={false}
                  source={isLive ? `Live Binance ${liveSymbols[asset.name]}` : "Simulated"}
                />
                <span className="chart-watermark">TRADING ASSISTANT</span>
              </div>
              <div className="chart-foot">
                <span>
                  <Info size={11} />
                  {isLive
                    ? `Binance ${liveSymbols[asset.name]} · latest candle ${sourceTime} UTC`
                    : hasLiveFeed && sourceStatus === "loading"
                      ? "Connecting to Binance public candles…"
                      : hasLiveFeed
                        ? "Session simulation · Binance feed unavailable"
                        : "Session simulation · no listed Binance pair"}
                </span>
                <span>
                  <Radio size={11} />
                  Paper trading only
                </span>
              </div>
            </section>
            <section className="configuration" aria-labelledby="config-title">
              <div className="configuration-head">
                <h2 id="config-title">Signal configuration</h2>
                <span>
                  <Gauge size={12} className="inline" /> Rules-based analysis
                </span>
              </div>
              <div className="form-grid">
                <div>
                  <span className="field-label">Price source</span>
                  <div className="feed-field">
                    <span className={`status-dot ${isLive ? "" : "feed-dot-simulated"}`} />
                    {isLive
                      ? `Binance · ${liveSymbols[asset.name]}`
                      : hasLiveFeed && sourceStatus === "loading"
                        ? "Connecting to Binance…"
                        : "Session simulation"}
                  </div>
                </div>
                <div>
                  <label className="field-label" htmlFor="expiry">
                    Expiry duration
                  </label>
                  <select
                    className="select-field"
                    id="expiry"
                    value={expiry}
                    onChange={(e) => setExpiry(Number(e.target.value))}
                  >
                    <option value={60}>60 seconds (Turbo)</option>
                    <option value={300}>5 minutes</option>
                    <option value={900}>15 minutes</option>
                  </select>
                </div>
              </div>
              <div className="strategy-title">
                <span>Technical confluences</span>
                <span>{strategies.length} of 4 enabled</span>
              </div>
              <div className="strategy-grid">
                {strategyOptions.map((s) => (
                  <label
                    className={`strategy ${strategies.includes(s.id) ? "checked" : ""}`}
                    key={s.id}
                  >
                    <input
                      type="checkbox"
                      checked={strategies.includes(s.id)}
                      onChange={(e) => {
                        setStrategies((list) =>
                          e.target.checked ? [...list, s.id] : list.filter((v) => v !== s.id),
                        );
                        setSignal(null);
                      }}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
              <Button
                variant="terminal"
                className="scan-button"
                disabled={scanning || strategies.length === 0}
                onClick={scan}
              >
                {scanning ? <LoaderCircle className="spinner" /> : <Sparkles />}
                {scanning ? scanStep || "Analyzing…" : "Scan & generate signal"}
                {!scanning && <ArrowUpRight />}
              </Button>
              <p className="scan-note">
                Four technical agents run locally. An optional server configured AI analyst can add
                a fifth review; no news or fundamentals feed is connected.
              </p>
            </section>
            <section className="agent-desk" aria-labelledby="agent-desk-title">
              <div className="agent-desk-head">
                <div>
                  <h2 id="agent-desk-title">Analyst agents</h2>
                  <p>Independent reads from the selected {timeframe}m candle series</p>
                </div>
                <span
                  className={`agent-state ${agentsRunning || aiRunning ? "agent-state-running" : ""}`}
                >
                  <span className="status-dot" />
                  {agentsRunning
                    ? "Analyzing"
                    : aiRunning
                      ? "AI reviewing"
                      : agentReports.length
                        ? `${agentReports.length} reports`
                        : "Ready"}
                </span>
              </div>
              <div className="agent-cards">
                {agentReports.length ? (
                  agentReports.map((report) => (
                    <article className="agent-card" key={report.name}>
                      <div>
                        <strong>{report.name}</strong>
                        <span>{report.focus}</span>
                      </div>
                      <span className={`agent-stance ${report.stance.toLowerCase()}`}>
                        {report.stance}
                      </span>
                      <p>{report.finding}</p>
                    </article>
                  ))
                ) : (
                  <p className="agent-empty">
                    {agentsRunning
                      ? "Trend, momentum, range and price action agents are reviewing the candles…"
                      : "Run a scan to get four independent technical reviews."}
                  </p>
                )}
              </div>
              {aiRunning && (
                <p className="agent-consensus">
                  Optional language model is reviewing the same candle data in the background…
                </p>
              )}
              {aiError && (
                <p className="agent-consensus" role="status">
                  {aiError}
                </p>
              )}
              {agentReports.length > 0 && (
                <p className="agent-consensus">
                  The four technical agents use fixed rules. The optional AI report is model
                  generated. Neither output is a validated forecast or investment advice.
                </p>
              )}
              <p className="agent-consensus">
                To enable the optional AI agent, configure an OpenAI-compatible chat provider on the
                server. Browse providers at{" "}
                <a href="https://free-llm.com" target="_blank" rel="noreferrer">
                  Free-LLM directory
                </a>
                ; provider availability and free-tier limits change.
              </p>
            </section>
          </div>
          <aside className="signal-panel" aria-label="Signal analysis and paper execution">
            <div className="panel-heading">
              Signal analysis
              <span>
                <span className="status-dot" /> Rules engine ready
              </span>
            </div>
            <div className="signal-content">
              <div className="signal-result" aria-live="polite">
                <div
                  className={`signal-icon ${direction === "CALL" ? "positive" : direction === "PUT" ? "negative" : ""}`}
                >
                  {direction === "CALL" ? (
                    <ArrowUp />
                  ) : direction === "PUT" ? (
                    <ArrowDown />
                  ) : (
                    <AudioLines />
                  )}
                </div>
                <div>
                  <h3
                    className={
                      direction === "CALL" ? "positive" : direction === "PUT" ? "negative" : ""
                    }
                  >
                    {signal ? direction : "Standby"}
                  </h3>
                  <p>
                    {signal
                      ? isLive
                        ? "Scan complete · live prices"
                        : "Scan complete · simulated market"
                      : "Waiting for your next scan"}
                  </p>
                </div>
              </div>
              <div className="confidence-row">
                <span>Confluence score</span>
                <strong className="mono">{signal ? `${signal.confidence}%` : "—"}</strong>
              </div>
              <progress className="confidence-meter" max={100} value={signal?.confidence ?? 0} />
              <div className="signal-label">
                <Info size={11} />
                Not a validated win probability
              </div>
              <div className="indicators">
                <div className="subheading">
                  Technical indicators
                  <Activity size={13} className="muted" />
                </div>
                <div className="indicator-row">
                  <span>RSI (14)</span>
                  <strong>
                    {indicators.rsi.toFixed(2)}{" "}
                    <span
                      className={
                        indicators.rsi >= 55
                          ? "positive"
                          : indicators.rsi <= 45
                            ? "negative"
                            : "muted"
                      }
                    >
                      {indicators.rsi >= 55 ? "↗" : indicators.rsi <= 45 ? "↘" : "·"}
                    </span>
                  </strong>
                </div>
                <div className="indicator-row">
                  <span>EMA 9 / 21</span>
                  <strong>
                    {indicators.ema9.toFixed(asset.precision)} /{" "}
                    {indicators.ema21.toFixed(asset.precision)}
                  </strong>
                </div>
                <div className="indicator-row">
                  <span>Bollinger midline</span>
                  <strong>{indicators.bb_mid.toFixed(asset.precision)}</strong>
                </div>
                <div className="indicator-row">
                  <span>20-period high / low</span>
                  <strong>
                    {indicators.high_20.toFixed(asset.precision)} /{" "}
                    {indicators.low_20.toFixed(asset.precision)}
                  </strong>
                </div>
              </div>
              <div className="reason-list">
                <div className="subheading">
                  Signal verification
                  <ShieldCheck size={13} className="muted" />
                </div>
                {signal ? (
                  signal.reasons.map((reason) => (
                    <div className="reason" key={reason}>
                      <Check />
                      {reason}
                    </div>
                  ))
                ) : (
                  <div className="reason">
                    <Clock3 />
                    Run a scan to check the selected confluences.
                  </div>
                )}
              </div>
            </div>
            <div className="execution">
              {activeTrade && (
                <div className="active-trade" role="status">
                  <span className={activeTrade.direction === "CALL" ? "positive" : "negative"}>
                    {activeTrade.direction} · Active paper trade
                  </span>
                  <strong className="mono">
                    {Math.max(0, Math.ceil((activeTrade.expiry - now) / 1000))}s
                  </strong>
                </div>
              )}
              <div className="execution-heading">
                <strong>Paper execution</strong>
                <span>Max stake $1.00</span>
              </div>
              <div className="stake-row">
                {[1, 0.5, 0.25, 0.1].map((s) => (
                  <Button
                    variant="control"
                    className={stake === s ? "selected" : ""}
                    aria-pressed={stake === s}
                    key={s}
                    onClick={() => setStake(s)}
                  >
                    {money(s)}
                  </Button>
                ))}
              </div>
              <div className="trade-actions">
                <Button
                  variant="call"
                  disabled={!!activeTrade || scanning}
                  onClick={() => execute("CALL")}
                >
                  <div>
                    <ArrowUp />
                    Buy CALL
                  </div>
                  <span>{asset.payout}% payout</span>
                </Button>
                <Button
                  variant="put"
                  disabled={!!activeTrade || scanning}
                  onClick={() => execute("PUT")}
                >
                  <div>
                    <ArrowDown />
                    Buy PUT
                  </div>
                  <span>{asset.payout}% payout</span>
                </Button>
              </div>
              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}
              <p className="execution-note">
                <ShieldCheck size={11} />
                No real money. No broker orders.
              </p>
            </div>
          </aside>
        </div>
        <section className="research-section" aria-labelledby="research-title">
          <div className="history-header research-header">
            <div>
              <h2 id="research-title">TradingAgents research</h2>
              <p className="muted small">
                Run the upstream LangGraph analyst, debate, trader and risk workflow for a ticker
                and date.
              </p>
            </div>
            <span className={`agent-state ${researchBusy ? "agent-state-running" : ""}`}>
              <span className="status-dot" />
              {researchBusy
                ? "Framework running"
                : researchResult
                  ? "Research complete"
                  : "Backend required"}
            </span>
          </div>
          <div className="research-controls">
            <label>
              Ticker
              <input
                aria-label="Research ticker"
                maxLength={20}
                value={researchTicker}
                onChange={(event) => setResearchTicker(event.target.value.toUpperCase())}
                placeholder="AAPL"
              />
            </label>
            <label>
              Analysis date
              <input
                aria-label="Research analysis date"
                type="date"
                value={researchDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setResearchDate(event.target.value)}
              />
            </label>
            <label>
              Asset type
              <select
                aria-label="Research asset type"
                value={researchType}
                onChange={(event) => setResearchType(event.target.value as "stock" | "crypto")}
              >
                <option value="stock">Stock</option>
                <option value="crypto">Crypto</option>
              </select>
            </label>
            <Button
              disabled={researchBusy || !researchTicker.trim() || !researchDate}
              onClick={() => void runFrameworkResearch()}
            >
              {researchBusy ? <LoaderCircle className="spinner" /> : <Sparkles />}
              {researchBusy ? "Agents researching…" : "Run research"}
            </Button>
          </div>
          {researchError && (
            <p className="error-message" role="alert">
              {researchError}. Start the optional Python service on port 4001 and configure its
              TradingAgents providers and data vendors.
            </p>
          )}
          {!researchResult && !researchError && (
            <p className="research-note">
              Requires the optional Python research service and TradingAgents model and market-data
              credentials. This date-based research workflow is separate from the short-term candle
              scan above.
            </p>
          )}
          {researchResult && (
            <div className="research-result">
              <div className="research-rating">
                <span>Framework rating</span>
                <strong>{researchResult.rating}</strong>
                <span>
                  {researchResult.ticker} · {researchResult.analysis_date} ·{" "}
                  {researchResult.asset_type}
                </span>
              </div>
              <div className="research-reports">
                {Object.entries(researchResult.reports).map(([title, report]) => (
                  <details key={title}>
                    <summary>{title}</summary>
                    <pre>{report}</pre>
                  </details>
                ))}
              </div>
              <details className="research-provenance">
                <summary>Run configuration and provenance</summary>
                <pre>{JSON.stringify(researchResult.run_settings, null, 2)}</pre>
              </details>
              <p className="research-note">
                Model generated research for study, not financial advice. Framework ratings are not
                guaranteed outcomes or broker orders.
              </p>
            </div>
          )}
        </section>
        <section id="trade-history" className="history-section" aria-label="Paper trade history">
          <div className="history-header">
            <div className="history-tabs">
              <Button
                variant="nav"
                className={tab === "history" ? "selected" : ""}
                onClick={() => setTab("history")}
              >
                Trade history{" "}
                <span className="mono muted">{String(trades.length).padStart(2, "0")}</span>
              </Button>
              <Button
                variant="nav"
                className={tab === "risk" ? "selected" : ""}
                onClick={() => setTab("risk")}
              >
                Risk guard
              </Button>
            </div>
            <Button variant="nav" disabled={!trades.length} onClick={exportHistory}>
              <ArrowDownToLine />
              Export history
            </Button>
          </div>
          {tab === "history" ? (
            <>
              <div className="table-wrap">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>ASSET</th>
                      <th>DIRECTION</th>
                      <th>STAKE</th>
                      <th>ENTRY PRICE</th>
                      <th>STATUS</th>
                      <th>PROFIT / LOSS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t) => (
                      <tr key={t.id}>
                        <td>{t.asset}</td>
                        <td className={t.direction === "CALL" ? "positive" : "negative"}>
                          {t.direction === "CALL" ? "↗" : "↘"} {t.direction}
                        </td>
                        <td className="mono">{money(t.stake)}</td>
                        <td className="mono">{t.entry.toFixed(t.precision)}</td>
                        <td>{t.profit === undefined ? "Active" : t.profit > 0 ? "Won" : "Lost"}</td>
                        <td className={`mono ${(t.profit ?? 0) >= 0 ? "positive" : "negative"}`}>
                          {t.profit === undefined ? "—" : money(t.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {trades.length === 0 && (
                <div className="empty-history">
                  <History size={24} />
                  <span>Your paper trades will appear here</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="risk-grid">
                <div>
                  <p>Daily trade cap</p>
                  <strong className="mono">{trades.length} / 20 trades</strong>
                </div>
                <div>
                  <p>Session P/L · planned loss limit</p>
                  <strong className="mono">{money(pnl)} / −$5.00</strong>
                </div>
                <div>
                  <p>Execution cooldown</p>
                  <strong className="mono">
                    {Math.max(0, Math.ceil((lastTrade + 60000 - now) / 1000))}s / 60s
                  </strong>
                </div>
                <div>
                  <p>Execution safety</p>
                  <strong className="positive">Paper mode only</strong>
                </div>
              </div>
              <p className="small muted">
                Session-only controls. The planned daily-loss stop is not enforced by a server.
              </p>
            </>
          )}
        </section>
        <footer className="footer">
          <p>
            Binance public candles power listed crypto pairs when available; all other instruments
            use session simulation. Four rule-based agents analyze price candles only. Paper trades
            reset on reload and never place broker orders.
          </p>
          <Button variant="nav" size="sm" onClick={() => setInfoOpen(true)}>
            <CircleHelp />
            About Trading Assistant
          </Button>
        </footer>
      </main>
      <nav className="mobile-dock" aria-label="Mobile navigation">
        <Button
          variant="nav"
          className="selected"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <CandlestickChart />
          Terminal
        </Button>
        <Button variant="nav" onClick={() => setAssetsOpen(true)}>
          <Layers3 />
          Markets
        </Button>
        <Button
          variant="nav"
          onClick={() =>
            document.getElementById("config-title")?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <Sparkles />
          Scan
        </Button>
        <Button variant="nav" onClick={() => historyView("risk")}>
          <ShieldCheck />
          Risk guard
        </Button>
      </nav>
      <Dialog open={assetsOpen} onOpenChange={setAssetsOpen}>
        <DialogContent className="dialog-content">
          <DialogTitle>All markets</DialogTitle>
          <DialogDescription>
            Binance candles for supported pairs; remaining instruments are simulated.
          </DialogDescription>
          <div className="asset-search">
            <Search size={16} />
            <input
              aria-label="Search markets"
              placeholder="Search a market…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="asset-results">
            {assets
              .map((a, i) => ({ a, i }))
              .filter(({ a }) => a.name.toLowerCase().includes(search.toLowerCase()))
              .map(({ a, i }) => (
                <Button
                  key={a.name}
                  variant="nav"
                  className={`asset-result ${i === assetIndex ? "active" : ""}`}
                  onClick={() => selectAsset(i)}
                >
                  <span>
                    <span className="asset-icon">{a.short}</span>
                    {a.name}
                  </span>
                  <span className="asset-result-source">
                    {liveSymbols[a.name] ? "BINANCE" : "SIMULATED"}
                    {i === assetIndex && <Check size={14} />}
                  </span>
                </Button>
              ))}
            {!assets.some((a) => a.name.toLowerCase().includes(search.toLowerCase())) && (
              <p className="muted small">No matching markets.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="dialog-content">
          <DialogTitle>Trading Assistant</DialogTitle>
          <DialogDescription>Market research terminal · browser edition</DialogDescription>
          <p className="modal-note">
            BTC/USDT, ETH/USDT, BNB/USDT and EUR/USDT use Binance public candles when the browser
            can reach the exchange. Every other instrument, and any supported pair during a feed
            outage, uses clearly labeled simulated candles. Four independent rule-based analysts
            review trend, momentum, range and price action. They do not use an LLM, news or
            fundamentals.
          </p>
          <p className="modal-note">
            No real orders are placed. Risk controls in this preview are not a substitute for
            broker-side protection.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="dialog-content max-w-5xl">
          <DialogTitle>
            {asset.name} · {timeframe}m
          </DialogTitle>
          <DialogDescription>
            {isLive ? `Live Binance candles · ${sourceTime} UTC` : "Session simulated candles"}
          </DialogDescription>
          <div className="chart-canvas">
            <PriceChart
              candles={candles}
              precision={asset.precision}
              indicators={showIndicators}
              line={line}
              zoom={zoom}
              expanded={expanded}
              source={isLive ? `Live Binance ${liveSymbols[asset.name]}` : "Simulated"}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
