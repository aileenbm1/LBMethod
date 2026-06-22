import { Router } from "express";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import { PrismaClient } from "@prisma/client";
import type { RoutineService } from "./RoutineService";
import {
  clearClientAttempts, clearCoachAttempts, isClientLocked, isCoachLocked,
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
      clearClientAttempts(identifier);
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

      const stored = await service.generateProgram(profile, weeks, seed, clientId);
      res.status(201).json({ id: stored.id, program: stored.program });
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

    // Clientes solo pueden usar "replace" en su propia rutina
    if (auth.role === "client") {
      if (parsed.data.action !== "replace") {
        return res.status(403).json({ error: "Forbidden", message: "Los clientes solo pueden cambiar ejercicios individuales." });
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

  router.post("/usuario/:id/logs", async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.id)) return res.status(403).json({ error: "Forbidden" });
    const parsed = exerciseLogSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "ValidationError", details: parsed.error.flatten() });
    try {
      const log = await service.saveExerciseLog(req.params.id, parsed.data);
      return res.status(201).json({ log });
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
