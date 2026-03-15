import { useState } from 'react';
import { parseEther } from 'ethers';
import { useWeb3, useInsuranceData } from '../Web3Provider.jsx';

const REGIONS = ['Laikipia', 'Nakuru', 'Turkana'];

export default function Admin() {
  const { account, contracts } = useWeb3();
  const { refresh } = useInsuranceData();
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  // Policy form
  const [policyForm, setPolicyForm] = useState({
    region: 'Laikipia',
    rainfall: '50',
    temperature: '35',
    premium: '0.01',
    multiplier: '2',
  });

  // Weather form
  const [weatherForm, setWeatherForm] = useState({
    region: 'Laikipia',
    rainfall: '80',
    temperature: '28',
    ndvi: '7000',
  });

  // Claim form
  const [claimAddress, setClaimAddress] = useState('');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSetPolicy = async () => {
    if (!contracts.insurance) return;
    setLoading(true);
    try {
      const tx = await contracts.insurance.setPolicy(
        policyForm.region,
        policyForm.rainfall,
        policyForm.temperature,
        parseEther(policyForm.premium),
        policyForm.multiplier,
      );
      await tx.wait();
      showToast(`✅ Policy updated for ${policyForm.region}`);
      refresh();
    } catch (err) {
      showToast(err.reason || 'Failed to set policy', 'error');
    }
    setLoading(false);
  };

  const handleSetWeather = async () => {
    if (!contracts.oracle) return;
    setLoading(true);
    try {
      const tx = await contracts.oracle.setWeatherData(
        weatherForm.region,
        weatherForm.rainfall,
        weatherForm.temperature,
        weatherForm.ndvi,
      );
      await tx.wait();
      showToast(`✅ Weather data set for ${weatherForm.region}`);
    } catch (err) {
      showToast(err.reason || 'Failed to set weather', 'error');
    }
    setLoading(false);
  };

  const handleCheckClaim = async () => {
    if (!contracts.insurance || !claimAddress) return;
    setLoading(true);
    try {
      const tx = await contracts.insurance.checkAndPayClaim(claimAddress);
      await tx.wait();
      showToast('✅ Claim check completed');
      refresh();
    } catch (err) {
      showToast(err.reason || 'Claim check failed', 'error');
    }
    setLoading(false);
  };

  if (!account) {
    return (
      <div className="card" style={{ maxWidth: 500, margin: '3rem auto' }}>
        <div className="empty-state">
          <div className="empty-icon">🔐</div>
          <p>Connect your wallet to access the admin panel</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="section-title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
        ⚙️ Admin Panel
      </div>

      {/* ── Set Policy ────────────────────────────────────────── */}
      <div className="card" id="set-policy-card">
        <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>📋 Set Regional Policy</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Region</label>
            <select
              value={policyForm.region}
              onChange={(e) => setPolicyForm({ ...policyForm, region: e.target.value })}
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Premium (ETH)</label>
            <input
              type="number"
              step="0.001"
              value={policyForm.premium}
              onChange={(e) => setPolicyForm({ ...policyForm, premium: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Rainfall Threshold (mm)</label>
            <input
              type="number"
              value={policyForm.rainfall}
              onChange={(e) => setPolicyForm({ ...policyForm, rainfall: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Temperature Threshold (°C)</label>
            <input
              type="number"
              value={policyForm.temperature}
              onChange={(e) => setPolicyForm({ ...policyForm, temperature: e.target.value })}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Payout Multiplier</label>
          <input
            type="number"
            value={policyForm.multiplier}
            onChange={(e) => setPolicyForm({ ...policyForm, multiplier: e.target.value })}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSetPolicy}
          disabled={loading}
          id="set-policy-btn"
        >
          {loading ? <span className="spinner" /> : '💾'} Save Policy
        </button>
      </div>

      <div className="two-col">
        {/* ── Set Weather Data ─────────────────────────────────── */}
        <div className="card" id="set-weather-card">
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>🌦️ Set Weather Data (Mock Oracle)</h3>
          <div className="form-group">
            <label>Region</label>
            <select
              value={weatherForm.region}
              onChange={(e) => setWeatherForm({ ...weatherForm, region: e.target.value })}
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Rainfall (mm)</label>
              <input
                type="number"
                value={weatherForm.rainfall}
                onChange={(e) => setWeatherForm({ ...weatherForm, rainfall: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Temperature (°C)</label>
              <input
                type="number"
                value={weatherForm.temperature}
                onChange={(e) => setWeatherForm({ ...weatherForm, temperature: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group">
            <label>NDVI (0–10000)</label>
            <input
              type="number"
              value={weatherForm.ndvi}
              onChange={(e) => setWeatherForm({ ...weatherForm, ndvi: e.target.value })}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSetWeather}
            disabled={loading}
            id="set-weather-btn"
          >
            {loading ? <span className="spinner" /> : '🌧️'} Update Weather
          </button>
        </div>

        {/* ── Trigger Claim Check ──────────────────────────────── */}
        <div className="card" id="trigger-claim-card">
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>🔔 Check & Pay Claim</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Enter a farmer's wallet address to check their region's weather against
            the policy thresholds. If conditions are met, the payout is sent automatically.
          </p>
          <div className="form-group">
            <label>Farmer Address</label>
            <input
              type="text"
              placeholder="0x..."
              value={claimAddress}
              onChange={(e) => setClaimAddress(e.target.value)}
              id="claim-address-input"
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleCheckClaim}
            disabled={loading || !claimAddress}
            id="check-claim-btn"
          >
            {loading ? <span className="spinner" /> : '⚡'} Check & Pay Claim
          </button>

          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'var(--accent-amber-dim)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              color: 'var(--accent-amber)',
            }}
          >
            ⚠️ Only the contract admin can trigger claim checks. This queries the weather oracle and auto-pays if thresholds are breached.
          </div>
        </div>
      </div>

      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </>
  );
}
