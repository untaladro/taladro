/* 3.1 — El techo de pérdida declarado, del lado de la vista.
   Lo que el motor no puede contestar: que el bloque exista, que diga los dos números
   cuando hay deriva, y —lo que más importa— que el calculador de tamaño arranque en el
   techo declarado y no en el promedio observado. Esa es la diferencia práctica del ítem
   y es la que se rompería en silencio: `#riesgo` solo se prellena si está vacío. */
require('./stub.js');
const src = require('fs').readFileSync(process.env.TALASTRAT_INLINE || '/tmp/inline.js', 'utf8');
const raw = JSON.parse(JSON.stringify(require('./fixture.js')));
raw.state.xyz.assetPositions = []; raw.orders.xyz = [];   // sin posición abierta: aparece prepPanel
global.__raw = raw;
global.__limpio = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const extra = `
;(function(){
  const g = id => __el(id), chk = (c,m) => console.log((c?'  ok  ':'  FAIL ')+m);

  // --- sin declarar ---
  DATOS.banda = null;
  ingest(__raw);
  const sin = g('bandaDecl').innerHTML;
  chk(sin.includes('Techo de pérdida'), 'el campo para declarar existe');
  chk(sin.includes('Declarar'), 'y el boton invita a escribir el numero');
  chk(!sin.includes('Sacar'), 'sin nada declarado no hay nada que sacar');
  chk(sin.includes('se mueve con tus pérdidas'), 'dice por que la referencia de hoy es floja');
  chk(!/undefined|NaN/.test(sin), 'sin NaN');
  const riesgoObs = g('riesgo').value;

  // --- con un techo declarado muy por debajo de lo que viene perdiendo ---
  DATOS.banda = { banda: 0.01, desde: Date.now() };
  g('riesgo').value = '';
  ingest(__raw);
  const con = g('bandaDecl').innerHTML;
  chk(con.includes('Lo escribiste vos'), 'dice que el numero es suyo');
  chk(con.includes('Sacar'), 'y se puede sacar');
  chk(con.includes('por encima del techo'), 'con deriva, lo dice');
  chk(con.includes('US$0.01') || con.includes('0.01'), 'con el techo declarado al lado');
  chk(g('_qs.bdec') !== undefined, 'el bloque se pudo montar');
  chk(!/undefined|NaN/.test(con), 'sin NaN con deriva');

  /* La que importa: el calculador arranca del techo. Si alguien vuelve a poner
     \`s.adherence.rec.avgLoss\` acá, esto es lo unico que se entera. */
  chk(g('riesgo').value === '0.01',
    'el calculador de tamano arranca en el techo declarado, no en el promedio ('+g('riesgo').value+')');
  chk(riesgoObs !== g('riesgo').value, 'y sin declarar arrancaba en otro numero ('+riesgoObs+')');

  console.log('');
  console.log('  ' + __limpio(con));
})();
`;
eval(src + extra);
