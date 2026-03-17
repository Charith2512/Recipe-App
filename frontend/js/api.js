const API_BASE = 'https://recipe-app-t6ok.onrender.com/api';
const EXTERNAL_API_BASE = 'https://www.themealdb.com/api/json/v1/1';
const COCKTAIL_API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

function getAuthHeader() {
    const token = sessionStorage.getItem('google_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}
window.getAuthHeader = getAuthHeader;

const api = {
    // --- TheMealDB (Recipes) ---
    async getExternalRecipes(query = '') {
        // If query is present, do a name search (Returns full details)
        if (query) {
            try {
                const res = await fetch(`${EXTERNAL_API_BASE}/search.php?s=${query}`);
                const data = await res.json();
                return data.meals || [];
            } catch (e) {
                console.error("External API Error:", e);
                return [];
            }
        }

        // If query is empty ("All"), fetch diverse popular categories
        // Optimized: Fetch top categories instead of ALL 14 to avoid browser connection limits (max ~6 per domain)
        try {
            const popularCategories = ['Dessert', 'Beef', 'Chicken', 'Vegetarian', 'Seafood', 'Pasta'];

            // Fetch recipes for these categories in parallel
            const promises = popularCategories.map(async (cat) => {
                try {
                    const res = await fetch(`${EXTERNAL_API_BASE}/filter.php?c=${cat}`);
                    const data = await res.json();
                    const meals = data.meals || [];
                    return meals.map(m => ({ ...m, strCategory: cat }));
                } catch (err) {
                    console.error(`Failed to fetch ${cat}`, err);
                    return [];
                }
            });

            const results = await Promise.all(promises);
            const allMeals = results.flat();

            // Shuffle
            for (let i = allMeals.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allMeals[i], allMeals[j]] = [allMeals[j], allMeals[i]];
            }

            return allMeals;

        } catch (e) {
            console.error("External API Error (All):", e);
            return [];
        }
    },

    async getRecipesByCategory(category) {
        try {
            const res = await fetch(`${EXTERNAL_API_BASE}/filter.php?c=${category}`);
            const data = await res.json();
            // Inject category for consistency
            return (data.meals || []).map(m => ({ ...m, strCategory: category }));
        } catch (e) {
            console.error("External Category Error:", e);
            return [];
        }
    },

    async getRecipesByArea(area) {
        try {
            const res = await fetch(`${EXTERNAL_API_BASE}/filter.php?a=${area}`);
            const data = await res.json();
            return (data.meals || []).map(m => ({ ...m, strArea: area }));
        } catch (e) {
            console.error("External Area Error:", e);
            return [];
        }
    },

    async getExternalRecipeDetails(id) {
        try {
            const res = await fetch(`${EXTERNAL_API_BASE}/lookup.php?i=${id}`);
            const data = await res.json();
            return data.meals ? data.meals[0] : null;
        } catch (e) {
            console.error("External Details Error:", e);
            return null;
        }
    },

    // --- TheCocktailDB (Drinks) ---
    async getExternalDrinks(query = '') {
        if (query) {
            try {
                const res = await fetch(`${COCKTAIL_API_BASE}/search.php?s=${query}`);
                const data = await res.json();
                return data.drinks || [];
            } catch (e) {
                console.error("Cocktail API Error:", e);
                return [];
            }
        }

        // If query is empty ("All"), fetch diverse popular categories
        try {
            const popularCategories = ['Cocktail', 'Ordinary_Drink', 'Shake', 'Cocoa', 'Shot', 'Coffee / Tea'];

            const promises = popularCategories.map(async (cat) => {
                try {
                    const res = await fetch(`${COCKTAIL_API_BASE}/filter.php?c=${cat}`);
                    const data = await res.json();
                    const drinks = data.drinks || [];
                    return drinks.map(d => ({ ...d, strCategory: cat }));
                } catch (err) {
                    // console.error(`Failed to fetch drink cat ${cat}`, err);
                    return [];
                }
            });

            const results = await Promise.all(promises);
            const allDrinks = results.flat();

            // Shuffle
            for (let i = allDrinks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allDrinks[i], allDrinks[j]] = [allDrinks[j], allDrinks[i]];
            }

            return allDrinks;

        } catch (e) {
            console.error("Cocktail API Error (All):", e);
            return [];
        }
    },

    async getDrinksByCategory(category) {
        try {
            const res = await fetch(`${COCKTAIL_API_BASE}/filter.php?c=${category}`);
            const data = await res.json();
            return (data.drinks || []).map(d => ({ ...d, strCategory: category }));
        } catch (e) {
            console.error("Cocktail Category Error:", e);
            return [];
        }
    },

    async getDrinksByAlcoholic(type) {
        try {
            const res = await fetch(`${COCKTAIL_API_BASE}/filter.php?a=${type}`);
            const data = await res.json();
            return (data.drinks || []).map(d => ({ ...d, strAlcoholic: type }));
        } catch (e) {
            console.error("Cocktail Alcoholic Error:", e);
            return [];
        }
    },

    async getExternalDrinkDetails(id) {
        console.log("API: fetching drink details for", id);
        if (!id) return null;
        try {
            const url = `${COCKTAIL_API_BASE}/lookup.php?i=${id}`;
            console.log("API: request URL", url);
            const res = await fetch(url);
            console.log("API: response status", res.status);
            const data = await res.json();
            console.log("API: data received", data);
            return data.drinks ? data.drinks[0] : null;
        } catch (e) {
            console.error("Cocktail Details Error:", e);
            return null;
        }
    },

    // --- Local Data (Meal Plans & Shopping List) ---
    async getLocalRecipes(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        const res = await fetch(`${API_BASE}/recipes?${query}`, {
            headers: getAuthHeader()
        });
        return res.json();
    },

    async getRecipeDetails(id) {
        // Kept for backward compatibility or local recipes
        const res = await fetch(`${API_BASE}/recipes/${id}`, {
            headers: getAuthHeader()
        });
        return res.json();
    },

    async getMealPlan(start, end) {
        const res = await fetch(`${API_BASE}/meal-plan?start_date=${start}&end_date=${end}`, {
            headers: getAuthHeader()
        });
        return res.json();
    },

    async updateMealPlan(data) {
        // data: { date, meal_type, recipe_id }
        const res = await fetch(`${API_BASE}/meal-plan`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async getShoppingList(start, end) {
        const res = await fetch(`${API_BASE}/shopping-list?start_date=${start}&end_date=${end}`, {
            headers: getAuthHeader()
        });
        return res.json();
    },

    async generateRecipeByName(name) {
        const res = await fetch(`${API_BASE}/ai/generate-by-name`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({ recipeName: name })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to generate recipe');
        return data;
    }
};
