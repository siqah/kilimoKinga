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
      let loyaltyDisc = 0;
      try {
        const [disc] = await contracts.insurance.getLoyaltyDiscount(account);
        loyaltyDisc = Number(disc);
      } catch (e) {}
      setPolicyInfo({
        rainfall: Number(p.rainfallThreshold),
        temperature: Number(p.temperatureThreshold),
        ndvi: Number(p.ndviThreshold),
        premium: formatEther(p.premiumAmount),
        multiplier: Number(p.payoutMultiplier),
        partialPayout: Number(p.partialPayoutPercent),
        loyaltyDiscount: loyaltyDisc,
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
                ✅ Registered
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
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Seasons Completed: </span>
                <strong>{Number(farmerDetails.seasonsCompleted)}</strong>
              </div>
              {Number(farmerDetails.loyaltyDiscount) > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Loyalty Discount: </span>
                  <span className="badge badge-info">⭐ {formatEther(farmerDetails.loyaltyDiscount)} ETH saved</span>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Status: </span>
                {farmerDetails.active ? (
                  <span className="badge badge-success">Active</span>
                ) : (
                  <span className="badge badge-warning">Season Ended – Re-register!</span>
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
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Full Payout</div>
                      <div style={{ fontWeight: 700 }}>{Number(policyInfo.premium) * policyInfo.multiplier} ETH</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Partial Payout</div>
                      <div style={{ fontWeight: 700 }}>{policyInfo.partialPayout}% ({(Number(policyInfo.premium) * policyInfo.multiplier * policyInfo.partialPayout / 100).toFixed(4)} ETH)</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Drought</div>
                      <div style={{ fontWeight: 700 }}>&lt; {policyInfo.rainfall} mm</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Heat</div>
                      <div style={{ fontWeight: 700 }}>&gt; {policyInfo.temperature} °C</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>NDVI (Crop Health)</div>
                      <div style={{ fontWeight: 700 }}>&lt; {policyInfo.ndvi / 100}%</div>
                    </div>
                  </div>
                  {policyInfo.loyaltyDiscount > 0 && (
                    <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'var(--accent-amber-dim)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--accent-amber)' }}>
                      ⭐ Loyalty discount: {policyInfo.loyaltyDiscount}% off premium!
                    </div>
                  )}
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
            { num: '01', title: 'Choose Your Region', desc: 'Select the agricultural region where your farm is located. Each region has tailored insurance parameters.' },
            { num: '02', title: 'Pay Your Premium', desc: 'A seasonal premium activates your coverage. Returning farmers earn loyalty discounts (up to 25% off)!' },
            { num: '03', title: 'Tiered Protection', desc: 'Moderate events get 50% partial payouts. Severe events get full coverage. NDVI satellite data also detects crop damage.' },
            { num: '04', title: 'Renew Each Season', desc: 'After a season ends, re-register for the next one. Your loyalty builds — 5% more discount per completed season!' },
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
