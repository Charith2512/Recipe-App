const db = require('../config/db');

async function runMigration() {
    try {
        console.log('Checking recipes table for is_ai_generated column...');
        
        // Check if column exists
        const [columns] = await db.query("SHOW COLUMNS FROM recipes LIKE 'is_ai_generated'");
        
        if (columns.length === 0) {
            console.log('Column does not exist. Adding it...');
            await db.query("ALTER TABLE recipes ADD COLUMN is_ai_generated BOOLEAN DEFAULT FALSE");
            console.log('✅ Successfully added is_ai_generated column.');
        } else {
            console.log('ℹ️ Column already exists. Skipping.');
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Migration Failed:', err);
        process.exit(1);
    }
}

runMigration();
