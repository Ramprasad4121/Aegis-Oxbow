// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AegisVault.sol";

contract AegisVaultTest is Test {
    AegisVault public vault;

    address public owner;
    address public relayer;
    address public user1;
    address public user2;
    address public freshWallet1;
    address public freshWallet2;
    address public attacker;

    uint256 constant ONE_BNB  = 1 ether;
    uint256 constant HALF_BNB = 0.5 ether;
    uint256 constant TINY_BNB = 0.1 ether;

    event IntentRegistered(address indexed sender, address indexed receiver, uint256 amount, uint256 intentIndex);
    event BatchExecuted(uint256 batchSize, uint256 totalValue);
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);

    function setUp() public {
        owner       = makeAddr("owner");
        relayer     = makeAddr("relayer");
        user1       = makeAddr("user1");
        user2       = makeAddr("user2");
        freshWallet1 = makeAddr("freshWallet1");
        freshWallet2 = makeAddr("freshWallet2");
        attacker    = makeAddr("attacker");

        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(attacker, 10 ether);

        vm.prank(owner);
        vault = new AegisVault(relayer);
    }

    // ── Deployment ────────────────────────────────────────────────────────────

    function test_Deployment_OwnerSet() public view {
        assertEq(vault.owner(), owner);
    }

    function test_Deployment_RelayerSet() public view {
        assertEq(vault.relayer(), relayer);
    }

    function test_Deployment_ZeroRelayer_Reverts() public {
        vm.prank(owner);
        vm.expectRevert(AegisVault.ZeroAddress.selector);
        new AegisVault(address(0));
    }

    function test_Deployment_InitialBalance_Zero() public view {
        assertEq(vault.vaultBalance(), 0);
    }

    function test_Deployment_InitialIntents_Zero() public view {
        assertEq(vault.totalIntents(), 0);
    }

    // ── deposit() ─────────────────────────────────────────────────────────────

    function test_Deposit_EmitsIntentRegistered() public {
        vm.expectEmit(true, true, false, true, address(vault));
        emit IntentRegistered(user1, freshWallet1, ONE_BNB, 0);

        vm.prank(user1);
        vault.deposit{value: ONE_BNB}(freshWallet1);
    }

    function test_Deposit_IncrementsVaultBalance() public {
        vm.prank(user1);
        vault.deposit{value: ONE_BNB}(freshWallet1);
        assertEq(vault.vaultBalance(), ONE_BNB);
    }

    function test_Deposit_TracksPerDepositorBalance() public {
        vm.startPrank(user1);
        vault.deposit{value: ONE_BNB}(freshWallet1);
        vault.deposit{value: HALF_BNB}(freshWallet2);
        vm.stopPrank();
        assertEq(vault.deposits(user1), ONE_BNB + HALF_BNB);
    }

    function test_Deposit_IncrementsIntentCounter() public {
        vm.prank(user1);
        vault.deposit{value: ONE_BNB}(freshWallet1);
        vm.prank(user2);
        vault.deposit{value: HALF_BNB}(freshWallet2);
        assertEq(vault.totalIntents(), 2);
    }

    function test_Deposit_ZeroValue_Reverts() public {
        vm.prank(user1);
        vm.expectRevert(AegisVault.ZeroAmount.selector);
        vault.deposit{value: 0}(freshWallet1);
    }

    function test_Deposit_ZeroAddress_Reverts() public {
        vm.prank(user1);
        vm.expectRevert(AegisVault.ZeroAddress.selector);
        vault.deposit{value: ONE_BNB}(address(0));
    }

    function test_Deposit_SequentialIntentIndices() public {
        vm.prank(user1);
        vault.deposit{value: ONE_BNB}(freshWallet1);     // idx 0
        vm.prank(user2);
        vault.deposit{value: HALF_BNB}(freshWallet2);    // idx 1
        assertEq(vault.totalIntents(), 2);
    }

    // ── executeBatch() ────────────────────────────────────────────────────────

    modifier withDeposits() {
        vm.prank(user1);
        vault.deposit{value: ONE_BNB}(freshWallet1);
        vm.prank(user2);
        vault.deposit{value: HALF_BNB}(freshWallet2);
        _;
    }

    function test_ExecuteBatch_TransfersCorrectAmounts() public withDeposits {
        uint256 fw1Before = freshWallet1.balance;
        uint256 fw2Before = freshWallet2.balance;

        address[] memory receivers = new address[](2);
        uint256[] memory amounts   = new uint256[](2);
        receivers[0] = freshWallet1; amounts[0] = ONE_BNB;
        receivers[1] = freshWallet2; amounts[1] = HALF_BNB;

        vm.prank(relayer);
        vault.executeBatch(receivers, amounts);

        assertEq(freshWallet1.balance, fw1Before + ONE_BNB);
        assertEq(freshWallet2.balance, fw2Before + HALF_BNB);
    }

    function test_ExecuteBatch_EmitsBatchExecuted() public withDeposits {
        address[] memory receivers = new address[](2);
        uint256[] memory amounts   = new uint256[](2);
        receivers[0] = freshWallet1; amounts[0] = ONE_BNB;
        receivers[1] = freshWallet2; amounts[1] = HALF_BNB;

        vm.expectEmit(false, false, false, true, address(vault));
        emit BatchExecuted(2, ONE_BNB + HALF_BNB);

        vm.prank(relayer);
        vault.executeBatch(receivers, amounts);
    }

    function test_ExecuteBatch_OnlyRelayer_Reverts_ForAttacker() public withDeposits {
        address[] memory receivers = new address[](1);
        uint256[] memory amounts   = new uint256[](1);
        receivers[0] = freshWallet1; amounts[0] = TINY_BNB;

        vm.prank(attacker);
        vm.expectRevert(AegisVault.OnlyRelayer.selector);
        vault.executeBatch(receivers, amounts);
    }

    function test_ExecuteBatch_OnlyRelayer_Reverts_ForOwner() public withDeposits {
        address[] memory receivers = new address[](1);
        uint256[] memory amounts   = new uint256[](1);
        receivers[0] = freshWallet1; amounts[0] = TINY_BNB;

        vm.prank(owner);
        vm.expectRevert(AegisVault.OnlyRelayer.selector);
        vault.executeBatch(receivers, amounts);
    }

    function test_ExecuteBatch_EmptyArray_Reverts() public {
        vm.prank(relayer);
        vm.expectRevert(AegisVault.EmptyBatch.selector);
        vault.executeBatch(new address[](0), new uint256[](0));
    }

    function test_ExecuteBatch_LengthMismatch_Reverts() public withDeposits {
        address[] memory receivers = new address[](2);
        uint256[] memory amounts   = new uint256[](1);
        receivers[0] = freshWallet1; receivers[1] = freshWallet2;
        amounts[0] = ONE_BNB;

        vm.prank(relayer);
        vm.expectRevert(AegisVault.ArrayLengthMismatch.selector);
        vault.executeBatch(receivers, amounts);
    }

    function test_ExecuteBatch_InsufficientBalance_Reverts() public withDeposits {
        address[] memory receivers = new address[](1);
        uint256[] memory amounts   = new uint256[](1);
        receivers[0] = freshWallet1; amounts[0] = 999 ether;

        vm.prank(relayer);
        vm.expectRevert(AegisVault.InsufficientVaultBalance.selector);
        vault.executeBatch(receivers, amounts);
    }

    function test_ExecuteBatch_ZeroAddressInArray_Reverts() public withDeposits {
        address[] memory receivers = new address[](1);
        uint256[] memory amounts   = new uint256[](1);
        receivers[0] = address(0); amounts[0] = TINY_BNB;

        vm.prank(relayer);
        vm.expectRevert(AegisVault.ZeroAddress.selector);
        vault.executeBatch(receivers, amounts);
    }

    function test_ExecuteBatch_ZeroAmountInArray_Reverts() public withDeposits {
        address[] memory receivers = new address[](1);
        uint256[] memory amounts   = new uint256[](1);
        receivers[0] = freshWallet1; amounts[0] = 0;

        vm.prank(relayer);
        vm.expectRevert(AegisVault.ZeroAmount.selector);
        vault.executeBatch(receivers, amounts);
    }

    function test_ExecuteBatch_SingleItem() public withDeposits {
        uint256 before = freshWallet1.balance;
        address[] memory receivers = new address[](1);
        uint256[] memory amounts   = new uint256[](1);
        receivers[0] = freshWallet1; amounts[0] = HALF_BNB;

        vm.prank(relayer);
        vault.executeBatch(receivers, amounts);
        assertEq(freshWallet1.balance, before + HALF_BNB);
    }

    function test_ExecuteBatch_DrainsFunds() public withDeposits {
        address[] memory receivers = new address[](2);
        uint256[] memory amounts   = new uint256[](2);
        receivers[0] = freshWallet1; amounts[0] = ONE_BNB;
        receivers[1] = freshWallet2; amounts[1] = HALF_BNB;

        vm.prank(relayer);
        vault.executeBatch(receivers, amounts);
        assertEq(vault.vaultBalance(), 0);
    }

    // ── setRelayer() ──────────────────────────────────────────────────────────

    function test_SetRelayer_UpdatesRelayer() public {
        vm.prank(owner);
        vault.setRelayer(user1);
        assertEq(vault.relayer(), user1);
    }

    function test_SetRelayer_EmitsRelayerUpdated() public {
        vm.expectEmit(true, true, false, false, address(vault));
        emit RelayerUpdated(relayer, user1);

        vm.prank(owner);
        vault.setRelayer(user1);
    }

    function test_SetRelayer_NonOwner_Reverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        vault.setRelayer(attacker);
    }

    function test_SetRelayer_ZeroAddress_Reverts() public {
        vm.prank(owner);
        vm.expectRevert(AegisVault.ZeroAddress.selector);
        vault.setRelayer(address(0));
    }

    // ── emergencyWithdraw() ───────────────────────────────────────────────────

    function test_EmergencyWithdraw_OwnerCanWithdraw() public {
        vm.prank(user1);
        vault.deposit{value: ONE_BNB}(freshWallet1);

        uint256 ownerBefore = owner.balance;
        vm.prank(owner);
        vault.emergencyWithdraw(owner, ONE_BNB);
        assertEq(owner.balance, ownerBefore + ONE_BNB);
    }

    function test_EmergencyWithdraw_NonOwner_Reverts() public {
        vm.prank(user1);
        vault.deposit{value: ONE_BNB}(freshWallet1);

        vm.prank(attacker);
        vm.expectRevert();
        vault.emergencyWithdraw(attacker, ONE_BNB);
    }

    function test_EmergencyWithdraw_InsufficientBalance_Reverts() public {
        vm.prank(owner);
        vm.expectRevert(AegisVault.InsufficientVaultBalance.selector);
        vault.emergencyWithdraw(owner, 999 ether);
    }

    // ── Receive / vaultBalance ────────────────────────────────────────────────

    function test_Receive_AcceptsPlainTransfer() public {
        vm.deal(owner, 10 ether);
        vm.prank(owner);
        (bool ok,) = address(vault).call{value: ONE_BNB}("");
        assertTrue(ok);
        assertEq(vault.vaultBalance(), ONE_BNB);
    }

    // ── Fuzz Tests ────────────────────────────────────────────────────────────

    function testFuzz_Deposit_AnyAmount(uint96 amount) public {
        vm.assume(amount > 0);
        vm.deal(user1, uint256(amount));
        vm.prank(user1);
        vault.deposit{value: amount}(freshWallet1);
        assertEq(vault.vaultBalance(), amount);
    }

    function testFuzz_ExecuteBatch_SingleEntry(uint96 amount) public {
        vm.assume(amount > 0 && amount < 100 ether);
        vm.deal(user1, uint256(amount));
        vm.prank(user1);
        vault.deposit{value: amount}(freshWallet1);

        address[] memory receivers = new address[](1);
        uint256[] memory amounts   = new uint256[](1);
        receivers[0] = freshWallet2;
        amounts[0]   = uint256(amount);

        uint256 before = freshWallet2.balance;
        vm.prank(relayer);
        vault.executeBatch(receivers, amounts);
        assertEq(freshWallet2.balance, before + uint256(amount));
    }
}
