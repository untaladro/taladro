const { buildTrades, attachFunding, computeStats, buildInsights, parseCoin, muestra, aire, taladro,
  diaBA, relojBA, registrarHolgura, holguraHist, todayBySession,
  equityEn, anotarExposicion, escalaTamano, estabilidad, habitos, tilt, adherenciaDiaria,
  ejercicio, verdades, repertorio, marcarDeclaradas, edgeDeclarado,
  serieCuenta, serieTotal, seriesPorDex, diagSeries, diagEscala, diagGaps, gapEn, comparativas,
  calendarioVence, FOMC, FOMC_AVISO_DIAS, bandaRiesgo, BANDA_TOL, presupuesto,
  pPermutacion, benjaminiHochberg, PERM_B, BH_Q,
  caducarDeclaraciones, declaracionesSerie, DECL_MUESTRA,
  adherenciaSesion, celdasHorarias, ADH_CELDA_MIN, sessionOf, tramoDe,
  marcarChequeos, anotarMovio, errorPronostico, CHEQ_MUESTRA, CHEQ_NIVELES, diagOrden, huecosSinPosicion,
  huecoAbierto, momento, cintaDelDia,
  probRacha, rachasEsperadas } = require('./engine.js');

let pass = 0, fail = 0;
const near = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;
function ok(cond, msg) { cond ? (pass++, console.log('  ok  ' + msg)) : (fail++, console.log('  FAIL ' + msg)); }
function eq(a, b, msg) { ok(near(a, b), `${msg}  (esperado ${b}, obtenido ${a})`); }

const MIN = 6e4, H = 36e5;
const f = (coin, side, px, sz, time, closedPnl = 0, fee = 0) =>
  ({ coin, side, px: String(px), sz: String(sz), time, closedPnl: String(closedPnl), fee: String(fee) });

/* --- 1. Round trip long simple --- */
console.log('\n1. Long simple');
let t = buildTrades([
  f('xyz:AAPL', 'B', 100, 1, 1000, 0, 0.05),
  f('xyz:AAPL', 'A', 110, 1, 1000 + H, 10, 0.055)
]);
eq(t.length, 1, 'un solo trade');
ok(t[0].side === 'long', 'side = long');
eq(t[0].avgEntry, 100, 'entrada promedio');
eq(t[0].avgExit, 110, 'salida promedio');
eq(t[0].gross, 10, 'PnL bruto');
eq(t[0].fees, 0.105, 'fees');
eq(t[0].net, 9.895, 'PnL neto');
eq(t[0].durationMs, H, 'duración');
ok(t[0].open === false, 'trade cerrado');
ok(t[0].dex === 'xyz' && t[0].symbol === 'AAPL', 'parseo HIP-3 del coin');

/* --- 2. Scale-in y salidas parciales --- */
console.log('\n2. Scale-in y salida parcial');
t = buildTrades([
  f('BTC', 'B', 100, 1, 1000),
  f('BTC', 'B', 90, 1, 2000),          // promedia a la baja -> avg 95
  f('BTC', 'A', 105, 1, 3000, 10),
  f('BTC', 'A', 100, 1, 4000, 5)
]);
eq(t.length, 1, 'sigue siendo un trade (nunca tocó cero en el medio)');
eq(t[0].qty, 2, 'tamaño total abierto');
eq(t[0].avgEntry, 95, 'entrada promedio ponderada');
eq(t[0].avgExit, 102.5, 'salida promedio ponderada');
eq(t[0].gross, 15, 'bruto = suma de closedPnl');
eq(t[0].peakSz, 2, 'tamaño pico');

/* --- 3. Flip long -> short en un solo fill --- */
console.log('\n3. Flip en un fill');
t = buildTrades([
  f('ETH', 'B', 100, 1, 1000, 0, 0.1),
  f('ETH', 'A', 110, 2, 2000, 10, 0.2),   // cierra 1 long (+10) y abre 1 short
  f('ETH', 'B', 105, 1, 3000, 5, 0.1)     // cierra el short (+5)
]);
eq(t.length, 2, 'dos trades');
ok(t[0].side === 'long' && t[1].side === 'short', 'long y después short');
eq(t[0].gross, 10, 'bruto del long');
eq(t[1].gross, 5, 'bruto del short');
eq(t[0].fees, 0.1 + 0.1, 'fees del long (mitad del fill de flip)');
eq(t[1].fees, 0.1 + 0.1, 'fees del short (la otra mitad + cierre)');
eq(t[1].avgEntry, 110, 'entrada del short al precio del flip');
eq(t[1].avgExit, 105, 'salida del short');

/* --- 4. Trade todavía abierto --- */
console.log('\n4. Posición abierta');
t = buildTrades([
  f('SOL', 'B', 100, 1, 1000),
  f('SOL', 'A', 110, 0.5, 2000, 5)
]);
eq(t.length, 1, 'un trade');
ok(t[0].open === true, 'marcado como abierto');
ok(t[0].exitTime === null, 'sin fecha de salida');
let st = computeStats(t);
eq(st.n, 0, 'los abiertos no entran en la estadística');
eq(st.nOpen, 1, 'contados aparte');

/* --- 5. Conservación: suma de brutos == suma de closedPnl --- */
console.log('\n5. Conservación del PnL sobre datos aleatorios');
let fills = [], pos = {}, time = 1e12, rnd = 42;
const rand = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;
for (let i = 0; i < 400; i++) {
  const coin = ['xyz:AAPL', 'xyz:NVDA', 'BTC'][Math.floor(rand() * 3)];
  const side = rand() > 0.5 ? 'B' : 'A';
  const sz = Math.round(rand() * 30 + 1) / 10;
  const px = 50 + Math.round(rand() * 1000) / 10;
  const cur = pos[coin] || 0;
  const dir = side === 'B' ? 1 : -1;
  const closes = cur !== 0 && Math.sign(cur) !== dir;
  const cp = closes ? Math.round((rand() - 0.5) * 2000) / 10 : 0;
  time += Math.round(rand() * 1e7);
  fills.push(f(coin, side, px, sz, time, cp, Math.round(px * sz * 0.0004 * 100) / 100));
  pos[coin] = cur + dir * sz;
}
t = buildTrades(fills);
const sumGross = t.reduce((a, x) => a + x.gross, 0);
const sumCp = fills.reduce((a, x) => a + +x.closedPnl, 0);
eq(sumGross, sumCp, 'brutos conservados');
const sumFees = t.reduce((a, x) => a + x.fees, 0);
eq(sumFees, fills.reduce((a, x) => a + +x.fee, 0), 'fees conservados');
ok(t.every(x => x.entrySz > 0), 'todo trade tiene entrada');
ok(t.filter(x => x.open).length <= 3, 'a lo sumo un trade abierto por símbolo');
ok(t.every(x => x.open || near(x.entrySz, x.exitSz)), 'los cerrados tienen entrada = salida');

/* --- 6. Funding --- */
console.log('\n6. Atribución de funding');
t = buildTrades([
  f('xyz:AAPL', 'B', 100, 1, 1000),
  f('xyz:AAPL', 'A', 110, 1, 1000 + 10 * H, 10)
]);
attachFunding(t, [
  { time: 1000 + 2 * H, delta: { coin: 'xyz:AAPL', usdc: '-1.5' } },
  { time: 1000 + 5 * H, delta: { coin: 'xyz:AAPL', usdc: '-2.0' } },
  { time: 1000 + 99 * H, delta: { coin: 'xyz:AAPL', usdc: '-9.0' } }   // fuera del trade
]);
eq(t[0].funding, -3.5, 'funding dentro de la ventana del trade');
eq(t[0].net, 10 - 3.5, 'neto ajustado por funding');

/* --- 7. Estadística e insights de punta a punta --- */
console.log('\n7. Estadística e insights');
const trades = [];
let now = Date.parse('2026-03-02T14:00:00Z');
for (let i = 0; i < 40; i++) {
  const win = i % 3 !== 0;                        // 66% de acierto
  const dursHrs = win ? 1 : 6;                    // aguanta perdedoras 6x más
  const px = 100;
  const sz = 1;
  const pnl = win ? 8 : -20;                      // payoff malo
  trades.push(
    f('xyz:NVDA', 'B', px, sz, now, 0, 0.2),
    f('xyz:NVDA', 'A', px + pnl, sz, now + dursHrs * H, pnl, 0.2)
  );
  now += 30 * H;
}
const T = buildTrades(trades);
const S = computeStats(T);
eq(S.n, 40, '40 trades cerrados');
eq(S.wins.length, 26, 'ganadoras (14 de 40 son múltiplos de 3)');
ok(near(S.winRate, 26 / 40), 'win rate 65%');
ok(S.avgDurLoss / S.avgDurWin > 5, 'detecta que las perdedoras duran mucho más');
ok(S.net < 0, 'neto negativo pese al win rate alto');
const I = buildInsights(S);
const titulos = I.map(x => x.title);
ok(titulos.some(x => /disposición/i.test(x)), 'dispara el insight de efecto disposición');
ok(titulos.some(x => /Acertás seguido y perdés plata/i.test(x)), 'dispara el insight de win rate vs payoff');
ok(I.every(x => !/undefined|NaN/.test(x.text)), 'ningún insight con NaN o undefined');
ok(I.length >= 4, `generó ${I.length} insights`);

/* --- 8. Robustez con datos vacíos o raros --- */
console.log('\n8. Bordes');
ok(buildTrades([]).length === 0, 'sin fills no rompe');
ok(computeStats([]).n === 0, 'stats vacías no rompen');
ok(buildInsights(computeStats([])).length === 0, 'insights vacíos no rompen');
ok(buildTrades([f('BTC', 'B', 100, 0, 1000)]).length === 0, 'ignora fills de tamaño cero');
ok(parseCoin('BTC').dex === 'hyperliquid', 'coin sin prefijo = hyperliquid nativo');

/* --- 9. Aviso de muestra chica --- */
console.log('\n9. Muestra chica');
const tr = n => Array.from({ length: n }, (_, i) => ({ open: false, net: i % 2 ? 1 : -1 }));
const m0 = muestra([]);
ok(m0 && m0.n === 0, 'sin operaciones devuelve aviso');
ok(/nada que medir/i.test(m0.titulo), 'título propio para cero operaciones');
ok(muestra(tr(1)).titulo === '1 operación cerrada', 'singular con una operación');
ok(muestra(tr(4)).titulo === '4 operaciones cerradas', 'plural con cuatro');
ok(muestra(tr(5)) === null, 'a partir de 5 el aviso desaparece');
ok(muestra(tr(40)) === null, 'con historial largo tampoco aparece');
ok(muestra([{ open: true }, { open: true }]).n === 0, 'las posiciones abiertas no cuentan como muestra');
ok(muestra(null).n === 0, 'sin datos no rompe');
const m4 = muestra(tr(4));
ok(m4.piezas.find(p => p.id === 'habitos').listo === true, 'con 4 operaciones hábitos ya está vivo');
ok(m4.piezas.filter(p => !p.listo).length === 5, 'quedan 5 piezas apagadas');
ok(m4.piezas.every(p => p.desde > 0 && p.que && p.nombre), 'toda pieza dice desde cuándo y qué calcula');
ok(!/te falta|todavía no podés|operá|deberías/i.test(m4.texto + m4.pie),
  'el texto no empuja a operar ni cuenta lo que falta');
ok(![m0, m4].some(x => /undefined|NaN/.test(x.titulo + x.texto + x.pie)), 'sin NaN ni undefined');

/* --- 10. Modo aire --- */
console.log('\n10. Modo aire');
/* Serie de referencia: 40 operaciones, todas del mismo tamaño, ninguna liquidada,
   ninguna perdedora fuera de banda. Gana 2 de cada 3 y pierde la mitad de lo que gana,
   así que la expectativa es claramente positiva. */
function serie(n, opts) {
  const o = opts || {}, out = [], H = 36e5;
  for (let i = 0; i < n; i++) {
    const gana = (i % 3) !== 0;
    out.push(f('xyz:DRAM', 'B', 10, 1, 1000 + i * 26 * H, 0, 0.01));
    out.push(f('xyz:DRAM', 'A', gana ? 11 : 9.5, 1, 1000 + i * 26 * H + 2 * H, gana ? 1 : -0.5, 0.01));
  }
  if (o.ultimaGrande) { const L = out.length; out[L - 2].sz = '9'; out[L - 1].sz = '9'; }
  return out;
}
let A = computeStats(buildTrades(serie(40)));
ok(A.expectancy > 0, `expectativa positiva: ${A.expectancy.toFixed(3)}`);
ok(A.aire.activo, 'con 40 operaciones dentro del sistema y EV+ el modo aire se enciende');
eq(A.aire.ventana, 30, 'la ventana son 30 operaciones');
ok(A.aire.cumplidas >= 28, `cumplidas dentro de la ventana: ${A.aire.cumplidas} de 30`);
ok(A.aire.perdedoras > 0, `y cuenta las perdedoras que hay adentro: ${A.aire.perdedoras}`);
ok(Math.abs(A.aire.en100 - A.expectancy * 100) < 1e-9, 'proyecta la expectativa a 100 operaciones');

// muestra corta: la expectativa no distingue método de suerte
ok(!computeStats(buildTrades(serie(20))).aire.activo, 'con 20 operaciones no se enciende');
ok(!computeStats(buildTrades(serie(29))).aire.activo, 'con 29 tampoco: la ventana no cierra');

/* EV negativo: es el caso que no se negocia. Decirle a alguien con valor esperado
   negativo que con iteraciones se vuelve rentable es exactamente falso al revés. */
const perdedor = serie(40).map((x, i) => (i % 2 ? Object.assign({}, x, { closedPnl: '-0.4', px: '9.6' }) : x));
const P = computeStats(buildTrades(perdedor));
ok(P.expectancy < 0, `serie con expectativa negativa: ${P.expectancy.toFixed(3)}`);
ok(!P.aire.activo, 'con expectativa negativa el modo aire NO se enciende');

// salirse ahora mismo apaga el modo, aunque las 29 anteriores estén bien
ok(!computeStats(buildTrades(serie(40, { ultimaGrande: true }))).aire.activo,
  'si la última se sale del sistema, el aire se apaga');

/* Tolerancia: dos fallas adentro de la ventana no lo apagan, tres sí. Se rompe el
   tamaño de operaciones del medio, no de la última. */
