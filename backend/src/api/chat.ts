/**
 * Chat router — funciona con Prisma (DB) o con store en memoria.
 * Siempre se registra; si no hay Prisma los mensajes viven en RAM.
 */
import path from "path";
import fs from "fs";
import { Router } from "express";
import multer from "multer";
import type { PrismaClient } from "@prisma/client";
import { requireAuth, canAccessClient, type AuthedRequest } from "./security";

/* ---- Uploads ---- */
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, /image\/|video\/|application\/pdf|audio\//.test(file.mimetype));
  },
});

function detectMedia(mime: string): "image" | "video" | "document" | "audio" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

/* ---- In-memory fallback ---- */
interface MemMsg {
  id: string; conversationId: string; senderRole: "coach" | "client";
  content: string | null; mediaUrl: string | null; mediaType: string | null;
  mediaFilename: string | null; createdAt: string;
}
const memStore = new Map<string, MemMsg[]>(); // key: clientId

function memGet(clientId: string) { return memStore.get(clientId) ?? []; }
function memAdd(clientId: string, m: Omit<MemMsg, "id" | "conversationId" | "createdAt">): MemMsg {
  const msg: MemMsg = {
    ...m, id: Math.random().toString(36).slice(2),
    conversationId: `conv-${clientId}`, createdAt: new Date().toISOString(),
  };
  if (!memStore.has(clientId)) memStore.set(clientId, []);
  memStore.get(clientId)!.push(msg);
  return msg;
}
function memDelete(clientId: string, msgId: string) {
  const msgs = memStore.get(clientId);
  if (msgs) memStore.set(clientId, msgs.filter(m => m.id !== msgId));
}

/* ---- Router factory ---- */
export function buildChatRouter(prisma?: PrismaClient): Router {
  const router = Router();
  router.use(requireAuth);

  /* GET /:clientId — obtener conversación + mensajes */
  router.get("/:clientId", async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.clientId) && auth?.role !== "coach") {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      if (prisma) {
        const convo = await prisma.conversation.upsert({
          where: { clientId: req.params.clientId },
          create: { clientId: req.params.clientId },
          update: {},
          include: { messages: { orderBy: { createdAt: "asc" } } },
        });
        return res.json({ conversationId: convo.id, messages: convo.messages });
      }
      // fallback
      const msgs = memGet(req.params.clientId);
      return res.json({ conversationId: `conv-${req.params.clientId}`, messages: msgs });
    } catch (err) { return next(err); }
  });

  /* POST /:clientId/message — enviar texto */
  router.post("/:clientId/message", async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.clientId) && auth?.role !== "coach") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { content } = req.body;
    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "ValidationError", message: "El campo content es requerido." });
    }
    try {
      const senderRole = auth!.role === "coach" ? "coach" : "client";
      if (prisma) {
        const convo = await prisma.conversation.upsert({
          where: { clientId: req.params.clientId },
          create: { clientId: req.params.clientId },
          update: {},
        });
        const message = await prisma.message.create({
          data: { conversationId: convo.id, senderRole: senderRole as any, content: content.trim() },
        });
        return res.status(201).json({ message });
      }
      // fallback
      const message = memAdd(req.params.clientId, { senderRole, content: content.trim(), mediaUrl: null, mediaType: null, mediaFilename: null });
      return res.status(201).json({ message });
    } catch (err) { return next(err); }
  });

  /* POST /:clientId/upload — subir archivo */
  router.post("/:clientId/upload", upload.single("file"), async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (!canAccessClient(auth, req.params.clientId) && auth?.role !== "coach") {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!req.file) return res.status(400).json({ error: "ValidationError", message: "No se recibió archivo." });
    try {
      const senderRole = auth!.role === "coach" ? "coach" : "client";
      const mediaUrl = `/uploads/${req.file.filename}`;
      const mediaType = detectMedia(req.file.mimetype);
      const contentText = (req.body.content as string | undefined)?.trim() || null;
      if (prisma) {
        const convo = await prisma.conversation.upsert({
          where: { clientId: req.params.clientId },
          create: { clientId: req.params.clientId },
          update: {},
        });
        const message = await prisma.message.create({
          data: { conversationId: convo.id, senderRole: senderRole as any, content: contentText, mediaUrl, mediaType: mediaType as any, mediaFilename: req.file.originalname },
        });
        return res.status(201).json({ message });
      }
      // fallback
      const message = memAdd(req.params.clientId, { senderRole, content: contentText, mediaUrl, mediaType, mediaFilename: req.file.originalname });
      return res.status(201).json({ message });
    } catch (err) { return next(err); }
  });

  /* DELETE /:clientId/message/:messageId */
  router.delete("/:clientId/message/:messageId", async (req, res, next) => {
    const auth = (req as AuthedRequest).auth;
    if (auth?.role !== "coach") return res.status(403).json({ error: "Forbidden" });
    try {
      if (prisma) {
        const msg = await prisma.message.findUnique({ where: { id: req.params.messageId } });
        if (!msg) return res.status(404).json({ error: "MessageNotFound" });
        if (msg.mediaUrl?.startsWith("/uploads/")) {
          const filePath = path.join(UPLOADS_DIR, path.basename(msg.mediaUrl));
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await prisma.message.delete({ where: { id: req.params.messageId } });
      } else {
        memDelete(req.params.clientId, req.params.messageId);
      }
      return res.json({ ok: true });
    } catch (err) { return next(err); }
  });

  return router;
}
