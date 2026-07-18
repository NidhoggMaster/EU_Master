# EU Master Application Manager 项目指南

修改代码前先阅读本文；项目事实以当前代码为准，实现变化时同步更新本文和 README。

## 1. 项目定位

- 面向欧洲硕士申请的本地管理工具，当前聚焦荷兰研究型大学和 2027+ 入学规划。
- 核心能力包括个人档案、项目目录与官网刷新、项目对比、材料版本、申请要求快照、任务、备份与恢复。
- 默认项目模式为 `local`。个人档案、学校配置、材料、材料版本、申请和任务在任何模式下都只保存在本机实体 CSV/文件中。
- Supabase 是可选项目目录，只保存项目、来源、刷新和审核记录；应用不再向远端写个人信息。
- 两套项目目录不会自动同步或隐式回退，只能通过设置页显式复制。
- 当前没有登录认证或用户级隔离，只适合可信本地环境。公开部署前必须增加认证和 API 访问控制。

## 2. 技术栈与命令

- Next.js 16 App Router、React 19、TypeScript 5（`strict: true`）。
- Tailwind CSS 4 通过 PostCSS 引入，页面主要使用 `src/app/globals.css` 中的语义类。
- CSV 使用 `csv-parse` / `csv-stringify`；校验使用 Zod；压缩使用 `fflate`；官网解析使用 Cheerio 和 `robots-parser`；远端访问使用 `pg`。
- IndexedDB 仅用于旧数据迁移和旧备份兼容，不是当前权威存储。
- 包管理器固定为 pnpm，Node.js 需要 20 或更高版本。

```bash
pnpm install
pnpm dev
pnpm lint
pnpm test
pnpm build
```

macOS 双击 `start-website.command` 默认运行生产构建；`./start-website.command --dev` 运行开发模式。脚本仅绑定 `127.0.0.1`，会检查依赖和构建、复用健康实例，并轮询 `/api/health` 后打开浏览器。

## 3. 环境变量

- `.env.local` 不得提交；`.env.example` 只保留占位符。
- `EU_MASTER_DATA_DIR` 可覆盖默认的 `<repo>/local-data`。
- `SUPABASE_SESSION_POOLER_URL` 必须是 `pooler.supabase.com:5432` Session Pool 地址；密码特殊字符需要 URL 编码。
- `SUPABASE_CA_CERT_PATH` 必须指向 Supabase CA PEM。`postgres.ts` 会拆分连接串参数，不能把含 `sslmode` 的连接串直接传给 `pg`，否则会覆盖 `ssl.ca`。
- `SUPABASE_SESSION_POOL_MAX` 被限制在 1–3。
- `FIRECRAWL_API_KEY` 是可选服务端变量，绝不能添加 `NEXT_PUBLIC_` 前缀。
- Supabase 未配置或连接失败不能阻止本地模式启动。

## 4. 目录职责

```text
src/app/dashboard/                         控制台页面
src/app/api/storage/                       存储状态、模式、复制、迁移和备份 API
src/app/api/materials/                     本地材料和文件 API
src/app/api/applications/                  本地申请 API
src/app/api/catalog/                       项目、发现、刷新、审核和诊断 API
src/lib/server/local-csv-codec.ts           CSV 列定义、编解码与 Zod 校验
src/lib/server/local-store.ts               本地实体仓储、原子写入和材料文件
src/lib/server/local-backup.ts              工作区 ZIP/.eumaster 备份
src/lib/server/catalog-service.ts           local / supabase 项目仓储分发和显式复制
src/lib/server/catalog-repository.ts        Supabase 项目 SQL 仓储
src/lib/server/postgres.ts                  CA 校验、连接池和受限角色事务
src/lib/server/refresh-service.ts           官网刷新编排
src/lib/db.ts                               旧 IndexedDB 读取和迁移兼容
scripts/seed-catalog.mjs                    当前模式 13 项目逐一刷新脚本
```

## 5. 本地 CSV 与文件

- 本地目录包含 `meta.csv`、`profile.csv`、`universities.csv`、`programs.csv`、`materials.csv`、`material_versions.csv`、`applications.csv`、`source_snapshots.csv`、`field_changes.csv` 和 `files/`。
- `meta.csv` 保存 `schemaVersion`、当前 `catalogMode`、汇率缓存和抓取诊断。
- 14 所学校始终从本地 `universities.csv` 读取；Supabase 故障不能让学校下拉为空。
- 数组和嵌套对象使用 JSON CSV 列。不要手写 CSV 转义，必须使用正式库和对应 codec。
- 写入使用进程串行队列、同目录临时文件、`fsync` 和原子 `rename`。新增写路径必须沿用该机制。
- 数据目录和子目录权限为 `0700`，CSV/材料文件为 `0600`。CSV 是明文，不要声称其已加密。
- 材料二进制存入 `files/<versionId>/<safeName>`，CSV 只保存受控相对路径。任何读取必须通过 `safeLocalPath()`，拒绝绝对路径和 `..`。
- 新增实体或 CSV 列时需更新 `TABLE_COLUMNS`、编解码、初始化、备份、迁移和测试。

## 6. 双项目模式

