import { useState } from 'react';
import { parseEther } from 'ethers';
import { useStore } from '../store/useStore.js';

const REGIONS = ['Laikipia', 'Nakuru', 'Turkana'];

export default function Admin() {
  const account = useStore(state => state.account);
  const contracts = useStore(state => state.contracts);
  const refresh = useStore(state => state.refreshInsuranceData);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  // Policy form (enhanced v2)
  const [policyForm, setPolicyForm] = useState({
    region: 'Laikipia',
    rainfall: '50',
    temperature: '35',
    ndvi: '5000',
    premium: '0.01',
    multiplier: '2',
    seasonDays: '90',
    partialPayout: '50',
    severeThreshold: '30',
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
      const seasonDuration = Number(policyForm.seasonDays) * 24 * 60 * 60;
      const tx = await contracts.insurance.setPolicy(
        policyForm.region,
        policyForm.rainfall,
        policyForm.temperature,
        policyForm.ndvi,
        parseEther(policyForm.premium),
        policyForm.multiplier,
        seasonDuration,
        policyForm.partialPayout,
        policyForm.severeThreshold,
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
      showToast('✅ Claim check completed — auto-payout if thresholds breached');
      refresh();
    } catch (err) {
      showToast(err.reason || 'Claim check failed', 'error');
    }
    setLoading(false);
  };

  const handleAdvanceSeason = async () => {
    if (!contracts.insurance) return;
    setLoading(true);
    try {
      const tx = await contracts.insurance.advanceSeason();
      await tx.wait();
      showToast('✅ New season started!');
      refresh();
    } catch (err) {
      showToast(err.reason || 'Failed to advance season', 'error');
    }
    setLoading(false);
  };

  const pf = (field) => (e) => setPolicyForm({ ...policyForm, [field]: e.target.value });
  const wf = (field) => (e) => setWeatherForm({ ...weatherForm, [field]: e.target.value });

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

      {/* ── Set Policy (Enhanced) ──────────────────────────────── */}
      <div className="card" id="set-policy-card">
        <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>📋 Set Regional Policy (v2)</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Region</label>
            <select value={policyForm.region} onChange={pf('region')}>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Premium (ETH)</label>
            <input type="number" step="0.001" value={policyForm.premium} onChange={pf('premium')} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Rainfall Threshold (mm)</label>
            <input type="number" value={policyForm.rainfall} onChange={pf('rainfall')} />
          </div>
          <div className="form-group">
            <label>Temperature Threshold (°C)</label>
            <input type="number" value={policyForm.temperature} onChange={pf('temperature')} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>🛰️ NDVI Threshold (0-10000)</label>
            <input type="number" value={policyForm.ndvi} onChange={pf('ndvi')} />
          </div>
          <div className="form-group">
            <label>Payout Multiplier</label>
            <input type="number" value={policyForm.multiplier} onChange={pf('multiplier')} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Season Duration (days)</label>
            <input type="number" value={policyForm.seasonDays} onChange={pf('seasonDays')} />
          </div>
          <div className="form-group">
            <label>Partial Payout %</label>
            <input type="number" value={policyForm.partialPayout} onChange={pf('partialPayout')} />
          </div>
        </div>
        <div className="form-group">
          <label>Severe Threshold % (deviation that triggers full payout)</label>
          <input type="number" value={policyForm.severeThreshold} onChange={pf('severeThreshold')} />
        </div>
        <button className="btn btn-primary" onClick={handleSetPolicy} disabled={loading} id="set-policy-btn">
          {loading ? <span className="spinner" /> : '💾'} Save Policy
        </button>
      </div>

      <div className="two-col">
        {/* ── Set Weather Data ─────────────────────────────────── */}
        <div className="card" id="set-weather-card">
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>🌦️ Set Weather Data (Mock Oracle)</h3>
          <div className="form-group">
            <label>Region</label>
            <select value={weatherForm.region} onChange={wf('region')}>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Rainfall (mm)</label>
              <input type="number" value={weatherForm.rainfall} onChange={wf('rainfall')} />
            </div>
            <div className="form-group">
              <label>Temperature (°C)</label>
              <input type="number" value={weatherForm.temperature} onChange={wf('temperature')} />
            </div>
          </div>
          <div className="form-group">
            <label>🛰️ NDVI (0–10000)</label>
            <input type="number" value={weatherForm.ndvi} onChange={wf('ndvi')} />
          </div>
          <button className="btn btn-primary" onClick={handleSetWeather} disabled={loading} id="set-weather-btn">
            {loading ? <span className="spinner" /> : '🌧️'} Update Weather
          </button>
        </div>

        {/* ── Trigger Claim Check + Season ─────────────────────── */}
        <div className="card" id="trigger-claim-card">
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>🔔 Check & Pay Claim</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Enter a farmer's address to check weather vs thresholds. Moderate events pay <strong>partial</strong> (50%), severe events pay <strong>full</strong> coverage.
          </p>
          <div className="form-group">
            <label>Farmer Address</label>
            <input type="text" placeholder="0x..." value={claimAddress} onChange={(e) => setClaimAddress(e.target.value)} id="claim-address-input" />
          </div>
          <button className="btn btn-primary" onClick={handleCheckClaim} disabled={loading || !claimAddress} id="check-claim-btn" style={{ marginBottom: '1rem' }}>
            {loading ? <span className="spinner" /> : '⚡'} Check & Pay Claim
          </button>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-glass)', margin: '1rem 0' }} />

          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>🔄 Season Management</h4>
          <button className="btn btn-secondary btn-full" onClick={handleAdvanceSeason} disabled={loading} id="advance-season-btn">
            📅 Advance to Next Season
          </button>

          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--accent-blue-dim)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--accent-blue)' }}>
            ℹ️ Claims now use tiered payouts + NDVI satellite data. Farmers earn loyalty for each completed season.
          </div>
        </div>
      </div>

      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </>
  );
}
