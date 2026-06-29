/**
 * Central, declarative business-rule tables for the LB Method.
 *
 * Keeping every magic number here (instead of scattered through the engine)
 * is the Single-Source-of-Truth that makes the system tunable without code
 * changes, and keeps the calculators/generators free of hardcoded constants.
 */
import type { ExperienceLevel, Goal, SelectionRole, TrainingMethod, TrainingMethodConfig } from "../../types";

/** Goals that use the pure LB Method glute split (hip thrust as main, 3+ glute days). */
export const GLUTE_PRIORITY_GOALS: ReadonlySet<Goal> = new Set<Goal>([
  "glute_hypertrophy",
  "glute_growth",
]);

export function isGlutePriorityGoal(goal: Goal): boolean {
  return GLUTE_PRIORITY_GOALS.has(goal);
}

/** Weekly glute set ranges per experience level (working sets). */
export const WEEKLY_GLUTE_SET_RANGE: Record<ExperienceLevel, { min: number; max: number }> = {
  beginner: { min: 12, max: 16 },
  intermediate: { min: 18, max: 24 },
  advanced: { min: 22, max: 30 },
};

/** Minimum weekly glute training frequency for priority goals. */
export const MIN_GLUTE_FREQUENCY = 3;

/** Volume distribution rules for glute-priority goals. */
export const LOWER_BODY_MIN_PCT = 0.6;
export const UPPER_BODY_MAX_PCT = 0.4;

/** Per-session systemic fatigue ceiling. */
export const MAX_SESSION_FATIGUE = 12;

/** Rep ranges by selection role (hypertrophy-oriented). */
export const REP_SCHEMES = {
  main: { repsMin: 6, repsMax: 10, sets: 4 },
  unilateral: { repsMin: 8, repsMax: 12, sets: 3 },
  isolation: { repsMin: 12, repsMax: 20, sets: 3 },
  accessory: { repsMin: 12, repsMax: 20, sets: 2 },
} as const;

/**
 * 4-week undulating mesocycle: intensity climbs (RIR falls) then deloads.
 * Week 4 cuts volume by 20% as required by the spec.
 */
export const MESOCYCLE: ReadonlyArray<{
  week: number;
  rir: number;
  volumeMultiplier: number;
  deload: boolean;
  notes: string;
}> = [
  { week: 1, rir: 3, volumeMultiplier: 1.0, deload: false, notes: "Accumulation — RIR 3, build technique & volume." },
  { week: 2, rir: 2, volumeMultiplier: 1.0, deload: false, notes: "Accumulation — RIR 2, add load or reps." },
  { week: 3, rir: 1, volumeMultiplier: 1.0, deload: false, notes: "Intensification — RIR 1, near-max effort." },
  { week: 4, rir: 4, volumeMultiplier: 0.8, deload: true, notes: "Deload — RIR 4, -20% volume, recover & supercompensate." },
];

// ---------------------------------------------------------------------------
// Training method catalogue — every method with its Spanish prescription
// ---------------------------------------------------------------------------

