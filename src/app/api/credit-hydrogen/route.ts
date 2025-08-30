import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import crypto from "crypto";

function getWalletFromPAN(pan: string, provider: ethers.JsonRpcProvider) {
  const hash = crypto.createHash("sha256").update(pan).digest("hex");
  const privateKey = "0x" + hash;
  return new ethers.Wallet(privateKey, provider);
}

const artifactPath = path.join(
  process.cwd(),
  "artifacts/contracts/HydrogenCredits.sol/HydrogenCredits.json",
);
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

const CONTRACT_ADDRESS = "0x983Af1A674a2a084E7b3577328933E178e1d1364";
const GANACHE_URL = "http://127.0.0.1:8545";
const OWNER_PRIVATE_KEY =
  "0xca57c092738076d02c9c9dc03e71c0c5e19b58f4b0c2a5a709a4cc15e83519eb";

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
    const { pan, hydrogenKg } = body;

    if (!pan || !hydrogenKg) {
      return new Response(
        JSON.stringify({ error: "Missing PAN or hydrogenKg" }),
        { status: 400 },
      );
    }

    const contract = await initContract();

    const userWallet = getWalletFromPAN(pan, provider);

    let isRegistered = false;
    try {
      isRegistered = await contract.registeredUsers(userWallet.address);
    } catch (err) {
      console.warn(
        "Warning: could not fetch registration status, assuming not registered",
        err,
      );
    }

    if (!isRegistered) {
      const txRegister = await contract.registerUser(userWallet.address);
      await txRegister.wait();
    }

    const txCredit = await contract.creditUser(userWallet.address, hydrogenKg);
    await txCredit.wait();

    const balance = await contract.getBalance(userWallet.address);
    console.log(balance);
    return new Response(
      JSON.stringify({
        message: "User registered and credited successfully",
        walletAddress: userWallet.address,
        balance: balance.toString(),
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
