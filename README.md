# Trading Assistant

Trading Assistant is a browser-based market research and paper-trading terminal. It combines market candles, transparent technical indicators, four independent rule-based analyst agents, an optional server-side AI analyst, and session-only paper trades.

## Market data and analysis

- BTC/USDT, ETH/USDT, BNB/USDT, and EUR/USDT use Binance's public spot candle feed in the browser when available. No exchange key or backend is required.
- Other listed instruments use generated session simulation candles and are labeled as simulated. If Binance cannot be reached, supported pairs fall back to simulated candles and the interface shows the source change.
- Trend, momentum, range, and price-action agents independently inspect the same candle series using fixed, visible technical rules. When configured, a fifth AI analyst reviews that same candle data through an OpenAI-compatible chat API. Its key stays on the server and its report is shown separately from the deterministic rules.
- The existing signal score is heuristic, not a forecast or validated win probability. Paper trades do not contact a broker, and balances and trade history reset on reload.

### Optional AI analyst

Copy `.env.example` to `.env` and configure `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` with a provider's documented OpenAI-compatible chat endpoint. `OPENAI_API_KEY` can be used instead of `AI_API_KEY` when the endpoint is OpenAI. Restart the dev server after changing environment values. Never put provider secrets in `VITE_*` variables or client code.

[Free-LLM](https://free-llm.com) is a community provider directory, not an AI API or market-data feed. Its free-tier, model, and quota listings can change; confirm current provider terms before configuring an endpoint. This app does not collect keys or automatically switch providers.

## Run locally

Requirements: Node.js 20.19+ (or 22.12+) and npm. These versions match the Vite 7 runtime requirements.

```sh
npm install --include=dev --os=android --cpu=arm64
npm run dev
```

The install flags include build tools and Android ARM64 native modules even when a global npm configuration targets Linux or omits development dependencies.

The development server binds to port `6000`: <http://localhost:6000>.

### TradingAgents research service

The separate research panel calls TauricResearch's upstream Python/LangGraph workflow through a local adapter on port `4001`. It runs stock or crypto analyst, debate, trader, and risk stages for a ticker and analysis date; its final five-tier rating is not converted into the browser terminal's short-expiry signal.

Use Python 3.11 or later. In another terminal, from this project directory:

```sh
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
uvicorn backend.app:app --host 127.0.0.1 --port 4001
```

Set TradingAgents provider and vendor keys in `.env` using the [upstream configuration guide](https://github.com/TauricResearch/TradingAgents#installation-and-cli). `OPENAI_API_KEY` is one supported option; TradingAgents also accepts providers such as OpenRouter, Groq, Google, and OpenAI-compatible endpoints through its own `TRADINGAGENTS_*` configuration. Data-source coverage depends on the ticker, date, vendors, and credentials. Run locally only; the adapter has no user authentication and should not be exposed to the public internet as-is.

The upstream framework uses its own dataflows and applies point-in-time rules to supported historical sources. Reports include safe run settings so you can review model/provider choices and vendor routing. Individual source coverage can vary. Provider/model output is research, not investment advice or an order sent to a broker.

To create a production build and preview it on the same port:

```sh
npm run build
npm run preview
```

## Project layout

- `src/lib/trading.ts` contains browser-safe candles, indicator rules, paper-trade limits, and the independent analyst agents.
- `src/routes/index.tsx` assembles the terminal and reports data provenance.
- `src/components/trading/price-chart.tsx` draws the chart.
- `src/styles.css` defines shared terminal colors, trading states, and component styles.

The browser terminal's candle scan and paper-trade simulator are separate from the framework-backed ticker/date research workflow. The optional research adapter requires its Python dependencies and configured model and data providers.