export const METHOD_CONFIGS: Record<TrainingMethod, TrainingMethodConfig> = {
  straight: {
    method: "straight", labelEs: "Series rectas",
    prescriptionNote: "Series rectas estándar.",
    restNote: "2 min entre series",
    isIntensityTechnique: false,
  },
  drop_set: {
    method: "drop_set", labelEs: "Drop Set",
    prescriptionNote: "Lleva al fallo, baja la carga ~25% y continúa hasta fallo. Sin descanso entre drops.",
    restNote: "2.5 min entre grupos de drop set",
    isIntensityTechnique: true,
  },
  rest_pause: {
    method: "rest_pause", labelEs: "Rest-Pause",
    prescriptionNote: "Lleva la serie al RIR indicado. Pausa 15-20 s (3-4 respiraciones) y continúa hasta fallo técnico.",
    restNote: "3 min entre series (incluye pausa intra-serie)",
    isIntensityTechnique: true,
  },
  myo_reps: {
    method: "myo_reps", labelEs: "Myo-Reps",
    prescriptionNote: "Serie de activación: 15-20 reps al RIR indicado. Luego 4-6 mini-series de 3-5 reps con 3 respiraciones de pausa.",
    restNote: "3-5 respiraciones entre mini-series · 2 min al terminar",
    isIntensityTechnique: true,
  },
  tempo: {
    method: "tempo", labelEs: "Tempo Controlado",
    prescriptionNote: "Excéntrico 3 s · Pausa 1 s en tensión máxima · Concéntrico 1 s · Pausa 0 s (3-1-1-0).",
    restNote: "90 s entre series (menor intensidad por tempo lento)",
    isIntensityTechnique: true,
  },
  pre_exhaust: {
    method: "pre_exhaust", labelEs: "Pre-Agotamiento",
    prescriptionNote: "Superset: ejecuta el ejercicio de aislamiento y, SIN descanso, pasa al compuesto. El músculo target llegará pre-fatigado al movimiento principal.",
    restNote: "0 s entre ejercicios del superset · 2.5 min entre rondas",
    isIntensityTechnique: true,
  },
  pyramid_ascending: {
    method: "pyramid_ascending", labelEs: "Pirámide Ascendente",
    prescriptionNote: "Series: 12→10→8→6 reps. Aumenta la carga en cada serie (~5-10%). Última serie cerca del fallo.",
    restNote: "2 min entre series",
    isIntensityTechnique: true,
  },
  pyramid_descending: {
    method: "pyramid_descending", labelEs: "Pirámide Inversa",
    prescriptionNote: "Primera serie: máximo peso (~85% 1RM), 5-6 reps. Reduce ~10% por serie aumentando reps (6→8→10→12). Mayor volumen total.",
    restNote: "3 min entre series (primer set demanda máxima)",
    isIntensityTechnique: true,
  },
  cluster_set: {
    method: "cluster_set", labelEs: "Cluster Set",
    prescriptionNote: "Haz 2-3 reps, descansa 10 s (sin soltar), haz 2-3 reps más. Repite hasta completar la meta de reps. Mantiene tensión mecánica máxima.",
    restNote: "2.5 min entre series (+ 10 s intra-serie)",
    isIntensityTechnique: true,
  },
  pause_reps: {
    method: "pause_reps", labelEs: "Reps con Pausa",
    prescriptionNote: "Pausa 2-3 s en el punto de máxima tensión muscular (ej. cadera abajo en hip thrust, rodilla flexionada en curl). Elimina el rebote.",
    restNote: "2 min entre series",
    isIntensityTechnique: true,
  },
  mechanical_drop: {
    method: "mechanical_drop", labelEs: "Drop Set Mecánico",
    prescriptionNote: "Al llegar al fallo con la variación difícil, cambia INMEDIATAMENTE a la variación más fácil del mismo músculo y continúa hasta fallo. Sin descanso.",
    restNote: "2.5 min entre grupos de mechanical drop",
    isIntensityTechnique: true,
  },
  giant_set: {
    method: "giant_set", labelEs: "Giant Set",
    prescriptionNote: "3 ejercicios del mismo músculo consecutivos sin descanso. Maximize el estrés metabólico y el tiempo bajo tensión total.",
    restNote: "2 min después de completar los 3 ejercicios",
    isIntensityTechnique: true,
  },
};

/**
 * Probability of applying an intensity technique (non-straight method)
 * per week number and experience level. Week 1 and deload = 0 always.
 */
export const METHOD_TECHNIQUE_PROBABILITY: Record<ExperienceLevel, Record<number, number>> = {
  beginner:     { 1: 0, 2: 0,    3: 0.15, 4: 0 },
  intermediate: { 1: 0, 2: 0.30, 3: 0.50, 4: 0 },
  advanced:     { 1: 0, 2: 0.45, 3: 0.65, 4: 0 },
};

/**
 * Candidate methods per exercise role, organized by which weeks they unlock.
 * Only includes evidence-based methods appropriate for each role.
 */
export const ROLE_METHOD_CANDIDATES: Record<SelectionRole, {
  week2: TrainingMethod[];
  week3: TrainingMethod[];
}> = {
  main: {
    week2: ["rest_pause", "pause_reps", "pyramid_ascending"],
    week3: ["rest_pause", "pause_reps", "pyramid_ascending", "cluster_set", "pyramid_descending"],
  },
  unilateral: {
    week2: ["tempo", "rest_pause"],
    week3: ["tempo", "rest_pause", "pause_reps"],
  },
  isolation: {
    week2: ["drop_set", "myo_reps", "tempo"],
    week3: ["drop_set", "myo_reps", "tempo", "mechanical_drop"],
  },
  accessory: {
    week2: ["drop_set", "myo_reps"],
    week3: ["drop_set", "myo_reps", "giant_set"],
  },
};

/** Fat-loss / muscle-gain are not glute-priority; they still skew lower for women here. */
export const GOAL_LOWER_BODY_BIAS: Record<Goal, number> = {
  glute_hypertrophy: 0.7,
  glute_growth: 0.7,
  lower_body_focus: 0.75,
  body_recomposition: 0.65,
  fat_loss: 0.6,
  muscle_gain: 0.55,
  general_health: 0.5,  // 50/50 cuerpo completo
};
