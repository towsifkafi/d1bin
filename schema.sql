CREATE TABLE IF NOT EXISTS content (
    key TEXT PRIMARY KEY,
    content BLOB,
    content_type TEXT,
    content_encoding TEXT,
    user_agent TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)