const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../config/db');
const { verifyToken } = require('../src/auth');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Robust JSON Extraction ---
// Gemma 4 models often include verbose "thinking" preamble before the actual JSON.
// This function finds the LAST valid top-level JSON object in the text,
// which is always the actual recipe data (not the echoed prompt structure).
function extractJSON(text) {
    // First, strip markdown code fences if present
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Strategy: Find the last occurrence of a top-level '{' that starts a valid JSON object.
    // We scan backwards from the end of the string.
    let braceDepth = 0;
    let jsonEnd = -1;
    let jsonStart = -1;

    for (let i = text.length - 1; i >= 0; i--) {
        const ch = text[i];
        if (ch === '}') {
            if (jsonEnd === -1) jsonEnd = i;
            braceDepth++;
        } else if (ch === '{') {
            braceDepth--;
            if (braceDepth === 0) {
                jsonStart = i;
                break; // Found the matching opening brace for the last top-level object
            }
        }
    }

    if (jsonStart !== -1 && jsonEnd !== -1) {
        const candidate = text.substring(jsonStart, jsonEnd + 1);
        try {
            return JSON.parse(candidate);
        } catch (e) {
            console.error("extractJSON: Found braces but JSON.parse failed:", e.message);
            console.error("extractJSON: Candidate text (first 500 chars):", candidate.substring(0, 500));
        }
    }

    // Fallback: try to parse the entire text as JSON (in case the model was clean)
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("extractJSON: Fallback parse also failed:", e.message);
    }

    return null;
}

// --- Retry wrapper for transient API errors ---
async function generateWithRetry(model, prompt, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error(`AI API attempt ${attempt + 1} failed:`, error.status, error.statusText);
            if (attempt < maxRetries && (error.status === 500 || error.status === 503)) {
                const delay = (attempt + 1) * 2000; // 2s, 4s
                console.log(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error; // Give up after max retries
            }
        }
    }
}

