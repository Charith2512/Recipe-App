const express = require('express');
const router = express.Router();

// Native fetch is available in Node 18+
// If using older node, might need 'node-fetch', but let's assume valid node version or use dynamic import if needed.
// Given previous errors showed Node v24.12.0, native fetch is available.

const COCKTAIL_API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ family: 4 });

// Shared helper to fetch and pipe response
const proxyFetch = async (res, endpoint, params) => {
    try {
        console.log(`[Proxy] Requesting. Endpoint: ${endpoint}`, params);
        const url = `${COCKTAIL_API_BASE}/${endpoint}`;

        const response = await axios.get(url, {
            params: params,
            timeout: 30000, // 30s timeout
            httpsAgent: agent
        });

        res.json(response.data);
    } catch (error) {
        console.error(`Proxy Error (${endpoint}):`, error.message);
        if (error.response) {
            res.status(error.response.status).json({ error: 'External API Error' });
        } else {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};

// GET /api/drinks/lookup.php?i=12345
router.get('/lookup.php', async (req, res) => {
    await proxyFetch(res, 'lookup.php', req.query);
});

// GET /api/drinks/search.php?s=margarita
router.get('/search.php', async (req, res) => {
    await proxyFetch(res, 'search.php', req.query);
});

// GET /api/drinks/filter.php?c=Cocktail
router.get('/filter.php', async (req, res) => {
    await proxyFetch(res, 'filter.php', req.query);
});

module.exports = router;
