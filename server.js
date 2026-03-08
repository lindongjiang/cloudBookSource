require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const mysql = require('mysql2/promise');
const multer = require('multer');

const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PORT = Number(process.env.PORT || 3000);

function resolvePathFromRoot(rawValue, fallbackAbsolutePath) {
  const value = String(rawValue || '').trim();
  if (!value) return fallbackAbsolutePath;
  if (path.isAbsolute(value)) return value;
  return path.resolve(ROOT, value);
}

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'cloud_book_source';
const SITE_NAME = process.env.SITE_NAME || '香色源';
const AI_BOOKSOURCE_URL =
  process.env.AI_BOOKSOURCE_URL || 'https://github.com/lindongjiang/xiangseSkill';
const APP_INSTALL_URL =
  process.env.APP_INSTALL_URL || 'https://github.com/lindongjiang/xiangseSkill#readme';
const ACTIVATION_BUY_URL =
  process.env.ACTIVATION_BUY_URL || 'https://github.com/lindongjiang/xiangseSkill';
const MT_WINDOWS_URL =
  process.env.MT_WINDOWS_URL || 'https://wwbhc.lanzn.com/iwFoH3g1r9da';
const MT_MACOS_URL =
  process.env.MT_MACOS_URL || 'https://wwbhc.lanzn.com/ivLSo3g1tjkj';
const CARD_BUY_URL =
  process.env.CARD_BUY_URL || 'https://cloudmantoua.top/81/';
const SITE_GITHUB_URL =
  process.env.SITE_GITHUB_URL || 'https://github.com/lindongjiang/cloudBookSource';
const GITHUB_OAUTH_CLIENT_ID = process.env.GITHUB_OAUTH_CLIENT_ID || '';
const GITHUB_OAUTH_CLIENT_SECRET = process.env.GITHUB_OAUTH_CLIENT_SECRET || '';
const GITHUB_OAUTH_CALLBACK_URL = process.env.GITHUB_OAUTH_CALLBACK_URL || '';
const GITHUB_OAUTH_SCOPE = process.env.GITHUB_OAUTH_SCOPE || 'read:user user:email';
const ANDROID_SITE_NAME = process.env.ANDROID_SITE_NAME || '开源阅读';
const ANDROID_APK_URL_PRIMARY =
  process.env.ANDROID_APK_URL_PRIMARY ||
  'https://gcore.jsdelivr.net/gh/mumuceo/file01/applist/yuedu/legado_app_3.23.110211.apk';
const ANDROID_APK_URL_SECONDARY =
  process.env.ANDROID_APK_URL_SECONDARY ||
  'https://gcore.jsdelivr.net/gh/mumuceo/file01/applist/yuedu/legado_app_3.25.apk';
const ANDROID_APK_URL_BETA =
  process.env.ANDROID_APK_URL_BETA || 'https://miaogongzi.lanzout.com/b01rgkhhe';
const ANDROID_OPEN_SOURCE_URL =
  process.env.ANDROID_OPEN_SOURCE_URL || 'https://github.com/gedoor/legado';
const ANDROID_BILIBILI_URL =
  process.env.ANDROID_BILIBILI_URL || 'https://space.bilibili.com/188144093';
const ANDROID_XIU2_URL =
  process.env.ANDROID_XIU2_URL || 'https://yuedu.xiu2.xyz';
const ANDROID_SOURCE_HUB_URL =
  process.env.ANDROID_SOURCE_HUB_URL || 'https://legado.aoaostar.com/';
const SITE_MODE_DEFAULT = process.env.SITE_MODE_DEFAULT || 'ios';
const MT_WINDOWS_QR_URL =
  process.env.MT_WINDOWS_QR_URL || '/static/images/install/qr-win.png';
const MT_MACOS_QR_URL =
  process.env.MT_MACOS_QR_URL || '/static/images/install/qr-mac.png';
const INSTALL_SHOT_1 =
  process.env.INSTALL_SHOT_1 || '/static/images/install/shot-1-mt.jpg';
const INSTALL_SHOT_2 =
  process.env.INSTALL_SHOT_2 || '/static/images/install/shot-2-store.jpg';
const INSTALL_SHOT_3 =
  process.env.INSTALL_SHOT_3 || '/static/images/install/shot-3-done.jpg';
const PYTHON_BIN = process.env.PYTHON_BIN || '';
const XBS_TOOL_DEFAULT_PATH = path.join(ROOT, 'tools/scripts/xbs_tool.py');
const XBS_TOOL_CONFIG_PATH = resolvePathFromRoot(process.env.XBS_TOOL_PATH, XBS_TOOL_DEFAULT_PATH);
const XBS_TOOL_PATH =
  fs.existsSync(XBS_TOOL_CONFIG_PATH) || !fs.existsSync(XBS_TOOL_DEFAULT_PATH)
    ? XBS_TOOL_CONFIG_PATH
    : XBS_TOOL_DEFAULT_PATH;
const XBSREBUILD_DEFAULT_ROOT = path.join(ROOT, 'xbsrebuild');
const XBSREBUILD_CONFIG_ROOT = resolvePathFromRoot(
  process.env.XBSREBUILD_ROOT,
  XBSREBUILD_DEFAULT_ROOT
);
const XBSREBUILD_ROOT =
  fs.existsSync(XBSREBUILD_CONFIG_ROOT) || !fs.existsSync(XBSREBUILD_DEFAULT_ROOT)
    ? XBSREBUILD_CONFIG_ROOT
    : XBSREBUILD_DEFAULT_ROOT;
const MYSQL_MIN_MAJOR = 5;
const MYSQL_MIN_MINOR = 7;
const IS_GITHUB_AUTH_ENABLED = Boolean(GITHUB_OAUTH_CLIENT_ID && GITHUB_OAUTH_CLIENT_SECRET);
const ENABLE_SAMPLE_SEED = String(process.env.ENABLE_SAMPLE_SEED || '0') === '1';
const ADMIN_UID = 1000;

if (String(process.env.XBS_TOOL_PATH || '').trim() && XBS_TOOL_CONFIG_PATH !== XBS_TOOL_PATH) {
  // eslint-disable-next-line no-console
  console.warn(
    `[xbs] 配置的 XBS_TOOL_PATH 无效，已回退为项目路径: ${XBS_TOOL_PATH}`
  );
}

if (String(process.env.XBSREBUILD_ROOT || '').trim() && XBSREBUILD_CONFIG_ROOT !== XBSREBUILD_ROOT) {
  // eslint-disable-next-line no-console
  console.warn(
    `[xbs] 配置的 XBSREBUILD_ROOT 无效，已回退为项目路径: ${XBSREBUILD_ROOT}`
  );
}

const XIANGSE_SOURCE_TYPES = new Set(['text', 'comic', 'video', 'audio']);
const XIANGSE_REQUIRED_ACTIONS = ['searchBook', 'bookDetail', 'chapterList', 'chapterContent'];
const XIANGSE_REQUESTINFO_REQUIRED_ACTIONS = new Set(['searchBook']);
const XIANGSE_XPATH_FIELDS = [
  'list',
  'name',
  'title',
  'url',
  'detailUrl',
  'coverUrl',
  'intro',
  'author',
  'catagory',
  'category',
  'status',
  'wordCount',
  'updateTime',
  'lastChapter',
  'content',
  'nextPageUrl',
];

const ONLY_SEED = process.argv.includes('--seed');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let pool;

const TYPE_CONFIG = {
  shuyuan: {
    key: 'shuyuan',
    label: '书源',
    kind: 'single',
    importPrefix: 'yuedu://booksource/importonline?src=',
  },
  shuyuans: {
    key: 'shuyuans',
    label: '书源合集',
    kind: 'file',
    importPrefix: 'yuedu://booksource/importonline?src=',
  },
};

const SITE_MODE_CONFIG = {
  ios: {
    key: 'ios',
    siteName: SITE_NAME,
    logoUrl: '/static/images/xiangse-logo.png',
    appName: SITE_NAME,
    appSubTitle: '香色闺阁 iOS 书源仓库',
    platformLabel: 'iOS',
    sourceTypeLabel: '书源',
    installNavLabel: '安装教程',
    activationNavLabel: '激活码购买',
    topExternalLabel: 'AI 自动写书源',
    topExternalUrl: AI_BOOKSOURCE_URL,
    footerSubtitle: '香色闺阁 iOS 书源站 · Express + MySQL 5.7+',
    homeNoticeLines: [
      '本站专注香色闺阁 iOS 书源，不提供订阅源模块。',
      '提交书源时会自动进行香色规则兼容优化（sourceType / weight / lastModifyTime / XPath）。',
      '推荐优先使用“书源合集”进行批量分发，便于版本管理和回滚。',
    ],
    homeRelatedLinks: [
      { label: 'AI 自动写书源（GitHub）', url: AI_BOOKSOURCE_URL, external: true, danger: true },
      { label: 'MT助手安装教程', url: '/yuedu/install/index.html' },
      { label: '卡密购买地址', url: CARD_BUY_URL, external: true },
      { label: '查看完整安装教程', url: '/yuedu/install/index.html' },
    ],
    downloadButtons: [],
    relatedLinks: [],
  },
  android: {
    key: 'android',
    siteName: ANDROID_SITE_NAME,
    logoUrl: '/static/images/yuedu-logo.png',
    appName: '阅读',
    appSubTitle: '开源阅读 Android 书源仓库',
    platformLabel: '安卓',
    sourceTypeLabel: '小说',
    installNavLabel: '安卓下载',
    activationNavLabel: '开源地址',
    topExternalLabel: '阅读 APP 开源地址',
    topExternalUrl: ANDROID_OPEN_SOURCE_URL,
    footerSubtitle: '开源阅读 Android 书源站 · Express + MySQL 5.7+',
    homeNoticeLines: [
      '自定义书源规则，抓取网页数据，规则清晰并可持续维护。',
      '书源支持搜索与发现，找书与看书路径可自定义扩展。',
      '支持本地 TXT / EPUB 阅读、净化替换、多翻页模式等能力。',
    ],
    homeRelatedLinks: [
      { label: '阅读APP开源地址', url: ANDROID_OPEN_SOURCE_URL, external: true, danger: true },
      { label: '安卓下载地址', url: '/yuedu/install/index.html' },
      { label: '喵公子 B 站', url: ANDROID_BILIBILI_URL, external: true },
      { label: 'XIU2 书源与订阅源', url: ANDROID_XIU2_URL, external: true },
    ],
    downloadButtons: [
      { label: '正式版 3.23.110211.apk', url: ANDROID_APK_URL_PRIMARY, external: true },
      { label: '正式版 3.25.apk', url: ANDROID_APK_URL_SECONDARY, external: true },
      { label: 'Beta 版（喵公子提供）', url: ANDROID_APK_URL_BETA, external: true },
    ],
    relatedLinks: [
      { label: '阅读APP开源地址', url: ANDROID_OPEN_SOURCE_URL },
      { label: '喵公子的 B 站地址', url: ANDROID_BILIBILI_URL },
      { label: 'XIU2 的书源和订阅源', url: ANDROID_XIU2_URL },
      { label: '「阅读」APP 源', url: ANDROID_SOURCE_HUB_URL },
    ],
  },
};

