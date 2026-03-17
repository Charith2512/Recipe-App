const COCKTAIL_API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

const categoriesToFind = [
    'Homemade Liqueur',
    'Shake',
    'Cocoa',
    'Other / Unknown'
];

async function findImages() {
    console.log("Finding images for new categories...");
    
    for (const cat of categoriesToFind) {
        try {
            const res = await fetch(`${COCKTAIL_API_BASE}/filter.php?c=${encodeURIComponent(cat)}`);
            const data = await res.json();
            const drinks = data.drinks || [];
            
            if (drinks.length > 0) {
                // Pick a random one or the first one
                const drink = drinks[0];
                console.log(`\nCategory: ${cat}`);
                console.log(`Image: ${drink.strDrinkThumb}`);
                console.log(`Example: ${drink.strDrink}`);
            } else {
                console.log(`\nCategory: ${cat} - No drinks found`);
            }
        } catch (e) {
            console.error(e);
        }
    }
}

findImages();