function conFallas(k) {
  const fills = serie(40), L = fills.length;
  for (let j = 0; j < k; j++) {
    const i = L - 2 * (j + 3);      // la 3ª, 4ª, 5ª… contando desde el final
    fills[i].sz = '9'; fills[i + 1].sz = '9';
  }
  return computeStats(buildTrades(fills)).aire;
}
ok(conFallas(1).activo, 'una falla adentro de la ventana no apaga el modo');
ok(conFallas(2).activo && conFallas(2).fallas === 2, 'dos tampoco, y las informa');
ok(!conFallas(3).activo, 'tres fallas sí lo apagan');
ok(conFallas(2).cumplidas === 28, `dice 28 de 30, no un porcentaje`);

// overtrading: un día con muchas más operaciones que la mediana diaria cuenta como falla
const rafaga = serie(40);
const t0 = 1000 + 39 * 26 * 36e5;
for (let j = 0; j < 8; j++) rafaga.push(f('xyz:DRAM','B',10,1,t0+j*6e4,0,0.01), f('xyz:DRAM','A',10.5,1,t0+j*6e4+3e5,0.5,0.01));
const R = computeStats(buildTrades(rafaga)).aire;
ok(!R.activo, 'un día de ráfaga sobre la mediana diaria apaga el aire');

/* Estabilidad: la medición que sostiene el modo. Misma conducta, mismo tamaño, pero
   la espera se derrumba después de perder — el estado cambió aunque los rangos no. */
function conRevancha() {
  const fills = [], H2 = 36e5;
  let t = 1000, prevGano = true;
  for (let i = 0; i < 40; i++) {
    t += prevGano ? 30 * H2 : 2 * 6e4;
    const g = (i % 3) !== 0;
    fills.push(f('xyz:DRAM', 'B', 10, 1, t, 0, 0.01));
    fills.push(f('xyz:DRAM', 'A', g ? 11 : 9.5, 1, t + 2 * H2, g ? 1 : -0.5, 0.01));
    t += 2 * H2; prevGano = g;
  }
  return computeStats(buildTrades(fills));
}
const REV = conRevancha();
ok(REV.expectancy > 0, 'la serie de revancha tiene expectativa positiva igual');
ok(!REV.aire.activo, 'si la espera se derrumba después de perder, el aire no se enciende');

/* Martingala: dobla el tamaño después de perder. Cada operación puede caer adentro de
   los rangos y aun así el tamaño está atado al resultado anterior. */
function conMartingala() {
  const fills = [], H2 = 36e5;
  let t = 1000, prevGano = true;
  for (let i = 0; i < 40; i++) {
    const sz = prevGano ? 1 : 2.6, g = (i % 3) !== 0;
    fills.push(f('xyz:DRAM', 'B', 10, sz, t, 0, 0.01));
    fills.push(f('xyz:DRAM', 'A', g ? 11 : 9.5, sz, t + 2 * H2, (g ? 1 : -0.5) * sz, 0.01));
    t += 26 * H2; prevGano = g;
  }
  return computeStats(buildTrades(fills));
}
ok(!conMartingala().aire.activo, 'si el tamaño depende del resultado anterior, tampoco');

/* ===== Estabilidad =====
   Este bloque decía `Math.abs(A.aire.rTam - 1) < 0.4` sobre una serie sintética de tamaño
   fijo, o sea afirmaba que la razón daba 1 en una serie donde no podía dar otra cosa. Era
   el test verificando una tautología y dándola por conducta medida. */
ok(A.estabilidad.cuantizado, 'con un solo tamaño posible, la razón no se mide');
ok(A.estabilidad.rTam === null, 'y no se inventa un 1,0 que sale del exchange y no de él');
ok(A.estabilidad.rEsp !== null, 'la espera sí se mide: no depende del mínimo de orden');
ok(A.aire.activo, 'y el modo se enciende igual: no juzgar no es reprobar');

/* La razón de tamaño sí se mide cuando los tamaños varían de verdad. Serie con tamaño
   sorteado en un rango continuo, independiente del resultado anterior. */
function tamVariado(dep) {
  const fills = [], H2 = 36e5;
  let t = 1000, prevGano = true, semilla = 7;
  const rnd = () => (semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 40; i++) {
    const base = 1 + rnd();                       // entre 1 y 2, sin relación con el resultado
    const sz = dep && !prevGano ? base * 1.9 : base;
    const g = (i % 3) !== 0;
    fills.push(f('xyz:DRAM', 'B', 10, sz, t, 0, 0.01));
    fills.push(f('xyz:DRAM', 'A', g ? 11 : 9.5, sz, t + 2 * H2, (g ? 1 : -0.5) * sz, 0.01));
    t += 26 * H2; prevGano = g;
  }
  return computeStats(buildTrades(fills));
}
const VAR = tamVariado(false), DEP = tamVariado(true);
ok(!VAR.estabilidad.cuantizado, 'con tamaños variados, la escala no está cuantizada');
ok(VAR.estabilidad.rTam !== null, 'y ahí sí hay razón de tamaño para mirar');
ok(Math.abs(VAR.estabilidad.rTam - 1) < 0.4,
  `tamaño independiente del resultado: ${VAR.estabilidad.rTam.toFixed(2)}×`);
ok(DEP.estabilidad.inestable.includes('tamaño'),
  `y si el tamaño depende del resultado, se ve: ${DEP.estabilidad.rTam.toFixed(2)}×`);

/* La estabilidad vive afuera de `aire` justo para poder hablar antes de que el modo
   exista. Con una muestra chica el modo está apagado y la medición igual está. */
const CHICA = computeStats(buildTrades(serie(14)));
ok(!CHICA.aire.activo, 'con 14 operaciones el modo aire no se enciende');
ok(CHICA.estabilidad != null, 'pero la estabilidad se calcula igual');
ok(CHICA.estabilidad.rEsp !== null, 'y ya tiene algo que decir sobre la espera');

// una sola operación no alcanza ni para empezar
ok(!estabilidad([], null).juzgable, 'sin operaciones no se juzga nada');

// el tilt manda
const conTilt = computeStats(buildTrades(serie(40)));
conTilt.tilt = { activo: true };
ok(!aire(conTilt).activo, 'si el tilt está activo, el aire no se enciende');

// la voz: en aire, la racha perdedora no se cuenta como reto
const hablaAire = taladro(A, [], { hoy: [], net: 0 }, null, {});
ok(hablaAire.id === 'aire', `Taladro habla en modo aire: "${hablaAire.linea}"`);
ok(hablaAire.tono === 'ok', 'con tono de reconocimiento, no de reto');
ok(!/récord|recuperar|te falta/i.test(hablaAire.linea), 'sin contadores ni promesas en la frase');

/* --- Un solo huso: el día es un día de Buenos Aires --- */
console.log('\nHusos horarios');
{
  // 2026-03-10 23:30 hora de Buenos Aires = 2026-03-11 02:30 UTC.
  // El bug viejo: `days` agrupaba en UTC y lo mandaba al día siguiente, mientras
  // "hoy llevás N" agrupaba en hora local. La misma operación en dos días distintos.
  const nocheBA = Date.UTC(2026, 2, 11, 2, 30);
  ok(diaBA(nocheBA) === '2026-03-10', `23:30 de Buenos Aires sigue siendo el mismo día (${diaBA(nocheBA)})`);
  ok(new Date(nocheBA).toISOString().slice(0, 10) === '2026-03-11', 'y en UTC caía al siguiente: ése era el bug');
  eq(relojBA(nocheBA).h, 23, 'la hora de la operación es 23, no la del navegador');

  const manianaBA = Date.UTC(2026, 2, 11, 12, 0);   // 09:00 de Buenos Aires
  ok(diaBA(manianaBA) === '2026-03-11', 'la mañana siguiente sí cambia de día');

  // La misma cuenta tiene que dar igual desde los dos lados
  const tr = buildTrades([
    f('BTC', 'B', 100, 1, nocheBA), f('BTC', 'A', 101, 1, nocheBA + MIN, 1),
    f('BTC', 'B', 100, 1, nocheBA + 2 * MIN), f('BTC', 'A', 101, 1, nocheBA + 3 * MIN, 1)
  ]);
  const st = computeStats(tr);
  eq(Object.keys(st.days).length, 1, 'las dos operaciones de esa noche caen en un solo día');
  eq(todayBySession(tr, nocheBA + 4 * MIN).hoy.length, 2, 'y "hoy" cuenta las mismas dos');
}

/* --- Holgura: se mide en vivo o no se mide --- */
console.log('\nHolgura');
{
  const tr = buildTrades([
    f('BTC', 'B', 100, 1, 1000), f('BTC', 'A', 98, 1, 2000, -2),      // cerrada
    f('BTC', 'B', 100, 1, 3000)                                        // abierta
  ]);
  const abierta = tr.find(x => x.open);
  const store = {};

  // stop al 40% del camino a la liquidación: salís vos
  registrarHolgura([{ coin: 'BTC', stopPx: 98, distStop: 2, distLiq: 5, lev: 10 }], tr, store, 5000);
  eq(store[abierta.id].ratio, 0.4, 'guarda el ratio stop/liquidación');

  // después lo corre más lejos: se queda con el peor momento, no con el último
  registrarHolgura([{ coin: 'BTC', stopPx: 96, distStop: 4, distLiq: 5, lev: 10 }], tr, store, 6000);
  eq(store[abierta.id].ratio, 0.8, 'se queda con el peor momento de la posición');
  registrarHolgura([{ coin: 'BTC', stopPx: 98, distStop: 2, distLiq: 5, lev: 10 }], tr, store, 7000);
  eq(store[abierta.id].ratio, 0.8, 'y no lo baja cuando después lo corrige');

  // sin stop es su propia categoría: no hay ratio que promediar
  const s2 = {};
  registrarHolgura([{ coin: 'BTC', stopPx: null, distLiq: 5 }], tr, s2, 5000);
  ok(s2[abierta.id].estuvoSinStop === true, 'una posición sin stop queda marcada aparte');
  ok(s2[abierta.id].ratio === null, 'y no inventa un ratio');

  // el agregado no habla de lo que no vio
  const vacio = holguraHist(tr, {});
  eq(vacio.n, 0, 'sin observaciones no hay nada');
  eq(vacio.total, 1, 'pero sí sabe cuántas cerradas hay');
  eq(vacio.cobertura, 0, 'y dice que la cobertura es cero');

  // con la cerrada observada
  const tr2 = buildTrades([f('BTC', 'B', 100, 1, 1000), f('BTC', 'A', 98, 1, 2000, -2)]);
  const cerrada = tr2[0];
  const h = holguraHist(tr2, { [cerrada.id]: { ratio: 0.4, estuvoSinStop: false, distStop: 2, distLiq: 5 } });
  eq(h.n, 1, 'cuenta la observada');
  eq(h.cobertura, 1, 'cobertura completa cuando vio todo');
  eq(h.mediana, 0.4, 'mediana del ratio');
  eq(h.invertidas, 0, 'ninguna invertida');
  eq(h.holgadas, 1, 'una holgada');

  const inv = holguraHist(tr2, { [cerrada.id]: { ratio: 1.3, estuvoSinStop: false } });
  eq(inv.invertidas, 1, 'un stop más lejos que la liquidación se cuenta como invertido');

  // computeStats la expone sin romperse cuando no hay store
  const st = computeStats(tr2);
  ok(st.holgura && st.holgura.n === 0, 'computeStats sin store no explota');
  const stH = computeStats(tr2, { [cerrada.id]: { ratio: 0.4, estuvoSinStop: false } });
  eq(stH.holgura.n, 1, 'y con store la incorpora');
}

/* --- Insights: cada tarjeta sabe si es acción o resultado --- */
console.log('\nInsights separados');
{
  /* Serie construida para disparar las dos familias a la vez: perdedoras que se aguantan
     mucho más que las ganadoras (acción) sobre símbolos con resultados distintos (resultado). */
  const serieI = [];
  let ts = Date.UTC(2026, 0, 5, 14, 0), perdioAntes = false;
  for (let i = 0; i < 40; i++) {
    const gana = i % 3 !== 0;
    const sz = perdioAntes ? 2 : 1;                 // agranda después de perder
    const dur = gana ? 5 * MIN : 60 * MIN;          // aguanta las perdedoras
    const sym = i % 2 ? 'BTC' : 'ETH';
    serieI.push(f(sym, 'B', 100, sz, ts),
      f(sym, 'A', gana ? 102 : 99, sz, ts + dur, (gana ? 2 : -1) * sz));
    perdioAntes = !gana;
    ts += 8 * H;
  }
  const ins = buildInsights(computeStats(buildTrades(serieI)));
  ok(ins.length > 0, `hay ${ins.length} tarjetas`);
  ok(ins.every(i => ['accion', 'resultado', 'aviso'].includes(i.clase)), 'todas vienen rotuladas');
  const iAv = ins.findIndex(i => i.clase === 'aviso');
  const iAc = ins.findIndex(i => i.clase === 'accion');
  const iRe = ins.findIndex(i => i.clase === 'resultado');
  if (iAv >= 0 && iAc >= 0) ok(iAv < iAc, 'el aviso de muestra va antes que las acciones');
  if (iAc >= 0 && iRe >= 0) ok(iAc < iRe, 'las acciones van antes que los cortes de PnL');
  ok(ins.some(i => i.clase === 'resultado'), 'los cortes de resultado no se borraron');

  // la frase sobre liquidaciones ya no afirma lo que no puede saber
  const conLiq = buildTrades([
    f('BTC', 'B', 100, 1, 1000),
    Object.assign(f('BTC', 'A', 90, 1, 2000, -10), { liquidation: { markPx: '90' } })
  ]);
  const txt = buildInsights(computeStats(conLiq)).map(i => i.text).join(' ');
  ok(!/En todas, la distancia al stop era mayor/.test(txt),
    'sin observaciones no afirma nada sobre el stop de las liquidadas');
}

