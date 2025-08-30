import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// -------------------- Helper: Create deterministic wallet from PAN --------------------
function getWalletFromPAN(pan: string, provider: ethers.JsonRpcProvider) {
  const hash = crypto.createHash("sha256").update(pan).digest("hex");
  const privateKey = "0x" + hash;
  return new ethers.Wallet(privateKey, provider);
}

// -------------------- Load compiled contract --------------------
const artifactPath = path.join(
  process.cwd(),
  "artifacts/contracts/HydrogenCredits.sol/HydrogenCredits.json",
);
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

// -------------------- Config --------------------
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const GANACHE_URL = process.env.GANACHE_URL;
const OWNER_PRIVATE_KEY =
  process.env.OWNER_PRIVATE_KEY;

let provider: ethers.JsonRpcProvider;
let signer: ethers.Wallet;
let contract: ethers.Contract;

// -------------------- Init contract --------------------
async function initContract() {
  if (contract) return contract;

  provider = new ethers.JsonRpcProvider(GANACHE_URL);
  signer = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);

  contract = new ethers.Contract(CONTRACT_ADDRESS, artifact.abi, signer);
  return contract;
}

// -------------------- POST handler for creating user --------------------
export const POST = async (req: Request) => {
  try {
    const body = await req.json();
    const { pan } = body;

    if (!pan) {
      return new Response(
        JSON.stringify({ error: "Missing PAN" }),
        { status: 400 },
      );
    }

    const contract = await initContract();

    // 1️⃣ Get user wallet from PAN
    const userWallet = getWalletFromPAN(pan, provider);

    // 2️⃣ Check if user already registered
    let isRegistered = false;
    try {
      isRegistered = await contract.registeredUsers(userWallet.address);
    } catch (err) {
      console.warn(
        "Warning: could not fetch registration status, assuming not registered",
        err,
      );
    }

    // 3️⃣ Register user if not registered
    if (!isRegistered) {
      const txRegister = await contract.registerUser(userWallet.address);
      await txRegister.wait();
    }

    return new Response(
      JSON.stringify({
        message: "User created successfully",
        walletAddress: userWallet.address,
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