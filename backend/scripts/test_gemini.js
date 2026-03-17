const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Since script is in backend/scripts, env is in backend/

const apiKey = process.env.GEMINI_API_KEY;
console.log("Testing Key:", apiKey ? "Present" : "Missing");

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    // For listing models, we can't use the SDK directly for listing in all versions easily, 
    // but let's try a simple generation with a known older model 'gemini-pro' first 
    // to see if at least THAT works.
    // Actually, SDK doesn't expose listModels directly in older versions? 
    // Let's just try to generate with 'gemini-1.5-flash' and print detailed error.
    
    console.log("Attempting `gemini-1.5-flash`...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hello");
    console.log("Success with gemini-1.5-flash:", result.response.text());
  } catch (error) {
    console.error("Failed with gemini-1.5-flash:", error.message);
    
    try {
        console.log("Attempting `gemini-pro`...");
        const model2 = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result2 = await model2.generateContent("Hello");
        console.log("Success with gemini-pro:", result2.response.text());
    } catch(e2) {
        console.error("Failed with gemini-pro:", e2.message);
    }
  }
}

listModels();