router.post('/pantry-chef', verifyToken, async (req, res) => {
    const { ingredients } = req.body;
    const userId = req.user.id;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        return res.status(400).json({ error: 'Please provide a list of ingredients.' });
    }

    // Normalize ingredients for deduplication
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
        const model = genAI.getGenerativeModel({ 
            model: "models/gemma-4-31b-it",
            systemInstruction: "You are a professional culinary chef. Always respond strictly in valid JSON format. Do not use markdown blocks. Do not include any text before or after the JSON.",
            generationConfig: { temperature: 0.1 }
        });
        
        const prompt = `Create a single recipe using ONLY these ingredients: ${ingredients.join(', ')}. 
Assume the user has staples like salt, oil, and water.

Title Guidelines: Concise, professional, hotel-style. No generic words like 'Simple' or 'AI'.
JSON Structure:
{
    "title": "Recipe Name",
    "servings": 2,
    "prep_time_minutes": 15,
    "cook_time_minutes": 20,
    "ingredients": [
        {"name": "Ingredient", "quantity": "1 unit", "amount": 1, "unit": "unit"}
    ],
    "instructions": ["Step 1"]
}`;

        const text = await generateWithRetry(model, prompt);
        console.log("Pantry Chef: AI responded, extracting JSON...");
        
        const recipeData = extractJSON(text);
        if (!recipeData || !recipeData.title || !recipeData.instructions) {
            console.error("Pantry Chef: Failed to extract valid recipe from AI response");
            console.error("Raw text (first 300 chars):", text.substring(0, 300));
            connection.release();
            return res.status(500).json({ error: 'AI generated incomplete data. Please try again.' });
        }

        console.log("Pantry Chef: Extracted recipe:", recipeData.title);

        // Database Transaction
        await connection.beginTransaction();

        try {
            // Insert Recipe
            const [recipeResult] = await connection.query(
                `INSERT INTO recipes (title, description, instructions, prep_time_minutes, image_url, is_ai_generated, source_ingredients, user_id) 
                 VALUES (?, ?, ?, ?, ?, TRUE, ?, ?)`,
                [
                    recipeData.title,
                    `A delicious recipe created from your pantry ingredients: ${ingredients.join(', ')}`,
                    JSON.stringify(recipeData.instructions),
                    recipeData.prep_time_minutes || 0,
                    'https://placehold.co/600x400?text=AI+Chef',
                    normalizedIngredients,
                    userId
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

        // 1. Check for existing recipe
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
        const model = genAI.getGenerativeModel({ 
            model: "models/gemma-4-31b-it",
            systemInstruction: "You are a professional culinary chef. Always respond strictly in valid JSON format. Do not use markdown blocks. Do not include any text before or after the JSON.",
            generationConfig: { temperature: 0.1 }
        });
        
        const prompt = `Create an authentic, practical, and delicious recipe for the dish exactly named: "${normalizedName}".
Ensure the ingredients accurately reflect the traditional way to make this dish.

JSON Structure:
{
    "title": "${normalizedName}",
    "servings": 4,
    "prep_time_minutes": 20,
    "cook_time_minutes": 30,
    "ingredients": [
        {"name": "Ingredient Name", "quantity": "1 unit", "amount": 1, "unit": "unit"}
    ],
    "instructions": ["Step 1"]
}`;

        const text = await generateWithRetry(model, prompt);
        console.log("Generate By Name: AI responded, extracting JSON...");

        const recipeData = extractJSON(text);
        if (!recipeData || !recipeData.title || !recipeData.instructions) {
            console.error("Generate By Name: Failed to extract valid recipe from AI response");
            console.error("Raw text (first 300 chars):", text.substring(0, 300));
            connection.release();
            return res.status(500).json({ error: 'Failed to generate a valid recipe. Please try again.' });
        }

        console.log("Generate By Name: Extracted recipe:", recipeData.title);

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

        // 1. Data Lookup — fetch the recipe from DB if we have an ID
        if (recipe_id) {
            const connection = await db.getConnection();
            try {
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
                        servings: r.servings || 4,
                        prep_time_minutes: r.prep_time_minutes,
                        ingredients: ingRows.map(i => `${i.quantity} ${i.unit} ${i.name}`.trim()),
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

        // 2. Build recipe context
        const recipeName = recipeContext.title;
        const ingredientsList = Array.isArray(recipeContext.ingredients) 
            ? recipeContext.ingredients.join(', ') 
            : recipeContext.ingredients;
        const instructionsList = Array.isArray(recipeContext.instructions)
            ? recipeContext.instructions.join('. ')
            : recipeContext.instructions;

        // 3. Use multi-turn chat so the recipe context is a SEPARATE turn from the question.
        console.log("Savor AI Chat — Recipe:", recipeName, "| Question:", user_query);
        const model = genAI.getGenerativeModel({ 
            model: "models/gemma-4-31b-it",
            systemInstruction: "You are a helpful culinary assistant. You MUST wrap your final answer to the user in <ANSWER> and </ANSWER> tags. Provide ONLY the final answer inside those tags in 1-3 friendly sentences. Do not include your reasoning or options inside the tags.",
            generationConfig: { 
                temperature: 0.5,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 512 // Increased to allow room for thinking + tags
            }
        });

        // Turn 1: Give the AI the recipe (as prior conversation history)
        // Turn 2: Ask the user's actual question
        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: `I'm making "${recipeName}". Here are the details:\n\nIngredients: ${ingredientsList}\n\nInstructions: ${instructionsList}` }],
                },
                {
                    role: "model",
                    parts: [{ text: `Got it! I can see you're making ${recipeName}. Feel free to ask me anything about this recipe.` }],
                },
            ],
        });

        const result = await chat.sendMessage(user_query);
        const response = await result.response;
        let text = response.text() || '';

        console.log("Savor AI Chat — Raw response:", text);

        // Extract everything inside <ANSWER>...</ANSWER>
        // Use matchAll and take the LAST match in case the model discusses the tags in its preamble
        let answerText = text;
        const answerMatches = [...text.matchAll(/<ANSWER>([\s\S]*?)<\/ANSWER>/gi)];
        
        if (answerMatches && answerMatches.length > 0) {
            answerText = answerMatches[answerMatches.length - 1][1].trim();
        } else {
            // Fallback: if it didn't use tags, try to take the very last paragraph
            const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
            if (paragraphs.length > 0) {
                answerText = paragraphs[paragraphs.length - 1].trim();
                // Strip leading option markers if they leaked into the last paragraph
                answerText = answerText.replace(/^Option\s*\d+:?\*?\s*/i, '');
            }
        }

        answerText = answerText.trim();
        console.log("Savor AI Chat — Final answer:", answerText);

        res.json({ response: answerText, timestamp: new Date().toISOString() });

    } catch (error) {
        console.error('Savor AI Error:', error);

        if (error.message && error.message.includes('API key')) {
            return res.status(403).json({ error: 'My AI brain is missing a valid API Key. Please check the backend .env file.' });
        }

        res.status(500).json({ error: 'I lost connection to the AI chef. Please try again.' });
    }
});

module.exports = router;

