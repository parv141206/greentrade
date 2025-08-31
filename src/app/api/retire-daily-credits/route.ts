// File: /app/api/retire-daily-credits/route.ts

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { supabase } from "~/lib/supabase";

// --- Contract Initialization (same as in transfer-tokens) ---
const artifactPath = path.join(
  process.cwd(),
  "artifacts/contracts/HydrogenCredits.sol/HydrogenCredits.json",
);
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const GANACHE_URL = process.env.GANACHE_URL;
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
// --- End Contract Initialization ---

// --- NEW Environment Variables ---
const CRON_SECRET = process.env.CRON_SECRET;
const DAILY_RETIREMENT_AMOUNT = parseInt(
  process.env.DAILY_RETIREMENT_AMOUNT || "1",
  10,
);
// ---

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
  // 1. --- Security Check ---
  const authorization = req.headers.get("Authorization");
  if (authorization !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isNaN(DAILY_RETIREMENT_AMOUNT) || DAILY_RETIREMENT_AMOUNT <= 0) {
    return NextResponse.json(
      { error: "Invalid DAILY_RETIREMENT_AMOUNT configured." },
      { status: 500 },
    );
  }

  const contract = await initContract();
  const summary = {
    processed: 0,
    successful: 0,
    failed: 0,
  };

  try {
    // 2. --- Fetch all users with a wallet address from your database ---
    const { data: users, error: fetchError } = await supabase
      .from("users") // Assuming you have a 'users' table with 'pan' and 'wallet_address'
      .select("pan, wallet_address")
      .not("wallet_address", "is", null);

    if (fetchError) {
      throw new Error(`Failed to fetch users: ${fetchError.message}`);
    }

    // 3. --- Loop through each user and attempt to retire credits ---
    for (const user of users) {
      summary.processed++;
      try {
        console.log(
          `Attempting to retire ${DAILY_RETIREMENT_AMOUNT} credits from ${user.pan}...`,
        );

        // Call the new smart contract function
        const tx = await contract.retireCredits(
          user.wallet_address,
          DAILY_RETIREMENT_AMOUNT,
        );
        const receipt = await tx.wait();

        // Log success to audit table
        await supabase.from("audit_logs").insert({
          from_pan: user.pan,
          to_pan: "RETIRED_POOL", // Use a system identifier for clarity
          amount: DAILY_RETIREMENT_AMOUNT,
          tx_hash: receipt.transactionHash,
          status: "success",
          remarks: "Daily credit retirement.",
        });

        summary.successful++;
        console.log(`Successfully retired credits for ${user.pan}.`);
      } catch (err: any) {
        // This catch block handles errors like "insufficient balance"
        summary.failed++;
        console.error(
          `Failed to retire credits for ${user.pan}: ${err.message}`,
        );

        // Log failure to audit table
        await supabase.from("audit_logs").insert({
          from_pan: user.pan,
          to_pan: "RETIRED_POOL",
          amount: DAILY_RETIREMENT_AMOUNT,
          status: "failed",
          remarks: `Daily retirement failed: ${err.message}`,
        });
      }
    }

    return NextResponse.json(
      { message: "Daily retirement process completed.", summary },
      { status: 200 },
    );
  } catch (err: any) {
    console.error(
      "A critical error occurred during the retirement process:",
      err,
    );
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
};
