/**
 * Vercel Edge Function — 天地图瓦片代理
 * 
 * 用途：绕过天地图 HTTP Referer 白名单限制
 * 原理：服务端转发请求，KEY 不暴露在前端
 * 
 * 调用方式：
 *   GET /api/tile?x={col}&y={row}&z={zoom}&type=img
 *   GET /api/tile?x={col}&y={row}&z={zoom}&type=cia  (注记层)
 * 
 * 部署：vercel --prod（推送 GitHub 自动触发）
 */

const TILE_KEY = 'c6abc72f35da7d4565e99e0cef4443ae';

// 天地图瓦片服务器子域（8个，轮询降低单域压力）
const TIANDITU_HOSTS = [
  't0.tianditu.gov.cn', 't1.tianditu.gov.cn', 't2.tianditu.gov.cn',
  't3.tianditu.gov.cn', 't4.tianditu.gov.cn', 't5.tianditu.gov.cn',
  't6.tianditu.gov.cn', 't7.tianditu.gov.cn'
];

// 瓦片类型 → 天地图图层名
const LAYER_MAP = {
  img:  'img_w',   // 卫星影像
  cia:  'cia_w',   // 注记（卫星图用）
  vec:  'vec_w',   // 矢量底图
  cva:  'cva_w',   // 矢量注记
};

export default async function handler(req) {
  const url = new URL(req.url);
  const x   = url.searchParams.get('x');
  const y   = url.searchParams.get('y');
  const z   = url.searchParams.get('z') || url.searchParams.get('l');
  const type = url.searchParams.get('type') || 'img';

  if (!x || !y || !z) {
    return new Response('Missing x/y/z params', { status: 400 });
  }

  const layer = LAYER_MAP[type] || 'img_w';
  const host  = TIANDITU_HOSTS[(parseInt(x) + parseInt(y)) % 8];
  const tileUrl = `https://${host}/DataServer?T=${layer}&x=${x}&y=${y}&l=${z}&tk=${TILE_KEY}`;

  try {
    const resp = await fetch(tileUrl, {
      headers: {
        'Referer': 'https://www.qq.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!resp.ok) {
      console.error(`Tile proxy error: ${resp.status} ${resp.statusText} — ${tileUrl}`);
      return new Response('Upstream error', { status: 502 });
    }

    const buffer = await resp.arrayBuffer();

    // 根据 type 返不同 Content-Type
    const contentType = type === 'img' || type === 'vec'
      ? 'image/png'
      : 'image/png';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',  // 瓦片缓存 1 天
        'Access-Control-Allow-Origin': '*',        // 允许小程序跨域
      },
    });
  } catch (err) {
    console.error('Tile proxy fetch failed:', err);
    return new Response('Proxy failed', { status: 500 });
  }
}