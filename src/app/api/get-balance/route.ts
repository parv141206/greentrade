import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const artifactPath = path.join(
  process.cwd(),
  "artifacts/contracts/HydrogenCredits.sol/HydrogenCredits.json",
);
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const GANACHE_URL = process.env.GANACHE_URL;

let provider: ethers.JsonRpcProvider;
let contract: ethers.Contract;

async function initContract() {
  if (contract) return contract;
  provider = new ethers.JsonRpcProvider(GANACHE_URL);
  contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, provider);
  return contract;
}

function getWalletFromPAN(pan: string, provider: ethers.JsonRpcProvider) {
  const hash = crypto.createHash("sha256").update(pan).digest("hex");
  const privateKey = "0x" + hash;
  return new ethers.Wallet(privateKey, provider);
}

export const GET = async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const pan = url.searchParams.get("pan");

    if (!pan) {
      return new Response(JSON.stringify({ error: "Missing PAN" }), {
        status: 400,
      });
    }

    const contract = await initContract();

    const wallet = getWalletFromPAN(pan, provider);

    const balance = await contract.getBalance(wallet.address);

    return new Response(
      JSON.stringify({
        pan,
        walletAddress: wallet.address,
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