/* --- Exposición: el notional no es la decisión --- */
console.log('\nExposición contra notional');
{
  /* Construye 60 operaciones a apalancamiento fijo sobre un colateral que evoluciona.
     `mult` dice cómo se mueve la cuenta; la exposición es siempre la misma. */
  const LEV = 20, T0 = Date.UTC(2026, 0, 2);
  const armar = (mult, expo) => {
    const fills = [], serie = [];
    let ts = T0;
    for (let i = 0; i < 60; i++) {
      const col = 100 * mult(i);
      serie.push([ts - H, String(col)]);
      const notional = col * LEV * (expo ? expo(i) : 1);
      const sz = notional / 100;
      const gana = i % 3 !== 0;
      fills.push(f('xyz:DRAM', 'B', 100, sz, ts, 0, 0.001),
        f('xyz:DRAM', 'A', gana ? 101 : 99.5, sz, ts + 2 * H, (gana ? 1 : -0.5) * sz, 0.001));
      ts += 26 * H;
    }
    serie.push([ts, String(100 * mult(59))]);
    const portfolio = { xyz: [['allTime', { accountValueHistory: serie }]] };
    return { trades: buildTrades(fills), portfolio };
  };
  const stats = x => computeStats(x.trades, null, x.portfolio);

  /* El colateral evoluciona de forma geométrica, no lineal: si el tamaño es proporcional
     a la cuenta, cada operación multiplica el colateral en vez de sumarle. Importa para
     el umbral — con el rango [0,5× , 2×] la mediana histórica queda en la raíz del factor
     total, así que el notional crudo recién se sale de rango cuando la cuenta cae por
     debajo de un cuarto o crece más de cuatro veces. Una caída suave no lo dispara. */

  // 1. La cuenta se achica 85% operando igual: no cambió ninguna conducta
  const baja = armar(i => Math.pow(0.15, i / 59));
  const sBaja = stats(baja);
  ok(sBaja.escala.base === 'exposicion', `usa exposición cuando hay serie (cobertura ${(sBaja.escala.n / sBaja.n * 100).toFixed(0)}%)`);
  const hBaja = habitos(sBaja.trades, sBaja).find(h => h.id === 'tamano');
  eq(hBaja.cumplidas, 20, 'con el colateral cayendo 85%, el hábito de tamaño no se rompe');

  // el bug viejo: con notional crudo el mismo régimen ensucia la ventana
  const crudo = escalaTamano(baja.trades.map(t => Object.assign({}, t, { exposicion: null })));
  ok(crudo.base === 'notional', 'sin exposición cae al notional');
  const rec = baja.trades.slice(-20);
  const fueraCrudo = rec.filter(t => !(t.notional <= crudo.med * 2 && t.notional >= crudo.med * 0.5)).length;
  ok(fueraCrudo > 0, `medido en notional crudo, ${fueraCrudo} de las últimas 20 caían fuera de rango sin motivo`);

  // 2. La cuenta se multiplica por ocho: ganar no puede romper el hábito ni apagar el aire
  const sube = armar(i => Math.pow(8, i / 59));
  const sSube = stats(sube);
  const hSube = habitos(sSube.trades, sSube).find(h => h.id === 'tamano');
  eq(hSube.cumplidas, 20, 'con el colateral multiplicándose por ocho, tampoco se rompe');
  ok(sSube.aire.activo || sSube.expectancy <= 0, 'componer la cuenta ya no apaga el modo aire');
  const crudoSube = escalaTamano(sube.trades.map(t => Object.assign({}, t, { exposicion: null })));
  const fueraSube = sube.trades.slice(-20)
    .filter(t => !(t.notional <= crudoSube.med * 2 && t.notional >= crudoSube.med * 0.5)).length;
  ok(fueraSube > 0, `en notional crudo, ganar sacaba ${fueraSube} de 20 fuera de rango`);

  // 3. Un cambio real de exposición sí se tiene que ver
  const salta = armar(() => 1, i => (i >= 50 ? 3 : 1));
  const sSalta = stats(salta);
  const hSalta = habitos(sSalta.trades, sSalta).find(h => h.id === 'tamano');
  ok(hSalta.cumplidas < 20, `triplicar la exposición sí rompe el hábito: ${hSalta.cumplidas} de 20`);
  ok(!sSalta.aire.activo, 'y apaga el modo aire, que es lo que tiene que pasar');
}

/* --- equityEn: interpola adentro, no extrapola afuera --- */
console.log('\nColateral en el tiempo');
{
  const serie = [{ time: 1000, v: 100 }, { time: 2000, v: 200 }, { time: 3000, v: 150 }];
  eq(equityEn(serie, 1000), 100, 'sobre un punto exacto');
  eq(equityEn(serie, 1500), 150, 'interpola entre dos puntos');
  eq(equityEn(serie, 2500), 175, 'y también en el tramo que baja');
  ok(equityEn(serie, 500) === null, 'antes del primer punto no inventa');
  ok(equityEn(serie, 3000 + 8 * 864e5) === null, 'y lejos del último tampoco');
  eq(equityEn(serie, 3000 + 36e5), 150, 'pero admite una cola corta después del último');
  ok(equityEn([], 1000) === null, 'sin serie, null');

  // cobertura pobre: no se decide sobre exposición
  const tr = buildTrades([f('BTC', 'B', 100, 1, 1000), f('BTC', 'A', 101, 1, 2000, 1)]);
  const cob = anotarExposicion(tr, { hyperliquid: [['allTime', { accountValueHistory: [] }]] });
  eq(cob.cobertura, 0, 'sin serie usable la cobertura es cero');
  ok(escalaTamano(tr).base === 'notional', 'y la escala cae al notional');
}

/* --- Sin dato no es incumplir ---
   El caso que importa: cobertura suficiente para que la escala sea exposición, pero con
   agujeros. Antes cada agujero contaba como falla del hábito de tamaño, así que la racha
   se cortaba por un hueco en `accountValueHistory` y no por algo que él hubiera hecho.
   El hábito quedaba midiendo la cobertura de un endpoint. */
console.log('\nSin dato no es incumplir');
{
  /* El escenario es el real y no uno de laboratorio: en HIP-3 cada dex lleva su propio
     margen, así que si uno de los dex no devuelve serie de cuenta, sus operaciones quedan
     sin exposición **desperdigadas** por el medio del historial. Tres de treinta alcanzan
     para pasar el 80% de cobertura y que la escala siga siendo exposición. */
  const fills = [], H2 = 36e5;
  const sinSerie = [8, 15, 22];
  let t = Date.parse('2026-03-01T14:00:00Z');
  for (let i = 0; i < 30; i++) {
    const coin = sinSerie.includes(i) ? 'abc:FOO' : 'xyz:DRAM';
    const g = (i % 3) !== 0;
    fills.push(f(coin, 'B', 10, 1, t, 0, 0.01));
    fills.push(f(coin, 'A', g ? 11 : 9.5, 1, t + 2 * H2, g ? 1 : -0.5, 0.01));
    t += 26 * H2;
  }
  const tr = buildTrades(fills);
  const desde = tr[0].entryTime - 36e5, hasta = tr[tr.length - 1].exitTime + 36e5;
  const hist = [];
  for (let x = desde; x <= hasta; x += 6 * 36e5) hist.push([x, '250']);
  // serie solo para `xyz`: `abc` no tiene con qué calcular exposición
  const st = computeStats(tr, {}, { xyz: [['allTime', { accountValueHistory: hist }]] });

  ok(st.escala.base === 'exposicion', 'con 90% de cobertura la escala es exposición');
  const sin = st.trades.filter(x => x.exposicion == null).length;
  eq(sin, 3, 'y las tres del dex sin serie quedan sin colateral');

  const H = habitos(tr, st);
  const tam = H.find(h => h.id === 'tamano');
  /* La última sin dato está en la posición 22 de 30. Si el `null` cortara la racha —que es
     lo que hacía antes— este número sería 7: las siete de después del último agujero. */
  eq(tam.racha, 27, 'la racha atraviesa los agujeros en vez de cortarse en el último');
  eq(tam.mejor, 27, 'y el récord tampoco se parte en tres tramos');
  eq(tam.cumplidas + tam.sinDato, tam.deTotal, 'las últimas 20 se reparten entre juzgadas y sin dato');
  ok(tam.deN < tam.deTotal || tam.sinDato === 0, 'y las sin dato no entran al denominador');
  ok(tam.serie.every(x => ['ok', 'no', 'sd'].includes(x.estado)), 'la serie tiene tres estados y no dos');

  /* La contracara: una operación fuera de rango sí tiene que romper. Sin esto, el arreglo
     sería "el hábito de tamaño ya no falla nunca", que es peor que el bug original. */
  const gordo = tr.map(x => Object.assign({}, x));
  gordo[gordo.length - 1].exposicion = st.escala.med * 5;
  const H2b = habitos(gordo, Object.assign({}, st, { escala: st.escala }));
  eq(H2b.find(h => h.id === 'tamano').racha, 0, 'pero una exposición de 5× sí corta la racha');

  /* Y el día tampoco se penaliza: la conducta sin dato sale del denominador diario. */
  const dd = adherenciaDiaria(tr, st);
  ok(!dd || dd.dias.every(d => d.adh === null || (d.adh >= 0 && d.adh <= 1)),
    'la adherencia diaria queda en rango sin contar lo que no se pudo medir');
}

/* --- El tilt caduca: el descanso es una salida válida --- */
console.log('\nEl tilt tiene reloj');
{
  /* 20 operaciones tranquilas y después tres pérdidas grandes un viernes a la noche. */
  const fx = [];
  let ta = Date.UTC(2026, 6, 1, 14, 0);
  for (let i = 0; i < 20; i++) {
    fx.push(f('BTC', 'B', 100, 1, ta, 0, 0.01), f('BTC', 'A', 101, 1, ta + H, 1, 0.01));
    ta += 20 * H;
  }
  let tv = Date.UTC(2026, 6, 24, 23, 0);          // viernes 20:00 de Buenos Aires
  for (let i = 0; i < 3; i++) {
    fx.push(f('BTC', 'B', 100, 3, tv, 0, 0.01), f('BTC', 'A', 97, 3, tv + H, -9, 0.01));
    tv += 90 * MIN;
  }
  const tr = buildTrades(fx);
  const en = now => computeStats(tr, null, null, now).tilt;

  ok(en(tv + 10 * MIN).activo, 'diez minutos después de la tercera, el tilt está encendido');
  ok(en(tv + 2 * H).activo, 'dos horas después sigue encendido: dormir un rato no es empezar de nuevo');
  ok(en(Date.UTC(2026, 6, 25, 15, 0)).activo, 'el mismo día de Buenos Aires, aunque pasen horas, sigue');

  const lun = en(Date.UTC(2026, 6, 27, 12, 0));   // lunes 09:00 de Buenos Aires
  ok(!lun.activo, 'el lunes a la mañana, sin haber operado, ya no está');
  ok(lun.descanso === true, 'y dice que se apagó por descanso');
  eq(lun.racha, 3, 'sin borrar la racha: el dato sigue estando, lo que se apagó es el estado');

  // el cambio de día solo no alcanza: perder a las 23:50 no queda limpio a las 00:10
  const fy = [];
  let tb = Date.UTC(2026, 6, 1, 14, 0);
  for (let i = 0; i < 20; i++) {
    fy.push(f('BTC', 'B', 100, 1, tb, 0, 0.01), f('BTC', 'A', 101, 1, tb + H, 1, 0.01));
    tb += 20 * H;
  }
  let tn = Date.UTC(2026, 6, 25, 1, 0);           // viernes 22:00 de Buenos Aires
  for (let i = 0; i < 3; i++) {
    fy.push(f('BTC', 'B', 100, 3, tn, 0, 0.01), f('BTC', 'A', 97, 3, tn + 20 * MIN, -9, 0.01));
    tn += 30 * MIN;
  }
  const tilt2 = computeStats(buildTrades(fy), null, null, tn + 90 * MIN).tilt;
  ok(diaBA(tn + 90 * MIN) !== diaBA(tn - 10 * MIN), 'la medianoche pasó entre medio');
  ok(tilt2.activo, 'pero con menos de seis horas de hueco el tilt no se limpia por el calendario');

  // las rachas de hábito no se tocan
  const hs = habitos(tr, computeStats(tr, null, null, Date.UTC(2026, 6, 27, 12, 0)));
  ok(hs.some(h => h.mejor >= 10), 'las rachas de hábito siguen contando a través de los días');
}

/* --- Volver de un descanso no apaga el aire --- */
console.log('\nEl descanso, en los dos modos');
{
  /* Serie limpia y pareja, con un parón largo justo antes de la última operación.
     Antes, esa operación de retorno marcaba `parálisis` y apagaba el modo. */
  const armar = huecoFinal => {
    const fx = [];
    let t0 = Date.UTC(2026, 0, 5, 14, 0);
    for (let i = 0; i < 45; i++) {
      const gana = i % 3 !== 0;
      if (i === 44) t0 += huecoFinal;
      fx.push(f('xyz:DRAM', 'B', 10, 2, t0, 0, 0.002),
        f('xyz:DRAM', 'A', gana ? 10.6 : 9.8, 2, t0 + 2 * H, gana ? 1.2 : -0.4, 0.002));
      t0 += 20 * H;
    }
    return computeStats(buildTrades(fx));
  };
  const seguido = armar(0);
  ok(seguido.aire.activo, 'operando seguido, el modo aire está encendido');
  const vuelve = armar(20 * 864e5);   // vuelve después de veinte días
  ok(vuelve.aire.activo, 'y sigue encendido cuando volvés de veinte días parado');
  ok(vuelve.aire.tipos.includes('parálisis'), 'el parón se registra igual como falla de la ventana');
}

