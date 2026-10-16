/* Motor del modo Merval — sin DOM, igual que engine.js.
   Acompaña la ejecución de un plan, no el seguimiento de una cartera.

   La unidad es el TRAMO: una compra prevista con ticker, monto, ventana y tipo de orden
   declarado antes de mandarla. Un plan de 5 posiciones escalonado en 3 son 15 unidades,
   y el N se conoce de antemano en vez de depender de que aguante un hábito.

   Tres cosas que este motor no hace, y no por olvido:
   - no mira el mercado, salvo para una sola pregunta: si un cierre cruzó un nivel que
     declaró el usuario (ver Reglas de nivel, decisión del 7/10/2026)
   - no calcula PnL, ni neto, ni retorno
   - no opina sobre el contenido del plan

   Ver docs/merval.md. */

'use strict';

/* ===== Día de Buenos Aires =====
   Invariante 4 de CLAUDE.md: un día es un día de Buenos Aires, siempre.
   Está duplicado de engine.js a propósito —este motor no lo importa— y por eso
   merval-test.js tiene un test que compara las dos implementaciones contra el mismo
   timestamp. Si alguien toca una sola, el test lo caza. */
const BA_OFF = 3 * 36e5;
function diaBA(ts) { return new Date(ts - BA_OFF).toISOString().slice(0, 10); }
const DIA = 864e5;
function diasEntre(a, b) { return Math.round((b - a) / DIA); }

/* ===== Umbrales, y de dónde salió cada uno =====
   `descartes.md`: un umbral que la app se inventa muere. Los dos que hay acá tienen
   origen, y los estados que podrían haber llevado umbral (alerta, apretado) no llevan
   ninguno: se disparan con la ventana que declaró el usuario. */

/* El monto ejecutado no coincide nunca con el declarado porque se compran nominales
   enteros: 100.000 pesos de una especie a 1.847 dan 54 nominales y 99.738 pesos.
   No es tolerancia a la desprolijidad, es que la igualdad exacta es imposible. */
const TOL_MONTO = 0.10;

/* Mismo piso que `MUESTRA_MIN` en engine.js. Debajo de esto el motor devuelve los
   conteos pero no deja que nadie los llame hallazgo. */
const MUESTRA_MIN = 5;

/* ===== El estado de un tramo: cuatro valores, no dos =====
   'como' y 'distinto' son las dos formas de haber ejecutado. 'noEjecutado' no es un
   hueco de datos: es la conducta, y es la única forma observable de sub-operar —
   justo lo que docs/hipotesis.md dice que el modo perps está tirando a la basura
   cuando purga las declaraciones a las 4 horas. Acá nace visible.
   'pendiente' es el tramo todavía vivo: no se juzga, sale del denominador. */
function estadoTramo(tr, now) {
  if (!tr || !tr.ticker || !(tr.monto > 0)) return { estado: 'sinDato', cambios: [], motivo: 'tramo incompleto' };

  const e = tr.ejec;
  if (!e) {
    if (tr.hasta == null) return { estado: 'sinDato', cambios: [], motivo: 'sin ventana declarada' };
    if (now <= tr.hasta) return { estado: 'pendiente', cambios: [], motivo: null };
    return { estado: 'noEjecutado', cambios: [], motivo: 'venció la ventana' };
  }

  /* Una orden límite que no se llenó es no-ejecución, pero de otra clase: el usuario
     hizo lo que dijo y el mercado no vino. Se separa para no confundir la técnica
     con la voluntad. */
  if (e.lleno === false) return { estado: 'noEjecutado', cambios: [], motivo: 'la orden no se llenó' };

  const cambios = [];
  if (e.ticker && e.ticker !== tr.ticker) cambios.push({ campo: 'ticker', de: tr.ticker, a: e.ticker });
  if (e.tipo && tr.tipo && e.tipo !== tr.tipo) cambios.push({ campo: 'tipo', de: tr.tipo, a: e.tipo });
  if (e.monto > 0 && Math.abs(e.monto - tr.monto) / tr.monto > TOL_MONTO) {
    cambios.push({ campo: 'monto', de: tr.monto, a: e.monto });
  }
  if (e.ts != null && tr.hasta != null && e.ts > tr.hasta) {
    cambios.push({ campo: 'ventana', de: tr.hasta, a: e.ts });
  }
  return { estado: cambios.length ? 'distinto' : 'como', cambios, motivo: null };
}

/* Anota el estado en cada tramo una sola vez. Todo lo demás lee `tr._e`. */
function anotarEstados(plan, now) {
  const T = (plan && plan.tramos) || [];
  T.forEach(tr => { tr._e = estadoTramo(tr, now); });
  return T;
}

/* ===== Señal 1: desvío de contenido =====
   Compró algo que no estaba en el plan. Booleano, sin interpretación. */
function desvioContenido(plan, now) {
  const T = anotarEstados(plan, now);
  const objetivo = new Set((plan.objetivo || []).map(o => o.ticker));
  const ejec = T.filter(tr => tr._e.estado === 'como' || tr._e.estado === 'distinto');
  const fuera = ejec.filter(tr => {
    const tk = (tr.ejec && tr.ejec.ticker) || tr.ticker;
    return !objetivo.has(tk);
  });
  return {
    n: ejec.length,
    fuera: fuera.map(tr => ({ ticker: (tr.ejec && tr.ejec.ticker) || tr.ticker, monto: tr.ejec.monto, ts: tr.ejec.ts })),
    pct: ejec.length ? fuera.length / ejec.length : null,
    /* Sin objetivo declarado no hay contra qué comparar. No es cero: es sin dato. */
    hay: objetivo.size > 0
  };
}

