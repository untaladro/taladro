/* Tests del motor Merval. `node _build/merval-test.js`
   Fixture sintética, generada acá: no hay ningún archivo con datos reales. */

'use strict';

const M = require('./merval-engine.js');
const {
  diaBA, estadoTramo, desvioContenido, desvioRitmo, reescrituras, contradicciones,
  distancia, trayectoria, tecnica, habitosPlan, cara, voz, muestraPlan, resumen,
  TOL_MONTO, MUESTRA_MIN, RITMO_MIN
} = M;

let pass = 0, fail = 0;
const near = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;
function ok(cond, msg) { cond ? (pass++, console.log('  ok  ' + msg)) : (fail++, console.log('  FAIL ' + msg)); }
function eq(a, b, msg) { ok(near(a, b), `${msg}  (esperado ${b}, obtenido ${a})`); }

const DIA = 864e5;
const T0 = Date.UTC(2026, 5, 1, 15, 0);   // 1/6/2026, 12:00 en Buenos Aires

/* Helpers de fixture. `ej` arma un tramo ejecutado; sin `ej` queda declarado y crudo. */
function tramo(id, ticker, monto, desde, hasta, tipo = 'limite') {
  return { id, ticker, monto, tipo, desde, hasta, declarado: desde, ejec: null };
}
function ej(tr, over = {}) {
  tr.ejec = Object.assign({ ts: tr.desde + DIA, ticker: tr.ticker, monto: tr.monto, tipo: tr.tipo, lleno: true }, over);
  return tr;
}
function planBase() {
  return {
    creado: T0,
    objetivo: [
      { ticker: 'GGAL', peso: 25, sector: 'bancos' },
      { ticker: 'YPFD', peso: 25, sector: 'energia' },
      { ticker: 'PAMP', peso: 25, sector: 'energia' },
      { ticker: 'TXAR', peso: 25, sector: 'industria' }
    ],
    reglas: { maxPos: 30, maxSector: 60, minPosiciones: 4 },
    tramos: [], ediciones: [], tenenciaInicial: []
  };
}

/* ============ 1. Los cuatro estados del tramo ============ */
console.log('\n1. Estados del tramo');
{
  const ahora = T0 + 30 * DIA;

  const vivo = tramo('a', 'GGAL', 100000, T0, T0 + 40 * DIA);
  ok(estadoTramo(vivo, ahora).estado === 'pendiente', 'ventana abierta -> pendiente, no falla');

  const vencido = tramo('b', 'GGAL', 100000, T0, T0 + 10 * DIA);
  const ev = estadoTramo(vencido, ahora);
  ok(ev.estado === 'noEjecutado' && ev.motivo === 'venció la ventana', 'ventana cerrada y nada hecho -> noEjecutado');

  const igual = ej(tramo('c', 'GGAL', 100000, T0, T0 + 10 * DIA));
  ok(estadoTramo(igual, ahora).estado === 'como', 'ejecutado tal cual -> como');

  const otroTk = ej(tramo('d', 'GGAL', 100000, T0, T0 + 10 * DIA), { ticker: 'YPFD' });
  const eo = estadoTramo(otroTk, ahora);
  ok(eo.estado === 'distinto' && eo.cambios[0].campo === 'ticker', 'otro ticker -> distinto, y dice cuál campo');

  const sinVentana = { id: 'e', ticker: 'GGAL', monto: 100000, tipo: 'limite', desde: T0, hasta: null, ejec: null };
  ok(estadoTramo(sinVentana, ahora).estado === 'sinDato', 'sin ventana declarada -> sinDato, no noEjecutado');

  const roto = { id: 'f', ticker: null, monto: 0 };
  ok(estadoTramo(roto, ahora).estado === 'sinDato', 'tramo incompleto -> sinDato');
}

