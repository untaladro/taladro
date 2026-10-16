/* 5.5 — Las dos columnas de desktop.

   No se verifica que "se vea bien", que ningun test puede saber, sino las tres decisiones
   que se tomaron y que se romperian **en silencio** si alguien las toca:

   1. Mobile es el caso por defecto. `.col{display:contents}` sin media query significa que
      un panel nuevo cae en la pila de siempre sin que nadie tenga que pensar en desktop.
   2. El tilt y el aire cruzan las dos columnas, porque existen para interrumpir.
   3. La izquierda va primera en el DOM. No es cosmetico: el auto-placement de grid no
      retrocede, asi que con la derecha adelante la izquierda caeria una fila mas abajo,
      y la portada quedaria con un hueco arriba sin que nada falle.

   Es el primer test de vista que mira el CSS y la estructura y no solo el DOM simulado.
   El motivo es que `stub.js` fabrica elementos por id a demanda y no tiene arbol: no
   puede contestar "esto viene antes que aquello". Eso lo sabe el HTML armado, que
   `build.py` ahora pasa en TALASTRAT_HTML junto con TALASTRAT_CSS. */
const fs = require('fs');
const css = fs.readFileSync(process.env.TALASTRAT_CSS || '/tmp/inline.css', 'utf8')
  .replace(/\s+/g, '');
const html = fs.readFileSync(process.env.TALASTRAT_HTML || '/tmp/inline.html', 'utf8');
const chk = (c, m) => console.log((c ? '  ok  ' : '  FAIL ') + m);

/* --- El CSS --- */
chk(/\.col\{display:contents\}/.test(css),
  'sin media query los envoltorios no existen: mobile queda como la pila de siempre');
const i = css.indexOf('@media(min-width:1000px)');
chk(i > 0, 'las dos columnas entran por media query, no al reves');
const dos = css.slice(i);
chk(/\.col-izq\{grid-column:1\}/.test(dos) && /\.col-der\{grid-column:2\}/.test(dos),
  'la decision a la izquierda y el contexto a la derecha');
chk(/#muestraPanel,#tiltPanel,#airePanel,#verMas,#detalle\{grid-column:1\/-1\}/.test(dos),
  'el tilt y el aire cruzan las dos columnas: existen para interrumpir');

/* --- La estructura --- */
const app = html.slice(html.indexOf('<div id="app"'), html.indexOf('id="verMas"'));
const pos = s => app.indexOf(s);
chk(pos('col col-izq') > 0 && pos('col col-der') > 0, 'las dos columnas existen');
chk(pos('col col-izq') < pos('col col-der'),
  'la izquierda va primera: el auto-placement de grid no retrocede');
chk(pos('col col-der') < pos('id="franja"') && pos('id="franja"') < pos('id="resumen"'),
  'franja y tira son contexto y viven a la derecha, en ese orden');
chk(pos('col col-izq') < pos('id="enTrade"') && pos('id="enTrade"') < pos('id="prepPanel"'),
  'con posicion abierta la decision ES esa posicion: enTrade encabeza la izquierda');
chk(pos('id="tiltPanel"') < pos('col col-izq'),
  'el tilt queda fuera de las columnas, arriba de las dos');
