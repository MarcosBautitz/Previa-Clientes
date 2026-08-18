// Ajustes no export estatico antes de publicar no GitHub Pages.
// Uso: node finalizar.mjs <pasta out>

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2];
if (!OUT) throw new Error('informe a pasta out');

const BASE = '/Previa-Clientes/sistema-harmonelle';
const EMAIL = 'demo@harmonelle.com.br';
const SENHA = 'Harmonelle2026';

function listarHtml(dir) {
  const achados = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) achados.push(...listarHtml(caminho));
    else if (nome.endsWith('.html')) achados.push(caminho);
  }
  return achados;
}

// ─── 1. Pagina de entrada, no lugar do redirect do produto (que o export
//        estatico nao consegue gerar) ────────────────────────────────────────
const entrada = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Previa \u00b7 Harmonelle Clinic</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  :root{--areia:#F6F1E9;--creme:#EFE7DA;--branco:#FDFBF7;--ink:#241E17;--cafe:#6E4F33;--caramelo:#A97B4F;--linha:#E3D8C8;--salvia:#7A8B6F;
        --serif:"Fraunces",Georgia,serif;--sans:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--areia);color:var(--ink);
       font-family:var(--sans);font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased;padding:32px 22px}
  main{max-width:560px;width:100%}
  .marca{font-family:var(--serif);font-size:12px;letter-spacing:.34em;text-transform:uppercase;color:var(--caramelo);margin:0 0 18px;font-weight:500}
  h1{font-family:var(--serif);font-weight:400;font-size:clamp(26px,4.4vw,38px);line-height:1.16;margin:0 0 16px;letter-spacing:-.01em}
  p{margin:0 0 16px;color:rgba(36,30,23,.78);font-size:16px}
  .acesso{margin:26px 0 0;padding:18px 20px;background:var(--branco);border:1px solid var(--linha);border-radius:4px}
  .acesso h2{font-family:var(--serif);font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--caramelo);font-weight:500;margin:0 0 12px}
  .linha{display:flex;justify-content:space-between;gap:16px;font-size:15px;padding:4px 0}
  .linha span:first-child{color:rgba(36,30,23,.55)}
  .linha span:last-child{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px}
  .botao{display:inline-block;margin:26px 0 0;padding:13px 30px;background:var(--salvia);color:#fff;text-decoration:none;
         border-radius:3px;font-size:15px;font-weight:500;letter-spacing:.01em;transition:background .18s ease}
  .botao:hover{background:#6b7c60}
  .nota{margin:26px 0 0;padding-top:20px;border-top:1px solid var(--linha);font-size:13.5px;color:rgba(36,30,23,.55)}
  .assinatura{margin:6px 0 0;font-family:var(--serif);font-style:italic;font-size:13.5px;color:rgba(36,30,23,.45)}
</style>
</head>
<body>
  <main>
    <p class="marca">Harmonelle Clinic</p>
    <h1>O sistema de atendimento da clínica, para você usar</h1>
    <p>
      Esta é a prévia do painel que reúne conversas, funil, agenda, pacientes,
      protocolos e prontuário em um lugar só. Não é uma apresentação de telas:
      é o sistema em si, para entrar, navegar, abrir conversas, responder,
      mover cards e mudar o que quiser.
    </p>
    <p>
      As pacientes, conversas e valores são inventados para a demonstração, e
      nada sai daqui: nenhuma mensagem é enviada de verdade. O que você mexer
      vale enquanto a página estiver aberta e volta ao início quando recarregar.
    </p>

    <div class="acesso">
      <h2>Acesso</h2>
      <div class="linha"><span>E-mail</span><span>${EMAIL}</span></div>
      <div class="linha"><span>Senha</span><span>${SENHA}</span></div>
    </div>

    <a class="botao" href="${BASE}/login/">Entrar no sistema</a>

    <p class="nota">Prévia para aprovação. Página não indexada e de acesso restrito a quem tem o link.</p>
    <p class="assinatura">Prazer em se ver.</p>
  </main>
</body>
</html>
`;
writeFileSync(join(OUT, 'index.html'), entrada);
console.log('index.html: pagina de entrada');

// ─── 2. /contacts virou aba de configuracoes; o redirect do produto tambem
//        nao sobrevive ao export ─────────────────────────────────────────────
const redirecionar = (destino) => `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="robots" content="noindex, nofollow">
<meta http-equiv="refresh" content="0; url=${destino}"><title>Redirecionando</title></head>
<body><script>location.replace('${destino}');</script></body></html>
`;
try {
  writeFileSync(join(OUT, 'contacts', 'index.html'), redirecionar(`${BASE}/settings/contacts/`));
  console.log('contacts/index.html: redirect');
} catch {
  console.log('contacts/index.html: nao existe, ignorado');
}

// ─── 3. Marcas da previa em toda pagina do app ───────────────────────────────
const NOINDEX = '<meta name="robots" content="noindex, nofollow"/>';
const SCRIPT_PREVIA = `<script>(function(){
  var EMAIL=${JSON.stringify(EMAIL)}, SENHA=${JSON.stringify(SENHA)};
  // Titulo da aba deixa claro que e previa, inclusive apos navegacao interna.
  function marcarTitulo(){
    if (document.title.indexOf('Prévia') !== 0) document.title = 'Prévia · ' + document.title;
  }
  // Aviso discreto, so na tela de entrada, com o acesso a mao.
  function aviso(){
    var naLogin = /\\/login\\/?$/.test(location.pathname);
    var el = document.getElementById('previa-aviso');
    if (naLogin && !el) {
      el = document.createElement('div');
      el.id = 'previa-aviso';
      el.setAttribute('style','position:fixed;left:0;right:0;bottom:20px;z-index:60;text-align:center;'
        + 'font:400 13px/1.6 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;'
        + 'color:rgba(36,30,23,.62);pointer-events:none;padding:0 16px');
      el.innerHTML = 'Prévia do sistema · entre com <b style="font-weight:600;color:rgba(36,30,23,.8)">'
        + EMAIL + '</b> e senha <b style="font-weight:600;color:rgba(36,30,23,.8)">' + SENHA
        + '</b><br>Dados fictícios: nenhuma mensagem é enviada de verdade.';
      document.body.appendChild(el);
    } else if (!naLogin && el) {
      el.remove();
    }
  }
  function tick(){ marcarTitulo(); aviso(); }
  document.addEventListener('DOMContentLoaded', tick);
  tick();
  setInterval(tick, 400);
})();</script>`;

let tocados = 0;
for (const arquivo of listarHtml(OUT)) {
  let html = readFileSync(arquivo, 'utf8');
  if (html.indexOf('previa-aviso') !== -1) continue;
  if (html.indexOf('name="robots"') === -1) {
    html = html.replace('</head>', `${NOINDEX}</head>`);
  }
  html = html.replace('</body>', `${SCRIPT_PREVIA}</body>`);
  writeFileSync(arquivo, html);
  tocados++;
}
console.log(`marcas de previa em ${tocados} paginas`);

// ─── 4. GitHub Pages passa por Jekyll, que ignora pastas iniciadas com _ ─────
writeFileSync(join(OUT, '.nojekyll'), '');
console.log('.nojekyll gravado');
