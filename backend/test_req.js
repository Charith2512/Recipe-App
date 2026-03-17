const jwt = require('jsonwebtoken');
const axios = require('axios');
const token = jwt.sign({ id: 1, email: 'moremcharith@gmail.com' }, 'savor_secret_key_2024', { expiresIn: '1h' });

axios.get('http://localhost:5001/api/meal-plan?start_date=2026-03-16&end_date=2026-03-22', {
    headers: { Authorization: `Bearer ${token}` }
})
.then(res => console.log('SUCCESS:', res.data))
.catch(e => console.error('FAIL:', e.response ? e.response.data : e.message));
