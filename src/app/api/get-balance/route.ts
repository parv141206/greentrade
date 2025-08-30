import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const artifactPath = path.join(
    process.cwd(),
    "artifacts/contracts/HydrogenCredits.sol/HydrogenCredits.json"
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

export const GET = async (req: Request) => {
    try {
        const url = new URL(req.url);
        const walletAddress = url.searchParams.get("walletAddress");

        if (!walletAddress) {
            return new Response(JSON.stringify({ error: "Missing walletAddress" }), { status: 400 });
        }

        const contract = await initContract();
        const balance = await contract.getBalance(walletAddress);

        return new Response(JSON.stringify({ walletAddress, balance: balance.toString() }), { status: 200 });
    } catch (err: any) {
        console.error(err);
        return new Response(JSON.stringify({ error: err.message || "Blockchain error" }), { status: 500 });
    }
};
