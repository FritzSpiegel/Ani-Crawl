import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { customAlphabet } from 'nanoid';
import nodemailer from 'nodemailer';
import path from 'node:path';
import fs from 'node:fs';

const {
    PORT = 4000,
    JWT_SECRET,
    APP_BASE_URL = 'http://localhost:5173',
    EMAIL_FROM = 'AniCrawl <no-reply@anicrawl.local>',
    SMTP_HOST, SMTP_PORT = 587, SMTP_USER, SMTP_PASS,
    DEV_RETURN_CODE = '0' // << nur für lokale Dev-Ausgaben
} = process.env;

if (!JWT_SECRET) { console.error('❌ .env: JWT_SECRET fehlt'); process.exit(1); }

const app = express();
app.use(express.json());
app.use(cookieParser());

// --- CORS (localhost und 127.0.0.1 erlauben) ---
const allowed = new Set([APP_BASE_URL, 'http://localhost:5173', 'http://127.0.0.1:5173']);
app.use(cors({
    origin(origin, cb) { if (!origin || allowed.has(origin)) return cb(null, true); cb(new Error(`CORS blocked: ${origin}`)); },
    credentials: true
}));
app.options('*', cors({
    origin(origin, cb) { if (!origin || allowed.has(origin)) return cb(null, true); cb(new Error('CORS')); },
    credentials: true
}));

// --- SQLite ---
const dbPath = path.resolve('./server/data.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name  TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    pass_hash  TEXT NOT NULL,
    verified   INTEGER NOT NULL DEFAULT 0,
    verify_token TEXT,
    verify_expires INTEGER,
    created_at TEXT NOT NULL
  )
