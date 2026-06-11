require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
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

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizePhilippinePhone(phone) {
  const rawPhone = String(phone || '').trim();
  const compactPhone = rawPhone.replace(/[\s().-]/g, '');

  if (/^09\d{9}$/.test(compactPhone)) return compactPhone;
  if (/^\+639\d{9}$/.test(compactPhone)) return compactPhone;
  if (/^639\d{9}$/.test(compactPhone)) return `+${compactPhone}`;
  if (/^9\d{9}$/.test(compactPhone)) return `0${compactPhone}`;

  return compactPhone;
}

function parseFaceProfile(rawProfile) {
  if (!rawProfile) {
    return {
      descriptor: null,
      helmetDescriptor: null,
    };
  }

  try {
    const parsed = typeof rawProfile === 'string'
      ? JSON.parse(rawProfile)
      : rawProfile;

    if (Array.isArray(parsed)) {
      return {
        descriptor: parsed,
        helmetDescriptor: null,
      };
    }

    return {
      descriptor: Array.isArray(parsed.descriptor)
        ? parsed.descriptor
        : Array.isArray(parsed.faceDescriptor)
          ? parsed.faceDescriptor
          : null,
      helmetDescriptor: Array.isArray(parsed.helmetDescriptor)
        ? parsed.helmetDescriptor
        : null,
    };
  } catch (err) {
    return {
      descriptor: null,
      helmetDescriptor: null,
    };
  }
}

async function ensureRideHistoryTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ride_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      motorcycle_id INT NULL,
      motorcycle_plate VARCHAR(32) NOT NULL,
      motorcycle_model VARCHAR(128) NOT NULL,
      status ENUM('completed', 'alert') NOT NULL,
      face_verified TINYINT(1) NOT NULL DEFAULT 0,
      helmet_verified TINYINT(1) NOT NULL DEFAULT 0,
      alcohol_detected TINYINT(1) NOT NULL DEFAULT 0,
      alert_sent TINYINT(1) NOT NULL DEFAULT 0,
      brac DECIMAL(6, 3) NOT NULL DEFAULT 0.000,
      unlock_status VARCHAR(80) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ride_history_user_created (user_id, created_at),
      INDEX idx_ride_history_user_status (user_id, status)
    )
  `);
}

function mapRideHistoryRecord(record) {
  return {
    id: record.id,
    motorcycleId: record.motorcycle_id,
    motorcyclePlate: record.motorcycle_plate,
    motorcycleModel: record.motorcycle_model,
    status: record.status,
    faceVerified: Boolean(record.face_verified),
    helmetVerified: Boolean(record.helmet_verified),
    alcoholDetected: Boolean(record.alcohol_detected),
    alertSent: Boolean(record.alert_sent),
    brac: Number(record.brac),
    unlockStatus: record.unlock_status,
    createdAt: record.created_at,
  };
}

async function saveFaceProfile(userId, { descriptor, helmetDescriptor }) {
  const [rows] = await db.query(
    'SELECT face_descriptor FROM users WHERE id = ?',
    [userId],
  );

  const current = parseFaceProfile(rows[0]?.face_descriptor);
  const nextProfile = {
    descriptor: Array.isArray(descriptor) ? descriptor : current.descriptor,
    helmetDescriptor: Array.isArray(helmetDescriptor)
      ? helmetDescriptor
      : current.helmetDescriptor,
  };

  if (!nextProfile.descriptor && !nextProfile.helmetDescriptor) {
    throw new Error('Invalid face descriptor.');
  }

  await db.query(
    `
    UPDATE users
    SET face_descriptor = ?,
        face_enrolled = 1,
        face_enrolled_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [JSON.stringify(nextProfile), userId],
  );

  return nextProfile;
}

function euclideanDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return Number.POSITIVE_INFINITY;
  }

  const sum = a.reduce((total, value, index) => {
    const diff = Number(value) - Number(b[index]);
    return total + diff * diff;
  }, 0);

  return Math.sqrt(sum);
}

