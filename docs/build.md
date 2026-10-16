# Build, tests y publicación

## Qué corta el build

El build corta si: quedan marcas sin reemplazar, aparece una dirección `0x…` en el HTML, algún `<script>` no compila (`node --check`), la página armada no renderiza, o alguna prueba de vista sale en rojo. Recién si pasa todo escribe `index.html`; el borrador que prueba vive en el temporal, así que un build roto deja lo anterior intacto.

**Los tres últimos chequeos existen por tres bugs reales, y son el mismo bug un piso más arriba cada vez.**

El primero: el build recortaba `engine.js` en `module.exports` para sacar código de node. Pero eso vive adentro de un `if (typeof module !== 'undefined') { … }`, así que el corte se comía la llave de cierre y el script entero quedaba roto. Los tests pasaban — corren `engine.js` suelto — y el build informaba éxito publicando una página muerta. El `if` ya protegía al navegador solo: no había nada que recortar.

El segundo: `const ROJO = () => cssVar('--down', ROJO())`. Sintaxis impecable, `node --check` conforme, todos los tests del motor en verde, y en el navegador `Maximum call stack size exceeded` en el primer render — que salía por pantalla como si fuera un error de la API de Hyperliquid. La lección es que revisar sintaxis no es revisar que ande: `smoke.js` ingesta datos sintéticos, renderiza, filtra, cambia de tema y mira que no queden `NaN`.

El tercero es el más incómodo de los tres, porque no fue un test que fallara sino uno que dejó de existir sin avisar. Los seis archivos de `_build/t/` leían un historial real por **ruta absoluta**, de una carpeta de subidas de una sesión vieja. Cuando esa carpeta desapareció, los seis pasaron a morir en `MODULE_NOT_FOUND` antes de la primera aserción. Y como el build nunca los había llamado, no había ningún lugar donde eso se viera: seguían listados acá arriba como si fueran parte de la suite.

**Un test que no puede correr es peor que un test que no existe, porque ocupa el lugar de la verificación sin hacerla.** Se arreglaron dos cosas y hay que sostener las dos: la fixture es sintética y vive en el repo (`t/fixture.js`), y el build corre la carpeta entera. Como `chk()` loguea y no cambia el código de salida, la señal de falla es la palabra `FAIL` en la salida — si alguna vez se cambia esa convención, hay que tocar `pruebas_de_vista` en `build.py` al mismo tiempo.


## Publicar

No hay automatización. Se compila acá y se sube `index.html` (y lo que se haya tocado) por la web de GitHub: `https://github.com/agroyffer/taladro/upload/main`. Después `Ctrl+Shift+R` y verificar el sello de versión abajo de todo.

Al arrastrar desde Windows, a veces sube el nombre corto de DOS (`SHELL~1.HTM`). Hay que renombrarlo en GitHub.


## El panel de diagnóstico

Plegado, al fondo, y **no habla de su operatoria**. Existe porque tres umbrales del motor se eligieron razonando y nunca se contrastaron contra una respuesta real: `EXP_COBERTURA_MIN` (0,8), `EQ_COLA` (7 días) y el 0,9 de concentración con el que `estabilidad` decide callarse. Los tres deciden si se puede confiar en la exposición, que es el denominador de `habitos.tamano`, `tilt`, `aire` y `estabilidad`.

Muestra tres cosas y **ninguna es una conclusión**: la resolución y el alcance real de la serie de colateral por dex, la distribución real de su escala de tamaño, y el ledger crudo. Cada bloque dice qué pregunta contesta y cuál es el umbral que se está usando, para que el número pueda contradecir la decisión.

Va plegado a propósito. Es un instrumento, no una pantalla de producto: nada de lo que dice le sirve para operar, así que no puede competir por la atención con lo que sí le sirve.
