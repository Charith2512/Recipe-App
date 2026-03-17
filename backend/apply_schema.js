const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'test',
        ssl: { rejectUnauthorized: true }
    });

    const schemaStr = fs.readFileSync('schema.sql', 'utf8');
    
    try {
        // Remove comments and split by semicolon
        const statements = schemaStr
            .replace(/--.*$/gm, '')
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const stmt of statements) {
            console.log("Executing:", stmt.substring(0, 50) + "...");
            await connection.query(stmt);
        }
        console.log("TiDB Schema applied successfully.");
    } catch (err) {
        console.error("Error applying schema:", err);
    } finally {
        await connection.end();
    }
}

run();
