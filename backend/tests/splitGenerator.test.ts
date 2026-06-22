import { describe, expect, it } from "vitest";
import { SplitGenerator } from "../src/engine/generators/SplitGenerator";

describe("SplitGenerator", () => {
  const gen = new SplitGenerator();

  it("produces the right number of days for 3-6 day splits", () => {
    for (const days of [3, 4, 5, 6]) {
      expect(gen.generate("glute_hypertrophy", days)).toHaveLength(days);
    }
  });

  it("hits glutes at least 3x for 4+ day priority splits", () => {
    expect(gen.gluteFrequency("glute_hypertrophy", 4)).toBeGreaterThanOrEqual(3);
    expect(gen.gluteFrequency("glute_growth", 5)).toBeGreaterThanOrEqual(3);
    expect(gen.gluteFrequency("lower_body_focus", 6)).toBeGreaterThanOrEqual(3);
  });

  it("matches the canonical 4-day LB Method split", () => {
    const foci = gen.generate("glute_hypertrophy", 4).map((d) => d.focus);
    expect(foci).toEqual(["glute_hamstring", "upper_body", "glute_quad", "glute_specialization"]);
  });

  it("clamps out-of-range day counts into 3-6", () => {
    expect(gen.generate("glute_growth", 2)).toHaveLength(3);
    expect(gen.generate("glute_growth", 9)).toHaveLength(6);
  });
});
