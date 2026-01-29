mod indexer;
mod auth;

use crate::auth::{login_handler, zklogin_verify_handler, Claims};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgPoolOptions, Pool, Postgres, Row}; // ✨ 导入 Row
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    db: Pool<Postgres>,
}

#[derive(Serialize, Deserialize, sqlx::FromRow)]
struct Order {
    id: Uuid,
    merchant_address: String,
    amount: i64, 
    currency: String,
    status: String,
}

#[derive(Deserialize)]
struct CreateOrderRequest {
    amount: i64,
    currency: Option<String>,
}

#[derive(Deserialize)]
struct CreateEmployeeRequest {
    name: String,
    wallet_address: String,
    salary_amount: i64,
    role: String,
}

async fn add_employee(_claims: Claims, State(state): State<AppState>, Json(payload): Json<CreateEmployeeRequest>) -> Result<Json<Employee>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, Employee>("INSERT INTO employees (name, wallet_address, salary_amount, role) VALUES ($1, $2, $3, $4) RETURNING id, name, wallet_address, salary_amount, role")
        .bind(payload.name)
        .bind(payload.wallet_address)
        .bind(payload.salary_amount)
        .bind(payload.role)
        .fetch_one(&state.db)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(row))
}


#[derive(Serialize, Deserialize, sqlx::FromRow)]
struct Employee {
    id: i32,
    name: String,
    wallet_address: String,
    salary_amount: i64,
    role: Option<String>,
}

#[derive(Serialize)]
struct MerchantSummary {
    total_revenue: i64,
    order_count: i64,
    employee_count: i64,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();
    dotenv::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let package_id = std::env::var("SUIPAY_PACKAGE_ID")
        .unwrap_or_else(|_| "0x0".to_string());

    let pool = PgPoolOptions::new().max_connections(5).connect(&database_url).await?;
    
    // 注意：在实际运行前，请确保手动运行了 schema.sql 或使用 sqlx migrate
    // 为了防止编译卡死，我们在这里只做简单的连接

    let state = AppState { db: pool.clone() };

    if package_id != "0x0" {
        let indexer_pool = pool.clone();
        tokio::spawn(async move { indexer::start_indexer(indexer_pool, package_id).await; });
    }

    let app = Router::new()
        .route("/auth/login", post(login_handler))
        .route("/auth/zklogin/verify", post(zklogin_verify_handler))
        .route("/orders", post(create_order))
        .route("/orders/:id", get(get_order))
        .route("/employees", get(get_employees).post(add_employee))
        .route("/merchant/summary", get(get_merchant_summary))
        .route("/merchant/rebalance", post(record_rebalance)) // ✨ New Audit Endpoint
        .layer(CorsLayer::new().allow_origin(Any).allow_headers(Any).allow_methods(Any))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3002));
    println!("Backend server listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

#[derive(Deserialize)]
struct RebalanceRequest {
    tx_digest: String,
    from_coin: String,
    to_coin: String,
    amount: f64,
}

async fn record_rebalance(claims: Claims, State(_state): State<AppState>, Json(payload): Json<RebalanceRequest>) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // In a real app, we would insert this into a 'treasury_audit_log' table
    println!("📝 [AUDIT] Rebalance recorded by Merchant: {}", claims.sub);
    println!("   TX: {}", payload.tx_digest);
    println!("   Action: Swap {} {} -> {}", payload.amount, payload.from_coin, payload.to_coin);
    
    // For MVP demo, just logging is enough to prove the backend is aware
    Ok(Json(serde_json::json!({ "status": "recorded", "audit_id": Uuid::new_v4() })))
}

async fn create_order(claims: Claims, State(state): State<AppState>, Json(payload): Json<CreateOrderRequest>) -> Result<Json<Order>, (StatusCode, String)> {
    let order_id = Uuid::new_v4();
    let currency = payload.currency.unwrap_or_else(|| "USDC".to_string());
    
    sqlx::query("INSERT INTO orders (id, merchant_address, amount, currency, status) VALUES ($1, $2, $3, $4, 'PENDING')")
        .bind(order_id)
        .bind(&claims.sub)
        .bind(payload.amount)
        .bind(&currency)
        .execute(&state.db)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(Order { id: order_id, merchant_address: claims.sub, amount: payload.amount, currency, status: "PENDING".to_string() }))
}

async fn get_order(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<Order>, (StatusCode, String)> {
    let order = sqlx::query_as::<_, Order>("SELECT id, merchant_address, amount, currency, status FROM orders WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Order not found".to_string()))?;

    Ok(Json(order))
}

// ✨ 仅用于演示/开发：强制将订单标记为支付成功
#[allow(dead_code)]
async fn mock_pay_order(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let result = sqlx::query("UPDATE orders SET status = 'PAID' WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Order not found".to_string()));
    }

    Ok(Json(serde_json::json!({ "status": "PAID", "mock": true })))
}

async fn get_employees(claims: Claims, State(state): State<AppState>) -> Result<Json<Vec<Employee>>, (StatusCode, String)> {
    println!("Auth user: {}", claims.sub);
    let employees = sqlx::query_as::<_, Employee>("SELECT id, name, wallet_address, salary_amount, role FROM employees")
        .fetch_all(&state.db)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(employees))
}

async fn get_merchant_summary(claims: Claims, State(state): State<AppState>) -> Result<Json<MerchantSummary>, (StatusCode, String)> {
    let merchant_address = claims.sub;

    let row = sqlx::query("SELECT COUNT(*) as count, COALESCE(SUM(amount), 0)::BIGINT as total FROM orders WHERE merchant_address = $1 AND status = 'PAID'")
        .bind(&merchant_address)
        .fetch_one(&state.db)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let count: i64 = row.get("count");
    let total: i64 = row.get("total");

    let emp_row = sqlx::query("SELECT COUNT(*) as count FROM employees")
        .fetch_one(&state.db)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    let emp_count: i64 = emp_row.get("count");

    Ok(Json(MerchantSummary {
        total_revenue: total,
        order_count: count,
        employee_count: emp_count,
    }))
}
