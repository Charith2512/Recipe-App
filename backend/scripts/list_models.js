const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error("API Error:", json.error.message);
            } else if (json.models) {
                console.log("Available Models:");
                json.models.forEach(m => console.log(`- ${m.name} (${m.displayName})`));
            } else {
                console.log("No models found or unexpected format:", data);
            }
        } catch (e) {
            console.error("Parse Error:", e.message);
        }
    });
}).on('error', (e) => {
    console.error("Request Error:", e.message);
});
