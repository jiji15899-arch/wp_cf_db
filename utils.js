export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-CF-API-Key',
};

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export function parseId(url, prefix) {
  // e.g. /api/posts/123 → 123
  const match = url.pathname.match(new RegExp(`^${prefix}/(\\d+)$`));
  return match ? parseInt(match[1]) : null;
}

export async function parseBody(request) {
  try { return await request.json(); }
  catch { return {}; }
}
