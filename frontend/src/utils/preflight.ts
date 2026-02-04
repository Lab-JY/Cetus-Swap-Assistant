import type { SuiClient } from '@mysten/sui/client';
import type { Transaction } from '@mysten/sui/transactions';
import { SUI_NETWORK } from './config';
import { dryRunWithFallback } from './rpc';

export type PreflightResult = {
  ok: boolean;
  reason?: string;
  gasUsed?: string;
  gasEstimate?: bigint;
  usedUrl?: string;
  fallback?: boolean;
};

export const preflightTransaction = async (
  tx: Transaction,
  client: SuiClient,
  network: 'mainnet' | 'testnet' = SUI_NETWORK
): Promise<PreflightResult> => {
  try {
    const { result, usedUrl, fallback } = await dryRunWithFallback(tx, client, network);
    const status = result?.effects?.status;
    if (status?.status === 'success') {
      const gasUsed = result?.effects?.gasUsed;
      const computationCost = BigInt(gasUsed?.computationCost || 0);
      const storageCost = BigInt(gasUsed?.storageCost || 0);
      const storageRebate = BigInt(gasUsed?.storageRebate || 0);
      
      const netGas = computationCost + storageCost - storageRebate;
      const estimatedBudget = computationCost + storageCost; // Budget needs to cover full cost upfront

      return {
        ok: true,
        gasUsed: (Number(netGas) / 1e9).toFixed(4),
        gasEstimate: estimatedBudget,
        usedUrl,
        fallback,
      };
    }

    return {
      ok: false,
      reason: status?.error || 'Dry run failed',
      usedUrl,
      fallback,
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
};
