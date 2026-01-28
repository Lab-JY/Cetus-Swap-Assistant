use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use std::time::Duration;
use tokio::time::sleep;

const SUI_RPC_URL: &str = "https://fullnode.testnet.sui.io:443";

#[derive(Serialize)]
struct RpcRequest<'a> {
    jsonrpc: &'a str,
    id: u64,
    method: &'a str,
    params: Vec<serde_json::Value>,
}

#[derive(Deserialize, Debug)]
struct RpcResponse<T> {
    result: Option<T>,
}

#[derive(Deserialize, Debug)]
struct EventPage {
    data: Vec<SuiEvent>,
}

#[derive(Deserialize, Debug)]
struct SuiEvent {
    parsedJson: Option<PaymentEventData>,
}

#[derive(Deserialize, Debug)]
struct PaymentEventData {
    ref_id: String,
}

pub async fn start_indexer(pool: Pool<Postgres>, package_id: String) {
    let client = reqwest::Client::new();

    println!("🚀 Starting Sui Indexer for package: {}", package_id);

    loop {
        match query_events(&client, &package_id).await {
            Ok(events) => {
                for event in events {
                    if let Some(data) = event.parsedJson {
                        let order_id_str = data.ref_id;
                        
                        if let Ok(uuid) = uuid::Uuid::parse_str(&order_id_str) {
                            println!("🔎 Found payment event for Order: {}", uuid);

                            let result = sqlx::query("UPDATE orders SET status = 'PAID' WHERE id = $1 AND status = 'PENDING'")
                                .bind(uuid)
                                .execute(&pool)
                                .await;

                            match result {
                                Ok(rows) => {
                                    if rows.rows_affected() > 0 {
                                        println!("✅ Order {} marked as PAID!", uuid);
                                    }
                                }
                                Err(e) => eprintln!("❌ Failed to update DB: {}", e),
                            }
                        }
                    }
                }
            }
            Err(e) => eprintln!("⚠️ Indexer error: {}", e),
        }

        sleep(Duration::from_secs(2)).await;
    }
}

async fn query_events(client: &reqwest::Client, package_id: &str) -> Result<Vec<SuiEvent>, String> {
    let request = RpcRequest {
        jsonrpc: "2.0",
        id: 1,
        method: "suix_queryEvents",
        params: vec![
            serde_json::json!({
                "MoveModule": {
                    "package": package_id,
                    "module": "payment"
                }
            }),
            serde_json::Value::Null, 
            serde_json::json!(5), 
            serde_json::json!(true)
        ],
    };

    let res = client.post(SUI_RPC_URL)
        .json(&request)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body: RpcResponse<EventPage> = res.json().await.map_err(|e| e.to_string())?;
    
    Ok(body.result.map(|r| r.data).unwrap_or_default())
}