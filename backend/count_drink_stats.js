const COCKTAIL_API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

// Detailed Categories from app.js + 'All' composition from api.js
const STATS_CATEGORIES = [
    { label: 'Cocktail', query: 'Cocktail' },
    { label: 'Shot', query: 'Shot' },
    { label: 'Ordinary Drink', query: 'Ordinary_Drink' },
    { label: 'Punch / Party', query: 'Punch / Party Drink' },
    { label: 'Coffee / Tea', query: 'Coffee / Tea' },
    { label: 'Soft Drink', query: 'Soft Drink' },
    { label: 'Beer', query: 'Beer' }
];

const ALL_CATEGORIES = ['Cocktail', 'Ordinary_Drink', 'Shake', 'Cocoa', 'Shot', 'Coffee / Tea'];

async function getCount(cat) {
    try {
        const res = await fetch(`${COCKTAIL_API_BASE}/filter.php?c=${encodeURIComponent(cat)}`);
        const data = await res.json();
        return data.drinks ? data.drinks.length : 0;
    } catch (e) {
        return 0;
    }
}

async function getAllCount() {
    try {
        const promises = ALL_CATEGORIES.map(async (cat) => {
            const res = await fetch(`${COCKTAIL_API_BASE}/filter.php?c=${encodeURIComponent(cat)}`);
            const data = await res.json();
            return data.drinks || [];
        });
        
        const results = await Promise.all(promises);
        const allDrinks = results.flat();
        
        // Use a Set to count unique IDs to be precise
        const uniqueIds = new Set(allDrinks.map(d => d.idDrink));
        return uniqueIds.size;
    } catch (e) {
        return 0;
    }
}

async function runStats() {
    console.log("--- Drink Statistics ---");
    
    // 1. Specific Categories
    for (const cat of STATS_CATEGORIES) {
        const count = await getCount(cat.query);
        console.log(`${cat.label}: ${count}`);
    }
    
    // 2. 'All' Category (Union)
    const allCount = await getAllCount();
    console.log(`All (Combined): ${allCount}`);
    console.log("------------------------");
}

runStats();
