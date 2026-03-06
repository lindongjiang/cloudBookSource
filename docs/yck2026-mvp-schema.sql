-- MySQL 5.7+ MVP schema for yck-like site

CREATE DATABASE IF NOT EXISTS `cloud_book_source`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE `cloud_book_source`;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uid BIGINT NOT NULL,
  username VARCHAR(191) NOT NULL,
  password VARCHAR(191) NOT NULL,
  display_name VARCHAR(191) NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_uid (uid),
  UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type VARCHAR(16) NOT NULL,
  title VARCHAR(512) NOT NULL,
  source_url TEXT NULL,
  code_text LONGTEXT NULL,
  content_html LONGTEXT NULL,
  ver INT NULL,
  has_faxian TINYINT(1) NOT NULL DEFAULT 0,
  has_sousuo TINYINT(1) NOT NULL DEFAULT 0,
  has_tu TINYINT(1) NOT NULL DEFAULT 0,
  has_shengyin TINYINT(1) NOT NULL DEFAULT 0,
  source_count INT NULL,
  download_count BIGINT NOT NULL DEFAULT 0,
  author_uid BIGINT NOT NULL,
  author_name VARCHAR(191) NOT NULL,
  file_path TEXT NULL,
  file_name VARCHAR(512) NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_entries_type_updated (type, updated_at),
  KEY idx_entries_type_download (type, download_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS short_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  hash CHAR(32) NOT NULL,
  target_url TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NULL,
  hit_count BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_short_links_hash (hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