const app = express();
app.set('trust proxy', true);

app.set('view engine', 'ejs');
app.set('views', path.join(ROOT, 'views'));

app.use(express.urlencoded({ extended: true, limit: '8mb' }));
app.use(express.json({ limit: '8mb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'yck-clone-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 3600 * 1000 },
  })
);

app.use('/static', express.static(path.join(ROOT, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

app.use((req, res, next) => {
  const queryMode = normalizeSiteMode(req.query.mode);
  if (queryMode) {
    req.session.siteMode = queryMode;
  }

  const siteMode = resolveSiteMode(req.session.siteMode);
  const baseMeta = SITE_MODE_CONFIG[siteMode];
  const switchMeta = SITE_MODE_CONFIG[siteMode === 'android' ? 'ios' : 'android'];

  res.locals.currentUser = req.session.user || null;
  res.locals.requestUrl = req.originalUrl;
  res.locals.siteMode = siteMode;
  res.locals.typeConfigMap = TYPE_CONFIG;
  res.locals.pageLabelMap = {
    index: '首页',
    install: baseMeta.installNavLabel,
    activation: baseMeta.activationNavLabel,
    shuyuan: TYPE_CONFIG.shuyuan.label,
    shuyuans: TYPE_CONFIG.shuyuans.label,
  };
  res.locals.siteMeta = {
    ...baseMeta,
    siteName: baseMeta.siteName,
    logoUrl: baseMeta.logoUrl,
    siteGithubUrl: SITE_GITHUB_URL,
    githubAuthEnabled: IS_GITHUB_AUTH_ENABLED,
    modeSwitch: {
      targetMode: switchMeta.key,
      label: switchMeta.siteName,
      logoUrl: switchMeta.logoUrl,
      href: `/index/site-mode/switch?mode=${switchMeta.key}&redirect=${encodeURIComponent(req.originalUrl)}`,
    },
    aiBookSourceUrl: AI_BOOKSOURCE_URL,
    appInstallUrl: APP_INSTALL_URL,
    activationBuyUrl: ACTIVATION_BUY_URL,
    mtWindowsUrl: MT_WINDOWS_URL,
    mtMacUrl: MT_MACOS_URL,
    cardBuyUrl: CARD_BUY_URL,
    mtWindowsQrUrl: MT_WINDOWS_QR_URL,
    mtMacQrUrl: MT_MACOS_QR_URL,
    installShots: [INSTALL_SHOT_1, INSTALL_SHOT_2, INSTALL_SHOT_3],
    androidDownloads: baseMeta.downloadButtons || [],
    androidRelatedLinks: baseMeta.relatedLinks || [],
  };
  next();
});

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || '.json') || '.json';
    const name = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext === '.json' || ext === '.xbs' || file.mimetype.includes('json')) {
      cb(null, true);
      return;
    }
    cb(new Error('仅支持 JSON / XBS 文件'));
  },
});

app.get('/', (_, res) => {
  res.redirect('/yuedu/index/index.html');
});

app.get('/index/site-mode/switch', (req, res) => {
  const mode = normalizeSiteMode(req.query.mode);
  if (mode) {
    req.session.siteMode = mode;
  }

  res.redirect(normalizeRedirectPath(req.query.redirect));
});

app.get('/yuedu/index/index.html', (req, res) => {
  res.render('pages/yuedu-index', {
    pageTitle: `${res.locals.siteMeta.siteName} - 首页`,
    currentType: 'index',
  });
});

app.get('/yuedu/install/index.html', (req, res) => {
  res.render('pages/install', {
    pageTitle: `${res.locals.siteMeta.siteName} - ${res.locals.siteMeta.installNavLabel}`,
    currentType: 'install',
  });
});

app.get('/yuedu/activation/index.html', (req, res) => {
  res.render('pages/activation', {
    pageTitle: `${res.locals.siteMeta.siteName} - ${res.locals.siteMeta.activationNavLabel}`,
    currentType: 'activation',
  });
});

app.get('/index/login/login.html', (req, res) => {
  if (req.session.user) {
    res.redirect(req.query.redirect || '/yuedu/shuyuan/index.html');
    return;
  }

  res.render('pages/login', {
    pageTitle: `登录 - ${res.locals.siteMeta.siteName}`,
    currentType: 'none',
    error: resolveLoginErrorMessage(req.query.error),
    redirect: normalizeRedirectPath(req.query.redirect),
    githubEnabled: IS_GITHUB_AUTH_ENABLED,
  });
});

app.post('/index/login/login.html', (req, res) => {
  const redirect = normalizeRedirectPath(req.body.redirect || '/yuedu/shuyuan/index.html');
  res.redirect(`/index/login/login.html?redirect=${encodeURIComponent(redirect)}&error=github_only`);
});

app.get('/index/login/github', (req, res) => {
  if (!IS_GITHUB_AUTH_ENABLED) {
    const redirect = normalizeRedirectPath(req.query.redirect);
    res.redirect(`/index/login/login.html?redirect=${encodeURIComponent(redirect)}&error=github_not_configured`);
    return;
  }

  const state = crypto.randomBytes(24).toString('hex');
  const redirect = normalizeRedirectPath(req.query.redirect);

  req.session.githubOauthState = state;
  req.session.githubOauthRedirect = redirect;

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', GITHUB_OAUTH_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', buildGithubOauthCallbackUrl(req));
  authUrl.searchParams.set('scope', GITHUB_OAUTH_SCOPE);
  authUrl.searchParams.set('state', state);
  res.redirect(authUrl.toString());
});

app.get('/index/login/github/callback', async (req, res) => {
  if (!IS_GITHUB_AUTH_ENABLED) {
    res.redirect('/index/login/login.html?error=github_not_configured');
    return;
  }

  if (req.query.error) {
    res.redirect('/index/login/login.html?error=github_oauth_denied');
    return;
  }

  const callbackState = String(req.query.state || '').trim();
  if (!callbackState || callbackState !== String(req.session.githubOauthState || '').trim()) {
    req.session.githubOauthState = '';
    res.redirect('/index/login/login.html?error=github_state_invalid');
    return;
  }

  const code = String(req.query.code || '').trim();
  if (!code) {
    res.redirect('/index/login/login.html?error=github_no_code');
    return;
  }

  const redirectTo = normalizeRedirectPath(req.session.githubOauthRedirect);
  req.session.githubOauthState = '';
  req.session.githubOauthRedirect = '';

  try {
    const githubToken = await exchangeGithubAccessToken(req, code, callbackState);
    const githubUser = await fetchGithubUserProfile(githubToken);
    const githubEmail = await fetchGithubUserPrimaryEmail(githubToken);
    const user = await createOrUpdateGithubUser(githubUser, githubEmail);

    req.session.user = {
      id: user.id,
      uid: user.uid,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url || '',
    };

    res.redirect(redirectTo);
    return;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('GitHub OAuth failed:', error);
    res.redirect('/index/login/login.html?error=github_exchange_failed');
    return;
  }
});

app.get('/index/register/register.html', (req, res) => {
  const redirect = normalizeRedirectPath(req.query.redirect || '/yuedu/shuyuan/index.html');
  res.redirect(`/index/login/login.html?redirect=${encodeURIComponent(redirect)}&error=register_disabled`);
});

app.post('/index/register/register.html', (req, res) => {
  const redirect = normalizeRedirectPath(req.body.redirect || '/yuedu/shuyuan/index.html');
  res.redirect(`/index/login/login.html?redirect=${encodeURIComponent(redirect)}&error=register_disabled`);
});

app.get(['/index/logout', '/index/login/logout.html'], (req, res) => {
  req.session.destroy(() => {
    res.redirect('/yuedu/shuyuan/index.html');
  });
});

