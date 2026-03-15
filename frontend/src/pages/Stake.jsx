import { useState } from 'react';
import { parseUnits, formatUnits } from 'ethers';
import { useWeb3, useInsuranceData } from '../Web3Provider.jsx';
import { ADDRESSES } from '../contracts.js';

export default function Stake() {
  const { account, contracts } = useWeb3();
  const { poolHealth, myStake, myReward, stakerCount, refresh } = useInsuranceData();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleStake = async () => {
    if (!contracts.usdc || !amount || Number(amount) <= 0) return;
    setLoading(true);
    try {
      // Approve pool to spend USDC
      const parsedAmt = parseUnits(amount, 6);
      const approveTx = await contracts.usdc.approve(ADDRESSES.InsurancePool, parsedAmt);
      showToast('⏳ Approving USDC…');
      await approveTx.wait();

      // Stake
      const stakeTx = await contracts.pool.stake(parsedAmt);
      showToast('⏳ Staking…');
      await stakeTx.wait();
      showToast('✅ Successfully staked!');
      setAmount('');
      refresh();
    } catch (err) {
      console.error(err);
      showToast(err.reason || err.message || 'Staking failed', 'error');
    }
    setLoading(false);
  };

  const handleUnstake = async () => {
    if (!contracts.pool) return;
    setLoading(true);
    try {
      const tx = await contracts.pool.unstake();
      showToast('⏳ Unstaking…');
      await tx.wait();
      showToast('✅ Successfully unstaked with rewards!');
      refresh();
    } catch (err) {
      console.error(err);
      showToast(err.reason || err.message || 'Unstake failed', 'error');
    }
    setLoading(false);
  };

  const handleMintTestUSDC = async () => {
    if (!contracts.usdc) return;
    setLoading(true);
    try {
      const tx = await contracts.usdc.mint(account, parseUnits('10000', 6));
      await tx.wait();
      showToast('✅ Minted 10,000 test USDC');
    } catch (err) {
      showToast(err.reason || 'Mint failed', 'error');
    }
    setLoading(false);
  };

  return (
    <>
      <div className="section-title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
        💰 Investor Staking
      </div>

      {/* ── Pool Stats ────────────────────────────────────────── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-icon blue">🏦</div>
          <div className="stat-label">Total Staked</div>
          <div className="stat-value">{Number(poolHealth.staked).toFixed(2)}</div>
          <div className="stat-sub">USDC in pool</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📈</div>
          <div className="stat-label">Annual APY</div>
          <div className="stat-value" style={{ color: 'var(--accent-green)' }}>5%</div>
          <div className="stat-sub">Reward rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">👥</div>
          <div className="stat-label">Active Investors</div>
          <div className="stat-value">{stakerCount}</div>
          <div className="stat-sub">Staking in pool</div>
        </div>
      </div>

      <div className="two-col">
        {/* ── Stake Form ──────────────────────────────────────── */}
        <div className="card" id="stake-form-card">
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>Stake USDC</h3>

          {!account ? (
            <div className="empty-state">
              <div className="empty-icon">🔗</div>
              <p>Connect your wallet to stake</p>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="stake-amount">Amount (USDC)</label>
                <input
                  id="stake-amount"
                  type="number"
                  placeholder="e.g. 1000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                  step="1"
                />
              </div>

              <button
                className="btn btn-primary btn-full"
                onClick={handleStake}
                disabled={loading || !amount || Number(amount) <= 0}
                id="stake-btn"
                style={{ marginBottom: '0.75rem' }}
              >
                {loading ? <span className="spinner" /> : '📥'} Stake USDC
              </button>

              <button
                className="btn btn-secondary btn-full"
                onClick={handleMintTestUSDC}
                disabled={loading}
                style={{ fontSize: '0.8rem' }}
                id="mint-test-usdc-btn"
              >
                🧪 Mint 10,000 Test USDC
              </button>

              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: 'var(--accent-blue-dim)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  color: 'var(--accent-blue)',
                }}
              >
                ℹ️ On testnet, use "Mint Test USDC" to get mock stablecoins for staking.
              </div>
            </>
          )}
        </div>

        {/* ── My Stake ────────────────────────────────────────── */}
        <div className="card" id="my-stake-card">
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>My Position</h3>

          {!account ? (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <p>Connect wallet to view position</p>
            </div>
          ) : !myStake ? (
            <div className="empty-state">
              <div className="empty-icon">💤</div>
              <p>No active stake yet</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <div className="stat-label">Staked Amount</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                    {Number(myStake.amount).toFixed(2)} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>USDC</span>
                  </div>
                </div>
                <div>
                  <div className="stat-label">Accrued Rewards</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                    +{Number(myReward).toFixed(4)} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>USDC</span>
                  </div>
                </div>
              </div>

              <button
                className="btn btn-danger btn-full"
                onClick={handleUnstake}
                disabled={loading}
                id="unstake-btn"
              >
                {loading ? <span className="spinner" /> : '📤'} Unstake + Claim Rewards
              </button>
            </>
          )}

          {/* Benefits */}
          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem' }}>Why Stake?</div>
            {[
              '🔐 Your capital backs real farmer insurance',
              '📈 Earn 5% APY on your stablecoins',
              '🌍 Direct impact on African food security',
              '⛓️ Fully transparent on-chain accounting',
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  padding: '0.4rem 0',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </>
  );
}