- `CatalogMode = "local" | "supabase"`，默认 `local`，保存在 `meta.csv`。
- 项目 API 通过 `catalog-service.ts` 分发；学校 API 不分发，始终本地读取。
- 切换到 Supabase 前必须验证连接、`eu_master_backend` 受限角色和查询能力。失败时保持现有模式并返回可操作原因。
- 显式复制先调用预览：新增项默认写入，冲突默认跳过；只有用户选择的冲突 ID 可以覆盖。
- Supabase 永远不能接收档案、材料、申请或任务。`getCurrentProfile()` 只允许用于一次性远端旧档案读取。
- 远端访问必须经过 `withDb()`，执行事务、`set local role eu_master_backend` 和超时设置。浏览器不能收到数据库凭据。

## 7. 项目发现与官网刷新

发现流程读取所选学校的本地白名单配置，只访问该校 `catalogUrl`，最多返回 25 个候选；用户确认后写入当前项目模式。

刷新流程读取当前项目模式中的项目，抓取官网并把低风险字段自动应用，高风险字段写入当前模式的待审核记录。每次成功刷新保留来源、摘录、哈希、抓取时间和审核轨迹；失败在本地 `meta.csv` 或远端刷新记录中留下结果。

不能削弱以下边界：

- 只允许 HTTPS，主机必须精确命中学校 `allowedHosts`，跳转后重新验证。
- 遵守 robots.txt，每主机请求间隔至少 5 秒。
- 单次请求超时 20 秒，HTML 上限 2 MB，只接受 HTML/XHTML。
- 403、429 和 robots 拒绝不得绕过；5xx 只做有限重试。
- Firecrawl 也必须先通过官方 URL 和 robots 校验，失败时只能合规直连。
- 同一项目 24 小时冷却不能被收集脚本绕过。

解析只是启发式提取。费用、截止日期、录取条件和材料要求必须保留来源和人工审核路径。

## 8. 项目、申请与材料

- `Program.requirements` 是项目当前结构化要求；创建申请时复制为 `ApplicationRequirementSnapshot`，不能保留实时引用。
- 项目刷新不能静默覆盖已有申请快照。“同步要求”只追加新要求，不修改或删除旧快照。
- 创建申请时可关联同类型第一份 `ready` 材料，并为未满足必需要求生成任务。
- 申请进度只计算必需要求；没有必需要求时为 0%。档案完成度按七个结构化分区等权计算。
- `Program.deadline` 可是官网待审核文本，`Application.deadline` 是 `YYYY-MM-DD`，不要混用。
- 删除材料会删除所有版本文件，但当前不会清理申请快照中的 `materialId`；改变时必须明确处理悬空关联。
- UI 接受 PDF、DOC/DOCX、JPG/JPEG、PNG，单文件 20 MB，空文件拒绝。服务器入口必须再次执行校验。

## 9. 备份与迁移

- 普通备份是 ZIP；加密备份扩展名 `.eumaster`，头为 `EUMA`，加密版本为 1。
- 使用 PBKDF2-SHA-256（310,000 次）派生 AES-GCM 256 位密钥；密码至少 8 字符。
- 当前完整备份 schemaVersion 为 2，覆盖档案、学校、项目、材料、文件版本、申请、来源和变更；每个材料文件使用 SHA-256 校验。
- 仍接受旧 schemaVersion 1 备份。旧备份没有完整档案/项目时，恢复不能因此清空当前本地档案和项目种子。
- 导入文件最大 500 MB；先校验再恢复。
- IndexedDB 迁移只合并目标中不存在的 ID，材料文件一并迁移，成功后保留旧浏览器数据库。不要自动删除旧库。

## 10. 编码与测试

- 使用 `@/` 别名；领域类型和中文标签集中在 `src/lib/types.ts`。
- 本地数据写操作集中在 `local-store.ts`，远端项目写操作集中在 `catalog-repository.ts`。
- API 和导入边界使用 Zod，预期错误转换为中文操作提示，不返回堆栈或密钥。
- 保存实体时维持 `createdAt`，更新 `updatedAt`；抓取使用 `fetchedAt` / `lastFetchedAt`。
- 保持 React 状态不可变；共享数组排序前先复制。
- 样式复用现有变量和语义类，检查 1100px、760px、430px；移动项目列表固定单列。
- 测试由 Vitest 运行。CSV 改动必须覆盖引号、换行、Unicode、JSON、损坏行、权限、原子写和路径穿越。
- 数据模型、路由或跨模块改动后运行 `pnpm lint && pnpm test && pnpm build`，并做桌面和移动浏览器走查。

## 11. 完成检查

1. 确认没有把数据库连接串、Firecrawl Key、CA 或个人数据提交到 Git、客户端或日志。
2. 确认无 Supabase 时本地模式、学校下拉、项目、档案、材料和申请仍完整可用。
3. 确认任何远端写入仅涉及项目及其来源/刷新/审核记录。
4. 涉及官网读取时复核 HTTPS、白名单、跳转、robots、限速、超时、大小、冷却和审核。
5. 涉及材料时复核版本文件、当前版本指针、删除和备份完整性。
6. 检查加载、空、错误状态以及桌面/移动布局。
7. 实现事实变化时同步更新本文和 README。