/* ============ 2. La tolerancia de monto, y por qué existe ============ */
console.log('\n2. Tolerancia de monto');
{
  const ahora = T0 + 30 * DIA;
  /* 100.000 pesos a 1.847 dan 54 nominales = 99.738. Eso NO es un desvío. */
  const redondeo = ej(tramo('g', 'GGAL', 100000, T0, T0 + 10 * DIA), { monto: 99738 });
  ok(estadoTramo(redondeo, ahora).estado === 'como', 'el redondeo a nominales enteros no es desvío');

  const mitad = ej(tramo('h', 'GGAL', 100000, T0, T0 + 10 * DIA), { monto: 50000 });
  const em = estadoTramo(mitad, ahora);
  ok(em.estado === 'distinto' && em.cambios.some(c => c.campo === 'monto'), 'la mitad del monto sí es desvío');

  const justo = ej(tramo('i', 'GGAL', 100000, T0, T0 + 10 * DIA), { monto: 100000 * (1 + TOL_MONTO + 0.001) });
  ok(estadoTramo(justo, ahora).estado === 'distinto', 'apenas pasada la tolerancia ya es desvío');
}

/* ============ 3. El límite que no se llenó ============ */
console.log('\n3. El límite sin llenar');
{
  const ahora = T0 + 30 * DIA;
  const noLleno = ej(tramo('j', 'GGAL', 100000, T0, T0 + 10 * DIA), { lleno: false });
  const e = estadoTramo(noLleno, ahora);
  ok(e.estado === 'noEjecutado' && e.motivo === 'la orden no se llenó',
    'no llenarse es no-ejecución, pero con motivo distinto que no haber mandado nada');

  const p = planBase();
  p.tramos = [noLleno];
  const t = tecnica(p, ahora);
  eq(t.perfil.sinLlenar, 1, 'el sin-llenar se cuenta aparte en el perfil');
  eq(t.adherencia.n, 0, 'y no entra al denominador de adherencia: hizo lo que dijo');
}

/* ============ 4. Tri-estado en los hábitos: el null atraviesa ============ */
console.log('\n4. El null atraviesa la racha');
{
  const ahora = T0 + 100 * DIA;
  const p = planBase();
  p.tramos = [
    ej(tramo('1', 'GGAL', 100000, T0, T0 + 5 * DIA)),
    tramo('2', 'YPFD', 100000, T0 + 10 * DIA, ahora + 30 * DIA),   // pendiente -> null
    ej(tramo('3', 'PAMP', 100000, T0 + 20 * DIA, T0 + 25 * DIA)),
    ej(tramo('4', 'TXAR', 100000, T0 + 30 * DIA, T0 + 35 * DIA))
  ];
  const fiel = habitosPlan(p, ahora).find(h => h.id === 'fiel');
  eq(fiel.racha, 3, 'la racha atraviesa el tramo pendiente sin cortarse');
  eq(fiel.deN, 3, 'y el pendiente sale del denominador');
  eq(fiel.sinDato, 1, 'contado aparte como sin dato');
  eq(fiel.pct, 1, 'el pct se calcula sobre lo juzgado, no sobre el total');

  /* El espejo: si el pendiente contara como cumplido, deN sería 4. Si contara como
     falla, la racha sería 1. Los dos errores están en descartes.md. */
  ok(fiel.deN !== 4 && fiel.racha !== 1, 'no cuenta el null ni como cumplido ni como falla');
}

/* ============ 5. Sin muestra, el motor se calla ============ */
console.log('\n5. Gating por muestra');
{
  const ahora = T0 + 100 * DIA;
  const p = planBase();
  p.tramos = [ej(tramo('1', 'GGAL', 100000, T0, T0 + 5 * DIA), { tipo: 'mercado' })];
  const t = tecnica(p, ahora);
  eq(t.adherencia.pct, 0, 'con un solo tramo el pct existe');
  ok(t.adherencia.suficiente === false, 'pero no alcanza el piso de muestra');
  ok(voz(p, ahora) === null || !/tipo de orden/.test(voz(p, ahora)),
    'y la voz no dice nada sobre la técnica con n=1');

  const m = muestraPlan(p, ahora);
  ok(m.faltan.some(f => f.id === 'tecnica'), 'muestraPlan declara que técnica todavía no llega');
}

