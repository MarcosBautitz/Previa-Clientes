#!/bin/bash
# Refaz a previa navegavel do sistema a partir do codigo do produto.
#
# O que ele faz, em ordem: copia o app web para uma pasta temporaria, troca a
# camada de dados por uma que responde de uma base gravada, grava essa base
# chamando a API local, builda estatico, ajusta o resultado e substitui a pasta
# publicada. O repositorio do produto nao e tocado em nenhum momento.
#
# Pre-requisitos: a API (porta 3001) e o banco rodando, com o seed da clinica e
# o seed de demonstracao ja aplicados:
#   cd sdr-clinica-bautitz-api
#   npx ts-node prisma/seed-clinica.ts
#   npx ts-node prisma/seed-demo.ts
#
# Uso: ./regerar.sh [caminho do sdr-clinica-bautitz-web]

set -e

FER="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$FER/../.." && pwd)"
FONTE="${1:-$HOME/Documents/sdr-atendimento-clinica/sdr-clinica-bautitz-web}"
DESTINO="$REPO/sistema-harmonelle"
API="http://localhost:3001/api/v1"

[ -d "$FONTE/src/app" ] || { echo "erro: nao achei o app web em $FONTE"; exit 1; }

echo "conferindo a API em $API"
curl -sf -o /dev/null -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@harmonelle.com.br","password":"Harmonelle2026"}' \
  || { echo "erro: a API nao respondeu ao login de demonstracao. Suba a API e rode os seeds."; exit 1; }

TMP="$(mktemp -d)"
APP="$TMP/app"
trap 'rm -rf "$TMP"' EXIT

echo "copiando o app para $APP"
mkdir -p "$APP"
rsync -a --exclude node_modules --exclude .next --exclude out --exclude .git "$FONTE/" "$APP/"

echo "trazendo node_modules"
# Hardlink quando der (mesmo volume, instantaneo); copia inteira como reserva.
cp -Rl "$FONTE/node_modules" "$APP/node_modules" 2>/dev/null \
  || cp -R "$FONTE/node_modules" "$APP/node_modules"

echo "trocando a camada de dados"
cp "$FER/trocas/next.config.ts" "$APP/next.config.ts"
cp "$FER/trocas/lib/api.ts" "$APP/src/lib/api.ts"
cp "$FER/trocas/lib/demo-api.ts" "$APP/src/lib/demo-api.ts"
cp "$FER/trocas/lib/socket.ts" "$APP/src/lib/socket.ts"

# Rotas dinamicas: o export estatico exige generateStaticParams, que nao pode
# sair de um arquivo 'use client'. O componente do produto vira um arquivo
# client ao lado, e a page passa a ser um envolucro de servidor.
PIPE="$APP/src/app/(dashboard)/pipelines/[id]"
CHAT="$APP/src/app/(dashboard)/chatbot/[id]"
mv "$PIPE/page.tsx" "$PIPE/board-client.tsx"
sed -i '' 's/export default function PipelineBoardPage/export default function PipelineBoardClient/' "$PIPE/board-client.tsx"
cp "$FER/trocas/rotas/pipelines-id-page.tsx" "$PIPE/page.tsx"

mv "$CHAT/page.tsx" "$CHAT/editor-client.tsx"
/usr/bin/python3 - "$CHAT/editor-client.tsx" <<'PY'
import io, sys
p = sys.argv[1]
s = io.open(p, encoding='utf-8').read()
s = s.replace("import { use } from 'react';", "import { useParams } from 'next/navigation';")
s = s.replace(
    "export default function ChatbotEditorPage({ params }: { params: Promise<{ id: string }> }) {\n  const { id } = use(params);",
    "export default function ChatbotEditorClient() {\n  const params = useParams<{ id: string }>();\n  const id = params?.id as string;",
)
io.open(p, 'w', encoding='utf-8').write(s)
PY
cp "$FER/trocas/rotas/chatbot-id-page.tsx" "$CHAT/page.tsx"

echo "gravando a base a partir da API"
node "$FER/capturar.mjs" "$APP/src/lib/dados-demo.json"

echo "buildando o export estatico"
(cd "$APP" && npx next build)

echo "ajustando o resultado"
node "$FER/finalizar.mjs" "$APP/out"

echo "publicando em $DESTINO"
rm -rf "$DESTINO"
mkdir -p "$DESTINO"
cp -R "$APP/out/." "$DESTINO/"

echo
echo "pronto. confira local com:"
echo "  cd \"$REPO/..\" && python3 -m http.server 8123"
echo "  http://127.0.0.1:8123/Previa-Clientes/sistema-harmonelle/"
echo
echo "para subir:"
echo "  cd \"$REPO\" && git add sistema-harmonelle && git commit -m 'previa: sistema-harmonelle atualizado' && git push"
