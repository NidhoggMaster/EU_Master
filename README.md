# EU Master Application Manager

面向欧洲硕士申请的本地管理工具，当前聚焦荷兰研究型大学和 2027+ 入学。个人档案、课程成绩、材料、申请和评分只保存在本机；Supabase 是可选项目目录，不保存个人信息。

## 功能

- 总览、项目目录、项目详情、2–8 项对比、项目申请与申请详情
- 个人信息、IELTS/GRE 分项与 ETS 官方换算工具链接
- 基本材料和项目特需材料清单；准备勾选与文件上传相互独立
- 本地 CSV / Supabase 项目模式和显式双向复制
- 官网事务式自动刷新、字段级来源、中文概述与历史记录
- QS 2027 学校总榜与 QS 2026 项目相关学科榜，含项目口径解读和官方榜单链接
- 竞争力、证据覆盖率、申请准备度、版本化权重与可选概率先验
- ZIP 或密码加密 `.eumaster` 完整备份；兼容 schema v1–v3

## 一键启动

需要 macOS、Node.js 20+ 和 pnpm。Supabase 不是启动前提。

双击 `start-website.command`，或在终端运行：

```bash
./start-website.command
```

脚本默认运行生产构建，只绑定 `127.0.0.1`。它会检查依赖、按需构建、迁移并校验本地数据、复用健康实例、自动选择 3000–3010 端口，并在 `/api/health` 通过后打开浏览器。日志写入 `.logs/website-YYYYMMDD.log`。

开发模式：

```bash
./start-website.command --dev
```

默认地址：[http://127.0.0.1:3000](http://127.0.0.1:3000)

## 本地数据

默认目录均位于仓库根目录，权限为目录 `0700`、文件 `0600`：

```text
Private_Data/
├── meta.csv
├── personal/profile.csv
├── catalog/
│   ├── universities.csv
│   ├── programs.csv
│   ├── source_snapshots.csv
│   └── change_history.csv
└── applications/
    ├── applications.csv
    ├── score_snapshots.csv
    └── match_overrides.csv

material_center/
├── materials.csv
├── material_versions.csv
├── basic/<短 ID + 标题>/versions/
└── programs/<项目 ID>/<短 ID + 标题>/versions/
```

复杂字段使用标准 JSON CSV 列，CSV 为明文。首次启动会把旧 `local-data/` 复制到新目录并校验，旧目录和迁移副本都保留。目录可在设置页直接于访达中显示。

可选覆盖：

```bash
EU_MASTER_PRIVATE_DATA_DIR=/absolute/path/to/Private_Data
EU_MASTER_MATERIAL_DIR=/absolute/path/to/material_center
EU_MASTER_DATA_DIR=/legacy/local-data/path
```

`EU_MASTER_DATA_DIR` 仅用于旧版迁移兼容。

## Supabase

实际凭据只写入已忽略的 `.env.local`：

```bash
SUPABASE_SESSION_POOLER_URL=postgresql://postgres.PROJECT_REF:URL_ENCODED_PASSWORD@aws-1-REGION.pooler.supabase.com:5432/postgres?sslmode=verify-full
SUPABASE_SESSION_POOL_MAX=3
SUPABASE_CA_CERT_PATH=/absolute/path/to/prod-ca-2021.crt
FIRECRAWL_API_KEY=
EU_MASTER_BASE_URL=http://127.0.0.1:3000
```

连接必须使用 Supavisor Session Pool `:5432`。应用拆分连接参数并把 CA 交给 `pg` 完成 `verify-full`，避免连接串中的 `sslmode` 覆盖证书配置。数据库操作使用 `eu_master_backend` 受限角色；旧远端档案表只读，远端写入仅涉及项目、来源、刷新与变更历史。

`/api/health` 只检查本地启动与目录完整性，确保 Supabase 网络故障不会卡住一键启动；设置页和切换到 Supabase 前会通过 `/api/storage/status` 执行完整远端诊断。

## 官网刷新

刷新只访问学校白名单 HTTPS 域名，重新验证跳转并遵守 robots.txt、每主机至少 5 秒间隔、20 秒超时、2 MB HTML 上限和 24 小时冷却。Firecrawl v2 可选，失败时只允许合规直连；不会绕过 robots、403、429、登录、验证码或付费墙。

有效官网事实直接事务写入未锁定字段；无效或空解析不会删除旧数据。抓取器会递归发现国际学历 foldout、accordion、语言最低分、材料、课程、就业和 Pre-master 子页；语言小分、材料模板、申请入口等保存到精确官方子页、PDF 或 fragment，而不是只挂项目主页。旧待审核记录会归档为 `superseded` 只读历史。

仓库带有 2026/27 官方基线导入，使用本地项目 API 原子写入 13 个项目的申请条件、材料、考试、课程、日期和来源：

```bash
pnpm catalog:official
```

基线中的学费和申请日期优先采用 2026/27：目录只显示短金额/日期，原文与精确链接保留在详情来源中。无法从当前官方费率表可靠确认的项目会明确显示“待官网确认”，不会用学校通用费率冒充项目金额。

Tilburg 2026/27 数据同时保留官网费率表和 [Tuition Fee Roadmap](https://landbot.pro/v3/H-3098416-R73QZFJEEIQN3TAL/index.html) 入口。Information Management、Data Science and Society、Data Science in Business and Entrepreneurship 的机构学费为 €23,900；学校生活费参考为每月 €1,000–€1,200，详情页会换算成年区间。

“双非 / 院校名单”分开保存官网规则与社区参考。官网硬条件优先；小红书、Reddit、B站、YouTube、知乎及留学论坛/平台只用于形成带证据等级的参考结论。界面会列出已检索平台和可复核链接，项目外或较旧案例不会被当成录取门槛或概率。

重新抓取 13 个种子项目：

```bash
pnpm catalog:seed
```

每个项目都会记录成功、冷却跳过或失败。

同步排名基线到本地 CSV 与 Supabase 项目目录：

```bash
pnpm catalog:rankings
```

排名基线覆盖 13 所进入 QS 2027 总榜的荷兰大学和 13 个种子项目；Open University of the Netherlands 保留为“未录入 QS 总榜”。项目详情将学校总榜与最接近项目方向的 QS 2026 学科榜分开显示。联合项目展示各合作院校的学科底盘，不把学科榜误写成项目自身排名；这些手工确认事实会锁定 `rankings` 字段，官网刷新不会静默覆盖。

## 评分

- 目录竞争力默认：标化 30%、课程 30%、学历/GPA 20%、经历 10%、项目因素 10%
- 申请综合指数默认：标化 25%、课程 25%、基本材料 20%、特需材料 10%、学历/GPA 10%、项目因素 10%
- 加权几何均值对已知零分采用 5% 下限；证据覆盖低于 60% 或硬条件失败时不输出总分/概率
- 概率必须来自带来源的基础区间；有申请/录取样本数时使用 95% Wilson 区间
- GRE/GMAT 不在应用内换算；Tilburg 显示 ETS 换算后的 GMAT 525+ 参考，Maastricht 显示 SBE GRE 二维表与 AWA 3.5，用户换算结果仍由本人确认记录

权重和项目概率先验在“设置与数据管理”中维护。每次确认保存权重版本与档案、项目、材料版本；数据变化后需要重新确认。

## 验证

```bash
pnpm lint
pnpm test
pnpm build
```

应用没有登录认证，只适合可信本地环境。公开部署前必须增加认证、API 访问控制和用户级隔离。
