# EU Master Application Manager 项目指南

本文供后续在本仓库工作的开发者与自动化代理使用。修改代码前先阅读本文件；项目事实以当前代码为准，如实现发生变化，应同步更新本文。

## 1. 项目定位

- 这是一个面向欧洲硕士申请的本地管理工具，当前产品范围聚焦荷兰研究型大学和 2027+ 入学规划。
- 核心能力包括：个人档案、项目目录与官网信息更新、项目对比、材料及版本、申请要求快照、任务进度、完整备份与恢复。
- 当前是混合存储架构：项目目录与个人档案保存在 Supabase PostgreSQL 的 `private` schema；材料文件、材料版本、申请工作区和本地项目表格快照保存在当前浏览器 IndexedDB。
- 浏览器端不会收到数据库凭据，也不直接访问 Supabase Data API。所有数据库访问必须经过 Next.js Node 后端、`pg.Pool` 和受限角色 `eu_master_backend`。
- 当前尚未接入登录认证或用户级隔离，只适合可信本地环境运行。公开部署前必须新增认证和后端 API 访问控制。
- 当前明确不包含自动提交申请、自动抓取计划和 AI 文书生成。

## 2. 技术栈与常用命令

- Next.js 16 App Router、React 19、TypeScript 5（`strict: true`）。
- Tailwind CSS 4 通过 PostCSS 引入，但现有界面主要使用 `src/app/globals.css` 中的手写语义类。
- IndexedDB 封装使用 `idb`；校验使用 Zod；压缩使用 `fflate`；官网 HTML 解析使用 Cheerio；robots.txt 解析使用 `robots-parser`；PostgreSQL 访问使用 `pg`。
- 包管理器固定为 pnpm，提交并维护 `pnpm-lock.yaml`，不要无故切换 npm 或 yarn 锁文件。
- 运行环境需要 Node.js 20 或更高版本。

```bash
pnpm install
pnpm dev
pnpm lint
pnpm test
pnpm build
```

macOS 本地可双击 `start-website.command` 一键启动。脚本会自动定位 Node/pnpm、在依赖过期时安装依赖、必要时从 `.env.example` 创建 `.env.local`、启动 Next.js 并打开浏览器。首次完整使用控制台前仍需在 `.env.local` 填写服务端 Supabase Session Pool 连接串；`FIRECRAWL_API_KEY` 只对 `pnpm catalog:seed` 必需。

完成改动后至少运行与改动范围相关的检查；涉及数据模型、路由或跨模块修改时，运行 `pnpm lint && pnpm test && pnpm build`。

## 3. 服务端环境变量

- `.env.local` 不得提交；`.env.example` 是唯一可提交示例。
- `SUPABASE_SESSION_POOLER_URL` 必须是 Supavisor Session Pool 的 `pooler.supabase.com:5432` PostgreSQL 地址，并保留 TLS；兼容旧名 `SUPABASE_SESSION_POOL_URL`，但新配置统一使用 `SUPABASE_SESSION_POOLER_URL`。
- `SUPABASE_SESSION_POOL_MAX` 默认 3，并在代码中限制为 1 到 3。
- `FIRECRAWL_API_KEY` 是服务端变量，不得添加 `NEXT_PUBLIC_` 前缀。项目刷新可在 Firecrawl 不可用时回退合规直连，但种子命令要求该变量已配置。
- `EU_MASTER_BASE_URL` 供 `scripts/seed-catalog.mjs` 访问本地开发服务，默认 `http://localhost:3000`。

## 4. 目录与职责

```text
src/app/
  page.tsx                                      极简首页和国家入口
  layout.tsx                                    全局元数据与根布局
  globals.css                                   全站样式、组件类和响应式断点
  dashboard/                                    控制台页面
    page.tsx                                    总览
    profile/page.tsx                            个人档案，读写后端 Supabase
    programs/                                   项目列表、详情与 2-4 项比较
    materials/page.tsx                          本地材料、文件和版本
    applications/                               本地申请列表与申请工作区
    settings/page.tsx                           浏览器存储、备份和恢复
  api/profile/route.ts                          个人档案 API
  api/catalog/                                  项目库、官网发现、刷新、审核和健康检查 API
  api/exchange-rates/latest/route.ts            欧元汇率 API
src/components/dashboard-shell.tsx              控制台桌面侧栏、顶栏和移动导航
src/lib/types.ts                                领域类型、枚举与中文标签的单一来源
src/lib/catalog-data.ts                         14 所大学、13 个预置项目与分类关键词
src/lib/catalog-server.ts                       官网访问安全、限频、抓取和解析
src/lib/server/postgres.ts                      Supabase Session Pool 与受限角色事务封装
src/lib/server/catalog-repository.ts            项目库 SQL 读写
src/lib/server/refresh-service.ts               项目官网刷新编排
src/lib/profile-postgres.ts                     个人档案 SQL 读写
src/lib/db.ts                                   IndexedDB 架构、本地工作区和表格快照
src/lib/backup.ts                               ZIP/.eumaster 导出、校验、加密和恢复
src/lib/matching.ts                             项目匹配与比较计算
scripts/seed-catalog.mjs                        一次性抓取 13 个预置项目
supabase/migrations/                            私有 schema、受限角色、项目目录和种子迁移
```

