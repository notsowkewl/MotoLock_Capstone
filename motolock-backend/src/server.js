require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log("REQUEST:", req.method, req.url, req.body);
  next();
});

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d',
    },
  );
}

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [users] = await db.query(
      'SELECT id, full_name, email, role FROM users WHERE id = ?',
      [decoded.id],
    );

    if (!users.length) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    req.user = users[0];

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }
}

/* REGISTER */
app.post('/api/auth/register', async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      password,
      pin, 
    } = req.body;

    const pinHash = pin ? await bcrypt.hash(pin, 10) : null;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email],
    );

    if (existing.length) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
  `
  INSERT INTO users
  (full_name, email, phone, password_hash, pin_hash)
  VALUES (?, ?, ?, ?, ?)
  `,
  [
    fullName,
    email,
    phone || '',
    passwordHash,
    pinHash,
  ],
);

    const token = generateToken({
      id: result.insertId,
      email,
      role: 'rider',
    });

    return res.json({
      success: true,
      token,
      user: {
        id: result.insertId,
        fullName,
        email,
        phone,
      },
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/* LOGIN */
app.post('/api/auth/login', async (req, res) => {
  try {
    const {email, password} = req.body;

    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email],
    );

    if (!users.length) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(
      password,
      user.password_hash,
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/* DASHBOARD */
app.get('/api/dashboard/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [motorcycles] = await db.query(
      'SELECT * FROM motorcycles WHERE user_id = ? LIMIT 1',
      [userId],
    );

    const [devices] = await db.query(
      'SELECT * FROM devices WHERE user_id = ? LIMIT 1',
      [userId],
    );

    return res.json({
      success: true,
      user: req.user,
      motorcycle: motorcycles[0] || null,
      device: devices[0] || null,
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/* ADD CONTACT */
app.post(
  '/api/contacts',
  authMiddleware,
  async (req, res) => {
    try {
      const {name, phone, role} = req.body;

      await db.query(
        `
        INSERT INTO emergency_contacts
        (user_id, name, phone, role)
        VALUES (?, ?, ?, ?)
        `,
        [
          req.user.id,
          name,
          phone,
          role || '',
        ],
      );

      return res.json({
        success: true,
      });
    } catch (err) {
      console.log(err);

      return res.status(500).json({
        success: false,
        message: 'Server error',
      });
    }
  },
);

/* ADD MOTORCYCLE */
app.post(
  '/api/motorcycles',
  authMiddleware,
  async (req, res) => {
    try {
      const {
        plateNumber,
        model,
      } = req.body;

      await db.query(
        `
        INSERT INTO motorcycles
        (user_id, plate_number, model)
        VALUES (?, ?, ?)
        `,
        [
          req.user.id,
          plateNumber,
          model,
        ],
      );

      return res.json({
        success: true,
      });
    } catch (err) {
      console.log(err);

      return res.status(500).json({
        success: false,
        message: 'Server error',
      });
    }
  },
);
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'MotoLock backend working',
  });
});
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "MotoLock backend working"
  });
});

app.listen(process.env.PORT || 5001, "0.0.0.0", () => {
  console.log(`MotoLock backend running on port ${process.env.PORT || 5001}`);
});