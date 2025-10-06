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

process.on('unhandledRejection', (r) => console.error('UNHANDLED REJECTION:', r));
process.on('uncaughtException', (e) => console.error('UNCAUGHT EXCEPTION:', e));

const {
    PORT = 4000,
    JWT_SECRET,
    APP_BASE_URL = 'http://localhost:5173',
    EMAIL_FROM = 'AniCrawl <no-reply@anicrawl.local>',
    SMTP_HOST, SMTP_PORT = 587, SMTP_USER, SMTP_PASS,
    DEV_RETURN_CODE = '0',
    DATABASE_URL,
    ADMIN_EMAIL = 'Admin@Mail',
    ADMIN_PASSWORD = 'password'
} = process.env;

if (!JWT_SECRET) { console.error('❌ .env: JWT_SECRET fehlt'); process.exit(1); }

const app = express();
app.use(express.json());
app.use(cookieParser());

const allowed = new Set([APP_BASE_URL, 'http://localhost:5173', 'http://127.0.0.1:5173']);
app.use(cors({
    origin(origin, cb) { if (!origin || allowed.has(origin)) return cb(null, true); cb(new Error(`CORS blocked: ${origin}`)); },
    credentials: true
}));
app.options('*', cors({
    origin(origin, cb) { if (!origin || allowed.has(origin)) return cb(null, true); cb(new Error('CORS')); },
    credentials: true
}));

// ---------- DB Layer (SQLite default, PostgreSQL optional via DATABASE_URL) ----------
let usePg = Boolean(DATABASE_URL);
let db, pool;
let pg;

