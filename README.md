# cloudBookSource

一个可运行的源仓库复刻站点（MySQL 版），覆盖原站核心结构与流程：

- 模块：`shuyuan / shuyuans / rss / rsss / tools`
- 路由风格：`/yuedu/.../*.html`
- 功能：列表筛选、分页、详情、JSON 下载、批量短链、一键导入链接、二维码、登录后新增/删除

## 环境要求

- Node.js 18+
- MySQL 8.0+

## 配置

1. 复制环境变量模板：

```bash
cp .env.example .env
```

2. 修改 `.env` 中的 MySQL 配置：

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=cloud_book_source
```

## 启动

```bash
npm install
npm run dev
```

启动后访问：

- `http://localhost:3000/yuedu/shuyuan/index.html`

## 初始化种子数据（可选）

```bash
npm run seed
```

应用启动时会自动建库建表并自动补种子（若表为空）。

## 演示账号

- 用户名：`admin`
- 密码：`admin123`

## 主要路由

- `GET /yuedu/:type/index.html`
- `GET /yuedu/:type/content/id/:id.html`
- `GET /yuedu/:type/add.html`
- `POST /yuedu/:type/add.html`
- `GET /yuedu/:type/del/id/:id.html`（需登录）
- `GET /yuedu/:type/json/id/:id.json`
- `GET /yuedu/:type/jsons?id=1-2-3`
- `GET /index/durl/add.html?data=base64(url)`
- `GET /d/:hash`

## 说明

- 复刻时已去掉原站广告和第三方混淆脚本。
- 登录为本地账号模式，便于本地开发与二次扩展。
