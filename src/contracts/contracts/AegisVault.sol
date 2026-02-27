// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @author Ramprasad
 * @title AegisVault
 * @notice Privacy-preserving vault for BNB Chain. Users deposit BNB with an intended
 *         receiver. The authorized AI Relayer batches withdrawals to break on-chain links,
 *         acting as a Paymaster for gas fees.
 * @dev Implements strict reentrancy guards and role-based relayer access.
 */
contract AegisVault is ReentrancyGuard, Ownable {
    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice The authorized AI Relayer address (acts as Paymaster / batch executor)
    address public relayer;

    /// @notice Tracks the vault's internal balance per depositor for accounting
    mapping(address => uint256) public deposits;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when a user registers a withdrawal intent.
     * @param sender       The depositing wallet (KYC'd).
     * @param receiver     The fresh destination wallet.
     * @param amount       The BNB amount deposited (in wei).
     * @param intentIndex  Monotonically-increasing intent ID for off-chain tracking.
     */
    event IntentRegistered(
        address indexed sender,
        address indexed receiver,
        uint256 amount,
        uint256 intentIndex
    );

    /**
     * @notice Emitted when the Relayer successfully executes a batch.
     * @param batchSize  Number of transfers in the batch.
     * @param totalValue Total BNB transferred in the batch.
     */
    event BatchExecuted(uint256 batchSize, uint256 totalValue);

    /// @notice Emitted when the relayer address is updated by the owner.
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error ZeroAmount();
    error ZeroAddress();
    error ArrayLengthMismatch();
    error EmptyBatch();
    error OnlyRelayer();
    error InsufficientVaultBalance();
    error TransferFailed();

    // ─────────────────────────────────────────────────────────────────────────
    // Intent counter
    // ─────────────────────────────────────────────────────────────────────────

    uint256 private _intentCounter;

    // ─────────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────────

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert OnlyRelayer();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param _relayer  Initial relayer address (AI agent wallet).
     */
    constructor(address _relayer) Ownable(msg.sender) {
        if (_relayer == address(0)) revert ZeroAddress();
        relayer = _relayer;
        emit RelayerUpdated(address(0), _relayer);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // User-facing Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Deposit BNB and register a withdrawal intent to a fresh wallet.
     * @param _intendedReceiver  The destination address that will receive the BNB.
     *                           Must be different from sender to preserve privacy.
     */
    function deposit(address _intendedReceiver) external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        if (_intendedReceiver == address(0)) revert ZeroAddress();

        // Track depositor balance
        deposits[msg.sender] += msg.value;

        uint256 idx = _intentCounter++;
        emit IntentRegistered(msg.sender, _intendedReceiver, msg.value, idx);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Relayer-only Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Execute a batch of transfers to fresh wallets.
     * @dev ONLY callable by the authorized `relayer`. Uses pull-then-transfer
     *      pattern with reentrancy guard. Transfers are independent; one failure
     *      reverts the whole batch (atomicity guarantee).
     * @param receivers  Array of destination (fresh) wallet addresses.
     * @param amounts    Corresponding BNB amounts in wei.
     */
    function executeBatch(
        address[] calldata receivers,
        uint256[] calldata amounts
    ) external nonReentrant onlyRelayer {
        if (receivers.length == 0) revert EmptyBatch();
        if (receivers.length != amounts.length) revert ArrayLengthMismatch();

        uint256 totalRequired;
        uint256 len = receivers.length;

        // ── Pre-flight: compute total and validate inputs ──────────────────
        for (uint256 i = 0; i < len; ) {
            if (receivers[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert ZeroAmount();
            totalRequired += amounts[i];
            unchecked { ++i; }
        }

        if (address(this).balance < totalRequired) revert InsufficientVaultBalance();

        // ── Execute transfers ──────────────────────────────────────────────
        for (uint256 i = 0; i < len; ) {
            (bool success, ) = receivers[i].call{value: amounts[i]}("");
            if (!success) revert TransferFailed();
            unchecked { ++i; }
        }

        emit BatchExecuted(len, totalRequired);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Owner-only Admin Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update the authorized relayer address.
     * @param _newRelayer  New relayer address.
     */
    function setRelayer(address _newRelayer) external onlyOwner {
        if (_newRelayer == address(0)) revert ZeroAddress();
        emit RelayerUpdated(relayer, _newRelayer);
        relayer = _newRelayer;
    }

    /**
     * @notice Emergency withdrawal of stuck funds (owner-only).
     * @param to      Recipient address.
     * @param amount  Amount of BNB to withdraw.
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (address(this).balance < amount) revert InsufficientVaultBalance();
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Total BNB held in the vault.
    function vaultBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Total intents registered since deployment.
    function totalIntents() external view returns (uint256) {
        return _intentCounter;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Receive / Fallback
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Accept plain BNB transfers (e.g. from owner top-up for gas reserve).
    receive() external payable {}
}
