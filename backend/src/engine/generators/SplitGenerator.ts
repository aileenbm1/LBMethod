/**
 * SplitGenerator
 *
 * Routing logic:
 *   glute_hypertrophy | glute_growth  → PRIORITY_SPLITS  (método glúteo puro LB)
 *   lower_body_focus                  → LOWER_BODY_SPLITS (tren inferior balanceado)
 *   fat_loss | body_recomposition     → METABOLIC_SPLITS  (full body / metabólico)
 *   muscle_gain                       → GENERAL_SPLITS    (upper-lower / PPL neutro)
 *   gender === "male"                 → MALE_SPLITS       (Push/Pull/Legs)
 *
 * focusMuscle (priority-3 weakPoint) añade un día extra para ese músculo.
 */
import type { DayFocus, DayTemplate, Gender, Goal } from "../../types";
import { isGlutePriorityGoal } from "../rules/businessRules";

const GLUTE_FOCI: ReadonlySet<DayFocus> = new Set<DayFocus>([
  "glute_hamstring", "glute_quad", "glute_specialization", "glute_heavy", "glute_metabolic",
]);

// ── Splits femeninos / neutrales ──────────────────────────────────────────────

/** Método glúteo puro — solo para glute_hypertrophy y glute_growth. */
const PRIORITY_SPLITS: Record<number, DayFocus[]> = {
  3: ["glute_hamstring", "upper_body", "glute_quad"],
  4: ["glute_hamstring", "upper_body", "glute_quad", "glute_specialization"],
  5: ["glute_hamstring", "back_shoulder", "glute_quad", "upper_body", "glute_specialization"],
  6: ["glute_heavy", "back_biceps", "glute_quad", "shoulder_triceps", "glute_metabolic", "full_leg"],
};

/** Tren inferior completo — lower_body_focus (glúteo + cuádriceps + isquio equilibrados). */
const LOWER_BODY_SPLITS: Record<number, DayFocus[]> = {
  3: ["legs_push", "glute_hamstring", "upper_body"],
  4: ["legs_push", "glute_hamstring", "glute_quad", "upper_body"],
  5: ["legs_push", "glute_hamstring", "glute_quad", "upper_body", "back_shoulder"],
  6: ["legs_push", "glute_hamstring", "glute_quad", "upper_body", "back_biceps", "full_leg"],
};

/** Metabólico / full-body — fat_loss y body_recomposition. */
const METABOLIC_SPLITS: Record<number, DayFocus[]> = {
  3: ["full_leg", "upper_body", "glute_hamstring"],
  4: ["full_leg", "upper_body", "glute_hamstring", "back_shoulder"],
  5: ["full_leg", "upper_body", "glute_hamstring", "back_shoulder", "legs_push"],
  6: ["full_leg", "upper_body", "glute_hamstring", "chest_triceps", "back_biceps", "legs_push"],
};

/** Hipertrofia general — muscle_gain y cualquier objetivo sin categoría. */
const GENERAL_SPLITS: Record<number, DayFocus[]> = {
  3: ["upper_body", "full_leg", "back_shoulder"],
  4: ["chest_triceps", "back_biceps", "full_leg", "upper_body"],
  5: ["chest_triceps", "back_biceps", "full_leg", "upper_body", "shoulder_triceps"],
  6: ["chest_triceps", "back_biceps", "full_leg", "shoulder_triceps", "back_shoulder", "full_leg"],
};

// ── Splits masculinos (PPL) ───────────────────────────────────────────────────

const MALE_SPLITS: Record<number, DayFocus[]> = {
  3: ["chest_triceps", "back_biceps", "legs_push"],
  4: ["chest_triceps", "back_biceps", "legs_push", "shoulder_triceps"],
  5: ["chest_triceps", "back_biceps", "legs_push", "upper_body", "shoulder_triceps"],
  6: ["chest_triceps", "back_biceps", "legs_push", "chest_triceps", "back_biceps", "legs_push"],
};

