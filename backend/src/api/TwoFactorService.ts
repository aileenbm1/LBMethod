/**
 * TwoFactorService — rate limiting + 2FA codes for login protection.
 *
 * Coach:  3 failed attempts → 2FA code via email
 *         10 failed attempts → 30-min lockout
 * Client: 5 failed attempts → 15-min lockout
 *
 * All state is in-memory; resets on server restart.
 */
import nodemailer from "nodemailer";

const COACH_2FA_THRESHOLD = 3;
const COACH_LOCKOUT_THRESHOLD = 10;
const COACH_LOCKOUT_MS = 30 * 60 * 1000;
const CLIENT_LOCKOUT_THRESHOLD = 5;
const CLIENT_LOCKOUT_MS = 15 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;

interface AttemptRecord { count: number; windowStart: number; lockedUntil?: number; }
interface CodeRecord    { code: string; expiresAt: number; used: boolean; }

const coachAttempts  = new Map<string, AttemptRecord>();
const asesoradattempts = new Map<string, AttemptRecord>();
const pendingCodes   = new Map<string, CodeRecord>();

function now() { return Date.now(); }

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Coach ─────────────────────────────────────────────────────────────────

export type CoachLoginResult =
  | { status: "ok" }
  | { status: "2fa_required"; maskedEmail: string }
  | { status: "locked"; lockedUntil: number };

export function recordCoachFailedAttempt(email: string): CoachLoginResult {
  const rec = coachAttempts.get(email) ?? { count: 0, windowStart: now() };
  rec.count += 1;
  coachAttempts.set(email, rec);

  if (rec.count >= COACH_LOCKOUT_THRESHOLD) {
    rec.lockedUntil = now() + COACH_LOCKOUT_MS;
    return { status: "locked", lockedUntil: rec.lockedUntil };
  }

  if (rec.count >= COACH_2FA_THRESHOLD) {
    const code = generateCode();
    pendingCodes.set(email, { code, expiresAt: now() + CODE_TTL_MS, used: false });
    sendCodeEmail(email, code).catch(console.error);
    return { status: "2fa_required", maskedEmail: maskEmail(email) };
  }

  return { status: "ok" };
}

export function isCoachLocked(email: string): { locked: boolean; lockedUntil?: number } {
  const rec = coachAttempts.get(email);
  if (!rec?.lockedUntil) return { locked: false };
  if (now() >= rec.lockedUntil) { coachAttempts.delete(email); return { locked: false }; }
  return { locked: true, lockedUntil: rec.lockedUntil };
}

export function isCoach2FAPending(email: string): boolean {
  const rec = coachAttempts.get(email);
  return !!rec && rec.count >= COACH_2FA_THRESHOLD && rec.count < COACH_LOCKOUT_THRESHOLD;
}

export function verifyCoachCode(email: string, code: string): boolean {
  const entry = pendingCodes.get(email);
  if (!entry || entry.used || now() > entry.expiresAt) return false;
  if (entry.code !== code.trim()) return false;
  entry.used = true;
  return true;
}

export function clearCoachAttempts(email: string) {
  coachAttempts.delete(email);
  pendingCodes.delete(email);
}

export function resendCoachCode(email: string): boolean {
  const rec = coachAttempts.get(email);
  if (!rec || rec.count < COACH_2FA_THRESHOLD) return false;
  const code = generateCode();
  pendingCodes.set(email, { code, expiresAt: now() + CODE_TTL_MS, used: false });
  sendCodeEmail(email, code).catch(console.error);
  return true;
}

// ── Client ────────────────────────────────────────────────────────────────

export function recordClientFailedAttempt(identifier: string): { locked: boolean; lockedUntil?: number } {
  const rec = asesoradattempts.get(identifier) ?? { count: 0, windowStart: now() };
  rec.count += 1;
  asesoradattempts.set(identifier, rec);

  if (rec.count >= CLIENT_LOCKOUT_THRESHOLD) {
    rec.lockedUntil = now() + CLIENT_LOCKOUT_MS;
    return { locked: true, lockedUntil: rec.lockedUntil };
  }
  return { locked: false };
}

export function isClientLocked(identifier: string): { locked: boolean; lockedUntil?: number } {
  const rec = asesoradattempts.get(identifier);
  if (!rec?.lockedUntil) return { locked: false };
  if (now() >= rec.lockedUntil) { asesoradattempts.delete(identifier); return { locked: false }; }
  return { locked: true, lockedUntil: rec.lockedUntil };
}

export function clearClientAttempts(identifier: string) {
  asesoradattempts.delete(identifier);
}

// ── Email ─────────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(0, user.length - 2))}@${domain}`;
}

async function sendCodeEmail(email: string, code: string): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  // Sin SMTP configurado: imprime en consola (útil para desarrollo)
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log(`\n🔐 [2FA CODE] Para ${email}: ${code} (válido 10 min)\n`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: SMTP_FROM ?? SMTP_USER,
    to: email,
    subject: "LB Method — Código de verificación",
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px">
        <h2 style="color:#17120d">Verificación de acceso</h2>
        <p style="color:#5a5044">Se detectaron varios intentos de inicio de sesión. Usa este código para continuar:</p>
        <div style="background:#17120d;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
          <span style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#a87d49">${code}</span>
        </div>
        <p style="color:#8c8377;font-size:13px">Este código expira en <strong>10 minutos</strong>.<br>Si no intentaste iniciar sesión, ignora este correo.</p>
      </div>
    `,
  });
}