app.get('/yuedu/:type/index.html', async (req, res, next) => {
  const cfg = TYPE_CONFIG[req.params.type];
  if (!cfg) {
    next();
    return;
  }

  const pageSize = 60;
  const requestedPage = toInt(req.query.page, 1);

  const { whereSql, params, orderSql } = buildListQuery(cfg, req.query, { siteMode: res.locals.siteMode });
  const countRows = await query(`select count(*) as c from entries where ${whereSql}`, params);
  const total = Number(countRows[0]?.c || 0);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const offset = (page - 1) * pageSize;

  const rows = await query(
    `select id, type, title, source_url, ver, has_faxian, has_sousuo, has_tu, has_shengyin, source_count, download_count, author_uid, author_name, created_at, updated_at
     from entries
     where ${whereSql}
     ${orderSql}
     limit ? offset ?`,
    [...params, pageSize, offset]
  );

  const entries = rows.map((row) => ({
    ...row,
    relativeTime: formatRelativeTime(row.updated_at),
  }));

  res.render('pages/list', {
    pageTitle: `${res.locals.siteMeta.siteName} - ${cfg.label}`,
    currentType: cfg.key,
    cfg,
    entries,
    total,
    page,
    totalPages,
    pageItems: buildPageItems(page, totalPages),
    buildPageUrl: (p) => buildListUrl(cfg.key, req.query, p),
    query: {
      keys: String(req.query.keys || ''),
      uid: String(req.query.uid || ''),
      order1: String(req.query.order1 || 'time'),
      order2: String(req.query.order2 || '1'),
      ver: String(req.query.ver || ''),
      faxian: String(req.query.faxian || ''),
      sousuo: String(req.query.sousuo || ''),
      tu: String(req.query.tu || ''),
      shengyin: String(req.query.shengyin || ''),
    },
  });
});

app.get('/yuedu/:type/content/id/:id.html', async (req, res, next) => {
  const cfg = TYPE_CONFIG[req.params.type];
  if (!cfg) {
    next();
    return;
  }

  const id = toInt(req.params.id, 0);
  const platform = resolveCurrentPlatform(req);
  const entries = await query(
    'select * from entries where id = ? and type = ? and platform = ? and is_deleted = 0 limit 1',
    [
    id,
    cfg.key,
      platform,
    ]
  );
  const entry = entries[0];

  if (!entry) {
    res.status(404).send('未找到内容');
    return;
  }

  const jsonPath = `/yuedu/${cfg.key}/json/id/${entry.id}.json`;
  const xbsPath = `/yuedu/${cfg.key}/xbs/id/${entry.id}.xbs`;
  const jsonUrl = jsonPath;
  const xbsUrl = xbsPath;
  const importUrl = `${cfg.importPrefix}${getRequestOrigin(req)}${jsonPath}`;

  res.render('pages/detail', {
    pageTitle: `${entry.title} - ${res.locals.siteMeta.siteName}`,
    currentType: cfg.key,
    cfg,
    entry,
    jsonUrl,
    xbsUrl,
    importUrl,
    codeDisplay: prettyJson(readEntryRawJson(entry)),
    relativeTime: formatRelativeTime(entry.updated_at),
  });
});

app.get('/yuedu/:type/add.html', (req, res, next) => {
  const cfg = TYPE_CONFIG[req.params.type];
  if (!cfg) {
    next();
    return;
  }

  const template = cfg.kind === 'single' ? 'pages/add-single' : 'pages/add-file';
  res.render(template, {
    pageTitle: `${res.locals.siteMeta.siteName} - 新建${cfg.label}`,
    currentType: cfg.key,
    cfg,
  });
});

app.post('/yuedu/:type/add.html', (req, res, next) => {
  const cfg = TYPE_CONFIG[req.params.type];
  if (!cfg) {
    next();
    return;
  }

  upload.single('file')(req, res, async (err) => {
    if (err) {
      res.json({ code: 0, msg: err.message, data: '', url: '', wait: 3 });
      return;
    }

    if (!req.session.user) {
      cleanupUploadedFile(req.file);
      res.json({ code: 0, msg: '请先登录！', data: '', url: '', wait: 3 });
      return;
    }

    try {
      if (cfg.kind === 'single') {
        await handleSingleAdd(req, res, cfg);
      } else {
        await handleFileAdd(req, res, cfg);
      }
    } catch (error) {
      cleanupUploadedFile(req.file);
      res.json({ code: 0, msg: `提交失败: ${error.message}`, data: '', url: '', wait: 3 });
    }
  });
});

app.get('/yuedu/:type/del/id/:id.html', requireLoginJson, async (req, res, next) => {
  const cfg = TYPE_CONFIG[req.params.type];
  if (!cfg) {
    next();
    return;
  }

  const id = toInt(req.params.id, 0);
  const platform = resolveCurrentPlatform(req);
  const rows = await query(
    'select id, author_uid from entries where id = ? and type = ? and platform = ? and is_deleted = 0 limit 1',
    [
    id,
    cfg.key,
      platform,
    ]
  );

  if (rows.length < 1) {
    res.json({ code: 0, msg: '数据不存在', data: '', url: '', wait: 2 });
    return;
  }

  const target = rows[0];
  if (!canManageEntry(req.session.user, target.author_uid)) {
    res.json({ code: 0, msg: '只能删除自己上传的书源', data: '', url: '', wait: 2 });
    return;
  }

  await query('update entries set is_deleted = 1, updated_at = ? where id = ? and type = ? and platform = ?', [
    Date.now(),
    id,
    cfg.key,
    platform,
  ]);
  res.json({ code: 1, msg: '删除成功', data: '', url: `/yuedu/${cfg.key}/index.html`, wait: 1 });
});

app.post('/yuedu/:type/del-selected.json', requireLoginJson, async (req, res, next) => {
  const cfg = TYPE_CONFIG[req.params.type];
  if (!cfg) {
    next();
    return;
  }

  const ids = parseIdList(req.body?.ids ?? req.body?.id ?? '');
  const platform = resolveCurrentPlatform(req);
  if (ids.length < 1) {
    res.json({ code: 0, msg: '请先勾选要删除的数据', data: '', url: '', wait: 2 });
    return;
  }

  const placeholders = ids.map(() => '?').join(',');
  const rows = await query(
    `select id, author_uid from entries where type = ? and platform = ? and is_deleted = 0 and id in (${placeholders})`,
    [cfg.key, platform, ...ids]
  );
  if (rows.length < 1) {
    res.json({ code: 0, msg: '选中的数据不存在', data: '', url: '', wait: 2 });
    return;
  }

  const allowedIds = rows
    .filter((row) => canManageEntry(req.session.user, row.author_uid))
    .map((row) => Number(row.id))
    .filter((id) => id > 0);

  if (allowedIds.length < 1) {
    res.json({ code: 0, msg: '选中的数据不属于你，无法删除', data: '', url: '', wait: 2 });
    return;
  }

  const now = Date.now();
  const allowPlaceholders = allowedIds.map(() => '?').join(',');
  const result = await query(
    `update entries set is_deleted = 1, updated_at = ? where type = ? and platform = ? and id in (${allowPlaceholders})`,
    [now, cfg.key, platform, ...allowedIds]
  );
  const affected = Number(result?.affectedRows || 0);
  const skipped = ids.length - allowedIds.length;
  const skipText = skipped > 0 ? `，跳过 ${skipped} 条（无权限或不存在）` : '';
  res.json({
    code: 1,
    msg: `已删除 ${affected} 条${skipText}`,
    data: '',
    url: `/yuedu/${cfg.key}/index.html`,
    wait: 1,
  });
});

app.post('/yuedu/:type/del-mine.json', requireLoginJson, async (req, res, next) => {
  const cfg = TYPE_CONFIG[req.params.type];
  if (!cfg) {
    next();
    return;
  }

  const uid = Number(req.session?.user?.uid || 0);
  const platform = resolveCurrentPlatform(req);
  if (!(uid > 0)) {
    res.json({ code: 0, msg: '请先登录', data: '', url: '', wait: 2 });
    return;
  }

  const now = Date.now();
  const result = await query(
    'update entries set is_deleted = 1, updated_at = ? where type = ? and platform = ? and is_deleted = 0 and author_uid = ?',
    [now, cfg.key, platform, uid]
  );
  const affected = Number(result?.affectedRows || 0);
  if (affected < 1) {
    res.json({ code: 0, msg: '你暂时没有可删除的书源', data: '', url: '', wait: 2 });
    return;
  }

  res.json({
    code: 1,
    msg: `已删除你上传的 ${affected} 条书源`,
    data: '',
    url: `/yuedu/${cfg.key}/index.html`,
    wait: 1,
  });
});

