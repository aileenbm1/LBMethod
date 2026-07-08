/**
 * ExerciseSelector
 *
 * Given a day template and the exercise library, selects the exercises for that
 * session. Every glute day is built from the LB Method skeleton:
 *
 *   1 main compound · 1 unilateral · 1 isolation · 1 optional accessory
 *
 * Selection is fatigue-aware (never breaches the session ceiling) and uses a
 * seeded RNG so the same inputs reproduce, while different seeds yield the
 * thousands of distinct-but-valid combinations the spec requires.
 */
import type {
  DayTemplate,
  Difficulty,
  Equipment,
  Exercise,
  ExperienceLevel,
  Goal,
  Limitation,
  MovementPattern,
  SelectedExercise,
  WeakPoint,
} from "../../types";
import { METHOD_CONFIGS, REP_SCHEMES } from "../rules/businessRules";
import { Rng } from "../rules/rng";
import { FatigueEngine } from "../services/FatigueEngine";
import { MethodSelector } from "../services/MethodSelector";

const DIFFICULTY_RANK: Record<Difficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

/**
 * Bodyweight exercises that still belong in a gym because they rely on apparatus
 * (pull-up bar, dip station, hyperextension bench, hanging bar, etc.). Every other
 * bodyweight exercise is floor calisthenics (push-ups, planks, jump squats…) and is
 * filtered out when the client trains at a gym.
 */
const GYM_BODYWEIGHT_ALLOWED = new Set<string>([
  "single-leg-hip-thrust",
  "hyperextension-glute",
  "nordic-curl",
  "pull-up",
  "chin-up",
  "inverted-row",
  "dips",
  "hanging-leg-raise",
]);

/** Main-lift movement pattern preference per glute day focus. */
const MAIN_PATTERN_BY_FOCUS: Record<string, MovementPattern[]> = {
  glute_hamstring: ["hip_hinge", "hip_thrust"],
  glute_quad: ["knee_dominant", "hip_thrust"],
  glute_specialization: ["hip_thrust", "hip_hinge"],
  glute_heavy: ["hip_thrust", "hip_hinge", "knee_dominant"],
  glute_metabolic: ["hip_thrust", "abduction"],
  full_leg: ["knee_dominant", "hip_hinge"],
};

export class ExerciseSelector {
  private readonly methodSelector = new MethodSelector();

  constructor(private readonly fatigue: FatigueEngine) {}

  /**
   * Select exercises for one day.
   * @param setScale    progression / deload multiplier applied to set counts.
   * @param limitations movement patterns to exclude (injuries).
   * @param weakPoints  muscle groups that need extra accessory attention.
   * @param goal        client goal (drives method selection weighting).
   * @param weekNumber  mesocycle week (1-4) for method unlocking.
   * @param deload      whether this is a deload week (forces straight sets).
   */
  selectForDay(
    template: DayTemplate,
    library: Exercise[],
    level: ExperienceLevel,
    rng: Rng,
    setScale = 1,
    limitations: Limitation[] = [],
    weakPoints: WeakPoint[] = [],
    goal: Goal = "glute_hypertrophy",
    weekNumber = 1,
    deload = false,
    allowedEquipment?: Equipment[],
    maxExercisesPerDay?: number,
    gymOnly = false,
  ): SelectedExercise[] {
    const blockedPatterns = this.blockedPatterns(limitations);
    const eligible = library.filter(
      (e) =>
        DIFFICULTY_RANK[e.difficulty] <= DIFFICULTY_RANK[level] &&
        !blockedPatterns.has(e.movementPattern) &&
        (!allowedEquipment || allowedEquipment.includes(e.equipment)) &&
        // En gimnasio, descarta calistenia de piso; conserva bodyweight con aparato.
        (!gymOnly || e.equipment !== "bodyweight" || GYM_BODYWEIGHT_ALLOWED.has(e.id)),
    );
    const result = template.isGluteDay
      ? this.buildGluteDay(template, eligible, rng, setScale, weakPoints, goal, level, weekNumber, deload)
      : this.buildSupportDay(template, eligible, rng, setScale, weakPoints, goal, level, weekNumber, deload);
    return maxExercisesPerDay ? result.slice(0, maxExercisesPerDay) : result;
  }

  /** Patterns blocked by moderate or severe limitations. */
  private blockedPatterns(limitations: Limitation[]): Set<MovementPattern> {
    const blocked = new Set<MovementPattern>();
    for (const lim of limitations) {
      if (lim.severity === "mild") continue;
      for (const p of lim.affectedPatterns) blocked.add(p);
    }
    return blocked;
  }

  // ---- Glute day skeleton -------------------------------------------------

