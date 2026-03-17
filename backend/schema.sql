-- Create Database
CREATE DATABASE IF NOT EXISTS recipe_app;
USE recipe_app;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

-- Recipes
CREATE TABLE IF NOT EXISTS recipes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT NOT NULL,
    prep_time_minutes INT,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    category_id INT,
    source_ingredients TEXT,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    user_id INT,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Ingredients
CREATE TABLE IF NOT EXISTS ingredients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

-- Recipe Ingredients (Many-to-Many)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipe_id INT,
    ingredient_id INT,
    quantity VARCHAR(50), -- e.g., "1 cup", "200g" - Keeping it simple string for now, or split into amount/unit
    unit VARCHAR(50),
    amount DECIMAL(10, 2),
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

-- Nutrition Info (One-to-One with Recipe)
CREATE TABLE IF NOT EXISTS nutrition (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipe_id INT UNIQUE,
    calories INT,
    protein_g DECIMAL(5, 2),
    fat_g DECIMAL(5, 2),
    carbs_g DECIMAL(5, 2),
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- Meal Plan
CREATE TABLE IF NOT EXISTS meal_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL, 
    meal_type ENUM('Breakfast', 'Lunch', 'Dinner', 'Snack') NOT NULL,
    recipe_id INT,
    user_id INT NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- SEED DATA (Optional, for testing)
INSERT IGNORE INTO categories (name) VALUES ('Italian'), ('Mexican'), ('Asian'), ('American'), ('Vegan'), ('Keto');

INSERT IGNORE INTO ingredients (name) VALUES ('Tomato'), ('Pasta'), ('Chicken Breast'), ('Lettuce'), ('Cheddar Cheese');

-- Shopping List Items
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
);
