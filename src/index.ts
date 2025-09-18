import { Hono } from 'hono';
import { getConnInfo } from 'hono/cloudflare-workers'
import { cors } from 'hono/cors'

import { customAlphabet } from 'nanoid';
const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 8)

import { Buffer } from "node:buffer";
import { env } from 'node:process';

type Env = {
    DB: D1Database;
    POST_RATE_LIMIT: RateLimit;
    GET_RATE_LIMIT: RateLimit;
    MAX_BODY_SIZE: number;
};

const app = new Hono<{ Bindings: Env }>();

const generateKey = () => nanoid(8);

app.use("*", cors({
    origin: '*',
    allowMethods: ['GET', 'POST'],
}))

app.use("*", async (c, next) => {
	
	const ipAddress = getConnInfo(c).remote.address;

    let rate = { success: true };

    if(c.req.method === 'POST') {
        rate = await c.env.POST_RATE_LIMIT.limit({ key: ipAddress || 'unknown' })
    } else if(c.req.method === 'GET') {
        rate = await c.env.GET_RATE_LIMIT.limit({ key: ipAddress || 'unknown' })
    }
	const success = rate.success

	if(!success) {
		return c.json({
			error: true,
			message: "Rate Limited: Too many requests"
		}, 429)
	}

    const contentLength = c.req.header('content-length');
    if (contentLength && parseInt(contentLength) > (c.env.MAX_BODY_SIZE || 15*1024*1024)) {
        return c.text('Content too large', 413);
    }

	await next()
})

app.get('/:key', async (c) => {
    const key = c.req.param('key');

    const result: Record<string, any> | null = await c.env.DB.prepare('SELECT content, content_type, content_encoding FROM content WHERE key = ?')
        .bind(key)
        .first();

    if (!result) { return c.text('Not found', 404) }

    const { content, content_type, content_encoding } = result;

    const data = Buffer.from(content);

    // response headers
    console.log(content_encoding)
    c.header('Content-Type', content_type || 'text/plain');
    if (content_encoding) {
        c.header('Content-Encoding', content_encoding);
    }

    if (content_encoding === 'gzip') {
        try {
            const decompressed = await decompressGzip(data);
            return c.body(decompressed, 200);
        } catch (e) {
            console.error('Error decompressing content:', e);
            return c.text('Error decompressing content', 500);
        }
    }

    return c.body(data, 200);
});

app.post('/post', async (c) => {
    const key = generateKey();
    const content = await c.req.raw.arrayBuffer();
    const contentType = c.req.header('Content-Type') || 'text/plain';
    const contentEncoding = c.req.header('Content-Encoding') || '';
    const clientInfo = getConnInfo(c)
    const userAgent = c.req.header('User-Agent') || '';

    // store content in D1
    try {
        await c.env.DB.prepare(
                'INSERT INTO content (key, content, content_type, content_encoding, user_agent, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
            )
            .bind(key, content, contentType, contentEncoding, userAgent, clientInfo.remote.address)
            .run();
    } catch (e) {
        console.log(e)
        return c.text('Error storing content', 500);
    }

    c.header('Location', `/${key}`);
    return c.json({ key }, 201);
});

async function decompressGzip(data: ArrayBuffer | Uint8Array): Promise <ArrayBuffer> {
    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    writer.write(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
    writer.close();
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream.readable) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).buffer;
}

export default app;