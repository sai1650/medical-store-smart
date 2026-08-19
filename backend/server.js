const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
const path = require('path');
const fs = require('fs');
require("dotenv").config({ path: path.join(__dirname, '.env') });
require("dotenv").config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('./db/connection');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

const emailConfig = {
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587", 10),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: process.env.EMAIL_USER && process.env.EMAIL_PASS ? {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  } : undefined
};

const emailTransporter = emailConfig.host ? nodemailer.createTransport(emailConfig) : null;
const emailFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@smartmedicalstore.com';

const twilioConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  from: process.env.TWILIO_FROM
};

async function sendOtpEmail(user, otp) {
  if (!emailTransporter || !user.email) return false;

  const subject = 'Your OTP for password reset';
  const text = `Hi ${user.name || user.username},\n\nYour OTP for password reset is ${otp}. It expires in 5 minutes.\n\nIf you did not request this, please ignore this message.`;
  const html = `
    <p>Hi ${user.name || user.username},</p>
    <p>Your OTP for password reset is <strong>${otp}</strong>.</p>
    <p>This code expires in 5 minutes.</p>
    <p>If you did not request this, ignore this email.</p>
  `;

  await emailTransporter.sendMail({
    from: emailFrom,
    to: user.email,
    subject,
    text,
    html
  });
  return true;
}

async function sendOtpSms(user, otp) {
  if (!twilioConfig.accountSid || !twilioConfig.authToken || !twilioConfig.from || !user.phone) {
    return false;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.accountSid}/Messages.json`;
  const params = new URLSearchParams({
    To: user.phone,
    From: twilioConfig.from,
    Body: `Your OTP for password reset is ${otp}. It expires in 5 minutes.`
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${twilioConfig.accountSid}:${twilioConfig.authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Twilio send error: ${response.status} ${errorText}`);
  }

  return true;
}

// Middleware
// CORS configuration - allow specific frontend origin(s) via env, plus localhost/Netlify defaults.
const rawFrontendOrigins = process.env.FRONTEND_ORIGINS; // comma-separated list, or undefined
let allowedOrigins = null;
if (rawFrontendOrigins && rawFrontendOrigins.trim()) {
  allowedOrigins = rawFrontendOrigins.split(',').map(s => s.trim()).filter(Boolean);
} else {
  // default: allow all origins (use a specific origin in production for tighter security)
  allowedOrigins = true;
}

function isLocalOrNetlifyOrigin(origin) {
  try {
    const parsedOrigin = new URL(origin);
    const hostname = parsedOrigin.hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      return true;
    }

    return hostname.endsWith('.netlify.app') || hostname === 'netlify.app';
  } catch (error) {
    return false;
  }
}

const corsOptions = {
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser tools like curl
    if (allowedOrigins === true || (Array.isArray(allowedOrigins) && allowedOrigins.indexOf(origin) !== -1) || isLocalOrNetlifyOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
// allow larger JSON payloads to support base64 images (photos)
app.use(express.json({ limit: '5mb' }));
app.use('/api/upload', uploadRoutes);

// Serve frontend static files (resolve absolute path).
// Prefer the production `dist` output, then `public`, then the frontend root.
const frontendRoot = path.join(__dirname, '..', 'frontend');
const candidates = [
  path.join(frontendRoot, 'dist'),
  path.join(frontendRoot, 'public'),
  frontendRoot
];

let frontendStatic = candidates.find(dir => {
  try {
    return fs.existsSync(path.join(dir, 'index.html'));
  } catch (e) {
    return false;
  }
});

if (!frontendStatic) {
  console.warn('⚠️ No frontend index.html found in dist/public/frontend root; defaulting to frontend/public.');
  frontendStatic = path.join(frontendRoot, 'public');
}

app.use(express.static(frontendStatic));

// Health endpoint
app.get('/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    status: 'ok',
    database: databaseConnected ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
    origin: req.get('origin') || null,
    allowedOrigins: Array.isArray(allowedOrigins) ? allowedOrigins : (allowedOrigins === true ? 'all' : null)
  });
});

