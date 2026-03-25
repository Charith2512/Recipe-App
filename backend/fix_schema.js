const db = require('./config/db');

async function updateSchema() {
    try {
        const connection = await db.getConnection();
        
        console.log("Adding user_id to recipes...");
        try {
            await connection.query('ALTER TABLE recipes ADD COLUMN user_id INT');
            await connection.query('ALTER TABLE recipes ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
        } catch(e) { console.log("Recipes might already have user_id", e.message) }

        console.log("Adding user_id to meal_plans...");
        try {
            await connection.query('ALTER TABLE meal_plans ADD COLUMN user_id INT NOT NULL DEFAULT 1');
            await connection.query('ALTER TABLE meal_plans ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
        } catch(e) { console.log("Meal Plans might already have user_id", e.message) }

        console.log("Adding title and image_url to meal_plans...");
        try {
            await connection.query('ALTER TABLE meal_plans ADD COLUMN title VARCHAR(255)');
            await connection.query('ALTER TABLE meal_plans ADD COLUMN image_url VARCHAR(500)');
        } catch(e) { console.log("Meal Plans might already have title/image_url", e.message) }
        
        // Ensure shopping list items exists
        console.log("Checking shopping_list_items...");
        await connection.query(`
            CREATE TABLE IF NOT EXISTS shopping_list_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                ingredient_id INT,
                custom_item_name VARCHAR(255),
                quantity VARCHAR(50),
                unit VARCHAR(50),
                is_checked BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
            )
        `);

        console.log("Checking favourites...");
        await connection.query(`
            CREATE TABLE IF NOT EXISTS favourites (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                item_id VARCHAR(255) NOT NULL,
                item_type ENUM('recipe', 'drink') NOT NULL,
                title VARCHAR(255),
                image_url VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_item (user_id, item_id, item_type),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log("Done updating schema!");
        connection.release();
        process.exit(0);
    } catch (err) {
        console.error("Fatal schema update error:", err);
        process.exit(1);
    }
}

updateSchema();
