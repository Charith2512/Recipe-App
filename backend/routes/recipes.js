const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken } = require('../src/auth');

// GET /api/recipes - Search & List
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { search, category, max_time, sort } = req.query;
        let query = `
            SELECT r.*, c.name as category_name 
            FROM recipes r 
            LEFT JOIN categories c ON r.category_id = c.id
            WHERE r.user_id = ?
        `;
        const params = [userId];

        if (search) {
            query += ` AND (r.title LIKE ? OR r.description LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }
        if (category) {
            query += ` AND c.name = ?`;
            params.push(category);
        }
        if (max_time) {
            query += ` AND r.prep_time_minutes <= ?`;
            params.push(max_time);
        }
        if (req.query.is_ai_generated) {
            query += ` AND r.is_ai_generated = TRUE`;
        }

        // Sorting
        if (sort === 'novelty') {
            query += ` ORDER BY r.created_at DESC`;
        } else if (sort === 'rating') {
            // Placeholder: avg_rating if we had a ratings table, defaulting to newest for now
             query += ` ORDER BY r.created_at DESC`;
        } else {
             query += ` ORDER BY r.title ASC`;
        }

        const [rows] = await db.query(query, params);

        // Deduplicate in JS if it's the AI History view
        // Keep the latest version of each title
        if (req.query.is_ai_generated) {
            const unique = new Map();
            rows.forEach(r => {
                // If we sort by CreatedAt DESC above, the first one we see is the newest.
                if (!unique.has(r.title)) {
                    unique.set(r.title, r);
                }
            });
            return res.json(Array.from(unique.values()));
        }

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error retrieving recipes' });
    }
});

// GET /api/recipes/:id - Details
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        // Get Recipe Basic Info
        const [recipeRows] = await db.query(`
            SELECT r.*, c.name as category_name 
            FROM recipes r 
            LEFT JOIN categories c ON r.category_id = c.id
            WHERE r.id = ? AND r.user_id = ?
        `, [id, userId]);

        if (recipeRows.length === 0) {
            return res.status(404).json({ error: 'Recipe not found' });
        }
        const recipe = recipeRows[0];

        // Get Ingredients
        const [ingredientRows] = await db.query(`
            SELECT i.name, ri.quantity, ri.unit, ri.amount 
            FROM recipe_ingredients ri
            JOIN ingredients i ON ri.ingredient_id = i.id
            WHERE ri.recipe_id = ?
        `, [id]);
        recipe.ingredients = ingredientRows;

        // Get Nutrition
        const [nutritionRows] = await db.query(`
            SELECT * FROM nutrition WHERE recipe_id = ?
        `, [id]);
        recipe.nutrition = nutritionRows[0] || null;

        res.json(recipe);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error retrieving recipe details' });
    }
});

// DELETE /api/recipes/ai-history - Clear all AI recipes
router.delete('/ai-history', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Because of ON DELETE CASCADE, deleting from recipes is enough
            await connection.query(`DELETE FROM recipes WHERE is_ai_generated = TRUE AND user_id = ?`, [userId]);
            
            await connection.commit();
            res.json({ message: 'AI history cleared successfully' });
        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error("Error clearing history:", err);
        res.status(500).json({ error: 'Server error clearing history' });
    }
});

// DELETE /api/recipes/:id - Delete single recipe
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const [result] = await db.query(`DELETE FROM recipes WHERE id = ? AND user_id = ?`, [id, userId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        res.json({ message: 'Recipe deleted successfully' });
    } catch (err) {
        console.error("Error deleting recipe:", err);
        res.status(500).json({ error: 'Server error deleting recipe' });
    }
});

module.exports = router;
