const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'food_donation_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool = null;
let isConnected = false;
let connectionError = null;

// Initialize MySQL pool
async function initDb() {
  require('dotenv').config({ override: true });

  const activeConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'food_donation_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };

  try {
    if (pool) {
      try { await pool.end(); } catch (e) {}
    }
    pool = mysql.createPool(activeConfig);
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    isConnected = true;
    connectionError = null;
    console.log(`[Database] Connected successfully to MySQL database "${activeConfig.database}" on ${activeConfig.host}:${activeConfig.port}`);
  } catch (err) {
    isConnected = false;
    connectionError = err.message;
    console.warn(`[Database] Note: Direct MySQL connection not established (${err.message}).`);
  }
}

// In-Memory Fallback Store (Mirrors MySQL seed data from schema.sql)
const inMemoryStore = {
  donors: [
    {
      id: 1,
      user_id: 1,
      organization_name: 'Green Leaf Gourmet Bistro',
      donor_type: 'RESTAURANT',
      food_safety_license: 'FSSAI-1122334455',
      contact_person: 'Chef Marco',
      phone: '+91 98765 43210',
      address: '104, 100ft Road, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      user_id: 2,
      organization_name: 'Grand Horizon Convention Hall',
      donor_type: 'CATERING',
      food_safety_license: 'FSSAI-9988776655',
      contact_person: 'Rajesh Sharma',
      phone: '+91 98765 43211',
      address: 'Plot 45, Outer Ring Road, Bellandur',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560103',
      created_at: new Date().toISOString()
    }
  ],
  ngos: [
    {
      id: 1,
      user_id: 3,
      organization_name: 'City Food Bank Foundation',
      registration_no: 'REG-NGO-2018-984',
      contact_person: 'Sister Agnes',
      phone: '+91 91234 56789',
      address: '12, 4th Cross, Austin Town',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560047',
      daily_servings_capacity: 600,
      verification_status: 'VERIFIED',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      user_id: 4,
      organization_name: 'Hope Child & Homeless Shelter',
      registration_no: 'REG-NGO-2021-312',
      contact_person: 'Arun Kumar',
      phone: '+91 91234 56788',
      address: '89, 7th Main, Koramangala 1st Block',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560034',
      daily_servings_capacity: 250,
      verification_status: 'VERIFIED',
      created_at: new Date().toISOString()
    }
  ],
  food_packages: [
    {
      id: 1,
      donor_id: 1,
      title: '50 Portions Veg Biryani & Paneer Gravy',
      description: 'Freshly prepared evening banquet surplus in insulated food containers',
      food_category: 'COOKED_MEALS',
      dietary_type: 'VEGETARIAN',
      quantity_kg: 22.50,
      estimated_servings: 50,
      storage_condition: 'HOT_HOLD',
      prepared_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      expiry_time: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      pickup_address: '104, 100ft Road, Indiranagar, Bengaluru',
      pickup_instructions: 'Collect from rear service entrance, ask for Marco.',
      status: 'AVAILABLE',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      donor_id: 1,
      title: 'Assorted Artisan Bread & Pastries',
      description: 'Unsold fresh bakery breads, baguettes, and croissants packed in boxes',
      food_category: 'BAKERY_DAIRY',
      dietary_type: 'VEGETARIAN',
      quantity_kg: 14.00,
      estimated_servings: 40,
      storage_condition: 'AMBIENT',
      prepared_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      expiry_time: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
      pickup_address: '104, 100ft Road, Indiranagar, Bengaluru',
      pickup_instructions: 'Front bakery counter.',
      status: 'AVAILABLE',
      created_at: new Date().toISOString()
    },
    {
      id: 3,
      donor_id: 2,
      title: 'North Indian Buffet Spread (Rice, Dal, Roti)',
      description: 'Leftover corporate event lunch surplus kept in hot food warmers',
      food_category: 'COOKED_MEALS',
      dietary_type: 'VEGETARIAN',
      quantity_kg: 45.00,
      estimated_servings: 110,
      storage_condition: 'HOT_HOLD',
      prepared_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      expiry_time: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
      pickup_address: 'Plot 45, Outer Ring Road, Bellandur, Bengaluru',
      pickup_instructions: 'Loading dock B, security gate pass: FOOD45',
      status: 'ASSIGNED',
      created_at: new Date().toISOString()
    },
    {
      id: 4,
      donor_id: 2,
      title: 'Fresh Crate Vegetables & Pre-cut Salads',
      description: 'Raw cabbage, cucumbers, tomatoes, bell peppers in crates',
      food_category: 'RAW_PRODUCE',
      dietary_type: 'VEGAN',
      quantity_kg: 30.00,
      estimated_servings: 75,
      storage_condition: 'REFRIGERATED',
      prepared_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      expiry_time: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      pickup_address: 'Plot 45, Outer Ring Road, Bellandur, Bengaluru',
      pickup_instructions: 'Cold storage room #2',
      status: 'DELIVERED',
      created_at: new Date().toISOString()
    }
  ],
  requests: [
    {
      id: 1,
      package_id: 3,
      ngo_id: 1,
      needed_servings: 110,
      request_notes: 'Can distribute immediately at Austin Town evening shelter dinner.',
      urgency_level: 'HIGH',
      status: 'APPROVED',
      requested_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    },
    {
      id: 2,
      package_id: 4,
      ngo_id: 2,
      needed_servings: 75,
      request_notes: 'Fresh produce needed for children shelter kitchen breakfast tomorrow.',
      urgency_level: 'NORMAL',
      status: 'APPROVED',
      requested_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
    },
    {
      id: 3,
      package_id: 1,
      ngo_id: 2,
      needed_servings: 50,
      request_notes: 'We have a night shelter distribution vehicle ready.',
      urgency_level: 'HIGH',
      status: 'PENDING',
      requested_at: new Date(Date.now() - 20 * 60 * 1000).toISOString()
    }
  ],
  assignments: [
    {
      id: 1,
      request_id: 1,
      package_id: 3,
      ngo_id: 1,
      driver_name: 'Suresh Patel',
      driver_phone: '+91 94444 11223',
      vehicle_type: 'Eco Van',
      vehicle_number: 'KA-01-MJ-4512',
      pickup_otp: '4821',
      delivery_otp: '9034',
      status: 'IN_TRANSIT',
      assigned_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      picked_up_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      delivered_at: null,
      notes: 'Vehicle equipped with thermal insulated bags'
    },
    {
      id: 2,
      request_id: 2,
      package_id: 4,
      ngo_id: 2,
      driver_name: 'Manoj Verma',
      driver_phone: '+91 94444 33445',
      vehicle_type: 'Mini Truck',
      vehicle_number: 'KA-05-AA-7890',
      pickup_otp: '7109',
      delivery_otp: '3256',
      status: 'DELIVERED',
      assigned_at: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
      picked_up_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
      delivered_at: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
      notes: 'Delivered and verified by shelter supervisor'
    }
  ],
  distribution_history: [
    {
      id: 1,
      assignment_id: 2,
      package_id: 4,
      ngo_id: 2,
      donor_id: 2,
      actual_servings_distributed: 75,
      beneficiaries_target: 'Orphanage and low-income community families',
      distribution_location: 'Hope Child Shelter, Koramangala 1st Block',
      proof_image_url: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=600&q=80',
      feedback_notes: 'Vegetables were fresh and clean! Children had a wholesome meal.',
      rating_donor: 5,
      completed_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString()
    }
  ]
};

// Execute query (falls back to in-memory if MySQL is disconnected)
async function query(sql, params = []) {
  if (isConnected && pool) {
    try {
      const [results] = await pool.query(sql, params);
      return results;
    } catch (err) {
      console.error('[MySQL Error]', err.message);
      throw err;
    }
  }
  return null;
}

// Function to reconnect/re-test MySQL
async function checkConnection() {
  await initDb();
  return {
    isConnected,
    config: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      database: process.env.DB_NAME || 'food_donation_db'
    },
    error: connectionError
  };
}

module.exports = {
  initDb,
  query,
  checkConnection,
  getPool: () => pool,
  getIsConnected: () => isConnected,
  inMemoryStore
};