// ── Enfoque muscular: día preferido por músculo ───────────────────────────────

const MUSCLE_TO_DAY_FOCUS: Record<string, DayFocus | null> = {
  chest:        "chest_triceps",
  triceps:      "chest_triceps",
  back:         "back_biceps",
  biceps:       "back_biceps",
  shoulders:    "shoulder_triceps",
  quadriceps:   "legs_push",
  hamstrings:   "glute_hamstring",
  glutes:       null,   // ya cubierto por objetivo
  glute_medius: null,
  upper_body:   null,   // balanced, sin día extra
  core:         null,
};

const REPLACEABLE_DAYS: DayFocus[] = [
  "shoulder_triceps", "upper_body", "back_shoulder", "glute_specialization", "glute_metabolic",
];

// ── Énfasis por tipo de día ───────────────────────────────────────────────────

const EMPHASIS: Record<DayFocus, string[]> = {
  glute_hamstring:     ["glutes", "hamstrings"],
  glute_quad:          ["glutes", "quadriceps"],
  glute_specialization:["glutes"],
  glute_heavy:         ["glutes", "hamstrings"],
  glute_metabolic:     ["glutes"],
  upper_body:          ["back", "chest", "shoulders"],
  back_shoulder:       ["back", "shoulders"],
  back_biceps:         ["back", "biceps"],
  shoulder_triceps:    ["shoulders", "triceps"],
  chest_triceps:       ["chest", "triceps"],
  full_leg:            ["glutes", "quadriceps", "hamstrings"],
  legs_push:           ["quadriceps", "hamstrings", "glutes"],
  rest:                [],
};

// ── Clase principal ───────────────────────────────────────────────────────────

export class SplitGenerator {
  generate(goal: Goal, daysPerWeek: number, gender: Gender = "unspecified", focusMuscle?: string): DayTemplate[] {
    const days = clamp(daysPerWeek, 3, 6);

    let foci: DayFocus[];

    if (gender === "male") {
      foci = MALE_SPLITS[days] ?? MALE_SPLITS[4];
    } else if (isGlutePriorityGoal(goal)) {
      // Método glúteo puro: solo glute_hypertrophy y glute_growth
      foci = PRIORITY_SPLITS[days] ?? PRIORITY_SPLITS[4];
    } else if (goal === "lower_body_focus") {
      foci = LOWER_BODY_SPLITS[days] ?? LOWER_BODY_SPLITS[4];
    } else if (goal === "fat_loss" || goal === "body_recomposition") {
      foci = METABOLIC_SPLITS[days] ?? METABOLIC_SPLITS[4];
    } else {
      // muscle_gain y cualquier otro → hipertrofia general
      foci = GENERAL_SPLITS[days] ?? GENERAL_SPLITS[4];
    }

    // Aplicar enfoque muscular: añadir un día extra para el músculo prioritario (4+ días)
    if (focusMuscle && days >= 4) {
      foci = this.applyMuscusFocus(foci, focusMuscle);
    }

    return foci.map((focus, i) => ({
      dayIndex: i,
      focus,
      emphasis: EMPHASIS[focus],
      isGluteDay: GLUTE_FOCI.has(focus),
    }));
  }

  private applyMuscusFocus(foci: DayFocus[], focusMuscle: string): DayFocus[] {
    const targetDay = MUSCLE_TO_DAY_FOCUS[focusMuscle];
    if (!targetDay) return foci;

    const result = [...foci];
    for (const replaceable of REPLACEABLE_DAYS) {
      const idx = result.indexOf(replaceable);
      if (idx !== -1 && replaceable !== targetDay) {
        result[idx] = targetDay;
        return result;
      }
    }
    return result;
  }

  gluteFrequency(goal: Goal, daysPerWeek: number, gender: Gender = "unspecified"): number {
    return this.generate(goal, daysPerWeek, gender).filter((d) => d.isGluteDay).length;
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