// ==================== SCHEMAS ====================

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "staff", enum: ["admin", "staff"] },
  name: String,
  email: String,
  phone: String,
  photo: String, // base64 data URL or URL to avatar
  // fields used for password reset via OTP
  resetOTP: Number,
  otpExpiry: Date,
  created_at: { type: Date, default: Date.now }
});

// Attendance Schema
const attendanceSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  username: String,
  date: Date,
  status: { type: String, enum: ["present", "absent", "leave"], default: "present" },
  check_in: Date,
  check_out: Date,
  created_at: { type: Date, default: Date.now }
});

// Medicine Schema
const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  company: { type: String, index: true },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 0 },
  rack: String,
  shelf: String,
  created_at: { type: Date, default: Date.now }
});

// Sales Schema
const salesSchema = new mongoose.Schema({
  medicine_id: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine" },
  medicine_name: String,
  qty: Number,
  total: Number,
  sold_at: { type: Date, default: Date.now }
});

// Bill Schema
const billSchema = new mongoose.Schema({
  items: Array,
  total_amount: Number,
  created_at: { type: Date, default: Date.now }
});

// Create Models
const User = mongoose.model("User", userSchema);
const Attendance = mongoose.model("Attendance", attendanceSchema);
const Medicine = mongoose.model("Medicine", medicineSchema);
const Sales = mongoose.model("Sales", salesSchema);
const Bill = mongoose.model("Bill", billSchema);

// ==================== ROUTES ====================

