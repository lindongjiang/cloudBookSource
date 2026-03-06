require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const multer = require('multer');

const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PORT = Number(process.env.PORT || 3000);

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'cloud_book_source';

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
  rss: {
    key: 'rss',
    label: '订阅源',
    kind: 'single',
    importPrefix: 'legado://import/auto?src=',
  },
  rsss: {
    key: 'rsss',
    label: '订阅源合集',
    kind: 'file',
    importPrefix: 'legado://import/rssSource?src=',
  },
};

const app = express();

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
  res.locals.currentUser = req.session.user || null;
  res.locals.requestUrl = req.originalUrl;
  res.locals.typeConfigMap = TYPE_CONFIG;
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
    if (ext === '.json' || file.mimetype.includes('json')) {
      cb(null, true);
      return;
    }
    cb(new Error('仅支持 JSON 文件'));
  },
});

app.get('/', (_, res) => {
  res.redirect('/yuedu/index/index.html');
});

app.get('/article', (_, res) => {
  res.send('<h2 style="font-family:sans-serif;padding:24px;">文章列表功能可按需扩展</h2>');
});

app.get('/yuedu/index/index.html', (req, res) => {
  res.render('pages/yuedu-index', {
    pageTitle: '阅读 - 源仓库',
    currentType: 'index',
  });
});

app.get('/yuedu/tools/index.html', (req, res) => {
  res.render('pages/tools-index', {
    pageTitle: '阅读 - 其他',
    currentType: 'tools',
  });
});

app.get('/yuedu/tools/index/id/:slug.html', (req, res) => {
  const titleMap = {
    shuyuan: '教程:书源规则',
    rss: '教程:RSS规则',
    uplink: '源仓库直链上传',
  };
  const title = titleMap[req.params.slug] || '工具文档';
  res.render('pages/tool-detail', {
    pageTitle: `${title} - 源仓库`,
    currentType: 'tools',
    title,
    slug: req.params.slug,
  });
});

app.get('/index/login/login.html', (req, res) => {
  if (req.session.user) {
    res.redirect(req.query.redirect || '/yuedu/shuyuan/index.html');
    return;
  }
  res.render('pages/login', {
    pageTitle: '登录 - 源仓库',
    currentType: 'none',
    error: '',
    redirect: req.query.redirect || '/yuedu/shuyuan/index.html',
  });
});

app.post('/index/login/login.html', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '').trim();
  const redirectTo = String(req.body.redirect || '/yuedu/shuyuan/index.html');

  const users = await query(
    'select id, uid, username, display_name from users where username = ? and password = ? limit 1',
    [username, password]
  );

  const user = users[0];

  if (!user) {
    res.status(401).render('pages/login', {
      pageTitle: '登录 - 源仓库',
      currentType: 'none',
      error: '用户名或密码错误',
      redirect: redirectTo,
    });
    return;
  }

  req.session.user = {
    id: user.id,
    uid: user.uid,
    username: user.username,
    displayName: user.display_name,
  };

  res.redirect(redirectTo);
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

  const { whereSql, params, orderSql } = buildListQuery(cfg, req.query);
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
    pageTitle: `阅读 - ${cfg.label}`,
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
  const entries = await query('select * from entries where id = ? and type = ? and is_deleted = 0 limit 1', [
    id,
    cfg.key,
  ]);
  const entry = entries[0];

  if (!entry) {
    res.status(404).send('未找到内容');
    return;
  }

  const jsonUrl = `${req.protocol}://${req.get('host')}/yuedu/${cfg.key}/json/id/${entry.id}.json`;
  const importUrl = `${cfg.importPrefix}${jsonUrl}`;

  res.render('pages/detail', {
    pageTitle: `${entry.title} - ${cfg.label}`,
    currentType: cfg.key,
    cfg,
    entry,
    jsonUrl,
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
    pageTitle: `阅读 - 新建${cfg.label}`,
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
  const rows = await query('select id from entries where id = ? and type = ? and is_deleted = 0 limit 1', [
    id,
    cfg.key,
  ]);

  if (rows.length < 1) {
    res.json({ code: 0, msg: '数据不存在', data: '', url: '', wait: 2 });
    return;
  }

  await query('update entries set is_deleted = 1, updated_at = ? where id = ?', [Date.now(), id]);
  res.json({ code: 1, msg: '删除成功', data: '', url: `/yuedu/${cfg.key}/index.html`, wait: 1 });
});

