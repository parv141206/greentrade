import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

// Path to your contract artifact
const artifactPath = path.join(
  process.cwd(),
  "artifacts/contracts/HydrogenCredits.sol/HydrogenCredits.json",
);
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const GANACHE_URL = process.env.GANACHE_URL;
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;

let provider: ethers.JsonRpcProvider;
let signer: ethers.Wallet;
let contract: ethers.Contract;

// Initialize the contract instance
async function initContract() {
  if (contract) return contract;
  provider = new ethers.JsonRpcProvider(GANACHE_URL);
  signer = new ethers.Wallet(OWNER_PRIVATE_KEY!, provider);
  contract = new ethers.Contract(CONTRACT_ADDRESS!, artifact.abi, signer);
  return contract;
}

export const POST = async (req: Request) => {
  try {
    const { fromWallet, toWallet, hydrogenKg } = await req.json();

    if (!fromWallet || !toWallet || !hydrogenKg) {
      return new Response(
        JSON.stringify({
          error: "Missing fromWallet, toWallet, or hydrogenKg",
        }),
        { status: 400 },
      );
    }

    const contract = await initContract();
    // The core function to transfer tokens
    const tx = await contract.transferTokens(fromWallet, toWallet, hydrogenKg);
    await tx.wait(); // Wait for the transaction to be mined

    return new Response(
      JSON.stringify({
        message: "Tokens transferred successfully",
        fromWallet,
        toWallet,
        hydrogenKg,
      }),
      { status: 200 },
    );
  } catch (err: any) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err.message || "Blockchain error" }),
      { status: 500 },
    );
  }
};
