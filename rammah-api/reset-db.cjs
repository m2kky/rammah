const { Client } = require('pg');
const client = new Client('postgres://postgres:postgres@localhost:55432/rammah');
client.connect().then(() => client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public';")).then(res => {
  console.log('Tables:', res.rows.map(r => r.tablename));
  return client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}).then(() => console.log('Dropped public schema'))
.catch(console.error)
.finally(() => client.end());
