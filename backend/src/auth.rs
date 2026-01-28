use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use jsonwebtoken::{encode, decode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::env;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // Sui Address
    pub exp: usize,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub address: String,
    pub signature: String,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct ZkLoginVerifyRequest {
    pub jwt: String, // Google 返回的 JWT
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub sui_address: String,
}

pub enum AuthError {
    InvalidToken,
    MissingCredentials,
    ZkLoginError(String),
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let (status, msg) = match self {
            AuthError::InvalidToken => (StatusCode::UNAUTHORIZED, "Invalid token"),
            AuthError::MissingCredentials => (StatusCode::BAD_REQUEST, "Missing credentials"),
            AuthError::ZkLoginError(s) => (StatusCode::BAD_REQUEST, s.as_str()),
        };
        (status, Json(serde_json::json!({ "error": msg }))).into_response()
    }
}

pub async fn login_handler(Json(payload): Json<LoginRequest>) -> Result<Json<LoginResponse>, AuthError> {
    // ... 保持原有钱包签名登录逻辑 ...
    let expiration = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as usize + 86400;
    let claims = Claims { sub: payload.address.clone(), exp: expiration };
    let secret = env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes())).map_err(|_| AuthError::InvalidToken)?;

    Ok(Json(LoginResponse { token, sui_address: payload.address }))
}

/// 🚀 zkLogin 验证逻辑
pub async fn zklogin_verify_handler(Json(payload): Json<ZkLoginVerifyRequest>) -> Result<Json<LoginResponse>, AuthError> {
    // 1. 验证 Google JWT (此处简化，演示逻辑)
    // 真实项目中需使用 jsonwebtoken::decode 配合 Google 的 JWKS (公钥集)
    println!("Verifying zkLogin JWT...");

    // 2. 获取/生成该用户的 Salt
    // 每个人（邮箱）对应的 Salt 应该是持久化存储且唯一的
    let user_salt = "1234567890"; // 示例：应从数据库获取

    // 3. 计算 Sui 地址
    // 逻辑：SuiAddress = Hash(JWT.sub, JWT.iss, JWT.aud, Salt)
    // 演示用：模拟生成一个地址
    let derived_sui_address = "0xzk_".to_string() + &payload.jwt[..10];

    // 4. 发放 JWT Token
    let expiration = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as usize + 86400;
    let claims = Claims { sub: derived_sui_address.clone(), exp: expiration };
    let secret = env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes())).map_err(|_| AuthError::InvalidToken)?;

    Ok(Json(LoginResponse { token, sui_address: derived_sui_address }))
}

#[async_trait]
impl<S> FromRequestParts<S> for Claims where S: Send + Sync {
    type Rejection = AuthError;
    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let TypedHeader(Authorization(bearer)) = parts.extract::<TypedHeader<Authorization<Bearer>>>().await.map_err(|_| AuthError::InvalidToken)?;
        let secret = env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());
        let token_data = decode::<Claims>(bearer.token(), &DecodingKey::from_secret(secret.as_bytes()), &Validation::default()).map_err(|_| AuthError::InvalidToken)?;
        Ok(token_data.claims)
    }
}