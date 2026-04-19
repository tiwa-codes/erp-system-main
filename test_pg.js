const { Client } = require('pg');

const connectionString = "postgresql://crownjewelhmo:crownjewelhmo%40sbfy360@167.99.59.53:5432/crownjewelhmo";

async function test() {
  console.log("Starting Raw PG Connection Test...");
  const client = new Client({
    connectionString: connectionString,
    connectionTimeoutMillis: 10000, // 10s
  });

  try {
    const start = Date.now();
    await client.connect();
    console.log(`Connection established in ${Date.now() - start}ms`);
    
    const queryStart = Date.now();
    const res = await client.query('SELECT NOW()');
    console.log(`Query "SELECT NOW()" took ${Date.now() - queryStart}ms`);
    console.log("Result:", res.rows[0]);
  } catch (err) {
    console.error("Raw PG Connection failed:", err);
  } finally {
    await client.end();
  }
}

test();