## 5. 关键架构与数据流

### 5.1 Supabase 后端数据

- 项目目录、项目来源、项目刷新记录、待审核字段变更、汇率和个人档案保存在 Supabase PostgreSQL `private` schema。
- API 通过 `withDb()` 开启事务，执行 `set local role eu_master_backend`、`statement_timeout` 和 `idle_in_transaction_session_timeout`。
- 项目列表优先读取数据库；手动新增候选和官网发现结果会写入 `private.programs`、`private.program_universities` 和 `private.program_sources`。
- 个人档案固定使用主键 `current`。客户端首次读取远端为空时，会尝试迁移 IndexedDB 里的旧本地档案，校验成功后清理本地 profile。
- 数据库连接串、Firecrawl Key 和任何服务端密钥绝不能暴露给客户端、日志、聊天或提交历史。

### 5.2 浏览器本地数据

- 数据库名为 `eu-master-nl`，当前 `DB_VERSION = 2`。
- 对象仓库包括 `meta`、`profile`、`universities`、`programs`、`materials`、`materialVersions`、`applications`、`sourceSnapshots`、`fieldChanges` 和 `catalogTable`。
- `profile`、`universities`、`programs`、`sourceSnapshots` 和 `fieldChanges` 主要保留兼容旧本地数据的能力；当前权威档案和项目目录在 Supabase。
- `catalogTable` 保存最近读取、发现或刷新的扁平化项目快照，用于表格展示和 CSV 导出，不保存完整官网 HTML，也不是权威数据源。
- `materialVersions` 通过 `by-material` 索引关联材料；材料 Blob 只在 IndexedDB 内保存。新增本地对象仓库或索引时必须提升 `DB_VERSION` 并写迁移。
- IndexedDB 和 Web Crypto 只能在浏览器环境使用。直接访问本地数据库的页面或模块应保持客户端边界（`"use client"`）。

### 5.3 项目发现与官网刷新

项目发现流程：

1. 客户端向 `/api/catalog/discover` 提交 `universityId` 和四类方向之一。
2. 服务端读取 Supabase 中的大学配置，并只访问该大学配置的 `catalogUrl`。
3. 服务端按分类关键词筛选候选链接，最多返回 25 条，并把候选写入数据库。
4. 用户确认候选或手动粘贴链接后，服务端仍必须验证 HTTPS 和所选大学白名单官方域名。

项目刷新流程：

1. 客户端向 `/api/catalog/programs/[id]/refresh` 发起请求。
2. 服务端读取数据库中的项目详情和主关联大学，检查同一项目 24 小时冷却与进程内刷新锁。
3. 服务端读取主页面，并最多补充两个 admissions/tuition 官方页面。
4. 名称、学位、语言、学制、学分、授课方式和入学时间等低风险空字段可自动应用；已有值或高风险内容进入待审核变更。
5. 每次刷新写入项目来源、刷新记录、字段变更记录和 `lastFetchedAt`；审核通过的高风险变更才会写回项目。

不要削弱 `catalog-server.ts` 的安全边界：

- 只允许 `https:`，且主机必须精确命中大学的 `allowedHosts`。
- 跳转后的 URL 也必须重新通过同一白名单校验。
- 遵守 robots.txt；每个主机请求间隔至少 5 秒。
- 单次请求超时 20 秒，HTML 响应上限 2 MB，只接受 HTML/XHTML。
- 403/429 应给出可理解的提示；5xx 当前只重试一次。
- Firecrawl 也必须先通过官方 URL 和 robots 校验；Firecrawl 失败时只能合规回退直连，不能绕过 robots、403 或 429。
- 服务端限频、刷新锁和 robots 缓存都是进程内状态，不是跨实例全局限流。

解析结果只是官网文本的启发式提取，不应把置信度当成事实证明。涉及费用、截止日期、录取标准和申请材料的内容必须保留来源、摘录和人工审核路径。

### 5.4 项目、申请与材料的关系

- `Program.requirements` 是项目当前的结构化要求。
- 创建申请时会把要求复制为 `ApplicationRequirementSnapshot`，不会保存对项目要求的实时引用；后续项目刷新不能静默覆盖已有申请。
- 创建申请时，同类型且状态为 `ready` 的第一份材料会被自动关联；未满足的必需要求会生成准备任务。
- 申请详情中的“同步要求”只追加项目中新出现的要求，不修改或删除已有快照。改变此行为前必须设计冲突提示和用户确认。
- 申请进度只计算必需要求；没有必需要求时返回 0%。档案完成度按七个结构化分区等权计算。
- `Program.deadline` 可能是待审核的官网文本；`Application.deadline` 是日期输入值，按 `YYYY-MM-DD` 使用。不要混淆两者。
- 删除材料会级联删除其所有文件版本，但当前不会清理申请快照中的 `materialId`。修改材料删除逻辑时，应显式决定如何处理这些悬空关联。

### 5.5 材料与备份

