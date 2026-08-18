// Captura as respostas reais da API local e grava a base da previa estatica.
// Uso: node capturar.mjs <arquivo-de-saida>

const BASE = 'http://localhost:3001/api/v1';
const EMAIL = 'demo@harmonelle.com.br';
const SENHA = 'Harmonelle2026';
const SAIDA = process.argv[2] || 'dados-demo.json';

let token = '';
let orgId = '';
const rotas = {};
let falhas = 0;

async function entrar() {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: SENHA }),
  });
  if (!r.ok) throw new Error(`login falhou: ${r.status}`);
  const corpo = await r.json();
  token = corpo.data.accessToken;
  orgId = corpo.data.organizations[0].id;
  rotas['POST /auth/login'] = corpo.data;
  console.log(`login ok — org ${orgId}`);
}

/** GET no endpoint e guarda o payload ja desembrulhado (body.data). */
async function pegar(caminho, chave = caminho) {
  try {
    const r = await fetch(`${BASE}${caminho}`, {
      headers: { Authorization: `Bearer ${token}`, 'x-organization-id': orgId },
    });
    if (!r.ok) {
      falhas++;
      console.log(`  ${r.status} ${caminho}`);
      return null;
    }
    const corpo = await r.json();
    const carga = corpo && 'data' in corpo ? corpo.data : corpo;
    rotas[`GET ${chave}`] = carga;
    return carga;
  } catch (e) {
    falhas++;
    console.log(`  ERRO ${caminho}: ${e.message}`);
    return null;
  }
}

function ids(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.map((x) => x && x.id).filter(Boolean);
}

await entrar();

console.log('coletando colecoes...');
await pegar('/auth/me');
await pegar('/organizations/current');
await pegar('/organizations/members');
await pegar('/users/me/preferences');
await pegar('/notifications');
await pegar('/notifications/unread-count');
await pegar('/api-keys');
await pegar('/projects');
await pegar('/projects/filters');
await pegar('/chatbot-flows');
await pegar('/pending-actions');
await pegar('/inbox-views');
await pegar('/segments');

const canais = await pegar('/channels');
const tags = await pegar('/tags');
const contatos = await pegar('/contacts');
const pipelines = await pegar('/pipelines');
const automacoes = await pegar('/automations');
await pegar('/automations/meta');
const agentes = await pegar('/ai-agents');
await pegar('/ai-agents/stats/overview');
await pegar('/ai-agents/runs/feed');
await pegar('/ai-agents/watchdog/stats');
await pegar('/ai-catalog/skills');
await pegar('/ai-catalog/tools');

const conversasResp = await pegar('/conversations?limit=200', '/conversations');
await pegar('/conversations/counts');

const pacientes = await pegar('/clinica/pacientes');
const agendamentos = await pegar('/clinica/agendamentos');
const procedimentos = await pegar('/clinica/procedimentos');
const protocolos = await pegar('/clinica/protocolos');
await pegar('/clinica/profissionais');

console.log('painel...');
for (const p of [
  'overview', 'volume-by-day', 'volume-by-channel', 'volume-by-status',
  'kpi-sparklines', 'agent-performance', 'volume-flow', 'peak-hours',
  'messages-flow', 'bot-performance', 'csat', 'reopens', 'top-tags',
]) {
  await pegar(`/dashboard/${p}`);
}

console.log('detalhes por id...');
for (const id of ids(canais)) {
  await pegar(`/channels/${id}`);
  await pegar(`/channels/${id}/agents`);
  await pegar(`/channels/${id}/eligible-agents`);
}
for (const id of ids(pipelines)) {
  await pegar(`/pipelines/${id}/board`);
}
for (const id of ids(automacoes)) {
  await pegar(`/automations/${id}`);
  await pegar(`/automations/${id}/stats`);
  await pegar(`/automations/${id}/runs`);
}
for (const id of ids(agentes)) {
  await pegar(`/ai-agents/${id}`);
  await pegar(`/ai-agents/${id}/skills`);
  await pegar(`/ai-agents/${id}/stats`);
  await pegar(`/ai-agents/${id}/runs`);
}
for (const id of ids(contatos && contatos.contacts ? contatos.contacts : contatos)) {
  await pegar(`/contacts/${id}`);
}
for (const id of ids(pacientes)) {
  await pegar(`/clinica/pacientes/${id}`);
}
for (const id of ids(agendamentos)) {
  await pegar(`/clinica/agendamentos/${id}`);
}
for (const id of ids(procedimentos)) {
  await pegar(`/clinica/procedimentos/${id}`);
  for (const sub of ['faq', 'insumos', 'complementares', 'profissionais', 'casos', 'videos']) {
    await pegar(`/clinica/procedimentos/${id}/${sub}`);
  }
}
for (const id of ids(protocolos)) {
  await pegar(`/clinica/protocolos/${id}`);
}

const listaConversas = conversasResp && conversasResp.conversations ? conversasResp.conversations : [];
console.log(`mensagens de ${listaConversas.length} conversas...`);
const mensagens = {};
for (const c of listaConversas) {
  await pegar(`/conversations/${c.id}`);
  const r = await fetch(`${BASE}/messages?conversationId=${c.id}&page=1&limit=100`, {
    headers: { Authorization: `Bearer ${token}`, 'x-organization-id': orgId },
  });
  if (r.ok) {
    const corpo = await r.json();
    mensagens[c.id] = corpo.data;
  } else {
    falhas++;
  }
}

const saida = {
  capturadoEm: new Date().toISOString(),
  orgId,
  rotas,
  mensagens,
};

const { writeFileSync } = await import('node:fs');
writeFileSync(SAIDA, JSON.stringify(saida));
const tamanho = (JSON.stringify(saida).length / 1024).toFixed(0);
console.log(`\ngravado ${SAIDA} — ${Object.keys(rotas).length} rotas, ${Object.keys(mensagens).length} conversas com mensagens, ${tamanho} KB, ${falhas} falhas`);