/* ===== Señal 2: desvío de ritmo =====
   El plan decía tres tramos en seis semanas y entraste todo el primer día. Es la falla
   más común armando una cartera y no requiere inferir nada: se comparan dos calendarios.

   `concentracion` es días distintos usados sobre tramos ejecutados. Vale 1 cuando cada
   tramo cayó en su propio día y tiende a 0 cuando se amontonaron. */
const RITMO_MIN = 3;
function desvioRitmo(plan, now) {
  const T = anotarEstados(plan, now);
  const ejec = T.filter(tr => (tr._e.estado === 'como' || tr._e.estado === 'distinto') && tr.ejec && tr.ejec.ts != null);
  if (ejec.length < RITMO_MIN) {
    return { n: ejec.length, suficiente: false, concentracion: null, spanPlan: null, spanReal: null, razon: null };
  }
  const dias = new Set(ejec.map(tr => diaBA(tr.ejec.ts)));
  const concentracion = dias.size / ejec.length;

  const desdes = T.map(tr => tr.desde).filter(x => x != null);
  const hastas = T.map(tr => tr.hasta).filter(x => x != null);
  const spanPlan = (desdes.length && hastas.length) ? diasEntre(Math.min(...desdes), Math.max(...hastas)) : null;
  const tss = ejec.map(tr => tr.ejec.ts);
  const spanReal = diasEntre(Math.min(...tss), Math.max(...tss));

  /* La razón es lo que se lee: menor a 1 es haber comprimido el plan, mayor es haberlo
     estirado. Los dos son desvío, y el motor no dice cuál es peor. */
  const razon = (spanPlan > 0) ? spanReal / spanPlan : null;
  return { n: ejec.length, suficiente: true, dias: dias.size, concentracion, spanPlan, spanReal, razon };
}

/* ===== Señal 3: reescrituras del objetivo =====
   Editar el plan es un evento con fecha. No se juzga —cambiar de idea en frío es
   legítimo y encima es la salida válida del estado 'apretado'— se cuenta y se fecha.

   Lo que NO se puede hacer todavía: ligar la edición a un movimiento de mercado en las
   48 h previas, que es lo que la volvería una señal de conducta y no un registro. Eso
   necesita una serie externa y hoy no está. Se declara sin dato en vez de aproximarse
   con otra cosa. El campo se llama `vinculoExterno` y no lo que describe, porque el
   test 11 corta el build si aparece un identificador de mercado en este archivo y esa
   red no lleva lista de excepciones: en cuanto una regla de seguridad admite la
   primera, deja de ser una regla. */
function reescrituras(plan, now) {
  const eds = (plan && plan.ediciones) || [];
  const T = anotarEstados(plan, now);
  const primerEjec = T.filter(tr => tr.ejec && tr.ejec.ts != null).map(tr => tr.ejec.ts).sort((a, b) => a - b)[0];

  /* Una edición antes de la primera compra es planificar. Después de haber empezado a
     ejecutar es otra cosa, y esa es la que se cuenta aparte. */
  const enVuelo = primerEjec == null ? [] : eds.filter(e => e.ts > primerEjec);
  return {
    total: eds.length,
    enVuelo: enVuelo.length,
    detalle: enVuelo.map(e => ({ ts: e.ts, dia: diaBA(e.ts), campo: e.campo, ticker: e.ticker || null, de: e.antes, a: e.despues })),
    /* Queda explícitamente sin medir. Ver el comentario de arriba. */
    vinculoExterno: null
  };
}

/* ===== Señal 4: contradicción interna del plan =====
   La app no opina sobre el plan. Señala cuando el plan choca con una regla que escribió
   el mismo usuario. Cada regla ausente devuelve `sinDato`, nunca 'cumple'. */
function contradicciones(plan) {
  const obj = (plan && plan.objetivo) || [];
  const R = (plan && plan.reglas) || {};
  const out = [];

  const total = obj.reduce((a, o) => a + (o.peso || 0), 0);

  if (R.maxPos == null) out.push({ id: 'maxPos', estado: 'sinDato', txt: 'no declaraste un máximo por posición' });
  else {
    const rotas = obj.filter(o => o.peso > R.maxPos);
    out.push(rotas.length
      ? { id: 'maxPos', estado: 'choca', txt: `tu plan tiene ${rotas.length} posición(es) sobre el ${R.maxPos}% que fijaste`, detalle: rotas.map(o => ({ ticker: o.ticker, peso: o.peso })) }
      : { id: 'maxPos', estado: 'ok', txt: `ninguna posición del plan pasa tu ${R.maxPos}%` });
  }

  if (R.maxSector == null) out.push({ id: 'maxSector', estado: 'sinDato', txt: 'no declaraste un máximo por sector' });
  else if (obj.some(o => !o.sector)) out.push({ id: 'maxSector', estado: 'sinDato', txt: 'hay posiciones sin sector, así que no se puede sumar' });
  else {
    const porSec = {};
    obj.forEach(o => { porSec[o.sector] = (porSec[o.sector] || 0) + (o.peso || 0); });
    const rotas = Object.keys(porSec).filter(s => porSec[s] > R.maxSector);
    out.push(rotas.length
      ? { id: 'maxSector', estado: 'choca', txt: `${rotas.join(', ')} pasa(n) el ${R.maxSector}% por sector que fijaste`, detalle: rotas.map(s => ({ sector: s, peso: porSec[s] })) }
      : { id: 'maxSector', estado: 'ok', txt: `ningún sector pasa tu ${R.maxSector}%` });
  }

  if (R.minPosiciones == null) out.push({ id: 'minPos', estado: 'sinDato', txt: 'no declaraste un mínimo de posiciones' });
  else out.push(obj.length < R.minPosiciones
    ? { id: 'minPos', estado: 'choca', txt: `el plan tiene ${obj.length} posiciones y pediste al menos ${R.minPosiciones}` }
    : { id: 'minPos', estado: 'ok', txt: `${obj.length} posiciones, sobre el mínimo de ${R.minPosiciones}` });

  /* Que los pesos no sumen 100 no es una regla suya: es que el plan está incompleto.
     Se dice como falta de dato, no como incumplimiento. */
  const suma = Math.abs(total - 100) < 0.5
    ? { id: 'suma', estado: 'ok', txt: 'los pesos del plan suman 100%' }
    : { id: 'suma', estado: 'sinDato', txt: `los pesos suman ${total.toFixed(1)}%, así que el plan todavía no está cerrado` };
  out.push(suma);

  return out;
}

