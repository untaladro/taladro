/* 4.7 y 4.1 del lado de la vista.

   Lo que el motor no puede contestar, y son las restricciones que **son** las piezas:

   1. El panel de "recién cerraste" **no puede terminar en el calculador de tamaño**. Si
      terminara ahí, la app habría creado un malestar cuya salida es operar. Descansar tiene
      que ser la salida obvia de esa pantalla.
   2. El hueco abierto **no puede llevar color de estado ni aparecer en la boca de Taladrín**.
      El día que alguien le ponga un umbral y un rojo, dejó de medir y pasó a reprochar —
      y eso no rompe ningún test del motor. */
require('./stub.js');
const src = require('fs').readFileSync(process.env.TALASTRAT_INLINE || '/tmp/inline.js', 'utf8');
const raw = JSON.parse(JSON.stringify(require('./fixture.js')));
raw.state.xyz.assetPositions = []; raw.orders.xyz = [];   // sin posición abierta
global.__raw = raw;
global.__limpio = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const extra = `
;(function(){
  const g = id => __el(id), chk = (c,m) => console.log((c?'  ok  ':'  FAIL ')+m);
  DATOS.vistoUlt = null;
  ingest(__raw);

  /* **El bug que costó caro y no lo agarraba ningún test del motor.** La fixture tiene un
     trade abierto en los fills y ninguna posición en el estado — que es exactamente lo que
     pasa en los segundos entre que cerrás y que llega el fill de cierre. Antes, en esa
     ventana la app anunciaba "recién cerraste" con la operación anterior, de otro
     símbolo: pasó de verdad con un short de BTC que se anunció como DRAM. */
  chk(g('despPanel').classList.contains('hide'),
    'con los fills atrasados no se anuncia nada, en vez de nombrar la operación equivocada');
  chk(momento(SBASE, [], null).desfasado === true, 'y el motor lo marca como desfasado');
  /* Con algo abierto tampoco hay hueco: estás adentro, y eso no es un hueco de cero. */
  chk(g('huecoAb').innerHTML === '', 'ni se muestra el hueco abierto');

  /* Ahora el caso normal: sin nada abierto en los fills. */
  const raw2 = JSON.parse(JSON.stringify(__raw));
  const abierto = TRADES.filter(t => t.open).map(t => t.coin);
  raw2.fills = raw2.fills.filter(f => !abierto.includes(f.coin));
  ingest(raw2);
  const d = g('despPanel').innerHTML;
  chk(!g('despPanel').classList.contains('hide'), 'sin nada abierto y con una cerrada, aparece');
  chk(d.includes('Recién cerraste'), 'con su título');
  chk(d.includes('Anotado'), 'y un botón para darla por leída');
  chk(!/undefined|NaN/.test(d), 'sin NaN');
  /* La restricción que define el ítem. */
  chk(!/id="stopPct"|id="riesgo"|Calcul|habilita/i.test(d),
    'no termina en el calculador de tamaño: la salida de esta pantalla no es operar');
  chk(d.includes('lo que hagas ahora no lo cambia'), 'y lo dice explícito');

  // se apaga al anotarla, sin ningún umbral de tiempo
  g('despOk').onclick();
  chk(g('despPanel').classList.contains('hide'), 'una vez anotada se va, sin esperar un reloj');

  // --- 4.1 ---
  /* El render con la cuenta plana, armado a mano: lo que importa verificar del lado de la
     vista no es el número —eso lo cubre el motor— sino cómo está pintado. */
  const T = TRADES.filter(t => !t.open);
  renderHueco({ trades: T, nOpen: 0 });
  const h = g('huecoAb').innerHTML;
  chk(h.includes('que no abrís una'), 'con la cuenta plana sí se muestra');
  chk(h.includes('class="hueco mut"'), 'siempre en --mut');
  /* Ningún color de estado, nunca. */
  chk(!/\\b(up|down|warn|alerta)\\b/.test(h), 'sin ninguna clase de color de estado');
  chk(!/undefined|NaN/.test(h), 'sin NaN');
  /* Y Taladrín no lo menciona jamás. */
  const voz = (g('dice').innerHTML || '') + (g('tal').className || '');
  chk(!/hueco|sin operar|no abrís/i.test(voz), 'y Taladrín no habla del hueco');

  console.log('');
  console.log('  hueco: ' + __limpio(h));
})();
`;
eval(src + extra);