async function loadFaceProfile(userId) {
  const [rows] = await db.query(
    'SELECT face_descriptor FROM users WHERE id = ?',
    [userId],
  );

  return parseFaceProfile(rows[0]?.face_descriptor);
}

/* GOOGLE LOGIN */
app.post('/api/auth/google', async (req, res) => {
  try {
    const { fullName, email, googleId } = req.body;

    if (!email || !googleId) {
      return res.status(400).json({
        success: false,
        message: 'Missing Google account details',
      });
    }

    let [users] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email],
    );

    let user = users[0];

    if (!user) {
      const [result] = await db.query(
        `
        INSERT INTO users
        (full_name, email, phone, password_hash, role, email_verified, auth_provider, google_id)
        VALUES (?, ?, ?, NULL, 'rider', 1, 'google', ?)
        `,
        [
          fullName || 'Google User',
          email,
          '',
          googleId,
        ],
      );

      [users] = await db.query(
        'SELECT * FROM users WHERE id = ?',
        [result.insertId],
      );

      user = users[0];
    }

    const token = generateToken(user);

    const [contacts] = await db.query(
      'SELECT id FROM emergency_contacts WHERE user_id = ? LIMIT 1',
      [user.id],
    );

    const [motorcycles] = await db.query(
      'SELECT id FROM motorcycles WHERE user_id = ? LIMIT 1',
      [user.id],
    );

    const setupStatus = {
      hasFaceId: user.face_enrolled === 1,
      hasPin: !!user.pin_hash,
      hasEmergencyContact: contacts.length > 0,
      hasMotorcycle: motorcycles.length > 0,
      hasConnectedDevice: false,
    };

    const dashboardRideState =
      Object.values(setupStatus).every(Boolean)
        ? 'lockedDefault'
        : 'setupRequired';

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
      setupStatus,
      dashboardRideState,
    });

  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: err.sqlMessage || 'Server error',
    });
  }
});

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
      email: rawEmail,
      phone: rawPhone,
      password,
      pin, 
    } = req.body;
    const email = normalizeEmail(rawEmail);
    const phone = normalizePhilippinePhone(rawPhone);

    const pinHash = pin ? await bcrypt.hash(pin, 10) : null;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    if (!(/^09\d{9}$/.test(phone) || /^\+639\d{9}$/.test(phone))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Use 09XXXXXXXXX or +639XXXXXXXXX.',
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

    const [existingPhone] = await db.query(
  'SELECT id FROM users WHERE phone = ?',
  [phone],
);

if (existingPhone.length) {
  return res.status(400).json({
    success: false,
    message: 'Phone number already exists',
  });
}

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationCode =
      Math.floor(100000 + Math.random() * 900000).toString();
    const connection = await db.getConnection();
    let insertedUserId = null;

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
  `
  INSERT INTO users
(
  full_name,
  email,
  phone,
  password_hash,
  pin_hash,
  email_verification_code,
  email_verification_expires
)
VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
  `,
  [
    fullName,
    email,
    phone || '',
    passwordHash,
    pinHash,
    verificationCode
  ],
);

      insertedUserId = result.insertId;

      await transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: email,
  subject: 'MotoLock Email Verification',
  html: `
    <h2>Verify Your MotoLock Account</h2>

    <p>Your verification code is:</p>

    <h1>${verificationCode}</h1>

    <p>This code will expire in 10 minutes.</p>
  `,
});

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    const token = generateToken({
      id: insertedUserId,
      email,
      role: 'rider',
    });

    return res.json({
      success: true,
      token,
      user: {
        id: insertedUserId,
        fullName,
        email,
        phone,
      },
    });
  } catch (err) {
  console.log(err);

  if (err.code === 'ER_DUP_ENTRY') {
    const duplicateTarget = /unique_phone|phone/i.test(err.sqlMessage || '')
      ? 'Phone number'
      : 'Email';

    return res.status(400).json({
      success: false,
      message: `${duplicateTarget} already exists`,
    });
  }

  if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    const constraintMessage = /email/i.test(err.sqlMessage || '')
      ? 'Invalid email format'
      : 'Invalid phone number format. Use 09XXXXXXXXX or +639XXXXXXXXX.';

    return res.status(400).json({
      success: false,
      message: constraintMessage,
    });
  }

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
    const loginId = (email || '').trim();
    const phoneLoginId = normalizePhilippinePhone(loginId);

    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ? OR phone = ? LIMIT 1',
      [loginId, phoneLoginId],
    );

    if (!users.length) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const user = users[0];

    if (user.email_verified !== 1) {
  return res.status(403).json({
    success: false,
    message: 'Please verify your email first',
  });
}

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

   const [contacts] = await db.query(
  'SELECT id FROM emergency_contacts WHERE user_id = ? LIMIT 1',
  [user.id],
);

