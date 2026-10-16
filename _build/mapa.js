/* Chequeo del mapa, a mano. NO lo corre el build, y eso está decidido:
   `talastrat-mapa.html` no entra a la página, así que acoplarlo al build que publica
   agregaría una forma de que el build falle por algo que el usuario no ve.

   El costo de esa decisión es que el mapa envejece sin que nada avise. Esto es lo que
   la baja: se corre a mano al cerrar un lote.

       node _build/mapa.js

   Verifica las dos cosas que sí son verificables, y ninguna de las dos es la prosa:

   1. Que las constantes del motor estén escritas igual en la tabla de umbrales. Es el
      mismo patrón que `build.py` usa con `FOMC_AVISO_DIAS`: se lee el valor de
      `engine.js` en vez de tener una copia.
   2. Que el mapa renderice sus cuatro tablas contra un DOM de mentira, y que ninguna
      pieza tenga campos que el render ignore. `por2` estuvo a punto de perderse así:
      escrito en los datos, invisible en pantalla, sin error.

   Lo que NO verifica, y es la mayor parte del archivo: si la prosa sigue siendo cierta.
   Eso se lee. */
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');

const eng = fs.readFileSync(path.join(RAIZ, '_build/engine.js'), 'utf8');
const html = fs.readFileSync(path.join(RAIZ, 'talastrat-mapa.html'), 'utf8');

let malas = 0;
const chk = (c, m) => { console.log((c ? '  ok  ' : '  FAIL ') + m); if (!c) malas++; };

/* ---- 1. las constantes ---- */
console.log('\nLas constantes del motor, como las escribe el mapa');
const valor = n => {
  const m = new RegExp('^const ' + n + ' *= *([^;/]+)', 'm').exec(eng);
  return m ? m[1].trim() : null;
};
/* [constante, cómo tiene que aparecer en la tabla de umbrales]. El segundo campo es una
   cadena que debe estar presente: el mapa escribe en castellano y con coma decimal, así
   que no se puede comparar contra el literal de JS. */
const ESPERA = [
  ['AIRE_VENT', '30', '"30 operaciones"'],
  ['AIRE_FALLAS', '2', '"2 permitidas en 30"'],
  ['AIRE_MIN', '30', 'AIRE_MIN'],
  ['EST_MIN_LADO', '5', '5 después de perder'],
  ['EST_TOL', '1.4', '[0,71 · 1,40]'],
  ['DIAS_MIN', '8', '8 días operados en total'],
  ['EXP_COBERTURA_MIN', '0.8', '0,8 de cobertura'],
  ['BANDA_TOL', '1.5', '1,5 × el promedio observado'],
  ['MUESTRA_MIN', '5', '5 operaciones cerradas'],
  ['HOLG_APRETADA', '0.6', '"0,6"'],
  ['FOMC_AVISO_DIAS', '60', '60 días de margen'],
  ['PERM_B', '2000', '2000 barajadas por corte'],
  ['BH_Q', '0.10', '10% de falsos descubrimientos']
];
for (const [n, esp, enMapa] of ESPERA) {
  const v = valor(n);
  chk(v === esp, `${n} = ${v} en el motor` + (v === esp ? '' : ` (el mapa se escribió contra ${esp})`));
  chk(html.includes(enMapa), `  y el mapa lo dice: ${enMapa}`);
}

/* Los hábitos son la cuenta que ya se desfasó una vez: al borrar `corte` quedaron cuatro
   en el motor, cinco en el mapa, cinco en el README y cinco en `PIEZAS`. */
const def = /const def = \[(.*?)\];/s.exec(eng);
const nHab = def ? (def[1].match(/\['/g) || []).length : 0;
const palabra = { 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis' }[nHab] || String(nHab);
console.log('');
chk(nHab > 0, `hábitos definidos en el motor: ${nHab}`);
chk(html.includes(palabra + ' conductas'), `el mapa dice "${palabra} conductas"`);
chk(eng.includes('las ' + palabra + ' conductas y sus rachas'), `y \`PIEZAS\` también`);
const readme = fs.readFileSync(path.join(RAIZ, 'README.md'), 'utf8');
chk(readme.includes(palabra.charAt(0).toUpperCase() + palabra.slice(1) + ' hábitos'),
  `y el README también`);

/* ---- 2. que renderice ---- */
console.log('\nEl mapa contra un DOM de mentira');
const els = {};
const mk = id => (els[id] = els[id] || {
  id, innerHTML: '', textContent: '', value: '', dataset: {},
  style: { setProperty() {} },
  classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
    toggle() {}, contains(c) { return this._s.has(c); } },
  addEventListener() {}, appendChild() {}, focus() {}, select() {}, blur() {},
  querySelector() { return null; }, querySelectorAll() { return []; },
  getBoundingClientRect() { return { width: 0, height: 0 }; }
});
global.window = global; global.innerWidth = 1200; global.innerHeight = 800;
global.document = {
  getElementById: mk, querySelector: s => mk('_qs' + s), querySelectorAll: () => [],
  createElement: () => mk('_new'), addEventListener() {},
  body: mk('_body'), documentElement: mk('_html')
};
global.Event = class { constructor(t) { this.type = t; } };

const bloques = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g) || [];
const src = bloques.map(b => b.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''))
  .sort((a, b) => b.length - a.length)[0];
eval(src + ';global.__T=TREE;');

for (const id of ['est', 'umb', 'reg', 'deu'])
  chk(mk(id).innerHTML.length > 400, `la tabla ${id} se armó`);
for (const id of ['deu', 'reg', 'umb', 'est'])
  chk(!/undefined|NaN|\[object Object\]/.test(mk(id).innerHTML), `${id} sin undefined ni NaN`);

/* Un campo escrito en TREE que el render no dibuja desaparece sin error. */
const CONOCIDAS = new Set(['nm', 'cp', 'des', 'fd', 'lead', 'pts', 'por', 'por2', 'no']);
const raras = [];
for (const g of global.__T) for (const f of g.items) for (const k of Object.keys(f))
  if (!CONOCIDAS.has(k)) raras.push(g.g + ' · ' + f.nm + ' · ' + k);
chk(raras.length === 0, 'ninguna pieza tiene campos que el render ignore' +
  (raras.length ? ': ' + raras.join(', ') : ''));

console.log(`\n  ${global.__T.reduce((a, g) => a + g.items.length, 0)} piezas en ` +
  `${global.__T.length} grupos\n`);
console.log(malas ? `  ${malas} para revisar` : '  mapa ok');
process.exit(malas ? 1 : 0);
