const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Jobs data
const JOBS_DB = {
  frontend: [
    {title: "Frontend React Developer", url: "https://mohirdev.uz/jobs", company: "Mohirdev", salary: "5-12M", type: "Toshkent"},
    {title: "Junior React Developer", url: "https://hh.uz/vacancies/react", company: "IT Park", salary: "4-8M", type: "Masofaviy"},
    {title: "UI/UX Frontend", url: "https://www.upwork.com/nx/search/jobs/?q=react+uzbekistan", company: "Upwork", salary: "$15-30/h", type: "Freelance"}
  ],
  backend: [
    {title: "Node.js Developer", url: "https://hh.uz/vacancies/node.js", company: "EPAM", salary: "8-15M", type: "Toshkent"},
    {title: "Python Backend", url: "https://myjob.uz/python", company: "MyJob", salary: "7-14M", type: "Gibrid"},
    {title: "Fullstack Node.js", url: "https://freelancer.uz/jobs", company: "Freelancer.uz", salary: "$1000-2500", type: "Remote"}
  ]
};

// JWT secret
const JWT_SECRET = 'career-advisor-secret-2026';

// Auto create table
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Database tayyor!');
  } catch (error) {
    console.error('DB xatosi:', error);
  }
}

// Auth middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({error: 'Token kerak!'});
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({error: 'Token yaroqsiz!'});
    req.user = user;
    next();
  });
};

// Routes
app.post('/api/register', async (req, res) => {
  try {
    const {username, email, password} = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id',
      [username, email.toLowerCase(), hashedPassword]
    );
    
    res.json({message: 'Ro\'yxatdan o\'tdingiz!'});
  } catch (error) {
    res.status(400).json({error: 'Email mavjud yoki xato!'});
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const {email, password} = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    
    if (result.rows.length === 0) return res.status(401).json({error: 'Noto\'g\'ri ma\'lumotlar!'});
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) return res.status(401).json({error: 'Noto\'g\'ri ma\'lumotlar!'});
    
    const token = jwt.sign({id: user.id, username: user.username}, JWT_SECRET);
    res.json({token, user: {id: user.id, username: user.username, email: user.email}});
  } catch (error) {
    res.status(500).json({error: 'Server xatosi!'});
  }
});

app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({error: 'Xato!'});
  }
});

// AI Career Advice
app.post('/api/career-advice', authenticateToken, (req, res) => {
  const {goal, experience, skills} = req.body;
  
  let advice = `🤖 AI KARYERA MASLAHATI\n\n`;
  advice += `🎯 Maqsad: ${goal}\n📚 Tajriba: ${experience} yil\n⭐ Skills: ${skills}\n\n`;
  
  if (goal.toLowerCase().includes('frontend')) {
    advice += `📱 FRONTEND yo'l xaritasi:\n• React/Next.js o'rganing\n• 3 ta portfolio loyihasi\n• Mohirdev.uz ga murojaat\n`;
  } else {
    advice += `⚙️ BACKEND yo'l xaritasi:\n• Node.js + Express\n• PostgreSQL o'rganing\n• REST API yarating\n`;
  }
  
  res.json({advice});
});

// Jobs
app.post('/api/find-jobs', authenticateToken, (req, res) => {
  const {goal} = req.body;
  let jobs = JOBS_DB.frontend;
  
  if (goal.toLowerCase().includes('backend')) jobs = JOBS_DB.backend;
  
  res.json({jobs: jobs.slice(0, 3)});
});

// Salary
app.post('/api/salary-calculator', authenticateToken, (req, res) => {
  const {role, experience} = req.body;
  let salary = role === 'frontend' ? 6 : 10;
  salary += experience * 2;
  
  res.json({
    min: `${salary-2}M UZS`,
    max: `${salary+3}M UZS`,
    usd: Math.round((salary*1000000)/12600)
  });
});

// Interview
app.post('/api/interview-question', authenticateToken, (req, res) => {
  const frontendQ = [
    "React da useEffect qachon ishlatiladi?",
    "Virtual DOM nima?",
    "Closure misolini keltiring"
  ];
  
  const backendQ = [
    "REST API vs GraphQL?",
    "JWT token qanday ishlaydi?",
    "async/await nima?"
  ];
  
  const questions = Math.random() > 0.5 ? frontendQ : backendQ;
  const question = questions[Math.floor(Math.random() * 3)];
  
  res.json({question});
});

// Frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start
initDatabase().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ Server ${PORT} da ishlamoqda`);
  });
});