const [motorcycles] = await db.query(
  'SELECT id FROM motorcycles WHERE user_id = ? LIMIT 1',
  [user.id],
);

const setupStatus = {
  hasFaceId: user.face_enrolled === 1,
  hasPin: !!user.pin_hash,
  hasEmergencyContact: contacts.length > 0,
  hasMotorcycle: motorcycles.length > 0,
  hasConnectedDevice: false
};

const dashboardRideState =
  Object.values(setupStatus).every(Boolean)
    ? 'lockedDefault'
    : 'setupRequired';

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
  setupStatus,
  dashboardRideState
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

/* ADD EMERGENCY CONTACT */
app.post('/api/contacts', authMiddleware, async (req, res) => {
  try {
    const { name, phone, role } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing contact details',
      });
    }

    const cleanedPhone = phone.replace(/\s+/g, '');

    const [riders] = await db.query(
      'SELECT phone FROM users WHERE id = ?',
      [req.user.id],
    );

    const riderPhone = riders[0].phone.replace(/\s+/g, '');

    if (cleanedPhone === riderPhone) {
      return res.status(400).json({
        success: false,
        message: 'Emergency contact number cannot be the same as rider phone number',
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO emergency_contacts
      (user_id, name, phone, role)
      VALUES (?, ?, ?, ?)
      `,
      [
        req.user.id,
        name,
        cleanedPhone,
        role || 'Primary Contact',
      ],
    );

    return res.json({
  success: true,
  message: 'Emergency contact saved',
  contact: {
    id: result.insertId,
    name,
    phone: cleanedPhone,
    role: role || 'Primary Contact',
  },
});

  } catch (err) {
    console.log(err);

    if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact phone number format',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/* GET EMERGENCY CONTACTS */
app.get('/api/contacts', authMiddleware, async (req, res) => {
  try {
    const [contacts] = await db.query(
      `
      SELECT
        id,
        name,
        phone,
        role
      FROM emergency_contacts
      WHERE user_id = ?
      ORDER BY id DESC
      `,
      [req.user.id]
    );

    return res.json({
      success: true,
      contacts,
    });

  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

app.put('/api/contacts/:id', authMiddleware, async (req, res) => {
  try {
    const { name, phone, role } = req.body;
    const cleanedPhone = phone.replace(/\s+/g, '');

    const [riders] = await db.query(
      'SELECT phone FROM users WHERE id = ?',
      [req.user.id]
    );

    if (cleanedPhone === riders[0].phone.replace(/\s+/g, '')) {
      return res.status(400).json({
        success: false,
        message: 'Emergency contact number cannot be the same as rider phone number',
      });
    }

    await db.query(
      `
      UPDATE emergency_contacts
      SET name = ?, phone = ?, role = ?
      WHERE id = ? AND user_id = ?
      `,
      [name, cleanedPhone, role, req.params.id, req.user.id]
    );

    return res.json({
      success: true,
      contact: {
        id: Number(req.params.id),
        name,
        phone: cleanedPhone,
        role,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: err.sqlMessage || 'Server error',
    });
  }
});

/* DELETE EMERGENCY CONTACT */
app.delete('/api/contacts/:id', authMiddleware, async (req, res) => {
  try {

    await db.query(
      `
      DELETE FROM emergency_contacts
      WHERE id = ? AND user_id = ?
      `,
      [req.params.id, req.user.id]
    );

    return res.json({
      success: true,
      message: 'Emergency contact deleted',
    });

  } catch (err) {

    console.log(err);

    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/* ADD MOTORCYCLE */
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

app.post("/api/face/enroll", authMiddleware, async (req, res) => {
  try {
    const descriptor = req.body.descriptor || req.body.faceDescriptor;
    const helmetDescriptor = req.body.helmetDescriptor;

    if ((!descriptor || !Array.isArray(descriptor)) && (!helmetDescriptor || !Array.isArray(helmetDescriptor))) {
      return res.status(400).json({
        success: false,
        message: "Invalid face descriptor."
      });
    }

    const faceProfile = await saveFaceProfile(req.user.id, {
      descriptor,
      helmetDescriptor,
    });

    res.json({
      success: true,
      message: "Face profile saved.",
      descriptor: faceProfile.descriptor,
      helmetDescriptor: faceProfile.helmetDescriptor,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to save face profile."
    });
  }
});

app.get("/api/face/me", authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT face_descriptor FROM users WHERE id = ?",
      [req.user.id]
    );

    const faceProfile = parseFaceProfile(rows[0]?.face_descriptor);

    if (!rows.length || (!faceProfile.descriptor && !faceProfile.helmetDescriptor)) {
      return res.status(404).json({
        success: false,
        message: "No face profile found."
      });
    }

    res.json({
      success: true,
      descriptor: faceProfile.descriptor,
      helmetDescriptor: faceProfile.helmetDescriptor,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to load face profile."
    });
  }
});

app.delete("/api/face/me", authMiddleware, async (req, res) => {
  try {
    await db.query(
      `
      UPDATE users
      SET face_descriptor = NULL,
          face_enrolled = 0,
          face_enrolled_at = NULL
      WHERE id = ?
      `,
      [req.user.id]
    );

    res.json({
      success: true,
      message: "Face ID removed."
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to remove face profile."
    });
  }
});

app.post("/api/face/verify", authMiddleware, async (req, res) => {
  try {
    const { descriptor, kind } = req.body;

    if (!Array.isArray(descriptor)) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: "Invalid face descriptor.",
      });
    }

    const faceProfile = await loadFaceProfile(req.user.id);

    if (!faceProfile.descriptor) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: "No registered Face ID found.",
      });
    }

    const registeredDistance = euclideanDistance(faceProfile.descriptor, descriptor);
    const helmetDistance = faceProfile.helmetDescriptor
      ? euclideanDistance(faceProfile.helmetDescriptor, descriptor)
      : null;
    const isHelmet = kind === "helmet";
    const registeredThreshold = isHelmet ? 0.50 : 0.42;
    const helmetThreshold = 0.52;
    const verified = isHelmet
      ? registeredDistance < registeredThreshold
      : registeredDistance < registeredThreshold;

    return res.json({
      success: true,
      verified,
      kind: isHelmet ? "helmet" : "face",
      registeredDistance,
      helmetDistance,
      threshold: registeredThreshold,
      message: verified
        ? "Face verified."
        : "Face does not match registered rider.",
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      verified: false,
      message: "Failed to verify face.",
    });
  }
});

app.post("/api/verification/enroll-face", authMiddleware, async (req, res) => {
  try {
    const descriptor = req.body.descriptor || req.body.faceDescriptor;
    const helmetDescriptor = req.body.helmetDescriptor;

    if ((!descriptor || !Array.isArray(descriptor)) && (!helmetDescriptor || !Array.isArray(helmetDescriptor))) {
      return res.status(400).json({
        success: false,
        message: "Invalid face descriptor."
      });
    }

    const faceProfile = await saveFaceProfile(req.user.id, {
      descriptor,
      helmetDescriptor,
    });

    return res.json({
      success: true,
      message: "Face ID setup saved",
      descriptor: faceProfile.descriptor,
      helmetDescriptor: faceProfile.helmetDescriptor,
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: "Failed to save face profile.",
    });
  }
});

app.post("/api/verification/liveness", authMiddleware, async (req, res) => {
  try {
    const { distance, verified, kind } = req.body;

    return res.json({
      success: true,
      message: "Face verification recorded",
      verification: {
        kind: kind || "face",
        distance: typeof distance === "number" ? distance : null,
        verified: verified === true,
      },
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: "Failed to record face verification.",
    });
  }
});

app.post('/api/motorcycles', authMiddleware, async (req, res) => {
  try {
    const { plateNumber, model, year, color } = req.body;

    if (!plateNumber || !model || !year || !color) {
      return res.status(400).json({
        success: false,
        message: 'Missing motorcycle details',
      });
    }

    const [result] = await db.query(
      `
      INSERT INTO motorcycles
      (user_id, plate_number, model, year, color)
      VALUES (?, ?, ?, ?, ?)
      `,
      [req.user.id, plateNumber, model, year, color],
    );

    return res.json({
      success: true,
      motorcycle: {
        id: result.insertId,
        plate: plateNumber,
        model,
        year,
        color,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: err.sqlMessage || 'Server error',
    });
  }
});

app.put('/api/motorcycles/:id', authMiddleware, async (req, res) => {
  try {
    const { plateNumber, model, year, color } = req.body;

    await db.query(
      `
      UPDATE motorcycles
      SET plate_number = ?, model = ?, year = ?, color = ?
      WHERE id = ? AND user_id = ?
      `,
      [plateNumber, model, year, color, req.params.id, req.user.id],
    );

    return res.json({
      success: true,
      motorcycle: {
        id: Number(req.params.id),
        plate: plateNumber,
        model,
        year,
        color,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: err.sqlMessage || 'Server error',
    });
  }
});

app.get('/api/motorcycles', authMiddleware, async (req, res) => {
  try {
    const [motorcycles] = await db.query(
      `
      SELECT id, plate_number, model, year, color
      FROM motorcycles
      WHERE user_id = ?
      ORDER BY id DESC
      `,
      [req.user.id],
    );

    return res.json({
      success: true,
      motorcycles,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/* DELETE MOTORCYCLE */
app.delete('/api/motorcycles/:id', authMiddleware, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM motorcycles WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    return res.json({
      success: true,
      message: 'Motorcycle deleted',
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

app.get('/api/ride-history', authMiddleware, async (req, res) => {
  try {
    const requestedFilter = String(req.query.filter || 'all').toLowerCase();
    const filter = ['completed', 'alert'].includes(requestedFilter)
      ? requestedFilter
      : null;
    const queryParams = [req.user.id];
    let whereClause = 'WHERE user_id = ?';

    if (filter) {
      whereClause += ' AND status = ?';
      queryParams.push(filter);
    }

    const [records] = await db.query(
      `
      SELECT *
      FROM ride_history
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      `,
      queryParams,
    );

    const [summaryRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'alert' THEN 1 ELSE 0 END) AS alerts
      FROM ride_history
      WHERE user_id = ?
      `,
      [req.user.id],
    );

    return res.json({
      success: true,
      records: records.map(mapRideHistoryRecord),
      summary: {
        total: Number(summaryRows[0]?.total || 0),
        alerts: Number(summaryRows[0]?.alerts || 0),
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: err.sqlMessage || 'Failed to load ride history',
    });
  }
});

