const state = {
    view: 'recipes', // recipes, planner, shopping
    filters: {},
    currentWeekStart: new Date(), // Defaults to today/start of week
    recipesCache: [],
    pantryIngredients: [],
    favourites: [],
    user: null // Will hold the logged in user info
};

// --- Authentication Logic ---
window.handleCredentialResponse = async (response) => {
    try {
        const res = await fetch(`${API_BASE}/auth/google`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: response.credential })
        });
        
        const data = await res.json();
        
        if (res.ok && data.user) {
            // Save token to session storage (cleared on browser close)
            sessionStorage.setItem('google_token', response.credential);
            sessionStorage.setItem('user_info', JSON.stringify(data.user));
            
            // Clean up old persistent storage if it exists
            localStorage.removeItem('google_token');
            localStorage.removeItem('user_info');
            
            updateLoginUI(data.user);
            showToast(`Welcome, ${data.user.name.split(' ')[0]}!`, 'success');
            
            // Reload user specific data
            state.favourites = await api.getFavourites();
            if (state.view === 'planner') loadPlanner();
            if (state.view === 'shopping') loadShoppingList();
            if (state.view === 'pantry') loadPantry();
        } else {
            showToast("Login failed.", 'error');
        }
    } catch (e) {
        console.error("Auth Error:", e);
        showToast("Error during login.", 'error');
    }
};

function updateLoginUI(user) {
    const btnContainer = document.querySelector('.g_id_signin');
    const userInfo = document.getElementById('user-info');
    
    if (user) {
        state.user = user;
        if (btnContainer) btnContainer.style.display = 'none';
        if (userInfo) {
            userInfo.style.display = 'flex';
            userInfo.classList.remove('hidden');
            document.getElementById('user-avatar').src = user.picture || 'https://placehold.co/35?text=U';
            document.getElementById('user-name').innerText = user.name;
        }
    } else {
        state.user = null;
        if (btnContainer) btnContainer.style.display = 'block';
        if (userInfo) {
            userInfo.style.display = 'none';
            userInfo.classList.add('hidden');
        }
    }
}

window.handleLogout = function handleLogout(isTimeout = false) {
    sessionStorage.removeItem('google_token');
    sessionStorage.removeItem('user_info');
    localStorage.removeItem('google_token'); // Cleanup legacy
    localStorage.removeItem('user_info');
    updateLoginUI(null);
    
    if (isTimeout === true) {
        showCustomConfirm(
            "Session Expired", 
            "Your secure session has timed out. Please sign in again with Google to continue.", 
            () => {}, 
            "Okay", 
            "primary"
        );
    } else {
        showToast("Logged out successfully.", 'info');
    }
    
    // Switch away from user data views
    if (['planner', 'shopping', 'pantry', 'favourites'].includes(state.view)) {
        switchView('recipes');
    }
}

async function checkStoredAuth() {
    // First clear old localStorage to enforce new session rules
    localStorage.removeItem('google_token');
    localStorage.removeItem('user_info');

    const storedStr = sessionStorage.getItem('user_info');
    if (storedStr) {
        try {
            const user = JSON.parse(storedStr);
            updateLoginUI(user);
            state.favourites = await api.getFavourites();
        } catch (e) {
            sessionStorage.removeItem('user_info');
        }
    }
}

// Utils
function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
    return new Date(d.setDate(diff));
}

function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function showCustomConfirm(title, message, onConfirm, confirmText = 'Confirm', variant = 'primary') {
    const modal = document.getElementById('confirmation-modal');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    if (!modal || !titleEl || !msgEl || !confirmBtn || !cancelBtn) {
        if (confirm(message)) onConfirm();
        return;
    }

    titleEl.innerText = title;
    msgEl.innerText = message;
    confirmBtn.innerText = confirmText;

    if (variant === 'danger') {
        confirmBtn.style.background = '#d32f2f';
        confirmBtn.style.borderColor = '#d32f2f';
    } else {
        confirmBtn.style.background = 'var(--primary-color)';
        confirmBtn.style.borderColor = 'var(--primary-color)';
    }

    modal.style.display = 'flex';
    modal.classList.remove('hidden');

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.onclick = () => {
        modal.style.display = 'none';
        modal.classList.add('hidden');
        onConfirm();
    };

    cancelBtn.onclick = () => {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    };

    modal.onclick = (e) => { if (e.target === modal) { modal.style.display = 'none'; modal.classList.add('hidden'); } };
}

function formatRecipeText(text) {
    if (!text) return '';
    // Replace **text** with <strong>text</strong>
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

// DOM Elements
// DOM Elements
const views = {
    recipes: document.getElementById('view-recipes'),
    drinks: document.getElementById('view-drinks'),
    planner: document.getElementById('view-planner'),
    shopping: document.getElementById('view-shopping'),
    recipeDetails: document.getElementById('view-recipe-details'),
    drinkDetails: document.getElementById('view-drink-details'),
    tagResults: document.getElementById('view-tag-results'),
    pantry: document.getElementById('view-pantry'),
    favourites: document.getElementById('view-favourites')
};

const navLinks = {
    recipes: document.getElementById('link-view-recipes'),
    drinks: document.getElementById('link-view-drinks'),
    planner: document.getElementById('link-view-planner'),
    shopping: document.getElementById('link-view-shopping'),
    pantry: document.getElementById('link-view-pantry'),
    favourites: document.getElementById('link-view-favourites')
};

// const modal = document.getElementById('recipe-details-modal');
// const modalContent = document.getElementById('modal-content');
// const closeModalBtn = document.getElementById('close-modal');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    state.currentWeekStart = getStartOfWeek(new Date());

    // Navigation
    Object.keys(navLinks).forEach(key => {
        if (!navLinks[key]) return; // Guard against missing elements
        navLinks[key].addEventListener('click', (e) => {
            e.preventDefault();
            switchView(key);
        });
    });

    // Recipes Listeners
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) searchBtn.addEventListener('click', loadRecipes);

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(loadRecipes, 500));
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') loadRecipes();
        });
    }

    const drinkSearchBtn = document.getElementById('drink-search-btn');
    if (drinkSearchBtn) drinkSearchBtn.addEventListener('click', loadDrinks);

    const drinkSearchInput = document.getElementById('drink-search-input');
    if (drinkSearchInput) {
        drinkSearchInput.addEventListener('input', debounce(loadDrinks, 500));
        drinkSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') loadDrinks();
        });
    }

    // Planner Listeners
    document.getElementById('prev-week').addEventListener('click', () => changeWeek(-7));
    document.getElementById('next-week').addEventListener('click', () => changeWeek(7));

    // Shopping List Listeners
    const shopPrevBtn = document.getElementById('shopping-prev-week');
    if (shopPrevBtn) shopPrevBtn.addEventListener('click', () => changeWeek(-7));
    const shopNextBtn = document.getElementById('shopping-next-week');
    if (shopNextBtn) shopNextBtn.addEventListener('click', () => changeWeek(7));

    // Meal Selector Logic Listeners
    const closeSelectorBtn = document.getElementById('close-meal-selector-btn');
    if (closeSelectorBtn) {
        closeSelectorBtn.addEventListener('click', closeMealSelector);
    }

    const selPrevBtn = document.getElementById('selector-prev-week');
    if (selPrevBtn) selPrevBtn.addEventListener('click', () => { state.currentWeekStart = addDays(state.currentWeekStart, -7); renderMealSelector(); });

    const selNextBtn = document.getElementById('selector-next-week');
    if (selNextBtn) selNextBtn.addEventListener('click', () => { state.currentWeekStart = addDays(state.currentWeekStart, 7); renderMealSelector(); });

    // Load Initial Data
    checkStoredAuth();
    
    // Auth Listeners
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    
    renderCategories();
    loadRecipes();

    renderDrinkCategories();
    loadDrinks();

    // --- History / Navigation Handling ---

    // Set initial state
    history.replaceState({ view: 'recipes' }, '', '#recipes');

    window.addEventListener('popstate', (event) => {
        const state = event.state;
        if (!state) return;

        if (state.view === 'recipeDetails' && state.id) {
            openRecipe(state.id, state.fromView || 'recipes', false); // Restoring from history
        } else if (state.view === 'drinkDetails' && state.id) {
            openDrink(state.id, false);
        } else {
            switchView(state.view, false);
        }
    });

    setupPantryListeners();
});

