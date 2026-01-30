module cetus_swap::swap_helper;

use sui::coin::Coin;
use sui::event;
use sui::table;
use std::type_name;
use std::ascii;

/// Capability for managing the swap registry
public struct AdminCap has key {
    id: sui::object::UID,
}

/// Swap record stored on-chain
public struct SwapRecord has store, copy, drop {
    user: address,
    from_coin: ascii::String,
    to_coin: ascii::String,
    amount_in: u64,
    amount_out: u64,
    timestamp: u64,
}

/// User statistics tracking
public struct UserStats has store {
    total_swaps: u64,
    total_volume_in: u64,
    total_volume_out: u64,
    last_swap_time: u64,
}

/// Global swap registry
public struct SwapRegistry has key {
    id: sui::object::UID,
    swap_records: table::Table<u64, SwapRecord>,
    user_stats: table::Table<address, UserStats>,
    total_swaps: u64,
    total_volume: u64,
}

/// Event emitted when a swap is completed
public struct SwapEvent has copy, drop {
    user: address,
    from_coin: ascii::String,
    to_coin: ascii::String,
    amount_in: u64,
    amount_out: u64,
    timestamp: u64,
}

/// Event emitted when user statistics are updated
public struct UserStatsUpdated has copy, drop {
    user: address,
    total_swaps: u64,
    total_volume_in: u64,
    total_volume_out: u64,
}

/// Event emitted when registry is initialized
public struct RegistryInitialized has copy, drop {
    admin: address,
    timestamp: u64,
}

/// Initialize the swap registry (called once)
public entry fun init_registry(ctx: &mut sui::tx_context::TxContext) {
    let admin_cap = AdminCap {
        id: object::new(ctx),
    };

    let registry = SwapRegistry {
        id: object::new(ctx),
        swap_records: table::new(ctx),
        user_stats: table::new(ctx),
        total_swaps: 0,
        total_volume: 0,
    };

    event::emit(RegistryInitialized {
        admin: tx_context::sender(ctx),
        timestamp: tx_context::epoch(ctx),
    });

    transfer::share_object(registry);
    transfer::transfer(admin_cap, tx_context::sender(ctx));
}

/// Execute a swap and record it on-chain
public entry fun execute_swap<T>(
    coin: Coin<T>,
    recipient: address,
    amount_out: u64,
    registry: &mut SwapRegistry,
    to_coin_type: ascii::String,
    ctx: &mut sui::tx_context::TxContext
) {
    let sender = tx_context::sender(ctx);
    let amount_in = coin.value();
    let from_coin_type = type_name::get<T>().into_string();
    let timestamp = tx_context::epoch(ctx);

    // Create swap record
    let swap_record = SwapRecord {
        user: sender,
        from_coin: from_coin_type,
        to_coin: to_coin_type,
        amount_in,
        amount_out,
        timestamp,
    };

    // Update registry
    let swap_id = registry.total_swaps;
    table::add(&mut registry.swap_records, swap_id, swap_record);
    registry.total_swaps = registry.total_swaps + 1;
    registry.total_volume = registry.total_volume + amount_in;

    // Update user statistics
    if (table::contains(&registry.user_stats, sender)) {
        let stats = table::borrow_mut(&mut registry.user_stats, sender);
        stats.total_swaps = stats.total_swaps + 1;
        stats.total_volume_in = stats.total_volume_in + amount_in;
        stats.total_volume_out = stats.total_volume_out + amount_out;
        stats.last_swap_time = timestamp;

        event::emit(UserStatsUpdated {
            user: sender,
            total_swaps: stats.total_swaps,
            total_volume_in: stats.total_volume_in,
            total_volume_out: stats.total_volume_out,
        });
    } else {
        let new_stats = UserStats {
            total_swaps: 1,
            total_volume_in: amount_in,
            total_volume_out: amount_out,
            last_swap_time: timestamp,
        };
        table::add(&mut registry.user_stats, sender, new_stats);

        event::emit(UserStatsUpdated {
            user: sender,
            total_swaps: 1,
            total_volume_in: amount_in,
            total_volume_out: amount_out,
        });
    };

    // Emit swap event
    event::emit(SwapEvent {
        user: sender,
        from_coin: from_coin_type,
        to_coin: to_coin_type,
        amount_in,
        amount_out,
        timestamp,
    });

    // Transfer coin to recipient
    transfer::public_transfer(coin, recipient);
}

/// Get user statistics
public fun get_user_stats(
    registry: &SwapRegistry,
    user: address,
): (u64, u64, u64, u64) {
    if (table::contains(&registry.user_stats, user)) {
        let stats = table::borrow(&registry.user_stats, user);
        (stats.total_swaps, stats.total_volume_in, stats.total_volume_out, stats.last_swap_time)
    } else {
        (0, 0, 0, 0)
    }
}

/// Get total registry statistics
public fun get_registry_stats(registry: &SwapRegistry): (u64, u64) {
    (registry.total_swaps, registry.total_volume)
}

/// Record a swap event (called after swap is completed)
public entry fun record_swap_event(
    from_coin: ascii::String,
    to_coin: ascii::String,
    amount_in: u64,
    amount_out: u64,
    ctx: &mut sui::tx_context::TxContext
) {
    event::emit(SwapEvent {
        user: tx_context::sender(ctx),
        from_coin,
        to_coin,
        amount_in,
        amount_out,
        timestamp: tx_context::epoch(ctx),
    });
}

/// Legacy function for backward compatibility
public entry fun transfer_with_event<T>(
    coin: Coin<T>,
    recipient: address,
    ctx: &sui::tx_context::TxContext
) {
    let amount = coin.value();
    let type_name = type_name::get<T>();

    event::emit(SwapEvent {
        user: tx_context::sender(ctx),
        from_coin: type_name.into_string(),
        to_coin: ascii::string(b"unknown"),
        amount_in: amount,
        amount_out: 0,
        timestamp: tx_context::epoch(ctx),
    });

    transfer::public_transfer(coin, recipient);
}