app.get('/yuedu/:type/json/id/:id.json', async (req, res, next) => {
  const cfg = TYPE_CONFIG[req.params.type];
  if (!cfg) {
    next();
    return;
  }

  const id = toInt(req.params.id, 0);
  const platform = resolveCurrentPlatform(req);
  const entries = await query(
    'select * from entries where id = ? and type = ? and platform = ? and is_deleted = 0 limit 1',
    [id, cfg.key, platform]
  );
  const entry = entries[0];

  if (!entry) {
    res.status(404).json({ code: 0, msg: 'not found' });
    return;
  }

  const data = parseEntryJson(entry, cfg);
  await query('update entries set download_count = download_count + 1 where id = ? and type = ? and platform = ?', [
    id,
    cfg.key,
    platform,
  ]);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${Date.now()}.json`);
  res.send(JSON.stringify(data, null, 2));
});

app.get('/yuedu/:type/xbs/id/:id.xbs', async (req, res, next) => {
  const cfg = TYPE_CONFIG[req.params.type];
  if (!cfg) {
    next();
    return;
  }

  const id = toInt(req.params.id, 0);
  const platform = resolveCurrentPlatform(req);
  const entries = await query(
    'select * from entries where id = ? and type = ? and platform = ? and is_deleted = 0 limit 1',
    [id, cfg.key, platform]
  );
  const entry = entries[0];

  if (!entry) {
    res.status(404).json({ code: 0, msg: 'not found' });
    return;
  }

  const preservedXbsPath = resolvePreservedXbsPath(entry);
  if (preservedXbsPath) {
    await query('update entries set download_count = download_count + 1 where id = ? and type = ? and platform = ?', [
      id,
      cfg.key,
      platform,
    ]);
    const downloadName = buildSafeXbsDownloadName(entry.file_name, `${Date.now()}.xbs`);
    res.download(preservedXbsPath, downloadName, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ code: 0, msg: `xbs 下载失败: ${err.message}` });
      }
    });
    return;
  }

  let tempFiles = null;
  try {
    const data = parseEntryJson(entry, cfg);
    const xbsPayload = buildXbsExportPayload(data);
    tempFiles = await convertJsonDataToXbs(xbsPayload);
    ensureGeneratedXbsFile(tempFiles.xbsPath);
    await query('update entries set download_count = download_count + 1 where id = ? and type = ? and platform = ?', [
      id,
      cfg.key,
      platform,
    ]);

    res.download(tempFiles.xbsPath, `${Date.now()}.xbs`, (err) => {
      cleanupTempFiles(tempFiles);
      if (err && !res.headersSent) {
        res.status(500).json({ code: 0, msg: `xbs 下载失败: ${err.message}` });
      }
    });
  } catch (error) {
    cleanupTempFiles(tempFiles);
    res.status(500).json({ code: 0, msg: `xbs 生成失败: ${error.message}` });
  }
});

app.get('/yuedu/:type/jsons', async (req, res, next) => {
  const cfg = TYPE_CONFIG[req.params.type];
  if (!cfg) {
    next();
    return;
  }

  const platform = resolveCurrentPlatform(req);
  const ids = String(req.query.id || req.query.ids || '')
    .split(/[-,]/)
    .map((x) => toInt(x, 0))
    .filter((x) => x > 0);

  if (ids.length < 1) {
    res.status(400).json({ code: 0, msg: 'id required' });
    return;
  }

  const placeholders = ids.map(() => '?').join(',');
  const rows = await query(
    `select * from entries where type = ? and platform = ? and is_deleted = 0 and id in (${placeholders})`,
    [cfg.key, platform, ...ids]
  );

  const merged = [];
  for (const row of rows) {
    const parsed = parseEntryJson(row, cfg);
    if (Array.isArray(parsed)) {
      merged.push(...parsed);
    } else {
      merged.push(parsed);
    }
  }

  if (rows.length > 0) {
    const hitPlaceholders = rows.map(() => '?').join(',');
    await query(
      `update entries set download_count = download_count + 1 where type = ? and platform = ? and id in (${hitPlaceholders})`,
      [cfg.key, platform, ...rows.map((x) => x.id)]
    );
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${Date.now()}.json`);
  res.send(JSON.stringify(merged, null, 2));
});

app.get('/yuedu/:type/xbss', async (req, res, next) => {
  const cfg = TYPE_CONFIG[req.params.type];
  if (!cfg) {
    next();
    return;
  }

  const platform = resolveCurrentPlatform(req);
  const ids = String(req.query.id || req.query.ids || '')
    .split(/[-,]/)
    .map((x) => toInt(x, 0))
    .filter((x) => x > 0);

  if (ids.length < 1) {
    res.status(400).json({ code: 0, msg: 'id required' });
    return;
  }

  const placeholders = ids.map(() => '?').join(',');
  const rows = await query(
    `select * from entries where type = ? and platform = ? and is_deleted = 0 and id in (${placeholders})`,
    [cfg.key, platform, ...ids]
  );

  const merged = [];
  for (const row of rows) {
    const parsed = parseEntryJson(row, cfg);
    if (Array.isArray(parsed)) {
      merged.push(...parsed);
    } else {
      merged.push(parsed);
    }
  }

  if (rows.length > 0) {
    const hitPlaceholders = rows.map(() => '?').join(',');
    await query(
      `update entries set download_count = download_count + 1 where type = ? and platform = ? and id in (${hitPlaceholders})`,
      [cfg.key, platform, ...rows.map((x) => x.id)]
    );
  }

  let tempFiles = null;
  try {
    const xbsPayload = buildXbsExportPayload(merged);
    tempFiles = await convertJsonDataToXbs(xbsPayload);
    ensureGeneratedXbsFile(tempFiles.xbsPath);
    res.download(tempFiles.xbsPath, `${Date.now()}.xbs`, (err) => {
      cleanupTempFiles(tempFiles);
      if (err && !res.headersSent) {
        res.status(500).json({ code: 0, msg: `xbs 下载失败: ${err.message}` });
      }
    });
  } catch (error) {
    cleanupTempFiles(tempFiles);
    res.status(500).json({ code: 0, msg: `xbs 生成失败: ${error.message}` });
  }
});

app.get('/index/durl/add.html', async (req, res) => {
  const encoded = String(req.query.data || '').trim();
  if (!encoded) {
    res.type('text/plain').send('0');
    return;
  }

  let target = '';
  try {
    target = Buffer.from(encoded, 'base64').toString('utf8').trim();
  } catch (_err) {
    res.type('text/plain').send('0');
    return;
  }

  if (!/^https?:\/\//i.test(target)) {
    res.type('text/plain').send('0');
    return;
  }

  const hash = crypto
    .createHash('md5')
    .update(`${target}|${Date.now()}|${Math.random()}`)
    .digest('hex');

  await query('insert into short_links(hash, target_url, created_at, expires_at, hit_count) values(?, ?, ?, ?, 0)', [
    hash,
    target,
    Date.now(),
    Date.now() + 3 * 24 * 3600 * 1000,
  ]);

  const shortUrl = `${getRequestOrigin(req)}/d/${hash}`;
  res.type('text/plain').send(shortUrl);
});

app.get('/d/:hash', async (req, res) => {
  const hash = String(req.params.hash || '').trim();
  const rows = await query('select * from short_links where hash = ? limit 1', [hash]);
  const row = rows[0];

  if (!row || (row.expires_at && Number(row.expires_at) < Date.now())) {
    res.status(404).send('短链已失效');
    return;
  }

  await query('update short_links set hit_count = hit_count + 1 where hash = ?', [hash]);
  res.redirect(row.target_url);
});

app.use((error, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(error);
  if (res.headersSent) {
    next(error);
    return;
  }
  res.status(500).send('服务器内部错误');
});

app.use((_, res) => {
  res.status(404).send('404');
});

async function initMysql() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  await ensureMysql57Compatible(conn);
  await conn.query(
    `create database if not exists \`${DB_NAME}\` character set utf8mb4 collate utf8mb4_unicode_ci`
  );
  await conn.end();

  pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function initDb() {
  await query(`
    create table if not exists users (
      id bigint unsigned not null auto_increment,
      uid bigint not null,
      username varchar(191) not null,
      password varchar(191) not null,
      display_name varchar(191) not null,
      github_id varchar(64) null,
      github_login varchar(191) null,
      github_email varchar(191) null,
      avatar_url text null,
      profile_url text null,
      created_at bigint not null,
      primary key (id),
      unique key uk_users_uid (uid),
      unique key uk_users_username (username),
      unique key uk_users_github_id (github_id)
    ) engine=InnoDB default charset=utf8mb4
  `);

  await ensureUsersOauthColumns();

  await query(`
    create table if not exists entries (
      id bigint unsigned not null auto_increment,
      type varchar(16) not null,
      platform varchar(16) not null default 'ios',
      title varchar(512) not null,
      source_url text null,
      code_text longtext null,
      content_html longtext null,
      ver int null,
      has_faxian tinyint(1) not null default 0,
      has_sousuo tinyint(1) not null default 0,
      has_tu tinyint(1) not null default 0,
      has_shengyin tinyint(1) not null default 0,
      source_count int null,
      download_count bigint not null default 0,
      author_uid bigint not null,
      author_name varchar(191) not null,
      file_path text null,
      file_name varchar(512) null,
      is_deleted tinyint(1) not null default 0,
      created_at bigint not null,
      updated_at bigint not null,
      primary key (id),
      key idx_entries_platform_type_updated (platform, type, updated_at),
      key idx_entries_platform_type_download (platform, type, download_count)
    ) engine=InnoDB default charset=utf8mb4
  `);
  await ensureEntriesPlatformColumn();

  await query(`
    create table if not exists short_links (
      id bigint unsigned not null auto_increment,
      hash char(32) not null,
      target_url text not null,
      created_at bigint not null,
      expires_at bigint null,
      hit_count bigint not null default 0,
      primary key (id),
      unique key uk_short_links_hash (hash)
    ) engine=InnoDB default charset=utf8mb4
  `);
}

async function ensureUsersOauthColumns() {
  const cols = await query('show columns from users');
  const columnNames = new Set(cols.map((x) => String(x.Field || '').toLowerCase()));

  const alterSqlList = [];
  if (!columnNames.has('github_id')) {
    alterSqlList.push('add column github_id varchar(64) null after display_name');
  }
  if (!columnNames.has('github_login')) {
    alterSqlList.push('add column github_login varchar(191) null after github_id');
  }
  if (!columnNames.has('github_email')) {
    alterSqlList.push('add column github_email varchar(191) null after github_login');
  }
  if (!columnNames.has('avatar_url')) {
    alterSqlList.push('add column avatar_url text null after github_email');
  }
  if (!columnNames.has('profile_url')) {
    alterSqlList.push('add column profile_url text null after avatar_url');
  }

  for (const sql of alterSqlList) {
    await query(`alter table users ${sql}`);
  }

  const indexes = await query('show index from users');
  const indexNames = new Set(indexes.map((x) => String(x.Key_name || '')));
  if (!indexNames.has('uk_users_github_id')) {
    await query('alter table users add unique key uk_users_github_id (github_id)');
  }
}

async function ensureEntriesPlatformColumn() {
  const cols = await query('show columns from entries');
  const columnNames = new Set(cols.map((x) => String(x.Field || '').toLowerCase()));

  if (!columnNames.has('platform')) {
    await query("alter table entries add column platform varchar(16) not null default 'ios' after type");
  }

  await query("update entries set platform = 'ios' where platform is null or platform = ''");

  const indexes = await query('show index from entries');
  const indexNames = new Set(indexes.map((x) => String(x.Key_name || '')));
  if (!indexNames.has('idx_entries_platform_type_updated')) {
    await query('alter table entries add key idx_entries_platform_type_updated (platform, type, updated_at)');
  }
  if (!indexNames.has('idx_entries_platform_type_download')) {
    await query('alter table entries add key idx_entries_platform_type_download (platform, type, download_count)');
  }
}