/* ============ 6. Trayectoria: se mide a monto invertido ============ */
console.log('\n6. Trayectoria a monto invertido');
{
  const ahora = T0 + 100 * DIA;
  const p = planBase();
  /* Cuatro compras iguales sobre cuatro objetivos de 25% cada uno: la distancia
     tiene que caer a cero. */
  p.tramos = [
    ej(tramo('1', 'GGAL', 100000, T0, T0 + 5 * DIA)),
    ej(tramo('2', 'YPFD', 100000, T0 + 10 * DIA, T0 + 15 * DIA)),
    ej(tramo('3', 'PAMP', 100000, T0 + 20 * DIA, T0 + 25 * DIA)),
    ej(tramo('4', 'TXAR', 100000, T0 + 30 * DIA, T0 + 35 * DIA))
  ];
  const tr = trayectoria(p, ahora);
  eq(tr.pasos.length, 4, 'un paso por tramo ejecutado');
  ok(near(tr.dist, 0, 1e-9), 'con el plan completo la distancia cae a cero');
  ok(tr.pasos.every(x => x.acerco), 'y cada compra acercó');
  eq(tr.avance, 1, 'avance = 1 con todo el plan puesto');

  /* El caso que destapó el error de modelado: normalizando sobre lo ya invertido, la
     PRIMERA compra de un plan de cuatro aleja —queda 100% en algo que debía ser 25%—
     y el motor te marcaba en rojo por arrancar. Con el total del plan de denominador,
     lo no comprado cuenta como efectivo y arrancar acerca. */
  eq(tr.pasos[0].antes, 0.5, 'de comitente vacía, la distancia arranca en 0,5');
  ok(tr.pasos[0].despues < tr.pasos[0].antes, 'y la primera compra del plan acerca, no aleja');

  /* Concentrar todo en un solo papel aleja, aunque el papel esté en el plan. */
  const q = planBase();
  q.tramos = [
    ej(tramo('1', 'GGAL', 100000, T0, T0 + 5 * DIA)),
    ej(tramo('2', 'GGAL', 300000, T0 + 10 * DIA, T0 + 15 * DIA))
  ];
  const tq = trayectoria(q, ahora);
  ok(tq.pasos[1].acerco === false, 'doblar sobre un papel del plan igual aleja del objetivo');

  /* El empate no cuenta como acercarse. */
  ok(!tq.pasos.some(x => x.acerco && near(x.antes, x.despues)), 'distancia igual no es acercarse');
}

/* ============ 7. El peso a monto NO se mueve solo ============ */
console.log('\n7. La propiedad que justifica medir a costo');
{
  const ahora = T0 + 100 * DIA;
  const p = planBase();
  p.tramos = [
    ej(tramo('1', 'GGAL', 100000, T0, T0 + 5 * DIA)),
    ej(tramo('2', 'YPFD', 100000, T0 + 10 * DIA, T0 + 15 * DIA))
  ];
  const antes = trayectoria(p, ahora).dist;
  /* Pasa un mes entero sin que compre nada. En una medición a valor de mercado la
     distancia se habría movido sola con los precios. Acá no se mueve. */
  const despues = trayectoria(p, ahora + 30 * DIA).dist;
  eq(despues, antes, 'sin comprar nada, la distancia al objetivo no se mueve');
}

