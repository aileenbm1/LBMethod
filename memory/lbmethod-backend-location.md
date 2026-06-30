---
name: lbmethod-backend-location
description: The LB Method routine-generation backend IS accessible, at LB/backend
metadata:
  type: project
---

El backend Node/Express/Prisma de LB Method **sí está accesible**, en `LB/backend` (raíz del repo, junto a `frontend/`). NO confundir con `GESTION DE PROTOTIPOS/backend/services` (otro proyecto Python de video/playwright).

Flujo de generación de rutina: `POST /generate-routine` ([backend/src/api/routes.ts](backend/src/api/routes.ts)) → `RoutineService.generateProgram` → `LBMethodEngine.generateProgram` ([backend/src/engine/services/LBMethodEngine.ts](backend/src/engine/services/LBMethodEngine.ts)). La progresión del mesociclo (RIR 3→2→1→deload, deload = −20% volumen) está en `MESOCYCLE` ([backend/src/engine/rules/businessRules.ts](backend/src/engine/rules/businessRules.ts)). Librería de ejercicios: `EXERCISE_LIBRARY` en `backend/src/data/exerciseLibrary.ts`.

Type-check: `cd backend && npx tsc --noEmit` (hay errores PREEXISTENTES de Prisma sin generar: faltan `invite`, `weeklyCheckIn`, enum `Goal` — no son míos). Ejecutar TS suelto: archivo en `backend/` + `npx ts-node archivo.ts`.

**Why:** En un resumen anterior asumí que el backend no estaba en los directorios de trabajo y por poco parcheo en el frontend algo que era un bug de backend.
**How to apply:** Para bugs de generación de rutina (ejercicios, RIR, volumen, deload), editar `LB/backend`, no el frontend. Ver [[coach-asesorados-layout]].