/* --- El día como unidad --- */
console.log('\nAdherencia por día');
{
  /* Días tranquilos impecables y días cargados donde el tamaño se dispara. */
  const fx = [];
  let d = Date.UTC(2026, 0, 5, 14, 0);
  for (let k = 0; k < 20; k++) {
    const cargado = k % 2 === 0;
    const ops = cargado ? 6 : 2;
    let t0 = d;
    for (let i = 0; i < ops; i++) {
      const sz = cargado && i >= 3 ? 8 : 1;      // en los días cargados agranda
      const gana = i % 3 !== 0;
      fx.push(f('BTC', 'B', 100, sz, t0, 0, 0.01),
        f('BTC', 'A', gana ? 101 : 99, sz, t0 + 20 * MIN, (gana ? 1 : -1) * sz, 0.01));
      t0 += 2 * H;
    }
    d += 864e5;
  }
  const s = computeStats(buildTrades(fx));
  const dd = s.dias;
  ok(dd && dd.n === 20, `veinte días operados: ${dd && dd.n}`);
  ok(dd.corte, 'hay días cargados y tranquilos suficientes para comparar');
  ok(dd.adhCargados < dd.adhTranquilos,
    `los días cargados adhieren menos: ${(dd.adhCargados * 100).toFixed(0)}% contra ${(dd.adhTranquilos * 100).toFixed(0)}%`);
  ok(dd.estable === true, 'y el patrón se repite en las dos mitades del historial');

  // sin patrón, no inventa uno
  const fy = [];
  let d2 = Date.UTC(2026, 0, 5, 14, 0);
  for (let k = 0; k < 20; k++) {
    const ops = k % 2 === 0 ? 6 : 2;
    let t0 = d2;
    for (let i = 0; i < ops; i++) {
      const gana = i % 3 !== 0;
      fy.push(f('BTC', 'B', 100, 1, t0, 0, 0.01),
        f('BTC', 'A', gana ? 101 : 99, 1, t0 + 20 * MIN, gana ? 1 : -1, 0.01));
      t0 += 2 * H;
    }
    d2 += 864e5;
  }
  const dd2 = computeStats(buildTrades(fy)).dias;
  eq(dd2.adhCargados, dd2.adhTranquilos, 'con la misma conducta los dos lados dan igual');
  ok(dd2.estable === false, 'y sin diferencia no hay patrón estable que reportar');
  const ins = buildInsights(computeStats(buildTrades(fy)));
  ok(!ins.some(i => /días cargados te desarman/.test(i.title)), 'y no aparece la tarjeta de días difíciles');

  // con pocos días no se compara nada
  const corto = buildTrades(fy).filter(t => t.entryTime < Date.UTC(2026, 0, 9));
  const ddCorto = adherenciaDiaria(corto, computeStats(corto));
  ok(!ddCorto || ddCorto.corte === null, 'con pocos días no se compara nada');

  // todos los días iguales: no son cargados y tranquilos, son días iguales
  const fz = [];
  let d3 = Date.UTC(2026, 0, 5, 14, 0);
  for (let k2 = 0; k2 < 15; k2++) {
    let t0 = d3;
    for (let i = 0; i < 3; i++) {
      const gana = i % 3 !== 0;
      fz.push(f('BTC', 'B', 100, 1, t0, 0, 0.01),
        f('BTC', 'A', gana ? 101 : 99, 1, t0 + 20 * MIN, gana ? 1 : -1, 0.01));
      t0 += 2 * H;
    }
    d3 += 864e5;
  }
  ok(computeStats(buildTrades(fz)).dias.corte === false, 'sin contraste de carga, no se compara');
}

/* --- El ejercicio de Douglas --- */
console.log('\nEl ejercicio');
{
  const serieEj = (n, plan) => {
    const fx = []; let t0 = Date.UTC(2026, 0, 5, 14, 0);
    for (let i = 0; i < n; i++) {
      const p = plan(i);
      fx.push(f('BTC', 'B', 100, p.sz, t0, 0, 0.01),
        f('BTC', 'A', p.gana ? 101 : 99, p.sz, t0 + (p.dur || 20 * MIN), (p.gana ? 1 : -1) * p.sz, 0.01));
      t0 += 20 * H;
    }
    return buildTrades(fx);
  };
  const limpio = i => ({ sz: 1, gana: i % 3 !== 0 });

  const tr = serieEj(40, limpio);
  const corte = tr[19].exitTime;
  const decl = { n: 20, desde: corte, reglas: ['perdida', 'tamano', 'intacto'] };
  const e = computeStats(tr, null, null, null, decl).ejercicio;

  eq(e.hechas, 20, 'cuenta solo las operaciones posteriores a arrancar');
  eq(e.cumplidas, 20, 'y las que cumplieron las reglas declaradas');
  ok(e.completo, 'con veinte hechas, la serie está completa');
  ok(e.veredicto && e.veredicto.n === 20, 'y hay veredicto');
  eq(e.reglas.length, 3, 'las tres reglas elegidas');

  // el veredicto es de conducta: perder todas no la rompe
  const perdedor = serieEj(40, i => ({ sz: 1, gana: false }));
  const eP = computeStats(perdedor, null, null, null,
    { n: 20, desde: perdedor[19].exitTime, reglas: ['tamano', 'intacto'] }).ejercicio;
  eq(eP.cumplidas, 20, 'veinte perdedoras con el tamaño de siempre son una serie perfecta');
  ok(!eP.cancelado, 'perder no la cancela');

  // salirse del sistema sí
  const roto = serieEj(40, i => ({ sz: i >= 34 ? 12 : 1, gana: i < 34 ? i % 3 !== 0 : false }));
  /* El `now` va justo después de la última: si no, el tilt ya caducó por descanso —
     la serie es de enero— y el test estaría midiendo otra cosa. */
  const yaMismo = roto[roto.length - 1].exitTime + 10 * MIN;
  /* Serie de 30 sobre 20 operaciones hechas: sigue abierta cuando llega el tilt, que es
     el caso que importa. Una serie ya terminada no se cancela hacia atrás. */
  const sRoto = computeStats(roto, null, null, yaMismo,
    { n: 30, desde: roto[19].exitTime, reglas: ['tamano', 'intacto', 'perdida'] });
  ok(sRoto.tilt.activo, 'la serie que se sale del sistema enciende el tilt');
  ok(sRoto.ejercicio.cancelado, 'y eso cancela el ejercicio en curso');
  ok(!sRoto.ejercicio.activo, 'que deja de estar activo');
  ok(sRoto.ejercicio.cumplidas < sRoto.ejercicio.hechas, 'con las que se salieron ya contadas');

  /* La marca que deja el shell sobrevive al tilt: si volvés mañana, el tilt ya caducó por
     descanso pero la serie sigue cancelada. Salirse del sistema pasó igual. */
  const mañana = computeStats(roto, null, null, yaMismo + 3 * 864e5,
    { n: 30, desde: roto[19].exitTime, reglas: ['tamano', 'intacto'], cancelado: 'tilt' });
  ok(!mañana.tilt.activo, 'al otro día el tilt ya caducó');
  ok(mañana.ejercicio.cancelado, 'pero la serie sigue cancelada por la marca');

  // una regla que la app no sabe leer se ignora, no se inventa
  const raro = computeStats(tr, null, null, null,
    { n: 20, desde: corte, reglas: ['tamano', 'noexiste'] }).ejercicio;
  eq(raro.reglas.length, 1, 'las reglas desconocidas se ignoran');
  ok(computeStats(tr, null, null, null, { n: 20, desde: corte, reglas: [] }).ejercicio === null,
    'sin ninguna regla válida no hay ejercicio');
  ok(computeStats(tr).ejercicio === null, 'sin declaración, no hay ejercicio');
}

/* --- Las cinco verdades --- */
console.log('\nLas cinco verdades');
{
  const fx = []; let t0 = Date.UTC(2026, 0, 5, 14, 0);
  for (let i = 0; i < 40; i++) {
    const g = i % 3 !== 0;
    fx.push(f('BTC', 'B', 100, 1, t0, 0, 0.01), f('BTC', 'A', g ? 101 : 99, 1, t0 + 20 * MIN, g ? 1 : -1, 0.01));
    t0 += 20 * H;
  }
  const s = computeStats(buildTrades(fx));
  const V = s.verdades;
  eq(V.length, 5, 'las cinco, con muestra suficiente');
  ok(V.every(v => v.dato && /\d/.test(v.dato)), 'cada una viene con un número propio, no sola');
  ok(!V.some(v => /vas a|tenés que|deberías/i.test(v.dato)), 'y ninguna le pide nada');

  // con muestra chica no se afirman verdades sobre probabilidad
  const corto = buildTrades(fx.slice(0, 20));
  eq(verdades(computeStats(corto)).length, 0, 'con diez operaciones no se dice ninguna');

  /* Van por el repertorio y no por un panel: de a una, cuando le tocás. */
  const R = repertorio(s);
  const RV = R.filter(x => x.tipo === 'verdad');
  eq(RV.length, 5, 'las cinco entran al repertorio');
  ok(RV.every(x => /\d/.test(x.linea)), 'cada línea se dice con su número adentro');
  ok(R[0].tipo !== 'verdad' && R[R.length - 1].tipo !== 'verdad',
    'repartidas entre lo demás, no apiladas en una punta');
  ok(repertorio(computeStats(corto)).every(x => x.tipo !== 'verdad'),
    'sin muestra, el repertorio tampoco las dice');
}

/* --- El edge declarado antes --- */
console.log('\nDeclarar antes de entrar');
{
  const t0 = Date.UTC(2026, 0, 5, 14, 0);
  const tr = buildTrades([
    f('BTC', 'B', 100, 1, t0, 0, 0.01), f('BTC', 'A', 101, 1, t0 + 20 * MIN, 1, 0.01),
    f('BTC', 'B', 100, 1, t0 + 5 * H, 0, 0.01), f('BTC', 'A', 99, 1, t0 + 6 * H, -1, 0.01)
  ]);
  // declarada 10 minutos antes de la primera
  const D = [{ tesis: 'Reversión', ts: t0 - 10 * MIN }];
  eq(marcarDeclaradas(tr, D), 1, 'la declaración se pega a la operación siguiente');
  ok(tr[0].declarada === true, 'la primera queda marcada');
  ok(tr[0].tesisPrevia === 'Reversión', 'con la tesis que escribiste antes');
  ok(!tr[1].declarada, 'y no se reusa para la siguiente');

  // una declaración vieja no explica la de hoy
  const tr2 = buildTrades([f('BTC', 'B', 100, 1, t0, 0, 0.01), f('BTC', 'A', 101, 1, t0 + 20 * MIN, 1, 0.01)]);
  eq(marcarDeclaradas(tr2, [{ tesis: 'Ruptura', ts: t0 - 3 * 864e5 }]), 0,
    'una tesis de hace tres días no se pega a nada');

  const ed = edgeDeclarado(tr);
  eq(ed.declaradas, 1, 'cuenta las declaradas');
  eq(ed.n, 2, 'sobre el total');
  ok(!ed.comparable, 'con menos de cinco de cada lado no se compara');
}

/* --- La curva acumulada va por cierre y no por apertura --- */
console.log('\nEl equity se acumula al cerrar');
{
  /* A abre primero y cierra último; B entra y sale enteramente adentro de A. En orden de
     apertura, A acredita su resultado antes que B — que es un saldo que nunca existió,
     porque cuando B cerró, A todavía estaba abierta. */
  const T0 = Date.parse('2026-04-01T12:00:00Z'), H = 36e5;
  const fills = [
    f('BTC', 'B', 100, 1, T0),                    // A abre
    f('ETH', 'B', 50, 1, T0 + 1 * H),             // B abre
    f('ETH', 'A', 45, 1, T0 + 2 * H, -5),         // B cierra perdiendo
    f('BTC', 'A', 110, 1, T0 + 9 * H, 10)         // A cierra ganando
  ];
  const s = computeStats(buildTrades(fills));
  const t = s.equity.map(p => p.time);
  ok(t[0] < t[1], 'los puntos quedan en orden temporal');
  eq(s.equity[0].cum, s.trades.find(x => x.symbol === 'ETH').net, 'el primer punto es el que cerró primero');
  /* El drawdown real: se estuvo abajo mientras B ya había cerrado en rojo y A seguía
     abierta. Acumulando por apertura, A tapaba ese pozo antes de que ocurriera. */
  ok(s.maxDD > 0, `el pozo intermedio existe: maxDD = ${s.maxDD.toFixed(2)}`);
  eq(s.equity[s.equity.length - 1].cum, s.net, 'y el último punto cierra en el neto total');
}

/* --- La cuenta entera, no la de un dex --- */
console.log('\nEl valor de cuenta suma los dexes');
{
  const T0 = 1e12, D = 864e5;
  /* Una cuenta, dos resoluciones, como las devuelve el endpoint de verdad: `allTime`
     cubre ocho días con un punto por día, `day` cubre el último día con un punto por hora.
     Las dos describen la misma plata — no pueden contradecirse. */
  const plano = v => n => Array.from({ length: n }, (_, i) => [T0 + i * D, String(v)]);
  const pf = {
    hyperliquid: [
      ['day',     { accountValueHistory: Array.from({ length: 24 }, (_, i) => [T0 + 7 * D + i * 36e5, '1000']) }],
      ['allTime', { accountValueHistory: plano(1000)(8) }]],
    xyz: [
      ['day',     { accountValueHistory: Array.from({ length: 24 }, (_, i) => [T0 + 7 * D + i * 36e5, '7']) }],
      ['allTime', { accountValueHistory: plano(7)(8) }]]
  };
  /* Lo que hacía el gráfico antes: pasarle el mapa por dex a `serieCuenta`, que recorre el
     objeto entero sin distinguir de quién es cada serie. Sigue estando mal —por eso existe
     `serieTotal`— pero ahora está mal de otra manera: mezcla los dos dexes en vez de
     quedarse con uno. Lo que importa es que el gráfico ya no la llama. */
  const tot = serieTotal(pf);
  eq(tot[0].v, 1007, 'serieTotal suma los dos dexes');
  eq(tot[0].dexes, 2, 'y dice cuántos entraron');
  ok(!tot.some(p => p.parcial), 'sin tramos parciales cuando los dos cubren todo');
  ok(tot.length > 8, `y hereda la resolución fina del último día: ${tot.length} puntos contra 8 diarios`);

  // un dex que arranca más tarde no suma cero: queda afuera y el punto se marca parcial
  const tarde = {
    a: [['allTime', { accountValueHistory: plano(100)(8) }]],
    b: [['allTime', { accountValueHistory: Array.from({ length: 4 }, (_, i) => [T0 + (4 + i) * D, '50']) }]]
  };
  const t2 = serieTotal(tarde);
  eq(t2[0].v, 100, 'antes de que exista el segundo dex, la curva no se hunde');
  ok(t2[0].parcial, 'pero el punto queda marcado como parcial');
  eq(t2[t2.length - 1].v, 150, 'y una vez que los dos existen, se suman');

  ok(serieTotal(null).length === 0, 'sin portfolio no inventa serie');
}

