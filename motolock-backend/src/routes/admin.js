const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

module.exports = function(db, authMiddleware) {

  // Apply authMiddleware globally to all routes in this router
  router.use(authMiddleware);

  // Middleware to ensure user is an admin
  const adminMiddleware = async (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
  };

  // 1. Get Dashboard Stats & Overview
  router.get('/dashboard', adminMiddleware, async (req, res) => {
    try {
      const [totalUsers] = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "rider"');
      const [totalRides] = await db.query('SELECT COUNT(*) as count FROM ride_history');
      const [failedTests] = await db.query('SELECT COUNT(*) as count FROM ride_history WHERE alcohol_detected = 1');
      
      const [trends] = await db.query(`
        SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM ride_history 
        WHERE alcohol_detected = 1 
        AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);

      const [sobrietySummary] = await db.query(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m-%d') as date,
          SUM(CASE WHEN alcohol_detected = 0 THEN 1 ELSE 0 END) as passed,
          SUM(CASE WHEN alcohol_detected = 1 THEN 1 ELSE 0 END) as failed
        FROM ride_history 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
        ORDER BY date ASC
      `);

      const [recentAlerts] = await db.query(`
        SELECT r.*, u.full_name, u.email 
        FROM ride_history r
        JOIN users u ON r.user_id = u.id
        ORDER BY r.created_at DESC 
        LIMIT 10
      `);

      res.json({
        success: true,
        stats: {
          totalUsers: totalUsers[0].count,
          totalRides: totalRides[0].count,
          failedTests: failedTests[0].count
        },
        trends,
        sobrietySummary,
        recentAlerts
      });
    } catch (err) {
      console.error('DB Query failed for dashboard stats:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 2. User Management - Get All Users
  router.get('/users', adminMiddleware, async (req, res) => {
    try {
      const [users] = await db.query(`
        SELECT id, full_name, email, phone, role, face_enrolled, created_at 
        FROM users 
        ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END ASC, created_at DESC
      `);
      res.json({ success: true, users });
    } catch (err) {
      console.error('DB Query failed for users:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 3. User Management - Delete User
  router.delete('/users/:id', adminMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      // Delete dependent records first to satisfy foreign key constraints
      await db.query('DELETE FROM ride_history WHERE user_id = ?', [id]).catch(() => {});
      await db.query('DELETE FROM contacts WHERE user_id = ?', [id]).catch(() => {});
      await db.query('DELETE FROM emergency_contacts WHERE user_id = ?', [id]).catch(() => {});
      await db.query('DELETE FROM motorcycles WHERE user_id = ?', [id]).catch(() => {});
      await db.query('DELETE FROM devices WHERE user_id = ?', [id]).catch(() => {});
      await db.query('DELETE FROM users WHERE id = ? AND role != "admin"', [id]);
      res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
      console.error('DB Query failed during delete:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 3b. User Management - Create User directly from Admin Dashboard
  router.post('/users', adminMiddleware, async (req, res) => {
    try {
      const { fullName, email, phone, password, pin, role } = req.body;
      if (!fullName || !email || !phone || !password || !role) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
      }

      // Check if email already exists
      const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length) {
        return res.status(400).json({ success: false, message: 'Email already exists.' });
      }

      // Check if phone already exists
      const [existingPhone] = await db.query('SELECT id FROM users WHERE phone = ?', [phone]);
      if (existingPhone.length) {
        return res.status(400).json({ success: false, message: 'Phone number already exists.' });
      }

      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);
      const pinHash = pin ? await bcrypt.hash(pin, 10) : null;

      const [result] = await db.query(
        `INSERT INTO users (full_name, email, phone, password_hash, pin_hash, role, email_verified, face_enrolled) 
         VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
        [fullName, email, phone, passwordHash, pinHash, role]
      );

      res.json({ success: true, userId: result.insertId, message: 'User registered successfully.' });
    } catch (err) {
      console.error('DB Error creating user:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 4. Predictive Analytics - Peak Hours
  router.get('/analytics/peak-hours', adminMiddleware, async (req, res) => {
    try {
      const [hours] = await db.query(`
        SELECT HOUR(created_at) as hour, COUNT(*) as count 
        FROM ride_history 
        WHERE alcohol_detected = 1 
        GROUP BY HOUR(created_at)
        ORDER BY hour ASC
      `);
      res.json({ success: true, hours });
    } catch (err) {
      console.error('DB Query failed for peak hours:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5. Predictive Analytics - Peak Days
  router.get('/analytics/peak-days', adminMiddleware, async (req, res) => {
    try {
      const [days] = await db.query(`
        SELECT DAYNAME(created_at) as day_name, DAYOFWEEK(created_at) as day_num, COUNT(*) as count 
        FROM ride_history 
        WHERE alcohol_detected = 1 
        GROUP BY DAYNAME(created_at), DAYOFWEEK(created_at)
        ORDER BY day_num ASC
      `);
      res.json({ success: true, days });
    } catch (err) {
      console.error('DB Query failed for peak days:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 6. Manual Override Logs
  router.get('/override-logs', adminMiddleware, async (req, res) => {
    try {
      const [logs] = await db.query(`
        SELECT r.*, u.full_name, u.email 
        FROM ride_history r
        JOIN users u ON r.user_id = u.id
        WHERE r.unlock_status LIKE '%override%' OR r.unlock_status LIKE '%OVERRIDE%'
        ORDER BY r.created_at DESC
      `);
      res.json({ success: true, logs });
    } catch (err) {
      console.error('DB Query failed for override logs:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 7. Database Backup (JSON Export)
  router.get('/backup', adminMiddleware, async (req, res) => {
    try {
      const [users] = await db.query('SELECT id, full_name, email, phone, role, face_enrolled, created_at FROM users');
      const [rideHistory] = await db.query('SELECT * FROM ride_history');

      const backupData = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        mode: 'MotoLock Production Backup',
        tables: { users, rideHistory }
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=motolock_backup_${Date.now()}.json`);
      res.send(JSON.stringify(backupData, null, 2));
    } catch (err) {
      console.error('Backup failed:', err.message);
      res.status(500).json({ success: false, message: 'Backup failed: ' + err.message });
    }
  });

  // 8. Export Compliance Report (PDF)
  router.get('/reports/pdf', adminMiddleware, async (req, res) => {
    try {
      const { reportType, status, alcohol, startDate, endDate } = req.query;
      const doc = new PDFDocument({ margin: 50 });
      let filename = 'MotoLock_Report.pdf';
      res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
      res.setHeader('Content-type', 'application/pdf');
      doc.pipe(res);

      const maskPhone = (p) => {
        if (!p) return '—';
        if (p.length < 7) return p;
        return p.slice(0, 3) + '*'.repeat(p.length - 5) + p.slice(-2);
      };

      if (reportType === 'users') {
        doc.fontSize(20).text('MotoLock User Accounts Report', { align: 'center' });
        doc.moveDown();

        const [users] = await db.query('SELECT id, full_name, email, phone, role, face_enrolled, created_at FROM users ORDER BY created_at DESC');
        
        let yPos = 140;
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Name', 50, yPos);
        doc.text('Email', 160, yPos);
        doc.text('Phone', 280, yPos);
        doc.text('Role', 370, yPos);
        doc.text('Face ID', 430, yPos);
        doc.text('Joined', 490, yPos);

        yPos += 15;
        doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
        yPos += 10;

        doc.font('Helvetica');
        users.forEach(u => {
          if (yPos > 700) { doc.addPage(); yPos = 50; }
          doc.text(u.full_name || 'N/A', 50, yPos, { width: 100, ellipsis: true });
          doc.text(u.email || 'N/A', 160, yPos, { width: 110, ellipsis: true });
          doc.text(maskPhone(u.phone), 280, yPos, { width: 80, ellipsis: true });
          doc.text(u.role || 'N/A', 370, yPos);
          doc.text(u.face_enrolled ? 'Enrolled' : 'Missing', 430, yPos);
          doc.text(new Date(u.created_at).toLocaleDateString(), 490, yPos);
          yPos += 20;
        });
      } else if (reportType === 'overrides') {
        doc.fontSize(20).text('MotoLock Override Audit Report', { align: 'center' });
        doc.moveDown();

        const [logs] = await db.query(`
          SELECT r.*, u.full_name, u.email 
          FROM ride_history r
          JOIN users u ON r.user_id = u.id
          WHERE r.unlock_status LIKE '%override%' OR r.unlock_status LIKE '%OVERRIDE%'
          ORDER BY r.created_at DESC
        `);

        let yPos = 140;
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Date', 50, yPos);
        doc.text('Rider Name', 160, yPos);
        doc.text('Email', 280, yPos);
        doc.text('BrAC Level', 400, yPos);
        doc.text('Audit Status', 470, yPos);

        yPos += 15;
        doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
        yPos += 10;

        doc.font('Helvetica');
        logs.forEach(l => {
          if (yPos > 700) { doc.addPage(); yPos = 50; }
          doc.text(new Date(l.created_at).toLocaleDateString(), 50, yPos);
          doc.text(l.full_name || 'Rider', 160, yPos, { width: 110, ellipsis: true });
          doc.text(l.email || 'N/A', 280, yPos, { width: 110, ellipsis: true });
          doc.text(`${l.brac || 0}% BAC`, 400, yPos);
          doc.text('Manual Override', 470, yPos);
          yPos += 20;
        });
      } else {
        // default: rides
        doc.fontSize(20).text('MotoLock Compliance Report', { align: 'center' });
        doc.moveDown();

        let query = `
          SELECT r.*, u.full_name, u.email 
          FROM ride_history r
          JOIN users u ON r.user_id = u.id
          WHERE 1=1
        `;
        const params = [];
        if (status) { query += ' AND r.status = ?'; params.push(status); }
        if (alcohol !== undefined && alcohol !== '') { query += ' AND r.alcohol_detected = ?'; params.push(parseInt(alcohol) || 0); }
        if (startDate) { query += ' AND r.created_at >= ?'; params.push(startDate + ' 00:00:00'); }
        if (endDate) { query += ' AND r.created_at <= ?'; params.push(endDate + ' 23:59:59'); }
        query += ' ORDER BY r.created_at DESC LIMIT 200';

        const [rides] = await db.query(query, params);

        let yPos = 140;
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Date', 50, yPos);
        doc.text('Rider Name', 140, yPos);
        doc.text('Email', 250, yPos);
        doc.text('Status', 360, yPos);
        doc.text('Alcohol', 440, yPos);
        doc.text('BrAC', 500, yPos);

        yPos += 15;
        doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
        yPos += 10;

        doc.font('Helvetica');
        rides.forEach(ride => {
          if (yPos > 700) { doc.addPage(); yPos = 50; }
          doc.text(new Date(ride.created_at || Date.now()).toLocaleDateString(), 50, yPos);
          doc.text(ride.full_name || 'Rider', 140, yPos, { width: 100, ellipsis: true });
          doc.text(ride.email || 'N/A', 250, yPos, { width: 100, ellipsis: true });
          doc.text(ride.status || 'Alert', 360, yPos);
          doc.text(ride.alcohol_detected ? 'Detected' : 'Sober', 440, yPos);
          doc.text(String(ride.brac || 0), 500, yPos);
          yPos += 20;
        });
      }

      doc.end();
    } catch (err) {
      console.error('PDF Report Generation failed:', err.message);
      if (!res.headersSent) res.status(500).json({ success: false, message: 'Server Error: ' + err.message });
    }
  });

  // 9. Export Compliance Report (Excel)
  router.get('/reports/excel', adminMiddleware, async (req, res) => {
    try {
      const { reportType, status, alcohol, role, startDate, endDate } = req.query;
      const workbook = new ExcelJS.Workbook();

      const maskPhone = (p) => {
        if (!p) return '—';
        if (p.length < 7) return p;
        return p.slice(0, 3) + '*'.repeat(p.length - 5) + p.slice(-2);
      };

      if (reportType === 'users') {
        const worksheet = workbook.addWorksheet('Users');
        worksheet.columns = [
          { header: 'Name', key: 'name', width: 30 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Phone', key: 'phone', width: 20 },
          { header: 'Role', key: 'role', width: 15 },
          { header: 'Face Enrolled', key: 'face_enrolled', width: 15 },
          { header: 'Created At', key: 'created_at', width: 25 }
        ];

        let query = 'SELECT full_name, email, phone, role, face_enrolled, created_at FROM users WHERE 1=1';
        const params = [];
        if (role && role !== 'all') {
          query += ' AND role = ?';
          params.push(role);
        }
        query += ' ORDER BY created_at DESC';

        const [users] = await db.query(query, params);
        users.forEach(u => {
          worksheet.addRow({
            name: u.full_name,
            email: u.email,
            phone: maskPhone(u.phone),
            role: u.role,
            face_enrolled: u.face_enrolled ? 'Yes' : 'No',
            created_at: new Date(u.created_at).toLocaleString()
          });
        });
      } else if (reportType === 'overrides') {
        const worksheet = workbook.addWorksheet('Overrides');
        worksheet.columns = [
          { header: 'Date', key: 'date', width: 25 },
          { header: 'Rider Name', key: 'name', width: 30 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'BrAC', key: 'brac', width: 10 },
          { header: 'Status', key: 'status', width: 25 }
        ];

        const [logs] = await db.query(`
          SELECT r.*, u.full_name, u.email 
          FROM ride_history r
          JOIN users u ON r.user_id = u.id
          WHERE r.unlock_status LIKE '%override%' OR r.unlock_status LIKE '%OVERRIDE%'
          ORDER BY r.created_at DESC
        `);
        logs.forEach(l => {
          worksheet.addRow({
            date: new Date(l.created_at).toLocaleString(),
            name: l.full_name,
            email: l.email,
            brac: l.brac || 0,
            status: 'Manual Override'
          });
        });
      } else {
        // default: rides
        const worksheet = workbook.addWorksheet('Ride History');
        worksheet.columns = [
          { header: 'Date', key: 'date', width: 20 },
          { header: 'Rider Name', key: 'name', width: 30 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Status', key: 'status', width: 15 },
          { header: 'Face Verified', key: 'face_verified', width: 15 },
          { header: 'Helmet Verified', key: 'helmet_verified', width: 15 },
          { header: 'Alcohol Detected', key: 'alcohol_detected', width: 15 },
          { header: 'BrAC', key: 'brac', width: 10 }
        ];

        let query = `
          SELECT r.*, u.full_name, u.email 
          FROM ride_history r
          JOIN users u ON r.user_id = u.id
          WHERE 1=1
        `;
        const params = [];
        if (status) { query += ' AND r.status = ?'; params.push(status); }
        if (alcohol !== undefined && alcohol !== '') { query += ' AND r.alcohol_detected = ?'; params.push(parseInt(alcohol) || 0); }
        if (startDate) { query += ' AND r.created_at >= ?'; params.push(startDate + ' 00:00:00'); }
        if (endDate) { query += ' AND r.created_at <= ?'; params.push(endDate + ' 23:59:59'); }
        query += ' ORDER BY r.created_at DESC';

        const [rides] = await db.query(query, params);
        rides.forEach(ride => {
          worksheet.addRow({
            id: ride.id,
            date: new Date(ride.created_at || Date.now()).toLocaleString(),
            name: ride.full_name || 'Rider',
            email: ride.email || 'N/A',
            status: ride.status || 'Alert',
            face_verified: ride.face_verified ? 'Yes' : 'No',
            helmet_verified: ride.helmet_verified ? 'Yes' : 'No',
            alcohol_detected: ride.alcohol_detected ? 'Yes' : 'No',
            brac: ride.brac || 0
          });
        });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=MotoLock_Report.xlsx');

      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error('Excel Report Generation failed:', err.message);
      if (!res.headersSent) res.status(500).json({ success: false, message: 'Server Error: ' + err.message });
    }
  });

  // 10. Get Audit Logs
  router.get('/audit-logs', adminMiddleware, async (req, res) => {
    try {
      const [logs] = await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500');
      res.json({ success: true, logs });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 11. Create Audit Log Entry
  router.post('/audit-logs', adminMiddleware, async (req, res) => {
    try {
      const { action, module, targetRecord } = req.body;
      const adminName = req.user.fullName || req.user.full_name || 'admin';
      await db.query('INSERT INTO audit_logs (admin_name, action, module, target_record) VALUES (?, ?, ?, ?)', [
        adminName,
        action,
        module,
        targetRecord || 'N/A'
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 12. Get System Settings
  router.get('/settings', adminMiddleware, async (req, res) => {
    try {
      const [settings] = await db.query('SELECT * FROM system_settings');
      res.json({ success: true, settings });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 13. Update System Settings
  router.post('/settings', adminMiddleware, async (req, res) => {
    try {
      const { setting_key, setting_value } = req.body;
      await db.query('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [
        setting_key,
        setting_value,
        setting_value
      ]);
      // Log the action
      const adminName = req.user.fullName || req.user.full_name || 'admin';
      await db.query('INSERT INTO audit_logs (admin_name, action, module, target_record) VALUES (?, ?, ?, ?)', [
        adminName,
        `Updated setting ${setting_key} to ${setting_value}`,
        'Settings',
        setting_key
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 14. Get Devices (Safe query)
  router.get('/devices', adminMiddleware, async (req, res) => {
    try {
      let devices = [];
      try {
        [devices] = await db.query('SELECT * FROM devices');
      } catch (e) {
        // Fallback if table doesn't exist
      }
      res.json({ success: true, devices });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 15. Get Critical Notifications
  router.get('/notifications', adminMiddleware, async (req, res) => {
    try {
      const [notifications] = await db.query(`
        SELECT r.*, u.full_name, u.email 
        FROM ride_history r
        JOIN users u ON r.user_id = u.id
        WHERE r.alcohol_detected = 1 OR r.face_verified = 0 OR r.helmet_verified = 0
        ORDER BY r.created_at DESC 
        LIMIT 10
      `);
      res.json({ success: true, notifications });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 16. Get All System Settings
  router.get('/settings', adminMiddleware, async (req, res) => {
    try {
      const [rows] = await db.query('SELECT setting_key, setting_value FROM system_settings');
      const settings = {};
      rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
      res.json({ success: true, settings });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 17. Save / Upsert a System Setting
  router.post('/settings', adminMiddleware, async (req, res) => {
    try {
      const { setting_key, setting_value } = req.body;
      if (!setting_key) return res.status(400).json({ success: false, message: 'setting_key required' });
      await db.query(
        'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [setting_key, setting_value, setting_value]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
};
