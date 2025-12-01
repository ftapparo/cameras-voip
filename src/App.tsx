import { VoipCameraProvider } from './contexts/VoipCameraContext';
import { CallHistoryProvider } from './contexts/CallHistoryContext';
import Home from './pages/Home/Home';

function App() {
  return (
    <CallHistoryProvider>
      <VoipCameraProvider>
        <Home />
      </VoipCameraProvider>
    </CallHistoryProvider>
  );
}

export default App;
