require('./stub.js');
const src=require('fs').readFileSync(process.env.TALASTRAT_INLINE || '/tmp/inline.js','utf8');
const raw=JSON.parse(JSON.stringify(require('./fixture.js')));
raw.state.xyz.assetPositions=[]; raw.state.xyz.marginSummary.accountValue='3.42'; raw.orders.xyz=[];
global.__raw=raw;
__setRect('cuerpo',{left:1300,top:710,width:86,height:66});
global.__limpio = h => h.replace(/<[^>]+>/g,' | ').replace(/\s+/g,' ').replace(/\| \|/g,'|').trim();
const extra = `
;(function(){
  ingest(__raw);
  const g=id=>__el(id), chk=(c,m)=>console.log((c?'  ok  ':'  FAIL ')+m);
  chk(g('franja').innerHTML.includes('class="big mono'), 'franja con el numero grande');
  chk(g('resumen').innerHTML.includes('class="tira"'), 'tira densa');
  chk(!/undefined|NaN/.test(g('franja').innerHTML+g('resumen').innerHTML+g('mejorar').innerHTML), 'sin NaN');

  /* 1.8 — con muestra corta la cifra grande no existe. Se toca bySession de la sesion
     activa y se vuelve a dibujar: no hace falta una fixture nueva para probar un umbral. */
  var _id = sessionOf(Date.now());
  var _fake = function (n, net, wins) {
    var o = { bySession: {}, byTramo: {} };
    o.bySession[_id] = { n: n, net: net, wins: wins };
    return o;
  };
  renderFranja(_fake(1, 0.2, 1), []);
  chk(!/class="big/.test(g('franja').innerHTML), 'con n=1 la franja no dibuja la cifra grande');
  chk(/sin muestra para promediar/.test(g('franja').innerHTML), 'y dice el conteo crudo en vez de un promedio');
  chk(g('franja').innerHTML.indexOf('0,20') < 0, 'el neto de una sola operacion no aparece por ningun lado');
  renderFranja(_fake(3, 0.6, 2), []);
  chk(/class="big/.test(g('franja').innerHTML), 'con n=3 vuelve la cifra grande: el umbral es 3 y no 4');
  render();

  /* 4.8 — la holgura sale de datos que calcular() ya tenia: liq sobre stop. */
  __el('stopPct').value = '1'; __el('riesgo').value = '0.07';
  calcular();
  chk(/Holgura/.test(g('calc').innerHTML), 'el calculador muestra holgura antes de entrar');
  var _m = g('calc').innerHTML.match(/Holgura[^0-9]+([0-9.]+)x/);
  chk(!!_m && +_m[1] > 1, 'y es un multiplo mayor que 1: ' + (_m ? _m[1] + 'x' : 'no parseo'));

  /* 1.7 — el camino de Cargar JSON. Se prueba desdeArchivo() y no el onchange porque el
     FileReader del stub no dispara onload; lo que estaba roto era el armado del objeto. */
  var _o = desdeArchivo(__raw);
  chk(!!_o.portfolio, 'desdeArchivo conserva portfolio, que era el que rompia escalaTamano');
  chk(!!_o.orders, 'y orders, sin el cual no hay stop ni holgura de la posicion abierta');
  chk(!!_o.dexes, 'y dexes, que nadie habia listado nunca');
  chk(!!_o.diag, 'y cualquier campo futuro pasa solo: diag no esta en ningun default');
  var _viejo = desdeArchivo([{ coin: 'BTC' }]);
  chk(_viejo.fills.length === 1, 'un array pelado sigue siendo la lista de fills');
  chk(!('0' in _viejo), 'y no se cuela como claves numericas 0,1,2');
  chk(desdeArchivo(null).fills.length === 0, 'un JSON nulo no explota');

  /* El falsador de verdad no es la forma del objeto: es que la app termine midiendo
     exposicion por este camino. Antes daba 'notional' pasara lo que pasara. */
  ingest(desdeArchivo(JSON.parse(JSON.stringify(__raw))));
  chk(escalaTamano(TRADES).base === 'exposicion',
    'y por Cargar JSON la app mide exposicion, no notional crudo: ' + escalaTamano(TRADES).base);
  console.log('');
  console.log('  FRANJA: ' + __limpio(g('franja').innerHTML));
  console.log('');
  console.log('  TIRA:   ' + __limpio(g('resumen').innerHTML));
  console.log('');
  console.log('  OBJETIVO nivel 1: ' + __limpio(g('mejorar').innerHTML));
  DATOS.objetivo = { id: DATOS.objetivo.id, ops: 0 };
  render();
  console.log('');
  console.log('  OBJETIVO nivel 3: ' + __limpio(g('mejorar').innerHTML));
  chk(g('mejorar').innerHTML.includes('mcomp'), 'aparece el boton de compromiso');
  chk(g('mejorar').innerHTML.includes('n3'), 'nivel 3 marcado');
})();
`;
eval(src + extra);
