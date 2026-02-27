import { expect } from "chai";
import { ethers } from "hardhat";
import { AegisVault } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { parseEther, ZeroAddress } from "ethers";

describe("AegisVault", function () {
  let vault: AegisVault;
  let owner: HardhatEthersSigner;
  let relayer: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let freshWallet1: HardhatEthersSigner;
  let freshWallet2: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;

  const ONE_BNB = parseEther("1");
  const HALF_BNB = parseEther("0.5");
  const POINT_1_BNB = parseEther("0.1");

  beforeEach(async function () {
    [owner, relayer, user1, user2, freshWallet1, freshWallet2, attacker] =
      await ethers.getSigners();

    const AegisVaultFactory = await ethers.getContractFactory("AegisVault");
    vault = await AegisVaultFactory.deploy(relayer.address);
    await vault.waitForDeployment();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Deployment
  // ─────────────────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await vault.owner()).to.equal(owner.address);
    });

    it("Should set the correct relayer", async function () {
      expect(await vault.relayer()).to.equal(relayer.address);
    });

    it("Should revert if deployed with zero-address relayer", async function () {
      const AegisVaultFactory = await ethers.getContractFactory("AegisVault");
      await expect(AegisVaultFactory.deploy(ZeroAddress)).to.be.revertedWithCustomError(
        vault,
        "ZeroAddress"
      );
    });

    it("Should start with zero vault balance", async function () {
      expect(await vault.vaultBalance()).to.equal(0n);
    });

    it("Should start with zero total intents", async function () {
      expect(await vault.totalIntents()).to.equal(0n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deposit()
  // ─────────────────────────────────────────────────────────────────────────

  describe("deposit()", function () {
    it("Should accept BNB and emit IntentRegistered", async function () {
      await expect(
        vault.connect(user1).deposit(freshWallet1.address, { value: ONE_BNB })
      )
        .to.emit(vault, "IntentRegistered")
        .withArgs(user1.address, freshWallet1.address, ONE_BNB, 0n);
    });

    it("Should increment intent counter on each deposit", async function () {
      await vault.connect(user1).deposit(freshWallet1.address, { value: ONE_BNB });
      await vault.connect(user1).deposit(freshWallet2.address, { value: HALF_BNB });
      expect(await vault.totalIntents()).to.equal(2n);
    });

    it("Should increase vault balance after deposit", async function () {
      await vault.connect(user1).deposit(freshWallet1.address, { value: ONE_BNB });
      expect(await vault.vaultBalance()).to.equal(ONE_BNB);
    });

    it("Should track per-depositor balance", async function () {
      await vault.connect(user1).deposit(freshWallet1.address, { value: ONE_BNB });
      await vault.connect(user1).deposit(freshWallet2.address, { value: HALF_BNB });
      expect(await vault.deposits(user1.address)).to.equal(ONE_BNB + HALF_BNB);
    });

    it("Should revert on zero-value deposit", async function () {
      await expect(
        vault.connect(user1).deposit(freshWallet1.address, { value: 0n })
      ).to.be.revertedWithCustomError(vault, "ZeroAmount");
    });

    it("Should revert on zero-address receiver", async function () {
      await expect(
        vault.connect(user1).deposit(ZeroAddress, { value: ONE_BNB })
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });

    it("Should correctly assign sequential intent indices", async function () {
      const tx1 = await vault.connect(user1).deposit(freshWallet1.address, { value: ONE_BNB });
      const tx2 = await vault.connect(user2).deposit(freshWallet2.address, { value: HALF_BNB });
      
      const receipt1 = await tx1.wait();
      const receipt2 = await tx2.wait();
      
      // Get events
      const iface = vault.interface;
      const log1 = receipt1!.logs.find(
        (l) => l.topics[0] === iface.getEvent("IntentRegistered")!.topicHash
      )!;
      const log2 = receipt2!.logs.find(
        (l) => l.topics[0] === iface.getEvent("IntentRegistered")!.topicHash
      )!;
      
      const parsed1 = iface.parseLog({ topics: [...log1.topics], data: log1.data })!;
      const parsed2 = iface.parseLog({ topics: [...log2.topics], data: log2.data })!;
      
      expect(parsed1.args.intentIndex).to.equal(0n);
      expect(parsed2.args.intentIndex).to.equal(1n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // executeBatch()
  // ─────────────────────────────────────────────────────────────────────────

  describe("executeBatch()", function () {
    beforeEach(async function () {
      // Pre-fund vault with deposits
      await vault.connect(user1).deposit(freshWallet1.address, { value: ONE_BNB });
      await vault.connect(user2).deposit(freshWallet2.address, { value: HALF_BNB });
    });

    it("Should transfer BNB to receivers and emit BatchExecuted", async function () {
      const receivers = [freshWallet1.address, freshWallet2.address];
      const amounts = [ONE_BNB, HALF_BNB];

      await expect(vault.connect(relayer).executeBatch(receivers, amounts))
        .to.emit(vault, "BatchExecuted")
        .withArgs(2n, ONE_BNB + HALF_BNB);
    });

    it("Should transfer correct BNB amounts to each receiver", async function () {
      const freshWallet1BalBefore = await ethers.provider.getBalance(freshWallet1.address);
      const freshWallet2BalBefore = await ethers.provider.getBalance(freshWallet2.address);

      await vault.connect(relayer).executeBatch(
        [freshWallet1.address, freshWallet2.address],
        [ONE_BNB, HALF_BNB]
      );

      expect(await ethers.provider.getBalance(freshWallet1.address)).to.equal(
        freshWallet1BalBefore + ONE_BNB
      );
      expect(await ethers.provider.getBalance(freshWallet2.address)).to.equal(
        freshWallet2BalBefore + HALF_BNB
      );
    });

    it("Should drain vault balance after full batch", async function () {
      await vault.connect(relayer).executeBatch(
        [freshWallet1.address, freshWallet2.address],
        [ONE_BNB, HALF_BNB]
      );
      expect(await vault.vaultBalance()).to.equal(0n);
    });

    it("Should revert if called by non-relayer", async function () {
      await expect(
        vault.connect(attacker).executeBatch(
          [freshWallet1.address],
          [ONE_BNB]
        )
      ).to.be.revertedWithCustomError(vault, "OnlyRelayer");
    });

    it("Should revert if called by owner (not relayer)", async function () {
      await expect(
        vault.connect(owner).executeBatch([freshWallet1.address], [ONE_BNB])
      ).to.be.revertedWithCustomError(vault, "OnlyRelayer");
    });

    it("Should revert on array length mismatch", async function () {
      await expect(
        vault.connect(relayer).executeBatch(
          [freshWallet1.address, freshWallet2.address],
          [ONE_BNB]
        )
      ).to.be.revertedWithCustomError(vault, "ArrayLengthMismatch");
    });

    it("Should revert on empty batch", async function () {
      await expect(
        vault.connect(relayer).executeBatch([], [])
      ).to.be.revertedWithCustomError(vault, "EmptyBatch");
    });

    it("Should revert if vault has insufficient balance", async function () {
      await expect(
        vault.connect(relayer).executeBatch(
          [freshWallet1.address],
          [parseEther("999")]
        )
      ).to.be.revertedWithCustomError(vault, "InsufficientVaultBalance");
    });

    it("Should revert on zero-address in receivers array", async function () {
      await expect(
        vault.connect(relayer).executeBatch([ZeroAddress], [POINT_1_BNB])
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });

    it("Should revert on zero-amount in amounts array", async function () {
      await expect(
        vault.connect(relayer).executeBatch([freshWallet1.address], [0n])
      ).to.be.revertedWithCustomError(vault, "ZeroAmount");
    });

    it("Should handle single-item batch correctly", async function () {
      const before = await ethers.provider.getBalance(freshWallet1.address);
      await vault.connect(relayer).executeBatch([freshWallet1.address], [HALF_BNB]);
      const after = await ethers.provider.getBalance(freshWallet1.address);
      expect(after - before).to.equal(HALF_BNB);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // setRelayer() (Owner admin)
  // ─────────────────────────────────────────────────────────────────────────

  describe("setRelayer()", function () {
    it("Should allow owner to update relayer", async function () {
      await expect(vault.connect(owner).setRelayer(user1.address))
        .to.emit(vault, "RelayerUpdated")
        .withArgs(relayer.address, user1.address);
      expect(await vault.relayer()).to.equal(user1.address);
    });

    it("Should reject non-owner calls", async function () {
      await expect(
        vault.connect(attacker).setRelayer(attacker.address)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("Should reject zero-address relayer update", async function () {
      await expect(
        vault.connect(owner).setRelayer(ZeroAddress)
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // emergencyWithdraw()
  // ─────────────────────────────────────────────────────────────────────────

  describe("emergencyWithdraw()", function () {
    beforeEach(async function () {
      await vault.connect(user1).deposit(freshWallet1.address, { value: ONE_BNB });
    });

    it("Should allow owner to do emergency withdrawal", async function () {
      const ownerBefore = await ethers.provider.getBalance(owner.address);
      const tx = await vault.connect(owner).emergencyWithdraw(owner.address, ONE_BNB);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const ownerAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerAfter + gasUsed - ownerBefore).to.equal(ONE_BNB);
    });

    it("Should revert if non-owner calls it", async function () {
      await expect(
        vault.connect(attacker).emergencyWithdraw(attacker.address, ONE_BNB)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("Should revert if insufficient balance", async function () {
      await expect(
        vault.connect(owner).emergencyWithdraw(owner.address, parseEther("999"))
      ).to.be.revertedWithCustomError(vault, "InsufficientVaultBalance");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Receive + vaultBalance
  // ─────────────────────────────────────────────────────────────────────────

  describe("Receive / vaultBalance", function () {
    it("Should accept plain ETH transfers to fill relayer gas reserve", async function () {
      await owner.sendTransaction({ to: await vault.getAddress(), value: ONE_BNB });
      expect(await vault.vaultBalance()).to.equal(ONE_BNB);
    });
  });
});
