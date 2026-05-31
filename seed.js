const pool = require('./db');

async function seedProducts() {
  try {
    await pool.query(`
      INSERT INTO products (name, description, price, category, sizes, colours, images, in_stock, created_at, updated_at)
      VALUES
      ('Ankara Wrap Dress', 'A vibrant hand-printed Ankara wrap dress with bold geometric patterns.', 35000, 'Dresses', '["XS","S","M","L","XL"]', '["Blue & Gold","Red & Black","Green & Yellow"]', '[]', true, NOW(), NOW()),
      ('Agbada Ensemble', 'Flowing three-piece Agbada set crafted from premium Aso-oke fabric.', 85000, 'Traditional Wear', '["S","M","L","XL","2XL"]', '["Royal Blue","White","Burgundy"]', '[]', true, NOW(), NOW()),
      ('Lace Iro & Buba', 'Elegant lace Iro and Buba set with intricate floral lace patterns.', 55000, 'Traditional Wear', '["S","M","L","XL"]', '["Gold","Ivory","Coral"]', '[]', true, NOW(), NOW()),
      ('Kaftan Jumpsuit', 'Contemporary kaftan-inspired jumpsuit blending Afrocentric print with modern silhouette.', 28000, 'Jumpsuits', '["XS","S","M","L","XL"]', '["Black & Kente","Navy & Terracotta"]', '[]', true, NOW(), NOW()),
      ('Adire Co-ord Set', 'Hand-dyed Adire two-piece co-ord set. Each piece is unique.', 42000, 'Sets', '["S","M","L"]', '["Indigo","Earth Tones"]', '[]', true, NOW(), NOW()),
      ('Ember Wrap Coat', 'A luxurious wrap coat in burnt orange.', 1000, 'Outerwear', '["M"]', '["Burnt Orange"]', '[]', true, NOW(), NOW())
    `);
    console.log('Products seeded successfully!');
    process.exit(0);
  } catch(err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seedProducts();
