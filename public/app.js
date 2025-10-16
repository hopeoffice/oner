// server.js
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'db.sqlite'));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS phone_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
       phone TEXT NOT NULL,
      verification_hash TEXT,
      last_sent INTEGER,
      verified INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT
    )
  `);
});

// Helper: generate 5-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Endpoint: request a verification code
app.post('/api/send-code', async (req, res) => {
  try {
    const phone = String(req.body.phone || '').trim();
    if (!phone) return res.status(400).json({ error: 'Phone required' });

    const now = Date.now();

    db.get('SELECT * FROM phone_requests WHERE phone = ?', [phone], async (err, row) => {
      if (err) return res.status(500).json({ error: 'DB error' });

      if (row && row.last_sent && now - row.last_sent < 60 * 1000) {
        const wait = 60 - Math.floor((now - row.last_sent) / 1000);
        return res.status(429).json({ error: 'Too many requests', wait_seconds: wait });
      }

      const code = generateCode();
      const codeHash = await bcrypt.hash(code, 10);
     
      // Insert or update the phone request
      if (row) {
        db.run(
          'UPDATE phone_requests SET verification_hash = ?, last_sent = ?, verified = 0 WHERE phone = ?',
          [codeHash, now, phone]
        );
      } else {
        db.run(
          'INSERT INTO phone_requests (phone, verification_hash, last_sent) VALUES (?, ?, ?)',
          [phone, codeHash, now]
        );
      }

      // Simulate sending SMS by logging the code. Replace this with a real SMS service in production.
      console.log(`Verification code for ${phone}: ${code}`);

      return res.json({ ok: true, message: 'Code generated and (simulated) sent' });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint: verify code
app.post('/api/verify-code', async (req, res) => {
  try {
    const phone = String(req.body.phone || '').trim();
    const code = String(req.body.code || '').trim();
    if (!phone || !code) return res.status(400).json({ error: 'Phone and code required' });

    db.get('SELECT * FROM phone_requests WHERE phone = ?', [phone], async (err, row) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!row || !row.verification_hash) return res.status(400).json({ error: 'No code requested for this phone' });

      const match = await bcrypt.compare(code, row.verification_hash);
      if (!match) return res.status(400).json({ error: 'Invalid code' });

      // Mark verified
      db.run('UPDATE phone_requests SET verified = 1 WHERE phone = ?', [phone]);

      return res.json({ ok: true, message: 'Code verified' });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint: set password (after code verified)
app.post('/api/set-password', async (req, res) => {
  try {
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');
    if (!phone || !password) return res.status(400).json({ error: 'Phone and password required' });

    db.get('SELECT * FROM phone_requests WHERE phone = ?', [phone], async (err, row) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!row || row.verified !== 1) return res.status(400).json({ error: 'Phone not verified' });

      const passwordHash = await bcrypt.hash(password, 10);

      // Upsert into users table
      db.run(
        `INSERT INTO users (phone, password_hash) VALUES (?, ?)
         ON CONFLICT(phone) DO UPDATE SET password_hash = excluded.password_hash`,
        [phone, passwordHash],
        function (err) {
          if (err) return res.status(500).json({ error: 'DB error saving user' });
          return res.json({ ok: true, message: 'Password saved' });
        }
      );
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Simple endpoint to show stored records 
// WARNING: In production, DO NOT expose raw DB contents. 
app.get('/api/debug-db', (req, res) => {
  db.serialize(() => {
    db.all('SELECT id, phone, last_sent, verified FROM phone_requests', [], (err, phoneRows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      db.all('SELECT id, phone FROM users', [], (err2, userRows) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        res.json({ phone_requests: phoneRows, users: userRows });
      });
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
