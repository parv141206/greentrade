import { ethers } from "hardhat";

async function main() {
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Compile & get contract factory
  const ContractFactory = await ethers.getContractFactory("HydrogenCredits");

  // Deploy the contract
  const contract = await ContractFactory.deploy();
  await contract.waitForDeployment();

  console.log("Contract deployed at:", contract.target);
}

main().catch((err: Error) => {
  console.error(err);
  process.exit(1);
});
