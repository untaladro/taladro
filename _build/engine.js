/* ===== Motor de reconstrucción de trades y analítica (Hyperliquid / trade.xyz) ===== */

function sgn(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }
const EPS = 1e-9;

/* Un fill de Hyperliquid:
   { coin, px, sz, side: 'B'|'A', time, closedPnl, fee, dir, oid, hash, tid }
   Los perps HIP-3 (trade.xyz) llegan con el dex como prefijo: "xyz:AAPL". */
function parseCoin(coin) {
  const i = coin.indexOf(':');
  return i === -1
    ? { dex: 'hyperliquid', symbol: coin }
    : { dex: coin.slice(0, i), symbol: coin.slice(i + 1) };
}

/* ===== Sesiones =====
   El subyacente de estos perps son acciones: el perp opera 24/5 pero el mercado real no.
   Clasificamos por el reloj de Nueva York (maneja el horario de verano solo) y mostramos
   todo en hora de Buenos Aires (UTC-3, sin DST). */
const SESSIONS = {
  asia:    { label: 'Asia / KRX',      art: '21:00 - 03:30' },
  hueco:   { label: 'Hueco nocturno',  art: '03:30 - 05:00' },
  pre:     { label: 'Pre-market US',   art: '05:00 - 10:30' },
  rueda:   { label: 'Rueda US',        art: '10:30 - 17:00' },
  after:   { label: 'After-hours US',  art: '17:00 - 21:00' },
  finde:   { label: 'Fin de semana',   art: 'vie 21:00 - dom 21:00' }
};

let _etFmt = null;
function etParts(ts) {
  try {
    if (!_etFmt) _etFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour12: false,
      weekday: 'short', hour: '2-digit', minute: '2-digit'
    });
    const p = {};
    for (const x of _etFmt.formatToParts(new Date(ts))) p[x.type] = x.value;
    const dows = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { dow: dows[p.weekday], min: (+p.hour % 24) * 60 + (+p.minute) };
  } catch (e) {
    // sin Intl: caemos a UTC-4 como aproximación
    const d = new Date(ts - 4 * 36e5);
    return { dow: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }
}

/* ===== Un solo día para todo lo que se cuenta =====
   Las sesiones se clasifican por Nueva York porque eso describe el mercado. Pero un día
   es un día vivido: "hoy llevás 6 operaciones" tiene que arrancar a la medianoche de
   Buenos Aires, no a la de Londres ni a la del reloj de la máquina.

   Antes convivían tres husos en el mismo motor: `s.days` agrupaba en UTC, `todayBySession`
   y `buildDayPlan` en la hora local del navegador, y las sesiones en Nueva York. La
   mediana diaria y el techo de ráfaga del modo aire salían de días UTC, mientras que
   "hoy llevás N" salía de días locales: toda operación de la noche argentina caía en un
   día para una cuenta y en otro para la otra. Acá se unifica.

   Argentina no cambia de hora desde 2009, así que UTC-3 fijo es exacto y no depende
   de que exista Intl. */
const BA_OFF = 3 * 36e5;
function diaBA(ts) { return new Date(ts - BA_OFF).toISOString().slice(0, 10); }
function relojBA(ts) {
  const d = new Date(ts - BA_OFF);
  return { h: d.getUTCHours(), dow: d.getUTCDay() };
}

function sessionOf(ts) {
  const { dow, min } = etParts(ts);
  // Mercado cerrado en trade.xyz: viernes 20:00 ET -> domingo 20:00 ET
  if (dow === 6 || (dow === 5 && min >= 1200) || (dow === 0 && min < 1200)) return 'finde';
  if (min >= 1200 || min < 150) return 'asia';    // 20:00 - 02:30 ET
  if (min < 240) return 'hueco';                  // 02:30 - 04:00
  if (min < 570) return 'pre';                    // 04:00 - 09:30
  if (min < 960) return 'rueda';                  // 09:30 - 16:00
  return 'after';                                 // 16:00 - 20:00
}

/* ===== Tramos de la rueda americana =====
   La actividad intradiaria tiene forma de U: mucho volumen en la apertura, hueco al
   mediodía y repunte en el cierre por rebalanceo y órdenes al cierre. Los bordes de esos
   tramos son horarios, no pronósticos: son momentos donde el régimen suele cambiar. */
const TRAMOS = [
  { id: 'apertura', label: 'Apertura',     frase: 'la apertura',    art: '10:30 - 11:30', de: 570, a: 630 },
  { id: 'media',    label: 'Media mañana', frase: 'la media mañana', art: '11:30 - 13:00', de: 630, a: 720 },
  { id: 'mediodia', label: 'Mediodía',     frase: 'el mediodía',    art: '13:00 - 15:00', de: 720, a: 840 },
  { id: 'tarde',    label: 'Tarde',        frase: 'la tarde',       art: '15:00 - 16:00', de: 840, a: 900 },
  { id: 'cierre',   label: 'Cierre',       frase: 'el cierre',      art: '16:00 - 17:00', de: 900, a: 960 }
];
function tramoDe(ts) {
  if (sessionOf(ts) !== 'rueda') return null;
  const { min } = etParts(ts);
  const t = TRAMOS.find(x => min >= x.de && min < x.a);
  return t ? t.id : null;
}

/* ===== Calendario y reloj =====
   Solo hechos: los horarios de las sesiones y las fechas del Fed. Ningún pronóstico
   sobre qué va a hacer el precio; las ventanas se usan para etiquetar y después medir. */
/* ===== Calendario de la Fed (5.1) =====
   Es una tabla escrita a mano y por lo tanto tiene fecha de vencimiento. El 1 de enero de
   2027 `ventanaEvento` empezaría a devolver `null` para siempre, las operaciones dejarían
   de marcarse y **nadie se enteraría**: la app seguiría funcionando, solo que sin una de
   sus dimensiones. Es la misma forma de los dos bugs que ya tiene documentados el build —
   el problema nunca fue el error, fue que el error salía como éxito.

   Por eso el vencimiento se dice en dos lugares. `calendarioVence()` lo dice en pantalla,
   y `build.py` corta si faltan menos de 60 días para la última fecha, que es el que
   funciona aunque nadie mire la app. */
const FOMC = ['2026-01-28','2026-03-18','2026-04-29','2026-06-17','2026-07-29','2026-09-16','2026-10-28','2026-12-09',
              '2027-01-27','2027-03-17','2027-04-28','2027-06-09','2027-07-28','2027-09-15','2027-10-27','2027-12-08'];
const FOMC_AVISO_DIAS = 60;

/* Cuánto le queda al calendario. `dias` puede ser negativo: ahí ya venció. */
function calendarioVence(now) {
  if (!FOMC.length) return { ultima: null, dias: -Infinity, vencido: true, porVencer: true };
  const ultima = FOMC[FOMC.length - 1];
  const dias = Math.floor((Date.parse(ultima + 'T23:59:59Z') - (now || Date.now())) / 864e5);
  return { ultima, dias, vencido: dias < 0, porVencer: dias < FOMC_AVISO_DIAS };
}

