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
    const body = await req.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return new Response(JSON.stringify({ error: "Missing wallet address" }), {
        status: 400,
      });
    }

    const contract = await initContract();

    const isRegistered = await contract.registeredUsers(walletAddress);
    if (isRegistered) {
      return new Response(
        JSON.stringify({ message: "User already registered" }),
        { status: 200 },
      );
    }

    const txRegister = await contract.registerUser(walletAddress);
    await txRegister.wait();

    return new Response(
      JSON.stringify({
        message: "User registered successfully",
        walletAddress: walletAddress,
      }),
      { status: 200 },
    );
  } catch (err: any) {
    console.error("Full error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Blockchain error" }),
      { status: 500 },
    );
  }
};