/* ===== Trayectoria: a monto invertido, no a valor de mercado =====

   Esto no es una limitación por no tener precios: es la definición correcta, y es la
   corrección #4 de CLAUDE.md otra vez. El peso a valor de mercado se mueve solo con el
   precio, así que medir la diversificación así es medir el resultado con otro nombre —
   una posición puede cruzar tu máximo sin que hayas comprado nada.

   A monto invertido, el peso se mueve únicamente cuando el usuario compra. Es acción
   pura. Y como efecto lateral, el MVP no necesita ninguna fuente de precios.

   La distancia es variación total: la mitad de la suma de las diferencias absolutas.
   Vale 0 cuando la cartera es el plan y 1 cuando no comparten nada.

   `base` es el total del plan, no lo ya invertido, y esa elección no es un detalle.
   Normalizando sobre lo invertido, la primera compra de un plan de cuatro posiciones
   *aleja* del objetivo —queda 100% en un papel que debía ser 25%— y el motor te marca
   en rojo por empezar. Con el total del plan como denominador, lo que todavía no
   compraste cuenta como efectivo y la primera compra acerca, que es lo que pasó.
   El test 6 tiene el caso que destapó esto. */
function distancia(montos, objetivo, base) {
  const obj = {};
  objetivo.forEach(o => { obj[o.ticker] = (o.peso || 0) / 100; });
  const tks = new Set([...Object.keys(montos), ...Object.keys(obj)]);
  let d = 0;
  tks.forEach(tk => {
    const w = base > 0 ? (montos[tk] || 0) / base : 0;
    d += Math.abs(w - (obj[tk] || 0));
  });
  return d / 2;
}

function trayectoria(plan, now) {
  const T = anotarEstados(plan, now);
  const objetivo = (plan && plan.objetivo) || [];
  if (!objetivo.length) return { hay: false, pasos: [], dist: null, avance: null };

  const acum = {};
  (plan.tenenciaInicial || []).forEach(t => { acum[t.ticker] = (acum[t.ticker] || 0) + t.monto; });

  const ejec = T.filter(tr => (tr._e.estado === 'como' || tr._e.estado === 'distinto') && tr.ejec)
    .sort((a, b) => (a.ejec.ts || 0) - (b.ejec.ts || 0));

  const planTotal = T.reduce((a, tr) => a + (tr.monto || 0), 0) +
    (plan.tenenciaInicial || []).reduce((a, t) => a + t.monto, 0);
  const puesto = (plan.tenenciaInicial || []).reduce((a, t) => a + t.monto, 0) +
    ejec.reduce((a, tr) => a + (tr.ejec.monto || tr.monto || 0), 0);

  /* La base es fija a lo largo de toda la trayectoria, o los pasos no serían
     comparables entre sí. Si terminó poniendo más de lo planeado, manda lo puesto:
     los pesos nunca pueden sumar más de 1. */
  const base = Math.max(planTotal, puesto);

  let prev = distancia(acum, objetivo, base);
  const pasos = [];
  for (const tr of ejec) {
    const tk = tr.ejec.ticker || tr.ticker;
    acum[tk] = (acum[tk] || 0) + (tr.ejec.monto || tr.monto);
    const d = distancia(acum, objetivo, base);
    pasos.push({
      id: tr.id, ticker: tk, ts: tr.ejec.ts, dia: diaBA(tr.ejec.ts),
      antes: prev, despues: d,
      /* El empate no es acercarse. Con distancia igual, `acerco` es false. */
      acerco: d < prev - 1e-9
    });
    prev = d;
  }

  const invertido = Object.keys(acum).reduce((a, k) => a + acum[k], 0);

  return {
    hay: true,
    pasos,
    dist: prev,
    /* Avance sobre el plan propio. No es rendimiento: es cuánto del plan está puesto. */
    avance: planTotal > 0 ? invertido / planTotal : null,
    invertido, planTotal
  };
}

