import { ethers } from "ethers";

// Replace with your Ganache RPC URL
const GANACHE_URL = "http://127.0.0.1:8545";

// Replace with your deployed contract address
const CONTRACT_ADDRESS = "0x43d04119122f67723bBA8CfEC0c08Fc4E457fb6a";

// Replace with the ABI from your compiled artifact
import HydrogenCreditsArtifact from "../../artifacts/contracts/HydrogenCredits.sol/HydrogenCredits.json";

const provider = new ethers.JsonRpcProvider(GANACHE_URL);

// Use the first Ganache account as owner
const signer = provider.getSigner(0);

const contract = new ethers.Contract(
  CONTRACT_ADDRESS,
  HydrogenCreditsArtifact.abi,
  signer,
);

export interface UserWallet {
  address: string;
  privateKey: string;
}

/**
 * Creates a new Ethereum wallet
 */
export function createWallet(): UserWallet {
  const wallet = ethers.Wallet.createRandom();
  return { address: wallet.address, privateKey: wallet.privateKey };
}

/**
 * Registers a user and credits them tokens
 */
export async function registerAndCreditUser(
  wallet: UserWallet,
  hydrogenProducedKg: number,
) {
  // Convert kg to token units (you can scale as needed, e.g., 1kg = 1 token)
  const amount = ethers.parseUnits(hydrogenProducedKg.toString(), 18);

  // Register the user on-chain
  const txRegister = await contract.registerUser!(wallet.address);
  await txRegister.wait();

  // Credit user with tokens
  const txCredit = await contract.creditUser!(wallet.address, amount)!;
  await txCredit.wait();

  return {
    walletAddress: wallet.address,
    privateKey: wallet.privateKey,
    tokensMinted: hydrogenProducedKg,
  };
}

/**
 * Example usage:
 * const wallet = createWallet();
 * await registerAndCreditUser(wallet, 12.5);
 */
