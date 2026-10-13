"""Small local HTTP adapter for the upstream TradingAgents research graph."""

from __future__ import annotations

import inspect
import re
from datetime import date
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Trading Assistant Research API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:6000", "http://127.0.0.1:6000"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class ResearchRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)
    analysis_date: date
    asset_type: Literal["stock", "crypto"] = "stock"


def _text(value: object) -> str:
    if value is None:
        return "No report was returned for this section."
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, list):
        return "\n".join(_text(item) for item in value)
    if isinstance(value, dict):
        return "\n".join(f"{key}: {_text(item)}" for key, item in value.items())
    return str(value)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ready", "engine": "TauricResearch TradingAgents"}


@app.post("/api/research")
def run_research(request: ResearchRequest) -> dict[str, object]:
    ticker = request.ticker.strip().upper()
    if not re.fullmatch(r"[A-Z0-9.^=_-]{1,20}", ticker):
        raise HTTPException(status_code=422, detail="Use a valid ticker symbol.")
    if request.analysis_date > date.today():
        raise HTTPException(status_code=422, detail="The analysis date cannot be in the future.")

    try:
        from tradingagents.default_config import build_default_config
        from tradingagents.graph.trading_graph import TradingAgentsGraph

        graph = TradingAgentsGraph(
            selected_analysts=("market", "social", "news", "fundamentals"),
            debug=False,
            config=build_default_config(),
        )
        propagate = graph.propagate
        parameters = inspect.signature(propagate).parameters.values()
        accepts_asset_type = any(
            parameter.name == "asset_type"
            or parameter.kind is inspect.Parameter.VAR_KEYWORD
            for parameter in parameters
        )
        if request.asset_type == "crypto" and not accepts_asset_type:
            raise HTTPException(
                status_code=422,
                detail="This installed TradingAgents version does not support crypto research.",
            )

        if accepts_asset_type:
            final_state, rating = propagate(
                ticker,
                request.analysis_date.isoformat(),
                asset_type=request.asset_type,
            )
        else:
            final_state, rating = propagate(ticker, request.analysis_date.isoformat())

        settings_method = getattr(graph, "run_settings", None)
        settings = settings_method() if callable(settings_method) else {}
        return {
            "ticker": ticker,
            "analysis_date": request.analysis_date.isoformat(),
            "asset_type": request.asset_type,
            "rating": str(rating),
            "reports": {
                "Market analyst": _text(final_state.get("market_report")),
                "Sentiment analyst": _text(final_state.get("sentiment_report")),
                "News analyst": _text(final_state.get("news_report")),
                "Fundamentals analyst": _text(final_state.get("fundamentals_report")),
                "Research debate": _text(final_state.get("investment_debate_state")),
                "Trader plan": _text(final_state.get("trader_investment_plan")),
                "Risk review": _text(final_state.get("risk_debate_state")),
                "Portfolio decision": _text(final_state.get("final_trade_decision")),
            },
            "run_settings": settings,
        }
    except HTTPException:
        raise
    except Exception as error:  # keep provider details and credentials out of the client response
        print(f"TradingAgents research failed ({type(error).__name__}).")
        raise HTTPException(
            status_code=502,
            detail=f"Research run failed ({type(error).__name__}). Check backend provider and market-data configuration.",
        ) from error
