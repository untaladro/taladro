#!/usr/bin/env python3
"""Arma el HTML de una sola pieza: mete engine.js dentro de shell.html.

    python3 _build/build.py

Deja el resultado en taladro.html y en publicar/index.html, y le pone
un sello de version con la fecha para poder verificar que lo publicado
es lo ultimo.
"""
import datetime
import pathlib
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SHELL = RAIZ / '_build' / 'shell.html'
ENGINE = RAIZ / '_build' / 'engine.js'
SALIDA = RAIZ / 'index.html'

MARCA = '/*__ENGINE__*/'


def revisar_sintaxis(html):
    """Pasa cada <script> del HTML por `node --check`.

    Los tests corren engine.js suelto, asi que un error introducido al pegar
    las piezas no lo agarra nadie: la pagina sale al aire muda y el build dice
    que salio todo bien. Esto lo agarra antes de escribir el archivo.
    """
    import re
    import shutil
    import subprocess
    import tempfile

    if not shutil.which('node'):
        print('  (aviso) sin node, no puedo revisar la sintaxis')
        return

    bloques = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.S)
    for i, js in enumerate(bloques, 1):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False,
                                         encoding='utf-8') as tmp:
            tmp.write(js)
            ruta = tmp.name
        r = subprocess.run(['node', '--check', ruta],
                           capture_output=True, text=True)
        pathlib.Path(ruta).unlink(missing_ok=True)
        if r.returncode:
            detalle = (r.stderr or '').strip().splitlines()
            pista = '\n    '.join(detalle[:6])
            sys.exit(f'el script #{i} del HTML no compila:\n    {pista}')
    print(f'  sintaxis ok en {len(bloques)} bloque(s) de script')


def revisar_calendario(engine):
    """El calendario de la Fed esta escrito a mano y vence (5.1).

    Sin esto, el 1 de enero de 2027 `ventanaEvento` empieza a devolver None para
    siempre: las operaciones dejan de marcarse y la app sigue andando como si nada.
    Es la forma exacta de los otros dos bugs que este build ya vigila — el problema
    nunca fue el error, fue que el error salia como exito.

    Corta y no avisa a propositio. Un aviso en la consola del build es algo que se
    lee una vez y despues se ignora; lo que hace que esto no pase es que no compile.
    """
    import re
    m = re.search(r"const FOMC = \[([^\]]*)\]", engine)
    if not m:
        sys.exit('no encontre la tabla FOMC en engine.js')
    fechas = re.findall(r"'(\d{4}-\d{2}-\d{2})'", m.group(1))
    if not fechas:
        sys.exit('la tabla FOMC esta vacia')
    md = re.search(r"const FOMC_AVISO_DIAS = (\d+)", engine)
    margen = int(md.group(1)) if md else 60
    ultima = datetime.date.fromisoformat(max(fechas))
    faltan = (ultima - datetime.date.today()).days
    if faltan < margen:
        sys.exit(
            f'el calendario de la Fed se queda corto: la ultima fecha es {ultima} '
            f'y faltan {faltan} dias (el minimo son {margen}).\n'
            f'    Agregá las fechas del ano que viene en FOMC, en _build/engine.js.')
    print(f'  calendario de la Fed ok, {faltan} dias de margen')


M_SHELL = RAIZ / '_build' / 'merval-shell.html'
M_ENGINE = RAIZ / '_build' / 'merval-engine.js'
M_SALIDA = RAIZ / 'merval.html'


