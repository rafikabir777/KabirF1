// netlify/functions/supabase-proxy.js
// All Supabase calls from the frontend go through here.
// Keys are read from Netlify environment variables — never exposed to the browser.

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_ANON_KEY;  // anon key only

const ALLOWED_ORIGIN = process.env.SITE_URL || '*';

// Paths that are allowed to be proxied
const ALLOWED_PATH_PREFIXES = [
  '/rest/v1/',
  '/auth/v1/token',
  '/auth/v1/signup',
  '/auth/v1/logout',
  '/auth/v1/user',
  '/auth/v1/settings',
  '/auth/v1/authorize',
];

exports.handler = async function(event) {
  // CORS preflight
  if(event.httpMethod === 'OPTIONS'){
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: ''
    };
  }

  // Only allow GET, POST, DELETE
  const method = event.httpMethod;
  if(!['GET','POST','DELETE','PATCH'].includes(method)){
    return { statusCode: 405, headers: corsHeaders(), body: 'Method not allowed' };
  }

  if(!SUPABASE_URL || !SUPABASE_KEY){
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Supabase env vars not configured on Netlify' })
    };
  }

  // Extract the target path from query string: ?path=/rest/v1/comments
  const qs = event.queryStringParameters || {};
  const targetPath = qs.path;

  if(!targetPath){
    return { statusCode: 400, headers: corsHeaders(), body: 'Missing ?path= parameter' };
  }

  // Security: only allow whitelisted path prefixes
  const allowed = ALLOWED_PATH_PREFIXES.some(p => targetPath.startsWith(p));
  if(!allowed){
    return { statusCode: 403, headers: corsHeaders(), body: 'Path not allowed' };
  }

  // Special case: /auth/v1/settings — inject supabase URL for OAuth redirect
  if(targetPath === '/auth/v1/settings'){
    return {
      statusCode: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ _supabaseUrl: SUPABASE_URL })
    };
  }

  // Reconstruct full query string (everything except 'path')
  const forwardQs = Object.entries(qs)
    .filter(([k]) => k !== 'path')
    .map(([k,v]) => `${k}=${v}`)
    .join('&');

  const targetUrl = `${SUPABASE_URL}${targetPath}${forwardQs ? '?' + forwardQs : ''}`;

  // Build headers to forward to Supabase
  const forwardHeaders = {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  };

  // If the user is authenticated, pass their JWT instead of the anon key
  // The frontend sends it as x-user-token
  const userToken = event.headers['x-user-token'];
  if(userToken){
    forwardHeaders['Authorization'] = `Bearer ${userToken}`;
  }

  // Forward PostgREST preference headers from the client
  if(event.headers['prefer'])  forwardHeaders['Prefer']  = event.headers['prefer'];
  if(event.headers['accept'])  forwardHeaders['Accept']  = event.headers['accept'];

  try{
    const response = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: ['POST','PATCH','DELETE'].includes(method) && event.body ? event.body : undefined,
    });

    const text = await response.text();

    return {
      statusCode: response.status,
      headers: {
        ...corsHeaders(),
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
      body: text
    };

  }catch(e){
    return {
      statusCode: 502,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Proxy error: ' + e.message })
    };
  }
};

function corsHeaders(){
  return {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-user-token, Prefer, Accept',
  };
}
