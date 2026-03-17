const http = require('http');

const data = JSON.stringify({
    ingredients: ['Chicken', 'Rice']
});

const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/ai/pantry-chef',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log('Sending request to AI endpoint...');

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    
    let body = '';
    res.on('data', (chunk) => {
        body += chunk;
    });
    
    res.on('end', () => {
        console.log('Response Body:', body);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
