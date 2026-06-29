import { Router } from "express";
import bcrypt from "bcryptjs";
import { timingSafeEqual, randomBytes } from "crypto";
import multer from "multer";

// Multer en memoria para fotos de progreso (se suben a Supabase Storage)
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
import { PrismaClient } from "@prisma/client";
import type { RoutineService } from "./RoutineService";
import {
  clearasesoradattempts, clearCoachAttempts, isClientLocked, isCoachLocked,
  isCoach2FAPending, recordClientFailedAttempt, recordCoachFailedAttempt,
  resendCoachCode, verifyCoachCode,
} from "./TwoFactorService";
import {
  clientLoginSchema,
  clientProgressSchema,
  coachLoginSchema,
  createCoachSchema,
  createClientSchema,
  exerciseLogSchema,
  generateRoutineSchema,
  progressRoutineSchema,
  routineDayEditSchema,
  setPinSchema,
  updateClientProfileSchema,
  updateExerciseMediaSchema,
} from "./validation";
import type { TrainingLocation, UserProfile } from "../types";
import {
  canAccessClient,
  requireAuth,
  requireRole,
  signAuthToken,
  type AuthedRequest,
} from "./security";

const prisma = new PrismaClient();

export function buildRouter(service: RoutineService): Router {
  const router = Router();

  router.get("/health", (_req, res) => res.json({ status: "ok" }));

  // Crear coach — solo con ADMIN_SECRET, sin registro público
  router.post("/admin/coach", async (req, res) => {
    const adminSecret = process.env.ADMIN_SECRET;
    const provided = String(req.headers["x-admin-secret"] ?? "");
    // timingSafeEqual previene timing attacks; requiere buffers del mismo tamaño
    const secretOk = adminSecret && provided.length === adminSecret.length &&
      timingSafeEqual(Buffer.from(provided), Buffer.from(adminSecret));
    if (!secretOk) {
      return res.status(403).json({ error: "Forbidden", message: "Se requiere X-Admin-Secret válido." });
    }
    const parsed = createCoachSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
    }
    const email = parsed.data.email.trim().toLowerCase();
    const existing = await prisma.coach.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Conflict", message: "Ya existe un coach con ese email." });
    }
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const coach = await prisma.coach.create({
      data: { email, name: parsed.data.name.trim(), passwordHash },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    return res.status(201).json({ coach });
  });

  router.post("/auth/coach/login", async (req, res) => {
    const parsed = coachLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
    }
    const email = parsed.data.email.trim().toLowerCase();

    // Verificar bloqueo activo
    const lockStatus = isCoachLocked(email);
    if (lockStatus.locked) {
      return res.status(429).json({ error: "TooManyAttempts", message: "Cuenta bloqueada temporalmente.", lockedUntil: lockStatus.lockedUntil });
    }

    const coach = await prisma.coach.findUnique({ where: { email } });
    if (!coach || !(await bcrypt.compare(parsed.data.password, coach.passwordHash))) {
      const result = recordCoachFailedAttempt(email);
      if (result.status === "locked") {
        return res.status(429).json({ error: "TooManyAttempts", message: "Demasiados intentos. Cuenta bloqueada 30 min.", lockedUntil: result.lockedUntil });
      }
      if (result.status === "2fa_required") {
        return res.status(401).json({ error: "TwoFactorRequired", twoFactorRequired: true, maskedEmail: result.maskedEmail, message: "Se envió un código de verificación a tu correo." });
      }
      return res.status(401).json({ error: "InvalidCredentials", message: "Credenciales incorrectas." });
    }

    // Si hay 2FA pendiente (ya se generó el código), requerir verificación aunque la contraseña sea correcta
    if (isCoach2FAPending(email)) {
      return res.status(401).json({ error: "TwoFactorRequired", twoFactorRequired: true, maskedEmail: email.replace(/(?<=.{2}).(?=.*@)/g, "*"), message: "Verifica tu identidad con el código enviado." });
    }

    clearCoachAttempts(email);
    const claims = { role: "coach" as const, name: coach.name, coachId: coach.id };
    const token = signAuthToken(claims);
    return res.json({ token, session: claims });
  });

  // Verificación del código 2FA del coach
  router.post("/auth/coach/verify-2fa", async (req, res) => {
    const { email, code } = req.body as { email?: string; code?: string };
    if (!email || !code) return res.status(400).json({ error: "BadRequest", message: "Email y código son requeridos." });
    const em = email.trim().toLowerCase();

    const lockStatus = isCoachLocked(em);
    if (lockStatus.locked) return res.status(429).json({ error: "TooManyAttempts", lockedUntil: lockStatus.lockedUntil });

    if (!verifyCoachCode(em, code)) {
      const result = recordCoachFailedAttempt(em);
      if (result.status === "locked") return res.status(429).json({ error: "TooManyAttempts", lockedUntil: result.lockedUntil });
      return res.status(401).json({ error: "InvalidCode", message: "Código incorrecto o expirado." });
    }

    const coach = await prisma.coach.findUnique({ where: { email: em } });
    if (!coach) return res.status(404).json({ error: "CoachNotFound" });

    clearCoachAttempts(em);
    const claims = { role: "coach" as const, name: coach.name, coachId: coach.id };
    const token = signAuthToken(claims);
    return res.json({ token, session: claims });
  });

  // Reenviar código 2FA
  router.post("/auth/coach/resend-2fa", async (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ error: "BadRequest" });
    const ok = resendCoachCode(email.trim().toLowerCase());
    return res.json({ sent: ok });
  });

  router.post("/auth/usuario/login", async (req, res, next) => {
    const parsed = clientLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
    }
    const identifier = parsed.data.identifier.trim();

    // Verificar bloqueo activo
    const lockStatus = isClientLocked(identifier);
    if (lockStatus.locked) {
      return res.status(429).json({ error: "TooManyAttempts", message: "Demasiados intentos. Espera 15 minutos.", lockedUntil: lockStatus.lockedUntil });
    }

    try {
      const usuario = await service.findClientByIdentifier(identifier);
      if (!usuario) {
        recordClientFailedAttempt(identifier);
        return res.status(404).json({
          error: "UsuarioNotFound",
          message: "No se encontró ningún usuario con ese correo, nombre o ID.",
        });
      }
      const storedPin = await service.getClientPin(usuario.id);
      if (!storedPin) {
        return res.status(401).json({
          error: "PinRequired",
          message: "Esta cuenta no tiene PIN de acceso. Pide a tu coach que configure tu acceso.",
        });
      }
      // Comparar PIN: soporta hashes bcrypt (nuevos) y texto plano (migración automática)
      const enteredPin = parsed.data.pin ?? "";
      const isHashed = storedPin.startsWith("$2b$") || storedPin.startsWith("$2a$");
      const pinValid = isHashed
        ? await bcrypt.compare(enteredPin, storedPin)
        : enteredPin === storedPin;

      if (!enteredPin || !pinValid) {
        const lockResult = recordClientFailedAttempt(identifier);
        if (lockResult.locked) {
          return res.status(429).json({ error: "TooManyAttempts", message: "Demasiados intentos. Espera 15 minutos.", lockedUntil: lockResult.lockedUntil });
        }
        return res.status(401).json({ error: "InvalidPin", message: "PIN incorrecto." });
      }

      // Migración automática: si el PIN era texto plano, lo hasheamos ahora
      if (!isHashed) {
        await service.setClientPin(usuario.id, enteredPin);
      }
      clearasesoradattempts(identifier);
      const claims = {
        role: "client" as const,
        clientId: usuario.id,
        name: usuario.name?.trim() || usuario.email || "Usuario",
      };
      const token = signAuthToken(claims);
      return res.json({ token, session: claims });
    } catch (err) {
      return next(err);
    }
  });

  router.get("/auth/usuario-opciones", async (_req, res, next) => {
    try {
      const usuarios = await service.listClients();
      return res.json({
        usuarios: usuarios.map((item) => ({
          id: item.client.id,
          name: item.client.name?.trim() || item.client.email || "Usuario",
        })),
      });
    } catch (err) {
      return next(err);
    }
  });

  router.use(requireAuth);

  router.get("/auth/me", (req, res) => {
    const auth = (req as AuthedRequest).auth;
    return res.json({ session: auth });
  });

  router.get("/exercise-library", async (_req, res, next) => {
    try {
      res.json({ exercises: await service.exerciseLibrary() });
    } catch (err) {
      next(err);
    }
  });

  router.get("/exercise-alternatives", async (req, res, next) => {
    try {
      const { exerciseRef, level, trainingLocation } = req.query as Record<string, string>;
      if (!exerciseRef) return res.status(400).json({ error: "exerciseRef required" });
      const alts = await service.getExerciseAlternatives(
        exerciseRef,
        (level ?? "intermediate") as UserProfile["experienceLevel"],
        trainingLocation as TrainingLocation | undefined,
      );
      res.json({ alternatives: alts });
    } catch (err) {
      next(err);
    }
  });

  router.get("/usuarios", requireRole("coach"), async (_req, res, next) => {
    try {
      res.json({ usuarios: await service.listClients() });
    } catch (err) {
      next(err);
    }
  });

  router.get("/usuario/:id", async (req, res, next) => {
    try {
      const auth = (req as AuthedRequest).auth;
      if (!canAccessClient(auth, req.params.id)) {
        return res.status(403).json({ error: "Forbidden", message: "Solo puedes acceder a tu propio perfil." });
      }
      const usuario = await service.getClientDashboard(req.params.id);
      if (!usuario) return res.status(404).json({ error: "UsuarioNotFound" });
      res.json({ usuario });
    } catch (err) {
      next(err);
    }
  });

  router.post("/usuario", requireRole("coach"), async (req, res, next) => {
    const parsed = createClientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
    }
    try {
      const { client: created, generatedPin } = await service.createClient(parsed.data);
      res.status(201).json({ usuario: created, generatedPin });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/usuario/:id/perfil", async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id) && auth?.role !== "coach") {
      return res.status(403).json({ error: "Forbidden", message: "Acceso denegado." });
    }
    const parsed = updateClientProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
    }
    try {
      const updated = await service.updateClientProfile(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ error: "UsuarioNotFound" });
      res.json({ usuario: updated });
    } catch (err) {
      return next(err);
    }
  });

  router.patch("/usuario/:id/progreso", async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) {
      return res.status(403).json({ error: "Forbidden", message: "Solo puedes actualizar tu propio progreso." });
    }
    const parsed = clientProgressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
    }
    try {
      const updated = await service.updateWeeklyProgress(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ error: "UsuarioNotFound" });
      res.json({ usuario: updated });
    } catch (err) {
      next(err);
    }
  });

  router.post("/generate-routine", async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (auth?.role !== "coach") {
      return res.status(403).json({ error: "Forbidden", message: "Solo el coach puede generar rutinas." });
    }
    const parsed = generateRoutineSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
    }
    try {
      const { clientId, weeks, seed } = parsed.data;
      let profile: UserProfile | undefined;

      if (clientId) {
        const usuario = await service.getClient(clientId);
        if (!usuario) return res.status(404).json({ error: "UsuarioNotFound" });
        profile = usuario;
      } else if (parsed.data.goal && parsed.data.experienceLevel && parsed.data.daysPerWeek) {
        profile = {
          goal: parsed.data.goal,
          experienceLevel: parsed.data.experienceLevel,
          daysPerWeek: parsed.data.daysPerWeek,
        };
      } else {
        return res.status(400).json({
          error: "MissingProfile",
          message: "Proporciona clientId, o goal + experienceLevel + daysPerWeek.",
        });
      }

      // Calcular ajuste de volumen basado en feedback previo del asesorado
      let volumeBias = 1.0;
      let feedbackMessage = "";
      if (clientId) {
        const feedbacks = await prisma.sessionFeedback.findMany({
          where: { userId: clientId },
          orderBy: { createdAt: "desc" },
          take: 6, // últimas 6 sesiones
        });
        if (feedbacks.length >= 3) {
          const scores = feedbacks.map(f => f.feeling === "easy" ? 1 : f.feeling === "good" ? 0 : -1);
          const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
          if (avg <= -0.4) {
            volumeBias = 0.85; // mayoría "duro" → -15% volumen
            feedbackMessage = "Volumen reducido 15% basado en feedback: sesiones reportadas como difíciles.";
          } else if (avg >= 0.4) {
            volumeBias = 1.10; // mayoría "fácil" → +10% volumen
            feedbackMessage = "Volumen aumentado 10% basado en feedback: sesiones reportadas como fáciles.";
          }
        }
      }

      const stored = await service.generateProgram(profile, weeks, seed, clientId, volumeBias);
      res.status(201).json({ id: stored.id, program: stored.program, volumeBias, feedbackMessage });
    } catch (err) {
      next(err);
    }
  });

  router.post("/progress-routine", requireRole("coach"), async (req, res, next) => {
    const parsed = progressRoutineSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
    }
    try {
      const result = await service.progress(parsed.data.routineId);
      if (!result) return res.status(404).json({ error: "ProgramNotFound" });
      res.json({ id: result.program.id, week: result.week, program: result.program.program });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/routine/:id/week/:week/day/:dayIndex", async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!auth) return res.status(401).json({ error: "Unauthorized" });

    const parsed = routineDayEditSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
    }

    // asesorados solo pueden usar "replace" en su propia rutina
    if (auth.role === "client") {
      if (parsed.data.action !== "replace") {
        return res.status(403).json({ error: "Forbidden", message: "Los asesorados solo pueden cambiar ejercicios individuales." });
      }
      const stored = await service.getProgram(req.params.id).catch(() => null);
      if (!stored || stored.clientId !== auth.clientId) {
        return res.status(403).json({ error: "Forbidden", message: "Solo puedes editar tu propia rutina." });
      }
    } else if (auth.role !== "coach") {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const weekNumber = parseInt(req.params.week, 10);
      const dayIndex = parseInt(req.params.dayIndex, 10);
      if (isNaN(weekNumber) || isNaN(dayIndex)) {
        return res.status(400).json({ error: "ValidationError", message: "week y dayIndex deben ser números." });
      }
      const result = await service.editRoutineDay(req.params.id, weekNumber, dayIndex, parsed.data);
      if (!result) return res.status(404).json({ error: "ProgramNotFound" });
      res.json({ id: result.id, program: result.program });
    } catch (err) {
      return next(err);
    }
  });

  router.patch("/usuario/:id/pin", requireRole("coach"), async (req, res, next) => {
    const parsed = setPinSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
    try {
      await service.setClientPin(req.params.id, parsed.data.pin);
      return res.json({ ok: true });
    } catch (err) { return next(err); }
  });

  router.post("/usuario/:id/logs", requireAuth, async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) return res.status(403).json({ error: "Forbidden" });
    const parsed = exerciseLogSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
    try {
      const log = await service.saveExerciseLog(req.params.id, parsed.data);

      // Detectar récord personal (PR)
      let isPR = false;
      let previousBest = 0;
      const newMaxKg = Math.max(...(parsed.data.setsData as {weightKg:number;completed:boolean}[])
        .filter(s => s.completed).map(s => s.weightKg), 0);

      if (newMaxKg > 0) {
        const history = await service.getExerciseHistory(req.params.id, parsed.data.exerciseName);
        // Excluir el log recién guardado comparando por weekNumber+dayIndex
        const prevMax = Math.max(...history
          .filter(h => !(h.weekNumber === parsed.data.weekNumber && h.dayIndex === parsed.data.dayIndex))
          .flatMap(h => (h.setsData as {weightKg:number;completed:boolean}[]).filter(s=>s.completed).map(s=>s.weightKg)), 0);
        if (newMaxKg > prevMax) { isPR = true; previousBest = prevMax; }
      }

      return res.status(201).json({ log, isPR, newMaxKg, previousBest });
    } catch (err) { return next(err); }
  });

  router.get("/usuario/:id/logs", async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) return res.status(403).json({ error: "Forbidden" });
    const week = parseInt(req.query.week as string, 10);
    const day = parseInt(req.query.day as string, 10);
    if (isNaN(week) || isNaN(day)) return res.status(400).json({ error: "Params week y day requeridos" });
    try {
      const logs = await service.getDayLogs(req.params.id, week, day);
      return res.json({ logs });
    } catch (err) { return next(err); }
  });

  router.get("/usuario/:id/logs/historial/:exerciseName", async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) return res.status(403).json({ error: "Forbidden" });
    try {
      const logs = await service.getExerciseHistory(req.params.id, decodeURIComponent(req.params.exerciseName));
      return res.json({ logs });
    } catch (err) { return next(err); }
  });

  // ── Peso corporal semanal ────────────────────────────────────────────────────
  router.post("/usuario/:id/peso", requireAuth, async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) return res.status(403).json({ error: "Forbidden" });
    const { weightKg, notes } = req.body as { weightKg: number; notes?: string };
    if (!weightKg || isNaN(weightKg) || weightKg <= 0) return res.status(400).json({ error: "Peso inválido." });
    try {
      const log = await prisma.weightLog.create({ data: { userId: req.params.id, weightKg, notes } });
      return res.status(201).json({ log });
    } catch (err) { return next(err); }
  });

  router.get("/usuario/:id/peso", requireAuth, async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) return res.status(403).json({ error: "Forbidden" });
    try {
      const logs = await prisma.weightLog.findMany({
        where: { userId: req.params.id },
        orderBy: { loggedAt: "asc" },
      });
      return res.json({ logs });
    } catch (err) { return next(err); }
  });

  // ── Notas del coach por sesión ────────────────────────────────────────────
  router.post("/usuario/:id/coach-note", requireRole("coach"), async (req, res, next) => {
    const { weekNumber, dayIndex, note } = req.body as { weekNumber: number; dayIndex: number; note: string };
    if (!note?.trim()) return res.status(400).json({ error: "Nota vacía." });
    try {
      const record = await prisma.coachNote.upsert({
        where: { userId_weekNumber_dayIndex: { userId: req.params.id, weekNumber, dayIndex } },
        update: { note: note.trim() },
        create: { userId: req.params.id, weekNumber, dayIndex, note: note.trim() },
      });
      return res.status(201).json({ note: record });
    } catch (err) { return next(err); }
  });

  router.get("/usuario/:id/coach-notes", requireAuth, async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) return res.status(403).json({ error: "Forbidden" });
    try {
      const notes = await prisma.coachNote.findMany({ where: { userId: req.params.id }, orderBy: { weekNumber: "asc" } });
      return res.json({ notes });
    } catch (err) { return next(err); }
  });

  // ── Feedback post-sesión ──────────────────────────────────────────────────
  router.post("/usuario/:id/feedback", requireAuth, async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) return res.status(403).json({ error: "Forbidden" });
    const { weekNumber, dayIndex, feeling } = req.body as { weekNumber: number; dayIndex: number; feeling: string };
    if (!["easy","good","hard"].includes(feeling)) return res.status(400).json({ error: "Feeling inválido." });
    try {
      const fb = await prisma.sessionFeedback.upsert({
        where: { userId_weekNumber_dayIndex: { userId: req.params.id, weekNumber, dayIndex } },
        update: { feeling },
        create: { userId: req.params.id, weekNumber, dayIndex, feeling },
      });
      return res.status(201).json({ feedback: fb });
    } catch (err) { return next(err); }
  });

  router.get("/usuario/:id/feedback", requireAuth, async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) return res.status(403).json({ error: "Forbidden" });
    try {
      const feedbacks = await prisma.sessionFeedback.findMany({ where: { userId: req.params.id } });
      return res.json({ feedbacks });
    } catch (err) { return next(err); }
  });

  // ── Invitaciones de registro ──────────────────────────────────────────────

  // Generar invitación (coach)
  router.post("/invites", requireRole("coach"), async (req, res, next) => {
    const { note } = req.body as { note?: string };
    try {
      const token = randomBytes(16).toString("hex"); // 32 chars hex
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días
      const invite = await prisma.invite.create({
        data: { token, note: note?.trim() || null, expiresAt },
        select: { id: true, token: true, note: true, expiresAt: true, createdAt: true },
      });
      return res.status(201).json({ invite });
    } catch (err) { return next(err); }
  });

  // Listar invitaciones del coach
  router.get("/invites", requireRole("coach"), async (_req, res, next) => {
    try {
      const invites = await prisma.invite.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, token: true, note: true, expiresAt: true, usedAt: true, createdUserId: true, createdAt: true },
      });
      return res.json({ invites });
    } catch (err) { return next(err); }
  });

  // Revocar invitación (coach)
  router.delete("/invites/:id", requireRole("coach"), async (req, res, next) => {
    try {
      await prisma.invite.delete({ where: { id: req.params.id } });
      return res.json({ ok: true });
    } catch (err) { return next(err); }
  });

  // Verificar token (público — para mostrar el formulario)
  router.get("/invites/verify/:token", async (req, res, next) => {
    try {
      const invite = await prisma.invite.findUnique({ where: { token: req.params.token } });
      if (!invite) return res.status(404).json({ error: "Invitación no encontrada." });
      if (invite.usedAt) return res.status(410).json({ error: "Esta invitación ya fue utilizada." });
      if (invite.expiresAt < new Date()) return res.status(410).json({ error: "Esta invitación expiró." });
      return res.json({ valid: true, note: invite.note });
    } catch (err) { return next(err); }
  });

  // Enviar formulario de registro (público)
  router.post("/invites/:token/registro", async (req, res, next) => {
    try {
      const invite = await prisma.invite.findUnique({ where: { token: req.params.token } });
      if (!invite) return res.status(404).json({ error: "Invitación no encontrada." });
      if (invite.usedAt) return res.status(410).json({ error: "Esta invitación ya fue utilizada." });
      if (invite.expiresAt < new Date()) return res.status(410).json({ error: "Esta invitación expiró." });

      const parsed = createClientSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });

      const { client, generatedPin } = await service.createClient(parsed.data);

      // Marcar invitación como usada
      await prisma.invite.update({
        where: { token: req.params.token },
        data: { usedAt: new Date(), createdUserId: client.id },
      });

      return res.status(201).json({ client, generatedPin });
    } catch (err) { return next(err); }
  });

  // ── Check-in semanal ──────────────────────────────────────────────────────
  router.post("/usuario/:id/checkin", requireAuth, async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) return res.status(403).json({ error: "Forbidden" });
    const { weekNumber, energy, sleep, stress, notes } = req.body as { weekNumber:number; energy:number; sleep:number; stress:number; notes?:string };
    if (!weekNumber || !energy || !sleep || !stress) return res.status(400).json({ error: "Datos incompletos." });
    try {
      const ci = await prisma.weeklyCheckIn.upsert({
        where: { userId_weekNumber: { userId: req.params.id, weekNumber } },
        update: { energy, sleep, stress, notes },
        create: { userId: req.params.id, weekNumber, energy, sleep, stress, notes },
      });
      return res.status(201).json({ checkIn: ci });
    } catch (err) { return next(err); }
  });

  router.get("/usuario/:id/checkins", requireAuth, async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) return res.status(403).json({ error: "Forbidden" });
    try {
      const checkIns = await prisma.weeklyCheckIn.findMany({ where: { userId: req.params.id }, orderBy: { weekNumber: "asc" } });
      return res.json({ checkIns });
    } catch (err) { return next(err); }
  });

  // ── Templates de rutinas ──────────────────────────────────────────────────
  router.post("/templates", requireRole("coach"), async (req, res, next) => {
    const { name, goal, level, daysPerWeek, totalWeeks, payload } = req.body as {
      name:string; goal:string; level:string; daysPerWeek:number; totalWeeks:number; payload:unknown;
    };
    if (!name?.trim() || !payload) return res.status(400).json({ error: "Nombre y programa requeridos." });
    try {
      const template = await prisma.workout.create({
        data: { name: name.trim(), goal: goal as any, level: level as any, daysPerWeek, totalWeeks, payload: payload as any },
      });
      return res.status(201).json({ template });
    } catch (err) { return next(err); }
  });

  router.get("/templates", requireRole("coach"), async (_req, res, next) => {
    try {
      const templates = await prisma.workout.findMany({ orderBy: { createdAt: "desc" } });
      return res.json({ templates });
    } catch (err) { return next(err); }
  });

  router.delete("/templates/:id", requireRole("coach"), async (req, res, next) => {
    try {
      await prisma.workout.delete({ where: { id: req.params.id } });
      return res.json({ ok: true });
    } catch (err) { return next(err); }
  });

  router.post("/templates/:id/aplicar", requireRole("coach"), async (req, res, next) => {
    const { clientId } = req.body as { clientId: string };
    if (!clientId) return res.status(400).json({ error: "clientId requerido." });
    try {
      const template = await prisma.workout.findUnique({ where: { id: req.params.id } });
      if (!template) return res.status(404).json({ error: "Template no encontrado." });
      const payload = template.payload as Record<string, unknown>;
      const program = payload.program ?? payload; // el payload puede ser el program directamente
      const routineId = `tpl-${Date.now()}`;
      const newPayload = { routineId, program, progress: [], clientId, usedSignatures: [] };
      // Guardar como rutina activa del asesorado
      const activeName = `client:${clientId}:active`;
      const existing = await prisma.workout.findFirst({ where: { name: activeName }, orderBy: { createdAt: "desc" } });
      if (existing) {
        await prisma.workout.update({ where: { id: existing.id }, data: { payload: newPayload as any } });
      } else {
        await prisma.workout.create({ data: { name: activeName, goal: template.goal, level: template.level, daysPerWeek: template.daysPerWeek, totalWeeks: template.totalWeeks, payload: newPayload as any } });
      }
      return res.status(201).json({ ok: true, program });
    } catch (err) { return next(err); }
  });

  // ── Medidas corporales ────────────────────────────────────────────────────
  router.post("/usuario/:id/medidas", requireAuth, async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) return res.status(403).json({ error: "Forbidden" });
    const { hipCm, waistCm, thighCm, armCm, chestCm, notes } = req.body as Record<string,number|string|undefined>;
    try {
      const log = await prisma.measurementLog.create({
        data: {
          userId: req.params.id,
          hipCm: hipCm ? Number(hipCm) : undefined,
          waistCm: waistCm ? Number(waistCm) : undefined,
          thighCm: thighCm ? Number(thighCm) : undefined,
          armCm: armCm ? Number(armCm) : undefined,
          chestCm: chestCm ? Number(chestCm) : undefined,
          notes: typeof notes === "string" ? notes : undefined,
        },
      });
      return res.status(201).json({ log });
    } catch (err) { return next(err); }
  });

  router.get("/usuario/:id/medidas", requireAuth, async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) return res.status(403).json({ error: "Forbidden" });
    try {
      const logs = await prisma.measurementLog.findMany({
        where: { userId: req.params.id },
        orderBy: { loggedAt: "asc" },
      });
      return res.json({ logs });
    } catch (err) { return next(err); }
  });

  // ── Fotos de progreso ─────────────────────────────────────────────────────
  router.post("/usuario/:id/fotos", requireAuth, photoUpload.single("photo"), async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) return res.status(403).json({ error: "Forbidden" });
    if (!req.file) return res.status(400).json({ error: "No se recibió ninguna foto." });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: "Storage no configurado." });

    try {
      const ext = req.file.originalname.split(".").pop() ?? "jpg";
      const filename = `${req.params.id}/${Date.now()}.${ext}`;
      const uploadRes = await fetch(
        `${supabaseUrl}/storage/v1/object/progress-photos/${filename}`,
        { method: "POST", headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": req.file.mimetype, "x-upsert": "true" }, body: req.file.buffer },
      );
      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        return res.status(500).json({ error: "Error al subir foto.", detail: err });
      }
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/progress-photos/${filename}`;
      const notes = typeof req.body.notes === "string" ? req.body.notes : undefined;
      const photo = await prisma.progressPhoto.create({ data: { userId: req.params.id, url: publicUrl, notes } });
      return res.status(201).json({ photo });
    } catch (err) { return next(err); }
  });

  router.get("/usuario/:id/fotos", requireAuth, async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) return res.status(403).json({ error: "Forbidden" });
    try {
      const photos = await prisma.progressPhoto.findMany({ where: { userId: req.params.id }, orderBy: { takenAt: "asc" } });
      return res.json({ photos });
    } catch (err) { return next(err); }
  });

  router.delete("/usuario/:id/fotos/:photoId", requireAuth, async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) return res.status(403).json({ error: "Forbidden" });
    try {
      await prisma.progressPhoto.delete({ where: { id: req.params.photoId } });
      return res.json({ ok: true });
    } catch (err) { return next(err); }
  });

  // ── Dashboard del coach (alertas) ─────────────────────────────────────────
  router.get("/dashboard", requireRole("coach"), async (_req, res, next) => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const users = await prisma.user.findMany({
        select: {
          id: true, name: true, goal: true, daysPerWeek: true,
          exerciseLogs: { select: { loggedAt: true }, orderBy: { loggedAt: "desc" }, take: 1 },
        },
      });
      const dashboard = users.map(u => {
        const lastLog = u.exerciseLogs[0]?.loggedAt ?? null;
        const inactive = lastLog ? lastLog < sevenDaysAgo : true;
        return { id: u.id, name: u.name, goal: u.goal, daysPerWeek: u.daysPerWeek, lastSession: lastLog, inactive };
      });
      return res.json({ dashboard });
    } catch (err) { return next(err); }
  });

  router.patch("/exercise/:id/media", requireRole("coach"), async (req, res, next) => {
    const parsed = updateExerciseMediaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
    }
    try {
      const ok = await service.updateExerciseMedia(req.params.id, parsed.data.imageUrl, parsed.data.videoUrl);
      if (!ok) return res.status(404).json({ error: "ExerciseNotFound" });
      res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  router.get("/routine/:id", async (req, res, next) => {
    try {
      const auth = (req as AuthedRequest).auth;
      const stored = await service.getProgram(req.params.id);
      if (!stored) return res.status(404).json({ error: "ProgramNotFound" });
      if (auth?.role === "client" && auth.clientId !== stored.clientId) {
        return res.status(403).json({ error: "Forbidden", message: "Solo puedes acceder a tu propia rutina." });
      }
      res.json({ id: stored.id, program: stored.program });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