// --- Categories Logic (Recipes) ---
// ... (Existing categories array and functions remain effectively the same, just referenced here) ...
// Sorted by recipe count as requested
const categories = [
    { label: 'All', type: 'all', img: 'https://www.themealdb.com/images/ingredients/Fresh%20Basil.png' },
    { label: 'Dessert', type: 'cat', value: 'Dessert', img: 'https://www.themealdb.com/images/category/Dessert.png' },
    { label: 'Beef', type: 'cat', value: 'Beef', img: 'https://www.themealdb.com/images/category/Beef.png' },
    { label: 'Vegetarian', type: 'cat', value: 'Vegetarian', img: 'https://www.themealdb.com/images/category/Vegetarian.png' },
    { label: 'Seafood', type: 'cat', value: 'Seafood', img: 'https://www.themealdb.com/images/category/Seafood.png' },
    { label: 'Chicken', type: 'cat', value: 'Chicken', img: 'https://www.themealdb.com/images/category/Chicken.png' },
    { label: 'Pork', type: 'cat', value: 'Pork', img: 'https://www.themealdb.com/images/category/Pork.png' },
    { label: 'Side', type: 'cat', value: 'Side', img: 'https://www.themealdb.com/images/category/Side.png' },
    { label: 'Lamb', type: 'cat', value: 'Lamb', img: 'https://www.themealdb.com/images/category/Lamb.png' },
    { label: 'Breakfast', type: 'cat', value: 'Breakfast', img: 'https://www.themealdb.com/images/category/Breakfast.png' },
    { label: 'Pasta', type: 'cat', value: 'Pasta', img: 'https://www.themealdb.com/images/category/Pasta.png' },
    { label: 'Vegan', type: 'cat', value: 'Vegan', img: 'https://www.themealdb.com/images/category/Vegan.png' },
    { label: 'Starter', type: 'cat', value: 'Starter', img: 'https://www.themealdb.com/images/category/Starter.png' },
    { label: 'Goat', type: 'cat', value: 'Goat', img: 'https://www.themealdb.com/images/category/Goat.png' },
    { label: 'Miscellaneous', type: 'cat', value: 'Miscellaneous', img: 'https://www.themealdb.com/images/category/Miscellaneous.png' }
];

let activeCategoryIndex = 0;

function renderCategories() {
    const container = document.getElementById('category-scroll-container');
    container.innerHTML = categories.map((cat, index) => `
        <div class="category-item ${index === activeCategoryIndex ? 'active' : ''}" onclick="selectCategory(${index})">
            <div class="cat-img-wrapper">
                <img src="${cat.img}" alt="${cat.label}">
            </div>
            <span>${cat.label}</span>
        </div>
    `).join('');
}

function selectCategory(index) {
    activeCategoryIndex = index;
    renderCategories();
    document.getElementById('search-input').value = '';
    loadRecipes();
}

// --- Categories Logic (Drinks) ---
const drinkCategories = [
    { label: 'All', value: '', img: 'https://www.thecocktaildb.com/images/ingredients/Ice.png' },
    { label: 'Ordinary Drink', value: 'Ordinary_Drink', img: 'https://www.thecocktaildb.com/images/media/drink/rrtssw1472668972.jpg' },
    { label: 'Cocktail', value: 'Cocktail', img: 'https://www.thecocktaildb.com/images/media/drink/5noda61589575158.jpg' },
    { label: 'Shot', value: 'Shot', img: 'https://www.thecocktaildb.com/images/media/drink/3pylqc1504370988.jpg' },
    { label: 'Punch / Party', value: 'Punch / Party Drink', img: 'https://www.thecocktaildb.com/images/media/drink/b3n0ge1503565473.jpg' },
    { label: 'Other', value: 'Other / Unknown', img: 'https://www.thecocktaildb.com/images/media/drink/tqxyxx1472719737.jpg' },
    { label: 'Coffee / Tea', value: 'Coffee / Tea', img: 'https://www.thecocktaildb.com/images/media/drink/vyrurp1472667777.jpg' },
    { label: 'Shake', value: 'Shake', img: 'https://www.thecocktaildb.com/images/media/drink/rvwrvv1468877323.jpg' },
    { label: 'Beer', value: 'Beer', img: 'https://www.thecocktaildb.com/images/media/drink/xxyywq1454511117.jpg' },
    { label: 'Soft Drink', value: 'Soft Drink', img: 'https://www.thecocktaildb.com/images/media/drink/qxrvqw1472718959.jpg' },
    { label: 'Liqueur', value: 'Homemade Liqueur', img: 'https://www.thecocktaildb.com/images/media/drink/uxxtrt1472667197.jpg' },
    { label: 'Cocoa', value: 'Cocoa', img: 'https://www.thecocktaildb.com/images/media/drink/3nbu4a1487603196.jpg' }
];

let activeDrinkCategoryIndex = 0;

function renderDrinkCategories() {
    const container = document.getElementById('drink-category-scroll-container');
    container.innerHTML = drinkCategories.map((cat, index) => `
        <div class="category-item ${index === activeDrinkCategoryIndex ? 'active' : ''}" onclick="selectDrinkCategory(${index})">
            <div class="cat-img-wrapper">
                <img src="${cat.img}" alt="${cat.label}">
            </div>
            <span>${cat.label}</span>
        </div>
    `).join('');
}

function selectDrinkCategory(index) {
    activeDrinkCategoryIndex = index;
    renderDrinkCategories();
    document.getElementById('drink-search-input').value = '';
    loadDrinks();
}




window.toggleFavourite = async function(btnNode, id, type, title, image_url) {
    if (!state.user) {
        showToast("Please sign in to save favourites.", 'error');
        return;
    }
    const isCurrentlyActive = btnNode.classList.contains('active');
    btnNode.classList.toggle('active');
    document.querySelectorAll('.fav-btn[data-id="'+id+'"]').forEach(el => {
        el.classList.toggle('active', !isCurrentlyActive);
    });

    try {
        if (isCurrentlyActive) {
            state.favourites = state.favourites.filter(f => String(f.item_id) !== String(id));
            await api.removeFavourite(id, type);
            if (state.view === 'favourites') loadFavourites();
        } else {
            state.favourites.push({ item_id: id, item_type: type, title, image_url });
            await api.addFavourite(id, type, title, image_url);
        }
    } catch (e) {
        btnNode.classList.toggle('active');
        document.querySelectorAll('.fav-btn[data-id="'+id+'"]').forEach(el => {
            el.classList.toggle('active', isCurrentlyActive);
        });
        showToast("Failed to update favourite.", 'error');
    }
};

async function loadFavourites() {
    const list = document.getElementById('favourites-list');
    if (!list) return;
    
    if (!state.user) {
        list.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">Please sign in to view your favourites.</div>';
        return;
    }

    // Refresh from backend just in case
    state.favourites = await api.getFavourites();
    
    if (state.favourites.length === 0) {
        list.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">No favourites yet. Start browsing to add some!</div>';
        return;
    }

    list.innerHTML = '';
    state.favourites.forEach(f => {
        const card = document.createElement('div');
        card.className = 'card recipe-card fade-in';
        card.onclick = () => f.item_type === 'drink' ? openDrink(f.item_id) : openRecipe(f.item_id);
        
        const safeTitle = (f.title || '').replace(/'/g, "\\'");
        card.innerHTML = `
            <button class="fav-btn active" data-id="${f.item_id}" onclick="event.stopPropagation(); toggleFavourite(event.currentTarget, '${f.item_id}', '${f.item_type}', '${safeTitle}', '${f.image_url}')">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
            
            <div class="card-img-container">
                <img src="${f.image_url || 'https://placehold.co/600x400?text=No+Image'}" loading="lazy">
            </div>
            <div class="card-body">
                <h3>${f.title || 'Unknown Item'}</h3>
                <span class="badge" style="width:fit-content; margin-top:0.5rem;">${f.item_type === 'drink' ? 'Drink' : 'Recipe'}</span>
            </div>
        `;
        list.appendChild(card);
    });
}

function switchView(viewName, addToHistory = true, targetNavOverride = null) {
    // 1. Authentication Guard for Protected Views
    const protectedViews = ['pantry', 'planner', 'shopping', 'favourites'];
    if (protectedViews.includes(viewName) && !state.user) {
        let featureName = viewName.charAt(0).toUpperCase() + viewName.slice(1);
        if (viewName === 'pantry') featureName = 'Pantry Chef AI';
        if (viewName === 'shopping') featureName = 'Shopping List';
        if (viewName === 'planner') featureName = 'Meal Planner';
        
        showToast(`Please sign in to use the ${featureName}.`, 'error');
        viewName = 'recipes'; // Redirect back to public view
        targetNavOverride = 'recipes';
    }

    // Update State
    state.view = viewName;

    // Update UI
    Object.values(views).forEach(el => el && el.classList.add('hidden')); // Guard
    if (views[viewName]) views[viewName].classList.remove('hidden');

    // Update Nav Active State
    Object.values(navLinks).forEach(el => el && el.classList.remove('active'));

    // Determine which nav link to highlight
    let activeKey = targetNavOverride || viewName;

    // Fallback logic for details views if no override provided
    if (!targetNavOverride) {
        if (viewName === 'recipeDetails') {
            activeKey = 'recipes'; // Default to recipes if not specified (e.g. from history without context)
        } else if (viewName === 'drinkDetails') {
            activeKey = 'drinks';
        }
    }

    if (navLinks[activeKey]) {
        navLinks[activeKey].classList.add('active');
    }

    // Only push state for top-level views here. Detail views handle their own pushState.
    if (addToHistory) {
        if (['recipes', 'drinks', 'planner', 'shopping', 'pantry'].includes(viewName)) {
            history.pushState({ view: viewName }, '', `#${viewName}`);
        }
    }

    // Trigger Loads
    if (viewName === 'planner') loadPlanner();
    if (viewName === 'shopping') loadShoppingList();
    if (viewName === 'pantry') loadPantry();
    if (viewName === 'favourites') loadFavourites();
}

async function loadShoppingList() {
    if (!state.user) {
        showToast("Please sign in to view your Shopping List.", 'error');
        switchView('recipes');
        return;
    }

    const listContainer = document.getElementById('shopping-list-container');
    if (!listContainer) return;
    
    listContainer.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';

    try {
        const start = state.currentWeekStart || new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + 6);

        const label = document.getElementById('shopping-current-week-label');
        if (label) {
            label.innerText = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
        }

        const pad = (n) => n < 10 ? '0' + n : n;
        const startStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
        const endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;

        const data = await api.getShoppingList(startStr, endStr);

        if (data.error) {
            listContainer.innerHTML = `<p style="text-align:center; color:#d32f2f;">${data.error}. Please log out and back in.</p>`;
            return;
        }

        if (!data || data.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; color:#666;">No items found for this week. Add recipes to your meal plan first!</p>';
            return;
        }

        let html = '';
        data.forEach(day => {
            const dateObj = new Date(day.date);
            const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
            
            html += `<div style="margin-bottom: 2rem; background: white; padding: 1.5rem; border-radius: 12px; box-shadow: var(--shadow-md);">
                        <h3 style="color: var(--primary-color); border-bottom: 2px solid #eee; padding-bottom: 0.5rem; margin-bottom: 1rem;">${dateStr}</h3>`;
            
            day.meals.forEach(meal => {
                html += `<div style="margin-bottom: 1.5rem;">
                            <h4 style="color: var(--text-main); margin-bottom: 0.5rem;">${meal.type}</h4>`;
                
                meal.recipes.forEach(recipe => {
                    html += `<div style="margin-left: 1rem; margin-bottom: 1rem;">
                                <strong style="color: #555;">${recipe.title}</strong>
                                <ul style="margin-top: 0.5rem; list-style-type: none; padding-left: 0;">`;
                    
                    recipe.ingredients.forEach(ing => {
                        html += `<li style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px dashed #eee;">
                                    <span>${ing.name}</span>
                                    <span style="color: var(--text-muted); font-weight: 500;">${ing.display_amount}</span>
                                 </li>`;
                    });
                    
                    html += `   </ul>
                             </div>`;
                });
                html += `</div>`;
            });
            html += `</div>`;
        });

        listContainer.innerHTML = html;

    } catch (err) {
        console.error("Error loading shopping list:", err);
        if (err.message === 'SESSION_EXPIRED') return;
        listContainer.innerHTML = '<p style="text-align:center; color:#d32f2f;">Failed to load your shopping list.</p>';
    }
}