/* ===== Técnica de orden =====
   Dos cosas separadas a propósito.

   `adherencia` es tri-estado y sí se puntúa: ¿ejecutaste con el tipo que declaraste?
   Eso es adherencia al plan y es acción.

   `perfil` solo describe, sin racha ni color. La app no sostiene que el límite sea
   mejor que el mercado —eso sería opinar sobre el contenido del plan— así que cuenta
   y se calla. Lo que sí separa es el límite que no se llenó, porque confundirlo con
   no haber querido operar mezcla técnica con voluntad. */
function tecnica(plan, now) {
  const T = anotarEstados(plan, now);
  let cumple = 0, falla = 0, sinLlenar = 0, limite = 0, mercado = 0;
  const cambios = [];

  for (const tr of T) {
    const e = tr._e;
    if (e.estado === 'noEjecutado' && e.motivo === 'la orden no se llenó') { sinLlenar++; continue; }
    if (e.estado !== 'como' && e.estado !== 'distinto') continue;
    const dec = tr.tipo, hecho = (tr.ejec && tr.ejec.tipo) || null;
    if (!dec || !hecho) continue;
    if (hecho === 'limite') limite++; else if (hecho === 'mercado') mercado++;
    if (dec === hecho) cumple++;
    else { falla++; cambios.push({ id: tr.id, ticker: tr.ticker, de: dec, a: hecho, ts: tr.ejec.ts }); }
  }
  const n = cumple + falla;
  return {
    adherencia: { cumple, falla, n, pct: n ? cumple / n : null, suficiente: n >= MUESTRA_MIN, cambios },
    perfil: { limite, mercado, sinLlenar }
  };
}

/* ===== Hábitos sobre tramos =====
   Misma forma que `habitos` en engine.js, con la misma regla de oro: tres valores.
   `null` atraviesa la racha sin cortarla y sin hacerla crecer, y sale del denominador.
   Un tramo pendiente o sin dato no es una falla: es un tramo que nadie pudo juzgar. */
function habitosPlan(plan, now) {
  const T = anotarEstados(plan, now);
  const tray = trayectoria(plan, now);
  const acercoPorId = {};
  tray.pasos.forEach(p => { acercoPorId[p.id] = p.acerco; });

  const test = {
    fiel: tr => {
      const e = tr._e.estado;
      if (e === 'pendiente' || e === 'sinDato') return null;
      if (e === 'como') return true;
      return false;   // 'distinto' y 'noEjecutado' son no haber hecho lo que dijiste
    },
    tecnica: tr => {
      const e = tr._e.estado;
      if (e !== 'como' && e !== 'distinto') return null;
      const dec = tr.tipo, hecho = tr.ejec && tr.ejec.tipo;
      if (!dec || !hecho) return null;
      return dec === hecho;
    },
    rumbo: tr => {
      if (!(tr.id in acercoPorId)) return null;
      return acercoPorId[tr.id];
    }
  };

  const def = [
    ['fiel', 'Tramo como estaba', 'ejecutar el tramo con el ticker, el monto y la ventana que declaraste'],
    ['tecnica', 'Tipo de orden sostenido', 'mandar la orden del tipo que dijiste que ibas a mandar'],
    ['rumbo', 'Cada compra acerca', 'que el tramo te deje más cerca de tu propia distribución objetivo']
  ];

  /* Orden cronológico por cuándo se resolvió el tramo, no por cuándo se declaró.
     Es la misma corrección que `descartes.md` anota para la curva de PnL: la racha se
     cuenta en el orden en que las cosas se cerraron. */
  const orden = T.slice().sort((a, b) => {
    const ka = (a.ejec && a.ejec.ts) || a.hasta || 0;
    const kb = (b.ejec && b.ejec.ts) || b.hasta || 0;
    return ka - kb;
  });

  return def.map(([id, nombre, accion]) => {
    const ok = test[id];
    let racha = 0;
    for (let i = orden.length - 1; i >= 0; i--) {
      const v = ok(orden[i]);
      if (v === false) break;
      if (v === true) racha++;
    }
    let mejor = 0, c = 0;
    for (const tr of orden) {
      const v = ok(tr);
      if (v === false) c = 0; else if (v === true) c++;
      mejor = Math.max(mejor, c);
    }
    const vals = orden.map(ok);
    const cumplidas = vals.filter(v => v === true).length;
    const fallidas = vals.filter(v => v === false).length;
    const sinDato = vals.filter(v => v == null).length;
    const juzgadas = cumplidas + fallidas;
    return {
      id, nombre, accion, racha, mejor,
      cumplidas, deN: juzgadas, sinDato, deTotal: orden.length,
      pct: juzgadas ? cumplidas / juzgadas : null,
      suficiente: juzgadas >= MUESTRA_MIN
    };
  });
}

/* ===== Las cuatro caras de Taladrín =====

   El estado se mapea al tablero del plan. Nunca al patrimonio, nunca al color de una
   posición.

   Ningún umbral inventado: 'alerta' y 'apretado' se disparan con la ventana que declaró
   el usuario, no con un número que eligió la app.

   Y la salida de 'apretado' es doble: ejecutar el tramo **o editar el plan**. Eso es lo
   que impide que el estado sea coercitivo. Cambiar de idea en frío es una salida válida,
   igual que descansar lo era en el modo perps. Si la única forma de apagarlo fuera
   comprar, sería un malestar que se alivia operando, que es el principio 6. */
