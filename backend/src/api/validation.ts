/** Zod request schemas — the API validates every payload at the boundary. */
import { z } from "zod";

export const goalSchema = z.enum([
  "glute_hypertrophy",
  "glute_growth",
  "lower_body_focus",
  "fat_loss",
  "body_recomposition",
  "muscle_gain",
]);

export const levelSchema = z.enum(["beginner", "intermediate", "advanced"]);

export const movementPatternSchema = z.enum([
  "hip_thrust",
  "hip_hinge",
  "knee_dominant",
  "abduction",
  "unilateral",
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "core",
]);

export const limitationSeveritySchema = z.enum(["mild", "moderate", "severe"]);
export const trainingLocationSchema = z.enum(["gym", "home"]);
export const genderSchema = z.enum(["female", "male", "unspecified"]);
export const genderRequiredSchema = z.enum(["female", "male"], {
  errorMap: () => ({ message: "El género es requerido: female o male" }),
});
export const sessionDurationSchema = z.union([z.literal(45), z.literal(60), z.literal(75), z.literal(90)]);

export const weakPointSchema = z.object({
  muscleGroup: z.string().min(1),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
});

export const limitationSchema = z.object({
  description: z.string().min(1),
  affectedPatterns: z.array(movementPatternSchema).min(1),
  severity: limitationSeveritySchema.default("moderate"),
});

export const bodyMeasurementsSchema = z.object({
  heightCm: z.number().positive().optional(),
  bodyFatPct: z.number().min(3).max(60).optional(),
  hipCm: z.number().positive().optional(),
  waistCm: z.number().positive().optional(),
  thighCm: z.number().positive().optional(),
});

export const createClientSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  goal: goalSchema,
  experienceLevel: levelSchema,
  daysPerWeek: z.number().int().min(3).max(6).default(4),
  gender: genderSchema.default("unspecified"),
  sessionDuration: sessionDurationSchema.default(60),
  trainingLocation: trainingLocationSchema.default("gym"),
  bodyweightKg: z.number().positive().optional(),
  age: z.number().int().min(12).max(90).optional(),
  monthsTrained: z.number().int().min(0).optional(),
  homeEquipment: z.array(z.string()).optional(),
  measurements: bodyMeasurementsSchema.optional(),
  weakPoints: z.array(weakPointSchema).optional(),
  limitations: z.array(limitationSchema).optional(),
  notes: z.string().optional(),
});

export const updateClientProfileSchema = z.object({
  measurements: bodyMeasurementsSchema.optional(),
  weakPoints: z.array(weakPointSchema).optional(),
  limitations: z.array(limitationSchema).optional(),
  notes: z.string().optional(),
  bodyweightKg: z.number().positive().optional(),
  trainingLocation: trainingLocationSchema.optional(),
  gender: genderSchema.optional(),
  sessionDuration: sessionDurationSchema.optional(),
  goal: goalSchema.optional(),
  experienceLevel: levelSchema.optional(),
  daysPerWeek: z.number().int().min(3).max(6).optional(),
});

export const generateRoutineSchema = z.object({
  clientId: z.string().optional(),
  goal: goalSchema.optional(),
  experienceLevel: levelSchema.optional(),
  daysPerWeek: z.number().int().min(3).max(6).optional(),
  weeks: z.number().int().min(1).max(12).default(4),
  seed: z.number().int().optional(),
});

export const progressRoutineSchema = z.object({
  routineId: z.string().min(1),
});

export const clientProgressSchema = z.object({
  weekNumber: z.number().int().min(1),
  completedSessions: z.number().int().min(0),
  notes: z.string().default(""),
});

export const coachLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createCoachSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export const clientLoginSchema = z.object({
  // El asesorado puede identificarse con su email, nombre o ID
  identifier: z.string().min(1),
  pin: z.string().optional(),
});

