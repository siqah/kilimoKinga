import { useState } from 'react';
import { Web3Provider, useWeb3 } from './Web3Provider.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Register from './pages/Register.jsx';
import Stake from './pages/Stake.jsx';
import Admin from './pages/Admin.jsx';
import Insights from './pages/Insights.jsx';
import { useStore } from './store/useStore.js';

function AppInner() {
  const account = useStore(state => state.account);
  const connect = useStore(state => state.connectWallet);
  const farmerDetails = useStore(state => state.farmerDetails);
  const stakerCount = useStore(state => state.stakerCount);
  const poolHealth = useStore(state => state.poolHealth);
  const [activeTab, setActiveTab] = useState('dashboard');

  const shortAddr = account
    ? `${account.slice(0, 6)}…${account.slice(-4)}`
    : null;

  // Determine user roles
  const isRegistered = farmerDetails?.active;
  const hasStaked = Number(poolHealth?.staked || 0) > 0 && account; // Simplification: in reality, check if *this exact user* has staked.
  
  // Decide which tabs to show
  const availableTabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'register', label: '🌾 Register' },
    ...(isRegistered ? [{ id: 'insights', label: '🧠 AI Insights' }] : []),
    { id: 'stake', label: '💰 Stake' },
    { id: 'admin', label: '⚙️ Admin' },
  ];

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
            {availableTabs.map((t) => (
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
          {activeTab === 'insights' && isRegistered && <Insights />}
          {activeTab === 'stake' && <Stake />}
          {activeTab === 'admin' && <Admin />}
          
          {/* Fallback if somehow on Insights but not registered */}
          {activeTab === 'insights' && !isRegistered && (
            <div className="empty-state">
              <div className="empty-icon">🔒</div>
              <h2 style={{ marginBottom: '1rem' }}>Premium Insights Locked</h2>
              <p style={{ marginBottom: '2rem' }}>You must be a registered farmer to access AI weather forecasts and yield predictions.</p>
              <button className="btn btn-primary" onClick={() => setActiveTab('register')}>
                Register Now
              </button>
            </div>
          )}
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
