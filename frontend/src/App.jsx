import { useState } from 'react';
import { Web3Provider } from './Web3Provider.jsx';
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
    <div className="relative min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden font-sans selection:bg-emerald-500/30">
      
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-600/10 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-600/10 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s' }}></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        
        <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 shadow-sm">
          <a 
            href="/" 
            className="flex items-center gap-3 text-white no-underline group" 
            onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }}
          >
            <span className="text-3xl transition-transform group-hover:scale-110">🌱</span>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-emerald-500">
              KilimoKinga
            </h1>
          </a>

          <div className="hidden md:flex items-center gap-1">
            {availableTabs.map((t) => (
              <a
                key={t.id}
                href="#"
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeTab === t.id 
                    ? 'bg-emerald-500/15 text-emerald-400' 
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                }`}
                onClick={(e) => { e.preventDefault(); setActiveTab(t.id); }}
              >
                {t.label}
              </a>
            ))}
          </div>

          {!account ? (
            <button 
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold text-sm transition-all duration-300 hover:bg-emerald-500/20 hover:shadow-[0_0_20px_rgba(34,197,94,0.15)] hover:-translate-y-0.5" 
              onClick={connect} 
              id="connect-wallet-btn"
            >
              🔗 Connect Wallet
            </button>
          ) : (
            <button 
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 bg-white/5 text-slate-100 font-semibold text-sm transition-all duration-300 hover:bg-white/10" 
              id="wallet-status-btn"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              {shortAddr}
            </button>
          )}
        </nav>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 md:px-8">
          
          <div className="md:hidden flex overflow-x-auto gap-2 pb-4 mb-4 scrollbar-hide snap-x">
             {availableTabs.map((t) => (
              <button
                key={t.id}
                className={`flex-shrink-0 snap-center px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === t.id 
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                    : 'text-slate-400 bg-white/5 border border-white/5'
                }`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'register' && <Register />}
            {activeTab === 'insights' && isRegistered && <Insights />}
            {activeTab === 'stake' && <Stake />}
            {activeTab === 'admin' && <Admin />}
            
            {/* Fallback if somehow on Insights but not registered */}
            {activeTab === 'insights' && !isRegistered && (
              <div className="flex flex-col items-center justify-center p-12 mt-12 text-center bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-3xl">
                <div className="text-6xl mb-6 opacity-50">🔒</div>
                <h2 className="text-2xl font-bold text-slate-200 mb-3">Premium Insights Locked</h2>
                <p className="text-slate-400 max-w-md mb-8 leading-relaxed">
                  You must be a registered farmer to access AI weather forecasts and yield predictions.
                </p>
                <button 
                  className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-full font-bold shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95" 
                  onClick={() => setActiveTab('register')}
                >
                  Register Now
                </button>
              </div>
            )}
          </div>
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
