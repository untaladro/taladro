/* ===== Fixture de vista =====
   Cuenta sintética con la forma exacta que devuelve `traer()`. Existe porque los seis
   tests de `_build/t/` apuntaban a un archivo absoluto de una carpeta de subidas que dejó
   de existir, así que hacía rato que ninguno corría — y nadie se enteraba, porque
   `build.py` corre `smoke.js` y no esta carpeta. Un test que no puede correr es peor que
   un test que no existe: ocupa el lugar de la verificación sin hacerla.

   Es un generador y no un .json a propósito. Dos motivos:

   El tilt tiene reloj. Desde que se apaga con día nuevo de Buenos Aires más seis horas de
   hueco, un archivo con fechas fijas deja de encender el modo apenas pasa un día, y el
   test de tilt se volvería verde por caducidad en vez de por conducta. Acá las
   operaciones se cuelgan de `Date.now()`, así que el escenario es siempre el mismo.

   Y no hay ninguna dirección real. El principio 1 dice que ningún archivo con una wallet
   real va al repo, y `build.py` corta si aparece un `0x…` en el HTML. Un volcado de su
   cuenta como fixture era exactamente lo que no puede estar versionado.

   Lo que arma, y por qué así:

     · 34 operaciones cerradas — pasa los umbrales de `habitos` (3), `presupuesto` (8),
       `adherencia` (8+4), `mitades` (10) y `adherenciaDiaria` (10). No llega a 30 días
       distintos, así que el corte por terciles queda apagado y eso está bien: esto prueba
       la vista, no la estadística.
     · una posición abierta con su orden trigger — `boton.js` necesita `enpos`.
     · serie de `accountValueHistory` que cubre todo el rango — para que la escala sea
       exposición y no notional, que es el camino que importa desde que `escalaTamano`
       manda en cuatro piezas.

   `armar({ tilt: true })` termina la serie con tres perdedoras y una fuera de banda, que
   son las dos condiciones del modo. **Por defecto está apagado**, y eso no es comodidad:
   el tilt tapa la plata y cambia medio render, así que una fixture que tiltea siempre
   haría que los tests de presupuesto y de objetivo prueben la pantalla roja creyendo que
   prueban la normal. Cada test pide el escenario que dice probar. */

const USER = '0x0000000000000000000000000000000000000001';   // sintética, nunca una real
const H = 36e5;

function fill(coin, side, px, sz, time, closedPnl, fee, extra) {
  return Object.assign({
    coin, side, px: String(px), sz: String(sz), time,
    closedPnl: String(closedPnl || 0), fee: String(fee == null ? 0.02 : fee),
    crossed: true, dir: side === 'B' ? 'Open Long' : 'Close Long', tid: time
  }, extra || {});
}

function armar(opt) {
  const conTilt = !!(opt && opt.tilt);
  const now = Date.now();
  const fills = [];
  /* Las operaciones se numeran hacia atrás desde ahora: la 0 es la más vieja. La última
     cierra hace media hora, así que el tilt no llega a caducar por hueco ni por día. */
  const N = 34;
  const paso = 5 * H;
  const t0 = now - (N + 1) * paso;

  /* Resultado por operación: ganadoras y perdedoras chicas alternadas. Con `tilt`, las
     tres últimas son perdedoras y una se pasa de una vez y media la banda — racha ≥ 3
     MÁS proceso roto, que son las dos condiciones del modo. Sin la segunda, perder tres
     veces no lo enciende, y eso es del diseño y no un descuido de la fixture. */
  const pnls = [];
  for (let i = 0; i < N - 3; i++) pnls.push((i % 3) !== 0 ? 0.42 : -0.28);
  if (conTilt) pnls.push(-0.30, -0.26, -1.10);
  else pnls.push(0.42, -0.28, 0.42);

  const coin = 'xyz:DRAM';
  for (let i = 0; i < N; i++) {
    const entra = t0 + i * paso;
    const sale = entra + 40 * 6e4;
    const pnl = pnls[i];
    const px = 10;
    const sz = 1.4;                       // notional ~US$14, arriba del mínimo de orden
    fills.push(fill(coin, 'B', px, sz, entra, 0, 0.02));
    fills.push(fill(coin, 'A', px + pnl / sz, sz, sale, pnl, 0.02));
  }

  // posición abierta ahora mismo, sin cerrar: la que hace que el botón marque `enpos`
  const abre = now - 2 * H;
  fills.push(fill('xyz:SPCX', 'B', 25, 0.8, abre, 0, 0.03));

  /* Colateral: arranca en 4,20 y termina en 3,42, la escala de la que él opera. Un punto
     cada dos horas cubre todo el historial, así que `equityEn` no extrapola nunca y la
     cobertura da 1,0. */
  const hist = [];
  for (let x = t0 - H; x <= now + H; x += 2 * H) {
    const f = (x - (t0 - H)) / ((now + H) - (t0 - H));
    hist.push([x, (4.2 - 0.78 * f).toFixed(4)]);
  }

  return {
    user: USER,
    pulledAt: now,
    dexes: ['xyz'],
    fills,
    funding: [],
    state: {
      xyz: {
        marginSummary: { accountValue: '3.42', totalMarginUsed: '1.00' },
        assetPositions: [{
          type: 'oneWay',
          position: {
            coin: 'xyz:SPCX', szi: '0.8', entryPx: '25', positionValue: '19.6',
            unrealizedPnl: '-0.4', marginUsed: '0.98',
            leverage: { type: 'cross', value: 20 }, maxLeverage: 20,
            liquidationPx: '23.9'
          }
        }]
      }
    },
    orders: {
      xyz: [{
        coin: 'xyz:SPCX', isTrigger: true, triggerPx: '24.2', isPositionTpsl: true,
        reduceOnly: true, side: 'A', sz: '0.8', orderType: 'Stop Market',
        oid: 1, timestamp: abre
      }]
    },
    portfolio: { xyz: [['allTime', { accountValueHistory: hist }]] },
    diag: []
  };
}

module.exports = armar();
module.exports.armar = armar;   // por si un test necesita uno limpio
