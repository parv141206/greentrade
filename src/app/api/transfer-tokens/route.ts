import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { supabase } from "~/lib/supabase";

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
  // --- MODIFICATION START ---
  // 1. Destructure the new fromPan and toPan from the request body
  const { fromWallet, toWallet, hydrogenKg, listingId, fromPan, toPan } =
    await req.json();
  let failedLogPanFrom = fromPan || fromWallet; // Fallback to wallet if PAN not provided
  let failedLogPanTo = toPan || toWallet; // Fallback to wallet if PAN not provided
  // --- MODIFICATION END ---

  try {
    // --- MODIFICATION START ---
    // 2. Update validation to include the new PAN fields
    if (
      !fromWallet ||
      !toWallet ||
      !hydrogenKg ||
      !listingId ||
      !fromPan ||
      !toPan
    ) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters (wallet or PAN details).",
        }),
        { status: 400 },
      );
    }
    // --- MODIFICATION END ---

    const contract = await initContract();
    const tx = await contract.transferTokens(fromWallet, toWallet, hydrogenKg);
    const receipt = await tx.wait();

    const { data: listing, error: fetchError } = await supabase
      .from("marketplace")
      .select("credits")
      .eq("id", listingId)
      .single();

    if (fetchError || !listing) {
      throw new Error("Failed to find the marketplace listing to update.");
    }

    const remainingCredits = listing.credits - hydrogenKg;

    if (remainingCredits > 0) {
      const { error: updateError } = await supabase
        .from("marketplace")
        .update({ credits: remainingCredits })
        .eq("id", listingId);
      if (updateError) {
        throw new Error(
          `DB update failed after partial transfer: ${updateError.message}`,
        );
      }
    } else {
      const { error: updateError } = await supabase
        .from("marketplace")
        .update({ status: "completed" })
        .eq("id", listingId);
      if (updateError) {
        throw new Error(
          `DB update failed after full transfer: ${updateError.message}`,
        );
      }
    }

    // --- MODIFICATION START ---
    // 3. Use the correct PANs when inserting the success log
    const { error: auditError } = await supabase.from("audit_logs").insert([
      {
        from_pan: fromPan, // Use fromPan
        to_pan: toPan, // Use toPan
        amount: hydrogenKg,
        tx_hash: receipt.transactionHash,
        status: "success",
        remarks: `Marketplace sale to listing ${listingId}`,
      },
    ]);
    // --- MODIFICATION END ---

    if (auditError) {
      console.error("Audit log insert error:", auditError);
      // Even if logging fails, the blockchain transaction succeeded, so we proceed.
    }

    return NextResponse.json(
      {
        message: "Tokens transferred successfully",
        txHash: receipt.transactionHash,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error("Transfer error:", err);

    // --- MODIFICATION START ---
    // 4. Use the correct PANs (or fallbacks) when inserting the failure log
    await supabase.from("audit_logs").insert([
      {
        from_pan: failedLogPanFrom,
        to_pan: failedLogPanTo,
        amount: hydrogenKg,
        status: "failed",
        remarks: err.message || "Blockchain error",
      },
    ]);
    // --- MODIFICATION END ---

    return NextResponse.json(
      { error: err.message || "Blockchain error" },
      { status: 500 },
    );
  }
};
