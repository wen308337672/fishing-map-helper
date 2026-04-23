// Vercel Node.js Function - 天地图瓦片代理
// 代理小程序的瓦片请求，绕过天地图 WAF 对小程序请求的拦截
// 
// 使用方式：GET /api/tile-proxy?type=img_w&x=52603&y=28730&l=16
// 返回：天地图瓦片图片二进制
//
// 注意：天地图 WAF 会检测 User-Agent 与 TLS 指纹是否匹配
//   Node.js https 发 HTTP/1.1，如果 UA 声称是 Chrome（用 HTTP/2）
//   反而会被 WAF 拦截。所以不要伪装浏览器 UA。

const TK_KEYS = [
  '3ca7ec3a931bc28d7563bf006adc411d'
];

const TILE_SERVERS = [
  't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'
];

function pickServer(x, y) {
  const idx = ((x * 7 + y * 13) & 0x7FFFFFFF) % TILE_SERVERS.length;
  return TILE_SERVERS[idx];
}

export default async function handler(req, res) {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }
  
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }
  
  const { type, x, y, l, z } = req.query;
  const zoom = l || z || '16';
  
  if (!x || !y) {
    res.status(400).send('Missing x or y parameter');
    return;
  }
  
  const server = pickServer(parseInt(x), parseInt(y));
  const tk = TK_KEYS[0];
  const tileUrl = `https://${server}.tianditu.gov.cn/DataServer?T=${type || 'img_w'}&x=${x}&y=${y}&l=${zoom}&tk=${tk}`;
  
  try {
    const https = require('https');
    const url = new URL(tileUrl);
    
    const buffer = await new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Accept': 'image/*,*/*;q=0.8',
          'Accept-Encoding': 'identity',
        },
        timeout: 10000,
      };
      
      const reqLib = https.request(options, (resp) => {
        const chunks = [];
        resp.on('data', (chunk) => chunks.push(chunk));
        resp.on('end', () => {
          resolve({
            data: Buffer.concat(chunks),
            contentType: resp.headers['content-type'] || 'image/jpg',
            statusCode: resp.statusCode,
          });
        });
        resp.on('error', reject);
      });
      
      reqLib.on('error', reject);
      reqLib.on('timeout', () => {
        reqLib.destroy();
        reject(new Error('Request timeout'));
      });
      reqLib.end();
    });
    
    if (buffer.statusCode !== 200) {
      console.error('Tile proxy upstream error:', buffer.statusCode, 'for', tileUrl);
      res.status(buffer.statusCode).send('Upstream error: ' + buffer.statusCode);
      return;
    }
    
    res.setHeader('Content-Type', buffer.contentType);
    res.setHeader('Cache-Control', 'public, max-age=2592000');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(buffer.data);
  } catch (err) {
    console.error('Tile proxy fetch error:', err.message);
    res.status(502).send('Proxy error: ' + err.message);
  }
}
