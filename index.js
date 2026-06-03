const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const pool = require('./db');
require('dotenv').config();

const app = express();
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_bjWu8L7A_BCgarmxPKAGTxmnYAYGhsMrq';

app.use(cors({
  origin: [
    'https://fadsbyphuray2001.netlify.app',
    'https://fadsbyphuray.com.ng',
    'http://localhost:3000'
  ]
}));

app.use(express.json());
app.use(express.static(__dirname));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/', (req, res) => {
  res.json({ message: 'Fads by Phuray backend is running!' });
});

app.get('/setup-products', async (req, res) => {
  try {
    await pool.query(`
      INSERT INTO products (name, description, price, category, sizes, colours, images, in_stock, created_at, updated_at)
      VALUES
      ('Ankara Wrap Dress','A vibrant Ankara wrap dress.',35000,'Dresses','["XS","S","M","L","XL"]','["Blue & Gold","Red & Black"]','[]',true,NOW(),NOW()),
      ('Agbada Ensemble','Premium Aso-oke Agbada set.',85000,'Traditional Wear','["S","M","L","XL"]','["Royal Blue","White"]','[]',true,NOW(),NOW()),
      ('Lace Iro & Buba','Elegant lace Iro and Buba set.',55000,'Traditional Wear','["S","M","L","XL"]','["Gold","Ivory","Coral"]','[]',true,NOW(),NOW()),
      ('Kaftan Jumpsuit','Afrocentric kaftan jumpsuit.',28000,'Jumpsuits','["XS","S","M","L","XL"]','["Black & Kente","Navy & Terracotta"]','[]',true,NOW(),NOW()),
      ('Adire Co-ord Set','Hand-dyed Adire two-piece set.',42000,'Sets','["S","M","L"]','["Indigo","Earth Tones"]','[]',true,NOW(),NOW()),
      ('Ember Wrap Coat','Luxurious burnt orange wrap coat.',1000,'Outerwear','["M"]','["Burnt Orange"]','[]',true,NOW(),NOW())
    `);
    res.json({ message: 'Products added successfully!' });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SEND EMAIL VIA RESEND ──
async function sendEmail(to, subject, html) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Fads by Phuray <onboarding@resend.dev>',
        to: [to],
        subject: subject,
        html: html
      })
    });
    const data = await response.json();
    return data;
  } catch(err) {
    console.error('Email error:', err);
    return null;
  }
}

