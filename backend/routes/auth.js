const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const db = require('../config/db');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// POST /api/auth/google
router.post('/google', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        let payload;
        
        // Mock token verification if Client ID isn't set yet (for local dev)
        if (!process.env.GOOGLE_CLIENT_ID) {
            console.warn("GOOGLE_CLIENT_ID not set. Using mock user.");
            payload = {
                sub: 'mock_google_id_123',
                email: 'mock@example.com',
                name: 'Mock User'
            };
        } else {
            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            payload = ticket.getPayload();
        }

        const { sub: googleId, email, name } = payload;

        // Check if user exists
        const [existingUsers] = await db.execute('SELECT * FROM users WHERE google_id = ?', [googleId]);
        let user;

        if (existingUsers.length > 0) {
            user = existingUsers[0];
            // Update name/email in case they changed on Google
            await db.execute('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, user.id]);
        } else {
            // Register new user
            const [result] = await db.execute(
                'INSERT INTO users (google_id, email, name) VALUES (?, ?, ?)',
                [googleId, email, name]
            );
            
            // Get the newly inserted user
            const [newUsers] = await db.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
            user = newUsers[0];
        }

        // Return user data (frontend will store the Google token as the session token)
        res.json({
            message: 'Authentication successful',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                picture: payload.picture
            }
        });
    } catch (error) {
        console.error('Auth Error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

module.exports = router;
