# Cetus RoutePay

> 基于 Sui 区块链的下一代交易与支付终端

Cetus RoutePay 是一个创新的 DeFi 应用，集成 **Cetus 聚合路由**、**CLMM 流动性池**、**PTB 原子交易**和 **zkLogin 无缝登录**，为用户提供最优交易路径和极致支付体验。

## 快速开始

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd Cetus-RoutePay/frontend

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.local.example .env.local

# 4. 启动开发服务器
npm run dev
```

访问 http://localhost:3000 即可开始使用。

## 核心功能

### 交易功能
- **智能路由聚合**：自动选择最优交易路径，节省手续费
- **CLMM 兜底机制**：聚合路由失败时自动切换到 CLMM 池，确保交易成功
- **原子 Zap 交易**：Swap + Transfer 一次签名完成，支持即时支付场景
- **实时报价缓存**：提升报价响应速度，优化用户体验

### 用户体验
- **zkLogin 集成**：支持 Google 等 Web2 账号登录，无需钱包即可体验
- **链上收据系统**：每笔交易生成 NFT 收据，可分享、可追溯
- **多 RPC 健康检查**：自动切换最优 RPC 节点，保证服务稳定性
- **Preflight 预检**：交易前模拟执行，提前发现潜在问题

### 数据洞察
- **AI 交易洞察**：基于链上数据和市场行情的智能分析
- **实时价格走势**：24 小时价格图表，支持多币种对比
- **交易排行榜**：展示热门交易对和活跃用户
- **链上交易卡片**：可视化展示交易详情，支持导出分享

## 技术栈

### 前端技术
- **框架**：Next.js 16 (App Router) + React 19
- **语言**：TypeScript 5
- **样式**：Tailwind CSS 4
- **状态管理**：React Query (TanStack Query)
- **图表**：Recharts
- **UI 组件**：Lucide React Icons

### 区块链集成
- **Sui SDK**：@mysten/sui ^1.45.2
- **Cetus SDK**：
  - @cetusprotocol/aggregator-sdk ^1.4.3
  - @cetusprotocol/cetus-sui-clmm-sdk ^5.4.0
- **钱包连接**：@mysten/dapp-kit ^0.20.0
- **数学计算**：Decimal.js, BigNumber.js, BN.js

### 外部服务
- **行情数据**：CoinGecko API
- **RPC 节点**：Sui Mainnet/Testnet RPC
- **认证**：zkLogin (Google OAuth)

## 项目架构

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # 主交易页面
│   │   ├── receipt/[id]/      # 收据详情页
│   │   └── api/               # API 路由
│   │       ├── market/        # 行情数据代理
│   │       └── sui/           # Sui RPC 代理
│   ├── components/            # React 组件
│   │   ├── AIInsightCard.tsx  # AI 洞察卡片
│   │   ├── PriceChart.tsx     # 价格走势图
│   │   ├── TradingCard.tsx    # 交易卡片
│   │   └── TradingLeaderboard.tsx  # 排行榜
│   └── utils/                 # 工具函数
│       ├── cetus.ts           # Cetus SDK 封装
│       ├── quoteService.ts    # 报价服务
│       ├── rpc.ts             # RPC 管理
│       └── aiInsights.ts      # AI 洞察引擎
├── public/                    # 静态资源
└── move/                      # Move 智能合约
    └── sources/
        └── swap_receipt.move  # 收据合约
```

### 核心模块说明

**1. 聚合路由模块** (`src/utils/cetus.ts`)
- 集成 Cetus Aggregator SDK
- 自动选择最优交易路径
- CLMM 兜底逻辑
- 支持多跳路由

**2. 报价服务** (`src/utils/quoteService.ts`)
- 报价缓存机制（15 秒有效期）
- 并发请求去重
- 错误重试策略

**3. RPC 管理** (`src/utils/rpc.ts`)
- 多 RPC 节点配置
- 健康检查与自动切换
- 请求负载均衡

**4. AI 洞察引擎** (`src/utils/aiInsights.ts`)
- 规则引擎生成交易建议
- 市场趋势分析
- 风险评估

## 环境变量配置

### 必需配置

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `NEXT_PUBLIC_SUI_NETWORK` | Sui 网络环境 | `mainnet` / `testnet` |
| `NEXT_PUBLIC_CETUS_SWAP_PACKAGE_ID` | 收据合约包 ID | `0x94877bee...` |

### 可选配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NEXT_PUBLIC_ENABLE_RECEIPTS` | 启用收据功能 | `true` |
| `NEXT_PUBLIC_CETUS_PARTNER_ID` | Cetus 合作伙伴 ID（用于分佣） | - |
| `NEXT_PUBLIC_SUI_RPC_URLS_MAINNET` | 主网 RPC 节点列表（逗号分隔） | Sui 官方节点 |
| `NEXT_PUBLIC_SUI_RPC_URLS_TESTNET` | 测试网 RPC 节点列表 | Sui 官方节点 |
| `COINGECKO_API_KEY` | CoinGecko API 密钥 | - |
| `COINGECKO_DEMO_KEY` | CoinGecko Demo 密钥 | - |

