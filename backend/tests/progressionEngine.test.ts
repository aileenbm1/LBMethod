import { describe, expect, it } from "vitest";
import { ProgressionEngine } from "../src/engine/services/ProgressionEngine";

describe("ProgressionEngine", () => {
  const engine = new ProgressionEngine();

  it("follows RIR 3 -> 2 -> 1 -> deload", () => {
    const cycle = engine.buildMesocycle();
    expect(cycle.map((w) => w.rir)).toEqual([3, 2, 1, 4]);
    expect(cycle[3].deload).toBe(true);
    expect(cycle[3].volumeMultiplier).toBeCloseTo(0.8);
  });

  it("cuts 20% volume on the deload week", () => {
    const week4 = engine.forWeek(4);
    expect(week4.deload).toBe(true);
    expect(week4.volumeMultiplier).toBe(0.8);
  });

  it("wraps the mesocycle for weeks beyond 4", () => {
    expect(engine.forWeek(5).rir).toBe(3);
    expect(engine.next(4).rir).toBe(3);
  });
});
