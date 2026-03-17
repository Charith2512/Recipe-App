const db = require('../config/db');

async function migrate() {
    console.log("Starting migration...");
    try {
        // 1. Get Foreign Key Name
        const [rows] = await db.query(`
            SELECT CONSTRAINT_NAME 
            FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_NAME = 'meal_plans' 
            AND COLUMN_NAME = 'recipe_id' 
            AND TABLE_SCHEMA = '${process.env.DB_NAME}';
        `);

        if (rows.length > 0) {
            const fkName = rows[0].CONSTRAINT_NAME;
            console.log(`Found Foreign Key: ${fkName}. Dropping...`);
            await db.query(`ALTER TABLE meal_plans DROP FOREIGN KEY ${fkName}`);
        } else {
            console.log("No Foreign Key found on recipe_id (already dropped?)");
        }

        // 2. Modify recipe_id to allow Strings (external IDs) and NULL
        console.log("Modifying recipe_id column...");
        await db.query(`ALTER TABLE meal_plans MODIFY recipe_id VARCHAR(255) NULL`);

        // 3. Add title and image_url columns if they don't exist
        console.log("Adding title and image_url columns...");
        try {
            await db.query(`ALTER TABLE meal_plans ADD COLUMN title VARCHAR(255)`);
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("Column 'title' already exists.");
            else throw e;
        }

        try {
            await db.query(`ALTER TABLE meal_plans ADD COLUMN image_url VARCHAR(500)`);
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("Column 'image_url' already exists.");
            else throw e;
        }

        console.log("Migration completed successfully!");
        process.exit(0);

    } catch (err) {
        console.error("Migration Failed:", err);
        process.exit(1);
    }
}

migrate();