function loadPantry() {
    if (!state.user) {
        showToast("Please sign in to use the Pantry Chef.", 'error');
        switchView('recipes');
        return;
    }

    state.pantryIngredients = [];
    const ingInput = document.getElementById('pantry-ingredient-input');
    const nameInput = document.getElementById('pantry-recipe-name-input');
    if (ingInput) ingInput.value = '';
    if (nameInput) nameInput.value = '';

    // Reset Tabs
    document.getElementById('pantry-mode-ingredients')?.classList.remove('hidden');
    document.getElementById('pantry-mode-name')?.classList.add('hidden');

    const tabIngs = document.getElementById('tab-by-ingredients');
    const tabName = document.getElementById('tab-by-name');
    if (tabIngs) tabIngs.className = 'btn btn-primary';
    if (tabName) tabName.className = 'btn btn-outline';

    const loading = document.getElementById('pantry-loading');
    if (loading) loading.classList.add('hidden');

    const generateBtn = document.getElementById('generate-recipe-btn');
    if (generateBtn) generateBtn.disabled = false;

    const generateNameBtn = document.getElementById('generate-by-name-btn');
    if (generateNameBtn) generateNameBtn.disabled = false;

    renderPantryTags();
    loadAIHistory();
}

function renderPantryTags() {
    const container = document.getElementById('pantry-tags-container');
    if (!container) return;
    container.innerHTML = state.pantryIngredients.map(ing => `
        <div class="pantry-tag">
            ${ing}
            <button onclick="removePantryIngredient('${ing}')">×</button>
        </div>
    `).join('');
}

window.removePantryIngredient = function (ing) {
    state.pantryIngredients = state.pantryIngredients.filter(i => i !== ing);
    renderPantryTags();
};

