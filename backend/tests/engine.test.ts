import { describe, expect, it } from "vitest";
import { LBMethodEngine } from "../src/engine/services/LBMethodEngine";
import { EXERCISE_LIBRARY } from "../src/data/exerciseLibrary";
import { MAX_SESSION_FATIGUE } from "../src/engine/rules/businessRules";
import type { Goal, ExperienceLevel, UserProfile } from "../src/types";

describe("LBMethodEngine (integration)", () => {
  const engine = new LBMethodEngine();

  it("generates a fully valid 4-week program for a priority goal", () => {
    const user: UserProfile = { goal: "glute_hypertrophy", experienceLevel: "intermediate", daysPerWeek: 5 };
    const program = engine.generateProgram(user, EXERCISE_LIBRARY, 4, { seed: 999 });

    expect(program.weeks).toHaveLength(4);
    for (const week of program.weeks) {
      const report = engine.validate(week);
      expect(report.valid, JSON.stringify(report.issues)).toBe(true);
    }
  });

  it("never exceeds the per-session fatigue ceiling", () => {
    const user: UserProfile = { goal: "glute_growth", experienceLevel: "advanced", daysPerWeek: 6 };
    const program = engine.generateProgram(user, EXERCISE_LIBRARY, 4, { seed: 7 });
    for (const week of program.weeks) {
      for (const day of week.days) {
        expect(day.sessionFatigue).toBeLessThanOrEqual(MAX_SESSION_FATIGUE);
      }
    }
  });

  it("builds each glute day from main + unilateral + isolation skeleton", () => {
    const user: UserProfile = { goal: "glute_hypertrophy", experienceLevel: "intermediate", daysPerWeek: 4 };
    const week = engine.generateRoutine(user, EXERCISE_LIBRARY, { seed: 1 });
    const gluteDays = week.days.filter((d) => d.focus.startsWith("glute"));
    expect(gluteDays.length).toBeGreaterThanOrEqual(3);
    for (const day of gluteDays) {
      const roles = day.selections.map((s) => s.role);
      expect(roles).toContain("main");
      expect(roles).toContain("unilateral");
      expect(roles).toContain("isolation");
    }
  });

  it("produces unique weekly combinations across the mesocycle", () => {
    const user: UserProfile = { goal: "glute_hypertrophy", experienceLevel: "intermediate", daysPerWeek: 5 };
    const program = engine.generateProgram(user, EXERCISE_LIBRARY, 4, { seed: 42 });
    const signatures = program.weeks.map((w) => w.signature);
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("generates valid programs across goals, levels and day counts", () => {
    const goals: Goal[] = ["glute_hypertrophy", "lower_body_focus", "body_recomposition", "fat_loss", "muscle_gain"];
    const levels: ExperienceLevel[] = ["beginner", "intermediate", "advanced"];
    for (const goal of goals) {
      for (const level of levels) {
        for (const days of [3, 4, 5, 6]) {
          const week = engine.generateRoutine({ goal, experienceLevel: level, daysPerWeek: days }, EXERCISE_LIBRARY, {
            seed: days * 100,
          });
          const report = engine.validate(week);
          expect(report.valid, `${goal}/${level}/${days}: ${JSON.stringify(report.issues)}`).toBe(true);
        }
      }
    }
  });
});