// LOGIN
app.post("/login", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const query = { username, password };
    if (role === 'admin' || role === 'staff') query.role = role;
    const user = await User.findOne(query);
    
    if (user) {
      res.json(user);
    } else {
      res.json({ message: "Invalid login" });
    }
  } catch (err) {
    if (mongoose.connection.readyState !== 1) {
      console.error('Login database unavailable:', err.name || err.code || 'UnknownError');
      return res.status(503).json({ message: "Login is temporarily unavailable because the database cannot be reached." });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// FORGOT PASSWORD - generate and "send" OTP
app.post("/forgot-password", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ message: "Username required" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      // don't reveal existence of account
      return res.json({ success: true, message: "If that user exists an OTP has been sent." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit
    user.resetOTP = otp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // valid for 5min
    await user.save();

    const channels = [];
    let sendFailure = false;
    let sendWarnings = [];

    if (user.email && emailTransporter) {
      try {
        await sendOtpEmail(user, otp);
        channels.push('email');
      } catch (err) {
        console.error('OTP email send failed:', err);
        sendFailure = true;
        sendWarnings.push('Email send failed');
      }
    }

    if (user.phone && twilioConfig.accountSid && twilioConfig.authToken && twilioConfig.from) {
      try {
        await sendOtpSms(user, otp);
        channels.push('SMS');
      } catch (err) {
        console.error('OTP SMS send failed:', err);
        sendFailure = true;
        sendWarnings.push('SMS send failed');
      }
    }

    const shouldReturnOtp = process.env.RETURN_OTP_IN_RESPONSE === 'true' || channels.length === 0;
    const response = {
      success: true,
      message: channels.length > 0
        ? `OTP sent via ${channels.join(' and ')}.`
        : 'OTP generated. No email or SMS transport is configured or user contact info is missing.',
    };

    if (shouldReturnOtp) {
      response.otp = otp;
    }

    if (sendFailure) {
      response.warning = sendWarnings.join('; ');
    }

    res.json(response);
  } catch (err) {
    if (mongoose.connection.readyState !== 1) {
      console.error('Forgot-password database unavailable:', err.name || err.code || 'UnknownError');
      return res.status(503).json({ message: "Password recovery is temporarily unavailable because the database cannot be reached." });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// RESET PASSWORD using OTP
app.post("/reset-password", async (req, res) => {
  try {
    const { username, otp, newPassword } = req.body;
    if (!username || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields required" });
    }

    const user = await User.findOne({ username });
    if (!user || !user.resetOTP || !user.otpExpiry) {
      return res.status(400).json({ message: "Invalid request" });
    }

    if (user.otpExpiry < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    if (Number(otp) !== user.resetOTP) {
      return res.status(400).json({ message: "Incorrect OTP" });
    }

    user.password = newPassword;
    user.resetOTP = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.json({ success: true, message: "Password updated" });
  } catch (err) {
    if (mongoose.connection.readyState !== 1) {
      console.error('Reset-password database unavailable:', err.name || err.code || 'UnknownError');
      return res.status(503).json({ message: "Password reset is temporarily unavailable because the database cannot be reached." });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// REGISTER (for staff)
app.post("/register", async (req, res) => {
  try {
    const { username, password, role, name, email, phone } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ message: "Username already taken" });
    }

    const newUser = new User({
      username,
      password,
      role: role || "staff",
      name,
      email,
      phone
    });

    await newUser.save();
    res.json({ success: true, id: newUser._id });
  } catch (err) {
    if (mongoose.connection.readyState !== 1) {
      console.error('Registration database unavailable:', err.name || err.code || 'UnknownError');
      return res.status(503).json({
        success: false,
        message: "Registration is temporarily unavailable because the database cannot be reached."
      });
    }

    if (err?.code === 11000) {
      return res.status(409).json({ message: "Username already taken" });
    }

    console.error('Registration error:', err.name || err.code || 'UnknownError');
    res.status(500).json({ message: "Registration failed" });
  }
});

// HEALTHCHECK
app.get("/health", (req,res) => {
  res.json({ status: "ok", message: "Backend running" });
});

// SEARCH MEDICINE
app.get("/search/:name", async (req, res) => {
  try {
    const name = req.params.name || "";
    const medicines = await Medicine.find({
      name: { $regex: name, $options: "i" }
    }).limit(20);

    const hasLocation = medicines.some(m => m.rack && m.shelf);
    if (medicines.length > 0 && !hasLocation) {
      const baseName = name.split(/[\s,-]+/)[0];
      if (baseName && baseName.length > 2) {
        const fallback = await Medicine.find({
          name: { $regex: `^${baseName}`, $options: "i" },
          rack: { $exists: true, $ne: "" },
          shelf: { $exists: true, $ne: "" }
        }).limit(20);
        if (fallback.length > 0) {
          return res.json(fallback);
        }
      }
    }

    res.json(medicines);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Server error during search" });
  }
});

// LOW STOCK
app.get("/low-stock", async (req, res) => {
  try {
    const medicines = await Medicine.find({ quantity: { $lte: 20 } }).sort({ quantity: 1 });
    res.json(medicines);
  } catch (err) {
    console.error("Low stock error:", err);
    res.status(500).json([]);
  }
});

// ANALYTICS
app.get("/analytics", async (req, res) => {
  try {
    const totalMedicines = await Medicine.countDocuments();
    const medicines = await Medicine.find();
    let totalStock = 0;
    medicines.forEach(m => totalStock += m.quantity);
    
    // Get total staff
    const totalStaff = await User.countDocuments({ role: "staff" });
    
    // Get sales data for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const sales = await Sales.aggregate([
      { $match: { sold_at: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$sold_at" } }, total: { $sum: "$total" } } },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({ 
      totalMedicines, 
      totalStock,
      totalStaff,
      weeklySales: sales.map(s => s.total),
      weeklyLabels: sales.map(s => s._id)
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ totalMedicines: 0, totalStock: 0, totalStaff: 0 });
  }
});

// DEBUG: show top medicines and types (temporary)
app.get('/debug-stock', async (req, res) => {
  try {
    const totalMedicines = await Medicine.countDocuments();
    const medicines = await Medicine.find().sort({ quantity: -1 }).limit(50);

    // include type info for quantity fields
    const meds = medicines.map(m => ({ id: m._id, name: m.name, quantity: m.quantity, qtyType: typeof m.quantity }));

    res.json({ totalMedicines, topByQuantity: meds });
  } catch (err) {
    console.error('Debug-stock error', err);
    res.status(500).json({ error: 'debug failed' });
  }
});

// BILLING - Generate bill and update stock
app.post("/billing", async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || Object.keys(items).length === 0) {
      return res.status(400).json({ message: "No items in cart" });
    }

    let totalAmount = 0;
    const billItems = [];

    for (const [medId, medicine] of Object.entries(items)) {
      // ensure medId is valid
      if (!medId || medId === 'undefined') {
        console.error("Skipping invalid medicine id in billing", medId);
        continue; // ignore invalid entries
      }

      const qty = medicine.quantity;
      const itemTotal = medicine.price * qty;
      totalAmount += itemTotal;

      // Update medicine quantity
      await Medicine.findByIdAndUpdate(medId, {
        $inc: { quantity: -qty }
      });

      // Record sale
      const sale = new Sales({
        medicine_id: medId,
        medicine_name: medicine.name,
        qty: qty,
        total: itemTotal
      });
      await sale.save();

      billItems.push({
        name: medicine.name,
        qty: qty,
        price: medicine.price,
        total: itemTotal
      });
    }

    // Create bill
    const bill = new Bill({
      items: billItems,
      total_amount: totalAmount
    });
    await bill.save();

    res.json({ success: true, totalAmount, billId: bill._id, itemsCount: billItems.length });
  } catch (err) {
    console.error("Billing error:", err);
    res.status(500).json({ message: "Billing failed" });
  }
});

// FILTER BY COMPANY
app.get("/company/:name", async (req, res) => {
  try {
    const medicines = await Medicine.find({ company: req.params.name });
    res.json(medicines);
  } catch (err) {
    res.status(500).json([]);
  }
});

// ROUTES FOR MEDICINE MANAGEMENT

// Get all medicines (with optional limit)
app.get('/medicines', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // default 50 per page
    const skip = (page - 1) * limit;
    
    const meds = await Medicine.find()
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Medicine.countDocuments();
    
    res.json({
      data: meds,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Fetch medicines error', err);
    res.status(500).json({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  }
});

// Get every medicine without pagination
app.get('/medicines/all', async (req, res) => {
  try {
    const meds = await Medicine.find().sort({ name: 1 });
    res.json(meds);
  } catch (err) {
    console.error('Fetch all medicines error', err);
    res.status(500).json({ message: 'Failed to fetch all medicines' });
  }
});

// Get summary/analytics
app.get('/medicines/summary', async (req, res) => {
  try {
    const total = await Medicine.countDocuments();
    const totalStock = await Medicine.aggregate([
      { $group: { _id: null, totalQty: { $sum: '$quantity' } } }
    ]);
    
    res.json({
      totalMedicines: total,
      totalStock: totalStock[0]?.totalQty || 0
    });
  } catch (err) {
    console.error('Summary error', err);
    res.status(500).json({ totalMedicines: 0, totalStock: 0 });
  }
});

// Create a new medicine record
app.post('/medicines', async (req, res) => {
  try {
    const { name, company, price, quantity, rack, shelf } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Name required' });
    }
    const newMed = new Medicine({ name, company, price: price || 0, quantity: quantity || 0, rack, shelf });
    await newMed.save();
    res.json({ success: true, medicine: newMed });
  } catch (err) {
    console.error('Create medicine error', err);
    res.status(500).json({ message: 'Failed to create medicine' });
  }
});

// Increase stock for a medicine by id (body: { amount: <number> })
app.post('/medicines/:id/increase', async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!amount || isNaN(amount)) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const medicine = await Medicine.findByIdAndUpdate(
      req.params.id,
      { $inc: { quantity: amount } },
      { new: true }
    );

    if (!medicine) return res.status(404).json({ message: 'Medicine not found' });

    res.json({ success: true, medicine });
  } catch (err) {
    console.error('Increase stock error', err);
    res.status(500).json({ message: 'Failed to increase stock' });
  }
});

// ==================== STAFF MANAGEMENT ====================

// GET ALL STAFF (for admin)
app.get("/staff", async (req, res) => {
  try {
    const staff = await User.find({ role: "staff" }).select("-password");
    res.json(staff);
  } catch (err) {
    res.status(500).json([]);
  }
});

// GET STAFF PROFILE
app.get("/staff/:id/profile", async (req, res) => {
  try {
    const staff = await User.findById(req.params.id).select("-password");
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: "Not found" });
  }
});

// UPDATE STAFF PROFILE
app.put("/staff/:id/profile", async (req, res) => {
  try {
    const { name, email, phone, photo } = req.body;
    const updateData = { name, email, phone };
    if (photo !== undefined) updateData.photo = photo; // allow null/empty to clear

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select("-password");
    res.json(updated);
  } catch (err) {
    console.error("Profile update error", err);
    // return error details to help frontend
    res.status(500).json({ message: "Update failed", error: err.message });
  }
});

// ==================== ATTENDANCE ====================

// MARK ATTENDANCE (from admin)
app.post("/attendance/mark", async (req, res) => {
  try {
    const { user_id, status } = req.body;
    
    console.log("=== ATTENDANCE MARK REQUEST ===");
    console.log("user_id:", user_id, "type:", typeof user_id);
    console.log("status:", status);
    
    if (!user_id || !status) {
      console.log("Missing fields - user_id:", !!user_id, "status:", !!status);
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    
    // Validate status
    if (!["present", "absent", "leave"].includes(status)) {
      console.log("Invalid status:", status);
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    
    let userId;
    try {
      userId = mongoose.Types.ObjectId.isValid(user_id) ? new mongoose.Types.ObjectId(user_id) : user_id;
      console.log("Converted user_id to ObjectId:", userId);
    } catch (e) {
      console.log("Error converting user_id:", e.message);
      return res.status(400).json({ success: false, message: "Invalid user ID format" });
    }
    
    // Get user info for username
    const user = await User.findById(userId);
    console.log("User lookup result:", user ? `Found ${user.username}` : "NOT FOUND");
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    console.log("Date range: ", startOfDay, " to ", endOfDay);
    
    let attendance = await Attendance.findOne({
      user_id: userId,
      date: { $gte: startOfDay, $lte: endOfDay }
    });
    
    console.log("Attendance record exists:", !!attendance);
    
    if (attendance) {
      // Update existing record
      attendance.status = status;
      attendance.check_in = new Date();
      await attendance.save();
      console.log("Updated attendance record");
    } else {
      // Create new record
      attendance = new Attendance({
        user_id: userId,
        username: user.username,
        date: startOfDay,
        status: status,
        check_in: new Date()
      });
      await attendance.save();
      console.log("Created new attendance record");
    }
    
    console.log("Success - returning record");
    res.json({ success: true, message: "Attendance marked successfully", attendance });
  } catch (err) {
    console.error("=== ATTENDANCE ERROR ===");
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({ success: false, message: "Failed to mark attendance: " + err.message });
  }
});

// CHECK IN / MARK ATTENDANCE (from staff - DEPRECATED, now admin only)
app.post("/attendance/checkin", async (req, res) => {
  try {
    const { user_id, username, status } = req.body;
    
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    let attendance = await Attendance.findOne({
      user_id: new mongoose.Types.ObjectId(user_id),
      date: { $gte: startOfDay, $lte: endOfDay }
    });
    
    if (attendance) {
      attendance.check_in = new Date();
      attendance.status = status || "present";
      await attendance.save();
    } else {
      attendance = new Attendance({
        user_id,
        username,
        date: startOfDay,
        status: status || "present",
        check_in: new Date()
      });
      await attendance.save();
    }
    
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ message: "Check-in failed" });
  }
});

// CHECK OUT
app.post("/attendance/checkout", async (req, res) => {
  try {
    const { user_id } = req.body;
    
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    const attendance = await Attendance.findOneAndUpdate(
      { user_id: new mongoose.Types.ObjectId(user_id), date: { $gte: startOfDay, $lte: endOfDay } },
      { check_out: new Date() },
      { new: true }
    );
    
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ message: "Check-out failed" });
  }
});

