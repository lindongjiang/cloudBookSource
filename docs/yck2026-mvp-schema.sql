-- PostgreSQL MVP schema for yck-like site

create table users (
  id bigserial primary key,
  username varchar(64) not null unique,
  display_name varchar(128) not null,
  oauth_provider varchar(32),
  oauth_id varchar(128),
  created_at timestamptz not null default now()
);

create table entries (
  id bigserial primary key,
  type varchar(16) not null check (type in ('shuyuan','shuyuans','rss','rsss')),
  title varchar(512) not null,
  source_url text,
  code_json jsonb,
  content_html text,
  ver smallint,
  has_faxian boolean,
  has_sousuo boolean,
  has_tu boolean,
  has_shengyin boolean,
  source_count integer,
  download_count bigint not null default 0,
  author_id bigint not null references users(id),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_entries_type_created_at on entries(type, created_at desc);
create index idx_entries_type_download_count on entries(type, download_count desc);
create index idx_entries_author_id on entries(author_id);

create table entry_files (
  id bigserial primary key,
  entry_id bigint not null references entries(id) on delete cascade,
  file_name varchar(256) not null,
  file_size bigint not null,
  mime_type varchar(128) not null,
  storage_key text not null,
  sha256 char(64),
  created_at timestamptz not null default now()
);

create unique index idx_entry_files_entry_id on entry_files(entry_id);

create table short_links (
  id bigserial primary key,
  hash char(32) not null unique,
  target_url text not null,
  expires_at timestamptz,
  created_by bigint references users(id),
  hit_count bigint not null default 0,
  created_at timestamptz not null default now()
);

create index idx_short_links_expires_at on short_links(expires_at);

create table download_logs (
  id bigserial primary key,
  entry_id bigint references entries(id),
  type varchar(16) not null,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_download_logs_entry_id on download_logs(entry_id, created_at desc);
