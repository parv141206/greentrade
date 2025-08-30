import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

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

async function initContract() {
  if (contract) return contract;
  provider = new ethers.JsonRpcProvider(GANACHE_URL);
  signer = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
  contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, signer);
  return contract;
}

export const POST = async (req: Request) => {
  try {
    const { walletAddress, hydrogenKg } = await req.json();

    if (!walletAddress || !hydrogenKg) {
      return new Response(
        JSON.stringify({ error: "Missing walletAddress or hydrogenKg" }),
        { status: 400 },
      );
    }

    const contract = await initContract();

    const tx = await contract.creditUser(walletAddress, hydrogenKg);
    await tx.wait();

    const balance = await contract.getBalance(walletAddress);

    return new Response(
      JSON.stringify({
        message: "Hydrogen tokens credited successfully",
        walletAddress,
        balance: balance.toString(),
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
