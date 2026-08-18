/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Backend falso da PREVIA estatica.
 *
 * Este arquivo existe apenas no build da previa: ele troca o adaptador do axios
 * por um que responde a partir de uma base gravada da API real, mantendo os
 * mesmos caminhos, envelopes e formatos. A interface e o codigo do produto, sem
 * um unico if de demonstracao.
 *
 * O estado vive em memoria: tudo que o visitante faz na sessao (mandar
 * mensagem, fechar conversa, mover card, confirmar agendamento, mudar status)
 * fica valendo ate ele recarregar a pagina, quando volta ao ponto inicial.
 */

import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import baseOriginal from './dados-demo.json';

// ─── Base e deslocamento de datas ────────────────────────────────────────────

const UM_DIA = 24 * 60 * 60 * 1000;
const ISO_COMPLETA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A base foi gravada num dia especifico. Para a agenda nunca aparecer velha,
 * todas as datas sao deslocadas pelo numero de dias que passou desde a captura.
 */
function deslocar(valor: any, dias: number): any {
  if (dias === 0) return valor;
  if (typeof valor === 'string') {
    if (ISO_COMPLETA.test(valor)) {
      return new Date(new Date(valor).getTime() + dias * UM_DIA).toISOString();
    }
    if (ISO_DATA.test(valor)) {
      const d = new Date(`${valor}T12:00:00.000Z`);
      return new Date(d.getTime() + dias * UM_DIA).toISOString().slice(0, 10);
    }
    return valor;
  }
  if (Array.isArray(valor)) return valor.map((v) => deslocar(v, dias));
  if (valor && typeof valor === 'object') {
    const saida: Record<string, any> = {};
    for (const chave of Object.keys(valor)) saida[chave] = deslocar(valor[chave], dias);
    return saida;
  }
  return valor;
}

const capturadoEm = new Date((baseOriginal as any).capturadoEm);
const inicioCaptura = new Date(capturadoEm);
inicioCaptura.setHours(0, 0, 0, 0);
const inicioHoje = new Date();
inicioHoje.setHours(0, 0, 0, 0);
const DIAS_OFFSET = Math.round((inicioHoje.getTime() - inicioCaptura.getTime()) / UM_DIA);

const base: any = deslocar(JSON.parse(JSON.stringify(baseOriginal)), DIAS_OFFSET);

const rotas: Record<string, any> = base.rotas;
const mensagensPorConversa: Record<string, any> = base.mensagens;

// ─── Atalhos para as colecoes vivas ──────────────────────────────────────────

const usuario = rotas['POST /auth/login'].user;
const organizacoes = rotas['POST /auth/login'].organizations;

const conversas: any[] = rotas['GET /conversations'].conversations;
const contatos: any[] = rotas['GET /contacts'].contacts;
const pacientes: any[] = rotas['GET /clinica/pacientes'];
const agendamentos: any[] = rotas['GET /clinica/agendamentos'];
const procedimentos: any[] = rotas['GET /clinica/procedimentos'];
const protocolos: any[] = rotas['GET /clinica/protocolos'];
const etiquetas: any[] = rotas['GET /tags'];
const canais: any[] = rotas['GET /channels'];
const automacoes: any[] = rotas['GET /automations'];
const agentes: any[] = rotas['GET /ai-agents'];
const pipelines: any[] = rotas['GET /pipelines'];
const chavesApi: any[] = rotas['GET /api-keys'] ?? [];
const segmentos: any[] = rotas['GET /segments'] ?? [];
const visoesInbox: any[] = rotas['GET /inbox-views'] ?? [];
const notificacoes: any = rotas['GET /notifications'] ?? { notifications: [], unreadCount: 0 };

/** Colecoes simples, indexadas pelo caminho da lista. */
const colecoes: Record<string, any[]> = {
  '/clinica/pacientes': pacientes,
  '/clinica/agendamentos': agendamentos,
  '/clinica/procedimentos': procedimentos,
  '/clinica/protocolos': protocolos,
  '/tags': etiquetas,
  '/channels': canais,
  '/automations': automacoes,
  '/ai-agents': agentes,
  '/pipelines': pipelines,
  '/api-keys': chavesApi,
  '/segments': segmentos,
  '/inbox-views': visoesInbox,
};

function acharEmQualquerColecao(id: string): any | null {
  for (const lista of Object.values(colecoes)) {
    const achado = lista.find((x: any) => x?.id === id);
    if (achado) return achado;
  }
  const conversa = conversas.find((c) => c.id === id);
  if (conversa) return conversa;
  const contato = contatos.find((c) => c.id === id);
  if (contato) return contato;
  return null;
}

