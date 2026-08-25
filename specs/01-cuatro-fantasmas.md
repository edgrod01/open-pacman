# SPEC 01 — Cuatro fantasmas con personalidades clásicas

> **Estado:** Aprovado
> **Depende de:** ninguna
> **Fecha:** 2026-08-24
> **Objetivo:** Tener 4 fantasmas en juego, cada uno con una IA de movimiento propia estilo arcade, uno de ellos persiguiendo directamente a Pac-Man.

## Alcance

**In:**

- Ampliar `GHOST_STARTS` de 2 a 4 fantasmas con kinds: `hunter`, `ambush`, `flank`, `shy`.
- `hunter` (rojo): persecución directa por distancia Manhattan (lógica existente).
- `ambush` (rosa): objetivo = celda de Pac-Man + 4 celdas en su dirección actual.
- `flank` (cyan): objetivo = punto 2 celdas delante de Pac-Man reflejado respecto a la posición del `hunter` (vector tipo Inky/Blinky).
- `shy` (naranja): persigue a Pac-Man; si está a distancia Manhattan ≤ 8, retrocede hacia su esquina inferior-izquierda.
- Eliminar el comportamiento `random` actual.
- Selector común: elegir dirección válida (sin media vuelta salvo callejón) que minimice la distancia Manhattan al objetivo del kind.

**Out of scope (para futuras specs):**

- Power pellets y modo asustado.
- Ciclo temporizado scatter/chase.
- Salida escalonada de la pen.
- Ajuste de dificultad/niveles.

## Modelo de datos

```js
// maze.js — GHOST_STARTS pasa de 2 a 4 entradas
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'hunter' }, // índice 0: referencia de 'flank'
  { x: 14, y: 14, kind: 'ambush' },
  { x: 11, y: 14, kind: 'flank' },
  { x: 16, y: 14, kind: 'shy' },
];
```

Sin estructuras nuevas adicionales: cada fantasma ya tiene `kind`; el objetivo se calcula por frame dentro de `decideGhost`. Velocidad única `GHOST_SPEED = 0.1` (sin cambios). Colores ya definidos por índice en `GHOST_COLORS` (`src/js/render.js:147`), sin cambios.

## Plan de implementación

1. `maze.js`: ampliar `GHOST_STARTS` a las 4 entradas anteriores. Verificación: abrir `src/index.html`, ver 4 fantasmas de colores distintos moviéndose (los nuevos caen temporalmente en la rama aleatoria).
2. `game.js`: extraer la lógica del `hunter` a un helper común `chooseDir( grid, g, target )` (sin media vuelta salvo callejón, desempate estable en orden left/right/up/down) y hacer que `hunter` lo use. Verificación: el rojo se comporta igual que antes.
3. Implementar objetivo de `ambush` (Pac-Man + 4 en su dirección) y despacho por `kind`. Verificación: el rosa corta el paso por delante de Pac-Man.
4. Implementar objetivo de `flank` usando `game.ghosts[0]` como referencia. Verificación: el cyan intenta rodear por el lado opuesto al rojo.
5. Implementar `shy` (umbral 8 celdas + retirada a esquina) eliminando la rama `random` de `decideGhost`, que queda total por kinds. Verificación: el naranja se acerca y huye al ponérsele cerca.

## Criterios de aceptación

- [ ] En partida hay exactamente 4 fantasmas, con colores `#ff0000`, `#00ffff`, `#ffb8ff`, `#ffb852`.
- [ ] El rojo reduce su distancia Manhattan a Pac-Man en cada cruce posible y nunca invierte marcha salvo callejón.
- [ ] El rosa se sitúa por delante de Pac-Man (objetivo ≈ 4 celdas según su dirección).
- [ ] El cyan calcula su objetivo a partir de la posición del rojo y tiende a flanquear.
- [ ] El naranja se retira cuando su distancia a Pac-Man es ≤ 8 celdas y se acerca cuando es mayor.
- [ ] Ningún fantasma se mueve aleatoriamente: misma secuencia de teclas ⇒ mismos movimientos de fantasmas.
- [ ] Paredes y puerta se respetan igual que hoy; colisión quita vida y reinicia posiciones sin regresiones.
- [ ] Consola sin errores durante una partida completa ganada o perdida.

## Decisiones

- **Sí:** personalidades clásicas arcade (directo/emboscada/flanqueo/tímido). Distintas entre sí y reconocibles.
- **No:** conservar el fantasma `random`. Una IA determinista cumple mejor "cada uno con forma propia"; el random se elimina.
- **Sí:** un único helper de dirección-hacia-objetivo compartido por los 4 kinds; solo cambia la función de objetivo. Menos duplicación.
- **Sí:** `flank` referencia siempre a `ghosts[0]` (el hunter), como Inky usa a Blinky. Orden de `GHOST_STARTS` contractual.
- **Sí:** salida inmediata de la pen y velocidad única 0.1. Sin estados extra.
- **No:** scatter/chase ni modo asustado. Los pellets no existen; merecen spec propia.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Con 4 fantasmas la partida puede ser demasiado difícil | Partida completa de prueba al terminar; ajuste puntual de `GHOST_SPEED` o del umbral del `shy` si es injugable |
| Objetivos fuera del tablero (borde en `ambush`, esquina del `shy`) | El selector solo compara distancias; no requiere celda transitable |

## Lo que **no** está en esta spec

- Power pellets y modo asustado.
- Ciclo scatter/chase.
- Salida escalonada de la pen.
- Niveles y dificultad progresiva.

Cada uno, si aterriza algún día, va en su propia spec.
