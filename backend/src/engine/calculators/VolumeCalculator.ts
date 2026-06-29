/**
 * VolumeCalculator
 *
 * Translates (goal, level, daysPerWeek) into a concrete weekly VolumePlan:
 * weekly set counts per region and the lower/upper distribution that the
 * hypertrophy rules require. Single Responsibility: it only computes volume,
 * it never selects exercises.
 */
import type { ExperienceLevel, Gender, Goal, VolumePlan, WeakPoint } from "../../types";
import {
  GOAL_LOWER_BODY_BIAS,
  LOWER_BODY_MIN_PCT,
  MIN_GLUTE_FREQUENCY,
  UPPER_BODY_MAX_PCT,
  WEEKLY_GLUTE_SET_RANGE,
  isGlutePriorityGoal,
} from "../rules/businessRules";

export class VolumeCalculator {
  /**
   * @param volumeMultiplier deload / progression multiplier (e.g. 0.8 on deload week).
   * @param weakPoints muscle groups that need extra volume (from client profile).
   */
  calculate(
    goal: Goal,
    level: ExperienceLevel,
    daysPerWeek: number,
    volumeMultiplier = 1,
    weakPoints: WeakPoint[] = [],
    gender: Gender = "unspecified",
    age?: number,
    monthsTrained?: number,
  ): VolumePlan {
    // Ajuste por edad: 45–54 → -10%, 55+ → -20% (mayor tiempo de recuperación)
    let ageBias = 1.0;
    if (age && age >= 55) ageBias = 0.80;
    else if (age && age >= 45) ageBias = 0.90;

    // Ajuste por historial dentro del mismo nivel declarado
    // Menos meses → menos volumen; más meses → puede tolerar más
    let monthsBias = 1.0;
    if (monthsTrained !== undefined) {
      if (monthsTrained < 3)  monthsBias = 0.80;   // muy nuevo
      else if (monthsTrained < 6)  monthsBias = 0.90;
      else if (monthsTrained < 12) monthsBias = 1.00;
      else if (monthsTrained < 24) monthsBias = 1.05;
      else                         monthsBias = 1.10; // 2+ años
    }

    const adjustedMultiplier = volumeMultiplier * ageBias * monthsBias;

    // Para hombres: menos sets de glúteo, distribución más balanceada
    if (gender === "male") return this.calculateMale(level, daysPerWeek, adjustedMultiplier, weakPoints);

    const range = WEEKLY_GLUTE_SET_RANGE[level];

    // Position within the level's range scales with weekly frequency: more days
    // → more recoverable volume → closer to the top of the band.
    const gluteDays = this.estimateGluteDays(goal, daysPerWeek);
    const span = range.max - range.min;
    const freqFactor = Math.min(1, (gluteDays - 1) / 4); // 1 day -> 0, 5 days -> 1
    let weeklyGluteSets = Math.round((range.min + span * freqFactor) * adjustedMultiplier);

    // Punto débil: glutes → boost directo en glute sets (máx +4 sets por prioridad)
    const gluteWeak = weakPoints.find((wp) =>
      ["glutes", "glute_medius", "glute_minimus"].includes(wp.muscleGroup),
    );
    if (gluteWeak) weeklyGluteSets = Math.min(range.max, weeklyGluteSets + gluteWeak.priority * 2);

    // Glutes get the priority share of lower-body volume; quads + hams split the rest.
    const lowerBias = isGlutePriorityGoal(goal) ? Math.max(LOWER_BODY_MIN_PCT, GOAL_LOWER_BODY_BIAS[goal]) : GOAL_LOWER_BODY_BIAS[goal];

    let weeklyQuadSets = Math.round(weeklyGluteSets * 0.5);
    let weeklyHamstringSets = Math.round(weeklyGluteSets * 0.45);

    // Boost para grupos débiles secundarios (máx +3 sets por prioridad)
    const quadWeak = weakPoints.find((wp) => wp.muscleGroup === "quadriceps");
    if (quadWeak) weeklyQuadSets += quadWeak.priority * 2;

    const hamWeak = weakPoints.find((wp) => wp.muscleGroup === "hamstrings");
    if (hamWeak) weeklyHamstringSets += hamWeak.priority * 2;

    const lowerSets = weeklyGluteSets + weeklyQuadSets + weeklyHamstringSets;

    // Derive upper-body volume from the desired lower/upper split.
    const upperPct = isGlutePriorityGoal(goal)
      ? Math.min(UPPER_BODY_MAX_PCT, 1 - lowerBias)
      : 1 - lowerBias;
    const lowerPct = 1 - upperPct;

    // lowerSets = total * lowerPct  =>  total = lowerSets / lowerPct
    const totalSets = lowerSets / lowerPct;
    const weeklyUpperSets = Math.max(0, Math.round(totalSets - lowerSets));

    const finalTotal = lowerSets + weeklyUpperSets;

    return {
      weeklyGluteSets,
      weeklyQuadSets,
      weeklyHamstringSets,
      weeklyUpperSets,
      lowerVolumePct: round2(lowerSets / finalTotal),
      upperVolumePct: round2(weeklyUpperSets / finalTotal),
      gluteFrequency: gluteDays,
    };
  }

