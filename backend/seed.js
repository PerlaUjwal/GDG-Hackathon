import db, { initDatabase } from './db.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

initDatabase();

export function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    console.log('Database already contains records. Skipping seed.');
    return;
  }

  console.log('Seeding initial data for FoundersGate...');

  const passwordHash = bcrypt.hashSync('Password123!', 10);
  const now = Date.now();

  // 1. Create Users
  const founder = {
    id: 'f1111111-1111-4111-a111-111111111111',
    email: 'alex.founder@tech.io',
    password_hash: passwordHash,
    full_name: 'Alex Vance',
    role: 'founder',
    country_code: '+1',
    phone_number: '4155552671',
    created_at: now - 86400000 * 5,
  };

  const investor1 = {
    id: 'i1111111-1111-4111-a111-111111111111',
    email: 'sarah.investor@vcfund.com',
    password_hash: passwordHash,
    full_name: 'Sarah Chen (Sequoia Alpha)',
    role: 'investor',
    country_code: '+1',
    phone_number: '6505553901',
    created_at: now - 86400000 * 4,
  };

  const investor2 = {
    id: 'i2222222-2222-4222-a222-222222222222',
    email: 'david.angel@capital.io',
    password_hash: passwordHash,
    full_name: 'David Rossi (Angel Syndicate)',
    role: 'investor',
    country_code: '+44',
    phone_number: '7911123456',
    created_at: now - 86400000 * 3,
  };

  const investor3 = {
    id: 'i3333333-3333-4333-a333-333333333333',
    email: 'elena.ventures@horizon.com',
    password_hash: passwordHash,
    full_name: 'Elena Rostova (Horizon Ventures)',
    role: 'investor',
    country_code: '+49',
    phone_number: '15123456789',
    created_at: now - 86400000 * 2,
  };

  const normalSeller = {
    id: 'n1111111-1111-4111-a111-111111111111',
    email: 'maria.shop@greenmarket.com',
    password_hash: passwordHash,
    full_name: 'Maria Santos (GreenMarket Goods)',
    role: 'normal',
    country_code: '+1',
    phone_number: '3125558721',
    created_at: now - 86400000 * 5,
  };

  const normalBuyer = {
    id: 'n2222222-2222-4222-a222-222222222222',
    email: 'kenji.buyer@tokyo.net',
    password_hash: passwordHash,
    full_name: 'Kenji Sato',
    role: 'normal',
    country_code: '+81',
    phone_number: '9012345678',
    created_at: now - 86400000 * 2,
  };

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, role, country_code, phone_number, created_at)
    VALUES (@id, @email, @password_hash, @full_name, @role, @country_code, @phone_number, @created_at)
  `);

  [founder, investor1, investor2, investor3, normalSeller, normalBuyer].forEach(u => insertUser.run(u));

  // 2. Create Startups
  // Startup 1: Threshold reached (3 investors) -> AUCTION_ACTIVE
  const startup1 = {
    id: 's1111111-1111-4111-a111-111111111111',
    founder_id: founder.id,
    title: 'NeuroPulse Health AI',
    industry: 'MedTech / AI',
    pitch: 'Non-invasive neural telemetry and early onset neurodegenerative biomarker detection through edge optical wearables. Patented sensor array with 98.4% diagnostic accuracy in clinical trials.',
    funding_target: 750000,
    equity_offered: 10.0,
    min_investor_threshold: 3,
    status: 'AUCTION_ACTIVE',
    selected_investor_id: null,
    created_at: now - 86400000 * 3,
  };

  // Startup 2: Only 1 investor -> PITCHING
  const startup2 = {
    id: 's2222222-2222-4222-a222-222222222222',
    founder_id: founder.id,
    title: 'SolarCleanse Autonomous Robotics',
    industry: 'CleanTech / Robotics',
    pitch: 'Autonomous water-free dust remediation crawlers for utility-scale desert solar farms, boosting generation efficiency by 22% with zero freshwater consumption.',
    funding_target: 500000,
    equity_offered: 8.5,
    min_investor_threshold: 3,
    status: 'PITCHING',
    selected_investor_id: null,
    created_at: now - 86400000 * 1,
  };

  const insertStartup = db.prepare(`
    INSERT INTO startups (id, founder_id, title, industry, pitch, funding_target, equity_offered, min_investor_threshold, status, selected_investor_id, created_at)
    VALUES (@id, @founder_id, @title, @industry, @pitch, @funding_target, @equity_offered, @min_investor_threshold, @status, @selected_investor_id, @created_at)
  `);

  [startup1, startup2].forEach(s => insertStartup.run(s));

  // 3. Register Interests
  const insertInterest = db.prepare(`
    INSERT INTO startup_interests (id, startup_id, investor_id, note, created_at)
    VALUES (@id, @startup_id, @investor_id, @note, @created_at)
  `);

  // Startup 1 has 3 interests
  insertInterest.run({ id: uuidv4(), startup_id: startup1.id, investor_id: investor1.id, note: 'Deep clinical trial synergy with our healthcare portfolio.', created_at: now - 86400000 * 2 });
  insertInterest.run({ id: uuidv4(), startup_id: startup1.id, investor_id: investor2.id, note: 'Impressive sensor specs. Interested in hardware scaling.', created_at: now - 86400000 * 2 });
  insertInterest.run({ id: uuidv4(), startup_id: startup1.id, investor_id: investor3.id, note: 'Ready to participate in seed syndicate.', created_at: now - 86400000 * 1 });

  // Startup 2 has 1 interest
  insertInterest.run({ id: uuidv4(), startup_id: startup2.id, investor_id: investor2.id, note: 'Strong robotics fundamentals. Looking forward to traction updates.', created_at: now - 3600000 });

  // 4. Auction Bids on Startup 1
  const insertBid = db.prepare(`
    INSERT INTO auction_bids (id, startup_id, investor_id, bid_amount, equity_demanded, conditions, status, created_at)
    VALUES (@id, @startup_id, @investor_id, @bid_amount, @equity_demanded, @conditions, @status, @created_at)
  `);

  insertBid.run({
    id: 'b1111111-1111-4111-a111-111111111111',
    startup_id: startup1.id,
    investor_id: investor1.id,
    bid_amount: 800000,
    equity_demanded: 11.5,
    conditions: 'Tranche disbursement tied to FDA 510(k) submission; 1 Observer Board Seat.',
    status: 'PENDING',
    created_at: now - 7200000,
  });

  insertBid.run({
    id: 'b2222222-2222-4222-a222-222222222222',
    startup_id: startup1.id,
    investor_id: investor3.id,
    bid_amount: 850000,
    equity_demanded: 12.0,
    conditions: 'Direct access to Horizon medical distributor networks in EMEA; quick 14-day close.',
    status: 'PENDING',
    created_at: now - 3600000,
  });

  // 5. Products for Normal Marketplace
  const insertProduct = db.prepare(`
    INSERT INTO products (id, vendor_id, title, description, price, category, image_url, stock, created_at)
    VALUES (@id, @vendor_id, @title, @description, @price, @category, @image_url, @stock, @created_at)
  `);

  const products = [
    {
      id: 'p1111111-1111-4111-a111-111111111111',
      vendor_id: normalSeller.id,
      title: 'Handcrafted Heritage Leather Satchel',
      description: 'Vegetable-tanned full-grain leather, solid brass hardware, fits up to 16-inch laptops. Made locally by artisan craftsmen.',
      price: 185.00,
      category: 'Leathercraft',
      image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80',
      stock: 5,
      created_at: now - 86400000 * 2,
    },
    {
      id: 'p2222222-2222-4222-a222-222222222222',
      vendor_id: normalSeller.id,
      title: 'Organic Wildflower Honey & Lavender (500g)',
      description: 'Raw, unpasteurized honey harvested from organic highland apiaries infused with soothing French culinary lavender.',
      price: 24.50,
      category: 'Artisanal Pantry',
      image_url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&auto=format&fit=crop&q=80',
      stock: 20,
      created_at: now - 86400000 * 1,
    },
    {
      id: 'p3333333-3333-4333-a333-333333333333',
      vendor_id: normalSeller.id,
      title: 'Ergonomic Curved Bamboo Laptop Stand',
      description: 'Sustainably sourced MOSO bamboo with anti-slip silicone cushions. Promotes posture health and optimal device airflow.',
      price: 49.00,
      category: 'Home & Workspace',
      image_url: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&auto=format&fit=crop&q=80',
      stock: 12,
      created_at: now - 3600000 * 5,
    }
  ];

  products.forEach(p => insertProduct.run(p));

  // 6. Inquiries on Product 1
  const insertInquiry = db.prepare(`
    INSERT INTO product_inquiries (id, product_id, buyer_id, buyer_name, buyer_phone, message, status, created_at)
    VALUES (@id, @product_id, @buyer_id, @buyer_name, @buyer_phone, @message, @status, @created_at)
  `);

  insertInquiry.run({
    id: uuidv4(),
    product_id: products[0].id,
    buyer_id: normalBuyer.id,
    buyer_name: normalBuyer.full_name,
    buyer_phone: `${normalBuyer.country_code} ${normalBuyer.phone_number}`,
    message: 'Hello Maria! Can you do custom initials monogrammed on the shoulder strap? I want to buy 2 units.',
    status: 'PENDING',
    created_at: now - 3600000 * 2,
  });

  // 7. Notifications
  const insertNotification = db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, read, created_at)
    VALUES (@id, @user_id, @type, @title, @message, @read, @created_at)
  `);

  insertNotification.run({
    id: uuidv4(),
    user_id: founder.id,
    type: 'AUCTION_STARTED',
    title: 'Auction Room Unlocked! 🎉',
    message: 'NeuroPulse Health AI reached 3 interested investors! Bidding is now open.',
    read: 0,
    created_at: now - 86400000,
  });

  insertNotification.run({
    id: uuidv4(),
    user_id: founder.id,
    type: 'BID_PLACED',
    title: 'New Bid Received: $850,000',
    message: 'Elena Rostova placed an auction bid for 12.0% equity.',
    read: 0,
    created_at: now - 3600000,
  });

  insertNotification.run({
    id: uuidv4(),
    user_id: normalSeller.id,
    type: 'PRODUCT_INQUIRY',
    title: 'New Purchase Inquiry!',
    message: 'Kenji Sato inquired about "Handcrafted Heritage Leather Satchel": "Hello Maria! Can you do custom initials..."',
    read: 0,
    created_at: now - 3600000 * 2,
  });

  console.log('Seeding completed successfully!');
}