### 合约部署信息

| 网络 | Package ID |
|------|-----------|
| **Mainnet** | `0x94877beeabecc1f0bf5c6989a6dfd1deb6a69b31bcdcc9045b0a791e3169673f` |
| **Testnet** | `0x622bf94c8095556221e3798242e7939c9ec6a5cdc59f90ee148dd0cc72e13480` |

## 详细安装指南

### 环境要求
- **Node.js**: 18.0.0 或更高版本
- **包管理器**: npm / pnpm / yarn
- **Sui CLI**: 可选，用于合约开发和部署

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone <your-repo-url>
   cd Cetus-RoutePay
   ```

2. **安装前端依赖**
   ```bash
   cd frontend
   npm install
   ```

3. **配置环境变量**
   ```bash
   cp .env.local.example .env.local
   # 编辑 .env.local 填入必要的配置
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```
   服务器将在 http://localhost:3000 启动

5. **构建生产版本**（可选）
   ```bash
   npm run build
   npm start
   ```

## 使用指南

### 基础交易操作

**1. Swap 交易（免费）**
```
1. 连接钱包或使用 zkLogin 登录
2. 选择源代币（From）和目标代币（To）
3. 输入交易数量
4. 查看路由信息和预估输出
5. 确认并签名交易
```

**2. Zap 交易（Swap + Send）**
```
1. 切换到 Zap 模式
2. 选择代币对
3. 输入接收地址
4. 确认交易（一次签名完成 Swap + Transfer）
```

**3. 查看交易收据**
```
1. 交易成功后获取 Receipt ID
2. 访问 /receipt/<id> 查看详情
3. 生成分享卡片并导出 PNG
```

**4. 数据洞察**
```
1. 点击顶部 INSIGHTS 标签
2. 查看 AI 交易洞察
3. 浏览 24h 价格走势图
4. 查看链上交易卡片和排行榜
```

### 高级功能

#### Cetus Partner 分佣机制

本项目已集成 Cetus Partner 分佣功能，仅在 **Zap 模式**下启用：

**启用条件：**
- 使用 Zap 模式（Swap + Send）
- 配置 `NEXT_PUBLIC_CETUS_PARTNER_ID`
- 路由完全由 Cetus 提供

**特点：**
- Swap 模式保持 0 收费
- 用户手续费不变，收入来自 Cetus 分佣
- UI 展示分佣状态与可领取额度
- 对用户完全透明，零感知

#### 多 RPC 节点配置

支持配置多个 RPC 节点实现负载均衡和故障转移：

```bash
# .env.local
NEXT_PUBLIC_SUI_RPC_URLS_MAINNET=https://rpc1.mainnet.sui.io,https://rpc2.mainnet.sui.io
NEXT_PUBLIC_SUI_RPC_URLS_TESTNET=https://rpc1.testnet.sui.io,https://rpc2.testnet.sui.io
```

系统会自动进行健康检查并选择最优节点。

## API 文档

### 行情数据 API

**获取代币价格**
```
GET /api/market/price?ids=sui,cetus
```

**获取市场数据**
```
GET /api/market/data?id=sui
```

### Sui 链上数据 API

**查询事件**
```
POST /api/sui/events
Body: {
  "query": { "MoveEventType": "..." },
  "limit": 50
}
```

### 报价服务

报价服务提供缓存机制，提升响应速度：

```typescript
// 使用示例
import { getQuote } from '@/utils/quoteService'

const quote = await getQuote({
  fromToken: 'SUI',
  toToken: 'USDC',
  amount: '1000000000'
})
```

**缓存策略：**
- 缓存时间：15 秒
- 并发请求去重
- 自动错误重试

## 智能合约

### 收据合约（Move）

项目包含 Move 智能合约，用于生成链上交易收据：

**合约结构：**
```move
module cetus_swap::receipt {
    // Swap 收据
    struct SwapReceipt has key, store {
        id: UID,
        from_token: String,
        to_token: String,
        amount_in: u64,
        amount_out: u64,
        timestamp: u64,
        sender: address
    }