function cara(plan, now) {
  const T = anotarEstados(plan, now);
  const juzgados = T.filter(tr => tr._e.estado !== 'pendiente' && tr._e.estado !== 'sinDato');

  if ((!T.length && !((plan && plan.niveles) || []).length) || !(plan.objetivo || []).length) {
    return { cara: 'nose', motivo: 'todavía no hay plan cargado', vencidos: [], salidas: [] };
  }
  const hayNiveles = anotarNiveles(plan, now).some(n => n._e.estado !== 'sinDato' && n._e.estado !== 'vigente');
  if (!juzgados.length && !hayNiveles) {
    return { cara: 'nose', motivo: 'ningún tramo se resolvió todavía', vencidos: [], salidas: [] };
  }

  const vencidos = T.filter(tr => tr._e.estado === 'noEjecutado' && tr._e.motivo === 'venció la ventana')
    .map(tr => ({ id: tr.id, ticker: tr.ticker, dias: diasEntre(tr.hasta, now) }))
    .sort((a, b) => b.dias - a.dias);

  const N = anotarNiveles(plan, now);
  const nivVencidos = N.filter(n => n._e.estado === 'noEjecutado')
    .map(n => ({ id: n.id, ticker: n.ticker, dias: n._e.disparo ? diasEntre(Date.parse(n._e.disparo + 'T15:00:00Z'), now) : null, nivel: true }));
  if (!vencidos.length && nivVencidos.length) {
    return {
      cara: 'apretado',
      motivo: `${nivVencidos.length} regla(s) de nivel cruzada(s) sin ejecutar`,
      vencidos: nivVencidos,
      salidas: ['ejecutar la salida', 'editar el plan']
    };
  }

  if (vencidos.length) {
    return {
      cara: 'apretado',
      motivo: `${vencidos.length} tramo(s) vencido(s) sin ejecutar, el más viejo hace ${vencidos[0].dias} día(s)`,
      vencidos,
      salidas: ['ejecutar el tramo', 'editar el plan']
    };
  }

  const porVencer = T.filter(tr => tr._e.estado === 'pendiente' && tr.hasta != null && diasEntre(now, tr.hasta) <= 1)
    .map(tr => ({ id: tr.id, ticker: tr.ticker, dias: diasEntre(now, tr.hasta) }));
  const nivPend = N.filter(n => n._e.estado === 'pendiente').map(n => ({ id: n.id, ticker: n.ticker, disparo: n._e.disparo }));
  if (!porVencer.length && nivPend.length) {
    return {
      cara: 'alerta',
      motivo: `${nivPend.length} regla(s) de nivel cruzada(s), ventana abierta`,
      vencidos: [], porVencer: nivPend,
      salidas: ['ejecutar la salida', 'editar el plan']
    };
  }
  if (porVencer.length) {
    return {
      cara: 'alerta',
      motivo: `${porVencer.length} tramo(s) con la ventana cerrándose`,
      vencidos: [], porVencer,
      salidas: ['ejecutar el tramo', 'editar el plan']
    };
  }

  return { cara: 'reposo', motivo: 'ningún tramo vencido ni por vencer', vencidos: [], salidas: [] };
}

/* ===== La voz =====
   Las reglas de engine.js, sin cambios: no habla sin un número, habla poco, y callarse
   es una respuesta válida y frecuente. Devuelve `null` seguido, y eso está bien. */
function voz(plan, now) {
  const c = cara(plan, now);
  const hab = habitosPlan(plan, now);
  const tec = tecnica(plan, now);
  const rit = desvioRitmo(plan, now);
  const cont = desvioContenido(plan, now);

  if (c.cara === 'apretado' && c.vencidos[0] && c.vencidos[0].nivel) {
    const v = c.vencidos[0];
    return `La regla de nivel de ${v.ticker} se cruzó hace ${v.dias} día(s) y no se ejecutó. Ejecutarla y reescribirla cuentan igual; dejarla ahí es lo único que no.`;
  }
  if (c.cara === 'apretado') {
    const v = c.vencidos[0];
    return `El tramo de ${v.ticker} venció hace ${v.dias} día(s). Ejecutarlo y borrarlo cuentan igual; dejarlo ahí es lo único que no.`;
  }

  /* Todo lo que sigue exige muestra. Antes del piso el motor se calla, que es lo mismo
     que hacen 4.2 y 4.3 en el modo perps. */
  if (tec.adherencia.suficiente && tec.adherencia.pct != null && tec.adherencia.pct < 0.6) {
    return `Declaraste un tipo de orden y mandaste otro en ${tec.adherencia.falla} de ${tec.adherencia.n}. No es que el límite sea mejor: es que dijiste una cosa y hiciste otra.`;
  }
  if (rit.suficiente && rit.razon != null && rit.razon < 0.34) {
    return `Tu plan se estiraba ${rit.spanPlan} días y lo ejecutaste en ${rit.spanReal}. Entrar más rápido no está mal por definición, pero no es lo que habías escrito.`;
  }
  if (cont.hay && cont.pct != null && cont.n >= MUESTRA_MIN && cont.pct > 0) {
    return `${cont.fuera.length} de ${cont.n} compras fueron a papeles que no estaban en tu plan.`;
  }

  const fiel = hab.find(h => h.id === 'fiel');
  if (fiel && fiel.racha >= 3) {
    return `${fiel.racha} tramos seguidos como los habías escrito.`;
  }
  return null;
}