let _etDia = null;
function etFecha(ts) {
  try {
    if (!_etDia) _etDia = new Intl.DateTimeFormat('en-CA',
      { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
    return _etDia.format(new Date(ts));
  } catch (e) { return new Date(ts - 4 * 36e5).toISOString().slice(0, 10); }
}

/* Ventana de evento de una operación. Comunicado 14:00 ET, conferencia 14:30 ET. */
function ventanaEvento(ts) {
  const dia = etFecha(ts), { min } = etParts(ts);
  if (FOMC.indexOf(dia) >= 0) {
    if (min < 840) return { id: 'previa',      label: 'Fed · antes del anuncio' };
    if (min < 870) return { id: 'impulso',     label: 'Fed · primera media hora' };
    if (min < 900) return { id: 'conferencia', label: 'Fed · conferencia' };
    return { id: 'post', label: 'Fed · después de la conferencia' };
  }
  const hoy = Date.parse(dia);
  for (const d of FOMC) {
    const dif = Math.round((hoy - Date.parse(d)) / 864e5);
    if (dif === 1) return { id: 'dia1',  label: 'Día después del Fed' };
    if (dif === 2 || dif === 3) return { id: 'dia23', label: 'Dos o tres días después del Fed' };
  }
  return null;
}

/* Próximo cambio estructural del día, en hora de Buenos Aires. */
function relojSesion(now) {
  now = now || Date.now();
  const { dow, min } = etParts(now);
  const seg = Math.floor(now / 1000) % 60;
  const faltan = m => (m - min) * 60000 - seg * 1000;
  const HITOS = [
    [240,  'Abre el pre-market',      '05:00'],
    [570,  'Abre la rueda US',        '10:30'],
    [960,  'Cierra la rueda US',      '17:00'],
    [1200, 'Cierra el perp, abre Asia', '21:00']
  ];
  let prox = null;
  const enRueda = min >= 570 && min < 960;
  if (enRueda) {
    const sig = TRAMOS.find(x => x.de > min);
    if (sig) prox = { label: 'Empieza ' + sig.frase,
      art: sig.art.split(' - ')[0], ms: faltan(sig.de) };
  }
  if (!prox) for (const [m, lab, art] of HITOS) if (m > min) { prox = { label: lab, art, ms: faltan(m) }; break; }
  if (!prox) prox = { label: 'Abre el pre-market', art: '05:00', ms: faltan(240 + 1440) };
  if (dow === 5 && min < 1200) prox = { label: 'Cierra por el fin de semana', art: '21:00', ms: faltan(1200) };

  let evento = null;
  if (FOMC.indexOf(etFecha(now)) >= 0) {
    if (min < 840) evento = { label: 'Comunicado del Fed', art: '15:00', ms: faltan(840) };
    else if (min < 870) evento = { label: 'Conferencia de prensa', art: '15:30', ms: faltan(870) };
    else if (min < 900) evento = { label: 'Termina la conferencia', art: '16:00', ms: faltan(900) };
  }
  return { prox, evento, ventana: ventanaEvento(now), tramo: tramoDe(now) };
}

/* Agrupa fills en trades round-trip: de posición plana a posición plana.
   Maneja adds, reducciones parciales y flips (long -> short en un solo fill). */
function buildTrades(fills) {
  const sorted = fills.slice().sort((a, b) => (a.time - b.time) || ((a.tid || 0) - (b.tid || 0)));
  const byCoin = new Map();
  for (const f of sorted) {
    if (!byCoin.has(f.coin)) byCoin.set(f.coin, []);
    byCoin.get(f.coin).push(f);
  }

  const trades = [];
  for (const [coin, list] of byCoin) {
    const { dex, symbol } = parseCoin(coin);
    let pos = 0, cur = null;

    const start = (t, dir) => ({
      coin, dex, symbol, side: dir > 0 ? 'long' : 'short',
      entryTime: t, exitTime: null,
      entrySz: 0, entryNotional: 0, exitSz: 0, exitNotional: 0,
      gross: 0, fees: 0, funding: 0, peakSz: 0, execs: 0, open: true,
      liquidated: false, liqMarkPx: null, makerEntry: null
    });

    for (const f of list) {
      const px = +f.px, sz = +f.sz, fee = +(f.fee || 0);
      if (!(sz > 0)) continue;
      const dir = f.side === 'B' ? 1 : -1;
      let cpLeft = +(f.closedPnl || 0);
      let left = sz;

      while (left > EPS) {
        if (!cur) { cur = start(f.time, dir); cur.makerEntry = !f.crossed; }
        /* el exchange no lo marca en `dir` (dice "Close Long" igual):
           la liquidación viene en un campo aparte del fill */
        if (f.liquidation) { cur.liquidated = true; cur.liqMarkPx = +f.liquidation.markPx || null; }
        const closing = pos !== 0 && sgn(pos) !== dir;
        const part = closing ? Math.min(left, Math.abs(pos)) : left;
        const frac = part / sz;

        if (closing) {
          cur.exitSz += part;
          cur.exitNotional += part * px;
          cur.gross += cpLeft;   // el closedPnl del fill corresponde entero al tramo que cierra
          cpLeft = 0;
        } else {
          cur.entrySz += part;
          cur.entryNotional += part * px;
          cur.gross += cpLeft;   // normalmente 0 en aperturas
          cpLeft = 0;
        }
        cur.fees += fee * frac;
        cur.execs += 1;

        pos += dir * part;
        cur.peakSz = Math.max(cur.peakSz, Math.abs(pos));
        left -= part;

        if (Math.abs(pos) < EPS) {
          pos = 0;
          cur.exitTime = f.time;
          cur.open = false;
          trades.push(cur);
          cur = null;
        }
      }
    }
    if (cur) trades.push(cur); // posición todavía abierta
  }

  for (const t of trades) finalize(t);
  return trades.sort((a, b) => a.entryTime - b.entryTime);
}

function finalize(t) {
  t.session = sessionOf(t.entryTime);
  t.tramo = tramoDe(t.entryTime);
  t.evento = ventanaEvento(t.entryTime);
  t.id = t.coin + '|' + t.entryTime;   // estable entre recargas: sirve de clave para las notas
  t.qty = t.entrySz;
  t.avgEntry = t.entrySz > 0 ? t.entryNotional / t.entrySz : 0;
  t.avgExit = t.exitSz > 0 ? t.exitNotional / t.exitSz : null;
  t.notional = t.entryNotional;
  t.peakNotional = t.peakSz * t.avgEntry;
  t.net = t.gross - t.fees + t.funding;
  t.durationMs = t.exitTime ? t.exitTime - t.entryTime : null;
  t.retPct = t.notional > 0 ? (t.net / t.notional) * 100 : 0;
  return t;
}

/* Atribuye cada pago/cobro de funding al trade abierto en ese momento. */
function attachFunding(trades, fundings) {
  let matched = 0, unmatched = 0;
  for (const fd of fundings || []) {
    const time = fd.time;
    const d = fd.delta || fd;
    const coin = d.coin;
    const usdc = +(d.usdc || 0); // negativo = pagaste funding
    const t = trades.find(x => x.coin === coin && x.entryTime <= time &&
      (x.exitTime === null ? true : time <= x.exitTime));
    if (t) { t.funding += usdc; matched += usdc; } else { unmatched += usdc; }
  }
  for (const t of trades) finalize(t);
  return { matched, unmatched };
}

/* ===== Estadística ===== */
function computeStats(all, holguras, portfolio, now, ejerc, bandaDecl) {
  /* La exposición se anota antes que nada: `habitos`, `tilt` y `aire` la usan como
     referencia de tamaño, y si no hay serie de cuenta caen al notional solos. */
  if (portfolio) anotarExposicion(all, portfolio);
  /* ===== 3.6 — El orden canónico es el de cierre =====
     `buildTrades` devuelve por apertura, y durante mucho tiempo las rachas se contaban así.
     **La racha es un estado psicológico y lo dispara enterarte del resultado, no haber
     abierto.** Con un solo instrumento los dos órdenes coinciden; con varios perps abiertos
     en paralelo —que es lo que él hace— no, y ahí el `tilt` se encendía por una secuencia
     que él nunca vivió: contaba tres pérdidas seguidas porque abrieron seguidas, aunque
     entre medio hubiera cerrado una ganadora.

     Se ordena **una vez, acá**, y todo lo de abajo hereda el mismo orden. No hay una
     segunda vista ordenada al lado: dos definiciones del orden serían la misma trampa que
     este proyecto ya pisó con `escalaTamano` (tres definiciones) y con la banda (seis
     copias), donde la misma operación cumplía para una pieza y fallaba para otra.

     El desempate es `entryTime` y no puede faltar: dos cierres en el mismo milisegundo
     dejarían el orden a merced del sort del navegador, y las rachas cambiarían entre
     recargas sin que nadie tocara nada. */
  const trades = all.filter(t => !t.open).sort((a, b) =>
    ((a.exitTime || a.entryTime) - (b.exitTime || b.entryTime)) || (a.entryTime - b.entryTime));
  const n = trades.length;
  const s = {
    n, nOpen: all.length - n, holgura: holguraHist(all, holguras),
    escala: escalaTamano(trades),
    net: 0, gross: 0, fees: 0, funding: 0,
    wins: [], losses: [], flat: [],
    bySymbol: {}, bySide: { long: { n: 0, net: 0 }, short: { n: 0, net: 0 } },
    byHour: {}, byDur: {}, bySession: {}, byTramo: {},
    liq: { n: 0, net: 0, trades: [] },
    equity: [], maxDD: 0, maxLossStreak: 0, maxWinStreak: 0
  };
  if (!n) return s;

  const DURB = [
    ['< 5 min', 5 * 6e4], ['5-30 min', 30 * 6e4], ['30 min - 4 h', 4 * 36e5],
    ['4-24 h', 24 * 36e5], ['1-7 días', 7 * 864e5], ['> 7 días', Infinity]
  ];

  let cum = 0, peak = 0, ls = 0, ws = 0;
  for (const t of trades) {
    s.net += t.net; s.gross += t.gross; s.fees += t.fees; s.funding += t.funding;
    /* Tres cajas y no dos. El empate exacto no es una ganadora: contarlo como tal inflaba
       `winRate`, y `winRate` alimenta `probRacha` a través de `q = 1 - winRate`. El sesgo
       iba en la peor dirección posible — subestimaba cuán normal es una racha perdedora,
       que es exactamente lo contrario de lo que el principio 9 le pide a esta app. */
    (t.net > 0 ? s.wins : t.net < 0 ? s.losses : s.flat).push(t);

    const sym = s.bySymbol[t.symbol] || (s.bySymbol[t.symbol] = { n: 0, net: 0, wins: 0, fees: 0 });
    sym.n++; sym.net += t.net; sym.fees += t.fees; if (t.net > 0) sym.wins++;

    s.bySide[t.side].n++; s.bySide[t.side].net += t.net;

    /* 5.2 — `byDow` se acumulaba acá y no aparecía en ninguna pantalla. Estado muerto,
       y encima recalculado en cada `computeStats`. `byHour` sí se usa, en los gráficos. */
    const { h } = relojBA(t.entryTime);
    (s.byHour[h] || (s.byHour[h] = { n: 0, net: 0 })).n++; s.byHour[h].net += t.net;

    const bucket = (DURB.find(b => t.durationMs < b[1]) || DURB[DURB.length - 1])[0];
    (s.byDur[bucket] || (s.byDur[bucket] = { n: 0, net: 0 })).n++; s.byDur[bucket].net += t.net;

    const se = s.bySession[t.session] || (s.bySession[t.session] = { n: 0, net: 0, wins: 0 });
    se.n++; se.net += t.net; if (t.net > 0) se.wins++;

    if (t.tramo) {
      const tr = s.byTramo[t.tramo] || (s.byTramo[t.tramo] = { n: 0, net: 0, wins: 0 });
      tr.n++; tr.net += t.net; if (t.net > 0) tr.wins++;
    }

    if (t.liquidated) { s.liq.n++; s.liq.net += t.net; s.liq.trades.push(t); }

    if (t.net < 0) { ls++; ws = 0; } else { ws++; ls = 0; }
    s.maxLossStreak = Math.max(s.maxLossStreak, ls);
    s.maxWinStreak = Math.max(s.maxWinStreak, ws);
  }

  /* ===== La curva acumulada va por cierre, no por apertura =====
     `trades` viene ordenado por `entryTime`, pero el PnL se realiza cuando la posición se
     cierra. Acumular en orden de apertura y después sellar cada punto con `exitTime` daba
     una curva con el eje temporal no monótono: una operación que abre temprano y cierra
     tarde acreditaba su resultado en el lugar de su apertura. El gráfico se dibujaba con
     los puntos desordenados y `maxDD` salía de una secuencia de saldos que nunca existió.

     Con scalping puro no se nota, porque abrir y cerrar caen casi juntos. Pero `byDur`
     contempla tramos de hasta siete días: el motor admite el caso donde sí importa.

     **Desde 3.6 esto ya no reordena nada: `trades` viene por cierre desde arriba.** La
     pregunta que faltaba —¿tu racha es el orden en que abriste o el orden en que te
     enteraste?— se contestó por el segundo, y el orden pasó a ser uno solo para toda la
     app. Este bucle quedó igual salvo que ya no hace su propia copia ordenada. */
  const porCierre = trades;
  for (const t of porCierre) {
    cum += t.net;
    peak = Math.max(peak, cum);
    s.maxDD = Math.max(s.maxDD, peak - cum);
    s.equity.push({ time: t.exitTime || t.entryTime, cum });
  }

  const sum = (a, f) => a.reduce((x, y) => x + f(y), 0);
  s.winRate = s.wins.length / n;
  /* `lossRate` no es `1 - winRate` desde que el empate tiene caja propia, y la diferencia
     importa donde se usa: `probRacha` pregunta por la probabilidad de perder, no por la de
     no ganar. Tomar el complemento del acierto metía los empates adentro de las pérdidas y
     hacía parecer más probable una mala racha de la que es. */
  s.lossRate = s.losses.length / n;
  s.nFlat = s.flat.length;
  s.sumWins = sum(s.wins, t => t.net);
  s.sumLosses = Math.abs(sum(s.losses, t => t.net));
  s.avgWin = s.wins.length ? s.sumWins / s.wins.length : 0;
  s.avgLoss = s.losses.length ? s.sumLosses / s.losses.length : 0;
  s.payoff = s.avgLoss ? s.avgWin / s.avgLoss : Infinity;
  s.profitFactor = s.sumLosses ? s.sumWins / s.sumLosses : Infinity;
  s.expectancy = s.net / n;
  s.avgDurWin = s.wins.length ? sum(s.wins, t => t.durationMs) / s.wins.length : 0;
  s.avgDurLoss = s.losses.length ? sum(s.losses, t => t.durationMs) / s.losses.length : 0;
  s.avgNotional = sum(trades, t => t.notional) / n;
  s.volume = sum(trades, t => t.entryNotional + t.exitNotional);
  s.best = trades.reduce((a, b) => (b.net > a.net ? b : a), trades[0]);
  s.worst = trades.reduce((a, b) => (b.net < a.net ? b : a), trades[0]);
  s.netExBest = s.net - s.best.net;
  const top3 = trades.slice().sort((a, b) => b.net - a.net).slice(0, 3);
  s.netExTop3 = s.net - sum(top3, t => t.net);

  // Trades abiertos dentro de los 30 min posteriores al cierre de una perdedora
  const byExit = trades.slice().sort((a, b) => a.exitTime - b.exitTime);
  const revenge = [];
  for (const t of trades) {
    const prev = byExit.filter(x => x.exitTime <= t.entryTime).pop();
    if (prev && prev.net < 0 && t.entryTime - prev.exitTime <= 30 * 6e4) revenge.push(t);
  }
  s.revenge = { n: revenge.length, net: sum(revenge, t => t.net) };

  /* El tamaño después de perder contra después de ganar lo mide `estabilidad`, y solo
     esa. Acá vivía una segunda versión —`sizeAfterLoss` / `sizeAfterWin`— que promediaba
     notional crudo: con apalancamiento fijo eso es colateral × 20, así que medía el PnL y
     lo publicaba con nivel `bad` y clase acción. Peor, el sesgo iba hacia el silencio:
     después de perder tenés menos colateral, el notional posterior sale más chico solo, y
     la razón nunca llegaba al umbral. Estaba callada por construcción, no por conducta. */

  // Concentración diaria: días con muchos trades vs días tranquilos
  const days = {};
  for (const t of trades) {
    const k = diaBA(t.entryTime);
    (days[k] || (days[k] = { n: 0, net: 0 })).n++; days[k].net += t.net;
  }
  s.days = days;
  const dayArr = Object.values(days);
  /* La mediana diaria se sigue calculando porque `aire.ráfaga` la usa como techo, que es
     otra cosa: ahí es un umbral sobre la cantidad del día, no un corte para comparar dos
     grupos.

     Lo que vivía acá era `netBusyDay` contra `netCalmDay`: el PnL promedio de los días con
     más operaciones que la mediana contra el resto. `adherenciaDiaria` ya tiene escrito por
     qué ese corte no sirve —con distribución bimodal la mediana cae encima de un modo y un
     lado queda vacío— y aun así la tarjeta salía sin terciles y sin split-half, al lado de
     la tarjeta de `s.dias` que sí exige las dos mitades. Dos afirmaciones sobre lo mismo con
     distinto rigor, y la floja tenía menos requisitos para hablar. Además comparaba PnL
     donde la otra compara conducta, que es lo que el principio 4 pide. */
  s.medianTradesDay = dayArr.length
    ? dayArr.map(d => d.n).sort((a, b) => a - b)[Math.floor(dayArr.length / 2)] : 0;
  s.nDays = dayArr.length;
    s.adherence = adherence(trades);
  s.trades = trades;
  /* Antes que `habitos`, `tilt`, `aire` y `presupuesto`, que las cuatro le preguntan.
     Necesita `s.adherence` ya calculado, así que no puede vivir arriba con `s.escala`. */
  s.banda = bandaRiesgo(s, bandaDecl);
  s.mitades = mitades(trades);

  // Entradas que siguen a dos o más pérdidas consecutivas
  {
    const sel = [];
    let racha = 0;
    for (const t of trades) {
      if (racha >= 2) sel.push(t);
      racha = t.net < 0 ? racha + 1 : 0;
    }
    const set = new Set(sel), resto = trades.filter(t => !set.has(t));
    const av = a => (a.length ? a.reduce((x, y) => x + y.net, 0) / a.length : 0);
    s.trasRacha = { n: sel.length, avg: av(sel), nResto: resto.length, avgResto: av(resto) };
  }
    s.comparativas = comparativas(trades, s);
  /* Expuesto aparte y no solo como propiedad del array: un `.filter()` en cualquier
     consumidor se llevaría `out.bh` puesto, sin error. */
  s.comparativasBH = s.comparativas.bh || null;
  s.presupuesto = presupuesto(trades, s);
  /* Antes que `aire`, que la consume: la estabilidad se define una sola vez para toda la
     app y no se recalcula adentro de ningún modo. */
  s.estabilidad = estabilidad(trades, s.escala);
  s.tilt = tilt(s, now);
  s.aire = aire(s, now);
  s.dias = adherenciaDiaria(trades, s);
  /* Después de `habitos` tener con qué: `adherenciaSesion` le pregunta a `serieTest`. */
  s.franjas = adherenciaSesion(s);
  s.ejercicio = ejercicio(s, ejerc, now);
  s.verdades = verdades(s);

  return s;
}

/* Primera mitad contra segunda mitad de la muestra, por fecha.
   Es el chequeo más barato para saber si lo que ves describe tu método o tu época. */
function mitades(trades) {
  if (trades.length < 10) return null;
  const o = trades.slice().sort((a, b) => (a.exitTime || a.entryTime) - (b.exitTime || b.entryTime));
  const m = Math.floor(o.length / 2);
  const r = a => {
    const L = a.filter(t => t.net < 0);
    return {
      n: a.length,
      exp: a.reduce((x, y) => x + y.net, 0) / a.length,
      wr: a.filter(t => t.net > 0).length / a.length,
      avgLoss: L.length ? Math.abs(L.reduce((x, y) => x + y.net, 0) / L.length) : 0,
      desde: o[0] ? a[0].entryTime : null, hasta: a[a.length - 1] ? a[a.length - 1].entryTime : null
    };
  };
  return { vieja: r(o.slice(0, m)), nueva: r(o.slice(m)) };
}

/* Últimas N operaciones contra todo lo anterior: qué estás sosteniendo y qué soltaste. */
function adherence(trades, N) {
  N = N || 20;
  if (trades.length < 8) return null;
  const rec = trades.slice(-N), base = trades.slice(0, -N);
  if (base.length < 4) return null;
  const m = arr => {
    const L = arr.filter(t => t.net < 0), W = arr.filter(t => t.net > 0);
    const avg = (a, f) => (a.length ? a.reduce((x, y) => x + f(y), 0) / a.length : 0);
    return {
      n: arr.length,
      winRate: W.length / arr.length,
      avgLoss: L.length ? Math.abs(avg(L, t => t.net)) : 0,
      worstLoss: L.length ? Math.abs(Math.min(...L.map(t => t.net))) : 0,
      durLoss: avg(L, t => t.durationMs),
      durWin: avg(W, t => t.durationMs),
      notional: avg(arr, t => t.notional),
      liq: arr.filter(t => t.liquidated).length,
      expectancy: avg(arr, t => t.net)
    };
  };
  return { rec: m(rec), base: m(base) };
}

/* ===== Posiciones abiertas en vivo =====
   Cruza lo que tenés abierto contra las órdenes trigger vigentes. La pregunta que responde
   es una sola: ¿tu stop entra antes que el del exchange? */
function analyzePositions(positions, orders, s) {
  const out = [];
  for (const p of positions || []) {
    const P = p.position || p;
    const szi = +P.szi;
    if (!szi) continue;
    const sz = Math.abs(szi), long = szi > 0;
    const notional = Math.abs(+(P.positionValue || 0));
    const mark = notional && sz ? notional / sz : +(P.entryPx || 0);
    const entry = +(P.entryPx || 0);
    const liqPx = +(P.liquidationPx || 0) || null;
    const lev = P.leverage ? +P.leverage.value : (notional && +P.marginUsed ? notional / +P.marginUsed : null);

    // órdenes trigger de este coin que reducen la posición
    const trig = (orders || []).filter(o => o.coin === P.coin &&
      (o.isTrigger || o.triggerPx) && (o.reduceOnly !== false));
    const px = o => +(o.triggerPx || o.limitPx || 0);
    // para un long, el stop está por debajo del mark; el take profit por encima
    const stops = trig.filter(o => long ? px(o) < mark : px(o) > mark).sort((a, b) => long ? px(b) - px(a) : px(a) - px(b));
    const tps = trig.filter(o => long ? px(o) > mark : px(o) < mark).sort((a, b) => long ? px(a) - px(b) : px(b) - px(a));
    const stopPx = stops.length ? px(stops[0]) : null;
    const tpPx = tps.length ? px(tps[0]) : null;

    const pctFrom = t => t ? Math.abs(mark - t) / mark * 100 : null;
    const r = {
      coin: P.coin, symbol: parseCoin(P.coin).symbol, dex: parseCoin(P.coin).dex,
      side: long ? 'long' : 'short', sz, notional, entry, mark, liqPx, lev,
      uPnl: +(P.unrealizedPnl || 0), margin: +(P.marginUsed || 0),
      stopPx, tpPx, distLiq: pctFrom(liqPx), distStop: pctFrom(stopPx), distTp: pctFrom(tpPx),
      // lo que efectivamente vas a anotar si salta el stop, medido contra la entrada
      pnlAtStop: stopPx ? (stopPx - entry) * szi : null,
      // lo que perdés desde acá (incluye la ganancia no realizada que estás devolviendo)
      riesgo: stopPx ? Math.abs(mark - stopPx) * sz : null,
      alerts: []
    };
    const A = (level, text) => r.alerts.push({ level, text });

    if (!stopPx) {
      A('bad', `Sin stop cargado. La única salida definida es la liquidación` +
        (r.distLiq ? `, a ${r.distLiq.toFixed(2)}% del mark` : '') +
        `. Tus dos peores operaciones históricas terminaron exactamente así.`);
    } else if (r.distLiq && r.distStop >= r.distLiq) {
      A('bad', `Tu stop (${r.distStop.toFixed(2)}%) está más lejos que la liquidación (${r.distLiq.toFixed(2)}%). ` +
        `Nunca se va a ejecutar: te liquidan primero.`);
    } else if (r.distLiq && r.distStop > r.distLiq * 0.6) {
      A('warn', `Stop a ${r.distStop.toFixed(2)}% y liquidación a ${r.distLiq.toFixed(2)}%: poco margen. ` +
        `Un gap o el slippage de un mercado fino se comen la diferencia.`);
    } else {
      A('good', `Stop a ${r.distStop.toFixed(2)}%, liquidación a ${r.distLiq ? r.distLiq.toFixed(2) + '%' : 's/d'}. ` +
        `Salís vos, no el exchange.`);
    }
    /* La guarda era `s.adherence`, que es `null` hasta las ocho operaciones. Ahora es la
       banda: con un techo declarado el aviso tiene que funcionar desde la primera, porque
       el número no depende de tener historial — depende de que lo hayas escrito. */
    if (r.pnlAtStop != null && s && s.banda && s.banda.limite > 0) {
      const B = s.banda, p = r.pnlAtStop, lim = B.limite;
      const dec = B.base === 'declarada';
      if (p >= 0) {
        A('good', `El stop ya está en ganancia: si salta anotás ${p > 0 ? '+' : ''}US$${p.toFixed(2)}. ` +
          `Esta operación no puede costarte plata.`);
      } else if (Math.abs(p) > lim) {
        A('warn', `Si salta el stop anotás -US$${Math.abs(p).toFixed(2)}: ${(Math.abs(p) / lim).toFixed(1)}x ` +
          (dec ? `el techo de US$${lim.toFixed(2)} que declaraste.`
               : `tu banda habitual de US$${lim.toFixed(2)}.`));
      } else {
        A('good', `Si salta el stop anotás -US$${Math.abs(p).toFixed(2)}, dentro de ` +
          (dec ? `el techo de US$${lim.toFixed(2)} que declaraste.` : `tu banda habitual (US$${lim.toFixed(2)}).`));
      }
    }
    if (!tpPx) A('info', `Sin objetivo cargado: el ratio objetivo/stop de esta operación queda sin definir.`);
    else if (r.distStop) {
      const rr = r.distTp / r.distStop;
      A(rr >= 2 ? 'good' : 'warn', `Ratio objetivo/stop: ${rr.toFixed(1)}:1.` +
        (rr < 2 ? ` Debajo de 2:1 necesitás más de 50% de acierto para empatar.` : ''));
    }
    const ses = sessionOf(Date.now());
    if ((ses === 'pre' || ses === 'after' || ses === 'finde') && lev && lev >= 10) {
      A('warn', `${lev}x con el subyacente fuera de rueda (${SESSIONS[ses].label}), ` +
        `donde el libro es más fino y las bandas de descubrimiento más anchas.`);
    }
    const order = { bad: 0, warn: 1, good: 2, info: 3 };
    r.alerts.sort((a, b) => order[a.level] - order[b.level]);
    out.push(r);
  }
  return out;
}

/* ===== Holgura =====
   La variable real cuando el colateral es chico no es el apalancamiento: con US$3,42 y
   órdenes mínimas de US$10, el apalancamiento es la entrada, no una decisión. Lo que sí
   se elige es la holgura — cuánto espacio hay entre tu stop y la liquidación.

   El problema es que no se puede reconstruir del historial: `userFillsByTime` no devuelve
   ni el stop que tenías cargado ni el apalancamiento de esa posición. Los fills dicen a
   qué precio entraste y saliste, nada más. Cualquier cálculo ex-post tendría que suponer
   el apalancamiento, y un supuesto acá no es una aproximación: es inventar justo el número
   que importa.

   Así que se mide en vivo y se guarda. Cada vez que la app ve una posición abierta anota
   la relación stop/liquidación, y cuando el trade cierra el dato queda pegado a su `id`,
   igual que las notas. Se guarda el ratio PEOR de la vida de la posición, no el último:
   si en algún momento el stop estuvo más lejos que la liquidación, eso pasó, aunque
   después lo hayas corregido.

   La contrapartida es honesta y hay que decirla en pantalla: solo cubre las posiciones
   que la app llegó a ver abiertas. Por eso `holguraHist` devuelve siempre la cobertura,
   y ninguna conclusión se dice sin ella al lado. */
const HOLG_APRETADA = 0.6;   // el mismo umbral con el que analyzePositions ya avisa en vivo

/* Anota la holgura de las posiciones vivas contra el trade abierto que les corresponde. */
function registrarHolgura(posAn, trades, store, now) {
  store = store || {};
  now = now || Date.now();
  const abiertos = (trades || []).filter(t => t.open);
  for (const p of posAn || []) {
    const t = abiertos.find(x => x.coin === p.coin);
    if (!t) continue;
    const e = store[t.id] || (store[t.id] = {
      coin: p.coin, desde: now, n: 0, estuvoSinStop: false,
      ratio: null, distStop: null, distLiq: null, lev: null
    });
    e.hasta = now; e.n++;
    if (!p.stopPx) { e.estuvoSinStop = true; continue; }
    if (!p.distLiq) continue;          // sin dato de liquidación no hay nada que comparar
    const r = p.distStop / p.distLiq;  // < 1 salís vos; >= 1 manda el exchange
    if (e.ratio == null || r > e.ratio) {
      e.ratio = r; e.distStop = p.distStop; e.distLiq = p.distLiq; e.lev = p.lev;
    }
  }
  return store;
}

/* Resume lo observado. Descriptivo: cuenta en cuántas salías vos y en cuántas el exchange,
   sin decir cuál tendría que ser el número. */
function holguraHist(all, store) {
  const T = (all || []).filter(t => !t.open);
  store = store || {};
  const obs = [];
  for (const t of T) { const e = store[t.id]; if (e) obs.push({ t, e }); }

  const base = { n: obs.length, total: T.length, cobertura: T.length ? obs.length / T.length : 0 };
  if (!obs.length) return base;

  const medi = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
  /* Una posición que estuvo sin stop no tiene ratio: su única salida definida era la
     liquidación. No entra en la mediana —no hay número que promediar— pero se cuenta
     aparte, que es lo que la hace grave. */
  const sinStop = obs.filter(o => o.e.estuvoSinStop);
  const conStop = obs.filter(o => !o.e.estuvoSinStop && o.e.ratio != null);
  const ratios = conStop.map(o => o.e.ratio);

  const invertidas = conStop.filter(o => o.e.ratio >= 1);
  const apretadas = conStop.filter(o => o.e.ratio > HOLG_APRETADA && o.e.ratio < 1);
  const holgadas = conStop.filter(o => o.e.ratio <= HOLG_APRETADA);

  /* Deriva: las últimas diez observadas contra las anteriores. Mismo criterio que
     `adherence` — la pregunta no es cómo estás sino si te estás corriendo. */
  let deriva = null;
  if (conStop.length >= 14) {
    const rec = ratios.slice(-10), prev = ratios.slice(0, -10);
    deriva = { rec: medi(rec), base: medi(prev), nRec: rec.length, nBase: prev.length };
  }

  /* Las liquidaciones observadas: ¿estaban avisadas? Esto es lo que valida —o desmiente—
     la frase que la app ya viene diciendo en `buildInsights`. */
  const liq = obs.filter(o => o.t.liquidated);
  const liqAvisadas = liq.filter(o => o.e.estuvoSinStop || (o.e.ratio != null && o.e.ratio >= 1));

  return Object.assign(base, {
    conStop: conStop.length, sinStop: sinStop.length,
    mediana: conStop.length ? medi(ratios) : null,
    /* 3.3 — La distancia al stop que la app **vio en vivo**, en porcentaje. Es otra cosa
       que `mediana`, que es la razón stop/liquidación: acá interesa dónde pusiste el stop
       y no cuán cerca quedó del margen. Lo consume `presupuesto` para romper su
       circularidad — antes sacaba el stop típico de `|net| / notional` de las perdedoras,
       o sea del resultado. */
    stopMediano: conStop.length ? medi(conStop.map(o => o.e.distStop).filter(x => x > 0)) : null,
    peor: conStop.length ? Math.max.apply(null, ratios) : null,
    invertidas: invertidas.length, apretadas: apretadas.length, holgadas: holgadas.length,
    deriva, nLiq: liq.length, nLiqAvisadas: liqAvisadas.length,
    umbral: HOLG_APRETADA,
    ultima: obs[obs.length - 1].e
  });
}

/* ===== 3.5 — El p-value de un corte, por permutación =====

   `comparativas` genera del orden de 15 a 30 cortes, y hasta acá el único filtro era
   `estable`: que la diferencia apareciera con el mismo signo en las dos mitades. Eso
   controla la **época** y está bien, pero bajo hipótesis nula coincidir en signo pasa la
   mitad de las veces. Con 30 cortes, unos 15 pasan por azar — y `repertorio` levantaba el
   primero del ranking y lo decía como un hallazgo.

   **Split-half y multiplicidad son dos problemas distintos y ninguno reemplaza al otro.**
   `estable` pregunta si el patrón sobrevive al paso del tiempo; esto pregunta si aparece
   más seguido que el azar. Un corte puede aguantar las dos mitades y ser ruido igual, y
   puede tener un p chiquito y describir solo una época. Por eso quedan los dos y
   `repertorio` pide ambos.

   **Por qué permutación y no un test t.** La distribución de PnL de esto no es normal ni
   de cerca: cola larga a la izquierda por las liquidaciones, masa concentrada cerca de
   cero, y muestras de 5 a 40 operaciones. Un test t sobre eso da un número con tres
   decimales y ninguna garantía. Barajar las etiquetas no supone nada: construye la
   distribución nula con sus propios datos.

   Dos detalles de implementación que no son cosméticos:

   **El RNG es determinista y sembrado con el corte.** Sin esto el mismo historial daría un
   p distinto en cada render, y un corte entraría y saldría del ranking solo — que es
   exactamente el tipo de inestabilidad silenciosa que este proyecto persigue. La semilla
   sale del label y de los tamaños, así que dos cortes distintos no comparten sorteo y el
   mismo corte da siempre lo mismo.

   **El p nunca es cero.** Se cuenta `(1 + extremos) / (1 + B)`, la corrección de Davison &
   Hinkley. Con B finito, un p de 0 afirmaría "esto no pasa nunca por azar", y lo único que
   se midió es que no pasó en 2000 intentos. El piso honesto con B=2000 es 1/2001. */
const PERM_B = 2000;      // barajadas por corte
const BH_Q = 0.10;        // tasa de falsos descubrimientos que se acepta

function rng32(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function semillaDe(txt) {
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* Probabilidad de ver una diferencia de promedios al menos tan grande como la observada
   si las etiquetas no significaran nada. `vals` son los netos del universo, `k` cuántos
   cayeron en el grupo. Devuelve `{ p, cota, barajadas }`, con `p` en `null` cuando no hay
   nada que permutar.

   **Y para en cuanto sabe que el corte no va a sobrevivir.** El umbral más laxo que puede
   aplicar BH es `q`, así que si el p parcial ya lo supera, seguir barajando no cambia el
   veredicto — y la mayoría de los ~30 cortes son de ésos. Cortar ahí saca el grueso del
   trabajo sin perder un dígito donde importa: los p chicos se calculan enteros. El precio
   es que ese número pasa a ser una **cota inferior** y no un valor, y eso se dice: la
   tabla muestra `> 0,10` y no un decimal inventado. */
function pPermutacion(vals, k, difObs, semilla, B, qMax) {
  const n = vals.length;
  if (!(k > 0) || k >= n) return { p: null, cota: false, barajadas: 0 };
  B = B || PERM_B;
  const total = vals.reduce((a, b) => a + b, 0);
  const obs = Math.abs(difObs);
  const rnd = rng32(semilla);
  const tope = qMax == null ? BH_Q : qMax;
  const MIN_B = 200;   // antes de esto el p parcial es ruido y cortar sería adivinar
  /* Fisher-Yates parcial: solo los primeros `k` intercambios, que es lo único que hace
     falta para tomar una muestra sin reemplazo. O(k) por permutación y no O(n) — con 30
     cortes × 2000 barajadas la diferencia es real. */
  const a = vals.slice();
  let extremos = 0, hechas = 0, cota = false;
  for (let b = 0; b < B; b++) {
    let suma = 0;
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(rnd() * (n - i));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      suma += a[i];
    }
    /* La misma diferencia que mide el corte: promedio del grupo menos promedio del resto. */
    const dif = suma / k - (total - suma) / (n - k);
    if (Math.abs(dif) >= obs - EPS) extremos++;
    hechas = b + 1;
    if (hechas >= MIN_B && tope > 0 && (1 + extremos) / (1 + hechas) > tope) { cota = true; break; }
  }
  return { p: (1 + extremos) / (1 + hechas), cota, barajadas: hechas };
}

/* Benjamini-Hochberg: de todos los cortes con p, cuáles sobreviven controlando la tasa de
   falsos descubrimientos en `q`. Es menos conservador que Bonferroni y es el que
   corresponde acá: no se busca "ningún falso positivo" —imposible con 30 cortes y esta
   muestra— sino que de lo que se afirme, a lo sumo el 10% sea ruido.

   Marca `sobrevive` en el lugar y devuelve cuántos pasaron. */
function benjaminiHochberg(items, q) {
  q = q || BH_Q;
  const conP = items.filter(x => x.p != null);
  for (const x of items) x.sobrevive = false;
  const m = conP.length;
  if (!m) return { m: 0, k: 0, corte: null };
  const orden = conP.slice().sort((a, b) => a.p - b.p);
  /* El mayor i cuyo p(i) todavía cae debajo de (i/m)·q. Todos los de arriba se rechazan,
     incluidos los que individualmente no pasarían: eso es BH y no un error. */
  let k = 0;
  for (let i = 0; i < m; i++) if (orden[i].p <= ((i + 1) / m) * q) k = i + 1;
  for (let i = 0; i < k; i++) orden[i].sobrevive = true;
  return { m, k, corte: k ? (k / m) * q : null, q };
}

/* Comparativas descriptivas: qué rindió cada contexto contra el resto de tus operaciones.
   Sin recomendaciones — solo el promedio por operación de cada grupo y el de su complemento. */
function comparativas(trades, s) {
  const out = [];
  const av = a => (a.length ? a.reduce((x, y) => x + y.net, 0) / a.length : 0);
  /* Partimos la muestra al medio por fecha. Si una diferencia solo aparece en una mitad,
     probablemente esté describiendo una época tuya y no el contexto. */
  const orden = trades.slice().sort((a, b) => (a.exitTime || a.entryTime) - (b.exitTime || b.entryTime));
  const vieja = new Set(orden.slice(0, Math.floor(orden.length / 2)).map(t => t.id));
  /* `universo` existe por el corte de tamaño y por nada más, pero es la parte que importa.
     El resto de los cortes parten la muestra entera: una operación o cayó en la sesión de
     Asia o no cayó, y no hay tercer estado. El tamaño sí lo tiene — `escalaTamano.de()`
     devuelve `null` cuando no hay colateral de ese momento— y sin esto esas operaciones se
     iban al `resto` por descarte, o sea que "no se pudo medir" quedaba comparado contra
     "grande" como si fuera "chica". Es la invariante 2 otra vez: el `null` sale del
     denominador, no se acomoda del lado que sobra. */
  const push = (label, sel, universo) => {
    const U = universo || trades;
    if (sel.length < 3 || sel.length === U.length) return;
    const set = new Set(sel), resto = U.filter(t => !set.has(t));
    if (!resto.length) return;
    const difMitad = esVieja => {
      const g = sel.filter(t => vieja.has(t.id) === esVieja);
      const r = resto.filter(t => vieja.has(t.id) === esVieja);
      return (g.length >= 3 && r.length >= 3) ? av(g) - av(r) : null;
    };
    const difA = difMitad(true), difB = difMitad(false);
    const avgSel = av(sel), avgResto = av(resto);
    /* La semilla lleva el label y los dos tamaños: el mismo corte sobre el mismo historial
       da siempre el mismo p, y dos cortes distintos no comparten sorteo. */
    const perm = pPermutacion(U.map(t => t.net), sel.length, avgSel - avgResto,
      semillaDe(label + '|' + sel.length + '|' + U.length));
    out.push({ label, n: sel.length, avg: avgSel, nResto: resto.length, avgResto,
      difA, difB,   // un cero en las dos mitades no es coincidencia de signo: es no haber diferencia
      estable: difA != null && difB != null && difA !== 0 && difB !== 0
        && Math.sign(difA) === Math.sign(difB),
      p: perm.p, pCota: perm.cota, barajadas: perm.barajadas,
      sobrevive: false });   // `sobrevive` lo escribe Benjamini-Hochberg al final
  };

  const byExit = trades.filter(t => t.exitTime).slice().sort((a, b) => a.exitTime - b.exitTime);
  push('Abiertas dentro de los 30 min de cerrar una pérdida', trades.filter(t => {
    const prev = byExit.filter(x => x.exitTime <= t.entryTime).pop();
    return prev && prev.net < 0 && t.entryTime - prev.exitTime <= 30 * 6e4;
  }));

  const sel = []; let racha = 0;
  for (const t of trades) { if (racha >= 2) sel.push(t); racha = t.net < 0 ? racha + 1 : 0; }
  push('Abiertas después de 2 o más pérdidas seguidas', sel);

  /* 3.4 — El corte de tamaño le pregunta a `escalaTamano` como todo el resto de la app.
     Antes partía por el promedio del notional crudo, que con apalancamiento fijo es
     colateral × 20: sube y baja solo con el PnL, así que "las grandes" terminaba siendo
     "las que hiciste cuando la cuenta venía bien". Es el error #4 de CLAUDE.md, el mismo
     que ya sacó a `sizeAfterLoss/Win`, sobreviviendo en otra función.

     Dos cambios más, chicos y del mismo lado. **Mediana y no promedio**, que es lo que usa
     el resto de la app y lo que no arrastra una sola operación enorme. Y **la etiqueta dice
     cuál base se usó**: si la app cortó por exposición o por notional cambia qué significa
     la fila, y eso no puede quedar implícito en una tabla que compara PnL. */
  const esc = (s && s.escala) || escalaTamano(trades);
  if (esc && esc.med > 0) {
    const medibles = trades.filter(t => esc.de(t) != null);
    push(esc.base === 'exposicion' ? 'Con más exposición que tu mediana'
                                   : 'Con notional mayor a tu mediana',
      medibles.filter(t => esc.de(t) > esc.med), medibles);
  }

  for (const [k, v] of Object.entries(s.bySession)) {
    if (v.n >= 3) push('En ' + SESSIONS[k].label, trades.filter(t => t.session === k));
  }
  for (const [k, v] of Object.entries(s.byTramo || {})) {
    const tr = TRAMOS.find(x => x.id === k);
    if (v.n >= 3 && tr) push('En ' + tr.frase + ' de la rueda', trades.filter(t => t.tramo === k));
  }
      const evs = [...new Set(trades.map(t => t.evento && t.evento.id).filter(Boolean))];
  for (const k of evs) {
    const lab = (trades.find(t => t.evento && t.evento.id === k).evento).label;
    push(lab, trades.filter(t => t.evento && t.evento.id === k));
  }

  const tesis = [...new Set(trades.map(t => t.tesis).filter(Boolean))];
  for (const k of tesis) push('Tesis: ' + k, trades.filter(t => t.tesis === k));
  const tags = [...new Set(trades.flatMap(t => t.tags || []))];
  for (const k of tags) push('Etiqueta: ' + k, trades.filter(t => (t.tags || []).includes(k)));

  push('Long', trades.filter(t => t.side === 'long'));
  push('Short', trades.filter(t => t.side === 'short'));
    push('Entradas con orden límite', trades.filter(t => t.makerEntry === true));
  push('Cerradas en menos de 5 minutos', trades.filter(t => t.durationMs < 5 * 6e4));
  push('Sostenidas más de 30 minutos', trades.filter(t => t.durationMs > 30 * 6e4));

  /* BH va acá y no adentro de `push`, porque corregir por multiplicidad necesita saber
     cuántas comparaciones hubo, y eso recién se sabe cuando están todas. */
  const bh = benjaminiHochberg(out, BH_Q);
  out.bh = bh;
  return out.sort((a, b) => (a.avg - a.avgResto) - (b.avg - b.avgResto));
}

/* ===== Hábitos =====
   Todo lo que se mide acá es una acción que dependió de vos, no un resultado.
   Las rachas y los hitos son sobre lo que hiciste; el PnL no entra nunca.

   Los tests son de tres valores y no de dos: `true` cumplió, `false` no cumplió, y `null`
   **no hay con qué juzgarlo**. El tercero existe porque `tamano` pregunta por la exposición
   y la exposición necesita el colateral de ese momento, que sale de `accountValueHistory`
   y a veces no está — un dex sin serie, una operación anterior al primer punto.

   Durante un tiempo esa ausencia se contaba como falla. Tres piezas preguntaban a la misma
   `escalaTamano` y dos trataban el `null` como "sin dato no acuso" mientras ésta lo trataba
   como incumplimiento, así que la misma operación quedaba limpia para el modo aire y te
   cortaba la racha acá. Y lo que la cortaba no era algo que hubieras hecho: era un agujero
   en la respuesta de la API. Medir la cobertura de un endpoint y llamarla disciplina es la
   forma más silenciosa de inventar la variable.

   Copiar el fallback de `tilt` y `aire` —tomar el dato faltante como si fuera tu tamaño de
   siempre— arreglaba la racha mintiendo para el otro lado: pinta verde una operación que
   nadie midió. Así que ni una cosa ni la otra. La operación sin dato **sale del
   denominador**: no suma a la racha, no la corta, y no entra en el "N de 20". Se cuenta
   aparte y se dice cuántas fueron. */
function habitos(all, s) {
  const T = (all || []).filter(t => !t.open);
  if (T.length < 3) return [];
  const B = (s && s.banda) || bandaRiesgo(s, null);
  const ref = B.valor;
  const rec = T.slice(-20);
  /* Una sola referencia de tamaño para toda la app: exposición si hay serie de cuenta,
     notional si no. Ver `escalaTamano`. */
  const esc = (s && s.escala) || escalaTamano(T);
  const medNot = esc.med;

  const test = {
    /* El `null` de `dentro` cuando no hay banda es el mismo tercer estado que `tamano`:
       una perdedora que nadie pudo juzgar sale del denominador en vez de contar como
       falla. Antes salía `false` por el `ref > 0 &&`, que acusaba por falta de dato. */
    perdida: t => B.dentro(t),
    /* 3.2 — Acá vivía `corte`: "no sostener una perdedora más de 30 minutos". Era el único
       umbral de la app que no salía de sus datos ni de una decisión suya, y `byDur`
       contempla tramos de hasta 7 días, así que el motor admitía swing y el hábito lo
       castigaba. Se borró y no se reemplazó: derivarlo de su historia lo habría vuelto
       consistente sin arreglar lo de fondo —seguiría siendo una regla que la app se
       inventó— y encima habría heredado exactamente la forma que 3.1 acaba de cerrar.
       La medición no se pierde: la tarjeta de efecto disposición la describe sin
       puntuarla. Lo que se pierde a propósito es la racha, que es lo que la convertía en
       una prescripción de proceso que él nunca escribió. */
    intacto: t => !t.liquidated,
        /* consistencia en las dos direcciones: ni el doble ni la mitad de lo tuyo.
           Sobre exposición, no sobre notional: con apalancamiento fijo el notional sube
           y baja con el colateral, así que medirlo crudo castigaba componer la cuenta.
           Es el único test que puede devolver `null`: sin colateral de ese momento no hay
           exposición, y sin exposición no hay nada que juzgar. */
    tamano:  t => {
      if (!(esc.med > 0)) return null;
      const v = esc.de(t);
      if (v == null) return null;
      return v <= esc.med * 2 && v >= esc.med * 0.5;
    },
    limite:  t => t.makerEntry === true
  };
  const def = [
    /* El rótulo dice contra qué se juzga, igual que `tamano`. No es cosmético: "tu banda"
       nombra dos cosas distintas según haya o no un techo declarado, y la diferencia es
       justamente quién eligió el número. */
    ['perdida', 'Pérdida contenida',  B.base === 'declarada'
      ? 'cerrar la perdedora dentro del techo que declaraste'
      : 'cerrar la perdedora dentro de tu banda'],
    ['intacto', 'Sin liquidaciones',  'cerrar vos, no el exchange'],
        ['tamano',  'Tamaño consistente', esc.base === 'exposicion'
          ? 'poner en juego siempre la misma porción de tu cuenta'
          : 'entrar con un tamaño parecido al de siempre'],
    ['limite',  'Entrada con límite',  'esperar a que el precio toque tu orden en vez de ir a mercado']
  ];
  const metas = [3, 5, 10, 20, 50, 100, 250];
  const ult = T[T.length - 1];

  return def.map(([id, nombre, accion]) => {
    const ok = test[id];

    /* Las tres pasadas tratan el `null` igual: lo atraviesan sin contarlo. La racha no se
       corta con una operación que nadie pudo juzgar, y tampoco crece con ella. */
    let racha = 0;
    for (let i = T.length - 1; i >= 0; i--) {
      const v = ok(T[i]);
      if (v === false) break;
      if (v === true) racha++;
    }
    let mejor = 0, c = 0;
    for (const t of T) {
      const v = ok(t);
      if (v === false) c = 0; else if (v === true) c++;
      mejor = Math.max(mejor, c);
    }
    let rompio = 0;
    if (ok(ult) === false) {
      for (let i = T.length - 2; i >= 0; i--) {
        const v = ok(T[i]);
        if (v === false) break;
        if (v === true) rompio++;
      }
    }

    const vals = rec.map(t => ok(t));
    const cumplidas = vals.filter(v => v === true).length;
    const fallidas = vals.filter(v => v === false).length;
    const sinDato = vals.filter(v => v == null).length;
    const juzgadas = cumplidas + fallidas;
    const estadoUlt = ok(ult) === true ? 'ok' : ok(ult) === false ? 'no' : 'sd';

    return {
      id, nombre, accion, racha, mejor, rompio, ult, estadoUlt,
      /* `cumple` es "no falló", no "cumplió": lo que pinta rojo el panel es el
         incumplimiento, y no haber podido medir no es incumplir. */
      cumple: ok(ult) !== false,
      /* El denominador son las que se pudieron juzgar. Si no se pudo juzgar ninguna,
         `pct` es null y quien lo muestre tiene que decidir qué hacer, en vez de recibir
         un cero que parece un desempeño pésimo. */
      pct: juzgadas ? cumplidas / juzgadas : null,
      cumplidas, deN: juzgadas, sinDato, deTotal: rec.length,
      serie: rec.map(t => { const v = ok(t); return { ok: v === true, estado: v === true ? 'ok' : v === false ? 'no' : 'sd', t }; }),
      serieTest: ok,                             // tri-estado: true / false / null
      meta: metas.find(m => m > racha) || null,
      medNot, ref, esc, banda: B
    };
  });
}

/* ===== La voz de Taladro =====
   Reglas: no habla sin un número, habla poco, festeja antes de marcar, y después de una
   racha perdedora baja el tono. La ironía va en cómo está dicha la frase, nunca colgada
   atrás como remate: una sola oración, sin comentario agregado. */
function taladro(s, pos, td, hab, vistos) {
  const usd = x => (x < 0 ? '-' : '') + 'US$' + Math.abs(x).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const dur = ms => !ms ? '—' : ms < 36e5 ? Math.round(ms / 6e4) + ' minutos' : (ms / 36e5).toFixed(1) + ' horas';
    const d = (tono, linea, id, mins) => ({ habla: true, tono, linea, id, silencio: (mins || 360) * 6e4 });
  const callado = linea => ({ habla: false, tono: 'silencio', linea: linea || '', id: null });
  pos = pos || []; td = td || { hoy: [], net: 0 }; vistos = vistos || {};
  hab = hab || habitos(s.trades || [], s);

  let racha = 0;
  if (s.trades) for (let i = s.trades.length - 1; i >= 0 && s.trades[i].net < 0; i--) racha++;

  /* 1. Riesgo abierto ahora. Es lo único que interrumpe siempre. */
  const sinStop = pos.find(p => !p.stopPx);
  if (sinStop) return d('alerta', `Estás sin stop, tu plan de salida es que decida el exchange ` +
    `a ${sinStop.distLiq ? sinStop.distLiq.toFixed(1) + '%' : 'una distancia sin dato'} de acá.`,
    'sinstop:' + sinStop.coin, 20);
  const invertido = pos.find(p => p.distLiq && p.distStop >= p.distLiq);
  if (invertido) return d('alerta', `Tu stop está a ${invertido.distStop.toFixed(1)}% y la liquidación a ` +
    `${invertido.distLiq.toFixed(1)}%, así que el que manda es el del exchange.`,
    'stopinv:' + invertido.coin, 20);

  /* 2. Tilt: racha con el proceso rompiéndose. Manda sobre todo lo demás salvo el riesgo abierto,
     y no se va hasta que cierres dos operaciones dentro de tu banda. */
  const tl = s.tilt;
  if (tl && tl.activo) {
    /* En positivo, porque es un límite y no una pérdida. Y es `limite`, no `banda`: la
       frase promete qué cuenta como limpia, y lo que `limpia()` acepta es el límite. Con
       banda observada decir el promedio pedía algo más estricto que lo que la app mide. */
    const bn = usdT(tl.limite);
    /* Rota cada dos minutos: la misma frase repetida media hora deja de escucharse.
       Todas apuntan a lo mismo — tamaño y stop, que son tuyos — y ninguna promete
       que esto se termina cuando pase algo. Contar cuánto falta para zafar convierte
       la salida en un premio por resultados, que es justo el pensamiento del tilt. */
    const frases = [
      `${tl.racha} pérdidas seguidas y ${tl.motivos[0]}.`,
      `Respirá, frená y volvé a tu sistema.`,
      `Tamaño de posición y stop. Enfocate en lo que podés controlar vos.`,
      `Bajá un cambio: tu tamaño de siempre es ${(tl.esc || { fmt: usdT }).fmt(tl.med)}.`,
      `Con tu acierto, ${tl.racha} seguidas entra dentro de lo esperable. El tamaño no.`,
      `La próxima no tiene que recuperar nada. Tiene que cerrar dentro de ${bn}.`
    ];
    return d('alerta', frases[Math.floor(Date.now() / 12e4) % frases.length], 'tilt', 15);
  }

  /* 3. Hitos antes que retos: si hay algo para reconocer, gana. */
  const hito = hab.filter(h => h.racha >= 3 && [3, 5, 10, 20, 50, 100, 250].includes(h.racha)
      && h.racha > (vistos[h.id] || 0)).sort((a, b) => b.racha - a.racha)[0];
  if (hito) {
        const f = {
      perdida: `${hito.racha} seguidas cerrando la pérdida donde dijiste que la ibas a cerrar.`,
      tamano:  `${hito.racha} entradas seguidas con el tamaño de siempre.`,
            limite:  `${hito.racha} entradas seguidas esperando a que el precio toque tu orden.`,
      intacto: `${hito.racha} operaciones sin que el exchange cierre por vos.`
    };
        const r = d('ok', f[hito.id], 'hito:' + hito.id + ':' + hito.racha);
    r.hito = { id: hito.id, racha: hito.racha };
    return r;
  }

  /* 3a. El ejercicio en curso. Va después del tilt y de los hitos, nunca antes: si el
     proceso se rompió, eso manda, y el ejercicio ya quedó cancelado de todos modos.
     La frase habla de conducta y jamás de cuánto falta para terminar — el contador vive
     en el panel, que es donde el usuario lo fue a buscar, y no en la boca de Taladro. */
  const ej = s.ejercicio;
  if (ej && ej.activo && ej.hechas > 0) {
    const frases = [
      `${ej.cumplidas} de ${ej.hechas} salieron con las reglas que vos escribiste.`,
      `La serie mide si lo sostenés, no si sale bien. Ninguna de las dos cosas la decide el mercado.`,
      `Estás ejecutando un sistema que elegiste en frío. Eso es lo único que se está probando acá.`
    ];
    return d('ok', frases[Math.floor(Date.now() / 15e4) % frases.length], 'ejercicio', 20);
  }

  /* 3b. Aire: va antes que la racha porque es la misma racha contada por el otro lado.
     Decir "3 pérdidas seguidas contra un récord de 7" cuando las tres salieron con el
     tamaño y la banda correctos sería medir el resultado justo donde no importa. */
  const ar = s.aire;
  if (ar && ar.activo) {
    const frases = [
      `${ar.cumplidas} de tus últimas ${ar.ventana} salieron con tu tamaño y dentro de tu banda.`,
      `Tu expectativa es ${usdT(ar.expectancy)} por operación; esta de acá no la mueve.`,
      ar.perdedoras
        ? `${ar.perdedoras} de esas ${ar.ventana} cerraron en rojo y el sistema aguantó igual.`
        : `${ar.ventana} operaciones sostenidas en el mismo sistema, que es lo único que se elige.`,
      `Cómo cierre esta no dice nada. El stop y el tamaño ya los elegiste.`
    ];
    return d('ok', frases[Math.floor(Date.now() / 18e4) % frases.length], 'aire', 25);
  }

  /* 4. Racha perdedora: seco, sin ironía, y sin pedirte nada. */
    if (racha >= 3) return dRacha(racha, s, d);

  function dRacha(racha, s, d) { return d('seco', `${racha} pérdidas seguidas contra un récord de ${s.maxLossStreak}` +
    (s.trasRacha && s.trasRacha.n >= 5
      ? `, y lo que abriste después de una racha rindió ${usd(s.trasRacha.avg)} por operación contra ${usd(s.trasRacha.avgResto)} del resto.`
            : '.'), 'racha'); }

  /* 5. Hábito roto, solo si venía de una racha que valía. Se dice una vez y se sigue. */
  const roto = hab.filter(h => h.rompio >= 5).sort((a, b) => b.rompio - a.rompio)[0];
  if (roto) {
    const t = roto.ult;
        const f = {
      /* `limite` y no `ref`: lo que se rompió es el borde que mide `dentro()`, no el número
         central. Con techo declarado son el mismo; con banda observada, decir el promedio
         acusaría de haber pasado algo que la app no considera roto. */
      perdida: `Venías ${roto.rompio} cerrando dentro de ${roto.banda && roto.banda.base === 'declarada'
        ? 'tu techo' : 'tu banda'} y esta se fue a ${usd(t.net)}, ` +
        `contra ${usd(-((roto.banda && roto.banda.limite) || roto.ref))} de referencia.`,
      tamano:  (() => { const e = roto.esc || { fmt: usd, de: x => x.notional };
        return `Tu tamaño de siempre es ${e.fmt(roto.medNot)} y esta la abriste en ${e.fmt(e.de(t) || 0)}.`; })(),
            limite:  `${roto.rompio} entradas esperando tu orden y a esta la fuiste a buscar a mercado.`,
      intacto: `Cerró el exchange por vos y ahí se cortó una racha de ${roto.rompio}.`
    };
        return d('seco', f[roto.id], 'roto:' + roto.id + ':' + roto.rompio);
  }

    /* 6. La fuga silenciosa: venir usando menos presupuesto del que tu propia regla habilita. */
  const pr = s.presupuesto;
  if (pr && pr.estado === 'corto' && !pos.length) {
        return d('ok', `Tu regla te habilita ${usd(pr.habilitado)} de notional y venís entrando con ${usd(pr.usado)}.`, 'presupuesto');
  }

    /* 7. Silencio, que es el estado normal. El conteo del día vive acá: es contexto,
     no algo por lo que valga la pena interrumpirte. */
  if (td.hoy.length >= 5 && s.medianTradesDay && td.hoy.length > s.medianTradesDay * 2.5)
    return callado(`${td.hoy.length} operaciones hoy, contra una mediana de ${s.medianTradesDay}.`);
  const mejor = hab.filter(h => h.racha > 0).sort((a, b) => b.racha - a.racha)[0];
    if (mejor) return callado(`${mejor.nombre}: ${mejor.racha} al hilo` + (mejor.meta ? `, próximo hito ${mejor.meta}.` : '.'));
  if (pos.length) return callado(`${pos[0].symbol} ${pos[0].side} abierta.`);
    return callado(s.n ? `${s.n} operaciones registradas.` : 'Todavía no hay nada para mirar.');
}

/* ===== Repertorio =====
   Cada vez que le tocás, Taladro dice otra cosa. Cuatro familias: algo para probar,
   algo que no estás mirando, algo del proceso, y una de las cinco verdades. Todo
   sale de tus propios datos. */
function repertorio(s, pos, td, hab) {
  const usd = x => (x < 0 ? '-' : '') + 'US$' + Math.abs(x).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  /* Las etiquetas de la tabla son títulos de columna; para decirlas en voz alta
     hay que convertirlas en algo que suene a castellano. */
  const enCriollo = l => l
    .replace(/^En /, 'operar en ')
    .replace(/^Tesis: /, 'las que anotás como ')
    .replace(/^Etiqueta: /, 'las que etiquetás como ')
    .replace(/^Long$/, 'operar en long').replace(/^Short$/, 'operar en short')
    /* Las dos, porque `comparativas` rotula según la base que eligió `escalaTamano` (3.4).
       Si acá quedara una sola, la otra caería al `else` y Taladrín leería el título de
       columna crudo — falla callada, que es la peor forma de fallar en este archivo. */
    .replace(/^Con más exposición que tu mediana$/, 'entrar con más exposición que tu mediana')
    .replace(/^Con notional mayor a tu mediana$/, 'entrar más grande que tu mediana')
    .replace(/^Abiertas /, 'las que abrís ')
    .replace(/^Cerradas /, 'las que cerrás ')
    .replace(/^Sostenidas /, 'las que sostenés ')
    .replace(/^Entradas /, 'las entradas ');
  const pc = x => (x * 100).toFixed(0) + '%';
  const out = [];
  const add = (tipo, linea) => out.push({ tipo, linea });
  hab = hab || habitos(s.trades || [], s);
  const T = s.trades || [];
  if (!T.length) return [{ tipo: 'info', linea: 'Todavía no hay operaciones para mirar.' }];
  const H = id => hab.find(h => h.id === id);

  /* --- para probar --- */
  const conNota = T.filter(t => t.tesis).length;
  if (conNota < 10) {
    add('probar', `Tenés ${conNota} operaciones con la tesis anotada; con diez la tabla ` +
      `te dice si te rinde más seguir tendencia o buscar reversión.`);
    out[out.length - 1].accion = { id: 'anotar', texto: 'Anotar la última' };
  }
  const lim = H('limite');
  if (lim && lim.pct < 0.5) add('probar', `De tus últimas ${lim.deN} entradas, ${lim.cumplidas} esperaron ` +
    `a que el precio tocara tu orden. Con cinco seguidas llegás al primer hito.`);
  if (s.presupuesto && !s.presupuesto.apagado && s.presupuesto.stopTipico) {
    const st = s.presupuesto.stopTipico;
    add('probar', `Con tu stop típico de ${st.toFixed(2)}%, un objetivo al doble queda a ${(st * 2).toFixed(2)}%.`);
  }
  if (s.presupuesto && s.presupuesto.estado === 'corto')
    add('probar', `Tu regla habilita ${usd(s.presupuesto.habilitado)} de notional y venís entrando con ${usd(s.presupuesto.usado)}.`);
  const symS = Object.entries(s.bySymbol).sort((a, b) => b[1].n - a[1].n);
  if (symS.length > 1 && symS[0][1].n / s.n > 0.5)
    add('probar', `Operás casi siempre ${symS[0][0]}: ${symS[0][1].n} de tus ${s.n} operaciones, ` +
      `y entre los otros ${symS.length - 1} símbolos juntan ${s.n - symS[0][1].n}.`);
  /* Tramos: el que nunca tocaste y el que te viene rindiendo distinto */
  const trOps = TRAMOS.map(tr => ({ tr, v: (s.byTramo || {})[tr.id] }));
  const sinTocar = trOps.filter(x => !x.v || x.v.n === 0);
  const conOps = trOps.filter(x => x.v && x.v.n >= 2).sort((a, b) => (b.v.net / b.v.n) - (a.v.net / a.v.n));
  if (sinTocar.length && conOps.length) {
    add('probar', `Nunca operaste en ${sinTocar[0].tr.frase} de la rueda (${sinTocar[0].tr.art}), ` +
      `y en ${conOps[conOps.length - 1].tr.frase} llevás ${usd(conOps[conOps.length - 1].v.net)} en ` +
      `${conOps[conOps.length - 1].v.n} operaciones.`);
  }
  if (conOps.length >= 2) {
    const b = conOps[0], w = conOps[conOps.length - 1];
    add('mirar', `Dentro de la rueda, en ${b.tr.frase} promediás ${usd(b.v.net / b.v.n)} por operación ` +
      `y en ${w.tr.frase} ${usd(w.v.net / w.v.n)}.`);
  }

  /* Qué hacen entre sí los símbolos que operás el mismo día */
  {
    const porDia = {};
    for (const t of T) {
      const k = diaBA(t.entryTime);
      (porDia[k] || (porDia[k] = {}))[t.symbol] = ((porDia[k][t.symbol]) || 0) + t.net;
    }
    const dias = Object.values(porDia).filter(d => Object.keys(d).length >= 2);
    if (dias.length >= 3) {
      let juntos = 0, cruzados = 0;
      for (const d of dias) {
        const v = Object.values(d);
        const pos = v.filter(x => x > 0).length, neg = v.filter(x => x < 0).length;
        if (pos && neg) cruzados++; else juntos++;
      }
      add('mirar', `En los ${dias.length} días que tocaste más de un símbolo, en ${cruzados} uno te dio ` +
        `verde y otro rojo el mismo día, y en ${juntos} fueron todos para el mismo lado.`);
    }
  }

  const vHoy = ventanaEvento(Date.now());
  if (vHoy && !T.some(t => t.evento && t.evento.id === vHoy.id))
    add('probar', `No tenés ninguna operación etiquetada en “${vHoy.label}”, y estás justo en esa ventana.`);

  /* --- lo que no estás mirando --- */
  const durs = Object.entries(s.byDur).filter(([, v]) => v.n >= 3);
  if (durs.length >= 2) {
    const b = durs.reduce((a, c) => (c[1].net / c[1].n > a[1].net / a[1].n ? c : a));
    const w = durs.reduce((a, c) => (c[1].net / c[1].n < a[1].net / a[1].n ? c : a));
    add('mirar', `Cuando la operación te dura ${b[0]} promediás ${usd(b[1].net / b[1].n)}, ` +
      `y cuando te dura ${w[0]} promediás ${usd(w[1].net / w[1].n)}.`);
  }
  /* 3.5 — Pide las dos cosas, y no son la misma. `estable` controla la **época**: que la
     diferencia aparezca en las dos mitades. `sobrevive` controla la **multiplicidad**: que
     aparezca más seguido que el azar entre los ~30 cortes que se probaron. Un corte puede
     aguantar el split-half y ser ruido igual — coincidir en signo pasa la mitad de las
     veces bajo hipótesis nula—, y puede tener un p chiquito y describir solo una época.

     Y la frase cambió aunque el corte sobreviva: *"lo que más te cambia el resultado"*
     afirmaba causalidad sobre un corte observacional. Lo que la app puede decir es dónde
     se separan los números; por qué se separan no lo sabe, y no hay estadística que lo
     arregle porque el problema es de diseño y no de muestra. */
  const est = (s.comparativas || []).filter(c => c.estable && c.sobrevive)
    .sort((a, b) => Math.abs(b.avg - b.avgResto) - Math.abs(a.avg - a.avgResto));
  const bh = s.comparativasBH;
  if (est.length) {
    const c = est[0];
    add('mirar', `Donde más se separan tus números es ${enCriollo(c.label)}: ${usd(c.avg)} por operación ` +
      `contra ${usd(c.avgResto)} del resto. Se repite en las dos mitades de tu historial y aguanta ` +
      `la corrección por haber mirado ${bh.m} cortes a la vez.`);
  } else if (bh && bh.m >= 10) {
    /* Que no sobreviva nada no es un bache que haya que tapar con otra cosa: es el
       resultado. Se dice una vez, con el número de cortes probados al lado, y esta familia
       del repertorio queda más callada — que es exactamente el arreglo funcionando. */
    add('mirar', `Probé ${bh.m} cortes de tus operaciones —sesiones, tramos, tamaño, lado, duración— y ` +
      `ninguno se separa más de lo que se separaría barajando las etiquetas al azar. ` +
      `Con esa cantidad de cortes, alguno iba a destacarse solo por probar muchos.`);
  }
  if (s.volume > 0) add('mirar', `Llevás ${usd(s.volume)} operados y pagaste ${usd(s.fees)} de comisiones, ` +
    `que es el ${(s.fees / s.volume * 100).toFixed(3)}% del volumen.`);
  const r = rachasEsperadas(s, 100);
  if (r) add('mirar', `Tu peor racha fue de ${r.real} y la racha larga típica con tu acierto es de ${r.tipica}.`);
  if (s.liq.n) add('mirar', `Sin tus ${s.liq.n} liquidaciones tu neto sería ${usd(s.net - s.liq.net)} en vez de ${usd(s.net)}.`);
  const ses = Object.entries(s.bySession).filter(([, v]) => v.n >= 3).sort((a, b) => b[1].net / b[1].n - a[1].net / a[1].n);
  if (ses.length >= 2) add('mirar', `Operando en ${SESSIONS[ses[0][0]].label} promediás ` +
    `${usd(ses[0][1].net / ses[0][1].n)} por operación, y en ${SESSIONS[ses[ses.length - 1][0]].label}, ` +
    `${usd(ses[ses.length - 1][1].net / ses[ses.length - 1][1].n)}.`);
  const mk = T.filter(t => t.makerEntry === true).length;
  add('mirar', `De tus ${T.length} entradas, ${T.length - mk} las tomaste a mercado y en ${mk} esperaste ` +
    `a que el precio tocara tu orden.`);

  /* --- proceso --- */
  if (s.adherence) {
    const r = s.adherence.rec, b = s.adherence.base;
    if (b.avgLoss > 0 && r.avgLoss / b.avgLoss > 1.25)
      add('proceso', `Se te está agrandando la pérdida promedio: ${usd(r.avgLoss)} en las últimas ${r.n} ` +
        `contra ${usd(b.avgLoss)} antes.`);
    else if (b.avgLoss > 0 && r.avgLoss / b.avgLoss < 0.8)
      add('proceso', `Achicaste la pérdida promedio de ${usd(b.avgLoss)} a ${usd(r.avgLoss)}, ` +
        `y eso es lo que movió tu expectativa de ${usd(b.expectancy)} a ${usd(r.expectancy)}.`);
  }
  if (s.adherence) add('proceso', `Tu pérdida promedio de las últimas ${s.adherence.rec.n} es ` +
    `${usd(s.adherence.rec.avgLoss)} y la peor de esa serie fue ${usd(s.adherence.rec.worstLoss)}.`);

  /* El día como unidad. Solo se dice si el patrón aguanta las dos mitades. */
  const dd = s.dias;
  if (dd && dd.corte && dd.estable) {
    const dif = (dd.adhCargados - dd.adhTranquilos) * 100;
    add('proceso', dif < 0
      ? `En tus ${dd.nCargados} días de ${dd.desdeN} operaciones o más sostuviste el ${pc(dd.adhCargados)} de las conductas, ` +
        `y en los ${dd.nTranquilos} más tranquilos el ${pc(dd.adhTranquilos)}. Se repite en las dos mitades de tu historial.`
      : `En tus días cargados sostenés el ${pc(dd.adhCargados)} de las conductas y en los tranquilos el ` +
        `${pc(dd.adhTranquilos)}: la actividad no te desarma, y eso también aguanta el split-half.`);
  }
  if (dd && dd.n >= DIAS_MIN)
    add('proceso', `Llevás ${dd.n} días operados y en ${dd.perfectos} no se te escapó ninguna conducta.`);

  /* Holgura: solo habla de lo que efectivamente vio, y dice cuánto vio. */
  const hg = s.holgura;
  if (hg && hg.n >= 5) {
    const mandaExchange = hg.invertidas + hg.sinStop;
    add('proceso', `De las ${hg.n} operaciones que la app llegó a ver abiertas, en ${hg.holgadas} tu stop ` +
      `estaba en la primera parte del camino a la liquidación y en ${mandaExchange} el que mandaba era el exchange.`);
    if (hg.mediana != null)
      add('proceso', `Tu stop suele quedar al ${(hg.mediana * 100).toFixed(0)}% de la distancia que hay ` +
        `hasta la liquidación, sobre ${hg.conStop} posiciones observadas.`);
    if (hg.deriva && hg.deriva.base > 0) {
      const r = hg.deriva.rec / hg.deriva.base;
      if (r > 1.2) add('proceso', `Se te está corriendo la holgura: en las últimas ${hg.deriva.nRec} observadas ` +
        `el stop quedó al ${(hg.deriva.rec * 100).toFixed(0)}% del camino a la liquidación, contra ` +
        `${(hg.deriva.base * 100).toFixed(0)}% antes.`);
      else if (r < 0.85) add('proceso', `Te estás dando más aire: el stop pasó del ${(hg.deriva.base * 100).toFixed(0)}% ` +
        `al ${(hg.deriva.rec * 100).toFixed(0)}% del camino a la liquidación en las últimas ${hg.deriva.nRec}.`);
    }
  } else if (hg && hg.total >= 10 && hg.n < 5) {
    add('probar', `La holgura entre tu stop y la liquidación es lo único que no se puede reconstruir del ` +
      `historial: se anota cuando tenés la app abierta con la posición viva. Llevás ${hg.n} de ${hg.total} anotadas.`);
  }
  const mejorH = hab.filter(h => h.racha > 0).sort((a, b) => b.racha - a.racha)[0];
  if (mejorH) add('proceso', `${mejorH.nombre} lleva ${mejorH.racha} al hilo con un récord de ${mejorH.mejor}.`);
  /* `pct` es null cuando no se pudo juzgar ninguna de las últimas veinte. Ese hábito no
     entra al ranking: no es el que más lugar para mejorar tiene, es el que no se midió. */
  const peorH = hab.filter(h => h.pct != null).sort((a, b) => a.pct - b.pct)[0];
  if (peorH) add('proceso', `El hábito con más lugar para mejorar es ${peorH.nombre.toLowerCase()}: ` +
    `lo cumpliste en ${peorH.cumplidas} de tus últimas ${peorH.deN} operaciones.`);

  /* ===== Las cinco verdades, dichas de a una =====
     Tenían panel propio arriba del pliegue y eran cinco tarjetas fijas: media pantalla
     de scroll antes de llegar al botón que justamente existe para que la portada sea
     corta. Y en bloque se leen como un cartel motivacional, que es exactamente lo que
     no son. Douglas las hace repetir de a una; acá entran al repertorio, cada una con
     su número al lado, y se escuchan cuando le tocás.

     Se reparten entre lo demás en vez de ir al final: el recorrido no tiene que
     terminar en cinco sermones seguidos. */
  const V = (s && s.verdades) || [];
  if (V.length) {
    const paso = Math.max(1, Math.floor(out.length / (V.length + 1)));
    V.forEach((v, i) => {
      const at = Math.min(out.length, paso * (i + 1) + i);
      out.splice(at, 0, { tipo: 'verdad', linea: `${v.frase} ${v.dato}` });
    });
  }

  return out;
}

/* ===== Lo que dice al pasar por encima =====
   La fila ya muestra los números; acá va la regla, que es lo que no se ve. */
function explica(tipo, dato, s) {
  const usd = x => (x < 0 ? '-' : '') + 'US$' + Math.abs(x).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  if (tipo === 'habito') {
    const h = dato;
    const reglas = {
      /* El múltiplo no se escribe acá: lo decide `bandaRiesgo` según quién puso el número.
         Un techo que vos declaraste se respeta exacto; un promedio observado necesita
         tolerancia o el hábito falla la mitad de las veces por construcción. */
      perdida: (() => {
        const b = h.banda || { base: 'observada', limite: h.ref * BANDA_TOL, observada: h.ref };
        return b.base === 'declarada'
          ? `Suma cuando la pérdida no supera ${usd(b.limite)}, el techo que declaraste. Exacto, sin tolerancia: el número ya es el borde.`
          : `Suma cuando la pérdida no supera ${usd(b.limite)}, que es una vez y media tu pérdida promedio reciente de ${usd(b.observada || h.ref)}.`;
      })(),
      intacto: `Suma cuando la posición la cerraste vos y no el exchange.`,
      tamano:  (() => {
        const e = h.esc || { base: 'notional', fmt: usd };
        return `Suma cuando ${e.base === 'exposicion' ? 'la porción de tu cuenta en juego' : 'el notional'} ` +
          `queda entre ${e.fmt(h.medNot * 0.5)} y ${e.fmt(h.medNot * 2)}, alrededor de tu mediana de ${e.fmt(h.medNot)}.` +
          (e.base === 'exposicion'
            ? ` Se mide contra tu colateral y no en dólares: con apalancamiento fijo el notional sube y baja con la cuenta sin que vos decidas nada.`
            : '') +
          /* La contrapartida al lado del número, no en una nota aparte. */
          (h.sinDato
            ? ` En ${h.sinDato} de tus últimas ${h.deTotal} no hay colateral de ese momento para calcularla, así que ni suman ni restan: quedan afuera de la cuenta.`
            : '');
      })(),
      limite:  `Suma cuando dejaste la orden puesta y el precio vino a tocarla, sin ir vos a mercado.`
    };
    return reglas[h.id] || h.accion;
  }
  if (tipo === 'racha') {
    const r = dato;
    return `Una racha de ${r.k} o más aparece en el ${(r.p * 100).toFixed(0)}% de las series de 100 operaciones ` +
      `con tu acierto de ${(s.winRate * 100).toFixed(1)}%.`;
  }
  if (tipo === 'presupuesto') {
    const p = dato;
    if (!p || p.apagado) return `Sin al menos 5 posiciones observadas con stop cargado no hay ` +
      `distancia al stop medida, y calcularla desde el resultado sería volver a la circularidad ` +
      `que esta pieza tenía.`;
    return `${p.base === 'declarada' ? 'El techo de' : 'Tu banda de'} ${usd(p.banda)} con un stop de ` +
      `${p.stopTipico.toFixed(2)}% —la mediana de lo que la app te vio poner en ${p.conStop} posiciones— ` +
      `habilita ${usd(p.habilitado)} de notional.`;
  }
  if (tipo === 'posicion') {
    const r = dato;
    return r.stopPx
      ? `Tu stop está a ${r.distStop.toFixed(2)}% y la liquidación a ${r.distLiq ? r.distLiq.toFixed(2) + '%' : 's/d'}.`
      : `No hay stop cargado en esta posición.`;
  }
  return '';
}

/* ===== Modo tilt =====
   Una racha perdedora sola no es tilt: es varianza, y la app misma dice que es normal.
   Tilt es la racha MÁS señales de que el proceso se rompió. Y se sale por proceso,
   nunca por ganar: dos operaciones seguidas dentro de tu banda y con tu tamaño.

   El tilt caduca. Durante mucho tiempo no tuvo reloj: se calculaba sobre las últimas seis
   operaciones sin mirar cuándo habían pasado, así que tres pérdidas del viernes a la noche
   dejaban la pantalla roja el lunes a la mañana. Y como la única salida eran dos
   operaciones limpias, la app terminaba diciendo, sin decirlo, que había que operar para
   zafar — que es exactamente el pensamiento del tilt, y el contador de redención que este
   proyecto prohíbe mostrar, colado por la puerta de atrás.

   Peor todavía: la misma conducta se trataba al revés en los dos modos. Parar y volver
   apagaba el modo aire (`parálisis` marca falla en la operación que vuelve) y no apagaba
   el tilt. Descansar te sacaba lo bueno y te dejaba lo malo.

   Así que el descanso es una salida válida, igual que las dos limpias. Un día nuevo de
   Buenos Aires más un hueco real desde la última operación, y se apaga solo. Lo que se
   reinicia es el estado, nunca la acumulación: las rachas de hábitos siguen contando a
   través de los días, porque eso se refuerza con el tiempo y no de una vez. */
const TILT_HUECO_MIN = 6 * 36e5;   // que la medianoche sola no lo limpie

function tilt(s, now) {
  const T = (s.trades || []);
  const off = { activo: false, racha: 0, motivos: [], limpias: 0, faltan: 0 };
  if (T.length < 5) return off;
  const B = s.banda || bandaRiesgo(s, null);
  const banda = B.valor;
  const esc = s.escala || escalaTamano(T);
  const med = esc.med;
  if (!banda || !med) return off;

  const tam = t => { const v = esc.de(t); return v == null ? med : v; };   // sin dato no acusa
  /* `dentro` no puede devolver `null` acá: la guarda de arriba ya cortó si no hay banda.
     El `!== false` lo deja explícito igual, porque el día que la guarda cambie un `null`
     silencioso pintaría sucia una operación que nadie midió. */
  const limpia = t => B.dentro(t) !== false && tam(t) <= med * 2 && !t.liquidated;

  let racha = 0;
  for (let i = T.length - 1; i >= 0 && T[i].net < 0; i--) racha++;

  const vent = T.slice(-6);
  const motivos = [];
  const peor = vent.filter(t => t.net < 0).sort((a, b) => a.net - b.net)[0];
  if (vent.some(t => t.liquidated)) motivos.push('te liquidaron una');
  if (peor && B.dentro(peor) === false)
    motivos.push(`una pérdida de ${usdT(peor.net)} contra ` +
      (B.base === 'declarada' ? `el techo de ${usdT(-B.limite)} que declaraste`
                              : `una banda de ${usdT(-banda)}`));
  const grande = vent.filter(t => tam(t) > med * 2).sort((a, b) => tam(b) - tam(a))[0];
  if (grande) motivos.push(`una entrada de ${esc.fmt(tam(grande))} contra tu tamaño de ${esc.fmt(med)}`);
  let rapidas = 0;
  for (let i = 1; i < vent.length; i++)
    if (vent[i - 1].exitTime && vent[i].entryTime - vent[i - 1].exitTime < 5 * 6e4) rapidas++;
  if (rapidas >= 3) motivos.push(`${rapidas} entradas a menos de cinco minutos de cerrar la anterior`);

  let limpias = 0;
  for (let i = T.length - 1; i >= 0 && limpia(T[i]); i--) limpias++;

  /* El descanso: si desde la última operación cambió el día de Buenos Aires y además pasó
     un hueco real, el tilt se apaga solo. Las dos condiciones juntas y no una sola —
     perder tres a las 23:50 no puede quedar limpio a las 00:10, y dormir una siesta
     tampoco es empezar de nuevo. */
  const ult = T[T.length - 1];
  const fin = ult.exitTime || ult.entryTime;
  const ahora = now || Date.now();
  const descanso = ahora - fin >= TILT_HUECO_MIN && diaBA(ahora) !== diaBA(fin);

  const activo = racha >= 3 && motivos.length > 0 && limpias < 2 && !descanso;
  return { activo, racha, motivos, limpias, faltan: Math.max(0, 2 - limpias),
    banda, limite: B.limite, base: B.base, med, esc, descanso, desde: fin };
}
function usdT(x) { return (x < 0 ? '-' : '') + 'US$' + Math.abs(x).toLocaleString('es-AR', { maximumFractionDigits: 2 }); }

/* ===== Modo aire =====
   El espejo exacto del tilt. El tilt pide racha perdedora MÁS proceso roto; este pide
   proceso intacto y no mira el resultado. Puede encenderse en el medio de una racha
   perdedora —de hecho ahí es cuando sirve—, porque lo que muestra es que el resultado
   de la operación de hoy no informa nada sobre el método.

   Dos condiciones que no se negocian:

   No se enciende con expectativa negativa. "Con suficientes iteraciones se vuelve
   rentable" es exactamente falso al revés: con valor esperado negativo, más operaciones
   es más pérdida acumulada. Prometer lo contrario sería el peor consejo que puede dar
   una app que dice medir el proceso.

   No se enciende con menos de 30 operaciones. Debajo de ahí la expectativa no distingue
   método de suerte, y la indiferencia al resultado se apoya justo en esa expectativa. */
/* La ventana es larga y con tolerancia, no una racha perfecta. Pedir treinta seguidas
   sin una sola falla haría que un resbalón apague todo, y el número de racha funcionaría
   como contador hacia un premio — las dos cosas que este modo justamente no es. Se
   sostiene con adherencia, no con perfección: entran dos fallas en treinta, pero la
   última tiene que estar limpia, así que una salida del sistema ahora mismo lo apaga. */
const AIRE_VENT = 30;    // ventana de conducta
const AIRE_FALLAS = 2;   // cuántas puede fallar adentro de la ventana
const AIRE_MIN = 30;     // muestra mínima para que la expectativa signifique algo

/* ===== Estabilidad =====
   Mide una sola cosa: si el resultado anterior cambia lo que hacés después. Es la
   definición operativa de "no importa el PnL" — si después de perder entrás con el mismo
   tamaño y esperás lo mismo que después de ganar, la indiferencia dejó de ser una
   declaración y pasó a ser una medición.

   Vive afuera de `aire` por dos motivos. Adentro solo se calculaba con n≥30 y expectativa
   positiva, así que la conducta que más le importa quedaba invisible justo cuando recién
   empezaba a formarse. Y porque había una segunda medición de lo mismo en otro lado —
   `sizeAfterLoss / sizeAfterWin`, sobre notional crudo, con promedio en vez de mediana y
   sin mínimo por lado— que podía contradecir a ésta en la misma pantalla. Dos definiciones
   de la misma conducta es garantía de que algún día se pelean; ésta es la única.

   Tres decisiones que se heredan y no cambian:

   Mediana y no promedio, porque una sola operación grande no puede decidirlo. Mínimo de
   cinco de cada lado, porque con menos la comparación describe dos operaciones y no una
   conducta. Y sobre la escala que devuelve `escalaTamano`, no sobre notional: con
   apalancamiento fijo el notional es colateral × 20 y se mueve solo con el PnL, así que
   medirlo crudo sería medir el resultado con nombre de acción.

   Lo que sí es nuevo: `cuantizado`. Con órdenes mínimas de US$10 y colateral chico puede
   que casi no haya tamaños posibles, y ahí la razón da 1,0 por construcción del exchange
   y no por indiferencia tuya. Cuando eso pasa, la razón de tamaño no se juzga y se dice.
   Es el mismo criterio que el mínimo de cinco: sin datos no se afirma en ninguna de las
   dos direcciones.

   El criterio es **concentración y no cantidad de valores distintos**, y la diferencia
   importa. Contar valores parece razonable hasta que se prueba: una martingala que alterna
   entre dos tamaños tiene dos valores distintos, y es exactamente la conducta que hay que
   ver. Lo que vuelve vacía la medición no es tener pocos tamaños sino que uno solo se
   coma casi toda la masa — ahí las dos medianas caen sobre el mismo número pase lo que
   pase, y la razón está clavada en 1 antes de mirar un solo dato tuyo. */
const EST_MIN_LADO = 5;      // cuántas de cada lado hacen falta para comparar
const EST_TOL = 1.4;         // fuera de [1/1,4 , 1,4] la conducta cambió
const EST_CONC_MAX = 0.9;    // si un solo tamaño se lleva más que esto, la razón está clavada en 1

function estabilidad(trades, esc) {
  const T = (trades || []).filter(t => !t.open);
  const off = { juzgable: false, rTam: null, rEsp: null, nP: 0, nG: 0,
    base: esc ? esc.base : null, cuantizado: false, inestable: [] };
  if (T.length < 2 || !esc || !(esc.med > 0)) return off;

  const medi = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
  const tam = x => { const v = esc.de(x); return v == null ? esc.med : v; };   // sin dato no acusa

  /* 3.6b — La espera después de cerrar no es la distancia a la siguiente de la lista: es
     **cuánto tardaste en abrir algo nuevo después de ese cierre**. Con dos perps a la vez
     la resta contra la siguiente daba negativo y se aplastaba a cero, así que "esperó
     cero" y "abrió antes de que cerrara la anterior" quedaban indistinguibles — y las dos
     iban al mismo balde que después decide si estás estable.

     Ahora se busca la primera apertura posterior al cierre. Si no hay ninguna posterior,
     la operación **no aporta espera**: no es una espera de cero, es que ya estabas adentro
     o que todavía no volviste. Sale del denominador, como todo lo que no se puede medir. */
  const aperturas = T.map(t => t.entryTime).sort((a, b) => a - b);
  const primeraDespues = ts => {
    let lo = 0, hi = aperturas.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (aperturas[m] > ts) hi = m; else lo = m + 1; }
    return lo < aperturas.length ? aperturas[lo] : null;
  };
  const trasP = [], trasG = [];
  for (const prev of T) {
    const fin = prev.exitTime || prev.entryTime;
    const sig = primeraDespues(fin);
    if (sig == null) continue;
    /* El tamaño de la que arrancó después de ese cierre, que es la conducta que interesa. */
    const cur = T.find(t => t.entryTime === sig);
    if (!cur) continue;
    (prev.net < 0 ? trasP : trasG).push({ tam: tam(cur), hueco: sig - fin });
  }
  const razon = (a, b) => {
    if (a.length < EST_MIN_LADO || b.length < EST_MIN_LADO) return null;
    const x = medi(a), y = medi(b);
    return x > 0 && y > 0 ? x / y : null;
  };

  /* Si un solo tamaño se lleva casi toda la masa, la razón no puede significar nada: las
     dos medianas caen sobre ese número pase lo que pase. Se anula la medición de tamaño y
     se deja la de espera, que no depende del mínimo de orden del exchange. */
  const cuenta = new Map();
  let conTam = 0;
  for (const x of T) {
    const v = tam(x);
    if (!(v > 0)) continue;
    /* Redondeo a tres cifras significativas: dos entradas de US$10,00 y US$10,01 son el
       mismo tamaño para cualquier lectura de conducta, y sin esto el ruido de punto
       flotante haría pasar por variada una escala que es de un solo valor. */
    const k = v.toPrecision(3);
    cuenta.set(k, (cuenta.get(k) || 0) + 1);
    conTam++;
  }
  const modo = conTam ? Math.max(0, ...cuenta.values()) / conTam : 1;
  const cuantizado = conTam === 0 || modo > EST_CONC_MAX;

  const rTam = cuantizado ? null : razon(trasP.map(x => x.tam), trasG.map(x => x.tam));
  const rEsp = razon(trasP.map(x => x.hueco), trasG.map(x => x.hueco));
  const fuera = r => r != null && (r > EST_TOL || r < 1 / EST_TOL);
  const inestable = [];
  if (fuera(rTam)) inestable.push('tamaño');
  if (fuera(rEsp)) inestable.push('espera');

  return {
    juzgable: rTam != null || rEsp != null,
    rTam, rEsp, inestable, cuantizado,
    nP: trasP.length, nG: trasG.length,
    base: esc.base, valores: cuenta.size, concentracion: modo,
    min: EST_MIN_LADO, tol: EST_TOL
  };
}

function aire(s, now) {
  const T = (s.trades || []);
  const off = { activo: false, cumplidas: 0, ventana: AIRE_VENT };
  if (T.length < Math.max(AIRE_MIN, AIRE_VENT)) return off;
  if (!(s.expectancy > 0)) return off;
  if (s.tilt && s.tilt.activo) return off;   // el tilt manda

  const B = s.banda || bandaRiesgo(s, null);
  const banda = B.valor;
  const esc = s.escala || escalaTamano(T);
  const med = esc.med;
  const tam = x => { const v = esc.de(x); return v == null ? med : v; };   // sin dato no acusa
  if (!banda || !med) return off;

  /* Fallar no es perder. Fallar es salirse del propio sistema, y eso tiene cuatro caras
     que se pueden medir con los fills:

       regla    — pérdida fuera de banda, liquidación, o tamaño fuera del rango de siempre
       ráfaga   — un día con muchas más operaciones que su mediana diaria (overtrading)
       parálisis— un hueco mucho más largo que su hueco típico entre operaciones
       salto    — un cambio abrupto de tamaño respecto de las diez anteriores

     La quinta cara que él nombra, "no mantener la calma", queda sin medir a propósito.
     El proxy obvio serían las reentradas calientes, y sus propios datos las descartaron:
     rendían +US$0,21 por operación mejor que el resto y aguantaban el split-half. Medir
     la calma con un número que sus datos ya desmintieron sería inventar una falla.

     Los umbrales salen de su propia historia, no de una tabla: la mediana diaria, el
     hueco mediano, su tamaño mediano. El sistema con el que se compara es el suyo. */
  const vent = T.slice(-AIRE_VENT);
  const idx0 = T.length - AIRE_VENT;
  const medi = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };

  const regla = x => B.dentro(x) !== false
    && !x.liquidated && tam(x) <= med * 2 && tam(x) >= med * 0.5;

  // ráfaga: cuántas operaciones hubo ese día en todo el historial, no solo en la ventana
  const dia = t => diaBA(t.entryTime);
  const porDia = s.days || {};
  const techoDia = Math.max(3, Math.round((s.medianTradesDay || 1) * 2.5));
  const rafaga = x => ((porDia[dia(x)] || {}).n || 0) > techoDia;

  /* parálisis: el hueco típico se mide sobre todo el historial, así que "quedarse quieto"
     se define contra su propio ritmo. Sin datos suficientes no se juzga.

     Ojo con lo que se está midiendo: la falla es el hueco, no la operación que vuelve.
     Volver a operar después de un parón es justamente lo contrario de la parálisis — es
     salir de ella. Por eso la parálisis cuenta adentro de la ventana pero queda fuera del
     candado de "la última tiene que estar limpia": si no, volver de unas vacaciones
     apagaba el modo aire, mientras que el mismo descanso no apagaba el tilt. */
  /* 3.6b — Los huecos son el tiempo **sin ninguna posición abierta**, no la distancia entre
     dos operaciones consecutivas. Con dos perps a la vez esa resta da negativo y el
     `if (g > 0)` que había acá los descartaba en silencio: el hueco típico terminaba
     saliendo solo de las veces que operó de a uno. Ver `huecosSinPosicion`. */
  const HS = huecosSinPosicion(T);
  const huecos = HS.gaps.filter(g => g > 0);
  const huecoTipico = huecos.length >= 10 ? medi(huecos) : 0;
  const techoHueco = huecoTipico ? Math.max(huecoTipico * 8, 5 * 864e5) : 0;
  /* Una operación que abrió mientras ya había otra corriendo no tiene hueco delante: no
     volviste de ningún lado, seguías adentro. Ésas no se juzgan por parálisis. */
  const paralisis = x => {
    if (!techoHueco) return false;
    const g = HS.antes[x.id];
    return g != null && g > techoHueco;
  };

  /* salto: cambio abrupto de tamaño contra las diez anteriores, no contra toda la historia.
     También sobre exposición: si el colateral se mueve, el notional se mueve con él sin
     que vos hayas decidido nada, y eso no es un salto. */
  const salto = (x, i) => {
    const j = idx0 + i;
    if (j < 10) return false;
    const ref = medi(T.slice(j - 10, j).map(y => { const v = esc.de(y); return v == null ? 0 : v; }).filter(Boolean));
    const v = esc.de(x);
    return ref > 0 && v != null && (v > ref * 2.5 || v < ref * 0.4);
  };

  const tipos = [];
  const detalle = vent.map((x, i) => {
    const f = [];
    if (!regla(x)) f.push('regla');
    if (rafaga(x)) f.push('ráfaga');
    if (paralisis(x)) f.push('parálisis');
    if (salto(x, i)) f.push('salto');
    f.forEach(t => { if (!tipos.includes(t)) tipos.push(t); });
    return f;
  });
  const fallo = detalle.map(f => f.length > 0);

  const fallas = fallo.filter(Boolean).length;
  const cumplidas = AIRE_VENT - fallas;
  if (fallas > AIRE_FALLAS) return off;
  /* Salirse ahora mismo lo apaga — pero volver de un descanso no es salirse. */
  const ultima = detalle[detalle.length - 1].filter(t => t !== 'parálisis');
  if (ultima.length) return off;

  /* Lo de arriba mide cumplimiento: cada operación adentro de un rango. La estabilidad
     mide otra cosa —que el resultado anterior no cambie lo que hacés después— y vive en
     su propia función, que es la única de la app que la define. Ver `estabilidad`. */
  const est = s.estabilidad || estabilidad(T, esc);
  if (est.inestable.length) return off;
  const { rTam, rEsp } = est;

  let racha = 0;
  for (let i = fallo.length - 1; i >= 0 && !fallo[i]; i--) racha++;
  let seca = 0;
  for (let i = T.length - 1; i >= 0 && T[i].net < 0; i--) seca++;

  const q = s.lossRate != null ? s.lossRate : 1 - s.winRate;   // probabilidad de perder, no de no ganar
  const re = rachasEsperadas(s, 100);
  const desde = vent[0].entryTime, hasta = vent[vent.length - 1].exitTime || vent[vent.length - 1].entryTime;
  return {
    activo: true, ventana: AIRE_VENT, cumplidas, fallas, tipos, racha,
    rTam, rEsp, est, banda, limite: B.limite, base: B.base, med, esc, n: T.length, techoDia, techoHueco,
    dias: Math.max(1, Math.round((hasta - desde) / 864e5)),
    perdedoras: vent.filter(x => x.net < 0).length,
    seca,
    expectancy: s.expectancy, winRate: s.winRate,
    en100: s.expectancy * 100,
    pSeca: seca >= 2 ? probRacha(100, q, seca) : null,
    tipica: re ? re.tipica : null
  };
}

/* ===== El edge declarado =====
   Douglas arranca donde esta app terminaba: el setup se define ANTES, objetivamente, y
   recién después se ejecuta. `tesis` y `tags` existían como etiqueta post-hoc, y una
   etiqueta puesta después de ver el resultado no dice por qué entraste — dice cómo te
   explicaste lo que pasó.

   Declarar antes cambia dos cosas. Se puede medir cuántas operaciones salieron de una
   tesis previa contra cuántas se racionalizaron después. Y se puede comparar el resultado
   de las declaradas contra el resto, que es lo más cerca que esta app puede estar de
   evaluar un edge de verdad.

   Lo que la app NO hace es opinar sobre el contenido de la tesis. Que "reversión en el
   cierre" sea buena o mala idea no es asunto suyo: eso sería prescripción de mercado,
   que sigue prohibida. Lo único que mide es si lo dijiste antes y si lo respetaste. */
/* 4.2 — Las declaraciones que caducaron sin ejecutarse no se borran más.

   Antes el shell hacía `filter(x => x.usada || ahora - x.ts <= 4h)` con el comentario
   "no se acumula historia muerta". Estaba al revés: **una declaración que caducó sin
   ejecutarse es el único registro observable de un setup que él identificó y no tomó**,
   o sea la única conducta en dirección sub-operar que esta app puede llegar a ver. Los
   fills no la traen — una operación que no hiciste no deja fill. El código estaba tirando
   exactamente el dato que mediría hesitación.

   Marca `caducada` con el momento en que se venció y devuelve cuántas marcó, para que el
   shell sepa si tiene que guardar. `marcarDeclaradas` no cambia: sigue mirando solo las
   vivas de las últimas 4 horas, así que esto no toca ninguna medición existente.

   **Y no dice nada todavía, a propósito.** Declarar y no ejecutar puede ser la mejor razón
   posible —el setup no se dio— y ahí es disciplina y no hesitación. No hay forma de
   distinguirlas sin ver la serie primero, así que se acumulan y recién con treinta se
   mira. Cualquier frase antes de eso sería inventar la variable.
   → *Qué habría que ver para separarlas:* si las caducadas se agrupan en las mismas
     franjas donde su adherencia ya es peor, o si aparecen sueltas. Eso necesita 4.4. */
const DECL_VIGENCIA = 4 * 36e5;

function caducarDeclaraciones(declaraciones, now) {
  const ahora = now || Date.now();
  let n = 0;
  for (const x of declaraciones || [])
    if (!x.usada && !x.caducada && ahora - x.ts > DECL_VIGENCIA) { x.caducada = ahora; n++; }
  return n;
}

/* Lo que se puede decir de la serie sin interpretarla: cuántas se declararon, cuántas se
   ejecutaron y cuántas se vencieron. `listo` marca cuándo hay muestra para mirarla — y
   hasta entonces nadie tiene que sacar conclusiones, empezando por mí. */
const DECL_MUESTRA = 30;

function declaracionesSerie(declaraciones) {
  const D = declaraciones || [];
  if (!D.length) return null;
  const usadas = D.filter(x => x.usada).length;
  const caducadas = D.filter(x => x.caducada && !x.usada).length;
  const vivas = D.length - usadas - caducadas;
  const cerradas = usadas + caducadas;
  return {
    n: D.length, usadas, caducadas, vivas, cerradas,
    /* `null` y no 0 sin muestra: un ratio sobre tres declaraciones no describe nada. */
    pctEjecutada: cerradas ? usadas / cerradas : null,
    listo: cerradas >= DECL_MUESTRA, faltan: Math.max(0, DECL_MUESTRA - cerradas)
  };
}

function marcarDeclaradas(trades, declaraciones) {
  const D = (declaraciones || []).slice().sort((a, b) => a.ts - b.ts);
  if (!D.length) return 0;
  let n = 0;
  for (const t of trades || []) {
    if (t.declarada) continue;
    /* La declaración vale para la próxima operación que abra después de escribirla, y
       solo si no pasó demasiado tiempo: una tesis de hace tres días no explica la de hoy. */
    const d = D.filter(x => x.ts <= t.entryTime && t.entryTime - x.ts <= 4 * 36e5).pop();
    if (d && !d.usada) {
      t.declarada = true; t.tesis = d.tesis || t.tesis; t.tesisPrevia = d.tesis;
      d.usada = t.id; n++;
    }
  }
  return n;
}

function edgeDeclarado(trades) {
  const T = (trades || []).filter(t => !t.open);
  if (!T.length) return null;
  const dec = T.filter(t => t.declarada);
  const av = a => (a.length ? a.reduce((x, y) => x + y.net, 0) / a.length : null);
  const resto = T.filter(t => !t.declarada);
  return {
    n: T.length, declaradas: dec.length, pct: dec.length / T.length,
    avg: av(dec), avgResto: av(resto), nResto: resto.length,
    /* Sin cinco de cada lado no se compara: describiría dos operaciones, no un método. */
    comparable: dec.length >= 5 && resto.length >= 5
  };
}

/* ===== 4.3 — El chequeo emocional, medido como error de pronóstico =====

   `aire` mide cuatro de las cinco formas de fallar que él nombra. La quinta —"no mantener
   la calma"— quedó sin medir **a propósito**: el único proxy disponible eran las reentradas
   calientes y sus propios datos las desmintieron (+US$0,21 por operación mejor que el
   resto, aguantando el split-half). El principio 1 dice, textual, *"cambia con: que
   aparezca la fuente que falta. Es prohibición sobre adivinar, no sobre un tema."*
   **Una pregunta directa no es un proxy: es la fuente.** Esto no abre un tema nuevo —
   cierra el agujero que el motor ya declaraba abierto.

   **Lo que hay que rechazar de entrada es la versión obvia**, que es la que trae cualquier
   app del rubro: preguntar "¿cómo te sentís?" al cerrar y guardar el nivel. Al cerrar, el
   estado está determinado por el resultado. Se obtiene una serie que correlaciona con el
   PnL, se la rotula "emoción", y es el error #4 de CLAUDE.md otra vez —el resultado
   disfrazado de acción— ahora con la coartada de que lo dijo él.

   **Así que no se guarda el nivel: se guarda la diferencia entre dos lecturas.** El
   pronóstico se declara en frío, antes de entrar; la lectura se toma al cerrar y **solo si
   hubo pronóstico**. La variable es `movio - pronosticado`, y tiene tres propiedades que
   el nivel no tiene:

   1. **Es acción y no resultado.** El pronóstico se elige antes, que es la forma de
      `edgeDeclarado` y del `ejercicio` — la única que este proyecto ya probó dos veces.
   2. **El PnL no la explica solo.** Dos perdedoras idénticas pueden dar error 0 y error 2.
   3. **Tiene contraste externo, que ninguna otra métrica de la app tiene.** El *impact
      bias* dice que la gente sobreestima la intensidad de sus reacciones a eventos
      negativos. Si sus datos dan sobreestimación, el hallazgo se dice como "te pega menos
      de lo que creés" con su número al lado. Si dan subestimación, contradice la línea de
      base publicada y es un hallazgo de verdad.

   **El "solo si contestó la de antes" no es un detalle de UX.** La pregunta del cierre no
   existe salvo que haya un pronóstico contra el cual medirla: eso corta el volumen a la
   mitad y elimina justo las respuestas que serían PnL.

   **Sin respuesta es `null` y sale del denominador** (invariantes 2 y 3). No se inventa un
   "no contestó = neutro", que sería la versión emocional exacta del error 1.2. */
const CHEQ_VIGENCIA = 4 * 36e5;   // igual que las declaraciones, y por el mismo motivo
const CHEQ_MUESTRA = 30;          // pares completos antes de decir una palabra
const CHEQ_NIVELES = [
  { n: 1, id: 'firme',    grados: 0,  label: 'firme' },
  { n: 2, id: 'sacudido', grados: 19, label: 'sacudido' },
  { n: 3, id: 'volteado', grados: 56, label: 'volteado' }
];

/* El pronóstico se escribe antes de que la operación exista, así que se pega igual que una
   tesis: a la próxima que abra dentro de la vigencia.

   **No se fusionó con `marcarDeclaradas` a propósito.** Son dos preguntas distintas —una
   es por qué entrás, la otra cuánto te va a mover— y atarlas obligaría a declarar tesis
   para poder pronosticar. Comparten mecanismo, no significado. */
function marcarChequeos(trades, chequeos) {
  const C = (chequeos || []).slice().sort((a, b) => a.ts - b.ts);
  if (!C.length) return 0;
  let n = 0;
  for (const t of trades || []) {
    if (t.pronostico != null) continue;
    const c = C.filter(x => x.ts <= t.entryTime && t.entryTime - x.ts <= CHEQ_VIGENCIA).pop();
    if (c && !c.usada && c.pre >= 1 && c.pre <= 3) {
      t.pronostico = c.pre; c.usada = t.id; n++;
    }
  }
  return n;
}

/* La lectura del cierre se guarda por operación, porque ahí la operación ya existe. */
function anotarMovio(trades, post) {
  const P = post || {};
  let n = 0;
  for (const t of trades || []) {
    const v = P[t.id] && P[t.id].movio;
    if (v >= 1 && v <= 3 && t.movio == null) { t.movio = v; n++; }
  }
  return n;
}

/* La serie de errores de pronóstico. Devuelve `null` mientras no haya ni un par: no es lo
   mismo "no hay datos" que "el error promedio es cero". */
function errorPronostico(trades) {
  const T = (trades || []).filter(t => !t.open);
  /* El par tiene que estar completo. Una operación con pronóstico y sin lectura no aporta
     un cero: aporta nada, y sale del denominador. */
  const pares = T.filter(t => t.pronostico != null && t.movio != null);
  const conPre = T.filter(t => t.pronostico != null).length;
  if (!pares.length) {
    return { n: 0, conPre, sinPost: conPre, listo: false, faltan: CHEQ_MUESTRA,
      promedio: null, sesgo: null, dist: null, porResultado: null,
      cobertura: T.length ? conPre / T.length : null, nOps: T.length };
  }
  const errs = pares.map(t => t.movio - t.pronostico);
  const prom = errs.reduce((a, b) => a + b, 0) / errs.length;
  const dist = { '-2': 0, '-1': 0, '0': 0, '1': 0, '2': 0 };
  for (const e of errs) dist[String(e)] = (dist[String(e)] || 0) + 1;

  /* El contraste externo. El *impact bias* predice **sobreestimación**: la gente cree que
     le va a pegar más de lo que le pega, sobre todo con eventos negativos. Sobreestimar es
     `movio < pronosticado`, o sea error negativo. Se nombra la dirección y no se afirma
     nada sobre la magnitud, que con esta muestra no se puede. */
  const sesgo = prom < 0 ? 'sobreestima' : prom > 0 ? 'subestima' : 'clava';

  /* Partido por cómo cerró, y esto es lo que separa la variable del PnL: si el error
     fuera el resultado con otro nombre, ganadoras y perdedoras darían errores opuestos y
     de la misma magnitud. Se muestra, no se concluye. */
  const lado = sel => {
    const e = pares.filter(sel).map(t => t.movio - t.pronostico);
    return e.length ? { n: e.length, prom: e.reduce((a, b) => a + b, 0) / e.length } : null;
  };
  return {
    n: pares.length, conPre, sinPost: conPre - pares.length,
    promedio: prom, sesgo, dist,
    porResultado: { perdedoras: lado(t => t.net < 0), ganadoras: lado(t => t.net >= 0) },
    cobertura: T.length ? conPre / T.length : null, nOps: T.length,
    /* `listo` es la única puerta: debajo de la muestra no se dice nada en ningún lado. */
    listo: pares.length >= CHEQ_MUESTRA, faltan: Math.max(0, CHEQ_MUESTRA - pares.length)
  };
}

/* ===== El ejercicio =====
   De Mark Douglas, "Trading in the Zone": elegís un conjunto de reglas mecánicas y las
   ejecutás una cantidad fija de veces sin desviarte. El objetivo declarado no es ganar
   plata — es instalar la creencia de que podés sostener un sistema.

   Esta pieza rompe a propósito la vieja regla de "nada de contadores". La distinción que
   la habilita es cuál es la meta y quién arranca: un contador de redención te encuentra
   adentro de un estado malo y te ofrece salir de él operando, y eso reproduce el
   pensamiento del tilt. Un contador de práctica lo arrancás vos, en frío, y apunta a una
   habilidad. El primero sigue prohibido; el segundo es todo el libro.

   Tres cosas que lo mantienen honesto:

   El veredicto es de conducta, nunca de resultado. Una serie de veinte perdedoras
   ejecutadas al pie de la letra es un ejercicio perfecto. Si el veredicto mirara el PnL
   sería el mismo error que esta app viene evitando desde el principio.

   El tilt la cancela. Y ojo con lo que eso significa: el tilt no se enciende por perder,
   se enciende por racha MÁS proceso roto. Así que lo que cancela la serie es haberte
   salido del sistema, que es exactamente lo que Douglas cancelaría. Perder veinte
   seguidas respetando las reglas no la toca.

   Descansar no la cancela. Como el tilt ahora caduca con un día nuevo y un hueco real,
   parar antes de romper nada deja la serie intacta. La única forma de perderla es
   salirse del sistema operando. */
const EJ_N = [10, 20, 30, 50];

function ejercicio(s, decl, now) {
  if (!decl || !decl.n || decl.desde == null) return null;
  const T = (s.trades || []);
  const H = habitos(T, s);
  if (!H.length) return null;

  /* Las reglas son un subconjunto de las conductas medibles. Si la declaración pide una
     que no existe, se ignora: nunca se juzga contra una regla que la app no sabe leer.

     3.2 lo convirtió de hipotético en real. Al borrar el hábito `corte`, una serie viva
     declarada con él pasa a juzgarse con una regla menos **y el criterio cambia sin que
     él haya cambiado nada** — o, si `corte` era la única, la serie entera desaparece con
     un `null` y el panel vuelve a ofrecer empezar una. Ninguna de las dos cosas puede ser
     silenciosa: es la forma exacta de los bugs que este proyecto persigue, donde el error
     sale como éxito. Se devuelven en `ignoradas` y el panel lo dice. */
  const pedidas = decl.reglas || [];
  const vivas = new Set(H.map(h => h.id));
  const ignoradas = pedidas.filter(id => !vivas.has(id));
  const reglas = H.filter(h => pedidas.includes(h.id));
  if (!reglas.length) return ignoradas.length ? { vacia: true, ignoradas, n: decl.n } : null;

  /* `serieTest` es de tres valores y acá el `null` se ignora, por la misma razón que se
     ignora una regla que la app no sabe leer: no se cancela una serie por algo que nadie
     pudo mirar. Solo un `false` explícito rompe la repetición. */
  const hechas = T.filter(t => (t.exitTime || t.entryTime) > decl.desde);
  const evaluadas = hechas.map(t => ({
    t, ok: reglas.every(r => r.serieTest(t) !== false),
    fallo: reglas.filter(r => r.serieTest(t) === false).map(r => r.nombre)
  }));
  const cumplidas = evaluadas.filter(e => e.ok).length;

  /* Cancelación: el tilt encendido ahora, o una operación de la serie que lo haya
     encendido antes. Lo segundo se aproxima con la marca que dejó el shell al detectarlo;
     sin marca, alcanza con el estado actual. */
  const porTilt = (s.tilt && s.tilt.activo) || decl.cancelado === 'tilt';
  const completo = evaluadas.length >= decl.n;

  return {
    n: decl.n, reglas: reglas.map(r => ({ id: r.id, nombre: r.nombre, accion: r.accion })),
    desde: decl.desde, inicio: decl.inicio || decl.desde,
    hechas: evaluadas.length, faltan: Math.max(0, decl.n - evaluadas.length),
    cumplidas, adherencia: evaluadas.length ? cumplidas / evaluadas.length : null,
    serie: evaluadas.slice(-decl.n),
    cancelado: porTilt && !completo,
    completo,
    /* El veredicto no mira un solo número: dice cuántas de N salieron enteras. Sin
       aprobado ni desaprobado — la serie es el dato. */
    veredicto: completo ? { cumplidas, n: evaluadas.length, adherencia: cumplidas / evaluadas.length } : null,
    activo: !completo && !porTilt,
    /* Vacío casi siempre. Cuando no lo está, la serie se está juzgando con menos reglas
       de las que él eligió, y eso tiene que verse. */
    ignoradas
  };
}

/* ===== Las cinco verdades =====
   Douglas las hace repetir como afirmación. Acá se dicen con el número propio al lado,
   que es la única forma en que esta app puede sostenerlas: "cualquier cosa puede pasar"
   dicho solo es autoayuda, y dicho con tu peor y tu mejor operación es una descripción.

   Sin muestra no se dicen. Una verdad sobre probabilidades afirmada con seis operaciones
   es una creencia disfrazada de dato. */
function verdades(s) {
  if (!s || s.n < 20) return [];
  const usd = x => (x < 0 ? '-' : '') + 'US$' + Math.abs(x).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const out = [];
  const V = (id, frase, dato) => out.push({ id, frase, dato });

  V('cualquiera', 'Cualquier cosa puede pasar.',
    `En tus ${s.n} operaciones la mejor dio ${usd(s.best.net)} y la peor ${usd(s.worst.net)}. ` +
    `Las dos salieron del mismo sistema.`);

  V('nosaber', 'No necesitás saber qué va a pasar para ganar plata.',
    `Acertás el ${(s.winRate * 100).toFixed(0)}% de las veces y tu expectativa es ${usd(s.expectancy)} ` +
    `por operación. La segunda no se deduce de la primera.`);

  const re = rachasEsperadas(s, 100);
  if (re) V('aleatorio', 'Ganancias y pérdidas se reparten al azar dentro de un mismo método.',
    `Tu peor racha fue de ${s.maxLossStreak} y con tu acierto la racha larga típica en 100 operaciones ` +
    `es de ${re.tipica}. No hizo falta que cambiaras nada para que pasara.`);

  V('ventaja', 'Una ventaja es solo una probabilidad más alta, no una certeza.',
    s.expectancy >= 0
      ? `La tuya vale ${usd(s.expectancy)} por operación: ${usd(s.expectancy * 100)} cada cien, y nada en particular en la próxima.`
      : `La tuya hoy es ${usd(s.expectancy)} por operación. Con ese signo, más operaciones es más pérdida acumulada.`);

  const sym = Object.entries(s.bySymbol).sort((a, b) => b[1].n - a[1].n)[0];
  if (sym && sym[1].n >= 10) {
    const T = s.trades.filter(t => t.symbol === sym[0]);
    const mx = Math.max.apply(null, T.map(t => t.net)), mn = Math.min.apply(null, T.map(t => t.net));
    V('unico', 'Cada momento del mercado es único.',
      `Operaste ${sym[0]} ${sym[1].n} veces y los resultados van de ${usd(mn)} a ${usd(mx)}. ` +
      `El símbolo se repite; la situación no.`);
  }
  return out;
}

/* ===== Adherencia por día =====
   La unidad de casi toda la app es la operación. Pero el día es la unidad en la que se
   vive esto: uno no decide "mi próxima operación va a ser distinta", decide que hoy va a
   hacer las cosas de otra manera. Y el día es lo único que empieza de nuevo solo.

   Mide, para cada día operado, qué fracción de las conductas se sostuvo. Después cruza
   los días cargados contra los tranquilos: la pregunta que responde es si los días de
   mucha actividad son también los de peor adherencia, que es lo que la experiencia sugiere
   pero los datos tienen que confirmar.

   Lo que NO hace es pronosticar. La app no puede saber si hoy va a ser un día difícil:
   `userFillsByTime` devuelve operaciones, no precios ni volatilidad del subyacente, y
   cualquier proxy armado con fills sería inventar la variable. Esto describe lo que ya
   pasó y nada más.

   Y no dice nada si el patrón no está: se pide un mínimo de días de cada lado, y la
   diferencia tiene que aparecer en las dos mitades del historial, igual que en
   `comparativas`. Un dato aislado no es un hallazgo. */
const DIAS_MIN = 8;

function adherenciaDiaria(trades, s) {
  const T = (trades || []).filter(t => !t.open);
  if (T.length < 10) return null;
  const H = habitos(T, s);
  if (!H.length) return null;
  /* El día se juzga solo con las conductas que dependen de cada operación. `limite` queda
     afuera por lo mismo que quedó afuera del núcleo del aire: es preferencia de ejecución,
     no control de riesgo. */
  const usar = H.filter(h => h.id !== 'limite');
  if (!usar.length) return null;

  const porDia = {};
  for (const t of T) {
    const k = diaBA(t.entryTime);
    const d = porDia[k] || (porDia[k] = { dia: k, n: 0, ok: 0, tot: 0, t0: t.entryTime });
    d.n++;
    /* `serieTest` es de tres valores: la conducta que no se pudo juzgar no entra en el
       denominador del día. Si entrara, un día sin dato de colateral bajaría su adherencia
       sin que hubieras hecho nada distinto, y la comparación cargados/tranquilos estaría
       midiendo dónde tiene agujeros la serie de cuenta. */
    for (const h of usar) { const v = h.serieTest(t); if (v == null) continue; d.tot++; if (v === true) d.ok++; }
  }
  const dias = Object.values(porDia).sort((a, b) => a.t0 - b.t0);
  for (const d of dias) d.adh = d.tot ? d.ok / d.tot : null;
  if (dias.length < DIAS_MIN) return { dias, n: dias.length, corte: null };

  /* Cargados contra tranquilos. Dos trampas que hay que esquivar acá:

     La mediana diaria no sirve de corte. Con una distribución bimodal —que es lo normal,
     días de dos operaciones y días de seis— la mediana cae justo encima de uno de los dos
     modos y un lado queda vacío.

     Y el corte tiene que ser un umbral sobre la cantidad, no un ranking de días. Tomar
     "el tercio de arriba" obliga a desempatar entre días con la misma carga, y cualquier
     desempate razonable (por fecha) manda los cargados a una punta del historial y los
     tranquilos a la otra: el split-half deja de controlar la época porque el corte mismo
     está correlacionado con el tiempo.

     Así que se calculan los terciles de la cantidad diaria y se clasifican TODOS los días
     por ese número. Los días del medio quedan afuera de la comparación. */
  const prom = a => (a.length ? a.reduce((x, y) => x + y.adh, 0) / a.length : null);
  const ns = dias.map(d => d.n).sort((a, b) => a - b);
  const cuantil = p => ns[Math.min(ns.length - 1, Math.floor(p * (ns.length - 1)))];
  const hastaN = cuantil(1 / 3), desdeN = cuantil(2 / 3);
  const cargados = dias.filter(d => d.n >= desdeN);
  const tranquilos = dias.filter(d => d.n <= hastaN);
  const medN = s.medianTradesDay || 1;

  /* Si el tercio de arriba y el de abajo tienen la misma carga, no hay nada que comparar:
     no son "días cargados" y "días tranquilos", son veinte días iguales. */
  const hayContraste = desdeN != null && hastaN != null && desdeN > hastaN;

  let estable = null, difA = null, difB = null;
  if (hayContraste && cargados.length >= 3 && tranquilos.length >= 3) {
    const m = Math.floor(dias.length / 2);
    const vieja = new Set(dias.slice(0, m).map(d => d.dia));
    const dif = esVieja => {
      const c = cargados.filter(d => vieja.has(d.dia) === esVieja);
      const t = tranquilos.filter(d => vieja.has(d.dia) === esVieja);
      return (c.length >= 2 && t.length >= 2) ? prom(c) - prom(t) : null;
    };
    difA = dif(true); difB = dif(false);
    /* Coincidir en signo, y que el signo exista: una diferencia de cero en las dos mitades
       no es un patrón estable, es la ausencia de patrón. `Math.sign(0) === Math.sign(0)`
       da true y por eso hay que pedirlo explícito. */
    estable = difA != null && difB != null && difA !== 0 && difB !== 0
      && Math.sign(difA) === Math.sign(difB);
  }

  return {
    dias, n: dias.length, medN, desdeN, hastaN,
    adhCargados: prom(cargados), adhTranquilos: prom(tranquilos),
    nCargados: cargados.length, nTranquilos: tranquilos.length,
    difA, difB, estable,
    corte: hayContraste && cargados.length >= 3 && tranquilos.length >= 3,
    perfectos: dias.filter(d => d.adh === 1).length,
    hoy: dias[dias.length - 1]
  };
}

/* ===== 4.4 — Adherencia por franja horaria =====

   `bySession` guarda `{ n, net, wins }` y **las tres son resultado**. No había forma de
   preguntar "¿cómo se porta mi proceso en la rueda contra el after?" — solo cuánto gané en
   cada una, que es justo la pregunta que el principio 3 no quiere que la app conteste.
   Esta función agrupa la conducta, no la plata.

   **Son diez celdas y no nueve.** `PLAN.md` decía nueve porque contaba cinco sesiones, y
   `SESSIONS` tiene seis: `finde` es una franja donde él opera y tiene que existir como
   celda. Cinco sesiones fuera de la rueda —asia, hueco, pre, after, finde— más los cinco
   tramos en que la rueda está subdividida. La rueda **no** aparece como celda propia: sus
   operaciones viven en sus tramos, o quedarían contadas dos veces.

   **Las flacas se guardan y se muestran vacías**, que es lo que él eligió. Una celda sin
   muestra es información —dice que casi no operás ahí— y colapsarla la esconde. Por eso
   `pct` es `null` y no 0 debajo de `ADH_CELDA_MIN`: quien lo consuma tiene que poder
   distinguir "no hay con qué" de "0% de cumplimiento", que en un mapa pintado por
   adherencia es la diferencia entre gris y rojo.

   **La invariante 2, entera:** `estado === 'sd'` sale del denominador. No cuenta como
   falla ni como cumplido. Si contara, una franja con agujeros en la serie de colateral
   tendría peor adherencia sin que él hubiera hecho nada distinto, y el mapa de 4.5 estaría
   pintando la cobertura de un endpoint con los colores de la disciplina.

   `limite` queda afuera por lo mismo que queda afuera de `adherenciaDiaria`: es preferencia
   de ejecución y no control de riesgo. */
const ADH_CELDA_MIN = 5;   // medibles que hacen falta para que una celda diga un porcentaje

function celdasHorarias() {
  const out = [];
  for (const [id, v] of Object.entries(SESSIONS)) {
    if (id === 'rueda') continue;   // vive subdividida en sus tramos
    out.push({ id, tipo: 'sesion', label: v.label, art: v.art });
  }
  for (const t of TRAMOS)
    out.push({ id: t.id, tipo: 'tramo', label: t.label, frase: t.frase, art: t.art });
  return out;
}

function celdaDe(t) {
  return t.session === 'rueda' ? (t.tramo || null) : (t.session || null);
}

function adherenciaSesion(s) {
  const T = (s && s.trades ? s.trades : []).filter(t => !t.open);
  const H = habitos(T, s).filter(h => h.id !== 'limite');
  if (!H.length) return null;

  const celdas = celdasHorarias();
  const idx = {};
  for (const c of celdas) {
    c.n = 0; c.cumplidas = 0; c.medibles = 0; c.pct = null;
    idx[c.id] = c;
  }

  /* Una operación aporta tantos juicios como hábitos medibles tenga, igual que
     `adherenciaDiaria`. Se cuenta por juicio y no por operación: una operación con tres
     hábitos medibles y uno sin dato pesa tres, no cuatro ni uno. */
  const puntos = [];   // { celda, ok } — la materia prima del test de permutación
  let sinCelda = 0;
  for (const t of T) {
    const k = celdaDe(t);
    if (!k || !idx[k]) { sinCelda++; continue; }
    idx[k].n++;
    for (const h of H) {
      const v = h.serieTest(t);
      if (v == null) continue;                       // invariante 2: fuera del denominador
      idx[k].medibles++;
      if (v === true) idx[k].cumplidas++;
      puntos.push({ celda: k, ok: v === true });
    }
  }
  for (const c of celdas)
    c.pct = c.medibles >= ADH_CELDA_MIN ? c.cumplidas / c.medibles : null;

  const conMuestra = celdas.filter(c => c.pct != null);
  const medibles = celdas.reduce((a, c) => a + c.medibles, 0);
  const cumplidas = celdas.reduce((a, c) => a + c.cumplidas, 0);
  const global = medibles ? cumplidas / medibles : null;

  /* ===== ¿Separan las celdas, o es todo la misma cosa con distinto nombre? =====
     El falsador de este ítem estaba escrito como "que las celdas no separen nada — todas
     entre 78% y 84%", y ese 6 sería un umbral inventado más. Se contesta con el mismo
     instrumento de 3.5: **barajar a qué celda pertenece cada juicio, manteniendo los
     tamaños, y ver si la dispersión observada es más grande que la que sale del azar.**

     El estadístico es la suma ponderada de los desvíos al promedio general, que es el
     chi-cuadrado de siempre escrito sin la tabla. No se compara contra una distribución
     teórica —con celdas de cinco juicios eso no vale— sino contra las permutaciones. */
  let dispersion = null, p = null, pCota = false;
  if (conMuestra.length >= 2 && global != null && puntos.length >= 20) {
    const estad = asign => {
      const acc = {};
      for (let i = 0; i < asign.length; i++) {
        const k = asign[i];
        const a = acc[k] || (acc[k] = { m: 0, c: 0 });
        a.m++; if (puntos[i].ok) a.c++;
      }
      let x = 0;
      for (const k in acc) {
        const a = acc[k];
        if (a.m < ADH_CELDA_MIN) continue;
        const d = a.c / a.m - global;
        x += a.m * d * d;
      }
      return x;
    };
    const asign = puntos.map(x => x.celda);
    dispersion = estad(asign);
    const rnd = rng32(semillaDe('adhSesion|' + puntos.length + '|' + conMuestra.length));
    const baraja = asign.slice();
    let extremos = 0, hechas = 0;
    for (let b = 0; b < PERM_B; b++) {
      for (let i = baraja.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        const tmp = baraja[i]; baraja[i] = baraja[j]; baraja[j] = tmp;
      }
      if (estad(baraja) >= dispersion - EPS) extremos++;
      hechas = b + 1;
      /* Misma parada temprana que 3.5, y por el mismo motivo: si ya se pasó del umbral,
         seguir barajando no cambia el veredicto. El número devuelto es una cota. */
      if (hechas >= 200 && (1 + extremos) / (1 + hechas) > BH_Q) { pCota = true; break; }
    }
    p = (1 + extremos) / (1 + hechas);
  }

  return {
    celdas, conMuestra: conMuestra.length, vacias: celdas.length - conMuestra.length,
    medibles, cumplidas, global, sinCelda, juicios: puntos.length,
    habitos: H.map(h => h.id),
    /* `separa` es el que decide si 4.5 y 4.6 tienen sentido. `null` mientras no haya con
       qué contestar — que no es lo mismo que "no separa". */
    dispersion, p, pCota,
    separa: p == null ? null : p <= BH_Q,
    minMuestra: ADH_CELDA_MIN
  };
}

/* ===== 3.6b — El tiempo sin ninguna posición abierta =====

   Apareció resolviendo 3.6 y es más grande que 3.6. `aire.parálisis` y `estabilidad.rEsp`
   calculaban el hueco como `cur.entryTime − prev.exitTime` entre operaciones consecutivas.
   **Con dos perps abiertos a la vez ese número sale negativo** —la siguiente abrió antes de
   que la anterior cerrara— y el código lo descartaba con `if (g > 0)`, en silencio.

   El efecto no era un número mal: era una **submuestra sesgada**. Cada vez que operaba en
   paralelo, ese hueco desaparecía del cálculo del hueco típico, y el que sobrevivía era
   justamente el de las veces que operó de a uno. El techo de parálisis salía de ahí.

   **Con posiciones paralelas, "estar sin operar" no es la distancia entre dos operaciones
   consecutivas: es el tiempo en que no hubo ninguna abierta.** Eso es un merge de
   intervalos, y es la única definición que no depende de en qué orden se miren.

   Devuelve los huecos reales y, para cada operación que **abre** un bloque nuevo, cuánto
   duró el hueco que la precede. Una operación que abre mientras ya había otra corriendo no
   tiene hueco: no volviste de ningún lado, seguías adentro. */
function huecosSinPosicion(trades) {
  const T = (trades || []).filter(t => !t.open && t.entryTime != null);
  if (!T.length) return { bloques: 0, gaps: [], antes: {} };
  const iv = T.map(t => [t.entryTime, Math.max(t.exitTime || t.entryTime, t.entryTime)])
    .sort((a, b) => a[0] - b[0]);
  const bloques = [];
  for (const [a, b] of iv) {
    const u = bloques[bloques.length - 1];
    if (u && a <= u[1]) u[1] = Math.max(u[1], b);   // se solapa o toca: mismo bloque
    else bloques.push([a, b]);
  }
  const gaps = [];
  const porInicio = new Map();
  for (let i = 1; i < bloques.length; i++) {
    const g = bloques[i][0] - bloques[i - 1][1];
    gaps.push(g);
    porInicio.set(bloques[i][0], g);
  }
  /* Solo las que abren bloque tienen hueco delante. Las demás quedan sin entrada, que es
     distinto de tener un hueco de cero: no se las juzga por parálisis. */
  const antes = {};
  for (const t of T) if (porInicio.has(t.entryTime)) antes[t.id] = porInicio.get(t.entryTime);
  return { bloques: bloques.length, gaps, antes };
}

/* ===== 4.5 — La cinta del día =====

   Veinticuatro horas de Buenos Aires partidas por sesión, con la rueda subdividida en sus
   tramos y anchos proporcionales a los minutos reales de cada franja.

   **No usa una tabla de horarios, y ése es el punto entero de esta función.** Los `art` de
   `SESSIONS` —"rueda 10:30 - 17:00"— están escritos a mano y valen solo con horario de
   verano de EEUU. Medido: en julio la rueda cae 10:30–17:00 en hora de Buenos Aires, y en
   enero **11:30–18:00**, porque Nueva York atrasa una hora y Argentina no. Una cinta
   dibujada con esos números estaría corrida sesenta minutos medio año, **sin que nada
   fallara** — y encima pintaría la adherencia de una franja sobre las horas de otra.

   Así que se le pregunta al motor minuto a minuto: `sessionOf` y `tramoDe` ya saben la
   respuesta correcta para cualquier fecha. Son 1440 consultas por render, que es barato, y
   a cambio no hay ningún supuesto sobre husos.

   El día es el de Buenos Aires porque es el día vivido, igual que en todo el resto.

   **Los fines de semana la cinta muestra un día que no está corriendo**: `finde` es una
   sesión de `SESSIONS` pero no una franja horaria, así que ocupa las 24 horas enteras. Es
   correcto —el mercado está cerrado— y queda dicho en vez de disimulado. */
function cintaDelDia(now) {
  now = now || Date.now();
  /* Medianoche de Buenos Aires del día en curso. `diaBA` ya define cuál es ese día. */
  const dia = diaBA(now);
  const [y, m, d] = dia.split('-').map(Number);
  const cero = Date.UTC(y, m - 1, d, 0, 0) + BA_OFF;   // 00:00 BA en epoch
  const seg = [];
  let cur = null;
  for (let min = 0; min <= 1440; min++) {
    const ts = cero + min * 6e4;
    const ses = min < 1440 ? sessionOf(ts) : null;
    const id = ses === 'rueda' ? (tramoDe(ts) || 'rueda') : ses;
    if (id !== cur) {
      if (seg.length) seg[seg.length - 1].hasta = min;
      if (id) seg.push({ id, tipo: ses === 'rueda' ? 'tramo' : 'sesion', desde: min, hasta: min + 1 });
      cur = id;
    }
  }
  if (seg.length) seg[seg.length - 1].hasta = Math.min(1440, seg[seg.length - 1].hasta);
  /* El día es cíclico y la tira recta lo mentía: Asia va de 21:00 a 03:30, así que quedaba
     partida en dos segmentos —uno al principio y otro al final— y se leía como dos franjas
     distintas. Acá se fusionan si el primero y el último son la misma franja, y el
     resultado lleva `cruza: true` para que el dibujo sepa que ese arco pasa por medianoche.
     La suma de minutos no cambia: es el mismo día, contado como corresponde. */
  const arcos = seg.map(x => Object.assign({ cruza: false }, x));
  if (arcos.length > 1 && arcos[0].id === arcos[arcos.length - 1].id) {
    const primero = arcos.shift();
    const ultimo = arcos[arcos.length - 1];
    ultimo.hasta = 1440 + primero.hasta;   // sigue del otro lado de la medianoche
    ultimo.cruza = true;
  }
  const ahora = Math.floor((now - cero) / 6e4);
  return {
    dia, cero, segmentos: seg, arcos,
    /* `null` si el reloj cayó fuera del día calculado, que no debería pasar pero no se
       inventa un marcador en la posición 0 si pasa. */
    ahora: ahora >= 0 && ahora <= 1440 ? ahora : null
  };
}

/* ===== 4.7 — Los tres momentos, y el que no existía =====

   La app tenía dos estados y él usa tres. Con posición abierta se muestra `enTrade`; sin
   posición, `prepPanel`. **Recién cerrada una operación caías directo en el panel que
   prepara la siguiente**, que es el peor lugar donde caer y además el de más riesgo de
   tilt.

   **La duración del estado `después` era la decisión pendiente, y se resolvió sin inventar
   ningún umbral.** El plan decía que ese número lo discutía 3.2, y 3.2 se cerró borrando el
   umbral en vez de elegirlo — así que un número nuevo acá sería exactamente lo que se acaba
   de sacar. Dura **hasta que abras la próxima**, que es la definición literal de "después
   de la anterior" y no necesita constante: el estado no se apaga con un reloj, se apaga
   porque volviste a operar.
   → *Consecuencia que hay que aceptar:* si dejás de operar una semana, el panel de
     `después` sigue ahí una semana. Es correcto —seguís después de esa operación— y además
     es justo donde `huecoAbierto` tiene algo para decir.

   `posAn` son las posiciones abiertas ahora. `visto` es lo que el usuario ya cerró a mano:
   el conmutador lo escribe, y existe porque **hoy es imposible mirar el estado "antes" con
   una posición abierta**, que era la parte barata del ítem y resuelve algo real. */
function momento(s, posAn, visto) {
  const abiertas = (posAn || []).length;
  if (abiertas) return { id: 'dentro', n: abiertas, trade: null };

  /* **Dos fuentes de verdad sobre qué está abierto, y se desincronizan.** `posAn` sale de
     `clearinghouseState` —las posiciones que el exchange reporta ahora— y `s.trades` sale
     de los fills. Cuando cerrás, el exchange deja de reportar la posición **antes** de que
     llegue el fill de cierre, así que hay una ventana de segundos o minutos donde no hay
     posición viva y el trade sigue `open`.

     Sin esta guarda, en esa ventana la app buscaba la última cerrada del historial y
     anunciaba *"recién cerraste"* con **la operación equivocada** — la anterior, de otro
     símbolo. Pasó de verdad: cerró un short de BTC y el panel dijo DRAM.

     `s.nOpen` cuenta trades sin cerrar en los fills. Si hay alguno y el exchange no reporta
     posición, los fills están atrasados: no se dice nada hasta que se pongan al día. **Es
     mejor callarse que nombrar la operación equivocada**, y además dura lo que tarda el
     próximo refresco. */
  if (s && s.nOpen > 0) return { id: 'antes', n: 0, trade: null, desfasado: true };

  const T = (s && s.trades) || [];
  const ult = T[T.length - 1] || null;
  if (!ult) return { id: 'antes', n: 0, trade: null };
  /* `visto` marca el id de la última que el usuario dio por leída. Se compara por id y no
     por timestamp: dos operaciones pueden cerrar en el mismo milisegundo. */
  if (visto && visto === ult.id) return { id: 'antes', n: 0, trade: ult };
  return { id: 'despues', n: 0, trade: ult };
}

/* ===== 4.1 — El hueco abierto, medido y no empujado =====

   `aire` detecta la parálisis **retroactivamente**, en la operación que vuelve. Un hueco
   abierto —estar sin operar ahora mismo— no existía en ningún lado, y el riesgo que él
   declaró como principal se veía solo por el espejo retrovisor.

   **Lo que lo destrabó fue reescribir el principio 5, no un dato.** Antes decía que la app
   no puede crear un malestar que se alivie operando, y un contador de días sin operar es
   exactamente eso. La versión actual agrega: *"pero medir no es empujar: la app puede saber
   que hay un hueco abierto y mostrarlo en frío en el panel al que él va a buscarlo."*

   De ahí salen las tres restricciones, y son la pieza tanto como el número:

   1. **Solo en el panel.** Nunca en `taladro` — la mascota no lo menciona jamás.
   2. **Sin color que cambie.** Todo en `--mut`. El día que alguien le ponga un umbral y un
      rojo, dejó de ser una medición y pasó a ser un reproche.
   3. **Sin contador de días que crezca solo.** Se dice el hueco con su percentil al lado,
      que es una descripción; *"llevás 4 días"* solo, es un reloj de culpa.

   Es descriptivo, con sus números, sin verbo en imperativo — la forma en que las cinco
   verdades ya funcionan.

   **Y usa los huecos de `huecosSinPosicion`, no los de antes.** Comparar el hueco actual
   contra un histórico que descartaba en silencio los solapes daría un percentil inflado:
   se estaría comparando contra la mitad tranquila de su historia.
   → *Qué lo falsaría:* que lo mires y te den ganas de operar. Ahí el principio 5 gana y se
     saca, aunque el número sea correcto. */
function huecoAbierto(s, now) {
  now = now || Date.now();
  const T = (s && s.trades) || [];
  /* Con posición abierta no hay hueco: estás adentro. No es un hueco de cero. */
  if (!T.length || (s && s.nOpen > 0)) return null;
  const ultimo = Math.max.apply(null, T.map(t => t.exitTime || t.entryTime));
  const ms = now - ultimo;
  if (!(ms > 0)) return null;

  const gaps = huecosSinPosicion(T).gaps.filter(g => g > 0).sort((a, b) => a - b);
  /* Sin historial de huecos se dice el hueco y nada más. Un percentil sobre tres muestras
     describe tres días, no un ritmo. */
  const MIN_GAPS = 10;
  if (gaps.length < MIN_GAPS) return { ms, desde: ultimo, n: gaps.length, comparable: false,
    percentil: null, mediana: null, p90: null };
  const menores = gaps.filter(g => g < ms).length;
  const cuantil = q => gaps[Math.min(gaps.length - 1, Math.floor(q * gaps.length))];
  return {
    ms, desde: ultimo, n: gaps.length, comparable: true,
    percentil: menores / gaps.length,
    mediana: cuantil(0.5), p90: cuantil(0.9)
  };
}

/* ===== 3.6 — Cuánto cambiaría contar las rachas por cierre =====

   `computeStats` calcula `maxLossStreak` y `maxWinStreak` recorriendo por `entryTime`. La
   curva acumulada ya se arregló y va por cierre; las rachas se dejaron a propósito, porque
   **no es el mismo arreglo sino otra pregunta**: ¿tu racha es el orden en que abriste o el
   orden en que te enteraste?

   El plan dice, textual, *"conviene medir la diferencia antes de decidir"*, y hasta ahora
   esa decisión se habría tomado a ciegas. Esto es el instrumento.

   **Lo primero que hay que entender es de dónde puede salir una diferencia.** Los trades se
   arman de posición plana a posición plana, así que **dos operaciones del mismo símbolo
   nunca se superponen**: la segunda no existe hasta que la primera cerró. La única fuente
   de desorden es tener dos instrumentos abiertos a la vez. Si él opera de a uno, los dos
   órdenes son idénticos y el ítem es cosmético — y eso se ve con un número, no opinando.

   No devuelve ninguna recomendación: devuelve cuánto se movería. */
function diagOrden(trades) {
  const T = (trades || []).filter(t => !t.open);
  if (T.length < 3) return null;
  const porEntrada = T.slice().sort((a, b) => a.entryTime - b.entryTime);
  const porCierre = T.slice().sort((a, b) =>
    ((a.exitTime || a.entryTime) - (b.exitTime || b.entryTime)) || (a.entryTime - b.entryTime));

  /* Cuántas cambian de lugar entre los dos órdenes. Es el número más directo: si es cero,
     no hay nada que decidir. */
  const movidas = porEntrada.reduce((a, t, i) => a + (porCierre[i] === t ? 0 : 1), 0);

  /* Superposiciones reales: pares que estuvieron abiertos al mismo tiempo. Se cuenta el
     par y no la operación, porque una sola operación larga puede solaparse con varias. */
  let pares = 0, conSolape = new Set(), maxSolape = 0;
  for (let i = 0; i < porEntrada.length; i++) {
    const a = porEntrada[i], aFin = a.exitTime || a.entryTime;
    for (let j = i + 1; j < porEntrada.length; j++) {
      const b = porEntrada[j];
      if (b.entryTime >= aFin) break;   // ordenadas por entrada: de acá en más ninguna solapa
      pares++; conSolape.add(a); conSolape.add(b);
      maxSolape = Math.max(maxSolape, Math.min(aFin, b.exitTime || b.entryTime) - b.entryTime);
    }
  }

  const rachas = orden => {
    let ls = 0, ws = 0, maxL = 0, maxW = 0;
    for (const t of orden) {
      if (t.net < 0) { ls++; ws = 0; } else { ws++; ls = 0; }
      maxL = Math.max(maxL, ls); maxW = Math.max(maxW, ws);
    }
    /* La racha en curso también, porque es la que mira `tilt` y la que se ve en pantalla. */
    let cur = 0;
    for (let i = orden.length - 1; i >= 0 && orden[i].net < 0; i--) cur++;
    return { maxLoss: maxL, maxWin: maxW, actual: cur };
  };
  const rE = rachas(porEntrada), rC = rachas(porCierre);

  return {
    n: T.length, movidas, pctMovidas: movidas / T.length,
    pares, opsSolapadas: conSolape.size, maxSolapeMs: maxSolape || null,
    porEntrada: rE, porCierre: rC,
    /* Lo único que importa para decidir: ¿alguno de los tres números cambia? */
    cambia: rE.maxLoss !== rC.maxLoss || rE.maxWin !== rC.maxWin || rE.actual !== rC.actual,
    cosmetico: movidas === 0
  };
}

/* ===== Presupuesto de riesgo =====
   Mide la fuga que ningún journal ve: entrar con menos de lo que tu propia regla te habilita.
   Pasarse se paga en la cuenta; quedarse corto se paga en repeticiones que no hiciste. */
function presupuesto(all, s) {
  const T = (all || []).filter(t => !t.open);
  if (T.length < 8) return null;
  /* `valor` y no `limite`: la pregunta es cuánto arriesgás por operación, no hasta dónde
     se te tolera una pérdida al juzgarte. Con techo declarado los dos coinciden; con banda
     observada, usar el límite inflaría el habilitado un 50% sin que él decidiera nada. */
  const B = (s && s.banda) || bandaRiesgo(s, null);
  const banda = B.valor;
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

  /* ===== 3.3 — El stop típico sale de dónde pusiste el stop, no de cómo salió =====

     Acá vivía `mediana(|net| / notional)` de las perdedoras recientes, y con eso la pieza
     era casi una tautología. La cuenta es `habilitado = banda / (stopTípico/100)`; si la
     pérdida relativa fuera constante, `habilitado` sería el promedio del notional **por
     construcción**. O sea que `uso` terminaba comparando tu notional reciente contra tu
     notional de hace un rato — y el notional se mueve solo con el colateral, así que la
     barra podía mostrarte "corto" simplemente porque perdiste.

     3.1 cortó una punta: con techo declarado, `banda` ya no sale del PnL. **Pero la
     tautología necesitaba las dos**, y ésta es la que faltaba.

     `holguraHist.stopMediano` es la distancia al stop que la app vio **en vivo**, mirando
     posiciones abiertas. Es independiente del resultado: es dónde lo pusiste, no cómo
     salió. El dato ya se venía guardando y solo alimentaba una tarjeta.

     **Sin cinco observadas la pieza se apaga, y ése es el costo aceptado.** La holgura
     tiene cobertura parcial por diseño —solo cubre lo que la app llegó a ver abierto— así
     que la barra va a estar apagada más seguido que antes. La alternativa era caer al
     cálculo viejo con un rótulo, y eso deja la tautología viva y rotulada: es más fácil
     ignorar un rótulo que una barra apagada. El umbral es el mismo 5 que ya usa la tarjeta
     de holgura en `buildInsights`, no uno nuevo.
     → *Qué lo reabriría:* que a los dos meses siga apagada. Ahí lo que falla no es el
       criterio sino la cobertura, y la pregunta pasa a ser cómo ver más posiciones. */
  const hg = s && s.holgura;
  const HOLG_MIN = 5;
  if (!banda) return null;
  if (!hg || !(hg.conStop >= HOLG_MIN) || !(hg.stopMediano > 0)) {
    /* Se apaga diciendo por qué y cuánto falta, en vez de devolver `null` a secas: la
       diferencia entre "no da" y "todavía no se puede medir" es justo la que esta app
       viene cuidando en todas las demás piezas. */
    /* `holguraHist` sin observaciones devuelve el objeto corto, **sin `conStop`**, así que
       leerlo directo daba `NaN` en `falta` y en pantalla. Vale para cualquier consumidor
       nuevo de esa función: los campos largos solo existen cuando hubo al menos una. */
    const cs = (hg && hg.conStop) || 0;
    return { apagado: true, motivo: 'holgura',
      conStop: cs, falta: Math.max(0, HOLG_MIN - cs),
      cobertura: (hg && hg.cobertura) || 0, banda, base: B.base };
  }
  const stopTipico = hg.stopMediano;

  const habilitado = banda / (stopTipico / 100);
  /* Ventana corta a propósito: con diez, cambiar tres operaciones no movía la mediana
     y parecía que la barra estaba rota. Con cinco, un cambio de conducta se ve enseguida. */
  const VENT = 5;
  const rec = T.slice(-VENT);
  const usado = med(rec.map(t => t.notional));
  const uso = habilitado > 0 ? usado / habilitado : null;
  const estado = uso == null ? null : uso < 0.6 ? 'corto' : uso > 1.5 ? 'pasado' : 'en banda';
  return { apagado: false, banda, base: B.base, stopTipico, habilitado, usado, uso, estado,
    n: rec.length, ventana: VENT, ultimos: rec.map(t => t.notional),
    /* De dónde salió el stop, para que la tarjeta lo pueda decir y para que el día que
       alguien lo cambie se note en el texto y no solo en el número. */
    stopFuente: 'holgura', conStop: hg.conStop, coberturaHolgura: hg.cobertura };
}

/* ===== Qué tan normal es una mala racha =====
   Probabilidad exacta de que aparezca al menos una racha de k pérdidas en n operaciones,
   dado tu propio win rate. Sirve para separar "me está yendo mal" de "esto tenía que pasar". */
function probRacha(n, q, k) {
  if (!(n > 0) || !(q > 0) || !(k > 0)) return 0;
  let dp = new Array(k).fill(0); dp[0] = 1;
  for (let i = 0; i < n; i++) {
    const nd = new Array(k).fill(0);
    for (let j = 0; j < k; j++) {
      if (!dp[j]) continue;
      nd[0] += dp[j] * (1 - q);
      if (j + 1 < k) nd[j + 1] += dp[j] * q;
    }
    dp = nd;
  }
  return 1 - dp.reduce((a, b) => a + b, 0);
}

/* Tabla de rachas esperadas con tus números, más la racha larga típica en n operaciones. */
function rachasEsperadas(s, n) {
  if (!s.n) return null;
  n = n || 100;
  const q = s.lossRate != null ? s.lossRate : 1 - s.winRate;   // probabilidad de perder, no de no ganar
  const filas = [3, 5, 8, 11].map(k => ({ k, p: probRacha(n, q, k) }));
  let tipica = 1;
  for (let k = 1; k <= 30; k++) if (probRacha(n, q, k) >= 0.5) tipica = k;
  return { n, q, filas, tipica, winRate: s.winRate, real: s.maxLossStreak };
}

/* Serie de valor de cuenta que devuelve el endpoint `portfolio`.
   A diferencia del PnL acumulado, incluye depósitos y retiros: es lo que realmente tuviste. */
function serieCuenta(portfolio) {
  if (!portfolio) return [];
  const listas = [];
  const recorrer = p => {
    if (!p) return;
    if (Array.isArray(p)) {
      for (const e of p) {
        if (Array.isArray(e) && e.length === 2 && e[1] && Array.isArray(e[1].accountValueHistory)) {
          listas.push({ clave: String(e[0]), h: e[1].accountValueHistory });
        } else recorrer(e);
      }
    } else if (typeof p === 'object') Object.values(p).forEach(recorrer);
  };
  recorrer(portfolio);
  if (!listas.length) return [];

  /* ===== Se fusionan todas, no se elige una =====
     El endpoint devuelve `day`, `week`, `month` y `allTime` en la MISMA respuesta, con
     distinta resolución cada una. Acá se agarraba `allTime` —la más gruesa— y se tiraban
     las otras. Para alguien que opera intradía eso es interpolar el colateral sobre la
     peor grilla disponible teniendo la buena en la mano, y el colateral es el denominador
     de toda la exposición: `escalaTamano`, `habitos.tamano`, `tilt`, `aire` y
     `estabilidad` cuelgan de ese número.

     `allTime` aporta el rango y `day` aporta la resolución donde la hay. En los instantes
     donde dos series se pisan gana **la más fina**, que es la que midió más cerca. La
     resolución se estima con la mediana de los huecos y no con la cantidad de puntos: una
     serie larga y rala tiene más puntos que una corta y densa, y lo que importa es cuánto
     hay que interpolar entre medición y medición. */
  const limpia = l => l.h.map(x => ({ time: +x[0], v: +x[1] }))
    .filter(x => isFinite(x.time) && isFinite(x.v))
    .sort((a, b) => a.time - b.time);
  const paso = ps => {
    if (ps.length < 2) return Infinity;
    const g = [];
    for (let i = 1; i < ps.length; i++) if (ps[i].time > ps[i - 1].time) g.push(ps[i].time - ps[i - 1].time);
    if (!g.length) return Infinity;
    g.sort((a, b) => a - b);
    return g[Math.floor(g.length / 2)];
  };

  const conPuntos = listas.map(l => { const ps = limpia(l); return { clave: l.clave, ps, paso: paso(ps) }; })
    .filter(l => l.ps.length);
  if (!conPuntos.length) return [];
  conPuntos.sort((a, b) => a.paso - b.paso);   // la más fina primero: gana los empates

  const mapa = new Map();
  for (const l of conPuntos) for (const p of l.ps) if (!mapa.has(p.time)) mapa.set(p.time, p.v);
  return [...mapa.entries()].map(([time, v]) => ({ time, v })).sort((a, b) => a.time - b.time);
}

/* Resolución y alcance de la serie de cada dex. No decide nada: existe para poder mirar
   los números antes de discutir `EXP_COBERTURA_MIN` y `EQ_COLA`, que hoy son 0,8 y 7 días
   elegidos a ojo y nunca contrastados con una respuesta real. */
function diagSeries(portfolio, trades) {
  const series = seriesPorDex(portfolio);
  const T = (trades || []).filter(t => !t.open);
  return Object.keys(series).map(dex => {
    const s = series[dex];
    const g = [];
    for (let i = 1; i < s.length; i++) if (s[i].time > s[i - 1].time) g.push(s[i].time - s[i - 1].time);
    g.sort((a, b) => a - b);
    const mid = a => (a.length ? a[Math.floor(a.length / 2)] : null);
    const propias = T.filter(t => t.dex === dex);
    const dentro = propias.filter(t => equityEn(s, t.entryTime) != null).length;
    return {
      dex, puntos: s.length,
      desde: s.length ? s[0].time : null, hasta: s.length ? s[s.length - 1].time : null,
      pasoMediano: mid(g), pasoMin: g[0] != null ? g[0] : null, pasoMax: g.length ? g[g.length - 1] : null,
      opsDelDex: propias.length, cubiertas: dentro,
      cobertura: propias.length ? dentro / propias.length : null
    };
  });
}

/* Concentración real de la escala de tamaño. `estabilidad` ya la usa para callarse cuando
   la razón está clavada en 1, pero el umbral de 0,9 se eligió razonando y no midiendo.
   Esto devuelve la distribución para poder mirarla. */
function diagEscala(trades, esc) {
  const T = (trades || []).filter(t => !t.open);
  if (!T.length || !esc) return null;
  const cuenta = new Map();
  let con = 0;
  for (const t of T) {
    const v = esc.de(t);
    if (!(v > 0)) continue;
    const k = v.toPrecision(3);
    cuenta.set(k, (cuenta.get(k) || 0) + 1);
    con++;
  }
  if (!con) return { base: esc.base, n: T.length, con: 0, valores: 0, top: [] };
  const top = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([v, n]) => ({ v: +v, n, frac: n / con }));
  return { base: esc.base, n: T.length, con, valores: cuenta.size,
    concentracion: top[0].frac, top };
}

