"""Carga cierres diarios en un plan (plan-activos.json) para que estadoNivel pueda juzgar.

    python _build/cierres.py [ruta-del-plan]

El motor no tiene red (merval-engine.js § 1): los cierres llegan desde afuera, y este es ese
afuera. Lee los tickers de `niveles`, baja los cierres diarios desde el `desde` más viejo y
los escribe en `cierres`. No toca nada más del plan.

Fuente: el gráfico diario de Yahoo. Los tickers con niveles en ARS se piden con sufijo `.BA`
(BYMA); el resto, tal cual (el subyacente en USD). Solo entran ruedas cerradas: la de hoy se
descarta hasta que el mercado cierre, porque un precio intradía no es un cierre.

Sin tickers ni niveles en este archivo: el repo es público.
"""
import json
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

BA = timezone(timedelta(hours=-3))
URL = 'https://query1.finance.yahoo.com/v8/finance/chart/{s}?period1={p1}&period2={p2}&interval=1d'


def simbolo(ticker, moneda):
    return ticker + '.BA' if moneda == 'ARS' else ticker


def bajar(sim, desde_ts):
    url = URL.format(s=sim, p1=int(desde_ts) - 86400 * 3, p2=int(time.time()) + 86400)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        res = json.load(r)['chart']['result'][0]
    meta = res['meta']
    tz = timezone(timedelta(seconds=meta.get('gmtoffset', 0)))
    periodo = meta.get('currentTradingPeriod', {}).get('regular', {})
    abierto_hoy = time.time() < periodo.get('end', 0)
    hoy = datetime.now(tz).date().isoformat()
    filas = []
    for ts, c in zip(res.get('timestamp') or [], res['indicators']['quote'][0].get('close') or []):
        d = datetime.fromtimestamp(ts, tz).date().isoformat()
        if c is None or (d == hoy and abierto_hoy):
            continue
        filas.append({'d': d, 'c': round(c, 4)})
    return filas


def main():
    ruta = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / 'plan-activos.json')
    plan = json.loads(ruta.read_text(encoding='utf-8'))
    niveles = plan.get('niveles') or []
    pedidos = {}
    for n in niveles:
        t = (n.get('ticker') or '').upper().strip()
        if not t:
            continue
        desde = (n.get('desde') or time.time() * 1000) / 1000
        prev = pedidos.get(t)
        pedidos[t] = (n.get('moneda'), min(desde, prev[1]) if prev else desde)

    cierres = plan.get('cierres') or {}
    fallas = []
    for t, (moneda, desde) in sorted(pedidos.items()):
        sim = simbolo(t, moneda)
        try:
            nuevos = bajar(sim, desde)
        except Exception as e:  # noqa: BLE001 - se informa y se sigue con el resto
            fallas.append(f'{t} ({sim}): {e}')
            continue
        por_dia = {x['d']: x for x in cierres.get(t, [])}
        por_dia.update({x['d']: x for x in nuevos})
        cierres[t] = [por_dia[d] for d in sorted(por_dia)]
        ult = cierres[t][-1] if cierres[t] else None
        print(f'  {t:6} {sim:8} {len(nuevos):3} cierres' + (f'  ultimo {ult["d"]} {ult["c"]}' if ult else ''))

    plan['cierres'] = cierres
    plan['cierresLeidos'] = datetime.now(BA).isoformat(timespec='minutes')
    ruta.write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding='utf-8')
    if fallas:
        sys.exit('sin cierres para:\n  ' + '\n  '.join(fallas))


if __name__ == '__main__':
    main()
