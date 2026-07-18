// ---------- Посты (публичная лента, как в Инсте) ----------
// Любой пользователь может опубликовать фото/видео с подписью;
// лента видна всем, лайки и комментарии — тоже общие.
const express = require("express");
const fs = require("fs");
const path = require("path");
const db = require("../db");
const { UPLOAD_DIR } = require("../config");
const { publicUser } = require("../helpers");
const { saveDataUrl } = require("../media");
const { authMiddleware } = require("../middleware");

const router = express.Router();

const MAX_CAPTION_LENGTH = 2000;
const MAX_COMMENT_LENGTH = 500;
const PAGE_SIZE = 20;

function userMap(usernames) {
  if (!usernames.length) return new Map();
  const placeholders = usernames.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM users WHERE username IN (${placeholders})`)
    .all(...usernames);
  const map = new Map();
  for (const r of rows) map.set(r.username, publicUser(r));
  return map;
}

// Собирает посты вместе с автором, счётчиком лайков/комментариев
// и флагом "лайкнул ли я".
function attachPostExtras(rows, viewer) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");

  const likeCounts = db
    .prepare(`SELECT post_id, COUNT(*) AS c FROM post_likes WHERE post_id IN (${placeholders}) GROUP BY post_id`)
    .all(...ids);
  const likeCountMap = new Map(likeCounts.map((r) => [r.post_id, r.c]));

  const myLikes = viewer
    ? db
        .prepare(`SELECT post_id FROM post_likes WHERE post_id IN (${placeholders}) AND username = ?`)
        .all(...ids, viewer)
        .map((r) => r.post_id)
    : [];
  const myLikeSet = new Set(myLikes);

  const commentCounts = db
    .prepare(`SELECT post_id, COUNT(*) AS c FROM post_comments WHERE post_id IN (${placeholders}) GROUP BY post_id`)
    .all(...ids);
  const commentCountMap = new Map(commentCounts.map((r) => [r.post_id, r.c]));

  const authorUsernames = [...new Set(rows.map((r) => r.username))];
  const authors = userMap(authorUsernames);

  return rows.map((r) => ({
    id: r.id,
    author: authors.get(r.username) || { username: r.username, nickname: r.username, avatar: null },
    caption: r.caption || "",
    media_url: r.media_url,
    media_mime: r.media_mime,
    media_kind: r.media_kind,
    media_w: r.media_w || null,
    media_h: r.media_h || null,
    like_count: likeCountMap.get(r.id) || 0,
    liked_by_me: myLikeSet.has(r.id),
    comment_count: commentCountMap.get(r.id) || 0,
    created_at: r.created_at,
  }));
}

// Лента: все посты всех пользователей, новые сверху, с пагинацией через before (created_at).
router.get("/api/posts", authMiddleware, (req, res) => {
  const before = req.query.before ? Number(req.query.before) : null;
  const rows =
    before && Number.isFinite(before)
      ? db
          .prepare("SELECT * FROM posts WHERE created_at < ? ORDER BY created_at DESC LIMIT ?")
          .all(before, PAGE_SIZE)
      : db.prepare("SELECT * FROM posts ORDER BY created_at DESC LIMIT ?").all(PAGE_SIZE);
  const posts = attachPostExtras(rows, req.username);
  res.json({ posts, has_more: rows.length === PAGE_SIZE });
});

// Посты конкретного пользователя (для профиля).
router.get("/api/posts/user/:username", authMiddleware, (req, res) => {
  const rows = db
    .prepare("SELECT * FROM posts WHERE username = ? ORDER BY created_at DESC")
    .all(req.params.username);
  res.json({ posts: attachPostExtras(rows, req.username) });
});

// Публикация нового поста: одно фото или видео (data URL) + необязательная подпись.
router.post("/api/posts", authMiddleware, (req, res) => {
  const { media, caption, media_w, media_h } = req.body || {};
  if (!media) return res.status(400).json({ error: "Прикрепите фото или видео" });

  const cleanCaption = (caption || "").toString().slice(0, MAX_CAPTION_LENGTH);

  const saved = saveDataUrl(media);
  if (saved.error) return res.status(400).json({ error: saved.error });
  if (saved.kind !== "image" && saved.kind !== "video") {
    // Голосовые/аудио сюда не пускаем — пост это фото или видео.
    fs.unlink(path.join(UPLOAD_DIR, path.basename(saved.url)), () => {});
    return res.status(400).json({ error: "Пост поддерживает только фото или видео" });
  }

  const now = Date.now();
  const info = db
    .prepare(
      `INSERT INTO posts (username, caption, media_url, media_mime, media_kind, media_w, media_h, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.username,
      cleanCaption,
      saved.url,
      saved.mime,
      saved.kind,
      Number.isFinite(media_w) ? media_w : null,
      Number.isFinite(media_h) ? media_h : null,
      now
    );

  const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(info.lastInsertRowid);
  res.json({ post: attachPostExtras([row], req.username)[0] });
});

