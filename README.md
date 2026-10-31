# Food Donation Management System 🍲🤝

A comprehensive platform connecting **Food Donors** (restaurants, hotels, catering halls, supermarkets) with **NGOs** and shelters to rescue surplus food, coordinate logistics with driver OTPs, and verify distribution with impact tracking.

Built with **Normal SQL (MySQL / MySQL Workbench)** and **Node.js (Express)**.

---

## 🗄️ Database Architecture (MySQL Workbench)

The system is designed with **6 core relational entities** plus analytical views:

```
[Donors] ──< [Food Packages] ──< [Requests] (by NGOs)
                    │               │
                    │               ▼
                    └───< [Assignments] (Driver / Logistics + OTP)
                                │
                                ▼
                    [Distribution History] (Verified Impact & Proof)
```

### Table Breakdown

1. **`users`**: Base credentials and role classification (`DONOR`, `NGO`, `ADMIN`).
2. **`donors`**: Registered food donors with organization type (`RESTAURANT`, `HOTEL`, `CATERING`, `SUPERMARKET`), contact info, address, and food safety license (`FSSAI`).
3. **`ngos`**: Certified relief organizations and shelters with daily serving capacity, registration number, and verification status.
4. **`food_packages`**: Surplus food items posted by donors, including category (`COOKED_MEALS`, `RAW_PRODUCE`, `BAKERY_DAIRY`, `PACKAGED_GOODS`), weight (kg), servings, storage temperature conditions, and exact expiry countdown.
5. **`requests`**: Claims submitted by NGOs for available packages with urgency levels (`NORMAL`, `HIGH`, `CRITICAL`) and needed portions.
6. **`assignments`**: Dispatch logistics connecting driver/volunteer, vehicle details, **Pickup OTP**, and **Delivery OTP** to ensure chain-of-custody food safety.
7. **`distribution_history`**: Final audit logs verifying distribution to beneficiaries, photo proof, feedback notes, and donor star ratings (1–5).
8. **Analytical Views**:
   * `v_active_food_packages`: Real-time view of non-expired available food with time remaining.
   * `v_distribution_impact`: Instant metrics for total kg rescued, meals served, and NGO coverage.

---

## 🚀 How to Run with MySQL Workbench

### Step 1: Execute `schema.sql` in MySQL Workbench
1. Open **MySQL Workbench**.
2. Connect to your local MySQL instance (usually `localhost:3306`).
3. Click **File -> Open SQL Script...** and select:
   ```
   C:\Users\rahuuuu\.gemini\antigravity-ide\scratch\food-donation-system\schema.sql
   ```
4. Click the **Execute (Lightning Bolt)** icon or press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Enter</kbd>.
5. Refresh the *Schemas* sidebar — you will see `food_donation_db` with all 7 tables, views, and realistic seed data!

### Step 2: Configure `.env`
Open the `.env` file in the project folder and set your MySQL root password:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=food_donation_db
```

### Step 3: Start Node.js Server
Run in PowerShell:
```bash
npm start
```

Open your browser at:
```
http://localhost:5000
```

> **Smart Fallback Engine**: If MySQL is not running or credentials are being configured, the application automatically runs in Safe Fallback Mode with realistic mock data mirroring `schema.sql`. You can test, submit donations, dispatch drivers, and log distributions immediately. When you connect MySQL, click **"Test MySQL Connection"** to switch to live database mode!

---

## 📡 REST API Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stats` | Live impact metrics (kg rescued, meals, CO2 offset) |
| `GET` | `/api/packages` | List all surplus food packages |
| `POST` | `/api/packages` | Create new surplus food donation package |
| `GET` | `/api/donors` | List registered donors |
| `POST` | `/api/donors` | Register new donor |
| `GET` | `/api/ngos` | List registered NGOs |
| `POST` | `/api/ngos` | Register new NGO |
| `GET` | `/api/requests` | List food claim requests |
| `POST` | `/api/requests` | Submit claim request for a package |
| `PUT` | `/api/requests/:id/status` | Approve or reject a claim request |
| `GET` | `/api/assignments` | List logistics assignments with OTPs |
| `POST` | `/api/assignments` | Dispatch driver & vehicle |
| `PUT` | `/api/assignments/:id/status` | Update delivery status (`IN_TRANSIT`, `DELIVERED`) |
| `GET` | `/api/distributions` | View verified distribution history |
| `POST` | `/api/distributions` | Log distribution completion with proof & ratings |
| `GET` | `/api/db/status` | Test connection to MySQL Workbench |
