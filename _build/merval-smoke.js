/* Prueba de humo del modo Merval: corre la página armada contra un DOM de mentira.

   Existe por lo mismo que `smoke.js` en el modo perps: `node --check` mira sintaxis y
   no llamadas, y `merval-test.js` prueba el motor suelto. Ninguno de los dos toca el
   render. Una página que compila y tiene los 87 tests en verde puede salir muda.

       node _build/merval-smoke.js [ruta/a/merval.html]

   Sale con código 1 si algo falla, para que build.py pueda cortar. */

'use strict';
const fs = require('fs'), path = require('path');

/* ===== DOM de mentira =====
   Mínimo y propio: el `stub.js` de perps fabrica cosas que este modo no usa, y
   depender de él ataría dos productos que se mueven por separado. */
const NODOS = {};
function nuevo(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    _cls: [], style: {}, dataset: {}, children: [], value: '', files: null,
    _html: '', _txt: '', _ev: {},
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); },
    get textContent() { return this._txt; },
    set textContent(v) { this._txt = String(v); },
    get className() { return this._cls.join(' '); },
    set className(v) { this._cls = String(v).split(/\s+/).filter(Boolean); },
    classList: {
      add: function (c) { if (!el._cls.includes(c)) el._cls.push(c); },
      remove: function (c) { el._cls = el._cls.filter(x => x !== c); },
      contains: function (c) { return el._cls.includes(c); }
    },
    addEventListener: function (t, f) { (this._ev[t] = this._ev[t] || []).push(f); },
    appendChild: function (c) { this.children.push(c); return c; },
    click: function () { (this._ev.click || []).forEach(f => f({ target: this })); },
    focus: function () {},
    disparar: function (t, ev) {
      const fs2 = (this._ev[t] || []).slice();
      if (t === 'click' && this.onclick) fs2.push(this.onclick);
      if (t === 'change' && this.onchange) fs2.push(this.onchange);
      fs2.forEach(f => f(ev || { target: this }));
    }
  };
  return el;
}
function el(id) { return NODOS[id] || (NODOS[id] = nuevo('div')); }

global.document = {
  getElementById: el,
  createElement: nuevo,
  addEventListener: () => {}
};
global.window = global;
global.localStorage = {
  _d: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; }
};
global.confirm = () => true;
global.alert = () => {};
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} };
global.Blob = function () {};
global.FileReader = function () { this.readAsText = () => {}; };

/* ===== la página ===== */
const HTML = process.argv[2] || path.join(__dirname, '..', 'merval.html');
if (!fs.existsSync(HTML)) { console.log('  FAIL  no existe ' + HTML); process.exit(1); }
const bloques = fs.readFileSync(HTML, 'utf8')
  .match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g) || [];
if (!bloques.length) { console.log('  FAIL  la página no tiene scripts'); process.exit(1); }
const src = bloques[bloques.length - 1].replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');

let fallos = 0;
const chk = (c, m) => { if (!c) fallos++; console.log((c ? '  ok  ' : '  FAIL ') + m); };

/* El guard de la página es `document.getElementById('tal')`, que con este DOM siempre
   devuelve algo, así que `inicio()` corre solo al evaluar el script. */
const HOY = Date.now(), DIA_ = 864e5;
const ctx = { chk, el, HOY, DIA_ };
try {
  new Function('chk', 'el', 'HOY', 'DIA_', src + `
;(function(){
  /* --- arranque en frío: sin plan --- */
  chk(el('tal').classList.contains('nose'), 'sin plan, Taladrín arranca en la cara del null');
  chk(el('est').textContent === 'NO SÉ', 'y el rótulo lo dice: ' + el('est').textContent);
  chk(el('drill').innerHTML.indexOf('<svg') === 0, 'el taladro se dibuja');
  chk(/Todavía no declaraste/.test(el('tTr').innerHTML), 'la tabla de tramos explica que está vacía');
  chk(/declararla es el ejercicio/.test(el('tObj').innerHTML), 'el objetivo vacío dice por qué no se importa');

  /* --- se carga un plan y se ejecuta --- */
  PLAN.objetivo = [
    { ticker:'GGAL', peso:25, sector:'bancos' }, { ticker:'YPFD', peso:25, sector:'energia' },
    { ticker:'PAMP', peso:25, sector:'energia' }, { ticker:'TXAR', peso:25, sector:'industria' }
  ];
  PLAN.reglas = { maxPos:30, maxSector:60, minPosiciones:4 };
  PLAN.tramos = ['GGAL','YPFD','PAMP','TXAR','GGAL','YPFD'].map((tk,i)=>({
    id:'t'+i, ticker:tk, monto:100000, tipo: i===4?'mercado':'limite',
    desde:HOY-(30-i*3)*DIA_, hasta:HOY-(26-i*3)*DIA_, declarado:HOY-(30-i*3)*DIA_,
    ejec: i<5 ? { ts:HOY-(28-i*3)*DIA_, ticker:tk, monto:100000,
                  tipo: i===3?'mercado':'limite', lleno:true } : null
  }));
  guardar();

  chk(el('habs').innerHTML.indexOf('card') > -1, 'las tarjetas de hábitos se renderizan');
  chk(/%/.test(el('dist').textContent), 'la distancia al objetivo sale con número: ' + el('dist').textContent);
  chk(el('senales').innerHTML.length > 200, 'el panel de señales tiene contenido');
  chk(/choca|ok|sin dato/.test(el('contr').innerHTML), 'las contradicciones se pintan');

  /* El tramo 5 venció sin ejecutar: la cara tiene que endurecerse y ofrecer las dos salidas. */
  chk(el('tal').classList.contains('apretado'), 'con un tramo vencido, la cara es apretado');
  chk(/editar el plan/.test(el('salidas').textContent), 'y ofrece editar el plan, no solo comprar');
  chk(/\\d/.test(el('dice').textContent), 'la voz lleva un número: ' + el('dice').textContent);

  /* --- el estado del null se dibuja de verdad --- */
  PLAN.tramos.forEach(t => { t.ejec = null; t.hasta = HOY + 40*DIA_; });
  guardar();
  chk(el('tal').classList.contains('nose'), 'todo pendiente vuelve a la cara del null, no a reposo');

  /* --- ninguna palabra de resultado en lo que se pinta --- */
  const pintado = ['habs','senales','notaTray','notaTec','dice','contr']
    .map(i => el(i).innerHTML + ' ' + el(i).textContent).join(' ');
  chk(!/pnl|ganancia|rendimiento|retorno/i.test(pintado),
    'nada de lo que se pinta habla de resultado');

  /* --- persistencia --- */
  chk(localStorage.getItem('talastrat.merval.v1') !== null, 'el plan se guarda en el navegador');
})();`)(chk, el, HOY, DIA_);
} catch (e) {
  console.log('  FAIL  la página reventó al correr: ' + (e && e.message));
  console.log('        ' + String(e && e.stack || '').split('\n').slice(1, 4).join('\n        '));
  fallos++;
}

console.log(fallos ? `\n  ${fallos} falla(s)` : '\n  humo del modo Merval ok');
process.exit(fallos ? 1 : 0);
