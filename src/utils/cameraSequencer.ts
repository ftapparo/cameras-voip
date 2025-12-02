// Sistema de controle sequencial para snapshot de câmeras
// Garante que apenas uma câmera faz requisição por vez com delay obrigatório

export interface SequencedCamera {
    id: string;
    snapshotUrl: string;
    onUpdate: (imageUrl: string) => void;
    onError: (error: string) => void;
}

export class CameraSequencer {
    private cameras: Map<string, SequencedCamera> = new Map();
    private sequence: string[] = [];
    private currentIndex = 0;
    private isRunning = false;
    private intervalId: number | null = null;
    private readonly DELAY_MS = 200; // Delay obrigatório entre câmeras

    // Registra uma câmera no sequenciador
    registerCamera(camera: SequencedCamera): void {
        this.cameras.set(camera.id, camera);
        this.sequence.push(camera.id);
        console.log(`[CameraSequencer] Câmera ${camera.id} registrada. Total: ${this.cameras.size}`);
    }

    // Remove uma câmera do sequenciador
    unregisterCamera(cameraId: string): void {
        this.cameras.delete(cameraId);
        this.sequence = this.sequence.filter(id => id !== cameraId);
        console.log(`[CameraSequencer] Câmera ${cameraId} removida. Total: ${this.cameras.size}`);
        
        // Ajusta o índice se necessário
        if (this.currentIndex >= this.sequence.length) {
            this.currentIndex = 0;
        }
    }

    // Inicia o sequenciamento
    start(): void {
        if (this.isRunning || this.sequence.length === 0) {
            return;
        }

        this.isRunning = true;
        this.currentIndex = 0;
        console.log(`[CameraSequencer] Iniciando sequenciamento com ${this.sequence.length} câmeras`);
        
        this.processNextCamera();
    }

    // Para o sequenciamento
    stop(): void {
        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('[CameraSequencer] Sequenciamento parado');
    }

    // Processa a próxima câmera na sequência
    private async processNextCamera(): Promise<void> {
        if (!this.isRunning || this.sequence.length === 0) {
            return;
        }

        const cameraId = this.sequence[this.currentIndex];
        const camera = this.cameras.get(cameraId);

        if (camera) {
            await this.fetchSnapshot(camera);
        }

        // Move para próxima câmera (circular)
        this.currentIndex = (this.currentIndex + 1) % this.sequence.length;

        // Agenda próxima execução com delay obrigatório
        this.intervalId = setTimeout(() => {
            this.processNextCamera();
        }, this.DELAY_MS) as unknown as number;
    }

    // Faz a requisição do snapshot para uma câmera
    private async fetchSnapshot(camera: SequencedCamera): Promise<void> {
        const startTime = Date.now();
        
        try {
            console.log(`[CameraSequencer] Fetching câmera ${camera.id}`);
            
            // Adiciona timestamp único para evitar cache
            const url = `${camera.snapshotUrl}?_t=${Date.now()}&_r=${Math.random()}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(url, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                // Cria blob URL para a imagem
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);
                
                camera.onUpdate(imageUrl);
                
                const duration = Date.now() - startTime;
                console.log(`[CameraSequencer] ✅ Câmera ${camera.id} atualizada em ${duration}ms`);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            
            console.error(`[CameraSequencer] ❌ Erro na câmera ${camera.id} após ${duration}ms:`, errorMessage);
            camera.onError(errorMessage);
        }
    }

    // Obtém estatísticas do sequenciador
    getStats() {
        return {
            totalCameras: this.cameras.size,
            currentIndex: this.currentIndex,
            currentCamera: this.sequence[this.currentIndex],
            isRunning: this.isRunning,
            delayMs: this.DELAY_MS
        };
    }
}

// Instância global do sequenciador
export const globalCameraSequencer = new CameraSequencer();