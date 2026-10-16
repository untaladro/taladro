# Interfaz: tema, teclado, personaje

Leer antes de tocar `_build/shell.html`.

## Tema claro y oscuro

Todo el color sale de variables con nombre de rol (`--txt2` es "texto secundario", no "gris claro"). El tema claro es el bloque `html[data-tema="claro"]`: cambia esos valores y nada más. Los rojos y verdes con alfa (`#f8514955` y compañía) no se duplican — al ser translúcidos funcionan sobre los dos fondos.

Tres cosas que no siguen la variable sola:

- **Chart.js copia los colores adentro del gráfico**, así que `GRID()`, `TICK()`, `VERDE()` y `ROJO()` son funciones que leen la variable viva en cada render, y cambiar de tema llama a `render()` otra vez.
- **El tema se aplica en un `<script>` del `<head>`**, antes de pintar. Vive en `localStorage` y no en `DATOS` porque `DATOS` está en IndexedDB, que es asíncrono: la página arrancaría oscura y saltaría a clara un cuadro después.
- **El taladro no cambia de color con el tema.** Tiene paleta propia (`PALETA` en `shell.html`) y es siempre la misma: es un personaje, no una pieza de la interfaz. Lo que cambia es `--talbg`, el gris oscuro sobre el que se para tanto el botón como el SVG del foco. Se probó darle una versión clara y quedó peor: la mecha y las partes metálicas son casi blancas, y sobre blanco el dibujo pierde la punta.

Los dos temas dan contraste AA (≥4,5) para todos los colores de texto **sobre panel**. Esa frase decía lo mismo pero sin la negrita, y la negrita es todo el punto: se había chequeado `panel` y nada más. `--mut` sobre `--bg` —el fondo de la página, no el de una tarjeta— daba 4,25 en claro, y el único texto que vive ahí es `.sub`, el subtítulo bajo el título.

**Se arregló moviendo el elemento a `--txt2`, no tocando la paleta, y eso es la parte que importa.** Subir `--mut` hubiera dado AA en todos lados y comprimido la distancia que lo separa de `--txt2` (7,55 contra 4,60 en claro). Esa distancia *es* la jerarquía entre "esto importa" y "esto es una nota al pie": `--mut` es el color de callarse, y el principio 8 se apoya en que haya un color para eso. Un arreglo de accesibilidad que aplana el tono no es un arreglo.

La regla que queda: antes de mover un color, fijate **quién escribe sobre qué fondo**. Casi siempre el que está mal es un elemento, no la variable.

## La portada: qué se ve primero

Dos decisiones del 3 de agosto, las dos sobre lo mismo: en 360px había 495px de cosas arriba de la posición abierta, sobre un viewport útil de 615. La posición se quedaba con el título y el número.

**El alta plegada es una línea, no cinco elementos.** `compacto` existía desde antes, pero escondía seis controles y dejaba cinco: chip, "Cambiar wallet", "Pausar", "guardado en este navegador" y el conteo de fills. En un teléfono eso son tres filas. Ahora quedan dos cosas, elegidas con el mismo criterio —*¿esto cambia lo que hago en los próximos treinta segundos?*—: el chip, que es el botón para salir de ahí, y el indicador de vivo, que es lo único que cambia el significado de todo lo de abajo. El botón "Cambiar wallet" se borró: era un segundo control para la misma acción a diez pixeles del primero, y ahora esa acción la hace el chip.

Dos cosas que no son obvias y que el plegado rompe si se olvidan. **El error tiene que verse plegado** (`#setup.compacto #status.err`), o plegar el alta la deja muda justo cuando tiene algo que decir. Y **`#vivo` ahora escribe la hora del volcado aunque el vivo esté apagado**: antes solo escribía algo si tocabas el botón, así que plegar el alta borraba la única marca de frescura que había y la pantalla quedaba idéntica mirando datos de hace un minuto o de hace tres días.

