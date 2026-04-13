import { jsonResponse, errorResponse, parseBody } from '../utils.js';

// ── POST META ──────────────────────────────────────────────
export async function handleMeta(request, env, url) {
  const method = request.method;
  const postId = url.searchParams.get('post_id');

  // GET /api/meta?post_id=123
  if (method === 'GET') {
    if (!postId) return errorResponse(400, 'post_id required');
    const { results } = await env.DB.prepare('SELECT meta_key, meta_value FROM postmeta WHERE post_id=?').bind(postId).all();
    const meta = {};
    for (const r of results) meta[r.meta_key] = r.meta_value;
    return jsonResponse(meta);
  }

  // POST /api/meta  { post_id, meta_key, meta_value }
  if (method === 'POST') {
    const { post_id, meta_key, meta_value } = await parseBody(request);
    if (!post_id || !meta_key) return errorResponse(400, 'post_id and meta_key required');
    await env.DB.prepare(
      `INSERT INTO postmeta (post_id,meta_key,meta_value) VALUES (?,?,?)
       ON CONFLICT(post_id,meta_key) DO UPDATE SET meta_value=excluded.meta_value`
    ).bind(post_id, meta_key, meta_value ?? '').run();
    return jsonResponse({ saved: true });
  }

  // DELETE /api/meta?post_id=123&meta_key=_thumbnail_id
  if (method === 'DELETE') {
    const metaKey = url.searchParams.get('meta_key');
    if (!postId || !metaKey) return errorResponse(400, 'post_id and meta_key required');
    await env.DB.prepare('DELETE FROM postmeta WHERE post_id=? AND meta_key=?').bind(postId, metaKey).run();
    return jsonResponse({ deleted: true });
  }

  return errorResponse(405, 'Method Not Allowed');
}

// ── OPTIONS ───────────────────────────────────────────────
export async function handleOptions(request, env, url) {
  const method = request.method;
  const name   = url.searchParams.get('name');

  // GET /api/options?name=siteurl  OR  /api/options (all)
  if (method === 'GET') {
    if (name) {
      const row = await env.DB.prepare('SELECT option_value FROM options WHERE option_name=?').bind(name).first();
      return jsonResponse(row ? row.option_value : null);
    }
    const { results } = await env.DB.prepare('SELECT option_name, option_value FROM options').all();
    const opts = {};
    for (const r of results) opts[r.option_name] = r.option_value;
    return jsonResponse(opts);
  }

  // POST /api/options  { name, value }
  if (method === 'POST') {
    const { name: n, value } = await parseBody(request);
    if (!n) return errorResponse(400, 'name required');
    await env.DB.prepare(
      `INSERT INTO options (option_name,option_value) VALUES (?,?)
       ON CONFLICT(option_name) DO UPDATE SET option_value=excluded.option_value`
    ).bind(n, value ?? '').run();
    return jsonResponse({ saved: true });
  }

  // DELETE /api/options?name=foo
  if (method === 'DELETE') {
    if (!name) return errorResponse(400, 'name required');
    await env.DB.prepare('DELETE FROM options WHERE option_name=?').bind(name).run();
    return jsonResponse({ deleted: true });
  }

  return errorResponse(405, 'Method Not Allowed');
}