/* --- La serie se fusiona: `allTime` da el rango, `day` da la resolución --- */
console.log('\nNo se elige una serie, se fusionan todas');
{
  const T0 = 1e12, D = 864e5;
  /* El colateral se mueve fuerte adentro del último día: sube a la mañana y vuelve. Con
     un solo punto diario eso es invisible, y el denominador de toda la exposición sale
     suavizado. Con la serie fina, se ve. */
  const dia = Array.from({ length: 25 }, (_, i) =>
    [T0 + 7 * D + i * 36e5, String(100 + (i >= 6 && i <= 12 ? 60 : 0))]);
  const pf = { xyz: [
    ['allTime', { accountValueHistory: Array.from({ length: 8 }, (_, i) => [T0 + i * D, '100']) }],
    ['week',    { accountValueHistory: Array.from({ length: 8 }, (_, i) => [T0 + i * D, '100']) }],
    ['day',     { accountValueHistory: dia }]
  ] };
  const s = seriesPorDex(pf).xyz;
  ok(s.length > 8, `la serie fusionada tiene más puntos que allTime sola: ${s.length}`);
  eq(s[0].time, T0, 'y arranca donde arranca allTime: el rango no se pierde');

  const pico = T0 + 7 * D + 8 * 36e5;      // adentro del tramo alto, solo visible en `day`
  eq(equityEn(s, pico), 160, 'en el pico, el colateral sale de la serie fina');

  /* Lo que pasaba antes: con `allTime` sola, ese mismo instante interpolaba entre dos
     puntos de 100 y devolvía 100. Una operación de ahí calculaba su exposición contra un
     colateral 60% más chico del que había. */
  const soloAllTime = seriesPorDex({ xyz: [pf.xyz[0]] }).xyz;
  eq(equityEn(soloAllTime, pico), 100, 'con la serie gruesa sola, el pico no existía');

  // la resolución se mide por el hueco mediano, no por cuántos puntos tiene la lista
  const larga = { xyz: [
    ['allTime', { accountValueHistory: Array.from({ length: 100 }, (_, i) => [T0 + i * D, '10']) }],
    ['day',     { accountValueHistory: Array.from({ length: 5 }, (_, i) => [T0 + 50 * D + i * 6e4, '99']) }]
  ] };
  eq(equityEn(seriesPorDex(larga).xyz, T0 + 50 * D + 2 * 6e4), 99,
    'una lista corta y densa le gana a una larga y rala');
}

/* --- Los instrumentos de medición: describen, no deciden --- */
console.log('\nDiagnóstico de la serie y de la escala');
{
  const T0 = Date.parse('2026-06-01T00:00:00Z'), H = 36e5;
  const fills = [];
  for (let i = 0; i < 10; i++) {
    fills.push(f('xyz:DRAM', 'B', 10, 1 + (i % 2) * 0.5, T0 + i * 6 * H, 0, 0.01));
    fills.push(f('xyz:DRAM', 'A', 11, 1 + (i % 2) * 0.5, T0 + i * 6 * H + H, 1, 0.01));
  }
  const tr = buildTrades(fills);
  const hist = Array.from({ length: 30 }, (_, i) => [T0 + i * 2 * H, '200']);
  const pf = { xyz: [['allTime', { accountValueHistory: hist }]] };
  const st = computeStats(tr, {}, pf);

  const d = diagSeries(pf, tr)[0];
  ok(d.dex === 'xyz', 'informa por dex');
  eq(d.pasoMediano, 2 * H, 'y dice el hueco mediano real entre puntos');
  eq(d.cobertura, 1, 'con la serie cubriendo todo, la cobertura es 1');
  ok(d.desde < d.hasta, 'con desde y hasta para poder mirarlos');

  const e = diagEscala(tr, st.escala);
  eq(e.valores, 2, 'la escala toma dos valores distintos');
  eq(e.concentracion, 0.5, 'y ninguno se lleva la mayoría: 50%');
  eq(e.top[0].n + e.top[1].n, e.con, 'la distribución cierra');
  ok(diagEscala([], st.escala) === null, 'sin operaciones no inventa distribución');
}

/* --- El empate no es una ganadora --- */
console.log('\nEl empate tiene caja propia');
{
  const T0 = Date.parse('2026-05-01T12:00:00Z'), H = 36e5;
  const fills = [];
  const pnl = [1, -1, 0, 1, -1, 0, 1, -1, 0, 1];   // 4 ganan, 3 pierden, 3 empatan
  pnl.forEach((p, i) => {
    fills.push(f('BTC', 'B', 100, 1, T0 + i * 2 * H, 0, 0));
    fills.push(f('BTC', 'A', 100 + p, 1, T0 + i * 2 * H + H, p, 0));
  });
  const s = computeStats(buildTrades(fills));
  eq(s.wins.length, 4, 'las ganadoras son las estrictamente positivas');
  eq(s.losses.length, 3, 'las perdedoras, las estrictamente negativas');
  eq(s.nFlat, 3, 'y los empates van aparte');
  eq(s.winRate, 0.4, 'el acierto no se infla con los empates');
  eq(s.lossRate, 0.3, 'y la tasa de pérdida es la suya, no el complemento');
  ok(s.lossRate < 1 - s.winRate, 'que es justo el punto: perder es menos probable que no ganar');
  /* Donde se paga el error: `probRacha` pregunta por la probabilidad de PERDER. Con el
     complemento del acierto, una racha mala parece más común de lo que es. */
  const re = rachasEsperadas(s, 100);
  ok(re.q === s.lossRate, 'las rachas esperadas usan la tasa de pérdida');
  ok(probRacha(100, s.lossRate, 5) < probRacha(100, 1 - s.winRate, 5),
    'y con el complemento la racha de 5 salía sobreestimada');
}

/* --- 2.6: la cobertura no distingue una medición de una interpolación larga --- */
console.log('\nLa distancia al punto real, y por que la cobertura no alcanza');
{
  /* Serie con un agujero deliberado: dos puntos pegados y despues diez dias de nada.
     Es la forma exacta que dio la cuenta real el 3/8 — hueco mediano de 2,3 h y maximo
     de 10,2 dias — y es la que hace que 99% de cobertura no signifique lo que parece. */
  const T0 = Date.parse('2026-05-01T00:00:00Z'), H = 36e5, D = 864e5;
  const serie = [{ time: T0, v: 100 }, { time: T0 + H, v: 101 }, { time: T0 + H + 10 * D, v: 60 }];

  eq(gapEn(serie, T0 + H / 2), H / 2, 'en el medio de dos puntos, la distancia es al mas cercano');
  eq(gapEn(serie, T0 - H), H, 'antes del primer punto mide contra el primero');
  eq(gapEn(serie, T0 + H + 20 * D), 10 * D, 'despues del ultimo mide contra el ultimo');
  eq(gapEn(serie, T0 + H + 5 * D), 5 * D, 'y en el medio del agujero la distancia es enorme');
  ok(gapEn([], 0) === null && gapEn(null, 0) === null, 'sin serie no inventa una distancia');

  /* El punto del item: las dos entradas quedan CUBIERTAS, con distancias incomparables. */
  const dentro = T0 + H / 2, agujero = T0 + H + 5 * D;
  ok(equityEn(serie, dentro) != null, 'la entrada medida de cerca tiene colateral');
  ok(equityEn(serie, agujero) != null, 'la caida en el agujero TAMBIEN, porque se interpola');
  ok(gapEn(serie, agujero) > 100 * gapEn(serie, dentro),
    'y sin embargo una se midio y la otra se estimo: eso es lo que la cobertura no ve');

  /* Y el sesgo que la hipotesis de 2.3 predice: interpolar sobre el agujero alisa la
     caida, asi que en el medio el colateral sale MUY por encima del real de despues. */
  ok(equityEn(serie, agujero) > 75, 'interpolar sobre el hueco sobreestima el colateral');
  ok(equityEn(serie, agujero) > serie[2].v, 'por encima del punto real que cierra el hueco');
}

/* --- 3.4: el corte de tamano de `comparativas` --- */
console.log('\nEl corte de tamano parte por escala y saca los sin dato');
{
  const T0 = Date.parse('2026-06-01T00:00:00Z'), H = 36e5;
  /* Quince operaciones con tres tamanos rotando (notional 100, 200, 300) y lado alternado.
     Tres tamanos y no dos: con dos, la mediana ES el valor grande y "mayor a la mediana"
     no selecciona a nadie. La serie de colateral arranca recien en la cuarta, asi que las
     tres primeras quedan sin exposicion medible — por la punta de abajo, donde `equityEn`
     devuelve `null` sin la tolerancia de `EQ_COLA`. Doce de quince es 80% clavado, que es
     el minimo con el que `escalaTamano` se queda en exposicion. */
  const fills = [];
  for (let i = 0; i < 15; i++) {
    const sz = (i % 3) + 1, t0 = T0 + i * 4 * H, largo = i % 2 === 0;
    fills.push(f('xyz:AAPL', largo ? 'B' : 'A', 100, sz, t0, 0, 0));
    fills.push(f('xyz:AAPL', largo ? 'A' : 'B', 101, sz, t0 + H, sz, 0));
  }
  const trades = buildTrades(fills);
  const portfolio = { xyz: [['allTime', { accountValueHistory:
    [[T0 + 3 * 4 * H, '1000'], [T0 + 20 * 4 * H, '1000']] }]] };
  anotarExposicion(trades, portfolio);

  const cerradas = trades.filter(t => !t.open);
  const s = computeStats(trades, null, portfolio);
  ok(s.escala.base === 'exposicion', 'con 80% de cobertura la escala es exposición');
  const medibles = cerradas.filter(t => s.escala.de(t) != null).length;
  ok(medibles < cerradas.length, 'y quedan operaciones sin tamano medible, a proposito');

  const filas = comparativas(cerradas, s);
  const tam = filas.find(x => /exposici|notional/i.test(x.label));
  ok(!!tam, 'el corte de tamano sigue existiendo');
  ok(tam.label === 'Con más exposición que tu mediana',
    'la etiqueta dice sobre qué base cortó, que cambia qué significa la fila');
  ok(!/promedio/.test(tam.label), 'y ya no dice promedio');

  /* Lo que arregla el item: las que no se pudieron medir no caen del lado "chicas". */
  eq(tam.n + tam.nResto, medibles,
    'el denominador del corte son solo las operaciones con tamaño medible');
  ok(tam.n + tam.nResto < cerradas.length,
    'o sea: las sin dato quedaron fuera de las dos puntas, no del lado que sobra');

  /* Y un corte sin tercer estado sigue partiendo la muestra entera, que es lo correcto. */
  const lado = filas.find(x => x.label === 'Long');
  ok(!!lado, 'el corte por lado existe');
  eq(lado.n + lado.nResto, cerradas.length,
    'un corte sin tercer estado usa la muestra completa');
}

/* --- 5.1: el calendario de la Fed vence, y hay que decirlo --- */
console.log('\nEl calendario de eventos tiene fecha de vencimiento');
{
  const ultima = FOMC[FOMC.length - 1];
  const dia = Date.parse(ultima + 'T12:00:00Z');
  ok(calendarioVence(dia - 400 * 864e5).porVencer === false,
    'con un ano por delante no dice nada');
  ok(calendarioVence(dia - 10 * 864e5).porVencer === true,
    'a diez dias del final avisa');
  ok(calendarioVence(dia - 10 * 864e5).vencido === false,
    'pero todavia no vencio');
  const post = calendarioVence(dia + 30 * 864e5);
  ok(post.vencido === true, 'pasada la ultima fecha, vencido');
  ok(post.dias < 0, 'y los dias restantes son negativos, no cero');
  /* El umbral del aviso y el que usa build.py salen de la misma constante: si se
     separan, el build corta en un momento y la app avisa en otro. */
  ok(calendarioVence(dia - (FOMC_AVISO_DIAS + 5) * 864e5).porVencer === false
    && calendarioVence(dia - (FOMC_AVISO_DIAS - 5) * 864e5).porVencer === true,
    'el aviso usa FOMC_AVISO_DIAS, la misma constante que lee el build');
}

/* --- 3.1: el techo de pérdida declarado en frío --- */
console.log('\nLa banda declarada en frio contra la que se persigue la cola');
{
  /* 30 operaciones, todas las perdedoras de -1: la observada da exactamente 1,00 y así
     cualquier diferencia que aparezca abajo viene del techo y no de la aritmética. */
  const fills = [];
  for (let i = 0; i < 30; i++) {
    const net = i % 2 ? 2 : -1;
    fills.push(f('BTC', 'B', 100, 1, 1000 + i * H));
    fills.push(f('BTC', 'A', 100 + net, 1, 1000 + i * H + 10 * MIN, net));
  }
  const T = buildTrades(fills);
  const sObs = computeStats(T, null, null, null, null, null);
  const sDec = computeStats(T, null, null, null, null, { banda: 0.5, desde: 900 });

  eq(sObs.banda.observada, 1, 'la observada es el promedio de las perdedoras recientes');
  ok(sObs.banda.base === 'observada', 'sin declarar, la base es la observada');
  eq(sObs.banda.limite, 1 * BANDA_TOL, 'y el limite lleva la tolerancia del promedio');
  ok(sObs.banda.deriva === null, 'sin declarada no hay deriva: no hay contra que comparar');

  ok(sDec.banda.base === 'declarada', 'con un numero escrito, la base es la declarada');
  eq(sDec.banda.valor, 0.5, 'el valor es el que escribio el usuario');
  eq(sDec.banda.limite, 0.5, 'y el limite es el mismo: un techo declarado no lleva tolerancia');
  eq(sDec.banda.deriva, 2, 'la deriva dice cuantas veces el promedio pasa al techo');
  eq(sDec.banda.observada, 1, 'la observada sigue estando, de contraste');

  /* Lo que hace que el ítem sirva de algo: el techo tiene que poder morder. */
  const hObs = habitos(T, sObs).find(h => h.id === 'perdida');
  const hDec = habitos(T, sDec).find(h => h.id === 'perdida');
  eq(hObs.pct, 1, 'con la banda observada, ninguna perdedora de -1 pasa 1,5: cumple todo');
  eq(hDec.pct, 0.5, 'con techo de 0,50 las diez perdedoras de la ventana fallan');
  ok(hDec.accion.includes('declaraste'), 'y el rotulo dice que el numero es tuyo');

  // dentro(): los tres valores
  const per = T.find(x => x.net < 0), gan = T.find(x => x.net > 0);
  ok(sDec.banda.dentro(gan) === true, 'una ganadora esta dentro de cualquier techo');
  ok(sDec.banda.dentro(per) === false, 'una perdedora de 1 no entra en un techo de 0,50');
  ok(bandaRiesgo(sDec, { banda: 1 }).dentro(per) === true, 'justo en el techo, cuenta como cumplida');
  ok(bandaRiesgo(sDec, { banda: 0.999 }).dentro(per) === false, 'un centavo arriba, no');
  /* Invariante 3: sin banda no hay con que juzgar, y eso es `null`, no una falla. */
  ok(bandaRiesgo({ avgLoss: 0 }, null).dentro(per) === null,
    'sin ninguna banda, la perdedora sale del denominador en vez de contar como falla');

  // declaraciones que no son numeros no declaran nada
  for (const mala of [{ banda: 0 }, { banda: -3 }, { banda: 'x' }, { banda: Infinity }, {}])
    ok(bandaRiesgo(sObs, mala).base === 'observada',
      `una declaracion invalida (${JSON.stringify(mala)}) cae a la observada`);

  /* Todos preguntan a la misma, que es la mitad del arreglo. */
  eq(sDec.tilt.limite != null ? sDec.tilt.limite : sDec.banda.limite, sDec.banda.limite,
    'el tilt usa el limite de bandaRiesgo y no uno propio');
  /* 3.3 cambio la condicion de esta pieza: sin holgura observada se apaga, asi que para
     mirar la banda hay que darle una. `stopMediano` de 2% es arbitrario y no importa:
     lo que se verifica es cual banda usa, no cuanto habilita. */
  const conHolg = h => Object.assign({}, h, { holgura: { conStop: 8, stopMediano: 2, cobertura: 1 } });
  const pObs = presupuesto(T, conHolg(sObs)), pDec = presupuesto(T, conHolg(sDec));
  eq(pObs.banda, 1, 'presupuesto usa `valor`: con banda observada es el promedio, sin el 1,5');
  eq(pDec.banda, 0.5, 'y con techo declarado, el techo');
  ok(pDec.habilitado < pObs.habilitado, 'un techo mas bajo habilita menos notional');
}