export const clientRegisterSchema = z.object({
  name: z.string().min(2),
  goal: goalSchema.default("glute_hypertrophy"),
  experienceLevel: levelSchema.default("beginner"),
  daysPerWeek: z.number().int().min(3).max(6).default(4),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type GenerateRoutineInput = z.infer<typeof generateRoutineSchema>;
export type ProgressRoutineInput = z.infer<typeof progressRoutineSchema>;
export type ClientProgressInput = z.infer<typeof clientProgressSchema>;
export type CoachLoginInput = z.infer<typeof coachLoginSchema>;
export type CreateCoachInput = z.infer<typeof createCoachSchema>;
export type ClientLoginInput = z.infer<typeof clientLoginSchema>;
export type ClientRegisterInput = z.infer<typeof clientRegisterSchema>;
export type UpdateClientProfileInput = z.infer<typeof updateClientProfileSchema>;

// ---- Edición de rutina -----------------------------------------------------

export const replaceExerciseSchema = z.object({
  action: z.literal("replace"),
  oldExerciseId: z.string().min(1),
  newExerciseId: z.string().min(1),
});

export const updateExerciseParamsSchema = z.object({
  action: z.literal("update"),
  exerciseId: z.string().min(1),
  sets: z.number().int().min(1).max(10).optional(),
  repsMin: z.number().int().min(1).max(30).optional(),
  repsMax: z.number().int().min(1).max(30).optional(),
  rir: z.number().int().min(0).max(5).optional(),
});

export const addExerciseSchema = z.object({
  action: z.literal("add"),
  exerciseId: z.string().min(1),
  role: z.enum(["main", "unilateral", "isolation", "accessory"]),
  sets: z.number().int().min(1).max(10),
  repsMin: z.number().int().min(1).max(30),
  repsMax: z.number().int().min(1).max(30),
  rir: z.number().int().min(0).max(5),
});

export const removeExerciseSchema = z.object({
  action: z.literal("remove"),
  exerciseId: z.string().min(1),
});

export const reorderExercisesSchema = z.object({
  action: z.literal("reorder"),
  // Array de exerciseIds en el nuevo orden deseado
  order: z.array(z.string().min(1)).min(1),
});

export const setDayExerciseItemSchema = z.object({
  exerciseId: z.string().min(1),
  role: z.enum(["main", "unilateral", "isolation", "accessory"]),
  sets: z.number().int().min(1).max(10),
  repsMin: z.number().int().min(1).max(50),
  repsMax: z.number().int().min(1).max(50),
  rir: z.number().int().min(0).max(5),
});

export const setDaySchema = z.object({
  action: z.literal("set_day"),
  exercises: z.array(setDayExerciseItemSchema).min(1).max(12),
});

export const routineDayEditSchema = z.discriminatedUnion("action", [
  replaceExerciseSchema,
  updateExerciseParamsSchema,
  addExerciseSchema,
  removeExerciseSchema,
  reorderExercisesSchema,
  setDaySchema,
]);

export type SetDayExerciseItem = z.infer<typeof setDayExerciseItemSchema>;

export const updateExerciseMediaSchema = z.object({
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
});

export type RoutineDayEdit = z.infer<typeof routineDayEditSchema>;
export type UpdateExerciseMediaInput = z.infer<typeof updateExerciseMediaSchema>;

// ---- PIN de asesorado --------------------------------------------------------

export const setPinSchema = z.object({
  pin: z.string().min(6).max(12).nullable(),
});

// ---- Registro de ejercicios ------------------------------------------------

export const setLogSchema = z.object({
  setNumber: z.number().int().min(1),
  reps: z.number().int().min(0),
  weightKg: z.number().min(0),
  completed: z.boolean().default(true),
});

export const exerciseLogSchema = z.object({
  weekNumber: z.number().int().min(1),
  dayIndex: z.number().int().min(0),
  exerciseName: z.string().min(1),
  setsData: z.array(setLogSchema).min(1),
  notes: z.string().optional(),
});

export type SetPinInput = z.infer<typeof setPinSchema>;
export type SetLogInput = z.infer<typeof setLogSchema>;
export type ExerciseLogInput = z.infer<typeof exerciseLogSchema>;