// ── MEDIA ─────────────────────────────────────────────────
export async function handleMedia(request, env, url) {
  const method = request.method;
  const id     = parseInt(url.pathname.split('/').pop()) || null;

  // GET /api/media?post_id=123  OR  /api/media/:id
  if (method === 'GET') {
    if (id && !isNaN(id)) {
      const row = await env.DB.prepare('SELECT * FROM media WHERE ID=?').bind(id).first();
      return row ? jsonResponse(row) : errorResponse(404, 'Not found');
    }
    const postId = url.searchParams.get('post_id');
    const query  = postId
      ? env.DB.prepare('SELECT * FROM media WHERE post_id=? ORDER BY uploaded_at DESC').bind(postId)
      : env.DB.prepare('SELECT * FROM media ORDER BY uploaded_at DESC LIMIT 100');
    const { results } = await query.all();
    return jsonResponse(results);
  }

  // POST /api/media  { post_id, file_url, mime_type, file_size, width, height, alt_text, caption, description }
  if (method === 'POST') {
    const b = await parseBody(request);
    const { post_id=0, file_url, mime_type='', file_size=0, width=null, height=null, alt_text='', caption='', description='' } = b;
    if (!file_url) return errorResponse(400, 'file_url required');
    const { meta: { last_row_id } } = await env.DB.prepare(
      `INSERT INTO media (post_id,file_url,mime_type,file_size,width,height,alt_text,caption,description)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind(post_id,file_url,mime_type,file_size,width,height,alt_text,caption,description).run();
    return jsonResponse({ id: last_row_id }, 201);
  }

  // PUT /api/media/:id
  if (method === 'PUT' && id) {
    const b = await parseBody(request);
    const fields = ['file_url','mime_type','file_size','width','height','alt_text','caption','description'];
    const updates = []; const params = [];
    for (const f of fields) if (f in b) { updates.push(`${f}=?`); params.push(b[f]); }
    if (!updates.length) return errorResponse(400, 'Nothing to update');
    params.push(id);
    await env.DB.prepare(`UPDATE media SET ${updates.join(',')} WHERE ID=?`).bind(...params).run();
    return jsonResponse({ updated: true });
  }

  // DELETE /api/media/:id
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM media WHERE ID=?').bind(id).run();
    return jsonResponse({ deleted: true });
  }

  return errorResponse(405, 'Method Not Allowed');
}

// ── TERMS ─────────────────────────────────────────────────
export async function handleTerms(request, env, url) {
  const method = request.method;

  // GET /api/terms?taxonomy=category
  // GET /api/terms?post_id=123
  if (method === 'GET') {
    const taxonomy = url.searchParams.get('taxonomy');
    const postId   = url.searchParams.get('post_id');

    if (postId) {
      const { results } = await env.DB.prepare(
        `SELECT t.* FROM terms t
         JOIN term_relationships tr ON t.term_id=tr.term_id
         WHERE tr.object_id=?`
      ).bind(postId).all();
      return jsonResponse(results);
    }
    if (taxonomy) {
      const { results } = await env.DB.prepare('SELECT * FROM terms WHERE taxonomy=? ORDER BY name').bind(taxonomy).all();
      return jsonResponse(results);
    }
    const { results } = await env.DB.prepare('SELECT * FROM terms ORDER BY taxonomy, name').all();
    return jsonResponse(results);
  }

  // POST /api/terms  { name, slug, taxonomy, description, parent }
  if (method === 'POST') {
    const b = await parseBody(request);
    const { name, slug, taxonomy='category', description='', parent=0 } = b;
    if (!name) return errorResponse(400, 'name required');
    const s = slug || name.toLowerCase().replace(/\s+/g, '-');
    const { meta: { last_row_id } } = await env.DB.prepare(
      `INSERT INTO terms (name,slug,taxonomy,description,parent) VALUES (?,?,?,?,?)
       ON CONFLICT(slug,taxonomy) DO UPDATE SET name=excluded.name, description=excluded.description`
    ).bind(name, s, taxonomy, description, parent).run();
    return jsonResponse({ id: last_row_id }, 201);
  }

  // POST /api/terms/assign  { post_id, term_ids: [1,2,3] }
  if (method === 'POST' && url.pathname.endsWith('/assign')) {
    const { post_id, term_ids } = await parseBody(request);
    if (!post_id || !term_ids?.length) return errorResponse(400, 'post_id and term_ids required');
    for (const tid of term_ids) {
      await env.DB.prepare(
        'INSERT INTO term_relationships (object_id,term_id) VALUES (?,?) ON CONFLICT DO NOTHING'
      ).bind(post_id, tid).run();
    }
    return jsonResponse({ assigned: true });
  }

  // DELETE /api/terms?id=5
  if (method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return errorResponse(400, 'id required');
    await env.DB.prepare('DELETE FROM terms WHERE term_id=?').bind(id).run();
    await env.DB.prepare('DELETE FROM term_relationships WHERE term_id=?').bind(id).run();
    return jsonResponse({ deleted: true });
  }

  return errorResponse(405, 'Method Not Allowed');
}

// ── COMMENTS ──────────────────────────────────────────────
export async function handleComments(request, env, url) {
  const method = request.method;
  const id     = parseInt(url.pathname.split('/').pop()) || null;

  // GET /api/comments?post_id=123&status=1
  if (method === 'GET') {
    const postId = url.searchParams.get('post_id');
    const status = url.searchParams.get('status') || '1';
    if (!postId) {
      const { results } = await env.DB.prepare('SELECT * FROM comments WHERE comment_approved=? ORDER BY comment_date DESC LIMIT 50').bind(status).all();
      return jsonResponse(results);
    }
    const { results } = await env.DB.prepare(
      'SELECT * FROM comments WHERE comment_post_ID=? AND comment_approved=? ORDER BY comment_date'
    ).bind(postId, status).all();
    return jsonResponse(results);
  }

  // POST /api/comments
  if (method === 'POST') {
    const b = await parseBody(request);
    const { comment_post_ID=0, comment_author='', comment_author_email='', comment_author_url='',
            comment_content='', comment_approved='0', comment_parent=0, user_id=0 } = b;
    const { meta: { last_row_id } } = await env.DB.prepare(
      `INSERT INTO comments (comment_post_ID,comment_author,comment_author_email,comment_author_url,comment_content,comment_approved,comment_parent,user_id)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(comment_post_ID,comment_author,comment_author_email,comment_author_url,comment_content,comment_approved,comment_parent,user_id).run();
    return jsonResponse({ id: last_row_id }, 201);
  }

  // PUT /api/comments/:id  (approve/reject/edit)
  if (method === 'PUT' && id) {
    const b = await parseBody(request);
    const fields = ['comment_content','comment_approved'];
    const updates = []; const params = [];
    for (const f of fields) if (f in b) { updates.push(`${f}=?`); params.push(b[f]); }
    if (!updates.length) return errorResponse(400, 'Nothing to update');
    params.push(id);
    await env.DB.prepare(`UPDATE comments SET ${updates.join(',')} WHERE comment_ID=?`).bind(...params).run();
    return jsonResponse({ updated: true });
  }

  // DELETE /api/comments/:id
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM comments WHERE comment_ID=?').bind(id).run();
    return jsonResponse({ deleted: true });
  }

  return errorResponse(405, 'Method Not Allowed');
}

