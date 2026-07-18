# EU Master Application Manager

面向欧洲硕士申请的本地管理工具，首期聚焦荷兰研究型大学。

项目使用 Next.js App Router、TypeScript、PostgreSQL 和 Supabase 构建。项目目录与个人档案保存在未公开的 `private` schema；材料文件和申请工作区仍保存在当前浏览器。

## 主要功能

- 申请档案与完成度管理
- 荷兰研究型大学及硕士项目目录
- 项目筛选、发现与官网信息更新
- 2–4 个项目的匹配度、费用、材料和来源对比
- 材料上传、分类、状态及版本历史
- 申请要求快照、材料关联和任务进度
- 浏览器存储状态、加密备份与完整恢复
- 桌面和移动端响应式中文界面

## 本地运行

需要 Node.js 20 或更高版本、pnpm，以及 Supabase Session Pool 连接串。

macOS 可以直接双击 `start-website.command`。它会自动定位 Node/pnpm、安装缺失依赖、必要时创建 `.env.local`、启动开发服务并打开浏览器。保持弹出的终端窗口打开；按 `Ctrl-C` 可停止网站。

也可以在终端运行同一个入口：

```bash
./start-website.command
```

手动启动流程如下：

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

在 `.env.local` 中，从 Supabase 项目顶部的 **Connect → Session pooler** 复制 5432 连接串，并从 Firecrawl 控制台复制服务端 API Key。不要把密钥发送到聊天、添加 `NEXT_PUBLIC_` 前缀或提交到 Git。然后打开 [http://localhost:3000](http://localhost:3000)。

首次启动并确认环境变量后，可在另一个终端顺序抓取 13 个预置项目（仍通过唯一的项目刷新接口，受 robots、域名白名单、限速和 24 小时冷却保护）：

```bash
pnpm catalog:seed
```

种子命令会先访问 `/api/catalog/health`，确认数据库由 `eu_master_backend` 受限角色读取、预置项目数量为 13 且 Firecrawl 已配置。任务只处理尚未成功抓取的预置项目，因此中断后可直接重跑；网络错误和 5xx 会有限退避重试，robots、403、429 不会重试。只要存在失败，命令就会返回非零退出码，并列出失败项目与最终汇总。

常见问题：

- `无法连接开发服务`：先保持 `pnpm dev` 运行，再从另一个终端执行种子命令。
- `数据库健康检查失败`：重新从 Supabase Connect 复制 Session Pool 地址，确认端口为 5432、密码已正确 URL 编码，并保留 `sslmode=require`。
- `尚未配置 FIRECRAWL_API_KEY`：补充 `.env.local` 后重启开发服务，让 Next.js 重新加载环境变量。
- 单个项目出现 403、429 或 robots 拒绝：命令会保留该失败并退出，不会绕过站点限制；稍后根据官网策略人工处理。

## 服务端环境变量

复制 `.env.example` 为 `.env.local`，然后填写以下服务端变量：

```bash
SUPABASE_SESSION_POOLER_URL=postgresql://postgres.gvjwrbdhhiwuqtbfdqrw:URL_ENCODED_PASSWORD@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=verify-full
SUPABASE_SESSION_POOL_MAX=3
FIRECRAWL_API_KEY=YOUR_FIRECRAWL_SERVER_KEY
EU_MASTER_BASE_URL=http://localhost:3000
```

这些变量只允许配置在服务端，不能添加 `NEXT_PUBLIC_` 前缀。连接串密码中的特殊字符需要 URL 编码；应用会校验 Session Pool 域名、5432 端口和 TLS。兼容旧变量名 `SUPABASE_SESSION_POOL_URL`，但新配置统一使用 `SUPABASE_SESSION_POOLER_URL`。

## 检查命令

```bash
pnpm lint
pnpm test
pnpm build
```

## 数据说明

`SUPABASE_SESSION_POOLER_URL` 只能配置为 Supavisor Session Pool 的 `pooler.supabase.com:5432` 地址。所有数据库访问都发生在 Next.js Node 后端，经 `pg.Pool` 和受限角色 `eu_master_backend` 执行；浏览器不会收到数据库凭据，也不使用 Supabase Data API。

项目筛选始终先查数据库。官网发现和项目刷新只能由用户点击触发；抓取先验证 HTTPS、官方域名与 robots.txt，优先 Firecrawl，失败后合规直连。403、429 或 robots 禁止不会被绕过。

材料、材料版本和申请工作区保存在 IndexedDB。项目每次从数据库读取、从官网发现或手动刷新后，也会同步为扁平化的本地表格快照，可在项目目录查看并导出 CSV；该快照不是权威数据源，也不保存完整官网 HTML。清理浏览器站点数据会删除这些本地内容，请定期在设置页面导出备份；Supabase 中的项目目录和个人档案不受影响。

本项目当前不包含登录、自动抓取计划、自动申请或 AI 文书生成。由于尚未接入身份认证，请只在可信的本地环境中运行；公开部署前应为后端 API 增加登录认证和用户级数据隔离。