function setupPantryListeners() {
    // Tab Switching
    document.getElementById('tab-by-ingredients')?.addEventListener('click', () => {
        document.getElementById('pantry-mode-ingredients').classList.remove('hidden');
        document.getElementById('pantry-mode-name').classList.add('hidden');
        document.getElementById('tab-by-ingredients').className = 'btn btn-primary';
        document.getElementById('tab-by-name').className = 'btn btn-outline';
    });

    document.getElementById('tab-by-name')?.addEventListener('click', () => {
        document.getElementById('pantry-mode-ingredients').classList.add('hidden');
        document.getElementById('pantry-mode-name').classList.remove('hidden');
        document.getElementById('tab-by-ingredients').className = 'btn btn-outline';
        document.getElementById('tab-by-name').className = 'btn btn-primary';
    });

    // By Ingredients
    const addIngBtn = document.getElementById('add-ingredient-btn');
    const ingInput = document.getElementById('pantry-ingredient-input');

    const addIngredient = () => {
        const val = ingInput?.value.trim();
        if (val && !state.pantryIngredients.includes(val)) {
            state.pantryIngredients.push(val);
            renderPantryTags();
            ingInput.value = '';
        }
    };

    addIngBtn?.addEventListener('click', addIngredient);
    ingInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') addIngredient(); });

    document.getElementById('generate-recipe-btn')?.addEventListener('click', async () => {
        if (state.pantryIngredients.length === 0) {
            alert('Please add at least one ingredient.');
            return;
        }

        const btn = document.getElementById('generate-recipe-btn');
        const loading = document.getElementById('pantry-loading');
        btn.disabled = true;
        loading.classList.remove('hidden');

        try {
            const res = await fetch(`${API_BASE}/ai/pantry-chef`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify({ ingredients: state.pantryIngredients })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to generate recipe');

            await openRecipe(data.recipeId, 'pantry');
            loadAIHistory();
        } catch (err) {
            alert(err.message);
        } finally {
            btn.disabled = false;
            loading.classList.add('hidden');
        }
    });

    // By Name
    const recipeNameInput = document.getElementById('pantry-recipe-name-input');
    const generateByNameBtn = document.getElementById('generate-by-name-btn');

    const generateByName = async () => {
        const val = recipeNameInput?.value.trim();
        if (!val) {
            alert('Please enter a recipe name (e.g., Chicken Biryani).');
            return;
        }

        const loading = document.getElementById('pantry-loading');
        generateByNameBtn.disabled = true;
        loading.classList.remove('hidden');

        try {
            const data = await api.generateRecipeByName(val);
            await openRecipe(data.recipeId, 'pantry');
            recipeNameInput.value = '';
            loadAIHistory();
        } catch (err) {
            alert(err.message);
        } finally {
            generateByNameBtn.disabled = false;
            loading.classList.add('hidden');
        }
    };

    generateByNameBtn?.addEventListener('click', generateByName);
    recipeNameInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') generateByName(); });

    // AI History Clear - Handle both modes
    document.getElementById('clear-history-btn')?.addEventListener('click', () => {
        showCustomConfirm(
            'Delete All History?',
            'Are you sure you want to delete ALL your AI creations? This action cannot be undone.',
            async () => {
                try {
                    const res = await fetch(`${API_BASE}/recipes/clear-ai`, { 
                        method: 'DELETE',
                        headers: getAuthHeader()
                    });
                    if (!res.ok) throw new Error('Failed to clear history');
                    state.pantryIngredients = [];
                    renderPantryTags();
                    loadAIHistory();
                    showToast('AI History cleared successfully', 'success');

                    // Re-exit edit mode
                    if (isHistoryEditMode) toggleHistoryEditMode(false);
                } catch (err) {
                    console.error(err);
                    showToast('Error clearing history.', 'error');
                }
            },
            'Delete All',
            'danger'
        );
    });
}

let isHistoryEditMode = false;

let aiHistoryFilter = 'all'; // 'all', 'by-ingredients', 'by-name'

async function loadAIHistory() {
    const list = document.getElementById('ai-history-grid');
    const headerSection = document.getElementById('ai-history-section');
    if (!list || !headerSection) return;

    // Update Header UI based on Edit Mode
    const headerContainer = headerSection.querySelector('div'); // The flex container
    if (headerContainer) {
        if (isHistoryEditMode) {
            headerContainer.innerHTML = `
                <h2 style="font-size: 2rem; color: var(--primary-color); margin: 0;">Manage History</h2>
                <div style="display: flex; gap: 1rem;">
                    <button id="delete-all-btn" class="btn btn-outline" style="color: #d32f2f; border-color: #d32f2f;">Delete All</button>
                    <button id="done-history-btn" class="btn btn-primary">Done</button>
                </div>
            `;
            document.getElementById('done-history-btn').onclick = () => toggleHistoryEditMode(false);
            document.getElementById('delete-all-btn').onclick = confirmDeleteAll;
        } else {
            headerContainer.innerHTML = `
                <h2 style="font-size: 2rem; color: var(--primary-color); margin: 0;">Your AI Creations</h2>
                <button id="manage-history-btn" class="btn btn-outline">Manage History</button>
            `;
            document.getElementById('manage-history-btn').onclick = () => toggleHistoryEditMode(true);
        }
    }

    // Filter Buttons (render below the header)
    let filterBar = document.getElementById('ai-history-filter-bar');
    if (!filterBar) {
        filterBar = document.createElement('div');
        filterBar.id = 'ai-history-filter-bar';
        filterBar.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;';
        // Insert filter bar before the grid
        list.parentNode.insertBefore(filterBar, list);
    }
    filterBar.innerHTML = `
        <button class="btn ${aiHistoryFilter === 'all' ? 'btn-primary' : 'btn-outline'}" 
                onclick="setAIHistoryFilter('all')" style="padding: 0.5rem 1.2rem; border-radius: 20px; font-size: 0.85rem;">
            🍽️ All
        </button>
        <button class="btn ${aiHistoryFilter === 'by-ingredients' ? 'btn-primary' : 'btn-outline'}" 
                onclick="setAIHistoryFilter('by-ingredients')" style="padding: 0.5rem 1.2rem; border-radius: 20px; font-size: 0.85rem;">
            🥕 By Ingredients
        </button>
        <button class="btn ${aiHistoryFilter === 'by-name' ? 'btn-primary' : 'btn-outline'}" 
                onclick="setAIHistoryFilter('by-name')" style="padding: 0.5rem 1.2rem; border-radius: 20px; font-size: 0.85rem;">
            📝 By Name
        </button>
    `;

    // Fetch recipes
    try {
        if (!state.user) {
            list.innerHTML = '<p style="grid-column: 1/-1; text-align: left; color: #888;">Please sign in to view your AI recipes.</p>';
            filterBar.style.display = 'none';
            if (isHistoryEditMode) toggleHistoryEditMode(false);
            return;
        }

        filterBar.style.display = 'flex';

        let url = `${API_BASE}/recipes?is_ai_generated=true&sort=novelty`;
        if (aiHistoryFilter !== 'all') {
            url += `&source_type=${aiHistoryFilter}`;
        }

        const response = await fetch(url, {
             headers: getAuthHeader()
        });
        const recipes = await response.json();

        list.innerHTML = '';

        if (recipes.length === 0) {
            const filterLabel = aiHistoryFilter === 'by-name' ? 'name-based' : aiHistoryFilter === 'by-ingredients' ? 'ingredient-based' : '';
            list.innerHTML = `<p style="grid-column: 1/-1; text-align: left; color: #888;">No ${filterLabel} AI recipes yet. Try generating one!</p>`;
            if (isHistoryEditMode) toggleHistoryEditMode(false);
            return;
        }

        recipes.forEach(r => {
            const card = document.createElement('div');
            card.className = 'card recipe-card fade-in';
            card.style.position = 'relative';

            // Determine generation type
            const isFromName = r.source_ingredients && r.source_ingredients.startsWith('Generated By Name:');
            const typeBadge = isFromName ? 'By Name' : 'By Ingredients';
            const typeColor = 'var(--primary-color)';

            // Format date/time
            let dateStr = '';
            if (r.created_at) {
                const d = new Date(r.created_at);
                dateStr = d.toLocaleDateString('en-US', { 
                    month: 'short', day: 'numeric', year: 'numeric' 
                }) + ' • ' + d.toLocaleTimeString('en-US', { 
                    hour: '2-digit', minute: '2-digit', hour12: true 
                });
            }

            if (isHistoryEditMode) {
                card.onclick = null;
                card.style.cursor = 'default';
                card.style.border = '2px solid var(--primary-color)';
            } else {
                card.onclick = () => openRecipe(r.id, 'pantry');
            }

            // Delete Button Overlay
            const deleteBtnHtml = isHistoryEditMode ?  `
                <button onclick="deleteSingleRecipe(event, '${r.id}')" 
                        style="position: absolute; top: 10px; right: 10px; background: #d32f2f; color: white; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-weight: bold; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; z-index: 10;">
                    ×
                </button>
            `  : '';
            const isFav = state.favourites.some(f => String(f.item_id) === String(r.id) && f.item_type === 'recipe');
            const safeTitle = (r.title || '').replace(/'/g, "\\'");
            const favBtnHtml = (!isHistoryEditMode) ? `
                <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${r.id}" onclick="event.stopPropagation(); toggleFavourite(event.currentTarget, '${r.id}', 'recipe', '${safeTitle}', '${r.image_url}')">
                    <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </button>
            ` : '';

            card.innerHTML = `
                ${deleteBtnHtml}
                ${favBtnHtml}
                <div class="card-img-container" style="display: none;">
                    <img src="${r.image_url || 'https://placehold.co/600x400?text=AI+Chef'}" alt="${r.title}" loading="lazy">
                </div>
                <div class="card-body">
                    <h3 style="${isHistoryEditMode ? 'padding-right: 20px;' : ''}">${r.title}</h3>
                    <div class="recipe-meta" style="flex-wrap: wrap; gap: 0.5rem;">
                        <span class="badge" style="background: ${typeColor}; color: white;">${typeBadge}</span>
                        <span>${r.prep_time_minutes} min</span>
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.78rem; color: #999; display: flex; align-items: center; gap: 0.3rem;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                        ${dateStr}
                    </div>
                </div>
            `;
            list.appendChild(card);
        });

    } catch (e) {
        console.error("Error loading AI history:", e);
        list.innerHTML = '<p>Failed to load history.</p>';
    }
}

window.setAIHistoryFilter = function(filter) {
    aiHistoryFilter = filter;
    loadAIHistory();
};

function toggleHistoryEditMode(active) {
    isHistoryEditMode = active;
    loadAIHistory(); // Re-render to show/hide controls
}

async function deleteSingleRecipe(e, id) {
    e.stopPropagation();

    showCustomConfirm(
        "Delete Recipe?",
        "Are you sure you want to delete this recipe?",
        async () => {
            try {
                const res = await fetch(`${API_BASE}/recipes/${id}`, { 
                    method: 'DELETE',
                    headers: getAuthHeader() 
                });
                if (res.ok) {
                    loadAIHistory();
                    showToast('Recipe deleted', 'success');
                }
            } catch (err) {
                console.error(err);
                showToast("Failed to delete.", 'error');
            }
        },
        "Delete",
        "danger"
    );
}

function confirmDeleteAll() {
    showCustomConfirm(
        "Delete All History?",
        "Are you sure you want to delete ALL your AI creations? This action cannot be undone.",
        async () => {
            try {
                const response = await fetch(`${API_BASE}/recipes/ai-history`, {
                    method: 'DELETE',
                    headers: getAuthHeader()
                });

                if (response.ok) {
                    loadAIHistory();
                    showToast('All history cleared', 'success');
                } else {
                    showToast("Failed to clear history.", 'error');
                }
            } catch (e) {
                console.error(e);
                showToast("Server error.", 'error');
            }
            toggleHistoryEditMode(false);
        },
        "Delete All",
        "danger"
    );
}

// --- Recipes Logic ---
async function loadRecipes() {
    const search = document.getElementById('search-input').value;
    const categoryObj = categories[activeCategoryIndex];

    // Show Loading
    const list = document.getElementById('recipe-list');
    list.innerHTML = `
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
    `;

    let recipes = [];

    // Logic Priority:
    // 1. If Text Search is entered, use that (Global Search).
    // 2. If "All" category is selected, use getExternalRecipes('') (Parallel Fetch).
    // 3. If Specific Category is selected, use getRecipesByCategory().

    try {
        if (search.trim()) {
            // MERGE STRATEGY: Fetch all potential matches and combine them
            const [nameMatches, areaMatches, catMatches] = await Promise.all([
                api.getExternalRecipes(search),
                api.getRecipesByArea(search),
                api.getRecipesByCategory(search)
            ]);

            // Combine arrays
            const allMatches = [...nameMatches, ...areaMatches, ...catMatches];

            // Deduplicate by idMeal
            const seen = new Set();
            recipes = allMatches.filter(item => {
                const k = item.idMeal;
                return seen.has(k) ? false : seen.add(k);
            });
        } else if (categoryObj.label === 'All') {
            recipes = await api.getExternalRecipes(''); // Fetches all
        } else {
            // Specific Category
            recipes = await api.getRecipesByCategory(categoryObj.value);
        }
    } catch (e) {
        console.error("Error in loadRecipes fetch:", e);
    }

    // TheMealDB doesn't have dates/ratings for sorting, so we might skip sort or randomize
    const sort = document.getElementById('sort-select');
    if (sort && sort.value === 'novelty') {
        recipes.reverse();
    }

    // Limit Removed to show full list as requested
    // recipes = recipes.slice(0, 12); 

    state.recipesCache = recipes; // Cache 
    renderRecipes(recipes);
}

function renderRecipes(recipes) {
    const list = document.getElementById('recipe-list');
    list.innerHTML = '';

    if (recipes.length === 0) {
        list.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: #fff; border-radius: 20px; box-shadow: var(--shadow-sm);">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                <h3>No recipes found</h3>
                <p style="color: var(--text-muted); margin-bottom: 2rem;">We couldn't find any matches for your search. Why not generate a custom recipe instead?</p>
                <button class="btn btn-primary" onclick="switchView('pantry')" style="padding: 0.8rem 2rem;">
                    ✨ Create with Pantry Chef AI
                </button>
            </div>
        `;
        return;
    }

    recipes.forEach(r => {
        const card = document.createElement('div');
        card.className = 'card recipe-card fade-in';
        // Make whole card clickable
        card.onclick = () => openRecipe(r.idMeal);
        const isFav = state.favourites.some(f => String(f.item_id) === String(r.idMeal) && f.item_type === 'recipe');
        const safeTitle = (r.strMeal || '').replace(/'/g, "\\'");
        const favBtnHtml = `
            <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${r.idMeal}" onclick="event.stopPropagation(); toggleFavourite(event.currentTarget, '${r.idMeal}', 'recipe', '${safeTitle}', '${r.strMealThumb}')">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
        `;

        card.innerHTML = `
            ${favBtnHtml}
            
            <div class="card-img-container">
                <img src="${r.strMealThumb}" alt="${r.strMeal}" loading="lazy">
            </div>
            <div class="card-body">
                <h3>${r.strMeal}</h3>
                <div class="recipe-meta">
                    ${r.strArea && r.strArea !== 'Unknown' ?
                `<span onclick="event.stopPropagation(); filterRecipesByArea('${r.strArea}')" class="clickable-tag">${r.strArea}</span>` :
                `<span>${r.strArea || 'International'}</span>`
            }
                    ${r.strCategory ?
                `<span onclick="event.stopPropagation(); filterRecipesByCategoryName('${r.strCategory}')" class="clickable-tag">${r.strCategory}</span>` :
                `<span>${r.strCategory || 'General'}</span>`
            }
                </div>
                <!-- Button is now just visual, clicking it propagates to card -->
                <button class="btn btn-primary" style="margin-top: 1rem; width: 100%; border-radius: 8px;">View Recipe</button>
            </div>
        `;
        list.appendChild(card);
    });
}

// --- Drinks Logic ---
async function loadDrinks() {
    const search = document.getElementById('drink-search-input').value;
    const categoryObj = drinkCategories[activeDrinkCategoryIndex];

    // Show Loading
    const list = document.getElementById('drink-list');
    list.innerHTML = `
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
    `;

    let drinks = [];

    // Logic Priority:
    // 1. Name Search
    // 2. Alcoholic Filter (e.g. "Alcoholic", "Non alcoholic")
    // 3. Category Filter

    if (search.trim()) {
        // MERGE STRATEGY: Fetch all potential matches and combine them
        const [nameMatches, alcMatches, catMatches] = await Promise.all([
            api.getExternalDrinks(search),
            api.getDrinksByAlcoholic(search),
            api.getDrinksByCategory(search)
        ]);

        // Combine arrays
        const allMatches = [...nameMatches, ...alcMatches, ...catMatches];

        // Deduplicate by idDrink
        const seen = new Set();
        drinks = allMatches.filter(item => {
            const k = item.idDrink;
            return seen.has(k) ? false : seen.add(k);
        });

    } else if (categoryObj.label === 'All') {
        drinks = await api.getExternalDrinks('');
    } else {
        drinks = await api.getDrinksByCategory(categoryObj.value);
    }

    renderDrinks(drinks);
}

function renderDrinks(drinks) {
    const list = document.getElementById('drink-list');
    list.innerHTML = '';

    if (drinks.length === 0) {
        list.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: #fff; border-radius: 20px; box-shadow: var(--shadow-sm);">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🍹</div>
                <h3>No drinks found</h3>
                <p style="color: var(--text-muted); margin-bottom: 2rem;">We couldn't find that drink. Try searching for something else or browse categories!</p>
                <button class="btn btn-outline" onclick="selectDrinkCategory(0)" style="padding: 0.8rem 2rem;">
                    Browse All Drinks
                </button>
            </div>
        `;
        return;
    }

    drinks.forEach(d => {
        const card = document.createElement('div');
        card.className = 'card recipe-card fade-in'; // Reusing recipe card style
        // Make whole card clickable
        card.onclick = () => openDrink(d.idDrink);
        const isFav = state.favourites.some(f => String(f.item_id) === String(d.idDrink) && f.item_type === 'drink');
        const safeTitle = (d.strDrink || '').replace(/'/g, "\\'");
        const favBtnHtml = `
            <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${d.idDrink}" onclick="event.stopPropagation(); toggleFavourite(event.currentTarget, '${d.idDrink}', 'drink', '${safeTitle}', '${d.strDrinkThumb}')">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
        `;

        card.innerHTML = `
            ${favBtnHtml}
            
            <div class="card-img-container">
                <img src="${d.strDrinkThumb}" alt="${d.strDrink}" loading="lazy">
            </div>
            <div class="card-body">
                <h3>${d.strDrink}</h3>
                <div class="recipe-meta">
                     ${d.strCategory ?
                `<span onclick="event.stopPropagation(); filterDrinksByCategoryName('${d.strCategory}')" class="clickable-tag">${d.strCategory}</span>` :
                `<span>${d.strCategory || 'Drink'}</span>`
            }
                    ${d.strAlcoholic ? `<span onclick="event.stopPropagation(); filterDrinksByAlcoholic('${d.strAlcoholic}')" class="clickable-tag">${d.strAlcoholic}</span>` : ''}
                </div>
                <!-- Note: filter.php doesn't return strAlcoholic, but search.php does. We handle gracefully. -->
                <button class="btn btn-primary" style="margin-top: 1rem; width: 100%; border-radius: 8px;">View Drink</button>
            </div>
        `;
        list.appendChild(card);
    });
}

// Global scope for onclick

async function openDrink(id, addToHistory = true) {
    const view = views.drinkDetails;
    switchView('drinkDetails', false);

    if (addToHistory) {
        history.pushState({ view: 'drinkDetails', id: id }, '', `#drink/${id}`);
    }

    view.innerHTML = '<div style="padding: 4rem; text-align:center; font-size: 1.5rem;">Loading Drink...</div>';
    console.log("openDrink called for ID:", id);

    try {
        const drink = await api.getExternalDrinkDetails(id);
        console.log("openDrink: result", drink);

        if (!drink) {
            console.error("openDrink: Drink not found or API null");
            view.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
                <h2>Error loading drink</h2>
                <p>Could not fetch details. Check console for details.</p>
                <button class="btn btn-primary" onclick="switchView('drinks')">Back to Browse</button>
            </div>`;
            return;
        }

        const ingredients = [];
        for (let i = 1; i <= 15; i++) {
            const ing = drink[`strIngredient${i}`];
            const meas = drink[`strMeasure${i}`];
            if (ing && ing.trim()) {
                ingredients.push({ name: ing, amount: meas });
            }
        }

        view.innerHTML = `
         <div style="margin-bottom: 2rem;">
            <button class="btn btn-outline" onclick="switchView('drinks')">← Back to Drinks</button>
        </div>

        <div class="card" style="border:none; box-shadow:none; background:transparent;">
            <div class="modal-header" style="text-align: left; margin-bottom: 2rem;">
                   <div style="display: flex; align-items: flex-start; justify-content: space-between;">
            <h1 style="font-size: 3rem; margin-bottom: 0.5rem; color: var(--primary-color);">${drink.strDrink}</h1>
            <button class="fav-btn ${state.favourites.some(f => String(f.item_id) === String(drink.idDrink)) ? 'active' : ''}" data-id="${drink.idDrink}" style="position: relative; top: auto; right: auto; margin-left: 1rem; flex-shrink: 0;" onclick="toggleFavourite(event.currentTarget, '${drink.idDrink}', 'drink', '${drink.strDrink.replace(/'/g, "\\'")}', '${drink.strDrinkThumb}')">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
        </div>
                <div>
                    ${drink.strAlcoholic ? `<span class="badge clickable-tag" onclick="filterDrinksByAlcoholic('${drink.strAlcoholic}')">${drink.strAlcoholic}</span>` : ''}
                    
                    ${drink.strCategory ?
                `<span class="badge clickable-tag" onclick="filterDrinksByCategoryName('${drink.strCategory}')">${drink.strCategory}</span>` :
                `<span class="badge">${drink.strCategory || 'Drink'}</span>`
            }
                </div>
            </div>

            <div style="text-align: center;">
                <img src="${drink.strDrinkThumb}" style="max-height: 500px; max-width: 100%; width: auto; border-radius: 20px; box-shadow: var(--shadow-md);">
            </div>

            <div class="modal-grid" style="margin-top: 3rem;">
                <div class="ingredients-panel" style="background: white; padding: 2rem; border-radius: 20px; box-shadow: var(--shadow-sm);">
                    <h3 style="font-size: 1.5rem; margin-bottom: 1.5rem;">Ingredients</h3>
                    <ul class="ingredient-list">
                        ${ingredients.map(i => `<li><strong>${i.amount || ''}</strong> ${i.name}</li>`).join('')}
                    </ul>
                    <p style="margin-top:1.5rem; font-size:1rem; color:#666"><strong>Glass:</strong> ${drink.strGlass}</p>
                </div>
                <div class="instructions-panel" style="background: white; padding: 2rem; border-radius: 20px; box-shadow: var(--shadow-sm);">
                    <h3 style="font-size: 1.5rem; margin-bottom: 1.5rem;">Instructions</h3>
                    <p style="white-space: pre-line; color: #444; line-height: 1.8; font-size: 1.1rem;">${formatRecipeText(drink.strInstructions)}</p>
                </div>
            </div>
             <div style="margin-top: 3rem; text-align: center;">
                <button class="btn btn-primary" onclick="openMealSelector('${drink.idDrink}', '${drink.strDrink.replace(/'/g, "\\'")}', 'drink', '${drink.strDrinkThumb}')">Add to Meal Plan</button>
            </div>
        </div>
    `;
        window.scrollTo(0, 0);

        if (typeof savorAI !== 'undefined') {
            drink.ingredients = ingredients;
            savorAI.setContext(drink, 'drink');
        }

    } catch (e) {
        console.error("Error in openDrink:", e);
        view.innerHTML = '<div style="padding: 2rem; text-align: center; color: red;">Failed to load drink details.</div>';
    }
}



async function openRecipe(id, fromView = 'recipes', addToHistory = true) {
    const view = views.recipeDetails;
    // Pass fromView as the targetNavOverride to highlight correct tab
    switchView('recipeDetails', false, fromView);

    if (addToHistory) {
        history.pushState({ view: 'recipeDetails', id: id, fromView: fromView }, '', `#recipe/${id}`);
    }

    view.innerHTML = '<div style="padding: 4rem; text-align:center; font-size: 1.5rem;">Loading Recipe...</div>';

    let recipe = null;
    let ingredients = [];
    let isLocal = false;

    // 1. Try Local API first (for AI recipes)
    try {
        // Simple check: if ID is small integer, it's likely local. 
        // Or just try fetching.
        recipe = await api.getRecipeDetails(id);

        if (recipe && recipe.id) {
            isLocal = true;
            // Normalize Local Data to View Format
            recipe.strMeal = recipe.title;
            recipe.strMealThumb = recipe.image_url;
            recipe.strArea = 'Local'; // or from DB
            recipe.strCategory = recipe.category_name || 'Custom';
            recipe.strArea = 'Local'; // or from DB
            recipe.strCategory = recipe.category_name || 'Custom';
            recipe.idMeal = recipe.id;
            recipe.source_ingredients = recipe.source_ingredients; // Ensure pass-through

            // Handle Instructions (JSON string or text)
            try {
                const instr = JSON.parse(recipe.instructions);
                if (Array.isArray(instr)) {
                    recipe.strInstructions = instr.join('\n\n');
                } else {
                    recipe.strInstructions = recipe.instructions;
                }
            } catch (e) {
                recipe.strInstructions = recipe.instructions;
            }

            // Handle Ingredients
            if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
                ingredients = recipe.ingredients.map(i => ({
                    name: i.name,
                    amount: i.quantity || ''
                }));
            }
        } else {
            // Not found locally, or error object returned
            recipe = null;
        }
    } catch (e) {
        console.log("Not a local recipe or fetch failed:", e);
        recipe = null;
    }

    // 2. Fallback to External API
    if (!recipe) {
        recipe = await api.getExternalRecipeDetails(id);
        if (recipe) {
            // Parse External Ingredients
            for (let i = 1; i <= 20; i++) {
                const ing = recipe[`strIngredient${i}`];
                const meas = recipe[`strMeasure${i}`];
                if (ing && ing.trim()) {
                    ingredients.push({ name: ing, amount: meas });
                }
            }
        }
    }


    if (!recipe) {
        view.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
                <h2>Error loading recipe</h2>
                <button class="btn btn-primary" onclick="switchView('${fromView}')">Back</button>
            </div>`;
        return;
    }

    const backLabel = fromView === 'pantry' ? '← Back to Pantry Chef' : '← Back to Recipes';
    const backAction = fromView === 'pantry' ? "switchView('pantry')" : "switchView('recipes')";

    view.innerHTML = `
        <div style="margin-bottom: 2rem;">
            <button class="btn btn-outline" onclick="${backAction}">${backLabel}</button>
        </div>

        <div class="card" style="border:none; box-shadow:none; background:transparent;">
            <div class="modal-header" style="text-align: left; margin-bottom: 2rem;">
                ${recipe.is_ai_generated && recipe.created_at ? `
                    <div style="margin-bottom: 0.5rem; font-size: 0.85rem; color: #888; display: flex; align-items: center; gap: 0.4rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-top: -2px;"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                        Generated on ${new Date(recipe.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • 
                        ${new Date(recipe.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </div>
                ` : ''}
                <div style="display: flex; align-items: flex-start; justify-content: space-between;">
                    <h1 style="font-size: 3rem; margin-bottom: 0.5rem; color: var(--primary-color);">
                        ${recipe.strMeal}
                    </h1>
                    <button class="fav-btn ${state.favourites.some(f => String(f.item_id) === String(recipe.idMeal)) ? 'active' : ''}" data-id="${recipe.idMeal}" style="position: relative; top: auto; right: auto; margin-left: 1rem; flex-shrink: 0;" onclick="toggleFavourite(event.currentTarget, '${recipe.idMeal}', 'recipe', '${recipe.strMeal.replace(/'/g, "\\'")}', '${recipe.strMealThumb}')">
                        <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    </button>
                </div>
                <div style="margin-top: 1rem;">
                   ${recipe.strCategory ?
            `<span class="badge clickable-tag" onclick="filterRecipesByCategoryName('${recipe.strCategory}')">${recipe.strCategory}</span>` :
            `<span class="badge">${recipe.strCategory || 'General'}</span>`
        }
                </div>
            </div>

            <div style="text-align: center; ${recipe.is_ai_generated ? 'display: none;' : ''}">
                <img src="${recipe.strMealThumb}" style="max-height: 500px; max-width: 100%; width: auto; border-radius: 20px; box-shadow: var(--shadow-md);">
            </div>

            <div class="modal-grid" style="margin-top: 3rem;">
                <div class="ingredients-panel" style="background: white; padding: 2rem; border-radius: 20px; box-shadow: var(--shadow-sm);">
                    <h3 style="font-size: 1.5rem; margin-bottom: 1.5rem;">Ingredients</h3>
                    <ul class="ingredient-list">
                        ${ingredients.map(i => `<li><strong>${i.amount || ''}</strong> ${i.name}</li>`).join('')}
                    </ul>
                </div>
                <div class="instructions-panel" style="background: white; padding: 2rem; border-radius: 20px; box-shadow: var(--shadow-sm);">
                    ${recipe.source_ingredients ? `
                        <div style="margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 2px solid #eee;">
                            <h3 style="font-size: 1.2rem; margin-bottom: 1rem; color: var(--primary-color);">Generated from your pantry:</h3>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${recipe.source_ingredients.split(',').map(s =>
            `<span style="background: #e8f5e9; color: #2e7d32; padding: 0.5rem 1rem; border-radius: 20px; font-weight: 500;">${s}</span>`
        ).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <h3 style="font-size: 1.5rem; margin-bottom: 1.5rem;">Instructions</h3>
                    <p style="white-space: pre-line; color: #444; line-height: 1.8; font-size: 1.1rem;">${formatRecipeText(recipe.strInstructions)}</p>
                    ${recipe.strYoutube ? `<a href="${recipe.strYoutube}" target="_blank" class="btn btn-outline" style="margin-top:2rem; display:inline-block">Watch on YouTube</a>` : ''}
                </div>
            </div>
            
             <div style="margin-top: 3rem; text-align: center;">
                <button class="btn btn-primary" onclick="openMealSelector('${recipe.idMeal}', '${recipe.strMeal.replace(/'/g, "\\'")}', 'recipe', '${recipe.strMealThumb}')">Add to Meal Plan</button>
            </div>
        </div>
    `;

    // Scroll to top
    window.scrollTo(0, 0);

    // Savor AI Integration
    if (typeof savorAI !== 'undefined') {
        // Pass normalized ingredients for context
        recipe.ingredients = ingredients;
        savorAI.setContext(recipe, 'recipe');
    }
}



// --- Meal Planner Logic ---
function changeWeek(days) {
    state.currentWeekStart = addDays(state.currentWeekStart, days);
    if (state.view === 'planner') {
        loadPlanner();
    } else if (state.view === 'shopping') {
        loadShoppingList();
    } else {
        loadPlanner();
        loadShoppingList();
    }
}

// ... (Rest of planner/shopping logic) ...
async function loadPlanner() {
    if (!state.user) {
        const grid = document.getElementById('planner-grid');
        if (grid) grid.innerHTML = '<div style="text-align:center; padding:3rem; grid-column:1/-1;">Please sign in to view your meal plan.</div>';
        return;
    }

    const start = state.currentWeekStart;
    const end = addDays(start, 6);

    // Update Label
    const label = document.getElementById('current-week-label');
    if (label) label.innerText = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;

    // Fetch Plans
    const plans = await api.getMealPlan(formatDate(start), formatDate(end));
    renderPlanner(start, plans);
}

function renderPlanner(startDate, plans) {
    const grid = document.getElementById('planner-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

    // Create 7 day columns
    for (let i = 0; i < 7; i++) {
        const currentDate = addDays(startDate, i);
        const dateStr = formatDate(currentDate);
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });

        const col = document.createElement('div');
        col.className = 'day-column';
        col.innerHTML = `<div class="day-header">${dayName}<br><span style="font-size: 0.8em; font-weight: normal">${currentDate.getDate()}/${currentDate.getMonth() + 1}</span></div>`;

        mealTypes.forEach(type => {
            // Filter all plans for this slot
            const slotPlans = plans.filter(p => p.date === dateStr && p.meal_type === type);
            const slot = document.createElement('div');
            slot.className = 'meal-slot';

            // Always show add button at the top or bottom. Let's put it at the bottom.

            if (slotPlans.length > 0) {
                slot.classList.add('filled');

                // Render List of Items
                const itemsHtml = slotPlans.map(plan => {
                    // Heuristic to guess if it's a drink. 
                    // CocktailDB IDs are usually 5-6 digits starting with 11 (e.g. 11007 for Margarita). 
                    // TheMealDB IDs are usually 5 digits starting with 52 (e.g. 52772 for Teriyaki Chicken).
                    // If local, it's a UUID or small integer. Let's try to infer.
                    let isDrink = false;
                    if (plan.title.toLowerCase().includes('cocktail') || plan.title.toLowerCase().includes('drink') || plan.title.toLowerCase().includes('shake')) {
                        isDrink = true;
                    } else if (plan.recipe_id && plan.recipe_id.toString().startsWith('11') && plan.recipe_id.toString().length >= 5) {
                        isDrink = true;
                    } else if (plan.recipe_id && plan.recipe_id.toString().length === 6 && plan.recipe_id.toString().startsWith('17')) {
                        // Some newer CocktailDB IDs start with 17
                        isDrink = true;
                    }

                    const clickAction = isDrink ? `openDrink('${plan.recipe_id}', 'planner')` : `openRecipe('${plan.recipe_id}', 'planner')`;

                    return `
                    <div class="meal-item" style="margin-bottom: 5px; padding-bottom: 5px; border-bottom: 1px solid rgba(0,0,0,0.05); cursor: pointer;" onclick="${clickAction}">
                        <div style="font-weight: 600; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${plan.title}</div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
                            <span style="font-size: 0.75rem; color: var(--text-muted); cursor: pointer;" onclick="event.stopPropagation(); removeMeal('${plan.id}')">Remove</span>
                        </div>
                    </div>
                `}).join('');

                slot.innerHTML = `
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">${type}</div>
                    ${itemsHtml}
                    <div class="add-more-btn" style="text-align: center; margin-top: 5px; cursor: pointer; color: var(--primary-color); font-size: 0.8rem;"
                         onclick="switchView('recipes'); showToast('Find a recipe and click Add to Meal Plan!', 'info');">
                        + Add More
                    </div>
                `;
            } else {
                slot.innerHTML = `<span style="color: #ccc; font-size: 0.9rem;">+ ${type}</span>`;
                slot.title = "Click to browse recipes";
                slot.onclick = () => {
                    switchView('recipes');
                    showToast('Find a recipe and click "Add to Meal Plan" to fill this slot!', 'info');
                };
            }

            col.appendChild(slot);
        });

        grid.appendChild(col);
    }
}

async function promptAddMeal(date, type) {
    // Legacy function - kept for reference but UI flow is now different
}

async function removeMeal(id) {
    showCustomConfirm(
        'Remove Meal?',
        'Remove this item from your meal plan?',
        async () => {
            try {
                const res = await fetch(`${API_BASE}/meal-plan`, {
                    method: 'DELETE',
                    headers: { 
                        'Content-Type': 'application/json',
                        ...getAuthHeader() 
                    },
                    body: JSON.stringify({ id })
                });

                if (!res.ok) throw new Error('Failed to delete');

                loadPlanner();
                showToast('Item removed from meal plan', 'success');
            } catch (err) {
                console.error(err);
                showToast('Error removing item', 'error');
            }
        },
        'Remove',
        'danger'
    );
}

// showCustomConfirm moved to Utils section

// --- Meal Selector Logic (New) ---
let pendingMealAddition = null; // { id, title, type, image }

function openMealSelector(id, title, type = 'recipe', image = '') {
    pendingMealAddition = { id, title, type, image };

    const modal = document.getElementById('meal-selector-modal');
    modal.style.display = 'flex';
    modal.classList.remove('hidden');

    // Reset to current week (optional)
    renderMealSelector();
}

function closeMealSelector() {
    const modal = document.getElementById('meal-selector-modal');
    modal.style.display = 'none';
    modal.classList.add('hidden');
    pendingMealAddition = null;
}

async function renderMealSelector() {
    if (!state.user) {
        showToast("Please sign in to add meals.", 'error');
        closeMealSelector();
        return;
    }

    const start = state.currentWeekStart;
    const end = addDays(start, 6);

    // Update Label
    const label = document.getElementById('selector-week-label');
    if (label) label.innerText = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;

    // Show Loading
    const grid = document.getElementById('selector-grid');
    grid.innerHTML = '<div style="text-align:center; padding: 2rem;">Loading schedule...</div>';

    const plans = await api.getMealPlan(formatDate(start), formatDate(end));

    grid.innerHTML = '';
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

    for (let i = 0; i < 7; i++) {
        const currentDate = addDays(start, i);
        const dateStr = formatDate(currentDate);
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });

        const col = document.createElement('div');
        col.className = 'day-column';
        col.style.minWidth = '200px';
        col.innerHTML = `<div class="day-header">${dayName} <span style="font-weight:normal">${currentDate.getDate()}</span></div>`;

        mealTypes.forEach(type => {
            const slotPlans = plans.filter(p => p.date.startsWith(dateStr) && p.meal_type === type);
            const slot = document.createElement('div');

            slot.style.cursor = 'pointer';
            slot.style.transition = 'all 0.2s';
            slot.onmouseover = () => { slot.style.borderColor = 'var(--primary-color)'; slot.style.background = '#f0fdf4'; };
            slot.onmouseout = () => { slot.style.borderColor = slotPlans.length ? 'transparent' : '#ccc'; slot.style.background = slotPlans.length ? '#e9f5db' : 'transparent'; };

            if (slotPlans.length > 0) {
                slot.className = 'meal-slot filled';
                const itemsHtml = slotPlans.map(p => `
                    <div style="font-weight: 600; font-size: 0.85em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 2px; margin-bottom: 2px;">
                        ${p.title}
                    </div>
                `).join('');

                slot.innerHTML = `
                    <div style="opacity: 0.6; font-size: 0.8em; margin-bottom: 4px;">${type} (${slotPlans.length})</div>
                    ${itemsHtml}
                    <div style="font-size: 0.75em; color: var(--primary-color); margin-top: 4px; text-align: center; font-weight: bold;">+ Add another to ${type}</div>
                `;
                slot.title = `Add ${pendingMealAddition.title} to ${type}?`;
                slot.onclick = () => confirmAddToMealPlan(dateStr, type, true);
            } else {
                slot.className = 'meal-slot';
                slot.innerHTML = `<span style="color: #888; font-size: 0.9em;">+ ${type}</span>`;
                 slot.title = `Add ${pendingMealAddition.title} to ${type}?`;
                slot.onclick = () => confirmAddToMealPlan(dateStr, type, false);
            }

            col.appendChild(slot);
        });

        grid.appendChild(col);
    }
}

