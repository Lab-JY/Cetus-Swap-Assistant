module suipay::payment {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use std::string::String;
    
    // --- Error Codes ---
    const EInsufficientBalance: u64 = 1;
    const EOrderAlreadyPaid: u64 = 2;
    // const ENotMerchant: u64 = 3;
    const ENotAuthorized: u64 = 4; 
    const EWrongMerchant: u64 = 5; 

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
        cap_id: ID, 
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

    /// ✨ 新增：创建订单
    public entry fun create_order<T>(
        account: &MerchantAccount<T>,
        amount: u64,
        order_id: String,
        ctx: &mut TxContext
    ) {
        let order = Order {
            id: object::new(ctx),
            merchant_account: object::uid_to_address(&account.id),
            amount,
            status: STATUS_PENDING,
            order_id,
        };
        transfer::share_object(order);
    }

    public entry fun pay_order<T>(
        account: &mut MerchantAccount<T>,
        order: &mut Order,
        mut payment: Coin<T>,
        ctx: &mut TxContext
    ) {
        let payment_amount = coin::value(&payment);
        
        // 1. Check if payment amount is sufficient
        assert!(payment_amount >= order.amount, EInsufficientBalance);
        
        // 2. Check if order is already paid
        assert!(order.status == STATUS_PENDING, EOrderAlreadyPaid);

        // 3. Verify Merchant
        assert!(object::uid_to_address(&account.id) == order.merchant_account, EWrongMerchant);
        
        // 4. Update Order status
        order.status = STATUS_PAID;
        
        // 5. Handle excess payment (refund)
        if (payment_amount > order.amount) {
            let refund = coin::split(&mut payment, payment_amount - order.amount, ctx);
            transfer::public_transfer(refund, ctx.sender());
        };

        // 6. Deposit to Merchant Account
        let paid_amount = coin::into_balance(payment);
        balance::join(&mut account.balance, paid_amount);
        account.total_received = account.total_received + order.amount;

        // 7. Emit Event for StableLayer Tracking
        event::emit(PaymentReceived {
            merchant: account.owner,
            amount: order.amount,
            order_id: object::uid_to_inner(&order.id),
            ref_id: order.order_id,
            yield_active: account.auto_yield, 
        });
    }

    /// ✨ Enable/Disable Auto-Yield for StableLayer
    public entry fun set_auto_yield<T>(
        account: &mut MerchantAccount<T>,
        cap: &MerchantCap,
        enable: bool,
        _ctx: &mut TxContext
    ) {
        // Verify ownership via Cap ID
        assert!(object::uid_to_inner(&cap.id) == account.cap_id, ENotAuthorized);
        account.auto_yield = enable;
    }
    
    /// ✨ Withdraw funds (for Payroll)
    public entry fun withdraw<T>(
        account: &mut MerchantAccount<T>,
        cap: &MerchantCap,
        amount: u64,
        ctx: &mut TxContext
    ) {
        assert!(object::uid_to_inner(&cap.id) == account.cap_id, ENotAuthorized);
        assert!(balance::value(&account.balance) >= amount, EInsufficientBalance);
        
        let withdraw_coin = coin::take(&mut account.balance, amount, ctx);
        transfer::public_transfer(withdraw_coin, account.owner);
    }
}
