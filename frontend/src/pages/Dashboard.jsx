import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore.js';

const BACKEND_URL = 'http://localhost:3001';

function RegionRiskRow({ region }) {
  const [risk, setRisk] = useState(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/risk/${region}`)
      .then(res => res.json())
      .then(data => setRisk(data))
      .catch(() => {});
  }, [region]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 0',
        borderBottom: '1px solid var(--border-glass)',
      }}
    >
      <span style={{ fontWeight: 600 }}>📍 {region}</span>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {risk ? (
          <span className={`badge badge-${risk.level === 'low' ? 'success' : risk.level === 'moderate' ? 'warning' : 'danger'}`}>
            {risk.score}/100 Risk
          </span>
        ) : (
          <span className="badge badge-success">Active</span>
        )}
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
    <>
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="hero" id="dashboard-hero">
        <div className="hero-badge">🛡️ Parametric Insurance</div>
        <h2>Protecting Farmers,<br />Powered by Blockchain</h2>
        <p>
          KilimoKinga provides automated, transparent crop insurance for
          African smallholder farmers. Instant payouts triggered by
          real-time weather data — no paperwork, no delays.
        </p>
      </section>

      {/* ── Stats ─────────────────────────────────────────────── */}
      <div className="stats-grid" id="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green">🌾</div>
          <div className="stat-label">Registered Farmers</div>
          <div className="stat-value">{farmerCount}</div>
          <div className="stat-sub">Active policies on-chain</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">💰</div>
          <div className="stat-label">Total Premiums</div>
          <div className="stat-value">{Number(totalPremiums).toFixed(4)} ETH</div>
          <div className="stat-sub">Collected from farmers</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">📤</div>
          <div className="stat-label">Total Claims Paid</div>
          <div className="stat-value">{Number(totalClaims).toFixed(4)} ETH</div>
          <div className="stat-sub">Auto-triggered payouts</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">🏦</div>
          <div className="stat-label">Contract Balance</div>
          <div className="stat-value">{Number(contractBalance).toFixed(4)} ETH</div>
          <div className="stat-sub">Available for claims</div>
        </div>
      </div>

      {/* ── Pool + Regions ────────────────────────────────────── */}
      <div className="two-col">
        {/* Pool Health */}
        <div className="card" id="pool-health-card">
          <div className="section-title">📊 Insurance Pool Health</div>
          <div className="pool-bar-wrap">
            <div className="pool-bar">
              <div
                className="pool-bar-fill"
                style={{ width: `${Math.min(poolUtilization, 100)}%` }}
              />
            </div>
            <div className="pool-bar-labels">
              <span>Staked: {Number(poolHealth.staked).toFixed(2)} USDC</span>
              <span>Available: {Number(poolHealth.available).toFixed(2)} USDC</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <div className="stat-label">Investors</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{stakerCount}</div>
            </div>
            <div>
              <div className="stat-label">APY</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-green)' }}>5%</div>
            </div>
          </div>
        </div>

        {/* Supported Regions with AI Risk */}
        <div className="card" id="regions-card">
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🗺️ Supported Regions</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>AI Risk Radar</span>
          </div>
          <div className="weather-grid" style={{ gridTemplateColumns: '1fr' }}>
            {['Laikipia', 'Nakuru', 'Turkana'].map((region) => (
              <RegionRiskRow key={region} region={region} />
            ))}
          </div>
        </div>
      </div>

      {/* ── How It Works ──────────────────────────────────────── */}
      <div className="card" id="how-it-works">
        <div className="section-title">⚡ How KilimoKinga Works</div>
        <div className="stats-grid" style={{ marginBottom: 0 }}>
          {[
            { icon: '📝', title: 'Register', desc: 'Choose your region and pay a small premium to activate coverage.' },
            { icon: '🌦️', title: 'Weather Monitoring', desc: 'Oracle nodes continuously monitor rainfall and temperature data.' },
            { icon: '🔔', title: 'Threshold Breach', desc: 'When drought or extreme heat is detected, a claim is triggered.' },
            { icon: '💸', title: 'Instant Payout', desc: 'Smart contract automatically sends funds — no paperwork needed.' },
          ].map((step, i) => (
            <div key={i} className="stat-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{step.icon}</div>
              <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>{step.title}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
