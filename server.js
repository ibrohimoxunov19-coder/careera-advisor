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

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Jobs database
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
    
    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id',
      [username, email, hashedPassword]
    );
    
    res.json({message: 'Ro\'yxatdan o\'tdingiz!'});
  } catch (error) {
    res.status(400).json({error: 'Foydalanuvchi mavjud yoki xato!'});
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const {email, password} = req.body;
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({error: 'Noto\'g\'ri ma\'lumotlar!'});
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({error: 'Noto\'g\'ri ma\'lumotlar!'});
    }
    
    const token = jwt.sign({id: user.id, username: user.username}, 'secret123');
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
  const advice = generateSmartAdvice(goal, experience, skills);
  res.json({advice});
});

function generateSmartAdvice(goal, experience, skills) {
  let advice = `🤖 **SIZNING AI KARYERA MASLAHATCHINGIZ**\n\n🎯 Maqsad: ${goal}\n📚 Tajriba: ${experience} yil\n⭐ Skills: ${skills}\n\n`;
  
  if (goal.toLowerCase().includes('frontend')) {
    advice += `📱 **FRONTEND DEVELOPER yo'l xaritasi:**\n`;
    if (experience < 1) advice += `• FreeCodeCamp HTML/CSS/JS\n• YouTube React kursi\n• 3 ta portfolio loyihasi\n`;
    else advice += `• Next.js o'rganing\n• TypeScript qo'shing\n• Open Source ishtirok\n`;
  } else if (goal.toLowerCase().includes('backend')) {
    advice += `⚙️ **BACKEND DEVELOPER yo'l xaritasi:**\n`;
    if (experience < 1) advice += `• Node.js + Express\n• PostgreSQL/MySQL\n• REST API yaratish\n`;
    else advice += `• NestJS o'rganing\n• Docker + CI/CD\n• Microservices\n`;
  }
  
  advice += `\n🚀 **Keyingi qadam:** LinkedIn profil yangilang!`;
  return advice;
}

// Job Search
app.post('/api/find-jobs', authenticateToken, (req, res) => {
  const {goal} = req.body;
  const goalLower = goal.toLowerCase();
  
  let matchedJobs = JOBS_DB.frontend;
  if (goalLower.includes('backend')) matchedJobs = JOBS_DB.backend;
  else if (goalLower.includes('fullstack')) matchedJobs = JOBS_DB.fullstack;
  
  res.json({jobs: matchedJobs.slice(0, 5)});
});

// Salary Calculator
app.post('/api/salary-calculator', authenticateToken, (req, res) => {
  const {role, experience} = req.body;
  let baseSalary = role === 'frontend' ? 6000000 : role === 'backend' ? 8000000 : 10000000;
  baseSalary += experience * 1000000;
  
  res.json({
    min: Math.round(baseSalary * 0.8 / 1000000) + 'M UZS',
    max: Math.round(baseSalary * 1.2 / 1000000) + 'M UZS',
    usd: Math.round(baseSalary / 12600)
  });
});

// Interview Questions
app.post('/api/interview-question', authenticateToken, (req, res) => {
  const {role} = req.body;
  const frontendQuestions = [
    "React da useEffect qachon ishlatiladi?",
    "Virtual DOM nima?", "Flexbox vs Grid farqi?",
    "Closure misolini keltiring", "Event bubbling?"
  ];
  const backendQuestions = [
    "REST API vs GraphQL?", "JWT token qanday ishlaydi?",
    "Database indexing nima?", "async/await vs Promise?"
  ];
  
  const questions = role === 'frontend' ? frontendQuestions : backendQuestions;
  const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
  
  res.json({question: randomQuestion});
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server ${PORT} portda ishlamoqda`);
});