// GET TODAY'S ATTENDANCE (for staff - to check if attendance marked)
app.get("/attendance/:user_id/today", async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    const attendance = await Attendance.findOne({
      user_id: new mongoose.Types.ObjectId(req.params.user_id),
      date: { $gte: startOfDay, $lte: endOfDay }
    });
    
    if (attendance) {
      res.json({
        marked: true,
        status: attendance.status,
        timestamp: attendance.check_in || new Date()
      });
    } else {
      res.json({
        marked: false,
        status: null,
        timestamp: null
      });
    }
  } catch (err) {
    console.error("Error getting today's attendance:", err);
    res.status(500).json({ marked: false });
  }
});

// GET STAFF ATTENDANCE RECORDS
app.get("/attendance/:user_id", async (req, res) => {
  try {
    const records = await Attendance.find({ user_id: new mongoose.Types.ObjectId(req.params.user_id) })
      .sort({ date: -1 })
      .limit(30);
    res.json(records);
  } catch (err) {
    console.error("Error fetching attendance records:", err);
    res.status(500).json([]);
  }
});

// GET TODAY'S ATTENDANCE REPORT (for admin)
app.get("/attendance-report/today", async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    console.log("Fetching attendance for today - Range:", startOfDay, "to", endOfDay);
    
    const records = await Attendance.find({
      date: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ check_in: -1 });
    
    console.log("Found attendance records:", records.length);
    
    res.json(records);
  } catch (err) {
    console.error("Error fetching today's attendance:", err.message);
    res.status(500).json([]);
  }
});

