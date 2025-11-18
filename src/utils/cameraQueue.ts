// Gerenciador de fila para limitar câmeras carregando simultaneamente
class CameraQueue {
    private queue: Array<() => void> = [];
    private active = 0;
    private readonly maxConcurrent = 4; // Máximo de 4 câmeras carregando ao mesmo tempo

    async acquire(): Promise<() => void> {
        console.log(`[Queue] Solicitação de slot. Ativas: ${this.active}/${this.maxConcurrent}`);

        while (this.active >= this.maxConcurrent) {
            await new Promise(resolve => this.queue.push(resolve as () => void));
        }

        this.active++;
        console.log(`[Queue] Slot adquirido. Ativas: ${this.active}/${this.maxConcurrent}`);

        // Retorna função para liberar a posição
        return () => {
            this.active--;
            console.log(`[Queue] Slot liberado. Ativas: ${this.active}/${this.maxConcurrent}`);
            const next = this.queue.shift();
            if (next) next();
        };
    }

    getActiveCount(): number {
        return this.active;
    }
}

export const cameraQueue = new CameraQueue();