/* ===== Gating de muestra =====
   Qué tiene derecho a decir el motor con lo que hay. Devuelve la lista de piezas que
   todavía no llegaron al piso, para que la vista las muestre calladas en vez de
   mostrarlas con un número que no significa nada. */
function muestraPlan(plan, now) {
  const T = anotarEstados(plan, now);
  const juzgados = T.filter(tr => tr._e.estado !== 'pendiente' && tr._e.estado !== 'sinDato').length;
  const piezas = [
    { id: 'habitos', n: juzgados, min: MUESTRA_MIN },
    { id: 'ritmo', n: T.filter(tr => tr.ejec && tr.ejec.ts != null).length, min: RITMO_MIN },
    { id: 'tecnica', n: tecnica(plan, now).adherencia.n, min: MUESTRA_MIN }
  ];
  return {
    juzgados,
    listas: piezas.filter(p => p.n >= p.min).map(p => p.id),
    faltan: piezas.filter(p => p.n < p.min).map(p => ({ id: p.id, n: p.n, min: p.min }))
  };
}

/* ===== Reglas de nivel: salidas que él declaró en frío =====

   `DECISIÓN` del 7/10/2026, ver docs/merval.md § Reglas de nivel. Hasta acá el motor no
   miraba ningún valor de mercado. Ahora mira uno, y solo para una pregunta: **¿el cierre
   cruzó el nivel que VOS escribiste, y cuando cruzó, hiciste lo que dijiste?**

   Lo que sigue prohibido, y el cortafuegos del test 11 lo sigue cortando: resultado
   (pnl, ganancia, retorno), comparación contra el mercado (benchmark) y valuación de la
   cartera. Un nivel declarado es una regla, igual que `maxPos`. Lo que se mide es la
   adherencia a la regla, nunca si la regla era buena.

   Los cierres NO los busca el motor: vienen en `plan.cierres`, cargados desde afuera
   (la tarea programada o el tablero de BYMA). Sin cierres para el ticker, `sinDato`.
   El motor no tiene red y no la va a tener: § 1.

   Cinco estados más uno:
   - `vigente`   ningún cierre cruzó todavía. No se juzga, sale del denominador.
   - `pendiente` cruzó y la ventana para ejecutar sigue abierta.
   - `como`      ejecutó dentro de la ventana la fracción declarada.
   - `distinto`  ejecutó, pero tarde, otra fracción, o ANTES de que cruzara.
   - `noEjecutado` cruzó, venció la ventana y no hizo nada.
   - `sinDato`   regla incompleta o sin cierres para ese ticker. */

const TOL_FRACCION = 0.10;   // mismo criterio que TOL_MONTO: nominales enteros

function sentidoNivel(n) {
  if (n.sentido === 'abajo' || n.sentido === 'arriba') return n.sentido;
  if (n.tipo === 'invalidacion') return 'abajo';
  if (n.tipo === 'objetivo') return 'arriba';
  return null;
}

function estadoNivel(n, cierres, now) {
  const sentido = n ? sentidoNivel(n) : null;
  if (!n || !n.ticker || !(n.nivel > 0) || !sentido) {
    return { estado: 'sinDato', cambios: [], motivo: 'regla incompleta', disparo: null };
  }
  const serie = ((cierres || {})[n.ticker] || [])
    .filter(x => x && x.d && x.c > 0)
    .slice().sort((a, b) => a.d < b.d ? -1 : 1);
  if (!serie.length) return { estado: 'sinDato', cambios: [], motivo: 'sin cierres cargados para ' + n.ticker, disparo: null };

  const desde = n.desde != null ? diaBA(n.desde) : null;
  const vale = serie.filter(x => desde == null || x.d >= desde);
  const cruza = x => sentido === 'abajo' ? x.c < n.nivel : x.c >= n.nivel;
  const i = vale.findIndex(cruza);
  const e = n.ejec;
  const plazo = n.plazo > 0 ? Math.round(n.plazo) : 1;   // ruedas después del cierre que cruzó

  if (i < 0) {
    /* Vendió sin que cruzara: hizo otra cosa que lo escrito. No es falla de datos. */
    if (e && e.ts != null) return { estado: 'distinto', cambios: [{ campo: 'disparo', de: 'sin cruce', a: diaBA(e.ts) }], motivo: 'ejecutó antes de que cruzara', disparo: null };
    return { estado: 'vigente', cambios: [], motivo: null, disparo: null };
  }

  const disparo = vale[i].d;
  const limite = vale[i + plazo] ? vale[i + plazo].d : null;   // null: todavía no hubo esas ruedas

  if (!e || e.ts == null) {
    if (limite == null) return { estado: 'pendiente', cambios: [], motivo: 'cruzó el ' + disparo, disparo };
    return { estado: 'noEjecutado', cambios: [], motivo: 'cruzó el ' + disparo + ' y venció la ventana', disparo };
  }

  const dia = diaBA(e.ts);
  const cambios = [];
  if (dia < disparo) cambios.push({ campo: 'disparo', de: disparo, a: dia });
  if (limite != null && dia > limite) cambios.push({ campo: 'ventana', de: limite, a: dia });
  if (n.fraccion > 0 && e.fraccion > 0 && Math.abs(e.fraccion - n.fraccion) > TOL_FRACCION) {
    cambios.push({ campo: 'fraccion', de: n.fraccion, a: e.fraccion });
  }
  return { estado: cambios.length ? 'distinto' : 'como', cambios, motivo: null, disparo };
}

