const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../config/db');
const { verifyToken } = require('../src/auth');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/pantry-chef', verifyToken, async (req, res) => {
    const { ingredients } = req.body;
    const userId = req.user.id;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        return res.status(400).json({ error: 'Please provide a list of ingredients.' });
    }

    // Normalize ingredients for deduplication
    // 1. Lowercase, trim
    // 2. Sort alphabetically to ensure "Chicken, Rice" == "Rice, Chicken"
    const normalizedIngredients = ingredients
        .map(i => i.trim().toLowerCase())
        .sort()
        .join(',');

    try {
        const connection = await db.getConnection();

        // 1. Check for existing recipe
        const [existing] = await connection.query(
            `SELECT id FROM recipes WHERE source_ingredients = ? AND user_id = ? LIMIT 1`,
            [normalizedIngredients, userId]
        );

        if (existing.length > 0) {
            connection.release();
            return res.json({
                message: 'Recipe retrieved from cache',
                recipeId: existing[0].id
            });
        }

        // 2. No match, Generate New
        console.log("Pantry Chef: Generating new recipe for", ingredients);
        const model = genAI.getGenerativeModel({ model: "gemma-3-27b-it" });

        const prompt = `
            You are a professional chef.
            Create a single recipe using ONLY the following ingredients: ${ingredients.join(', ')}.
            You may assume the user has basic pantry staples like salt, pepper, oil, and water.
            
            IMPORTANT:
            - The title must be CONCISE, PROFESSIONAL, and DESCRIPTIVE.
            - It should sound like a standard item on a hotel or restaurant menu.
            - DO NOT use overly elaborate adjectives like "Royale", "Supreme", "Exotic", "Grand", "5-Star".
            - DO NOT use generic adjectives like "Simple", "Easy", "Quick".
            - DO NOT include "AI" or "Generated".
            - Example Bad Title: "Grand Supreme Chicken Royale" or "Simple Chicken Dish"
            - Example Good Title: "Roasted Chicken and Potatoes" or "Classic Caesar Salad"
            
            Return the response strictly as a single JSON object. Do not include markdown formatting like \`\`\`json.
            
            Use this exact JSON structure:
            {
                "title": "Recipe Title",
                "servings": 2,
                "prep_time_minutes": 15,
                "cook_time_minutes": 20,
                "ingredients": [
                    {"name": "Ingredient Name", "quantity": "1 cup", "amount": 1.0, "unit": "cup"}
                ],
                "instructions": ["Step 1", "Step 2"]
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Clean cleanup markdown if present
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        let recipeData;
        try {
            recipeData = JSON.parse(text);
            
            if (!recipeData.title || !recipeData.instructions) {
                connection.release();
                return res.status(500).json({ error: 'AI generated incomplete data. Please try again.' });
            }
        } catch (e) {
            console.error("AI JSON Parse Error:", e, "\\nRaw Text:", text);
            connection.release();
            return res.status(500).json({ error: 'Failed to generate a valid recipe. The AI response was malformed. Please try again.' });
        }

        // Database Transaction
        await connection.beginTransaction();

        try {
            // Insert Recipe with source_ingredients and user_id
            const [recipeResult] = await connection.query(
                `INSERT INTO recipes (title, description, instructions, prep_time_minutes, image_url, is_ai_generated, source_ingredients, user_id) 
                 VALUES (?, ?, ?, ?, ?, TRUE, ?, ?)`,
                [
                    recipeData.title,
                    `A delicious recipe created from your pantry ingredients: ${ingredients.join(', ')}`,
                    JSON.stringify(recipeData.instructions),
                    recipeData.prep_time_minutes || 0,
                    'https://placehold.co/600x400?text=AI+Chef',
                    normalizedIngredients, // Save the signature
                    userId // Associate with the logged-in user
                ]
            );

            const recipeId = recipeResult.insertId;

            // Insert Ingredients
            for (const ing of recipeData.ingredients) {
                await connection.query(`INSERT IGNORE INTO ingredients (name) VALUES (?)`, [ing.name]);
                const [ingResult] = await connection.query(`SELECT id FROM ingredients WHERE name = ?`, [ing.name]);
                const ingredientId = ingResult[0].id;
                await connection.query(
                    `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, amount, unit) VALUES (?, ?, ?, ?, ?)`,
                    [recipeId, ingredientId, ing.quantity, ing.amount || 0, ing.unit || '']
                );
            }

            await connection.commit();
            res.status(201).json({
                message: 'Recipe generated successfully',
                recipeId: recipeId
            });

        } catch (dbError) {
            console.error("Database Insert Error during Pantry Chef:", dbError);
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Pantry Chef Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/generate-by-name', verifyToken, async (req, res) => {
    const { recipeName } = req.body;
    const userId = req.user.id;

    if (!recipeName || typeof recipeName !== 'string' || recipeName.trim() === '') {
        return res.status(400).json({ error: 'Please provide a valid recipe name.' });
    }

    const normalizedName = recipeName.trim();

    try {
        const connection = await db.getConnection();

        // 1. Check for existing recipe by exactly the same title to avoid duplicate generations
        const [existing] = await connection.query(
            `SELECT id FROM recipes WHERE title = ? AND is_ai_generated = TRUE AND user_id = ? LIMIT 1`,
            [normalizedName, userId]
        );

        if (existing.length > 0) {
            connection.release();
            return res.json({
                message: 'Recipe retrieved from cache',
                recipeId: existing[0].id
            });
        }

        // 2. Generate New
        console.log("Pantry Chef: Generating new recipe by name for", normalizedName);
        const model = genAI.getGenerativeModel({ model: "gemma-3-27b-it" });

        const prompt = `
            You are a professional chef.
            Create an authentic, practical, and delicious recipe for the dish exactly named: "${normalizedName}".
            
            IMPORTANT:
            - The title MUST be exactly "${normalizedName}". Do not add any extra words, translations, or variations to the title.
            - Provide a realistic list of ingredients and step-by-step instructions.
            - Ensure the ingredients accurately reflect the traditional or best-practice way to make this dish.
            
            Return the response strictly as a single JSON object. Do not include markdown formatting like \`\`\`json.
            
            Use this exact JSON structure:
            {
                "title": "Recipe Title",
                "servings": 4,
                "prep_time_minutes": 20,
                "cook_time_minutes": 30,
                "ingredients": [
                    {"name": "Ingredient Name", "quantity": "1 cup", "amount": 1.0, "unit": "cup"}
                ],
                "instructions": ["Step 1", "Step 2"]
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        let recipeData;
        try {
            recipeData = JSON.parse(text);
        } catch (e) {
            console.error("AI JSON Parse Error:", text);
            connection.release();
            return res.status(500).json({ error: 'Failed to generate a valid recipe. Please try again.' });
        }

        if (!recipeData.title || !recipeData.instructions) {
            connection.release();
            return res.status(500).json({ error: 'AI generated incomplete data.' });
        }

        // Database Transaction
        await connection.beginTransaction();

        try {
            const [recipeResult] = await connection.query(
                `INSERT INTO recipes (title, description, instructions, prep_time_minutes, image_url, is_ai_generated, source_ingredients, user_id) 
                 VALUES (?, ?, ?, ?, ?, TRUE, ?, ?)`,
                [
                    normalizedName,
                    `An authentic AI-generated recipe for ${normalizedName}.`,
                    JSON.stringify(recipeData.instructions),
                    recipeData.prep_time_minutes || 0,
                    'https://placehold.co/600x400?text=AI+Chef',
                    `Generated By Name: ${normalizedName}`,
                    userId
                ]
            );

            const recipeId = recipeResult.insertId;

            for (const ing of recipeData.ingredients) {
                await connection.query(`INSERT IGNORE INTO ingredients (name) VALUES (?)`, [ing.name]);
                const [ingResult] = await connection.query(`SELECT id FROM ingredients WHERE name = ?`, [ing.name]);
                const ingredientId = ingResult[0].id;
                await connection.query(
                    `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, amount, unit) VALUES (?, ?, ?, ?, ?)`,
                    [recipeId, ingredientId, ing.quantity, ing.amount || 0, ing.unit || '']
                );
            }

            await connection.commit();
            res.status(201).json({
                message: 'Recipe generated successfully',
                recipeId: recipeId
            });

        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Pantry Chef Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/ai/chat - Savor AI Contextual Chat
router.post('/chat', async (req, res) => {
    const { recipe_id, user_query, history, context } = req.body;

    if (!user_query) {
        return res.status(400).json({ error: 'User query is required.' });
    }

    try {
        let recipeContext = context;

        // 1. Data Lookup Strategy
        // If we didn't receive full context, or if we want to enforce DB truth for local recipes:
        if (recipe_id) {
            const connection = await db.getConnection();
            try {
                // Try fetching from DB
                const [rows] = await connection.query(`SELECT * FROM recipes WHERE id = ?`, [recipe_id]);

                if (rows.length > 0) {
                    const r = rows[0];

                    // Fetch Ingredients
                    const [ingRows] = await connection.query(`
                        SELECT i.name, ri.quantity, ri.unit 
                        FROM recipe_ingredients ri
                        JOIN ingredients i ON ri.ingredient_id = i.id
                        WHERE ri.recipe_id = ?
                    `, [recipe_id]);

                    let instructions = [];
                    try {
                        instructions = JSON.parse(r.instructions);
                    } catch (e) {
                        instructions = [r.instructions];
                    }

                    recipeContext = {
                        title: r.title,
                        servings: r.servings || 4, // Default if missing
                        prep_time_minutes: r.prep_time_minutes,
                        ingredients: ingRows.map(i => `${i.quantity} ${i.unit} ${i.name}`.trim()), // Format as strings for AI
                        instructions: instructions
                    };
                }
            } catch (err) {
                console.error("DB Lookup failed, falling back to provided context:", err);
            } finally {
                connection.release();
            }
        }

        if (!recipeContext) {
            return res.status(404).json({ error: 'Recipe context could not be determined.' });
        }

        // 2. Construct Prompt
        const systemInstruction = `
            You are 'Savor AI', an expert, friendly, and practical culinary assistant.
            Your primary goal is to provide concise, safe, and helpful advice based strictly on the provided recipe data.

            RULES:
            1. Base ALL answers ONLY on the provided recipe details. Do not reference external recipes unless asked for a substitution.
            2. Substitutions: If requested (e.g. 'gluten-free', 'vegan'), suggest safe alternatives, state the ratio (e.g. 1:1), and mention flavor/texture changes.
            3. Quantity: If asked to adjust servings, recalculate ingredient quantities proportionally.
            4. Explanations: Explain techniques (e.g. 'whisking') in simple terms relevant to this recipe.
            5. Safety: Prioritize food safety. Reject unsafe requests politely.
        `;

        const contextBlock = JSON.stringify({
            current_context: recipeContext,
            chat_history: history || []
        }, null, 2);

        const fullPrompt = `
            ${systemInstruction}
            
            RECIPE DATA:
            ${contextBlock}

            USER QUERY:
            ${user_query}
        `;

        // 3. Call Gemini
        console.log("Savor AI: Generating content with context:", recipeContext.title);
        const model = genAI.getGenerativeModel({ model: "gemma-3-27b-it" });
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        res.json({ response: text, timestamp: new Date().toISOString() });

    } catch (error) {
        console.error('Savor AI Error:', error);

        // Improve Error Message for User
        if (error.message && error.message.includes('API key')) { // GoogleGenerativeAI Error often mentions "API key"
            return res.status(403).json({ error: 'My AI brain is missing a valid API Key. Please check the backend .env file.' });
        }

        res.status(500).json({ error: 'I lost connection to the AI chef. Please try again.' });
    }
});

module.exports = router;
