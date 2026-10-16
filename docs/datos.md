# Datos y tiempo

API pública de Hyperliquid, `POST https://api.hyperliquid.xyz/info`. Se usan `userFillsByTime`, `userFunding`, `clearinghouseState`, `frontendOpenOrders`, `portfolio`, `webData2` y `userNonFundingLedgerUpdates`.

**El endpoint `portfolio` devuelve varias series en la misma respuesta** —`day`, `week`, `month`, `allTime`— con distinta resolución. `serieCuenta` las **fusiona** en vez de elegir una: `allTime` aporta el rango y `day` aporta la resolución donde la hay, y donde dos se pisan gana la más fina. Antes se quedaba con `allTime`, la más gruesa, y tiraba el resto — o sea interpolaba el colateral sobre la peor grilla disponible teniendo la buena en la mano. La resolución se estima con la mediana de los huecos y no con la cantidad de puntos: una serie larga y rala tiene más puntos que una corta y densa, y lo que importa es cuánto hay que interpolar entre medición y medición.

`userNonFundingLedgerUpdates` trae depósitos, retiros y transferencias, que ningún otro endpoint muestra. Se baja y se enseña crudo en el panel de diagnóstico, y **no se infiere nada de ahí todavía**: los nombres exactos de `delta.type` hay que leerlos de una respuesta real de su cuenta.

Los perps HIP-3 vienen con el prefijo del dex en el coin: `xyz:DRAM`. Para `clearinghouseState` de esos mercados hace falta mandar `dex`, y el código prueba tres variantes con fallback.

**Las liquidaciones se detectan por el campo `liquidation` del fill**, no por `dir`, que dice "Close Long" idéntico a un cierre voluntario.

Los trades se arman de posición plana a posición plana: un scale-in es una sola operación.

El margen de mantenimiento es la mitad del margen inicial al apalancamiento *máximo* del activo. DRAM y SPCX llegan a 20x → 2,5%. MU, SKHY y SNDK a 10x → 5%.

## Tiempo

Las sesiones se clasifican por el reloj de Nueva York y se muestran en hora de Buenos Aires (UTC−3). Todo lo que ve el usuario, incluido el CSV, es hora local.

**Un día es un día de Buenos Aires, siempre.** `diaBA` y `relojBA` son la única forma de agrupar por día o por hora en todo el motor. Antes convivían tres husos: `s.days` agrupaba en UTC, `todayBySession` y `buildDayPlan` en el reloj del navegador, y las sesiones en Nueva York. Consecuencia real: la mediana diaria y el techo de ráfaga del modo aire salían de días UTC mientras "hoy llevás N" salía de días locales, así que toda operación de la noche argentina caía en un día para una cuenta y en otro para la otra. Argentina no cambia de hora desde 2009, así que UTC−3 fijo es exacto y no depende de que exista `Intl`.

Lo que sigue en Nueva York es la clasificación de sesiones y tramos, que describe el mercado. Lo que pasó a Buenos Aires es todo lo que se cuenta como día vivido.

```
asia 21:00–03:30 · hueco 03:30–05:00 · pre 05:00–10:30 · rueda 10:30–17:00 · after 17:00–21:00
```

La rueda está partida en tramos porque él identificó cambios de régimen adentro: apertura, media mañana, mediodía, tarde y cierre. Son momentos para prestar atención, jamás señales.

---