function anotarNiveles(plan, now) {
  const N = (plan && plan.niveles) || [];
  N.forEach(n => { n._e = estadoNivel(n, plan.cierres, now); });
  return N;
}

function niveles(plan, now) {
  const N = anotarNiveles(plan, now);
  const cuenta = { vigente: 0, pendiente: 0, como: 0, distinto: 0, noEjecutado: 0, sinDato: 0 };
  N.forEach(n => { cuenta[n._e.estado]++; });
  const juzgados = cuenta.como + cuenta.distinto + cuenta.noEjecutado;
  return {
    n: N.length, cuenta, juzgados,
    suficiente: juzgados >= MUESTRA_MIN,
    pct: juzgados ? cuenta.como / juzgados : null,
    lista: N.map(n => ({ id: n.id, ticker: n.ticker, tipo: n.tipo, nivel: n.nivel, estado: n._e.estado, motivo: n._e.motivo, disparo: n._e.disparo }))
  };
}

/* ===== La entrada: el taller =====

   Decisión del 5/8: la IA se usa **afuera** de la app. El usuario le da la captura a un
   asistente, recibe este JSON y lo carga. Nada de esto sale del navegador, y por eso
   la restricción § 1 —"todo se procesa en el navegador"— sigue entera.

   `desdePlan` COPIA el objeto y le pone defaults encima. No lista campos a mano, y eso
   no es estilo: es el bug que CLAUDE.md documenta para `desdeArchivo()` en el modo
   perps. El literal que había allá se comía `portfolio`, `orders` y `dexes` sin decir
   nada. Si mañana el esquema gana un campo, acá pasa solo. Volver a un literal de
   campos reabre el mismo agujero. */

const PLAN_DEFAULTS = {
  creado: null, objetivo: [], reglas: {}, tramos: [], ediciones: [], tenenciaInicial: [], niveles: [], cierres: {}
};

/* Un número puede venir como 100000, "100000" o "100.000,50", que es lo que escribe
   cualquier pantalla argentina. Lo que NO hace es adivinar: si no se puede leer,
   devuelve null y `revisar` lo marca. Un 0 silencioso sería inventar la variable. */
function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

function desdePlan(raw) {
  const plan = Object.assign({}, PLAN_DEFAULTS, raw || {});

  /* Solo se tocan los campos que el motor sabe recorrer. Todo lo demás viajó en el
     `Object.assign` de arriba y sigue ahí intacto. */
  plan.objetivo = (Array.isArray(plan.objetivo) ? plan.objetivo : []).map(o =>
    Object.assign({}, o, { ticker: (o.ticker || '').toUpperCase().trim() || null, peso: num(o.peso) }));

  plan.tenenciaInicial = (Array.isArray(plan.tenenciaInicial) ? plan.tenenciaInicial : []).map(t =>
    Object.assign({}, t, { ticker: (t.ticker || '').toUpperCase().trim() || null, monto: num(t.monto) }))
    .filter(t => t.ticker && t.monto > 0);

  plan.tramos = (Array.isArray(plan.tramos) ? plan.tramos : []).map((tr, i) =>
    Object.assign({}, tr, {
      /* El asistente no inventa ids. Se generan por posición y son estables mientras
         no se reordene la lista, que es lo que necesita `trayectoria` para casar pasos. */
      id: tr.id != null ? tr.id : 't' + (i + 1),
      ticker: (tr.ticker || '').toUpperCase().trim() || null,
      monto: num(tr.monto),
      tipo: tr.tipo === 'mercado' ? 'mercado' : tr.tipo === 'limite' ? 'limite' : null,
      ejec: tr.ejec ? Object.assign({}, tr.ejec, { monto: num(tr.ejec.monto), lleno: tr.ejec.lleno !== false }) : null
    }));

  plan.niveles = (Array.isArray(plan.niveles) ? plan.niveles : []).map((n, i) =>
    Object.assign({}, n, {
      id: n.id != null ? n.id : 'n' + (i + 1),
      ticker: (n.ticker || '').toUpperCase().trim() || null,
      nivel: num(n.nivel),
      fraccion: n.fraccion == null ? null : num(n.fraccion),
      ejec: n.ejec ? Object.assign({}, n.ejec, { fraccion: n.ejec.fraccion == null ? null : num(n.ejec.fraccion) }) : null
    }));
  const C = plan.cierres && typeof plan.cierres === 'object' ? plan.cierres : {};
  plan.cierres = {};
  Object.keys(C).forEach(k => {
    plan.cierres[k.toUpperCase().trim()] = (Array.isArray(C[k]) ? C[k] : []).map(x => ({ d: x && x.d, c: x ? num(x.c) : null }));
  });

  plan.ediciones = Array.isArray(plan.ediciones) ? plan.ediciones : [];
  plan.reglas = Object.assign({}, plan.reglas || {});

  return { plan, revision: revisar(plan) };
}

/* ===== La revisión: nada entra sin que lo mires =====

   Una extracción que lee 18,8% como 1,88% rompe el tablero entero en silencio, que es
   el peor modo de falla de este proyecto. Por eso lo que sale del taller no es un plan:
   es un plan **más un reporte de qué habría que confirmar**. Quien monte la vista tiene
   que mostrarlo antes de guardar.

   Tres estados, los mismos de siempre: 'ok' pasa, 'confirmar' se leyó pero podría estar
   mal, 'falta' no se puede usar. */
