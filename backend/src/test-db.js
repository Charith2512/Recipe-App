require('dotenv').config();
const mysql = require('mysql2');

console.log('Testing connection with:');
console.log('Host:', process.env.DB_HOST);
console.log('User:', process.env.DB_USER);
console.log('Database:', process.env.DB_NAME);
console.log('Password Length:', process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0);

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

connection.connect((err) => {
    if (err) {
        console.error('\n❌ Connection Failed!');
        console.error('Error Code:', err.code);
        console.error('Message:', err.message);
        if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('\n--> Diagnosis: The password in your .env file is incorrect for user "root".');
        } else if (err.code === 'ER_BAD_DB_ERROR') {
            console.error('\n--> Diagnosis: The database "recipe_app" does not exist. Did you run the schema.sql in Workbench?');
        }
    } else {
        console.log('\n✅ Connection Successful!');
        console.log('Database is ready to use.');
    }
    connection.end();
});
