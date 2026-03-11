/**
 * 🚀 AI Karyera Maslahatchisi - Professional Node.js Server
 * PostgreSQL + Express + JWT Auth + 5 AI Features
 * Render.com deployment ready
 */

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use(morgan('combined'));

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Jobs database (O'zbekiston + International)
const JOBS_DB = {
  frontend: [
    {title: "Frontend React Developer", url: "https://mohirdev.uz/jobs", company: "Mohirdev", salary: "5-12M", type: "Toshkent", remote: false},
    {title: "Junior React Developer", url: "https://hh.uz/vacancies/react", company: "IT Park", salary: "4-8M", type: "Masofaviy", remote: true},
    {title: "UI/UX + Frontend", url: "https://www.upwork.com/nx/search/jobs/?q=react+uzbekistan", company: "Upwork", salary: "$15-30/h", type: "Freelance", remote: true},
    {title: "React Native Developer", url: "https://freelancer.uz/jobs", company: "Freelancer.uz", salary: "6-10M", type: "Mobil App", remote: true}
  ],
  backend: [
    {title: "Node.js Backend Developer", url: "https://hh.uz/vacancies/node.js", company: "EPAM", salary: "8-15M", type: "Toshkent", remote: false},
    {title: "Python Django Developer", url: "https://myjob.uz/python", company: "MyJob", salary: "7-14M", type: "Gibrid", remote: false},
    {title: "Fullstack Node.js", url: "https://freelancer.uz/jobs", company: "Freelancer.uz", salary: "$1000-2500", type: "Remote", remote: true}
  ],
  fullstack: [
    {title: "Fullstack MERN Developer", url: "https://www.linkedin.com/jobs/search/?keywords=mern&location=Uzbekistan", company: "LinkedIn", salary: "12-25M", type: "International", remote: true},
    {title: "React + Node.js Fullstack", url: "https://hh.uz/vacancies/fullstack", company: "HeadHunter", salary: "10-20M", type: "To'liq vaqt", remote: false}
  ]
};

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'secret123';

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token kerak!' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token yaroqsiz!' });
    req.user = user;
    next();
  });
};

// 🚀 Auto Database initialization
async function initDatabase() {
  try {
    // Create users table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Test connection
    const result = await pool.query('SELECT version()');
    console.log('✅ PostgreSQL tayyor:', result.rows[0].version);
    console.log('✅ Users table yaratildi/tayyor');
  } catch (error) {
    console.error('❌ DB init xatosi:', error.message);
  }
}

// API Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Barcha maydonlar to\'ldirilishi va parol 6+ belgidan iborat bo\'lishi kerak!' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email.toLowerCase(), hashedPassword]
    );

    res.status(201).json({ 
      message: '✅ Ro\'yxatdan o\'tdingiz!', 
      user: result.rows[0] 
    });
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Bu email allaqachon ro\'yxatdan o\'tgan!' });
    } else {
      console.error('Register xatosi:', error);
      res.status(500).json({ error: 'Server xatosi!' });
    }
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Noto\'g\'ri email yoki parol!' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Noto\'g\'ri email yoki parol!' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email 
      } 
    });
  } catch (error) {
    console.error('Login xatosi:', error);
    res.status(500).json({ error: 'Server xatosi!' });
  }
});

app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1', 
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Profile xatosi:', error);
    res.status(500).json({ error: 'Profil olishda xato!' });
  }
});

// 🤖 AI Career Advice (Smart Algorithm)
app.post('/api/career-advice', authenticateToken, (req, res) => {
  const { goal, experience, skills } = req.body;
  const advice = generateSmartAdvice(goal, parseInt(experience) || 0, skills);
  res.json({ advice });
});

