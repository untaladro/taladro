# Descartes: se probó y quedó peor

`REGISTRO` — Ver CLAUDE.md § Cómo se lee este documento para qué peso tiene un `REGISTRO`.

`REGISTRO` — Índice de cosas que ya se intentaron. **Escanealo antes de proponer un cambio**, porque casi todas son ideas razonables que alguien va a volver a tener. Cada una vive explicada en su sección; acá está la versión de una línea con dónde buscarla.

| Se probó | Por qué se sacó | Dónde |
|---|---|---|
| Aura y brillo en el modo `aire` | Decía "estás imparable", que es falso —la expectativa no cambia porque el modo se encienda— y volvía el modo un trofeo | Las caras de Taladrín |
| Frenar del todo la mecha en `airemode` | Borraba la señal de que hay plata puesta | Las caras de Taladrín |
| Versión clara del taladro para el tema claro | La mecha y las partes metálicas son casi blancas; sobre blanco el dibujo pierde la punta | Tema claro y oscuro |
| Subir `--mut` para llegar a AA en todos lados | Aplana la distancia con `--txt2`, que *es* la jerarquía entre "esto importa" y "esto es una nota al pie" | Tema claro y oscuro |
| Panel propio para las cinco verdades | Media pantalla de scroll antes del botón que existe para que la portada sea corta, y cinco tarjetas juntas se leen como cartel motivacional | `verdades` |
| Mediana de las últimas 10 en `presupuesto` | La barra no reaccionaba y parecía rota. Quedó en 5 | `presupuesto` |
| Cortar `adherenciaDiaria` por mediana diaria | Con distribución bimodal cae encima de un modo y un lado queda vacío | `adherenciaDiaria` |
| Cortar `adherenciaDiaria` por ranking de días | Desempatar por fecha manda los cargados a una punta del historial y los tranquilos a la otra; el split-half deja de controlar la época | `adherenciaDiaria` |
| Reentradas calientes como fuga | Sus datos daban +US$0,21 por operación *mejor* que el resto, y aguantaba el split-half | Cómo hablarle a él |
| `sizeAfterLoss / sizeAfterWin` como tarjeta de conducta | Promediaba notional crudo y lo publicaba con clase acción y nivel `bad`. Con apalancamiento fijo eso es el PnL con otro nombre, y encima callado por construcción: después de perder hay menos colateral, el notional posterior sale más chico solo y el umbral no se alcanzaba nunca | `estabilidad` |
| Medir la estabilidad adentro de `aire` | Solo se calculaba con n≥30 y expectativa positiva, así que la conducta quedaba invisible mientras se estaba formando | `estabilidad` |
| Contar valores distintos para detectar escala cuantizada | Una martingala que alterna entre dos tamaños tiene dos valores, y es justo lo que hay que ver. Lo que vuelve vacía la medición es la concentración, no la cantidad | `estabilidad` |
| Tomar el `null` de exposición como falla del hábito | Cortaba la racha por un agujero en `accountValueHistory`, o sea medía la cobertura de un endpoint | `habitos` |
| Tomar el `null` de exposición como cumplido | El espejo del anterior: pinta verde una operación que nadie midió | `habitos` |
| `netBusyDay` / `netCalmDay` y su tarjeta de sobreoperación | Cortaba los días por la mediana diaria y comparaba PnL, sin terciles ni split-half, al lado de la tarjeta de `s.dias` que sí los exige. El mismo corte que `adherenciaDiaria` ya tenía documentado como inservible | `computeStats` |
| Acumular la curva de PnL en orden de apertura | El resultado se realiza al cerrar: el eje del gráfico quedaba no monótono y `maxDD` salía de una secuencia de saldos que nunca existió | `computeStats` |
| `serieCuenta` sobre el mapa por dex | Se quedaba con la primera lista `allTime` que encontraba y dibujaba el colateral de un dex con rótulo de cuenta entera | `serieTotal` |
| Historial real por ruta absoluta como fixture de `t/*.js` | La carpeta desapareció y los seis tests murieron antes de la primera aserción, sin que nadie se enterara porque el build no los corría | Publicar |
| Stroop y go/no-go como lectura de estado diaria | Test-retest de 0 a .82 en siete tareas clásicas (Hedge, Powell & Sumner); Stroop ICC ≈ .64. Los dos guardan puntajes de diferencia, así que el jitter del navegador entra dos veces. El PVT guarda un conteo con 200 ms de margen al umbral | `PLAN.md` 4.6 |
| El panel de Diagnóstico plegado en la portada | Cumplió su función —de ahí salieron 2.3, 2.4 y 2.6— pero **nadie lo abría**: los tres números que decidían 4.4, 3.5 y 3.6 se terminaron mirando desde afuera con las herramientas de navegador. Una medición detrás de un clic voluntario compite con el olvido y pierde | `_build/t/diag.js`, que quedó como lápida |
| El mapa horario como eje para el PVT (4.6) | Su premisa era que la conducta varía por hora, y medido sobre la cuenta real no varía: p = 0,37. Se cae el lugar, no la variable | `PLAN.md` 4.6 |
| El hábito `corte`: no sostener una perdedora más de 30 minutos | Único umbral de la app que no salía de sus datos ni de una decisión suya, y `byDur` contempla tramos de hasta 7 días: el motor admitía swing y el hábito lo castigaba | `habitos` |
| Derivar el umbral de `corte` de la mediana de sus perdedoras | Sale de él pero se mueve con él: es exactamente la forma que 3.1 acababa de cerrar en la banda. Aguantar cada vez más habría corrido el umbral y el hábito marcaría verde igual | `habitos` |

**Regla de esta tabla, simétrica a la de la deuda: entra cuando algo se probó y se sacó, y no se borra nunca.** Es lo opuesto a la lista de deuda —que solo debe encoger— y por eso las dos conviven sin pisarse: una registra lo que falta, la otra lo que ya se contestó.

---

