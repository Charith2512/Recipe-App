// Native fetch in Node 18+

const EXTERNAL_API_BASE = 'https://www.themealdb.com/api/json/v1/1';

async function countAllRecipes() {
    console.log('Fetching ALL categories list...');
    try {
        // 1. Get all categories
        const catRes = await fetch(`${EXTERNAL_API_BASE}/list.php?c=list`);
        const catData = await catRes.json();
        const categories = catData.meals.map(c => c.strCategory);
        
        console.log(`Found ${categories.length} categories:`, categories.join(', '));

        // 2. Count recipes in each
        console.log('Fetching counts for each category...');
        const promises = categories.map(async (cat) => {
            const res = await fetch(`${EXTERNAL_API_BASE}/filter.php?c=${cat}`);
            const data = await res.json();
            return (data.meals || []).length;
        });

        const counts = await Promise.all(promises);
        const total = counts.reduce((a, b) => a + b, 0);

        console.log('\n--- Recipe Counts by Category ---');
        categories.forEach((cat, i) => {
            console.log(`${cat}: ${counts[i]}`);
        });
        console.log('---------------------------------');
        console.log(`TOTAL RECIPES IN DB: ${total}`);
        console.log('---------------------------------');

    } catch (e) {
        console.error(e);
    }
}

countAllRecipes();