app.post('/api/ride-history', authMiddleware, async (req, res) => {
  try {
    const {
      motorcycleId,
      motorcyclePlate,
      motorcycleModel,
      status,
      faceVerified,
      helmetVerified,
      alcoholDetected,
      alertSent,
      brac,
      unlockStatus,
    } = req.body;

    if (!['completed', 'alert'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ride history status',
      });
    }

    const finalBrac = Number(brac);

    if (!Number.isFinite(finalBrac) || finalBrac < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid BrAC value',
      });
    }

    let resolvedMotorcycleId = Number.isFinite(Number(motorcycleId))
      ? Number(motorcycleId)
      : null;
    let resolvedPlate = String(motorcyclePlate || '').trim();
    let resolvedModel = String(motorcycleModel || '').trim();

    if (resolvedMotorcycleId) {
      const [motorcycles] = await db.query(
        `
        SELECT id, plate_number, model
        FROM motorcycles
        WHERE id = ? AND user_id = ?
        LIMIT 1
        `,
        [resolvedMotorcycleId, req.user.id],
      );

      if (motorcycles.length > 0) {
        resolvedPlate = motorcycles[0].plate_number;
        resolvedModel = motorcycles[0].model;
      } else {
        resolvedMotorcycleId = null;
      }
    }

    if (!resolvedPlate) resolvedPlate = 'No plate';
    if (!resolvedModel) resolvedModel = 'Motorcycle';

    const [result] = await db.query(
      `
      INSERT INTO ride_history
      (
        user_id,
        motorcycle_id,
        motorcycle_plate,
        motorcycle_model,
        status,
        face_verified,
        helmet_verified,
        alcohol_detected,
        alert_sent,
        brac,
        unlock_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        req.user.id,
        resolvedMotorcycleId,
        resolvedPlate,
        resolvedModel,
        status,
        faceVerified === true ? 1 : 0,
        helmetVerified === true ? 1 : 0,
        alcoholDetected === true ? 1 : 0,
        alertSent === true ? 1 : 0,
        finalBrac.toFixed(3),
        String(unlockStatus || (status === 'completed' ? 'Ignition access granted' : 'Motor still locked')).trim(),
      ],
    );

    const [records] = await db.query(
      'SELECT * FROM ride_history WHERE id = ? AND user_id = ? LIMIT 1',
      [result.insertId, req.user.id],
    );

    return res.json({
      success: true,
      record: mapRideHistoryRecord(records[0]),
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: err.sqlMessage || 'Failed to save ride history',
    });
  }
});

/* UPDATE PROFILE */
app.put('/api/profile', authMiddleware, async (req, res) => {
  try {
    const { fullName, email, phone } = req.body;

    if (!fullName || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Missing profile fields',
      });
    }

    const [existing] = await db.query(
      `
      SELECT id
      FROM users
      WHERE (email = ? OR phone = ?)
        AND id != ?
      `,
      [email, phone, req.user.id],
    );

    if (existing.length) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number already exists',
      });
    }

    await db.query(
      `
      UPDATE users
      SET full_name = ?,
          email = ?,
          phone = ?
      WHERE id = ?
      `,
      [fullName, email, phone, req.user.id],
    );

    return res.json({
      success: true,
      user: {
        id: req.user.id,
        fullName,
        email,
        phone,
        role: req.user.role,
      },
    });

  } catch (err) {
    console.log(err);

    if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format',
      });
    }

    return res.status(500).json({
      success: false,
      message: err.sqlMessage || 'Server error',
    });
  }
});

/* CHANGE PASSWORD */
app.put('/api/profile/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Missing password fields',
      });
    }

    const [users] = await db.query(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id],
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isMatch = await bcrypt.compare(
      currentPassword,
      users[0].password_hash,
    );

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await db.query(
  `
  UPDATE users
  SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
  `,
  [newPasswordHash, req.user.id],
);

    return res.json({
      success: true,
      message: 'Password updated successfully',
    });

  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/* SAVE FACE SETUP */
app.put('/api/setup/face', authMiddleware, async (req, res) => {
  try {
    await db.query(
      `
      UPDATE users
      SET face_enrolled = 1,
          face_enrolled_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [req.user.id]
    );

    return res.json({
      success: true,
      message: 'Face ID setup saved',
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/* SAVE PIN SETUP */
app.put('/api/setup/pin', authMiddleware, async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits',
      });
    }

    const pinHash = await bcrypt.hash(pin, 10);

    await db.query(
      `
      UPDATE users
      SET pin_hash = ?
      WHERE id = ?
      `,
      [pinHash, req.user.id]
    );

    return res.json({
      success: true,
      message: 'PIN setup saved',
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/* VERIFY PIN AFTER LOGIN */
app.post('/api/setup/pin/verify', authMiddleware, async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits',
      });
    }

    const [users] = await db.query(
      'SELECT pin_hash FROM users WHERE id = ?',
      [req.user.id],
    );

    if (!users.length || !users[0].pin_hash) {
      return res.status(400).json({
        success: false,
        message: 'No PIN set for this account',
      });
    }

    const isMatch = await bcrypt.compare(pin, users[0].pin_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect PIN',
      });
    }

    return res.json({
      success: true,
      message: 'PIN verified',
    });

  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/* FORGOT PASSWORD */
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const [users] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email],
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'Email not found',
      });
    }

    const resetCode =
      Math.floor(100000 + Math.random() * 900000).toString();

    await db.query(
      `
      UPDATE users
      SET reset_code = ?,
          reset_code_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
      WHERE email = ?
      `,
      [resetCode, email],
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'MotoLock Password Reset Code',
      html: `
        <h2>MotoLock Password Reset</h2>

        <p>Your verification code is:</p>

        <h1>${resetCode}</h1>

        <p>This code will expire in 10 minutes.</p>
      `,
    });

    return res.json({
      success: true,
      message: 'Reset code sent',
    });

  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: 'Failed to send reset email',
    });
  }
});

