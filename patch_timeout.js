const fs = require('fs');

// 1. PATCH API.JS
let apiStr = fs.readFileSync('frontend/js/api.js', 'utf8').replace(/\r\n/g, '\n');

const fetchWithAuthDef = `
async function fetchWithAuth(url, options = {}) {
    const res = await fetch(url, options);
    if ((res.status === 401 || res.status === 403) && url.startsWith(API_BASE)) {
        if (typeof window.handleLogout === 'function') {
            window.handleLogout(true);
        }
        throw new Error('SESSION_EXPIRED');
    }
    return res;
}
`;

apiStr = apiStr.replace(/const api = \{/, fetchWithAuthDef + '\nconst api = {');

// Replace fetch calls but ONLY for API_BASE endpoints.
apiStr = apiStr.replace(/await fetch\(`\$\{API_BASE\}/g, 'await fetchWithAuth(`${API_BASE}');

fs.writeFileSync('frontend/js/api.js', apiStr, 'utf8');


// 2. PATCH APP.JS
let appStr = fs.readFileSync('frontend/js/app.js', 'utf8').replace(/\r\n/g, '\n');

const oldLogout = `function handleLogout() {
    sessionStorage.removeItem('google_token');
    sessionStorage.removeItem('user_info');
    localStorage.removeItem('google_token'); // Cleanup legacy
    localStorage.removeItem('user_info');
    updateLoginUI(null);
    showToast("Logged out successfully.", 'info');
    
    // Switch away from user data views
    if (['planner', 'shopping', 'pantry', 'favourites'].includes(state.view)) {
        switchView('recipes');
    }
}`;

const newLogout = `window.handleLogout = function handleLogout(isTimeout = false) {
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
}`;

appStr = appStr.replace(oldLogout, newLogout);

// Also we need to make sure the loadShoppingList error handler doesn't just print "Session logged out, sign in again..." text if we caught a SESSION_EXPIRED error.
// Because it throws an error (`throw new Error('SESSION_EXPIRED')`), it goes into the `catch (err)` block of `loadShoppingList`.
// Currently `loadShoppingList` has: listContainer.innerHTML = '<p...'
// If we just check `if (err.message === 'SESSION_EXPIRED') return;` at the top of the catch block, it won't render the text. It will just cleanly switch view due to the logout logic.

appStr = appStr.replace(
    /catch \(err\) {\n\s*console\.error\("Error loading shopping list:", err\);/g,
    `catch (err) {\n        console.error("Error loading shopping list:", err);\n        if (err.message === 'SESSION_EXPIRED') return;`
);

appStr = appStr.replace(
    /catch \(err\) {\n\s*console\.error\("Error loading planner:", err\);/g,
    `catch (err) {\n        console.error("Error loading planner:", err);\n        if (err.message === 'SESSION_EXPIRED') return;`
);

fs.writeFileSync('frontend/js/app.js', appStr, 'utf8');

console.log("Patched successfully!");
