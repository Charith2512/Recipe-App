const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken } = require('../src/auth');

// GET /api/meal-plan - Get plans for a date range
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start and end dates are required' });
        }

        // Fetch from meal_plans, joining recipes for fallback if title/image are null
        // Fix: Use DATE_FORMAT to ensure simplified YYYY-MM-DD string is returned directly, avoiding Timezone shifts in JS.
        const [rows] = await db.query(`
            SELECT mp.id, DATE_FORMAT(mp.date, '%Y-%m-%d') as date, mp.meal_type, mp.recipe_id, 
                   COALESCE(mp.title, r.title) as title, 
                   COALESCE(mp.image_url, r.image_url) as image_url 
            FROM meal_plans mp
            LEFT JOIN recipes r ON (mp.recipe_id = r.id AND mp.recipe_id REGEXP '^[0-9]+$') 
            WHERE mp.user_id = ? AND mp.date BETWEEN ? AND ?
            ORDER BY mp.date, FIELD(mp.meal_type, 'Breakfast', 'Lunch', 'Dinner', 'Snack')
        `, [userId, start_date, end_date]);

        // Mysql2 returns the string directly now for 'date' field.
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error retrieving meal plans' });
    }
});

// POST /api/meal-plan - Add a meal slot
router.post('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { date, meal_type, recipe_id } = req.body;
        const title = req.body.title || 'Unknown Recipe';
        const image_url = req.body.image_url || '';

        // Always Insert (Allow multiple items per slot)
        await db.query(`
            INSERT INTO meal_plans (date, meal_type, recipe_id, title, image_url, user_id) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [date, meal_type, recipe_id, title, image_url, userId]);

        res.json({ success: true });
    } catch (err) {
        console.error("Save Error:", err);
        res.status(500).json({ error: 'Server error saving meal plan' });
    }
});

// DELETE /api/meal-plan - Remove a specific meal item
router.delete('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.body;
        await db.query(`DELETE FROM meal_plans WHERE id = ? AND user_id = ?`, [id, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error deleting meal plan' });
    }
});

module.exports = router;
