/* 3.3 — El presupuesto tiene dos estados y los dos se ven acá.

   Antes esta prueba solo miraba la barra encendida, porque la pieza siempre calculaba:
   sacaba el stop típico de las perdedoras y eso nunca falta. Ahora sale de la holgura
   observada, que tiene cobertura parcial por diseño, así que **apagada es el estado más
   probable al principio** y es el que hay que verificar con más cuidado: una pieza que
   desaparece sin decir nada se lee como un bug. */
require('./stub.js');
const src = require('fs').readFileSync(process.env.TALASTRAT_INLINE || '/tmp/inline.js', 'utf8');
const raw = JSON.parse(JSON.stringify(require('./fixture.js')));
raw.state.xyz.assetPositions = []; raw.state.xyz.marginSummary.accountValue = '3.42'; raw.orders.xyz = [];
global.__raw = raw;
global.__limpio = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const extra = `
;(function(){
  const g = id => __el(id), chk = (c,m) => console.log((c?'  ok  ':'  FAIL ')+m);

  // --- sin holgura observada: apagada, y explicando ---
  DATOS.holguras = {};
  ingest(__raw);
  const off = g('presu').innerHTML;
  chk(off.includes('está apagado'), 'sin holgura observada la barra se apaga');
  chk(off.includes('5 posiciones observadas'), 'y dice qué le falta');
  chk(/llevás\\s*<b>0<\\/b>/.test(off), 'con el conteo actual');
  chk(off.includes('tautología'), 'y por qué no se calcula con lo que hay');
  chk(!/undefined|NaN/.test(off), 'sin NaN — el conteo salía NaN cuando holguraHist no tiene observadas');
  chk(!off.includes('class="pb"'), 'y no dibuja una barra vacía');

  // --- con cinco observadas: enciende ---
  const T = TRADES.filter(t => !t.open).slice(-6);
  DATOS.holguras = {};
  T.forEach((t, i) => { DATOS.holguras[t.id] = {
    coin: t.coin, desde: t.entryTime, hasta: t.exitTime, n: 3, estuvoSinStop: false,
    ratio: 0.4, distStop: 2 + (i % 3) * 0.5, distLiq: 6, lev: 20 }; });
  ingest(__raw);
  const on = g('presu').innerHTML;
  chk(on.includes('class="pb"'), 'con seis observadas vuelve la barra');
  chk(on.includes('class="ult"'), 'y la tira de las últimas 5');
  chk(on.includes('Tus últimas 5'), 'diciendo de cuántas es la mediana');
  /* Punto y no coma: los porcentajes de la app usan toFixed, igual que distStop. */
  chk(/stop típico de [\\d.,]+%/.test(on), 'con el stop típico');
  /* Lo que cambió y no puede volver atrás sin que alguien se entere. */
  chk(on.includes('te vi poner'), 'y el rótulo dice que el stop es el observado, no el de tus perdedoras');
  chk(!/undefined|NaN/.test(on), 'sin NaN');

  console.log('');
  console.log('  apagada: ' + __limpio(off).slice(0, 120));
  console.log('  prendida: ' + __limpio(on).slice(0, 150));
})();
`;
eval(src + extra);