- 材料元数据和每个历史版本的 Blob 都存入 IndexedDB。新版本号取已有最大值加一，并更新材料的 `currentVersionId`。
- UI 当前只接受 PDF、DOC/DOCX、JPG/JPEG、PNG，单文件上限 20 MB，空文件会被拒绝。底层 `db.ts` 不重复执行这些文件校验，因此新增写入入口时要主动复用或下沉校验。
- 普通备份是 ZIP；加密备份扩展名为 `.eumaster`，文件头为 `EUMA`，当前加密版本为 1。
- 加密使用 PBKDF2-SHA-256（310,000 次）派生 AES-GCM 256 位密钥；UI 要求密码至少 8 个字符。
- 当前备份只覆盖本地工作区：材料、材料版本、申请和 `catalogTable` 快照。它不会导出或恢复 Supabase 中的个人档案、权威项目目录、项目来源或字段变更。
- 备份清单为 `backup.json`，材料 Blob 位于 `files/<versionId>`，每个文件用 SHA-256 校验。导入文件最大 500 MB。
- 导入分为“检查”和“恢复”两步。恢复会整体清空并替换当前浏览器中的材料、材料版本、申请和本地表格快照，不覆盖 Supabase 数据。

## 6. 编码约定

- 使用 `@/` 别名导入 `src/` 下模块。
- 领域类型、联合枚举和显示标签集中维护在 `src/lib/types.ts`；不要在页面中复制另一套不一致的枚举。
- Supabase 数据写操作集中放在 `src/lib/server/catalog-repository.ts`、`src/lib/profile-postgres.ts` 或同层服务模块；本地 IndexedDB 写操作集中放在 `src/lib/db.ts`。
- 需要跨多个数据库表或对象仓库保持一致时，使用同一个 SQL 事务或 IndexedDB `readwrite` 事务。
- 保存实体时维持 `createdAt` 不变并更新 `updatedAt`；来源抓取时间使用 `fetchedAt`/`lastFetchedAt`，不要混用。
- 用户可见文本当前以简体中文为主，官网项目名、学位名等原始事实可保留英文。
- API 和导入边界继续使用 Zod 校验，并把预期错误转换为中文、可操作的提示；不要把内部异常、堆栈或密钥返回给用户。
- 客户端异步读取可复用 `useLocalQuery`。它以 `key` 和内部 `revision` 触发加载，故 loader 闭包中的其他变化不会自动重查；需要刷新时调用 `reload()` 或改变稳定查询键。
- 保持 React 状态不可变更新。排序数据库或 IndexedDB 返回数组时，如该数组仍被其他状态共享，先复制再排序。
- 样式优先复用现有 CSS 变量和语义类。主要响应式断点是 1100px、760px 和 430px；新增交互必须同时检查桌面侧栏和移动端底部导航布局。
- 当前移动端底部导航只显示前五个入口，设置页通过其他页面链接进入。调整导航时同时核对桌面与移动两套入口。

## 7. 测试策略

- 测试文件与实现相邻，命名为 `*.test.ts` 或脚本相邻测试，由 Vitest 运行。
- `catalog-server.test.ts` 使用内联 HTML 验证 URL 白名单、Firecrawl 回退、候选发现、辅助链接和字段风险分流；解析器改动应补充离线 fixture，不要让单元测试依赖真实大学官网。
- `db.test.ts` 使用 `fake-indexeddb` 验证本地材料、Blob 存储、`catalogTable` 和备份可读性。数据库模块在同一测试进程中缓存连接，新增用例要避免依赖执行顺序或固定空库假设。
- `profile-schema.test.ts` 固定个人档案结构校验；`matching.test.ts` 固定项目匹配评分；`progress.test.ts` 固定档案七分区算法和“只计算必需要求”的申请进度规则。
- 修改以下内容时应补充相应回归测试：
  - Supabase SQL、受限角色、迁移或仓储查询；
  - IndexedDB 升级、事务和级联行为；
  - 备份版本、加密头、校验和或恢复兼容性；
  - 官网域名/跳转安全、限额、Firecrawl 回退或解析正则；
  - 要求快照同步、材料自动关联和完成度计算。

## 8. 修改完成检查清单

1. 确认没有把数据库连接串、Firecrawl Key 或其他服务端密钥暴露到客户端、日志、提交或聊天。
2. 确认没有把当前“可信本地环境、尚未接入登录认证”的边界包装成正式多用户部署能力。
3. 涉及类型时同步检查 `types.ts`、Supabase 迁移、数据库仓储、IndexedDB、备份、页面和测试。
4. 涉及官网读取时复核 HTTPS、官方域名、跳转、robots.txt、限频、超时、大小限制、Firecrawl 回退和人工审核。
5. 涉及项目要求时复核已有申请快照不会被静默覆盖。
6. 涉及材料时复核版本 Blob、当前版本指针、删除行为和备份完整性。
7. 同时检查空状态、加载状态、错误提示和中文文案。
8. 检查桌面和移动布局，并运行对应的 lint、测试和构建命令。
9. 若本次改动改变了上述事实、命令或约束，同步更新本文件和 README。