// ── KV CACHE ──────────────────────────────────────────────
// Used for: page HTML cache, query results cache
export async function handleCache(request, env, url) {
  const method = request.method;
  const key    = url.searchParams.get('key');

  if (method === 'GET') {
    if (!key) return errorResponse(400, 'key required');
    const val = await env.KV.get(`cache:${key}`);
    return jsonResponse({ key, value: val, hit: val !== null });
  }

  if (method === 'POST') {
    const { key: k, value, ttl } = await parseBody(request);
    if (!k) return errorResponse(400, 'key required');
    const opts = ttl ? { expirationTtl: ttl } : {};
    await env.KV.put(`cache:${k}`, typeof value === 'string' ? value : JSON.stringify(value), opts);
    return jsonResponse({ saved: true });
  }

  if (method === 'DELETE') {
    if (!key) return errorResponse(400, 'key required');
    await env.KV.delete(`cache:${key}`);
    return jsonResponse({ deleted: true });
  }

  return errorResponse(405, 'Method Not Allowed');
}

// ── KV TRANSIENTS ─────────────────────────────────────────
// WordPress transient API equivalent (set_transient / get_transient)
export async function handleTransients(request, env, url) {
  const method = request.method;
  const name   = url.searchParams.get('name');

  if (method === 'GET') {
    if (!name) return errorResponse(400, 'name required');
    const val = await env.KV.get(`transient:${name}`);
    return jsonResponse({ name, value: val, exists: val !== null });
  }

  if (method === 'POST') {
    const { name: n, value, expiration } = await parseBody(request);
    if (!n) return errorResponse(400, 'name required');
    const opts = expiration ? { expirationTtl: expiration } : {};
    await env.KV.put(`transient:${n}`, typeof value === 'string' ? value : JSON.stringify(value), opts);
    return jsonResponse({ saved: true });
  }

  if (method === 'DELETE') {
    if (!name) return errorResponse(400, 'name required');
    await env.KV.delete(`transient:${name}`);
    return jsonResponse({ deleted: true });
  }

  return errorResponse(405, 'Method Not Allowed');
}
