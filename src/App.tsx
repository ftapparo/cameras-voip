import { CallHistoryProvider } from './contexts/CallHistoryContext';
import Home from './pages/Home/Home';

function App() {
  return (
    <CallHistoryProvider>
      <Home />
    </CallHistoryProvider>
  );
}

export default App;
