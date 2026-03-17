const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY;
console.log(`Checking API Key: ${apiKey ? apiKey.substring(0, 5) + '...' : 'MISSING'}`);

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

async function check() {
    try {
        const result = await model.generateContent("Test");
        console.log("SUCCESS: Key is valid.");
    } catch (error) {
        console.log("FAILURE: Key is invalid.");
        console.log("Error Details:", error.message);
        if (error.response) {
            console.log("API Response:", JSON.stringify(error.response, null, 2));
        }
    }
}

check();
