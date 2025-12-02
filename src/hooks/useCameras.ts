import { useState, useEffect } from 'react';
import type { CameraConfig } from '../config/cameras';
import { fetchCamerasFromProxy, reloadCameraConfig } from '../config/cameras';

export function useCameras() {
  const [cameras, setCameras] = useState<CameraConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCameras = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const cameraData = await fetchCamerasFromProxy();
      setCameras(cameraData);
      
      console.log(`✅ ${cameraData.length} câmeras carregadas para o hook`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('❌ Erro ao carregar câmeras no hook:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCameras();
  }, []);

  const reloadCameras = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await reloadCameraConfig();
      await loadCameras();
      
      console.log('✅ Câmeras recarregadas com sucesso');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao recarregar câmeras';
      setError(errorMessage);
      console.error('❌ Erro ao recarregar câmeras:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const findCameraByExtension = (extension: string): CameraConfig | undefined => {
    return cameras.find(camera => camera.extension === extension);
  };

  const findCameraById = (id: string): CameraConfig | undefined => {
    return cameras.find(camera => camera.id === id);
  };

  const getCamerasWithVoip = (): CameraConfig[] => {
    return cameras.filter(camera => camera.hasVoip);
  };

  const getCamerasWithoutVoip = (): CameraConfig[] => {
    return cameras.filter(camera => !camera.hasVoip);
  };

  return {
    cameras,
    loading,
    error,
    reloadCameras,
    findCameraByExtension,
    findCameraById,
    getCamerasWithVoip,
    getCamerasWithoutVoip,
    // Stats
    totalCameras: cameras.length,
    voipCameras: cameras.filter(c => c.hasVoip).length,
    staticCameras: cameras.filter(c => !c.hasVoip).length
  };
}