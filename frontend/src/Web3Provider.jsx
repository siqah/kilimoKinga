import { useEffect } from 'react';
import { useStore } from './store/useStore.js';

export function Web3Provider({ children }) {
  const handleAccountsChanged = useStore((state) => state.handleAccountsChanged);
  const refreshInsuranceData = useStore((state) => state.refreshInsuranceData);

  useEffect(() => {
    if (!window.ethereum) return;
    
    const handleChain = () => window.location.reload();
    
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChain);
    
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChain);
    };
  }, [handleAccountsChanged]);

  useEffect(() => {
    // Poll blockchain data every 15s
    const iv = setInterval(() => {
      refreshInsuranceData();
    }, 15000);
    return () => clearInterval(iv);
  }, [refreshInsuranceData]);

  return <>{children}</>;
}
