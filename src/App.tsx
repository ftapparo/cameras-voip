import { VoipCameraProvider } from './contexts/VoipCameraContext';
import Home from './pages/Home/Home';

function App() {
  return (
    <VoipCameraProvider>
      <Home />
    </VoipCameraProvider>
  );
}

export default App;
