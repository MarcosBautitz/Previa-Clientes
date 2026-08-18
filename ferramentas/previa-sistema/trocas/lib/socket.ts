/**
 * Tempo real da PREVIA estatica.
 *
 * Nao existe servidor para conectar, entao o socket vira um objeto inerte com
 * a mesma superficie usada pelo app (on, off, emit, connect, disconnect). Os
 * componentes registram seus ouvintes normalmente e nada acontece, em vez de
 * ficarem tentando reconectar para sempre.
 */

type Ouvinte = (...args: unknown[]) => void;

interface SocketInerte {
  connected: boolean;
  id: string;
  on: (evento: string, ouvinte: Ouvinte) => SocketInerte;
  once: (evento: string, ouvinte: Ouvinte) => SocketInerte;
  off: (evento?: string, ouvinte?: Ouvinte) => SocketInerte;
  emit: (evento: string, ...args: unknown[]) => SocketInerte;
  connect: () => SocketInerte;
  disconnect: () => SocketInerte;
  removeAllListeners: () => SocketInerte;
}

let socket: SocketInerte | null = null;

function criar(): SocketInerte {
  const inerte: SocketInerte = {
    connected: false,
    id: 'previa',
    on: () => inerte,
    once: () => inerte,
    off: () => inerte,
    emit: () => inerte,
    connect: () => inerte,
    disconnect: () => inerte,
    removeAllListeners: () => inerte,
  };
  return inerte;
}

export function getSocket(): SocketInerte {
  if (!socket) socket = criar();
  return socket;
}

export function disconnectSocket(): void {
  socket = null;
}
