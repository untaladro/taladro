/* 4.5 — La cinta del día, del lado de la vista.

   **La regla que define el ítem no se puede verificar en el motor**: que los segmentos se
   pinten por adherencia y jamás por frecuencia ni por PnL. `adherenciaSesion` puede estar
   perfecta y el render tomar `bySession[x].net` para el color, y no falla ningún test —
   solo se convierte en su opuesto. De eso se trata este archivo.

   Si alguna vez alguien lo pinta por neto, el ítem se convirtió en lo contrario de lo que
   era y hay que revertirlo sin discutir. Acá está la alarma. */
require('./stub.js');
const src = require('fs').readFileSync(process.env.TALASTRAT_INLINE || '/tmp/inline.js', 'utf8');
const raw = JSON.parse(JSON.stringify(require('./fixture.js')));
global.__raw = raw;
global.__limpio = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const extra = `
;(function(){
  const g = id => __el(id), chk = (c,m) => console.log((c?'  ok  ':'  FAIL ')+m);
  ingest(__raw);
  const m = g('mapaDia').innerHTML;

  chk(m.includes('class="mapa"'), 'el mapa se dibuja');
  chk(/class="ma /.test(m), 'con sus arcos');
  chk(!/undefined|NaN/.test(m), 'sin NaN');

  /* **Anillo y no gajos radiales.** "Cuándo operás" ya usa gajos que crecen con la
     frecuencia y se pintan por PnL; dos relojes casi idénticos con variables opuestas se
     confunden. Acá el grosor es constante y lo único que codifica es el color. */
  chk(m.includes('<svg'), 'es un SVG circular');
  chk(!/class="mg |class="mfila"/.test(m), 'y ya no queda nada de la cinta recta');

  /* El día es cíclico: Asia cruza medianoche y tiene que ser UN arco, no dos. En la tira
     recta quedaba partida en las dos puntas y se leía como dos franjas distintas. */
  const arcos = [...m.matchAll(/class="ma [a-z]+"/g)].length;
  chk(arcos >= 5, arcos + ' arcos dibujados');
  chk(arcos === cintaDelDia().arcos.length, 'uno por arco, con la medianoche ya fusionada');
  /* Con reloj fijo en un miércoles: de viernes a domingo el día termina en finde y no hay
     nada que fusionar, y la prueba fallaba según el día en que se corriera el build. */
  const mie = cintaDelDia(Date.parse('2026-10-14T15:00:00Z'));
  chk(mie.arcos.length < mie.segmentos.length,
    'y hay menos arcos que segmentos, que es la fusión funcionando');

  /* **La regla.** Los únicos tonos permitidos son los cuatro de adherencia. */
  const tonos = [...new Set([...m.matchAll(/class="ma ([a-z]+)"/g)].map(x => x[1]))];
  const permitidos = ['ok','medio','roto','sd','plano'];
  chk(tonos.every(t => permitidos.includes(t)), 'los tonos son solo de adherencia: ' + tonos.join(', '));
  /* Una línea y lo largo por hover: nadie lee un párrafo abajo de un gráfico, y la app
     ya tiene el canal: data-tal hace que Taladrín lo explique al pasar por encima. */
  chk(/data-tal="[^"]{80,}"/.test(m), 'la explicación larga vive en el hover de Taladrín');
  /* Solo el pie: '__limpio' sobre todo el SVG cuenta los <title> de los tooltips, que no
     son texto visible. Lo que se mide es lo que se lee sin pasar el mouse. */
  const tras = (m.split('class="hint"')[1] || '');
  const visible = __limpio(tras.slice(tras.indexOf('>') + 1).split('</div>')[0] || '');
  chk(visible.length < 120, 'y el texto visible es corto: ' + visible.length + ' caracteres');
  chk(/tus reglas|te portás igual/.test(m), 'hablado como él y no como el motor');
  chk(!m.includes('El color es adherencia'), 'ya no arranca con la palabra del motor');
  chk(/class="ma sd"/.test(m), 'las celdas sin muestra van en gris y no en el tono de 0%');

  /* Los puntos de las operaciones no pueden llevar color de resultado: el mapa mide
     conducta, y un punto verde o rojo lo convertiría en otro corte de PnL. */
  chk(!/class="mop [a-z]/.test(m), 'los puntos de hoy no llevan color de resultado');

  /* **El aviso de si las franjas separan.** Medido sobre la cuenta real el 3/8: nueve
     celdas entre 72% y 88% y p = 0,37 — no separan. Sin este aviso los colores sugieren un
     patrón que la estadística no sostiene, que es exactamente lo que 3.5 vino a arreglar en
     comparativas. El día que separen, el aviso cambia de texto solo. */
  chk(/palos en la rueda|te portás igual a toda hora/.test(m),
    'el mapa dice si sus franjas separan o no');
  /* **Sin señal no se colorea.** Pintar de verde y rojo una variación que el test de
     permutación dice que es azar es lo mismo que 3.5 vino a arreglar en comparativas. */
  const fr = SBASE && SBASE.franjas;
  if (fr && fr.separa === false)
    chk(/class="ma plano"/.test(m) && !/class="ma (ok|roto|medio)"/.test(m),
      'con franjas que no separan, el anillo va en un solo tono neutro');

  /* Ninguna mitigación puede caerse en silencio. */
  chk(!/próximo tramo|falta[n]? \\d|en \\d+ min|empieza en/i.test(m),
    'ningún marcador de próximo tramo ni cuenta regresiva');
  const voz = (g('dice').innerHTML || '');
  chk(!/mapa|cinta|franja habitual/i.test(voz), 'y Taladrín no habla del mapa');

  console.log('');
  console.log('  ' + __limpio(m).slice(0, 170));
})();
`;
eval(src + extra);
