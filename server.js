const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const DB_PATH = path.resolve(__dirname, 'BD.txt');

// Ensure DB file exists
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, '', 'utf8');
}

function readUsersText() {
  return fs.readFileSync(DB_PATH, 'utf8');
}

function parseUsers() {
  const text = readUsersText().trim();
  if (!text) return [];
  return text.split(/\r?\n/).map(line => {
    const parts = line.split(' ');
    return { login: parts[0], password: parts[1], balance: parseFloat(parts[2] || 0) };
  });
}

app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

// Return raw BD.txt
app.get('/users', (req, res) => {
  try {
    const text = readUsersText();
    res.type('text/plain').send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'read_error' });
  }
});

// Register new user
app.post('/register', (req, res) => {
  try {
    const { login, password } = req.body || {};
    if (!login || !password) return res.status(400).json({ ok: false, error: 'missing_fields' });

    const users = parseUsers();
    if (users.some(u => u.login === login)) {
      return res.status(409).json({ ok: false, error: 'exists' });
    }

    // Append new line. NOTE: For production, store hashed passwords (bcrypt)
    const line = `${login} ${password} 0.00\n`;
    fs.appendFileSync(DB_PATH, line, 'utf8');
    return res.json({ ok: true });
  } catch (err) {
    console.error('register error', err);
    return res.status(500).json({ ok: false, error: 'io_error' });
  }
});

// Login endpoint
app.post('/login', (req, res) => {
  try {
    const { login, password } = req.body || {};
    if (!login || !password) return res.status(400).json({ ok: false, error: 'missing_fields' });

    const users = parseUsers();
    const user = users.find(u => u.login === login && u.password === password);
    if (!user) return res.status(401).json({ ok: false, error: 'invalid_credentials' });

    return res.json({ ok: true, user: { login: user.login, balance: user.balance } });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Replenish balance endpoint
app.post('/replenish', (req, res) => {
  try {
    const { login, amount } = req.body || {};
    if (!login || typeof amount !== 'number') return res.status(400).json({ ok: false, error: 'missing_fields' });

    const lines = readUsersText().split(/\r?\n/).filter(l => l.trim());
    let found = false;
    const updated = lines.map(line => {
      const parts = line.split(' ');
      if (parts[0] === login) {
        found = true;
        const old = parseFloat(parts[2] || 0) || 0;
        const next = (old + amount).toFixed(2);
        return `${parts[0]} ${parts[1]} ${next}`;
      }
      return line;
    });

    if (!found) return res.status(404).json({ ok: false, error: 'user_not_found' });

    fs.writeFileSync(DB_PATH, updated.join('\n') + '\n', 'utf8');
    return res.json({ ok: true });
  } catch (err) {
    console.error('replenish error', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ghost Tools API listening on http://localhost:${PORT}`));
