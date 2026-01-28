use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;

// Sui RPC URL (Testnet)
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
    // error: Option<serde_json::Value>, // 简化错误处理
}

#[derive(Deserialize, Debug)]
struct EventPage {
    data: Vec<SuiEvent>,
    next_cursor: Option<EventID>,
}

#[derive(Deserialize, Debug)]
struct SuiEvent {
    // tx_digest: String,
    // event_seq: String,
    parsedJson: Option<PaymentEventData>, // 注意：RPC 返回的字段可能是 camelCase
    // type: String,
}

#[derive(Deserialize, Debug)]
struct EventID {
    txDigest: String,
    eventSeq: String,
}

// 对应 Move 合约中的 PaymentReceived 事件结构
#[derive(Deserialize, Debug)]
struct PaymentEventData {
    // merchant: String,
    // amount: String, // u64 在 JSON 中可能是 string
    ref_id: String, // 或者是 vector<u8>，需要根据实际返回处理，假设我们传的是字符串的字节
}

pub async fn start_indexer(pool: Pool<Postgres>, package_id: String) {
    let client = reqwest::Client::new();
    let mut cursor = None;

    println!("🚀 Starting Sui Indexer for package: {}", package_id);

    loop {
        // 构建查询参数
        let filter = serde_json::json!({
            "MoveModule": {
                "package": package_id,
                "module": "payment"
            }
        });

        let params = vec![
            filter,
            serde_json::Value::Null, // cursor (首次为 null)
            serde_json::json!(10),   // limit
            serde_json::json!(true)  // descending_order (为了演示方便，实际应该由旧到新)
        ];
        
        // 注意：生产环境应该正确的处理分页和 cursor，由旧到新同步
        // 这里为了黑客松演示，我们简化为：每 5 秒查一次最新的事件

        match query_events(&client, &package_id).await {
            Ok(events) => {
                for event in events {
                    if let Some(data) = event.parsedJson {
                        // ref_id 在 Move 里是 vector<u8>，JSON RPC 返回时可能是 string 或 array
                        // 假设我们存的是 UUID 字符串
                        let order_id_str = parse_ref_id(&data.ref_id);
                        
                        println!("🔎 Found payment event for Order: {}", order_id_str);

                        // 更新数据库
                        if let Ok(uuid) = uuid::Uuid::parse_str(&order_id_str) {
                            let result = sqlx::query!(
                                "UPDATE orders SET status = 'PAID' WHERE id = $1 AND status = 'PENDING'",
                                uuid
                            )
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
            serde_json::json!(true) // descending = true, 获取最新的
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

// 辅助函数：处理 Move vector<u8> 到 String 的转换
// 实际上 Sui JSON RPC 对 string 类型的 vector<u8> 通常直接返回字符串
fn parse_ref_id(input: &str) -> String {
    input.to_string()
}
