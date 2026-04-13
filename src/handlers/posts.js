import { jsonResponse, errorResponse, parseId, parseBody } from '../utils.js';

export async function handlePosts(request, env, url) {
  const id = parseId(url, '/api/posts');
  const method = request.method;

  // GET /api/posts?type=post&status=publish&page=1&per_page=10
  if (method === 'GET' && !id) {
    const type     = url.searchParams.get('type')     || 'post';
    const status   = url.searchParams.get('status')   || 'publish';
    const page     = parseInt(url.searchParams.get('page')     || '1');
    const perPage  = parseInt(url.searchParams.get('per_page') || '10');
    const search   = url.searchParams.get('search')   || '';
    const authorId = url.searchParams.get('author_id')|| '';
    const offset   = (page - 1) * perPage;

    let query  = 'SELECT * FROM posts WHERE post_type=? AND post_status=?';
    let params = [type, status];

    if (search) { query += ' AND (post_title LIKE ? OR post_content LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (authorId) { query += ' AND post_author=?'; params.push(authorId); }

    query += ' ORDER BY post_date DESC LIMIT ? OFFSET ?';
    params.push(perPage, offset);

    const { results } = await env.DB.prepare(query).bind(...params).all();
    const { results: [{ total }] } = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM posts WHERE post_type=? AND post_status=?'
    ).bind(type, status).all();

    return jsonResponse({ posts: results, total, page, per_page: perPage });
  }

  // GET /api/posts/:id
  if (method === 'GET' && id) {
    const post = await env.DB.prepare('SELECT * FROM posts WHERE ID=?').bind(id).first();
    if (!post) return errorResponse(404, 'Post not found');
    return jsonResponse(post);
  }

  // POST /api/posts
  if (method === 'POST') {
    const body = await parseBody(request);
    const { post_author=1, post_title='', post_content='', post_excerpt='',
            post_status='draft', post_name='', post_type='post',
            post_parent=0, menu_order=0, guid='' } = body;

    const slug = post_name || slugify(post_title);
    const { meta: { last_row_id } } = await env.DB.prepare(
      `INSERT INTO posts (post_author,post_title,post_content,post_excerpt,post_status,post_name,post_type,post_parent,menu_order,guid)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(post_author,post_title,post_content,post_excerpt,post_status,slug,post_type,post_parent,menu_order,guid).run();

    return jsonResponse({ id: last_row_id }, 201);
  }

  // PUT /api/posts/:id
  if (method === 'PUT' && id) {
    const body = await parseBody(request);
    const fields = ['post_title','post_content','post_excerpt','post_status','post_name','post_type','post_parent','menu_order'];
    const updates = [];
    const params  = [];
    for (const f of fields) {
      if (f in body) { updates.push(`${f}=?`); params.push(body[f]); }
    }
    if (!updates.length) return errorResponse(400, 'Nothing to update');
    updates.push(`modified=datetime('now')`);
    params.push(id);
    await env.DB.prepare(`UPDATE posts SET ${updates.join(',')} WHERE ID=?`).bind(...params).run();
    return jsonResponse({ updated: true });
  }

  // DELETE /api/posts/:id
  if (method === 'DELETE' && id) {
    await env.DB.prepare('DELETE FROM posts WHERE ID=?').bind(id).run();
    await env.DB.prepare('DELETE FROM postmeta WHERE post_id=?').bind(id).run();
    return jsonResponse({ deleted: true });
  }

  return errorResponse(405, 'Method Not Allowed');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');
}