function revisar(plan) {
  const out = [];
  const O = plan.objetivo || [], T = plan.tramos || [];

  if (!O.length) out.push({ campo: 'objetivo', estado: 'falta', txt: 'no hay ninguna posición objetivo' });

  O.forEach((o, i) => {
    if (!o.ticker) out.push({ campo: `objetivo[${i}].ticker`, estado: 'falta', txt: 'posición sin ticker' });
    if (o.peso == null) out.push({ campo: `objetivo[${i}].peso`, estado: 'falta', txt: `${o.ticker || '?'} sin peso legible` });
    else out.push({ campo: `objetivo[${i}]`, estado: 'confirmar', txt: `${o.ticker}: ${o.peso}%`, valor: o.peso });
    if (!o.sector) out.push({ campo: `objetivo[${i}].sector`, estado: 'confirmar', txt: `${o.ticker || '?'} sin sector: la regla por sector va a quedar sin dato` });
  });

  /* Los pesos no se normalizan. Si suman 97, suman 97 y se dice: reescalarlos sería
     inventar la intención del usuario a partir de un error de lectura. */
  const suma = O.reduce((a, o) => a + (o.peso || 0), 0);
  if (O.length && Math.abs(suma - 100) >= 0.5) {
    out.push({ campo: 'objetivo.suma', estado: 'confirmar', valor: suma,
      txt: `los pesos suman ${suma.toFixed(1)}% y no 100%. No se reescalan solos` });
  }

  T.forEach((tr, i) => {
    if (!tr.ticker) out.push({ campo: `tramos[${i}].ticker`, estado: 'falta', txt: 'tramo sin ticker' });
    if (!(tr.monto > 0)) out.push({ campo: `tramos[${i}].monto`, estado: 'falta', txt: `${tr.ticker || '?'} sin monto legible` });
    if (tr.hasta == null) out.push({ campo: `tramos[${i}].hasta`, estado: 'falta', txt: `${tr.ticker || '?'} sin ventana: va a quedar en sinDato para siempre` });
    if (!tr.tipo) out.push({ campo: `tramos[${i}].tipo`, estado: 'confirmar', txt: `${tr.ticker || '?'} sin tipo de orden: no se puede medir adherencia técnica` });
  });

  (plan.niveles || []).forEach((n, i) => {
    if (!n.ticker) out.push({ campo: `niveles[${i}].ticker`, estado: 'falta', txt: 'regla de nivel sin ticker' });
    if (!(n.nivel > 0)) out.push({ campo: `niveles[${i}].nivel`, estado: 'falta', txt: `${n.ticker || '?'} sin nivel legible` });
    if (!sentidoNivel(n)) out.push({ campo: `niveles[${i}].tipo`, estado: 'falta', txt: `${n.ticker || '?'}: decí si es invalidación u objetivo` });
    if (!n.moneda) out.push({ campo: `niveles[${i}].moneda`, estado: 'confirmar', txt: `${n.ticker || '?'} ${n.nivel}: ¿en qué moneda? Tiene que ser la misma que los cierres` });
    if (n.ticker && !((plan.cierres || {})[n.ticker] || []).length) {
      out.push({ campo: `niveles[${i}].cierres`, estado: 'confirmar', txt: `${n.ticker} no tiene cierres cargados: la regla queda en sinDato hasta que lleguen` });
    }
  });

  const tksObj = new Set(O.map(o => o.ticker));
  T.forEach((tr, i) => {
    if (tr.ticker && tksObj.size && !tksObj.has(tr.ticker)) {
      out.push({ campo: `tramos[${i}].ticker`, estado: 'confirmar',
        txt: `${tr.ticker} no está en tu objetivo. Si es a propósito queda como desvío de contenido` });
    }
  });

  return {
    items: out,
    falta: out.filter(x => x.estado === 'falta').length,
    confirmar: out.filter(x => x.estado === 'confirmar').length,
    /* Usable no es correcto. Dice que el motor puede correr, no que lo leído esté bien. */
    usable: out.filter(x => x.estado === 'falta').length === 0
  };
}

/* ===== Resumen para la vista ===== */
function resumen(plan, now) {
  now = now == null ? Date.now() : now;
  anotarEstados(plan, now);
  const T = (plan && plan.tramos) || [];
  const cuenta = { como: 0, distinto: 0, noEjecutado: 0, pendiente: 0, sinDato: 0 };
  T.forEach(tr => { cuenta[tr._e.estado]++; });
  return {
    now,
    cuenta,
    cara: cara(plan, now),
    habitos: habitosPlan(plan, now),
    tecnica: tecnica(plan, now),
    trayectoria: trayectoria(plan, now),
    senales: {
      contenido: desvioContenido(plan, now),
      ritmo: desvioRitmo(plan, now),
      reescrituras: reescrituras(plan, now),
      contradicciones: contradicciones(plan)
    },
    niveles: niveles(plan, now),
    muestra: muestraPlan(plan, now),
    voz: voz(plan, now)
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    diaBA, diasEntre, estadoTramo, anotarEstados,
    desvioContenido, desvioRitmo, reescrituras, contradicciones,
    distancia, trayectoria, tecnica, habitosPlan, cara, voz, muestraPlan, resumen,
    desdePlan, revisar, num, PLAN_DEFAULTS,
    estadoNivel, niveles, TOL_FRACCION,
    TOL_MONTO, MUESTRA_MIN, RITMO_MIN
  };
}
