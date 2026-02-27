// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AegisVault.sol";

/**
 * @dev Deploy AegisVault to any EVM-compatible chain.
 *
 * Usage:
 *   forge script script/Deploy.s.sol:DeployAegisVault \
 *     --rpc-url $RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $BSCSCAN_API_KEY \
 *     -vvvv
 */
contract DeployAegisVault is Script {
    function run() external returns (AegisVault vault) {
        // The relayer address must be set in env
        address relayerAddr = vm.envAddress("RELAYER_ADDRESS");

        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console2.log("=================================================");
        console2.log("Deploying AegisVault");
        console2.log("  Deployer:  ", deployer);
        console2.log("  Relayer:   ", relayerAddr);
        console2.log("  Chain ID:  ", block.chainid);
        console2.log("=================================================");

        vm.startBroadcast(deployerKey);
        vault = new AegisVault(relayerAddr);
        vm.stopBroadcast();

        console2.log("AegisVault deployed at:", address(vault));
        console2.log("BSCScan: https://testnet.bscscan.com/address/", address(vault));
    }
}
