const db = require('./config/db');
(async () => {
    try {
        const [rows] = await db.query(`
            SELECT mp.id, DATE_FORMAT(mp.date, '%Y-%m-%d') as date, mp.meal_type, mp.recipe_id, 
                   COALESCE(mp.title, r.title) as title, 
                   COALESCE(mp.image_url, r.image_url) as image_url 
            FROM meal_plans mp
            LEFT JOIN recipes r ON (mp.recipe_id = r.id AND mp.recipe_id REGEXP '^[0-9]+$') 
        `);
        console.log("Meal Plan Select Success! Rows:", rows.length);

        const [localRows] = await db.query(`
            SELECT 
                DATE_FORMAT(mp.date, '%Y-%m-%d') as meal_date,
                mp.meal_type,
                mp.title as recipe_title,
                i.name, 
                ri.quantity,
                ri.unit
            FROM meal_plans mp
            JOIN recipes r ON mp.recipe_id = r.id
            JOIN recipe_ingredients ri ON r.id = ri.recipe_id
            JOIN ingredients i ON ri.ingredient_id = i.id
        `);
        console.log("Local Ingredients Select Success! Rows:", localRows.length);
    } catch(e) {
        console.error("DEBUG CRASH:", e);
    } finally {
        process.exit();
    }
})();