/** Usuario da org por id, no formato curto que as telas esperam. */
function membroPorId(id: string): { id: string; name: string } | null {
  if (id === usuario.id) return { id: usuario.id, name: usuario.name };
  const membros: any[] = rotas['GET /organizations/members'] ?? [];
  const m = membros.find((x: any) => x.userId === id || x.user?.id === id);
  return m ? { id, name: m.user?.name ?? 'Profissional' } : null;
}

function agora(): string {
  return new Date().toISOString();
}

let contadorId = 0;
function novoId(prefixo: string): string {
  contadorId += 1;
  return `${prefixo}_${Date.now().toString(36)}${contadorId}`;
}

// ─── Resposta ────────────────────────────────────────────────────────────────

interface Saida {
  status: number;
  corpo: any;
}

/**
 * Toda resposta sai como copia. Uma API real devolve JSON novo a cada chamada;
 * se devolvessemos o objeto vivo do estado, o cache da interface passaria a
 * apontar para ele e mudanca nenhuma seria percebida como mudanca.
 */
function copiar<T>(valor: T): T {
  return valor === undefined || valor === null ? valor : JSON.parse(JSON.stringify(valor));
}

function ok(carga: any): Saida {
  return { status: 200, corpo: { data: copiar(carga), meta: { timestamp: agora() } } };
}

function falha(status: number, mensagem: string): Saida {
  return { status, corpo: { message: mensagem, statusCode: status } };
}

// ─── Conversas ───────────────────────────────────────────────────────────────

function contarPorStatus(): Record<string, number> {
  const contagem: Record<string, number> = { PENDING: 0, BOT: 0, OPEN: 0, WAITING: 0, CLOSED: 0 };
  for (const c of conversas) {
    if (c.isArchived) continue;
    contagem[c.status] = (contagem[c.status] ?? 0) + 1;
  }
  return contagem;
}

function ordenarConversas(lista: any[]): any[] {
  return [...lista].sort((a, b) => {
    const ta = new Date(a.lastMessageAt ?? a.createdAt).getTime();
    const tb = new Date(b.lastMessageAt ?? b.createdAt).getTime();
    return tb - ta;
  });
}

function filtrarConversas(params: Record<string, string>): any {
  let lista = conversas;

  const arquivadas = params.archived;
  if (arquivadas === 'only') lista = lista.filter((c) => c.isArchived);
  else if (arquivadas === 'exclude' || !arquivadas) lista = lista.filter((c) => !c.isArchived);

  if (params.status) {
    const desejados = params.status.split(',');
    lista = lista.filter((c) => desejados.includes(c.status));
  }
  if (params.channelId) lista = lista.filter((c) => c.channelId === params.channelId);
  if (params.assignedToId) lista = lista.filter((c) => c.assignedToId === params.assignedToId);
  if (params.unread === 'true') lista = lista.filter((c) => (c.unreadCount ?? 0) > 0);
  if (params.groups === 'only') lista = lista.filter((c) => c.isGroup);
  if (params.groups === 'exclude') lista = lista.filter((c) => !c.isGroup);
  if (params.segmentId) lista = lista.filter((c) => c.segmentId === params.segmentId);
  if (params.tagIds) {
    const desejadas = params.tagIds.split(',');
    lista = lista.filter((c) =>
      (c.tags ?? []).some((t: any) => desejadas.includes(t?.tag?.id ?? t?.tagId)),
    );
  }
  if (params.search) {
    const busca = params.search.toLowerCase();
    lista = lista.filter((c) => {
      const nome = (c.contact?.name ?? '').toLowerCase();
      const telefone = (c.contact?.phone ?? '').toLowerCase();
      const ultima = (c.messages?.[0]?.content?.text ?? '').toLowerCase();
      return nome.includes(busca) || telefone.includes(busca) || ultima.includes(busca);
    });
  }

  lista = ordenarConversas(lista);

  const limite = Number(params.limit ?? 30);
  const pagina = Number(params.page ?? 1);
  const total = lista.length;
  const fatia = lista.slice((pagina - 1) * limite, pagina * limite);

  return {
    conversations: fatia,
    pagination: {
      page: pagina,
      limit: limite,
      total,
      totalPages: Math.max(1, Math.ceil(total / limite)),
    },
  };
}

