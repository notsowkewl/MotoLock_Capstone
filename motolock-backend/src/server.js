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
    const [result] = await db.query(
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

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({
      success: false,
      message: 'Email or phone number already exists',
    });
  }

  if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    return res.status(400).json({
      success: false,
      message: 'Invalid phone number format',
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
    const { descriptor } = req.body;

    if (!descriptor || !Array.isArray(descriptor)) {
      return res.status(400).json({ message: "Invalid face descriptor." });
    }

    await db.query(
      "UPDATE users SET face_descriptor = ? WHERE id = ?",
      [JSON.stringify(descriptor), req.user.id]
    );

    res.json({ success: true, message: "Face profile saved." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save face profile." });
  }
});

app.get("/api/face/me", authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT face_descriptor FROM users WHERE id = ?",
      [req.user.id]
    );

    if (!rows.length || !rows[0].face_descriptor) {
      return res.status(404).json({ message: "No face profile found." });
    }

    res.json({
      descriptor: JSON.parse(rows[0].face_descriptor)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load face profile." });
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

app.listen(process.env.PORT || 5001, "0.0.0.0", () => {
  console.log(`MotoLock backend running on port ${process.env.PORT || 5001}`);
});