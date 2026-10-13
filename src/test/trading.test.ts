import { describe, it, expect } from "vitest";
import { demoCandles, makeSignal, tradeError } from "@/lib/trading";
describe("Imported paper trading rules", () => {
  it("caps paper stakes at one dollar", () => {
    expect(tradeError(1.01, 1000, 0, 0, 100000)).toBeTruthy();
    expect(tradeError(1, 1000, 0, 0, 100000)).toBe("");
  });
  it("caps paper trades at twenty", () => {
    expect(tradeError(1, 1000, 20, 0, 100000)).toBeTruthy();
    expect(tradeError(1, 1000, 19, 0, 100000)).toBe("");
  });
  it("retains sixty second cooldown", () => {
    expect(tradeError(1, 1000, 1, 100000, 159999)).toBeTruthy();
    expect(tradeError(1, 1000, 1, 100000, 160000)).toBe("");
  });
  it("keeps disabled strategies neutral", () => {
    const s = makeSignal(
      { strategies: [], symbol: "EUR/USD OTC", market: "OTC", timeframe: "1m", expiry_seconds: 60 },
      demoCandles(1.0852),
    );
    expect(s.direction).toBe("WAIT");
    expect(s.confidence).toBe(50);
  });
});