function conversaPorId(id: string): any | null {
  const daLista = conversas.find((c) => c.id === id);
  const capturada = rotas[`GET /conversations/${id}`];
  if (!daLista && !capturada) return null;
  return { ...(capturada ?? {}), ...(daLista ?? {}) };
}

function anexarMensagem(conversaId: string, mensagem: any): void {
  if (!mensagensPorConversa[conversaId]) {
    mensagensPorConversa[conversaId] = {
      messages: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 1 },
    };
  }
  const bloco = mensagensPorConversa[conversaId];
  bloco.messages.push(mensagem);
  bloco.pagination.total = bloco.messages.length;

  const conversa = conversas.find((c) => c.id === conversaId);
  if (conversa) {
    conversa.lastMessageAt = mensagem.createdAt;
    conversa.messages = [mensagem];
    conversa._count = { messages: (conversa._count?.messages ?? 0) + 1 };
    if (conversa.status === 'PENDING' || conversa.status === 'BOT') conversa.status = 'OPEN';
    if (!conversa.assignedToId && mensagem.direction === 'OUTBOUND') {
      conversa.assignedToId = usuario.id;
      conversa.assignedTo = { id: usuario.id, name: usuario.name, avatarUrl: usuario.avatarUrl };
    }
  }
}

// ─── Quadro do funil ─────────────────────────────────────────────────────────

function quadro(pipelineId: string): any | null {
  return rotas[`GET /pipelines/${pipelineId}/board`] ?? null;
}

/**
 * No quadro, `cards` vem agrupado por etapa: { stageId: Card[] }. Todo acesso a
 * card passa por aqui para nao esquecer disso.
 */
function listasDoQuadro(board: any): any[][] {
  if (!board?.cards) return [];
  return Array.isArray(board.cards) ? [board.cards] : Object.values(board.cards);
}

function acharCard(cardId: string): { card: any; board: any } | null {
  for (const p of pipelines) {
    const b = quadro(p.id);
    if (!b) continue;
    for (const lista of listasDoQuadro(b)) {
      const card = lista.find((c: any) => c?.id === cardId);
      if (card) return { card, board: b };
    }
  }
  return null;
}

/** Tira o card da etapa em que estiver e coloca na etapa destino. */
function moverCard(board: any, card: any, stageIdDestino: string, ordem?: number): void {
  for (const lista of listasDoQuadro(board)) {
    const i = lista.findIndex((c: any) => c?.id === card.id);
    if (i >= 0) lista.splice(i, 1);
  }
  card.stageId = stageIdDestino;
  if (typeof ordem === 'number') card.order = ordem;
  if (Array.isArray(board.cards)) {
    board.cards.push(card);
    return;
  }
  board.cards[stageIdDestino] = board.cards[stageIdDestino] ?? [];
  const destino = board.cards[stageIdDestino];
  const posicao = typeof ordem === 'number' ? Math.min(ordem, destino.length) : destino.length;
  destino.splice(posicao, 0, card);
  destino.forEach((c: any, i: number) => {
    c.order = i;
  });
}

function removerCard(board: any, cardId: string): void {
  for (const lista of listasDoQuadro(board)) {
    const i = lista.findIndex((c: any) => c?.id === cardId);
    if (i >= 0) lista.splice(i, 1);
  }
}

// ─── Etiquetas ───────────────────────────────────────────────────────────────

function ligarEtiqueta(alvo: any, tagId: string): void {
  if (!alvo) return;
  const tag = etiquetas.find((t) => t.id === tagId);
  if (!tag) return;
  alvo.tags = alvo.tags ?? [];
  if (!alvo.tags.some((t: any) => (t?.tag?.id ?? t?.tagId) === tagId)) {
    alvo.tags.push({ tag });
  }
}

function desligarEtiqueta(alvo: any, tagId: string): void {
  if (!alvo?.tags) return;
  alvo.tags = alvo.tags.filter((t: any) => (t?.tag?.id ?? t?.tagId) !== tagId);
}

// ─── Roteador ────────────────────────────────────────────────────────────────

