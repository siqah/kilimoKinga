import { useState } from 'react';
import { parseEther, formatEther } from 'ethers';
import { useWeb3, useInsuranceData } from '../Web3Provider.jsx';

const REGIONS = ['Laikipia', 'Nakuru', 'Turkana'];

export default function Register() {
  const { account, contracts } = useWeb3();
  const { farmerDetails, refresh } = useInsuranceData();
  const [region, setRegion] = useState(REGIONS[0]);
  const [policyInfo, setPolicyInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchPolicy = async (r) => {
    if (!contracts.insurance) return;
    try {
      const p = await contracts.insurance.regionalPolicies(r);
      setPolicyInfo({
        rainfall: Number(p.rainfallThreshold),
        temperature: Number(p.temperatureThreshold),
        premium: formatEther(p.premiumAmount),
        multiplier: Number(p.payoutMultiplier),
      });
    } catch (e) {
      setPolicyInfo(null);
    }
  };

  const handleRegionChange = (e) => {
    const r = e.target.value;
    setRegion(r);
    fetchPolicy(r);
  };

  // Fetch policy on mount
  useState(() => { fetchPolicy(region); });

  const handleRegister = async () => {
    if (!contracts.insurance || !policyInfo) return;
    setLoading(true);
    try {
      const tx = await contracts.insurance.register(region, {
        value: parseEther(policyInfo.premium),
      });
      showToast('⏳ Transaction submitted…');
      await tx.wait();
      showToast('✅ Successfully registered!');
      refresh();
    } catch (err) {
      console.error(err);
      showToast(err.reason || err.message || 'Registration failed', 'error');
    }
    setLoading(false);
  };

  return (
    <>
      <div className="section-title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
        🌾 Farmer Registration
      </div>

      <div className="two-col">
        {/* ── Registration Form ────────────────────────────────── */}
        <div className="card" id="register-form-card">
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>Register for Coverage</h3>

          {!account ? (
            <div className="empty-state">
              <div className="empty-icon">🔗</div>
              <p>Connect your wallet to register</p>
            </div>
          ) : farmerDetails ? (
            <div>
              <div className="badge badge-success" style={{ marginBottom: '1rem' }}>
                ✅ Already Registered
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Region: </span>
                <strong>{farmerDetails.region}</strong>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Premium Paid: </span>
                <strong>{formatEther(farmerDetails.premiumPaid)} ETH</strong>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Coverage: </span>
                <strong>{formatEther(farmerDetails.coverageAmount)} ETH</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Status: </span>
                {farmerDetails.active ? (
                  <span className="badge badge-success">Active</span>
                ) : (
                  <span className="badge badge-warning">Claim Paid</span>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="region-select">Select Region</label>
                <select
                  id="region-select"
                  value={region}
                  onChange={handleRegionChange}
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {policyInfo && (
                <div
                  style={{
                    background: 'var(--accent-green-dim)',
                    border: '1px solid rgba(34,197,94,0.2)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 600, marginBottom: '0.75rem' }}>
                    POLICY DETAILS
                  </div>
                  <div className="form-row" style={{ gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Premium</div>
                      <div style={{ fontWeight: 700 }}>{policyInfo.premium} ETH</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Payout</div>
                      <div style={{ fontWeight: 700 }}>{Number(policyInfo.premium) * policyInfo.multiplier} ETH</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Drought Trigger</div>
                      <div style={{ fontWeight: 700 }}>&lt; {policyInfo.rainfall} mm</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Heat Trigger</div>
                      <div style={{ fontWeight: 700 }}>&gt; {policyInfo.temperature} °C</div>
                    </div>
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary btn-full"
                onClick={handleRegister}
                disabled={loading}
                id="register-btn"
              >
                {loading ? <span className="spinner" /> : '🌾'} Register & Pay Premium
              </button>
            </>
          )}
        </div>

        {/* ── Info Panel ───────────────────────────────────────── */}
        <div className="card" id="register-info-card">
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>How Registration Works</h3>
          {[
            { num: '01', title: 'Choose Your Region', desc: 'Select the agricultural region where your farm is located. Each region has tailored insurance parameters based on local climate.' },
            { num: '02', title: 'Pay Your Premium', desc: 'A one-time premium payment activates your coverage. The smart contract holds these funds securely on-chain.' },
            { num: '03', title: 'Get Auto-Protected', desc: 'Weather oracles continuously monitor your region. If a drought or heatwave is detected, your payout is triggered automatically.' },
            { num: '04', title: 'Receive Instant Payout', desc: 'No claims to file! Funds are transferred directly to your wallet — transparent, auditable, and instant.' },
          ].map((step) => (
            <div
              key={step.num}
              style={{
                display: 'flex',
                gap: '1rem',
                marginBottom: '1.5rem',
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  minWidth: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-green-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  color: 'var(--accent-green)',
                  fontSize: '0.85rem',
                }}
              >
                {step.num}
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{step.title}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </>
  );
}
