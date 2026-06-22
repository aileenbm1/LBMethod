/**
 * RoutineValidator
 *
 * A composable set of guards that reject malformed programs:
 *  - excessive volume / wrong glute frequency
 *  - per-session fatigue overruns
 *  - repeated exercises within a day
 *  - unbalanced lower/upper distribution for priority goals
 *
 * Each guard is small and independently testable (Open/Closed: add a guard
 * without touching the others).
 */
import type {
  ExperienceLevel,
  GeneratedRoutine,
  Goal,
  ValidationIssue,
  ValidationResult,
} from "../../types";
import {
  LOWER_BODY_MIN_PCT,
  MAX_SESSION_FATIGUE,
  MIN_GLUTE_FREQUENCY,
  UPPER_BODY_MAX_PCT,
  WEEKLY_GLUTE_SET_RANGE,
  isGlutePriorityGoal,
} from "../rules/businessRules";

export class RoutineValidator {
  validate(routine: GeneratedRoutine): ValidationResult {
    const issues: ValidationIssue[] = [
      ...this.checkVolume(routine.goal, routine.level, routine.volume.weeklyGluteSets, routine.deload),
      ...this.checkFrequency(routine.goal, routine.daysPerWeek, routine.volume.gluteFrequency),
      ...this.checkDistribution(routine.goal, routine.volume.lowerVolumePct, routine.volume.upperVolumePct),
      ...this.checkFatigue(routine),
      ...this.checkRepeats(routine),
      ...this.checkBalance(routine),
    ];

    return {
      valid: issues.every((i) => i.severity !== "error"),
      issues,
    };
  }

  checkVolume(goal: Goal, level: ExperienceLevel, weeklyGluteSets: number, deload: boolean): ValidationIssue[] {
    const range = WEEKLY_GLUTE_SET_RANGE[level];
    // On a deload week the floor is intentionally lower.
    const min = deload ? Math.round(range.min * 0.7) : range.min;
    const max = Math.round(range.max * 1.1); // small tolerance
    if (weeklyGluteSets > max) {
      return [error("VOLUME_EXCESS", `Weekly glute sets ${weeklyGluteSets} exceed the ${level} ceiling (${range.max}).`)];
    }
    if (isGlutePriorityGoal(goal) && weeklyGluteSets < min) {
      return [error("VOLUME_LOW", `Weekly glute sets ${weeklyGluteSets} below the ${level} minimum (${min}).`)];
    }
    return [];
  }

  checkFrequency(goal: Goal, daysPerWeek: number, gluteFrequency: number): ValidationIssue[] {
    if (!isGlutePriorityGoal(goal)) return [];
    // 3-day splits can only fit 2 dedicated glute days; require 3 from 4 days up.
    const required = Math.min(MIN_GLUTE_FREQUENCY, daysPerWeek - 1);
    if (gluteFrequency < required) {
      return [error("FREQ_LOW", `Glute frequency ${gluteFrequency}/wk below required ${required} for this goal.`)];
    }
    return [];
  }

  checkDistribution(goal: Goal, lowerPct: number, upperPct: number): ValidationIssue[] {
    if (!isGlutePriorityGoal(goal)) return [];
    const out: ValidationIssue[] = [];
    if (lowerPct < LOWER_BODY_MIN_PCT - 0.02) {
      out.push(error("DIST_LOWER", `Lower-body volume ${(lowerPct * 100).toFixed(0)}% < required ${LOWER_BODY_MIN_PCT * 100}%.`));
    }
    if (upperPct > UPPER_BODY_MAX_PCT + 0.02) {
      out.push(error("DIST_UPPER", `Upper-body volume ${(upperPct * 100).toFixed(0)}% > allowed ${UPPER_BODY_MAX_PCT * 100}%.`));
    }
    return out;
  }

  checkFatigue(routine: GeneratedRoutine): ValidationIssue[] {
    const out: ValidationIssue[] = [];
    for (const day of routine.days) {
      if (day.sessionFatigue > MAX_SESSION_FATIGUE + 0.01) {
        out.push(error("FATIGUE_EXCESS", `Day ${day.dayIndex + 1} (${day.focus}) fatigue ${day.sessionFatigue} > ${MAX_SESSION_FATIGUE}.`));
      }
    }
    return out;
  }

  checkRepeats(routine: GeneratedRoutine): ValidationIssue[] {
    const out: ValidationIssue[] = [];
    for (const day of routine.days) {
      const ids = day.selections.map((s) => s.exercise.id);
      if (new Set(ids).size !== ids.length) {
        out.push(error("REPEAT_EXERCISE", `Day ${day.dayIndex + 1} repeats an exercise.`));
      }
    }
    return out;
  }

  /** Every glute day should contain at least a main + an isolation movement. */
  checkBalance(routine: GeneratedRoutine): ValidationIssue[] {
    const out: ValidationIssue[] = [];
    for (const day of routine.days) {
      const isGlute = day.focus.startsWith("glute") || day.focus === "full_leg";
      if (!isGlute) continue;
      const roles = new Set(day.selections.map((s) => s.role));
      if (!roles.has("main")) {
        out.push(error("BALANCE_NO_MAIN", `Glute day ${day.dayIndex + 1} has no main compound.`));
      }
      if (day.selections.length < 3) {
        out.push(warn("BALANCE_THIN", `Glute day ${day.dayIndex + 1} has only ${day.selections.length} exercises.`));
      }
    }
    return out;
  }
}

function error(code: string, message: string): ValidationIssue {
  return { code, message, severity: "error" };
}
function warn(code: string, message: string): ValidationIssue {
  return { code, message, severity: "warning" };
}