function despachar(
  metodo: string,
  caminho: string,
  params: Record<string, string>,
  corpo: any,
): Saida {
  const partes = caminho.split('/').filter(Boolean);
  const chaveCapturada = `${metodo} ${caminho}`;

  // ── Autenticacao ──
  if (metodo === 'POST' && caminho === '/auth/login') {
    const email = String(corpo?.email ?? '').trim().toLowerCase();
    const senha = String(corpo?.password ?? '');
    if (email !== usuario.email.toLowerCase() || senha !== 'Harmonelle2026') {
      return falha(401, 'E-mail ou senha incorretos.');
    }
    return ok(rotas['POST /auth/login']);
  }
  if (metodo === 'POST' && caminho === '/auth/register') {
    return falha(403, 'Esta e uma demonstracao: entre com a conta de acesso que voce recebeu.');
  }
  if (metodo === 'POST' && caminho === '/auth/refresh') {
    return ok(rotas['POST /auth/login']);
  }
  if (metodo === 'GET' && caminho === '/auth/me') {
    return ok({ user: usuario, organizations: organizacoes });
  }

  // ── Conversas ──
  if (metodo === 'GET' && caminho === '/conversations') return ok(filtrarConversas(params));
  if (metodo === 'GET' && caminho === '/conversations/counts') return ok(contarPorStatus());
  if (metodo === 'GET' && partes[0] === 'conversations' && partes.length === 2) {
    const c = conversaPorId(partes[1]);
    return c ? ok(c) : falha(404, 'Conversa nao encontrada');
  }
  if (partes[0] === 'conversations' && partes.length >= 2) {
    const conversa = conversas.find((c) => c.id === partes[1]);
    if (!conversa) return falha(404, 'Conversa nao encontrada');
    const acao = partes.slice(2).join('/');

    if (metodo === 'PATCH' && !acao) {
      Object.assign(conversa, corpo ?? {});
      if (corpo && 'assignedToId' in corpo) {
        conversa.assignedTo = corpo.assignedToId
          ? { id: usuario.id, name: usuario.name, avatarUrl: usuario.avatarUrl }
          : null;
      }
      return ok(conversaPorId(conversa.id));
    }
    if (metodo === 'POST' && acao === 'close') {
      conversa.status = 'CLOSED';
      conversa.closedAt = agora();
      return ok(conversaPorId(conversa.id));
    }
    if (metodo === 'POST' && acao === 'reopen') {
      conversa.status = 'OPEN';
      conversa.closedAt = null;
      conversa.reopenedAt = agora();
      conversa.reopenedCount = (conversa.reopenedCount ?? 0) + 1;
      return ok(conversaPorId(conversa.id));
    }
    if (metodo === 'POST' && acao === 'assign-me') {
      conversa.assignedToId = usuario.id;
      conversa.assignedTo = { id: usuario.id, name: usuario.name, avatarUrl: usuario.avatarUrl };
      if (conversa.status === 'PENDING') conversa.status = 'OPEN';
      return ok(conversaPorId(conversa.id));
    }
    if (metodo === 'POST' && acao === 'read') {
      conversa.unreadCount = 0;
      return ok({ ok: true });
    }
    if (metodo === 'POST' && acao === 'unread') {
      conversa.unreadCount = 1;
      return ok({ ok: true });
    }
    if (metodo === 'POST' && acao === 'archive') {
      conversa.isArchived = true;
      conversa.archivedAt = agora();
      return ok(conversaPorId(conversa.id));
    }
    if (metodo === 'POST' && acao === 'unarchive') {
      conversa.isArchived = false;
      conversa.archivedAt = null;
      return ok(conversaPorId(conversa.id));
    }
    if (metodo === 'POST' && acao === 'sync') {
      return ok({ imported: 0, fetched: 0, syncedAt: agora() });
    }
    if (metodo === 'PATCH' && acao === 'ai') {
      conversa.aiEnabled = corpo?.enabled ?? null;
      conversa.aiDisabledAt = corpo?.enabled === false ? agora() : null;
      return ok(conversaPorId(conversa.id));
    }
    if (metodo === 'POST' && acao === 'ai/engage') {
      conversa.aiEnabled = true;
      return ok(conversaPorId(conversa.id));
    }
    if (metodo === 'POST' && acao === 'ai/set-agent') {
      conversa.activeAgentId = corpo?.agentId ?? null;
      return ok(conversaPorId(conversa.id));
    }
  }
  if (metodo === 'POST' && caminho === '/conversations') {
    return falha(422, 'Iniciar conversa nova nao esta disponivel na demonstracao.');
  }

  // ── Mensagens ──
  if (metodo === 'GET' && caminho === '/messages') {
    const bloco = mensagensPorConversa[params.conversationId];
    return ok(bloco ?? { messages: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } });
  }
  if (metodo === 'POST' && caminho === '/messages') {
    const conversaId = corpo?.conversationId;
    const mensagem = {
      id: novoId('msg'),
      conversationId: conversaId,
      direction: 'OUTBOUND',
      type: corpo?.type ?? 'TEXT',
      content: corpo?.content ?? { text: '' },
      externalId: null,
      status: 'SENT',
      senderName: usuario.name,
      senderId: usuario.id,
      sender: { id: usuario.id, name: usuario.name, avatarUrl: usuario.avatarUrl },
      providerTimestamp: agora(),
      sentAt: agora(),
      deliveredAt: null,
      readAt: null,
      failedReason: null,
      metadata: corpo?.metadata ?? {},
      createdAt: agora(),
    };
    anexarMensagem(conversaId, mensagem);
    return ok(mensagem);
  }
  if (metodo === 'DELETE' && partes[0] === 'messages' && partes.length === 2) {
    for (const bloco of Object.values(mensagensPorConversa)) {
      const m = (bloco as any).messages.find((x: any) => x.id === partes[1]);
      if (m) {
        m.revokedAt = agora();
        m.revokedBy = usuario.id;
        m.revokeSucceededRemote = true;
        return ok(m);
      }
    }
    return falha(404, 'Mensagem nao encontrada');
  }
  if (metodo === 'POST' && caminho.startsWith('/messages/uploads')) {
    return falha(422, 'Envio de arquivo nao esta disponivel na demonstracao.');
  }

  // ── Etiquetas em conversa e contato ──
  if (partes[0] === 'tags' && partes[1] === 'conversation' && partes[3] === 'tag') {
    const conversa = conversas.find((c) => c.id === partes[2]);
    if (metodo === 'POST') ligarEtiqueta(conversa, partes[4]);
    if (metodo === 'DELETE') desligarEtiqueta(conversa, partes[4]);
    return ok({ ok: true });
  }
  if (partes[0] === 'tags' && partes[1] === 'contact' && partes[3] === 'tag') {
    const contato = contatos.find((c) => c.id === partes[2]);
    if (metodo === 'POST') ligarEtiqueta(contato, partes[4]);
    if (metodo === 'DELETE') desligarEtiqueta(contato, partes[4]);
    return ok({ ok: true });
  }

  // ── Contatos ──
  if (metodo === 'GET' && caminho === '/contacts') {
    let lista = contatos;
    if (params.search) {
      const busca = params.search.toLowerCase();
      lista = lista.filter(
        (c) =>
          (c.name ?? '').toLowerCase().includes(busca) ||
          (c.phone ?? '').includes(busca) ||
          (c.email ?? '').toLowerCase().includes(busca),
      );
    }
    return ok({
      contacts: lista,
      pagination: { page: 1, limit: lista.length, total: lista.length, totalPages: 1 },
    });
  }

  // ── Funil ──
  if (metodo === 'GET' && partes[0] === 'pipelines' && partes[2] === 'board') {
    const b = quadro(partes[1]);
    return b ? ok(b) : falha(404, 'Pipeline nao encontrado');
  }
  if (metodo === 'POST' && partes[0] === 'pipelines' && partes[1] === 'cards' && partes[3] === 'move') {
    const achado = acharCard(partes[2]);
    if (!achado) return falha(404, 'Card nao encontrado');
    moverCard(achado.board, achado.card, corpo?.stageId ?? achado.card.stageId, corpo?.order);
    achado.card.updatedAt = agora();
    return ok(achado.card);
  }
  if (partes[0] === 'pipelines' && partes[1] === 'cards' && partes.length === 3) {
    const achado = acharCard(partes[2]);
    if (!achado) return falha(404, 'Card nao encontrado');
    if (metodo === 'PATCH') {
      Object.assign(achado.card, corpo ?? {}, { updatedAt: agora() });
      return ok(achado.card);
    }
    if (metodo === 'DELETE') {
      removerCard(achado.board, partes[2]);
      return ok({ ok: true });
    }
  }
  if (metodo === 'POST' && partes[0] === 'pipelines' && partes[2] === 'cards') {
    const b = quadro(partes[1]);
    if (!b) return falha(404, 'Pipeline nao encontrado');
    const card = {
      id: novoId('card'),
      organizationId: base.orgId,
      pipelineId: partes[1],
      stageId: corpo?.stageId ?? b.stages?.[0]?.id,
      title: corpo?.title ?? 'Novo card',
      description: corpo?.description ?? null,
      value: corpo?.value ?? null,
      currency: 'BRL',
      status: 'OPEN',
      order: 999,
      contactId: corpo?.contactId ?? null,
      contact: contatos.find((c) => c.id === corpo?.contactId) ?? null,
      conversationId: corpo?.conversationId ?? null,
      assignedToId: usuario.id,
      assignedTo: { id: usuario.id, name: usuario.name, avatarUrl: usuario.avatarUrl },
      metadata: {},
      createdAt: agora(),
      updatedAt: agora(),
    };
    if (Array.isArray(b.cards)) {
      b.cards.push(card);
    } else {
      b.cards = b.cards ?? {};
      b.cards[card.stageId] = b.cards[card.stageId] ?? [];
      b.cards[card.stageId].push(card);
    }
    return ok(card);
  }
  if (metodo === 'PUT' && partes[0] === 'pipelines' && partes[2] === 'stages') {
    const b = quadro(partes[1]);
    if (!b) return falha(404, 'Pipeline nao encontrado');
    if (Array.isArray(corpo?.stages)) {
      b.stages = corpo.stages.map((s: any, i: number) => ({
        ...s,
        id: s.id ?? novoId('stage'),
        order: i,
        pipelineId: partes[1],
      }));
    }
    return ok(b.stages);
  }
  if (metodo === 'GET' && caminho.startsWith('/pipelines/cards/by-conversation/')) {
    const conversaId = partes[3];
    for (const p of pipelines) {
      const b = quadro(p.id);
      const card = (b?.cards ?? []).find((c: any) => c.conversationId === conversaId);
      if (card) return ok(card);
    }
    return ok(null);
  }

  // ── Clinica: listas com filtro ──
  if (metodo === 'GET' && caminho === '/clinica/pacientes') {
    const lista = params.estado
      ? pacientes.filter((p) => p.estadoOperacional === params.estado)
      : pacientes;
    // A lista sai com o profissional responsavel resolvido, do mesmo jeito que
    // o detalhe do paciente ja devolve.
    return ok(
      lista.map((p) => ({
        ...p,
        profissionalResponsavel: p.profissionalResponsavelId
          ? membroPorId(p.profissionalResponsavelId)
          : null,
      })),
    );
  }
  if (metodo === 'GET' && caminho === '/clinica/agendamentos') {
    let lista = agendamentos;
    if (params.status) lista = lista.filter((a) => a.status === params.status);
    if (params.pacienteId) lista = lista.filter((a) => a.pacienteId === params.pacienteId);
    if (params.profissionalId) lista = lista.filter((a) => a.profissionalId === params.profissionalId);
    if (params.de) lista = lista.filter((a) => new Date(a.inicioEm) >= new Date(params.de));
    if (params.ate) lista = lista.filter((a) => new Date(a.inicioEm) <= new Date(params.ate));
    return ok([...lista].sort((a, b) => new Date(a.inicioEm).getTime() - new Date(b.inicioEm).getTime()));
  }
  if (metodo === 'GET' && caminho === '/clinica/procedimentos') {
    let lista = procedimentos;
    if (params.status) lista = lista.filter((p) => p.status === params.status);
    if (params.tipo) lista = lista.filter((p) => p.tipo === params.tipo);
    return ok(lista);
  }
  if (metodo === 'GET' && caminho === '/clinica/protocolos') {
    let lista = protocolos;
    if (params.status) lista = lista.filter((p) => p.status === params.status);
    if (params.pacienteId) lista = lista.filter((p) => p.pacienteId === params.pacienteId);
    return ok(lista);
  }
  // Agendamento e protocolo mudam de estado por verbo de acao, nao pelo status
  // direto. A API real traduz o verbo; aqui fazemos a mesma traducao.
  if (metodo === 'PATCH' && partes[0] === 'clinica' && partes[1] === 'agendamentos' && partes.length === 3) {
    const ag = agendamentos.find((a) => a.id === partes[2]);
    if (!ag) return falha(404, 'Agendamento nao encontrado');
    const acao = corpo?.acao;
    if (acao === 'confirmar') {
      ag.status = 'CONFIRMADO';
      ag.confirmadoEm = agora();
    } else if (acao === 'cancelar') {
      ag.status = 'CANCELADO';
      ag.canceladoEm = agora();
      ag.motivoCancelamento = corpo?.motivo ?? null;
    } else if (acao === 'no_show') {
      ag.status = 'NAO_COMPARECEU';
    } else if (acao === 'reagendar') {
      ag.status = 'REAGENDADO';
      if (corpo?.inicioEm) ag.inicioEm = corpo.inicioEm;
      if (corpo?.fimEm) ag.fimEm = corpo.fimEm;
      if (corpo?.duracaoMin) ag.duracaoMin = corpo.duracaoMin;
      if (corpo?.sala !== undefined) ag.sala = corpo.sala;
    } else {
      Object.assign(ag, corpo ?? {});
    }
    ag.updatedAt = agora();
    return ok(ag);
  }

  if (metodo === 'PATCH' && partes[0] === 'clinica' && partes[1] === 'protocolos' && partes.length === 3) {
    const prot = protocolos.find((x) => x.id === partes[2]);
    if (!prot) return falha(404, 'Protocolo nao encontrado');
    const acao = corpo?.acao;
    if (acao === 'iniciar') {
      prot.status = 'ATIVO';
      prot.iniciadoEm = prot.iniciadoEm ?? agora();
    } else if (acao === 'pausar') {
      prot.status = 'PAUSADO';
    } else if (acao === 'concluir') {
      prot.status = 'CONCLUIDO';
      prot.concluidoEm = agora();
    } else if (acao === 'cancelar') {
      prot.status = 'CANCELADO';
    } else {
      Object.assign(prot, corpo ?? {});
    }
    prot.updatedAt = agora();
    return ok(prot);
  }

  if (metodo === 'PATCH' && partes[0] === 'clinica' && partes[1] === 'procedimentos' && partes[3] === 'status') {
    const proc = procedimentos.find((p) => p.id === partes[2]);
    if (!proc) return falha(404, 'Procedimento nao encontrado');
    proc.status = corpo?.status ?? proc.status;
    proc.updatedAt = agora();
    return ok(proc);
  }

  // ── Automacoes ──
  if (metodo === 'POST' && partes[0] === 'automations' && partes[2] === 'toggle') {
    const a = automacoes.find((x) => x.id === partes[1]);
    if (!a) return falha(404, 'Automacao nao encontrada');
    // O app manda `enabled` na query; aceitamos tambem no corpo.
    if (params.enabled === 'true' || params.enabled === 'false') a.enabled = params.enabled === 'true';
    else if (typeof corpo?.enabled === 'boolean') a.enabled = corpo.enabled;
    else a.enabled = !a.enabled;
    a.updatedAt = agora();
    return ok(a);
  }
  if (metodo === 'POST' && partes[0] === 'automations' && partes[2] === 'dry-run') {
    return ok({ matched: true, actions: [], simulated: true });
  }

  // ── Notificacoes ──
  if (metodo === 'GET' && caminho === '/notifications') return ok(notificacoes);
  if (metodo === 'GET' && caminho === '/notifications/unread-count') {
    return ok({ count: notificacoes.unreadCount ?? 0 });
  }
  if (metodo === 'PATCH' && caminho === '/notifications/read-all') {
    (notificacoes.notifications ?? []).forEach((n: any) => (n.readAt = agora()));
    notificacoes.unreadCount = 0;
    return ok({ ok: true });
  }
  if (metodo === 'PATCH' && partes[0] === 'notifications' && partes[2] === 'read') {
    const n = (notificacoes.notifications ?? []).find((x: any) => x.id === partes[1]);
    if (n) n.readAt = agora();
    notificacoes.unreadCount = Math.max(0, (notificacoes.unreadCount ?? 1) - 1);
    return ok({ ok: true });
  }

  // ── Organizacao e preferencias ──
  if (metodo === 'PATCH' && caminho === '/organizations/current') {
    Object.assign(rotas['GET /organizations/current'], corpo ?? {});
    return ok(rotas['GET /organizations/current']);
  }
  if (metodo === 'PATCH' && caminho === '/users/me/preferences') {
    rotas['GET /users/me/preferences'] = {
      ...(rotas['GET /users/me/preferences'] ?? {}),
      ...(corpo ?? {}),
    };
    return ok(rotas['GET /users/me/preferences']);
  }

  // ── Canais: acoes sem efeito real ──
  if (metodo === 'POST' && partes[0] === 'channels' && partes[2] === 'test') {
    return ok({ ok: true, status: 'connected', detail: 'Conexao simulada na demonstracao.' });
  }
  if (metodo === 'POST' && partes[0] === 'channels' && partes[2] === 'sync') {
    return ok({ started: true, jobId: novoId('sync') });
  }
  if (metodo === 'GET' && partes[0] === 'channels' && partes[2] === 'sync' && partes[3] === 'status') {
    return ok({ status: 'IDLE', progress: 100 });
  }

  // ── Escritas genericas ──
  const caminhoColecao = `/${partes.slice(0, partes.length - 1).join('/')}`;

  if (metodo === 'PATCH' || metodo === 'PUT') {
    const item = acharEmQualquerColecao(partes[partes.length - 1]);
    if (item) {
      Object.assign(item, corpo ?? {}, { updatedAt: agora() });
      return ok(item);
    }
    const alvo = acharEmQualquerColecao(partes[1]);
    if (alvo) {
      Object.assign(alvo, corpo ?? {}, { updatedAt: agora() });
      return ok(alvo);
    }
    if (rotas[`GET ${caminho}`] !== undefined) {
      rotas[`GET ${caminho}`] = corpo ?? rotas[`GET ${caminho}`];
      return ok(rotas[`GET ${caminho}`]);
    }
    return ok({ ...(corpo ?? {}), updatedAt: agora() });
  }

  if (metodo === 'POST') {
    const lista = colecoes[caminho];
    if (lista) {
      const novo = {
        id: novoId('novo'),
        organizationId: base.orgId,
        ...(corpo ?? {}),
        createdAt: agora(),
        updatedAt: agora(),
      };
      lista.unshift(novo);
      return ok(novo);
    }
    return ok({ ...(corpo ?? {}), id: novoId('novo'), createdAt: agora() });
  }

  if (metodo === 'DELETE') {
    const id = partes[partes.length - 1];
    const lista = colecoes[caminhoColecao];
    if (lista) {
      const i = lista.findIndex((x: any) => x.id === id);
      if (i >= 0) lista.splice(i, 1);
      return ok({ ok: true });
    }
    return ok({ ok: true });
  }

  // ── Leitura: base gravada ──
  if (metodo === 'GET') {
    if (rotas[chaveCapturada] !== undefined) return ok(rotas[chaveCapturada]);
    // Detalhe de item que existe em alguma colecao viva.
    const item = acharEmQualquerColecao(partes[partes.length - 1]);
    if (item) return ok(item);
    // Caminho desconhecido: devolve vazio no formato mais provavel.
    return ok(partes.length <= 2 ? [] : {});
  }

  return falha(404, 'Recurso nao encontrado na demonstracao.');
}