async function confirmAddToMealPlan(date, type) {
    if (!pendingMealAddition) return;

    const { id, title, image } = pendingMealAddition;

    // No replacement check - always add
    try {
        await api.updateMealPlan({
            date,
            meal_type: type,
            recipe_id: id,
            title: title,
            image_url: image
        });

        closeMealSelector();
        showToast(`Added ${title} to ${type} on ${date}`, 'success');

        state.favourites = await api.getFavourites();
            if (state.view === 'planner') loadPlanner();

    } catch (e) {
        console.error(e);
        showToast('Failed to save meal plan.', 'error');
    }
}

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
        container.style.zIndex = '5000';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} fade-in`;
    toast.innerHTML = message;

    // Quick Styles for Toast
    toast.style.background = type === 'error' ? '#d32f2f' : '#2d6a4f';
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '50px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.fontSize = '0.95rem';
    toast.style.fontWeight = '500';

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}


// --- Filter Logic ---

function renderTagResults(title, items, type = 'recipe') {
    const view = views.tagResults;
    const grid = document.getElementById('tag-results-grid');
    const titleEl = document.getElementById('tag-results-title');

    // Switch view but DON'T push history yet, we do custom push
    switchView('tagResults', false);

    // Custom History Push
    history.pushState({ view: 'tagResults', title: title, items: items, type: type }, '', `#tag/${title.replace(/\s+/g, '-')}`);

    titleEl.innerText = title;

    grid.innerHTML = '';
    if (items.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No results found.</p>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card recipe-card fade-in';

        const id = type === 'recipe' ? item.idMeal : item.idDrink;
        const name = type === 'recipe' ? item.strMeal : item.strDrink;
        const img = type === 'recipe' ? item.strMealThumb : item.strDrinkThumb;
        const fn = type === 'recipe' ? 'openRecipe' : 'openDrink';

        card.onclick = () => window[fn](id);

        const isFav = state.favourites.some(f => String(f.item_id) === String(id) && f.item_type === type);
        const safeTitle = (name || '').replace(/'/g, "\\'");
        const favBtnHtml = `
            <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${id}" onclick="event.stopPropagation(); toggleFavourite(event.currentTarget, '${id}', '${type}', '${safeTitle}', '${img}')">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
        `;

        card.innerHTML = `
            ${favBtnHtml}
            <div class="card-img-container">
                <img src="${img}" alt="${name}" loading="lazy">
            </div>
            <div class="card-body">
                <h3>${name}</h3>
                 <button class="btn btn-primary" style="margin-top: 1rem; width: 100%; border-radius: 8px;">View Details</button>
            </div>
        `;
        grid.appendChild(card);
    });

    window.scrollTo(0, 0);
}

