import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.GANACHE_URL);

  const PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
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
