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
use sqlx::{postgres::PgPoolOptions, Pool, Postgres};
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

#[derive(Serialize, Deserialize, sqlx::FromRow)]
struct Employee {
    id: i32,
    name: String,
    wallet_address: String,
    salary_amount: i64,
    role: Option<String>,
}

// ✨ 新增：商户数据汇总结构
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
        .unwrap_or_else(|_| "0x0000000000000000000000000000000000000000000000000000000000000000".to_string());

    let pool = PgPoolOptions::new().max_connections(5).connect(&database_url).await?;
    let schema = std::fs::read_to_string("schema.sql")?;
    sqlx::query(&schema).execute(&pool).await?;

    let state = AppState { db: pool.clone() };

    if package_id != "0x0000000000000000000000000000000000000000000000000000000000000000" {
        let indexer_pool = pool.clone();
        tokio::spawn(async move { indexer::start_indexer(indexer_pool, package_id).await; });
    }

    let app = Router::new()
        .route("/auth/login", post(login_handler))
        .route("/auth/zklogin/verify", post(zklogin_verify_handler))
        .route("/orders", post(create_order))
        .route("/orders/:id", get(get_order))
        .route("/employees", get(get_employees))
        .route("/merchant/summary", get(get_merchant_summary)) // ✨ 新增汇总接口
        .layer(CorsLayer::new().allow_origin(Any).allow_headers(Any).allow_methods(Any))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    println!("Backend server listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn create_order(claims: Claims, State(state): State<AppState>, Json(payload): Json<CreateOrderRequest>) -> Result<Json<Order>, (StatusCode, String)> {
    let order_id = Uuid::new_v4();
    let currency = payload.currency.unwrap_or_else(|| "USDC".to_string());
    sqlx::query!("INSERT INTO orders (id, merchant_address, amount, currency, status) VALUES ($1, $2, $3, $4, 'PENDING')", order_id, claims.sub, payload.amount, currency).execute(&state.db).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(Order { id: order_id, merchant_address: claims.sub, amount: payload.amount, currency, status: "PENDING".to_string() }))
}

async fn get_order(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<Order>, (StatusCode, String)> {
    let order = sqlx::query_as!(Order, r#"SELECT id, merchant_address, amount, currency, status FROM orders WHERE id = $1"#, id).fetch_optional(&state.db).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?.ok_or((StatusCode::NOT_FOUND, "Order not found".to_string()))?;
    Ok(Json(order))
}

async fn get_employees(claims: Claims, State(state): State<AppState>) -> Result<Json<Vec<Employee>>, (StatusCode, String)> {
    let employees = sqlx::query_as!(Employee, r#"SELECT id, name, wallet_address, salary_amount, role FROM employees"#).fetch_all(&state.db).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(employees))
}

// ✨ 汇总接口实现
async fn get_merchant_summary(claims: Claims, State(state): State<AppState>) -> Result<Json<MerchantSummary>, (StatusCode, String)> {
    let merchant_address = claims.sub;

    let order_stats = sqlx::query!(
        "SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM orders WHERE merchant_address = $1 AND status = 'PAID'",
        merchant_address
    ).fetch_one(&state.db).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let employee_count = sqlx::query!(
        "SELECT COUNT(*) as count FROM employees"
    ).fetch_one(&state.db).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(MerchantSummary {
        total_revenue: order_stats.total.unwrap_or(0),
        order_count: order_stats.count.unwrap_or(0),
        employee_count: employee_count.count.unwrap_or(0),
    }))
}