/* ===== La cuenta entera, no la de un dex =====
   `serieCuenta` recibe la respuesta de UN pedido de `portfolio`. El gráfico de valor de
   cuenta le pasaba `RAW.portfolio`, que desde que existen los HIP-3 es un **mapa por dex**:
   la función recorría el objeto entero, se quedaba con la primera lista cuya clave dijera
   `allTime`, y dibujaba el colateral de un solo dex con el rótulo de la cuenta. Con
   hyperliquid en 1000 y xyz en 7, el gráfico decía 1000.

   `seriesPorDex` ya hacía lo correcto —por eso `equityEn` y la exposición estaban sanas—,
   así que el que había quedado con el formato viejo era el gráfico, que es justo donde uno
   iría a chequear a ojo el denominador de todo lo demás.

   Sumar no es concatenar: cada dex tiene sus propios timestamps. Se arma la unión de todos
   los instantes y en cada uno se pregunta a cada serie cuánto valía, con `equityEn`, que
   interpola adentro del rango y devuelve `null` afuera en vez de extrapolar. Un dex que
   todavía no existía en ese instante no suma cero —eso hundiría la curva hacia atrás—:
   queda afuera y el punto se marca como parcial, con cuántos dexes lo formaron. */
function serieTotal(portfolio) {
  const series = seriesPorDex(portfolio);
  const claves = Object.keys(series);
  if (!claves.length) return [];
  if (claves.length === 1) {
    return series[claves[0]].map(p => ({ time: p.time, v: p.v, dexes: 1, parcial: false }));
  }
  const instantes = [...new Set(claves.flatMap(k => series[k].map(p => p.time)))].sort((a, b) => a - b);
  const out = [];
  for (const t of instantes) {
    let v = 0, con = 0;
    for (const k of claves) {
      const x = equityEn(series[k], t);
      if (x != null) { v += x; con++; }
    }
    if (con) out.push({ time: t, v, dexes: con, parcial: con < claves.length });
  }
  return out;
}

