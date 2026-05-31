const express = require('express');
const path = require('path');
const cors = require('cors');
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

// ── TEST ROUTE ──
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
    console.error(err);
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
    console.error(err);
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
    console.error(err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ── CUSTOMERS ──
app.get('/api/customers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    const existing = await pool.query('SELECT * FROM customers WHERE email=$1', [email]);
    if (existing.rows.length > 0) {
      return res.json(existing.rows[0]);
    }
    const result = await pool.query(
      'INSERT INTO customers (name, email, phone, address, created_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING *',
      [name, email, phone, address]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// ── ORDERS ──
app.get('/api/orders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, deliveryAddress, totalAmount, transactionRef, transactionId, items } = req.body;
    let customer = await pool.query('SELECT * FROM customers WHERE email=$1', [customerEmail]);
    if (customer.rows.length === 0) {
      customer = await pool.query(
        'INSERT INTO customers (name, email, phone, address, created_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING *',
        [customerName, customerEmail, customerPhone, deliveryAddress]
      );
    }
    const result = await pool.query(
      'INSERT INTO orders (customer_name, customer_email, customer_phone, delivery_address, total_amount, transaction_ref, transaction_id, items, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) RETURNING *',
      [customerName, customerEmail, customerPhone, deliveryAddress, totalAmount, transactionRef, transactionId, JSON.stringify(items), 'pending']
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
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update order' });
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
        transaction_ref VARCHAR(255),
        transaction_id VARCHAR(255),
        items JSONB DEFAULT '[]',
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
  console.log(`Fads by Phuray backend running on port ${PORT}`);
});