async function seedData() {
  if (!ENABLE_SAMPLE_SEED) {
    return;
  }

  const countRows = await query('select count(*) as c from entries');
  const count = Number(countRows[0]?.c || 0);
  if (count > 0) {
    return;
  }

  const now = Date.now();
  const users = [
    { uid: 1000, name: '管理员' },
    { uid: 2226, name: 'jianghubailei' },
    { uid: 317, name: 'guaner001125' },
  ];

  for (let i = 0; i < 18; i += 1) {
    const u = users[i % users.length];
    const sample = {
      bookSourceName: `示例书源 ${i + 1}`,
      bookSourceUrl: `https://example${i + 1}.com`,
      bookSourceType: 0,
      enabledExplore: i % 2 === 0,
      searchUrl: '/search?q={{key}}&page={{page}}',
      ruleSearch: {
        bookList: '.book-item',
        name: '.title@text',
      },
    };

    await insertEntry({
      type: 'shuyuan',
      title: sample.bookSourceName,
      source_url: sample.bookSourceUrl,
      code_text: JSON.stringify(sample, null, 2),
      content_html: `<p>这是示例书源 ${i + 1} 的说明。</p>`,
      ver: 3,
      has_faxian: i % 2,
      has_sousuo: 1,
      has_tu: i % 3 === 0 ? 1 : 0,
      has_shengyin: i % 5 === 0 ? 1 : 0,
      source_count: 1,
      download_count: 200 + i * 17,
      author_uid: u.uid,
      author_name: u.name,
      file_path: null,
      file_name: null,
      created_at: now - i * 3600 * 1000,
      updated_at: now - i * 3600 * 1000,
    });
  }

  for (let i = 0; i < 8; i += 1) {
    const u = users[i % users.length];
    const arr = [];
    for (let j = 0; j < 10 + i; j += 1) {
      arr.push({
        bookSourceName: `合集书源 ${i + 1}-${j + 1}`,
        bookSourceUrl: `https://set-${i + 1}-${j + 1}.example.com`,
      });
    }

    const fileName = `sample-shuyuans-${i + 1}.json`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), 'utf8');
    }

    await insertEntry({
      type: 'shuyuans',
      title: `示例书源合集 ${i + 1}`,
      source_url: '',
      code_text: null,
      content_html: `<p>示例书源合集 ${i + 1}</p>`,
      ver: null,
      has_faxian: 0,
      has_sousuo: 0,
      has_tu: 0,
      has_shengyin: 0,
      source_count: arr.length,
      download_count: 800 + i * 15,
      author_uid: u.uid,
      author_name: u.name,
      file_path: path.relative(ROOT, filePath).replace(/\\/g, '/'),
      file_name: fileName,
      created_at: now - i * 10800 * 1000,
      updated_at: now - i * 10800 * 1000,
    });
  }

}