async function filterRecipesByArea(area) {
    const list = document.getElementById('tag-results-grid'); // Pre-load
    // Show spinner if we want, or just wait. 
    // Better UX: Switch to view immediately with spinner? 
    // Let's stick to standard flow: Fetch then Show.

    const recipes = await api.getRecipesByArea(area);
    renderTagResults(`${area} Recipes`, recipes, 'recipe');
}

async function filterRecipesByCategoryName(categoryName) {
    const recipes = await api.getRecipesByCategory(categoryName);
    renderTagResults(`${categoryName} Recipes`, recipes, 'recipe');
}

async function filterDrinksByAlcoholic(type) {
    const drinks = await api.getDrinksByAlcoholic(type);
    renderTagResults(`${type} Drinks`, drinks, 'drink');
}

async function filterDrinksByCategoryName(categoryName) {
    const drinks = await api.getDrinksByCategory(categoryName);
    renderTagResults(`${categoryName}`, drinks, 'drink');
}


// Expose openRecipe to window for onclick handler in HTML string
window.openRecipe = openRecipe;
window.openDrink = openDrink;
window.selectCategory = selectCategory;
window.selectDrinkCategory = selectDrinkCategory;
window.switchView = switchView;
window.filterRecipesByArea = filterRecipesByArea;
window.filterRecipesByCategoryName = filterRecipesByCategoryName;
window.filterDrinksByAlcoholic = filterDrinksByAlcoholic;
window.removePantryIngredient = removePantryIngredient;
window.filterDrinksByCategoryName = filterDrinksByCategoryName;
// --- Savor AI Chatbot Logic ---

