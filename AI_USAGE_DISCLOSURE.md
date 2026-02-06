# AI Usage Disclosure / AI 使用披露 (Sui Vibe Hackathon 2026)

This document satisfies **Rule #6: AI Usage Disclosure (Mandatory)**.
本文件用于满足比赛规则 **第 6 条：AI 使用披露（强制）**。

This is the **single source of truth** for AI usage in this repository.
本文件是本仓库 AI 使用信息的**唯一来源**。

## 1) AI Tools, Models, and Usage Scope / AI 工具、模型与使用范围

| Tool / 工具 | Model / Version / 模型版本 | Usage Scope / 使用范围 |
|---|---|---|
| Trae IDE | Gemini-3-Pro-Preview (200k) | Primary development agent for feature implementation, debugging, architecture decisions, and docs updates / 主要用于功能实现、调试、架构决策与文档更新 |
| Claude Code | Claude Haiku 4.5 | Refactoring, debugging, code writing, and documentation drafting / 用于重构、调试、代码编写与文档草拟 |
| Google Gemini | Gemini 3 Pro | Code analysis, design exploration, and solution comparison / 用于代码分析、方案探索与对比 |
| GitHub Copilot | GPT-5.2-Codex | Inline completion and boilerplate generation / 用于行内补全与模板代码生成 |
| OpenAI ChatGPT (Codex CLI) | GPT-5 | Integration fixes, API route adjustments, reliability improvements, and documentation cleanup / 用于集成修复、API 路由调整、稳定性优化与文档整理 |

## 2) Prompt Log (Exact Prompts) / 提示词日志（原文）

> Notes / 说明:
> - Prompts are listed as issued by contributors during development. / 提示词按开发过程中真实输入记录。
> - Sensitive secrets/keys are not included. / 不包含任何私钥或敏感凭据。

### Prompt 01 - zkLogin proving flow / zkLogin 证明流程
```text
Integrate the official Sui Proving Service (https://prover.mystenlabs.com/v1)
for zkLogin authentication. Create functions to:
1. Call the Proving Service to generate ZK proofs from JWT tokens
2. Sign transactions using zkLogin with ephemeral keys
3. Handle the complete flow from Google OAuth to transaction signing
```

### Prompt 02 - zkLogin TypeScript fix / zkLogin 类型修复
```text
Fix TypeScript errors in zkLogin signing:
- Error: "Argument of type 'Transaction' is not assignable to parameter of type 'Uint8Array'"
- The signTransaction method expects serialized bytes, not a Transaction object
- Need to serialize the transaction first, then sign the bytes
```

### Prompt 03 - getZkLoginSignature parameter fix / getZkLoginSignature 参数修复
```text
Fix the getZkLoginSignature() call - it's missing required parameters:
- The Proving Service returns: proofPoints, issBase64Details, headerBase64, addressSeed
- Need to pass userSignature (from ephemeral key signing) and maxEpoch
- Structure the inputs object correctly for the SDK
```

### Prompt 04 - Move 2024 contract upgrade / Move 2024 合约升级
```text
Upgrade the swap_helper.move contract to use Move 2024 syntax and advanced features:
1. Add AdminCap struct with key ability for access control
2. Create SwapRegistry with Tables for efficient on-chain storage
3. Add SwapRecord and UserStats structs for tracking
4. Implement events: SwapEvent, UserStatsUpdated, RegistryInitialized
5. Add functions: init_registry, execute_swap<T>, get_user_stats, get_registry_stats
6. Use generics, Tables, capabilities, and event emission
7. Ensure full Move 2024 compliance (edition = "2024")
```

### Prompt 05 - PTB analytics append / PTB 链上事件拼接
```text
How can I record swap events on-chain when using the Cetus SDK?
I want to make sure every swap transaction also calls my Move contract `record_swap_event`.
Modify `buildSimpleSwapTx` to append a MoveCall to the transaction block.
```

### Prompt 06 - Testnet aggregator support / Testnet 聚合路由支持
```text
Check if Cetus Aggregator SDK supports Testnet.
If yes, modify the `getSwapQuote` function to use Aggregator on Testnet as well.
Update the fallback logic to handle cases where Aggregator finds no routes.
```

### Prompt 07 - Timestamp display bug fix / 时间显示问题修复
```text
The swap history shows incorrect dates.
The contract returns `timestamp` as Epoch (e.g., 100), but the frontend expects milliseconds.
Fix this in the frontend without redeploying the contract.
Use the system `timestampMs` from the event metadata if available.
```

### Prompt 08 - Frontend swap page generation / 前端主页面生成
```text
Create a Next.js Swap UI component with:
1. Token selection dropdowns (from/to tokens)
2. Amount input fields with balance display
3. Real-time quote fetching
4. Swap button with loading states
5. Success/error feedback
6. Integration with zkLogin and wallet connection
7. Responsive design with Tailwind CSS
```

### Prompt 09 - Network-aware config generation / 网络配置生成
```text
Create a network-aware configuration system for:
1. Token definitions (SUI, USDC, CETUS, wUSDC, MEME, IDOL_APPLE, IDOL_DGRAN)
2. Pool IDs for different networks (Mainnet vs Testnet)
3. Network endpoints and RPC URLs
4. Supported token pairs per network
```

### Prompt 10 - README drafting / README 草拟
```text
Create a comprehensive README for hackathon submission that includes:
1. Project overview and key features
2. P0 milestone achievements (zkLogin + Move 2024)
3. Tech stack with versions
4. Project structure
5. Quick start guide
6. Configuration instructions
7. API reference
8. Troubleshooting guide
9. Testing instructions
```

## 3) AI-Assisted Output Areas / AI 参与的输出范围

- `frontend/src/utils/zklogin.ts` (zkLogin proving and signing helpers / zkLogin 证明与签名逻辑)
- `contracts/cetus_swap/sources/swap_helper.move` (Move module with receipts/events / 收据与事件合约)
- `frontend/src/utils/cetus.ts` (routing, fallback, PTB append, history/event processing / 路由、兜底、PTB 拼接、事件处理)
- `frontend/src/app/page.tsx` (swap/transfer/insights UX and transaction flow / 主页面交互与交易流程)
- `frontend/src/utils/config.ts` (network/token/pool config / 网络与代币池配置)
- `README.md` and docs under `docs/` (文档与提交材料)

## 4) Human Review and Responsibility / 人工复核与责任

All AI-assisted outputs were manually reviewed, edited, and validated by project contributors before commit.
所有 AI 辅助输出在提交前均由项目成员进行人工复核、编辑与验证。

Final architecture, security, and release decisions are made by humans.
最终的架构、安全与发布决策均由人工负责。

## 5) Redaction Statement / 脱敏声明

No private keys, secrets, or sensitive credentials are disclosed in this file.
本文件不包含任何私钥、密钥或敏感凭据。

If prompts originally contained sensitive values, those values were removed before publication.
如原始提示词包含敏感信息，发布前已完成脱敏处理。
