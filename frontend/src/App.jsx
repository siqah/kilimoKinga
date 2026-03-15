import { useState } from 'react';
import { Web3Provider, useWeb3 } from './Web3Provider.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Register from './pages/Register.jsx';
import Stake from './pages/Stake.jsx';
import Admin from './pages/Admin.jsx';
import Insights from './pages/Insights.jsx';

const TABS = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'register', label: '🌾 Register' },
  { id: 'insights', label: '🧠 AI Insights' },
  { id: 'stake', label: '💰 Stake' },
  { id: 'admin', label: '⚙️ Admin' },
];

function AppInner() {
  const { account, connect } = useWeb3();
  const [activeTab, setActiveTab] = useState('dashboard');

  const shortAddr = account
    ? `${account.slice(0, 6)}…${account.slice(-4)}`
    : null;

  return (
    <div className="app-wrapper">
      <div className="bg-mesh"></div>
      <div className="app">
        {/* ── Navbar ─────────────────────────────────────────────── */}
        <nav className="navbar">
          <a href="/" className="navbar-brand" onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }}>
            <span className="logo">🌱</span>
            <h1>KilimoKinga</h1>
          </a>

          <div className="navbar-links">
            {TABS.map((t) => (
              <a
                key={t.id}
                href="#"
                className={activeTab === t.id ? 'active' : ''}
                onClick={(e) => { e.preventDefault(); setActiveTab(t.id); }}
              >
                {t.label}
              </a>
            ))}
          </div>

          {!account ? (
            <button className="wallet-btn" onClick={connect} id="connect-wallet-btn">
              🔗 Connect Wallet
            </button>
          ) : (
            <button className="wallet-btn connected" id="wallet-status-btn">
              <span className="dot" />
              {shortAddr}
            </button>
          )}
        </nav>

        <main className="main-content">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'register' && <Register />}
          {activeTab === 'insights' && <Insights />}
          {activeTab === 'stake' && <Stake />}
          {activeTab === 'admin' && <Admin />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Web3Provider>
      <AppInner />
    </Web3Provider>
  );
}
