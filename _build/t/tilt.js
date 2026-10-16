require('./stub.js');
const src = require('fs').readFileSync(process.env.TALASTRAT_INLINE || '/tmp/inline.js','utf8');
const raw = require('./fixture.js').armar({ tilt: true });
raw.state.xyz.assetPositions = []; raw.orders.xyz = [];
global.__raw = raw;
const extra = [
';(function(){',
'  const g = id => __el(id), chk = (c,m) => console.log((c ? "  ok  " : "  FAIL ") + m);',
'  ingest(__raw);',
'  chk(document.body.classList.contains("tiltpage"), "la pantalla entera entra en tilt");',
'  chk(document.body.style._v["--tf"] !== undefined, "intensidad segun la racha: --tf = " + document.body.style._v["--tf"]);',
'  chk(g("franja").innerHTML.includes("plata"), "el numero de la franja queda tapado");',
'  chk(g("resumen").innerHTML.includes("plata"), "el neto de hoy queda tapado");',
'  chk(g("tiltSpec").innerHTML.includes("Tamaño máximo"), "especificacion de la proxima");',
'  chk(!/undefined|NaN/.test(g("tiltSpec").innerHTML), "sin NaN");',
'  console.log("");',
'  console.log("  SPEC: " + g("tiltSpec").innerHTML.replace(/<[^>]+>/g," ").replace(/[ ]+/g," ").trim());',
/* 3.1 — El tilt promete un número y `limpia()` mide otro si alguien vuelve a escribir el
   múltiplo a mano en la vista. Con un techo declarado ridículamente bajo, la spec y la
   salida tienen que decir ese techo exacto: si aparece un 1,5 en el medio, se ve acá. */
'  DATOS.banda = { banda: 0.07, desde: Date.now() }; ingest(__raw);',
'  const spec = g("tiltSpec").innerHTML, sal = g("tiltSalida").innerHTML;',
'  chk(spec.includes("0,07"), "la spec dice el techo declarado exacto, sin multiplicarlo: " + /Pérdida[^<]*<b[^>]*>([^<]+)/.exec(spec.replace(/<\\/?span[^>]*>/g,""))?.[1]);',
'  chk(sal.includes("0,07") && sal.includes("declaraste"), "y como se sale promete el mismo numero");',
'  DATOS.banda = null;',
'  g("destapar").onclick();',
'  chk(document.body.classList.contains("destapado"), "se pueden destapar a mano");',
'  chk(g("destapar").textContent === "Volver a taparlos", "y volver a taparlos");',
'})();'
].join("\n");
eval(src + extra);
