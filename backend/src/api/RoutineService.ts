import { createHash, randomUUID } from "crypto";
import bcrypt from "bcryptjs";

/**
 * Genera un PIN aleatorio de 8 caracteres con letras, números y símbolos.
 * Garantiza al menos 1 mayúscula, 1 minúscula, 1 dígito y 1 símbolo.
 */
function generatePin(): string {
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const special = "@#$!%&*";
  const all = lower + upper + digits + special;
  const required = [
    lower[Math.floor(Math.random() * lower.length)],
    upper[Math.floor(Math.random() * upper.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  const rest = Array.from({ length: 4 }, () => all[Math.floor(Math.random() * all.length)]);
  const pin = [...required, ...rest];
  // Fisher-Yates shuffle
  for (let i = pin.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pin[i], pin[j]] = [pin[j], pin[i]];
  }
  return pin.join("");
}
import type { Prisma, PrismaClient } from "@prisma/client";
import { LBMethodEngine } from "../engine/services/LBMethodEngine";
import { ProgressionEngine } from "../engine/services/ProgressionEngine";
import type { ExerciseRepository } from "../models/ExerciseRepository";
import type { BodyMeasurements, Gender, GeneratedDay, GeneratedProgram, GeneratedRoutine, Limitation, SelectedExercise, SessionDuration, TrainingLocation, UserProfile, WeakPoint } from "../types";
import { METHOD_CONFIGS } from "../engine/rules/businessRules";
import type { RoutineDayEdit } from "./validation";

export interface StoredClient extends UserProfile {
  id: string;
  pin?: string;
  createdAt: string;
}

export interface StoredProgram {
  id: string;
  clientId?: string;
  program: GeneratedProgram;
  usedSignatures: string[];
  createdAt: string;
}

export interface WeeklyProgress {
  weekNumber: number;
  completedSessions: number;
  notes: string;
  updatedAt: string;
}

export interface ClientDashboard {
  client: StoredClient;
  program: GeneratedProgram | null;
  routineId: string | null;
  progress: WeeklyProgress[];
}

interface ClientState {
  routineId: string | null;
  program: GeneratedProgram | null;
  progress: WeeklyProgress[];
}

export class RoutineService {
  private clients = new Map<string, StoredClient>();
  private programs = new Map<string, StoredProgram>();
  private clientState = new Map<string, ClientState>();

  constructor(
    private readonly repo: ExerciseRepository,
    private readonly engine: LBMethodEngine = new LBMethodEngine(),
    private readonly progression: ProgressionEngine = new ProgressionEngine(),
    private readonly prisma?: PrismaClient,
  ) {}

  private normalizeEmail(name?: string, email?: string): string {
    if (email && email.trim().length > 0) return email.trim().toLowerCase();
    const seed = `${name ?? "client"}-${Date.now()}-${Math.random()}`;
    const hash = createHash("sha1").update(seed).digest("hex").slice(0, 12);
    return `client-${hash}@lbmethod.local`;
  }

  private mapPrismaUserToClient(user: {
    id: string;
    email: string;
    name: string | null;
    goal: UserProfile["goal"];
    experienceLevel: UserProfile["experienceLevel"];
    daysPerWeek: number;
    gender?: string | null;
    sessionDuration?: number | null;
    trainingLocation?: string | null;
    bodyweightKg: number | null;
    heightCm: number | null;
    bodyFatPct: number | null;
    hipCm: number | null;
    waistCm: number | null;
    thighCm: number | null;
    notes: string | null;
    pin?: string | null;
    createdAt: Date;
    weakPoints?: Array<{ muscleGroup: string; priority: number }>;
    limitations?: Array<{ description: string; affectedPatterns: string[]; severity: string }>;
  }): StoredClient {
    const measurements: BodyMeasurements = {
      heightCm: user.heightCm ?? undefined,
      bodyFatPct: user.bodyFatPct ?? undefined,
      hipCm: user.hipCm ?? undefined,
      waistCm: user.waistCm ?? undefined,
      thighCm: user.thighCm ?? undefined,
    };
    const hasMeasurements = Object.values(measurements).some((v) => v !== undefined);

    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      goal: user.goal,
      experienceLevel: user.experienceLevel,
      daysPerWeek: user.daysPerWeek,
      gender: (user.gender as Gender) ?? "unspecified",
      sessionDuration: (user.sessionDuration as SessionDuration) ?? 60,
      trainingLocation: (user.trainingLocation as TrainingLocation) ?? "gym",
      pin: user.pin ?? undefined,
      bodyweightKg: user.bodyweightKg ?? undefined,
      notes: user.notes ?? undefined,
      measurements: hasMeasurements ? measurements : undefined,
      weakPoints: user.weakPoints?.map((wp) => ({
        muscleGroup: wp.muscleGroup,
        priority: wp.priority as 1 | 2 | 3,
      })),
      limitations: user.limitations?.map((lim) => ({
        description: lim.description,
        affectedPatterns: lim.affectedPatterns as Limitation["affectedPatterns"],
        severity: lim.severity as Limitation["severity"],
      })),
      createdAt: user.createdAt.toISOString(),
    };
  }

  private parseClientPayload(payload: unknown): ClientState {
    const fallback: ClientState = { routineId: null, program: null, progress: [] };
    if (!payload || typeof payload !== "object") return fallback;
    const candidate = payload as Partial<ClientState>;
    return {
      routineId: typeof candidate.routineId === "string" ? candidate.routineId : null,
      program: candidate.program ?? null,
      progress: Array.isArray(candidate.progress) ? (candidate.progress as WeeklyProgress[]) : [],
    };
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private get prismaUserInclude() {
    return { weakPoints: true, limitations: true } as const;
  }

  async createClient(input: UserProfile & { email?: string }): Promise<{ client: StoredClient; generatedPin: string }> {
    const pin = generatePin();

    if (this.prisma) {
      const user = await this.prisma.user.create({
        data: {
          email: this.normalizeEmail(input.name, input.email),
          name: input.name,
          goal: input.goal,
          experienceLevel: input.experienceLevel,
          daysPerWeek: input.daysPerWeek,
          bodyweightKg: input.bodyweightKg,
          notes: input.notes,
          pin,
          heightCm: input.measurements?.heightCm,
          bodyFatPct: input.measurements?.bodyFatPct,
          hipCm: input.measurements?.hipCm,
          waistCm: input.measurements?.waistCm,
          thighCm: input.measurements?.thighCm,
          weakPoints: input.weakPoints?.length
            ? { create: input.weakPoints.map((wp) => ({ muscleGroup: wp.muscleGroup, priority: wp.priority })) }
            : undefined,
          limitations: input.limitations?.length
            ? { create: input.limitations.map((lim) => ({ description: lim.description, affectedPatterns: lim.affectedPatterns, severity: lim.severity })) }
            : undefined,
        },
        include: this.prismaUserInclude,
      });
      return { client: this.mapPrismaUserToClient(user), generatedPin: pin };
    }

    const id = randomUUID();
    const client: StoredClient = {
      ...input,
      email: this.normalizeEmail(input.name, input.email),
      id,
      createdAt: new Date().toISOString(),
    };
    this.clients.set(id, { ...client, pin } as StoredClient & { pin: string });
    this.clientState.set(id, { routineId: null, program: null, progress: [] });
    return { client, generatedPin: pin };
  }

  async getClient(id: string): Promise<StoredClient | undefined> {
    if (this.prisma) {
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: this.prismaUserInclude,
      });
      if (!user) return undefined;
      return this.mapPrismaUserToClient(user);
    }
    return this.clients.get(id);
  }

  /**
   * Busca un cliente por email, nombre o ID.
   * La búsqueda es case-insensitive para email y nombre.
   */
  async findClientByIdentifier(identifier: string): Promise<StoredClient | undefined> {
    const id = identifier.trim();
    if (!id) return undefined;

    if (this.prisma) {
      const idLower = id.toLowerCase();
      // Intentar primero por ID exacto
      let user = await this.prisma.user.findUnique({
        where: { id },
        include: this.prismaUserInclude,
      }).catch(() => null);

      if (!user) {
        // Buscar por email (único en DB)
        user = await this.prisma.user.findFirst({
          where: { email: { equals: idLower, mode: "insensitive" } },
          include: this.prismaUserInclude,
        });
      }

      if (!user) {
        // Buscar por nombre (case-insensitive, primer resultado)
        user = await this.prisma.user.findFirst({
          where: { name: { equals: id, mode: "insensitive" } },
          include: this.prismaUserInclude,
        });
      }

      return user ? this.mapPrismaUserToClient(user) : undefined;
    }

    // Fallback en memoria
    const byId = this.clients.get(id);
    if (byId) return byId;
    const idLower = id.toLowerCase();
    return Array.from(this.clients.values()).find(
      (c) =>
        c.email?.toLowerCase() === idLower ||
        c.name?.toLowerCase() === idLower,
    );
  }

  async updateClientProfile(
    clientId: string,
    input: {
      measurements?: BodyMeasurements;
      weakPoints?: WeakPoint[];
      limitations?: Limitation[];
      notes?: string;
      bodyweightKg?: number;
      trainingLocation?: TrainingLocation;
      gender?: Gender;
      sessionDuration?: SessionDuration;
      goal?: UserProfile["goal"];
      experienceLevel?: UserProfile["experienceLevel"];
      daysPerWeek?: number;
    },
  ): Promise<StoredClient | undefined> {
    if (this.prisma) {
      // Reemplaza puntos débiles y limitaciones completamente para simplificar
      await this.prisma.weakPoint.deleteMany({ where: { userId: clientId } });
      await this.prisma.limitation.deleteMany({ where: { userId: clientId } });

      const user = await this.prisma.user.update({
        where: { id: clientId },
        data: {
          bodyweightKg: input.bodyweightKg,
          notes: input.notes,
          trainingLocation: input.trainingLocation,
          gender: input.gender,
          sessionDuration: input.sessionDuration,
          goal: input.goal,
          experienceLevel: input.experienceLevel,
          daysPerWeek: input.daysPerWeek,
          heightCm: input.measurements?.heightCm,
          bodyFatPct: input.measurements?.bodyFatPct,
          hipCm: input.measurements?.hipCm,
          waistCm: input.measurements?.waistCm,
          thighCm: input.measurements?.thighCm,
          weakPoints: input.weakPoints?.length
            ? { create: input.weakPoints.map((wp) => ({ muscleGroup: wp.muscleGroup, priority: wp.priority })) }
            : undefined,
          limitations: input.limitations?.length
            ? { create: input.limitations.map((lim) => ({ description: lim.description, affectedPatterns: lim.affectedPatterns, severity: lim.severity })) }
            : undefined,
        },
        include: this.prismaUserInclude,
      });
      return this.mapPrismaUserToClient(user);
    }

    // In-memory fallback
    const client = this.clients.get(clientId);
    if (!client) return undefined;
    const updated: StoredClient = {
      ...client,
      bodyweightKg: input.bodyweightKg ?? client.bodyweightKg,
      notes: input.notes ?? client.notes,
      trainingLocation: input.trainingLocation ?? client.trainingLocation,
      gender: input.gender ?? client.gender,
      sessionDuration: input.sessionDuration ?? client.sessionDuration,
      goal: input.goal ?? client.goal,
      experienceLevel: input.experienceLevel ?? client.experienceLevel,
      daysPerWeek: input.daysPerWeek ?? client.daysPerWeek,
      measurements: input.measurements ?? client.measurements,
      weakPoints: input.weakPoints ?? client.weakPoints,
      limitations: input.limitations ?? client.limitations,
    };
    this.clients.set(clientId, updated);
    return updated;
  }

  async listClients(): Promise<ClientDashboard[]> {
    const prisma = this.prisma;
    if (prisma) {
      const usersWithRelations = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        include: this.prismaUserInclude,
      });
      const records = await Promise.all(
        usersWithRelations.map(async (user) => {
          const stateRow = await prisma.workout.findFirst({
            where: { name: `client:${user.id}:active` },
            orderBy: { createdAt: "desc" },
          });
          const parsedState = this.parseClientPayload(stateRow?.payload);
          return {
            client: this.mapPrismaUserToClient(user),
            routineId: parsedState.routineId,
            program: parsedState.program,
            progress: parsedState.progress,
          };
        }),
      );
      return records;
    }

    return Array.from(this.clients.values())
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((client) => {
        const state = this.clientState.get(client.id) ?? {
          routineId: null,
          program: null,
          progress: [],
        };
        return {
          client,
          routineId: state.routineId,
          program: state.program,
          progress: state.progress,
        };
      });
  }

  async getClientDashboard(clientId: string): Promise<ClientDashboard | undefined> {
    const client = await this.getClient(clientId);
    if (!client) return undefined;

    const prisma = this.prisma;
    if (prisma) {
      const stateRow = await prisma.workout.findFirst({
        where: { name: `client:${clientId}:active` },
        orderBy: { createdAt: "desc" },
      });
      const parsedState = this.parseClientPayload(stateRow?.payload);
      return {
        client,
        routineId: parsedState.routineId,
        program: parsedState.program,
        progress: parsedState.progress,
      };
    }

    const state = this.clientState.get(clientId) ?? {
      routineId: null,
      program: null,
      progress: [],
    };
    return { client, routineId: state.routineId, program: state.program, progress: state.progress };
  }

  async updateWeeklyProgress(
    clientId: string,
    payload: Pick<WeeklyProgress, "weekNumber" | "completedSessions" | "notes">,
  ): Promise<ClientDashboard | undefined> {
    const dashboard = await this.getClientDashboard(clientId);
    if (!dashboard) return undefined;

    const updatedAt = new Date().toISOString();
    const normalizedWeek = Math.max(1, payload.weekNumber);
    const maxSessions = dashboard.client.daysPerWeek;
    const normalizedSessions = Math.min(Math.max(payload.completedSessions, 0), maxSessions);
    const entry: WeeklyProgress = {
      weekNumber: normalizedWeek,
      completedSessions: normalizedSessions,
      notes: payload.notes.trim(),
      updatedAt,
    };

    const nextProgress = [...dashboard.progress];
    const existingIndex = nextProgress.findIndex((item) => item.weekNumber === normalizedWeek);
    if (existingIndex >= 0) nextProgress[existingIndex] = entry;
    else nextProgress.push(entry);

    const nextState: ClientState = {
      routineId: dashboard.routineId,
      program: dashboard.program,
      progress: nextProgress,
    };

    const prisma = this.prisma;
    if (prisma) {
      const activeName = `client:${clientId}:active`;
      const existing = await prisma.workout.findFirst({
        where: { name: activeName },
        orderBy: { createdAt: "desc" },
      });
      const workoutPayload = {
        routineId: nextState.routineId,
        program: nextState.program,
        progress: nextState.progress,
      };
      if (existing) {
        await prisma.workout.update({
          where: { id: existing.id },
          data: { payload: this.toJson(workoutPayload), totalWeeks: nextState.program?.totalWeeks ?? 0 },
        });
      } else {
        await prisma.workout.create({
          data: {
            name: activeName,
            goal: dashboard.client.goal,
            level: dashboard.client.experienceLevel,
            daysPerWeek: dashboard.client.daysPerWeek,
            totalWeeks: nextState.program?.totalWeeks ?? 0,
            payload: this.toJson(workoutPayload),
          },
        });
      }
    } else {
      this.clientState.set(clientId, nextState);
    }

    return {
      client: dashboard.client,
      routineId: nextState.routineId,
      program: nextState.program,
      progress: nextState.progress,
    };
  }

  async exerciseLibrary() {
    return this.repo.all();
  }

  async getExerciseAlternatives(
    exerciseRef: string,   // id o nombre
    level: UserProfile["experienceLevel"],
    trainingLocation?: TrainingLocation,
  ) {
    const library = await this.repo.all();
    const DIFF: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };
    const HOME_EQ = ["bodyweight", "barbell", "dumbbell", "band", "kettlebell"];
    const maxDiff = (DIFF[level] ?? 1) + 1; // permite un nivel superior para variedad

    const source = library.find(e => e.id === exerciseRef || e.name === exerciseRef);
    if (!source) return [];

    const locationOk = (eq: string) =>
      trainingLocation !== "home" || HOME_EQ.includes(eq);

    // Búsqueda primaria: mismo patrón de movimiento + mismo músculo principal
    let alts = library.filter(e =>
      e.movementPattern === source.movementPattern &&
      e.primaryMuscle === source.primaryMuscle &&
      e.id !== source.id &&
      DIFF[e.difficulty] <= maxDiff &&
      locationOk(e.equipment),
    );

    // Si hay menos de 3, ampliar al mismo patrón + mismo grupo muscular
    if (alts.length < 3) {
      alts = library.filter(e =>
        e.movementPattern === source.movementPattern &&
        e.muscleGroup === source.muscleGroup &&
        e.id !== source.id &&
        DIFF[e.difficulty] <= maxDiff &&
        locationOk(e.equipment),
      );
    }

    return alts
      .sort((a, b) => (b.activationScore ?? 0) - (a.activationScore ?? 0))
      .slice(0, 6)
      .map(e => ({
        id: e.id, name: e.name, muscleGroup: e.muscleGroup,
        primaryMuscle: e.primaryMuscle, category: e.category,
        equipment: e.equipment,
      }));
  }

  async generateProgram(
    profile: UserProfile,
    weeks: number,
    seed?: number,
    clientId?: string,
  ): Promise<StoredProgram> {
    const library = await this.repo.all();
    const program = this.engine.generateProgram(profile, library, weeks, { seed });
    const stored: StoredProgram = {
      id: randomUUID(),
      clientId,
      program,
      usedSignatures: program.weeks.map((w) => w.signature),
      createdAt: new Date().toISOString(),
    };
    this.programs.set(stored.id, stored);

    if (clientId) {
      const nextState: ClientState = {
        routineId: stored.id,
        program,
        progress: [],
      };

      const prisma = this.prisma;
      if (prisma) {
        const activeName = `client:${clientId}:active`;
        const routineName = `routine:${stored.id}`;
        const payload = {
          routineId: stored.id,
          program,
          progress: [],
          clientId,
          usedSignatures: stored.usedSignatures,
        };

        const existingActive = await prisma.workout.findFirst({
          where: { name: activeName },
          orderBy: { createdAt: "desc" },
        });

        if (existingActive) {
          await prisma.workout.update({
            where: { id: existingActive.id },
            data: { payload: this.toJson(payload), totalWeeks: program.totalWeeks },
          });
        } else {
          await prisma.workout.create({
            data: {
              name: activeName,
              goal: profile.goal,
              level: profile.experienceLevel,
              daysPerWeek: profile.daysPerWeek,
              totalWeeks: program.totalWeeks,
              payload: this.toJson(payload),
            },
          });
        }

        await prisma.workout.create({
          data: {
            name: routineName,
            goal: profile.goal,
            level: profile.experienceLevel,
            daysPerWeek: profile.daysPerWeek,
            totalWeeks: program.totalWeeks,
            payload: this.toJson(payload),
          },
        });
      } else {
        this.clientState.set(clientId, nextState);
      }
    }

    return stored;
  }

  async getProgram(id: string): Promise<StoredProgram | undefined> {
    const inMemory = this.programs.get(id);
    if (inMemory) return inMemory;

    const prisma = this.prisma;
    if (prisma) {
      const row = await prisma.workout.findFirst({
        where: { name: `routine:${id}` },
        orderBy: { createdAt: "desc" },
      });
      if (!row) return undefined;
      const payload = row.payload as {
        program?: GeneratedProgram;
        clientId?: string;
        usedSignatures?: string[];
      };
      if (!payload?.program) return undefined;
      return {
        id,
        clientId: payload.clientId,
        program: payload.program,
        usedSignatures: payload.usedSignatures ?? payload.program.weeks.map((w) => w.signature),
        createdAt: row.createdAt.toISOString(),
      };
    }

    return undefined;
  }

  async editRoutineDay(
    programId: string,
    weekNumber: number,
    dayIndex: number,
    edit: RoutineDayEdit,
  ): Promise<StoredProgram | null> {
    const stored = await this.getProgram(programId);
    if (!stored) return null;

    const week = stored.program.weeks.find((w) => w.weekNumber === weekNumber);
    if (!week) return null;

    const day = week.days.find((d) => d.dayIndex === dayIndex);
    if (!day) return null;

    day.selections = await this.applyDayEdit(day, edit);
    day.totalSets = day.selections.reduce((sum, s) => sum + s.sets, 0);

    await this.persistProgram(programId, stored);
    return stored;
  }

  private async applyDayEdit(day: GeneratedDay, edit: RoutineDayEdit): Promise<SelectedExercise[]> {
    let sels = [...day.selections];

    if (edit.action === "set_day") {
      // Reemplaza todo el día — busca datos completos del ejercicio en el repo
      const newSels: SelectedExercise[] = [];
      for (let i = 0; i < edit.exercises.length; i++) {
        const e = edit.exercises[i];
        const exercise = await this.repo.byId(e.exerciseId);
        if (!exercise) continue;
        newSels.push({ exercise, role: e.role, sets: e.sets, repsMin: e.repsMin, repsMax: e.repsMax, rir: e.rir, order: i + 1, method: "straight", methodConfig: METHOD_CONFIGS.straight });
      }
      return newSels;
    }

    if (edit.action === "replace") {
      const newEx = await this.repo.byId(edit.newExerciseId);
      if (newEx) sels = sels.map((s) => s.exercise.id === edit.oldExerciseId ? { ...s, exercise: newEx } : s);
    } else if (edit.action === "update") {
      sels = sels.map((s) => {
        if (s.exercise.id !== edit.exerciseId) return s;
        return { ...s, sets: edit.sets ?? s.sets, repsMin: edit.repsMin ?? s.repsMin, repsMax: edit.repsMax ?? s.repsMax, rir: edit.rir ?? s.rir };
      });
    } else if (edit.action === "add") {
      const exercise = await this.repo.byId(edit.exerciseId);
      if (exercise) sels = [...sels, { exercise, role: edit.role, sets: edit.sets, repsMin: edit.repsMin, repsMax: edit.repsMax, rir: edit.rir, order: sels.length + 1, method: "straight", methodConfig: METHOD_CONFIGS.straight }];
    } else if (edit.action === "remove") {
      sels = sels.filter((s) => s.exercise.id !== edit.exerciseId).map((s, i) => ({ ...s, order: i + 1 }));
    } else if (edit.action === "reorder") {
      const byId = new Map(sels.map((s) => [s.exercise.id, s]));
      const reordered = edit.order.map((id, i) => { const sel = byId.get(id); return sel ? { ...sel, order: i + 1 } : null; }).filter(Boolean) as SelectedExercise[];
      const rest = sels.filter((s) => !edit.order.includes(s.exercise.id));
      sels = [...reordered, ...rest.map((s, i) => ({ ...s, order: reordered.length + i + 1 }))];
    }

    return sels;
  }

  private async persistProgram(programId: string, stored: StoredProgram): Promise<void> {
    const prisma = this.prisma;
    if (prisma) {
      const routineRow = await prisma.workout.findFirst({
        where: { name: `routine:${programId}` },
        orderBy: { createdAt: "desc" },
      });
      if (routineRow) {
        const prev = routineRow.payload as Record<string, unknown>;
        await prisma.workout.update({
          where: { id: routineRow.id },
          data: { payload: this.toJson({ ...prev, program: stored.program, usedSignatures: stored.usedSignatures }), totalWeeks: stored.program.totalWeeks },
        });
      }
      if (stored.clientId) {
        const activeName = `client:${stored.clientId}:active`;
        const activeRow = await prisma.workout.findFirst({ where: { name: activeName }, orderBy: { createdAt: "desc" } });
        if (activeRow) {
          const prev = activeRow.payload as Record<string, unknown>;
          await prisma.workout.update({
            where: { id: activeRow.id },
            data: { payload: this.toJson({ ...prev, program: stored.program }), totalWeeks: stored.program.totalWeeks },
          });
        }
      }
    } else {
      this.programs.set(programId, stored);
    }
  }

  // ---- PIN ----------------------------------------------------------------

  async getClientPin(clientId: string): Promise<string | null> {
    if (!this.prisma) return null;
    const user = await this.prisma.user.findUnique({ where: { id: clientId }, select: { pin: true } });
    return user?.pin ?? null;
  }

  async setClientPin(clientId: string, pin: string | null): Promise<void> {
    if (!this.prisma) return;
    // Hashear el PIN con bcrypt antes de guardar
    const hashed = pin ? await bcrypt.hash(pin, 12) : null;
    await this.prisma.user.update({ where: { id: clientId }, data: { pin: hashed } });
  }

  // ---- Registro de ejercicios ---------------------------------------------

  async saveExerciseLog(
    clientId: string,
    data: { weekNumber: number; dayIndex: number; exerciseName: string; setsData: object[]; notes?: string },
  ) {
    if (!this.prisma) throw new Error("DB requerida");
    return this.prisma.exerciseLog.upsert({
      where: { userId_weekNumber_dayIndex_exerciseName: { userId: clientId, weekNumber: data.weekNumber, dayIndex: data.dayIndex, exerciseName: data.exerciseName } },
      update: { setsData: this.toJson(data.setsData), notes: data.notes, loggedAt: new Date() },
      create: { userId: clientId, weekNumber: data.weekNumber, dayIndex: data.dayIndex, exerciseName: data.exerciseName, setsData: this.toJson(data.setsData), notes: data.notes },
    });
  }

  async getDayLogs(clientId: string, weekNumber: number, dayIndex: number) {
    if (!this.prisma) return [];
    return this.prisma.exerciseLog.findMany({
      where: { userId: clientId, weekNumber, dayIndex },
      orderBy: { loggedAt: "desc" },
    });
  }

  async getExerciseHistory(clientId: string, exerciseName: string) {
    if (!this.prisma) return [];
    return this.prisma.exerciseLog.findMany({
      where: { userId: clientId, exerciseName },
      orderBy: { loggedAt: "asc" },
    });
  }

  async updateExerciseMedia(exerciseId: string, imageUrl?: string, videoUrl?: string): Promise<boolean> {
    const prisma = this.prisma;
    if (prisma) {
      await prisma.exercise.update({
        where: { id: exerciseId },
        data: { imageUrl, videoUrl },
      });
      return true;
    }
    return false;
  }

  async progress(programId: string): Promise<{ program: StoredProgram; week: GeneratedRoutine } | null> {
    const stored = await this.getProgram(programId);
    if (!stored) return null;

    const last = stored.program.weeks[stored.program.weeks.length - 1];
    const profile: UserProfile = {
      goal: stored.program.goal,
      experienceLevel: stored.program.level,
      daysPerWeek: stored.program.daysPerWeek,
    };
    const library = await this.repo.all();
    const nextWeekNumber = last.weekNumber + 1;

    const week = this.engine.generateRoutine(profile, library, {
      weekNumber: nextWeekNumber,
      usedSignatures: stored.usedSignatures,
    });

    stored.program.weeks.push(week);
    stored.program.totalWeeks = stored.program.weeks.length;
    stored.program.progression.push(this.progression.forWeek(nextWeekNumber));
    stored.usedSignatures.push(week.signature);

    const prisma = this.prisma;
    if (prisma) {
      const routineRow = await prisma.workout.findFirst({
        where: { name: `routine:${programId}` },
        orderBy: { createdAt: "desc" },
      });

      const previousPayload = (routineRow?.payload ?? {}) as { progress?: WeeklyProgress[] };
      const payload = {
        routineId: programId,
        clientId: stored.clientId,
        program: stored.program,
        usedSignatures: stored.usedSignatures,
        progress: previousPayload.progress ?? [],
      };

      if (routineRow) {
        await prisma.workout.update({
          where: { id: routineRow.id },
          data: { payload: this.toJson(payload), totalWeeks: stored.program.totalWeeks },
        });
      }

      if (stored.clientId) {
        const activeName = `client:${stored.clientId}:active`;
        const activeRow = await prisma.workout.findFirst({
          where: { name: activeName },
          orderBy: { createdAt: "desc" },
        });
        if (activeRow) {
          await prisma.workout.update({
            where: { id: activeRow.id },
            data: { payload: this.toJson(payload), totalWeeks: stored.program.totalWeeks },
          });
        }
      }
    } else {
      this.programs.set(programId, stored);
      if (stored.clientId) {
        const current = this.clientState.get(stored.clientId) ?? {
          routineId: programId,
          program: stored.program,
          progress: [],
        };
        this.clientState.set(stored.clientId, {
          ...current,
          routineId: programId,
          program: stored.program,
        });
      }
    }

    return { program: stored, week };
  }
}
