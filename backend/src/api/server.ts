/**
 * HTTP server bootstrap.
 *
 * By default it runs with the in-memory exercise repository so the API is
 * runnable with zero infrastructure. Set USE_DB=true to back it with Prisma /
 * PostgreSQL.
 */
import path from "path";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { buildRouter } from "./routes";
import { buildChatRouter } from "./chat";
import { RoutineService } from "./RoutineService";
import { InMemoryExerciseRepository } from "../models/ExerciseRepository";
import type { ExerciseRepository } from "../models/ExerciseRepository";
import type { PrismaClient } from "@prisma/client";

export function createApp(
  repo: ExerciseRepository = new InMemoryExerciseRepository(),
  prisma?: PrismaClient,
) {
  const app = express();

  // ── Seguridad: headers HTTP (XSS, clickjacking, sniffing) ──────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // permite GIFs de ejercicios
    contentSecurityPolicy: false, // desactivado: la app es solo API, no sirve HTML
  }));

  app.use(express.json({ limit: "2mb" }));

  // ── CORS: restrictivo en producción, abierto en desarrollo ─────────────────
  const allowedOrigin = process.env.CORS_ORIGIN ?? "*";
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigin === "*") {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else {
      // Lista de orígenes permitidos separados por coma
      const allowed = allowedOrigin.split(",").map(o => o.trim());
      if (origin && allowed.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
      }
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });

  // ── Rate limiting global: 120 peticiones / 1 minuto por IP ─────────────────
  app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "TooManyRequests", message: "Demasiadas peticiones. Espera un momento." },
    skip: (req) => req.method === "OPTIONS",
  }));

  // Rate limiting más estricto para auth endpoints: 20 intentos / 15 min
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "TooManyRequests", message: "Demasiados intentos de autenticación." },
  });
  app.use("/api/auth", authLimiter);

  // Servir archivos subidos (imágenes, videos, documentos del chat)
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  const service = new RoutineService(repo, undefined, undefined, prisma);

  app.use("/api/chat", buildChatRouter(prisma));
  app.use("/api", buildRouter(service));

  // Error handler centralizado
  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      // eslint-disable-next-line no-console
      console.error(err);
      res.status(500).json({ error: "InternalServerError", message: err.message });
    },
  );

  return app;
}

async function resolveInfrastructure(): Promise<{ repo: ExerciseRepository; prisma?: PrismaClient }> {
  if (process.env.USE_DB === "true") {
    const { prisma } = await import("../database/prisma");
    const { PrismaExerciseRepository } = await import("../models/PrismaExerciseRepository");
    return { repo: new PrismaExerciseRepository(prisma), prisma };
  }
  return { repo: new InMemoryExerciseRepository() };
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  resolveInfrastructure().then(({ repo, prisma }) => {
    createApp(repo, prisma).listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`LBMethodEngine API listening on http://localhost:${port}/api`);

      if (process.env.NODE_ENV !== "production") {
        const warnings: string[] = [];
        const secret = process.env.JWT_SECRET ?? "";
        if (!secret || secret === "lbmethod-dev-secret-change-me" || secret.length < 32)
          warnings.push("⚠️  JWT_SECRET débil — usa ≥32 caracteres aleatorios en producción.");
        if (process.env.USE_DB !== "true")
          warnings.push("⚠️  USE_DB no activo — datos se pierden al reiniciar.");
        if (!process.env.CORS_ORIGIN)
          warnings.push("⚠️  CORS_ORIGIN no definido — usando * (abierto). Define CORS_ORIGIN=https://tudominio.com en producción.");
        warnings.push("⚠️  Rate limiting en MEMORIA — se borra al reiniciar. Usa Redis en producción.");
        if (warnings.length) {
          // eslint-disable-next-line no-console
          console.warn("\n── Advertencias de seguridad (desarrollo) ──");
          // eslint-disable-next-line no-console
          warnings.forEach(w => console.warn(w));
          // eslint-disable-next-line no-console
          console.warn("──────────────────────────────────────────\n");
        }
      }
    });
  });
}
