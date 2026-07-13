/**
 * LBMethodEngine — the orchestrator.
 *
 * Wires together the calculators, generators and engines into a single
 * `generateRoutine` / `generateProgram` API. It depends on abstractions
 * (injected collaborators) rather than concretions, so any piece can be
 * swapped or stubbed in tests (Dependency Inversion).
 */
import type {
  Equipment,
  Exercise,
  GenerateOptions,
  GeneratedDay,
  GeneratedProgram,
  GeneratedRoutine,
  ProgressionWeek,
  SelectedExercise,
  UserProfile,
  VolumePlan,
} from "../../types";
import { HOME_EQUIPMENT, SESSION_MAX_EXERCISES } from "../../types";
import { VolumeCalculator } from "../calculators/VolumeCalculator";
import { ExerciseSelector } from "../generators/ExerciseSelector";
import { SplitGenerator } from "../generators/SplitGenerator";
import { Rng } from "../rules/rng";
import { RoutineValidator } from "../validators/RoutineValidator";
import { FatigueEngine } from "./FatigueEngine";
import { ProgressionEngine } from "./ProgressionEngine";

export interface EngineDeps {
  volumeCalculator?: VolumeCalculator;
  splitGenerator?: SplitGenerator;
  fatigueEngine?: FatigueEngine;
  exerciseSelector?: ExerciseSelector;
  progressionEngine?: ProgressionEngine;
  validator?: RoutineValidator;
}

export class LBMethodEngine {
  private readonly volume: VolumeCalculator;
  private readonly splits: SplitGenerator;
  private readonly fatigue: FatigueEngine;
  private readonly selector: ExerciseSelector;
  private readonly progression: ProgressionEngine;
  private readonly validator: RoutineValidator;

  constructor(deps: EngineDeps = {}) {
    this.volume = deps.volumeCalculator ?? new VolumeCalculator();
    this.splits = deps.splitGenerator ?? new SplitGenerator();
    this.fatigue = deps.fatigueEngine ?? new FatigueEngine();
    this.selector = deps.exerciseSelector ?? new ExerciseSelector(this.fatigue);
    this.progression = deps.progressionEngine ?? new ProgressionEngine();
    this.validator = deps.validator ?? new RoutineValidator();
  }

  /**
   * Generate a single validated week. Retries with new seeds until it finds a
   * combination that (a) validates and (b) is not in `usedSignatures`.
   */
  generateRoutine(
    user: UserProfile,
    library: Exercise[],
    options: GenerateOptions = {},
  ): GeneratedRoutine {
    const used = new Set(options.usedSignatures ?? []);
    const weekNumber = options.weekNumber ?? 1;
    const prog = this.progression.forWeek(weekNumber);
    const baseSeed = options.seed ?? hashSeed(`${user.goal}:${user.experienceLevel}:${user.daysPerWeek}:${weekNumber}`);

    const MAX_ATTEMPTS = 64;
    let lastRoutine: GeneratedRoutine | null = null;

    const bias = options.volumeBias ?? 1;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const routine = this.buildRoutine(user, library, weekNumber, prog.rir, prog.deload, prog.volumeMultiplier * bias, baseSeed + attempt * 1013);
      lastRoutine = routine;
      const result = this.validator.validate(routine);
      if (result.valid && !used.has(routine.signature)) {
        return routine;
      }
    }

