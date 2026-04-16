import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore.js';
import axios from 'axios';  

const BACKEND_URL = 'http://localhost:3001';

function RegionRiskRow({ region }) {
  const [risk, setRisk] = useState(null);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/risk/${region}`)
      .then(res => setRisk(res.data))
      .catch(() => {});
  }, [region]);

  const getRiskBadgeStyles = () => {
    if (!risk) return 'bg-green-500/20 text-green-400 border border-green-500/30';
    switch(risk.level) {
      case 'low': return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'moderate': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      default: return 'bg-red-500/20 text-red-400 border border-red-500/30';
    }
  };

  return (
    <div className="flex justify-between items-center py-3 border-b border-white/10">
      <span className="font-semibold">📍 {region}</span>
      <div className="flex gap-2 items-center">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskBadgeStyles()}`}>
          {risk ? `${risk.score}/100 Risk` : 'Active'}
        </span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const totalPremiums = useStore(state => state.totalPremiums);
  const totalClaims = useStore(state => state.totalClaims);
  const farmerCount = useStore(state => state.farmerCount);
  const contractBalance = useStore(state => state.contractBalance);
  const poolHealth = useStore(state => state.poolHealth);
  const stakerCount = useStore(state => state.stakerCount);
  const loading = useStore(state => state.loading);

  const poolUtilization =
    Number(poolHealth.available) > 0
      ? Math.min(100, (Number(poolHealth.staked) / Number(poolHealth.available)) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-900/20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-12 px-6 text-center" id="dashboard-hero">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10"></div>
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 backdrop-blur-sm px-4 py-2 rounded-full text-emerald-400 text-sm font-medium mb-6 border border-emerald-500/20">
            🛡️ Parametric Insurance
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Protecting Farmers,<br />Powered by Blockchain
          </h2>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            KilimoKinga provides automated, transparent crop insurance for
            African smallholder farmers. Instant payouts triggered by
            real-time weather data — no paperwork, no delays.
          </p>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-6 max-w-7xl mx-auto mb-8">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-emerald-500/50 transition-all duration-300">
          <div className="text-4xl mb-3">🌾</div>
          <div className="text-gray-400 text-sm mb-1">Registered Farmers</div>
          <div className="text-2xl font-bold text-white">{farmerCount}</div>
          <div className="text-gray-500 text-xs mt-2">Active policies on-chain</div>
        </div>
        
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-emerald-500/50 transition-all duration-300">
          <div className="text-4xl mb-3">💰</div>
          <div className="text-gray-400 text-sm mb-1">Total Premiums</div>
          <div className="text-2xl font-bold text-white">{Number(totalPremiums).toFixed(4)} ETH</div>
          <div className="text-gray-500 text-xs mt-2">Collected from farmers</div>
        </div>
        
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-emerald-500/50 transition-all duration-300">
          <div className="text-4xl mb-3">📤</div>
          <div className="text-gray-400 text-sm mb-1">Total Claims Paid</div>
          <div className="text-2xl font-bold text-white">{Number(totalClaims).toFixed(4)} ETH</div>
          <div className="text-gray-500 text-xs mt-2">Auto-triggered payouts</div>
        </div>
        
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-emerald-500/50 transition-all duration-300">
          <div className="text-4xl mb-3">🏦</div>
          <div className="text-gray-400 text-sm mb-1">Contract Balance</div>
          <div className="text-2xl font-bold text-white">{Number(contractBalance).toFixed(4)} ETH</div>
          <div className="text-gray-500 text-xs mt-2">Available for claims</div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-6 max-w-7xl mx-auto mb-8">
        {/* Pool Health */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
          <div className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            📊 Insurance Pool Health
          </div>
          
          <div className="mb-4">
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(poolUtilization, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-gray-400">Staked: {Number(poolHealth.staked).toFixed(2)} USDC</span>
              <span className="text-gray-400">Available: {Number(poolHealth.available).toFixed(2)} USDC</span>
            </div>
          </div>
          
          <div className="flex gap-6">
            <div>
              <div className="text-gray-400 text-sm mb-1">Investors</div>
              <div className="text-xl font-bold text-white">{stakerCount}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-1">APY</div>
              <div className="text-xl font-bold text-emerald-400">5%</div>
            </div>
          </div>
        </div>

        {/* Supported Regions */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <div className="text-lg font-semibold text-white flex items-center gap-2">
              🗺️ Supported Regions
            </div>
            <span className="text-xs text-gray-400">AI Risk Radar</span>
          </div>
          
          <div className="space-y-1">
            {['Laikipia', 'Nakuru', 'Turkana'].map((region) => (
              <RegionRiskRow key={region} region={region} />
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 max-w-7xl mx-auto mb-8 px-6">
        <div className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          ⚡ How KilimoKinga Works
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: '📝', title: 'Register', desc: 'Choose your region and pay a small premium to activate coverage.' },
            { icon: '🌦️', title: 'Weather Monitoring', desc: 'Oracle nodes continuously monitor rainfall and temperature data.' },
            { icon: '🔔', title: 'Threshold Breach', desc: 'When drought or extreme heat is detected, a claim is triggered.' },
            { icon: '💸', title: 'Instant Payout', desc: 'Smart contract automatically sends funds — no paperwork needed.' },
          ].map((step, i) => (
            <div key={i} className="text-center p-4 rounded-xl bg-gray-900/50 hover:bg-gray-900/70 transition-all duration-300">
              <div className="text-4xl mb-3">{step.icon}</div>
              <div className="font-semibold text-white mb-1">{step.title}</div>
              <div className="text-sm text-gray-400">{step.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}