// Удаление своего поста (или создателем сервиса — модерация).
router.delete("/api/posts/:id", authMiddleware, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Пост не найден" });

  const me = db.prepare("SELECT is_owner FROM users WHERE username = ?").get(req.username);
  if (post.username !== req.username && !(me && me.is_owner)) {
    return res.status(403).json({ error: "Можно удалять только свои посты" });
  }

  db.prepare("DELETE FROM posts WHERE id = ?").run(post.id);
  db.prepare("DELETE FROM post_likes WHERE post_id = ?").run(post.id);
  db.prepare("DELETE FROM post_comments WHERE post_id = ?").run(post.id);

  const filePath = path.join(UPLOAD_DIR, path.basename(post.media_url));
  fs.unlink(filePath, () => {});

  res.json({ ok: true });
});

// Лайк/снятие лайка — переключатель одним запросом.
router.post("/api/posts/:id/like", authMiddleware, (req, res) => {
  const post = db.prepare("SELECT id FROM posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Пост не найден" });

  const existing = db
    .prepare("SELECT 1 FROM post_likes WHERE post_id = ? AND username = ?")
    .get(post.id, req.username);

  if (existing) {
    db.prepare("DELETE FROM post_likes WHERE post_id = ? AND username = ?").run(post.id, req.username);
  } else {
    db.prepare("INSERT INTO post_likes (post_id, username, created_at) VALUES (?, ?, ?)").run(
      post.id,
      req.username,
      Date.now()
    );
  }

  const count = db.prepare("SELECT COUNT(*) AS c FROM post_likes WHERE post_id = ?").get(post.id).c;
  res.json({ liked: !existing, like_count: count });
});

// Комментарии: список.
router.get("/api/posts/:id/comments", authMiddleware, (req, res) => {
  const post = db.prepare("SELECT id FROM posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Пост не найден" });

  const rows = db
    .prepare("SELECT * FROM post_comments WHERE post_id = ? ORDER BY created_at ASC")
    .all(post.id);
  const authors = userMap([...new Set(rows.map((r) => r.username))]);
  res.json({
    comments: rows.map((r) => ({
      id: r.id,
      author: authors.get(r.username) || { username: r.username, nickname: r.username, avatar: null },
      text: r.text,
      created_at: r.created_at,
    })),
  });
});

// Комментарии: добавление.
router.post("/api/posts/:id/comments", authMiddleware, (req, res) => {
  const post = db.prepare("SELECT id FROM posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Пост не найден" });

  const text = ((req.body || {}).text || "").toString().trim().slice(0, MAX_COMMENT_LENGTH);
  if (!text) return res.status(400).json({ error: "Пустой комментарий" });

  const now = Date.now();
  const info = db
    .prepare("INSERT INTO post_comments (post_id, username, text, created_at) VALUES (?, ?, ?, ?)")
    .run(post.id, req.username, text, now);

  const me = db.prepare("SELECT * FROM users WHERE username = ?").get(req.username);
  res.json({
    comment: {
      id: info.lastInsertRowid,
      author: publicUser(me),
      text,
      created_at: now,
    },
  });
});

// Комментарии: удаление (автор комментария, автор поста или создатель сервиса).
router.delete("/api/posts/:id/comments/:commentId", authMiddleware, (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Пост не найден" });
  const comment = db.prepare("SELECT * FROM post_comments WHERE id = ? AND post_id = ?").get(req.params.commentId, post.id);
  if (!comment) return res.status(404).json({ error: "Комментарий не найден" });

  const me = db.prepare("SELECT is_owner FROM users WHERE username = ?").get(req.username);
  const allowed =
    comment.username === req.username || post.username === req.username || (me && me.is_owner);
  if (!allowed) return res.status(403).json({ error: "Нет прав на удаление" });

  db.prepare("DELETE FROM post_comments WHERE id = ?").run(comment.id);
  res.json({ ok: true });
});

module.exports = router;
