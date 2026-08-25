// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame
const AMBUSH_AHEAD = 4;     // celdas delante de Pacman para el objetivo de 'ambush'
const FLANK_AHEAD = 2;      // celdas delante de Pacman antes de reflejar respecto al hunter
const SHY_THRESHOLD = 8;    // distancia Manhattan a la que 'shy' se retira a su esquina

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      released: false,
      releaseFrame: g.releaseDelay,
      penDir: 'up',
    } ) ),
    frameCount: 0,
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Selector comun de direccion hacia un objetivo: elige la direccion valida
// (sin media vuelta salvo callejon) que minimiza la distancia Manhattan al
// objetivo. Desempate estable: gana la primera en orden left/right/up/down.
function chooseDir( grid, g, target ) {
  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ OPPOSITE[ g.dir ] ];
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

// Objetivo del fantasma segun su kind (celda de referencia de chooseDir).
function ghostTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  if ( g.kind === 'hunter' ) {
    return { x: px, y: py };
  }
  if ( g.kind === 'ambush' ) {
    const d = DIRS[ p.dir ];
    return { x: px + d.x * AMBUSH_AHEAD, y: py + d.y * AMBUSH_AHEAD };
  }
  // Punto FLANK_AHEAD celdas delante de Pacman reflejado respecto al hunter
  // (game.ghosts[0], vector tipo Inky/Blinky). Orden de GHOST_STARTS contractual.
  if ( g.kind === 'flank' ) {
    const d = DIRS[ p.dir ];
    const ax = px + d.x * FLANK_AHEAD;
    const ay = py + d.y * FLANK_AHEAD;
    const ref = game.ghosts[ 0 ];
    return { x: ax + ( ax - Math.round( ref.x ) ), y: ay + ( ay - Math.round( ref.y ) ) };
  }
  // Persigue a Pacman; si le pone a SHY_THRESHOLD o menos, huye a su esquina
  // inferior-izquierda (el selector solo compara distancias; no hace falta
  // que la celda sea transitable).
  if ( g.kind === 'shy' ) {
    const dist = Math.abs( px - Math.round( g.x ) ) + Math.abs( py - Math.round( g.y ) );
    if ( dist <= SHY_THRESHOLD ) {
      return { x: 0, y: game.grid.length - 1 };
    }
    return { x: px, y: py };
  }
  return { x: px, y: py };
}

// Mueve al fantasma dentro de la pen: oscila arriba/abajo.
// Si penDir es 'up' y esta en y<=12, se libera.
function moveInPen( game, g ) {
  const grid = game.grid;
  if ( !canMove( grid, g.x, g.y, g.penDir, 'ghost' ) ) {
    g.penDir = g.penDir === 'up' ? 'down' : 'up';
  }
  if ( g.penDir === 'up' && g.y <= 12 ) {
    g.released = true;
    return;
  }
  const d = DIRS[ g.penDir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
}

// Despacho total por kind: todo fantasma decide con chooseDir hacia su objetivo.
function decideGhost( game, g ) {
  g.dir = chooseDir( game.grid, g, ghostTarget( game, g ) );
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( !g.released ) {
    moveInPen( game, g );
    return;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.released = false;
    g.releaseFrame = GHOST_STARTS[ i ].releaseDelay;
    g.penDir = 'up';
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.frameCount++;
  game.ghosts.forEach( ( g ) => {
    if ( !g.released ) {
      g.releaseFrame--;
      if ( g.releaseFrame <= 0 ) g.released = true;
    }
  } );

  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
