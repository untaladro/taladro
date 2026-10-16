# Talastrat

Personal trainer de trading para Hyperliquid y trade.xyz. **Una sola página HTML, sin servidor**, publicada en <https://agroyffer.github.io/taladro/>. Repo `agroyffer/taladro`. La mascota se llama **Taladrin**.

El usuario es Adrián: argentino, colateral chico, apalancamiento alto, perps HIP-3. **Escribile en castellano rioplatense.**

---

## 1. RESTRICCIÓN

**Nunca pide clave privada.** No opera, no mueve fondos, todo se procesa en el navegador. Ningún archivo con una wallet real va al repo.
→ *Qué lo cambiaría:* nada. Si esto cae, lo que queda es otro producto.

Es la única restricción. Todo lo demás en este documento es discutible y dice cómo discutirlo.

---

## 2. Reglas duras

- **No edites `index.html`.** Es generado. Editá `_build/engine.js` (lógica, sin DOM) o `_build/shell.html` (estilos, HTML, SVG, render) y compilá.
- **Corré el build antes de decir que terminaste.** Un test que pasa en node no prueba que la página ande — ver `docs/build.md`, los tres bugs.
- **Ninguna dirección `0x…` entra al HTML.** El build corta si aparece.
- **Escaneá `docs/descartes.md` antes de proponer un cambio.** Casi todo lo que está ahí es una idea razonable que alguien va a volver a tener.
- **No inventes una variable que no está.** Si el dato falta, se dice que falta. No se aproxima con un proxy.
- **Ninguna afirmación acá adentro sin qué la falsaría al lado.** Si agregás algo y no sabés qué evidencia te haría sacarlo, todavía no lo entendiste como para escribirlo.

```bash
python3 _build/build.py     # compila (corre t/*.js y recién ahí escribe index.html)
node _build/test.js         # tests del motor
node _build/smoke.js        # la página armada contra un DOM de mentira
node _build/perfiles.js     # operadores sintéticos: ¿el modo se enciende donde corresponde?
node _build/mapa.js         # el mapa contra el motor. A mano, al cerrar un lote: no entra al build
```

| Archivo | Qué es |
|---|---|
| `_build/engine.js` | toda la lógica, sin DOM |
| `_build/shell.html` | estilos, HTML, SVG del taladro, render. Tiene `/*__ENGINE__*/` |
| `_build/build.py` | junta, sella versión, verifica |
| `_build/t/*.js` | pruebas de vista. Fixture sintética en `t/fixture.js` (genera, no guarda: el tilt tiene reloj) |
| `index.html` | **generado. No editar nunca.** |
| `talastrat-mapa.html` | mapa del proyecto, suelto. **No entra al build, así que envejece sin que nada avise** — ver abajo |
| `_build/mapa.js` | lo baja a lo verificable. A mano, no en el build |

**El mapa se queda afuera del build a propósito, y el costo hay que asumirlo escrito.** No entra a la página, así que acoplarlo al build que publica agregaría una forma de que el build falle por algo que el usuario no ve. La consecuencia es que se desfasa en silencio: al borrar el hábito `corte` quedaron cuatro en el motor y cinco en el mapa, en el README y en `PIEZAS`, sin que nada fallara. **Se revisa a mano al cerrar un lote**, y `node _build/mapa.js` baja la parte verificable — las constantes del motor contra la tabla de umbrales, la cuenta de hábitos en los cuatro lugares donde está escrita, y que las tablas rendericen sin campos huérfanos. **Lo que ese script no puede mirar es la prosa, que es la mayor parte del archivo.** Esa se lee.

**Para probar la app en el navegador sin wallet**, generá un volcado sintético y cargalo con **Cargar JSON**:

```bash
node -e "console.log(JSON.stringify(require('./_build/t/fixture.js').armar()))" > muestra-chica.json
```

Está en `.gitignore` a propósito: es un artefacto local y se regenera con esa línea. No lo edites a mano — un archivo con fechas fijas deja de encender el `tilt`, que tiene reloj.

Ese camino mide exposición de verdad desde que existe `desdeArchivo()`, que **copia el JSON y le pone defaults encima** en vez de listar campos a mano. El literal que había antes se comía `portfolio`, `orders` y `dexes` sin decir nada, y sin `portfolio` la app entera decidía sobre notional crudo. Si agregás un campo a `RAW`, no hay que tocar nada acá: pasa solo. Volver a un literal de campos reabre el bug.

---

## 3. Los ocho principios, en orden de desempate

El orden **es** la regla cuando dos chocan. Pasá cualquier propuesta por acá de arriba hacia abajo. Justificación completa en `docs/principios.md`.

