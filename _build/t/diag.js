/* El panel de diagnóstico se borró el 3 de agosto, y este archivo queda como su lápida
   porque el motivo importa más que el panel.

   Existía para que un número real pudiera contradecir una decisión de diseño, y cumplió:
   de ahí salieron la cobertura de la serie de colateral (2.3), la distancia al punto real
   (2.6) y la concentración de la escala (2.4). Los tres cerraron su ítem sin tocar un
   umbral.

   **Se borró porque nadie lo iba a abrir.** Un `<details>` plegado en la portada que solo
   dice "Diagnóstico de los datos" no comunica que adentro está el número que decide tres
   ítems — y quedó demostrado: las franjas de 4.4, los cortes de 3.5 y el orden de 3.6 se
   terminaron mirando desde afuera, con las herramientas de navegador, y no abriendo el
   panel. Un instrumento que hay que acordarse de usar no es un instrumento.

   **Lo que se hizo con su contenido, que es la parte que vale:**

   - Lo que decide algo subió a la pieza que corresponde. El mapa dice si sus franjas
     separan; `presupuesto` apagado dice qué le falta; el build corta si el calendario de
     la Fed vence. **Ninguna de las tres necesita que alguien abra nada.**
   - Lo que es instrumento de desarrollo se quedó en `engine.js` con sus tests —
     `diagSeries`, `diagEscala`, `diagGaps`, `gapEn`, `diagOrden`, `declaracionesSerie` —
     y se consulta desde afuera cuando hace falta. Siguen exportadas y probadas.

   La lección general, que es la que no hay que perder: **una medición que vive detrás de un
   clic voluntario compite con el olvido, y pierde.** Si un número importa, tiene que estar
   donde ya se está mirando; y si no importa lo suficiente para eso, no importa.

   Este archivo no prueba nada a propósito: existe para que el próximo que quiera agregar un
   panel plegado "para los números que no entran en la portada" lea esto antes. */
console.log('  ok  el panel de diagnóstico se borró el 3/8 — ver el comentario de este archivo');
