# Cetus RoutePay

## 项目描述
Cetus RoutePay 是一个基于 Sui 的交易与支付终端，主打 **Cetus 聚合路由 + CLMM 兜底**、**PTB 原子 Zap（Swap + Send）**、**Move 2024 链上收据** 与 **zkLogin Web2 上手**。目标是在提升 Cetus 交易体验的同时，给评委展示可衡量的生态价值与可持续的商业化能力。

## 项目准备
1. **环境要求**
   - Node.js 18+
   - pnpm / npm
   - Sui CLI（可选，用于合约发布）

2. **安装与启动**
   ```bash
   git clone <your-repo-url>
   cd Cetus-RoutePay/frontend
   npm install
   cp .env.local.example .env.local
   npm run dev
   ```

3. **关键环境变量（.env.local）**
   - `NEXT_PUBLIC_SUI_NETWORK`：`mainnet` / `testnet`
   - `NEXT_PUBLIC_CETUS_SWAP_PACKAGE_ID`：合约包 ID
   - `NEXT_PUBLIC_ENABLE_RECEIPTS`：是否启用收据对象（`true/false`）
   - `NEXT_PUBLIC_CETUS_PARTNER_ID`：**已实现** Zap 分佣所需（可选）
   - `NEXT_PUBLIC_SUI_RPC_URLS_MAINNET` / `NEXT_PUBLIC_SUI_RPC_URLS_TESTNET`：自定义 RPC 兜底（可选）

4. **合约部署信息（Package ID）**
   - **Mainnet**：`0x94877beeabecc1f0bf5c6989a6dfd1deb6a69b31bcdcc9045b0a791e3169673f`
   - **Testnet**：`0x622bf94c8095556221e3798242e7939c9ec6a5cdc59f90ee148dd0cc72e13480`

5. **AI 使用披露**
   - 详见 `AI_USAGE_DISCLOSURE.md`（单一来源文档）

## 项目亮点
- **Cetus 价值增量**：聚合路由可视化 + 省费对比，且在聚合失败时自动 CLMM 兜底，提升交易成功率与体验。
- **PTB 原子 Zap**：Swap + Transfer 一次签名完成，面向“支付”与“转账”场景。
- **Move 2024 收据对象**：SwapReceipt / ZapReceipt 链上可分享、可索引。
- **服务层能力**：Quote 缓存、多 RPC 健康检查、Preflight 失败预判。
- **zkLogin 上手**：Web2 用户无钱包体验。
- **已实现 ✅ Cetus Partner 分佣（Zap-only）**：
  - 仅在 **Zap 模式 + 配置 `NEXT_PUBLIC_CETUS_PARTNER_ID` + 路由完全由 Cetus 提供** 时启用
  - **Swap 模式保持 0 收费**，对用户零感知
  - UI 展示分佣状态与可领取额度

## 技术 Roadmap
- **已完成**
  - 聚合路由 + CLMM 兜底（主网/测试网）
  - PTB 原子 Zap（Swap + Send）
  - Move 2024 收据对象（SwapReceipt / ZapReceipt）
  - zkLogin + 钱包双入口
  - 服务层（Quote 缓存 / RPC 兜底 / Preflight）
  - Cetus Partner Zap 分佣逻辑（仅 Zap）

- **规划中**
  - Limit Order / 更复杂的策略交易
  - Swap-as-a-Service SDK
  - 社交化分享与排行榜

## 商业收费方案
- **基础策略（已实现）**：
  - **Swap 免费**（不向用户加收任何费用）
  - **Zap 走 Cetus 官方返佣**（需要 Partner 账号与 `NEXT_PUBLIC_CETUS_PARTNER_ID`）
  - 用户支付的手续费不变，收入来自 Cetus 分佣，**对用户零感知**

- **可选增强（规划）**：
  - 付费 RPC / 交易加速
  - B2B 集成（嵌入式 Swap 组件）

## 操作指南
1. **Swap（免费）**
   - 选择 From/To 代币、输入数量，确认交易即可。

2. **Zap（Swap + Send）**
   - 选择 From/To，并填写接收地址。
   - 若满足 **Partner 分佣条件**，UI 会显示“Enabled”。否则自动降级为无分佣模式。

3. **收据分享**
   - 交易成功后会返回 Receipt ID。
   - 打开 `/receipt/<id>` 页面可生成分享卡片并导出 PNG。

4. **分佣查看**
   - 配置 `NEXT_PUBLIC_CETUS_PARTNER_ID` 后，页面会展示可领取分佣余额。
   - 实际领取需走 Cetus 官方 Partner 领取流程（如需，我可以补充完整领取步骤）。
