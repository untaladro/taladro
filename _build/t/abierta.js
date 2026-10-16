/* Una posicion abierta no se filtra por fecha.

   El bug lo encontro un tester con una wallet que no habia operado hoy. El filtro
   arranca en "Hoy" (`data-p="hoy"` con `class="on"`), asi que `#graficos` se escondia
   entero — eso es lo esperado y lo explica el cartel de `#vacio`. Lo que no era
   esperado: la posicion abierta tambien desaparecia, porque `renderTables` sacaba las
   abiertas de `sel`, que esta filtrado por `entryTime`. Una posicion que entro ayer y
   sigue viva no entra en el rango de hoy.

   El resultado era una contradiccion visible en pantalla: `analyzePositions` lee LIVE
   y no el filtro, asi que el globo del taladro avisaba "estas sin stop" sobre una
   posicion que la tabla se negaba a mostrar, y el contador decia "0 abiertas".

   La distincion que fija este test es conceptual y vale mas que la tabla: el rango de
   fechas contesta "que hiciste en este rango". Una posicion abierta no esta en ningun
   rango — esta ahora. Los demas filtros (dex, simbolo, lado) si se aplican, porque esos
   describen que estas mirando y no cuando.

   El cuarto chk es el que impide arreglar de mas: las cerradas tienen que seguir
   filtradas. Un fix que le sacara la fecha a todo pasaria los tres primeros. */
require('./stub.js');
const src = require('fs').readFileSync(process.env.TALASTRAT_INLINE || '/tmp/inline.js', 'utf8');

/* La fixture abre la posicion hace dos horas, o sea hoy: con eso el bug no aparece.
   Se corre ese unico fill tres dias para atras. No hace falta tocar `state` ni
   `orders` — la tabla de abiertas se arma desde los fills reconstruidos, y dejar la
   posicion viva en `state` es justamente lo que crea la contradiccion a probar. */
const raw = JSON.parse(JSON.stringify(require('./fixture.js')));
const vieja = raw.fills[raw.fills.length - 1];
if (vieja.coin !== 'xyz:SPCX') throw new Error('la fixture cambio: el ultimo fill ya no es la abierta');
vieja.time -= 3 * 864e5;
vieja.tid = vieja.time;
global.__raw = raw;

const extra = `
;(function(){
  ingest(__raw);
  const g = id => __el(id), chk = (c,m) => console.log((c ? '  ok  ' : '  FAIL ') + m);

  /* El escenario del tester, escrito a mano y no heredado del default, para que el test
     siga probando esto aunque alguien cambie con que periodo arranca la pagina. */
  var hoy = localDay(Date.now());
  g('fFrom').value = hoy; g('fTo').value = hoy;
  render();

  chk(!g('openPanel').classList.contains('hide'),
    'con el filtro en hoy y la posicion abierta anteayer, el panel de abiertas sigue visible');
  chk(/SPCX/.test(g('tOpen').innerHTML),
    'y la tabla la nombra, no solo se destapa el panel vacio');
  chk(/1 abiertas/.test(g('count').textContent),
    'el contador cuenta las vivas y no las del rango: ' + g('count').textContent);

  /* El control. Sin esto, "sacarle la fecha a todo" pasaria los tres de arriba.
     La fixture cierra 34 operaciones repartidas en los ultimos siete dias y pico, asi
     que unas cuantas caen hoy: el contador tiene que decir menos que 34. */
  var cerradasHoy = +(/^(\\d+) cerradas/.exec(g('count').textContent) || [])[1];
  chk(cerradasHoy > 0 && cerradasHoy < 34,
    'las cerradas siguen filtradas por fecha: ' + cerradasHoy + ' de 34 en el rango de hoy');

  /* La version fuerte, y la que de verdad separa el estado del evento: un periodo que
     no contiene ni la entrada de la abierta ni ningun cierre. La fixture empieza hace
     siete dias y pico, asi que hace treinta no hay absolutamente nada. */
  var lejos = localDay(Date.now() - 30 * 864e5);
  g('fFrom').value = lejos; g('fTo').value = lejos;
  render();
  chk(!g('vacio').classList.contains('hide'),
    'en un periodo sin nada cerrado aparece el cartel de vacio, como corresponde');
  chk(g('count').textContent.indexOf('0 cerradas') === 0,
    'y el contador dice cero cerradas: ' + g('count').textContent);
  chk(!g('openPanel').classList.contains('hide'),
    'pero la abierta sigue ahi: no esta en ese rango ni en ninguno, esta ahora');

  g('fFrom').value = hoy; g('fTo').value = hoy;
  render();

  /* Los demas filtros no son la fecha y tienen que seguir mordiendo, tambien sobre las
     abiertas: filtrar por simbolo es decir que estas mirando. */
  g('fSym').value = 'xyz:DRAM';
  render();
  chk(g('openPanel').classList.contains('hide'),
    'filtrando por otro simbolo la abierta si se esconde: la fecha es la excepcion, no el resto');
})();
`;
eval(src + extra);