/* VERIFY RESET CODE */
app.post('/api/auth/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    const [users] = await db.query(
      `
      SELECT id
      FROM users
      WHERE email = ?
        AND reset_code = ?
        AND reset_code_expires > NOW()
      `,
      [email, code],
    );

    if (!users.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code',
      });
    }

    return res.json({
      success: true,
      message: 'Reset code verified',
    });

  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/* RESET FORGOT PASSWORD */
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing reset password fields',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.query(
      `
      UPDATE users
      SET password_hash = ?,
          reset_code = NULL,
          reset_code_expires = NULL
      WHERE email = ?
      `,
      [passwordHash, email],
    );

    return res.json({
      success: true,
      message: 'Password reset successful',
    });

  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/* VERIFY EMAIL */
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;

    const [users] = await db.query(
      `
      SELECT id
      FROM users
      WHERE email = ?
        AND email_verification_code = ?
        AND email_verification_expires > NOW()
      `,
      [email, code],
    );

    if (!users.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code',
      });
    }

    await db.query(
      `
      UPDATE users
      SET email_verified = 1,
          email_verification_code = NULL,
          email_verification_expires = NULL
      WHERE email = ?
      `,
      [email],
    );

    return res.json({
      success: true,
      message: 'Email verified successfully',
    });

  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/* FORGOT PIN - SEND CODE */
