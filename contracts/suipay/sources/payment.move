module suipay::payment {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use std::string::String;
    
    // --- Error Codes ---
    const EInsufficientBalance: u64 = 1;
    const EOrderAlreadyPaid: u64 = 2;
    const ENotMerchant: u64 = 3;
    const ENotAuthorized: u64 = 4; // ✨ 新增：未授权错误

    // --- Constants ---
    const STATUS_PENDING: u8 = 0;
    const STATUS_PAID: u8 = 1;

    // --- Core Objects ---

    public struct MerchantCap has key, store {
        id: UID,
        merchant_name: String,
    }

    public struct MerchantAccount<phantom T> has key {
        id: UID,
        owner: address,
        balance: Balance<T>,
        total_received: u64,
        auto_yield: bool, 
        cap_id: ID, // ✨ 核心改进：记录绑定的 Cap ID
    }

    public struct Order has key, store {
        id: UID,
        merchant_account: address,
        amount: u64,
        status: u8,
        order_id: String, 
    }

    // --- Events ---
    public struct PaymentReceived has copy, drop {
        merchant: address,
        amount: u64,
        order_id: ID,
        ref_id: String,
        yield_active: bool,
    }

    // --- Functions ---

    public entry fun create_merchant<T>(name: String, ctx: &mut TxContext) {
        let sender = ctx.sender();
        
        // 1. 先生成 Cap，并获取其 ID
        let cap_uid = object::new(ctx);
        let cap_id = object::uid_to_inner(&cap_uid);
        
        let merchant_cap = MerchantCap {
            id: cap_uid,
            merchant_name: name,
        };
        transfer::public_transfer(merchant_cap, sender);

        // 2. 创建 Account 并将 Cap ID 存入
        let merchant_account = MerchantAccount<T> {
            id: object::new(ctx),
            owner: sender,
            balance: balance::zero(),
            total_received: 0,
            auto_yield: false,
            cap_id, // ✨ 绑定
        };
        transfer::share_object(merchant_account);
    }

    public entry fun pay_order<T>(
        account: &mut MerchantAccount<T>,
        order: &mut Order,
        mut payment: Coin<T>,
        ctx: &mut TxContext
    ) {
        let order_amount = order.amount;
        assert!(order.status == STATUS_PENDING, EOrderAlreadyPaid);
        assert!(coin::value(&payment) >= order_amount, EInsufficientBalance);

        let paid_coin = coin::split(&mut payment, order_amount, ctx);
        
        // 逻辑保持不变...
        let paid_balance = coin::into_balance(paid_coin);
        account.balance.join(paid_balance);
        account.total_received = account.total_received + order_amount;

        if (coin::value(&payment) > 0) {
            transfer::public_transfer(payment, ctx.sender());
        } else {
            coin::destroy_zero(payment);
        };

        order.status = STATUS_PAID;
        event::emit(PaymentReceived {
            merchant: account.owner,
            amount: order_amount,
            order_id: object::id(order),
            ref_id: order.order_id,
            yield_active: account.auto_yield,
        });
    }

    /// 🛠️ 修复：增加权限校验
    public entry fun toggle_yield<T>(
        cap: &MerchantCap,
        account: &mut MerchantAccount<T>,
        _ctx: &mut TxContext
    ) {
        // ✨ 校验：传入的 Cap 必须是绑定的那个
        assert!(object::uid_to_inner(&cap.id) == account.cap_id, ENotAuthorized);
        account.auto_yield = !account.auto_yield;
    }

    /// 🛠️ 修复：增加权限校验
    public entry fun withdraw<T>(
        cap: &MerchantCap,
        account: &mut MerchantAccount<T>,
        ctx: &mut TxContext
    ) {
        // ✨ 校验：传入的 Cap 必须是绑定的那个
        assert!(object::uid_to_inner(&cap.id) == account.cap_id, ENotAuthorized);
        
        let amount = account.balance.value();
        let cash = coin::take(&mut account.balance, amount, ctx);
        transfer::public_transfer(cash, ctx.sender());
    }
}
