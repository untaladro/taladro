# Plan de mejora

`REGISTRO` — Estado al 2 de agosto de 2026. Salió de una lectura del código, no del doc.

**Este archivo está hecho para desaparecer.** Es la tercera lista del proyecto y hereda el problema que CLAUDE.md ya identificó en la deuda conceptual: una lista que solo crece se convierte en ruido con formato de registro. La diferencia es que ésta tiene condición de muerte escrita: cuando los lotes estén cerrados, se borra el archivo. Si en seis meses sigue vivo con la mitad de los ítems abiertos, eso no es un plan, es una lista de deseos, y conviene borrarlo igual.

**El 4 de agosto se abrió un lote 6, y eso es exactamente lo que el párrafo de arriba temía.** La condición de muerte decía "cuando los cinco lotes estén cerrados"; agregar un sexto es la forma en que una lista con fecha de vencimiento se vuelve eterna. Se abrió igual por un motivo que conviene poder juzgar desde afuera: **los seis ítems no salieron de esta lista mirándose el ombligo, salieron de leer la superficie de la app preguntando qué ve el usuario.** Ninguno estaba acá porque ninguno se ve leyendo el motor por partes. **La condición se reescribe y no se vuelve a reescribir: se borra el archivo cuando cierre el lote 6.** Si aparece un séptimo, lo que falló es la lista y no el lote.

**Regla de cierre, heredada de CLAUDE.md:** el que resuelve un ítem lo borra de acá **y** de la lista de deuda de CLAUDE.md en el mismo commit. Si lo resolvió a medias, lo reescribe con lo que quedó. Si probó el arreglo y quedó peor, lo mueve a la tabla de **Descartes** con una línea explicando por qué — ese es el único destino que no es "borrar".

---

## Cómo está ordenado

Los ítems no están ordenados por esfuerzo ni por antigüedad. Están ordenados por **qué principio violan y en qué lugar de la lista está ese principio**, que es la regla de desempate que el proyecto ya tiene escrita. Un ítem que hace que la app afirme algo falso sobre su conducta (principios 2, 3 y 4) va antes que uno que hace que un gráfico se vea feo, aunque el segundo se arregle en cinco minutos.

Consecuencia incómoda que conviene aceptar de entrada: **el lote 1 arregla cosas que hoy no molestan y el lote 5 arregla cosas que se ven todos los días.** Está bien así. Un gráfico feo se nota; una métrica que miente, no — por eso es peor.

| Lote | Qué es | Requiere que decidas algo |
|---|---|---|
| **1. Desarmar lo que miente** | La app hace afirmaciones que sus propios números no sostienen | No |
| **2. Mirar antes de decidir** | Cuatro decisiones dependen de números que nadie miró todavía | No, pero produce los datos para el lote 3 |
| **3. Las decisiones** | Diseño pendiente, con recomendación y contra | Sí |
| **4. Diseño nuevo** | Piezas que no existen. Dependen del lote 2 | Sí |
| **5. Higiene** | Independientes, sin discusión, en cualquier momento | No |
| **6. La fricción y el rigor desparejo** | Una variable que daña todos los días y no se mide, y cuatro lugares donde la app se aplica dos varas | Sí, en dos |

---

# Lote 1 — Desarmar lo que miente · CERRADO

Los nueve ítems cerrados están hechos. El detalle de cada uno vive en CLAUDE.md, donde corresponde, y en la tabla de Descartes; acá no quedan porque esta lista registra lo que falta y no lo que se hizo.

| | Qué era | Dónde quedó |
|---|---|---|
| 1.1 | `sizeAfterLoss/Win` sobre notional crudo acusándote de una conducta | `estabilidad()`, función propia y única definición |
| 1.2 | El `null` de exposición contaba como falla del hábito | Sale del denominador: ni suma ni corta |
| 1.3 | Corte de días por mediana diaria sobre PnL, sin split-half | Borrado. La pregunta la contesta `adherenciaDiaria` |
| 1.4 | El gráfico de cuenta mostraba un solo dex | `serieTotal()` suma los dexes y dice cuántos |
| 1.5 | El equity acumulaba en orden de apertura | Va por cierre. Las rachas no se tocaron: es otra decisión, y quedó abierta como 3.6 |
| 1.6 | El empate contaba como ganadora e inflaba `winRate` | Caja propia, y `probRacha` usa `lossRate` |
| 1.7 | `Cargar JSON` armaba el objeto con un literal y se comía `portfolio`, `orders` y `dexes` | `desdeArchivo()` copia el JSON y pone defaults encima: el próximo campo pasa solo |
| 1.8 | La franja daba 40px al neto de una franja sin muestra | `MUESTRA_FRANJA`, una sola definición del umbral. Con `n < 3` no se dibuja la cifra |
| 1.9 | Dos de las cinco cajas de la tira medían con el resultado | `Racha` y `Mejor racha` fuera de la portada; `Más flojo` sale solo con el compromiso visible. La racha en curso vive en `rachaPanel` con su probabilidad |

**Lo que cerró 1.9 no fue el principio 3, y conviene que quede escrito.** El ítem argumentaba que `Racha` es PnL consecutivo, que es cierto y era discutible. Lo que lo volvió indiscutible apareció mirando el CSS: **`Hoy` lleva la clase `plata` y `Racha` no.** `body.tiltpage .plata` difumina a 9px, así que el tilt tapaba la plata —porque decidió que en ese momento el resultado no dice nada— y dejaba `5 perdedoras seguidas` nítida y en rojo en la caja de al lado. El modo se contradecía adentro de la misma fila. Ése es también el motivo por el que `Hoy` se queda siendo PnL: tiene el mecanismo que a `Racha` le faltaba.

**Queda pendiente de tu reacción, que es la evidencia que este ítem pidió.** Con compromiso activo la portada arranca en **dos cajas**. Si con la tira reducida dejás de abrir la app, gana el principio 7 y vuelven — al pie y en `--mut`, nunca como caja con cifra grande.

# Lote 2 — Mirar antes de decidir · CERRADO EL 3/8

Los seis están cerrados: los dos de código estaban hechos y los cuatro de medición se miraron el 3 de agosto sobre la cuenta real. Los números quedan anotados abajo, en este mismo archivo, porque son el registro de qué se vio y no una lista de pendientes.

**Mirar abrió un ítem y lo cerró el mismo día.** 2.3 contestó su duda con holgura y dejó ver otra —2.6— que resultó no estar. Los seis cerraron **sin cambiar un solo umbral**: los cuatro números que se sospechaban elegidos a ojo (`EXP_COBERTURA_MIN`, `EQ_COLA`, el 90% de concentración, y el umbral de gap que se iba a crear) quedaron donde estaban porque la medición no los tocó. Eso también es un resultado, y es el que este lote existía para producir.

| | Qué era | Estado |
|---|---|---|
| 2.1 | `computeStats` entero una vez por segundo para el reloj | Hecho. `renderFranja` reusa lo último calculado |
| 2.2 | `serieCuenta` elegía `allTime`, la más gruesa | Hecho. Se fusionan las cuatro; la más fina gana los empates |
| 2.3 | Cobertura y resolución de la serie sin verificar | **Mirado el 3/8.** Cobertura 99%; la resolución es el problema, y la cobertura no la mide |
| 2.4 | Concentración real de la exposición | **Mirado el 3/8.** 3% contra un umbral de 90%. `rTam` mide. Cerrado |
| 2.5 | Los retiros no se ven | **Mirado el 3/8.** No hay ni un retiro. 4.2 sigue bloqueado, con mejor motivo |
| 2.6 | La cobertura no distinguía medición de interpolación | **Mirado el 3/8.** Peor distancia 10,1 h contra un agujero de 10,2 días. Cierra sin umbral |

## Lo que se midió, el 3 de agosto de 2026

Volcado de `Diagnóstico de los datos` sobre la cuenta real, ventana 4/7/2026 – 3/8/2026, 175 operaciones.

### 2.3 — La serie de colateral: la cobertura está bien y no es la pregunta

| dex | puntos | hueco mediano | más chico | más grande | cobertura |
|---|---|---|---|---|---|
| `xyz` | 82 | 2,3 h | 18 min | **10,2 días** | 99% (174/175) |
| `hyperliquid` | 82 | 2,3 h | 18 min | 10,2 días | — (0/0) |

**Cobertura 99% contra un `EXP_COBERTURA_MIN` de 0,8: el umbral ni siquiera está cerca de morder, así que no hay nada que discutir ahí.** Toda la actividad está en `xyz`; `hyperliquid` tiene serie y cero operaciones.

**Pero el número que importaba no está en la tabla, y la aritmética lo delata.** 82 puntos son 81 huecos; el rango son 30 días, o sea 720 h. Si los 81 midieran el mediano de 2,3 h sumarían 186 h. Faltan 534 h repartidas en la mitad de arriba, con un hueco máximo de 10,2 días. **La serie es densa a ráfagas y ciega durante tramos largos.**

Y ahí está el hallazgo: **`cobertura` cuenta si se produjo un número, no si se midió cerca de la operación.** `equityEn` interpola entre los dos puntos que encierran la entrada sin mirar cuán lejos están, así que una operación caída adentro del hueco de 10,2 días recibe un colateral interpolado a lo largo de diez días **y suma como cubierta**. El 99% es cierto y dice bastante menos de lo que parece.

**Hipótesis que sale de esto, con su falsador.** El colateral no se mueve suave: salta en cada cierre. Interpolar linealmente sobre un hueco largo alisa esos saltos, así que una entrada inmediatamente posterior a una pérdida grande recibe un colateral tirado hacia el valor *previo* a la pérdida — colateral sobreestimado, **exposición subestimada justo después de perder**, que es el momento exacto que miran `tilt` y el `rTam` de `aire`.
→ *Cómo se falsaría:* comparar la exposición de las entradas con un punto real cerca contra las que caen en huecos largos. Si no hay diferencia sistemática, la interpolación no está sesgando y esto se cierra.

**Lo que hace falta, y no existe: la distancia de cada operación al punto real más cercano.** Es lo que debería condicionar si se usa exposición, en vez de una cobertura global que no distingue una entrada medida de una inventada por interpolación. **Queda abierto como 2.6.**

### 2.4 — La concentración: cerrado, y la preocupación no se materializó

Medida sobre **exposición**, en 174 de 175 operaciones: **133 valores distintos**, y el más repetido (2,00×) se lleva 5 veces, el **3%** del total.

El umbral con el que `rTam` se calla es 90%. Está a treinta veces de distancia, así que **la razón de tamaño de `estabilidad` está midiendo y no hay nada que rediseñar.**

**Conviene anotar que la sospecha que motivó el chequeo era falsa.** Se temía que con apalancamiento fijo y órdenes mínimas del exchange la escala quedara cuantizada en dos o tres valores, y que la razón diera 1,0 por construcción. Con 133 valores distintos en 174 operaciones, la exposición de él es prácticamente continua. **Cerrado, y que no vuelva.**

### 2.5 — Los retiros: no hay ninguno, y eso decide 4.2

Cuatro movimientos, todos del 14/7/2026. Los `delta.type` reales, que era lo único que se podía leer y no suponer:

