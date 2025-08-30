import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Ganache default RPC
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Get Ganache accounts with private keys
  // Replace with your Ganache CLI mnemonic/private key if needed
  const PRIVATE_KEY =
    "0xca57c092738076d02c9c9dc03e71c0c5e19b58f4b0c2a5a709a4cc15e83519eb";
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  // Load compiled contract JSON
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/HydrogenCredits.sol/HydrogenCredits.json",
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Deploy contract
  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet, // use wallet instead of provider.getSigner()
  );

  const contract = await factory.deploy();
  await contract.waitForDeployment(); // wait for deployment in v6

  console.log("Contract deployed to:", contract.target);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