`).run();

// --- Mail Transporter ---
let transporter;
async function getTransporter() {
    if (transporter) return transporter;
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: Number(SMTP_PORT) || 587,
            secure: Number(SMTP_PORT) === 465, // 465 = SMTPS
            auth: { user: SMTP_USER, pass: SMTP_PASS }
        });
        try {
            await transporter.verify();
            console.log('📮 SMTP verbunden:', SMTP_HOST, 'Port', SMTP_PORT);
        } catch (e) {
            console.error('❌ SMTP verify fehlgeschlagen:', e);
        }
        return transporter;
    }
    // Fallback: Ethereal (nur Vorschau-Link)
    const test = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email', port: 587, secure: false,
        auth: { user: test.user, pass: test.pass }
    });
    console.log('✉️  Ethereal test user:', test.user);
    console.log('🔗  Vorschau-Links erscheinen in der Server-Konsole.');
    return transporter;
}

const sixDigits = customAlphabet('0123456789', 6);
async function sendVerificationEmail(email, code) {
    const t = await getTransporter();
    const html = `
    <div style="font-family:system-ui">
      <h2>Dein AniCrawl Bestätigungscode</h2>
      <p>Gib diesen Code in der App ein (gültig für 15 Minuten):</p>
      <div style="font-size:24px;font-weight:800;letter-spacing:4px">${code}</div>
    </div>`;
    const info = await t.sendMail({ from: EMAIL_FROM, to: email, subject: 'Dein Bestätigungscode', html });
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log('🔍 Vorschau-Link:', preview);
    console.log(`✅ Code an ${email}: ${code}`);
}

function issueToken(user) {
    return jwt.sign({ uid: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

// --- Routes ---

// Registrieren → speichert Code + Ablaufzeit; optional devCode zurückgeben
app.post('/auth/register', (req, res) => {
    const { firstName, lastName, email, password } = req.body || {};
    if (!firstName || !lastName || !email || !password) return res.status(400).json({ ok: false, message: 'Felder fehlen.' });
    const emailNorm = String(email).trim().toLowerCase();
    const exists = db.prepare('SELECT id FROM users WHERE email=?').get(emailNorm);
    if (exists) return res.status(409).json({ ok: false, code: 'EMAIL_EXISTS', message: 'E-Mail schon registriert.' });

    const passHash = bcrypt.hashSync(password, 10);
    const code = sixDigits();
    const expires = Date.now() + 15 * 60 * 1000;

    db.prepare(`
    INSERT INTO users (first_name,last_name,email,pass_hash,verified,verify_token,verify_expires,created_at)
    VALUES (?,?,?,?,0,?,?,datetime('now'))
  `).run(firstName.trim(), lastName.trim(), emailNorm, passHash, code, expires);

    sendVerificationEmail(emailNorm, code).catch(console.error);
    const payload = { ok: true, email: emailNorm };
    if (DEV_RETURN_CODE === '1') payload.devCode = code; // << Nur lokal helfen
    res.json(payload);
});

// Login → Cookie setzen; unverifiziert liefert NOT_VERIFIED
app.post('/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    const emailNorm = String(email || '').trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(emailNorm);
    if (!user) return res.status(401).json({ ok: false, code: 'NO_USER', message: 'E-Mail oder Passwort falsch.' });
    const ok = bcrypt.compareSync(password, user.pass_hash);
    if (!ok) return res.status(401).json({ ok: false, code: 'BAD_PASS', message: 'E-Mail oder Passwort falsch.' });

    const token = issueToken(user);
    res.cookie('token', token, { httpOnly: true, sameSite: 'Lax', secure: false, maxAge: 7 * 24 * 3600 * 1000 });

    if (!user.verified) return res.status(403).json({ ok: false, code: 'NOT_VERIFIED', message: 'E-Mail nicht bestätigt.' });
    res.json({ ok: true, user: { email: user.email, firstName: user.first_name, lastName: user.last_name } });
});

// Logout
app.post('/auth/logout', (_req, res) => { res.clearCookie('token', { httpOnly: true, sameSite: 'Lax', secure: false }); res.json({ ok: true }); });

// Code erneut senden → neuer Code + neue Ablaufzeit
app.post('/auth/resend', async (req, res) => {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const user = db.prepare('SELECT id, verified FROM users WHERE email=?').get(email);
    if (!user) return res.status(404).json({ ok: false, message: 'Unbekannte E-Mail.' });
    if (user.verified) return res.json({ ok: true, message: 'Schon verifiziert.' });

    const code = sixDigits();
    const expires = Date.now() + 15 * 60 * 1000;
    db.prepare('UPDATE users SET verify_token=?, verify_expires=? WHERE id=?').run(code, expires, user.id);
    await sendVerificationEmail(email, code);
    res.json({ ok: true });
});

// Code prüfen
app.post('/auth/verify-code', (req, res) => {
    const { email, code } = req.body || {};
    const emailNorm = String(email || '').toLowerCase().trim();
    const codeStr = String(code || '').trim();

    const user = db.prepare('SELECT id, verify_token, verify_expires FROM users WHERE email=?').get(emailNorm);
    if (!user) return res.status(404).json({ ok: false, message: 'Unbekannte E-Mail.' });
    if (!user.verify_token || !user.verify_expires) return res.status(400).json({ ok: false, code: 'NO_CODE', message: 'Kein Code angefordert.' });
    if (Date.now() > Number(user.verify_expires)) return res.status(410).json({ ok: false, code: 'CODE_EXPIRED', message: 'Code abgelaufen. Bitte neu senden.' });
    if (codeStr !== String(user.verify_token)) return res.status(400).json({ ok: false, code: 'INVALID_CODE', message: 'Code ist ungültig.' });

    db.prepare('UPDATE users SET verified=1, verify_token=NULL, verify_expires=NULL WHERE id=?').run(user.id);
    res.json({ ok: true });
});

// Optional: Status
app.get('/auth/status', (req, res) => {
    const email = String(req.query.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ ok: false });
    const row = db.prepare('SELECT verified FROM users WHERE email=?').get(email);
    res.json({ ok: true, verified: Boolean(row?.verified) });
});

app.listen(PORT, () => { console.log(`🚀 Auth-Server läuft auf http://localhost:${PORT}`); });
