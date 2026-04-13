-- ============================================================
-- WordPress CF Storage - D1 Schema
-- Run: wrangler d1 execute wp_cf_db --file=schema.sql
-- ============================================================

-- Posts (replaces wp_posts)
CREATE TABLE IF NOT EXISTS posts (
  ID            INTEGER PRIMARY KEY AUTOINCREMENT,
  post_author   INTEGER NOT NULL DEFAULT 1,
  post_date     TEXT    NOT NULL DEFAULT (datetime('now')),
  post_content  TEXT    NOT NULL DEFAULT '',
  post_title    TEXT    NOT NULL DEFAULT '',
  post_excerpt  TEXT    NOT NULL DEFAULT '',
  post_status   TEXT    NOT NULL DEFAULT 'publish',
  post_name     TEXT    NOT NULL DEFAULT '',
  post_type     TEXT    NOT NULL DEFAULT 'post',
  post_parent   INTEGER NOT NULL DEFAULT 0,
  menu_order    INTEGER NOT NULL DEFAULT 0,
  guid          TEXT    NOT NULL DEFAULT '',
  modified      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_type_status ON posts(post_type, post_status);
CREATE INDEX IF NOT EXISTS idx_posts_name        ON posts(post_name);
CREATE INDEX IF NOT EXISTS idx_posts_author      ON posts(post_author);

-- Post Meta (replaces wp_postmeta)
CREATE TABLE IF NOT EXISTS postmeta (
  meta_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL,
  meta_key   TEXT    NOT NULL,
  meta_value TEXT
);
CREATE INDEX IF NOT EXISTS idx_postmeta_post    ON postmeta(post_id);
CREATE INDEX IF NOT EXISTS idx_postmeta_key     ON postmeta(meta_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_postmeta_unique ON postmeta(post_id, meta_key);

-- Options (replaces wp_options — non-autoloaded only)
CREATE TABLE IF NOT EXISTS options (
  option_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  option_name  TEXT    NOT NULL UNIQUE,
  option_value TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_options_name ON options(option_name);

-- Media (attachment metadata)
CREATE TABLE IF NOT EXISTS media (
  ID          INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id     INTEGER NOT NULL DEFAULT 0,
  file_url    TEXT    NOT NULL,
  mime_type   TEXT    NOT NULL DEFAULT '',
  file_size   INTEGER NOT NULL DEFAULT 0,
  width       INTEGER,
  height      INTEGER,
  alt_text    TEXT    NOT NULL DEFAULT '',
  caption     TEXT    NOT NULL DEFAULT '',
  description TEXT    NOT NULL DEFAULT '',
  uploaded_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_media_post ON media(post_id);

-- Terms (replaces wp_terms + wp_term_taxonomy + wp_term_relationships)
CREATE TABLE IF NOT EXISTS terms (
  term_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  slug        TEXT    NOT NULL,
  taxonomy    TEXT    NOT NULL DEFAULT 'category',
  description TEXT    NOT NULL DEFAULT '',
  parent      INTEGER NOT NULL DEFAULT 0,
  count       INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_terms_slug_tax ON terms(slug, taxonomy);

CREATE TABLE IF NOT EXISTS term_relationships (
  object_id        INTEGER NOT NULL,
  term_id          INTEGER NOT NULL,
  PRIMARY KEY (object_id, term_id)
);

-- Comments (replaces wp_comments)
CREATE TABLE IF NOT EXISTS comments (
  comment_ID          INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_post_ID     INTEGER NOT NULL DEFAULT 0,
  comment_author      TEXT    NOT NULL DEFAULT '',
  comment_author_email TEXT   NOT NULL DEFAULT '',
  comment_author_url  TEXT    NOT NULL DEFAULT '',
  comment_content     TEXT    NOT NULL DEFAULT '',
  comment_approved    TEXT    NOT NULL DEFAULT '1',
  comment_date        TEXT    NOT NULL DEFAULT (datetime('now')),
  comment_parent      INTEGER NOT NULL DEFAULT 0,
  user_id             INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_comments_post   ON comments(comment_post_ID);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(comment_approved);
