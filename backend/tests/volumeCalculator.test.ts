import { describe, expect, it } from "vitest";
import { VolumeCalculator } from "../src/engine/calculators/VolumeCalculator";

describe("VolumeCalculator", () => {
  const calc = new VolumeCalculator();

  it("keeps beginner glute volume within 12-16 sets", () => {
    const plan = calc.calculate("glute_hypertrophy", "beginner", 4);
    expect(plan.weeklyGluteSets).toBeGreaterThanOrEqual(12);
    expect(plan.weeklyGluteSets).toBeLessThanOrEqual(16);
  });

  it("keeps intermediate glute volume within 18-24 sets", () => {
    const plan = calc.calculate("glute_growth", "intermediate", 5);
    expect(plan.weeklyGluteSets).toBeGreaterThanOrEqual(18);
    expect(plan.weeklyGluteSets).toBeLessThanOrEqual(24);
  });

  it("keeps advanced glute volume within 22-30 sets", () => {
    const plan = calc.calculate("lower_body_focus", "advanced", 6);
    expect(plan.weeklyGluteSets).toBeGreaterThanOrEqual(22);
    expect(plan.weeklyGluteSets).toBeLessThanOrEqual(30);
  });

  it("enforces >=60% lower / <=40% upper for priority goals", () => {
    const plan = calc.calculate("glute_hypertrophy", "intermediate", 4);
    expect(plan.lowerVolumePct).toBeGreaterThanOrEqual(0.6);
    expect(plan.upperVolumePct).toBeLessThanOrEqual(0.4);
  });

  it("reduces volume on a deload multiplier", () => {
    const full = calc.calculate("glute_growth", "advanced", 5, 1);
    const deload = calc.calculate("glute_growth", "advanced", 5, 0.8);
    expect(deload.weeklyGluteSets).toBeLessThan(full.weeklyGluteSets);
  });
});
