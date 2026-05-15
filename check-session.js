const Database = require('better-sqlite3');
const db = new Database('sessions.sqlite');
const rows = db.prepare('SELECT id, shop, scope FROM shopify_sessions').all();
console.log(JSON.stringify(rows, null, 2));
