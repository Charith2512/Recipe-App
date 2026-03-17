const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../config/db');

async function backfill() {
    try {
        const connection = await db.getConnection();
        console.log("Connected to DB...");

        // 1. Get Recipes needing update
        const [recipes] = await connection.query(`
            SELECT id, title FROM recipes 
            WHERE is_ai_generated = TRUE AND source_ingredients IS NULL
        `);

        console.log(`Found ${recipes.length} recipes to backfill.`);

        for (const r of recipes) {
            // 2. Get ingredients for this recipe
            const [rows] = await connection.query(`
                SELECT i.name 
                FROM recipe_ingredients ri
                JOIN ingredients i ON ri.ingredient_id = i.id
                WHERE ri.recipe_id = ?
            `, [r.id]);

            if (rows.length > 0) {
                // 3. Construct source string (approximate from actual ingredients)
                const source = rows.map(row => row.name.toLowerCase()).join(',');
                
                await connection.query(`
                    UPDATE recipes SET source_ingredients = ? WHERE id = ?
                `, [source, r.id]);
                
                console.log(`Updated "${r.title}" with: ${source}`);
            } else {
                console.log(`No ingredients found for "${r.title}", skipping.`);
            }
        }

        console.log("Backfill complete.");
        process.exit(0);

    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

backfill();
