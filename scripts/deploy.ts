import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.GANACHE_URL);

  const PRIVATE_KEY =
    "0x6397001106c5b5958218958a125368e71442b0dcbf039a8c5da18493b15ceb10";
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