app.post('/api/auth/forgot-pin', async (req, res) => {
  try {
    const { email } = req.body;

    const [users] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'Email not found',
      });
    }

    const pinResetCode =
      Math.floor(100000 + Math.random() * 900000).toString();

    await db.query(
      `
      UPDATE users
      SET reset_code = ?,
          reset_code_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE)
      WHERE email = ?
      `,
      [pinResetCode, email]
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'MotoLock PIN Reset Code',
      html: `
        <h2>MotoLock PIN Reset</h2>
        <p>Your PIN reset verification code is:</p>
        <h1>${pinResetCode}</h1>
        <p>This code will expire in 10 minutes.</p>
      `,
    });

    return res.json({
      success: true,
      message: 'PIN reset code sent',
    });

  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: 'Failed to send PIN reset email',
    });
  }
});

/* EMAIL CHANGE - SEND CODE TO CURRENT EMAIL */
app.post('/api/profile/email-change/send-current-code', authMiddleware, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT email, email_change_cooldown_until FROM users WHERE id = ?',
      [req.user.id]
    );

    const user = users[0];

    if (user.email_change_cooldown_until && new Date(user.email_change_cooldown_until) > new Date()) {
      return res.status(429).json({
        success: false,
        message: 'Too many attempts. Please try again later.',
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await db.query(
      `
      UPDATE users
      SET email_change_current_code = ?,
          email_change_current_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
          email_change_attempts = 0
      WHERE id = ?
      `,
      [code, req.user.id]
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'MotoLock Email Change Verification',
      html: `
        <h2>MotoLock Email Change Request</h2>
        <p>Your verification code is:</p>
        <h1>${code}</h1>
        <p>This code will expire in 10 minutes.</p>
      `,
    });

    return res.json({
      success: true,
      message: 'Verification code sent to current email',
    });

  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification code',
    });
  }
});

