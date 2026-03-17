const express = require('express');
const router = express.Router();
const db = require('../config/db');
const axios = require('axios');
const { verifyToken } = require('../src/auth');

// Helper to format date "YYYY-MM-DD" safely
function formatDateKey(dateStr) {
    if (!dateStr) return 'Unknown Date';
    // If it's a Date object, use local timezone methods
    if (dateStr instanceof Date) {
        const year = dateStr.getFullYear();
        const month = String(dateStr.getMonth() + 1).padStart(2, '0');
        const day = String(dateStr.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    // If it's a string, try extracting YYYY-MM-DD
    if (typeof dateStr === 'string') {
        const match = dateStr.match(/^\d{4}-\d{2}-\d{2}/);
        if (match) return match[0];

        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    }
    return 'Unknown Date';
}

// GET /api/shopping-list - Generate list for date range
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Start and end dates are required' });
        }

        // We will return an array of dates -> array of meal types -> array of recipes -> ingredients
        const dateGroups = new Map();

        // Helper to get or create nested maps
        const getGroupIndices = (dateKey, mealType, recipeTitle) => {
            if (!dateGroups.has(dateKey)) {
                dateGroups.set(dateKey, new Map());
            }
            const typesMap = dateGroups.get(dateKey);

            if (!typesMap.has(mealType)) {
                typesMap.set(mealType, new Map());
            }
            const recipesMap = typesMap.get(mealType);

            if (!recipesMap.has(recipeTitle)) {
                recipesMap.set(recipeTitle, { title: recipeTitle, ingredients: new Map() });
            }
            return recipesMap.get(recipeTitle);
        };

        // 1. Get Local Ingredients grouped by Date, Type and Recipe Title
        const localQuery = `
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
            WHERE mp.user_id = ? AND mp.date BETWEEN ? AND ?
        `;
        const [localRows] = await db.query(localQuery, [userId, start_date, end_date]);

        // Add Local Ingredients to Recipe Groups
        localRows.forEach(row => {
            const dateKey = row.meal_date || formatDateKey(row.meal_date);
            const mealType = row.meal_type || 'Other';
            const title = row.recipe_title || 'Unknown Recipe';

            const group = getGroupIndices(dateKey, mealType, title);
            const key = `${row.name.toLowerCase().trim()}|${row.unit ? row.unit.toLowerCase().trim() : ''}`;

            if (group.ingredients.has(key)) {
                group.ingredients.get(key).multiplier = (group.ingredients.get(key).multiplier || 1) + 1;
            } else {
                group.ingredients.set(key, {
                    name: row.name,
                    quantity: row.quantity,
                    unit: row.unit || '',
                    is_external: false,
                    multiplier: 1
                });
            }
        });

        // 2. Identify External Recipes
        const externalQuery = `
             SELECT DATE_FORMAT(mp.date, '%Y-%m-%d') as meal_date, mp.meal_type, mp.title, mp.recipe_id
             FROM meal_plans mp
             LEFT JOIN recipes r ON mp.recipe_id = r.id
             WHERE mp.user_id = ? AND mp.date BETWEEN ? AND ? AND r.id IS NULL
        `;
        const [externalRows] = await db.query(externalQuery, [userId, start_date, end_date]);

        // 3. Fetch External Ingredients
        for (const row of externalRows) {
            const recipeId = row.recipe_id;
            const title = row.title || 'External Recipe';
            const dateKey = row.meal_date || formatDateKey(row.meal_date);
            const mealType = row.meal_type || 'Other';
            if (!recipeId) continue;

            const group = getGroupIndices(dateKey, mealType, title);

            let externalRecipe = null;
            try {
                // Try TheMealDB first
                const mealRes = await axios.get(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${recipeId}`);
                if (mealRes.data && mealRes.data.meals && mealRes.data.meals.length > 0) {
                    externalRecipe = mealRes.data.meals[0];
                } else {
                    // Try CocktailDB if not found in MealDB
                    const drinkRes = await axios.get(`https://www.thecocktaildb.com/api/json/v1/1/lookup.php?i=${recipeId}`);
                    if (drinkRes.data && drinkRes.data.drinks && drinkRes.data.drinks.length > 0) {
                        externalRecipe = drinkRes.data.drinks[0];
                    }
                }
            } catch (err) {
                console.error(`Error fetching external recipe ${recipeId}:`, err.message);
            }

            if (externalRecipe) {
                for (let i = 1; i <= 20; i++) {
                    const ing = externalRecipe[`strIngredient${i}`];
                    const meas = externalRecipe[`strMeasure${i}`];
                    if (ing && ing.trim()) {
                        const name = ing.trim();
                        // For external, just keep the measure exactly as it is without attempting to SUM numeric chunks
                        const exactMeasure = meas ? meas.trim() : '';

                        const key = `${name.toLowerCase()}|${exactMeasure.toLowerCase()}`;

                        if (group.ingredients.has(key)) {
                            group.ingredients.get(key).multiplier = (group.ingredients.get(key).multiplier || 1) + 1;
                        } else {
                            group.ingredients.set(key, {
                                name: name,
                                unit: exactMeasure,
                                total_amount: 1, // we don't display this for external
                                is_external: true,
                                multiplier: 1
                            });
                        }
                    }
                }
            }
        }

        // 4. Format and Return - Hierarchical
        const finalResponse = Array.from(dateGroups.entries()).map(([dateKey, typesMap]) => {

            const meals = Array.from(typesMap.entries()).map(([mealType, recipesMap]) => {

                const recipes = Array.from(recipesMap.values()).map(group => {
                    const ingArray = Array.from(group.ingredients.values()).map(item => {
                        if (item.is_external) {
                            let displayAmt = item.unit;
                            if (item.multiplier > 1) displayAmt += ` (x${item.multiplier})`;
                            return { name: item.name, display_amount: displayAmt };
                        } else {
                            let displayAmt = item.quantity || item.unit || '';
                            if (item.multiplier > 1) displayAmt += ` (x${item.multiplier})`;
                            return { name: item.name, display_amount: displayAmt.trim() };
                        }
                    }).sort((a, b) => a.name.localeCompare(b.name));

                    return {
                        title: group.title,
                        ingredients: ingArray
                    };
                }).sort((a, b) => a.title.localeCompare(b.title));

                return {
                    type: mealType,
                    recipes: recipes
                };
            });

            // Sort meals by regular order if possible: Breakfast, Lunch, Dinner, Snack
            const order = { 'Breakfast': 1, 'Lunch': 2, 'Dinner': 3, 'Snack': 4 };
            meals.sort((a, b) => (order[a.type] || 5) - (order[b.type] || 5));

            return {
                date: dateKey,
                meals: meals
            };
        }).sort((a, b) => new Date(a.date) - new Date(b.date));

        res.json(finalResponse);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error generating shopping list' });
    }
});

module.exports = router;
