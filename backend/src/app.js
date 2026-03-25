const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const db = require('../config/db'); // Import DB connection

const path = require('path');
const dns = require('dns');

// Force IPv4 first to avoid IPv6 connection timeouts
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const app = express();
const PORT = process.env.PORT || 5001;

// Test DB Connection immediately
db.query('SELECT 1')
    .then(() => {
        console.log('✅ MySQL Database Connected Successfully!');
    })
    .catch(err => {
        console.error('❌ Database Connection Failed:', err.message);
        process.exit(1); // Exit if DB fails
    });

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname, '../../frontend')));

// Routes
app.get('/api/health', (req, res) => res.status(200).json({ status: 'awake' }));

const recipeRoutes = require('../routes/recipes');
const mealPlanRoutes = require('../routes/mealPlan');
const shoppingListRoutes = require('../routes/shoppingList');
const aiRoutes = require('../routes/ai');
const drinkRoutes = require('../routes/drinks');
const authRoutes = require('../routes/auth');
const favouritesRoutes = require('../routes/favourites');

app.use('/api/recipes', recipeRoutes);
app.use('/api/meal-plan', mealPlanRoutes);
app.use('/api/shopping-list', shoppingListRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/drinks', drinkRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/favourites', favouritesRoutes);

// Catch-all for frontend (if using SPA router, though this is vanilla)
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Frontend accessible at http://localhost:${PORT}`);
});