app.get('/yuedu/:type/json/id/:id.json', async (req, res, next) => {
  const cfg = TYPE_CONFIG[req.params.type];
  if (!cfg) {
    next();
    return;
  }

  const id = toInt(req.params.id, 0);
  const entries = await query('select * from entries where id = ? and type = ? and is_deleted = 0 limit 1', [
    id,
    cfg.key,
  ]);
  const entry = entries[0];

  if (!entry) {
    res.status(404).json({ code: 0, msg: 'not found' });
    return;
  }

  const data = parseEntryJson(entry, cfg);
  await query('update entries set download_count = download_count + 1 where id = ?', [id]);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${Date.now()}.json`);
  res.send(JSON.stringify(data, null, 2));
});

app.get('/yuedu/:type/jsons', async (req, res, next) => {
  const cfg = TYPE_CONFIG[req.params.type];
  if (!cfg) {
    next();
    return;
  }

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
    `select * from entries where type = ? and is_deleted = 0 and id in (${placeholders})`,
    [cfg.key, ...ids]
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
    await query(`update entries set download_count = download_count + 1 where id in (${hitPlaceholders})`, rows.map((x) => x.id));
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${Date.now()}.json`);
  res.send(JSON.stringify(merged, null, 2));
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

  const shortUrl = `${req.protocol}://${req.get('host')}/d/${hash}`;
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
      created_at bigint not null,
      primary key (id),
      unique key uk_users_uid (uid),
      unique key uk_users_username (username)
    ) engine=InnoDB default charset=utf8mb4
  `);

  await query(`
    create table if not exists entries (
      id bigint unsigned not null auto_increment,
      type varchar(16) not null,
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
      key idx_entries_type_updated (type, updated_at),
      key idx_entries_type_download (type, download_count)
    ) engine=InnoDB default charset=utf8mb4
  `);

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

async function seedData() {
  const userCountRows = await query('select count(*) as c from users');
  const userCount = Number(userCountRows[0]?.c || 0);

  if (userCount < 1) {
    await query('insert into users(uid, username, password, display_name, created_at) values(?, ?, ?, ?, ?)', [
      1000,
      'admin',
      'admin123',
      '管理员',
      Date.now(),
    ]);
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

  for (let i = 0; i < 12; i += 1) {
    const u = users[i % users.length];
    const sample = {
      title: `示例订阅源 ${i + 1}`,
      url: `https://feed${i + 1}.example.com`,
      articleStyle: 0,
      sourceUrl: `https://feed${i + 1}.example.com/rss`,
      customOrder: i,
    };

    await insertEntry({
      type: 'rss',
      title: `${sample.title} ${sample.url}`,
      source_url: sample.url,
      code_text: JSON.stringify(sample, null, 2),
      content_html: `<p>这是示例订阅源 ${i + 1} 的说明。</p>`,
      ver: 3,
      has_faxian: 1,
      has_sousuo: 1,
      has_tu: i % 2,
      has_shengyin: 0,
      source_count: 1,
      download_count: 500 + i * 9,
      author_uid: u.uid,
      author_name: u.name,
      file_path: null,
      file_name: null,
      created_at: now - i * 7200 * 1000,
      updated_at: now - i * 7200 * 1000,
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

  for (let i = 0; i < 6; i += 1) {
    const u = users[i % users.length];
    const arr = [];
    for (let j = 0; j < 20 + i * 2; j += 1) {
      arr.push({
        title: `订阅源条目 ${i + 1}-${j + 1}`,
        url: `https://rss-set-${i + 1}-${j + 1}.example.com`,
      });
    }

    const fileName = `sample-rsss-${i + 1}.json`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), 'utf8');
    }

    await insertEntry({
      type: 'rsss',
      title: `示例订阅源合集 ${i + 1}`,
      source_url: '',
      code_text: null,
      content_html: `<p>示例订阅源合集 ${i + 1}</p>`,
      ver: null,
      has_faxian: 0,
      has_sousuo: 0,
      has_tu: 0,
      has_shengyin: 0,
      source_count: arr.length,
      download_count: 1200 + i * 21,
      author_uid: u.uid,
      author_name: u.name,
      file_path: path.relative(ROOT, filePath).replace(/\\/g, '/'),
      file_name: fileName,
      created_at: now - i * 14400 * 1000,
      updated_at: now - i * 14400 * 1000,
    });
  }
}

