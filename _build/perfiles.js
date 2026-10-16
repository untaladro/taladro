/* Banco de perfiles sintéticos.

   Todo lo que mide Talastrat está calibrado contra una sola persona. Antes de que lo
   toque un tester con otro estilo, conviene saber qué hace el motor con operadores que
   no operan así: un scalper de cincuenta trades por día, un swing que entra una vez por
   semana, alguien que piramida a propósito, alguien que dobla después de perder.

   La pregunta que responde no es "¿anda?" sino "¿se enciende donde tiene que
   encenderse?". Un modo aire que se prende con un martingala está roto aunque no tire
   ningún error, y uno que nunca se prende con un swing disciplinado también.

       node _build/perfiles.js

   Sale con código 1 si algún perfil da lo contrario de lo esperado. */
const { buildTrades, computeStats } = require('./engine.js');

const H = 36e5, D = 864e5;
const f = (coin, side, px, sz, time, cp = 0, fee = 0, liq) => {
  const o = { coin, side, px: String(px), sz: String(sz), time,
    closedPnl: String(cp), fee: String(fee) };
  if (liq) o.liquidation = { liquidatedUser: '0x' + '0'.repeat(40), markPx: String(px), method: 'market' };
  return o;
};

/* Generador común: `plan` decide, para cada operación i, con qué tamaño entra, cuánto
   dura, cuánto espera desde la anterior y si gana. Todo lo que distingue a un perfil
   cabe ahí adentro. */
function generar(n, plan, semilla, colateral) {
  let r = semilla || 7;
  const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648;
  const fills = [], serie = [];
  let t = Date.now() - n * 2 * D, prevGano = true;
  for (let i = 0; i < n; i++) {
    const p = plan(i, rnd, prevGano);
    t += p.espera;
    /* Si el perfil declara cómo evoluciona su cuenta, el notional se escala con ella:
       es lo que pasa de verdad con apalancamiento fijo. El plan sigue declarando la
       exposición, que es lo único que la persona elige. */
    const esc = colateral ? colateral(i, n) : 1;
    if (colateral) serie.push([t - 1000, String(100 * esc)]);
    const notional = p.notional * esc;
    const px = 10, sz = notional / px;
    const salida = p.gana ? px * (1 + p.ret) : px * (1 - p.ret);
    fills.push(f('xyz:DRAM', 'B', px, sz, t, 0, notional * 0.0004));
    fills.push(f('xyz:DRAM', 'A', salida, sz, t + p.dur,
      (p.gana ? 1 : -1) * notional * p.ret, notional * 0.0004, p.liq));
    t += p.dur;
    prevGano = p.gana;
  }
  if (colateral) serie.push([t + 1000, String(100 * colateral(n - 1, n))]);
  return { fills, portfolio: colateral ? { xyz: [['allTime', { accountValueHistory: serie }]] } : null };
}

/* ganancia media > pérdida media × tasa de fallo → expectativa positiva */
const gana = (i, rnd) => rnd() < 0.55;

