# 如何配置 zkLogin (Google 方案)

要让 zkLogin 在本地正常工作，你需要拥有一个 Google OAuth Client ID。请按照以下步骤操作：

## 第一步：创建 Google Cloud 项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)。
2. 点击左上角的项目选择器，选择 "新建项目 (New Project)"。
3. 输入项目名称（例如 `SuiPay Dev`），点击 "创建"。

## 第二步：配置 OAuth 同意屏幕 (Consent Screen)

1. 在左侧菜单中，点击 **API 和服务 (APIs & Services)** > **OAuth 同意屏幕 (OAuth consent screen)**。
2. 选择 **外部 (External)**，然后点击 "创建"。
3. 填写必要信息：
   - **应用名称**：SuiPay
   - **用户支持邮箱**：你的邮箱
   - **开发者联系邮箱**：你的邮箱
4. 点击 "保存并继续"。
5. 在 "范围 (Scopes)" 页面，直接点击 "保存并继续"（zkLogin 只需要默认的 `openid` 和 `email`）。
6. 在 "测试用户 (Test users)" 页面，添加你用来测试登录的 Google 邮箱账号。
   > **注意**：在应用发布前，只有添加到这里的用户才能登录。

## 第三步：创建 OAuth Client ID

1. 在左侧菜单中，点击 **凭据 (Credentials)**。
2. 点击顶部的 **+ 创建凭据 (+ CREATE CREDENTIALS)** > **OAuth 客户端 ID (OAuth client ID)**。
3. **应用类型**选择：**Web 应用 (Web application)**。
4. **名称**：SuiPay Local。
5. **已获授权的重定向 URI (Authorized redirect URIs)** —— **⚠️ 这一步最关键**：
   - 点击 "+ 添加 URI"。
   - 填写：`http://localhost:3000/auth/callback`
   - *（如果以后部署到线上，记得回来添加线上的域名，例如 `https://your-site.com/auth/callback`）*
6. 点击 "创建"。

## 第四步：更新项目配置

1. 复制刚刚生成的 **客户端 ID (Client ID)**（通常以 `.apps.googleusercontent.com` 结尾）。
2. 打开本项目中的 `frontend/.env.local` 文件。
3. 修改 `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 的值：

```bash
# frontend/.env.local
NEXT_PUBLIC_GOOGLE_CLIENT_ID=你的_CLIENT_ID_粘贴在这里
```

4. 重启前端开发服务器：
   - 在终端中按 `Ctrl+C` 停止。
   - 运行 `npm run dev` 重新启动。

## 常见问题

- **错误 400: redirect_uri_mismatch**: 说明 Google控制台填写的 URI 和代码中的不一致。请确保完全匹配 `http://localhost:3000/auth/callback`。
- **错误 401: invalid_client**: Client ID 填写错误或被删除了。
