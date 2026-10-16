# Modo Merval

`REGISTRO` — Abierto el 4 de agosto de 2026, reescrito el 5. Ver CLAUDE.md § Cómo se lee este documento para qué peso tiene un `REGISTRO`.

**Esto no es una lista de deuda y no compite con `PLAN.md`.** Es el diseño de un producto distinto que comparte el repo, la disciplina y la mascota. Cuando `PLAN.md` muera al cerrar el lote 6, hay que decidir dónde vive la deuda de este modo — esa decisión está pendiente y anotada acá para que no se tome por omisión.

---

## Qué es

**Taladrín no acompaña una cartera: acompaña una transición.** El usuario llega con la comitente sin papeles o con una cartera que quiere reacomodar, y con un objetivo escrito. La app lo asiste a ejecutar **su propio plan** y le devuelve dónde se está apartando de él.

Lo único que sobrevive intacto de Talastrat es **Taladrín** y cinco lecciones. Los modos, el tilt, `aire`, `estabilidad`, las sesiones y las celdas horarias no se portan: se construyeron contra un reloj intradiario que en una cartera no existe.

---

## La contradicción que se resolvió primero

La consigna inicial pedía dos cosas incompatibles: *no cargar operaciones* y *medir tipo de orden y horario*. Tipo de orden y horario **son** datos de la operación.

La salida no fue sacar la carga sino moverla:

| | Seguimiento de cartera | Ejecución de un plan |
|---|---|---|
| Carga de datos | Perpetua y abierta. Si parás un mes, las métricas se pudren | **Acotada y con final.** 8 a 15 tramos y se terminó |
| Cuándo ocurre | Después, como tarea agregada | **En el momento de decidir** |
| Qué es para el usuario | Una obligación | **La intervención misma** |

**Declarar el tramo antes de mandarlo no es el costo del producto: es el producto.** Es `edgeDeclarado` del modo perps, mudado al único lugar donde una cartera lenta sí repite.

---

## Lo que se hereda: cinco lecciones, todas negativas

No sabemos qué funciona acá. Sabemos qué falla, y cada una se probó y se sacó:

| Lección | Dónde se aprendió | Dónde vive ahora |
|---|---|---|
| **El tri-estado `null`** | `descartes.md`, dos entradas simétricas sobre `habitos` | `estadoTramo` devuelve cuatro valores; `habitosPlan` tres |
| **Una medición detrás de un clic voluntario pierde** | El panel de Diagnóstico, y el reporte de IOL de julio | La declaración del tramo es la intervención, no un extra |
| **Un umbral que la app se inventa muere** | El hábito `corte` | `alerta` y `apretado` se disparan con **la ventana que declaró él** |
| **Una métrica que se mueve sola con el precio es resultado disfrazado** | Notional crudo → exposición | La trayectoria se mide **a monto invertido** |
| **Callarse hasta tener muestra** | `MUESTRA_MIN`, ítems 4.2 y 4.3 mudos a propósito | `muestraPlan`, y `voz` devuelve `null` seguido |

---

## La unidad: el tramo

No es la operación ni el día. Es **el tramo del plan**: una compra prevista, con ticker, monto, ventana y tipo de orden, declarada antes de mandarla.

Un plan de 5 posiciones escalonado en 3 son 15 unidades, y **el N se conoce de antemano** en vez de depender de que aguante un hábito.

### Cuatro estados, no dos

| Estado | Qué es |
|---|---|
| `como` | Ticker, monto, tipo y ventana coinciden con lo declarado |
| `distinto` | Se ejecutó pero cambió algo. Se guarda **qué** |
| `noEjecutado` | Venció la ventana, o la orden límite no se llenó — motivos separados |
| `pendiente` | Ventana todavía abierta. No se juzga, sale del denominador |
| `sinDato` | Tramo incompleto o sin ventana |

**`noEjecutado` no es un hueco: es la conducta.** Es la única forma observable de sub-operar, justo lo que `docs/hipotesis.md` dice que el modo perps tira a la basura cuando purga las declaraciones a las 4 horas. Acá nace visible.

---

## Las cuatro señales que reemplazan "respuesta emocional"

La emoción no se observa. Ponerla como variable es inventar la variable, que es el principio 2. Lo que sí se observa:

1. **Desvío de contenido.** Compró algo que no estaba en el plan. Booleano.
2. **Desvío de ritmo.** El plan decía 3 tramos en 6 semanas y entró todo el primer día. Se comparan dos calendarios, no se infiere nada. Es la falla más común armando una cartera.
3. **Reescritura del objetivo, con fecha.** Editar el plan es un evento fechado, y se separan las ediciones *antes* de la primera compra (planificar) de las de *después* (otra cosa).
4. **Contradicción interna del plan.** Declaró "máximo 15% por posición" y el plan tiene una al 40%. La app no opina sobre el 40%: señala que choca con **una regla que escribió él**.

