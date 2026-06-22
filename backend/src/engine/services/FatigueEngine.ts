/**
 * FatigueEngine
 *
 * Owns all fatigue accounting. A session's fatigue is the sum of each
 * exercise's fatigueScore (1–5) scaled by how many working sets it contributes.
 * The engine refuses to let a session exceed MAX_SESSION_FATIGUE.
 */
import type { Exercise, SelectedExercise } from "../../types";
import { MAX_SESSION_FATIGUE } from "../rules/businessRules";

export class FatigueEngine {
  readonly maxSessionFatigue: number;

  constructor(maxSessionFatigue: number = MAX_SESSION_FATIGUE) {
    this.maxSessionFatigue = maxSessionFatigue;
  }

  /**
   * Fatigue cost of a single exercise. The raw fatigueScore is the cost for a
   * "standard" 3-set block; we scale linearly with set count so that adding
   * sets is correctly penalised.
   */
  exerciseFatigue(exercise: Exercise, sets: number): number {
    const STANDARD_SETS = 3;
    return round1((exercise.fatigueScore * sets) / STANDARD_SETS);
  }

  sessionFatigue(selections: SelectedExercise[]): number {
    return round1(
      selections.reduce((sum, s) => sum + this.exerciseFatigue(s.exercise, s.sets), 0),
    );
  }

  /** Would adding this exercise keep the session under the ceiling? */
  canAdd(current: SelectedExercise[], exercise: Exercise, sets: number): boolean {
    return this.sessionFatigue(current) + this.exerciseFatigue(exercise, sets) <= this.maxSessionFatigue;
  }

  remainingBudget(selections: SelectedExercise[]): number {
    return round1(this.maxSessionFatigue - this.sessionFatigue(selections));
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