/* ===== Exposición: el tamaño que sí elegís =====
   El notional no es una decisión cuando el apalancamiento es fijo. Con x20, el notional
   es colateral × 20: si perdés, entra más chico solo; si ganás, entra más grande solo.
   Medir "tamaño consistente" sobre el notional crudo mide entonces el PnL con otro nombre,
   y el sesgo va justo al revés de lo que esta app quiere:

     colateral que baja despacio  → las últimas 20 se parecen entre sí y arrastran la
                                    mediana con ellas: verde permanente sin cambiar nada
     colateral que baja mucho     → el notional cae debajo del piso: rojo por perder plata
     colateral que sube           → el notional pasa el techo: rojo por ganar, y como
                                    `aire.regla` usa el mismo test, componer la cuenta
                                    apagaba el modo aire

   La variable invariante a la escala es la exposición: notional / colateral, o sea cuántas
   veces tu cuenta pusiste en juego. Si siempre entrás a x20 con todo, da 20 vaya como vaya
   la cuenta, y el hábito marca verde porque es cierto y no por accidente. Si un día entrás
   con la mitad del colateral, da 10 y eso sí es un cambio de conducta.

   Es la misma corrección que ya se había hecho con el apalancamiento: era la entrada, no
   una decisión de riesgo. El notional es la consecuencia; la exposición es la elección. */

