const COCKTAIL_API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

async function countAllDrinks() {
    console.log("--- Fetching Full Drink Stats ---");
    try {
        // 1. Get ALL Categories
        const catRes = await fetch(`${COCKTAIL_API_BASE}/list.php?c=list`);
        const catData = await catRes.json();
        const categories = catData.drinks.map(c => c.strCategory);
        
        console.log(`Found ${categories.length} categories:`, categories.join(', '));
        
        let allDrinks = [];
        let categoryStats = {};

        // 2. Fetch drinks for EACH category
        // Serial or parallel? Parallel might hit rate limits, but let's try parallel with chunks or just all if brief. 
        // The API is usually lenient.
        
        const promises = categories.map(async (cat) => {
            try {
                const res = await fetch(`${COCKTAIL_API_BASE}/filter.php?c=${encodeURIComponent(cat)}`);
                const data = await res.json();
                const drinks = data.drinks || [];
                categoryStats[cat] = drinks.length;
                return drinks;
            } catch (e) {
                console.error(`Error fetching ${cat}:`, e.message);
                return [];
            }
        });

        const results = await Promise.all(promises);
        
        // Flatten
        allDrinks = results.flat();
        
        // Unique Count
        const uniqueIds = new Set(allDrinks.map(d => d.idDrink));
        
        console.log("\n--- Breakdown by Category ---");
        // Sort categories by count desc
        const sortedCats = Object.entries(categoryStats).sort(([,a], [,b]) => b - a);
        sortedCats.forEach(([cat, count]) => {
            console.log(`${cat}: ${count}`);
        });
        
        console.log("\n--- Grand Total ---");
        console.log(`Total Unique Drinks Available via API: ${uniqueIds.size}`);
        
    } catch (e) {
        console.error("Fatal Error:", e);
    }
}

countAllDrinks();