  /**
   * Cálculo de volumen para hombres: distribución 50/50 tren inferior/superior,
   * menos sets de glúteo y más énfasis en cuádriceps y tren superior.
   */
  private calculateMale(
    level: ExperienceLevel,
    daysPerWeek: number,
    volumeMultiplier = 1,
    weakPoints: WeakPoint[] = [],
  ): VolumePlan {
    const MALE_WEEKLY_SETS: Record<ExperienceLevel, { min: number; max: number }> = {
      beginner:     { min: 10, max: 14 },
      intermediate: { min: 14, max: 20 },
      advanced:     { min: 18, max: 26 },
    };
    const range = MALE_WEEKLY_SETS[level];
    const freqFactor = Math.min(1, (daysPerWeek - 3) / 3);
    const totalWeeklySets = Math.round((range.min + (range.max - range.min) * freqFactor) * volumeMultiplier);

    // Distribución: 50% inferior / 50% superior (hombres balanceado)
    const lowerSets  = Math.round(totalWeeklySets * 0.50);
    const upperSets  = totalWeeklySets - lowerSets;

    // Dentro del tren inferior: cuád 40%, isquio 35%, glúteo 25%
    let weeklyQuadSets      = Math.round(lowerSets * 0.40);
    let weeklyHamstringSets = Math.round(lowerSets * 0.35);
    let weeklyGluteSets     = lowerSets - weeklyQuadSets - weeklyHamstringSets;

    // Boost puntos débiles
    const quadWeak = weakPoints.find(w => w.muscleGroup === "quadriceps");
    if (quadWeak) weeklyQuadSets += quadWeak.priority;
    const hamWeak = weakPoints.find(w => w.muscleGroup === "hamstrings");
    if (hamWeak) weeklyHamstringSets += hamWeak.priority;

    const finalLower = weeklyGluteSets + weeklyQuadSets + weeklyHamstringSets;
    const finalTotal = finalLower + upperSets;

    return {
      weeklyGluteSets,
      weeklyQuadSets,
      weeklyHamstringSets,
      weeklyUpperSets: upperSets,
      lowerVolumePct: round2(finalLower / finalTotal),
      upperVolumePct: round2(upperSets / finalTotal),
      gluteFrequency: Math.round(daysPerWeek / 3),
    };
  }

  /** Glute training days implied by the split for the given day count. */
  estimateGluteDays(goal: Goal, daysPerWeek: number): number {
    if (!isGlutePriorityGoal(goal)) {
      // Non-priority goals still hit glutes, but fewer dedicated days.
      return Math.max(2, Math.min(daysPerWeek - 1, Math.round(daysPerWeek / 2)));
    }
    switch (daysPerWeek) {
      case 3:
        return 2; // 3-day split has 2 glute days + 1 upper
      case 4:
        return 3;
      case 5:
        return 3;
      case 6:
        return 4;
      default:
        return Math.max(MIN_GLUTE_FREQUENCY, Math.min(daysPerWeek, 3));
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
