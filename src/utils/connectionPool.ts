// Pool de conexões para limitar o número de streams MJPEG simultâneos
class ConnectionPool {
  private maxConnections: number;
  private activeConnections: Map<string, number> = new Map(); // URL -> timestamp
  private waitingQueue: Array<{ url: string; resolve: Function; reject: Function }> = [];

  constructor(maxConnections: number = 6) {
    this.maxConnections = maxConnections;
  }

  async requestConnection(url: string): Promise<void> {
    // Se a URL já está ativa, apenas atualiza o timestamp
    if (this.activeConnections.has(url)) {
      this.activeConnections.set(url, Date.now());
      console.log(`[ConnectionPool] Conexão renovada para ${url}`);
      return Promise.resolve();
    }

    if (this.activeConnections.size < this.maxConnections) {
      this.activeConnections.set(url, Date.now());
      console.log(`[ConnectionPool] Conexão ativa para ${url}. Total: ${this.activeConnections.size}/${this.maxConnections}`);
      return Promise.resolve();
    }

    // Se não há slots disponíveis, libera a conexão mais antiga
    const oldestEntry = Array.from(this.activeConnections.entries())
      .sort((a, b) => a[1] - b[1])[0]; // Ordena por timestamp (mais antigo primeiro)
    
    if (oldestEntry) {
      this.activeConnections.delete(oldestEntry[0]);
      console.log(`[ConnectionPool] Liberando conexão antiga: ${oldestEntry[0]} para dar lugar a ${url}`);
      
      // Adiciona a nova conexão
      this.activeConnections.set(url, Date.now());
      console.log(`[ConnectionPool] Conexão ativa para ${url}. Total: ${this.activeConnections.size}/${this.maxConnections}`);
      return Promise.resolve();
    }

    // Fallback: adiciona à fila (não deveria acontecer com a lógica acima)
    return new Promise((resolve, reject) => {
      this.waitingQueue.push({ url, resolve, reject });
      console.log(`[ConnectionPool] ${url} adicionado à fila. Posição: ${this.waitingQueue.length}`);
    });
  }

  releaseConnection(url: string): void {
    if (this.activeConnections.has(url)) {
      this.activeConnections.delete(url);
      console.log(`[ConnectionPool] Conexão liberada para ${url}. Total: ${this.activeConnections.size}/${this.maxConnections}`);

      // Processa próximo da fila
      if (this.waitingQueue.length > 0) {
        const next = this.waitingQueue.shift()!;
        this.activeConnections.set(next.url, Date.now());
        console.log(`[ConnectionPool] Próximo da fila: ${next.url}`);
        next.resolve();
      }
    }
  }

  // Libera uma conexão aleatória para dar espaço para novas
  forceReleaseOldConnection(): string | null {
    if (this.activeConnections.size > 0) {
      const connections = Array.from(this.activeConnections.keys());
      const oldestConnection = connections[0]; // Primeira conexão (mais antiga)
      this.activeConnections.delete(oldestConnection);
      console.log(`[ConnectionPool] Conexão forçadamente liberada: ${oldestConnection}. Total: ${this.activeConnections.size}/${this.maxConnections}`);
      return oldestConnection;
    }
    return null;
  }

  getStats(): { active: number; waiting: number; max: number; activeUrls: string[] } {
    return {
      active: this.activeConnections.size,
      waiting: this.waitingQueue.length,
      max: this.maxConnections,
      activeUrls: Array.from(this.activeConnections.keys())
    };
  }
}
}

// Instância singleton
export const connectionPool = new ConnectionPool(6);