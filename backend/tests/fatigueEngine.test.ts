import { describe, expect, it } from "vitest";
import { FatigueEngine } from "../src/engine/services/FatigueEngine";
import { METHOD_CONFIGS } from "../src/engine/rules/businessRules";
import type { Exercise, SelectedExercise } from "../src/types";

function fakeExercise(fatigueScore: number): Exercise {
  return {
    id: `ex-${fatigueScore}-${Math.random()}`,
    name: "x",
    muscleGroup: "glutes",
    movementPattern: "hip_thrust",
    category: "compound",
    equipment: "barbell",
    difficulty: "intermediate",
    activationScore: 9,
    fatigueScore,
    stabilityRequirement: 3,
    unilateral: false,
    primaryMuscle: "glutes",
    secondaryMuscles: [],
  };
}

function sel(fatigueScore: number, sets: number): SelectedExercise {
  return {
    exercise: fakeExercise(fatigueScore),
    role: "main",
    sets,
    repsMin: 8,
    repsMax: 12,
    rir: 2,
    order: 1,
    method: "straight" as const,
    methodConfig: METHOD_CONFIGS.straight,
  };
}

describe("FatigueEngine", () => {
  const engine = new FatigueEngine();

  it("scales fatigue with set count", () => {
    expect(engine.exerciseFatigue(fakeExercise(4), 3)).toBe(4);
    expect(engine.exerciseFatigue(fakeExercise(4), 6)).toBe(8);
  });

  it("sums session fatigue", () => {
    const session = [sel(4, 3), sel(1, 3), sel(1, 3)];
    expect(engine.sessionFatigue(session)).toBe(6);
  });

  it("refuses additions that breach the 12-point ceiling", () => {
    const session = [sel(5, 3), sel(4, 3)]; // 9
    expect(engine.canAdd(session, fakeExercise(5), 3)).toBe(false); // +5 = 14
    expect(engine.canAdd(session, fakeExercise(1), 3)).toBe(true); // +1 = 10
  });
});
