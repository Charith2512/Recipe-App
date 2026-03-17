const db = require('./config/db');

async function test() {
    try {
        const [r] = await db.query(`
            SELECT mp.id, DATE_FORMAT(mp.date, '%Y-%m-%d') as date, mp.meal_type, mp.recipe_id, 
                   COALESCE(mp.title, r.title) as title, 
                   COALESCE(mp.image_url, r.image_url) as image_url 
            FROM meal_plans mp
            LEFT JOIN recipes r ON (mp.recipe_id = r.id AND mp.recipe_id REGEXP '^[0-9]+$') 
            WHERE mp.user_id = 1 AND mp.date BETWEEN '2026-03-16' AND '2026-03-22'
        `);
        console.log('SUCCESS:', r);
    } catch(e) {
        console.error('FAIL:', e.message);
    } finally {
        process.exit();
    }
}
test();
