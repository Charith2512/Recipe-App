const COCKTAIL_API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

async function testDrinks() {
    console.log("Testing getExternalDrinks('')");
    try {
        const res = await fetch(`${COCKTAIL_API_BASE}/search.php?s=`);
        const data = await res.json();
        if (data.drinks) {
            console.log(`Success! Found ${data.drinks.length} drinks.`);
            console.log("First drink:", data.drinks[0].strDrink);
        } else {
            console.log("No drinks found (data.drinks is null/undefined).");
            console.log("Raw Response:", JSON.stringify(data));
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

testDrinks();
