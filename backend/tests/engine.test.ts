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

  it("keeps the same exercises across every week of the mesocycle", () => {
    const user: UserProfile = { goal: "glute_hypertrophy", experienceLevel: "intermediate", daysPerWeek: 5 };
    const program = engine.generateProgram(user, EXERCISE_LIBRARY, 4, { seed: 42 });
    const signatures = program.weeks.map((w) => w.signature);
    // Semana 4 es deload (menos series) pero los ejercicios son los mismos, así
    // que la firma (basada solo en ids de ejercicio) debe repetirse las 4 semanas.
    expect(new Set(signatures).size).toBe(1);
  });

  it("keeps the same exercises when regenerating with an unchanged profile (anchor)", () => {
    const user: UserProfile = { goal: "glute_hypertrophy", experienceLevel: "intermediate", daysPerWeek: 4 };
    const first = engine.generateProgram(user, EXERCISE_LIBRARY, 4, { seed: 55 });
    const anchored = engine.generateProgram(user, EXERCISE_LIBRARY, 4, { anchorRoutine: first.weeks[0] });
    expect(anchored.weeks[0].signature).toBe(first.weeks[0].signature);
  });

  it("only substitutes exercises blocked by a new limitation when anchoring", () => {
    const user: UserProfile = { goal: "glute_hypertrophy", experienceLevel: "intermediate", daysPerWeek: 4 };
    const baseline = engine.generateProgram(user, EXERCISE_LIBRARY, 4, { seed: 55 });
    const anchor = baseline.weeks[0];
    const blockedPattern = anchor.days[0].selections[0].exercise.movementPattern;

    const restrictedUser: UserProfile = {
      ...user,
      limitations: [{ description: "test", affectedPatterns: [blockedPattern], severity: "severe" }],
    };
    const reconciled = engine.generateProgram(restrictedUser, EXERCISE_LIBRARY, 4, { anchorRoutine: anchor }).weeks[0];

    for (const day of anchor.days) {
      const reconciledDay = reconciled.days.find((d) => d.dayIndex === day.dayIndex)!;
      for (const sel of day.selections) {
        const kept = reconciledDay.selections.find((s) => s.role === sel.role && s.order === sel.order);
        if (sel.exercise.movementPattern === blockedPattern) {
          expect(kept?.exercise.id).not.toBe(sel.exercise.id);
        } else {
          expect(kept?.exercise.id).toBe(sel.exercise.id);
        }
      }
    }
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