Los estados de Taladrín reflejan estas cuatro. **Nunca un ánimo inferido ni el color de una posición.**

---

## La trayectoria se mide a monto invertido

**No es una limitación por no tener precios: es la definición correcta.** Es la corrección #4 de CLAUDE.md otra vez. El peso a valor de mercado se mueve solo con el precio —una posición puede cruzar tu máximo sin que hayas comprado nada— así que medir la diversificación así es medir el resultado con otro nombre. A monto invertido, el peso se mueve **únicamente cuando comprás**. Es acción pura.

Efecto lateral que cambia el proyecto entero: **el MVP no necesita ninguna fuente de precios.**

La distancia al objetivo es variación total, con **el total del plan como denominador y no lo ya invertido**. La diferencia no es cosmética y la encontró un test: normalizando sobre lo invertido, la primera compra de un plan de cuatro posiciones *aleja* del objetivo —queda 100% en algo que debía ser 25%— y el motor te marcaba en rojo por arrancar. Con el total del plan, lo que falta comprar cuenta como efectivo y arrancar acerca, que es lo que de verdad pasó.

---

## Técnica de ejecución

### Tipo de orden — dos cosas separadas

- **`adherencia`** se puntúa y es tri-estado: ¿ejecutaste con el tipo que declaraste? Eso es acción.
- **`perfil`** solo describe, sin racha ni color. La app **no sostiene que el límite sea mejor que el mercado** — eso sería opinar sobre el contenido del plan. Cuenta y se calla.
- **El límite que no se llenó va aparte.** Confundirlo con no haber querido operar mezcla técnica con voluntad. No entra al denominador de adherencia: hizo lo que dijo.

### Horarios — muerto, con evidencia

No es opinión de diseño. Son dos cosas ya resueltas:

- **Principio 5**, textual: *"la regla que mata el empujón horario, que es una señal de timing con ropa de apoyo emocional"*.
- **Se midió.** `PLAN.md` 4.6 y `descartes.md`: el mapa horario contra la cuenta real dio **p = 0,37**.

Y acá es peor: el Merval opera unas seis horas y media, así que hay tres baldes usables contra los veinticuatro de cripto.

**Lo que sí sobrevive, y es otra cosa:** la hora como predictora **del propio desvío**, no del resultado de mercado. Si el 80% de las compras fuera de plan se declaran después de las 20:00, eso es un hallazgo sobre él. La diferencia es qué es la variable dependiente: **el desvío, nunca el precio.**

### Momento del mes — la única escala temporal con hipótesis propia

No por el mercado sino por el flujo de fondos: cobro, vencimiento de plazo fijo, liquidación. El ciclo mensual de ingreso de plata es real y no es una afirmación sobre precios.
→ *Cómo se falsaría:* que sus tramos ejecutados se repartan parejo en el mes.

---

## Diversificación: contra su propia definición

La app no tiene una teoría de la diversificación y no debe adquirirla. Le pide que la escriba —máximo por posición, máximo por sector, mínimo de posiciones— y mide **la trayectoria**: ¿cada compra te acerca o te aleja de tu propia distribución objetivo?

Cada regla no declarada devuelve `sinDato`, **nunca "cumple"**.

---

## Taladrín: cuatro caras, y una es el `null`

| Cara | Cuándo |
|---|---|
| **Reposo** | Ningún tramo vencido ni por vencer |
| **Alerta** | Una ventana cerrándose |
| **Apretado** | Un tramo venció sin ejecutar. Escala con los días **desde su propia ventana** |
| **No sé** | Sin plan, o ningún tramo resuelto todavía |

**La cuarta no es negociable.** Al principio es el estado más frecuente, y una app que no puede dibujar "no sé" termina dibujando otra cosa en su lugar.

**`apretado` tiene dos salidas y eso es lo que impide que sea coercitivo:** ejecutar el tramo **o editar el plan**. Cambiar de idea en frío es una salida válida, igual que descansar lo era en perps. Si la única forma de apagarlo fuera comprar, sería un malestar que se alivia operando — el principio 6. Hay un test que lo verifica.

**El principio 6 se reescribe:** *la app no puede inventar un malestar; solo puede espejar el que vos te pusiste en frío.*
→ *Qué lo falsaría:* que escriba reglas que no piensa cumplir y la app se vuelva un generador de culpa sobre compromisos de mentira. El síntoma sería un tramo con vencimiento crónico que nunca edita ni borra.