const savorAI = {
    fab: document.getElementById('savor-ai-fab'),
    modal: document.getElementById('savor-ai-chat-modal'),
    closeBtn: document.getElementById('close-chat-btn'),
    historyContainer: document.getElementById('chat-history'),
    input: document.getElementById('chat-input'),
    sendBtn: document.getElementById('send-chat-btn'),

    context: null, // Stores current recipe data
    history: [],   // Stores conversation history

    init() {
        if (!this.fab) return; // Guard

        // Event Listeners
        this.fab.onclick = () => this.toggleModal(true);
        this.closeBtn.onclick = () => this.toggleModal(false);

        this.sendBtn.onclick = () => this.sendMessage();
        this.input.onkeydown = (e) => {
            if (e.key === 'Enter') this.sendMessage();
        };
    },

    setContext(recipe, type = 'recipe') {
        this.context = recipe;
        this.history = []; // Reset history
        this.renderHistory(); // Clear UI
        this.fab.classList.remove('hidden'); // Show FAB

        // Initial Greeting
        const name = recipe.strMeal || recipe.title;
        const msg = `Hello! I'm Savor AI. I see you're making **${name}**. Ask me about substitutes, instructions, or anything else!`;
        this.addMessage(msg, 'ai');
    },

    clearContext() {
        this.context = null;
        this.history = [];
        this.fab.classList.add('hidden');
        this.modal.classList.add('hidden');
    },

    toggleModal(show) {
        if (show) {
            this.modal.classList.remove('hidden');
            this.modal.style.display = 'flex'; // Force flex
            setTimeout(() => this.input.focus(), 100);
        } else {
            this.modal.classList.add('hidden');
        }
    },

    async sendMessage() {
        const query = this.input.value.trim();
        if (!query) return;

        // 1. UI Update (User)
        this.addMessage(query, 'user');
        this.input.value = '';
        this.input.disabled = true;

        // 2. Loading State
        const loadingId = this.showLoading();

        try {
            // 3. API Call
            const payload = {
                recipe_id: this.context.id || this.context.idMeal || this.context.idDrink,
                user_query: query,
                history: this.history,
                context: {
                    title: this.context.strMeal || this.context.title || this.context.strDrink,
                    servings: this.context.servings || 4, // Default
                    ingredients: this.extractIngredients(this.context),
                    instructions: this.context.strInstructions || this.context.instructions
                }
            };

            const res = await fetch(`${API_BASE}/ai/chat`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            this.removeLoading(loadingId);

            if (data.error) {
                this.addMessage("I'm having trouble thinking right now. " + data.error, 'ai');
            } else {
                this.addMessage(data.response, 'ai');
            }

        } catch (e) {
            console.error(e);
            this.removeLoading(loadingId);
            this.addMessage("Sorry, I can't reach the AI chef right now.", 'ai');
        } finally {
            this.input.disabled = false;
            this.input.focus();
        }
    },

    addMessage(text, sender) {
        const div = document.createElement('div');
        div.className = `chat-msg ${sender} fade-in`;

        // Simple Markdown parsing for bold/italic/lists
        let html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');

        div.innerHTML = html;
        this.historyContainer.appendChild(div);
        this.scrollToBottom();

        // Add to history state
        this.history.push({ role: sender === 'user' ? 'user' : 'model', parts: [{ text: text }] });
    },

    showLoading() {
        const id = 'loading-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = 'chat-msg ai typing-dots';
        div.innerHTML = '<span></span><span></span><span></span>';
        this.historyContainer.appendChild(div);
        this.scrollToBottom();
        return id;
    },

    removeLoading(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    },

    scrollToBottom() {
        this.historyContainer.scrollTop = this.historyContainer.scrollHeight;
    },

    renderHistory() {
        this.historyContainer.innerHTML = '';
    },

    extractIngredients(ctx) {
        // If it's already structured (local DB format passed back via app logic)
        if (ctx.ingredients && Array.isArray(ctx.ingredients) && ctx.ingredients[0].name) {
            return ctx.ingredients.map(i => `${i.amount || i.quantity || ''} ${i.unit || ''} ${i.name}`.trim());
        }

        // If it's TheMealDB format (app.js normalized it partially, but let's be safe)
        // Actually, openRecipe normalizes it into `ingredients` array!
        if (ctx.ingredients && Array.isArray(ctx.ingredients)) {
            return ctx.ingredients.map(i => `${i.amount} ${i.name}`);
        }

        return [];
    }
};

// Initialize Savor AI
savorAI.init();
window.savorAI = savorAI;

// Hook into switchView to hide chatbot when leaving details
const originalSwitchView = switchView;
switchView = function (viewName, addToHistory = true, targetNavOverride = null) {
    originalSwitchView(viewName, addToHistory, targetNavOverride);

    // If NOT in details view, hide AI
    if (viewName !== 'recipeDetails' && viewName !== 'drinkDetails') {
        savorAI.clearContext();
    }
};

// Hook into openRecipe/openDrink to set context is already done by switchView logic?
// No, we need to call setContext() explicitly after load.
// We will modify openRecipe and openDrink to call savoryAI.setContext() at the end.

// Wake up Render backend immediately on page load to reduce cold start delay
window.addEventListener('load', () => {
    if (typeof API_BASE !== 'undefined') {
        fetch(`${API_BASE}/health`).catch(() => {});
    }
});


// --- Scroll to Top Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const scrollBtn = document.getElementById('scrollToTopBtn');
    if (scrollBtn) {
        window.addEventListener('scroll', () => {
            if (document.body.scrollTop > 400 || document.documentElement.scrollTop > 400) {
                scrollBtn.style.display = "flex";
            } else {
                scrollBtn.style.display = "none";
            }
        });
        scrollBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
});
