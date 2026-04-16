import { useState } from 'react';
import { parseEther, formatEther } from 'ethers';
import { useStore } from '../store/useStore.js';

const REGIONS = ['Laikipia', 'Nakuru', 'Turkana'];
const BACKEND_URL = 'http://localhost:3001';

export default function Register() {
  const account = useStore(state => state.account);
  const contracts = useStore(state => state.contracts);
  const farmerDetails = useStore(state => state.farmerDetails);
  const refresh = useStore(state => state.refreshInsuranceData);
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

  const [aiData, setAiData] = useState({ pricing: null, recommend: null });

  const fetchPolicy = async (r) => {
    if (!contracts.insurance) return;
    try {
      const p = await contracts.insurance.regionalPolicies(r);
      let loyaltyDisc = 0;
      let seasons = 0;
      let prevClaims = 0;
      
      try {
        const [disc] = await contracts.insurance.getLoyaltyDiscount(account);
        loyaltyDisc = Number(disc);
        if (farmerDetails) {
          seasons = Number(farmerDetails.seasonsCompleted || 0);
        }
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

      // Fetch AI Dynamic Pricing & Recommendations
      try {
        const [priceRes, recRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/pricing/${r}?seasonsCompleted=${seasons}&previousClaims=${prevClaims}`),
          fetch(`${BACKEND_URL}/api/recommend/${r}`)
        ]);
        setAiData({ pricing: await priceRes.json(), recommend: await recRes.json() });
      } catch (e) {
        setAiData({ pricing: null, recommend: null });
      }

      // Fetch KES rate
      try {
        const rateRes = await fetch(`${BACKEND_URL}/api/rates`);
        const rateData = await rateRes.json();
        
        // Use AI dynamic premium if available, else fallback to contract base premium
        const ethPrice = aiData.pricing?.finalPremium || Number(formatEther(p.premiumAmount));
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

  const getToastStyles = () => {
    if (toast?.type === 'error') return 'bg-red-500/90 backdrop-blur-sm border border-red-400';
    return 'bg-emerald-500/90 backdrop-blur-sm border border-emerald-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-900/20 px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <span>🌾</span>
            <span>Farmer Registration</span>
          </div>
          <p className="text-gray-400">Get insured and protect your crops against climate risks</p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Registration Form Card */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-6">Register for Coverage</h3>

            {/* Payment mode toggle */}
            <div className="flex gap-2 mb-6 bg-gray-900/50 p-1 rounded-lg">
              <button
                className={`flex-1 py-2 rounded-lg font-medium transition-all duration-200 ${
                  paymentMode === 'wallet' 
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                onClick={() => setPaymentMode('wallet')}
              >
                🔗 Wallet (ETH)
              </button>
              <button
                className={`flex-1 py-2 rounded-lg font-medium transition-all duration-200 ${
                  paymentMode === 'mpesa' 
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                onClick={() => setPaymentMode('mpesa')}
              >
                📱 M-Pesa
              </button>
            </div>

            {/* If already registered */}
            {farmerDetails && farmerDetails.active ? (
              <div className="space-y-4">
                <div className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ✅ Registered
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-400">Region:</span>
                    <span className="text-white font-semibold">{farmerDetails.region}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-400">Premium Paid:</span>
                    <span className="text-white font-semibold">{formatEther(farmerDetails.premiumPaid)} ETH</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-400">Coverage:</span>
                    <span className="text-white font-semibold">{formatEther(farmerDetails.coverageAmount)} ETH</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-400">Seasons:</span>
                    <span className="text-white font-semibold">{Number(farmerDetails.seasonsCompleted)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-400">Status:</span>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">Active</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Region selector */}
                <div className="mb-4">
                  <label htmlFor="region-select" className="block text-gray-300 text-sm font-medium mb-2">
                    Select Region
                  </label>
                  <select
                    id="region-select"
                    value={region}
                    onChange={handleRegionChange}
                    className="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Policy details */}
                {policyInfo && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 mb-5">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-semibold text-emerald-400 tracking-wider">POLICY DETAILS</span>
                      {aiData.pricing && aiData.pricing.changePercent !== 0 && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          aiData.pricing.changePercent < 0 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {aiData.pricing.changePercent < 0 ? '' : '+'}{aiData.pricing.changePercent}% AI Adjustment
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Premium {aiData.pricing ? '(Dynamic)' : ''}</div>
                        <div className="font-bold text-white text-sm">
                          {paymentMode === 'mpesa' && premiumKES
                            ? `KES ${premiumKES.toLocaleString()}`
                            : `${aiData.pricing?.finalPremium || policyInfo.premium} ETH`}
                        </div>
                        {aiData.pricing && aiData.pricing.changePercent !== 0 && paymentMode === 'wallet' && (
                          <div className="text-xs text-gray-500 line-through">{policyInfo.premium} ETH Base</div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Full Payout</div>
                        <div className="font-bold text-white text-sm">
                          {paymentMode === 'mpesa' && premiumKES
                            ? `KES ${(premiumKES * policyInfo.multiplier).toLocaleString()}`
                            : `${Number(policyInfo.premium) * policyInfo.multiplier} ETH`}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Drought</div>
                        <div className="font-bold text-white text-sm">&lt; {policyInfo.rainfall} mm</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Heat</div>
                        <div className="font-bold text-white text-sm">&gt; {policyInfo.temperature} °C</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">NDVI</div>
                        <div className="font-bold text-white text-sm">&lt; {policyInfo.ndvi / 100}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Partial</div>
                        <div className="font-bold text-white text-sm">{policyInfo.partialPayout}%</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* AI Crop Recommendation insight bit */}
                {aiData.recommend && aiData.recommend.recommendations && aiData.recommend.recommendations.length > 0 && (
                  <div className="mb-5 p-3 bg-blue-500/10 rounded-lg border-l-4 border-blue-500">
                    <div className="text-xs font-bold text-blue-400 mb-1 flex items-center gap-1">
                      <span>🤖</span> AI FARM INSIGHT
                    </div>
                    <div className="text-sm text-gray-300">
                      Top crops for {region} this month: <span className="font-semibold text-white">
                        {aiData.recommend.recommendations.map(r => r.crop).join(', ')}
                      </span>.
                    </div>
                  </div>
                )}

                {/* ── WALLET MODE ──────────────────────────────── */}
                {paymentMode === 'wallet' && (
                  <>
                    {!account ? (
                      <div className="text-center py-8">
                        <div className="text-5xl mb-3">🔗</div>
                        <p className="text-gray-400">Connect your wallet to register with ETH</p>
                      </div>
                    ) : (
                      <button
                        className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        onClick={handleRegister}
                        disabled={loading}
                        id="register-btn"
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          '🔗'
                        )} Register & Pay with ETH
                      </button>
                    )}
                  </>
                )}

                {/* ── M-PESA MODE ──────────────────────────────── */}
                {paymentMode === 'mpesa' && (
                  <>
                    <div className="mb-4">
                      <label htmlFor="phone-input" className="block text-gray-300 text-sm font-medium mb-2">
                        M-Pesa Phone Number
                      </label>
                      <input
                        id="phone-input"
                        type="tel"
                        placeholder="07XX XXX XXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    <button
                      className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      onClick={handleMpesaPay}
                      disabled={loading || !phone}
                      id="mpesa-pay-btn"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        '📱'
                      )} Pay {premiumKES ? `KES ${premiumKES.toLocaleString()}` : ''} via M-Pesa
                    </button>

                    {mpesaStatus === 'success' && (
                      <div className="mt-4 p-3 bg-emerald-500/10 rounded-lg text-sm text-emerald-400 border border-emerald-500/20">
                        📱 Check your phone for the M-Pesa payment prompt. Complete the payment to activate your coverage.
                      </div>
                    )}

                    <div className="mt-4 p-3 bg-blue-500/10 rounded-lg text-sm text-blue-400 border border-blue-500/20">
                      ℹ️ No wallet needed! Pay with M-Pesa and receive payouts directly to your phone. The blockchain runs in the background.
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Info Panel */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-6">How Registration Works</h3>
            <div className="space-y-6">
              {[
                { num: '01', title: 'Choose Your Region', desc: 'Select the agricultural region where your farm is located. Each region has tailored insurance parameters.' },
                { num: '02', title: 'Choose Payment Method', desc: 'Pay with M-Pesa (KES) or crypto wallet (ETH). M-Pesa users don\'t need any blockchain knowledge!' },
                { num: '03', title: 'Tiered Protection', desc: 'Moderate events get 50% partial payouts. Severe events get full coverage. NDVI satellite data also detects crop damage.' },
                { num: '04', title: 'Automatic Payouts', desc: 'M-Pesa users receive payouts directly to their phone. Wallet users receive ETH. No claims to file!' },
              ].map((step) => (
                <div key={step.num} className="flex gap-4 items-start">
                  <div className="min-w-[40px] h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 text-sm">
                    {step.num}
                  </div>
                  <div>
                    <div className="font-semibold text-white mb-1">{step.title}</div>
                    <div className="text-sm text-gray-400 leading-relaxed">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Toast Notification */}
        {toast && (
          <div className={`fixed bottom-6 right-6 z-50 px-6 py-3 rounded-lg text-white font-medium shadow-lg animate-in slide-in-from-right-5 ${getToastStyles()}`}>
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}