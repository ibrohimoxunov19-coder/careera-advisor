const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const app = express();

// Fayl BOSHIDA (require qatorlaridan keyin):
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Barcha mysql.createConnection → pool
// Barcha connection.execute → pool.query


app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// DB Config
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'career_advisor'
};

// Job bazasi
const JOBS_DB = {
  frontend: [
    {title: "Frontend React Developer", url: "https://mohirdev.uz/jobs", company: "Mohirdev", salary: "5-12M", type: "Toshkent"},
    {title: "Junior React Developer", url: "https://hh.uz/vacancies/react", company: "IT Park", salary: "4-8M", type: "Masofaviy"},
    {title: "UI/UX + Frontend", url: "https://www.upwork.com/nx/search/jobs/?q=react+uzbekistan", company: "Upwork", salary: "$15-30/h", type: "Freelance"}
  ],
  backend: [
    {title: "Node.js Developer", url: "https://hh.uz/vacancies/node.js", company: "EPAM", salary: "8-15M", type: "Toshkent"},
    {title: "Python Backend", url: "https://myjob.uz/python", company: "MyJob", salary: "7-14M", type: "Gibrid"},
    {title: "Fullstack Node.js", url: "https://freelancer.uz/jobs", company: "Freelancer.uz", salary: "$1000-2500", type: "Remote"}
  ],
  fullstack: [
    {title: "Fullstack MERN", url: "https://www.linkedin.com/jobs/search/?keywords=mern&location=Uzbekistan", company: "LinkedIn", salary: "12-25M", type: "International"},
    {title: "React + Node.js", url: "https://hh.uz/vacancies/fullstack", company: "HeadHunter", salary: "10-20M", type: "To'liq vaqt"}
  ]
};

// Auth middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({error: 'Token kerak!'});
  
  jwt.verify(token, 'secret123', (err, user) => {
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
    
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);
    await connection.end();
    
    res.json({message: 'Ro\'yxatdan o\'tdingiz!'});
  } catch (error) {
    res.status(400).json({error: 'Xato yuz berdi!'});
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const {email, password} = req.body;
    const connection = await mysql.createConnection(dbConfig);
    
    const [rows] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);
    
    if (rows.length === 0 || !await bcrypt.compare(password, rows[0].password)) {
      await connection.end();
      return res.status(401).json({error: 'Noto\'g\'ri ma\'lumotlar!'});
    }
    
    const token = jwt.sign({id: rows[0].id, username: rows[0].username}, 'secret123');
    await connection.end();
    
    res.json({token, user: rows[0]});
  } catch (error) {
    res.status(500).json({error: 'Server xatosi!'});
  }
});

app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT id, username, email FROM users WHERE id = ?', [req.user.id]);
    await connection.end();
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({error: 'Xato!'});
  }
});

// AI Career Advice
app.post('/api/career-advice', authenticateToken, (req, res) => {
  const {goal, experience, skills} = req.body;
  const advice = generateSmartAdvice(goal, experience, skills);
  
  res.json({advice});
});

function generateSmartAdvice(goal, experience, skills) {
  const keywords = skills.toLowerCase().split(',').map(s => s.trim());
  let advice = `🤖 **SIZNING AI KARYERA MASLAHATCHINGIZ**\n\n`;
  
  if (goal.toLowerCase().includes('frontend') || keywords.some(k => k.includes('react'))) {
    advice += `📱 **FRONTEND DEVELOPER uchun:\n`;
  } else if (goal.toLowerCase().includes('backend') || keywords.some(k => k.includes('node'))) {
    advice += `⚙️ **BACKEND DEVELOPER uchun:\n`;
  } else {
    advice += `🚀 **${goal.toUpperCase()} yo\'nalishi uchun:\n`;
  }
  
  if (experience < 1) {
    advice += `- FreeCodeCamp.org da HTML/CSS/JS boshlang\n- YouTube: "Net Ninja" React kursi\n- GitHub profil yarating\n- 3 ta portfolio loyihasi qiling\n`;
  } else if (experience < 3) {
    advice += `- LeetCode easy/medium yeching\n- Open Source GitHub da hissa qo\'shing\n- LinkedIn da ingliz profil\n- AWS sertifikat oling\n`;
  } else {
    advice += `- System Design o\'rganing\n- Tech blog oching\n- Mentorlik boshlang\n- Konfranslarda gapiring\n`;
  }
  
  return advice;
}

// Job Search
app.post('/api/find-jobs', authenticateToken, (req, res) => {
  const {goal, skills} = req.body;
  const goalLower = goal.toLowerCase();
  
  let matchedJobs = [];
  if (goalLower.includes('frontend') || goalLower.includes('react')) {
    matchedJobs = JOBS_DB.frontend;
  } else if (goalLower.includes('backend') || goalLower.includes('node')) {
    matchedJobs = JOBS_DB.backend;
  } else if (goalLower.includes('fullstack')) {
    matchedJobs = JOBS_DB.fullstack;
  }
  
  res.json({jobs: matchedJobs.slice(0, 5)});
});

// Salary Calculator
app.post('/api/salary-calculator', authenticateToken, (req, res) => {
  const {role, experience, skills} = req.body;
  const salary = calculateSalary(role, experience, skills);
  res.json(salary);
});

function calculateSalary(role, experience, skills) {
  let baseSalary = role === 'frontend' ? 6000000 : role === 'backend' ? 8000000 : 10000000;
  baseSalary += experience * 1000000;
  
  if (skills.includes('react') || skills.includes('node')) baseSalary *= 1.3;
  
  return {
    min: Math.round(baseSalary * 0.8 / 1000000) + 'M UZS',
    max: Math.round(baseSalary * 1.2 / 1000000) + 'M UZS',
    usd: Math.round(baseSalary / 12600) + '$'
  };
}

// Interview Questions
app.post('/api/interview-question', authenticateToken, (req, res) => {
  const {role} = req.body;
  const questions = getInterviewQuestions(role);
  const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
  res.json({question: randomQuestion});
});

function getInterviewQuestions(role) {
  const frontendQuestions = [
    "React da useEffect qachon ishlatiladi?",
    "Virtual DOM nima va u qanday ishlaydi?",
    "Flexbox vs Grid farqi nima?",
    "Closure misolini keltiring",
    "Event bubbling va capturing?"
  ];
  
  const backendQuestions = [
    "REST API vs GraphQL farqi?",
    "JWT token qanday ishlaydi?",
    "Database indexing nima?",
    "async/await vs Promise?",
    "Middleware nima va qanday ishlatiladi?"
  ];
  
  return role === 'frontend' ? frontendQuestions : backendQuestions;
}

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server ${PORT} da ishlamoqda`));

