#!/bin/bash
# Coloca uma previa no ar. Uso: ./publicar.sh <pasta> <caminho do html>
set -e

if [ $# -ne 2 ]; then
  echo "uso: ./publicar.sh <nome-da-pasta> <caminho do html>"
  echo "ex:  ./publicar.sh clinica-fulano ~/Documents/proj/entregas/site-autossuficiente.html"
  exit 2
fi

PASTA="$1"
ORIGEM="$2"
RAIZ="$(cd "$(dirname "$0")" && pwd)"

[ -f "$ORIGEM" ] || { echo "erro: nao achei o arquivo $ORIGEM"; exit 1; }

mkdir -p "$RAIZ/$PASTA"
cp "$ORIGEM" "$RAIZ/$PASTA/index.html"

# noindex, para a previa nao entrar na busca do Google
PYTHONDONTWRITEBYTECODE=1 /usr/bin/python3 - "$RAIZ/$PASTA/index.html" <<'PY'
import io, sys
p = sys.argv[1]
s = io.open(p, encoding='utf-8').read()
if 'name="robots"' not in s:
    tag = '\n<meta name="robots" content="noindex, nofollow">'
    if '<head>' in s:
        s = s.replace('<head>', '<head>' + tag, 1)
        io.open(p, 'w', encoding='utf-8').write(s)
        print('noindex inserido')
    else:
        print('AVISO: nao achei <head>, o noindex NAO foi inserido')
else:
    print('ja tinha noindex')
PY

cd "$RAIZ"
git add "$PASTA"
git commit -q -m "previa: $PASTA" || { echo "nada mudou, nada a subir"; exit 0; }
git push -q origin main

echo
echo "no ar em ate 1 minuto:"
echo "https://marcosbautitz.github.io/Previa-Clientes/$PASTA/"
