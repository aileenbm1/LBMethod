import { describe, expect, it } from "vitest";
import { RoutineValidator } from "../src/engine/validators/RoutineValidator";
import { METHOD_CONFIGS } from "../src/engine/rules/businessRules";
import type { GeneratedRoutine } from "../src/types";

const validator = new RoutineValidator();

function baseRoutine(overrides: Partial<GeneratedRoutine> = {}): GeneratedRoutine {
  return {
    goal: "glute_hypertrophy",
    level: "intermediate",
    daysPerWeek: 4,
    weekNumber: 1,
    rir: 3,
    deload: false,
    volume: {
      weeklyGluteSets: 20,
      weeklyQuadSets: 10,
      weeklyHamstringSets: 9,
      weeklyUpperSets: 12,
      lowerVolumePct: 0.66,
      upperVolumePct: 0.34,
      gluteFrequency: 3,
    },
    days: [],
    signature: "abc",
    ...overrides,
  };
}

describe("RoutineValidator", () => {
  it("flags excessive volume", () => {
    const r = baseRoutine({ volume: { ...baseRoutine().volume, weeklyGluteSets: 40 } });
    const result = validator.checkVolume(r.goal, r.level, r.volume.weeklyGluteSets, false);
    expect(result.some((i) => i.code === "VOLUME_EXCESS")).toBe(true);
  });

  it("flags low glute frequency for priority goals", () => {
    const result = validator.checkFrequency("glute_hypertrophy", 5, 2);
    expect(result.some((i) => i.code === "FREQ_LOW")).toBe(true);
  });

  it("flags unbalanced lower/upper distribution", () => {
    const result = validator.checkDistribution("glute_hypertrophy", 0.5, 0.5);
    expect(result.some((i) => i.code === "DIST_LOWER")).toBe(true);
    expect(result.some((i) => i.code === "DIST_UPPER")).toBe(true);
  });

  it("flags fatigue overruns", () => {
    const r = baseRoutine({
      days: [{ dayIndex: 0, focus: "glute_quad", selections: [], sessionFatigue: 15, totalSets: 12 }],
    });
    const result = validator.checkFatigue(r);
    expect(result.some((i) => i.code === "FATIGUE_EXCESS")).toBe(true);
  });

  it("accepts a well-formed routine", () => {
    const r = baseRoutine({
      days: [
        {
          dayIndex: 0,
          focus: "glute_quad",
          sessionFatigue: 9,
          totalSets: 12,
          selections: [
            { exercise: { id: "a" } as any, role: "main", sets: 4, repsMin: 6, repsMax: 10, rir: 3, order: 1, method: "straight" as const, methodConfig: METHOD_CONFIGS.straight },
            { exercise: { id: "b" } as any, role: "unilateral", sets: 3, repsMin: 8, repsMax: 12, rir: 3, order: 2, method: "straight" as const, methodConfig: METHOD_CONFIGS.straight },
            { exercise: { id: "c" } as any, role: "isolation", sets: 3, repsMin: 12, repsMax: 20, rir: 3, order: 3, method: "straight" as const, methodConfig: METHOD_CONFIGS.straight },
          ],
        },
      ],
    });
    expect(validator.validate(r).valid).toBe(true);
  });
});
