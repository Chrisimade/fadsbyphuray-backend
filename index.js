const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const pool = require('./db');
require('dotenv').config();

const app = express();

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
    const { name, description, price, category, sizes, colours, images, inStock } = req.body;
    const result = await pool.query(
      'INSERT INTO products (name, description, price, category, sizes, colours, images, in_stock, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW()) RETURNING *',
      [name, description, price, category, JSON.stringify(sizes), JSON.stringify(colours), JSON.stringify(images || []), inStock !== false]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { name, description, price, category, sizes, colours, images, inStock } = req.body;
    const result = await pool.query(
      'UPDATE products SET name=$1, description=$2, price=$3, category=$4, sizes=$5, colours=$6, images=$7, in_stock=$8, updated_at=NOW() WHERE id=$9 RETURNING *',
      [name, description, price, category, JSON.stringify(sizes), JSON.stringify(colours), JSON.stringify(images || []), inStock !== false, req.params.id]
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
    res.json(result.rows[0]);
  } catch (err) {
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
    res.json(user);
  } catch (err) {
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
    await pool.query(
      'INSERT INTO withdrawals (email, name, account_name, bank_name, account_number, amount, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())',
      [email, name, accountName, bankName, accountNumber, amount, 'pending']
    );
    res.json({ message: 'Withdrawal request submitted' });
  } catch (err) {
    res.status(500).json({ error: 'Withdrawal error' });
  }
});

app.put('/api/withdrawals/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      'UPDATE withdrawals SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update withdrawal' });
  }
});

// ── DATABASE SETUP ──
async function setupDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(100),
        sizes JSONB DEFAULT '[]',
        colours JSONB DEFAULT '[]',
        images JSONB DEFAULT '[]',
        in_stock BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(50),
        address TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255),
        customer_email VARCHAR(255),
        customer_phone VARCHAR(50),
        delivery_address TEXT,
        total_amount DECIMAL(10,2),
        shipping_fee DECIMAL(10,2) DEFAULT 0,
        shipping_zone VARCHAR(100),
        transaction_ref VARCHAR(255),
        transaction_id VARCHAR(255),
        referral_code VARCHAR(255),
        items JSONB DEFAULT '[]',
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(50),
        password VARCHAR(255),
        wallet_balance DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_history (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255),
        amount DECIMAL(10,2),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_email VARCHAR(255),
        referred_email VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255),
        name VARCHAR(255),
        account_name VARCHAR(255),
        bank_name VARCHAR(255),
        account_number VARCHAR(50),
        amount DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
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