def build_merval():
    """Segundo target: el modo Merval.

    Es una invocacion aparte a proposito. Son dos productos independientes, y que un
    fallo del modo Merval impida publicar un arreglo de Talastrat seria acoplar dos
    cosas que no tienen por que moverse juntas. Mismo criterio que el mapa.

    Comparte con el target principal las dos revisiones que valen para cualquier
    pagina —sintaxis de cada <script>, y que no se cuele una direccion— y no corre
    ni el calendario de la Fed ni las pruebas de vista, que son de Talastrat.
    """
    for f in (M_SHELL, M_ENGINE):
        if not f.exists():
            sys.exit(f'falta {f}')

    shell = M_SHELL.read_text(encoding='utf-8')
    engine = M_ENGINE.read_text(encoding='utf-8')
    if MARCA not in shell:
        sys.exit(f'merval-shell.html no tiene la marca {MARCA}')

    version = datetime.datetime.now().strftime('%Y.%m.%d.%H%M')
    html = shell.replace(MARCA, engine).replace('__BUILD__', version)
    if '__BUILD__' in html or MARCA in html:
        sys.exit('quedaron marcas sin reemplazar en el modo Merval')

    import re
    sospechosas = set(re.findall(r'0x[0-9a-fA-F]{40}', html))
    sospechosas.discard('0x0000000000000000000000000000000000000000')
    if sospechosas:
        sys.exit('hay direcciones en merval.html: ' + ', '.join(sospechosas))

    # El cortafuegos, sobre los <script> y NO sobre la pagina entera.
    #
    # La primera version escaneaba todo el HTML y corto por la palabra "rendimiento"
    # en el pie, donde la app declara que no lo calcula. El scope estaba mal, y la
    # correccion no es una lista de excepciones: es que la regla mira lo que el codigo
    # computa, no lo que la copy dice. La prosa se revisa leyendola.
    #
    # El test 11 cubre merval-engine.js; esto cubre el script del shell, que es por
    # donde podria colarse un calculo de resultado sin pasar por el motor.
    for js in re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.S):
        codigo = re.sub(r'/\*.*?\*/', '', js, flags=re.S)
        codigo = re.sub(r'^\s*//.*$', '', codigo, flags=re.M)
        fugas = [w for w in ('pnl', 'cotiza', 'benchmark', 'ganancia', 'retorno')
                 if re.search(w, codigo, re.I)]
        if fugas:
            sys.exit('el modo Merval no puede calcular resultado y aparecio: ' + ', '.join(fugas))

    revisar_sintaxis(html)

    r = _correr_tests_merval()
    if r:
        sys.exit(r)

    # El humo corre contra un borrador, igual que en el target principal: si la pagina
    # no renderiza, merval.html queda como estaba. Publicar a mano una version muerta
    # es demasiado facil y el sello de version no distingue una buena de una rota.
    import tempfile
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False,
                                     encoding='utf-8') as tmp:
        tmp.write(html)
        borrador = pathlib.Path(tmp.name)
    try:
        r = _humo_merval(borrador)
        if r:
            sys.exit(r)
    finally:
        borrador.unlink(missing_ok=True)

    M_SALIDA.write_text(html, encoding='utf-8')
    print(f'merval {version}  ·  {len(html):,} bytes'.replace(',', '.'))
    print(f'  -> {M_SALIDA.name}')


def _correr_tests_merval():
    """Los tests del motor corren adentro del build, no al lado.

    En perps esto se aprendio caro: los seis tests de vista murieron por una ruta que
    ya no existia y nadie se entero, porque el build no los corria. Ver Descartes.
    """
    import shutil
    import subprocess
    if not shutil.which('node'):
        print('  (aviso) sin node, no puedo correr merval-test.js')
        return None
    t = RAIZ / '_build' / 'merval-test.js'
    if not t.exists():
        return 'falta merval-test.js: el build no publica un motor sin tests'
    r = subprocess.run(['node', t.name], capture_output=True, text=True,
                       cwd=str(t.parent))
    salida = (r.stdout or '') + (r.stderr or '')
    if r.returncode or 'FAIL' in salida:
        malas = [l.strip() for l in salida.splitlines() if 'FAIL' in l][:5]
        return 'tests del motor Merval en rojo:\n    ' + '\n    '.join(
            malas or salida.strip().splitlines()[-4:])
    ultimo = [l for l in salida.splitlines() if ' ok, ' in l]
    print('  ' + (ultimo[-1].strip() if ultimo else 'tests del motor Merval ok'))
    return None


