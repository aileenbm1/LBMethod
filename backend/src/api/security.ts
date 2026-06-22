import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import type { Secret, SignOptions } from "jsonwebtoken";

export type AuthRole = "coach" | "client";

export interface AuthClaims {
  role: AuthRole;
  name: string;
  clientId?: string;
}

export type AuthedRequest = Request & { auth?: AuthClaims };

const DEFAULT_SECRET = "lbmethod-dev-secret-change-me";
const rawSecret = process.env.JWT_SECRET ?? DEFAULT_SECRET;

// En producción, rechazar el secreto por defecto o uno demasiado corto
if (process.env.NODE_ENV === "production") {
  if (rawSecret === DEFAULT_SECRET || rawSecret.length < 32) {
    console.error("❌  SEGURIDAD: JWT_SECRET no configurado o demasiado corto. El servidor no arrancará en producción sin un secreto seguro (≥32 caracteres).");
    process.exit(1);
  }
}

const JWT_SECRET: Secret = rawSecret;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "12h";

export function signAuthToken(claims: AuthClaims): string {
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN as SignOptions["expiresIn"] };
  return jwt.sign(claims, JWT_SECRET, options);
}

export function verifyAuthToken(token: string): AuthClaims | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthClaims;
  } catch {
    return null;
  }
}

function bearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized", message: "Missing Bearer token." });
  }
  const claims = verifyAuthToken(token);
  if (!claims) {
    return res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token." });
  }
  (req as AuthedRequest).auth = claims;
  next();
};

export function requireRole(...roles: AuthRole[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as AuthedRequest).auth;
    if (!auth) {
      return res.status(401).json({ error: "Unauthorized", message: "Missing auth context." });
    }
    if (!roles.includes(auth.role)) {
      return res.status(403).json({ error: "Forbidden", message: "Insufficient permissions." });
    }
    next();
  };
}

export function canAccessClient(auth: AuthClaims | undefined, clientId: string): boolean {
  if (!auth) return false;
  if (auth.role === "coach") return true;
  return auth.role === "client" && auth.clientId === clientId;
}