async function insertEntry(entry) {
  await query(
    `insert into entries(
      type, title, source_url, code_text, content_html,
      ver, has_faxian, has_sousuo, has_tu, has_shengyin,
      source_count, download_count, author_uid, author_name,
      file_path, file_name, is_deleted, created_at, updated_at
    ) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      entry.type,
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

function buildListQuery(cfg, queryParams) {
  const where = ['type = ?', 'is_deleted = 0'];
  const params = [cfg.key];

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
  const rawCode = String(req.body.code || '').trim();
  if (!rawCode) {
    res.json({ code: 0, msg: '请输入源代码', data: '', url: '', wait: 2 });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(rawCode);
  } catch (_error) {
    res.json({ code: 0, msg: '请输入正确的源代码!', data: '', url: '', wait: 2 });
    return;
  }

  const arr = Array.isArray(parsed) ? parsed : [parsed];
  const first = arr[0] || {};

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

  const sourceUrl = clipText(
    String(first.bookSourceUrl || first.sourceUrl || first.url || req.body.source_url || ''),
    2048
  );

  const contentHtml = clipText(String(req.body.content || '').trim(), 30000);
  const ver = toInt(req.body.ver, 0) || 3;

  const hasFaxian = req.body.faxian ? 1 : first.enabledExplore || first.exploreUrl ? 1 : 0;
  const hasSousuo = req.body.sousuo ? 1 : first.ruleSearch || first.searchUrl ? 1 : 0;
  const hasTu = req.body.tu ? 1 : 0;
  const hasShengyin = req.body.shengyin ? 1 : 0;

  const now = Date.now();

  const result = await query(
    `insert into entries(
      type, title, source_url, code_text, content_html,
      ver, has_faxian, has_sousuo, has_tu, has_shengyin,
      source_count, download_count, author_uid, author_name,
      file_path, file_name, is_deleted, created_at, updated_at
    ) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, null, null, 0, ?, ?)`,
    [
      cfg.key,
      title,
      sourceUrl,
      JSON.stringify(parsed, null, 2),
      contentHtml,
      ver,
      hasFaxian,
      hasSousuo,
      hasTu,
      hasShengyin,
      arr.length,
      req.session.user.uid,
      req.session.user.displayName,
      now,
      now,
    ]
  );

  res.json({
    code: 1,
    msg: '提交成功',
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

  const title = clipText(
    String(req.body.title || req.body.titles || path.parse(req.file.originalname).name || '').trim(),
    512
  );

  if (!title) {
    cleanupUploadedFile(req.file);
    res.json({ code: 0, msg: '请输入标题', data: '', url: '', wait: 2 });
    return;
  }

  const text = fs.readFileSync(req.file.path, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_error) {
    cleanupUploadedFile(req.file);
    res.json({ code: 0, msg: '文件不是有效 JSON', data: '', url: '', wait: 2 });
    return;
  }

  const sourceCount = Array.isArray(parsed) ? parsed.length : 1;
  const contentHtml = clipText(String(req.body.content || '').trim(), 30000);
  const now = Date.now();

  const result = await query(
    `insert into entries(
      type, title, source_url, code_text, content_html,
      ver, has_faxian, has_sousuo, has_tu, has_shengyin,
      source_count, download_count, author_uid, author_name,
      file_path, file_name, is_deleted, created_at, updated_at
    ) values(?, ?, '', null, ?, null, 0, 0, 0, 0, ?, 0, ?, ?, ?, ?, 0, ?, ?)`,
    [
      cfg.key,
      title,
      contentHtml,
      sourceCount,
      req.session.user.uid,
      req.session.user.displayName,
      path.relative(ROOT, req.file.path).replace(/\\/g, '/'),
      req.file.originalname,
      now,
      now,
    ]
  );

  res.json({
    code: 1,
    msg: '提交成功',
    data: '',
    url: `/yuedu/${cfg.key}/content/id/${result.insertId}.html`,
    wait: 1,
  });
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