**1. No inventar la variable.** Si el dato no está, no se aproxima con un proxy. Condición de posibilidad de todo lo demás: medir bien una variable falsa sigue siendo medir mal.
→ *Cambia con:* que aparezca la fuente que falta. Es prohibición sobre adivinar, no sobre un tema.

**2. Un dato aislado no es un hallazgo.** Split-half y tamaño de muestra al lado, siempre. Coincidir en signo con diferencia cero no es un patrón.
→ *Cambia con:* un método de validación mejor que split-half. Es piso, no techo.

**3. Se miden acciones, no resultados.** Ningún hábito, barra ni felicitación se calcula sobre el PnL. Si una métrica se mueve sola con el colateral, está midiendo el PnL con otro nombre.
→ *Cambia con:* poco. Ojo con la lectura de más: prohíbe **medir la conducta con el resultado**, no que exista una regla *disparada* por el resultado.

**4. Prescribe proceso, nunca mercado.** Puede pedirte que definas tu setup antes o que sostengas tus reglas. No sugiere activos, no opina sobre dirección, no dice cuándo entrar.
→ *Cambia con:* nada mientras la app no vea precios. Mata el empujón horario, que es una señal de timing con ropa de apoyo emocional.

**5. La app no puede crear un malestar que se alivie operando.** Prohíbe "te faltan 2 limpias" y "llevás 4 días sin operar": los dos hacen que la vía de escape sea entrar al mercado. Descansar siempre es salida válida. **Pero medir no es empujar:** la app puede *saber* que hay un hueco abierto y mostrarlo en frío en el panel al que él va a buscarlo.
→ *Cambia con:* evidencia de que la parálisis le cuesta más caro que el sobre-operar en su régimen.

**6. Se refuerza con el tiempo; solo caduca el estado.** Las rachas de hábitos atraviesan los días. Se reinicia el ánimo, jamás la acumulación.
→ *Cambia con:* que él pida borrar y arrancar limpio. Es su historial.

**7. Cuidar sin joder, alentar sin forzar.** Nada de relleno ni autoayuda. Las afirmaciones van con el número propio al lado o no van. El humor es irónico y va *adentro* de la oración, nunca pegado al final como remate. **Callarse es una opción válida y frecuente.**
→ *Cambia con:* que él diga que la app quedó fría. Única regla cuya evidencia es su reacción y no un número.

**8. Evitar el autocastigo.** Los drawdowns largos son normales incluso haciendo todo bien, y hay que decirlo con la probabilidad exacta al lado.
→ *Cambia con:* nada en la dirección de callarlo. Sí la dosis: dicho de más se vuelve consuelo automático y viola el 7.

---

## 4. Cómo hablarle

Corto y directo. **Le sirve que le discutan:** si un dato no sostiene lo que dice, decíselo con el número. Ya pasó varias veces y siempre fue mejor que asentir. Si te corrige y tiene razón, concedelo explícito y seguí, sin disculpas largas.

Cuatro veces me equivoqué por afirmar antes de mirar:

- Dije que no había liquidaciones porque busqué en el campo `dir`. Estaban en `liquidation`. La hipótesis era correcta, el lugar no.
- Dije que las reentradas calientes eran una fuga. Sus datos daban **+US$0,21 por operación mejor** que el resto, y aguantaba el split-half.
- Dije que el apalancamiento nunca se gana. Con US$3,42 de colateral y órdenes mínimas de US$10, el apalancamiento es la entrada, no una decisión de riesgo. La variable real es la **holgura**: distancia al stop contra distancia a la liquidación.
- Medí "tamaño consistente" sobre notional crudo. Él lo vio primero: con apalancamiento fijo el notional es colateral × 20, así que sube y baja solo con el PnL. Era el resultado disfrazado de acción. La variable es la **exposición**: notional sobre colateral.

Los cuatro son el mismo error. **Mirá el dato antes de afirmar sobre el dato.**

---

## 5. Invariantes que cruzan todo el motor

Si vas a tocar `engine.js`, estas seis valen más que el resto:

1. **`escalaTamano` es la única definición de "tu tamaño de siempre".** Devuelve exposición (`notional / colateral`) si hay serie de cuenta con cobertura ≥80%, notional crudo si no, y dice cuál eligió. `habitos.tamano`, `tilt`, `aire.regla`, `aire.salto` y `estabilidad` preguntan todas acá.