  private buildGluteDay(
    template: DayTemplate,
    library: Exercise[],
    rng: Rng,
    setScale: number,
    weakPoints: WeakPoint[] = [],
    goal: Goal = "glute_hypertrophy",
    level: ExperienceLevel = "intermediate",
    weekNumber = 1,
    deload = false,
  ): SelectedExercise[] {
    const selections: SelectedExercise[] = [];
    const used = new Set<string>();
    let order = 0;

    const mainPatterns = MAIN_PATTERN_BY_FOCUS[template.focus] ?? ["hip_thrust", "hip_hinge"];

    // 1) Main compound — highest activation among preferred patterns.
    const main = this.bestOf(
      this.pool(library, { patterns: mainPatterns, category: "compound", muscle: "glutes" }),
      used, rng,
    );
    if (main) this.push(selections, main, "main", setScale, ++order, used, goal, level, weekNumber, deload, rng);

    // 2) Unilateral — single-leg stimulus + symmetry.
    const uni = this.bestOf(
      this.pool(library, { unilateral: true, muscle: "glutes" }),
      used, rng,
    );
    if (uni) this.push(selections, uni, "unilateral", setScale, ++order, used, goal, level, weekNumber, deload, rng);

    // 3) Isolation — abduction / direct glute medius/min work.
    const iso = this.bestOf(
      this.pool(library, { patterns: ["abduction"], muscle: "glutes" }),
      used, rng,
    );
    if (iso) this.push(selections, iso, "isolation", setScale, ++order, used, goal, level, weekNumber, deload, rng);

    // Accessory: priorizar punto débil si hay uno que aplique al día,
    // si no, seguir lógica normal por foco del día.
    const weakAccessoryMuscle = this.weakMuscleForDay(template.focus, weakPoints);
    const accessoryMuscle = weakAccessoryMuscle
      ?? (template.focus === "glute_quad" ? "quadriceps" : template.focus === "glute_hamstring" ? "hamstrings" : "glutes");
    const accessory = this.bestOf(
      this.pool(library, { category: "accessory", muscle: accessoryMuscle }).concat(
        this.pool(library, { category: "isolation", muscle: accessoryMuscle }),
      ),
      used,
      rng,
    );
    if (accessory && this.fatigue.canAdd(selections, accessory, scaledSets("accessory", setScale))) {
      this.push(selections, accessory, "accessory", setScale, ++order, used, goal, level, weekNumber, deload, rng);
    }

    return selections;
  }

  /** Músculo débil relevante para días de glúteo. */
  private weakMuscleForDay(focus: string, weakPoints: WeakPoint[]): string | undefined {
    if (weakPoints.length === 0) return undefined;
    const MAP: Record<string, string[]> = {
      glute_hamstring:    ["hamstrings", "glutes", "glute_medius", "glute_minimus"],
      glute_quad:         ["quadriceps", "glutes", "glute_medius", "glute_minimus"],
      glute_specialization: ["glutes", "glute_medius", "glute_minimus"],
      glute_heavy:        ["glutes", "hamstrings", "glute_medius", "glute_minimus"],
      glute_metabolic:    ["glutes", "glute_medius", "glute_minimus"],
      full_leg:           ["quadriceps", "hamstrings", "glutes", "calves"],
    };
    const relevant = MAP[focus] ?? [];
    const sorted = [...weakPoints].sort((a, b) => b.priority - a.priority);
    return sorted.find((wp) => relevant.includes(wp.muscleGroup))?.muscleGroup;
  }

  /** Músculo débil relevante para días de soporte (PPL masculino). */
  private weakMuscleForSupportDay(focus: string, weakPoints: WeakPoint[]): string | undefined {
    if (weakPoints.length === 0) return undefined;
    const MAP: Record<string, string[]> = {
      chest_triceps:   ["chest", "triceps"],
      back_biceps:     ["back", "biceps"],
      shoulder_triceps:["shoulders", "triceps"],
      upper_body:      ["chest", "back", "shoulders"],
      back_shoulder:   ["back", "shoulders"],
      full_leg:        ["quadriceps", "hamstrings", "calves"],
      legs_push:       ["quadriceps", "hamstrings", "calves"],
    };
    const relevant = MAP[focus] ?? [];
    const sorted = [...weakPoints].sort((a, b) => b.priority - a.priority);
    return sorted.find((wp) => relevant.includes(wp.muscleGroup))?.muscleGroup;
  }

  // ---- Support (upper / back / shoulder / PPL) days -----------------------

