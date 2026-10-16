require('./stub.js');
const src = require('fs').readFileSync(process.env.TALASTRAT_INLINE || '/tmp/inline.js','utf8');
const conPos = require('./fixture.js');
const flat = JSON.parse(JSON.stringify(conPos));
flat.state.xyz.assetPositions = []; flat.orders.xyz = [];
global.__conPos = conPos; global.__flat = flat;
const extra = [
';(function(){',
'  const g = id => __el(id), chk = (c,m) => console.log((c ? "  ok  " : "  FAIL ") + m);',
'  ingest(__conPos);',
'  chk(/enpos/.test(g("tal").className), "con posicion abierta marca enpos: " + g("tal").className);',
'  chk(!g("cuerpo").innerHTML.includes("q2.8 2.2 5.6 0"), "no duerme: los ojos no estan cerrados");',
'  chk(g("app").classList.contains("dentro"), "con posicion abierta la portada entra en modo dentro");',
'  chk(g("setup").classList.contains("compacto"), "el alta queda plegada despues de ingest");',
'  chk(g("chip").getAttribute("aria-expanded") === "false", "y el chip lo dice: aria-expanded=false");',
'  chk(/0x/.test(g("chip").textContent), "el chip muestra la direccion: " + g("chip").textContent);',
'  chk(/datos de \\d/.test(g("vivo").textContent), "plegada, la linea igual dice de cuando son los numeros: " + g("vivo").textContent);',
'  plegarAlta(false);',
'  chk(!g("setup").classList.contains("compacto"), "plegarAlta(false) despliega el alta");',
'  chk(g("chip").getAttribute("aria-expanded") === "true", "y el aria acompaña, sin escribirse en otro lado");',
'  chk(!g("lema").classList.contains("hide"), "y vuelve el lema");',
'  ingest(__flat);',
'  chk(!/enpos/.test(g("tal").className), "sin posicion, sin enpos");',
'  chk(!g("app").classList.contains("dentro"), "sin posicion se sale de modo dentro");',
'  chk(g("setup").classList.contains("compacto"), "y el alta se vuelve a plegar sola");',
'  console.log("");',
'  console.log("  el boton, ciclo completo:");',
'  for (let i = 0; i < TAPAS.length; i++) {',
'    console.log("   " + String(i+1).padStart(2) + ". abrir: " + tapa(i)[0].padEnd(22) + " cerrar: " + tapa(i)[1]);',
'  }',
'  chk(TAPAS.length === 14, "catorce variantes");',
'})();'
].join("\n");
eval(src + extra);
