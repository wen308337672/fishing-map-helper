// Vercel Serverless Function - 天地图瓦片代理
// 代理小程序的瓦片请求，绕过天地图 WAF 对小程序请求的拦截
// 
// 使用方式：GET /api/tile-proxy?type=img_w&x=52603&y=28730&l=16
// 返回：天地图瓦片图片二进制

const TK_KEYS = [
  '3ca7ec3a931bc28d7563bf006adc411d'
];

const TILE_SERVERS = [
  't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'
];

// 根据 x+y hash 选一个服务器，保持稳定
function pickServer(x, y) {
  const idx = ((x * 7 + y * 13) & 0x7FFFFFFF) % TILE_SERVERS.length;
  return TILE_SERVERS[idx];
}

// CORS 预检
function handleOptions() {
  return {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  };
}

// 代理请求
async function handleGet(req) {
  const { searchParams } = new URL(req.url);
  
  const type = searchParams.get('type') || 'img_w';
  const x = searchParams.get('x');
  const y = searchParams.get('y');
  const l = searchParams.get('l') || searchParams.get('z') || '16';
  
  if (!x || !y) {
    return { status: 400, body: 'Missing x or y parameter' };
  }
  
  const server = pickServer(parseInt(x), parseInt(y));
  const tk = TK_KEYS[0];
  
  const tileUrl = `https://${server}.tianditu.gov.cn/DataServer?T=${type}&x=${x}&y=${y}&l=${l}&tk=${tk}`;
  
  try {
    const resp = await fetch(tileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      }
    });
    
    if (!resp.ok) {
      console.error(`Tile proxy error: ${resp.status} for ${tileUrl}`);
      return { status: resp.status, body: `Upstream error: ${resp.status}` };
    }
    
    const buffer = await resp.arrayBuffer();
    
    return {
      status: 200,
      headers: {
        'Content-Type': resp.headers.get('Content-Type') || 'image/jpg',
        'Cache-Control': 'public, max-age=2592000', // 30天缓存（天地图瓦片不变）
        'Access-Control-Allow-Origin': '*',
      },
      body: buffer,
    };
  } catch (err) {
    console.error('Tile proxy fetch error:', err.message);
    return { status: 502, body: `Proxy error: ${err.message}` };
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return handleOptions();
  }
  if (req.method === 'GET') {
    return handleGet(req);
  }
  return { status: 405, body: 'Method not allowed' };
}
