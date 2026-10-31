const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB check
db.initDb();

// -------------------------------------------------------------
// 1. STATS / IMPACT METRICS
// -------------------------------------------------------------
app.get('/api/stats', async (req, res) => {
  try {
    if (db.getIsConnected()) {
      const impactRows = await db.query(`
        SELECT 
          COUNT(DISTINCT dh.id) AS total_distributions,
          COALESCE(SUM(dh.actual_servings_distributed), 0) AS total_meals_served,
          COALESCE(SUM(fp.quantity_kg), 0) AS total_food_rescued_kg,
          (SELECT COUNT(*) FROM donors) AS active_donors_count,
          (SELECT COUNT(*) FROM ngos) AS active_ngos_count,
          (SELECT COUNT(*) FROM food_packages WHERE status = 'AVAILABLE') AS available_packages_count
        FROM distribution_history dh
        JOIN food_packages fp ON dh.package_id = fp.id
      `);

      const impact = (impactRows && impactRows[0]) || {};

      return res.json({
        totalFoodRescuedKg: parseFloat(impact.total_food_rescued_kg || 0).toFixed(1),
        totalMealsServed: parseInt(impact.total_meals_served || 0, 10),
        activeDonors: parseInt(impact.active_donors_count || 0, 10),
        activeNgos: parseInt(impact.active_ngos_count || 0, 10),
        availablePackages: parseInt(impact.available_packages_count || 0, 10),
        co2SavedKg: (parseFloat(impact.total_food_rescued_kg || 0) * 2.5).toFixed(1),
        isLiveMySQL: true
      });
    }

    // In-memory fallback
    const mem = db.inMemoryStore;
    const totalFoodRescuedKg = mem.distribution_history.reduce((sum, dh) => {
      const pkg = mem.food_packages.find(p => p.id === dh.package_id);
      return sum + (pkg ? parseFloat(pkg.quantity_kg) : 0);
    }, 0);

    const totalMealsServed = mem.distribution_history.reduce((sum, dh) => sum + dh.actual_servings_distributed, 0);
    const availablePackages = mem.food_packages.filter(p => p.status === 'AVAILABLE').length;

    res.json({
      totalFoodRescuedKg: totalFoodRescuedKg.toFixed(1),
      totalMealsServed,
      activeDonors: mem.donors.length,
      activeNgos: mem.ngos.length,
      availablePackages,
      co2SavedKg: (totalFoodRescuedKg * 2.5).toFixed(1),
      isLiveMySQL: false
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 2. DONORS
// -------------------------------------------------------------
app.get('/api/donors', async (req, res) => {
  try {
    if (db.getIsConnected()) {
      const rows = await db.query('SELECT * FROM donors ORDER BY created_at DESC');
      return res.json(rows);
    }
    res.json(db.inMemoryStore.donors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/donors', async (req, res) => {
  const { organization_name, donor_type, food_safety_license, contact_person, phone, address, city, state, pincode } = req.body;
  if (!organization_name || !contact_person || !phone) {
    return res.status(400).json({ error: 'Missing required donor fields' });
  }

  try {
    if (db.getIsConnected()) {
      // Create user first with guaranteed unique email
      const cleanSlug = organization_name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 25) || 'donor';
      const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const email = req.body.email || `${cleanSlug}_${uniqueSuffix}@donor.org`;

      const uRes = await db.query('INSERT INTO users (name, email, role, phone) VALUES (?, ?, ?, ?)', [
        organization_name, email, 'DONOR', phone
      ]);
      const dRes = await db.query(`
        INSERT INTO donors (user_id, organization_name, donor_type, food_safety_license, contact_person, phone, address, city, state, pincode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [uRes.insertId, organization_name, donor_type || 'RESTAURANT', food_safety_license || null, contact_person, phone, address || '', city || 'Bengaluru', state || 'Karnataka', pincode || '560001']);

      return res.status(201).json({ id: dRes.insertId, message: 'Donor registered successfully' });
    }

    const newId = db.inMemoryStore.donors.length + 1;
    const newDonor = {
      id: newId,
      user_id: newId,
      organization_name,
      donor_type: donor_type || 'RESTAURANT',
      food_safety_license: food_safety_license || 'FSSAI-DEMO',
      contact_person,
      phone,
      address: address || 'Main Road',
      city: city || 'Bengaluru',
      state: state || 'Karnataka',
      pincode: pincode || '560001',
      created_at: new Date().toISOString()
    };
    db.inMemoryStore.donors.unshift(newDonor);
    res.status(201).json({ id: newId, donor: newDonor });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'An organization with this contact or email already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 3. NGOS
// -------------------------------------------------------------
app.get('/api/ngos', async (req, res) => {
  try {
    if (db.getIsConnected()) {
      const rows = await db.query('SELECT * FROM ngos ORDER BY created_at DESC');
      return res.json(rows);
    }
    res.json(db.inMemoryStore.ngos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ngos', async (req, res) => {
  const { organization_name, registration_no, contact_person, phone, address, city, state, pincode, daily_servings_capacity } = req.body;
  if (!organization_name || !registration_no || !contact_person) {
    return res.status(400).json({ error: 'Missing required NGO fields' });
  }

  try {
    if (db.getIsConnected()) {
      const cleanSlug = organization_name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 25) || 'ngo';
      const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const email = req.body.email || `${cleanSlug}_${uniqueSuffix}@ngo.org`;

      const uRes = await db.query('INSERT INTO users (name, email, role, phone) VALUES (?, ?, ?, ?)', [
        organization_name, email, 'NGO', phone
      ]);
      const nRes = await db.query(`
        INSERT INTO ngos (user_id, organization_name, registration_no, contact_person, phone, address, city, state, pincode, daily_servings_capacity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [uRes.insertId, organization_name, registration_no, contact_person, phone, address || '', city || 'Bengaluru', state || 'Karnataka', pincode || '560001', daily_servings_capacity || 200]);

      return res.status(201).json({ id: nRes.insertId, message: 'NGO registered successfully' });
    }

    const newId = db.inMemoryStore.ngos.length + 1;
    const newNgo = {
      id: newId,
      user_id: newId + 10,
      organization_name,
      registration_no,
      contact_person,
      phone,
      address: address || 'Community Lane',
      city: city || 'Bengaluru',
      state: state || 'Karnataka',
      pincode: pincode || '560001',
      daily_servings_capacity: parseInt(daily_servings_capacity, 10) || 200,
      verification_status: 'VERIFIED',
      created_at: new Date().toISOString()
    };
    db.inMemoryStore.ngos.unshift(newNgo);
    res.status(201).json({ id: newId, ngo: newNgo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 4. FOOD PACKAGES
// -------------------------------------------------------------
app.get('/api/packages', async (req, res) => {
  try {
    if (db.getIsConnected()) {
      const rows = await db.query(`
        SELECT 
          fp.*,
          d.organization_name AS donor_name,
          d.donor_type,
          d.phone AS donor_phone,
          d.contact_person AS donor_contact,
          TIMESTAMPDIFF(MINUTE, NOW(), fp.expiry_time) AS minutes_remaining
        FROM food_packages fp
        JOIN donors d ON fp.donor_id = d.id
        ORDER BY fp.created_at DESC
      `);
      return res.json(rows);
    }

    // In-memory fallback
    const list = db.inMemoryStore.food_packages.map(pkg => {
      const donor = db.inMemoryStore.donors.find(d => d.id === pkg.donor_id) || {};
      const expDate = new Date(pkg.expiry_time);
      const minutes_remaining = Math.round((expDate - new Date()) / 60000);
      return {
        ...pkg,
        donor_name: donor.organization_name || 'Anonymous Donor',
        donor_type: donor.donor_type || 'RESTAURANT',
        donor_phone: donor.phone || 'N/A',
        donor_contact: donor.contact_person || 'N/A',
        minutes_remaining
      };
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/packages', async (req, res) => {
  const {
    donor_id,
    title,
    description,
    food_category,
    dietary_type,
    quantity_kg,
    estimated_servings,
    storage_condition,
    expiry_hours,
    pickup_address,
    pickup_instructions
  } = req.body;

  if (!donor_id || !title || !quantity_kg || !estimated_servings) {
    return res.status(400).json({ error: 'Missing required food package fields' });
  }

  const hours = parseFloat(expiry_hours) || 6;
  const preparedAt = new Date();
  const expiryTime = new Date(preparedAt.getTime() + hours * 3600 * 1000);

  try {
    if (db.getIsConnected()) {
      const result = await db.query(`
        INSERT INTO food_packages (
          donor_id, title, description, food_category, dietary_type,
          quantity_kg, estimated_servings, storage_condition,
          prepared_at, expiry_time, pickup_address, pickup_instructions, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')
      `, [
        donor_id, title, description || '', food_category || 'COOKED_MEALS',
        dietary_type || 'VEGETARIAN', quantity_kg, estimated_servings,
        storage_condition || 'AMBIENT', preparedAt, expiryTime,
        pickup_address || '', pickup_instructions || ''
      ]);

      return res.status(201).json({ id: result.insertId, message: 'Surplus food package listed!' });
    }

    const newId = db.inMemoryStore.food_packages.length + 1;
    const newPkg = {
      id: newId,
      donor_id: parseInt(donor_id, 10),
      title,
      description: description || '',
      food_category: food_category || 'COOKED_MEALS',
      dietary_type: dietary_type || 'VEGETARIAN',
      quantity_kg: parseFloat(quantity_kg),
      estimated_servings: parseInt(estimated_servings, 10),
      storage_condition: storage_condition || 'AMBIENT',
      prepared_at: preparedAt.toISOString(),
      expiry_time: expiryTime.toISOString(),
      pickup_address: pickup_address || 'Donor Premise',
      pickup_instructions: pickup_instructions || '',
      status: 'AVAILABLE',
      created_at: new Date().toISOString()
    };
    db.inMemoryStore.food_packages.unshift(newPkg);
    res.status(201).json({ id: newId, package: newPkg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 5. REQUESTS
// -------------------------------------------------------------
app.get('/api/requests', async (req, res) => {
  try {
    if (db.getIsConnected()) {
      const rows = await db.query(`
        SELECT 
          r.*,
          fp.title AS package_title,
          fp.quantity_kg,
          fp.estimated_servings AS total_servings,
          fp.food_category,
          fp.pickup_address,
          n.organization_name AS ngo_name,
          n.contact_person AS ngo_contact,
          n.phone AS ngo_phone,
          d.organization_name AS donor_name
        FROM requests r
        JOIN food_packages fp ON r.package_id = fp.id
        JOIN ngos n ON r.ngo_id = n.id
        JOIN donors d ON fp.donor_id = d.id
        ORDER BY r.requested_at DESC
      `);
      return res.json(rows);
    }

    const list = db.inMemoryStore.requests.map(reqItem => {
      const pkg = db.inMemoryStore.food_packages.find(p => p.id === reqItem.package_id) || {};
      const ngo = db.inMemoryStore.ngos.find(n => n.id === reqItem.ngo_id) || {};
      const donor = db.inMemoryStore.donors.find(d => d.id === pkg.donor_id) || {};
      return {
        ...reqItem,
        package_title: pkg.title || 'Unknown Package',
        quantity_kg: pkg.quantity_kg || 0,
        total_servings: pkg.estimated_servings || 0,
        food_category: pkg.food_category || 'COOKED_MEALS',
        pickup_address: pkg.pickup_address || 'Address not listed',
        ngo_name: ngo.organization_name || 'Unknown NGO',
        ngo_contact: ngo.contact_person || 'N/A',
        ngo_phone: ngo.phone || 'N/A',
        donor_name: donor.organization_name || 'Donor'
      };
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/requests', async (req, res) => {
  const { package_id, ngo_id, needed_servings, request_notes, urgency_level } = req.body;
  if (!package_id || !ngo_id) {
    return res.status(400).json({ error: 'package_id and ngo_id are required' });
  }

  try {
    if (db.getIsConnected()) {
      const result = await db.query(`
        INSERT INTO requests (package_id, ngo_id, needed_servings, request_notes, urgency_level, status)
        VALUES (?, ?, ?, ?, ?, 'PENDING')
      `, [package_id, ngo_id, needed_servings || 10, request_notes || '', urgency_level || 'NORMAL']);

      await db.query(`UPDATE food_packages SET status = 'REQUESTED' WHERE id = ? AND status = 'AVAILABLE'`, [package_id]);

      return res.status(201).json({ id: result.insertId, message: 'Request submitted to donor' });
    }

    const newId = db.inMemoryStore.requests.length + 1;
    const newReq = {
      id: newId,
      package_id: parseInt(package_id, 10),
      ngo_id: parseInt(ngo_id, 10),
      needed_servings: parseInt(needed_servings, 10) || 50,
      request_notes: request_notes || '',
      urgency_level: urgency_level || 'NORMAL',
      status: 'PENDING',
      requested_at: new Date().toISOString()
    };
    db.inMemoryStore.requests.unshift(newReq);

    const targetPkg = db.inMemoryStore.food_packages.find(p => p.id === parseInt(package_id, 10));
    if (targetPkg && targetPkg.status === 'AVAILABLE') {
      targetPkg.status = 'REQUESTED';
    }

    res.status(201).json({ id: newId, request: newReq });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/requests/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'APPROVED' or 'REJECTED'

  try {
    if (db.getIsConnected()) {
      await db.query(`UPDATE requests SET status = ?, responded_at = NOW() WHERE id = ?`, [status, id]);

      let autoAsgResult = null;

      if (status === 'APPROVED') {
        const reqRows = await db.query(`SELECT package_id, ngo_id FROM requests WHERE id = ?`, [id]);
        if (reqRows && reqRows.length > 0) {
          const { package_id, ngo_id } = reqRows[0];
          await db.query(`UPDATE food_packages SET status = 'ASSIGNED' WHERE id = ?`, [package_id]);

          // Check if an assignment already exists for this request
          const existingAsg = await db.query(`SELECT id FROM assignments WHERE request_id = ?`, [id]);
          if (!existingAsg || existingAsg.length === 0) {
            const pickupOtp = Math.floor(1000 + Math.random() * 9000).toString();
            const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

            // Fetch NGO details for driver assignment
            const ngoRows = await db.query(`SELECT contact_person, phone, organization_name FROM ngos WHERE id = ?`, [ngo_id]);
            const ngoInfo = (ngoRows && ngoRows[0]) || {};
            const driverName = ngoInfo.contact_person ? `${ngoInfo.contact_person} (Relief Dispatch)` : 'Relief Transport Volunteer';
            const driverPhone = ngoInfo.phone || '+91 98450 11223';

            const asgRes = await db.query(`
              INSERT INTO assignments (
                request_id, package_id, ngo_id, driver_name, driver_phone,
                vehicle_type, vehicle_number, pickup_otp, delivery_otp, status, notes
              ) VALUES (?, ?, ?, ?, ?, 'Eco Thermal Van', 'KA-05-FD-2026', ?, ?, 'SCHEDULED', 'Auto-assigned upon approval of NGO request')
            `, [id, package_id, ngo_id, driverName, driverPhone, pickupOtp, deliveryOtp]);

            autoAsgResult = { assignmentId: asgRes.insertId, pickupOtp, deliveryOtp };
          }
        }
      }

      return res.json({ 
        message: status === 'APPROVED' ? `Request approved and auto-assigned to Logistics!` : `Request status updated to ${status}`,
        ...(autoAsgResult || {})
      });
    }

    const item = db.inMemoryStore.requests.find(r => r.id === parseInt(id, 10));
    if (!item) return res.status(404).json({ error: 'Request not found' });
    item.status = status;

    let autoAsgResult = null;

    if (status === 'APPROVED') {
      const pkg = db.inMemoryStore.food_packages.find(p => p.id === item.package_id);
      if (pkg) pkg.status = 'ASSIGNED';

      const existingAsg = db.inMemoryStore.assignments.find(a => a.request_id === item.id);
      if (!existingAsg) {
        const ngo = db.inMemoryStore.ngos.find(n => n.id === item.ngo_id) || {};
        const pickupOtp = Math.floor(1000 + Math.random() * 9000).toString();
        const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
        const newAsg = {
          id: db.inMemoryStore.assignments.length + 1,
          request_id: item.id,
          package_id: item.package_id,
          ngo_id: item.ngo_id,
          driver_name: ngo.contact_person ? `${ngo.contact_person} (Relief Dispatch)` : 'Relief Transport Volunteer',
          driver_phone: ngo.phone || '+91 98450 11223',
          vehicle_type: 'Eco Thermal Van',
          vehicle_number: 'KA-05-FD-2026',
          pickup_otp: pickupOtp,
          delivery_otp: deliveryOtp,
          status: 'SCHEDULED',
          assigned_at: new Date().toISOString(),
          picked_up_at: null,
          delivered_at: null,
          notes: 'Auto-assigned upon approval of NGO request'
        };
        db.inMemoryStore.assignments.unshift(newAsg);
        autoAsgResult = { assignmentId: newAsg.id, pickupOtp, deliveryOtp };
      }
    }

    res.json({ 
      message: status === 'APPROVED' ? `Request approved and auto-assigned to Logistics!` : `Request status updated to ${status}`, 
      request: item,
      ...(autoAsgResult || {})
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 6. ASSIGNMENTS & DISPATCH
// -------------------------------------------------------------
app.get('/api/assignments', async (req, res) => {
  try {
    if (db.getIsConnected()) {
      const rows = await db.query(`
        SELECT 
          a.*,
          fp.title AS package_title,
          fp.quantity_kg,
          fp.pickup_address,
          n.organization_name AS ngo_name,
          n.phone AS ngo_phone,
          d.organization_name AS donor_name,
          d.phone AS donor_phone
        FROM assignments a
        JOIN food_packages fp ON a.package_id = fp.id
        JOIN ngos n ON a.ngo_id = n.id
        JOIN donors d ON fp.donor_id = d.id
        ORDER BY a.assigned_at DESC
      `);
      return res.json(rows);
    }

    const list = db.inMemoryStore.assignments.map(asg => {
      const pkg = db.inMemoryStore.food_packages.find(p => p.id === asg.package_id) || {};
      const ngo = db.inMemoryStore.ngos.find(n => n.id === asg.ngo_id) || {};
      const donor = db.inMemoryStore.donors.find(d => d.id === pkg.donor_id) || {};
      return {
        ...asg,
        package_title: pkg.title || 'Food Package',
        quantity_kg: pkg.quantity_kg || 0,
        pickup_address: pkg.pickup_address || '',
        ngo_name: ngo.organization_name || 'NGO',
        ngo_phone: ngo.phone || '',
        donor_name: donor.organization_name || 'Donor',
        donor_phone: donor.phone || ''
      };
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/assignments', async (req, res) => {
  const { request_id, package_id, ngo_id, driver_name, driver_phone, vehicle_type, vehicle_number, notes } = req.body;
  if (!package_id || !ngo_id || !driver_name) {
    return res.status(400).json({ error: 'Missing assignment details' });
  }

  // Generate 4-digit verification OTPs
  const pickupOtp = Math.floor(1000 + Math.random() * 9000).toString();
  const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

  try {
    if (db.getIsConnected()) {
      const resAsg = await db.query(`
        INSERT INTO assignments (
          request_id, package_id, ngo_id, driver_name, driver_phone,
          vehicle_type, vehicle_number, pickup_otp, delivery_otp, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?)
      `, [request_id || 1, package_id, ngo_id, driver_name, driver_phone || '', vehicle_type || 'Van', vehicle_number || 'KA-XX-0000', pickupOtp, deliveryOtp, notes || '']);

      await db.query(`UPDATE food_packages SET status = 'ASSIGNED' WHERE id = ?`, [package_id]);

      return res.status(201).json({ id: resAsg.insertId, pickupOtp, deliveryOtp });
    }

    const newId = db.inMemoryStore.assignments.length + 1;
    const newAsg = {
      id: newId,
      request_id: parseInt(request_id, 10) || 1,
      package_id: parseInt(package_id, 10),
      ngo_id: parseInt(ngo_id, 10),
      driver_name,
      driver_phone: driver_phone || '+91 99999 88888',
      vehicle_type: vehicle_type || 'Eco Van',
      vehicle_number: vehicle_number || 'KA-01-AB-1234',
      pickup_otp: pickupOtp,
      delivery_otp: deliveryOtp,
      status: 'SCHEDULED',
      assigned_at: new Date().toISOString(),
      picked_up_at: null,
      delivered_at: null,
      notes: notes || ''
    };
    db.inMemoryStore.assignments.unshift(newAsg);

    const pkg = db.inMemoryStore.food_packages.find(p => p.id === parseInt(package_id, 10));
    if (pkg) pkg.status = 'ASSIGNED';

    res.status(201).json({ id: newId, pickupOtp, deliveryOtp, assignment: newAsg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/assignments/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'IN_TRANSIT', 'DELIVERED', 'FAILED'

  try {
    if (db.getIsConnected()) {
      let timeUpdateSql = '';
      if (status === 'IN_TRANSIT') {
        timeUpdateSql = ', picked_up_at = NOW()';
      } else if (status === 'DELIVERED') {
        timeUpdateSql = ', delivered_at = NOW()';
      }

      await db.query(`UPDATE assignments SET status = ? ${timeUpdateSql} WHERE id = ?`, [status, id]);

      // If delivered, also update package
      if (status === 'DELIVERED') {
        const rows = await db.query(`SELECT package_id FROM assignments WHERE id = ?`, [id]);
        if (rows && rows.length > 0) {
          await db.query(`UPDATE food_packages SET status = 'DELIVERED' WHERE id = ?`, [rows[0].package_id]);
        }
      }
      return res.json({ message: `Assignment updated to ${status}` });
    }

    const item = db.inMemoryStore.assignments.find(a => a.id === parseInt(id, 10));
    if (!item) return res.status(404).json({ error: 'Assignment not found' });

    item.status = status;
    if (status === 'IN_TRANSIT') {
      item.picked_up_at = new Date().toISOString();
      const pkg = db.inMemoryStore.food_packages.find(p => p.id === item.package_id);
      if (pkg) pkg.status = 'PICKED_UP';
    } else if (status === 'DELIVERED') {
      item.delivered_at = new Date().toISOString();
      const pkg = db.inMemoryStore.food_packages.find(p => p.id === item.package_id);
      if (pkg) pkg.status = 'DELIVERED';
    }

    res.json({ message: `Assignment status updated to ${status}`, assignment: item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 7. DISTRIBUTION HISTORY
// -------------------------------------------------------------
app.get('/api/distributions', async (req, res) => {
  try {
    if (db.getIsConnected()) {
      const rows = await db.query(`
        SELECT 
          dh.*,
          fp.title AS package_title,
          fp.quantity_kg,
          fp.food_category,
          n.organization_name AS ngo_name,
          d.organization_name AS donor_name
        FROM distribution_history dh
        JOIN food_packages fp ON dh.package_id = fp.id
        JOIN ngos n ON dh.ngo_id = n.id
        JOIN donors d ON dh.donor_id = d.id
        ORDER BY dh.completed_at DESC
      `);
      return res.json(rows);
    }

    const list = db.inMemoryStore.distribution_history.map(dh => {
      const pkg = db.inMemoryStore.food_packages.find(p => p.id === dh.package_id) || {};
      const ngo = db.inMemoryStore.ngos.find(n => n.id === dh.ngo_id) || {};
      const donor = db.inMemoryStore.donors.find(d => d.id === dh.donor_id) || {};
      return {
        ...dh,
        package_title: pkg.title || 'Food Package',
        quantity_kg: pkg.quantity_kg || 0,
        food_category: pkg.food_category || 'COOKED_MEALS',
        ngo_name: ngo.organization_name || 'NGO',
        donor_name: donor.organization_name || 'Donor'
      };
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/distributions', async (req, res) => {
  const { assignment_id, package_id, ngo_id, donor_id, actual_servings_distributed, beneficiaries_target, distribution_location, proof_image_url, feedback_notes, rating_donor } = req.body;

  if (!package_id || !ngo_id || !actual_servings_distributed) {
    return res.status(400).json({ error: 'Missing distribution report details' });
  }

  try {
    if (db.getIsConnected()) {
      let resolvedDonorId = donor_id;
      if (!resolvedDonorId) {
        const pkgRows = await db.query(`SELECT donor_id FROM food_packages WHERE id = ?`, [package_id]);
        if (pkgRows && pkgRows.length > 0) resolvedDonorId = pkgRows[0].donor_id;
      }

      const resDist = await db.query(`
        INSERT INTO distribution_history (
          assignment_id, package_id, ngo_id, donor_id,
          actual_servings_distributed, beneficiaries_target, distribution_location,
          proof_image_url, feedback_notes, rating_donor
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        assignment_id || null, package_id, ngo_id, resolvedDonorId || 1,
        actual_servings_distributed, beneficiaries_target || 'Community Members',
        distribution_location || 'Distribution Point', proof_image_url || null,
        feedback_notes || '', rating_donor || 5
      ]);

      await db.query(`UPDATE food_packages SET status = 'DELIVERED' WHERE id = ?`, [package_id]);

      return res.status(201).json({ id: resDist.insertId, message: 'Distribution log recorded successfully' });
    }

    const targetPkg = db.inMemoryStore.food_packages.find(p => p.id === parseInt(package_id, 10));
    const resolvedDonorId = donor_id ? parseInt(donor_id, 10) : (targetPkg ? targetPkg.donor_id : 1);

    const newId = db.inMemoryStore.distribution_history.length + 1;
    const newDist = {
      id: newId,
      assignment_id: assignment_id ? parseInt(assignment_id, 10) : null,
      package_id: parseInt(package_id, 10),
      ngo_id: parseInt(ngo_id, 10),
      donor_id: resolvedDonorId,
      actual_servings_distributed: parseInt(actual_servings_distributed, 10),
      beneficiaries_target: beneficiaries_target || 'Local Shelter Families',
      distribution_location: distribution_location || 'Shelter Community Center',
      proof_image_url: proof_image_url || 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=600&q=80',
      feedback_notes: feedback_notes || 'Warm food served promptly with zero waste.',
      rating_donor: parseInt(rating_donor, 10) || 5,
      completed_at: new Date().toISOString()
    };

    db.inMemoryStore.distribution_history.unshift(newDist);
    if (targetPkg) targetPkg.status = 'DELIVERED';

    res.status(201).json({ id: newId, distribution: newDist });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 8. DATABASE / SCHEMA UTILITY ENDPOINTS
// -------------------------------------------------------------
app.get('/api/db/status', async (req, res) => {
  const status = await db.checkConnection();
  res.json(status);
});

app.post('/api/db/reconnect', async (req, res) => {
  const status = await db.checkConnection();
  res.json(status);
});

app.get('/api/schema', (req, res) => {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sqlContent = fs.readFileSync(schemaPath, 'utf8');
    res.json({ sql: sqlContent });
  } catch (err) {
    res.status(500).json({ error: 'Unable to load schema.sql' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`Food Donation Management System API running at http://localhost:${PORT}`);
  console.log(`MySQL Workbench Schema: schema.sql`);
  console.log(`Database target: ${process.env.DB_NAME || 'food_donation_db'}`);
  console.log(`=======================================================`);
});