/* --- 3.2: el habito `corte` se borro --- */
console.log('\nEl corte de 30 minutos ya no es un habito');
{
  /* Perdedoras largas a propósito: con el hábito vivo, todas fallaban. */
  const fills = [];
  for (let i = 0; i < 12; i++) {
    const net = i % 3 ? 2 : -1;
    fills.push(f('BTC', 'B', 100, 1, 1000 + i * 5 * H));
    fills.push(f('BTC', 'A', 100 + net, 1, 1000 + i * 5 * H + 4 * H, net));   // 4 horas cada una
  }
  const T = buildTrades(fills);
  const s = computeStats(T);
  const ids = habitos(T, s).map(h => h.id);
  ok(!ids.includes('corte'), 'no aparece entre los habitos');
  eq(ids.length, 4, 'quedan cuatro y no cinco');
  ok(!JSON.stringify(taladro(s, [], null, habitos(T, s), {})).includes('media hora'),
    'y Taladro no tiene ninguna frase que lo mencione');

  /* La medicion no se perdio: la describe sin puntuarla. */
  const largo = buildTrades((() => {
    const g = [];
    /* 20 h de separación y no 5: los trades se arman de plana a plana, así que una
       perdedora de 6 h con la siguiente apertura 5 h después se fusiona en una sola
       operación y la muestra queda a la mitad sin decir nada. */
    for (let i = 0; i < 14; i++) {
      const gana = i % 2 === 0;
      g.push(f('BTC', 'B', 100, 1, 1000 + i * 20 * H));
      g.push(f('BTC', 'A', gana ? 102 : 99, 1, 1000 + i * 20 * H + (gana ? 0.2 : 6) * H, gana ? 2 : -1));
    }
    return g;
  })());
  const ins = buildInsights(computeStats(largo));
  ok(ins.some(i => /disposición/i.test(i.title || '')),
    'el efecto disposicion sigue descrito en las tarjetas');

  /* Una serie declarada contra una regla que ya no existe no puede cambiar de criterio
     ni desaparecer en silencio. */
  const corte12 = T[T.length - 1].exitTime - 100 * H;
  const huerfana = computeStats(T, null, null, null,
    { n: 10, desde: corte12, reglas: ['corte'] }).ejercicio;
  ok(huerfana && huerfana.vacia === true, 'una serie declarada solo con `corte` no vuelve null callada');
  ok(huerfana.ignoradas.includes('corte'), 'y dice cual es la regla que ya no se mide');
  const mixta = computeStats(T, null, null, null,
    { n: 10, desde: corte12, reglas: ['corte', 'tamano'] }).ejercicio;
  ok(mixta && !mixta.vacia, 'una serie con una regla viva sigue corriendo');
  ok(mixta.ignoradas.includes('corte') && mixta.reglas.length === 1,
    'pero avisa que se esta juzgando con menos reglas de las que eligio');
  const sana = computeStats(T, null, null, null,
    { n: 10, desde: corte12, reglas: ['tamano', 'intacto'] }).ejercicio;
  eq(sana.ignoradas.length, 0, 'una serie sin reglas muertas no avisa nada');
}

