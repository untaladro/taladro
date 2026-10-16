/* Prueba de humo: corre la página entera —ingest, render, gráficos, tablas, cambio de
   tema— contra un DOM de mentira.

   Existe porque `node --check` mira sintaxis y no llamadas. Un
   `const ROJO = () => cssVar('--down', ROJO())` compila perfecto, pasa los 63 tests del
   motor, y revienta en el primer render con "Maximum call stack size exceeded". El build
   informaba éxito y la página salía muerta: exactamente el mismo agujero que el chequeo
   de sintaxis vino a tapar, un piso más arriba.

   Corre sobre el index.html ya armado, así que prueba lo que se publica.

       node _build/smoke.js [ruta/al/index.html]

   Sale con código 1 si algo falla, para que build.py pueda cortar. */
require('./t/stub.js');
const fs = require('fs'), path = require('path');

const HTML = process.argv[2] || path.join(__dirname, '..', 'index.html');
const bloques = fs.readFileSync(HTML, 'utf8').match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g) || [];
if (!bloques.length) { console.log('  FAIL  el HTML no tiene scripts'); process.exit(1); }
const src = bloques[bloques.length - 1].replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');

const append = `
;(function(){
  const H = 36e5;
  const f = (coin,side,px,sz,time,cp=0,fee=0) =>
    ({ coin, side, px:String(px), sz:String(sz), time, closedPnl:String(cp), fee:String(fee) });

  /* Los datos terminan hoy a propósito: el filtro arranca en "hoy", así que una muestra
     anclada a una fecha fija deja la pantalla vacía y el humo no prueba nada. */
  const fills = [];
  let now = Date.now() - 50 * 26 * H;
  for (let i = 0; i < 50; i++) {
    const win = i % 3 !== 0, sym = ['xyz:NVDA','xyz:AAPL','BTC'][i % 3];
    const pnl = win ? 12 : -25, dur = win ? 1 : 5;
    fills.push(f(sym,'B',100,1,now,0,0.2), f(sym,'A',100+pnl,1,now+dur*H,pnl,0.2));
    now += 26 * H;
  }
  fills.push(f('xyz:TSLA','B',400,2,Date.now()-2*H,0,0.5));   // posición abierta
  const funding = [{ time: Date.now()-30*864e5, delta:{ coin:'xyz:NVDA', usdc:'-0.8' } }];

  const g = id => __el(id);
  let fallos = 0;
  const chk = (c,m) => { if(!c) fallos++; console.log((c?'  ok  ':'  FAIL ')+m); };

  ingest({ user:'0x0000000000000000000000000000000000000001', fills, funding, state:null, pulledAt:Date.now() });
  chk(TRADES.length===51, 'trades reconstruidos: '+TRADES.length);
  chk(!g('app').classList.contains('hide'), 'panel principal visible');
  chk(g('fDex').innerHTML.includes('xyz'), 'filtro de dex poblado');

  setPreset('todo'); render();
  chk(g('count').textContent.includes('50 cerradas'), 'contador con todo el historial: '+g('count').textContent);
  chk(g('kpis').innerHTML.includes('PnL neto'), 'KPIs renderizados');
  chk(g('insights').innerHTML.includes('ins '), 'insights renderizados');
  chk(/Lo que hiciste/.test(g('insights').innerHTML), 'los insights salen separados en acciones');
  chk(/Cómo salió/.test(g('insights').innerHTML), 'y en cortes de resultado');
  chk(g('insights').innerHTML.indexOf('Lo que hiciste') < g('insights').innerHTML.indexOf('Cómo salió'),
    'las acciones van arriba del PnL');
  chk(g('tTrades').innerHTML.includes('<tbody>'), 'tabla de trades renderizada');
  chk(!g('openPanel').classList.contains('hide'), 'panel de posiciones abiertas visible');
  chk(g('tOpen').innerHTML.includes('TSLA'), 'la posición abierta aparece');
  chk((global.__charts||0) > 0, 'gráficos creados: '+(global.__charts||0));
  chk(g('muestraPanel').classList.contains('hide'), 'con 50 cerradas no sale el aviso de muestra chica');
  const sucio = ['kpis','insights','tTrades','tOpen','resumen','franja'].filter(id => /undefined|NaN/.test(g(id).innerHTML));
  chk(!sucio.length, 'sin NaN ni undefined en pantalla'+(sucio.length?': '+sucio.join(', '):''));

  chk(g('graficos').classList.contains('hide')===false, 'con datos, los gráficos están a la vista');
  chk(g('vacio').classList.contains('hide'), 'con datos, sin cartel de período vacío');

  // un día sin operar: el período arranca en hoy y los seis gráficos quedaban en blanco
  setPreset('hoy');
  g('fFrom').value='1999-01-01'; g('fTo').value='1999-01-01'; render();
  chk(g('graficos').classList.contains('hide'), 'período sin operaciones esconde los gráficos');
  chk(!g('vacio').classList.contains('hide'), 'y explica por qué');
  chk(/Sin operaciones en este período/.test(g('vacio').innerHTML), 'el cartel dice lo suyo: '+g('vacio').innerHTML.slice(0,60));
  setPreset('todo'); render();
  chk(!g('graficos').classList.contains('hide'), 'volver a Todo devuelve los gráficos');

  // el taladro es el mismo en los dos temas: se para sobre su propio fondo oscuro
  const oscuro = drillSvg('seco', false);
  aplicarTema('claro');
  const claro = drillSvg('seco', false);
  aplicarTema('oscuro');
  chk(oscuro === claro, 'el taladro no cambia de color con el tema');
  chk(/#e9f6f1/.test(claro), 'la mecha sigue siendo la misma en claro');

  /* La cara del aire va por id, no por tono. El tono 'ok' lo comparten hitos, ejercicio
     y aire, así que lo que hay que agarrar es que la cara no se derrame a los otros dos:
     un hito con los ojos tomados diría algo que el hito no dice.
     (Nada de backticks acá adentro: esto vive en un template literal.) */
  const caraDe = v => { renderTaladro(v); return g('cuerpo').innerHTML; };
  const cAire = caraDe({ tono:'ok', linea:'x', habla:true, id:'aire' });
  const cHito = caraDe({ tono:'ok', linea:'x', habla:true, id:'hito' });
  const cEjer = caraDe({ tono:'ok', linea:'x', habla:true, id:'ejercicio' });
  chk(cAire.includes('#eafff6'), 'el modo aire enciende la cara avatar');
  chk(!cHito.includes('#eafff6'), 'un hito con el mismo tono NO la recibe');
  chk(!cEjer.includes('#eafff6'), 'el ejercicio con el mismo tono tampoco');
  chk(cHito === cEjer, 'hito y ejercicio siguen compartiendo cara');

  /* Sin aura: si aparece un filtro de resplandor en el SVG, alguien la volvió un premio. */
  chk(!/feGaussianBlur|filter=/.test(cAire), 'la cara del aire no tiene resplandor');

  // el estado va en la clase, y es el espejo del tilt: uno tiembla, el otro se queda quieto
  renderTaladro({ tono:'ok', linea:'x', habla:true, id:'aire' });
  chk(g('tal').className.includes('airemode'), 'la clase airemode queda puesta');
  chk(!g('tal').className.includes('tiltmode'), 'y no convive con tiltmode');
  renderTaladro({ tono:'alerta', linea:'x', habla:true, id:'tilt' });
  chk(!g('tal').className.includes('airemode'), 'el tilt no deja airemode pegado');
  chk(/#c94f4f/.test(g('cuerpo').innerHTML), 'y vuelve a la paleta roja');

  // filtros
  g('fDex').value='xyz'; syncSyms(); render();
  chk(g('count').textContent.includes('34 cerradas'), 'filtro por dex xyz (17 NVDA + 17 AAPL): '+g('count').textContent);
  g('fSide').value='short'; render();
  chk(g('kpis').innerHTML.includes('Sin datos'), 'filtro sin resultados no rompe');
  g('fSide').value=''; g('fDex').value=''; syncSyms(); render();

  /* Cambiar de tema vuelve a llamar a render(): los gráficos llevan el color adentro.
     Contar que se rehicieron es lo que agarra una variable de color mal definida. */
  const antes = global.__charts || 0;
  aplicarTema('claro');
  chk((global.__charts||0) > antes, 'el tema claro repintó los gráficos: '+((global.__charts||0)-antes));
  chk(document.documentElement.getAttribute('data-tema')==='claro', 'el atributo de tema quedó en claro');
  aplicarTema('oscuro');
  chk(!/undefined|NaN/.test(g('kpis').innerHTML), 'después de ir y volver de tema, sin NaN');

  // modo aire: 40 operaciones sostenidas en el mismo sistema, EV positivo
  const limpias = [];
  for (let i = 0; i < 40; i++) {
    const gana = (i % 3) !== 0, t0 = Date.now() - (40 - i) * 26 * H;
    limpias.push(f('xyz:DRAM','B',10,1,t0,0,0.01), f('xyz:DRAM','A',gana?11:9.5,1,t0+2*H,gana?1:-0.5,0.01));
  }
  ingest({ user:'0x0000000000000000000000000000000000000001', fills: limpias, funding:[], state:null, pulledAt:Date.now() });
  setPreset('todo'); render();
  chk(!g('airePanel').classList.contains('hide'), 'con 40 dentro del sistema y EV+ aparece el modo aire');
  chk(/de tus últimas 30/.test(g('aireRacha').innerHTML), 'el encabezado cuenta sobre 30: '+g('aireRacha').textContent);
  chk(document.body.classList.contains('airepage'), 'la plata se difumina');
  chk(/Expectativa por operación/.test(g('aireSpec').innerHTML), 'muestra la expectativa');
  chk(!/undefined|NaN/.test(g('aireQue').innerHTML+g('aireSpec').innerHTML+g('airePie').innerHTML), 'aire sin NaN');
  chk(g('tiltPanel').classList.contains('hide'), 'tilt y aire no conviven');

  // aviso de muestra chica: la misma página con dos operaciones
  ingest({ user:'0x0000000000000000000000000000000000000001', fills: fills.slice(0,4), funding:[], state:null, pulledAt:Date.now() });
  setPreset('todo'); render();
  chk(!g('muestraPanel').classList.contains('hide'), 'con 2 cerradas aparece el aviso de muestra chica');
  chk(/2 operaciones cerradas/.test(g('muestraPanel').innerHTML), 'el aviso dice cuántas hay');
  chk(!/undefined|NaN/.test(g('muestraPanel').innerHTML), 'el aviso sin NaN');
  chk(g('airePanel').classList.contains('hide'), 'con 2 operaciones no hay modo aire');
  chk(!document.body.classList.contains('airepage'), 'y la plata se destapa sola');

  /* Holgura de punta a punta. Es el único dato que no se recalcula del historial: se anota
     mientras la posición está viva y queda pegado al trade cuando cierra. Todo lo anterior
     del humo corre con state:null, así que este camino no lo tocaba nadie. */
  {
    const t0 = Date.now() - 3 * H;
    const abierta = [f('xyz:DRAM','B',10,1,t0,0,0.01)];
    for (let i = 0; i < 12; i++) {
      const ti = Date.now() - (20 - i) * 26 * H;
      abierta.push(f('xyz:DRAM','B',10,1,ti,0,0.01), f('xyz:DRAM','A',10.5,1,ti+2*H,0.5,0.01));
    }
    const state = { marginSummary: { accountValue: '50' }, assetPositions: [
      { position: { coin: 'xyz:DRAM', szi: '1', entryPx: '10', positionValue: '10',
        liquidationPx: '9', marginUsed: '1', unrealizedPnl: '0', leverage: { value: 10 } } }
    ]};
    // stop a 2% del mark, liquidación a 10%: ratio 0.2, salís vos
    const orders = [{ coin: 'xyz:DRAM', isTrigger: true, triggerPx: '9.8', reduceOnly: true }];
    DATOS.holguras = {};
    ingest({ user:'0x0000000000000000000000000000000000000001', fills: abierta, funding:[],
      state, orders, pulledAt: Date.now() });
    setPreset('todo'); render();

    const claves = Object.keys(DATOS.holguras);
    chk(claves.length === 1, 'la posición viva quedó anotada: '+claves.length);
    const e = DATOS.holguras[claves[0]];
    chk(e && Math.abs(e.ratio - 0.2) < 0.01, 'con el ratio stop/liquidación correcto: '+(e && e.ratio));
    chk(e && e.estuvoSinStop === false, 'y sabiendo que tenía stop');

    // sin stop cargado, la posición queda marcada aparte y no inventa ratio
    DATOS.holguras = {};
    ingest({ user:'0x0000000000000000000000000000000000000001', fills: abierta, funding:[],
      state, orders: [], pulledAt: Date.now() });
    setPreset('todo'); render();
    const sinStop = DATOS.holguras[Object.keys(DATOS.holguras)[0]];
    chk(sinStop && sinStop.estuvoSinStop === true, 'sin stop cargado queda marcada');
    chk(sinStop && sinStop.ratio === null, 'y no inventa un ratio');
    chk(!/undefined|NaN/.test(g('insights').innerHTML), 'los insights con holgura, sin NaN');
  }

  /* Exposición de punta a punta: la cuenta se achica 85% con la conducta intacta.
     Con notional crudo esto sacaba media ventana fuera de rango y apagaba el aire. */
  {
    const nOps = 40, LEV = 20, base = 100;
    const fx = [], serie = [];
    let t0 = Date.now() - nOps * 26 * H;
    for (let i = 0; i < nOps; i++) {
      const col = base * Math.pow(0.15, i / (nOps - 1));
      serie.push([t0 - 1000, String(col)]);
      const sz = (col * LEV) / 10;
      const gana = (i % 3) !== 0;
      fx.push(f('xyz:DRAM','B',10,sz,t0,0,col*0.002),
        f('xyz:DRAM','A',gana?10.6:9.8,sz,t0+2*H,(gana?0.6:-0.2)*sz,col*0.002));
      t0 += 26 * H;
    }
    serie.push([t0, String(base * 0.15)]);
    ingest({ user:'0x0000000000000000000000000000000000000001', fills: fx, funding:[],
      state:null, portfolio: { xyz: [['allTime', { accountValueHistory: serie }]] }, pulledAt: Date.now() });
    setPreset('todo'); render();

    const st = computeStats(filtered(true), DATOS.holguras, RAW.portfolio);
    chk(st.escala.base === 'exposicion', 'con serie de cuenta, la escala pasa a exposición');
    const hb = habitos(st.trades, st).find(h => h.id === 'tamano');
    chk(hb.cumplidas === hb.deN, 'el colateral cayendo 85% no rompe el tamaño: '+hb.cumplidas+'/'+hb.deN);
    chk(!/undefined|NaN/.test(g('habitos').innerHTML), 'los hábitos con exposición, sin NaN');
    chk(!/undefined|NaN/.test(g('kpis').innerHTML+g('insights').innerHTML), 'la página con exposición, sin NaN');
  }

  /* El giro hacia Douglas: la serie declarada, las cinco verdades y la tesis previa.
     Estos tres tocan DATOS y el render, así que el camino entero tiene que andar. */
  {
    const fx = []; let t0 = Date.now() - 45 * 26 * H;
    for (let i = 0; i < 45; i++) {
      const gana = (i % 3) !== 0;
      fx.push(f('xyz:DRAM','B',10,2,t0,0,0.002),
        f('xyz:DRAM','A',gana?10.6:9.8,2,t0+2*H,(gana?1.2:-0.4),0.002));
      t0 += 26 * H;
    }
    DATOS.ejerc = null; DATOS.declaraciones = [];
    ingest({ user:'0x0000000000000000000000000000000000000001', fills: fx, funding:[],
      state:null, pulledAt: Date.now() });
    setPreset('todo'); render();

    chk(!g('ejercPanel').classList.contains('hide'), 'el panel de la serie aparece');
    chk(/Una serie/.test(g('ejercPanel').innerHTML), 'y ofrece empezar una');
    /* Las verdades ya no tienen panel: salen por el repertorio, de a una. */
    {
      const R = repertorio(computeStats(TRADES, DATOS.holguras, null, null, DATOS.ejerc));
      const V = R.filter(x => x.tipo === 'verdad');
      chk(V.length === 5, 'las cinco verdades entran al repertorio');
      chk(V.some(x => /Cualquier cosa puede pasar/.test(x.linea)), 'con la primera de Douglas');
      chk(!V.some(x => /undefined|NaN/.test(x.linea)), 'las verdades sin NaN');
      chk(R[0].tipo !== 'verdad' && R[R.length - 1].tipo !== 'verdad',
        'repartidas entre lo demás, no apiladas en una punta');
    }

    // arrancar una serie a mitad de camino
    const T = TRADES.filter(t => !t.open);
    DATOS.ejerc = { n: 20, reglas: ['perdida','tamano','intacto'],
      inicio: Date.now(), desde: T[24].exitTime };
    render();
    chk(/Serie/.test(g('ejercPanel').innerHTML), 'con serie declarada, el panel cambia');
    chk(/ejP/.test(g('ejercPanel').innerHTML), 'y dibuja el registro de conducta');
    chk(!/undefined|NaN/.test(g('ejercPanel').innerHTML), 'la serie sin NaN');

    // declarar una tesis antes de entrar
    DATOS.declaraciones = [{ tesis: 'Reversión', ts: Date.now() }];
    render();
    chk(/Reversión/.test(g('declarar').innerHTML), 'la tesis declarada se muestra');
    chk(!/undefined|NaN/.test(g('declarar').innerHTML), 'el declarador sin NaN');
    DATOS.ejerc = null; DATOS.declaraciones = [];
  }

  console.log('');
  console.log(fallos ? '  '+fallos+' fallo(s) de humo' : '  humo ok');
  if (fallos) process.exit(1);
})();
`;

eval(src + append);