/* ============ 8. Las cuatro señales ============ */
console.log('\n8. Señales de desvío');
{
  const ahora = T0 + 100 * DIA;

  /* Contenido */
  const p = planBase();
  p.tramos = [
    ej(tramo('1', 'GGAL', 100000, T0, T0 + 5 * DIA)),
    ej(tramo('2', 'GGAL', 100000, T0 + 6 * DIA, T0 + 8 * DIA), { ticker: 'METR' })
  ];
  const dc = desvioContenido(p, ahora);
  eq(dc.fuera.length, 1, 'una compra fuera del plan');
  eq(dc.pct, 0.5, 'sobre dos ejecutadas da la mitad');

  const sinObj = planBase(); sinObj.objetivo = []; sinObj.tramos = p.tramos;
  ok(desvioContenido(sinObj, ahora).hay === false, 'sin objetivo declarado no hay contra qué comparar');

  /* Ritmo: el plan se estiraba 60 días y se ejecutó en uno */
  const q = planBase();
  q.tramos = [
    ej(tramo('1', 'GGAL', 100000, T0, T0 + 60 * DIA), { ts: T0 + DIA }),
    ej(tramo('2', 'YPFD', 100000, T0, T0 + 60 * DIA), { ts: T0 + DIA }),
    ej(tramo('3', 'PAMP', 100000, T0, T0 + 60 * DIA), { ts: T0 + DIA })
  ];
  const dr = desvioRitmo(q, ahora);
  ok(dr.suficiente, 'con tres ejecutados ya se puede hablar de ritmo');
  eq(dr.dias, 1, 'los tres cayeron el mismo día');
  ok(near(dr.concentracion, 1 / 3), 'concentración máxima');
  eq(dr.spanReal, 0, 'span real de cero días');
  ok(dr.razon === 0, 'razón cero: el plan se comprimió del todo');

  const pocos = planBase();
  pocos.tramos = [ej(tramo('1', 'GGAL', 100000, T0, T0 + 5 * DIA))];
  ok(desvioRitmo(pocos, ahora).suficiente === false, `con menos de ${RITMO_MIN} no se dice nada del ritmo`);

  /* Reescrituras: solo cuentan las de después de la primera compra */
  const r = planBase();
  r.tramos = [ej(tramo('1', 'GGAL', 100000, T0 + 10 * DIA, T0 + 15 * DIA), { ts: T0 + 11 * DIA })];
  r.ediciones = [
    { ts: T0 + 2 * DIA, campo: 'peso', ticker: 'GGAL', antes: 20, despues: 25 },
    { ts: T0 + 20 * DIA, campo: 'peso', ticker: 'GGAL', antes: 25, despues: 40 }
  ];
  const re = reescrituras(r, ahora);
  eq(re.total, 2, 'dos ediciones en total');
  eq(re.enVuelo, 1, 'una sola después de haber empezado a ejecutar');
  ok(re.vinculoExterno === null, 'el vínculo con el movimiento de mercado queda sin medir, y lo dice');

  /* Contradicciones internas */
  const c = planBase();
  c.objetivo = [
    { ticker: 'GGAL', peso: 40, sector: 'bancos' },
    { ticker: 'YPFD', peso: 40, sector: 'energia' },
    { ticker: 'PAMP', peso: 20, sector: 'energia' }
  ];
  const cs = contradicciones(c);
  ok(cs.find(x => x.id === 'maxPos').estado === 'choca', 'dos posiciones sobre el máximo que él fijó');
  ok(cs.find(x => x.id === 'minPos').estado === 'choca', 'tres posiciones contra un mínimo de cuatro');
  ok(cs.find(x => x.id === 'suma').estado === 'ok', 'los pesos suman 100');

  /* El borde: energía suma exactamente 60 y la regla dice máximo 60. No es violación,
     y esto se testea porque un `>=` mal puesto acá acusa al que cumplió justo. */
  ok(cs.find(x => x.id === 'maxSector').estado === 'ok', 'el sector justo en el límite no choca');
  const cEstricto = Object.assign(planBase(), { objetivo: c.objetivo });
  cEstricto.reglas = { maxPos: 30, maxSector: 50, minPosiciones: 4 };
  ok(contradicciones(cEstricto).find(x => x.id === 'maxSector').estado === 'choca',
    'energía al 60% sí choca contra un máximo de 50');

  const sinReglas = planBase();
  sinReglas.reglas = {};
  const cr = contradicciones(sinReglas);
  ok(cr.filter(x => x.estado === 'sinDato').length >= 3, 'regla no declarada es sinDato, nunca "cumple"');

  const sinSector = planBase();
  sinSector.objetivo = sinSector.objetivo.map(o => ({ ticker: o.ticker, peso: o.peso }));
  ok(contradicciones(sinSector).find(x => x.id === 'maxSector').estado === 'sinDato',
    'sin sector declarado no se inventa la suma por sector');
}

