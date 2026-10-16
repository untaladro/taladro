/* 3.5 — La tabla de comparativas del lado de la vista.
   Lo que el motor no puede contestar: que las dos columnas de la derecha estén las dos, y
   sobre todo que **el aviso de cuántos cortes se probaron exista**. Sin ese aviso la tabla
   se lee como una lista de hallazgos y la fila de arriba parece un descubrimiento, que es
   exactamente el problema que este ítem vino a arreglar. */
require('./stub.js');
const src = require('fs').readFileSync(process.env.TALASTRAT_INLINE || '/tmp/inline.js', 'utf8');
const raw = JSON.parse(JSON.stringify(require('./fixture.js')));
global.__raw = raw;
global.__limpio = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const extra = `
;(function(){
  const g = id => __el(id), chk = (c,m) => console.log((c?'  ok  ':'  FAIL ')+m);
  ingest(__raw);

  const t = g('tComp').innerHTML, nota = g('compNota').innerHTML;
  chk(t.includes('<th>Épocas</th>'), 'la columna de split-half se llama Épocas');
  chk(t.includes('<th>p</th>'), 'y al lado está la del p-value');
  chk(!t.includes('<th>Estable</th>'), 'la columna vieja no quedó duplicada');
  chk(!/undefined|NaN/.test(t), 'la tabla sin NaN');

  /* La que importa. */
  chk(nota.length > 40, 'el aviso de comparaciones múltiples existe');
  chk(/Se probaron <b>\\d+<\\/b> cortes/.test(nota), 'y dice cuántos cortes se probaron');
  chk(nota.includes('Benjamini-Hochberg'), 'nombrando la corrección, para que se pueda buscar');
  chk(!/undefined|NaN/.test(nota), 'el aviso sin NaN');

  /* Con datos sintéticos no sobrevive nada, y esa rama tiene que decir algo útil en vez
     de quedar muda: es el caso más probable en una cuenta real. */
  chk(nota.includes('ninguno'), 'con cero sobrevivientes lo dice con todas las letras');
  chk(nota.includes('para mirar, no para decidir'), 'y aclara para qué sirve la tabla igual');
  /* La frase se arma con tres condicionales y la concordancia se rompe sin error: la
     primera versión decía "ninguno aguantan". */
  chk(!/ninguno<\\/b> aguantan|<b>1<\\/b> aguantan/.test(nota), 'y concuerda en número');

  console.log('');
  console.log('  ' + __limpio(nota));
})();
`;
eval(src + extra);