/* En los perps HIP-3 cada dex lleva su propio margen, así que la exposición de una
   operación se mide contra el colateral de SU dex, no contra la suma de la cuenta. */
function seriesPorDex(portfolio) {
  const out = {};
  if (!portfolio || typeof portfolio !== 'object') return out;
  /* El mapa viene indexado por dex desde `traer()`. Si llega una sola serie suelta
     (formato viejo) se la trata como la de hyperliquid. */
  const claves = Object.keys(portfolio);
  if (!claves.length) return out;
  for (const k of claves) {
    const s = serieCuenta(portfolio[k]);
    if (s.length) out[k] = s.slice().sort((a, b) => a.time - b.time);
  }
  return out;
}

/* Valor de cuenta en un instante. Interpola entre los dos puntos que lo encierran; fuera
   del rango de la serie devuelve null en vez de extrapolar, porque extrapolar el colateral
   es inventar el denominador de todo lo que sigue. */
const EQ_COLA = 7 * 864e5;   // cuánto se admite pasado el último punto de la serie
function equityEn(serie, ts) {
  if (!serie || !serie.length) return null;
  if (ts < serie[0].time) return null;
  const ult = serie[serie.length - 1];
  if (ts > ult.time) return ts - ult.time <= EQ_COLA ? (ult.v > 0 ? ult.v : null) : null;
  let lo = 0, hi = serie.length - 1;
  while (lo < hi - 1) {
    const m = (lo + hi) >> 1;
    if (serie[m].time <= ts) lo = m; else hi = m;
  }
  const a = serie[lo], b = serie[hi];
  if (ts <= a.time) return a.v > 0 ? a.v : null;
  const span = b.time - a.time;
  const v = span > 0 ? a.v + (b.v - a.v) * ((ts - a.time) / span) : a.v;
  return v > 0 ? v : null;
}