| tipo | veces | qué es en estos datos |
|---|---|---|
| `send` | 2 | `user` **igual a** `destination`, con `sourceDex: "xyz"`. Es un movimiento entre dexes de la misma cuenta |
| `deposit` | 1 | `usdc: "8.111181"`. Entra plata |
| `spotTransfer` | 1 | `UETH`, `usdcValue: "9.278046"`, desde otra dirección. Entra valor |

**No hay un solo retiro.** Los tres tipos observados mueven plata *hacia adentro* o *entre dexes propios*; ninguno la saca.

**Y hay una trampa que ahora se puede evitar antes de caer en ella: `send` no es un retiro.** Con `user == destination` es un traslado interno entre márgenes de HIP-3. Contarlo como capital que sale sería medir una conducta que no ocurrió — el discriminador es comparar `user` contra `destination`, y hay que escribirlo antes de tocar nada.

**Qué le hace esto a 4.2 (la regla de pagarse):** sigue bloqueado, pero por un motivo mejor que "falta el endpoint". El endpoint está y responde. Lo que no hay es la conducta: **no se puede medir adherencia a una regla de retiro contra cero retiros**, y no se sabe todavía qué `delta.type` trae uno porque nunca pasó. Es exactamente el falsador escrito en `docs/hipotesis.md` — *"que sus retiros reales, una vez visibles, no tengan relación con ninguna regla previa; ahí la medición sería sobre una conducta que no existe"*. Se destraba solo cuando haya un primer retiro y se pueda leer su forma real.

---

### 2.6 — La distancia al punto real: mirado el 3/8, y cierra

Salió de 2.3: `anotarExposicion` contaba una operación como cubierta si `equityEn` devolvió un número, y `equityEn` interpola entre los dos puntos que la encierran **sin mirar la distancia**. Se construyó `gapEn`, `t.equityGap` y `diagGaps` para poder verlo. Lo que devolvió, sobre 174 entradas con exposición anotada:

| mitad de las entradas | 9 de cada 10 | 99 de cada 100 | la peor |
|---|---|---|---|
| 44 min | 1,7 h | 9,1 h | **10,1 h** |

**2 entradas (1%) cayeron a más del triple del hueco típico de su dex.**

**El número que cierra el ítem es el máximo, y hay que leerlo con cuidado: son 10,1 horas, no días.** El hueco más grande de la serie es de 10,2 **días**, así que si alguna entrada hubiera caído adentro, su distancia habría sido de hasta 5 días. Ninguna llegó ni a medio día. **El agujero de diez días de la serie está en un tramo donde no operó**, que era exactamente el falsador escrito cuando se abrió el ítem.

**Y el motivo estructural conviene anotarlo, porque es lo que lo hace seguro y lo que podría dejar de serlo.** La serie de `portfolio` parece registrar puntos cuando hay actividad, no a intervalo fijo. Por eso sus agujeros coinciden con los agujeros de su operatoria: el endpoint deja de anotar más o menos cuando él deja de operar. **La interpolación nunca tuvo mucho para arruinar.**
→ *Qué lo reabriría:* que la serie pase a ser por reloj en vez de por actividad, o que aparezca un dex que anote distinto. Ahí los agujeros dejan de alinearse con los suyos y `equityGap` vuelve a importar. El instrumento queda puesto para ese día.

**Lo que queda vivo, más chico y más preciso de lo que se temía.** Con hueco mediano de 2,3 h y varias operaciones por día, dos o tres entradas seguidas pueden caer adentro de la misma ventana y compartir una recta donde la realidad son escalones. Los extremos de esa recta **sí** son mediciones reales que incluyen el PnL de todo el tramo, así que el error está acotado por el movimiento total de la ventana y no se acumula. Con 2 casos lejanos no hay muestra para contrastarlo, y fabricar una conclusión con dos casos sería justo lo que el principio 2 prohíbe.
→ *Cómo se contrastaría el día que haya muestra:* exposición de las entradas con `equityGap` chico contra las de `equityGap` grande, con split-half. Si no separan, esto se cierra del todo.

**No se puso ningún umbral, y así queda.** El instrumento existe, el número dio bien y no hay nada que condicionar. Poner un corte ahora sería agregar un "a ojo" nuevo para resolver un problema que la medición dice que no está.

---

# Lote 3 — Las decisiones

Acá cada ítem lleva una recomendación con su argumento en contra. Ninguna se puede tomar desde el código: son decisiones tuyas.

---

## 3.1 — La banda que se persigue la cola · HECHO el 3/8

`banda = s.adherence.rec.avgLoss`, el promedio de las últimas 20 pérdidas, estaba copiado en **seis** lugares —cinco en `engine.js` y uno en `shell.html`, que nadie había contado— y el múltiplo `1.5` en cinco más. Si las pérdidas crecían despacio la referencia crecía con ellas: el hábito `perdida` marcaba verde para siempre y `tilt` dejaba de encontrar motivo justo cuando más lo habría.

**Qué se hizo: `bandaRiesgo(s, decl)`, hermana de `escalaTamano`.** Una sola definición, y `habitos`, `tilt`, `aire`, `presupuesto` y `analyzePositions` preguntan todas ahí. Se declara en frío desde `prepPanel` y se guarda en `DATOS.banda` como `{ banda, desde }`, igual que las reglas del `ejercicio` y por el mismo motivo: se elige antes, se mide adherencia después.

**Se eligió techo duro y no promedio, y eso mató el `× 1.5` donde había una decisión suya.** El múltiplo existía porque un promedio necesita tolerancia — pedirle a alguien que no supere nunca su propia media es un hábito que falla el 50% de las veces por construcción. Un techo declarado no la necesita: el número ya es el borde, y sumarle 50% lo convierte en otro número que él no escribió. De ahí que la función devuelva **dos** valores:

| | Qué es | Quién lo consume |
|---|---|---|
| `valor` | cuánto arriesgás por operación | `presupuesto`, y el calculador de tamaño de `prepPanel` |
| `limite` | hasta dónde una pérdida todavía cuenta como cumplida | `habitos.perdida`, `tilt.limpia`, `aire.regla`, el aviso de stop |

Coinciden con techo declarado. Con banda observada, `limite = valor × BANDA_TOL`. **El múltiplo vive adentro de la función y ningún consumidor multiplica nada.**

**Lo que apareció por el camino y no estaba en el ítem, en orden de qué tan callado se rompía:**

- **`shell.html` tenía la sexta copia.** `$('riesgo').value = ref` prellenaba el calculador de tamaño con la pérdida promedio observada. Era el lugar de más efecto práctico de todo el ítem —el número con el que dimensionás la próxima operación— y no estaba en la lista de cinco. Sale de `s.banda.valor`, y `t/banda.js` existe sobre todo para que el día que alguien lo revierta, algo se entere.
- **El hábito `perdida` acusaba por falta de dato.** El test era `t.net >= 0 || (ref > 0 && ...)`, así que sin banda una perdedora daba `false`. Es la invariante 2 en el último lugar donde faltaba: `dentro()` devuelve `null` y la operación sale del denominador. Es el caso de 1.2 otra vez, del otro lado del motor.
- **La guarda de `analyzePositions` era `s.adherence`, que es `null` hasta las ocho operaciones.** Con un techo declarado el aviso de "si salta el stop anotás X" tiene que funcionar desde la primera: el número no depende de tener historial, depende de que lo hayas escrito. Ahora la guarda es la banda.
- **`tilt` prometía un número más estricto del que medía.** *"La próxima tiene que cerrar dentro de US$X"* decía la banda, pero `limpia()` aceptaba hasta 1,5×. Dice `limite`.
- **Y no hizo falta escribir ninguna guarda para que la banda no se pueda cambiar en caliente.** `prepPanel` desaparece con tilt activo y con posición abierta, así que el bloque no existe en los dos únicos momentos en que se te ocurriría subir el techo. Está anotado en el código: si algún día se muda a un panel que sobrevive al tilt, la guarda hay que agregarla a mano.

**Lo que se rechazó:** un umbral de "deriva grande". El único corte del aviso es 1,0 — o sea la definición misma del techo. *"Tu promedio ya pasó el número que escribiste"* es un hecho; *"tu promedio pasó el número que escribiste por 1,3"* pide inventar cuánto es demasiado, que es justo lo que el lote 2 se cansó de no hacer. El bloque no tiene color de estado por el mismo motivo: es una decisión tuya anotada, no un semáforo.

**Qué falsaría todo esto:** que nunca lo escribas. A los dos meses con `DATOS.banda` en `null`, la banda móvil con todos sus defectos era mejor que la correcta que nadie cargó. **Y el segundo falsador, que es nuevo y sale de haber elegido techo duro:** que con el número exacto la racha de `perdida` quede clavada en cero. Ahí lo que está mal es el techo declarado y no la falta de tolerancia — y el que lo dice es la deriva, sin tocar nada.

---

## 3.2 — Los 30 minutos de `corte` · BORRADO el 3/8

*"No sostener una perdedora más de 30 minutos"* era el único umbral de la app que no salía ni de sus datos ni de una decisión suya, y `byDur` contempla tramos de hasta 7 días: el motor admitía swing y el hábito lo castigaba. **Se borró.** Los hábitos son cuatro.

**Se rechazaron las dos alternativas, y la segunda es la que vale anotar.** Declarar la duración máxima —reusando el panel que 3.1 acababa de construir— era la opción coherente y quedó afuera igual: agrega un campo más para sostener una conducta que la app ya describe sin puntuarla. Y derivar el umbral de la mediana de sus perdedoras es **exactamente la forma que 3.1 acababa de cerrar**: aguantar cada vez más habría corrido el umbral con él y el hábito marcaría verde igual. Las dos están en `docs/descartes.md`.

**La medición no se perdió.** La tarjeta de efecto disposición (`avgDurLoss / avgDurWin` en `buildInsights`) la describe sin puntuarla. Lo que se perdió a propósito es la racha, que es lo que la convertía en prescripción. Y `adherenciaDiaria` dejó de contarla entre las conductas del día, sin tocarle una línea: le pregunta a `habitos()`.

**Lo que apareció al borrar, y es la mitad del trabajo.** Una serie del `ejercicio` declarada contra `corte` seguía viva en `DATOS.ejerc`. El motor ya tenía escrito *"si la declaración pide una regla que no existe, se ignora"*, y eso convertía el borrado en dos fallas calladas: una serie declarada con tres reglas pasaba a juzgarse con dos —**criterio cambiado sin que él tocara nada**— y una declarada solo con `corte` devolvía `null` y **desaparecía**, con el panel ofreciendo empezar otra como si nunca hubiera existido. Las dos son la forma de bug que este proyecto persigue: el error saliendo como éxito. `ejercicio` ahora devuelve `ignoradas`, el panel lo dice con nombre y explica que no se cortó por nada que él haya hecho.
→ *Qué lo reabre:* que se borre otro hábito. El aviso ya está puesto, pero el mensaje nombra la regla muerta y nada más — si algún día se borran dos a la vez, conviene mirar que la frase siga leyéndose.