---

## El cortafuegos, y por qué no lleva lista de excepciones

`merval-test.js` § 11 lee `merval-engine.js`, saca los comentarios y **corta si aparece un identificador de mercado o de resultado**: `pnl`, `precio`, `cotiza`, `ganancia`, `retorno`, `benchmark`.

Ya cazó un caso, y era mío: un campo llamado `ligadaAlPrecio` cuyo único propósito era declarar que ese vínculo *no* se medía. Se renombró en vez de agregar una excepción. **En cuanto una regla de seguridad admite la primera excepción, deja de ser una regla** — y la alternativa costaba renombrar un campo.

---

## La IA como taller, no como producto

`DECISIÓN` — 5 de agosto de 2026.

**La app no llama a ningún modelo.** El usuario le da la captura a un asistente afuera, recibe un JSON y lo carga. La IA es la herramienta con la que se prepara el insumo, no una pieza del producto.

**Lo decide § 1, no una preferencia.** *"Todo se procesa en el navegador"* está adentro de la restricción, y su *qué lo cambiaría* dice **nada**. Una captura de comitente lleva número de cuenta, nombre y saldos; mandarla a una API de terceros cambia qué es la app.

### Se parsea la tenencia, jamás el plan

| | Qué es | ¿Se puede extraer? |
|---|---|---|
| Cartera actual (`tenenciaInicial`) | Un hecho del mundo | **Sí.** Pura comodidad, sin costo conceptual |
| Objetivo y tramos | Un compromiso | **No.** Destruye el producto |
| Ejecutado sí/no | Un hecho, pero es un clic | No hace falta |

**Declarar es la intervención.** Si la IA convierte una cartera sugerida en objetivo, la declaración nunca ocurre: queda un compromiso que él no tomó, y todo lo que el motor mide después es adherencia a algo ajeno. Peor si viene de un asesor o un newsletter — **tipearla es leerla**. El ahorro serían noventa segundos, una vez, justo donde la fricción es la función.

Donde sí gana es en un rearmado: quince posiciones con montos que él **reporta**, no declara.

### Nada entra sin que lo mires

`desdePlan()` no devuelve un plan: devuelve `{ plan, revision }`. Una lectura que confunde 18,8% con 1,88% rompe el tablero **en silencio**, que es el peor modo de falla de este proyecto. La revisión clasifica en tres —`falta`, `confirmar`, `ok`— y `usable: true` significa que el motor puede correr, **no que lo leído esté bien**. Hay un test que fija esa diferencia.

Dos cosas que el cargador se niega a hacer, las dos por el principio 2:

- **No reescala los pesos.** Si suman 97 quedan en 97 y se avisa. Normalizarlos sería inventar la intención a partir de un error de lectura.
- **No convierte lo ilegible en cero.** `num()` devuelve `null`, el tramo queda en `sinDato` y nadie lo juzga.

### El cargador copia y pone defaults encima

`desdePlan` hace `Object.assign({}, DEFAULTS, raw)` y **no lista campos a mano**. No es estilo: es el bug que CLAUDE.md documenta para `desdeArchivo()` en el modo perps, donde el literal se comía `portfolio`, `orders` y `dexes` sin decir nada. Si el esquema gana un campo, pasa solo. El test 13 se pone rojo si alguien vuelve al literal.

### Dónde la IA no va: la voz

Va a ser tentador, porque `voz()` son plantillas y suenan a plantillas. Pero un modelo produce relleno y autoayuda por defecto, que es lo que el principio 7 prohíbe, y hay algo más concreto: **`merval-test.js` § 10 verifica que la voz lleve un número y no tenga signos de exclamación.** Eso deja de ser testeable el día que la genere un modelo.