/* Distancia de un instante al punto REAL más cercano de la serie (2.6).
   `equityEn` interpola entre los dos puntos que encierran la entrada sin mirar cuán lejos
   están, así que devuelve un número igual de seguro de sí mismo para una entrada medida 18
   minutos antes que para una caída adentro de un hueco de diez días. La cobertura del 99%
   medida el 3/8 contaba las dos como cubiertas.

   Esto no decide nada todavía y es a propósito: elegir el umbral antes de ver cómo se
   reparte la distancia sería el mismo "a ojo" que 2.3 vino a corregir. Primero se mide. */
function gapEn(serie, ts) {
  if (!serie || !serie.length) return null;
  let lo = 0, hi = serie.length - 1;
  if (ts <= serie[0].time) return serie[0].time - ts;
  if (ts >= serie[hi].time) return ts - serie[hi].time;
  while (lo < hi - 1) {
    const m = (lo + hi) >> 1;
    if (serie[m].time <= ts) lo = m; else hi = m;
  }
  return Math.min(ts - serie[lo].time, serie[hi].time - ts);
}

/* Anota `equity` y `exposicion` sobre cada trade y devuelve la cobertura. Nada se decide
   sobre exposición si la cobertura es pobre: se dice y se cae al notional.

   `equityGap` se anota al lado y **no condiciona nada**: existe para poder mirar la
   distribución antes de discutir si hace falta un umbral. Ver 2.6 en `PLAN.md`. */
