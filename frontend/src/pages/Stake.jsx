import { useState } from 'react';
import { parseUnits, formatUnits } from 'ethers';
import { useStore } from '../store/useStore.js';
import { ADDRESSES } from '../contracts.js';

export default function Stake() {
  const account = useStore(state => state.account);
  const contracts = useStore(state => state.contracts);
  const poolHealth = useStore(state => state.poolHealth);
  const myStake = useStore(state => state.myStake);
  const myReward = useStore(state => state.myReward);
  const stakerCount = useStore(state => state.stakerCount);
  const refresh = useStore(state => state.refreshInsuranceData);
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
            <span>💰</span>
            <span>Investor Staking</span>
          </div>
          <p className="text-gray-400">Earn rewards while supporting climate-resilient agriculture</p>
        </div>

        {/* Pool Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-emerald-500/50 transition-all duration-300">
            <div className="text-3xl mb-3">🏦</div>
            <div className="text-gray-400 text-sm mb-1">Total Staked</div>
            <div className="text-2xl font-bold text-white">{Number(poolHealth.staked).toFixed(2)}</div>
            <div className="text-gray-500 text-xs mt-2">USDC in pool</div>
          </div>
          
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-emerald-500/50 transition-all duration-300">
            <div className="text-3xl mb-3">📈</div>
            <div className="text-gray-400 text-sm mb-1">Annual APY</div>
            <div className="text-2xl font-bold text-emerald-400">5%</div>
            <div className="text-gray-500 text-xs mt-2">Reward rate</div>
          </div>
          
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 hover:border-emerald-500/50 transition-all duration-300">
            <div className="text-3xl mb-3">👥</div>
            <div className="text-gray-400 text-sm mb-1">Active Investors</div>
            <div className="text-2xl font-bold text-white">{stakerCount}</div>
            <div className="text-gray-500 text-xs mt-2">Staking in pool</div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stake Form Card */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-6">Stake USDC</h3>

            {!account ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">🔗</div>
                <p className="text-gray-400">Connect your wallet to stake</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label htmlFor="stake-amount" className="block text-gray-300 text-sm font-medium mb-2">
                    Amount (USDC)
                  </label>
                  <input
                    id="stake-amount"
                    type="number"
                    placeholder="e.g. 1000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <button
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-3"
                  onClick={handleStake}
                  disabled={loading || !amount || Number(amount) <= 0}
                  id="stake-btn"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    '📥'
                  )} Stake USDC
                </button>

                <button
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                  onClick={handleMintTestUSDC}
                  disabled={loading}
                  id="mint-test-usdc-btn"
                >
                  🧪 Mint 10,000 Test USDC
                </button>

                <div className="mt-4 p-3 bg-blue-500/10 rounded-lg text-sm text-blue-400 border border-blue-500/20">
                  ℹ️ On testnet, use "Mint Test USDC" to get mock stablecoins for staking.
                </div>
              </>
            )}
          </div>

          {/* My Position Card */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-6">My Position</h3>

            {!account ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">📊</div>
                <p className="text-gray-400">Connect wallet to view position</p>
              </div>
            ) : !myStake ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-3">💤</div>
                <p className="text-gray-400">No active stake yet</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-5 mb-6">
                  <div>
                    <div className="text-gray-400 text-sm mb-1">Staked Amount</div>
                    <div className="text-2xl font-bold text-white">
                      {Number(myStake.amount).toFixed(2)} <span className="text-sm text-gray-400">USDC</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm mb-1">Accrued Rewards</div>
                    <div className="text-2xl font-bold text-emerald-400">
                      +{Number(myReward).toFixed(4)} <span className="text-sm text-gray-400">USDC</span>
                    </div>
                  </div>
                </div>

                <button
                  className="w-full bg-red-600/80 hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  onClick={handleUnstake}
                  disabled={loading}
                  id="unstake-btn"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    '📤'
                  )} Unstake + Claim Rewards
                </button>
              </>
            )}

            {/* Benefits Section */}
            <div className="mt-6 pt-6 border-t border-gray-700">
              <div className="font-semibold text-white mb-3 text-sm">Why Stake?</div>
              <div className="space-y-2">
                {[
                  '🔐 Your capital backs real farmer insurance',
                  '📈 Earn 5% APY on your stablecoins',
                  '🌍 Direct impact on African food security',
                  '⛓️ Fully transparent on-chain accounting',
                ].map((item, i) => (
                  <div key={i} className="text-sm text-gray-400 py-1">
                    {item}
                  </div>
                ))}
              </div>
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