**Contra, que sigue en pie:** el efecto disposición es el patrón mejor documentado en trading minorista, y la app se quedó sin su única medida accionable de eso. Una tarjeta descriptiva no genera racha.
→ *Qué lo revierte:* que la tarjeta se te encienda seguido y no cambie nada. Ahí lo descriptivo no alcanzaba, y vuelve — **pero como duración declarada por vos, no como los 30 minutos.** Ese número no vuelve.

---

## 3.3 — `presupuesto` es casi una tautología · HECHO el 3/8

`habilitado = banda / (stopTípico/100)`, donde `stopTípico` era la mediana de `|net| / notional` de las perdedoras. Si la pérdida relativa fuera constante, `habilitado` sería el promedio del notional **por construcción**: `uso` terminaba comparando tu notional reciente contra tu notional de hace un rato, y el notional se mueve solo con el colateral. **La barra podía mostrarte "corto" simplemente porque perdiste.**

3.1 había cortado una punta —con techo declarado, `banda` ya no sale del PnL— pero la tautología necesitaba las dos. Ésta era la que faltaba.

**Qué se hizo.** `stopTípico` ahora es `holguraHist.stopMediano`: la distancia al stop que la app vio **en vivo**, mirando posiciones abiertas. Es independiente del resultado — es dónde lo pusiste, no cómo salió. El dato ya se venía guardando en `DATOS.holguras` desde que existe `registrarHolgura` y solo alimentaba una tarjeta descriptiva.

**Con menos de 5 observadas la pieza se apaga**, y ése es el costo aceptado. El umbral es el mismo 5 que ya usaba la tarjeta de holgura en `buildInsights`, no uno nuevo. La alternativa era caer al cálculo viejo con un rótulo, y se descartó por un motivo concreto: **es más fácil ignorar un rótulo que una barra apagada**, así que el fallback dejaría la tautología viva y prolija.

**Pero apagada no es muda, y eso es la mitad del arreglo.** Devuelve `{ apagado: true, motivo, conStop, falta }` en vez de `null`, y el panel dice qué le falta y por qué no se calcula con lo que hay. Una pieza que desaparece sin explicación se lee como un bug — la diferencia entre *"no da"* y *"todavía no se puede medir"* es la que esta app viene cuidando en todas las demás.

**El test que prueba que la circularidad se rompió** no mira el número sino su independencia: con el mismo stop observado y perdedoras del doble de grandes, `stopTípico` no se mueve. Y con techo declarado más stop observado, el `habilitado` es idéntico entre dos historiales con resultados distintos — o sea que ya **no depende en nada del resultado**, que era el punto.

**Un bug que apareció al escribirlo, y vale para cualquier consumidor nuevo de `holguraHist`:** sin observaciones esa función devuelve el objeto corto, **sin `conStop`**. Leerlo directo daba `NaN` en el conteo y en pantalla. Los campos largos solo existen cuando hubo al menos una.

→ *Qué lo reabriría:* que a los dos meses la barra siga apagada. Ahí lo que falla no es el criterio sino la cobertura, y la pregunta pasa a ser cómo lograr que la app vea más posiciones abiertas — no cómo calcular el stop sin verlas.

## 3.4 — `comparativas` en notional crudo · HECHO el 3/8

`engine.js` partía la muestra con `push('Con notional mayor a tu promedio', trades.filter(t => t.notional > nProm))`. Con apalancamiento fijo el notional es colateral × 20, así que **"las grandes" era en realidad "las que hiciste cuando la cuenta venía bien"**: el error #4 de CLAUDE.md, el mismo que ya había sacado a `sizeAfterLoss/Win`, sobreviviendo en otra función.

**Qué se hizo:**

- El corte le pregunta a `escalaTamano`, como el resto de la app. Una sola definición de "tu tamaño de siempre".
- **Mediana en vez de promedio**, que es lo que usa todo lo demás y lo que no arrastra una operación enorme.
- **La etiqueta dice sobre qué base cortó** — *"Con más exposición que tu mediana"* contra *"Con notional mayor a tu mediana"*. Cambia qué significa la fila y no puede quedar implícito en una tabla que compara PnL.

**Lo que no estaba en el ítem y era la mitad del arreglo: el tercer estado.** `push` comparaba `sel` contra *todo lo demás*, y eso alcanza para los otros cortes —una operación cayó en Asia o no cayó, no hay tercera opción— pero el tamaño **sí** la tiene: `escalaTamano.de()` devuelve `null` cuando falta el colateral de ese momento. Sin tocar nada, esas operaciones se iban al `resto` por descarte, o sea que **"no se pudo medir" quedaba comparado contra "grande" como si fuera "chica"**. `push` ahora acepta un `universo` opcional y el corte de tamaño le pasa solo las medibles. Es la invariante 2 otra vez, en el último lugar donde faltaba: el `null` sale del denominador, no se acomoda del lado que sobra.

**Y una falla callada que apareció con `grep` y no con los tests.** `repertorio` traduce las etiquetas de la tabla a la voz de Taladrín con un `enCriollo` de reemplazos por expresión regular, y tenía la etiqueta vieja escrita a mano. Cambiar el rótulo en `comparativas` la habría dejado sin matchear **sin romper nada**: Taladrín habría empezado a leer el título de columna crudo. Están las dos nuevas, porque el rótulo depende de la base que elija `escalaTamano` en cada cuenta.
→ *Deuda que esto deja a la vista:* `enCriollo` es un segundo lugar donde viven las etiquetas, acoplado por string. Vale la pena mirarlo cuando se toque 3.5, que reescribe la misma función.

**Nueve pruebas nuevas** sobre una fixture de quince operaciones con tres tamaños rotando —tres y no dos: con dos, la mediana *es* el valor grande y el corte no selecciona a nadie— y la serie de colateral arrancando recién en la cuarta, así que tres quedan sin medir por la punta de abajo, donde `equityEn` devuelve `null` sin la tolerancia de `EQ_COLA`. Verifican que el denominador del corte son las 12 medibles y no las 15, y que un corte sin tercer estado sigue usando la muestra completa.

---

## 3.5 — `comparativas` no controla comparaciones múltiples · HECHO el 3/8

Era el punto más flojo estadísticamente de la app. `estable` solo pedía que las dos mitades coincidieran en **signo** — bajo hipótesis nula eso pasa la mitad de las veces, así que con 30 cortes unos 15 pasaban por azar — y `repertorio` levantaba el primero del ranking y lo decía como *"lo que más te cambia el resultado"*.

**Qué se hizo: test de permutación por corte más Benjamini-Hochberg al 10%.** Para cada corte se barajan las etiquetas hasta 2000 veces y se cuenta qué fracción da una diferencia de magnitud mayor o igual a la observada. Después BH sobre todos los p controla la tasa de falsos descubrimientos.

**Lo primero que hay que entender es que no reemplazó a `estable`, y no son lo mismo.** `estable` controla la **época**: que el patrón aparezca en las dos mitades. El p controla la **multiplicidad**: que aparezca más seguido que el azar entre todos los cortes que se probaron. Un corte puede aguantar el split-half y ser ruido igual, y puede tener un p chiquito y describir solo una época. `repertorio` pide **los dos** y la tabla muestra las dos columnas.

**Por qué permutación y no un test t.** La distribución de PnL de esto no es normal ni de cerca: cola larga a la izquierda por las liquidaciones, masa cerca de cero, y muestras de 5 a 40 operaciones. Un test t sobre eso da tres decimales y ninguna garantía. Barajar no supone nada — construye la distribución nula con sus propios datos.

**Tres decisiones de implementación que no son cosméticas:**

- **El RNG es determinista y sembrado con el corte** (`label|n|universo`). Sin esto el mismo historial daría un p distinto en cada render y un corte entraría y saldría del ranking solo, que es justo el tipo de inestabilidad silenciosa que este proyecto persigue.
- **El p nunca es cero.** Se cuenta `(1 + extremos) / (1 + B)`, la corrección de Davison & Hinkley. Con B finito un p de 0 afirmaría "esto no pasa nunca por azar", y lo único que se midió es que no pasó en 2000 intentos. El piso honesto es 1/2001.
- **Para en cuanto sabe que el corte no sobrevive.** El umbral más laxo que puede aplicar BH es `q`, así que si el p parcial ya lo supera, seguir barajando no cambia el veredicto. **Medido sobre datos sin señal, que es el caso real: 76 ms → 13 ms**, con los 30 cortes cortando temprano. Los p chicos se calculan enteros. El precio es que ese número pasa a ser una cota inferior y no un valor, y la tabla lo dice: muestra `> 0,10` y no un decimal inventado.

**Calibración, que era la única forma de saber si esto anda.** Sobre 300 cortes sin señal: `p < 0,05` en el 4,0% y `p < 0,10` en el 9,0%. Los teóricos son 5% y 10%. Con un grupo corrido +1,5 el p se hunde al piso. Hay un test que lo fija.

**Lo que aparece cuando no sobrevive nada, que es el caso probable.** `repertorio` no se queda mudo ni rellena con otra cosa: dice cuántos cortes se probaron y que ninguno se separa más de lo que se separaría barajando. Y la tabla lleva arriba un aviso con el mismo número. **Sin ese aviso la tabla se lee como una lista de hallazgos y la fila de arriba parece un descubrimiento**, que es exactamente el problema que el ítem vino a arreglar — corregir el ranking y dejar la tabla sin contexto habría movido el error de lugar.

**Y la frase cambió aunque el corte sobreviva.** *"Lo que más te cambia el resultado"* afirmaba causalidad sobre un corte observacional. Ahora es *"donde más se separan tus números"*. **Eso no lo arregla la estadística**: el problema es de diseño observacional y no de muestra, así que ningún p por chico que sea lo habría autorizado.

→ *Lo que falta y no puedo hacer yo:* mirarlo sobre la cuenta real. Con la fixture sintética son 9 cortes y no sobrevive ninguno, que es lo esperable en datos sin señal. **El número que importa es cuántos sobreviven con sus 175 operaciones**, y sale de abrir la app. Si sobrevive alguno, vale mirar si es de los que él ya sospechaba; si no sobrevive ninguno, la app quedó más callada y eso es el arreglo funcionando.

**Sobre la guarda `difA !== 0`:** el ítem notaba que es prácticamente vacía con PnL en punto flotante. Se dejó igual. Ahora que hay un p, la guarda dejó de ser lo que sostiene la afirmación y no vale la pena tocarla.

---

## 3.6 — Las rachas se cuentan en orden de apertura · HECHO el 3/8

**Lo destrabó un dato que él aportó y que ningún instrumento podía ver: opera varios perps en paralelo y no los cierra en el orden en que los abre.** Con eso el ítem dejó de ser una decisión a ciegas — el desorden existe, no es cosmético, y la pregunta *"¿tu racha es el orden en que abriste o el orden en que te enteraste?"* tiene una sola respuesta razonable: **la racha es un estado psicológico y lo dispara enterarte del resultado.**

**Qué se hizo.** `computeStats` ordena por cierre una sola vez, arriba, y todo lo de abajo hereda ese orden. **No hay una segunda vista ordenada al lado**: dos definiciones del orden serían la misma trampa que este proyecto ya pisó con `escalaTamano` (tres definiciones) y con la banda (seis copias), donde la misma operación cumplía para una pieza y fallaba para otra. La curva de equity dejó de hacer su propia copia ordenada porque ya no hace falta.