    // Zap 收据
    struct ZapReceipt has key, store {
        id: UID,
        from_token: String,
        to_token: String,
        amount_in: u64,
        amount_out: u64,
        recipient: address,
        timestamp: u64,
        sender: address
    }
}
```

**功能特点：**
- 链上可验证
- 支持 NFT 化分享
- 可索引查询
- 永久存储

### 合约部署

**部署到测试网：**
```bash
cd move
sui client publish --gas-budget 100000000
```

**部署到主网：**
```bash
sui client publish --gas-budget 100000000 --network mainnet
```

## 测试网说明

### 可用交易对

当前测试网保证可用的交易对：

| 交易对 | 流动性 | 状态 |
|--------|--------|------|
| SUI / MEME | 充足 | ✅ 可用 |
| SUI / IDOL_APPLE | 充足 | ✅ 可用 |
| SUI / IDOL_DGRAN | 充足 | ✅ 可用 |

**注意事项：**
- 非 SUI 配对可能没有流动性池
- 无路由的交易对会提示不可交易
- 建议优先使用上述交易对进行测试

### 获取测试代币

```bash
# 获取测试网 SUI
sui client faucet

# 或访问 Sui 测试网水龙头
https://faucet.testnet.sui.io/
```

## 开发指南

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 代码检查
npm run lint
```

### 项目脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（端口 3000） |
| `npm run build` | 构建生产版本 |
| `npm start` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint 检查 |

### 添加新代币

在 `src/utils/tokens.ts` 中添加代币配置：

```typescript
export const TOKENS = {
  YOUR_TOKEN: {
    address: '0x...',
    symbol: 'YOUR_TOKEN',
    decimals: 9,
    name: 'Your Token Name',
    logoUrl: '/tokens/your-token.png'
  }
}
```

### 自定义主题

修改 `tailwind.config.js` 自定义颜色和样式：

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#your-color',
        // ...
      }
    }
  }
}
```

## 数据来源

### 行情数据
- **来源**：CoinGecko API
- **代理**：`/api/market/*`
- **用途**：价格、成交量、市值等市场数据
- **更新频率**：实时

### 链上数据
- **来源**：Sui RPC `queryEvents`
- **代理**：`/api/sui/events`（前端失败时自动降级）
- **事件类型**：SwapEvent, TransferEvent
- **用途**：交易历史、排行榜、洞察分析

### AI 洞察
- **引擎**：规则引擎（非 LLM）
- **数据源**：链上交易 + 市场行情
- **生成内容**：交易建议、趋势分析、风险评估
- **免责声明**：仅供参考，不构成投资建议

## 技术路线图

### 已完成功能 ✅

- [x] Cetus 聚合路由集成
- [x] CLMM 流动性池兜底
- [x] PTB 原子 Zap（Swap + Send）
- [x] Move 链上收据对象
- [x] zkLogin Web2 登录
- [x] 报价缓存服务
- [x] 多 RPC 健康检查
- [x] Preflight 交易预检
- [x] Cetus Partner 分佣（Zap-only）
- [x] AI 交易洞察
- [x] 价格走势图表
- [x] 交易排行榜

### 规划中功能 🚧

- [ ] 限价单（Limit Order）
- [ ] 策略交易（DCA, Grid Trading）
- [ ] Swap-as-a-Service SDK
- [ ] 社交化分享功能
- [ ] 移动端 PWA 支持
- [ ] 多语言国际化
- [ ] 高级图表分析
- [ ] 交易机器人集成

## 商业模式

### 当前策略

**免费 Swap**
- 不向用户收取任何额外费用
- 保持 Cetus 原生手续费标准
- 提供最优交易体验

**Zap 分佣**
- 仅在 Zap 模式启用
- 收入来自 Cetus Partner 返佣
- 用户手续费不变
- 完全透明，零感知

### 未来增强

**付费服务**
- 高速 RPC 节点
- 交易加速服务
- 高级数据分析
- API 调用配额

**B2B 集成**
- 嵌入式 Swap 组件
- 白标解决方案
- 企业级 API
- 定制化开发

## 贡献指南

欢迎贡献代码、报告问题或提出建议！

### 提交 Issue

在提交 Issue 前，请确保：
- 搜索现有 Issue，避免重复
- 提供详细的复现步骤
- 附上错误日志和截图
- 说明你的环境信息

### 提交 Pull Request

1. Fork 本仓库
2. 创建特性分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 开启 Pull Request

### 代码规范

- 遵循 ESLint 配置
- 使用 TypeScript 类型注解
- 编写清晰的注释
- 保持代码简洁

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 致谢

- [Sui Network](https://sui.io/) - 高性能区块链平台
- [Cetus Protocol](https://www.cetus.zone/) - DEX 聚合器和 CLMM
- [Next.js](https://nextjs.org/) - React 框架
- [CoinGecko](https://www.coingecko.com/) - 加密货币市场数据

## 联系方式

- **项目主页**：[GitHub Repository]
- **问题反馈**：[GitHub Issues]
- **技术讨论**：[Discord/Telegram]

## AI 使用披露

本项目在开发过程中使用了 AI 辅助工具。详细信息请参阅 [AI_USAGE_DISCLOSURE.md](AI_USAGE_DISCLOSURE.md)。

---

**Built with ❤️ for the Sui ecosystem**
