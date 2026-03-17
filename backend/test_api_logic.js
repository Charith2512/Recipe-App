// Native fetch
// Actually I'll just use native fetch, assuming Node 22 (from user info).

const EXTERNAL_API_BASE = 'https://www.themealdb.com/api/json/v1/1';

async function getExternalRecipes(query = '') {
    // Copied logic from api.js to test it
    console.log("Testing getExternalRecipes with query: '" + query + "'");
    if (query) {
         // ...
    }

    try {
        console.log("Fetching categories...");
        const catRes = await fetch(`${EXTERNAL_API_BASE}/list.php?c=list`);
        const catData = await catRes.json();
        const categories = catData.meals.map(c => c.strCategory);
        console.log("Categories found:", categories.length);

        const promises = categories.map(async (cat) => {
            const res = await fetch(`${EXTERNAL_API_BASE}/filter.php?c=${cat}`);
            const data = await res.json();
            return (data.meals || []).map(m => ({ ...m, strCategory: cat }));
        });

        const results = await Promise.all(promises);
        const allMeals = results.flat();
        console.log("Total meals found:", allMeals.length);
        return allMeals;

    } catch (e) {
        console.error("Error:", e);
        return [];
    }
}

getExternalRecipes('');