**El orden de la portada lo manda el momento, no el orden del archivo.** Los paneles son hermanos y se apilaban como están escritos, así que con posición abierta lo primero era la franja — que por su propio comentario en `renderFranja` es *"tu espejo justo antes de entrar"*, o sea el espejo de nada cuando ya hay plata puesta. `renderResumen` pone la clase `dentro` en `#app` y el CSS baja franja y tira debajo de `enTrade` con `order`.

Tres cosas de esa implementación valen más que la decisión:

- **Es `order` y no mover nodos** porque franja y tira no tienen nada focusable adentro (`data-tal` es hover), así que el orden de tabulado no se parte. **Si algún día se les mete un botón, esto pasa a ser un bug de teclado silencioso y hay que mover el DOM de verdad.**
- **`#app:not(.hide)` y no `#app`.** `.hide` es un selector de clase y `#app` uno de id: `#app{display:flex}` le gana a `.hide{display:none}` y la app aparece antes de que haya un solo dato.
- **El tilt y el aire se quedan arriba** de la posición a propósito. Existen para interrumpir, y tener una operación abierta no es motivo para callarlos: el tilt habla de la que sigue, no de la que ya está puesta.

La clase `dentro` es un paso intermedio a propósito. Cuando exista el estado "recién cerraste" (`PLAN.md` 4.7) pasa a ser `momento()` y devuelve una de tres.

**El techo de pérdida (`#bandaDecl`, 3.1) vive adentro de `prepPanel`, y eso no es una decisión de dónde queda mejor.** `prepPanel` se esconde con tilt activo y con posición abierta, así que **el bloque para cambiar tu regla de riesgo no existe en los dos únicos momentos en que se te ocurriría subirla**. Es la guarda que no hubo que escribir, y por eso mismo se puede perder sin que nada falle: el día que este bloque se mude a un panel que sobrevive al tilt, la condición hay que agregarla a mano. Está anotado al lado de `renderBanda`.

**El pre-check de 4.3 vive en el mismo panel y por el mismo motivo**, y hereda la misma propiedad gratis: la pregunta *"si sale mal, ¿cuánto te va a mover?"* no aparece nunca adentro de una operación ni en tilt, porque el panel no existe ahí. La lectura del cierre (`#postCheck`) sí es un panel propio, y **solo aparece si hubo pronóstico** — sin un pronóstico contra el cual medirla, la respuesta está determinada por el resultado.

**Los tres Taladrines inclinados son el único lugar donde el dibujo es un control y no una salida.** La regla que lo hace posible es una línea: *la salida varía la cara y mantiene el cuerpo derecho; la entrada varía el cuerpo y mantiene la cara igual.* Las ocho expresiones de `CARAS` están todas tomadas por estados de salida —tilt, aire, hitos, ejercicio— pero el ángulo del cuerpo no lo usa ninguno: `tiltmode` tiembla y `airemode` se queda quieto, los dos derechos. Canal libre.

Dos cosas que ese dibujo no puede hacer, o el bloqueo vuelve: **tomar el rojo de `PALETA.tilt`** —el color es un canal de salida y pisarlo hace que dos fuentes compitan por el mismo trazo— y **animarse**, porque el movimiento es el otro canal que la salida ya usa. `t/cheq.js` verifica las dos, más que los tres ángulos sean distintos y crecientes: si alguien toca el `rotate` y quedan iguales, la escala deja de ser ordinal **sin ningún error**, con los tres botones ahí y el usuario apretando cualquiera.

El `viewBox` es el mismo para los tres y por eso es grande. El pivote está en la base de la empuñadura, que es lo que hace que "volteado" se lea como que se cae en vez de como que gira; con marcos ajustados por ángulo los tres se verían del mismo tamaño y la inclinación perdería todo lo que tiene para aportar.

No lleva color de estado ni borde que cambie. Con deriva —tu pérdida promedio ya por encima del techo que escribiste— sube el contraste del texto y nada más: pintarlo de rojo convertiría una decisión tuya anotada en un reproche, y el número que estaría reprochando lo elegiste vos.

## Teclado y foco

