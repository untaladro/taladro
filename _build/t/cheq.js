/* 4.3 — El chequeo emocional del lado de la vista.
   Lo que el motor no puede contestar, y son tres cosas que se romperían en silencio:

   1. Que los tres dibujos tengan **ángulos distintos**. Si alguien toca el `rotate` y los
      tres quedan iguales, la escala deja de ser ordinal y la variable se muere — sin
      error, con los tres botones ahí y el usuario apretando cualquiera.
   2. Que el dibujo de entrada **no tome el rojo del tilt ni se anime**. Son las dos
      condiciones que levantaron el bloqueo del ítem; si vuelven, dos fuentes compiten por
      el mismo trazo.
   3. Que la pregunta del cierre **no exista sin pronóstico previo**. Es lo que la mantiene
      del lado correcto del principio 3. */
require('./stub.js');
const src = require('fs').readFileSync(process.env.TALASTRAT_INLINE || '/tmp/inline.js', 'utf8');
const raw = JSON.parse(JSON.stringify(require('./fixture.js')));
raw.state.xyz.assetPositions = []; raw.orders.xyz = [];   // sin posición: aparece prepPanel
global.__raw = raw;
global.__limpio = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const extra = `
;(function(){
  const g = id => __el(id), chk = (c,m) => console.log((c?'  ok  ':'  FAIL ')+m);
  DATOS.chequeos = []; DATOS.movidas = {};
  ingest(__raw);

  const pre = g('preCheck').innerHTML;
  chk(pre.includes('cuánto te va a mover'), 'la pregunta de antes existe');
  chk((pre.match(/data-pre=/g)||[]).length === 3, 'con tres opciones');
  chk(pre.includes('sale del denominador'), 'y dice que no contestar es una opción');
  chk(pre.includes('No se guarda cómo te sentís'), 'aclarando que no guarda el nivel');
  chk(!/undefined|NaN/.test(pre), 'sin NaN');

  /* 1. Los tres ángulos tienen que ser distintos y crecientes. */
  const rots = [...pre.matchAll(/rotate\\((-?[\\d.]+) /g)].map(m => +m[1]);
  chk(rots.length === 3, 'hay tres rotaciones, una por opción');
  chk(new Set(rots).size === 3, 'y las tres son distintas: ' + rots.join(', '));
  chk(rots[0] < rots[1] && rots[1] < rots[2], 'crecientes, o la escala deja de ser ordinal');
  chk(rots[0] === 0, 'la primera es el taladro derecho');

  /* 2. Las dos prohibiciones. */
  chk(!pre.includes('#c94f4f'), 'el dibujo de entrada no toma el rojo de PALETA.tilt');
  chk(!/class="[^"]*flota|class="[^"]*gira|class="bit"/.test(pre), 'y no lleva ninguna clase animada');
  chk(!pre.includes('class="brazo"'), 'sin el brazo, que apunta a cosas y acá no apunta a nada');
  /* La cara es la misma en los tres: la entrada varía el cuerpo, no la cara. */
  const caras = (pre.match(/class="face"/g)||[]).length;
  chk(caras === 3, 'los tres llevan cara');
  const bocas = [...pre.matchAll(/M27 27\\.5 h8/g)].length;
  chk(bocas === 3, 'y es la misma en los tres — seco, impasible');

  /* 3. La pregunta del cierre no existe sin pronóstico. */
  chk(g('postCheck').classList.contains('hide'), 'sin pronóstico previo, el cierre no pregunta nada');

  console.log('');
  console.log('  ángulos: ' + rots.join('° · ') + '°');
  console.log('  ' + __limpio(pre).slice(0, 150));
})();
`;
eval(src + extra);
