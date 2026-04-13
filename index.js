/**
 * Cloudflare Worker - WordPress CF Storage Backend
 * Handles all data storage/retrieval for the WordPress plugin
 * Bindings required:
 *   - DB: D1 database (posts, meta, options, comments, terms)
 *   - KV: KV namespace (sessions, cache, transients)
 *   - API_KEY: Secret (from Workers secrets)
 */

import { handlePosts } from './handlers/posts.js';
import { handleMeta } from './handlers/meta.js';
import { handleOptions } from './handlers/options.js';
import { handleMedia } from './handlers/media.js';
import { handleTerms } from './handlers/terms.js';
import { handleComments } from './handlers/comments.js';
import { handleCache } from './handlers/cache.js';
import { handleTransients } from './handlers/transients.js';
import { corsHeaders, errorResponse } from './utils.js';

export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API Key authentication
    const apiKey = request.headers.get('X-CF-API-Key');
    if (!apiKey || apiKey !== env.API_KEY) {
      return errorResponse(401, 'Unauthorized');
    }

    const url = new URL(request.url);
    const path = url.pathname; // e.g. /api/posts, /api/meta, /api/options

    try {
      // Route to handlers
      if (path.startsWith('/api/posts'))      return handlePosts(request, env, url);
      if (path.startsWith('/api/meta'))       return handleMeta(request, env, url);
      if (path.startsWith('/api/options'))    return handleOptions(request, env, url);
      if (path.startsWith('/api/media'))      return handleMedia(request, env, url);
      if (path.startsWith('/api/terms'))      return handleTerms(request, env, url);
      if (path.startsWith('/api/comments'))   return handleComments(request, env, url);
      if (path.startsWith('/api/cache'))      return handleCache(request, env, url);
      if (path.startsWith('/api/transients')) return handleTransients(request, env, url);
      if (path === '/api/health')             return new Response(JSON.stringify({ status: 'ok', ts: Date.now() }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });

      return errorResponse(404, 'Not Found');
    } catch (e) {
      console.error(e);
      return errorResponse(500, e.message || 'Internal Server Error');
    }
  }
};
