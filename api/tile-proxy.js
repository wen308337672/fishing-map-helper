// Vercel Node.js Function - 天地图瓦片代理
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
    // 用 Node.js 原生 http/https 发请求，完全控制请求头
    const https = require('https');
    const url = new URL(tileUrl);
    
    const buffer = await new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          'Referer': 'https://map.tianditu.gov.cn/',
        },
        timeout: 10000,
      };
      
      const reqLib = https.request(options, (resp) => {
        // 处理 gzip
        const encoding = resp.headers['content-encoding'];
        let stream = resp;
        if (encoding === 'gzip') {
          const zlib = require('zlib');
          stream = resp.pipe(zlib.createGunzip());
        } else if (encoding === 'deflate') {
          const zlib = require('zlib');
          stream = resp.pipe(zlib.createInflate());
        }
        
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => {
          resolve({
            data: Buffer.concat(chunks),
            contentType: resp.headers['content-type'] || 'image/jpg',
            statusCode: resp.statusCode,
          });
        });
        stream.on('error', reject);
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
