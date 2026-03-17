const COCKTAIL_API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

async function scrapeAll() {
    console.log("--- Deep Audit: Scrape by Letter (A-Z, 0-9) ---");
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
    let allDrinks = [];
    
    // Serial fetch to be nice to the API
    for (const char of chars) {
        try {
            // console.log(`Scanning '${char}'...`);
            const res = await fetch(`${COCKTAIL_API_BASE}/search.php?f=${char}`);
            const data = await res.json();
            if (data.drinks) {
                allDrinks = allDrinks.concat(data.drinks);
            }
        } catch (e) {
            // ignore
        }
    }
    
    // De-dupe by ID
    const uniqueMap = new Map();
    allDrinks.forEach(d => {
        if (!uniqueMap.has(d.idDrink)) {
            uniqueMap.set(d.idDrink, d);
        }
    });
    
    const uniqueDrinks = Array.from(uniqueMap.values());
    console.log(`\nTotal Unique Drinks Found: ${uniqueDrinks.length}`);
    
    // Count per category
    const catCounts = {};
    uniqueDrinks.forEach(d => {
        const c = d.strCategory || 'Unknown';
        catCounts[c] = (catCounts[c] || 0) + 1;
    });
    
    console.log("\n--- Verified Category Breakdown ---");
    Object.entries(catCounts)
        .sort(([,a], [,b]) => b - a)
        .forEach(([cat, count]) => {
            console.log(`${cat}: ${count}`);
        });
}

scrapeAll();