const EXP_COBERTURA_MIN = 0.8;
function anotarExposicion(trades, portfolio) {
  const series = seriesPorDex(portfolio);
  let con = 0;
  for (const t of trades || []) {
    const v = equityEn(series[t.dex], t.entryTime);
    t.equity = v;
    t.exposicion = v && t.notional > 0 ? t.notional / v : null;
    t.equityGap = t.exposicion != null ? gapEn(series[t.dex], t.entryTime) : null;
    if (t.exposicion != null) con++;
  }
  const n = (trades || []).length;
  return { n, con, cobertura: n ? con / n : 0, hay: n > 0 && con / n >= EXP_COBERTURA_MIN, dexes: Object.keys(series) };
}

/* Cómo se reparte esa distancia (2.6). Cuantiles y no promedio: si la mitad de las entradas
   cae a minutos de un punto real y un puñado cae adentro de un hueco de diez días, el
   promedio no lo dice y la mediana tampoco — hay que mirar la cola.

   `lejos` cuenta contra el hueco mediano observado de la propia serie y no contra una
   constante: el criterio de "lejos" tiene que salir de sus datos, igual que todos los
   umbrales de `aire` y `tilt`. Una entrada interpolada sobre una distancia mucho mayor que
   el paso típico de su dex es la que hay que poder contar. */
function diagGaps(trades, portfolio) {
  const T = (trades || []).filter(t => !t.open && t.equityGap != null);
  if (!T.length) return null;
  const series = seriesPorDex(portfolio);
  const pasoDex = {};
  for (const dex of Object.keys(series)) {
    const s = series[dex], g = [];
    for (let i = 1; i < s.length; i++) if (s[i].time > s[i - 1].time) g.push(s[i].time - s[i - 1].time);
    g.sort((a, b) => a - b);
    pasoDex[dex] = g.length ? g[Math.floor(g.length / 2)] : null;
  }
  const q = T.map(t => t.equityGap).sort((a, b) => a - b);
  const cuantil = f => q[Math.min(q.length - 1, Math.floor(f * q.length))];
  let lejos = 0, sinPaso = 0;
  for (const t of T) {
    const paso = pasoDex[t.dex];
    if (!(paso > 0)) { sinPaso++; continue; }
    if (t.equityGap > 3 * paso) lejos++;
  }
  return {
    n: T.length, medida: T.length,
    p50: cuantil(0.5), p90: cuantil(0.9), p99: cuantil(0.99), max: q[q.length - 1],
    lejos, sinPaso, fracLejos: T.length ? lejos / T.length : 0, pasoDex
  };
}

/* ===== La referencia única de "cuánto puede costarte una operación" =====
   Hermana de `escalaTamano`: una sola definición, y todos preguntan acá.

   3.1 — Hasta acá la banda era `adherence.rec.avgLoss`, el promedio de las últimas veinte
   pérdidas, y ése es un defecto que no se arregla afinándolo. Si las pérdidas crecen
   despacio la referencia crece con ellas: el hábito `perdida` marca verde para siempre y
   `tilt` deja de encontrar motivo justo cuando más lo habría. Una regla de riesgo que se
   mueve sola con tus pérdidas no es una regla — es un termómetro que se cree norma.

   Así que la banda se declara en frío, como las reglas del `ejercicio` y por el mismo
   motivo: se elige antes, se mide adherencia después. La observada queda de fallback
   mientras no haya una declarada, y de contraste cuando la hay, pero nunca vuelve a ser la
   norma que se ajusta sola.

   `valor` y `limite` no son lo mismo, y confundirlos es fácil:

     valor  — cuánto arriesgás por operación. Lo consume `presupuesto` para el habilitado.
     limite — hasta dónde una pérdida todavía cuenta como cumplida. Lo consumen
              `habitos.perdida`, `tilt.limpia` y `aire.regla`.

   Coinciden cuando la banda está declarada, **y ésa es la otra mitad del arreglo.** El
   ×1,5 que estaba escrito a mano en cinco lugares existía porque un promedio necesita
   tolerancia: pedirle a alguien que no supere nunca su propio promedio es pedirle que
   acierte la mitad de las veces contra su propia media, o sea un hábito que falla por
   definición el 50% del tiempo. Un techo declarado no necesita ninguna — el número ya es
   el borde, y sumarle un 50% encima lo convierte en otro número que él no escribió. El
   múltiplo vive acá adentro y ningún consumidor multiplica nada.
   → *Qué lo reabriría:* que con el techo exacto la racha de `perdida` quede clavada en
     cero. Ahí lo que está mal es el número declarado y no la tolerancia, y el que lo dice
     es `deriva`, sin tocar nada.

   `deriva` es la red que pide el ítem: la observada contra la declarada, los dos números
   al lado, y la declarada no se mueve nunca sola. La observada ya es un promedio de
   veinte, así que "sostenida" viene de fábrica: no hace falta inventar otra ventana. */
const BANDA_TOL = 1.5;

function bandaRiesgo(s, decl) {
  const obs = ((s && s.adherence) ? s.adherence.rec.avgLoss : (s && s.avgLoss)) || 0;
  const d = decl && +decl.banda > 0 && isFinite(+decl.banda) ? +decl.banda : null;
  const valor  = d != null ? d : obs;
  const limite = d != null ? d : obs * BANDA_TOL;
  return {
    base: d != null ? 'declarada' : 'observada',
    valor, limite,
    declarada: d, observada: obs || null,
    desde: d != null ? (decl.desde || null) : null,
    nObs: (s && s.adherence) ? s.adherence.rec.n : null,
    /* La razón entre lo que hacés y lo que dijiste. `null` sin declarada: no hay contra
       qué comparar, y un 1,0 por defecto diría que estás perfecto. */
    deriva: (d != null && obs > 0) ? obs / d : null,
    /* De tres valores, como todo test de conducta de esta app: sin banda no hay con qué
       juzgar una pérdida, y eso es `null`, no una falla. Invariante 3. */
    dentro: t => {
      if (t.net >= 0) return true;
      if (!(limite > 0)) return null;
      return Math.abs(t.net) <= limite;
    }
  };
}

/* La referencia única de "tu tamaño de siempre". Devuelve la escala que corresponde y
   dice cuál eligió, para que ninguna pieza invente la suya por su cuenta.

   Existía por triplicado —`habitos.tamano`, `tilt.med` y `aire.med` sobre el historial
   entero, `aire.salto` sobre las diez anteriores— y la misma operación podía cumplir una
   y fallar otra. Ahora todas preguntan acá. */
function escalaTamano(trades) {
  const T = (trades || []).filter(t => !t.open);
  const medi = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
  const exps = T.map(t => t.exposicion).filter(x => x != null && isFinite(x) && x > 0);
  if (T.length && exps.length / T.length >= EXP_COBERTURA_MIN) {
    return {
      base: 'exposicion', med: medi(exps), n: exps.length,
      de: t => (t.exposicion != null && isFinite(t.exposicion) ? t.exposicion : null),
      fmt: x => x.toFixed(1) + '× tu cuenta'
    };
  }
  return {
    base: 'notional', med: medi(T.map(t => t.notional)), n: T.length,
    de: t => (t.notional > 0 ? t.notional : null),
    fmt: x => usdT(x)
  };
}

/* Operaciones de hoy agrupadas por sesión. */
function todayBySession(trades, now) {
  now = now || Date.now();
  const key = diaBA(now);
  const hoy = trades.filter(t => !t.open && diaBA(t.entryTime) === key);
  const by = {};
  for (const t of hoy) {
    const b = by[t.session] || (by[t.session] = { n: 0, net: 0, wins: 0 });
    b.n++; b.net += t.net; if (t.net > 0) b.wins++;
  }
  return { hoy, by, net: hoy.reduce((a, t) => a + t.net, 0) };
}

/* ===== Preparación del día: alertas de contexto sobre las operaciones recientes ===== */
function buildDayPlan(s, now) {
  now = now || Date.now();
  const out = { session: sessionOf(now), sessions: SESSIONS, alerts: [], rules: [] };
  if (!s.n) return out;
  const usd = x => (x < 0 ? '-' : '') + 'US$' + Math.abs(x).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const A = (level, title, text) => out.alerts.push({ level, title, text });
  const T = s.trades, last = T[T.length - 1];

  // Sesión actual y tu historial en ella
  const cur = s.bySession[out.session];
  const lab = SESSIONS[out.session].label;
  if (out.session === 'finde') {
    A('bad', 'Mercado cerrado', `El subyacente no opera entre viernes 21:00 y domingo 21:00 de Buenos Aires. Cualquier precio acá es descubrimiento del perp, sin referencia.`);
  } else if (!cur || cur.n < 3) {
    A('info', `Estás en ${lab}`, `Casi no tenés historia en esta franja: ${cur ? cur.n : 0} operaciones.`);
  } else if (cur.net < 0) {
    A('warn', `${lab} es una franja que te cuesta plata`,
      `${cur.n} operaciones, ${usd(cur.net)}, ${((cur.wins / cur.n) * 100).toFixed(0)}% de acierto, ` +
      `${usd(cur.net / cur.n)} por operación contra ${usd(s.expectancy)} de tu promedio general.`);
  } else {
    A('good', `${lab} es tu mejor franja`,
      `${cur.n} operaciones, ${usd(cur.net)}, ${((cur.wins / cur.n) * 100).toFixed(0)}% de acierto.`);
  }

  // Racha reciente
  let streak = 0;
  for (let i = T.length - 1; i >= 0 && T[i].net < 0; i--) streak++;
  if (streak >= 2) {
    A('bad', `Venís de ${streak} pérdidas seguidas`,
      `Tu racha peor histórica fue de ${s.maxLossStreak}.` +
      (s.trasRacha && s.trasRacha.n >= 3
        ? ` Tus entradas después de dos o más pérdidas seguidas rindieron ${usd(s.trasRacha.avg)} por operación ` +
          `contra ${usd(s.trasRacha.avgResto)} del resto, sobre ${s.trasRacha.n} casos.`
        : ` Todavía no hay casos suficientes para medir qué rinden tus entradas después de una racha.`));
  }

  // Escalada de tamaño
  /* La misma estabilidad que mira `aire`, no una segunda cuenta sobre notional crudo. */
  {
    const e = s.estabilidad;
    if (e && e.inestable.length) {
      const p = r => (r > 1 ? '+' : '') + ((r - 1) * 100).toFixed(0) + '%';
      const uni = e.base === 'exposicion' ? 'la exposición' : 'el tamaño';
      const d = [];
      if (e.rTam != null && e.inestable.includes('tamaño')) d.push(`${uni} ${p(e.rTam)}`);
      if (e.rEsp != null && e.inestable.includes('espera')) d.push(`la espera ${p(e.rEsp)}`);
      A('warn', 'Histórico: el resultado anterior te cambia lo que hacés',
        `Después de perder, ${d.join(' y ')} contra lo que hacés después de ganar. ` +
        `Medianas sobre ${e.nP} y ${e.nG} operaciones.`);
    }
  }

  /* Liquidaciones. La frase "en todas la distancia al stop era mayor" se dijo mucho tiempo
     a ciegas: el historial no guarda el stop, así que era una afirmación sin dato. Se
     corrigió en `buildInsights` y quedó viva acá — el mismo error, un panel más allá. Ahora
     sale de `holguraHist`, sobre las que la app llegó a ver abiertas y con el conteo al
     lado. Sin observaciones no se dice nada. */
  if (s.liq.n) {
    const hg = s.holgura;
    const obs = hg && hg.nLiq
      ? ` De esas, ${hg.nLiq} ${hg.nLiq > 1 ? 'las vio' : 'la vio'} la app abierta` +
        (hg.nLiqAvisadas ? `, y en ${hg.nLiqAvisadas} el stop estaba más lejos que la liquidación o no había stop.` : '.')
      : '';
    A('bad', `${s.liq.n} ${s.liq.n > 1 ? 'liquidaciones' : 'liquidación'} en tu historial`,
      `Costaron ${usd(s.liq.net)}. Neto sin ellas: ${usd(s.net - s.liq.net)}.` + obs);
  }

  // Deriva de técnica
  const ad = s.adherence;
  if (ad) {
    const r = ad.rec, b = ad.base;
    if (b.avgLoss > 0 && r.avgLoss / b.avgLoss < 0.7) {
      A('good', 'Estás sosteniendo el stop corto',
        `Pérdida promedio de las últimas ${r.n}: ${usd(r.avgLoss)} contra ${usd(b.avgLoss)} antes. ` +
        `En el mismo período la expectativa pasó de ${usd(b.expectancy)} a ${usd(r.expectancy)} por operación.`);
    } else if (b.avgLoss > 0 && r.avgLoss / b.avgLoss > 1.3) {
      A('bad', 'Se te está agrandando la pérdida promedio',
        `Últimas ${r.n}: ${usd(r.avgLoss)} contra ${usd(b.avgLoss)} antes. El stop se está corriendo.`);
    }
    if (r.durLoss > 0 && r.durWin > 0 && r.durLoss / r.durWin > 1.3) {
      A('warn', 'Volviste a aguantar las perdedoras',
        `En las últimas ${r.n} tus perdedoras duran ${(r.durLoss / r.durWin).toFixed(1)}x más que las ganadoras.`);
    }
    if (b.notional > 0 && r.notional / b.notional > 1.4) {
      A('warn', 'Subiste el tamaño',
        `Notional promedio ${usd(r.notional)} contra ${usd(b.notional)} antes: +${(((r.notional / b.notional) - 1) * 100).toFixed(0)}%. ` +
        `Tu pérdida promedio actual es ${usd(r.avgLoss)} y escala en la misma proporción.`);
    }
  }

  // Sobreoperación del día en curso
  const hoy = T.filter(t => diaBA(t.entryTime) === diaBA(now));
  if (hoy.length) {
    const neto = hoy.reduce((a, t) => a + t.net, 0);
    /* La coletilla sobre días cargados sale de `adherenciaDiaria` y solo si el patrón
       aguantó las dos mitades. Antes salía del PnL promedio de un corte por mediana, que
       es el corte que esa misma función tiene documentado como inservible. */
    const dd = s.dias;
    const cola = dd && dd.corte && dd.estable && dd.adhCargados < dd.adhTranquilos
      ? ` En tus días de ${dd.desdeN} operaciones o más sostenés el ${(dd.adhCargados * 100).toFixed(0)}% de las ` +
        `conductas medidas, contra el ${(dd.adhTranquilos * 100).toFixed(0)}% en los tranquilos.`
      : '';
    A(hoy.length > s.medianTradesDay * 2 ? 'warn' : 'info', `Hoy llevás ${hoy.length} ${hoy.length === 1 ? 'operación' : 'operaciones'}`,
      `${usd(neto)} en el día. Tu mediana diaria es ${s.medianTradesDay}.` + cola);
  }

  // Última operación fuera de rango
  if (last && last.net < 0 && s.avgLoss > 0 && Math.abs(last.net) > s.avgLoss * 2) {
    A('warn', 'Tu última pérdida fue el doble de lo normal',
      `${usd(last.net)} en ${last.symbol} contra una pérdida promedio de ${usd(s.avgLoss)}: ` +
      `${(Math.abs(last.net) / s.avgLoss).toFixed(1)}x.`);
  }

  // Reglas derivadas de sus propios datos
  const syms = Object.entries(s.bySymbol).sort((a, b) => b[1].net - a[1].net);
  const sess = Object.entries(s.bySession).filter(([, v]) => v.n >= 3).sort((a, b) => b[1].net - a[1].net);
  if (syms.length) out.rules.push(`Instrumento: ${syms[0][0]} suma ${usd(syms[0][1].net)} en ${syms[0][1].n} operaciones.` +
    (syms.length > 1 && syms[syms.length - 1][1].net < 0 ? ` ${syms[syms.length - 1][0]} resta ${usd(syms[syms.length - 1][1].net)}.` : ''));
  if (sess.length) out.rules.push(`Franja: mejor en ${SESSIONS[sess[0][0]].label} (${SESSIONS[sess[0][0]].art}), ${usd(sess[0][1].net)}.` +
    (sess[sess.length - 1][1].net < 0 ? ` Peor en ${SESSIONS[sess[sess.length - 1][0]].label}, ${usd(sess[sess.length - 1][1].net)}.` : ''));
  const L = s.bySide.long, S2 = s.bySide.short;
  if (L.n >= 3 && S2.n >= 3) out.rules.push(`Lado: longs ${usd(L.net)} en ${L.n}, shorts ${usd(S2.net)} en ${S2.n}.`);
  /* Con techo declarado la regla es el techo y el promedio pasa a ser el contraste, que
     es exactamente el aviso de deriva: los dos números al lado, sin tocar el declarado. */
  const bR = s.banda;
  if (bR && bR.base === 'declarada')
    out.rules.push(`Pérdida: declaraste un techo de ${usd(bR.declarada)} por operación` +
      (bR.observada ? `; tu promedio de las últimas ${bR.nObs} es ${usd(bR.observada)}` +
        (bR.deriva > 1 ? `, o sea ${bR.deriva.toFixed(1)}× lo que dijiste.` : '.') : '.'));
  else
    out.rules.push(`Pérdida: tu promedio reciente es ${usd(ad ? ad.rec.avgLoss : s.avgLoss)}; la peor de esa serie, ${usd(ad ? ad.rec.worstLoss : 0)}.`);
  const durs = Object.entries(s.byDur).filter(([, v]) => v.n >= 3).sort((a, b) => (b[1].net / b[1].n) - (a[1].net / a[1].n));
  if (durs.length) out.rules.push(`Horizonte: tu mejor tramo es ${durs[0][0]} (${usd(durs[0][1].net / durs[0][1].n)} por operación).`);

  const order = { bad: 0, warn: 1, good: 2, info: 3 };
  out.alerts.sort((a, b) => order[a.level] - order[b.level]);
  return out;
}