async function initDb() {
    if (usePg) {
        try {
            const mod = await import('pg');
            pg = mod.default || mod;
            pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined });
            // DDL
            await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
              id SERIAL PRIMARY KEY,
              first_name TEXT NOT NULL,
              last_name  TEXT NOT NULL,
              email      TEXT NOT NULL UNIQUE,
              pass_hash  TEXT NOT NULL,
              verified   BOOLEAN NOT NULL DEFAULT FALSE,
              verify_token TEXT,
              verify_expires BIGINT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS watchlist (
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              item_id TEXT NOT NULL,
              title   TEXT NOT NULL,
              image   TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              PRIMARY KEY (user_id, item_id)
            );
            `);
            // ensure pass_plain exists for older deployments
            // no plaintext column in production
            console.log('🗄️  PostgreSQL verbunden');
            return;
        } catch (e) {
            console.warn('⚠️  PostgreSQL Verbindung fehlgeschlagen, falle zurück auf SQLite. Grund:', e?.message || e);
            usePg = false;
        }
    }
    const dbPath = path.resolve('./server/data.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
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
    // ensure pass_plain exists for older DB files
    // ensure no plaintext column is added going forward
    db.prepare(`
      CREATE TABLE IF NOT EXISTS watchlist (
        user_id INTEGER NOT NULL,
        item_id TEXT NOT NULL,
        title   TEXT NOT NULL,
        image   TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, item_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `).run();
    console.log('🗄️  SQLite (file) verbunden');
}

function rowToBool(v) { return typeof v === 'boolean' ? v : Boolean(Number(v)); }

const dbApi = {
    async getUserByEmail(email) {
        if (usePg) {
            const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
            return rows[0];
        }
        return db.prepare('SELECT * FROM users WHERE email=?').get(email);
    },
    async insertUser({ firstName, lastName, email, passHash, code, expires }) {
        if (usePg) {
            await pool.query(
                'INSERT INTO users (first_name,last_name,email,pass_hash,verified,verify_token,verify_expires,created_at) VALUES ($1,$2,$3,$4,false,$5,$6,NOW())',
                [firstName, lastName, email, passHash, code, expires]
            );
            return;
        }
        db.prepare(`INSERT INTO users (first_name,last_name,email,pass_hash,verified,verify_token,verify_expires,created_at) VALUES (?,?,?,? ,0,?, ?, datetime('now'))`).run(firstName, lastName, email, passHash, code, expires);
    },
    // removed pass_plain handling
    async updateVerifyCode({ userId, code, expires }) {
        if (usePg) {
            await pool.query('UPDATE users SET verify_token=$1, verify_expires=$2 WHERE id=$3', [code, expires, userId]);
            return;
        }
        db.prepare('UPDATE users SET verify_token=?, verify_expires=? WHERE id=?').run(code, expires, userId);
    },
    async setVerified(userId) {
        if (usePg) {
            await pool.query('UPDATE users SET verified=true, verify_token=NULL, verify_expires=NULL WHERE id=$1', [userId]);
            return;
        }
        db.prepare('UPDATE users SET verified=1, verify_token=NULL, verify_expires=NULL WHERE id=?').run(userId);
    },
    async getVerifyStatus(email) {
        if (usePg) {
            const { rows } = await pool.query('SELECT verified FROM users WHERE email=$1', [email]);
            return rows[0]?.verified ?? false;
        }
        const row = db.prepare('SELECT verified FROM users WHERE email=?').get(email);
        return Boolean(row?.verified);
    },
    async watchlistList(userId) {
        if (usePg) {
            const { rows } = await pool.query('SELECT item_id as id, title, image, created_at FROM watchlist WHERE user_id=$1 ORDER BY created_at DESC', [userId]);
            return rows;
        }
        return db.prepare('SELECT item_id as id, title, image, created_at FROM watchlist WHERE user_id=? ORDER BY created_at DESC').all(userId);
    },
    async watchlistContains(userId, itemId) {
        if (usePg) {
            const { rows } = await pool.query('SELECT 1 FROM watchlist WHERE user_id=$1 AND item_id=$2', [userId, String(itemId)]);
            return Boolean(rows[0]);
        }
        return Boolean(db.prepare('SELECT 1 FROM watchlist WHERE user_id=? AND item_id=?').get(userId, String(itemId)));
    },
    async watchlistUpsert(userId, { id, title, img }) {
        if (usePg) {
            await pool.query(`
                INSERT INTO watchlist (user_id, item_id, title, image)
                VALUES ($1,$2,$3,$4)
                ON CONFLICT (user_id, item_id) DO UPDATE SET title=EXCLUDED.title, image=EXCLUDED.image
            `, [userId, String(id), String(title), img || null]);
            return;
        }
        db.prepare(`
            INSERT INTO watchlist (user_id, item_id, title, image, created_at)
            VALUES (?,?,?,?,datetime('now'))
            ON CONFLICT(user_id, item_id) DO UPDATE SET title=excluded.title, image=excluded.image
        `).run(userId, String(id), String(title), img || null);
    },
    async watchlistDelete(userId, itemId) {
        if (usePg) {
            await pool.query('DELETE FROM watchlist WHERE user_id=$1 AND item_id=$2', [userId, String(itemId)]);
            return;
        }
        db.prepare('DELETE FROM watchlist WHERE user_id=? AND item_id=?').run(userId, String(itemId));
    }
};

// ---------- Mail ----------
let transporter;
async function getTransporter() {
    if (transporter) return transporter;
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: Number(SMTP_PORT) || 587,
            secure: Number(SMTP_PORT) === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS }
        });
        try {
            await transporter.verify();
            console.log('📮 SMTP verbunden:', SMTP_HOST, 'Port', SMTP_PORT);
            return transporter;
        } catch (e) {
            console.error('❌ SMTP verify fehlgeschlagen:', e?.response || e?.message || e);
            // Fallback zu Ethereal Test-Account
            transporter = undefined;
        }
    }
    const test = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email', port: 587, secure: false,
        auth: { user: test.user, pass: test.pass }
    });
    console.log('✉️  Ethereal test user:', test.user);
    console.log('🔗  Vorschau-Links erscheinen in der Server-Konsole.');
    return transporter;
}

async function sendVerificationEmail(email, code) {
    try {
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
        return { ok: true };
    } catch (e) {
        console.error('✉️  MAIL SEND FAILED:', e?.response || e?.message || e);
        console.log(`ℹ️  Verifikationscode (DEV): ${code} für ${email}`);
        return { ok: false };
    }
}

const sixDigits = customAlphabet('0123456789', 6);
function issueToken(user) {
    return jwt.sign({ uid: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

// ---------- Auth Helpers ----------
function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.token;
        if (!token) return res.status(401).json({ ok: false, code: 'NO_AUTH' });
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        return next();
    } catch {
        return res.status(401).json({ ok: false, code: 'BAD_TOKEN' });
    }
}

function requireAdmin(req, res, next) {
    try {
        const token = req.cookies?.token;
        if (!token) return res.status(401).json({ ok: false, code: 'NO_AUTH' });
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        if (payload.email && payload.email.toLowerCase() === String(ADMIN_EMAIL).toLowerCase()) return next();
        return res.status(403).json({ ok: false, code: 'NOT_ADMIN' });
    } catch {
        return res.status(401).json({ ok: false, code: 'BAD_TOKEN' });
    }
}

// ---------- Auth Routes ----------
app.post('/auth/register', async (req, res) => {
    const { firstName, lastName, email, password } = req.body || {};
    if (!firstName || !lastName || !email || !password) return res.status(400).json({ ok: false, message: 'Felder fehlen.' });
    const emailNorm = String(email).trim().toLowerCase();
    const exists = await dbApi.getUserByEmail(emailNorm);
    if (exists) return res.status(409).json({ ok: false, code: 'EMAIL_EXISTS', message: 'E-Mail schon registriert.' });

    const passHash = bcrypt.hashSync(password, 10);
    const code = sixDigits();
    const expires = Date.now() + 15 * 60 * 1000;
    await dbApi.insertUser({ firstName: firstName.trim(), lastName: lastName.trim(), email: emailNorm, passHash, code, expires });
    const mailRes = await sendVerificationEmail(emailNorm, code);
    const payload = { ok: true, email: emailNorm };
    if (!mailRes.ok || DEV_RETURN_CODE === '1') payload.devCode = code;
    res.json(payload);
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    const emailNorm = String(email || '').trim().toLowerCase();
    // Admin bypass
    if (emailNorm === String(ADMIN_EMAIL).toLowerCase() && String(password) === String(ADMIN_PASSWORD)) {
        const token = jwt.sign({ uid: 0, email: ADMIN_EMAIL }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, { httpOnly: true, sameSite: 'Lax', secure: false, maxAge: 7 * 24 * 3600 * 1000 });
        return res.json({ ok: true, user: { email: ADMIN_EMAIL, firstName: 'Admin', lastName: 'User' }, admin: true });
    }

    const user = await dbApi.getUserByEmail(emailNorm);
    if (!user) return res.status(401).json({ ok: false, code: 'NO_USER', message: 'E-Mail oder Passwort falsch.' });
    const ok = bcrypt.compareSync(password, user.pass_hash);
    if (!ok) return res.status(401).json({ ok: false, code: 'BAD_PASS', message: 'E-Mail oder Passwort falsch.' });

    const token = issueToken(user);
    res.cookie('token', token, { httpOnly: true, sameSite: 'Lax', secure: false, maxAge: 7 * 24 * 3600 * 1000 });
    if (!rowToBool(user.verified)) return res.status(403).json({ ok: false, code: 'NOT_VERIFIED', message: 'E-Mail nicht bestätigt.' });

    res.json({ ok: true, user: { email: user.email, firstName: user.first_name, lastName: user.last_name }, admin: (user.email && user.email.toLowerCase() === String(ADMIN_EMAIL).toLowerCase()) });
});
// ---------- Admin Endpoints ----------
app.post('/admin/login', (req, res) => {
    const { email, password } = req.body || {};
    if (String(email).toLowerCase() === String(ADMIN_EMAIL).toLowerCase() && String(password) === String(ADMIN_PASSWORD)) {
        const token = jwt.sign({ uid: 0, email: ADMIN_EMAIL }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, { httpOnly: true, sameSite: 'Lax', secure: false, maxAge: 7 * 24 * 3600 * 1000 });
        return res.json({ ok: true, admin: true });
    }
    return res.status(401).json({ ok: false, message: 'Admin Login fehlgeschlagen.' });
});

app.get('/admin/users', requireAdmin, async (_req, res) => {
    try {
        if (usePg) {
            const { rows } = await pool.query('SELECT id, first_name, last_name, email, verified, created_at FROM users ORDER BY created_at DESC');
            return res.json({ ok: true, users: rows });
        }
        const rows = db.prepare('SELECT id, first_name, last_name, email, verified, created_at FROM users ORDER BY created_at DESC').all();
        return res.json({ ok: true, users: rows.map(r => ({ ...r, verified: Boolean(r.verified) })) });
    } catch (e) {
        console.error('ADMIN USERS ERROR:', e);
        return res.status(500).json({ ok: false, message: 'Fehler beim Laden der Nutzer.' });
    }
});

app.delete('/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        const uid = Number(req.params.id);
        if (!uid || Number.isNaN(uid)) return res.status(400).json({ ok: false, message: 'Ungültige ID' });
        if (usePg) {
            await pool.query('DELETE FROM users WHERE id=$1', [uid]);
        } else {
            db.prepare('DELETE FROM users WHERE id=?').run(uid);
        }
        return res.json({ ok: true });
    } catch (e) {
        console.error('ADMIN DELETE USER ERROR:', e);
        return res.status(500).json({ ok: false, message: 'Löschen fehlgeschlagen.' });
    }
});

app.post('/auth/logout', (_req, res) => { res.clearCookie('token', { httpOnly: true, sameSite: 'Lax', secure: false }); res.json({ ok: true }); });

app.post('/auth/resend', async (req, res) => {
    try {
        const email = String(req.body?.email || '').toLowerCase().trim();
        const user = await dbApi.getUserByEmail(email);
        if (!user) return res.status(404).json({ ok: false, message: 'Unbekannte E-Mail.' });
        if (rowToBool(user.verified)) return res.json({ ok: true, message: 'Schon verifiziert.' });

        const code = sixDigits();
        const expires = Date.now() + 15 * 60 * 1000;
        await dbApi.updateVerifyCode({ userId: user.id, code, expires });

        const mailRes = await sendVerificationEmail(email, code);
        if (!mailRes.ok) return res.status(202).json({ ok: true, message: 'Code erneuert; E-Mail-Versand fehlgeschlagen (siehe Server-Log).' });
        res.json({ ok: true });
    } catch (e) {
        console.error('RESEND ERROR:', e);
        res.status(500).json({ ok: false, message: 'Resend fehlgeschlagen.' });
    }
});

// Session prüfen
// removed /auth/me for the requested rollback point

app.post('/auth/verify-code', async (req, res) => {
    const { email, code } = req.body || {};
    const emailNorm = String(email || '').toLowerCase().trim();
    const codeStr = String(code || '').trim();

    const user = await dbApi.getUserByEmail(emailNorm);
    if (!user) return res.status(404).json({ ok: false, message: 'Unbekannte E-Mail.' });
    if (!user.verify_token || !user.verify_expires) return res.status(400).json({ ok: false, code: 'NO_CODE', message: 'Kein Code angefordert.' });
    if (Date.now() > Number(user.verify_expires)) return res.status(410).json({ ok: false, code: 'CODE_EXPIRED', message: 'Code abgelaufen. Bitte neu senden.' });
    if (codeStr !== String(user.verify_token)) return res.status(400).json({ ok: false, code: 'INVALID_CODE', message: 'Code ist ungültig.' });

    await dbApi.setVerified(user.id);
    res.json({ ok: true });
});

app.get('/auth/status', async (req, res) => {
    const email = String(req.query.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ ok: false });
    const verified = await dbApi.getVerifyStatus(email);
    res.json({ ok: true, verified: Boolean(verified) });
});

// ---------- Watchlist Routes (auth required) ----------
app.get('/watchlist', requireAuth, async (req, res) => {
    const rows = await dbApi.watchlistList(req.user.uid);
    res.json({ ok: true, items: rows });
});

app.get('/watchlist/contains/:id', requireAuth, async (req, res) => {
    const exists = await dbApi.watchlistContains(req.user.uid, req.params.id);
    res.json({ ok: true, exists });
});

app.post('/watchlist', requireAuth, async (req, res) => {
    const { id, title, img } = req.body || {};
    if (!id || !title) return res.status(400).json({ ok: false, message: 'id und title erforderlich.' });
    await dbApi.watchlistUpsert(req.user.uid, { id, title, img });
    res.json({ ok: true });
});

app.delete('/watchlist/:id', requireAuth, async (req, res) => {
    await dbApi.watchlistDelete(req.user.uid, req.params.id);
    res.json({ ok: true });
});

function startServer(preferredPort, maxAttempts = 10) {
    let current = Number(preferredPort) || 4000;
    let attempts = 0;
    const server = app.listen(current, () => {
        console.log(`🚀 Auth- & Watchlist-Server läuft auf http://localhost:${current}`);
    });
    server.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE' && attempts < maxAttempts) {
            attempts += 1;
            current += 1;
            console.warn(`⚠️  Port belegt. Versuche Port ${current} ...`);
            setTimeout(() => {
                server.close?.();
                app.listen(current, () => {
                    console.log(`🚀 Auth- & Watchlist-Server läuft auf http://localhost:${current}`);
                }).on('error', (e2) => {
                    if (e2 && e2.code === 'EADDRINUSE' && attempts < maxAttempts) {
                        attempts += 1;
                        current += 1;
                        console.warn(`⚠️  Port belegt. Versuche Port ${current} ...`);
                        // try again by recursively emitting error
                        server.emit('error', e2);
                    } else {
                        console.error('❌ Server konnte keinen freien Port finden:', e2?.message || e2);
                        process.exit(1);
                    }
                });
            }, 100);
        } else {
            console.error('❌ Serverstart fehlgeschlagen:', err?.message || err);
            process.exit(1);
        }
    });
}

await initDb();
startServer(PORT);