/* ============ 9. Las cuatro caras ============ */
console.log('\n9. Caras de Taladrín');
{
  const vacio = planBase();
  ok(cara(vacio, T0).cara === 'nose', 'plan sin tramos -> no sé');

  const soloPend = planBase();
  soloPend.tramos = [tramo('1', 'GGAL', 100000, T0, T0 + 40 * DIA)];
  ok(cara(soloPend, T0 + DIA).cara === 'nose', 'nada resuelto todavía -> no sé, no reposo');

  const alerta = planBase();
  alerta.tramos = [tramo('1', 'GGAL', 100000, T0, T0 + 10 * DIA), ej(tramo('2', 'YPFD', 100000, T0, T0 + 2 * DIA))];
  ok(cara(alerta, T0 + 9 * DIA).cara === 'alerta', 'ventana cerrándose -> alerta');

  const apretado = planBase();
  apretado.tramos = [ej(tramo('1', 'GGAL', 100000, T0, T0 + 2 * DIA)), tramo('2', 'YPFD', 100000, T0, T0 + 10 * DIA)];
  const ca = cara(apretado, T0 + 24 * DIA);
  ok(ca.cara === 'apretado', 'tramo vencido sin ejecutar -> apretado');
  eq(ca.vencidos[0].dias, 14, 'y dice hace cuántos días venció');

  /* Principio 6: el estado no puede tener una sola salida, y esa salida no puede
     ser obligatoriamente comprar. */
  ok(ca.salidas.length === 2 && ca.salidas.includes('editar el plan'),
    'apretado tiene dos salidas, y una es editar el plan');

  const reposo = planBase();
  reposo.tramos = [ej(tramo('1', 'GGAL', 100000, T0, T0 + 2 * DIA)), tramo('2', 'YPFD', 100000, T0, T0 + 60 * DIA)];
  ok(cara(reposo, T0 + 10 * DIA).cara === 'reposo', 'nada vencido ni por vencer -> reposo');
}

/* ============ 10. La voz: no habla sin número, y se calla seguido ============ */
console.log('\n10. La voz');
{
  const ahora = T0 + 100 * DIA;
  const mudo = planBase();
  mudo.tramos = [ej(tramo('1', 'GGAL', 100000, T0, T0 + 5 * DIA))];
  ok(voz(mudo, ahora) === null, 'con un tramo limpio y sin muestra, se calla');

  const p = planBase();
  p.tramos = [ej(tramo('1', 'GGAL', 100000, T0, T0 + 2 * DIA)), tramo('2', 'YPFD', 100000, T0, T0 + 10 * DIA)];
  const v = voz(p, T0 + 24 * DIA);
  ok(/\d/.test(v), 'cuando habla, lleva un número');
  ok(/borrarlo|editar/.test(v), 'y ofrece la salida que no es comprar');

  const racha = planBase();
  racha.tramos = [
    ej(tramo('1', 'GGAL', 100000, T0, T0 + 5 * DIA)),
    ej(tramo('2', 'YPFD', 100000, T0 + 6 * DIA, T0 + 10 * DIA)),
    ej(tramo('3', 'PAMP', 100000, T0 + 11 * DIA, T0 + 15 * DIA))
  ];
  const vr = voz(racha, ahora);
  ok(vr && /3 tramos/.test(vr), 'festeja con el número propio al lado');
  ok(!/!/.test(vr || ''), 'sin signos de exclamación');
}

/* ============ 11. Nada del motor toca precios ni PnL ============ */
console.log('\n11. El cortafuegos');
{
  const fs = require('fs');
  const src = fs.readFileSync(__dirname + '/merval-engine.js', 'utf8');
  const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const prohibidas = ['pnl', 'precio', 'cotiza', 'ganancia', 'retorno', 'benchmark', 'mercadoValor'];
  const halladas = prohibidas.filter(w => new RegExp(w, 'i').test(codigo));
  ok(halladas.length === 0, 'ningún identificador de precio o resultado en el código: ' + (halladas.join(', ') || 'limpio'));

  /* Y el motor entero corre sin una sola fuente externa. */
  const p = planBase();
  p.tramos = [ej(tramo('1', 'GGAL', 100000, T0, T0 + 5 * DIA))];
  const r = resumen(p, T0 + 10 * DIA);
  ok(r && r.cara && r.habitos && r.trayectoria, 'resumen completo sin red, sin API y sin precios');
}

/* ============ 12. `diaBA` no se desfasó de engine.js ============ */
console.log('\n12. Deriva contra engine.js');
{
  let otro = null;
  try { otro = require('./engine.js').diaBA; } catch (e) { /* engine.js puede no estar */ }
  if (otro) {
    const casos = [T0, T0 - 4 * 36e5, T0 + 8 * 36e5, Date.UTC(2026, 0, 1, 2, 30), Date.UTC(2026, 11, 31, 23, 59)];
    ok(casos.every(ts => diaBA(ts) === otro(ts)),
      'diaBA da lo mismo que la de engine.js en los cinco casos, incluido el cruce de medianoche');
  } else {
    console.log('  --  engine.js no disponible, se saltea la comparación');
  }
}