    // Could not find an unused valid combination; return the best effort and let
    // the caller decide. (In practice the library is large enough this is rare.)
    if (!lastRoutine) throw new Error("Failed to generate routine");
    return lastRoutine;
  }

  /** Generate a full multi-week program (default: one 4-week mesocycle).
   *  All weeks use the SAME exercises; only technique, load, and volume change.
   *  Progression is via RIR ↓ and training method intensity, not exercise variation.
   */
  generateProgram(
    user: UserProfile,
    library: Exercise[],
    totalWeeks = 4,
    options: GenerateOptions = {},
  ): GeneratedProgram {
    const progression = this.progression.buildMesocycle();
    const weeks: GeneratedRoutine[] = [];

    // Si viene un ancla (mesociclo anterior del mismo cliente, mismo objetivo/enfoque),
    // reconciliar en vez de generar desde cero: conserva los ejercicios que sigan siendo
    // elegibles y solo sustituye los que ya no lo son (nueva lesión, cambio de equipo/lugar).
    let templateRoutine = options.anchorRoutine
      ? this.reconcileAnchor(options.anchorRoutine, user, library)
      : this.generateRoutine(user, library, {
          ...options,
          weekNumber: 1,
          usedSignatures: options.usedSignatures,
          volumeBias: options.volumeBias,
        });

    // Red de seguridad: si la reconciliación no queda válida, generar desde cero.
    if (options.anchorRoutine && !this.validator.validate(templateRoutine).valid) {
      templateRoutine = this.generateRoutine(user, library, {
        ...options,
        weekNumber: 1,
        usedSignatures: options.usedSignatures,
        volumeBias: options.volumeBias,
      });
    }

    weeks.push(templateRoutine);

    // Weeks 2-N reuse week 1's EXACT exercises. Only RIR, deload flag and (on a
    // deload week) the set volume change — never the exercise selection. This is
    // the whole point of a mesocycle: same plan, progressive intensity.
    for (let week = 2; week <= totalWeeks; week++) {
      weeks.push(this.deriveWeek(templateRoutine, user, this.progression.forWeek(week)));
    }

    return {
      goal: user.goal,
      level: user.experienceLevel,
      daysPerWeek: user.daysPerWeek,
      totalWeeks,
      progression: progression.slice(0, Math.min(totalWeeks, progression.length)),
      weeks,
    };
  }

  validate(routine: GeneratedRoutine) {
    return this.validator.validate(routine);
  }

  // ---- internals ----------------------------------------------------------

  /**
   * Reconcile a previous mesocycle's week-1 template against the client's
   * *current* constraints. Every exercise that's still eligible (difficulty,
   * limitations, equipment, gym-only floor-calisthenics rule) is kept exactly
   * as-is; anything that's no longer eligible (new injury, switched from gym
   * to home, etc.) is swapped for the highest-activation exercise that shares
   * its movement pattern and primary muscle. Sets/reps/method/role are always
   * preserved from the original slot — only *which* exercise fills it changes.
   */
  private reconcileAnchor(anchor: GeneratedRoutine, user: UserProfile, library: Exercise[]): GeneratedRoutine {
    const blockedPatterns = this.selector.blockedPatterns(user.limitations ?? []);
    const allowedEquipment: Equipment[] | undefined =
      user.trainingLocation === "home"
        ? (user.homeEquipment && user.homeEquipment.length > 0 ? user.homeEquipment : HOME_EQUIPMENT)
        : undefined;
    const gymOnly = user.trainingLocation === "gym";
    const level = user.experienceLevel;

    const days: GeneratedDay[] = anchor.days.map((day) => {
      const usedToday = new Set(day.selections.map((s) => s.exercise.id));
      const selections: SelectedExercise[] = [];
      for (const sel of day.selections) {
        if (this.selector.isEligible(sel.exercise, level, blockedPatterns, allowedEquipment, gymOnly)) {
          selections.push(sel);
          continue;
        }
        // Primero intenta un reemplazo del mismo patrón (mejor sustituto cuando la
        // razón fue equipo/lugar). Si el patrón en sí está bloqueado (lesión), nunca
        // habrá candidatos ahí, así que amplía a "mismo músculo, cualquier patrón".
        const sameMuscleEligible = library.filter(
          (e) =>
            e.primaryMuscle === sel.exercise.primaryMuscle &&
            !usedToday.has(e.id) &&
            this.selector.isEligible(e, level, blockedPatterns, allowedEquipment, gymOnly),
        );
        const replacement =
          sameMuscleEligible
            .filter((e) => e.movementPattern === sel.exercise.movementPattern)
            .sort((a, b) => b.activationScore - a.activationScore)[0] ??
          sameMuscleEligible.sort((a, b) => b.activationScore - a.activationScore)[0];
        // Si no hay reemplazo válido, se descarta el ejercicio de este día (igual
        // que el truncado por maxExercisesPerDay que ya hace selectForDay).
        if (replacement) {
          selections.push({ ...sel, exercise: replacement });
          usedToday.add(replacement.id);
        }
      }
      return {
        dayIndex: day.dayIndex,
        focus: day.focus,
        selections,
        sessionFatigue: this.fatigue.sessionFatigue(selections),
        totalSets: selections.reduce((sum, s) => sum + s.sets, 0),
      };
    });

    return {
      goal: user.goal,
      level: user.experienceLevel,
      daysPerWeek: user.daysPerWeek,
      weekNumber: 1,
      rir: anchor.rir,
      deload: anchor.deload,
      volume: anchor.volume,
      days,
      signature: signatureFor(days),
    };
  }

  /**
   * Build a later week of the mesocycle from the week-1 template. Keeps the
   * exact same exercises, order and training methods; only updates RIR, the
   * deload flag and — on a deload week — scales the set count down by the
   * week's volume multiplier. This guarantees the routine does NOT change from
   * week to week; the only thing that progresses is intensity.
   */
  private deriveWeek(
    template: GeneratedRoutine,
    user: UserProfile,
    prog: ProgressionWeek,
  ): GeneratedRoutine {
    const effectiveRir = user.goal === "general_health" ? Math.min(prog.rir + 1, 5) : prog.rir;
    const scale = prog.volumeMultiplier;

    const days: GeneratedDay[] = template.days.map((day) => {
      const selections: SelectedExercise[] = day.selections.map((s) => ({
        ...s,
        sets: scale === 1 ? s.sets : Math.max(1, Math.round(s.sets * scale)),
        rir: effectiveRir,
      }));
      return {
        dayIndex: day.dayIndex,
        focus: day.focus,
        selections,
        sessionFatigue: this.fatigue.sessionFatigue(selections),
        totalSets: selections.reduce((sum, s) => sum + s.sets, 0),
      };
    });

    const volume: VolumePlan =
      scale === 1
        ? { ...template.volume }
        : {
            ...template.volume,
            weeklyGluteSets: Math.round(template.volume.weeklyGluteSets * scale),
            weeklyQuadSets: Math.round(template.volume.weeklyQuadSets * scale),
            weeklyHamstringSets: Math.round(template.volume.weeklyHamstringSets * scale),
            weeklyUpperSets: Math.round(template.volume.weeklyUpperSets * scale),
          };

    return {
      goal: template.goal,
      level: template.level,
      daysPerWeek: template.daysPerWeek,
      weekNumber: prog.week,
      rir: prog.rir,
      deload: prog.deload,
      volume,
      days,
      signature: signatureFor(days),
    };
  }

  private buildRoutine(
    user: UserProfile,
    library: Exercise[],
    weekNumber: number,
    rir: number,
    deload: boolean,
    volumeMultiplier: number,
    seed: number,
  ): GeneratedRoutine {
    const weakPoints = user.weakPoints ?? [];
    const limitations = user.limitations ?? [];
    // Si especificó equipamiento en casa, usar ese; si no, usar el set completo de casa
    const allowedEquipment: Equipment[] | undefined =
      user.trainingLocation === "home"
        ? (user.homeEquipment && user.homeEquipment.length > 0 ? user.homeEquipment : HOME_EQUIPMENT)
        : undefined;
    const maxExPerDay: number | undefined = user.sessionDuration
      ? SESSION_MAX_EXERCISES[user.sessionDuration]
      : undefined;

    const gender = user.gender ?? "unspecified";
    // Músculo con prioridad 3 = enfoque estructural (afecta el split)
    const focusMuscle = weakPoints.find(wp => wp.priority === 3)?.muscleGroup;
    const volume = this.volume.calculate(user.goal, user.experienceLevel, user.daysPerWeek, volumeMultiplier, weakPoints, gender, user.age, user.monthsTrained);
    const templates = this.splits.generate(user.goal, user.daysPerWeek, gender, focusMuscle);
    volume.gluteFrequency = templates.filter((t) => t.isGluteDay).length;

    const rng = new Rng(seed);

    // Movimiento saludable: siempre 1 RIR adicional (más conservador)
    const effectiveRir = user.goal === "general_health" ? Math.min(rir + 1, 5) : rir;

    const days: GeneratedDay[] = templates.map((template) => {
      const selections: SelectedExercise[] = this.selector
        .selectForDay(
          template, library, user.experienceLevel, rng, volumeMultiplier,
          limitations, weakPoints, user.goal, weekNumber, deload, allowedEquipment, maxExPerDay,
          user.trainingLocation === "gym",
        )
        .map((s) => ({ ...s, rir: effectiveRir }));
      return {
        dayIndex: template.dayIndex,
        focus: template.focus,
        selections,
        sessionFatigue: this.fatigue.sessionFatigue(selections),
        totalSets: selections.reduce((sum, s) => sum + s.sets, 0),
      };
    });

    return {
      goal: user.goal,
      level: user.experienceLevel,
      daysPerWeek: user.daysPerWeek,
      weekNumber,
      rir,
      deload,
      volume,
      days,
      signature: signatureFor(days),
    };
  }
}

/** Stable signature of a week's full exercise combination (order-independent per day). */
export function signatureFor(days: GeneratedDay[]): string {
  const parts = days.map(
    (d) =>
      `${d.dayIndex}:` +
      d.selections
        .map((s) => s.exercise.id)
        .sort()
        .join(","),
  );
  return hashSeed(parts.join("|")).toString(36);
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