def _humo_merval(borrador):
    """La pagina armada contra un DOM de mentira, antes de escribirla.

    `node --check` mira sintaxis y `merval-test.js` prueba el motor suelto. Ninguno de
    los dos toca el render: una pagina que compila con los 87 tests en verde puede
    salir muda. Mismo agujero que tapo `smoke.js` en perps, un piso mas arriba.
    """
    import shutil
    import subprocess
    if not shutil.which('node'):
        print('  (aviso) sin node, no puedo correr el humo del modo Merval')
        return None
    h = RAIZ / '_build' / 'merval-smoke.js'
    if not h.exists():
        return 'falta merval-smoke.js: el build no publica una pagina sin humo'
    r = subprocess.run(['node', h.name, str(borrador)], capture_output=True, text=True,
                       cwd=str(h.parent))
    salida = (r.stdout or '') + (r.stderr or '')
    if r.returncode or 'FAIL' in salida:
        malas = [l.strip() for l in salida.splitlines() if 'FAIL' in l][:5]
        return 'humo del modo Merval en rojo:\n    ' + '\n    '.join(
            malas or salida.strip().splitlines()[-4:])
    print('  humo del modo Merval ok')
    return None


def main():
    for f in (SHELL, ENGINE):
        if not f.exists():
            sys.exit(f'falta {f}')

    shell = SHELL.read_text(encoding='utf-8')
    engine = ENGINE.read_text(encoding='utf-8')

    if MARCA not in shell:
        sys.exit(f'shell.html no tiene la marca {MARCA}')

    # El engine va entero: el `if (typeof module !== 'undefined')` del final ya
    # hace que el navegador saltee el module.exports. Cortarlo a mano se comia
    # la llave de cierre y rompia el script completo, en silencio.

    version = datetime.datetime.now().strftime('%Y.%m.%d.%H%M')
    html = shell.replace(MARCA, engine).replace('__BUILD__', version)

    if '__BUILD__' in html or MARCA in html:
        sys.exit('quedaron marcas sin reemplazar')

    # ninguna wallet real puede terminar publicada
    import re
    sospechosas = set(re.findall(r'0x[0-9a-fA-F]{40}', html))
    sospechosas.discard('0x0000000000000000000000000000000000000000')
    if sospechosas:
        sys.exit('hay direcciones en el HTML: ' + ', '.join(sospechosas))

    revisar_calendario(engine)
    revisar_sintaxis(html)

    # El humo corre contra un borrador en el directorio temporal: si la pagina no
    # renderiza, index.html queda como estaba. Publicar a mano una version rota es
    # demasiado facil, y el sello de version no distingue una buena de una muerta.
    import tempfile
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False,
                                     encoding='utf-8') as tmp:
        tmp.write(html)
        borrador = pathlib.Path(tmp.name)
    try:
        prueba_de_humo(borrador)
        pruebas_de_vista(html)
    finally:
        try:
            borrador.unlink()
        except OSError:
            pass

    SALIDA.write_text(html, encoding='utf-8')
    print(f'version {version}  ·  {len(html):,} bytes'.replace(',', '.'))
    print(f'  -> {SALIDA.name}')


def prueba_de_humo(archivo):
    """Corre la pagina armada contra un DOM de mentira.

    `node --check` mira sintaxis y no llamadas. Una variable de color mal definida
    ---`const ROJO = () => cssVar('--down', ROJO())`--- compila, pasa los tests del
    motor, y revienta en el primer render. Sin esto, el build decia que salio todo
    bien y la pagina salia al aire muerta.
    """
    import shutil
    import subprocess

    if not shutil.which('node'):
        print('  (aviso) sin node, no puedo correr la prueba de humo')
        return

    humo = RAIZ / '_build' / 'smoke.js'
    if not humo.exists():
        print('  (aviso) falta smoke.js')
        return

    r = subprocess.run(['node', str(humo), str(archivo)],
                       capture_output=True, text=True, cwd=str(RAIZ))
    salida = ((r.stdout or '') + (r.stderr or '')).strip()
    if r.returncode:
        detalle = '\n    '.join(salida.splitlines()[-12:])
        sys.exit(f'la pagina armada no renderiza:\n    {detalle}')
    print('  ' + (salida.splitlines() or ['humo ok'])[-1].strip())


