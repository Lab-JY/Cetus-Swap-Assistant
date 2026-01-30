module cetus_swap::swap_helper;

use sui::coin::Coin;
use sui::event;
use std::type_name;
use std::ascii;

/// Event emitted when a swap is completed and funds are transferred
public struct SwapEvent has copy, drop {
    user: address,
    coin_type: ascii::String,
    amount: u64
}

/// Helper function to transfer a coin and emit a log event.
/// This should be called at the end of the PTB (Programmable Transaction Block)
/// instead of a standard transfer, to record the volume on-chain.
public entry fun transfer_with_event<T>(
    coin: Coin<T>,
    recipient: address,
    ctx: &TxContext
) {
    let amount = coin.value();
    let type_name = type_name::get<T>();
    
    event::emit(SwapEvent {
        user: ctx.sender(),
        coin_type: type_name.into_string(),
        amount
    });

    transfer::public_transfer(coin, recipient);
}
