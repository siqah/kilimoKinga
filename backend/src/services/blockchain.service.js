import { ethers } from 'ethers';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const INSURANCE_ABI = [
  "function regionalPolicies(string) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)",
  "function getFarmerDetails(address) view returns (bool,string,uint256,uint256,uint256,bool,uint256,uint256)",
  "event ClaimPaid(address indexed farmer, uint256 amount, string reason, uint256 severity)",
];

const BRIDGE_ABI = [
  "function registerFarmerViaMpesa(bytes32 phoneHash, address walletAddress, string region, uint256 premiumKES) payable",
  "function triggerMpesaPayout(address farmerWallet, uint256 amountWei, string reason)",
  "function isMpesaFarmer(address) view returns (bool)",
  "function getMpesaFarmer(bytes32) view returns (string,address,bool,uint256)",
];

let provider = null;
let relay = null;
let insuranceContract = null;
let bridgeContract = null;
let initialized = false;

export function init() {
  if (initialized) return;

  try {
    provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
    relay = new ethers.Wallet(config.blockchain.relayPrivateKey, provider);

    const { farmerInsurance, mpesaBridge } = config.blockchain.contracts;

    if (farmerInsurance) {
      insuranceContract = new ethers.Contract(farmerInsurance, INSURANCE_ABI, relay);
    }

    if (mpesaBridge && mpesaBridge !== '0x0000000000000000000000000000000000000000') {
      bridgeContract = new ethers.Contract(mpesaBridge, BRIDGE_ABI, relay);
    }

    initialized = true;
    logger.info(`Blockchain connected. Relay: ${relay.address}`);
  } catch (err) {
    logger.error('Blockchain init failed:', err.message);
  }
}

export async function getRegionalPremium(region) {
  if (!insuranceContract) throw new Error('Insurance contract not initialized');

  const policy = await insuranceContract.regionalPolicies(region);
  const premiumWei = policy[4];

  if (premiumWei === 0n) throw new Error(`Region "${region}" not supported`);

  return {
    premiumWei,
    premiumETH: Number(ethers.formatEther(premiumWei)),
    premiumKES: Math.ceil(Number(ethers.formatEther(premiumWei)) * config.kesPerEth),
  };
}

export async function registerMpesaFarmer({ phoneHash, region, premiumKES, premiumWei }) {
  if (!bridgeContract) throw new Error('MpesaBridge contract not initialized');

  const farmerWallet = ethers.Wallet.createRandom();

  const tx = await bridgeContract.registerFarmerViaMpesa(
    phoneHash,
    farmerWallet.address,
    region,
    premiumKES,
    { value: premiumWei }
  );

  const receipt = await tx.wait();
  logger.info(`Farmer registered on-chain. Wallet: ${farmerWallet.address} | Tx: ${receipt.hash}`);

  return { walletAddress: farmerWallet.address, txHash: receipt.hash };
}

export async function triggerPayoutEvent(farmerWallet, amountWei, reason) {
  if (!bridgeContract) throw new Error('MpesaBridge contract not initialized');

  const tx = await bridgeContract.triggerMpesaPayout(farmerWallet, amountWei, reason);
  await tx.wait();
  logger.info(`Payout event emitted for ${farmerWallet}`);
}

export async function isMpesaFarmer(address) {
  if (!bridgeContract) return false;
  return bridgeContract.isMpesaFarmer(address);
}

export function weiToKES(weiAmount) {
  const eth = Number(ethers.formatEther(weiAmount));
  return Math.floor(eth * config.kesPerEth);
}

export function hashPhone(phone) {
  return ethers.keccak256(ethers.toUtf8Bytes(phone));
}

export function getInsuranceContract() { return insuranceContract; }
export function getBridgeContract() { return bridgeContract; }
export function getProvider() { return provider; }