async function insertEntry(entry) {
  const platform = resolveSiteMode(entry.platform);
  await query(
    `insert into entries(
      type, platform, title, source_url, code_text, content_html,
      ver, has_faxian, has_sousuo, has_tu, has_shengyin,
      source_count, download_count, author_uid, author_name,
      file_path, file_name, is_deleted, created_at, updated_at
    ) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      entry.type,
      platform,
      entry.title,
      entry.source_url,
      entry.code_text,
      entry.content_html,
      entry.ver,
      entry.has_faxian,
      entry.has_sousuo,
      entry.has_tu,
      entry.has_shengyin,
      entry.source_count,
      entry.download_count,
      entry.author_uid,
      entry.author_name,
      entry.file_path,
      entry.file_name,
      entry.created_at,
      entry.updated_at,
    ]
  );
}

async function insertSingleEntry(row) {
  const platform = resolveSiteMode(row.platform);
  return query(
    `insert into entries(
      type, platform, title, source_url, code_text, content_html,
      ver, has_faxian, has_sousuo, has_tu, has_shengyin,
      source_count, download_count, author_uid, author_name,
      file_path, file_name, is_deleted, created_at, updated_at
    ) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 0, ?, ?)`,
    [
      row.type,
      platform,
      row.title,
      row.source_url,
      row.code_text,
      row.content_html,
      row.ver,
      row.has_faxian,
      row.has_sousuo,
      row.has_tu,
      row.has_shengyin,
      row.source_count,
      row.author_uid,
      row.author_name,
      row.file_path || null,
      row.file_name || null,
      row.created_at,
      row.updated_at,
    ]
  );
}

function buildSingleSourceEntryRow(cfg, body, user, sourceObj, fallbackTitle, fixedTimestamp, platform) {
  const source = isPlainObject(sourceObj) ? sourceObj : {};
  const now = fixedTimestamp || Date.now();

  const title = clipText(
    String(
      source.bookSourceName ||
        source.sourceName ||
        source.title ||
        source.name ||
        fallbackTitle ||
        `${cfg.label}-${now}`
    ),
    512
  );

  const sourceUrl = clipText(
    String(source.bookSourceUrl || source.sourceUrl || source.url || body.source_url || ''),
    2048
  );

  const ver = toInt(body.ver, 0) || toInt(source.ver, 0) || 3;
  const hasFaxian = isTruthyFlag(body.faxian) ? 1 : source.enabledExplore || source.exploreUrl ? 1 : 0;
  const hasSousuo =
    isTruthyFlag(body.sousuo) || source.ruleSearch || source.searchUrl || hasActionRequestInfo(source.searchBook)
      ? 1
      : 0;
  const sourceType = String(source.sourceType || '').toLowerCase();
  const hasTu = isTruthyFlag(body.tu) || sourceType === 'comic' ? 1 : 0;
  const hasShengyin = isTruthyFlag(body.shengyin) || sourceType === 'audio' ? 1 : 0;

  return {
    type: cfg.key,
    platform: resolveSiteMode(platform),
    title,
    source_url: sourceUrl,
    code_text: JSON.stringify(source, null, 2),
    content_html: clipText(String(body.content || '').trim(), 30000),
    ver,
    has_faxian: hasFaxian,
    has_sousuo: hasSousuo,
    has_tu: hasTu,
    has_shengyin: hasShengyin,
    source_count: 1,
    author_uid: user.uid,
    author_name: user.displayName,
    created_at: now,
    updated_at: now,
  };
}

function shouldPreserveUploadedXbs(file, convertedFromXbs, batchSize) {
  if (!file || !convertedFromXbs) return false;
  if (Number(batchSize) !== 1) return false;
  const ext = path.extname(String(file.originalname || file.path || '')).toLowerCase();
  return ext === '.xbs';
}

function isUploadedXbs(file, convertedFromXbs) {
  if (!file || !convertedFromXbs) return false;
  const ext = path.extname(String(file.originalname || file.path || '')).toLowerCase();
  return ext === '.xbs';
}

function buildListQuery(cfg, queryParams, options = {}) {
  const platform = resolveSiteMode(options.siteMode);
  const where = ['type = ?', 'platform = ?', 'is_deleted = 0'];
  const params = [cfg.key, platform];

  const keys = String(queryParams.keys || '').trim();
  if (keys) {
    const like = `%${keys}%`;
    where.push('(title like ? or source_url like ? or author_name like ?)');
    params.push(like, like, like);
  }

  const uid = toInt(queryParams.uid, 0);
  if (uid > 0) {
    where.push('author_uid = ?');
    params.push(uid);
  }

  if (cfg.kind === 'single') {
    if (cfg.key === 'shuyuan' && platform === 'ios') {
      where.push("title not like '示例书源 %'");
      where.push("source_url not like 'https://example%.com'");
    }

    if (queryParams.ver === '2' || queryParams.ver === '3') {
      where.push('ver = ?');
      params.push(Number(queryParams.ver));
    }

    const flagMap = {
      faxian: 'has_faxian',
      sousuo: 'has_sousuo',
      tu: 'has_tu',
      shengyin: 'has_shengyin',
    };

    for (const [queryKey, col] of Object.entries(flagMap)) {
      const val = String(queryParams[queryKey] || '');
      if (val === '0' || val === '1') {
        where.push(`${col} = ?`);
        params.push(Number(val));
      }
    }
  }

  const orderField = queryParams.order1 === 'down' ? 'download_count' : 'updated_at';
  const orderDir = queryParams.order2 === '2' ? 'asc' : 'desc';

  return {
    whereSql: where.join(' and '),
    params,
    orderSql: `order by ${orderField} ${orderDir}`,
  };
}

async function handleSingleAdd(req, res, cfg) {
  const platform = resolveCurrentPlatform(req);
  const rawCode = String(req.body.code || '').trim();
  let parsed;
  let convertedFromXbs = false;
  if (rawCode) {
    try {
      parsed = JSON.parse(rawCode);
    } catch (_error) {
      res.json({ code: 0, msg: '请输入正确的源代码!', data: '', url: '', wait: 2 });
      return;
    }
  } else if (req.file) {
    try {
      const parsedResult = await parseUploadedSourceFile(req.file.path, req.file.originalname);
      parsed = parsedResult.parsed;
      convertedFromXbs = parsedResult.convertedFromXbs;
    } catch (error) {
      cleanupUploadedFile(req.file);
      res.json({ code: 0, msg: `上传文件解析失败: ${error.message}`, data: '', url: '', wait: 2 });
      return;
    }
  } else {
    res.json({ code: 0, msg: '请输入源代码或上传 JSON/XBS 文件', data: '', url: '', wait: 2 });
    return;
  }

  const normalizedResult = normalizePayloadByType(cfg.key, parsed);
  if (!normalizedResult.ok) {
    cleanupUploadedFile(req.file);
    res.json({ code: 0, msg: normalizedResult.errorMessage, data: '', url: '', wait: 2 });
    return;
  }

  parsed = normalizedResult.payload;
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  const first = arr[0] || {};
  const splitPublish = isTruthyFlag(req.body.split_publish);
  const batchSize = arr.length;

  if (splitPublish && batchSize > 1) {
    if (batchSize > 500) {
      cleanupUploadedFile(req.file);
      res.json({
        code: 0,
        msg: `单次拆分发布最多 500 条，当前 ${batchSize} 条，请分批上传`,
        data: '',
        url: '',
        wait: 2,
      });
      return;
    }

    const now = Date.now();
    const createdIds = [];
    for (let index = 0; index < arr.length; index += 1) {
      const source = arr[index];
      const fallbackTitle = `${cfg.label}-${now}-${index + 1}`;
      const row = buildSingleSourceEntryRow(
        cfg,
        req.body,
        req.session.user,
        source,
        fallbackTitle,
        now,
        platform
      );
      const result = await insertSingleEntry(row);
      createdIds.push(result.insertId);
    }

    cleanupUploadedFile(req.file);

    const msgPrefix = convertedFromXbs
      ? `${normalizedResult.successMessage}（已自动将 XBS 转为 JSON）`
      : normalizedResult.successMessage;

    res.json({
      code: 1,
      msg: `${msgPrefix}，已拆分批量发布 ${createdIds.length} 条`,
      data: '',
      url: `/yuedu/${cfg.key}/index.html`,
      wait: 1,
    });
    return;
  }

  const title = clipText(
    String(
      req.body.title ||
        first.bookSourceName ||
        first.sourceName ||
        first.title ||
        `${cfg.label}-${Date.now()}`
    ),
    512
  );

  const row = buildSingleSourceEntryRow(
    cfg,
    req.body,
    req.session.user,
    first,
    title,
    undefined,
    platform
  );
  row.code_text = JSON.stringify(parsed, null, 2);
  row.source_count = arr.length;
  const preserveUploadedXbs = shouldPreserveUploadedXbs(req.file, convertedFromXbs, batchSize);
  if (preserveUploadedXbs) {
    row.file_path = path.relative(ROOT, req.file.path).replace(/\\/g, '/');
    row.file_name = clipText(String(req.file.originalname || path.basename(req.file.path)), 512);
  }
  const result = await insertSingleEntry(row);

  if (!preserveUploadedXbs) {
    cleanupUploadedFile(req.file);
  }

  res.json({
    code: 1,
    msg: convertedFromXbs
      ? `${normalizedResult.successMessage}（已自动将 XBS 转为 JSON）`
      : normalizedResult.successMessage,
    data: '',
    url: `/yuedu/${cfg.key}/content/id/${result.insertId}.html`,
    wait: 1,
  });
}

async function handleFileAdd(req, res, cfg) {
  if (!req.file) {
    res.json({ code: 0, msg: '请先选择要分享的文件！', data: '', url: '', wait: 2 });
    return;
  }
  const platform = resolveCurrentPlatform(req);

  const title = clipText(
    String(req.body.title || req.body.titles || path.parse(req.file.originalname).name || '').trim(),
    512
  );

  if (!title) {
    cleanupUploadedFile(req.file);
    res.json({ code: 0, msg: '请输入标题', data: '', url: '', wait: 2 });
    return;
  }

  let parsed;
  let convertedFromXbs = false;
  try {
    const parsedResult = await parseUploadedSourceFile(req.file.path, req.file.originalname);
    parsed = parsedResult.parsed;
    convertedFromXbs = parsedResult.convertedFromXbs;
  } catch (error) {
    cleanupUploadedFile(req.file);
    res.json({ code: 0, msg: `上传文件解析失败: ${error.message}`, data: '', url: '', wait: 2 });
    return;
  }

  const normalizedResult = normalizePayloadByType(cfg.key, parsed);
  if (!normalizedResult.ok) {
    cleanupUploadedFile(req.file);
    res.json({ code: 0, msg: normalizedResult.errorMessage, data: '', url: '', wait: 2 });
    return;
  }

  parsed = normalizedResult.payload;
  const uploadedIsXbs = isUploadedXbs(req.file, convertedFromXbs);
  const parsedJsonText = JSON.stringify(parsed, null, 2);
  if (!uploadedIsXbs) {
    fs.writeFileSync(req.file.path, parsedJsonText, 'utf8');
  }

  const sourceCount = Array.isArray(parsed) ? parsed.length : 1;
  const contentHtml = clipText(String(req.body.content || '').trim(), 30000);
  const now = Date.now();
  const relFilePath = path.relative(ROOT, req.file.path).replace(/\\/g, '/');
  const fileName = clipText(String(req.file.originalname || path.basename(req.file.path)), 512);
  const codeText = uploadedIsXbs ? parsedJsonText : null;

  const result = await query(
    `insert into entries(
      type, platform, title, source_url, code_text, content_html,
      ver, has_faxian, has_sousuo, has_tu, has_shengyin,
      source_count, download_count, author_uid, author_name,
      file_path, file_name, is_deleted, created_at, updated_at
    ) values(?, ?, ?, '', ?, ?, null, 0, 0, 0, 0, ?, 0, ?, ?, ?, ?, 0, ?, ?)`,
    [
      cfg.key,
      platform,
      title,
      codeText,
      contentHtml,
      sourceCount,
      req.session.user.uid,
      req.session.user.displayName,
      relFilePath,
      fileName,
      now,
      now,
    ]
  );

  res.json({
    code: 1,
    msg: convertedFromXbs
      ? `${normalizedResult.successMessage}（已自动将 XBS 转为 JSON）`
      : normalizedResult.successMessage,
    data: '',
    url: `/yuedu/${cfg.key}/content/id/${result.insertId}.html`,
    wait: 1,
  });
}

async function allocateNextUid() {
  const rows = await query('select uid from users order by uid desc limit 1');
  const base = Number(rows[0]?.uid || 1000);
  return base + 1;
}

async function allocateUniqueUsername(baseName) {
  const seed = normalizeUsernameSeed(baseName);
  let suffix = 0;

  while (suffix < 9999) {
    const candidate = suffix === 0 ? seed : clipText(`${seed}_${suffix}`, 191);
    const existed = await query('select id from users where username = ? limit 1', [candidate]);
    if (existed.length < 1) {
      return candidate;
    }
    suffix += 1;
  }

  return clipText(`github_${Date.now()}`, 191);
}

function normalizeUsernameSeed(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '');
  if (!cleaned) {
    return 'github_user';
  }
  return clipText(cleaned, 191);
}

async function convertXbsFileToJson(xbsPath) {
  const tempJsonPath = buildTempFilePath('xbs2json', '.json');
  try {
    await runXbsTool('xbs2json', xbsPath, tempJsonPath);
    const text = fs.readFileSync(tempJsonPath, 'utf8');
    return JSON.parse(text);
  } finally {
    cleanupTempFiles({ jsonPath: tempJsonPath });
  }
}

async function parseUploadedSourceFile(filePath, originalName) {
  const ext = path.extname(originalName || filePath).toLowerCase();
  if (ext === '.xbs') {
    const parsed = await convertXbsFileToJson(filePath);
    return { parsed, convertedFromXbs: true };
  }

  const text = fs.readFileSync(filePath, 'utf8');
  try {
    const parsed = JSON.parse(text);
    return { parsed, convertedFromXbs: false };
  } catch (_error) {
    throw new Error('文件不是有效 JSON');
  }
}

async function convertJsonDataToXbs(data) {
  const jsonPath = buildTempFilePath('json2xbs', '.json');
  const xbsPath = buildTempFilePath('json2xbs', '.xbs');
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');

  await runXbsTool('json2xbs', jsonPath, xbsPath);
  return { jsonPath, xbsPath };
}

function buildXbsExportPayload(data) {
  const list = extractSourceListFromPayload(data)
    .filter((item) => isPlainObject(item))
    .map((item) => normalizeSourceForXbs(item));

  if (list.length < 1) {
    throw new Error('无可导出的书源数据');
  }

  const out = {};
  list.forEach((item, idx) => {
    const baseName = clipText(
      firstNonEmptyString(item.sourceName, item.bookSourceName, item.title, item.name) || `source-${idx + 1}`,
      512
    );
    item.sourceName = baseName;
    const key = ensureUniqueMapKey(out, baseName);
    out[key] = item;
  });
  return out;
}

function normalizeSourceForXbs(source) {
  const out = JSON.parse(JSON.stringify(source));
  out.enable = normalizeXbsEnableValue(out.enable);
  return out;
}

function normalizeXbsEnableValue(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return 1;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  const text = String(value).trim().toLowerCase();
  if (text === 'true' || text === 'yes' || text === 'on') return 1;
  if (text === 'false' || text === 'no' || text === 'off') return 0;

  const num = Number(text);
  if (Number.isFinite(num)) return num > 0 ? 1 : 0;
  return 1;
}

function ensureUniqueMapKey(mapObj, preferredKey) {
  let key = String(preferredKey || '').trim() || 'source';
  if (!Object.prototype.hasOwnProperty.call(mapObj, key)) {
    return key;
  }
  let i = 2;
  while (Object.prototype.hasOwnProperty.call(mapObj, `${key}-${i}`)) {
    i += 1;
  }
  return `${key}-${i}`;
}

function ensureGeneratedXbsFile(xbsPath) {
  if (!xbsPath || !fs.existsSync(xbsPath)) {
    throw new Error('未生成 xbs 文件');
  }
  const stat = fs.statSync(xbsPath);
  if (!stat.isFile() || stat.size < 1) {
    throw new Error('生成的 xbs 文件为空');
  }
}

function buildTempFilePath(prefix, ext) {
  const safeExt = String(ext || '').startsWith('.') ? ext : `.${ext}`;
  return path.join(UPLOAD_DIR, `tmp-${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}${safeExt}`);
}

async function runXbsTool(action, inputPath, outputPath) {
  if (!fs.existsSync(XBS_TOOL_PATH)) {
    throw new Error(
      `找不到 xbs 转换脚本: ${XBS_TOOL_PATH}（请检查 XBS_TOOL_PATH，或确认 tools/scripts/xbs_tool.py 已存在）`
    );
  }

  const pythonCandidates = buildPythonCandidates();

  let firstRuntimeError = null;
  const triedBins = [];
  const notFoundBins = [];
  for (const bin of pythonCandidates) {
    triedBins.push(bin);
    try {
      await runProcess(bin, [XBS_TOOL_PATH, action, '-i', inputPath, '-o', outputPath], {
        env: buildXbsToolEnv(),
      });
      return;
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        notFoundBins.push(bin);
        continue;
      }
      firstRuntimeError = { bin, error };
      break;
    }
  }

  if (firstRuntimeError) {
    throw new Error(
      `xbs 转换执行失败（python=${firstRuntimeError.bin}）：${firstRuntimeError.error?.message || 'unknown error'}（已尝试Python: ${triedBins.join(', ')}；XBSREBUILD_ROOT=${XBSREBUILD_ROOT}）`
    );
  }

  throw new Error(
    `未找到可用的 Python 可执行文件（已尝试Python: ${triedBins.join(', ')}；未找到: ${notFoundBins.join(', ')}；请确认 Python/Go 环境可用，XBSREBUILD_ROOT=${XBSREBUILD_ROOT}）`
  );
}

function buildPythonCandidates() {
  const fallbackAbsoluteBins = [
    '/usr/bin/python3',
    '/usr/local/bin/python3',
    '/bin/python3',
    '/usr/bin/python',
    '/usr/local/bin/python',
    '/bin/python',
  ];

  return [PYTHON_BIN, 'python3', 'python', ...fallbackAbsoluteBins]
    .map((x) => String(x || '').trim())
    .filter((x, i, arr) => x && arr.indexOf(x) === i);
}

function buildXbsToolEnv() {
  const env = { ...process.env };
  if (String(XBSREBUILD_ROOT || '').trim()) {
    env.XBSREBUILD_ROOT = XBSREBUILD_ROOT;
  }
  return env;
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

function cleanupTempFiles(files) {
  if (!files || typeof files !== 'object') return;
  for (const filePath of Object.values(files)) {
    if (!filePath || !fs.existsSync(filePath)) continue;
    try {
      fs.unlinkSync(filePath);
    } catch (_error) {
      // ignore
    }
  }
}

function normalizePayloadByType(type, payload) {
  if (type === 'shuyuan' || type === 'shuyuans') {
    return normalizeXiangseShuyuanPayload(payload);
  }

  return {
    ok: true,
    payload,
    successMessage: '提交成功',
  };
}

function normalizeXiangseShuyuanPayload(payload) {
  const list = extractSourceListFromPayload(payload);
  if (list.length < 1) {
    return {
      ok: false,
      errorMessage: '书源校验失败: 至少包含 1 条书源数据',
    };
  }

  const normalizedList = [];
  const errors = [];
  const warnings = [];

  list.forEach((item, idx) => {
    const rowNo = idx + 1;
    if (!isPlainObject(item)) {
      errors.push(`第${rowNo}条不是对象`);
      return;
    }

    const normalized = { ...item };

    const sourceName = firstNonEmptyString(
      normalized.sourceName,
      normalized.bookSourceName,
      normalized.title,
      normalized.name
    );
    if (!sourceName) {
      errors.push(`第${rowNo}条缺少 sourceName`);
      return;
    }
    normalized.sourceName = sourceName;

    const sourceUrl = firstNonEmptyString(
      normalized.sourceUrl,
      normalized.bookSourceUrl,
      normalized.url,
      normalized.host
    );
    if (!sourceUrl) {
      errors.push(`第${rowNo}条缺少 sourceUrl`);
      return;
    }
    if (!/^https?:\/\//i.test(sourceUrl)) {
      errors.push(`第${rowNo}条 sourceUrl 必须是 http/https 地址`);
      return;
    }
    normalized.sourceUrl = sourceUrl;

    if (typeof normalized.enable !== 'boolean') {
      normalized.enable = true;
    }

    normalized.sourceType = normalizeSourceType(
      normalized.sourceType,
      normalized.bookSourceType,
      rowNo,
      warnings
    );

    normalized.weight = normalizeWeight(normalized.weight, rowNo, warnings);
    normalized.lastModifyTime = normalizeLastModifyTime(normalized.lastModifyTime, rowNo, warnings);

    for (const actionKey of XIANGSE_REQUIRED_ACTIONS) {
      const actionValue = normalized[actionKey];
      if (!isPlainObject(actionValue)) {
        errors.push(`第${rowNo}条缺少动作 ${actionKey}`);
        continue;
      }

      const action = { ...actionValue };
      action.actionID = actionKey;
      action.parserID = normalizeParserID(action.parserID);

      if (action.responseFormatType === undefined || action.responseFormatType === null) {
        action.responseFormatType = 'html';
      } else {
        action.responseFormatType = String(action.responseFormatType).trim();
      }

      if (!isValidRequestInfo(action.requestInfo)) {
        if (isActionRequestInfoRequired(actionKey)) {
          errors.push(`第${rowNo}条 ${actionKey}.requestInfo 不能为空`);
        } else {
          warnings.push(`第${rowNo}条 ${actionKey}.requestInfo 为空，按香色兼容规则允许`);
        }
      }

      if (action.parserID === 'DOM') {
        patchXiangseDomXPath(action, actionKey, rowNo, warnings);
      }

      normalized[actionKey] = action;
    }

    normalizedList.push(normalized);
  });

  if (errors.length > 0) {
    return {
      ok: false,
      errorMessage: `书源校验失败: ${errors.slice(0, 5).join('；')}`,
    };
  }

  return {
    ok: true,
    payload: normalizedList.length === 1 ? normalizedList[0] : normalizedList,
    successMessage: buildSuccessMessage(warnings),
  };
}

function extractSourceListFromPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isPlainObject(payload)) {
    return [payload];
  }

  const containerKeys = ['bookSources', 'sources', 'sourceList', 'items', 'list', 'data'];
  for (const key of containerKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  if (isLikelySourceObject(payload)) {
    return [payload];
  }

  const values = [];
  for (const [mapKey, mapValue] of Object.entries(payload)) {
    if (!isPlainObject(mapValue)) continue;
    const row = { ...mapValue };
    if (!firstNonEmptyString(row.sourceName, row.bookSourceName, row.title, row.name)) {
      row.sourceName = clipText(String(mapKey || '').trim(), 512);
    }
    values.push(row);
  }

  if (values.length > 0) {
    return values;
  }

  return [payload];
}

function isLikelySourceObject(value) {
  if (!isPlainObject(value)) return false;
  if (firstNonEmptyString(value.sourceName, value.bookSourceName, value.title, value.name)) return true;

  const sourceActionKeys = ['searchBook', 'bookDetail', 'chapterList', 'chapterContent'];
  return sourceActionKeys.some((key) => isPlainObject(value[key]));
}

function normalizeSourceType(sourceType, bookSourceType, rowNo, warnings) {
  let type = String(sourceType || '').trim().toLowerCase();
  if (!type) {
    type = Number(bookSourceType) === 1 ? 'comic' : 'text';
    warnings.push(`第${rowNo}条已补充 sourceType=${type}`);
  }

  if (type === 'novel') {
    type = 'text';
  }

  if (!XIANGSE_SOURCE_TYPES.has(type)) {
    warnings.push(`第${rowNo}条 sourceType=${type} 不受支持，已回退为 text`);
    return 'text';
  }

  return type;
}

function normalizeWeight(weight, rowNo, warnings) {
  let val = Number.parseInt(String(weight ?? ''), 10);
  if (Number.isNaN(val)) {
    warnings.push(`第${rowNo}条已补充默认 weight=100`);
    return 100;
  }

  if (val < 1) {
    warnings.push(`第${rowNo}条 weight<1，已调整为 1`);
    return 1;
  }

  if (val > 9999) {
    warnings.push(`第${rowNo}条 weight>9999，已调整为 9999`);
    return 9999;
  }

  return val;
}

function normalizeLastModifyTime(lastModifyTime, rowNo, warnings) {
  const nowSec = Math.floor(Date.now() / 1000);
  const raw = String(lastModifyTime ?? '').trim();
  if (!raw) {
    warnings.push(`第${rowNo}条已补充 lastModifyTime`);
    return String(nowSec);
  }

  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    warnings.push(`第${rowNo}条 lastModifyTime 无效，已自动修复`);
    return String(nowSec);
  }

  if (numeric > 9999999999) {
    return String(Math.floor(numeric / 1000));
  }

  return String(Math.floor(numeric));
}

function normalizeParserID(parserID) {
  const parser = String(parserID || 'DOM').trim().toUpperCase();
  if (parser === 'JS') return 'JS';
  return 'DOM';
}

function patchXiangseDomXPath(action, actionKey, rowNo, warnings) {
  for (const field of XIANGSE_XPATH_FIELDS) {
    if (typeof action[field] !== 'string') continue;
    if (action[field].includes('@js:')) continue;
    if (!action[field].includes('.//')) continue;
    const raw = action[field];
    const fixed = raw.replace(/(^|\|\|)\.\/\//g, '$1//');
    if (fixed !== raw) {
      action[field] = fixed;
      warnings.push(`第${rowNo}条 ${actionKey}.${field} 已将前缀 .// 修正为 //`);
    }
  }
}