/* EMAIL CHANGE - VERIFY CURRENT EMAIL CODE */
app.post('/api/profile/email-change/verify-current-code', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;

    const [users] = await db.query(
      `
      SELECT email_change_attempts
      FROM users
      WHERE id = ?
        AND email_change_current_code = ?
        AND email_change_current_expires > NOW()
      `,
      [req.user.id, code]
    );

    if (!users.length) {
      await db.query(
        `
        UPDATE users
        SET email_change_attempts = email_change_attempts + 1,
            email_change_cooldown_until =
              CASE
                WHEN email_change_attempts + 1 >= 3
                THEN DATE_ADD(NOW(), INTERVAL 5 MINUTE)
                ELSE email_change_cooldown_until
              END
        WHERE id = ?
        `,
        [req.user.id]
      );

      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code',
      });
    }

    return res.json({
      success: true,
      message: 'Current email verified',
    });

  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

/* EMAIL CHANGE - SEND CODE TO NEW EMAIL */
app.post('/api/profile/email-change/send-new-code', authMiddleware, async (req, res) => {
  try {
    const { newEmail } = req.body;

    if (!newEmail) {
      return res.status(400).json({
        success: false,
        message: 'New email is required',
      });
    }

    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [newEmail]
    );

    if (existing.length) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists',
      });
    }

    const code =
      Math.floor(100000 + Math.random() * 900000).toString();

    await db.query(
      `
      UPDATE users
      SET pending_email = ?,
          email_change_new_code = ?,
          email_change_new_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
          email_change_attempts = 0
      WHERE id = ?
      `,
      [newEmail, code, req.user.id]
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: newEmail,
      subject: 'MotoLock New Email Verification',
      html: `
        <h2>Verify Your New Email Address</h2>
        <p>Your verification code is:</p>
        <h1>${code}</h1>
        <p>This code will expire in 10 minutes.</p>
      `,
    });

    return res.json({
      success: true,
      message: 'Verification code sent to new email',
    });

  } catch (err) {
    console.log(err);

    return res.status(500).json({
      success: false,
      message: 'Failed to send verification code',
    });
  }
});