/* ===== Muestra mínima =====
   Con menos de cinco operaciones cerradas la mitad de la app se apaga sola —hábitos,
   rachas, mitades, presupuesto— y ninguna dice por qué. El usuario nuevo ve una pantalla
   a medio llenar y no sabe si es él, si son los datos o si está rota.

   Esto describe la maquinaria, no le pide nada. No cuenta cuánto falta ni propone operar
   más: dice qué se calcula con qué, y recuerda que lo único que sirve desde la primera
   operación —tamaño y holgura al stop— no necesita historial. */
const MUESTRA_MIN = 5;
const PIEZAS = [
  { id: 'habitos',     nombre: 'Hábitos',     desde: 3,  que: 'las cuatro conductas y sus rachas' },
  { id: 'presupuesto', nombre: 'Presupuesto', desde: 8,  que: 'la banda de pérdida y el tamaño que habilita' },
  { id: 'rachas',      nombre: 'Rachas',      desde: 10, que: 'qué tan normal es una mala racha con tu tasa de acierto' },
  { id: 'mitades',     nombre: 'Mitades',     desde: 10, que: 'si cambiaste vos o cambió la época' },
  { id: 'adherencia',  nombre: 'Adherencia',  desde: 24, que: 'las últimas 20 contra todo lo anterior' },
  { id: 'estadistica', nombre: 'Estadística', desde: 30, que: 'acierto, expectativa y horarios como algo distinto de la suerte' }
];
function muestra(all) {
  const n = (all || []).filter(t => !t.open).length;
  if (n >= MUESTRA_MIN) return null;
  const titulo = n === 0 ? 'Todavía no hay nada que medir'
    : n === 1 ? '1 operación cerrada'
    : `${n} operaciones cerradas`;
  const texto = n === 0
    ? 'No hay operaciones cerradas en este período. Casi todo lo que muestra la app se ' +
      'calcula sobre lo que hiciste, así que por ahora está apagado casi entero.'
    : 'Con esta cantidad, cualquier número de acá abajo —acierto, expectativa, mejor ' +
      'horario— se da vuelta entero con la próxima operación. Los paneles que faltan ' +
      'están apagados por eso, no porque algo esté roto.';
  return {
    n, titulo, texto,
    pie: 'Lo que sí sirve desde la primera y no necesita historial: el tamaño de la ' +
      'posición y la distancia a tu stop contra la distancia a la liquidación.',
    piezas: PIEZAS.map(p => ({ id: p.id, nombre: p.nombre, desde: p.desde, que: p.que, listo: n >= p.desde }))
  };
}

/* ===== Motor de insights =====
   Cada tarjeta viene rotulada con `clase`, y no es cosmética: separa lo que hiciste de
   cómo salió.

     accion    — depende de vos y se repite: cuánto arriesgás, cuánto aguantás una
                 perdedora, si cerrás vos o el exchange, cuánto pagás por entrar.
     resultado — el PnL cortado de distintas maneras. Describe lo que pasó, y con una
                 muestra chica describe sobre todo el azar de esa muestra.
     aviso     — el tamaño de la muestra, que enmarca todo lo demás.

   La regla que abre este proyecto es que se miden acciones, no resultados. Los cortes de
   PnL no se borran —un símbolo que resta plata es un hecho y el usuario tiene derecho a
   verlo— pero dejan de estar mezclados con las conductas como si fueran lo mismo. Poner
   "tu horizonte rentable" al lado de "aguantás las perdedoras" hacía que las dos cosas
   pesaran igual, y no pesan igual: una la elegís cada vez, la otra es una lectura de
   treinta muestras que la próxima racha puede dar vuelta. */
function buildInsights(s) {
  const out = [];
  if (!s.n) return out;
  const usd = x => (x < 0 ? '-' : '') + 'US$' + Math.abs(x).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const dur = ms => {
    if (!isFinite(ms) || ms <= 0) return '0 min';
    const m = ms / 6e4;
    if (m < 60) return m.toFixed(0) + ' min';
    if (m < 1440) return (m / 60).toFixed(1) + ' h';
    return (m / 1440).toFixed(1) + ' días';
  };
  const add = (level, title, text) => out.push({ level, title, text, clase: 'resultado' });
  const addA = (level, title, text) => out.push({ level, title, text, clase: 'accion' });
  const racha = n => `${n} pérdida${n === 1 ? '' : 's'} consecutiva${n === 1 ? '' : 's'}`;

  if (s.n < 30) {
    out.push({ clase: 'aviso', level: 'info', title: 'Muestra chica', text:
      `${s.n} trades cerrados. Debajo de ~30 operaciones casi nada de lo que sigue es estadísticamente ` +
      `distinguible de la suerte. Tomalo como hipótesis a verificar, no como diagnóstico.` });
  }

  // 0. Liquidaciones — lo más caro y lo único totalmente evitable
  if (s.liq.n) {
    const det = s.liq.trades.map(t => `${t.symbol} ${new Date(t.entryTime).toLocaleDateString('es-AR')} (${usd(t.net)})`).join(', ');
    const hg = s.holgura;
    /* La frase "en todas la distancia al stop era mayor" era una afirmación sin dato:
       el historial no guarda el stop. Ahora se dice solo sobre las que se observaron,
       con el conteo al lado, y si no se observó ninguna no se dice nada. */
    const obs = hg && hg.nLiq
      ? ` De esas, ${hg.nLiq} ${hg.nLiq > 1 ? 'las vio' : 'la vio'} la app abierta${
          hg.nLiqAvisadas ? `, y en ${hg.nLiqAvisadas} el stop estaba más lejos que la liquidación o directamente no había stop.` : '.'}`
      : '';
    addA('bad', `${s.liq.n} ${s.liq.n > 1 ? 'liquidaciones' : 'liquidación'}: ${usd(s.liq.net)}`,
      `${det}. En todas el cierre lo ejecutó el exchange a mercado, no vos. ` +
      `Neto con ellas: ${usd(s.net)}. Sin ellas: ${usd(s.net - s.liq.net)}.` + obs);
  }

  // 0aa. El día como unidad: solo si el patrón aguanta las dos mitades del historial
  {
    const dd = s.dias;
    if (dd && dd.corte && dd.estable) {
      const p = x => (x * 100).toFixed(0) + '%';
      const peor = dd.adhCargados < dd.adhTranquilos;
      addA(peor ? 'warn' : 'good',
        peor ? 'Los días cargados te desarman el sistema' : 'La actividad no te desarma el sistema',
        `En tus ${dd.nCargados} días de ${dd.desdeN} operaciones o más sostuviste el ${p(dd.adhCargados)} de las ` +
        `conductas medidas, y en los ${dd.nTranquilos} de ${dd.hastaN} o menos, el ${p(dd.adhTranquilos)}. ` +
        `Se repite igual en la primera y en la segunda mitad de tu historial, así que describe tu método y no una época. ` +
        `Es una lectura de lo que ya pasó: la app no sabe si hoy va a ser un día difícil.`);
    }
  }

  // 0a. Holgura — la única variable de riesgo que se elige en cada operación
  {
    const hg = s.holgura;
    if (hg && hg.conStop >= 5) {
      const manda = hg.invertidas + hg.sinStop;
      const cob = ` Medido sobre ${hg.n} de tus ${hg.total} operaciones: las que la app llegó a ver abiertas.`;
      if (manda > 0) {
        addA('bad', `En ${manda} de ${hg.n} el que decidía la salida era el exchange`,
          `${hg.sinStop ? `${hg.sinStop} sin stop cargado` : ''}${hg.sinStop && hg.invertidas ? ' y ' : ''}` +
          `${hg.invertidas ? `${hg.invertidas} con el stop más lejos que la liquidación` : ''}. ` +
          `Tu stop mediano queda al ${(hg.mediana * 100).toFixed(0)}% del camino a la liquidación.` + cob);
      } else {
        addA('good', `Siempre saliste vos, no el exchange`,
          `En las ${hg.conStop} observadas el stop estaba antes que la liquidación, mediana al ` +
          `${(hg.mediana * 100).toFixed(0)}% del camino.` + cob);
      }
      if (hg.deriva && hg.deriva.base > 0 && hg.deriva.rec / hg.deriva.base > 1.2) {
        addA('warn', 'Se te está corriendo la holgura',
          `Últimas ${hg.deriva.nRec} observadas: el stop quedó al ${(hg.deriva.rec * 100).toFixed(0)}% del camino ` +
          `a la liquidación, contra ${(hg.deriva.base * 100).toFixed(0)}% en las ${hg.deriva.nBase} anteriores. ` +
          `Es la misma pérdida con menos lugar para equivocarse.`);
      }
    } else if (hg && hg.total >= 10) {
      out.push({ clase: 'aviso', level: 'info', title: 'Holgura: sin datos suficientes', text:
        `La distancia entre tu stop y la liquidación no se puede reconstruir del historial — la API no ` +
        `devuelve ni el stop cargado ni el apalancamiento de cada momento. Se anota en vivo, cuando tenés ` +
        `la app abierta con la posición andando. Llevás ${hg.n} de ${hg.total} anotadas.` });
    }
  }

  // 0b. Sesiones
  const ses = Object.entries(s.bySession).filter(([, v]) => v.n >= 3).sort((a, b) => b[1].net - a[1].net);
  if (ses.length >= 2) {
    const [bk, bv] = ses[0], [wk, wv] = ses[ses.length - 1];
    if (bv.net > 0 && wv.net < 0) {
      add('info', 'Tenés una franja horaria que funciona y otra que no',
        `${SESSIONS[bk].label} (${SESSIONS[bk].art} de Buenos Aires): ${usd(bv.net)} en ${bv.n} operaciones. ` +
        `${SESSIONS[wk].label} (${SESSIONS[wk].art}): ${usd(wv.net)} en ${wv.n}. ` +
        `Por operación: ${usd(bv.net / bv.n)} contra ${usd(wv.net / wv.n)}.`);
    }
  }

  // 1. Costos
  const costos = s.fees - Math.min(s.funding, 0);
  const bruto = Math.max(s.gross, 0);
  if (bruto > 0 && costos / bruto > 0.15) {
    addA('bad', 'Los costos se están comiendo el resultado',
      `Pagaste ${usd(s.fees)} de fees${s.funding < 0 ? ` y ${usd(-s.funding)} de funding` : ''}, ` +
      `contra ${usd(s.gross)} de PnL bruto: ${((costos / bruto) * 100).toFixed(1)}% de lo que ganaste operando ` +
      `se fue en costos. Con ${s.n} trades y ${usd(s.volume)} de volumen, cada operación de más te cuesta ` +
      `${usd(s.fees / s.n)} promedio antes de tener razón.`);
  }

  // 2. Efecto disposición
  if (s.avgDurWin > 0 && s.avgDurLoss / s.avgDurWin > 1.3) {
    addA('bad', 'Efecto disposición: cortás las ganadoras y aguantás las perdedoras',
      `Tus perdedoras duran ${dur(s.avgDurLoss)} en promedio y tus ganadoras ${dur(s.avgDurWin)} — ` +
      `${(s.avgDurLoss / s.avgDurWin).toFixed(1)}x más tiempo aguantando lo que no funciona. ` +
      `Es el patrón mejor documentado en trading minorista. En tu muestra, cada perdedora estuvo ` +
      `abierta ${dur(s.avgDurLoss - s.avgDurWin)} más que una ganadora promedio.`);
  } else if (s.avgDurLoss > 0 && s.avgDurWin / s.avgDurLoss > 1.3) {
    addA('good', 'Dejás correr las ganadoras',
      `Ganadoras ${dur(s.avgDurWin)} vs perdedoras ${dur(s.avgDurLoss)}. Estás sosteniendo lo que funciona ` +
      `y soltando rápido lo que no — la relación correcta, y la menos común.`);
  }

  // 3. Win rate vs payoff
  if (s.winRate > 0.5 && s.payoff < 1) {
    add('bad', 'Acertás seguido y perdés plata igual',
      `Ganás el ${(s.winRate * 100).toFixed(0)}% de las veces, pero tu pérdida promedio (${usd(s.avgLoss)}) ` +
      `es ${(1 / s.payoff).toFixed(1)}x tu ganancia promedio (${usd(s.avgWin)}). ${s.wins.length} aciertos ` +
      `suman ${usd(s.sumWins)} y ${s.losses.length} errores restan ${usd(-s.sumLosses)}.`);
  } else if (s.winRate < 0.45 && s.payoff > 1.8) {
    add('good', 'Perfil de asimetría',
      `Acertás solo el ${(s.winRate * 100).toFixed(0)}% pero cobrás ${s.payoff.toFixed(1)}x más en cada acierto. ` +
      `Ese perfil requiere atravesar rachas largas sin cambiar el método: la tuya llegó a ${s.maxLossStreak} pérdidas seguidas.`);
  }

  // 4. Profit factor / expectativa
  add(s.expectancy >= 0 ? 'good' : 'bad', 'Expectativa por trade',
    `${usd(s.expectancy)} por operación, profit factor ${isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞'}. ` +
    (s.expectancy >= 0
      ? `Sobre ${s.n} operaciones, el conjunto suma ${usd(s.net)}.`
      : `Valor esperado negativo: a más operaciones, más pérdida acumulada. Sobre ${s.n} operaciones, ${usd(s.net)}.`));

  // 5. Revenge trading
  if (s.revenge.n >= 3) {
    const dif = s.revenge.net / s.revenge.n - s.expectancy;
    /* Esta tarjeta no acusa. Sus propios datos ya desmintieron la hipótesis de la reentrada
       caliente —rendían mejor que el resto y aguantaban el split-half—, así que el nivel
       sale del número y no de la creencia. Por lo mismo la calma quedó sin medir en `aire`. */
    addA(dif < 0 ? 'warn' : 'info', 'Trades abiertos en caliente',
      `${s.revenge.n} operaciones (${((s.revenge.n / s.n) * 100).toFixed(0)}% del total) las abriste dentro de ` +
      `los 30 minutos de cerrar una perdedora. Resultado: ${usd(s.revenge.net)}, o sea ${usd(s.revenge.net / s.revenge.n)} ` +
      `por operación, contra ${usd(s.expectancy)} de tu promedio general` +
      (dif < 0 ? `. Diferencia: ${usd(dif)} por operación.` : `.`));
  }

  /* 6. Estabilidad: qué hacés después de perder contra qué hacés después de ganar.
     Es la conducta que el modo aire mide para encenderse, dicha acá sin esperar a que se
     encienda: `aire` pide n≥30 y expectativa positiva, y esta conducta importa mucho antes
     de eso. Habla en las dos direcciones —lo bueno también es un hallazgo— y se calla
     cuando no puede juzgar, que es lo que hace la escala cuantizada. */
  {
    const e = s.estabilidad;
    const pct = r => (r > 1 ? '+' : '') + ((r - 1) * 100).toFixed(0) + '%';
    const uni = e && e.base === 'exposicion' ? 'la exposición' : 'el tamaño';
    if (e && e.cuantizado) {
      out.push({ clase: 'aviso', level: 'info', title: 'El tamaño no se puede comparar', text:
        `El ${(e.concentracion * 100).toFixed(0)}% de tus entradas tiene el mismo tamaño. Con esa concentración, ` +
        `comparar lo que entrás después de perder contra después de ganar daría 1,0 por el mínimo de orden del ` +
        `exchange y no por indiferencia tuya, así que no se compara. La espera sí se mide.` });
    }
    if (e && e.inestable.length) {
      const d = [];
      if (e.rTam != null && e.inestable.includes('tamaño'))
        d.push(`${uni} te cambia ${pct(e.rTam)} después de perder`);
      if (e.rEsp != null && e.inestable.includes('espera'))
        d.push(`la espera antes de volver a entrar te cambia ${pct(e.rEsp)}`);
      addA('warn', 'El resultado anterior te cambia lo que hacés después',
        `${d.join(' y ')}, medido sobre ${e.nP} operaciones que siguieron a una pérdida y ${e.nG} que siguieron ` +
        `a una ganancia. Son medianas, así que no lo decide una operación suelta. ` +
        `Es la conducta que el modo aire mide para encenderse.`);
    } else if (e && e.juzgable) {
      const d = [];
      if (e.rTam != null) d.push(`${uni}, ${pct(e.rTam)}`);
      if (e.rEsp != null) d.push(`la espera, ${pct(e.rEsp)}`);
      addA('good', 'El resultado anterior no te mueve',
        `Comparando lo que hacés después de perder contra después de ganar: ${d.join('; ')}. ` +
        `Sobre ${e.nP} y ${e.nG} operaciones de cada lado. Eso es indiferencia al resultado medida, no declarada.`);
    }
  }

  // 7. Concentración del resultado
  if (s.net > 0 && s.netExBest < 0) {
    add('bad', 'Todo el resultado es un solo trade',
      `Neto ${usd(s.net)}. Sin ${s.best.symbol} (${usd(s.best.net)}): ${usd(s.netExBest)}. ` +
      `El resultado de ${s.n} operaciones depende de una.`);
  } else if (s.net > 0 && s.netExTop3 < 0) {
    add('warn', 'El resultado vive en tres trades',
      `Sin tus 3 mejores operaciones el neto es ${usd(s.netExTop3)}. Las otras ${s.n - 3} en conjunto restan.`);
  }

  // 8. Long vs short
  const L = s.bySide.long, S = s.bySide.short;
  if (L.n >= 5 && S.n >= 5 && sgn(L.net) !== sgn(S.net)) {
    const mal = L.net < S.net ? 'long' : 'short';
    const malN = Math.min(L.net, S.net), bienN = Math.max(L.net, S.net);
    add('info', `Los dos lados dan resultados opuestos`,
      `Longs: ${usd(L.net)} en ${L.n} operaciones. Shorts: ${usd(S.net)} en ${S.n}. ` +
      `Solo el lado positivo suma ${usd(bienN)} contra ${usd(s.net)} del total; el lado ${mal} resta ${usd(malN)}.`);
  }

  // 9. Símbolo que arrastra
  const syms = Object.entries(s.bySymbol).sort((a, b) => a[1].net - b[1].net);
  if (syms.length > 2) {
    const [peorSym, peor] = syms[0];
    if (peor.net < 0 && Math.abs(peor.net) > Math.abs(s.net) * 0.3 && peor.n >= 3) {
      add('warn', `${peorSym}: ${usd(peor.net)} en ${peor.n} operaciones`,
        `${usd(peor.net)} en ${peor.n} operaciones (${((peor.wins / peor.n) * 100).toFixed(0)}% de acierto). ` +
        `Sin ese símbolo tu neto sería ${usd(s.net - peor.net)}.`);
    }
    const [mejorSym, mejor] = syms[syms.length - 1];
    if (mejor.net > 0 && mejor.n >= 3) {
      add('good', `${mejorSym}: ${usd(mejor.net)} en ${mejor.n} operaciones`,
        `${((mejor.wins / mejor.n) * 100).toFixed(0)}% de acierto, ${usd(mejor.net / mejor.n)} por operación ` +
        `contra ${usd(s.expectancy)} de tu promedio general.`);
    }
  }

  /* 10. Acá vivía "Los días de mucha actividad te rinden peor", con el corte en la mediana
     diaria y sobre PnL. La tarjeta 0aa de más arriba contesta la misma pregunta con
     terciles, sobre conducta, y solo si el patrón se repite en las dos mitades del
     historial. Tener las dos era publicar dos veredictos con distinto rigor sobre el mismo
     tema, y el flojo hablaba más seguido porque pedía menos. */

  // 11. Duración óptima
  const durs = Object.entries(s.byDur).filter(([, v]) => v.n >= 5);
  if (durs.length >= 2) {
    const best = durs.reduce((a, b) => (b[1].net / b[1].n > a[1].net / a[1].n ? b : a));
    const worst = durs.reduce((a, b) => (b[1].net / b[1].n < a[1].net / a[1].n ? b : a));
    if (best[0] !== worst[0]) {
      add('info', 'Tu horizonte rentable',
        `Mejor tramo: ${best[0]} (${usd(best[1].net / best[1].n)} por trade, ${best[1].n} operaciones). ` +
        `Peor: ${worst[0]} (${usd(worst[1].net / worst[1].n)}, ${worst[1].n}). ` +
        `Diferencia por operación: ${usd(best[1].net / best[1].n - worst[1].net / worst[1].n)}.`);
    }
  }

  // 12. Drawdown
  if (s.maxDD > 0) {
    add('info', 'Peor racha',
      `Drawdown máximo de ${usd(s.maxDD)} sobre el PnL acumulado, y ${racha(s.maxLossStreak)}. ` +
      (s.net > 0 ? `Contra una ganancia total de ${usd(s.net)}: ratio ${(s.maxDD / s.net).toFixed(1)}x.` : ``));
  }

  /* El aviso de muestra primero porque enmarca todo, después las acciones, y al final
     los cortes de PnL. Dentro de cada bloque, lo peor arriba. */
  const order = { bad: 0, warn: 1, good: 2, info: 3 };
  const cls = { aviso: 0, accion: 1, resultado: 2 };
  return out.sort((a, b) => (cls[a.clase] - cls[b.clase]) || (order[a.level] - order[b.level]));
}

if (typeof module !== 'undefined') {
  module.exports = { buildTrades, attachFunding, computeStats, buildInsights, parseCoin,
    sessionOf, tramoDe, TRAMOS, buildDayPlan, analyzePositions, todayBySession, comparativas, taladro, habitos, mitades, serieCuenta, serieTotal, diagSeries, diagEscala, diagGaps, gapEn, probRacha, rachasEsperadas, presupuesto, tilt, aire, AIRE_VENT, AIRE_MIN, explica, repertorio, relojSesion, ventanaEvento, muestra, MUESTRA_MIN, FOMC, FOMC_AVISO_DIAS, calendarioVence, SESSIONS,
    diaBA, relojBA, registrarHolgura, holguraHist,
    equityEn, seriesPorDex, anotarExposicion, escalaTamano, estabilidad, EST_MIN_LADO, EST_TOL, EST_CONC_MAX,
    adherenciaDiaria, TILT_HUECO_MIN, ejercicio, verdades, EJ_N,
    marcarDeclaradas, edgeDeclarado, bandaRiesgo, BANDA_TOL,
    pPermutacion, benjaminiHochberg, rng32, semillaDe, PERM_B, BH_Q,
    caducarDeclaraciones, declaracionesSerie, DECL_VIGENCIA, DECL_MUESTRA,
    adherenciaSesion, celdasHorarias, celdaDe, ADH_CELDA_MIN,
    marcarChequeos, anotarMovio, errorPronostico, diagOrden, huecosSinPosicion,
    huecoAbierto, momento, cintaDelDia,
    CHEQ_VIGENCIA, CHEQ_MUESTRA, CHEQ_NIVELES };
}