// ── PRODUCTS ──
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, description, price, category, sizes, colours, images, inStock, gender } = req.body;
    const result = await pool.query(
      'INSERT INTO products (name, description, price, category, sizes, colours, images, in_stock, gender, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()) RETURNING *',
      [name, description, price, category, JSON.stringify(sizes), JSON.stringify(colours), JSON.stringify(images || []), inStock !== false, JSON.stringify(gender || [])]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { name, description, price, category, sizes, colours, images, inStock, gender } = req.body;
    const result = await pool.query(
      'UPDATE products SET name=$1, description=$2, price=$3, category=$4, sizes=$5, colours=$6, images=$7, in_stock=$8, gender=$9, updated_at=NOW() WHERE id=$10 RETURNING *',
      [name, description, price, category, JSON.stringify(sizes), JSON.stringify(colours), JSON.stringify(images || []), inStock !== false, JSON.stringify(gender || []), req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ── CUSTOMERS ──
app.get('/api/customers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    const existing = await pool.query('SELECT * FROM customers WHERE email=$1', [email]);
    if (existing.rows.length > 0) return res.json(existing.rows[0]);
    const result = await pool.query(
      'INSERT INTO customers (name, email, phone, address, created_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING *',
      [name, email, phone, address]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// ── ORDERS ──
app.get('/api/orders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.get('/api/orders/customer/:email', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE customer_email=$1 ORDER BY created_at DESC', [req.params.email]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, deliveryAddress, totalAmount, shippingFee, shippingZone, transactionRef, transactionId, referralCode, items } = req.body;
    let customer = await pool.query('SELECT * FROM customers WHERE email=$1', [customerEmail]);
    if (customer.rows.length === 0) {
      customer = await pool.query(
        'INSERT INTO customers (name, email, phone, address, created_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING *',
        [customerName, customerEmail, customerPhone, deliveryAddress]
      );
    }
    const result = await pool.query(
      'INSERT INTO orders (customer_name, customer_email, customer_phone, delivery_address, total_amount, shipping_fee, shipping_zone, transaction_ref, transaction_id, referral_code, items, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW()) RETURNING *',
      [customerName, customerEmail, customerPhone, deliveryAddress, totalAmount, shippingFee || 0, shippingZone || '', transactionRef, transactionId, referralCode || '', JSON.stringify(items), 'pending']
    );

    // Send order confirmation email
    await sendEmail(
      customerEmail,
      'Order Confirmed — Fads by Phuray',
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0A0705;color:#F5ECD8;padding:32px;">
        <h1 style="font-family:Georgia,serif;color:#C9952A;font-size:28px;margin-bottom:8px;">Fads by Phuray</h1>
        <h2 style="color:#F5ECD8;font-size:20px;margin-bottom:16px;">Order Confirmed! ✅</h2>
        <p style="color:#9C7A58;margin-bottom:8px;">Hi ${customerName},</p>
        <p style="color:#9C7A58;margin-bottom:24px;">Thank you for shopping with us. Your order has been received and is being processed.</p>
        <div style="background:#1C1410;border:1px solid rgba(201,149,42,0.3);padding:20px;margin-bottom:24px;">
          <p style="color:#C9952A;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">Order Details</p>
          <p style="color:#F5ECD8;margin-bottom:6px;"><strong>Order Ref:</strong> ${transactionRef}</p>
          <p style="color:#F5ECD8;margin-bottom:6px;"><strong>Total Paid:</strong> ₦${Number(totalAmount).toLocaleString()}</p>
          <p style="color:#F5ECD8;margin-bottom:6px;"><strong>Delivery Address:</strong> ${deliveryAddress}</p>
          <p style="color:#F5ECD8;"><strong>Estimated Delivery:</strong> 3–7 business days</p>
        </div>
        <p style="color:#9C7A58;font-size:12px;">Questions? Reply to this email or WhatsApp us at +234 810 944 3159</p>
      </div>`
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      'UPDATE orders SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    // Notify customer of status update
    if(result.rows[0]) {
      const order = result.rows[0];
      await sendEmail(
        order.customer_email,
        `Order Update — Fads by Phuray`,
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0A0705;color:#F5ECD8;padding:32px;">
          <h1 style="font-family:Georgia,serif;color:#C9952A;font-size:28px;margin-bottom:16px;">Fads by Phuray</h1>
          <h2 style="color:#F5ECD8;font-size:20px;margin-bottom:16px;">Order Status Update</h2>
          <p style="color:#9C7A58;margin-bottom:16px;">Hi ${order.customer_name}, your order status has been updated to:</p>
          <div style="background:#C9952A;color:#0A0705;padding:12px 24px;text-align:center;font-weight:bold;font-size:18px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:24px;">${status}</div>
          <p style="color:#9C7A58;font-size:12px;">Order Ref: ${order.transaction_ref}</p>
          <p style="color:#9C7A58;font-size:12px;">Questions? WhatsApp us at +234 810 944 3159</p>
        </div>`
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// ── AUTH ──
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password, refCode } = req.body;
    const existing = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already registered' });
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const result = await pool.query(
      'INSERT INTO users (name, email, phone, password, wallet_balance, created_at) VALUES ($1,$2,$3,$4,0,NOW()) RETURNING id,name,email,phone,wallet_balance',
      [name, email, phone, hashedPassword]
    );
    const user = result.rows[0];
    if (refCode) {
      try {
        const referrerEmail = Buffer.from(refCode, 'base64').toString('utf8');
        const referrer = await pool.query('SELECT * FROM users WHERE email=$1', [referrerEmail]);
        if (referrer.rows.length > 0) {
          await pool.query('INSERT INTO referrals (referrer_email, referred_email, created_at) VALUES ($1,$2,NOW())', [referrer.rows[0].email, email]);
        }
      } catch(e) { console.log('Referral error:', e); }
    }
    // Send welcome email
    await sendEmail(
      email,
      'Welcome to Fads by Phuray!',
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0A0705;color:#F5ECD8;padding:32px;">
        <h1 style="font-family:Georgia,serif;color:#C9952A;font-size:28px;margin-bottom:16px;">Fads by Phuray</h1>
        <h2 style="color:#F5ECD8;font-size:20px;margin-bottom:16px;">Welcome, ${name}! 🎉</h2>
        <p style="color:#9C7A58;margin-bottom:16px;">Your account has been created successfully. You can now shop, track orders, and earn referral bonuses.</p>
        <p style="color:#9C7A58;margin-bottom:24px;">Share your referral link and earn up to ₦1,000 for every friend who shops!</p>
        <p style="color:#9C7A58;font-size:12px;">Questions? WhatsApp us at +234 810 944 3159</p>
      </div>`
    );
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const result = await pool.query(
      'SELECT id,name,email,phone,wallet_balance FROM users WHERE email=$1 AND password=$2',
      [email, hashedPassword]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── PASSWORD RESET ──
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'No account found with this email' });
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await pool.query(
      'UPDATE users SET reset_token=$1, reset_expiry=$2 WHERE email=$3',
      [resetToken, resetExpiry, email]
    );
    const resetLink = `https://fadsbyphuray2001.netlify.app?reset=${resetToken}&email=${encodeURIComponent(email)}`;
    await sendEmail(
      email,
      'Password Reset — Fads by Phuray',
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0A0705;color:#F5ECD8;padding:32px;">
        <h1 style="font-family:Georgia,serif;color:#C9952A;font-size:28px;margin-bottom:16px;">Fads by Phuray</h1>
        <h2 style="color:#F5ECD8;font-size:20px;margin-bottom:16px;">Password Reset Request</h2>
        <p style="color:#9C7A58;margin-bottom:24px;">Hi ${user.rows[0].name}, you requested a password reset. Click the button below to reset your password:</p>
        <a href="${resetLink}" style="display:block;background:#C9952A;color:#0A0705;padding:14px 28px;text-align:center;font-weight:bold;font-size:14px;text-decoration:none;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:24px;">Reset My Password</a>
        <p style="color:#9C7A58;font-size:12px;">This link expires in 24 hours. If you did not request this, ignore this email.</p>
        <p style="color:#9C7A58;font-size:12px;">Questions? WhatsApp us at +234 810 944 3159</p>
      </div>`
    );
    res.json({ message: 'Reset link sent to your email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    const user = await pool.query(
      'SELECT * FROM users WHERE email=$1 AND reset_token=$2 AND reset_expiry > NOW()',
      [email, token]
    );
    if (user.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired reset link' });
    const hashedPassword = crypto.createHash('sha256').update(newPassword).digest('hex');
    await pool.query(
      'UPDATE users SET password=$1, reset_token=NULL, reset_expiry=NULL WHERE email=$2',
      [hashedPassword, email]
    );
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ── USERS (Admin) ──
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id,name,email,phone,wallet_balance,created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.put('/api/users/:id/wallet', async (req, res) => {
  try {
    const { amount, description } = req.body;
    const user = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    if(user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await pool.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id=$2', [amount, req.params.id]);
    await pool.query(
      'INSERT INTO wallet_history (email, amount, description, created_at) VALUES ($1,$2,$3,NOW())',
      [user.rows[0].email, amount, description || 'Manual adjustment by admin']
    );
    res.json({ message: 'Wallet updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update wallet' });
  }
});

// ── WALLET ──
app.get('/api/wallet/:email', async (req, res) => {
  try {
    const result = await pool.query('SELECT wallet_balance FROM users WHERE email=$1', [req.params.email]);
    if (result.rows.length === 0) return res.json({ balance: 0, history: [] });
    const history = await pool.query('SELECT * FROM wallet_history WHERE email=$1 ORDER BY created_at DESC LIMIT 20', [req.params.email]);
    res.json({ balance: result.rows[0].wallet_balance || 0, history: history.rows });
  } catch (err) {
    res.json({ balance: 0, history: [] });
  }
});

// ── REFERRAL BONUS ──
app.post('/api/referral-bonus', async (req, res) => {
  try {
    const { refCode, bonus, subtotal } = req.body;
    const referrerEmail = Buffer.from(refCode, 'base64').toString('utf8');
    const referrer = await pool.query('SELECT * FROM users WHERE email=$1', [referrerEmail]);
    if (referrer.rows.length === 0) return res.json({ message: 'Referrer not found' });
    await pool.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE email=$2', [bonus, referrerEmail]);
    await pool.query(
      'INSERT INTO wallet_history (email, amount, description, created_at) VALUES ($1,$2,$3,NOW())',
      [referrerEmail, bonus, 'Referral bonus — friend purchased ₦' + Number(subtotal).toLocaleString()]
    );
    // Notify referrer
    await sendEmail(
      referrerEmail,
      'You earned a referral bonus! — Fads by Phuray',
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0A0705;color:#F5ECD8;padding:32px;">
        <h1 style="font-family:Georgia,serif;color:#C9952A;font-size:28px;margin-bottom:16px;">Fads by Phuray</h1>
        <h2 style="color:#F5ECD8;font-size:20px;margin-bottom:16px;">🎉 You earned ₦${Number(bonus).toLocaleString()}!</h2>
        <p style="color:#9C7A58;margin-bottom:16px;">Your referral just made a purchase and you've earned a ₦${Number(bonus).toLocaleString()} bonus!</p>
        <p style="color:#9C7A58;margin-bottom:16px;">Your new wallet balance is growing. Log in to your account to request a withdrawal.</p>
        <p style="color:#9C7A58;font-size:12px;">Keep sharing your referral link to earn more!</p>
      </div>`
    );
    res.json({ message: 'Bonus added' });
  } catch (err) {
    res.status(500).json({ error: 'Bonus error' });
  }
});

// ── WITHDRAWALS ──
app.get('/api/withdrawals', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM withdrawals ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

app.post('/api/withdrawal', async (req, res) => {
  try {
    const { email, name, accountName, bankName, accountNumber, amount } = req.body;
    // Check wallet balance
    const user = await pool.query('SELECT wallet_balance FROM users WHERE email=$1', [email]);
    if(user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const balance = Number(user.rows[0].wallet_balance || 0);
    if(Number(amount) > balance) {
      return res.status(400).json({ error: `Insufficient balance. Your wallet balance is ₦${balance.toLocaleString()}` });
    }
    await pool.query(
      'INSERT INTO withdrawals (email, name, account_name, bank_name, account_number, amount, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())',
      [email, name, accountName, bankName, accountNumber, amount, 'pending']
    );
    res.json({ message: 'Withdrawal request submitted' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Withdrawal error' });
  }
});

app.put('/api/withdrawals/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const withdrawal = await pool.query('SELECT * FROM withdrawals WHERE id=$1', [req.params.id]);
    if(withdrawal.rows.length === 0) return res.status(404).json({ error: 'Withdrawal not found' });
    const w = withdrawal.rows[0];
    await pool.query('UPDATE withdrawals SET status=$1 WHERE id=$2', [status, req.params.id]);
    if(status === 'paid') {
      // Deduct from wallet
      await pool.query('UPDATE users SET wallet_balance = wallet_balance - $1 WHERE email=$2', [w.amount, w.email]);
      await pool.query(
        'INSERT INTO wallet_history (email, amount, description, created_at) VALUES ($1,$2,$3,NOW())',
        [w.email, -w.amount, 'Withdrawal paid — ₦' + Number(w.amount).toLocaleString()]
      );
      // Notify user
      await sendEmail(
        w.email,
        'Withdrawal Processed — Fads by Phuray',
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0A0705;color:#F5ECD8;padding:32px;">
          <h1 style="font-family:Georgia,serif;color:#C9952A;font-size:28px;margin-bottom:16px;">Fads by Phuray</h1>
          <h2 style="color:#F5ECD8;font-size:20px;margin-bottom:16px;">Withdrawal Processed ✅</h2>
          <p style="color:#9C7A58;margin-bottom:16px;">Hi ${w.name}, your withdrawal of ₦${Number(w.amount).toLocaleString()} has been processed and sent to your ${w.bank_name} account ending in ${w.account_number.slice(-4)}.</p>
          <p style="color:#9C7A58;font-size:12px;">Questions? WhatsApp us at +234 810 944 3159</p>
        </div>`
      );
    } else if(status === 'rejected') {
      await sendEmail(
        w.email,
        'Withdrawal Request Update — Fads by Phuray',
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0A0705;color:#F5ECD8;padding:32px;">
          <h1 style="font-family:Georgia,serif;color:#C9952A;font-size:28px;margin-bottom:16px;">Fads by Phuray</h1>
          <h2 style="color:#F5ECD8;font-size:20px;margin-bottom:16px;">Withdrawal Request Update</h2>
          <p style="color:#9C7A58;margin-bottom:16px;">Hi ${w.name}, unfortunately your withdrawal request of ₦${Number(w.amount).toLocaleString()} could not be processed at this time.</p>
          <p style="color:#9C7A58;margin-bottom:16px;">Please contact us on WhatsApp at +234 810 944 3159 for more information.</p>
        </div>`
      );
    }
    res.json({ message: 'Withdrawal updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update withdrawal' });
  }
});

// ── DATABASE SETUP ──
async function setupDatabase() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(10,2) NOT NULL, category VARCHAR(100), sizes JSONB DEFAULT '[]', colours JSONB DEFAULT '[]', images JSONB DEFAULT '[]', in_stock BOOLEAN DEFAULT true, gender JSONB DEFAULT '[]', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS gender JSONB DEFAULT '[]'`).catch(()=>{});
    await pool.query(`CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255) UNIQUE, phone VARCHAR(50), address TEXT, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, customer_name VARCHAR(255), customer_email VARCHAR(255), customer_phone VARCHAR(50), delivery_address TEXT, total_amount DECIMAL(10,2), shipping_fee DECIMAL(10,2) DEFAULT 0, shipping_zone VARCHAR(100), transaction_ref VARCHAR(255), transaction_id VARCHAR(255), referral_code VARCHAR(255), items JSONB DEFAULT '[]', status VARCHAR(50) DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name VARCHAR(255), email VARCHAR(255) UNIQUE, phone VARCHAR(50), password VARCHAR(255), wallet_balance DECIMAL(10,2) DEFAULT 0, reset_token VARCHAR(255), reset_expiry TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS wallet_history (id SERIAL PRIMARY KEY, email VARCHAR(255), amount DECIMAL(10,2), description TEXT, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS referrals (id SERIAL PRIMARY KEY, referrer_email VARCHAR(255), referred_email VARCHAR(255), created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS withdrawals (id SERIAL PRIMARY KEY, email VARCHAR(255), name VARCHAR(255), account_name VARCHAR(255), bank_name VARCHAR(255), account_number VARCHAR(50), amount DECIMAL(10,2), status VARCHAR(50) DEFAULT 'pending', created_at TIMESTAMP DEFAULT NOW())`);
    // Add missing columns if they don't exist
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)`).catch(()=>{});
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expiry TIMESTAMP`).catch(()=>{});
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(10,2) DEFAULT 0`).catch(()=>{});
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_zone VARCHAR(100)`).catch(()=>{});
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_code VARCHAR(255)`).catch(()=>{});
    console.log('Database tables ready!');
  } catch (err) {
    console.error('Database setup error:', err);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await setupDatabase();
  console.log('Fads by Phuray backend running on port ' + PORT);
});