function buildSuccessMessage(warnings) {
  if (!warnings || warnings.length < 1) {
    return '提交成功';
  }
  return `提交成功，已自动优化 ${warnings.length} 处香色兼容字段`;
}

function isValidRequestInfo(requestInfo) {
  if (typeof requestInfo === 'string') {
    return requestInfo.trim().length > 0;
  }
  if (isPlainObject(requestInfo)) {
    return Object.keys(requestInfo).length > 0;
  }
  return false;
}

function isActionRequestInfoRequired(actionKey) {
  return XIANGSE_REQUESTINFO_REQUIRED_ACTIONS.has(actionKey);
}

function hasActionRequestInfo(action) {
  return isPlainObject(action) && isValidRequestInfo(action.requestInfo);
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function resolveLoginErrorMessage(code) {
  const key = String(code || '').trim();
  const map = {
    github_only: '本站仅支持 GitHub 授权登录',
    register_disabled: '已关闭站内注册，请使用 GitHub 登录',
    github_not_configured: '管理员尚未配置 GitHub OAuth，请联系站点维护者',
    github_oauth_denied: '你已取消 GitHub 授权',
    github_state_invalid: 'GitHub 登录状态校验失败，请重试',
    github_no_code: 'GitHub 回调缺少授权参数，请重试',
    github_exchange_failed: 'GitHub 登录失败，请稍后重试',
  };
  return map[key] || '';
}

function getRequestOrigin(req) {
  const xfProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const xfHost = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim();
  const proto = xfProto || req.protocol || 'http';
  const host = xfHost || req.get('host') || 'localhost';
  return `${proto}://${host}`;
}

function buildGithubOauthCallbackUrl(req) {
  const configured = String(GITHUB_OAUTH_CALLBACK_URL || '').trim();
  if (configured) {
    if (/^https?:\/\//i.test(configured)) {
      return configured;
    }
    if (configured.startsWith('/')) {
      return `${getRequestOrigin(req)}${configured}`;
    }
  }
  return `${getRequestOrigin(req)}/index/login/github/callback`;
}

async function exchangeGithubAccessToken(req, code, state) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'cloudBookSource',
    },
    body: JSON.stringify({
      client_id: GITHUB_OAUTH_CLIENT_ID,
      client_secret: GITHUB_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: buildGithubOauthCallbackUrl(req),
      state,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`GitHub token response ${response.status}: ${JSON.stringify(data)}`);
  }

  const token = String(data.access_token || '').trim();
  if (!token || data.error) {
    throw new Error(`GitHub token exchange failed: ${data.error_description || data.error || 'empty_token'}`);
  }

  return token;
}