  private buildSupportDay(
    template: DayTemplate,
    library: Exercise[],
    rng: Rng,
    setScale: number,
    weakPoints: WeakPoint[] = [],
    goal: Goal = "glute_hypertrophy",
    level: ExperienceLevel = "intermediate",
    weekNumber = 1,
    deload = false,
  ): SelectedExercise[] {
    const selections: SelectedExercise[] = [];
    const used = new Set<string>();
    let order = 0;

    for (const muscle of template.emphasis) {
      const compound = this.bestOf(this.pool(library, { category: "compound", muscle }), used, rng);
      if (compound && this.fatigue.canAdd(selections, compound, scaledSets("main", setScale))) {
        this.push(selections, compound, "main", setScale, ++order, used, goal, level, weekNumber, deload, rng);
      }
      const isolation = this.bestOf(this.pool(library, { category: "isolation", muscle }), used, rng);
      if (isolation && this.fatigue.canAdd(selections, isolation, scaledSets("isolation", setScale))) {
        this.push(selections, isolation, "isolation", setScale, ++order, used, goal, level, weekNumber, deload, rng);
      }
    }

    // Accesorio: priorizar músculo en enfoque si es relevante para este día
    const focusMuscle = this.weakMuscleForSupportDay(template.focus, weakPoints);
    if (focusMuscle) {
      const accessory = this.bestOf(
        this.pool(library, { category: "accessory", muscle: focusMuscle })
          .concat(this.pool(library, { category: "isolation", muscle: focusMuscle })),
        used, rng,
      );
      if (accessory && this.fatigue.canAdd(selections, accessory, scaledSets("accessory", setScale))) {
        this.push(selections, accessory, "accessory", setScale, ++order, used, goal, level, weekNumber, deload, rng);
      }
    }
    return selections;
  }

  // ---- Helpers ------------------------------------------------------------

  private pool(
    library: Exercise[],
    filter: {
      patterns?: MovementPattern[];
      category?: Exercise["category"];
      muscle?: string;
      unilateral?: boolean;
    },
  ): Exercise[] {
    return library.filter((e) => {
      if (filter.patterns && !filter.patterns.includes(e.movementPattern)) return false;
      if (filter.category && e.category !== filter.category) return false;
      if (filter.unilateral !== undefined && e.unilateral !== filter.unilateral) return false;
      if (filter.muscle) {
        const hit =
          e.primaryMuscle === filter.muscle ||
          e.muscleGroup === filter.muscle ||
          e.secondaryMuscles.includes(filter.muscle);
        if (!hit) return false;
      }
      return true;
    });
  }

  /**
   * Pick from a candidate pool: shuffle (seeded variety) then take the highest
   * activation that hasn't been used yet. This balances "always good" with
   * "never identical week to week".
   */
  private bestOf(pool: Exercise[], used: Set<string>, rng: Rng): Exercise | undefined {
    const fresh = pool.filter((e) => !used.has(e.id));
    if (fresh.length === 0) return undefined;
    // Keep the top tier by activation, then randomly pick within it.
    const sorted = fresh.slice().sort((a, b) => b.activationScore - a.activationScore);
    const topTier = sorted.filter((e) => e.activationScore >= sorted[0].activationScore - 1.5);
    return rng.pick(rng.shuffle(topTier));
  }

  private push(
    selections: SelectedExercise[],
    exercise: Exercise,
    role: SelectedExercise["role"],
    setScale: number,
    order: number,
    used: Set<string>,
    goal: Goal = "glute_hypertrophy",
    level: ExperienceLevel = "intermediate",
    weekNumber = 1,
    deload = false,
    rng?: Rng,
  ): void {
    const scheme = REP_SCHEMES[role];
    const { method, config } = rng
      ? this.methodSelector.select(role, level, goal, weekNumber, deload, rng)
      : { method: "straight" as const, config: METHOD_CONFIGS.straight };

    // Some methods adjust rep ranges to fit their prescription.
    let repsMin: number = scheme.repsMin;
    let repsMax: number = scheme.repsMax;
    if (method === "pyramid_ascending") { repsMin = 6; repsMax = 12; }
    if (method === "pyramid_descending") { repsMin = 5; repsMax = 12; }
    if (method === "cluster_set") { repsMin = scheme.repsMin; repsMax = scheme.repsMax; }
    if (method === "myo_reps") { repsMin = 15; repsMax = 20; }
    if (method === "tempo") { repsMin = scheme.repsMin; repsMax = Math.min(scheme.repsMax, 15); }

    selections.push({
      exercise,
      role,
      sets: scaledSets(role, setScale),
      repsMin,
      repsMax,
      rir: 2,
      order,
      method,
      methodConfig: config,
    });
    used.add(exercise.id);
  }
}

function scaledSets(role: SelectedExercise["role"], setScale: number): number {
  return Math.max(1, Math.round(REP_SCHEMES[role].sets * setScale));
}
