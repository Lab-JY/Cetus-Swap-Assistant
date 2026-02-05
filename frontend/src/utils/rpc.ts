import { SuiClient } from '@mysten/sui/client';
import type { Transaction } from '@mysten/sui/transactions';
import { SUI_NETWORK } from './config';

const parseEnvUrls = (raw?: string): string[] => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
};

const DEFAULT_RPC_URLS: Record<'mainnet' | 'testnet', string[]> = {
  mainnet: ['https://fullnode.mainnet.sui.io:443'],
  testnet: ['https://fullnode.testnet.sui.io:443'],
};

const MAINNET_RPC_ENV = process.env.NEXT_PUBLIC_SUI_RPC_URLS_MAINNET;
const TESTNET_RPC_ENV = process.env.NEXT_PUBLIC_SUI_RPC_URLS_TESTNET;

const buildRpcList = (network: 'mainnet' | 'testnet'): string[] => {
  const fromEnv = parseEnvUrls(network === 'mainnet' ? MAINNET_RPC_ENV : TESTNET_RPC_ENV);
  const merged = [...fromEnv, ...DEFAULT_RPC_URLS[network]];
  return Array.from(new Set(merged));
};

const clientCache = new Map<string, SuiClient>();
const healthCache = new Map<string, { ok: boolean; ts: number }>();
const HEALTH_TTL_MS = 15_000;
const HEALTH_TIMEOUT_MS = 3_000;

const getClient = (url: string) => {
  if (!clientCache.has(url)) {
    clientCache.set(url, new SuiClient({ url }));
  }
  return clientCache.get(url)!;
};

type SuiClientWithOptionalMethods = SuiClient & {
  getLatestSuiSystemState?: () => Promise<unknown>;
  getChainIdentifier?: () => Promise<unknown>;
  getReferenceGasPrice?: () => Promise<unknown>;
};

type SuiClientWithDryRun = SuiClient & {
  dryRunTransactionBlock: (args: { transactionBlock: Uint8Array | string }) => Promise<unknown>;
};

type TransactionLike = Transaction & {
  build: (args: { client: SuiClient }) => Promise<Uint8Array | string>;
};

const pingClient = async (client: SuiClient) => {
  const checkClient = client as SuiClientWithOptionalMethods;
  if (typeof checkClient.getLatestSuiSystemState === 'function') {
    return await checkClient.getLatestSuiSystemState();
  }
  if (typeof checkClient.getChainIdentifier === 'function') {
    return await checkClient.getChainIdentifier();
  }
  if (typeof checkClient.getReferenceGasPrice === 'function') {
    return await checkClient.getReferenceGasPrice();
  }
  return true;
};

const withTimeout = async <T>(promise: Promise<T>, ms: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), ms);
      promise.then(resolve).catch(reject);
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const isHealthy = async (url: string) => {
  const cached = healthCache.get(url);
  const now = Date.now();
  if (cached && now - cached.ts < HEALTH_TTL_MS) return cached.ok;

  try {
    await withTimeout(pingClient(getClient(url)), HEALTH_TIMEOUT_MS);
    healthCache.set(url, { ok: true, ts: now });
    return true;
  } catch {
    healthCache.set(url, { ok: false, ts: now });
    return false;
  }
};

export const getHealthySuiClient = async (network: 'mainnet' | 'testnet' = SUI_NETWORK) => {
  const urls = buildRpcList(network);
  for (const url of urls) {
    if (await isHealthy(url)) {
      return { client: getClient(url), url };
    }
  }
  // Fallback to first URL even if health check fails
  const url = urls[0];
  return { client: getClient(url), url };
};

export const dryRunWithFallback = async (
  tx: TransactionLike,
  primaryClient: SuiClient,
  network: 'mainnet' | 'testnet' = SUI_NETWORK
) => {
  try {
    const bytes = await tx.build({ client: primaryClient });
    const result = await (primaryClient as SuiClientWithDryRun).dryRunTransactionBlock({ transactionBlock: bytes });
    return { result, usedUrl: 'wallet', fallback: false };
  } catch (primaryError) {
    const { client, url } = await getHealthySuiClient(network);
    const bytes = await tx.build({ client });
    const result = await (client as SuiClientWithDryRun).dryRunTransactionBlock({ transactionBlock: bytes });
    return { result, usedUrl: url, fallback: true, primaryError };
  }
};
