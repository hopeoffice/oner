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


// Simple endpoint to show stored records (for demo only!)
// WARNING: In production, DO NOT expose raw DB contents. This is for demonstration/testing only.
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