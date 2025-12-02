export interface CameraConfig {
  id: string;
  name: string;
  url: string;
  snapshotUrl: string;
  extension?: string;
  hasVoip: boolean;
  description: string;
  ip?: string;
}

const PROXY_BASE_URL = 'http://localhost:3001';

// Cache das câmeras
let camerasCache: CameraConfig[] | null = null;

// Função para buscar câmeras do servidor proxy
export async function fetchCamerasFromProxy(): Promise<CameraConfig[]> {
  try {
    const response = await fetch(`${PROXY_BASE_URL}/cameras`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const cameraData = await response.json();
    
    const cameras: CameraConfig[] = cameraData.map((camera: any) => ({
      id: camera.id,
      name: camera.nome,
      url: `${PROXY_BASE_URL}${camera.url}`,
      snapshotUrl: `${PROXY_BASE_URL}${camera.snapshotUrl}`,
      extension: camera.ramal || undefined,
      hasVoip: camera.hasVoip,
      description: camera.descricao,
      ip: camera.ip
    }));
    
    // Atualiza o cache
    camerasCache = cameras;
    console.log(`✅ ${cameras.length} câmeras carregadas do servidor proxy`);
    
    return cameras;
  } catch (error) {
    console.error('❌ Erro ao buscar câmeras do servidor proxy:', error);
    
    // Retorna cache se houver erro, senão retorna configuração estática
    if (camerasCache) {
      console.warn('⚠️  Usando cache de câmeras devido ao erro');
      return camerasCache;
    }
    
    console.warn('⚠️  Usando configuração estática de câmeras');
    return getStaticCameras();
  }
}

// Função para obter câmeras (usa cache se disponível)
export async function getCameras(): Promise<CameraConfig[]> {
  if (camerasCache) {
    return camerasCache;
  }
  
  return await fetchCamerasFromProxy();
}

// Função para buscar câmera por ramal
export async function findCameraByExtension(extension: string): Promise<CameraConfig | undefined> {
  const cameras = await getCameras();
  return cameras.find(camera => camera.extension === extension);
}

// Função para recarregar configuração
export async function reloadCameraConfig(): Promise<void> {
  try {
    const response = await fetch(`${PROXY_BASE_URL}/reload-config`, { method: 'POST' });
    if (response.ok) {
      camerasCache = null; // Limpa o cache
      await fetchCamerasFromProxy(); // Recarrega
      console.log('✅ Configuração de câmeras recarregada');
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('❌ Erro ao recarregar configuração das câmeras:', error);
  }
}

// Configuração estática de fallback (caso o servidor proxy não esteja disponível)
function getStaticCameras(): CameraConfig[] {
  return [
    {
      id: 'cam1',
      name: 'Entrada Portaria Principal',
      url: 'http://192.168.0.103/cgi-bin/video.cgi',
      hasVoip: false,
      description: 'Entrada portaria principal (sem ramal)',
      ip: '192.168.0.103'
    },
    {
      id: 'cam3',
      name: 'Entrada Veículos',
      url: 'http://192.168.0.110/cgi-bin/video.cgi',
      extension: '9013',
      hasVoip: true,
      description: 'Entrada veículos (ramal 9013)',
      ip: '192.168.0.110'
    },
    {
      id: 'cam5',
      name: 'Portaria Serviço Externa',
      url: 'http://192.168.0.106/cgi-bin/video.cgi',
      extension: '9021',
      hasVoip: true,
      description: 'Portaria serviço externa (ramal 9021)',
      ip: '192.168.0.106'
    }
  ];
}

// Compatibilidade com código existente
export const cameras: CameraConfig[] = [];

// Função de compatibilidade síncrona (deprecated)
export const findCameraByExtensionSync = (extension: string): CameraConfig | undefined => {
  if (camerasCache) {
    return camerasCache.find(camera => camera.extension === extension);
  }
  return getStaticCameras().find(camera => camera.extension === extension);
};

export default cameras;