→ *Qué cambiaría esta decisión:* que aparezca un modelo de visión local suficientemente bueno y liviano — [Transformers.js con WebGPU](https://github.com/huggingface/transformers.js) ya corre SmolVLM y Donut en el navegador, pero hoy son cientos de MB contra los 380 KB que pesa la app. Cuando parsear a mano moleste de verdad, se revisa. No antes.

### El esquema que produce el taller

```json
{
  "creado": 1785000000000,
  "objetivo": [
    { "ticker": "GGAL", "peso": 25, "sector": "bancos" }
  ],
  "reglas": { "maxPos": 30, "maxSector": 60, "minPosiciones": 4 },
  "tenenciaInicial": [ { "ticker": "PAMP", "monto": 250000 } ],
  "tramos": [
    { "ticker": "GGAL", "monto": 100000, "tipo": "limite",
      "desde": 1785000000000, "hasta": 1785600000000, "ejec": null }
  ],
  "ediciones": []
}
```

`id` se genera solo si falta. Los montos aceptan `"100.000,50"`. **`objetivo`, `reglas` y `tramos` los escribe él**; del taller sale, como mucho, `tenenciaInicial`.

---

## Reglas de nivel

`DECISIÓN` — 7 de octubre de 2026. La tomó Adrián, eligiendo entre dos opciones: abrir reglas de nivel o dejar el modo en entradas sin precios.

**Qué cambió.** El motor ahora mira un dato de mercado, uno solo y para una sola pregunta: **¿el cierre cruzó el nivel que él declaró, y cuando cruzó, hizo lo que había escrito?** Es la condición que la sección *Diferido, no descartado* dejaba anotada para reabrir BYMA: *"hace falta cuando aparezcan reglas de nivel de precio"*. Aparecieron: los planes activos salen por invalidación al cierre y targets escalonados de a un tercio.

**Por qué no rompe el principio 4.** El nivel lo escribe él, en frío, igual que `maxPos`. La app no sugiere el nivel, no opina si está bien puesto y no dice cuándo entrar. Mide adherencia a una regla propia. Si el nivel es malo, es su nivel.
→ *Qué lo falsaría:* que los niveles empiecen a llegar escritos por otro (un asistente, un newsletter) y él solo los confirme. El síntoma sería un plan con niveles cargados en el mismo minuto que el objetivo y nunca editados. Mismo criterio que *Se parsea la tenencia, jamás el plan*: **los niveles los tipea él.**

**Lo que sigue prohibido, sin excepciones.** El cortafuegos del test 11 no se tocó: `pnl`, `precio`, `cotiza`, `ganancia`, `retorno`, `benchmark` y `mercadoValor` siguen cortando el build. Los cierres no entran como "precio" ni se valúa nada con ellos. El test 14 agrega un cortafuegos estructural: **`plan.cierres` solo se lee en `anotarNiveles`, `desdePlan` y `revisar`**, y `estadoNivel` los recibe por parámetro. Si otra función empieza a leerlos —una trayectoria valuada, un "cuánto llevás"— el build corta.

**Los cierres no los busca el motor.** Vienen en `plan.cierres` (`{ TICKER: [{ d: 'AAAA-MM-DD', c }] }`), cargados desde afuera: la tarea programada o el tablero EOD de BYMA. El motor sigue sin red, por § 1.

### Los estados

| Estado | Qué es |
|---|---|
| `vigente` | Ningún cierre cruzó desde que la declaró. No se juzga, sale del denominador |
| `pendiente` | Cruzó y la ventana (`plazo`, en ruedas, default 1) sigue abierta |
| `como` | Ejecutó dentro de la ventana la fracción declarada (tolerancia `TOL_FRACCION`, nominales enteros) |
| `distinto` | Ejecutó tarde, otra fracción, **o antes de que cruzara**. Se guarda qué |
| `noEjecutado` | Cruzó, venció la ventana y no hizo nada |
| `sinDato` | Regla incompleta o sin cierres para ese ticker. Nunca "vigente" por falta de dato |

Solo cuenta el **cierre**, no la mecha: es la regla que él eligió el 6/10 (*"si lo cierro, lo cierro manual"*). Un cierre exactamente en el nivel no lo cruza.

**`apretado` conserva sus dos salidas:** ejecutar o editar el plan. Mover un nivel después de que cruzó queda como reescritura fechada (señal 3), no como falla. Sin eso sería un malestar que solo se alivia operando.

### Lo que falta

- **Vista.** Declarar niveles, cargar `cierres`, marcar la ejecución. El motor y 20 tests están; `merval-shell.html` todavía no los muestra.
- **`habitosPlan` no los cuenta todavía.** Primero que existan datos reales; con menos de `MUESTRA_MIN` juzgados el motor se calla igual.
- **La moneda.** El nivel y los cierres tienen que estar en la misma (USD del subyacente o ARS del CEDEAR). La revisión lo pide confirmar; el motor no convierte, porque convertir con un CCL sería inventar la variable.

---

## Lo que este modo no hace

- No recomienda especies
- No pone el foco en el PnL ni en el neto de la comitente
- No persigue objetivos de porcentaje ni de ganancia
- **No juzga el contenido del plan.** Si el plan es malo, es su plan. Solo señala cuando choca con una regla que escribió él
- **No compara su precio de ejecución contra el promedio del período.** Se disfraza de calidad de ejecución y a estos horizontes es suerte retrospectiva
- **No esconde el PnL: se abstiene de meterlo en una métrica.** El broker se lo va a mostrar igual; fingir que no existe vuelve mentirosa a la app

---

## Fases

| | Qué | Estado |
|---|---|---|
| **1** | `_build/merval-engine.js` — sin DOM, sin red, sin precios. `desdePlan` / `revisar` para la entrada. `_build/merval-test.js` con fixture sintética | **Hecho. 87 tests** |
| **2** | `_build/merval-shell.html` → `merval.html`. Alta del plan, declarar tramos, marcar ejecución, tablero, las 4 caras, `localStorage`, importar/exportar. `merval-smoke.js` contra un DOM de mentira | **Hecho. 15 chequeos de humo** |
| **2b** | Reglas de nivel en el motor (`estadoNivel`, `niveles`), 20 tests. Ver § Reglas de nivel | **Hecho el 7/10. Falta la vista** |
| **3** | Un plan real suyo, de punta a punta | Siguiente: los cuatro de octubre |
| **4** | Recién ahí se decide si hay producto | — |

### El build

```bash
python3 _build/build.py            # Talastrat, sin cambios
python3 _build/build.py merval     # merval.html
python3 _build/build.py todo       # los dos
```

**Son invocaciones separadas a propósito.** Que un fallo del modo Merval impida publicar un arreglo de Talastrat sería acoplar dos productos que no tienen por qué moverse juntos — mismo criterio con el que el mapa se queda afuera del build.

El target `merval` corre, en orden: sintaxis de cada `<script>`, el cortafuegos, los 87 tests del motor y el humo contra un DOM de mentira. **Los tests y el humo corren adentro del build, no al lado**, porque `descartes.md` ya tiene la lápida de los seis tests de vista que murieron por una ruta vieja sin que nadie se enterara. Y el humo corre contra un borrador: si la página no renderiza, `merval.html` queda como estaba.

**El cortafuegos del build mira los `<script>`, no el HTML entero.** La primera versión escaneaba todo y cortó por la palabra "rendimiento" en el pie de página, donde la app declara que *no* lo calcula. El scope estaba mal, y la corrección no fue una lista de excepciones: fue que la regla mire lo que el código computa. La prosa se revisa leyéndola.

### Diferido, no descartado

**BYMA y `merval-probe.html`.** Al medir la trayectoria a monto invertido, el MVP no necesita precios. El probe queda escrito y sin correr; hace falta cuando aparezcan reglas de nivel de precio o el modo de seguimiento. **La fase 0 dejó de bloquear.**

**El modo de seguimiento** —regla × día, latencia, días-violación— no queda mal: queda **después**. Es lo que corresponde cuando el plan terminó y hay cartera que sostener. Se decide con lo que pase en el primer plan real, no antes.

---

## El modo es episódico, y eso está bien

Un plan de compras se termina. Después no hay nada que hacer hasta el próximo rebalanceo, que son dos o cuatro por año.

**Talastrat perps es un compañero diario; esto es un instrumento que se agarra y se suelta.** Si el diseño pelea contra eso e inventa razones para que abras la app en enero cuando terminaste el plan en noviembre, está creando un malestar que se alivia operando. **Que la app esté cerrada tres meses es un estado válido.**

---

## Trampas conocidas, sin resolver

**~~Un mismo subyacente en tres tickers (CEDEAR en pesos, especie D, ADR) es la misma exposición.~~ Degradada el 5/8 mirando una comitente real.** Todas las posiciones eran especie D, o sea en dólares, y **ninguna duplicada**. La trampa existe si algún día mezcla especies del mismo subyacente; hoy no muerde, y como efecto lateral no hace falta ningún MEP: la comitente ya viene en dólares. Se deja anotada porque el día que compre la versión en pesos de algo que ya tiene, la regla de máximo por posición va a contar doble sin avisar.

**De dónde sale el "ejecutado".** Hoy lo marca él, un clic por tramo, ~15 por plan. Inferirlo comparando tenencias antes y después es posible; leerlo del broker está descartado por credenciales.

**Nada de esto está validado en nadie, ni siquiera en él.** Los umbrales del motor de perps salieron de sus fills reales; acá hay dos umbrales y ninguno salió de datos: `TOL_MONTO` sale de que no se pueden comprar fracciones de nominal, y `MUESTRA_MIN` está copiado de perps.
→ *Cómo se falsaría el producto entero:* que después de un plan completo la mayoría de los tramos hayan quedado en `sinDato`, o que todos hayan salido `como` y el coach no tenga nada de qué hablar. Lo primero es un problema de carga; lo segundo significa que no necesita la herramienta.