/* EMAIL CHANGE - VERIFY NEW EMAIL CODE */
app.post('/api/profile/email-change/verify-new-code', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;

    const [users] = await db.query(
      `
      SELECT pending_email, email_change_attempts
      FROM users
      WHERE id = ?
        AND email_change_new_code = ?
        AND email_change_new_expires > NOW()
      `,
      [req.user.id, code]
    );

    if (!users.length) {
      await db.query(
        `
        UPDATE users
        SET email_change_attempts = email_change_attempts + 1,
            email_change_cooldown_until =
              CASE
                WHEN email_change_attempts + 1 >= 3
                THEN DATE_ADD(NOW(), INTERVAL 5 MINUTE)
                ELSE email_change_cooldown_until
              END
        WHERE id = ?
        `,
        [req.user.id]
      );

      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code',
      });
    }

    const newEmail = users[0].pending_email;

    await db.query(
      `
      UPDATE users
      SET email = ?,
          pending_email = NULL,
          email_change_current_code = NULL,
          email_change_current_expires = NULL,
          email_change_new_code = NULL,
          email_change_new_expires = NULL,
          email_change_attempts = 0,
          email_change_cooldown_until = NULL
      WHERE id = ?
      `,
      [newEmail, req.user.id]
    );

    return res.json({
      success: true,
      message: 'Email updated successfully',
      user: {
        id: req.user.id,
        fullName: req.user.full_name,
        email: newEmail,
        role: req.user.role,
      },
    });

  } catch (err) {
    console.log(err);

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Email already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

async function startServer() {
  await ensureRideHistoryTable();

  app.listen(process.env.PORT || 5001, "0.0.0.0", () => {
    console.log(`MotoLock backend running on port ${process.env.PORT || 5001}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start MotoLock backend:', err);
  process.exit(1);
});