// ─── Adaptador do axios ──────────────────────────────────────────────────────

function normalizar(config: AxiosRequestConfig): {
  caminho: string;
  params: Record<string, string>;
} {
  const bruto = config.url ?? '';
  const semBase = bruto.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api\/v1/, '');
  const [semQuery, query] = semBase.split('?');
  const params: Record<string, string> = {};
  if (query) {
    for (const [k, v] of new URLSearchParams(query).entries()) params[k] = v;
  }
  const extras = (config.params ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(extras)) {
    if (v !== undefined && v !== null && v !== '') params[k] = String(v);
  }
  const caminho = semQuery.replace(/\/+$/, '') || '/';
  return { caminho, params };
}

function corpoDe(config: AxiosRequestConfig): any {
  if (config.data === undefined || config.data === null) return undefined;
  if (typeof config.data === 'string') {
    try {
      return JSON.parse(config.data);
    } catch {
      return config.data;
    }
  }
  return config.data;
}

/** Um respiro curto para os estados de carregamento aparecerem como no real. */
function respirar(): Promise<void> {
  const ms = 90 + Math.floor(Math.random() * 160);
  return new Promise((r) => setTimeout(r, ms));
}

export const adaptadorDemo: AxiosAdapter = async (config) => {
  const { caminho, params } = normalizar(config);
  const metodo = String(config.method ?? 'get').toUpperCase();
  await respirar();

  let saida: Saida;
  try {
    saida = despachar(metodo, caminho, params, corpoDe(config));
  } catch (e) {
    saida = falha(500, (e as Error).message);
    console.error('[previa] erro em', metodo, caminho, e);
  }
  if (saida.status >= 400) {
    console.warn('[previa]', saida.status, metodo, caminho, saida.corpo?.message);
  }

  const resposta: AxiosResponse = {
    data: saida.corpo,
    status: saida.status,
    statusText: saida.status === 200 ? 'OK' : 'Error',
    headers: {},
    config: config as any,
    request: {},
  };

  if (saida.status >= 400) {
    const erro = new Error(saida.corpo?.message ?? 'Erro') as any;
    erro.isAxiosError = true;
    erro.config = config;
    erro.response = resposta;
    throw erro;
  }

  return resposta;
};
