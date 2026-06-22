/**
 * ProgressionEngine
 *
 * Owns the mesocycle: RIR progression across weeks and the week-4 deload.
 * It exposes both the full progression table and per-week parameters that the
 * main engine feeds into the volume calculator and selector.
 */
import type { ProgressionWeek } from "../../types";
import { MESOCYCLE } from "../rules/businessRules";

export class ProgressionEngine {
  /** Full 4-week progression plan. */
  buildMesocycle(): ProgressionWeek[] {
    return MESOCYCLE.map((w) => ({ ...w }));
  }

  /** Parameters for a single week (1-indexed); weeks beyond 4 wrap the cycle. */
  forWeek(week: number): ProgressionWeek {
    const idx = ((week - 1) % MESOCYCLE.length + MESOCYCLE.length) % MESOCYCLE.length;
    return { ...MESOCYCLE[idx], week };
  }

  /**
   * Advance an existing routine's week, returning the next week's parameters.
   * Used by POST /progress-routine.
   */
  next(currentWeek: number): ProgressionWeek {
    return this.forWeek(currentWeek + 1);
  }
}
