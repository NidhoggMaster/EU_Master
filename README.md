# EU Master Application Manager

面向欧洲硕士申请的本地管理工具，首期聚焦荷兰研究型大学。默认使用本机实体 CSV 和受控文件目录；Supabase 是可选项目目录，不保存个人档案、材料或申请。

## 主要功能

- 个人档案、材料版本、申请要求快照与任务进度
- 14 所荷兰研究型大学及 13 个硕士项目种子
- 项目筛选、官网发现、手动刷新与关键字段审核
- 本地 CSV / Supabase 项目模式切换和显式双向复制
- 项目单行列表、双列卡片、详情与 2–4 项比较
- ZIP 或密码加密 `.eumaster` 完整备份与恢复
- 旧 IndexedDB 数据预览合并，旧浏览器数据库保留

## 一键启动

需要 Node.js 20 或更高版本和 pnpm。Supabase 不是启动前提。

macOS 双击 `start-website.command`，或在终端运行：

```bash
./start-website.command
```

脚本默认运行生产构建，只绑定 `127.0.0.1`。它会检查依赖和构建是否过期、复用已运行实例、初始化本地 CSV，并在 `/api/health` 通过后打开浏览器。开发模式使用：

```bash
./start-website.command --dev
```

手动开发流程：

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

默认地址是 [http://127.0.0.1:3000](http://127.0.0.1:3000)。

## 本地数据

默认数据目录为仓库中的 `local-data/`，可通过 `EU_MASTER_DATA_DIR` 指向其他位置。目录权限为 `0700`，CSV 和材料文件为 `0600`；`local-data/` 已加入 `.gitignore`。

实体文件包括：

```text
meta.csv
profile.csv
universities.csv
programs.csv
materials.csv
material_versions.csv
applications.csv
source_snapshots.csv
field_changes.csv
files/
```

数组和嵌套对象以 JSON CSV 列保存。CSV 是明文，外发前应在设置页生成密码加密备份。

## 可选 Supabase

Supabase 仅保存项目、来源、刷新和审核记录。配置写入已忽略的 `.env.local`：

```bash
SUPABASE_SESSION_POOLER_URL=postgresql://postgres.PROJECT_REF:URL_ENCODED_PASSWORD@aws-1-REGION.pooler.supabase.com:5432/postgres?sslmode=verify-full
SUPABASE_SESSION_POOL_MAX=3
SUPABASE_CA_CERT_PATH=/absolute/path/to/prod-ca-2021.crt
FIRECRAWL_API_KEY=
EU_MASTER_BASE_URL=http://127.0.0.1:3000
EU_MASTER_DATA_DIR=
```

连接必须使用 Supavisor Session Pool 的 `pooler.supabase.com:5432`。应用会拆分连接串参数，并把 `SUPABASE_CA_CERT_PATH` 的 CA 传给 `pg` 执行完整证书校验；密码特殊字符必须 URL 编码。

控制台顶栏可切换项目模式。切换到 Supabase 前会执行健康检查，失败时保持当前模式；两套项目库只通过设置页的显式复制操作传输，不自动同步或隐式回退。个人信息永远只写入本地 CSV。

## 官网抓取

项目刷新先验证 HTTPS、官方域名、跳转和 robots.txt，并遵守每主机 5 秒限频、20 秒超时、2 MB HTML 上限和 24 小时项目冷却。Firecrawl 可选；未配置或失败时只能使用同样受限的合规直连，不绕过 robots、403 或 429。

网站运行后，可逐一处理当前模式的 13 个种子项目：

```bash
pnpm catalog:seed
```

脚本为每个项目记录成功、冷却跳过或失败；网络错误和 5xx 有限重试，403、429 和 robots 拒绝不重试。

## 检查命令

```bash
pnpm lint
pnpm test
pnpm build
```

项目尚未接入登录认证，只适合可信本地环境运行。公开部署前必须增加认证、API 访问控制和用户级数据隔离。