1b. **`bandaRiesgo` es la única definición de "cuánto puede costarte una operación".** Devuelve el techo que él declaró en frío, o su pérdida promedio reciente si no declaró nada, y dice cuál eligió. `habitos.perdida`, `tilt.limpia`, `aire.regla`, `presupuesto` y el aviso de stop de `analyzePositions` preguntan todas acá. **Devuelve dos números y no uno: `valor` es cuánto arriesgás, `limite` es hasta dónde una pérdida todavía cuenta como cumplida.** Coinciden con techo declarado; con banda observada el límite lleva `BANDA_TOL`, porque un promedio necesita tolerancia y un techo elegido no. **Ningún consumidor multiplica nada** — el día que aparezca un `banda * 1.5` suelto, volvió el problema que 3.1 cerró.
2. **Y todas responden igual a su silencio.** Cuando devuelve `null` no hay dato: la operación **sale del denominador**. No suma a la racha, no la corta, no entra en el "N de 20". Contarlo como falla mide la cobertura de un endpoint y la llama disciplina; contarlo como cumplido pinta verde una operación que nadie midió.
3. **Los tests de hábitos son de tres valores:** `true` cumplió, `false` no cumplió, `null` no hay con qué juzgarlo. El tercero es el que importa.
4. **Un día es un día de Buenos Aires, siempre.** `diaBA` y `relojBA` son la única forma de agrupar por día o por hora. Lo que sigue en Nueva York es la clasificación de sesiones, que describe el mercado.
5. **Las liquidaciones se detectan por el campo `liquidation`**, nunca por `dir`, que dice "Close Long" idéntico a un cierre voluntario.

Los trades se arman de posición plana a posición plana: un scale-in es una sola operación.

---

## 6. Cómo se lee este documento

Todo está escrito con la misma prosa, y **eso es un problema si no sabés qué peso tiene cada cosa**. Un juicio tomado al pasar y una condición de existencia no se distinguen por el tono.

| | Qué es | Cómo se cambia |
|---|---|---|
| **Restricción** | Cambiarla cambia qué es la app | No se cambia. Hoy es una sola: § 1 |
| **Principio** | Decisión de diseño con orden de desempate | Con una decisión explícita, y anotando por qué cambió |
| **Hipótesis** | Creencia sobre trading, puede ser falsa | Se contrasta con sus datos. Cada una dice qué la falsaría |
| **Registro** | Qué pasó, qué se probó, por qué elegimos X | Se revisa libre. Está para no rehacer el análisis, no para obedecer |

---

## 7. Dónde está el resto

Leé el archivo cuando la tarea lo pida. No los leas todos por las dudas.

| Archivo | Cuándo |
|---|---|
| `docs/descartes.md` | `REGISTRO` — **antes de proponer cualquier cambio.** Lo que ya se probó y quedó peor |
| `docs/motor.md` | `REGISTRO` — al tocar `engine.js`. Qué hace y por qué cada pieza: `tilt`, `aire`, `estabilidad`, `habitos`, `adherenciaDiaria`, `holguraHist`, `taladro`… |
| `docs/interfaz.md` | `REGISTRO` — al tocar `shell.html`. Tema claro/oscuro, foco por teclado, las siete caras |
| `docs/datos.md` | `REGISTRO` — al tocar la API. Endpoints, HIP-3, márgenes, husos, sesiones |
| `docs/build.md` | `REGISTRO` — al tocar el build o publicar. Qué corta, los tres bugs que lo explican, el panel de diagnóstico |
| `docs/principios.md` | `PRINCIPIO` — al querer **cambiar** un principio, no al aplicarlo |
| `docs/hipotesis.md` | `HIPÓTESIS` — creencias sobre el oficio, cada una con qué la falsaría. Douglas, parálisis, abundancia, pagarse |
| `PLAN.md` | `REGISTRO` — **la única lista de pendientes y deuda abierta.** Ordenada por qué principio viola |
| `docs/merval.md` | `REGISTRO` — el modo Merval: cartera lenta, BYMA, otra unidad de medida. **No es una lista de deuda**, es el diseño de otro producto en el mismo repo |
| `README.md` / `SETUP.md` | Para el usuario final y para instalar |

**`PLAN.md` es la única lista de deuda.** Antes había dos, con la regla de borrar el ítem en los dos lugares en el mismo commit — que es exactamente la trampa que este proyecto se puso solo. El que resuelve un ítem lo borra de `PLAN.md`; si lo probó y quedó peor, lo mueve a `docs/descartes.md` con una línea. Ese es el único destino que no es "borrar".

**`docs/descartes.md` nunca se borra.** Es simétrico a `PLAN.md`: una lista registra lo que falta y solo debe encoger, la otra registra lo que ya se contestó y solo crece.