const PERFILES = [
  {
    nombre: 'Disciplinado de tamaño fijo',
    espera: 'aire',
    porque: 'siempre el mismo tamaño, misma banda, ritmo parejo, expectativa positiva',
    plan: (i, rnd) => { const g = gana(i, rnd);
      return { notional: 20, dur: 2 * H, espera: 20 * H, gana: g, ret: g ? 0.06 : 0.04 }; }
  },
  {
    nombre: 'Scalper de alta frecuencia',
    espera: 'aire',
    porque: 'opera muchísimo pero de forma constante: la mediana diaria sube con él, no contra él',
    plan: (i, rnd) => { const g = gana(i, rnd);
      return { notional: 15, dur: 4 * 6e4, espera: 12 * 6e4, gana: g, ret: g ? 0.012 : 0.008 }; }
  },
  {
    nombre: 'Swing de una operación por semana',
    espera: 'aire',
    porque: 'huecos larguísimos pero parejos: el umbral de parálisis sale de su propio ritmo',
    plan: (i, rnd) => { const g = gana(i, rnd);
      return { notional: 40, dur: 3 * D, espera: 7 * D, gana: g, ret: g ? 0.09 : 0.06 }; }
  },
  {
    nombre: 'Martingala: dobla después de perder',
    espera: 'nada',
    porque: 'el tamaño depende del resultado anterior, que es exactamente lo que el modo mira',
    plan: (i, rnd, prevGano) => { const g = gana(i, rnd);
      return { notional: prevGano ? 20 : 60, dur: 2 * H, espera: 20 * H, gana: g, ret: g ? 0.06 : 0.04 }; }
  },
  {
    nombre: 'Revancha: reentra al toque después de perder',
    espera: 'nada',
    porque: 'mismo tamaño pero la espera se derrumba tras una pérdida: el estado cambió aunque el tamaño no',
    plan: (i, rnd, prevGano) => { const g = gana(i, rnd);
      return { notional: 20, dur: 2 * H, espera: prevGano ? 30 * H : 2 * 6e4, gana: g, ret: g ? 0.06 : 0.04 }; }
  },
  {
    /* Sube el tamaño a propósito y de a poco, y el modo se enciende igual. La primera
       lectura fue que era un falso positivo; no lo es. El modo mide estabilidad, no
       constancia: lo que descalifica es que el tamaño reaccione al resultado anterior,
       y acá no reacciona (tam 0,92×). Alguien que agranda porque le creció la cuenta
       está en un estado distinto de alguien que agranda porque acaba de perder. */
    nombre: 'Piramidador suave (+15% cada 10)',
    espera: 'aire',
    porque: 'crece de a poco pero el tamaño no depende del resultado anterior: eso es estable',
    plan: (i, rnd) => { const g = gana(i, rnd);
      return { notional: 10 + i * 1.5, dur: 2 * H, espera: 20 * H, gana: g, ret: g ? 0.06 : 0.04 }; }
  },
  {
    nombre: 'Piramidador agresivo (duplica cada 10)',
    espera: 'nada',
    porque: 'a este ritmo las últimas superan el doble de su propia mediana y salen del rango',
    plan: (i, rnd) => { const g = gana(i, rnd);
      return { notional: 10 * Math.pow(2, i / 10), dur: 2 * H, espera: 20 * H, gana: g, ret: g ? 0.06 : 0.04 }; }
  },
  {
    nombre: 'Perdedor consistente',
    espera: 'nada',
    porque: 'conducta impecable pero expectativa negativa: prometerle iteraciones sería mentirle',
    plan: (i, rnd) => { const g = rnd() < 0.4;
      return { notional: 20, dur: 2 * H, espera: 20 * H, gana: g, ret: g ? 0.03 : 0.07 }; }
  },
  {
    nombre: 'Se hace liquidar seguido',
    espera: 'nada',
    porque: 'el exchange cierra por él: la falla más cara y la más evitable',
    plan: (i, rnd) => { const g = gana(i, rnd);
      return { notional: 20, dur: 2 * H, espera: 20 * H, gana: g, ret: g ? 0.06 : 0.30, liq: !g && i % 4 === 0 }; }
  },
  {
    nombre: 'Arranca hoy',
    espera: 'muestra',
    porque: 'tres operaciones: casi todo lo que la app calcula todavía no significa nada',
    n: 3,
    plan: (i, rnd) => { const g = gana(i, rnd);
      return { notional: 20, dur: 2 * H, espera: 20 * H, gana: g, ret: g ? 0.06 : 0.04 }; }
  },
  /* Los dos que siguen son el régimen real de esta app: colateral chico, apalancamiento
     fijo, el notional moviéndose solo con la cuenta. La conducta es idéntica a la del
     disciplinado; lo único que cambia es cuánta plata hay atrás. Si el motor midiera
     notional crudo, el primero daría verde de a ratos por perder y el segundo se apagaría
     por ganar. Los dos tienen que dar aire. */
  {
    nombre: 'Cuenta que se achica 85%',
    espera: 'aire',
    porque: 'misma exposición todo el tiempo: que la cuenta baje no es un cambio de conducta',
    colateral: (i, n) => Math.pow(0.15, i / (n - 1)),
    plan: (i, rnd) => { const g = gana(i, rnd);
      return { notional: 20, dur: 2 * H, espera: 20 * H, gana: g, ret: g ? 0.06 : 0.04 }; }
  },
  {
    nombre: 'Cuenta que se multiplica por 8',
    espera: 'aire',
    porque: 'componer la cuenta no puede apagar el modo: sería castigar el resultado bueno',
    colateral: (i, n) => Math.pow(8, i / (n - 1)),
    plan: (i, rnd) => { const g = gana(i, rnd);
      return { notional: 20, dur: 2 * H, espera: 20 * H, gana: g, ret: g ? 0.06 : 0.04 }; }
  },
  {
    nombre: 'Vuelve después de veinte días',
    espera: 'aire',
    porque: 'volver de un parón es salir de la parálisis, no entrar en ella: no puede apagar el modo',
    plan: (i, rnd) => { const g = gana(i, rnd);
      return { notional: 20, dur: 2 * H, gana: g, ret: g ? 0.06 : 0.04,
        espera: i === 59 ? 20 * D : 20 * H }; }
  },
  {
    nombre: 'Sube la exposición sobre el final',
    espera: 'nada',
    porque: 'acá sí cambió la decisión, no el colateral: el modo tiene que apagarse',
    colateral: () => 1,
    plan: (i, rnd) => { const g = gana(i, rnd);
      return { notional: i >= 50 ? 60 : 20, dur: 2 * H, espera: 20 * H, gana: g, ret: g ? 0.06 : 0.04 }; }
  }
];

const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
let fallos = 0;
console.log('\nPerfiles sintéticos — ¿se enciende donde tiene que encenderse?\n');

for (const p of PERFILES) {
  const g = generar(p.n || 60, p.plan, 13, p.colateral);
  const s = computeStats(buildTrades(g.fills), null, g.portfolio);
  const a = s.aire || {}, t = s.tilt || {};
  const estado = a.activo ? 'aire' : t.activo ? 'tilt' : s.n < 5 ? 'muestra' : 'nada';
  const bien = estado === p.espera;
  if (!bien) fallos++;

  const detalle = [];
  detalle.push(`n=${s.n}`);
  detalle.push(`EV=${s.expectancy >= 0 ? '+' : ''}${s.expectancy.toFixed(3)}`);
  if (a.activo) detalle.push(`${a.cumplidas}/${a.ventana}`);
  if (a.activo && a.rTam != null) detalle.push(`tam ${a.rTam.toFixed(2)}×`);
  if (a.activo && a.rEsp != null) detalle.push(`espera ${a.rEsp.toFixed(2)}×`);
  if (s.liq.n) detalle.push(`${s.liq.n} liq`);
  if (s.escala) detalle.push(s.escala.base === 'exposicion' ? 'exposición' : 'notional');

  console.log(`  ${bien ? 'ok  ' : 'FAIL'} ${pad(p.nombre, 38)} → ${pad(estado, 8)} ${detalle.join(' · ')}`);
  if (!bien) console.log(`       esperaba "${p.espera}": ${p.porque}`);
}

console.log(`\n${fallos ? fallos + ' perfil(es) fuera de lo esperado' : 'todos los perfiles se comportan como se espera'}\n`);
process.exit(fallos ? 1 : 0);
