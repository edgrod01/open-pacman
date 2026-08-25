# SPEC 02 — Salida escalonada de la pen

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-25
> **Objetivo:** Los fantasmas arrancan dentro de la pen, esperan quietos mientras esperan y salen escalonados al mapa siguiendo la IA de su kind.

## Alcance

**In:**

- Estado `released` por fantasma (booleano). Todos arrancan `false`.
- Temporización escalonada de salida: cada fantasma tiene un `releaseDelay` en frames.
- Mientras no liberado: el fantasma se mueve arriba-abajo dentro de la pen (oscilación vertical entre las filas interiores y=13 e y=14, invirtiendo dirección al tocar una pared).
- Al llegar a y ≤ 12 (fila de la puerta) con dirección arriba, o al vencer `releaseFrame`: el fantasma se marca como liberado y pasa a IA normal (`decideGhost`).
- Tras colisión (Pac-Man pierde vida): todos los fantasmas vuelven a la pen, `released = false`, se re-aplica la temporización escalonada.

**Out of scope (para futuras specs):**

- Modo scatter/chase.
- Power pellets y modo asustado.
- Ajuste de temporización por nivel o dificultad progresiva.

## Modelo de datos

```js
// maze.js — se añade releaseDelay a cada entrada de GHOST_STARTS
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'hunter',  releaseDelay: 0 },   // sale primero
  { x: 14, y: 14, kind: 'ambush',  releaseDelay: 60 },  // ~1 s
  { x: 11, y: 14, kind: 'flank',   releaseDelay: 180 }, // ~3 s
  { x: 16, y: 14, kind: 'shy',     releaseDelay: 300 }, // ~5 s
];

// game.js — propiedades nuevas por fantasma (dentro de createGame):
ghosts: GHOST_STARTS.map( ( g, i ) => ( {
  x: g.x,
  y: g.y,
  dir: 'up',
  speed: GHOST_SPEED,
  kind: g.kind,
  released: false,                    // nuevo
  releaseFrame: g.releaseDelay,       // frames hasta liberación
  penDir: 'up',                       // dirección de oscilación en la pen
} ) )

// game.js — contador global de frames (nuevo, en createGame):
frameCount: 0
```

Sin estructuras adicionales. El contador `frameCount` se incrementa cada llamada a `update`.

## Plan de implementación

1. **`maze.js`**: añadir `releaseDelay` a las 4 entradas de `GHOST_STARTS`. Verificación: el juego carga sin errores; el mapa no cambia.

2. **`game.js`**: en `createGame`, añadir `released: false`, `releaseFrame`, `penDir` a cada fantasma y `frameCount: 0` al game. Verificación: consola sin errores.

3. **`game.js`**: implementar `moveInPen( game, g )` — mueve al fantasma solo en dirección `penDir` (arriba o abajo). Si `penDir` es `'up'` y no puede moverse arriba, invierte a `'down'` (y viceversa). Si `penDir` es `'up'` y `g.y ≤ 12`, marca `g.released = true`. Verificación: los 4 fantasmas oscilan dentro de la pen sin salir.

4. **`game.js`**: modificar `moveGhost` — si `!g.released`, llamar `moveInPen` en vez de `decideGhost`. Verificación: fantasmas oscilan; al pasar ~5 s el sale primero, luego el segundo, etc.

5. **`game.js`**: incrementar `game.frameCount` en `update`, y decrementar `releaseFrame` de cada fantasma no liberado. Cuando `releaseFrame <= 0`, marcar `released = true` directamente (ypassa a IA normal sin esperar llegar a y ≤ 12). Verificación: el hunter sale primero, el shy sale último.

6. **`game.js`**: en `resetPositions`, resetear `released = false`, `releaseFrame = g.releaseDelay` y `penDir = 'up'` para cada fantasma, usando el valor de `GHOST_STARTS`. Verificación: al morir, los fantasmas vuelven a la pen y repiten la secuencia de salida.

## Criterios de aceptación

- [ ] Al iniciar la partida, los 4 fantasmas están visibles dentro de la pen, oscilando arriba-abajo.
- [ ] El hunter (rojo) sale de la pen primero (~0 frames de espera).
- [ ] El ambush (rosa) sale después del hunter (~60 frames).
- [ ] El flank (cyan) sale después del ambush (~180 frames).
- [ ] El shy (naranja) sale último (~300 frames).
- [ ] Un fantasma liberado se mueve con su IA de kind correspondiente (hunter persigue, ambush embosca, etc.).
- [ ] Al morir Pac-Man, todos los fantasmas vuelven a la pen y repiten la secuencia de salida.
- [ ] La oscilación dentro de la pen es visible (suben y bajan, no están estáticos).
- [ ] Consola sin errores durante una partida completa ganada o perdida.

## Decisiones

- **Sí:** temporización escalonada por fantasma con `releaseDelay` en frames. Fiel al arcade original.
- **Sí:** oscilación up/down en la pen para fantasmas no liberados. Más visual y fiel.
- **No:** "eaten" state (fantasma muerto vuelve a la pen en modo eyes). Requiere spec propia con power pellets.
- **No:** variar delays por nivel. Un solo conjunto de delays; niveles son otra spec.
- **Sí:** `frameCount` en el game object. Contador global simple; no necesita estructura separada.
- **Sí:** reset completo de estados de pen al morir Pac-Man. Reproducibilidad: misma secuencia cada vez.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El pen interior (y=13-14) es estrecho y la oscilación se ve rápida | `PEN_SPEED` separada (ej. 0.0625 = 1/16 celda/frame, mitad de `GHOST_SPEED`). Más lenta dentro de la pen. |
| `releaseFrame` puede no alinearse con llegada a y ≤ 12 | Se usa `releaseFrame` como liberación directa (sin depender de posición). La oscilación es solo visual. |
| Al morir, fantasmas quedan en posiciones que no son las de GHOST_STARTS | `resetPositions` fuerza `x, y` exactos de `GHOST_STARTS`, igual que hoy. |

## Lo que **no** está en esta spec

- Modo scatter/chase.
- Power pellets y modo asustado.
- Variación de temporización por nivel.
- Eyes mode (fantasma muerto regresa a la pen).

Cada uno, si aterriza algún día, va en su propia spec.
