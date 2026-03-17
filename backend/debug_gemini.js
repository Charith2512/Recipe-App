const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listModels() {
    // Basic HTTP request to list models since SDK method might vary
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    console.log("Fetching models from:", url);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log("Available Models:");
        if (data.models) {
            data.models.forEach(m => console.log(`- ${m.name} (${m.supportedGenerationMethods})`));
        } else {
            console.log("No models field in response:", data);
        }
    } catch (e) {
        console.error("Failed to list models:", e.message);
    }
}

listModels();
