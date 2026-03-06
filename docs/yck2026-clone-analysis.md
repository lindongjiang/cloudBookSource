# yck2026 源仓库站点分析与复刻方案

分析时间：2026-03-05（Asia/Shanghai）
目标站点：`https://www.yck2026.top/yuedu/shuyuan/index.html`

## 1. 站点技术形态

- 后端渲染：ThinkPHP（页面底部明确写了 `Thinkphp + Layui`）。
- 前端库：Layui + jQuery + 少量内联 JS。
- 页面不是 SPA：列表、筛选、分页均为服务端渲染 + query 参数。
- 交互增强：弹窗筛选、批量勾选、二维码生成、剪贴板复制。
- 存在广告和统计脚本（含混淆脚本、第三方注入），并产生控制台报错。

## 2. 模块拆解（你需要复刻的业务域）

- 阅读首页：`/yuedu/index/index.html`（APP介绍 + 相关链接）
- 书源（单源）：`/yuedu/shuyuan/*`
- 书源合集（文件型）：`/yuedu/shuyuans/*`
- 订阅源（单条）：`/yuedu/rss/*`
- 订阅源合集（文件型）：`/yuedu/rsss/*`
- 工具页：`/yuedu/tools/*`

## 3. 核心路由与接口行为

### 3.1 列表与详情

- 单源列表：`GET /yuedu/shuyuan/index.html`
- 单源详情：`GET /yuedu/shuyuan/content/id/{id}.html`
- 单源 JSON：`GET /yuedu/shuyuan/json/id/{id}.json`
- 批量 JSON：`GET /yuedu/shuyuan/jsons?id=7019-7018-...`

同构路由还存在于：
- `/yuedu/rss/*`
- `/yuedu/shuyuans/*`
- `/yuedu/rsss/*`

### 3.2 新增与删除

- 书源新增（AJAX）：`POST /yuedu/shuyuan/add.html`
  - 字段：`code`（JSON字符串）、`content`（富文本HTML）、可选 `tu`、`shengyin`
- 书源删除（AJAX）：`GET /yuedu/shuyuan/del/id/{id}.html`

未登录响应示例：
- 新增：`{"code":0,"msg":"请先登录！"...}`
- 删除：`{"code":0,"msg":"请先登录"...}`

### 3.3 临时短链生成（用于批量导入）

- `GET /index/durl/add.html?data={base64(真实jsons地址)}`
- 返回短链：`https://www.yck2026.top/d/{hash}`
- 短链 302 到真实 `jsons` 下载链接。

## 4. 页面交互细节（复刻时要对齐）

### 4.1 书源 / 订阅源（单条）列表

- 顶部操作：`全选`、`生成`、`新建`、`搜索`
- 卡片项字段：
  - 标题+源地址
  - 时间（相对时间或日期）
  - 版本标签（2.X/3.X）
  - 能力标签（发/搜/图/声）
  - 用户（含 UID）
  - 下载次数
- 分页：服务端输出 laypage HTML。

### 4.2 批量“生成”逻辑

- 收集 `ids[]` 勾选值拼接成 `1-2-3`。
- 拼出 `jsons?id=...` 地址。
- 调用 `/index/durl/add.html?data=base64(url)` 获取临时短链。
- 弹窗展示：
  - 文本地址
  - 下载链接
  - 一键导入深链
  - 二维码

### 4.3 导入深链差异

- `shuyuan/shuyuans` 使用：`yuedu://booksource/importonline?src=...`
- `rss` 使用：`legado://import/auto?src=...`
- `rsss` 使用：`legado://import/rssSource?src=...`

### 4.4 新建页差异

- `shuyuan` / `rss`：文本框粘贴 JSON 源码 + 说明富文本。
- `shuyuans` / `rsss`：上传 JSON 文件（`acceptMime: application/json`）+ 标题 + 说明。

## 5. 登录与权限

- 登录入口：`/index/login/login.html`
- 观察到跳转到 Gitee OAuth 登录页（第三方 OAuth）。
- 匿名用户可浏览和下载，新增/删除必须登录。

## 6. 建议你不要照搬的部分

- 广告注入脚本（含混淆代码与外部未知 JS）。
- 第三方统计与可疑资源域名。

建议替换成：
- 自己可控的统计（如 Plausible / Umami / GA）
- 自己可控广告位系统（如果要广告）

## 7. 复刻实现建议（现代化版本）

### 7.1 推荐技术栈

- 后端：`NestJS` 或 `Express + TypeScript`
- 前端：`Next.js`（SSR）或继续用 `Layui + 模板引擎`
- 数据库：`PostgreSQL`
- ORM：`Prisma`
- 富文本：`TipTap` / `Quill`（代替 Layedit）
- 文件存储：`S3/R2`
- 登录：`OAuth2 + JWT + Session`

### 7.2 数据模型（最小集）

建议至少四张主表：
- `users`
- `entries`（统一书源/订阅源/合集）
- `entry_files`（合集上传文件）
- `short_links`（临时短链）

`entries` 关键字段：
- `id`, `type`(shuyuan/shuyuans/rss/rsss)
- `title`, `source_url`, `code_json`, `content_html`
- `flags`（faxian/sousuo/tu/shengyin/ver）
- `source_count`, `download_count`
- `author_id`, `created_at`, `updated_at`

### 7.3 路由设计（建议）

- `GET /:type/index`
- `GET /:type/content/:id`
- `POST /:type/add`
- `DELETE /:type/:id`
- `GET /:type/json/:id`
- `GET /:type/jsons?ids=1-2-3`
- `GET /short-links/new?data=...`
- `GET /d/:hash`

## 8. 最小可用开发顺序（MVP）

1. 先做 `shuyuan` 单模块：列表、详情、新增、删除、JSON下载。
2. 再加 `jsons` 批量导出 + 短链。
3. 再复制到 `rss`（仅改深链协议和文案）。
4. 再做 `shuyuans/rsss` 的文件上传型流程。
5. 最后做登录、权限、后台审核、防滥用。

## 9. 风险与合规提醒

- 内容版权、成人内容、抓取来源合法性要先评估。
- 需要准备：内容审核机制、违法内容下线机制、举报入口、日志留存。
- 文件导入与富文本必须做安全处理（JSON 校验、XSS 过滤、上传白名单）。