def pruebas_de_vista(html):
    """Corre `_build/t/*.js` contra el bloque inline de la pagina recien armada.

    Existe por un agujero que costo caro descubrir: los seis tests de vista leian un
    archivo por ruta absoluta de una carpeta de subidas que dejo de existir, asi que
    hacia rato que ninguno corria. No fallaban --- ni siquiera arrancaban --- y el build
    nunca los habia llamado, asi que la senal de que estaban muertos no existia en
    ningun lado.

    Es exactamente la forma de los dos bugs que ya tiene este build anotados: el
    problema nunca fue el error, fue que el error salia como exito. Un test que no
    puede correr es peor que un test que no existe, porque ocupa el lugar de la
    verificacion sin hacerla. Ahora son parte del build y no se pueden morir en
    silencio otra vez.

    `chk()` en esos tests loguea y no cambia el codigo de salida, asi que la senal de
    falla es la palabra FAIL en la salida.
    """
    import re
    import shutil
    import subprocess
    import tempfile

    if not shutil.which('node'):
        print('  (aviso) sin node, no puedo correr las pruebas de vista')
        return

    carpeta = RAIZ / '_build' / 't'
    casos = sorted(p for p in carpeta.glob('*.js')
                   if p.name not in ('stub.js', 'fixture.js'))
    if not casos:
        print('  (aviso) no hay pruebas de vista en _build/t')
        return

    bloques = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.S)
    if not bloques:
        sys.exit('la pagina armada no tiene bloques de script para las pruebas de vista')
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False,
                                     encoding='utf-8') as tmp:
        tmp.write(max(bloques, key=len))
        inline = pathlib.Path(tmp.name)

    # El CSS tambien, porque hay decisiones que viven solo ahi. El caso que lo pidio es
    # 5.5: que el tilt cruce las dos columnas y que mobile sea el default no son cosas
    # que un DOM de mentira pueda ver, pero si se pueden afirmar sobre la hoja armada.
    estilos = re.findall(r'<style[^>]*>(.*?)</style>', html, re.S)
    with tempfile.NamedTemporaryFile('w', suffix='.css', delete=False,
                                     encoding='utf-8') as tmp:
        tmp.write(max(estilos, key=len) if estilos else '')
        hoja = pathlib.Path(tmp.name)

    # Y la pagina entera. El DOM de `stub.js` fabrica elementos por id a demanda y no
    # tiene arbol, asi que no puede contestar "esto viene antes que aquello". Para las
    # afirmaciones de estructura --- 5.5 necesita que la columna izquierda vaya primera ---
    # lo unico que sabe la verdad es el HTML armado.
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False,
                                     encoding='utf-8') as tmp:
        tmp.write(html)
        pagina = pathlib.Path(tmp.name)

    import os
    entorno = dict(os.environ, TALASTRAT_INLINE=str(inline), TALASTRAT_CSS=str(hoja),
                   TALASTRAT_HTML=str(pagina))
    try:
        malas = []
        for caso in casos:
            r = subprocess.run(['node', caso.name], capture_output=True, text=True,
                               cwd=str(carpeta), env=entorno)
            salida = (r.stdout or '') + (r.stderr or '')
            if r.returncode or 'FAIL' in salida:
                detalle = '\n      '.join(
                    [l.strip() for l in salida.splitlines() if 'FAIL' in l][:4]
                    or salida.strip().splitlines()[-4:])
                malas.append(f'{caso.name}:\n      {detalle}')
        if malas:
            sys.exit('pruebas de vista en rojo:\n    ' + '\n    '.join(malas))
        print(f'  {len(casos)} prueba(s) de vista ok')
    finally:
        inline.unlink(missing_ok=True)
        hoja.unlink(missing_ok=True)
        pagina.unlink(missing_ok=True)


if __name__ == '__main__':
    arg = sys.argv[1] if len(sys.argv) > 1 else ''
    if arg == 'merval':
        build_merval()
    elif arg == 'todo':
        main()
        print()
        build_merval()
    elif arg:
        sys.exit(f'target desconocido: {arg}. Son: (nada) = Talastrat, merval, todo')
    else:
        main()
