import { VoipTest } from "./VoipTest";
import "./App.css";

function App() {
  return (
    <div className="app-root">
      <h1>POC Portaria – VoIP + CFTV</h1>

      <div className="cards">
        <div className="card">
          <h2>Teste VoIP (SIP)</h2>
          <VoipTest />
        </div>
      </div>
    </div>
  );
}

export default App;
