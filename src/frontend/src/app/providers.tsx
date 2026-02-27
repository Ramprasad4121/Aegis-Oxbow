'use client';

import { ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { bscTestnet } from 'wagmi/chains';
import { RainbowKitProvider, darkTheme, connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  trustWallet,
  coinbaseWallet,
  rabbyWallet,
  injectedWallet
} from '@rainbow-me/rainbowkit/wallets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@rainbow-me/rainbowkit/styles.css';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Suggested',
      wallets: [metaMaskWallet, trustWallet, coinbaseWallet, rabbyWallet, injectedWallet],
    },
  ],
  {
    appName: 'Aegis-Oxbow',
    projectId: 'YOUR_PROJECT_ID', // WalletConnect requires this, but we can leave a dummy for now if we don't strictly use the QR code feature
  }
);

const config = createConfig({
  chains: [bscTestnet],
  connectors,
  transports: {
    [bscTestnet.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL ??
        'https://data-seed-prebsc-1-s1.binance.org:8545/'
    ),
  },
  ssr: true,
});

const queryClient = new QueryClient();

// Terminal-minimalist theme — BNB Yellow accent, sharp corners, true black
const aegisTheme = darkTheme({
  accentColor: '#F0B90B',
  accentColorForeground: '#000',
  borderRadius: 'none',
  fontStack: 'system',
  overlayBlur: 'none',
});
aegisTheme.colors.modalBackground              = '#0a0a0a';
aegisTheme.colors.modalBorder                  = '#27272a';
aegisTheme.colors.profileForeground            = '#0a0a0a';
aegisTheme.colors.connectButtonBackground      = '#000';
aegisTheme.colors.connectButtonInnerBackground = '#0a0a0a';
aegisTheme.colors.connectButtonText            = '#F0B90B';
aegisTheme.colors.menuItemBackground           = '#0a0a0a';
aegisTheme.colors.actionButtonBorder           = '#27272a';
aegisTheme.colors.generalBorder                = '#27272a';
aegisTheme.colors.generalBorderDim             = '#18181b';
aegisTheme.colors.selectedOptionBorder         = '#F0B90B';
aegisTheme.radii.connectButton                 = '0px';
aegisTheme.radii.modal                         = '0px';
aegisTheme.radii.menuButton                    = '0px';
aegisTheme.radii.modalMobile                   = '0px';
aegisTheme.radii.actionButton                  = '0px';
aegisTheme.fonts.body                          = "'Fira Code', 'Courier New', monospace";

export default function Web3Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={aegisTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
