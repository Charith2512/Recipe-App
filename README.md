# Savor - Recipe & Meal Prep App

**Savor** is a comprehensive, AI-powered full-stack web application designed to help users discover culinary dishes, explore refreshing drinks, plan weekly meals, and automatically generate smart shopping lists.

## 🚀 Key Features

### 1. Recipe Management
- **Discover**: Browse an extensive collection of food recipes with high-quality images and detailed info.
- **Search & Filter**: Find recipes quickly by title, ingredients, cuisine type, or prep time.
- **Detailed View**: Access step-by-step cooking instructions, exact ingredient measurements, and nutritional facts.

### 2. Drinks & Cocktails Management
- **Explore Mixology**: Browse a curated list of cocktails and beverages.
- **Dedicated Categories**: Filter drinks by type and search for specific beverages.
- **Drink Details**: View specific instructions, glass types, and ingredients for crafting perfect beverages.

### 3. Pantry Chef 🤖 (AI-Powered)
- **Cook with What You Have**: Input the ingredients currently in your pantry and let the AI generate a unique, delicious recipe for you.
- **Recipe by Name**: Ask the AI to generate a recipe for any specific dish you are craving.
- **AI History**: Automatically saves your previously generated AI recipes so you never lose a good creation.

### 4. Savor AI Chat Assistant
- **Interactive Chat**: Ask the built-in Savor AI questions about recipes, substitutions, cooking techniques, or nutritional advice in real-time. 

### 5. Meal Planning
- **Weekly Calendar**: Interactive interface for planning your weekly meals.
- **Dedicated Slots**: Organize meals by Breakfast, Lunch, Dinner, and Snacks.
- **Flexible Scheduling**: Easily schedule ahead, navigate between weeks, and remove or replace meals.

### 6. Smart Shopping List
- **Auto-Generation**: Automatically compiles a grocery list based on the ingredients needed for your planned meals in the current week.
- **Deduplication**: Intelligently groups and sums up identical ingredients so you buy exactly what you need.

---

## 🛠 Tech Stack

- **Frontend**: HTML5, Vanilla JavaScript (ES6+), and custom CSS3 (Variables, Grid, Glassmorphism).
- **Backend**: Node.js and Express.js REST API.
- **Database**: MySQL.
- **AI Integration**: Google Generative AI (Gemini API) for Pantry Chef and Chat Assistant.

---

## ⚙️ Setup & Installation Guide

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine.
- [MySQL Server](https://dev.mysql.com/downloads/) installed and running.
- A Google Gemini API Key.

### 1. Database Configuration
1. Open your MySQL command line or a client like MySQL Workbench.
2. Run the SQL script located at `backend/schema.sql`. This will:
   - Create the `recipe_app` database.
   - Create all necessary tables (`recipes`, `categories`, `ingredients`, `meal_plans`, etc.).
   - Insert initial seed categories and ingredients.

### 2. Backend Setup
1. Open a terminal and navigate to the project's backend directory:
   ```bash
   cd "backend"
   ```
2. Create a `.env` file in the `backend` folder and add your configuration details:
   ```env
   PORT=5001
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=recipe_app
   GEMINI_API_KEY=your_google_gemini_api_key
   ```
3. Install the required Node dependencies:
   ```bash
   npm install
   ```
4. Start the backend server:
   ```bash
   npm run dev
   ```
   *(You should see "Server running on port 5001" and "MySQL Database Connected Successfully!" in the terminal)*

### 3. Running the Frontend
1. The frontend operates essentially as a static SPA (Single Page Application).
2. Simply open `frontend/index.html` in any modern web browser.
   - *Tip: If you use VS Code, you can use the "Live Server" extension for a better development experience.*
3. Ensure the backend is running so the frontend can securely fetch recipes, save meals, and generate AI content.

---

## 📂 Project Architecture

```text
/
├── backend/                  # Node.js + Express API
│   ├── config/               # Database connection logic
│   ├── routes/               # API Endpoints (Recipes, AI, Shopping List, etc.)
│   ├── src/                  # Main application entry point (app.js)
│   ├── package.json          # Backend dependencies
│   └── schema.sql            # MySQL table schemas
│
└── frontend/                 # Client-side UI
    ├── css/                  # Application styling
    ├── js/                   # Frontend logic (app.js) and API communication (api.js)
    └── index.html            # Main User Interface
```
