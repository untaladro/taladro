# Principios: la versión larga

CLAUDE.md lleva el enunciado y el "qué lo cambiaría" de cada uno. Acá está la justificación completa, que es lo que hace falta cuando estás por *cambiar* un principio y no solo por aplicarlo.

## Cómo se lee este documento

Todo lo que sigue está escrito con la misma prosa, y eso **es un problema si no sabés qué peso tiene cada cosa**. Un juicio tomado al pasar y una condición de existencia no se distinguen por el tono. Así fue como el párrafo sobre Douglas pasó meses pareciendo fundamento hasta que él lo leyó de nuevo y vio que estaba mal.

Cuatro pesos, de mayor a menor costo de revisión:

| | Qué es | Cómo se cambia |
|---|---|---|
| **Restricción** | Cambiarla cambia qué es la app | No se cambia. Hoy es una sola: el principio 1. |
| **Principio** | Decisión de diseño con orden de desempate | Con una decisión explícita, y anotando por qué cambió |
| **Hipótesis** | Creencia sobre trading, puede ser falsa | Se contrasta con sus datos. Cada una dice qué la falsaría. |
| **Registro** | Qué pasó, qué se probó, por qué elegimos X | Se revisa libre. Está para no rehacer el análisis, no para obedecer. |

**La regla que sostiene todo esto: salvo la restricción, cada afirmación lleva al lado qué la cambiaría.** Un documento sin eso solo puede defenderse; no puede mejorar. Si agregás algo acá y no sabés qué evidencia te haría sacarlo, todavía no lo entendiste lo suficiente como para escribirlo.

---


## Lo que no se negocia

Una restricción y ocho principios, **en orden de prioridad**. El orden no es decorativo: es la regla de desempate cuando dos chocan. Antes de agregar cualquier cosa, pasala por acá de arriba hacia abajo.

Varios se ganaron corrigiéndome, y la lista se reescribió entera después de contrastarla con *Trading in the Zone* de Mark Douglas — ver **Lo que creemos sobre el oficio**, más abajo, para qué se adoptó de ahí y qué no.

Cada uno lleva **qué lo cambiaría**. Donde dice "nada", es literal y hay que tomárselo en serio; donde dice otra cosa, es una invitación abierta.

**1. Nunca pide clave privada.** `RESTRICCIÓN` — No opera, no mueve fondos, todo se procesa en el navegador. Ningún archivo con una wallet real va al repo. No es un principio de diseño: es la condición para que la app exista.
→ *Qué lo cambiaría:* nada. Si esto cae, lo que queda es otro producto.

**2. No inventar la variable.** Si el dato no está, no se aproxima con un proxy. Por eso "no mantener la calma" quedó sin medir, la holgura se anota en vivo en vez de reconstruirse y la volatilidad no se estima con fills. Va segundo porque es condición de posibilidad de todo lo demás: medir bien una variable falsa sigue siendo medir mal.
→ *Qué lo cambiaría:* que aparezca la fuente que falta. No es una prohibición permanente sobre un tema, es una prohibición sobre adivinar — el endpoint de ledger para ver retiros es exactamente el caso donde el dato pasa a existir y la restricción se levanta sola.

**3. Un dato aislado no es un hallazgo.** Split-half y tamaño de muestra al lado, siempre. Nada se afirma con una mitad sola, y coincidir en signo con diferencia cero no cuenta como patrón. Junto con el 2 define qué tiene derecho a decir la app.
→ *Qué lo cambiaría:* un método de validación mejor que split-half. Es un piso, no un techo: `comparativas` ya lo pasa y sigue siendo estadísticamente flojo por comparaciones múltiples.

**4. Se miden acciones, no resultados.** Recién acá se elige *qué* medir, porque antes hay que poder confiar en el número. Ningún hábito, barra ni felicitación se calcula sobre el PnL. Si una métrica premia ganar está mal diseñada — y si se mueve sola con el colateral, está midiendo el PnL con otro nombre.
→ *Qué lo cambiaría:* poco. Ojo con la lectura de más: prohíbe **medir la conducta con el resultado**, no prohíbe que exista una regla *disparada* por el resultado. Una regla de retiro que vos escribís en frío se mide por adherencia, y la adherencia es una acción.

**5. Prescribe proceso, nunca mercado.** Puede pedirte que definas tu setup antes, que sostengas tus reglas, que ejecutes una serie sin desviarte. No sugiere activos, no opina sobre dirección, no dice cuándo entrar ni qué comprar. La versión vieja de esta regla decía "descriptivo, nunca prescriptivo" y mezclaba las dos cosas; Douglas prescribe proceso todo el tiempo y no dice una palabra sobre el mercado.
→ *Qué lo cambiaría:* nada mientras la app no vea precios. Es la regla que mata el empujón horario ("es tu franja habitual, buscá algo"), que es una señal de timing con ropa de apoyo emocional.

**6. La app no puede crear un malestar que se alivie operando.** Ningún estado que ella enciende puede apagarse solo operando. Prohíbe "te faltan 2 limpias y se termina" y prohíbe "llevás 4 días sin operar": los dos hacen que la vía de escape sea entrar al mercado. Descansar siempre es salida válida.

**Antes esto decía "ninguna salida puede exigir operar", y ese enunciado abarcaba de más.** Tanto, que necesitaba declarar excepción al ejercicio de práctica — y un principio que necesita excepción para su caso más obvio está enunciado en el nivel equivocado. Lo que importa no es el mecanismo (que operar resuelva un estado) sino la relación: **malestar inducido por la app → aliviado operando**. El ejercicio no es una excepción, nunca lo violó: lo arrancás vos en frío, apunta a una habilidad, y no hay ningún estado del que estés escapando. Un contador que aparece cuando estás en rojo sigue prohibido.

**Y medir no es empujar.** La app puede *saber* que hay un hueco abierto sin decirte que operes, mostrándolo en frío en el panel al que vas a buscarlo. El enunciado viejo trababa la medición de la parálisis hacia adelante por parecerse a un contador de días; el nuevo no.
→ *Qué lo cambiaría:* evidencia de que la parálisis le cuesta más caro que el sobre-operar en su régimen. Sería un caso para permitir que la app hable de huecos abiertos, nunca para que empuje.

**7. Se refuerza con el tiempo; solo caduca el estado.** Las rachas de hábitos atraviesan los días. Lo que se reinicia es el ánimo, jamás la acumulación: cada día nuevo es una oportunidad de empezar de nuevo sin que eso borre un solo dato.
→ *Qué lo cambiaría:* que él pida borrar y arrancar limpio. Es su historial.

**8. Cuidar sin joder, alentar sin forzar.** Nada de relleno, nada de autoayuda. Las afirmaciones se dicen con el número propio al lado o no se dicen. El humor es irónico y va *adentro* de la oración, nunca pegado al final como remate. Callarse es una opción válida y frecuente.
→ *Qué lo cambiaría:* que él diga que la app quedó fría. Es la única regla acá cuya evidencia es su reacción y no un número.

**9. Evitar el autocastigo.** Los drawdowns largos son normales incluso haciendo todo bien, y la app tiene que decirlo con la probabilidad exacta al lado.
→ *Qué lo cambiaría:* nada en la dirección de callarlo. Sí se puede discutir la dosis: dicho de más, se vuelve consuelo automático y viola el 8.

---

