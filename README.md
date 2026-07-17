# EU Master Application Manager

面向欧洲硕士申请的本地管理工具，首期聚焦荷兰研究型大学。

项目使用 Next.js App Router、TypeScript 和 Tailwind CSS 构建。个人档案由 Next.js 后端通过 PostgreSQL Session Pool 写入 Supabase；材料和申请数据仍保存在当前浏览器。

## 主要功能

- 申请档案与完成度管理
- 荷兰研究型大学及硕士项目目录
- 项目筛选、发现与官网信息更新
- 材料上传、分类、状态及版本历史
- 申请要求快照、材料关联和任务进度
- 浏览器存储状态、加密备份与完整恢复
- 桌面和移动端响应式中文界面

## 本地运行

需要 Node.js 20 或更高版本，以及 pnpm。

```bash
pnpm install
pnpm dev
```

然后打开 [http://localhost:3000](http://localhost:3000)。

## Supabase 个人档案

复制 `.env.example` 为 `.env.local`，然后从 Supabase Dashboard 的 **Connect → Session pooler** 复制端口为 `5432` 的连接串：

```bash
SUPABASE_SESSION_POOLER_URL=postgresql://postgres.PROJECT_REF:URL_ENCODED_PASSWORD@SESSION_POOLER_HOST:5432/postgres
```

该变量只允许配置在服务端，不能添加 `NEXT_PUBLIC_` 前缀。连接串密码中的特殊字符需要进行 URL 编码。后端强制使用校验证书的 TLS，并通过参数化 SQL 将表单写入 `private.applicant_profiles`；表不暴露给 Data API，且已启用 RLS。

## 检查命令

```bash
pnpm lint
pnpm test
pnpm build
```

## 数据说明

个人档案保存在 Supabase。材料、申请、项目更新和备份数据保存在当前浏览器的 IndexedDB 中；清理浏览器站点数据会删除这些本地内容，请定期在设置页面导出备份。

本项目当前不包含登录、自动申请、AI 文书生成或线上部署。由于尚未接入身份认证，请只在可信的本地环境中运行；公开部署前应为 `/api/profile` 增加登录认证和用户级数据隔离。
