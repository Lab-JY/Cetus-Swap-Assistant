CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY,
    merchant_address TEXT NOT NULL,
    amount BIGINT NOT NULL, -- 存储最小单位 (例如 1.00 USDC = 1000000)
    currency TEXT NOT NULL DEFAULT 'USDC',
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    salary_amount BIGINT NOT NULL, -- 存储最小单位
    role TEXT
);

-- 更新测试数据 (以最小单位 10^6 存储)
INSERT INTO employees (name, wallet_address, salary_amount, role)
SELECT 'Alex Rivera', '0x7b2...a3f1', 4500000000, 'Senior Developer'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Alex Rivera');

INSERT INTO employees (name, wallet_address, salary_amount, role)
SELECT 'Sarah Chen', '0x1d4...e8c2', 3800000000, 'UI Designer'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Sarah Chen');

INSERT INTO employees (name, wallet_address, salary_amount, role)
SELECT 'Marco Rossi', '0x9a8...b5d4', 2200000000, 'Community Manager'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Marco Rossi');
