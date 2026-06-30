---
name: coach-asesorados-layout
description: Where the coach client-detail master-detail UI lives and how its tabs are structured
metadata:
  type: project
---

El coach tiene 3 secciones en el menú: **Coach Studio** (`activeTab==="coach"`, wizard de alta de 4 pasos), **Asesorados** (`activeTab==="clients"`, master-detail lista+detalle), y **Portal** (`activeTab==="portal"`, vista "Mi entrenamiento").

La pantalla que la usuaria llama "la vista del coach" y para la que pidió el mockup bonito es **Asesorados** (`activeTab==="clients"`), NO Coach Studio. El panel de detalle (`selectedClient && ...`) tiene tabs **Avance | Rutinas | Perfil** controlados por el estado `clientDetailTab`:
- **Avance**: gráficas (AvanceCharts: volumen semanal en barras + progreso de fuerza línea) + 3 métricas (adherencia, sesiones, Δ volumen) + form Registrar avance + check-ins.
- **Rutinas**: mesociclos (RoutinesTab) + templates + notas por sesión.
- **Perfil**: nombre, objetivo, nivel, días, email, adherencia.
- El editor de rutina queda fuera de los tabs (siempre visible cuando `editingRoutine`).

Componentes en [frontend/components/portal/](frontend/components/portal/): PortalTabs, RoutinesTab, AvanceCharts (SVG inline, sin librería de charts). Datos de gráficas son reales, derivados de `selectedClient.progress` + `program.weeks[].days[].totalSets`. Volumen etiquetado "(series)" no "(kg)" porque no hay kg semanales en esta vista. Ver [[lbmethod-stack]].

**Why:** Perdí 4 intentos editando la pantalla equivocada (Portal en vez de Asesorados) porque los nombres se confunden.
**How to apply:** Para cambios visuales del coach sobre un cliente, editar la sección `activeTab==="clients"` en RoutineGenerator.tsx, no Portal ni Coach Studio.
