# 香色源 (cloudBookSource)

一个可运行的源仓库复刻站点（MySQL 版），覆盖原站核心结构与流程：

- 模块：`shuyuan / shuyuans / install / activation`
- 路由风格：`/yuedu/.../*.html`
- 功能：用户注册登录、自主发布书源、支持上传 `json/xbs`、自动 `xbs→json` 转换、详情页 `json/xbs` 下载、批量短链、一键导入、MT助手安装教程、卡密购买入口、`iOS/安卓` 一键模式切换
- 书源提交优化：内置香色闺阁（iOS）兼容校验，自动补齐 `sourceType/weight/lastModifyTime`，并修正常见 `.//` XPath 兼容问题

## 环境要求

- Node.js 18+
- MySQL 5.7+（启动时会自动检测版本）

## 配置

1. 复制环境变量模板：

```bash
cp .env.example .env
```

2. 修改 `.env` 中的站点与 MySQL 配置：

```env
SITE_NAME=香色源
SITE_MODE_DEFAULT=ios
AI_BOOKSOURCE_URL=https://github.com/lindongjiang/xiangseSkill
APP_INSTALL_URL=/yuedu/install/index.html
ACTIVATION_BUY_URL=https://cloudmantoua.top/81/
ANDROID_SITE_NAME=开源阅读
ANDROID_APK_URL_PRIMARY=https://gcore.jsdelivr.net/gh/mumuceo/file01/applist/yuedu/legado_app_3.23.110211.apk
ANDROID_APK_URL_SECONDARY=https://gcore.jsdelivr.net/gh/mumuceo/file01/applist/yuedu/legado_app_3.25.apk
ANDROID_APK_URL_BETA=https://miaogongzi.lanzout.com/b01rgkhhe
ANDROID_OPEN_SOURCE_URL=https://github.com/gedoor/legado
ANDROID_BILIBILI_URL=https://space.bilibili.com/188144093
ANDROID_XIU2_URL=https://yuedu.xiu2.xyz
ANDROID_SOURCE_HUB_URL=https://legado.aoaostar.com/
MT_WINDOWS_URL=https://wwbhc.lanzn.com/iwFoH3g1r9da
MT_MACOS_URL=https://wwbhc.lanzn.com/ivLSo3g1tjkj
CARD_BUY_URL=https://cloudmantoua.top/81/
MT_WINDOWS_QR_URL=/static/images/install/qr-win.png
MT_MACOS_QR_URL=/static/images/install/qr-mac.png
INSTALL_SHOT_1=/static/images/install/shot-1-mt.jpg
INSTALL_SHOT_2=/static/images/install/shot-2-store.jpg
INSTALL_SHOT_3=/static/images/install/shot-3-done.jpg
PYTHON_BIN=python3
XBS_TOOL_PATH=/Users/mantou/Documents/idea/3.2/xiangseSkill/tools/scripts/xbs_tool.py
XBSREBUILD_ROOT=/Users/mantou/Documents/idea/3.2/xbsrebuild

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

## XBS 自动转换

- 上传 `.xbs` 文件时会在服务端自动执行 `xbs2json`，再进入规则校验与发布流程。
- 详情页支持下载 `.xbs`（服务端 `json2xbs` 动态生成）。
- 如部署环境路径不同，请修改 `.env` 的 `XBS_TOOL_PATH` 与 `XBSREBUILD_ROOT`。

## 主要路由

- `GET /yuedu/:type/index.html`
- `GET /yuedu/:type/content/id/:id.html`
- `GET /yuedu/:type/add.html`
- `POST /yuedu/:type/add.html`
- `GET /yuedu/:type/del/id/:id.html`（需登录）
- `GET /yuedu/:type/json/id/:id.json`
- `GET /yuedu/:type/xbs/id/:id.xbs`
- `GET /yuedu/:type/jsons?id=1-2-3`
- `GET /yuedu/install/index.html`
- `GET /yuedu/activation/index.html`
- `GET /index/site-mode/switch?mode=ios|android&redirect=...`
- `GET /index/register/register.html`
- `POST /index/register/register.html`
- `GET /index/durl/add.html?data=base64(url)`
- `GET /d/:hash`

## 说明

- 复刻时已去掉原站广告和第三方混淆脚本。
- 登录为本地账号模式，便于本地开发与二次扩展。
