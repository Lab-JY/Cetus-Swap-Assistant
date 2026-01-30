'use strict';
'use client';

import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@mysten/dapp-kit/dist/index.css';

import { SUI_NETWORK } from "@/utils/config";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
	const networks = { 
		testnet: { url: getFullnodeUrl('testnet') },
		mainnet: { url: getFullnodeUrl('mainnet') } 
	};

	return (
		<QueryClientProvider client={queryClient}>
			<SuiClientProvider networks={networks} defaultNetwork={SUI_NETWORK as 'mainnet' | 'testnet'}>
				<WalletProvider autoConnect>
					{children}
				</WalletProvider>
			</SuiClientProvider>
		</QueryClientProvider>
	);
}
