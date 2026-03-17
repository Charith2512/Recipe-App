const BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

async function findImages() {
    const cats = ['Coffee / Tea', 'Soft Drink', 'Beer'];
    
    for (const c of cats) {
        try {
            const res = await fetch(`${BASE}/filter.php?c=${encodeURIComponent(c)}`);
            const data = await res.json();
            if (data.drinks && data.drinks.length > 0) {
                // Pick the first one or a random one
                const drink = data.drinks[0];
                console.log(`Category: ${c}`);
                console.log(`Drink: ${drink.strDrink}`);
                console.log(`Img: ${drink.strDrinkThumb}`);
                console.log('---');
            } else {
                console.log(`No drinks for ${c}`);
            }
        } catch (e) {
            console.error(e);
        }
    }
}

findImages();