// GET ALL ATTENDANCE (for admin)
app.get("/attendance-report/all", async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const records = await Attendance.find({
      date: { $gte: thirtyDaysAgo }
    }).sort({ date: -1 });
    
    res.json(records);
  } catch (err) {
    res.status(500).json([]);
  }
});

// ==================== BILLS HISTORY ====================

// GET ALL BILLS
app.get("/bills", async (req, res) => {
  try {
    const bills = await Bill.find().sort({ created_at: -1 }).limit(100);
    res.json(bills);
  } catch (err) {
    res.status(500).json([]);
  }
});

// GET SPECIFIC BILL
app.get("/bills/:id", async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }
    res.json(bill);
  } catch (err) {
    res.status(500).json({ message: "Error fetching bill" });
  }
});

// SERVE HOMEPAGE
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendStatic, 'index.html'));
});

// ==================== SEED DATA ====================
async function seedDatabase() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await User.insertMany([
        { username: "admin", password: "admin", role: "admin", name: "Admin", email: "admin@pharmaflow.com", phone: "9000000001" },
        { username: "staff", password: "staff", role: "staff", name: "John Doe", email: "john@pharmaflow.com", phone: "9000000002" },
        { username: "staff2", password: "staff2", role: "staff", name: "Jane Smith", email: "jane@pharmaflow.com", phone: "9000000003" }
      ]);
      console.log("✅ Users created");
    }

    const medCount = await Medicine.countDocuments();
    if (medCount === 0) {
      await Medicine.insertMany([
        { name: "Paracetamol 500mg", company: "Acme Pharma", price: 20, quantity: 50, rack: "R1", shelf: "S1" },
        { name: "Amoxicillin 250mg", company: "HealthCorp", price: 45, quantity: 30, rack: "R1", shelf: "S2" },
        { name: "Cough Syrup 100ml", company: "Wellness Ltd", price: 90, quantity: 10, rack: "R2", shelf: "S1" },
        { name: "Aspirin 500mg", company: "Acme Pharma", price: 15, quantity: 25, rack: "R2", shelf: "S2" },
        { name: "Ibuprofen 200mg", company: "HealthCorp", price: 25, quantity: 40, rack: "R3", shelf: "S1" }
      ]);
      console.log("✅ Medicines created");
    }
  } catch (err) {
    console.log("Seed data error:", err.message);
  }
}

// DEBUG: Check attendance collection
app.get("/debug-attendance", async (req, res) => {
  try {
    const allAttendance = await Attendance.find().limit(10);
    const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0, 0);
    const todayAttendance = await Attendance.find({ date: todayStart });
    
    res.json({ 
      totalRecords: await Attendance.countDocuments(),
      sampleRecords: allAttendance,
      todayAttendance: todayAttendance,
      queryDate: todayStart
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ==================== CATCH-ALL ROUTES (MUST BE LAST) ====================
// make root and all unmatched routes serve index.html for SPA
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendStatic, 'index.html'));
});
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendStatic, 'index.html'));
});

async function startServer() {
  try {
    await connectDB();
    await seedDatabase();
  } catch (error) {
    if (error.code === 'MONGODB_URI_MISSING') {
      console.error('❌ MONGODB_URI is missing. Database startup skipped.');
    } else if (mongoose.connection.readyState !== 1) {
      console.error('⚠️ Database unavailable. Server will start, but database endpoints will be unavailable.');
    }
  }

  const PORT = process.env.PORT || 5001;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

// Export for Vercel
module.exports = app;
