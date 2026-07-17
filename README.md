# EU Master Application Manager

面向欧洲硕士申请的本地管理工具，首期聚焦荷兰研究型大学。

项目使用 Next.js App Router、TypeScript 和 Tailwind CSS 构建。档案、材料和申请数据保存在当前浏览器，不需要登录或远程数据库。

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

## 检查命令

```bash
pnpm lint
pnpm test
pnpm build
```

## 数据说明

用户数据仅保存在当前浏览器的 IndexedDB 中。清理浏览器站点数据会删除本地内容，请定期在设置页面导出备份。

本项目当前不包含登录、云端数据库、自动申请、AI 文书生成或线上部署。