/* ============ 13. El cargador del taller ============ */
console.log('\n13. desdePlan y revisar');
{
  const { desdePlan, revisar, num } = M;

  /* EL test del cargador. CLAUDE.md documenta que el literal de campos de `desdeArchivo()`
     se comía `portfolio`, `orders` y `dexes` en silencio. Si alguien reemplaza el
     Object.assign por una lista de campos, esto se pone rojo. */
  const conExtra = desdePlan({
    objetivo: [{ ticker: 'GGAL', peso: 100 }],
    tramos: [], campoQueTodaviaNoExiste: 42, otroMas: { anidado: true }
  }).plan;
  eq(conExtra.campoQueTodaviaNoExiste, 42, 'un campo desconocido del JSON sobrevive al cargador');
  ok(conExtra.otroMas && conExtra.otroMas.anidado === true, 'y también si es un objeto anidado');

  /* Defaults encima, no debajo: lo que vino gana. */
  const vacio = desdePlan({}).plan;
  ok(Array.isArray(vacio.tramos) && vacio.tramos.length === 0, 'sin tramos, queda array vacío y no undefined');
  ok(Array.isArray(vacio.objetivo) && Array.isArray(vacio.ediciones), 'los arrays faltantes se rellenan');
  ok(desdePlan({ creado: 123 }).plan.creado === 123, 'el default no pisa lo que vino');

  /* Números como los escribe una pantalla argentina. */
  eq(num('100.000,50'), 100000.5, 'lee el formato argentino');
  eq(num('$ 1.234'), 1234, 'y le saca el signo');
  eq(num(5000), 5000, 'un número pasa derecho');
  ok(num('no es un número') === null, 'lo ilegible da null, no cero');
  ok(num(null) === null && num(undefined) === null, 'null y undefined dan null');

  /* Ese null tiene que llegar hasta el estado del tramo como sinDato, no como un
     tramo de monto cero que después se juzga. */
  const ilegible = desdePlan({
    objetivo: [{ ticker: 'GGAL', peso: 100 }],
    tramos: [{ ticker: 'GGAL', monto: 'ilegible', hasta: T0 + 5 * DIA, tipo: 'limite' }]
  }).plan;
  ok(estadoTramo(ilegible.tramos[0], T0 + 40 * DIA).estado === 'sinDato',
    'un monto que no se pudo leer deja el tramo en sinDato, no lo juzga');

  /* Ids generados: el asistente no los inventa. */
  const conIds = desdePlan({ tramos: [{ ticker: 'GGAL' }, { ticker: 'YPFD' }, { id: 'mio', ticker: 'PAMP' }] }).plan;
  ok(conIds.tramos[0].id === 't1' && conIds.tramos[1].id === 't2', 'los ids faltantes se generan por posición');
  ok(conIds.tramos[2].id === 'mio', 'y un id propio se respeta');

  /* Los pesos NO se normalizan. */
  const flojo = desdePlan({ objetivo: [{ ticker: 'GGAL', peso: 50 }, { ticker: 'YPFD', peso: 47 }] });
  eq(flojo.plan.objetivo[0].peso, 50, 'los pesos quedan como se leyeron');
  ok(flojo.revision.items.some(x => x.campo === 'objetivo.suma' && x.estado === 'confirmar'),
    'y la revisión avisa que suman 97, en vez de reescalarlos sola');

  /* La revisión marca lo que no se puede usar. */
  const roto = desdePlan({
    objetivo: [{ ticker: 'GGAL', peso: 100 }],
    tramos: [{ ticker: 'GGAL', monto: 100000 }]      // sin ventana
  });
  ok(roto.revision.usable === false, 'un tramo sin ventana vuelve el plan no usable');
  ok(roto.revision.items.some(x => /sinDato para siempre/.test(x.txt)), 'y dice exactamente por qué');

  const sinObj = desdePlan({ tramos: [] });
  ok(sinObj.revision.items.some(x => x.campo === 'objetivo' && x.estado === 'falta'),
    'sin objetivo el plan no arranca');

  /* `usable` no quiere decir correcto, y el nombre solo no alcanza: se testea. */
  const leible = desdePlan({
    objetivo: [{ ticker: 'GGAL', peso: 100, sector: 'bancos' }],
    tramos: [{ ticker: 'GGAL', monto: 100000, hasta: T0 + 5 * DIA, tipo: 'limite' }]
  });
  ok(leible.revision.usable === true, 'con todo lo mínimo, usable');
  ok(leible.revision.confirmar > 0, 'pero igual quedan cosas para confirmar a ojo');

  /* Un tramo que no está en el objetivo se avisa, no se borra: puede ser a propósito
     y en ese caso es la señal de desvío de contenido haciendo su trabajo. */
  const fuera = desdePlan({
    objetivo: [{ ticker: 'GGAL', peso: 100 }],
    tramos: [{ ticker: 'METR', monto: 1000, hasta: T0 + DIA, tipo: 'limite' }]
  });
  ok(fuera.plan.tramos.length === 1, 'el tramo fuera del objetivo no se borra');
  ok(fuera.revision.items.some(x => /no está en tu objetivo/.test(x.txt)), 'se avisa y se explica');

  /* Tickers en minúscula, que es como salen de una captura. */
  const minus = desdePlan({ objetivo: [{ ticker: ' ggal ', peso: 100 }] }).plan;
  eq(minus.objetivo[0].ticker === 'GGAL' ? 1 : 0, 1, 'el ticker se normaliza a mayúscula sin espacios');
}

