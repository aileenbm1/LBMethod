/**
 * LBMethodEngine — core domain types.
 *
 * These types are framework-agnostic: the rule engine depends only on them,
 * never on Prisma or Express. This keeps the engine pure and unit-testable.
 */

export type Goal =
  | "glute_hypertrophy"
  | "glute_growth"
  | "lower_body_focus"
  | "fat_loss"
  | "body_recomposition"
  | "muscle_gain";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type MovementPattern =
  | "hip_thrust"
  | "hip_hinge"
  | "knee_dominant"
  | "abduction"
  | "unilateral"
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "core";

export type ExerciseCategory = "compound" | "unilateral" | "isolation" | "accessory";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "smith"
  | "bodyweight"
  | "band"
  | "kettlebell";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type DayFocus =
  | "glute_hamstring"
  | "glute_quad"
  | "glute_specialization"
  | "glute_heavy"
  | "glute_metabolic"
  | "upper_body"
  | "back_shoulder"
  | "back_biceps"
  | "shoulder_triceps"
  | "chest_triceps"
  | "full_leg"
  | "legs_push"
  | "rest";

export type SelectionRole = "main" | "unilateral" | "isolation" | "accessory";

export type TrainingLocation = "gym" | "home";
export type Gender = "female" | "male" | "unspecified";
export type SessionDuration = 45 | 60 | 75 | 90;

export const HOME_EQUIPMENT: Equipment[] = ["bodyweight", "barbell", "dumbbell", "band", "kettlebell"];
export const SESSION_MAX_EXERCISES: Record<SessionDuration, number> = { 45: 3, 60: 4, 75: 5, 90: 6 };

/**
 * Training intensity techniques applied to individual exercises.
 * "straight" = traditional straight sets (always valid baseline).
 * Other methods are applied strategically based on goal, level, week, and role.
 */
export type TrainingMethod =
  | "straight"
  | "drop_set"           // reduce carga ~25% y continúa hasta falla
  | "rest_pause"         // pausa 15-20s intra-serie, continúa con más reps
  | "myo_reps"           // activación + mini-series de 3-5 reps
  | "tempo"              // excéntrico controlado (ej. 3-1-1-0)
  | "pre_exhaust"        // superset: aislamiento → compuesto sin descanso
  | "pyramid_ascending"  // series: peso ↑, reps ↓ (12-10-8-6)
  | "pyramid_descending" // reverse pyramid: 1er set máximo, luego más ligero
  | "cluster_set"        // micro-descansos de 10s intra-serie
  | "pause_reps"         // 2-3s pausa isométrica en punto de máxima tensión
  | "mechanical_drop"    // mismo músculo, variación más fácil inmediatamente
  | "giant_set";         // 3+ ejercicios seguidos sin descanso (mismo músculo)

export interface TrainingMethodConfig {
  method: TrainingMethod;
  labelEs: string;
  prescriptionNote: string;   // instrucción concisa para mostrar en la rutina
  restNote: string;           // tiempo de descanso recomendado
  isIntensityTechnique: boolean;
}

/** The five biomechanical glute classifications used for selection logic. */
export type GlutePattern =
  | "hip_thrust"
  | "hip_hinge"
  | "knee_dominant"
  | "abduction"
  | "unilateral";

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  movementPattern: MovementPattern;
  category: ExerciseCategory;
  equipment: Equipment;
  difficulty: Difficulty;
  activationScore: number;
  fatigueScore: number;
  stabilityRequirement: number;
  unilateral: boolean;
  primaryMuscle: string;
  secondaryMuscles: string[];
  imageUrl?: string;
  videoUrl?: string;
}

export type LimitationSeverity = "mild" | "moderate" | "severe";

export interface WeakPoint {
  muscleGroup: string;
  /** 1 = leve, 2 = moderado, 3 = prioritario */
  priority: 1 | 2 | 3;
}

export interface Limitation {
  description: string;
  affectedPatterns: MovementPattern[];
  severity: LimitationSeverity;
}

export interface BodyMeasurements {
  heightCm?: number;
  bodyFatPct?: number;
  hipCm?: number;
  waistCm?: number;
  thighCm?: number;
}

export interface UserProfile {
  id?: string;
  email?: string;
  name?: string;
  goal: Goal;
  experienceLevel: ExperienceLevel;
  daysPerWeek: number;
  gender?: Gender;
  sessionDuration?: SessionDuration;
  trainingLocation?: TrainingLocation;
  bodyweightKg?: number;
  /** Edad en años. Afecta recuperación y volumen para 45+. */
  age?: number;
  /** Meses entrenando. Refina el volumen dentro del nivel declarado. */
  monthsTrained?: number;
  /** Equipamiento disponible (relevante para entreno en casa). */
  homeEquipment?: Equipment[];
  measurements?: BodyMeasurements;
  weakPoints?: WeakPoint[];
  limitations?: Limitation[];
  notes?: string;
}

export interface VolumePlan {
  weeklyGluteSets: number;
  weeklyQuadSets: number;
  weeklyHamstringSets: number;
  weeklyUpperSets: number;
  lowerVolumePct: number;
  upperVolumePct: number;
  gluteFrequency: number;
}

export interface DayTemplate {
  dayIndex: number;
  focus: DayFocus;
  /** Primary muscle groups trained, used by the selector + balance validator. */
  emphasis: string[];
  isGluteDay: boolean;
}

export interface SelectedExercise {
  exercise: Exercise;
  role: SelectionRole;
  sets: number;
  repsMin: number;
  repsMax: number;
  rir: number;
  order: number;
  method: TrainingMethod;
  methodConfig: TrainingMethodConfig;
}

export interface GeneratedDay {
  dayIndex: number;
  focus: DayFocus;
  selections: SelectedExercise[];
  sessionFatigue: number;
  totalSets: number;
}

export interface ProgressionWeek {
  week: number;
  rir: number;
  volumeMultiplier: number;
  deload: boolean;
  notes: string;
}

export interface GeneratedRoutine {
  goal: Goal;
  level: ExperienceLevel;
  daysPerWeek: number;
  weekNumber: number;
  rir: number;
  deload: boolean;
  volume: VolumePlan;
  days: GeneratedDay[];
  /** Stable signature of the weekly exercise combination (anti-repeat). */
  signature: string;
}

export interface GeneratedProgram {
  goal: Goal;
  level: ExperienceLevel;
  daysPerWeek: number;
  totalWeeks: number;
  progression: ProgressionWeek[];
  weeks: GeneratedRoutine[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface GenerateOptions {
  /** Previously used weekly signatures to avoid repeating combinations. */
  usedSignatures?: string[];
  /** Deterministic seed for reproducible generation in tests. */
  seed?: number;
  weekNumber?: number;
  /**
   * Multiplicador de volumen basado en feedback del asesorado.
   * < 1 = reducir volumen (sesiones muy duras), > 1 = aumentar (demasiado fácil).
   * Rango recomendado: 0.80 – 1.15
   */
  volumeBias?: number;
}
