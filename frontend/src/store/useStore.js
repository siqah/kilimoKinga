import { create } from 'zustand';
import { BrowserProvider, Contract, formatEther, formatUnits } from 'ethers';
import {
  ADDRESSES,
  FARMER_INSURANCE_ABI,
  INSURANCE_POOL_ABI,
  MOCK_ORACLE_ABI,
  MOCK_USDC_ABI,
} from '../contracts.js';

export const useStore = create((set, get) => ({
  // ── Web3 State ──
  provider: null,
  signer: null,
  account: null,
  chainId: null,
  contracts: {},

  // ── Insurance Data ──
  totalPremiums: '0',
  totalClaims: '0',
  farmerCount: 0,
  contractBalance: '0',
  farmerDetails: null,
  poolHealth: { staked: '0', available: '0' },
  stakerCount: 0,
  myStake: null,
  myReward: '0',
  loading: false,

  // ── Actions ──
  setLoading: (loading) => set({ loading }),

  connectWallet: async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet.');
      return;
    }
    try {
      const p = new BrowserProvider(window.ethereum);
      const accounts = await p.send('eth_requestAccounts', []);
      const s = await p.getSigner();
      const net = await p.getNetwork();

      const contracts = {
        insurance: new Contract(ADDRESSES.FarmerInsurance, FARMER_INSURANCE_ABI, s),
        pool: new Contract(ADDRESSES.InsurancePool, INSURANCE_POOL_ABI, s),
        oracle: new Contract(ADDRESSES.MockWeatherOracle, MOCK_ORACLE_ABI, s),
        usdc: new Contract(ADDRESSES.MockUSDC, MOCK_USDC_ABI, s),
      };

      set({
        provider: p,
        signer: s,
        account: accounts[0],
        chainId: Number(net.chainId),
        contracts,
      });

      // Fetch data immediately upon connection
      get().refreshInsuranceData();

    } catch (err) {
      console.error('Wallet connection failed:', err);
    }
  },

  handleAccountsChanged: (accounts) => {
    if (accounts.length === 0) {
      // Disconnected
      set({ account: null, farmerDetails: null, myStake: null, myReward: '0' });
    } else {
      set({ account: accounts[0] });
      get().refreshInsuranceData();
    }
  },

  refreshInsuranceData: async () => {
    const { contracts, account } = get();
    if (!contracts.insurance) return;

    set({ loading: true });
    try {
      const [totalPrem, totalCl, fCount, bal] = await Promise.all([
        contracts.insurance.totalPremiums(),
        contracts.insurance.totalClaims(),
        contracts.insurance.farmerCount(),
        contracts.insurance.getContractBalance(),
      ]);

      let poolH = { staked: 0n, available: 0n };
      let sCount = 0;
      let myStake = null;
      let myReward = '0';

      try {
        [poolH.staked, poolH.available] = await contracts.pool.getPoolHealth();
        sCount = Number(await contracts.pool.getStakerCount());
        if (account) {
          myStake = await contracts.pool.stakers(account);
          if (myStake.active) {
            myReward = formatUnits(await contracts.pool.calculateReward(account), 6);
          }
        }
      } catch (e) { /* pool may not be deployed yet */ }

      let farmerDetails = null;
      if (account) {
        try {
          const d = await contracts.insurance.getFarmerDetails(account);
          if (d.isRegistered) farmerDetails = d;
        } catch (e) {}
      }

      set({
        totalPremiums: formatEther(totalPrem),
        totalClaims: formatEther(totalCl),
        farmerCount: Number(fCount),
        contractBalance: formatEther(bal),
        farmerDetails,
        poolHealth: {
          staked: formatUnits(poolH.staked, 6),
          available: formatUnits(poolH.available, 6),
        },
        stakerCount: sCount,
        myStake: myStake?.active ? { amount: formatUnits(myStake.amount, 6) } : null,
        myReward,
      });
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      set({ loading: false });
    }
  },
}));
