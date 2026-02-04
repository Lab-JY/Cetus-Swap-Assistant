/* eslint-disable @typescript-eslint/no-explicit-any */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { CETUS_SWAP_PACKAGE_ID } from "../config";

// 📊 Query History (Swap + Transfer)
export async function getSwapHistory(
    suiClient: any,
    userAddress: string,
    registryObjectId: string,
    limit: number = 50
) {
    try {
        const normalizedUserAddress = normalizeSuiAddress(userAddress);

        // 1. Fetch Swap Events
        const swapEventsPromise = suiClient.queryEvents({
            query: { MoveEventType: `${CETUS_SWAP_PACKAGE_ID}::swap_helper::SwapEvent` },
            limit: limit
        });

        // 2. Fetch Transfer Events
        const transferEventsPromise = suiClient.queryEvents({
            query: { MoveEventType: `${CETUS_SWAP_PACKAGE_ID}::swap_helper::TransferEvent` },
            limit: limit
        });

        const [swapEvents, transferEvents] = await Promise.all([swapEventsPromise, transferEventsPromise]);
        
        const combinedEvents: any[] = [];

        // Process Swaps
        if (swapEvents && swapEvents.data) {
            combinedEvents.push(...swapEvents.data.map((event: any) => ({
                ...event,
                type: 'swap'
            })));
        }

        // Process Transfers
        if (transferEvents && transferEvents.data) {
            combinedEvents.push(...transferEvents.data.map((event: any) => ({
                ...event,
                type: 'transfer'
            })));
        }

        // Filter and Sort
        const userEvents = combinedEvents
            .filter((event: any) => {
                const data = event.parsedJson as any;
                
                // Normalize addresses for comparison
                // For swaps: user is 'user'. For transfers: user could be 'sender' or 'recipient'
                if (event.type === 'swap') {
                    // Check both data.user (Move event field) AND event.sender (Tx signer)
                    // Zap transactions might be signed by user but event.user refers to Router
                    const isUserMatch = data.user && normalizeSuiAddress(data.user) === normalizedUserAddress;
                    const isSenderMatch = event.sender && normalizeSuiAddress(event.sender) === normalizedUserAddress;
                    return isUserMatch || isSenderMatch;
                }
                if (event.type === 'transfer') {
                    const isSender = data.sender && normalizeSuiAddress(data.sender) === normalizedUserAddress;
                    const isRecipient = data.recipient && normalizeSuiAddress(data.recipient) === normalizedUserAddress;
                    return isSender || isRecipient;
                }
                return false;
            })
            .sort((a: any, b: any) => {
                const aTime = Number(a.timestampMs || (a.parsedJson as any).timestamp || 0);
                const bTime = Number(b.timestampMs || (b.parsedJson as any).timestamp || 0);
                return bTime - aTime;
            })
            .slice(0, limit);

        return userEvents.map((event: any) => {
            const data = event.parsedJson as any;
            const timestamp = event.timestampMs ? Number(event.timestampMs) : Number(data.timestamp);
            
            if (event.type === 'swap') {
                return {
                    type: 'swap' as const,
                    user: data.user,
                    fromCoin: data.from_coin,
                    toCoin: data.to_coin,
                    amountIn: data.amount_in,
                    amountOut: data.amount_out,
                    timestamp: timestamp,
                    txDigest: event.id?.txDigest || '',
                    memo: ''
                };
            } else {
                // Transfer
                // Ensure addresses are normalized for comparison to avoid case-sensitivity or 0x prefix issues
                const isSender = normalizeSuiAddress(data.sender) === normalizeSuiAddress(userAddress);
                const transferRecord = {
                    type: (isSender ? 'send' : 'receive') as 'send' | 'receive',
                    user: isSender ? data.sender : data.recipient,
                    otherParty: isSender ? data.recipient : data.sender, // The other person
                    fromCoin: data.coin_type,
                    toCoin: data.coin_type,
                    amountIn: data.amount,
                    amountOut: data.amount,
                    timestamp: timestamp,
                    txDigest: event.id?.txDigest || '',
                    memo: data.memo || ''
                };

                return transferRecord;
            }
        });
    } catch (error) {
        console.error("❌ Error fetching history:", error);
        return [];
    }
}
