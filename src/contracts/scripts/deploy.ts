import { ethers } from "hardhat";
import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer, relayerSigner] = await ethers.getSigners();

  console.log("=================================================");
  console.log("🚀 Deploying AegisVault to:", hre.network.name);
  console.log("=================================================");
  console.log("Deployer address:", deployer.address);
  console.log(
    "Deployer balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "BNB"
  );

  // On testnet, use RELAYER_ADDRESS env var; otherwise use the second signer
  const relayerAddress =
    process.env.RELAYER_ADDRESS || relayerSigner?.address || deployer.address;

  console.log("Relayer address:", relayerAddress);
  console.log("─────────────────────────────────────────────────");

  // Deploy AegisVault
  const AegisVault = await ethers.getContractFactory("AegisVault");
  const vault = await AegisVault.deploy(relayerAddress);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log("✅ AegisVault deployed to:", vaultAddress);
  console.log(
    "   Gas used: ~",
    (await vault.deploymentTransaction()?.wait())?.gasUsed?.toString()
  );

  // Persist addresses for the relayer service
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    vaultAddress,
    relayerAddress,
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "../src/relayer/deployment.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("📄 Deployment info saved to src/relayer/deployment.json");

  // Also save to contracts artifacts dir for easy reference
  const contractsOutPath = path.join(__dirname, "../deployments.json");
  fs.writeFileSync(contractsOutPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("=================================================");
  console.log("🎉 Deployment complete!");
  console.log(`   View on BscScan: https://testnet.bscscan.com/address/${vaultAddress}`);
  console.log("=================================================");

  // Verify on BscScan if not on local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n⏳ Waiting 5 block confirmations before verification...");
    await vault.deploymentTransaction()?.wait(5);
    try {
      await hre.run("verify:verify", {
        address: vaultAddress,
        constructorArguments: [relayerAddress],
      });
      console.log("✅ Contract verified on BscScan!");
    } catch (err: any) {
      if (err.message.includes("Already Verified")) {
        console.log("⚠️  Contract already verified.");
      } else {
        console.error("❌ Verification failed:", err.message);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
