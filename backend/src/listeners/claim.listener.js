import { ethers } from 'ethers';
import logger from '../utils/logger.js';
import * as blockchainService from '../services/blockchain.service.js';
import * as registrationService from '../services/registration.service.js';

export function startClaimListener() {
  const insurance = blockchainService.getInsuranceContract();
  const bridge = blockchainService.getBridgeContract();

  if (!insurance || !bridge) {
    logger.warn('Claim listener skipped — contracts not configured');
    return;
  }

  insurance.on('ClaimPaid', async (farmer, amount, reason, severity) => {
    logger.info(`🔔 ClaimPaid: ${farmer} | ${ethers.formatEther(amount)} ETH | ${reason} | Severity: ${severity}`);

    try {
      const isMpesa = await blockchainService.isMpesaFarmer(farmer);
      if (!isMpesa) {
        logger.info('Not an M-Pesa farmer, skipping auto-payout');
        return;
      }

      const amountKES = blockchainService.weiToKES(amount);

      let phone = null;
      for (const [, reg] of registrationService.getAllPending()) {
        if (reg.walletAddress === farmer) {
          phone = reg.phone;
          break;
        }
      }

      if (!phone) {
        logger.warn('Phone not found for M-Pesa farmer — manual payout needed');
        return;
      }

      await blockchainService.triggerPayoutEvent(farmer, amount, reason);

      await registrationService.sendPayout({
        phone,
        amountKES,
        reason: `KilimoKinga Claim: ${reason}`,
      });

      logger.info(`✅ Auto-payout complete: KES ${amountKES} → ${phone.slice(-4)}`);
    } catch (err) {
      logger.error('Auto-payout failed:', err.message);
    }
  });

  logger.info('👂 Claim listener active — watching for ClaimPaid events');
}
