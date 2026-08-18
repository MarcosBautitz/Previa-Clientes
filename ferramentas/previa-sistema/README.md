# Previa navegavel do sistema Harmonelle

A pasta publicada `sistema-harmonelle/` nao e uma pagina: e o proprio app
Next.js do sistema, exportado como HTML estatico, com o backend trocado por uma
camada que responde de uma base gravada da API real. O cliente entra com login e
senha, navega pelas telas, abre conversas, responde, move cards, confirma
agendamento e muda status. Tudo que ele mexe vale enquanto a aba estiver aberta
e volta ao inicio quando recarrega.

## Refazer a previa

```
./regerar.sh
```

Antes de rodar, deixe de pe a API (porta 3001), o Postgres e o Redis, com os
dois seeds aplicados:

```
cd ~/Documents/sdr-atendimento-clinica/sdr-clinica-bautitz-api
npx ts-node prisma/seed-clinica.ts
npx ts-node prisma/seed-demo.ts
```

O script trabalha numa copia temporaria do app. **O repositorio do produto nao e
tocado.**

## Como funciona

**1. Copia e troca.** O app web e copiado para uma pasta temporaria e quatro
arquivos sao substituidos:

| Arquivo | O que muda |
|---|---|
| `next.config.ts` | vira `output: 'export'` com o `basePath` do GitHub Pages |
| `src/lib/api.ts` | mesma instancia axios, com o adaptador da previa no lugar da rede |
| `src/lib/demo-api.ts` | o backend falso (arquivo novo) |
| `src/lib/socket.ts` | socket inerte, para o app nao tentar reconectar para sempre |

As rotas `/pipelines/[id]` e `/chatbot/[id]` ganham um envolucro de servidor com
`generateStaticParams`, exigencia do export estatico, que nao aceita essa funcao
num arquivo `use client`.

**2. Base gravada.** `capturar.mjs` entra na API local com a conta de
demonstracao e grava a resposta de todas as rotas de leitura (colecoes,
detalhes, painel, mensagens de cada conversa) em `dados-demo.json`. E a resposta
real da API: mesmos campos, mesmos formatos, mesmos envelopes.

**3. Backend falso.** `demo-api.ts` recebe as chamadas do axios e responde da
base. Leitura vem da base com os filtros aplicados (status, canal, busca,
paginacao). Escrita muda o estado em memoria e devolve o objeto atualizado, do
mesmo jeito que a API devolveria: mandar mensagem, encerrar e reabrir conversa,
atribuir, etiquetar, mover card, confirmar agendamento, trocar estado de
paciente, ativar procedimento, ligar e desligar automacao. Toda resposta sai
como copia, nunca o objeto vivo, senao o cache da interface nao percebe a
mudanca.

As datas sao deslocadas na hora de carregar: a base sabe o dia em que foi
gravada e tudo anda junto com o calendario, para a agenda nunca aparecer velha.

**4. Ajuste final.** `finalizar.mjs` escreve a pagina de entrada (o redirect do
produto nao sobrevive ao export), marca todas as paginas com `noindex`, prefixa
o titulo da aba com "Previa", mostra o acesso na tela de login e grava o
`.nojekyll`.

## Detalhes que valem lembrar

- **`.nojekyll` na raiz do repositorio e obrigatorio.** Sem ele o GitHub Pages
  passa o site pelo Jekyll, que descarta pastas iniciadas com `_`, e a `_next/`
  some junto com a aplicacao inteira.
- **O `basePath` esta fixo** em `/Previa-Clientes/sistema-harmonelle`. Se a
  pasta publicada mudar de nome, mude junto em `trocas/next.config.ts` e em
  `finalizar.mjs`.
- **A conta da demonstracao** e `demo@harmonelle.com.br` / `Harmonelle2026`,
  criada pelo `prisma/seed-demo.ts` como dona da org da clinica. A senha esta
  no codigo do backend falso porque a previa inteira e publica para quem tem o
  link; nao ha segredo nenhum ali.
- **Nao ha servidor.** Nenhuma mensagem sai, nenhum dado entra. A base tem
  pacientes e conversas inventadas.
