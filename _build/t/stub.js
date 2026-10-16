const els = {}, rects = {};
function el(id){
  if(els[id]) return els[id];
  return els[id] = { id, value:'', textContent:'', innerHTML:'', dataset:{}, files:[],
    style:{ setProperty(){} },
    _a:{}, setAttribute(k,v){ this._a[k]=v; }, getAttribute(k){ return this._a[k]||null; },
    classList:{ _s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)},
      /* devolvía !v, al revés que el DOM real y al revés que el classList de body veinte
         líneas más abajo. Nadie usaba el valor de retorno todavía; el primero que lo usara
         leía lo contrario de lo que puso y el test iba a mentir en verde. */
      toggle(c,on){ const h=this._s.has(c); const v = on===undefined? !h : !!on; v?this._s.add(c):this._s.delete(c); return v; },
      contains(c){return this._s.has(c)} },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    getBoundingClientRect(){ return rects[id] || {left:0,top:0,width:0,height:0}; },
    click(){}, focus(){}, scrollIntoView(){} };
}
global.__setRect = (id,r) => { rects[id] = r; };
global.__el = el;
global.document = { getElementById: el, createElement: () => el('_t'+Math.random()), addEventListener(){},
  querySelector(s){ return el('_qs'+s); }, querySelectorAll(){return []},
  documentElement: { _a:{}, setAttribute(k,v){this._a[k]=v}, getAttribute(k){return this._a[k]||null}, style:{} } };
/* El tema se resuelve leyendo CSS de verdad, que en node no existe: devolver vacío
   obliga al código a caer en el color por defecto, que es justo lo que hay que probar. */
global.getComputedStyle = () => ({ getPropertyValue: () => '' });
global.matchMedia = () => ({ matches: false });
global.Chart = class { constructor(){ global.__charts=(global.__charts||0)+1; } destroy(){} };
global.window = global; global.FSA = false; global.setInterval = () => {};
global.fetch = async () => { throw new Error('sin red'); };
global.FileReader = class { readAsText(){} };
const _ls = new Map();
global.localStorage = { getItem:k=>_ls.has(k)?_ls.get(k):null, setItem:(k,v)=>_ls.set(k,String(v)), removeItem:k=>_ls.delete(k) };
global.indexedDB = undefined;
global.addEventListener = () => {}; global.scrollTo = () => {}; global.scrollY = 0;
global.document.body = { classList:{ _s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)},
  toggle(c,on){const h=this._s.has(c); const v = on===undefined? !h : !!on; v?this._s.add(c):this._s.delete(c); return v;},
  contains(c){return this._s.has(c)} }, style:{ _v:{}, setProperty(k,v){this._v[k]=v} } };