async function fetchGithubUserProfile(accessToken) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'cloudBookSource',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`GitHub user profile failed: ${response.status}`);
  }

  if (!data || !data.id || !data.login) {
    throw new Error('GitHub user profile incomplete');
  }

  return data;
}

async function fetchGithubUserPrimaryEmail(accessToken) {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'cloudBookSource',
    },
  });

  if (!response.ok) {
    return '';
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    return '';
  }

  const preferred =
    data.find((item) => item && item.primary && item.verified && item.email) ||
    data.find((item) => item && item.verified && item.email) ||
    data.find((item) => item && item.email);

  return clipText(String(preferred?.email || ''), 191);
}

async function createOrUpdateGithubUser(githubUser, githubEmail) {
  const githubId = clipText(String(githubUser.id || ''), 64);
  if (!githubId) {
    throw new Error('GitHub user id missing');
  }

  const githubLogin = clipText(String(githubUser.login || ''), 191);
  const displayName = clipText(String(githubUser.name || githubLogin || `GitHub-${githubId}`), 191);
  const avatarUrl = clipText(String(githubUser.avatar_url || ''), 2048);
  const profileUrl = clipText(String(githubUser.html_url || ''), 2048);
  const now = Date.now();

  const existed = await query(
    'select id, uid, username, display_name, avatar_url from users where github_id = ? limit 1',
    [githubId]
  );

  if (existed.length > 0) {
    const user = existed[0];
    await query(
      'update users set display_name = ?, github_login = ?, github_email = ?, avatar_url = ?, profile_url = ? where id = ?',
      [displayName, githubLogin, githubEmail, avatarUrl, profileUrl, user.id]
    );
    return {
      ...user,
      display_name: displayName,
      avatar_url: avatarUrl,
    };
  }

  const uid = await allocateNextUid();
  const username = await allocateUniqueUsername(githubLogin || `github_${githubId}`);
  const password = `oauth:${crypto.randomBytes(20).toString('hex')}`;

  const result = await query(
    'insert into users(uid, username, password, display_name, github_id, github_login, github_email, avatar_url, profile_url, created_at) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [uid, username, password, displayName, githubId, githubLogin, githubEmail, avatarUrl, profileUrl, now]
  );

  return {
    id: result.insertId,
    uid,
    username,
    display_name: displayName,
    avatar_url: avatarUrl,
  };
}

function normalizeSiteMode(value) {
  const mode = String(value || '')
    .trim()
    .toLowerCase();
  if (mode === 'ios' || mode === 'android') {
    return mode;
  }
  return '';
}

function resolveSiteMode(value) {
  const mode = normalizeSiteMode(value);
  if (mode) return mode;
  const fallback = normalizeSiteMode(SITE_MODE_DEFAULT);
  return fallback || 'ios';
}

function resolveCurrentPlatform(req) {
  return resolveSiteMode(req?.session?.siteMode);
}

function normalizeRedirectPath(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('/')) {
    return '/yuedu/index/index.html';
  }

  if (raw.startsWith('//') || raw.startsWith('/\\')) {
    return '/yuedu/index/index.html';
  }

  return raw;
}

async function ensureMysql57Compatible(conn) {
  const [rows] = await conn.query('select version() as version');
  const rawVersion = String(rows[0]?.version || '');
  const match = rawVersion.match(/(\d+)\.(\d+)/);

  if (!match) {
    return;
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const isCompatible =
    major > MYSQL_MIN_MAJOR || (major === MYSQL_MIN_MAJOR && minor >= MYSQL_MIN_MINOR);

  if (!isCompatible) {
    throw new Error(
      `当前数据库版本 ${rawVersion} 不兼容，要求 MySQL ${MYSQL_MIN_MAJOR}.${MYSQL_MIN_MINOR}+`
    );
  }
}

function requireLoginJson(req, res, next) {
  if (!req.session.user) {
    res.json({ code: 0, msg: '请先登录', data: '', url: '', wait: 3 });
    return;
  }
  next();
}

function parseEntryJson(entry, cfg) {
  const raw = readEntryRawJson(entry);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    throw new Error('JSON 数据损坏');
  }

  if (cfg.kind === 'single') {
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  return parsed;
}

function readEntryRawJson(entry) {
  if (entry.code_text) {
    return entry.code_text;
  }

  if (entry.file_path) {
    const fullPath = path.join(ROOT, entry.file_path);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf8');
    }
  }

  return '[]';
}

function resolvePreservedXbsPath(entry) {
  const rel = String(entry?.file_path || '').trim();
  if (!rel) return null;
  if (path.extname(rel).toLowerCase() !== '.xbs') return null;

  const fullPath = path.join(ROOT, rel);
  if (!fs.existsSync(fullPath)) return null;

  const stat = fs.statSync(fullPath);
  if (!stat.isFile() || stat.size < 1) return null;
  return fullPath;
}

function buildSafeXbsDownloadName(rawName, fallbackName) {
  const fallback = String(fallbackName || `${Date.now()}.xbs`).trim() || `${Date.now()}.xbs`;
  const raw = clipText(String(rawName || '').trim(), 255);
  if (!raw) return fallback;
  if (!raw.toLowerCase().endsWith('.xbs')) return `${raw}.xbs`;
  return raw;
}

function buildPageItems(current, total) {
  const items = [];
  let last = 0;

  for (let i = 1; i <= total; i += 1) {
    const shouldShow = i === 1 || i === total || Math.abs(i - current) <= 2;
    if (!shouldShow) continue;

    if (last && i - last > 1) {
      items.push(null);
    }

    items.push(i);
    last = i;
  }

  return items;
}

function buildListUrl(type, queryParams, page) {
  const params = new URLSearchParams();

  for (const [k, v] of Object.entries(queryParams || {})) {
    if (k === 'page') continue;
    if (v === undefined || v === null || String(v).trim() === '') continue;
    params.set(k, String(v));
  }

  if (page > 1) {
    params.set('page', String(page));
  }

  const qs = params.toString();
  return `/yuedu/${type}/index.html${qs ? `?${qs}` : ''}`;
}

function formatRelativeTime(ts) {
  const diff = Date.now() - Number(ts || 0);

  if (diff < 60 * 1000) return '刚刚';
  if (diff < 3600 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`;
  if (diff < 24 * 3600 * 1000) return `${Math.floor(diff / (3600 * 1000))}小时前`;
  if (diff < 30 * 24 * 3600 * 1000) return `${Math.floor(diff / (24 * 3600 * 1000))}天前`;

  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');

  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function clipText(text, max) {
  return String(text || '').slice(0, max);
}

function prettyJson(raw) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch (_error) {
    return raw;
  }
}

function cleanupUploadedFile(file) {
  if (!file || !file.path) return;

  try {
    fs.unlinkSync(file.path);
  } catch (_error) {
    // ignore
  }
}

function toInt(value, fallback) {
  const n = Number.parseInt(String(value || ''), 10);
  if (Number.isNaN(n)) return fallback;
  return n;
}

function isTruthyFlag(value) {
  const text = String(value || '')
    .trim()
    .toLowerCase();
  return text === '1' || text === 'true' || text === 'on' || text === 'yes';
}

function parseIdList(value) {
  const arr = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[-,\s]+/)
        .filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    const id = toInt(item, 0);
    if (id < 1) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function canManageEntry(user, authorUid) {
  const uid = Number(user?.uid || 0);
  if (!(uid > 0)) return false;
  if (uid === ADMIN_UID) return true;
  return uid === Number(authorUid || 0);
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

async function startServer() {
  await initMysql();
  await initDb();
  await seedData();

  if (ONLY_SEED) {
    // eslint-disable-next-line no-console
    console.log('Seed completed.');
    await pool.end();
    return;
  }

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', error);
  if (pool) {
    try {
      await pool.end();
    } catch (_error) {
      // ignore
    }
  }
  process.exit(1);
});
