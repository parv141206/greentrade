import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  const PRIVATE_KEY =
    "0xca57c092738076d02c9c9dc03e71c0c5e19b58f4b0c2a5a709a4cc15e83519eb";
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/HydrogenCredits.sol/HydrogenCredits.json",
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet,
  );

  const contract = await factory.deploy();
  await contract.waitForDeployment();

  console.log("Contract deployed to:", contract.target);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