function generateSmartAdvice(goal, experience, skills) {
  const keywords = skills.toLowerCase().split(',').map(s => s.trim());
  let advice = `🤖 **SHAXSIY KARYERA MASLAHATCHISI**\n\n`;
  advice += `🎯 **Maqsad:** ${goal}\n`;
  advice += `📚 **Tajriba:** ${experience} yil\n`;
  advice += `⭐ **Skills:** ${skills}\n\n`;

  // Role-based roadmap
  if (goal.toLowerCase().includes('frontend') || keywords.some(k => k.includes('react') || k.includes('vue'))) {
    advice += `📱 **FRONTEND DEVELOPER Yo'l Xaritasi:**\n`;
  } else if (goal.toLowerCase().includes('backend') || keywords.some(k => k.includes('node') || k.includes('python'))) {
    advice += `⚙️ **BACKEND DEVELOPER Yo'l Xaritasi:**\n`;
  } else if (goal.toLowerCase().includes('fullstack') || goal.toLowerCase().includes('mern')) {
    advice += `🔥 **FULLSTACK DEVELOPER Yo'l Xaritasi:**\n`;
  } else {
    advice += `🚀 **${goal.toUpperCase()} Yo'l Xaritasi:**\n`;
  }

  // Experience-based advice
  if (experience < 1) {
    advice += `**🥇 BOSHLovCHI (0-${experience} yil):**\n`;
    advice += `• FreeCodeCamp.org da bepul boshlang\n`;
    advice += `• YouTube: "Net Ninja" yoki "Traversy Media"\n`;
    advice += `• GitHub profil yarating\n`;
    advice += `• 3 ta portfolio loyihasi qiling\n`;
  } else if (experience < 3) {
    advice += `**🥈 O'rta Daraja (${experience} yil):**\n`;
    advice += `• LeetCode 100+ muammo yeching\n`;
    advice += `• Open Source GitHub da ishtirok eting\n`;
    advice += `• LinkedIn da ingliz profil oching\n`;
    advice += `• AWS/Google Cloud sertifikat oling\n`;
  } else {
    advice += `**🥉 Professional (${experience}+ yil):**\n`;
    advice += `• System Design o'rganing (Grokking)\n`;
    advice += `• Tech blog oching (Dev.to)\n`;
    advice += `• Mentorlik boshlang\n`;
    advice += `• Konfranslarda chiqing\n`;
  }

  // Skill-specific recommendations
  advice += `\n💎 **SIZNING SKILLS uchun:**\n`;
  if (keywords.some(k => k.includes('react'))) advice += `• React Native → Mobil app\n`;
  if (keywords.some(k => k.includes('node'))) advice += `• NestJS → Enterprise backend\n`;
  if (keywords.some(k => k.includes('python'))) advice += `• FastAPI + Docker\n`;

  advice += `\n📈 **BUGUN:** LinkedIn da profil yangilang + 1 soat kod yozing!`;
  return advice;
}

// 💼 Job Search API
app.post('/api/find-jobs', authenticateToken, (req, res) => {
  const { goal, skills } = req.body;
  const goalLower = goal.toLowerCase();
  
  let matchedJobs = [];
  if (goalLower.includes('frontend') || goalLower.includes('react')) {
    matchedJobs = JOBS_DB.frontend;
  } else if (goalLower.includes('backend') || goalLower.includes('node')) {
    matchedJobs = JOBS_DB.backend;
  } else if (goalLower.includes('fullstack') || goalLower.includes('mern')) {
    matchedJobs = JOBS_DB.fullstack;
  }

  res.json({ 
    jobs: matchedJobs.slice(0, 5), 
    total: matchedJobs.length,
    message: `${matchedJobs.length} ta mos ish topildi!`
  });
});

// 💰 Salary Calculator
app.post('/api/salary-calculator', authenticateToken, (req, res) => {
  const { goal, experience, skills } = req.body;
  let baseSalary = 6000000;
  
  if (goal.toLowerCase().includes('backend') || goal.toLowerCase().includes('fullstack')) {
    baseSalary = 8000000;
  }
  
  baseSalary += experience * 1500000;
  if (skills.toLowerCase().includes('react') || skills.toLowerCase().includes('node')) {
    baseSalary *= 1.3;
  }

  res.json({
    min: `${Math.round(baseSalary * 0.8 / 1000000)}M UZS`,
    max: `${Math.round(baseSalary * 1.2 / 1000000)}M UZS`,
    usd: Math.round(baseSalary / 12600),
    message: `O'zbekiston IT bozori (${experience} yil tajriba)`
  });
});

// 🎤 Interview Simulator
app.post('/api/interview-question', authenticateToken, (req, res) => {
  const { goal } = req.body;
  const isFrontend = goal.toLowerCase().includes('frontend') || goal.toLowerCase().includes('react');
  
  const frontendQuestions = [
    "React da useEffect qachon ishlatiladi va cleanup nima?",
    "Virtual DOM ning afzalliklari va kamchiliklari?",
    "Flexbox vs CSS Grid farqi va qachon ishlatish?",
    "JavaScript Closure haqida misol keltiring",
    "Event bubbling va capturing farqi?"
  ];
  
  const backendQuestions = [
    "REST API vs GraphQL asosiy farqlari?",
    "JWT token qanday ishlaydi va xavfsizlik muammolari?",
    "Database indexing qachon va qanday ishlatiladi?",
    "async/await vs Promise.all farqi va afzalliklari?",
    "Middleware Express da qanday ishlaydi?"
  ];

  const questions = isFrontend ? frontendQuestions : backendQuestions;
  const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
  
  res.json({ 
    question: randomQuestion,
    category: isFrontend ? 'Frontend' : 'Backend',
    tip: 'Javobingizni baland ovozda aytib ko\'ring!'
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'DB Error', error: error.message });
  }
});

// Serve React/HTML frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Noma\'lum xato yuz berdi!' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM qabul qilindi. DB ulanishlarini yopilmoqda...');
  await pool.end();
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`\n🚀 Server ${PORT} portda ishlamoqda`);
      console.log(`📱 Frontend: http://localhost:${PORT}`);
      console.log(`🔐 API Docs: http://localhost:${PORT}/api/profile`);
      console.log(`✅ Health: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Server ishga tushmadi:', error);
    process.exit(1);
  }
}

startServer();




