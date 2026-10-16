# Lo que creemos sobre el oficio

`HIPÓTESIS` — Se contrastan con sus datos. Cada una dice qué la falsaría.

No son principios: son hipótesis sobre trading. Pueden ser falsas, dependen del contexto y **se contrastan con sus datos**. Van aparte para que discutirlas no parezca discutir los fundamentos. Cada una dice qué la falsaría.

**La parálisis es un riesgo real.** Poner plata en riesgo no es malo en sí; el paper trading y las rachas forzadas de no operar son falsa sensación de control por inacción. No es *el mayor* riesgo como afirmación general: eso deja de ser cierto apenas la cuenta valga algo, porque la ruina es un estado absorbente y la parálisis no. En su régimen actual —colateral chico— él tiene razón y el cálculo le da a favor. Sí se puede sugerir no operar el fin de semana, pero como priorizar la vida, no como disciplina.
→ *Cómo se falsaría:* que la cuenta crezca. Esta hipótesis tiene fecha de vencimiento incorporada y hay que estar atento a cuándo se cumple.

**De Douglas se adoptó:** que el resultado individual no informa nada sobre el método, que el edge se define antes y no se racionaliza después, que la práctica deliberada con reglas fijas instala la creencia, y las cinco verdades fundamentales — dichas acá con el número propio al lado en vez de como afirmación repetida.

**Pagarse: se rechazó por error y se está adoptando.** Durante meses esto decía que "pagarse cuando el mercado pone dinero disponible" era *prescripción sobre el resultado*, y por lo tanto prohibido. **Era un error de categoría, y él lo encontró releyendo.** Retirar plata de la cuenta no sugiere activos, no opina sobre dirección y no dice cuándo entrar: es gestión de capital, tan proceso como definir el setup antes. Nunca chocó con el principio 5.

Y el argumento a favor ya estaba escrito acá arriba, sin conectar: **la ruina es un estado absorbente.** La regla de retiro es el otro lado exacto de esa frase — es lo que tiene que encenderse justo cuando la hipótesis de la parálisis se apaga. Con apalancamiento muy por encima de Kelly, una estrategia de EV positivo igual tiende a cero con suficientes repeticiones; retirar no arregla la sobre-apuesta, pero saca capital del estado absorbente. Es el único mecanismo que convierte una ganancia en papel en una permanente.

Dónde sí choca, que no es donde decía: **con el principio 2**, porque hoy la app no puede ver un retiro — ninguno de los endpoints que pide trae depósitos ni retiros, y una caída de colateral sin fills es indistinguible de una pérdida. Hace falta `userNonFundingLedgerUpdates`. Y **con el 4**, sorteable: la versión que falla es un contador de "llevás US$X guardados", que es PnL con moño; la que pasa es que él escriba la regla en frío, como el ejercicio, y la app mida adherencia a esa regla.
→ *Cómo se falsaría:* que sus retiros reales, una vez visibles, no tengan relación con ninguna regla previa. Ahí la medición sería sobre una conducta que no existe.

**Hesitación: la versión de Douglas no sirve, pero la nuestra tampoco estaba construida.** Su medición como contador de inactividad no se adoptó, y eso sigue firme: la operación no tomada no existe en los fills, y avisar "es tu franja habitual y no estás operando" es una señal de timing que muere en el principio 5 — además de que la app no ve precios y estaría alentando a ciegas.

**Pero la alternativa que este documento proponía era falsa.** Decía que el usuario declare el setup que vio "y ahí sí la app puede comparar identificados contra ejecutados". `edgeDeclarado` compara declaradas contra no-declaradas **entre las que se ejecutaron**, y `shell.html` borra las declaraciones no usadas a las 4 horas. **El código tira exactamente el dato que mediría hesitación.** El setup declarado y no tomado es la única conducta de escasez en dirección sub-operar que es observable, y se está borrando.
→ *Cómo se falsaría:* que al dejar de purgarlas, casi no queden declaraciones sin ejecutar. Ahí la hesitación no sería su problema y habría que dejar de buscarla.

**Sobre el abundance mindset**, que él trajo con fuentes: la literatura lo ubica en la **compostura ante la pérdida**, no en la actividad durante la calma — tres de las cuatro conductas de escasez que lista son de sobre-operar, ninguna de sub-operar, y la recomendación explícita es esperar setups en vez de forzarlos. Eso ya está construido y es la pieza más fina de la app: `aire` compara tamaño y espera después de perder contra después de ganar, y se enciende cuando el resultado anterior dejó de moverte. **Eso es abundancia, operacionalizada, con sus números.** Lo que falta no es empujarlo a operar: es que `repertorio` lo diga con un lenguaje donde él la reconozca.

**Queda abierto cuál teoría del cambio manda.** Douglas dice creencia → conducta; la arquitectura de esta app dice conducta repetida → hábito. El documento declaraba la primera mientras el código hacía la segunda. Hoy conviven a propósito: el ejercicio y las cinco verdades son Douglas, los hábitos y los modos son lo otro. Si en algún momento chocan, gana el principio 4.
→ *Cómo se falsaría:* que una de las dos vías muestre adherencia sostenida y la otra no. Hoy no hay muestra para decidirlo.

---

