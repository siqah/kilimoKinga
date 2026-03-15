import { useState } from 'react';
import { parseEther, formatEther } from 'ethers';
import { useWeb3, useInsuranceData } from '../Web3Provider.jsx';

const REGIONS = ['Laikipia', 'Nakuru', 'Turkana'];
const BACKEND_URL = 'http://localhost:3001';

export default function Register() {
  const { account, contracts } = useWeb3();
  const { farmerDetails, refresh } = useInsuranceData();
  const [region, setRegion] = useState(REGIONS[0]);
  const [policyInfo, setPolicyInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // M-Pesa state
  const [paymentMode, setPaymentMode] = useState('wallet'); // 'wallet' | 'mpesa'
  const [phone, setPhone] = useState('');
  const [mpesaStatus, setMpesaStatus] = useState(null); // null | 'pending' | 'success' | 'error'
  const [premiumKES, setPremiumKES] = useState(null);

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

      // Fetch KES rate
      try {
        const rateRes = await fetch(`${BACKEND_URL}/api/rates`);
        const rateData = await rateRes.json();
        const ethPrice = Number(formatEther(p.premiumAmount));
        setPremiumKES(Math.ceil(ethPrice * rateData.KES_PER_ETH));
      } catch (e) {
        setPremiumKES(null);
      }
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

  // ── Wallet registration (existing) ─────────────────────────────
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

  // ── M-Pesa registration (new) ─────────────────────────────────
  const handleMpesaPay = async () => {
    if (!phone || phone.length < 9) {
      showToast('Please enter a valid phone number', 'error');
      return;
    }
    setLoading(true);
    setMpesaStatus('pending');
    try {
      const res = await fetch(`${BACKEND_URL}/api/mpesa/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, region }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(`📱 Check your phone for M-Pesa prompt! KES ${data.premium_kes}`);
        setMpesaStatus('success');

        // Open Paystack checkout in new tab
        if (data.authorization_url) {
          window.open(data.authorization_url, '_blank');
        }

        // Poll for status
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`${BACKEND_URL}/api/mpesa/status/${data.reference}`);
            const statusData = await statusRes.json();
            if (statusData.status === 'registered') {
              showToast('✅ Registration complete! You\'re insured.');
              setMpesaStatus(null);
              clearInterval(pollInterval);
            } else if (statusData.paystack_status === 'success' && statusData.status !== 'registered') {
              showToast('💰 Payment received! Registering on-chain…');
            }
          } catch (e) {}
        }, 5000);

        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 300000);
      } else {
        showToast(data.error || 'Payment initialization failed', 'error');
        setMpesaStatus('error');
      }
    } catch (err) {
      showToast('Backend not reachable. Start the backend server first.', 'error');
      setMpesaStatus('error');
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

          {/* Payment mode toggle */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            background: 'var(--bg-glass)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
          }}>
            <button
              className={paymentMode === 'wallet' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ flex: 1, padding: '0.6rem' }}
              onClick={() => setPaymentMode('wallet')}
            >
              🔗 Wallet (ETH)
            </button>
            <button
              className={paymentMode === 'mpesa' ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ flex: 1, padding: '0.6rem' }}
              onClick={() => setPaymentMode('mpesa')}
            >
              📱 M-Pesa
            </button>
          </div>

          {/* If wallet mode and already registered */}
          {paymentMode === 'wallet' && farmerDetails && farmerDetails.active ? (
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
                <span style={{ color: 'var(--text-muted)' }}>Seasons: </span>
                <strong>{Number(farmerDetails.seasonsCompleted)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Status: </span>
                <span className="badge badge-success">Active</span>
              </div>
            </div>
          ) : (
            <>
              {/* Region selector */}
              <div className="form-group">
                <label htmlFor="region-select">Select Region</label>
                <select id="region-select" value={region} onChange={handleRegionChange}>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Policy details */}
              {policyInfo && (
                <div style={{
                  background: 'var(--accent-green-dim)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  marginBottom: '1.25rem',
                }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 600, marginBottom: '0.75rem' }}>
                    POLICY DETAILS
                  </div>
                  <div className="form-row" style={{ gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Premium</div>
                      <div style={{ fontWeight: 700 }}>
                        {paymentMode === 'mpesa' && premiumKES
                          ? `KES ${premiumKES.toLocaleString()}`
                          : `${policyInfo.premium} ETH`}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Full Payout</div>
                      <div style={{ fontWeight: 700 }}>
                        {paymentMode === 'mpesa' && premiumKES
                          ? `KES ${(premiumKES * policyInfo.multiplier).toLocaleString()}`
                          : `${Number(policyInfo.premium) * policyInfo.multiplier} ETH`}
                      </div>
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
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>NDVI</div>
                      <div style={{ fontWeight: 700 }}>&lt; {policyInfo.ndvi / 100}%</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Partial</div>
                      <div style={{ fontWeight: 700 }}>{policyInfo.partialPayout}%</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── WALLET MODE ──────────────────────────────── */}
              {paymentMode === 'wallet' && (
                <>
                  {!account ? (
                    <div className="empty-state">
                      <div className="empty-icon">🔗</div>
                      <p>Connect your wallet to register with ETH</p>
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary btn-full"
                      onClick={handleRegister}
                      disabled={loading}
                      id="register-btn"
                    >
                      {loading ? <span className="spinner" /> : '🔗'} Register & Pay with ETH
                    </button>
                  )}
                </>
              )}

              {/* ── M-PESA MODE ──────────────────────────────── */}
              {paymentMode === 'mpesa' && (
                <>
                  <div className="form-group">
                    <label htmlFor="phone-input">M-Pesa Phone Number</label>
                    <input
                      id="phone-input"
                      type="tel"
                      placeholder="07XX XXX XXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <button
                    className="btn btn-primary btn-full"
                    onClick={handleMpesaPay}
                    disabled={loading || !phone}
                    id="mpesa-pay-btn"
                    style={{ background: 'linear-gradient(135deg, #4caf50, #2e7d32)' }}
                  >
                    {loading ? <span className="spinner" /> : '📱'} Pay {premiumKES ? `KES ${premiumKES.toLocaleString()}` : ''} via M-Pesa
                  </button>

                  {mpesaStatus === 'success' && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      background: 'var(--accent-green-dim)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      color: 'var(--accent-green)',
                    }}>
                      📱 Check your phone for the M-Pesa payment prompt. Complete the payment to activate your coverage.
                    </div>
                  )}

                  <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    background: 'var(--accent-blue-dim)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    color: 'var(--accent-blue)',
                  }}>
                    ℹ️ No wallet needed! Pay with M-Pesa and receive payouts directly to your phone. The blockchain runs in the background.
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* ── Info Panel ───────────────────────────────────────── */}
        <div className="card" id="register-info-card">
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>How Registration Works</h3>
          {[
            { num: '01', title: 'Choose Your Region', desc: 'Select the agricultural region where your farm is located. Each region has tailored insurance parameters.' },
            { num: '02', title: 'Choose Payment Method', desc: 'Pay with M-Pesa (KES) or crypto wallet (ETH). M-Pesa users don\'t need any blockchain knowledge!' },
            { num: '03', title: 'Tiered Protection', desc: 'Moderate events get 50% partial payouts. Severe events get full coverage. NDVI satellite data also detects crop damage.' },
            { num: '04', title: 'Automatic Payouts', desc: 'M-Pesa users receive payouts directly to their phone. Wallet users receive ETH. No claims to file!' },
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
