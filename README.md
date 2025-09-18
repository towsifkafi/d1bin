# d1bin
A simple Cloudflare Worker that stores and retrieves data using a Cloudflare D1 database, inspired by [lucko/bytebin](https://github.com/lucko/bytebin) but built for a serverless architecture. This project was created to run [lucko/paste](https://github.com/lucko/paste) on Cloudflare's serverless workers.

It supports storing binary data, though it is not ideal for large binaries due to the SQL-based D1 database. It is well suited for storing paste-like text data.

## Getting Started
Clone the repository and use [`wrangler`](https://developers.cloudflare.com/workers/wrangler/install-and-update/) to run the project locally.

```bash
git clone https://github.com/towsifkafi/d1bin.git
cd d1bin
```
Create a D1 database.
```bash
wrangler d1 database create <database_name>
wrangler d1 execute <database_name> --file=./schema.sql   # run only once
```
You will have to configure the `wrangler.jsonc` file with your D1 database details. Then you can start the local development server:
```bash
wrangler dev
```

To run on a deployed D1 database:
```bash
wrangler dev --remote
```

To deploy the worker to Cloudflare:
```bash
wrangler d1 execute <database_name> --file=./schema.sql   # run only once
wrangler deploy
```

## Usage
#### Read
- `GET /{key}` (e.g., `/a1b2c3d`): Returns content as-is. Client can use encoding (e.g., gzip) during upload. 

#### Write
- `POST /post`: Send content in body. Optional `Content-Type` (e.g., `application/json`) and `User-Agent` headers. Compress with gzip and set `Content-Encoding: gzip` for performance (Optional). Returns unique key in `Location` header and JSON body (e.g., `{"key": "a1b2c3d"}`).