El desempate es `entryTime` y no puede faltar: dos cierres en el mismo milisegundo dejarían el orden a merced del sort del navegador y **las rachas cambiarían entre recargas sin que nadie tocara nada**. Hay un test que ordena los fills al revés y verifica que el resultado sea idéntico.

**El caso concreto que arregla**, y está en los tests: BTC abre primero y cierra última, ganadora, envolviendo tres perdedoras de ETH. Por apertura la racha en curso era **3** y el `tilt` se encendía por una secuencia que él nunca vivió; por cierre es **0**.

### 3.6b — Lo que esto destapó, y es más grande que el ítem

`aire.parálisis` y `estabilidad.rEsp` calculaban el hueco como `cur.entryTime − prev.exitTime` entre operaciones consecutivas. **Con dos perps abiertos a la vez esa resta da negativo** —la siguiente abrió antes de que la anterior cerrara— y el código lo descartaba con `if (g > 0)`, en silencio.

**El efecto no era un número mal: era una submuestra sesgada.** Cada vez que operaba en paralelo ese hueco desaparecía del cálculo, así que el hueco típico salía solo de las veces que operó de a uno. Y de ahí salía el techo de parálisis del modo aire.

**Con posiciones paralelas, "estar sin operar" no es la distancia entre dos operaciones consecutivas: es el tiempo en que no hubo ninguna abierta.** `huecosSinPosicion` hace merge de intervalos y devuelve los huecos reales. Es la única definición que no depende de en qué orden se miren las operaciones.

Dos consecuencias que valen escritas:

- **Una operación que abre mientras ya había otra corriendo no tiene hueco delante.** No volviste de ningún lado, seguías adentro — y por eso no se la juzga por parálisis. Antes se la juzgaba contra un hueco inventado.
- **`estabilidad` mide la espera como la primera apertura posterior al cierre**, no como la distancia a la siguiente de la lista. Si no hay ninguna posterior, la operación no aporta espera: no es una espera de cero, es que ya estabas adentro o que todavía no volviste. Sale del denominador.

→ *Qué lo reabriría:* que aparezca una definición de racha que él viva distinto — por ejemplo, que con dos perps abiertos sienta las pérdidas por instrumento y no mezcladas. Ahí la racha sería por símbolo y no global, y eso es otro ítem.

# Lote 4 — Diseño nuevo

Tres piezas que no existen. Las dos primeras dependen del lote 2; la tercera no depende de nada y es la única que agrega una fuente de datos en vez de leer mejor las que hay.

---

## 4.1 — La parálisis hacia adelante · HECHO el 3/8

`aire` la detectaba retroactivamente, en la operación que vuelve. Un hueco abierto —estar sin operar ahora mismo— no existía en ningún lado, así que el riesgo que él declaró como principal se veía solo por el espejo retrovisor.

**Lo destrabó el principio 5 reescrito, no un dato.** La versión vieja prohibía crear un malestar que se alivie operando, y un contador de días sin operar es exactamente eso. La actual agrega: *"pero medir no es empujar: la app puede saber que hay un hueco abierto y mostrarlo en frío en el panel al que él va a buscarlo."*

`huecoAbierto(s, now)` devuelve el hueco actual y su percentil contra su propio historial. **Con posición abierta devuelve `null`: estás adentro, y eso no es un hueco de cero.** Debajo de 10 huecos históricos dice el hueco pero no inventa un percentil.

**Las tres restricciones son la pieza tanto como el número**, y las tres están fijadas en `t/momento.js` porque ninguna rompe un test del motor:

1. **Solo en el panel.** Nunca en `taladro` — hay una aserción de que la mascota no lo menciona.
2. **Sin color que cambie.** `--mut` fijo. El día que alguien le ponga un umbral y un rojo, dejó de medir y pasó a reprochar.
3. **Sin contador de días suelto.** El hueco va siempre con su percentil al lado, que es una descripción; *"llevás 4 días"* solo es un reloj de culpa.

**Y usa los huecos de `huecosSinPosicion`, no los de antes.** Comparar contra un histórico que descartaba los solapes daría un percentil inflado: se estaría comparando contra la mitad tranquila de su historia.

→ *Qué lo falsaría:* que lo mires y te den ganas de operar. Ahí el principio 5 gana y se saca, aunque el número sea correcto.

## 4.2 — Las declaraciones sin ejecutar · HECHO el 3/8 · y la regla de pagarse, que sigue bloqueada

Dos ítems que comparten forma: los dos necesitan acumular datos antes de decir una palabra.

### Dejar de purgar las declaraciones

`shell.html:1737` las borra a las 4 horas. Son el único registro observable de un setup identificado y no tomado — la única conducta de escasez en dirección sub-operar que la app podría ver. **El código tira exactamente el dato que mediría hesitación.**

**Hecho.** `caducarDeclaraciones` marca `caducada` con el momento del vencimiento y no borra nada. `marcarDeclaradas` no cambió — sigue mirando solo las vivas de las últimas 4 horas — así que ninguna medición existente se movió.

**El orden en `ingest` importa y no es intercambiable:** primero se pegan las que alcanzaron a una operación, después se marcan las vencidas. Al revés, una declaración de 4 h y un minuto quedaría caducada antes de que `marcarDeclaradas` la mirara.

**Qué se dice con eso: nada, y está construido para que sea así.** `declaracionesSerie` devuelve el conteo con un `listo` que solo se enciende a las 30 cerradas, y hasta entonces el panel dice explícitamente que es solo el conteo. Puede que declares y no ejecutes por la mejor razón posible —el setup no se dio— y ahí "declaraste y no tomaste" es disciplina, no hesitación.

**Vive en Diagnóstico y no en la portada, por principio 5.** Un contador de "vencidas" a la vista invita a ejecutar la próxima para que no se venza, y ahí la app habría creado un malestar que se alivia operando. A Diagnóstico hay que ir a buscarlo.
→ *Qué haría falta para separar disciplina de hesitación:* ver si las caducadas se agrupan en las mismas franjas donde su adherencia ya es peor, o si aparecen sueltas. Eso necesita 4.4, que ahora existe.

### La regla de pagarse · `nice to have`, y ahora se sabe por qué

**Bajado de prioridad el 3/8 con el motivo real, que no era el que estaba escrito.** El plan decía que estaba bloqueada por falta de retiros; el motivo de fondo es más concreto: **no puede retirar hasta juntar 10 USDC**, que es lo que cuesta la orden mínima para comprar ETH y sacar. O sea que no es que todavía no haya retirado — es que hasta ese umbral **la conducta no puede existir**, y medir adherencia a una regla que el exchange no te deja ejecutar sería inventar la variable con otro nombre.

Se queda anotado y no se construye. Cuando aparezca el primer retiro, lo primero es leer su `delta.type` real — la trampa ya está escrita más abajo y no cambió: **`send` con `user == destination` es un traslado interno entre márgenes de HIP-3, no un retiro.**

### La regla de pagarse

Bloqueada por 2.5. Una vez que los retiros sean visibles, la forma es la misma que 3.1: **vos escribís la regla en frío, la app mide adherencia**.

Prohibido explícitamente, y conviene dejarlo escrito antes de construir nada: cualquier contador del tipo *"llevás US$X guardados"*. Eso es PnL con moño y muere en el principio 4.

---

## 4.3 — El chequeo emocional, medido como error de pronóstico · HECHO el 3/8

**Es el único ítem de esta lista que agrega una fuente en vez de leer mejor las que ya hay, y por eso hay que justificar primero que no viole el principio 1.**

`motor.md` dice que "no mantener la calma" —la quinta de las cinco formas de fallar— **quedó sin medir a propósito**, porque el único proxy disponible eran las reentradas calientes y sus propios datos las desmintieron (+US$0,21 por operación *mejor* que el resto). El principio 1 dice, textual, *"cambia con: que aparezca la fuente que falta. Es prohibición sobre adivinar, no sobre un tema."* Una pregunta directa no es un proxy: **es la fuente.** Es la única de las cinco fallas que no se puede sacar de los fills y la única que tiene fuente trivial. Esto no abre un tema nuevo — cierra el agujero que el motor ya declara abierto.

**Lo que hay que rechazar de entrada es la versión obvia**, que es la que trae cualquier app del rubro: preguntar "¿cómo te sentís?" al cerrar y guardar el nivel. Al cerrar, el estado está determinado por el resultado. Se obtiene una serie que correlaciona con el PnL, se la rotula "emoción", y es el **error #4 de CLAUDE.md otra vez**: el resultado disfrazado de acción, ahora con la coartada de que lo dijo él.

### Recomendación: no se guarda el nivel, se guarda la diferencia entre dos lecturas

Dos preguntas de tres opciones, la misma escala, en dos momentos:

- **Antes de entrar,** adentro del panel `prep` que ya existe, pegada a la tesis: *si sale mal, ¿cuánto te va a mover?*
- **Al cerrar,** y **solo si contestó la de antes**: *¿cuánto te movió?*

La variable es `movio - pronosticado`. Tiene tres propiedades que el nivel no tiene:

