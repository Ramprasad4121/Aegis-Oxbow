// ABI for AegisVault — only the events and functions the relayer needs
export const AEGIS_VAULT_ABI = [
  // Events
  "event IntentRegistered(address indexed sender, address indexed receiver, uint256 amount, uint256 intentIndex)",
  "event BatchExecuted(uint256 batchSize, uint256 totalValue)",

  // executeBatch
  "function executeBatch(address[] calldata receivers, uint256[] calldata amounts) external",

  // View helpers
  "function vaultBalance() external view returns (uint256)",
  "function totalIntents() external view returns (uint256)",
  "function relayer() external view returns (address)",
] as const;