`input,select,button` lleva `outline:none` para que el borde de foco lo dibuje el diseño y no el navegador — pero durante mucho tiempo nadie lo dibujó, así que los botones no tenían **ninguna** señal: tabulabas por el panel de setup y no sabías dónde estabas parado. La regla es `:focus-visible` global con `--acc`: solo se enciende en navegación por teclado, así que con el mouse no cambia un pixel. Si aparece otro `outline:none` en algún selector nuevo, tiene que venir con su `:focus-visible` al lado.

Los `<th data-k>` de la tabla ordenan y son focusables, con Enter y Espacio además del clic. **El detalle que no es obvio: `renderTables()` reescribe el `innerHTML` entero**, así que el `th` que activaste deja de existir y el foco se caería al `<body>` — habría que tabular desde cero para ordenar por la segunda columna. Por eso se vuelve a buscar por `data-k` después de redibujar y se refocalea. El clic no lo hace: no le hace falta y movería el scroll. Es el mismo problema que tiene el modal `#foco` sin resolver, un piso más abajo.

El rótulo de `#verMas` y su `aria-expanded` se ponen juntos en `rotularVerMas()` y en ningún otro lado. Había cuatro puntos escribiendo el `textContent` por su cuenta, y con cuatro un quinto que se olvide de avisar es cuestión de tiempo.

## Las caras de Taladrín

`CARAS` tiene **ocho** expresiones y llegan a la pantalla por tres caminos distintos, no por uno.

**Cinco por tono**, que es lo que hace `CARA_DE`: `alerta`, `seco`→`ceja`, `ok`→`guiño`, `info`→`seco`, `silencio`→`dormido`.

**Dos por id**, porque el tono no alcanza para distinguirlas: `tilt` → `furioso` con `PALETA.tilt`, y `aire` → `avatar`. El aire comparte el tono `ok` con los hitos y con el ejercicio, así que mapearlo por tono le hubiera puesto los ojos tomados a una felicitación.

**Y una que no sale de ningún mapa:** `atento` reemplaza a `dormido` cuando hay posición abierta. No es un tono ni un id — es una línea de sustitución al final de `renderTaladro`, y por eso se le escapó a este documento, que durante un tiempo dijo "siete". El motivo es bueno y conviene dejarlo escrito: **el silencio con plata puesta no es el mismo silencio.** Callarse es una opción válida, pero dormirse arriba de una posición viva sería la app fingiendo que no está pasando nada.

Contando `atento`, las ocho están tomadas como **salida**. Eso es lo que bloqueaba usar la cara como entrada, y lo que obliga a que el chequeo emocional de `PLAN.md` 4.3 use el ángulo del cuerpo: es el único canal del dibujo que ningún estado usa para hablar.

La cara del aire salió de una idea suya: el estado avatar. Funciona, pero al revés de lo obvio — **el tilt ya era el estado avatar**, el descontrolado: rojo, temblando, con el poder manejándote a vos. El par tilt/aire es el mismo estado dominado y sin dominar, y el código ya lo tenía a medias.

Lo que se descartó es el brillo. Se probó con aura, mecha encendida y resplandor en los ojos, y decía "estás imparable": falso —la expectativa por operación no cambia porque el modo se encienda— y además convertía el modo en un trofeo a perseguir. Lo que `aire` mide es desapego, no potencia: `rTam` y `rEsp` comparan qué hacés después de perder contra después de ganar. Se enciende cuando el resultado anterior dejó de moverte.

Quedaron los ojos sin pupila, que son la señal inconfundible, y nada más: cejas horizontales, boca recta, cero aura. En CSS `airemode` apaga la vibración y afloja el resto: la respiración pasa a 7s y la mecha gira lenta (2,6s, o 1,4s con posición abierta) en vez de los 0,45s de siempre. Detenerla del todo se probó y borraba la señal de que hay plata puesta. El espejo exacto del tilt: en los dos el personaje está tomado, uno tiembla y el otro está inmóvil. Los ojos del avatar no van en `<g class="ojos">` porque ese grupo parpadea.

La referencia a Avatar vive en el dibujo y no en el texto a propósito: dicha en voz alta sería un remate pegado al final, que es lo que prohíbe el principio 8.