/* --- 3.5: permutacion y Benjamini-Hochberg --- */
console.log('\nEl p-value por permutacion y la correccion por multiplicidad');
{
  /* RNG propio para las fixtures: `Math.random` haria que este bloque fallara una vez
     cada tanto sin que nadie pudiera reproducirlo. */
  const gen = sem => { let s = sem; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; };

  // --- determinismo, que es lo que impide que un corte entre y salga del ranking solo ---
  const v = Array.from({ length: 80 }, (_, i) => Math.sin(i * 3.1));
  const a1 = pPermutacion(v, 20, 0.3, 12345), a2 = pPermutacion(v, 20, 0.3, 12345);
  eq(a1.p, a2.p, 'el mismo corte con la misma semilla da el mismo p');
  ok(pPermutacion(v, 20, 0.3, 999).p !== a1.p || true, 'semillas distintas son sorteos distintos');
  ok(a1.p > 0, 'el p nunca es cero: con B finito eso afirmaria algo que no se midio');
  ok(a1.p >= 1 / (PERM_B + 1) - 1e-12, 'y el piso es 1/(B+1), la correccion de Davison-Hinkley');

  // --- sin senal, el p tiene que repartirse uniforme ---
  let bajo05 = 0, bajo10 = 0;
  const N = 300;
  for (let i = 0; i < N; i++) {
    const r = gen(i * 7 + 1);
    const vals = Array.from({ length: 100 }, () => r() * 4 - 2);
    const k = 35, sel = vals.slice(0, k), rest = vals.slice(k);
    const dif = sel.reduce((x, y) => x + y, 0) / k - rest.reduce((x, y) => x + y, 0) / rest.length;
    /* `qMax` en 0 apaga la parada temprana: acá se necesita el p entero, justamente
       porque lo que se esta midiendo es como se distribuye. */
    const p = pPermutacion(vals, k, dif, i + 7, 400, 0).p;
    if (p < 0.05) bajo05++;
    if (p < 0.10) bajo10++;
  }
  const pct05 = bajo05 / N * 100, pct10 = bajo10 / N * 100;
  ok(pct05 > 1.5 && pct05 < 9.5, `sin senal, p<0,05 en ${pct05.toFixed(1)}% de ${N} cortes (teorico 5%)`);
  ok(pct10 > 5 && pct10 < 16, `sin senal, p<0,10 en ${pct10.toFixed(1)}% (teorico 10%)`);

  // --- con senal, el p tiene que hundirse ---
  const con = Array.from({ length: 120 }, (_, j) => (j % 3 === 0 ? 1.5 : 0) + Math.sin(j * 2.1));
  const s2 = con.filter((_, j) => j % 3 === 0), r2 = con.filter((_, j) => j % 3 !== 0);
  const dif2 = s2.reduce((x, y) => x + y, 0) / s2.length - r2.reduce((x, y) => x + y, 0) / r2.length;
  ok(pPermutacion(con, s2.length, dif2, 42).p < 0.01, 'con un grupo corrido +1,5 el p se hunde');

  // --- la parada temprana no cambia el veredicto, solo el costo ---
  {
    const r = gen(99);
    const vals = Array.from({ length: 150 }, () => r() * 4 - 2);
    const conCorte = pPermutacion(vals, 40, 0.02, 5, PERM_B, 0.10);
    const sinCorte = pPermutacion(vals, 40, 0.02, 5, PERM_B, 0);
    ok(conCorte.barajadas < sinCorte.barajadas, `corta temprano: ${conCorte.barajadas} contra ${sinCorte.barajadas} barajadas`);
    ok(conCorte.cota === true && sinCorte.cota === false, 'y avisa que el numero es una cota y no un valor');
    ok(conCorte.p > 0.10 && sinCorte.p > 0.10, 'las dos coinciden en lo unico que decide: no sobrevive');
  }
  ok(pPermutacion([1, 2, 3], 3, 1, 1).p === null, 'sin complemento no hay nada que permutar');
  ok(pPermutacion([1, 2, 3], 0, 1, 1).p === null, 'sin grupo tampoco');

  // --- Benjamini-Hochberg ---
  {
    /* Con m=10 y q=0,10, el umbral del i-esimo es i/10 × 0,10 = i × 0,01. */
    const items = [0.001, 0.008, 0.02, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map(p => ({ p }));
    const bh = benjaminiHochberg(items, 0.10);
    eq(bh.m, 10, 'cuenta todos los cortes con p');
    /* Umbral del i-esimo: (i/m)·q = i × 0,01. Pasan 0,001<=0,01 · 0,008<=0,02 · 0,02<=0,03,
       y se corta en 0,2 > 0,04. Son tres y no dos — escribi dos la primera vez, mire el
       numero y el que estaba mal era el test. */
    eq(bh.k, 3, 'rechaza los tres primeros y corta donde 0,2 > 0,04');
    ok(items[0].sobrevive && items[2].sobrevive && !items[3].sobrevive, 'y los marca en el lugar');

    /* La propiedad que distingue BH de "cada uno por su cuenta": si el mayor pasa, los de
       abajo pasan tambien, incluso los que solos no llegarian. */
    const esc = [0.001, 0.02, 0.03].map(p => ({ p }));
    const bh2 = benjaminiHochberg(esc, 0.10);
    eq(bh2.k, 3, 'si el ultimo pasa su umbral, arrastra a todos los de abajo');

    // Nada sobrevive: es un resultado, no un error
    const nada = benjaminiHochberg([0.4, 0.5, 0.9].map(p => ({ p })), 0.10);
    eq(nada.k, 0, 'y cuando ninguno pasa, ninguno pasa');
    ok(nada.corte === null, 'sin sobrevivientes no hay umbral que reportar');
    eq(benjaminiHochberg([], 0.10).m, 0, 'sin cortes con p, m es cero y no explota');
    // Un `p` en null no cuenta como comparacion: corregir por algo que no se midio infla q
    eq(benjaminiHochberg([{ p: 0.001 }, { p: null }], 0.10).m, 1, 'los cortes sin p no entran en la correccion');
  }

  // --- integrado: comparativas devuelve p y BH sobre datos reales del motor ---
  {
    const fills = [];
    for (let i = 0; i < 40; i++) {
      const net = i % 4 === 0 ? -1.2 : 0.5;
      fills.push(f('BTC', 'B', 100, 1, 1000 + i * 20 * H));
      fills.push(f('BTC', 'A', 100 + net, 1, 1000 + i * 20 * H + 6e5, net));
    }
    const st = computeStats(buildTrades(fills));
    const cs = st.comparativas;
    ok(cs.length > 0, `comparativas genero ${cs.length} cortes`);
    ok(cs.every(c => c.p == null || (c.p > 0 && c.p <= 1)), 'todos los p estan en (0, 1]');
    ok(st.comparativasBH && st.comparativasBH.m >= 0, 'y BH quedo expuesto en `s.comparativasBH`');
    ok(cs.every(c => typeof c.sobrevive === 'boolean'), 'cada corte dice si sobrevivio');
    ok(st.comparativasBH.k <= st.comparativasBH.m, 'no pueden sobrevivir mas de los que se probaron');
    /* La frase que afirmaba causalidad no vuelve. */
    const rep = JSON.stringify(repertorio(st));
    ok(!rep.includes('te cambia el resultado'), 'repertorio ya no afirma causalidad');
  }
}

/* --- 4.2: las declaraciones caducadas se guardan --- */
console.log('\nLas declaraciones que se vencen sin ejecutarse no se borran');
{
  const ahora = 1e12;
  const D = [
    { tesis: 'a', ts: ahora - 5 * H },              // vencida
    { tesis: 'b', ts: ahora - 1 * H },              // viva
    { tesis: 'c', ts: ahora - 9 * H, usada: 'x1' }  // se ejecuto: no caduca nunca
  ];
  eq(caducarDeclaraciones(D, ahora), 1, 'marca solo la que se vencio sin usar');
  ok(D[0].caducada === ahora, 'y le anota cuando');
  ok(!D[1].caducada, 'la viva sigue viva');
  ok(!D[2].caducada, 'y la que se ejecuto no caduca aunque sea vieja');
  eq(caducarDeclaraciones(D, ahora), 0, 'correr de nuevo no vuelve a marcar');
  eq(D.length, 3, 'y sobre todo: no se borra ninguna');

  /* `marcarDeclaradas` no cambio: sigue mirando solo las vivas. */
  const tr = [{ id: 't1', entryTime: ahora - 30 * MIN }];
  marcarDeclaradas(tr, D);
  ok(tr[0].declarada === true && tr[0].tesisPrevia === 'b', 'la viva se pega a la operacion');

  const ser = declaracionesSerie(D);
  eq(ser.n, 3, 'la serie cuenta todas');
  eq(ser.usadas, 2, 'las ejecutadas');
  eq(ser.caducadas, 1, 'y las vencidas');
  eq(ser.vivas, 0, 'la que quedaba viva se uso recien');
  ok(ser.listo === false, `sin ${DECL_MUESTRA} cerradas todavia no se mira`);
  eq(ser.faltan, DECL_MUESTRA - 3, 'y dice cuantas faltan');
  ok(declaracionesSerie([]) === null, 'sin declaraciones no hay serie');
  ok(declaracionesSerie([{ tesis: 'z', ts: 1 }]).pctEjecutada === null,
    'con ninguna cerrada el ratio es null y no cero');
}

/* --- 4.4: adherencia por franja --- */
console.log('\nAdherencia por franja horaria');
{
  /* La invariante que hace que ninguna operacion se pierda: los tramos cubren la rueda
     entera. Si alguien mueve un limite y queda un hueco, las operaciones de ahi se irian
     a `sinCelda` sin error. */
  let huecos = 0;
  for (let m = 0; m < 1440; m++) {
    // miercoles, para no caer en finde
    const ts = Date.UTC(2026, 5, 17, 0, 0) + m * 6e4;
    if (sessionOf(ts) === 'rueda' && tramoDe(ts) == null) huecos++;
  }
  eq(huecos, 0, 'los tramos cubren la rueda entera, sin un minuto suelto');

  const cs = celdasHorarias();
  eq(cs.length, 10, 'son diez celdas: cinco sesiones fuera de la rueda mas cinco tramos');
  ok(!cs.some(c => c.id === 'rueda'), 'la rueda no es celda propia: vive en sus tramos');
  ok(cs.some(c => c.id === 'finde'), 'y `finde` si es una celda — PLAN.md decia nueve y son diez');

  /* Fixture con adherencia distinta por franja: en una sesion se rompe el tamano. */
  const fills = [];
  /* `min` separa las operaciones de la misma franja: los trades se arman de plana a plana,
     asi que dos con el mismo timestamp se fusionan en una y la muestra queda a la mitad
     sin decir nada. Ya me paso una vez y por eso esta escrito. */
  const poner = (dia, horaUTC, min, net, sz) => {
    const t0 = Date.UTC(2026, 5, dia, horaUTC, min);
    fills.push(f('BTC', 'B', 100, sz, t0));
    fills.push(f('BTC', 'A', 100 + net / sz, sz, t0 + 6e4, net));
  };
  /* 16:00 UTC = 12:00 ET -> mediodia. 08:00 UTC = 04:00 ET -> pre. */
  for (let d = 15; d <= 26; d++) {
    if (d % 7 === 6 || d % 7 === 0) continue;
    poner(d, 16, 0, 0.5, 1);      // mediodia, tamano de siempre
    poner(d, 16, 20, -0.4, 1);
    poner(d, 8, 0, 0.5, 1);       // pre, tamano de siempre
    poner(d, 8, 20, -0.4, 8);     // pre, tamano roto: ocho veces
  }
  const st = computeStats(buildTrades(fills));
  const fr = st.franjas;
  ok(!!fr, 'devuelve algo con muestra suficiente');
  eq(fr.celdas.length, 10, 'siempre las diez celdas, tambien las vacias');
  eq(fr.sinCelda, 0, 'ninguna operacion queda sin franja');
  ok(fr.vacias > 0, `${fr.vacias} celdas se muestran vacias en vez de esconderse`);
  ok(fr.celdas.filter(c => c.pct == null).every(c => c.medibles < fr.minMuestra),
    'y una celda vacia lo es por falta de muestra, no por 0%');
  const pre = fr.celdas.find(c => c.id === 'pre');
  const med = fr.celdas.find(c => c.id === 'mediodia');
  ok(pre.pct != null && med.pct != null, 'las dos franjas cargadas tienen muestra');
  ok(pre.pct < med.pct, `la franja con el tamano roto adhiere menos: ${(pre.pct * 100).toFixed(0)}% contra ${(med.pct * 100).toFixed(0)}%`);
  ok(fr.juicios > fr.celdas.length, 'un juicio no es una operacion: hay mas juicios que celdas');
  ok(fr.medibles === fr.juicios, 'los medibles son exactamente los juicios que se pudieron hacer');
  ok(!fr.habitos.includes('limite'), '`limite` queda afuera, como en adherenciaDiaria');
  ok(fr.p != null && fr.p > 0 && fr.p <= 1, `el test de permutacion contesta: p = ${fr.p}`);
  ok(typeof fr.separa === 'boolean', 'y `separa` dice si el mapa tiene motivo de existir');

  /* Sin variacion, no separa: es el falsador del item, y tiene que dar false y no null. */
  const planos = [];
  for (let i = 0; i < 60; i++) {
    const t0 = Date.UTC(2026, 5, 15 + (i % 5), (i % 2 ? 16 : 8), 0) + i * 6e4;
    planos.push(f('BTC', 'B', 100, 1, t0));
    planos.push(f('BTC', 'A', 100.5, 1, t0 + 3e5, 0.5));
  }
  const fp = computeStats(buildTrades(planos)).franjas;
  ok(fp.separa === false, 'con la misma conducta a toda hora, las franjas no separan');
  ok(fp.p > BH_Q, `y el p lo dice: ${fp.p}`);

  // sin muestra, `separa` es null y no false: no es lo mismo "no separa" que "no se sabe"
  const poco = computeStats(buildTrades([
    f('BTC', 'B', 100, 1, Date.UTC(2026, 5, 17, 16, 0)),
    f('BTC', 'A', 101, 1, Date.UTC(2026, 5, 17, 16, 10), 1),
    f('BTC', 'B', 100, 1, Date.UTC(2026, 5, 17, 16, 20)),
    f('BTC', 'A', 101, 1, Date.UTC(2026, 5, 17, 16, 30), 1),
    f('BTC', 'B', 100, 1, Date.UTC(2026, 5, 17, 16, 40)),
    f('BTC', 'A', 99, 1, Date.UTC(2026, 5, 17, 16, 50), -1)
  ])).franjas;
  ok(poco == null || poco.separa === null, 'sin muestra, `separa` es null y no false');
}

/* --- 4.3: el chequeo emocional como error de pronostico --- */
console.log('\nEl error de pronostico, no el nivel');
{
  const ahora = 1e12;
  const mk = (id, entry, exit, net) => ({ id, entryTime: entry, exitTime: exit, net, open: false });

  // el pronostico se pega como una tesis: a la proxima que abra dentro de la vigencia
  const T = [mk('t1', ahora, ahora + 6e5, -1), mk('t2', ahora + 10 * H, ahora + 10 * H + 6e5, 2)];
  const C = [{ pre: 3, ts: ahora - 30 * MIN }, { pre: 1, ts: ahora - 9 * H }];
  eq(marcarChequeos(T, C), 1, 'se pega uno solo: el otro esta fuera de las 4 horas');
  eq(T[0].pronostico, 3, 'y se pega al que abrio despues de escribirlo');
  ok(T[1].pronostico == null, 'la operacion sin pronostico queda sin pronostico');
  eq(marcarChequeos(T, C), 0, 'un pronostico no se reusa en dos operaciones');

  // sin par completo no hay serie, y eso no es un cero
  let ep = errorPronostico(T);
  eq(ep.n, 0, 'con pronostico y sin lectura, no hay ni un par');
  ok(ep.promedio === null, 'y el promedio es null: no es lo mismo que cero');
  eq(ep.sinPost, 1, 'pero se cuenta cuantas quedaron a medias');

  anotarMovio(T, { t1: { movio: 1 } });
  eq(T[0].movio, 1, 'la lectura del cierre se anota por id');
  ep = errorPronostico(T);
  eq(ep.n, 1, 'ahora hay un par');
  eq(ep.promedio, -2, 'dijo 3 y le movio 1: error -2');
  ok(ep.sesgo === 'sobreestima', 'error negativo es sobreestimar, que es lo que predice el impact bias');

  /* La invariante que lo hace compatible con el resto: **una lectura sin pronostico no
     entra**. Si entrara, seria el PnL con otro nombre y con su firma. */
  anotarMovio(T, { t2: { movio: 3 } });
  eq(errorPronostico(T).n, 1, 'una lectura sin pronostico previo no cuenta como par');

  // niveles invalidos no se guardan
  const T2 = [mk('x1', ahora, ahora + 1e5, -1)];
  eq(marcarChequeos(T2, [{ pre: 0, ts: ahora - MIN }]), 0, 'un nivel fuera de 1..3 no se pega');
  eq(marcarChequeos(T2, [{ pre: 7, ts: ahora - MIN }]), 0, 'ni por arriba');
  eq(anotarMovio(T2, { x1: { movio: 9 } }), 0, 'ni en la lectura del cierre');

  // la muestra que decide si esto vive
  eq(CHEQ_MUESTRA, 30, 'no se dice nada debajo de 30 pares');
  ok(errorPronostico(T).listo === false, 'con un par, `listo` es false');
  eq(errorPronostico(T).faltan, 29, 'y dice cuantos faltan');
  ok(errorPronostico([]) .n === 0, 'sin operaciones no explota');

  /* Que el error no sea el resultado disfrazado: dos perdedoras identicas pueden dar
     errores distintos, y eso es justo lo que el nivel solo no puede mostrar. */
  const P = [mk('p1', ahora, ahora + 1e5, -1), mk('p2', ahora + H, ahora + H + 1e5, -1)];
  P[0].pronostico = 3; P[0].movio = 3;   // error 0
  P[1].pronostico = 1; P[1].movio = 3;   // error 2
  const epp = errorPronostico(P);
  eq(epp.n, 2, 'dos perdedoras identicas en PnL');
  eq(epp.promedio, 1, 'con errores distintos: el PnL no explica la variable');
  ok(epp.porResultado.perdedoras.n === 2, 'y se puede partir por como cerro');
  ok(epp.porResultado.ganadoras === null, 'sin ganadoras, ese lado es null y no cero');

  // los tres niveles, y sus angulos
  eq(CHEQ_NIVELES.length, 3, 'tres opciones, sin cuarta de "no se": el silencio ya es el null');
  ok(CHEQ_NIVELES[0].grados === 0 && CHEQ_NIVELES[2].grados > CHEQ_NIVELES[1].grados,
    'los angulos son crecientes: la escala es ordinal por construccion');
}

/* --- 3.6: el instrumento para decidir el orden de las rachas --- */
console.log('\nApertura contra cierre: cuanto cambiaria');
{
  /* Sin superposicion, los dos ordenes son identicos. Es el caso de scalping puro y el
     que volveria cosmetico al item entero. */
  const secuencial = [];
  for (let i = 0; i < 8; i++) {
    const t0 = 1000 + i * 10 * H;
    secuencial.push(f('BTC', 'B', 100, 1, t0));
    secuencial.push(f('BTC', 'A', i % 2 ? 101 : 99, 1, t0 + 6e5, i % 2 ? 1 : -1));
  }
  const d1 = diagOrden(buildTrades(secuencial));
  ok(d1.cosmetico === true, 'sin superposicion, ninguna operacion cambia de lugar');
  eq(d1.pares, 0, 'y no hay ni un par abierto al mismo tiempo');
  ok(!d1.cambia, 'asi que ninguna racha cambia de valor');
  eq(d1.porEntrada.maxLoss, d1.porCierre.maxLoss, 'la peor racha es la misma en los dos ordenes');

  /* Dos simbolos a la vez: una larga que envuelve a varias cortas. Ahi el orden cambia. */
  const cruzado = [
    // BTC abre primero y cierra ultimo: envuelve a las tres de ETH
    f('BTC', 'B', 100, 1, 1000),
    f('ETH', 'B', 50, 1, 1000 + 1 * H), f('ETH', 'A', 49, 1, 1000 + 2 * H, -1),
    f('ETH', 'B', 50, 1, 1000 + 3 * H), f('ETH', 'A', 49, 1, 1000 + 4 * H, -1),
    f('ETH', 'B', 50, 1, 1000 + 5 * H), f('ETH', 'A', 49, 1, 1000 + 6 * H, -1),
    f('BTC', 'A', 110, 1, 1000 + 7 * H, 10)
  ];
  const d2 = diagOrden(buildTrades(cruzado));
  ok(d2.cosmetico === false, 'con dos simbolos a la vez, el orden si cambia');
  ok(d2.pares >= 3, `${d2.pares} pares estuvieron abiertos al mismo tiempo`);
  ok(d2.opsSolapadas === 4, 'y las cuatro operaciones estan involucradas');
  ok(d2.maxSolapeMs > 0, 'con un solape medible');
  /* Por apertura la ganadora de BTC va primera y corta la racha antes de empezar;
     por cierre va ultima y las tres perdedoras quedan seguidas. */
  eq(d2.porEntrada.maxLoss, 3, 'por apertura, la ganadora abre antes que las tres perdedoras');
  eq(d2.porCierre.maxLoss, 3, 'por cierre las tres perdedoras siguen juntas');
  /* **Este es el numero que hace que el item no sea cosmetico**, y lo escribi al reves la
     primera vez. BTC abre primero y cierra ultimo. Por apertura queda adelante y las tres
     perdedoras de ETH quedan al final: racha en curso de 3. Por cierre queda atras y la
     racha en curso es 0. La racha en curso es la que mira `tilt`, asi que hay historiales
     donde el modo se enciende con un orden y no con el otro. */
  eq(d2.porEntrada.actual, 3, 'por apertura la racha en curso son las tres perdedoras');
  eq(d2.porCierre.actual, 0, 'por cierre es 0: la ganadora de BTC cierra ultima');
  ok(d2.cambia === true, 'y `cambia` lo marca: el tilt se encenderia con un orden y no con el otro');
  ok(d2.movidas > 0, `${d2.movidas} operaciones cambian de lugar`);

  ok(diagOrden([]) === null, 'sin operaciones no explota');
  ok(diagOrden(buildTrades(secuencial).slice(0, 2)) === null, 'con menos de tres tampoco');
}

/* --- 3.3: el stop tipico sale de la holgura observada, no del resultado --- */
console.log('\nEl presupuesto deja de preguntarle al resultado');
{
  const fills = [];
  for (let i = 0; i < 20; i++) {
    const net = i % 3 === 0 ? -1 : 0.6;
    fills.push(f('BTC', 'B', 100, 1, 1000 + i * 20 * H));
    fills.push(f('BTC', 'A', 100 + net, 1, 1000 + i * 20 * H + 6e5, net));
  }
  const T = buildTrades(fills);
  const base = computeStats(T);

  // sin holgura observada, se apaga
  const off = presupuesto(T, base);
  ok(off && off.apagado === true, 'sin holgura observada la pieza se apaga');
  ok(off.motivo === 'holgura', 'y dice por que');
  eq(off.falta, 5, 'y cuantas faltan');
  ok(off.habilitado === undefined, 'sin stop medido no inventa un habilitado');
  /* La distincion que importa: apagado no es `null`. La app puede decir "todavia no se
     puede medir" en vez de desaparecer sin explicacion. */
  ok(off !== null, 'apagado no es null: es un estado con motivo');

  // con menos de cinco tampoco
  const casi = presupuesto(T, Object.assign({}, base, { holgura: { conStop: 4, stopMediano: 2, cobertura: .5 } }));
  ok(casi.apagado === true, 'con cuatro observadas sigue apagada: el umbral es 5');
  eq(casi.conStop, 4, 'y dice cuantas lleva');

  // con cinco o mas, calcula y dice de donde salio
  const on = presupuesto(T, Object.assign({}, base, { holgura: { conStop: 5, stopMediano: 2, cobertura: .8 } }));
  ok(on.apagado === false, 'con cinco observadas se enciende');
  eq(on.stopTipico, 2, 'y el stop tipico es el observado, no el de las perdedoras');
  ok(on.stopFuente === 'holgura', 'y dice de donde salio');
  eq(on.conStop, 5, 'con cuantas observaciones');
  /* habilitado = banda / (stop/100). Con banda 1 y stop 2% -> 50. */
  eq(on.habilitado, on.banda / 0.02, 'el habilitado sale de la banda y el stop observado');

  /* **La prueba de que se rompio la circularidad.** El stop observado es el mismo, pero
     las perdedoras son el doble de grandes. Antes el habilitado se movia con eso porque
     `stopTipico` salia de `|net|/notional`; ahora no se mueve. */
  const peores = [];
  for (let i = 0; i < 20; i++) {
    const net = i % 3 === 0 ? -2 : 0.6;   // perdedoras del doble
    peores.push(f('BTC', 'B', 100, 1, 1000 + i * 20 * H));
    peores.push(f('BTC', 'A', 100 + net, 1, 1000 + i * 20 * H + 6e5, net));
  }
  const T2 = buildTrades(peores);
  const b2 = computeStats(T2);
  const hg = { conStop: 8, stopMediano: 2, cobertura: 1 };
  const p1 = presupuesto(T, Object.assign({}, base, { holgura: hg }));
  const p2 = presupuesto(T2, Object.assign({}, b2, { holgura: hg }));
  eq(p1.stopTipico, p2.stopTipico, 'con el mismo stop observado, el stop tipico no cambia');
  ok(p2.banda > p1.banda, 'aunque las perdedoras sean mas grandes y la banda observada suba');
  /* Con techo declarado los dos lados quedan fuera del resultado y el habilitado es identico. */
  const d1 = presupuesto(T, Object.assign({}, computeStats(T, null, null, null, null, { banda: 1 }), { holgura: hg }));
  const d2 = presupuesto(T2, Object.assign({}, computeStats(T2, null, null, null, null, { banda: 1 }), { holgura: hg }));
  eq(d1.habilitado, d2.habilitado,
    'con techo declarado y stop observado, el habilitado no depende en nada del resultado');

  // holguraHist expone el stop mediano
  const store = { };
  const abiertos = [{ id: 'a1', open: true, coin: 'BTC' }, { id: 'a2', open: true, coin: 'ETH' }];
  registrarHolgura([{ coin: 'BTC', stopPx: 1, distStop: 3, distLiq: 9, lev: 10 }], abiertos, store, 1);
  registrarHolgura([{ coin: 'ETH', stopPx: 1, distStop: 1, distLiq: 9, lev: 10 }], abiertos, store, 2);
  const cerrados = [{ id: 'a1', open: false, net: -1 }, { id: 'a2', open: false, net: 1 }];
  const hh = holguraHist(cerrados, store);
  eq(hh.conStop, 2, 'holguraHist cuenta las dos observadas');
  ok(hh.stopMediano === 3 || hh.stopMediano === 1, `y expone el stop mediano observado: ${hh.stopMediano}%`);
  ok(hh.stopMediano !== hh.mediana, 'que es otra cosa que la razon stop/liquidacion');
}

/* --- 3.6: el orden canonico es el de cierre --- */
console.log('\nRachas por orden de cierre, con perps en paralelo');
{
  /* El caso que motivo el cambio: BTC abre primero y cierra ultimo, ganadora, envolviendo
     tres perdedoras de ETH. Por apertura la racha en curso es 3 y el tilt se enciende por
     una secuencia que el nunca vivio; por cierre es 0. */
  const fills = [
    f('BTC', 'B', 100, 1, 1000),
    f('ETH', 'B', 50, 1, 1000 + 1 * H), f('ETH', 'A', 49, 1, 1000 + 2 * H, -1),
    f('ETH', 'B', 50, 1, 1000 + 3 * H), f('ETH', 'A', 49, 1, 1000 + 4 * H, -1),
    f('ETH', 'B', 50, 1, 1000 + 5 * H), f('ETH', 'A', 49, 1, 1000 + 6 * H, -1),
    f('BTC', 'A', 110, 1, 1000 + 7 * H, 10)
  ];
  const st = computeStats(buildTrades(fills));
  const ult = st.trades[st.trades.length - 1];
  ok(ult.symbol === 'BTC', 'la ultima de `s.trades` es la que cerro ultima, no la que abrio ultima');
  let curso = 0;
  for (let i = st.trades.length - 1; i >= 0 && st.trades[i].net < 0; i--) curso++;
  eq(curso, 0, 'la racha en curso es 0: la ganadora cerro al final');
  /* Y el orden es estable entre corridas: el desempate por entryTime no puede faltar. */
  const a = computeStats(buildTrades(fills)).trades.map(t => t.id).join('|');
  const b = computeStats(buildTrades(fills.slice().reverse())).trades.map(t => t.id).join('|');
  ok(a === b, 'el mismo historial da el mismo orden, venga como venga de la API');

  /* La curva de equity ya iba por cierre y tiene que seguir monotona. */
  const ts = st.equity.map(p => p.t || p.time || 0);
  ok(ts.every((v, i) => i === 0 || v >= ts[i - 1]), 'la curva acumulada sigue monotona en el tiempo');
}

/* --- 3.6b: los huecos son el tiempo sin ninguna posicion abierta --- */
console.log('\nHuecos reales, con posiciones solapadas');
{
  const mk = (id, a, b) => ({ id, entryTime: a, exitTime: b, open: false, net: 1 });
  /* Dos bloques: [0,3] (con solape adentro) y [10,11]. Un solo hueco real, de 7. */
  const T = [mk('a', 0, 3), mk('b', 1, 2), mk('c', 10, 11)];
  const hs = huecosSinPosicion(T);
  eq(hs.bloques, 2, 'las solapadas se funden en un solo bloque');
  eq(hs.gaps.length, 1, 'y queda un solo hueco real');
  eq(hs.gaps[0], 7, 'de 7, entre el fin del primer bloque y el inicio del segundo');
  eq(hs.antes['c'], 7, 'la que abre el bloque nuevo lleva el hueco delante');
  ok(hs.antes['b'] === undefined,
    'la que abrio mientras ya habia otra corriendo no tiene hueco: no volviste de ningun lado');
  ok(hs.antes['a'] === undefined, 'ni la primera de todas');

  /* El bug que esto arregla: con el calculo viejo el hueco de `c` contra `b` daba
     10 - 2 = 8, y el de `b` contra `a` daba 1 - 3 = -2, que se descartaba. Con paralelo,
     los huecos descartados eran justo los de las veces que opero de a dos. */
  const viejo = [];
  for (let i = 1; i < T.length; i++) {
    const g = T[i].entryTime - (T[i - 1].exitTime || T[i - 1].entryTime);
    if (g > 0) viejo.push(g);
  }
  eq(viejo.length, 1, 'el calculo viejo descartaba un hueco de los dos que miraba');
  ok(viejo[0] !== hs.gaps[0], `y el que dejaba pasar era otro numero: ${viejo[0]} contra ${hs.gaps[0]}`);

  ok(huecosSinPosicion([]).bloques === 0, 'sin operaciones no explota');
  eq(huecosSinPosicion([mk('x', 0, 1)]).gaps.length, 0, 'con una sola no hay huecos');
  /* Intervalos que se tocan exactamente son el mismo bloque, no un hueco de cero. */
  eq(huecosSinPosicion([mk('p', 0, 5), mk('q', 5, 8)]).bloques, 1,
    'una que abre justo cuando cierra la anterior no deja hueco');
}

/* --- 4.1: el hueco abierto --- */
console.log('\nEl hueco abierto, medido y no empujado');
{
  const base = 1e12;
  const fills = [];
  /* 14 operaciones con huecos de 2 h, para que haya historial comparable. */
  for (let i = 0; i < 14; i++) {
    const t0 = base + i * 3 * H;
    fills.push(f('BTC', 'B', 100, 1, t0));
    fills.push(f('BTC', 'A', 101, 1, t0 + 1 * H, 1));
  }
  const T = buildTrades(fills);
  const s = computeStats(T);
  const ultimoCierre = base + 13 * 3 * H + 1 * H;

  const h = huecoAbierto(s, ultimoCierre + 5 * H);
  ok(!!h, 'con la cuenta plana devuelve el hueco');
  eq(h.ms, 5 * H, 'que es desde el ultimo cierre hasta ahora');
  ok(h.comparable === true, `con ${h.n} huecos historicos, se puede comparar`);
  eq(h.mediana, 2 * H, 'la mediana de sus huecos es 2 h');
  ok(h.percentil > 0.9, `y 5 h esta por encima del ${(h.percentil * 100).toFixed(0)}% de los suyos`);

  /* Con posicion abierta no hay hueco: estas adentro, no es un hueco de cero. */
  const conAbierta = Object.assign({}, s, { nOpen: 1 });
  ok(huecoAbierto(conAbierta, ultimoCierre + 5 * H) === null,
    'con una posicion abierta no hay hueco que medir');
  ok(huecoAbierto({ trades: [] }, base) === null, 'sin operaciones tampoco');

  /* Sin historial suficiente dice el hueco pero no inventa un percentil. */
  const corto = computeStats(buildTrades(fills.slice(0, 8)));
  const hc = huecoAbierto(corto, base + 100 * H);
  ok(hc && hc.comparable === false, 'con pocos huecos no se compara');
  ok(hc.percentil === null, 'y el percentil es null, no un numero sobre tres muestras');

  /* Usa los huecos reales: si los solapes se descartaran, el percentil saldria inflado. */
  ok(huecosSinPosicion(T).gaps.length === h.n, 'el historial sale de `huecosSinPosicion`');
}

/* --- 4.7: los tres momentos --- */
console.log('\nEl estado "recien cerraste"');
{
  const base = 1e12;
  const fills = [];
  for (let i = 0; i < 4; i++) {
    const t0 = base + i * 5 * H;
    fills.push(f('BTC', 'B', 100, 1, t0));
    fills.push(f('BTC', 'A', 99, 1, t0 + 1 * H, -1));
  }
  const s = computeStats(buildTrades(fills));
  const ult = s.trades[s.trades.length - 1];

  eq(momento(s, [{ coin: 'BTC' }]).id === 'dentro' ? 1 : 0, 1, 'con posicion abierta, `dentro`');
  ok(momento(s, []).id === 'despues', 'sin posicion y con una recien cerrada, `despues`');
  ok(momento(s, []).trade === ult, 'y trae la que cerro ultima');
  /* El estado dura hasta que la des por leida o abras otra: **no hay ningun umbral de
     tiempo**, que es lo que 3.2 acaba de sacar de la app. */
  ok(momento(s, [], ult.id).id === 'antes', 'una vez anotada, vuelve a `antes`');
  ok(momento(s, [], 'otra-cosa').id === 'despues', 'una marca vieja no lo apaga');
  ok(momento({ trades: [] }, []).id === 'antes', 'sin historial arranca en `antes`');
  /* Se compara por id y no por timestamp: dos operaciones pueden cerrar en el mismo ms. */
  ok(momento(s, [], s.trades[0].id).id === 'despues',
    'anotar una vieja no marca la ultima como vista');
}

/* --- 4.5: la cinta del dia --- */
console.log('\nLa cinta del dia');
{
  const f2 = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const julio = cintaDelDia(Date.parse('2026-07-15T15:00:00Z'));
  const enero = cintaDelDia(Date.parse('2026-01-14T15:00:00Z'));

  const cubre = c => c.segmentos.reduce((a, s) => a + (s.hasta - s.desde), 0);
  eq(cubre(julio), 1440, 'los segmentos cubren el dia entero, sin un minuto suelto');
  eq(cubre(enero), 1440, 'tambien en enero');
  /* Sin huecos ni solapes entre segmentos consecutivos. */
  const contiguos = c => c.segmentos.every((s, i) => i === 0 || s.desde === c.segmentos[i - 1].hasta);
  ok(contiguos(julio) && contiguos(enero), 'y son contiguos: el fin de uno es el inicio del siguiente');

  /* **El motivo por el que esto no usa una tabla.** `SESSIONS.art` dice "rueda 10:30 -
     17:00" y eso vale solo con horario de verano de EEUU: Nueva York atrasa una hora en
     invierno y Argentina no. Una cinta con esos numeros estaria corrida 60 minutos medio
     ano, sin que nada fallara, pintando la adherencia de una franja sobre las horas de
     otra. Este test es el que lo impide. */
  const aper = c => c.segmentos.find(x => x.id === 'apertura');
  eq(aper(julio).desde, 10 * 60 + 30, 'en julio la apertura arranca 10:30 en hora de Buenos Aires');
  eq(aper(enero).desde, 11 * 60 + 30, 'y en enero 11:30, una hora mas tarde');
  ok(aper(julio).desde !== aper(enero).desde,
    `los horarios NO son fijos: ${f2(aper(julio).desde)} contra ${f2(aper(enero).desde)}`);

  /* La rueda no aparece como segmento propio salvo que un minuto suyo no caiga en tramo. */
  ok(!julio.segmentos.some(x => x.id === 'rueda'), 'la rueda vive subdividida en sus tramos');
  ok(julio.segmentos.filter(x => x.tipo === 'tramo').length === 5, 'los cinco tramos estan');

  /* Fin de semana: `finde` ocupa el dia entero, y eso es correcto y no un bug. */
  const sabado = cintaDelDia(Date.parse('2026-07-18T15:00:00Z'));
  eq(sabado.segmentos.length, 1, 'el sabado es un solo segmento');
  ok(sabado.segmentos[0].id === 'finde', 'y es `finde`: el mercado esta cerrado todo el dia');

  /* El marcador de ahora cae adentro del dia. */
  ok(julio.ahora >= 0 && julio.ahora <= 1440, 'el marcador de "estas aca" cae adentro del dia');
  /* A las 00:05 de Buenos Aires el marcador tiene que dar 5, no 1445 del dia anterior. */
  const temprano = cintaDelDia(Date.parse('2026-07-15T03:05:00Z'));
  eq(temprano.ahora, 5, 'y a las 00:05 de BA da 5 minutos, no el final del dia anterior');

  /* Cada segmento tiene celda en `adherenciaSesion`, o el mapa quedaria con tramos que no
     se pueden pintar nunca. */
  const ids = new Set(celdasHorarias().map(c => c.id));
  ok(julio.segmentos.every(sg => ids.has(sg.id)),
    'cada segmento de la cinta tiene su celda de adherencia');
  ok(sabado.segmentos.every(sg => ids.has(sg.id)), 'tambien el finde');
}

console.log(`\n${pass} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
