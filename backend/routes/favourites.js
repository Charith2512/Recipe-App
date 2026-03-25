const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken } = require('../src/auth');

// GET all favourites for user
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await db.query(
            'SELECT * FROM favourites WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        res.json(rows);
    } catch (err) {
        console.error("Fetch Favourites Error:", err);
        res.status(500).json({ error: 'Failed to fetch favourites' });
    }
});

// POST add a favourite
router.post('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { item_id, item_type, title, image_url } = req.body;

        if (!item_id || !item_type) {
            return res.status(400).json({ error: 'item_id and item_type are required' });
        }

        // Use INSERT IGNORE to avoid duplicate constraint errors
        await db.query(
            'INSERT IGNORE INTO favourites (user_id, item_id, item_type, title, image_url) VALUES (?, ?, ?, ?, ?)',
            [userId, item_id, item_type, title || null, image_url || null]
        );

        res.status(201).json({ message: 'Added to favourites' });
    } catch (err) {
        console.error("Add Favourite Error:", err);
        res.status(500).json({ error: 'Failed to add favourite' });
    }
});

// DELETE a favourite
router.delete('/:item_id', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { item_id } = req.params;
        const { type } = req.query; // e.g., ?type=recipe or ?type=drink

        if (!type) {
            return res.status(400).json({ error: 'type query parameter is required' });
        }

        await db.query(
            'DELETE FROM favourites WHERE user_id = ? AND item_id = ? AND item_type = ?',
            [userId, item_id, type]
        );

        res.json({ message: 'Removed from favourites' });
    } catch (err) {
        console.error("Delete Favourite Error:", err);
        res.status(500).json({ error: 'Failed to remove favourite' });
    }
});

module.exports = router;
