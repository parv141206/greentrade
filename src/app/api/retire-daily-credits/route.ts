// File: /app/api/retire-daily-credits/route.ts

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { supabase } from "~/lib/supabase";
import { auth } from "~/server/auth/";

// --- Wallet Generation Function ---
function getWalletFromPAN(pan: string, provider: ethers.JsonRpcProvider) {
  const hash = crypto.createHash("sha256").update(pan).digest("hex");
  const privateKey = "0x" + hash;
  return new ethers.Wallet(privateKey, provider);
}

// --- Contract Initialization ---
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
  signer = new ethers.Wallet(OWNER_PRIVATE_KEY!, provider);
  contract = new ethers.Contract(CONTRACT_ADDRESS!, artifact.abi, signer);
  return contract;
}

export const POST = async (req: NextRequest) => {
  // 1. --- Security Check: Verify Admin Session ---
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden: Not an admin" },
      { status: 403 },
    );
  }

  const contract = await initContract();
  const summary = { processed: 0, successful: 0, failed: 0 };

  try {
    // 2. --- Fetch companies ---
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("pan, daily_usage")
      .eq("verified", true)
      .not("pan", "is", null)
      .gt("daily_usage", 0);

    if (companiesError)
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    if (!companies || companies.length === 0) {
      return NextResponse.json(
        {
          message: "No verified companies with daily usage found to process.",
          summary,
        },
        { status: 200 },
      );
    }

    // 4. --- Loop through each company ---
    for (const company of companies) {
      summary.processed++;
      const amountToRetire = company.daily_usage;
      const pan = company.pan!;

      // Generate wallet address on the fly
      const userWallet = getWalletFromPAN(pan, provider);
      const walletAddress = userWallet.address;

      try {
        // =================================================================
        // STEP 1: PRE-FLIGHT CHECKS (BEFORE SENDING TRANSACTION)
        // =================================================================

        // Check if the user is registered on the smart contract
        const isRegistered = await contract.registeredUsers(walletAddress);
        if (!isRegistered) {
          throw new Error("User is not registered on the blockchain.");
        }

        // Check if the user has enough balance
        const balanceBigInt = await contract.getBalance(walletAddress);
        const balance = Number(balanceBigInt); // Convert BigInt to number for comparison

        if (balance < amountToRetire) {
          throw new Error(
            `Insufficient balance. Has: ${balance}, needs: ${amountToRetire}.`,
          );
        }

        console.log(
          `Checks passed for PAN ${pan}. Balance: ${balance}. Retiring: ${amountToRetire}`,
        );

        // =================================================================
        // STEP 2: EXECUTE TRANSACTION
        // =================================================================
        const tx = await contract.retireCredits(walletAddress, amountToRetire);
        const receipt = await tx.wait();

        const newBalance = await contract.getBalance(walletAddress);
        console.log(
          `SUCCESS for PAN ${pan}. Tx: ${receipt.transactionHash}. New Balance: ${newBalance}`,
        );

        // Log success to database
        await supabase.from("audit_logs").insert({
          from_pan: pan,
          to_pan: "RETIRED_POOL",
          amount: amountToRetire,
          tx_hash: receipt.transactionHash,
          status: "success",
          remarks: `Daily retirement. Balance changed from ${balance} to ${newBalance}.`,
        });
        summary.successful++;
      } catch (err: any) {
        // =================================================================
        // STEP 3: CATCH AND LOG FAILURES CLEARLY
        // =================================================================
        console.error(
          `Retirement FAILED for PAN ${pan} (Wallet: ${walletAddress}). Reason: ${err.message}`,
        );

        summary.failed++;
        // Log the specific failure reason to the database
        await supabase.from("audit_logs").insert({
          from_pan: pan,
          to_pan: "RETIRED_POOL",
          amount: amountToRetire,
          status: "failed",
          remarks: `Retirement failed: ${err.message}`,
        });
      }
    }

    return NextResponse.json(
      { message: "Retirement process completed.", summary },
      { status: 200 },
    );
  } catch (err: any) {
    console.error("Critical error in retirement process:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
};