1. **Es acción y no resultado.** El pronóstico se declara en frío, antes de entrar. Es exactamente la forma de `edgeDeclarado` y del `ejercicio`, que es la única forma que este proyecto ya probó dos veces: se elige antes, se mide adherencia después.
2. **El PnL no la explica solo.** Dos perdedoras idénticas pueden dar error 0 y error 2.
3. **Tiene contraste externo, que ninguna otra métrica de la app tiene.** El *impact bias* dice que la gente sobreestima la intensidad y la duración de sus reacciones a eventos negativos, y que el mecanismo es no anticipar lo rápido que uno se acomoda ([Wilson & Gilbert 2005](https://bear.warrington.ufl.edu/brenner/mar7588/Papers/wilson-gilbert-cdips2005.pdf)). Si sus datos dan sobreestimación, el hallazgo se dice como **"te pega menos de lo que creés"**, con su número al lado — que es principio 7 en estado puro y no consuelo, porque sale de su serie. Si dan *sub*estimación, contradice la línea de base publicada y es un hallazgo de verdad.

**El "solo si contestó la de antes" no es un detalle de UX: es lo que hace que el ítem sea barato y lo que lo mantiene del lado correcto del principio 3.** La pregunta del cierre no existe salvo que haya un pronóstico contra el cual medirla, lo que corta el volumen a la mitad y elimina justo las respuestas que serían PnL.

### Los momentos que quedan afuera, y por qué

**Con posición abierta no se pregunta nada.** `registrarHolgura` ya está poleando ahí, así que técnicamente sería gratis — y ése es el argumento tramposo: gratis para el código, caro para él, que está adentro de una operación.

**Sin trade abierto tampoco, por ahora.** *"¿Cuántas ganas de entrar tenés ahora?"* mide activación, que es otra variable que la del par pre/post; juntarlas en el mismo ítem es dos mediciones con una sola muestra. El par se sostiene solo, no necesita línea de base. Si se construye alguna vez, es ítem aparte y con una condición dura: **solo en el panel, sin nada que la reclame.** La arquitectura ya lo protege sin ayuda —página sin servidor, no puede notificar— y el día que aparezca la tentación de un aviso, ahí muere por principio 5.

### La interacción: tres Taladrines inclinados, adentro de `prep`

Tres botones en fila en el panel al que ya va a escribir la tesis. Superficie nueva cero. **La escala no son palabras: son tres ángulos del mismo dibujo.**

| | Ángulo | Rótulo |
|---|---|---|
| 1 | 0° | firme |
| 2 | ~19° | sacudido |
| 3 | ~56°, cayéndose | volteado |

**El taladro es un objeto que se puede voltear, así que el ángulo *es* la pregunta.** "Cuánto te movió" se contesta con cuánto está movido, sin traducir a una palabra y sin calibrar qué significa un 2 sobre 3. Y resuelve lo que hundía a la versión de dos frases: **el ángulo es ordinal por construcción**, así que hay diferencia que medir. Los rótulos van debajo como etiqueta, no como la escala; si molestan, se sacan y no se pierde nada.

**La cara es la misma en los tres** —`seco`, impasible— y eso no es ahorro de dibujo: es la regla que hace que esto no rompa nada.

> **La salida varía la cara y mantiene el cuerpo derecho. La entrada varía el cuerpo y mantiene la cara igual.**

Ésa es la línea que desbloquea el ítem. Este archivo tenía anotada la idea de usar a Taladrín como instrumento y **bloqueada** porque "dos fuentes para el mismo dibujo se pisan" — cierto mientras la entrada compitiera por la cara, que es el canal que `taladro` ya usa para tilt, aire, hitos y ejercicio. Las ocho expresiones de `CARAS` están todas tomadas. El ángulo del cuerpo no lo usa ningún estado de salida: `tiltmode` tiembla y `airemode` se queda quieto, los dos derechos. **Canal libre, bloqueo levantado.** (De paso: `interfaz.md` dice "siete expresiones" y `CARAS` tiene ocho — quedó desactualizado cuando entró `avatar`.)

Dos cosas que **no** puede hacer el dibujo de entrada, o el bloqueo vuelve: tomar el rojo de `PALETA.tilt`, y animarse. Estático y en la paleta normal, siempre.

Se descartaron sin construir, y van a Descartes si se prueban: **contar cuántas veces apreta "destapar la plata"** durante el tilt, que es conducta observada pero es un proxy y solo repite la trampa de las reentradas calientes; y **muestreo adaptativo** —preguntar solo donde el motor no puede predecir la respuesta— más elegante, pero exige inventar el criterio de "no puede predecir".

### El número que decide si esto vive

En la literatura de EMA, los diarios de frecuencia diaria rinden ~90% de cumplimiento y las encuestas de frecuencia horaria ~63% ([JMIR Formative 2024](https://formative.jmir.org/2024/1/e49512)). Con scalping, preguntar por operación **es** frecuencia horaria. Diseñar para el 100% de las operaciones cosecha ~40%, y sesgado hacia las operaciones tranquilas — justo las que no importan. Techo realista: una lectura de base por sesión más el par pre/post en un subconjunto.

**La invariante que lo hace compatible ya está construida:** sin respuesta es `null`, y `null` sale del denominador (invariantes 2 y 3). **No se inventa un "no contestó = neutro"**, que sería la versión emocional exacta del error 1.2.

### Prohibido, y conviene dejarlo escrito antes de construir nada

- **Racha de check-ins.** El pre-check solo se puede contestar si vas a entrar: sería una racha que se alimenta operando. Principio 5, sin discusión.
- **Un score emocional agregado** tipo *"Calma: 72"*. Es el `Trading Strength` de TraderControl, que es un promedio ponderado sin fórmula publicada y desglosado por día y por setup con N chico.
- **Rueda de emociones o grilla 2D valencia/activación.** Nunca va a haber N por celda.
- **Decir qué hacer con el estado** (*"estás activado, no operes"*). La app no ve precios: eso es timing con ropa de apoyo emocional, que es la frase con la que el principio 4 ya mató al empujón horario.

### Cómo quedó

`marcarChequeos` pega el pronóstico a la próxima operación que abra dentro de 4 h, igual que una tesis — **y no se fusionó con `marcarDeclaradas` a propósito**: son dos preguntas distintas y atarlas obligaría a declarar tesis para poder pronosticar. Comparten mecanismo, no significado. `anotarMovio` guarda la lectura por id, porque ahí la operación ya existe. `errorPronostico` arma la serie de `movio - pronosticado`.

**La invariante que lo hace compatible ya estaba construida y acá se usa entera:** una operación con pronóstico y sin lectura no aporta un cero, aporta nada. Hay un test que fija que el promedio es `null` y no 0 sin pares completos, y otro que fija que **una lectura sin pronóstico previo no cuenta** — si contara, sería el PnL con otro nombre y con su firma.

**Y hay un test que muestra por qué la variable no es el resultado disfrazado:** dos perdedoras idénticas en PnL, una con error 0 y otra con error 2. El nivel solo no puede distinguirlas; la diferencia sí.

**Los tres ángulos son 0°, 19° y 56° sobre la base de la empuñadura**, que es lo que hace que "volteado" se lea como que se cae y no como que gira. El `viewBox` es el mismo para los tres y por eso es grande: con marcos ajustados por ángulo los tres se verían del mismo tamaño y la inclinación perdería todo lo que tiene para aportar. `t/cheq.js` verifica que los tres ángulos sean distintos y crecientes, que el dibujo no tome el rojo de `PALETA.tilt`, que no lleve ninguna clase animada, y que la cara sea la misma en los tres.

**El pre-check vive en `prepPanel`, que no existe con posición abierta ni en tilt.** La pregunta no aparece nunca adentro de una operación, y no hizo falta escribir la guarda — es la misma propiedad que protege al techo de pérdida de 3.1. Si algún día se muda a un panel que sobrevive al tilt, hay que agregarla a mano.

**No hay cuarta opción de "no sé".** No contestar es el `null`, y el panel lo dice.

**Qué lo falsaría, en dos partes.** A las 30 operaciones con par completo, si el error de pronóstico no tiene relación con ninguna conducta ya medida —`regla`, `salto`, `ráfaga`, holgura— la pregunta se saca y se anota en Descartes. Y por separado: si a las cuatro semanas menos de la mitad de las entradas declaradas tienen pre-check, **lo que falló es la superficie, no él**; se prueba otra forma de preguntar antes de concluir nada sobre la variable.

---

## 4.4 — `adherenciaSesion()` · HECHO el 3/8

Nada de 4.5, 4.6 ni el mapa se puede construir sin esto, así que va primero.

`bySession` (`engine.js:310`) guarda `{ n, net, wins }`. **Las tres son resultado.** No hay ninguna forma, hoy, de preguntar "¿cómo se porta mi proceso en la rueda contra el after?" — solo se puede preguntar cuánto gané en cada una, que es la pregunta que el principio 3 no quiere que la app conteste.

**Arreglo:** una función que agrupe `habitos().serie` por sesión y por tramo, y devuelva por celda `{ n, cumplidas, medibles, pct }`, con la **invariante 2 aplicada entera**: `estado === 'sd'` sale del denominador, no cuenta como falla ni como cumplido. `pct` es `null` cuando `medibles < 5`, y quien lo consuma tiene que poder distinguir "no hay muestra" de "0%".

**Se guardan todas y se muestran las que llegan**, que es lo que él eligió: una celda vacía es información —dice que casi no operás ahí— y colapsarla la esconde. `pct` es `null` y no 0 debajo de 5 medibles, porque en un mapa pintado por adherencia esa es la diferencia entre gris y rojo.

**Y son diez celdas, no nueve.** Este plan decía nueve porque contaba cinco sesiones, y `SESSIONS` tiene seis: `finde` es una franja donde él opera y tiene que existir. Cinco sesiones fuera de la rueda más los cinco tramos. La rueda no aparece como celda propia o sus operaciones quedarían contadas dos veces.

**Un juicio no es una operación**, y conviene tenerlo claro antes de leer el número: cada operación aporta tantos juicios como hábitos se le hayan podido medir. Una celda puede tener 2 operaciones y 6 juicios. La invariante 2 va entera — `sd` sale del denominador — porque si no, una franja con agujeros en la serie de colateral tendría peor adherencia sin que él hubiera hecho nada distinto, y **el mapa estaría pintando la cobertura de un endpoint con los colores de la disciplina.**

**El falsador estaba escrito como "todas entre 78% y 84%", y ese 6 habría sido otro umbral inventado.** Se contesta con el instrumento de 3.5: barajar a qué celda pertenece cada juicio, manteniendo los tamaños, y ver si la dispersión observada es más grande que la del azar. El estadístico es la suma ponderada de los desvíos al promedio general —un chi-cuadrado escrito sin la tabla— y no se compara contra una distribución teórica, porque con celdas de cinco juicios eso no vale.

`separa` es `null` mientras no haya con qué contestar, que **no es lo mismo que "no separa"**. Hay un test que fija esa diferencia, y otro que verifica que los tramos cubren la rueda entera sin un minuto suelto: si alguien mueve un límite y queda un hueco, esas operaciones se irían a `sinCelda` sin error.

### Medido sobre la cuenta real el 3/8: **no separan**

194 operaciones, 582 juicios, nueve celdas con muestra:

| | Asia | Pre | After | Finde | Apertura | Media mañana | Mediodía | Tarde | Cierre |
|---|---|---|---|---|---|---|---|---|---|
| ops | 40 | 24 | 35 | 12 | 29 | 20 | 14 | 10 | 10 |
| adherencia | 86% | 81% | 77% | 78% | 80% | 72% | 88% | 83% | 87% |

Global 80,9%. **p = 0,37**: el 37% de las barajadas al azar da una dispersión igual o mayor. Esa variación entre 72% y 88% es exactamente la que sale de repartir los mismos juicios sin mirar la hora.

**El falsador se cumplió, y hay que anotarlo aunque duela**: el ítem decía *"que a las celdas el pct no separe nada"* y eso es lo que pasó. **4.5 y 4.6 pierden su motivo.**

**Y una limitación de esta implementación que juega en contra del resultado y hay que decirla:** el test permuta **juicios** y asume que son independientes, y no lo son — cada operación aporta tres. Eso infla la muestra efectiva y hace el test **más** propenso a detectar señal. Aún así no detecta, así que el resultado es robusto en la dirección que importa.
→ *Qué lo reabriría:* más muestra. Son tres semanas. Si con dos meses el p baja de 0,10, el mapa recupera su motivo y el aviso desaparece solo.
→ *Deuda anotada:* permutar operaciones enteras en vez de juicios sueltos sería lo correcto. No se hizo porque el resultado no cambia el veredicto de hoy.

## 4.5 — El mapa del día · HECHO el 3/8 · **anillo, no cinta**

Veinticuatro horas de Buenos Aires partidas por sesión, con la rueda subdividida en sus tramos y anchos proporcionales a los minutos reales. Aguja de *estás acá*, y las operaciones de hoy como puntos adentro del anillo.

**Se construyó primero como cinta recta y se rehízo como anillo el mismo día, a pedido.** El argumento que decidió no fue el estético sino uno que la tira no podía resolver: **el día es cíclico y la cinta lo mentía.** Asia va de 21:00 a 03:30, así que quedaba partida en dos pedazos —uno en cada punta— y se leía como dos franjas distintas. `cintaDelDia` ahora devuelve también `arcos`, con el primero y el último fusionados si son la misma franja y marcados con `cruza`.

**Es un anillo y no gajos radiales, y eso es una decisión y no un detalle.** El reloj *"Cuándo operás"* ya usa gajos que crecen con la frecuencia y se pintan por PnL. Dos relojes casi idénticos con variables opuestas se confunden, y gana el que tiene los colores más fuertes. Mismo espacio, distinto lenguaje: acá el grosor es constante y **no significa nada a propósito** — lo único que codifica es el color, y el color es adherencia. Hay un test que verifica que no quede nada de la cinta recta y otro que cuenta los arcos contra los segmentos, o sea que la fusión de medianoche sigue funcionando.

**Se construyó sin esperar el número de 4.4, y el número llegó el mismo día: p = 0,37, las franjas no separan.**

**Y el color se rehizo entero cuando él dijo que no lo convencía, porque tenía razón por un motivo que no era estético.** Los cortes eran `p >= 0,9 ? verde : p >= 0,7 ? amarillo : rojo` — **dos umbrales inventados**, justo lo que este proyecto saca de todos lados. Con su adherencia global en 80,9% y las nueve franjas entre 72% y 88%, **las nueve caían en la misma banda** y el anillo entero quedaba mostaza. El dibujo se veía sucio y no decía nada.

Dos reglas nuevas, y la primera importa más:

- **Si las franjas no separan, no se colorea nada.** Un solo tono neutro. Pintar de verde y rojo una variación que el test de permutación dice que es azar es exactamente lo que 3.5 corrigió en `comparativas`, y sería raro arreglarlo ahí y cometerlo acá.
- **Cuando separen, el corte sale de su propio nivel y no de una tabla.** Mejor o peor que su global, con medio desvío de margen. Nada de "90% es bueno": bueno es mejor que vos mismo.

**Y el texto se cortó de cuatro oraciones a una.** Decía *"el color es adherencia, no plata ni cantidad"*, que es la palabra del motor y no la suya. Ahora dice **"verde donde sostenés tus reglas, rojo donde te ponés palos en la rueda"** — 68 caracteres visibles contra 350 — y todo lo largo vive en `data-tal`, o sea que lo cuenta Taladrín al pasar por encima, que es como se explican todas las demás métricas. Hay un test que verifica que el texto visible no crezca.

**Qué se hizo con eso: la pieza lo dice ella misma.** Cuando `franjas.separa` es falso, el mapa lleva al pie *"mirá el color solo cuando alguna franja se separe: hoy no lo hacen"*, con el p y el conteo de juicios. Es la misma forma que ya usan `presupuesto` apagado y las celdas sin muestra — **la pieza dice cuándo no tiene nada que decir**. Sin ese aviso, los colores sugieren un patrón que la estadística no sostiene, que es literalmente lo que 3.5 vino a arreglar en `comparativas`.

Se decidió no borrarlo: sigue sirviendo como reloj de dónde caen las operaciones, el aviso desaparece solo el día que separen, y el costo de tenerlo apagado es una línea de texto. Hay un test que verifica que ese aviso exista en cualquiera de sus dos formas.

**Lo que apareció al construirlo, y era un bug latente en toda la app.** Los `art` de `SESSIONS` —*"rueda 10:30 - 17:00"*— están escritos a mano y **valen solo con horario de verano de EEUU**. Medido: en julio la rueda cae 10:30–17:00 en hora de Buenos Aires y en enero **11:30–18:00**, porque Nueva York atrasa una hora y Argentina no. Una cinta dibujada con esa tabla habría quedado corrida sesenta minutos medio año, **sin que nada fallara**, y encima pintando la adherencia de una franja sobre las horas de otra.

Por eso `cintaDelDia` **no usa ninguna tabla**: le pregunta a `sessionOf` y `tramoDe` minuto a minuto. Son 1440 consultas por render, que es barato, y a cambio no queda ningún supuesto sobre husos. Hay un test que compara julio contra enero y falla si alguien vuelve a fijar los horarios.
→ *Deuda que esto deja a la vista:* los `art` de `SESSIONS` siguen siendo falsos medio año en todos los demás lugares donde se muestran — Diagnóstico, el mapa del proyecto, la tabla de franjas. No se tocaron acá porque son texto de referencia y no cálculo, pero **el día que alguien los use para calcular algo, ya están mal.**

**La regla que define el ítem vive en `t/mapa.js` y no en el motor.** `adherenciaSesion` puede estar perfecta y el render tomar `bySession[x].net` para el color: no falla ningún test, solo convierte al mapa en su opuesto. El test verifica que los únicos tonos sean los cuatro de adherencia, que los anchos sumen 100%, que las celdas sin muestra vayan en gris —**"no hay con qué juzgarte acá" no es "acá fallás siempre"**— y que no haya ningún marcador de próximo tramo ni cuenta regresiva.

**Tres tonos y un gris, sin gradiente continuo.** Con celdas de cinco juicios, un degradé sugiere una precisión que la muestra no tiene.

**El contra se asumió como estaba escrito:** la cinta tiene mitad derecha y eso es el futuro. Las mitigaciones son parte de la pieza y están testeadas — sin marcador de lo que viene, sin cuenta regresiva, y nada en `taladro` que hable del mapa.

**Los fines de semana `finde` ocupa las 24 horas.** El plan lo daba como problema sin resolver; es correcto —el mercado está cerrado— y ahora queda dicho en vez de disimulado.

→ *Qué lo falsaría:* que lo mires y te den ganas de esperar a un tramo.

## 4.6 — Cansancio con PVT-B · **se cae con 4.4**, y queda anotado por qué

**Depende de 4.5, que depende de que las franjas separen, y no separan (p = 0,37).** El PVT necesitaba un eje de reloj donde dibujarse y la premisa de ese eje es que la conducta varía por hora. Con esa premisa refutada, el ítem se queda sin dónde vivir.

**No se descarta la variable, se descarta el lugar.** El cansancio a las 3 de la mañana sigue siendo un hecho sobre el cuerpo que existe antes de abrir nada y no sabe cómo salió la operación — eso no lo toca el número de 4.4. Lo que se cayó es la idea de que se lee contra un mapa horario.

**Todo lo que se investigó se conserva, porque el día que vuelva no hay que rehacerlo:**

- PVT y no Stroop ni go/no-go, **por fiabilidad y no por sensibilidad**: las tareas clásicas dan test-retest de 0 a .82 y guardan puntajes de diferencia, así que el jitter del navegador entra dos veces. El PVT guarda un conteo con 200 ms de margen al umbral. Ver `docs/descartes.md`.
- La versión de 3 minutos se validó contra la de 10 **solo tras bajar el umbral de lapse de 500 a 355 ms**, y hay un trabajo de 2022 que le encuentra validez convergente inadecuada. Las dos cosas van en el mismo párrafo, no una en nota al pie.
- **La asimetría que decide si el ítem vive:** tiene que poder marcar el cansancio y **no** poder marcar la frescura. Un PVT bueno diciendo *"estás afilado"* es el empujón horario con bata de laboratorio.
- Contar **lapses** y jamás el RT promedio, que es donde vive el ruido y la deriva documentada.

→ *Qué lo reabriría:* que las franjas empiecen a separar con más muestra. Ahí vuelve 4.5 con motivo y este ítem tiene otra vez dónde dibujarse. Hasta entonces, construirlo sería hacer la parte cara de un proyecto cuya parte barata ya dijo que no.

## 4.7 — El momento explícito, y el estado "después" · HECHO el 3/8

La app tenía dos estados y él usa tres. **Recién cerrada una operación caías directo en el panel que prepara la siguiente**, que es el peor lugar donde caer y el de más riesgo de tilt.

**La duración era la decisión pendiente y se resolvió sin inventar ningún umbral.** El plan decía que ese número lo discutía 3.2, y 3.2 se cerró borrando el umbral en vez de elegirlo — así que una constante nueva acá sería exactamente lo que se acaba de sacar. **El estado dura hasta que lo des por leído o abras la próxima.** No se apaga con un reloj, se apaga porque volviste.
→ *Consecuencia que hay que aceptar:* si dejás de operar una semana, el panel sigue ahí una semana. Es correcto —seguís después de esa operación— y además es justo donde `huecoAbierto` tiene algo para decir.

**Muestra cuatro cosas y solo una es una acción.** Qué cerró, cuánto, cuánto duró y cómo quedó contra tu banda son hechos; **si cumpliste tus reglas** es lo único que dependió de vos, y el veredicto es de tres valores como todo test de hábito — el "no se pudo medir" no se pinta de rojo.

**Un bug que apareció usándolo y que ningún test del motor podía agarrar: dos fuentes de verdad sobre qué está abierto.** `posAn` sale de `clearinghouseState` —lo que el exchange reporta ahora— y `s.trades` sale de los fills. **Cuando cerrás, el exchange deja de reportar la posición antes de que llegue el fill de cierre**, así que hay una ventana de segundos donde no hay posición viva y el trade sigue abierto en los fills. En esa ventana el panel buscaba la última cerrada del historial y anunciaba *"recién cerraste"* con **la operación equivocada, de otro símbolo**. Pasó de verdad: cerró un short de BTC y el panel dijo DRAM.

Ahora, si hay trades sin cerrar en los fills y el exchange no reporta posición, `momento` devuelve `antes` con `desfasado: true` y no se anuncia nada. **Es mejor callarse que nombrar la operación equivocada**, y dura lo que tarda el próximo refresco. `t/momento.js` lo fija en los dos sentidos.

**La restricción de principio 5 está fijada en un test:** `t/momento.js` verifica que el panel **no termine en el calculador de tamaño**. Si terminara ahí, la app habría creado un malestar cuya salida es operar. Descansar es la salida obvia de esa pantalla, no la de abajo.

`momento(s, posAn, visto)` reemplaza la clase booleana `dentro` que ponía `renderResumen`, que ya estaba escrita como paso intermedio. **La marca de "visto" se compara por id y no por timestamp**, porque dos operaciones pueden cerrar en el mismo milisegundo — que es el mismo motivo por el que 3.6 necesitó desempate.

→ *Qué lo falsaría:* que nunca lo mires. Es difícil de medir sin A/B y él es N=1, así que el criterio realista es el suyo.

# Lote 5 — Higiene · CERRADO EL 3/8

Los cinco están hechos. Dos dejaron algo que no era higiene: 5.1 le puso una compuerta al build y 5.5 le dio CSS y HTML a las pruebas de vista.

---

## 5.1 – 5.4 · HECHOS el 3/8

### 5.1 — El calendario de la Fed vence, y ahora se nota

`FOMC` es una tabla escrita a mano. El 1 de enero de 2027 `ventanaEvento` habría devuelto `null` para siempre, las operaciones habrían dejado de marcarse y **la app habría seguido andando como si nada**. Es la forma de los otros dos bugs que el build ya vigila: el problema no es el error, es que el error sale como éxito.

Hecho en los dos lugares que el ítem pedía, y el orden de importancia es el inverso del obvio:

- **`build.py` corta** si a la última fecha le faltan menos de `FOMC_AVISO_DIAS` (60). Ésta es la que funciona aunque nadie mire la app. Va **antes** de escribir `index.html`, así que una compilación con el calendario corto no publica nada. Probado a mano recortando la tabla: corta con el mensaje y `index.html` queda intacto.
- **`calendarioVence(now)`** lo dice en el panel de diagnóstico, que es donde se va a preguntar en qué mediciones se puede confiar. Solo aparece cuando falta poco o ya venció — antes de eso no dice nada.

El umbral es **una sola constante leída por los dos**: `build.py` la parsea de `engine.js` con regex en vez de tener su propio 60. Hay un test que lo verifica, porque dos umbrales que se separan hacen que el build corte en un momento y la app avise en otro.

### 5.2 — `byDow` borrado

Se acumulaba en `computeStats` y no aparecía en ninguna pantalla. Estado muerto recalculado en cada corrida. `byHour` sí se usa, en los gráficos, y se queda.

### 5.3 — `prefers-reduced-motion`, keyframe por keyframe

Nunca un `animation:none` global: apagaría el tilt entero sin avisar, y ese debate ya estaba resuelto —detener la mecha se probó y borraba la señal de que hay plata puesta.

**El criterio quedó escrito en el CSS y es qué lleva la animación:**

| | Con la preferencia activa |
|---|---|
| `vibra`, `tiembla`, `parpadeo`, `saltito`, `latido`, `pulsa` | **Apagados.** Pura oscilación |
| `aparece`, `entra` | A 0,01 s: instantáneos, no ausentes |
| `flota` (respiración) | 4 s → 16 s. Dice que está vivo |
| `gira` (la mecha) | 0,45–0,7 s → 3–4 s. **Es la señal de que hay plata puesta** |
| Tinte rojo, desenfoque de la plata, cara furiosa | **No se tocan.** Llevan el estado sin moverse |

Con la preferencia activa, un usuario tiene que seguir viendo que está en tilt. Nada de lo que dice el estado depende del movimiento.

### 5.4 — Teclado en el modal `#foco`

`.fcaja` es `role="button"` con `tabindex="0"`, y Enter y Espacio van al mismo handler que el clic. **No** se usó `role="dialog"` con foco en el botón primario: eso haría que Enter dispare la acción en vez de avanzar, o sea lo contrario de lo que hace el mouse en el mismo elemento. Escape cierra y el foco vuelve a `#cuerpo`.

Funciona porque `abrirFoco()` reescribe `#fsvg`, `#ftx` y `#facc` pero **no** `.fcaja`, así que el elemento con foco sobrevive a cada avance.
→ *Cómo se rompe:* si algún día `abrirFoco` pasa a recrear la caja, el foco se cae al `body` y el carrusel deja de avanzar con teclado después del primero — **sin error**. Está anotado en el código al lado del handler.

**Una trampa que costó un minuto y vale la pena dejar escrita:** `#cuerpo` ya es un `<button>`, así que el navegador dispara su `onclick` con Enter solo. El `onkeydown` propio que le había puesto avanzaba **dos** ítems por tecla.

---

## 5.5 — La portada en dos columnas · HECHO el 3/8

`#app` era una pila vertical de ancho completo: en desktop desperdiciaba media pantalla y empujaba la decisión abajo del pliegue.

**Cómo quedó.** Grid de dos columnas desde 1000px. **Izquierda, la decisión** (`enTrade`, `prepPanel`, `ejercPanel`); **derecha, el contexto** (`franja`, `resumen`). **Ancho completo** el aviso de muestra porque enmarca todo, el `verMas` y el detalle porque son tablas y gráficos, y el **tilt y el aire porque existen para interrumpir** — decidido así a propósito, aunque empuje el contexto hacia abajo justo cuando la pantalla ya está roja: interrumpir es el trabajo del modo.

**Mobile es el default y desktop la excepción**, que es al revés de como se escribiría solo. `.col{display:contents}` sin media query hace que los dos envoltorios no existan para el layout, así que los paneles vuelven a ser hijos directos del flex de `#app` y el `order` de siempre sigue mandando. La ventaja concreta: **agregar un panel nuevo no obliga a pensar en desktop.**

**La izquierda va primera en el DOM, y no es cosmético.** El auto-placement de grid no retrocede: con la derecha adelante, la izquierda caería una fila más abajo y la portada quedaría con un hueco arriba **sin que nada falle**.

### Lo que este ítem desactivó, que no era "higiene"

El ítem decía *"no toca ninguna métrica: mueve cajas que ya existen"*. Cierto sobre las métricas y falso sobre los mecanismos. **Hoy el orden vertical era el mecanismo que decía qué importa ahora** — por eso existía `#app.dentro`. Con dos columnas todo entra arriba del pliegue y mover algo de lugar deja de significar nada.

No hizo falta compensarlo, y ahí está lo bueno: **`#enTrade` ya es lo primero de la columna izquierda, así que con una posición abierta la decisión *es* esa posición, sin reordenar nada.** Las reglas de `.dentro` quedan como no-op en desktop —`franja` y `resumen` son hermanos dentro de `.col-der` y su orden relativo no cambia— y eso es correcto, no un descuido. Está escrito en el CSS para que nadie lo "arregle".

→ **Lo que hereda 4.7.** `momento()` va a decidir por **slot** y no por orden. La portada ya está en esos términos.

### Dos cosas que este ítem le dejó al build

**`build.py` ahora pasa el CSS y el HTML armados a las pruebas de vista** (`TALASTRAT_CSS`, `TALASTRAT_HTML`), además del bloque de script que ya pasaba. El motivo es concreto: `stub.js` fabrica elementos por id a demanda y **no tiene árbol**, así que no puede contestar "esto viene antes que aquello" — que es exactamente la afirmación que sostiene esta portada. Y hay decisiones que viven solo en la hoja de estilo.

**`t/columnas.js`**, ocho aserciones sobre las tres decisiones que se romperían en silencio. Probado a mano renombrando `col-izq`: el build corta.

---

# Lote 6 — La fricción y el rigor desparejo

Abierto el 4 de agosto de 2026. **No salió de leer el motor sino de leer la pantalla**, preguntando qué se lleva puesto el usuario. Por eso ninguno de los seis ítems estaba en los lotes 1 a 5: se ven mirando la superficie entera junta, no cada pieza por separado.

Los seis se reparten en dos grupos, y el orden entre ellos es el de siempre — qué principio violan:

- **Una variable que daña todos los días y no se mide** (6.1, 6.2). Cae en el principio 3: la app mide acciones, y hay una acción con costo compuesto y garantizado que casi no aparece.
- **Cuatro lugares donde la app se aplica dos varas de rigor** (6.3 a 6.6). Caen en el principio 2: un dato aislado no es un hallazgo, y al lado de la única pieza que lo respeta hay trece que no.

---

## 6.0 — Mirar el número antes de construir nada

**Va primero y no es una formalidad.** Es lote 2 otra vez: la parte barata decide si vale la parte cara.

Con los datos que ya están, calcular tres cosas sobre la cuenta real:

| | Cuenta | Qué contesta |
|---|---|---|
| `porOp` | `(s.fees − min(s.funding,0)) / s.n` | Cuánto cuesta cada operación antes de tener razón |
| `sobreNotional` | `porOp / notional mediano` | Cuánto tiene que moverse el precio a tu favor solo para empatar |
| `sobreBanda` | `porOp / bandaRiesgo(s).valor` | Qué fracción de tu riesgo declarado se va en peaje |

**Si `sobreBanda` da chico y estable, 6.1 se va a Descartes sin escribirse** y el lote se reduce a las contradicciones. Si da grande, es la fuga más cara de la app y explica por qué el resto de las mediciones pueden estar todas en verde con la cuenta cayendo.

---

## 6.1 — La fricción: la única variable con efecto compuesto garantizado y negativo

Con colateral chico y órdenes mínimas de US$10, los fees no son un detalle de la operación: son una fracción estructural de cada una. **La app tiene el dato entero —`t.fees` por trade, `attachFunding` atribuye el funding al trade abierto— y no lo usa para decidir nada.**

| Dónde aparece hoy | Qué dice | Qué le pasa |
|---|---|---|
| KPI `Costos` | El total de fees y funding | Es un total. No se compara contra nada, así que no se puede leer |
| Tarjeta de `buildInsights` | Se dispara con `costos / bruto > 0,15` | El denominador es `s.gross`, o sea **el resultado** |
| `repertorio`, familia `mirar` | "el X% del volumen" | El volumen no es una referencia que él pueda usar para decidir |

**Y hay un bug del tipo exacto que este proyecto persigue: el aviso más importante se apaga en el peor caso.** `bruto = Math.max(s.gross, 0)` con guarda `bruto > 0`, así que **con PnL bruto negativo la tarjeta de costos no existe.** Un mes malo apaga la única pieza que habla de la fricción, justo cuando la fricción es todo lo que queda. El error saliendo como éxito, otra vez.

**Qué se propone: `friccion(s)`, con denominadores que no son el resultado.**

| Campo | Qué es | Por qué no es PnL con otro nombre |
|---|---|---|
| `porOp` | costo medio por operación | Sale de cuántas veces entrás y de qué tamaño. No de si acertaste |
| `sobreNotional` | `porOp / notional mediano` | El % que el precio tiene que moverse antes de empatar. Es estructura del exchange, no resultado tuyo |
| `sobreBanda` | `porOp / banda.valor` | **Es el número fuerte.** Si arriesgás US$1 y cada operación cuesta US$0,20, tenés que ganar 1,2× tu riesgo para quedar igual. Usa el techo que declaraste en frío, no tu pérdida media |
| `winBreakeven` | qué tasa de acierto necesitás, con tu payoff observado, para cubrir la fricción | Traduce el peaje a la unidad en la que él ya piensa |

**Pasa los ocho principios, y conviene dejarlo escrito porque una pieza nueva que habla de plata da desconfianza justificada:**

- **1 (no inventar la variable):** los fees vienen adentro del fill. Cero proxy, cero estimación.
- **3 (acciones, no resultados):** los fees son consecuencia de dos cosas que elegís —cuántas veces entrás y con qué tamaño— y **no se mueven con el PnL**. `sobreBanda` se apoya en el techo declarado, así que hereda la propiedad que 3.1 le compró a la banda.
- **5 (no crear un malestar que se alivie operando):** al revés que todo lo demás de la app, **este número baja si descansás.** Es la única pieza estructuralmente del lado correcto del principio 5, sin necesitar guarda.
- **4 (proceso, nunca mercado):** no dice cuándo entrar ni en qué. Dice cuánto cuesta entrar.

**Va sin color de estado y sin umbral**, como `huecoAbierto`, y **no genera racha**. El motivo es el riesgo simétrico y hay que vigilarlo: un número de costos a la vista puede producir parálisis, que es el riesgo que él nombró como principal. Un semáforo rojo sobre los costos sería la app empujándolo a no operar, que es prescripción con el signo cambiado.

→ *Qué lo falsaría:* que `sobreBanda` dé chico y estable sobre tres meses. Ahí la fricción no es la fuga, y esta pieza es ruido con formato de hallazgo.
→ *Qué habría que vigilar si se construye:* que a las cuatro semanas no haya bajado la frecuencia por miedo al número en vez de por decisión. Eso lo dice `huecoAbierto`, que ya está puesto.

---

## 6.2 — `ráfaga` se compara contra sí misma · **decisión tuya**

`aire()` línea 1707: `techoDia = Math.max(3, Math.round(s.medianTradesDay * 2.5))`.

**Es la banda móvil de 3.1 viva en otro lado.** El umbral de sobreoperar se adapta a cuánto operás, así que si operás mucho todos los días, **la detección de overtrading no se enciende nunca.** El mismo `2.5` aparece dos veces más con el mismo defecto: `taladro` (1183) y `buildDayPlan` (3197).

Dos salidas:

**(a) Borrarlo, como se borró `corte`.** Precedente exacto de 3.2: un umbral que no sale ni de sus datos ni de una decisión suya se saca, y la conducta queda descripta sin puntuarla — acá la describe `friccion`, que dice lo mismo en plata y con una referencia que no se mueve. `aire` queda con tres caras.

**(b) Declarar el techo diario en frío**, hermana de `bandaRiesgo`, en `prepPanel`.

**Recomendación: (a).** El motivo es que (b) ya se rechazó una vez, textual en 3.2: *"agrega un campo más para sostener una conducta que la app ya describe sin puntuarla"*.

**Contra, y es serio:** la frecuencia tiene costo aritmético directo y la duración no, así que el precedente de 3.2 no calza del todo. Un techo diario declarado es la única forma de que la sobreoperación genere adherencia medible en vez de solo descripción.
→ *Qué reabre (b):* que 6.0 dé alto y él quiera una regla y no una descripción. Ahí el argumento de 3.2 deja de aplicar porque el costo existe.

---

## 6.3 — El reconocimiento de proceso está condicionado al resultado

`aire()` línea 1672: `if (!(s.expectancy > 0)) return off;`

**Consecuencia: con expectativa negativa la app no tiene ningún canal para decirte que tu proceso está sano.** El que más necesita esa frase es el único que no puede recibirla, y lo único que le queda en pantalla es la lista de lo que hace mal. Es el principio 3 leído del revés: no se mide la conducta con el PnL, pero **se condiciona el elogio al PnL**.

**El gate en sí es correcto y no se toca.** Con EV negativo, más operaciones es más pérdida, y encender un modo que alienta a sostener sería el peor consejo posible. Ese argumento sigue entero.

**Lo que se separa es la medición del modo, y es un precedente propio aplicado de nuevo.** `estabilidad` salió de adentro de `aire` por este mismo motivo y está en Descartes: *"solo se calculaba con n≥30 y expectativa positiva, así que la conducta quedaba invisible mientras se estaba formando"*. La ventana de 28 sobre 30 se calcula y se dice **sin encender el modo**, con la misma forma.

**Y es lo que habilita la frase que hoy es literalmente indecible, que es lo que junta este lote entero:**

> *"Tu holgura, tu estabilidad y tu adherencia están limpias. Estás perdiendo por fricción."*

Hoy no se puede decir por dos guardas distintas que **fallan hacia el mismo lado y en el mismo caso**: `aire` apagado por expectativa negativa, y la tarjeta de costos apagada por bruto negativo. Las dos se callan exactamente en el escenario que más necesita explicación.

→ *Qué lo falsaría:* que lo leas como consuelo. La diferencia entre descripción y consuelo es si el número está al lado — y si aun con el número al lado suena a palmada, gana el principio 7 y se saca.

---

## 6.4 — Dos varas de rigor sobre el mismo tema · **decisión tuya**

3.5 le puso permutación con Benjamini-Hochberg a `comparativas`, y fue el trabajo estadístico más caro del proyecto. **Al lado, `buildInsights` publica trece tarjetas en prosa afirmativa con umbrales elegidos a ojo — y cuatro de ellas son el mismo corte que `comparativas` acaba de someter al test.**

| Tarjeta | Corte | Umbral | Tiene p |
|---|---|---|---|
| "Tenés una franja horaria que funciona y otra que no" | sesión | `n>=3` y signos opuestos | No |
| "Tu horizonte rentable" | duración | `n>=5` | No |
| "Los dos lados dan resultados opuestos" | long/short | `n>=5` | No |
| "SÍMBOLO: US$X en N operaciones" | símbolo | `>30%` del neto | No |

**El precedente está adentro del propio código, escrito por este proyecto.** El comentario 10 de `buildInsights` explica por qué se borró `netBusyDay`: *"tener las dos era publicar dos veredictos con distinto rigor sobre el mismo tema, y el flojo hablaba más seguido porque pedía menos."* Es exactamente esto, cuatro veces más.

**Propuesta: se borran las cuatro.** La pregunta ya la contesta `comparativas`, que prueba esos mismos cortes, corrige por multiplicidad y **dice cuándo no sobrevive ninguno**. Sobreviven las tarjetas que no son cortes de la muestra: liquidaciones (es un hecho, no una comparación), fricción, holgura, estabilidad, concentración del resultado, expectativa y drawdown.

**Y el efecto disposición se queda, sin nivel `bad` y sin el `1.3`.** Es una razón como `estabilidad` y no un corte, pero el umbral es inventado igual. Se dice el número y no se lo puntúa — que es lo que 3.2 ya decidió para esta misma medición cuando borró el hábito `corte`.

**Contra, y hay que tomárselo en serio:** son las tarjetas que más se leen, porque cuentan una historia, y `comparativas` es una tabla con dos columnas de estadística. **Se pierde legibilidad a cambio de honestidad.** Si al mes la pantalla se siente vacía, la salida no es devolverlas: es que `comparativas` narre en prosa el corte que sí sobrevivió.

→ *Qué lo falsaría:* que con sus 194 operaciones algún corte sobreviva a BH y sea justo uno de estos cuatro. Ahí la tarjeta estaba diciendo la verdad y lo único que le faltaba era el p al lado.

---

## 6.5 — Los seis gráficos de PnL no llevan el aviso que sí lleva la tabla

Cinco de los seis canvas son PnL cortado de distintas maneras (`cSess`, `cSym`, `cHour`, `cDur`, `cDist`) y el sexto es la curva acumulada.

3.5 le puso a la tabla de `comparativas` un aviso arriba con este argumento: **"sin él, la fila de arriba del ranking se lee como un descubrimiento"**. El mismo argumento vale palabra por palabra para un gráfico de barras ordenado de mayor a menor: **la barra más alta se lee como hallazgo.**

Propuesta: el bloque de gráficos hereda el mismo aviso, con el mismo conteo de cortes y el mismo p. Una línea, no un panel.

**Contra:** un gráfico no afirma nada, solo muestra. Es cierto — **y también lo era de la tabla, que llevó aviso igual.**

---

## 6.6 — Higiene que sale de lo anterior

- **`friccion` reemplaza el cálculo de la tarjeta de costos y el denominador deja de ser `s.gross`.** Un aviso que se apaga en el peor mes está roto, independientemente de qué se decida en 6.1.
- **`s.medianTradesDay * 2.5` está escrito tres veces** — `aire` (1707), `taladro` (1183), `buildDayPlan` (3197). Sea cual sea la salida de 6.2, hoy es una constante duplicada en tres lugares: la forma exacta de la banda en seis copias, esperando a que alguien cambie uno solo.
- **`interfaz.md` dice "siete expresiones" y `CARAS` tiene ocho.** Ya estaba anotado al pasar en 4.3 y sigue sin arreglarse.

---

## Orden del lote

| # | Qué | Decisión tuya | Bloqueado por |
|---|---|---|---|
| **6.0** | Mirar `sobreBanda` y `sobreNotional` sobre la cuenta real | No | Nada. Va primero |
| 6.1 | `friccion()` | No | 6.0 |
| 6.3 | Sacar el reconocimiento de proceso del gate de expectativa | No | 6.1, para poder decir la frase entera |
| 6.4 | Borrar las cuatro tarjetas que duplican cortes | **Sí** | — |
| 6.5 | Aviso de multiplicidad en los gráficos | No | 6.4 |
| 6.2 | `ráfaga`: borrar o declarar | **Sí** | 6.0. El número decide cuál |
| 6.6 | Higiene | No | — |

---

# Lo que no entra en este plan

Cuatro cosas que quedan afuera a propósito, para que no parezca que se olvidaron.

**El modo Merval.** Abierto el 4 de agosto, vive en `docs/merval.md`. **No es un lote 7**: la condición de muerte de este archivo dice que si aparece un séptimo lote lo que falló es la lista, y tiene razón. El modo Merval no es deuda de Talastrat — es otro producto que comparte repo, disciplina y mascota, y su primera fase es un probe que todavía no se corrió. Queda pendiente y anotado allá dónde vive su deuda cuando este archivo se borre al cerrar el lote 6.

**Canal de feedback para testers.** Es un pendiente de producto, no de código. No compite con nada de esta lista.

**Renombrar el repo a `talastrat`.** GitHub redirige la URL vieja, así que no rompe nada. Cuando quieras.

**Rotación sectorial.** Ya está decidido que queda afuera y el motivo sigue en pie: no tiene reloj y es otra cosa que la estructura horaria.

---

# Resumen ejecutable

| # | Ítem | Lote | Decisión tuya | Bloqueado por |
|---|---|---|---|---|
| **6.0** | **Mirar la fricción sobre la cuenta real** | 6 | No | **Nada. Es lo único que se puede hacer hoy mismo** |
| 6.1 | `friccion()` | 6 | No | 6.0 |
| 6.3 | El proceso limpio se dice aunque la expectativa sea negativa | 6 | No | 6.1 |
| 6.4 | Borrar las cuatro tarjetas que duplican cortes de `comparativas` | 6 | **Sí** | — |
| 6.5 | Aviso de multiplicidad en los gráficos | 6 | No | 6.4 |
| 6.2 | `ráfaga`: borrar el techo móvil o declararlo en frío | 6 | **Sí** | 6.0 |
| 6.6 | Higiene: denominador de costos, `2.5` triplicado, `CARAS` | 6 | No | — |
| 4.2b | La regla de pagarse · `nice to have` | 4 | **Sí** | No llega a los 10 USDC que cuesta la orden mínima para sacar |

**Lo que sigue no es del mismo tipo.** El lote 1 eran errores: la app afirmaba cosas que sus números no sostenían, y se arreglaban sin preguntarte nada. De acá en adelante hay que mirar datos que nadie miró (lote 2) y tomar decisiones que nunca se tomaron (lotes 3 y 4). El lote 5 es higiene y se puede hacer en cualquier momento.

**El camino largo ya tiene su primer tramo puesto, y ahora depende de un número y no de escribir código.** 4.4 existe y contesta su propio falsador con un test de permutación. **Antes de tocar 4.5 hay que abrir Diagnóstico y mirar si las diez celdas separan.** Si no separan, 4.5 y 4.6 se caen con ella y eso es el ítem funcionando: la parte barata fue la que decidió si valía la pena la cara.

**Y hay dos ítems que ahora esperan muestra en vez de esperar código.** 4.2 acumula declaraciones vencidas y no dice nada hasta las 30 cerradas; 4.3 acumula pares pre/post y no dice nada hasta los 30. Los dos están construidos enteros y callados a propósito — cualquier frase antes de esa muestra sería inventar la variable.