/* ============ 14. Reglas de nivel (decisión del 7/10/2026) ============ */
console.log('\n14. Reglas de nivel');
{
  const { estadoNivel, niveles, desdePlan } = M;
  /* Cierres sintéticos de una especie cualquiera: ruedas consecutivas desde T0. */
  const dias = k => diaBA(T0 + k * DIA);
  const serie = cs => cs.map((c, k) => ({ d: dias(k), c }));
  const inv = (over = {}) => Object.assign({ id: 'n1', ticker: 'XXX', tipo: 'invalidacion', nivel: 65, fraccion: 1, plazo: 1, desde: T0, ejec: null }, over);

  const C1 = { XXX: serie([68, 67, 66, 64.8, 64, 63]) };   // cruza en la rueda 3
  ok(estadoNivel(inv(), { XXX: serie([68, 67, 66]) }, T0 + 3 * DIA).estado === 'vigente',
    'sin cierre debajo del nivel, vigente: no se juzga');
  ok(estadoNivel(inv(), { XXX: serie([68, 67, 66, 64.8]) }, T0 + 3 * DIA).estado === 'pendiente',
    'cerró debajo y todavía no hubo la rueda siguiente: pendiente');
  const vencido = estadoNivel(inv(), C1, T0 + 6 * DIA);
  ok(vencido.estado === 'noEjecutado' && vencido.disparo === dias(3),
    'cruzó, pasó la ventana y no ejecutó: noEjecutado, con el día del cruce');
  ok(estadoNivel(inv({ ejec: { ts: T0 + 4 * DIA, fraccion: 1 } }), C1, T0 + 6 * DIA).estado === 'como',
    'vendió en la rueda siguiente al cierre que cruzó: como');
  const tarde = estadoNivel(inv({ ejec: { ts: T0 + 5 * DIA, fraccion: 1 } }), C1, T0 + 6 * DIA);
  ok(tarde.estado === 'distinto' && tarde.cambios.some(x => x.campo === 'ventana'), 'vendió dos ruedas tarde: distinto, y dice qué');
  const antes = estadoNivel(inv({ ejec: { ts: T0 + DIA, fraccion: 1 } }), C1, T0 + 6 * DIA);
  ok(antes.estado === 'distinto' && antes.cambios.some(x => x.campo === 'disparo'), 'vendió antes del cruce: también es apartarse de lo escrito');
  const parcial = estadoNivel(inv({ ejec: { ts: T0 + 4 * DIA, fraccion: 0.5 } }), C1, T0 + 6 * DIA);
  ok(parcial.estado === 'distinto' && parcial.cambios.some(x => x.campo === 'fraccion'), 'vendió la mitad de lo declarado: distinto');

  /* Una mecha no dispara: solo cuenta el cierre. Es la regla que él eligió. */
  ok(estadoNivel(inv(), { XXX: serie([68, 65.0, 66]) }, T0 + 3 * DIA).estado === 'vigente',
    'cerrar justo en el nivel no es cruzarlo hacia abajo');

  /* Objetivo: sentido contrario. */
  const obj = { id: 'n2', ticker: 'XXX', tipo: 'objetivo', nivel: 73, fraccion: 1 / 3, desde: T0, ejec: null };
  ok(estadoNivel(obj, { XXX: serie([70, 72, 73.1]) }, T0 + 2 * DIA).estado === 'pendiente', 'un objetivo se dispara al cerrar arriba');

  /* Sin cierres no se inventa nada: § principio 1. */
  ok(estadoNivel(inv(), {}, T0 + 6 * DIA).estado === 'sinDato', 'sin cierres para el ticker: sinDato, no vigente');
  ok(estadoNivel(inv({ nivel: null }), C1, T0 + 6 * DIA).estado === 'sinDato', 'sin nivel legible: sinDato');

  /* Cierres anteriores a la declaración no cuentan: la regla rige desde que la escribió. */
  ok(estadoNivel(inv({ desde: T0 + 5 * DIA }), C1, T0 + 6 * DIA).estado === 'pendiente',
    'un cruce anterior a la declaración no la dispara retroactivamente');

  /* La cara: una regla cruzada y vencida aprieta, con dos salidas. */
  const p = planBase();
  p.niveles = [inv()]; p.cierres = C1;
  const c = cara(p, T0 + 6 * DIA);
  ok(c.cara === 'apretado' && c.salidas.includes('editar el plan'), 'regla vencida: apretado, y editar el plan es salida válida');
  const v = voz(p, T0 + 6 * DIA);
  ok(v && /\d/.test(v) && !/!/.test(v), 'la voz lleva número y no exclama');
  p.cierres = { XXX: serie([68, 67, 66, 64.8]) };
  ok(cara(p, T0 + 3 * DIA).cara === 'alerta', 'cruzada con ventana abierta: alerta');

  /* Muestra: los vigentes salen del denominador. */
  const r = niveles({ niveles: [inv(), inv({ id: 'n2', nivel: 50 })], cierres: C1 }, T0 + 6 * DIA);
  ok(r.cuenta.vigente === 1 && r.juzgados === 1 && r.suficiente === false, 'el que no cruzó no entra al denominador, y con 1 se calla');

  /* Cargador. */
  const d = desdePlan({ objetivo: [{ ticker: 'XXX', peso: 100 }], niveles: [{ ticker: 'xxx', tipo: 'invalidacion', nivel: '65,0' }], cierres: { xxx: [{ d: '2026-10-01', c: '68,5' }] } });
  ok(d.plan.niveles[0].ticker === 'XXX' && d.plan.niveles[0].nivel === 65 && d.plan.niveles[0].id === 'n1', 'el cargador normaliza ticker, número e id');
  ok(d.plan.cierres.XXX && d.plan.cierres.XXX[0].c === 68.5, 'y los cierres, con formato argentino');
  ok(d.revision.items.some(x => /moneda/.test(x.txt)), 'la revisión pide confirmar la moneda del nivel');

  /* Cortafuegos estructural: los cierres solo se leen para evaluar la regla. */
  const fs = require('fs');
  const codigo = fs.readFileSync(__dirname + '/merval-engine.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const bloques = codigo.split(/\nfunction /).slice(1).map(b => ({ nombre: b.match(/^(\w+)/)[1], cuerpo: b }));
  const leen = bloques.filter(b => /\.cierres\b/.test(b.cuerpo)).map(b => b.nombre).sort();
  const permitidas = ['anotarNiveles', 'desdePlan', 'revisar'];   // estadoNivel los recibe por parámetro
  ok(leen.every(n => permitidas.includes(n)),
    'los cierres solo se leen para evaluar la regla y cargarla: ' + leen.join(', '));
}

console.log(`\n${pass} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
