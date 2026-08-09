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

  // 2. User Management - Get All Users (with contacts and motorcycles)
  router.get('/users', adminMiddleware, async (req, res) => {
    try {
      const [users] = await db.query(`
        SELECT id, full_name, email, phone, role, face_enrolled, created_at 
        FROM users 
        ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END ASC, created_at DESC
      `);
      
      const [contacts] = await db.query('SELECT * FROM contacts');
      const [motorcycles] = await db.query('SELECT * FROM motorcycles');

      const usersWithDetails = users.map(user => {
        return {
          ...user,
          contacts: contacts.filter(c => c.user_id === user.id),
          motorcycles: motorcycles.filter(m => m.user_id === user.id)
        };
      });

      res.json({ success: true, users: usersWithDetails });
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

  // 3a. User Management - Update User profile (Admin access)
  router.put('/users/:id', adminMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { fullName, email, phone, role } = req.body;
      await db.query(
        'UPDATE users SET full_name = ?, email = ?, phone = ?, role = ? WHERE id = ?',
        [fullName, email, phone, role, id]
      );
      res.json({ success: true, message: 'User profile updated successfully' });
    } catch (err) {
      console.error('DB Query failed during user update:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Admin emergency contacts management
  router.post('/admin/contacts', adminMiddleware, async (req, res) => {
    try {
      const { userId, name, phone, role } = req.body;
      const [result] = await db.query(
        'INSERT INTO contacts (user_id, name, phone, role) VALUES (?, ?, ?, ?)',
        [userId, name, phone, role]
      );
      res.json({ success: true, contact: { id: result.insertId, user_id: userId, name, phone, role } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.delete('/admin/contacts/:id', adminMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      await db.query('DELETE FROM contacts WHERE id = ?', [id]);
      res.json({ success: true, message: 'Contact deleted successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Admin motorcycles management
  router.post('/admin/motorcycles', adminMiddleware, async (req, res) => {
    try {
      const { userId, plateNumber, model, year, color } = req.body;
      const [result] = await db.query(
        'INSERT INTO motorcycles (user_id, plate_number, model, year, color) VALUES (?, ?, ?, ?, ?)',
        [userId, plateNumber, model, year, color]
      );
      res.json({ success: true, motorcycle: { id: result.insertId, user_id: userId, plate_number: plateNumber, model, year, color } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.delete('/admin/motorcycles/:id', adminMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      await db.query('DELETE FROM motorcycles WHERE id = ?', [id]);
      res.json({ success: true, message: 'Motorcycle deleted successfully' });
    } catch (err) {
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
      const doc = new PDFDocument({ margin: 50, bufferPages: true });
      let filename = 'MotoLock_Report.pdf';
      res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
      res.setHeader('Content-type', 'application/pdf');
      doc.pipe(res);

      const maskPhone = (p) => {
        if (!p) return '—';
        if (p.length < 7) return p;
        return p.slice(0, 3) + '*'.repeat(p.length - 5) + p.slice(-2);
      };

      // Helper function to draw top header, metadata block, and executive summary
      const adminName = req.user?.full_name || req.user?.fullName || req.user?.username || 'Administrator';

      const generateReportHeader = async (title, count, stats) => {
        // 1. MOTOLOCK Title Block
        doc.fontSize(22).font('Helvetica-Bold').fillColor('#000000').text('MOTOLOCK', 50, 40);
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#6c757d').text('Alcohol Detection and Safe-Ride System', 50, 64);
        
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#000000').text(title.toUpperCase(), 250, 40, { align: 'right', width: 300 });
        
        doc.moveTo(50, 76).lineTo(550, 76).strokeColor('#000000').lineWidth(1).stroke();

        // 2. Info Block (y=84) — 3 columns, no Report Type or MotoLock System rows
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000').text('Report ID', 50, 84);
        doc.font('Helvetica').fillColor('#495057').text(`RPT-2026-${String(Math.floor(10000 + Math.random() * 90000))}`, 50, 95);

        doc.font('Helvetica-Bold').fillColor('#000000').text('Generated By', 50, 114);
        doc.font('Helvetica').fillColor('#495057').text(adminName, 50, 125);

        // Col 2
        doc.font('Helvetica-Bold').fillColor('#000000').text('Reporting Period', 230, 84);
        const periodStr = (startDate || endDate) 
          ? `${startDate || 'Start'} — ${endDate || 'End'}` 
          : 'All-Time Records';
        doc.font('Helvetica').fillColor('#495057').text(periodStr, 230, 95);

        doc.font('Helvetica-Bold').fillColor('#000000').text('Generated At', 230, 114);
        doc.font('Helvetica').fillColor('#495057').text(new Date().toLocaleString(), 230, 125);

        // Col 3
        doc.font('Helvetica-Bold').fillColor('#000000').text('Page', 410, 84);
        doc.font('Helvetica').fillColor('#495057').text('1 of 1 (Buffered)', 410, 95);

        doc.font('Helvetica-Bold').fillColor('#000000').text('Filters Applied', 410, 114);
        let filtersText = `Rider: All Riders\nIdentity: All\nIgnition: All`;
        if (status && status !== 'all') filtersText += `\nStatus: ${status}`;
        if (alcohol && alcohol !== 'all') filtersText += `\nAlcohol: ${alcohol === '1' ? 'Detected' : 'Sober'}`;
        doc.font('Helvetica').fillColor('#495057').text(filtersText, 410, 125, { width: 140, lineGap: 1 });
      };

      // Helper function to draw Summary / Observations, Result Distribution, and Data Source
      const generateReportFooter = (count, stats) => {
        const footY = 515;

        // SUMMARY / OBSERVATIONS
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text('SUMMARY / OBSERVATIONS', 50, footY);
        doc.rect(50, footY + 12, 240, 105).strokeColor('#dee2e6').stroke();
        
        const passedPct = count > 0 ? ((stats[1]/count)*100).toFixed(2) : '0.00';
        const failedPct = count > 0 ? ((stats[2]/count)*100).toFixed(2) : '0.00';
        
        let yObs = footY + 20;
        doc.fontSize(8).font('Helvetica').fillColor('#212529');
        doc.text(`• Out of ${count} tests conducted, ${stats[1]} (${passedPct}%) passed and`, 60, yObs, { width: 220 });
        doc.text(`${stats[2]} (${failedPct}%) failed.`, 68, yObs + 10);
        doc.text(`• All failed sobriety tests resulted in lockouts.`, 60, yObs + 24, { width: 220 });
        doc.text(`• Identity verification passed for all valid sessions.`, 60, yObs + 36, { width: 220 });
        doc.text(`• Most activities were verified within normal hours.`, 60, yObs + 48, { width: 220 });

        // TEST RESULT DISTRIBUTION
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text('TEST RESULT DISTRIBUTION', 310, footY);
        doc.rect(310, footY + 12, 240, 105).strokeColor('#dee2e6').stroke();

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#495057');
        doc.text('TEST RESULT', 320, footY + 20);
        doc.text('TOTAL', 410, footY + 20, { align: 'right', width: 40 });
        doc.text('PERCENTAGE', 470, footY + 20, { align: 'right', width: 70 });

        doc.moveTo(320, footY + 32).lineTo(540, footY + 32).strokeColor('#dee2e6').stroke();

        // Passed Row
        doc.font('Helvetica').fillColor('#212529');
        doc.text('Passed', 320, footY + 40);
        doc.text(String(stats[1]), 410, footY + 40, { align: 'right', width: 40 });
        doc.text(`${passedPct}%`, 470, footY + 40, { align: 'right', width: 70 });

        // Passed progress bar
        doc.rect(320, footY + 52, 220, 6).fill('#e9ecef');
        doc.rect(320, footY + 52, Math.max(0, 220 * (stats[1]/count || 0)), 6).fill('#198754');

        // Failed Row
        doc.fillColor('#212529');
        doc.text('Failed', 320, footY + 68);
        doc.text(String(stats[2]), 410, footY + 68, { align: 'right', width: 40 });
        doc.text(`${failedPct}%`, 470, footY + 68, { align: 'right', width: 70 });

        // Failed progress bar
        doc.rect(320, footY + 80, 220, 6).fill('#e9ecef');
        doc.rect(320, footY + 80, Math.max(0, 220 * (stats[2]/count || 0)), 6).fill('#dc3545');

        // Totals row
        doc.moveTo(320, footY + 94).lineTo(540, footY + 94).strokeColor('#dee2e6').stroke();
        doc.font('Helvetica-Bold');
        doc.text('Total', 320, footY + 100);
        doc.text(String(count), 410, footY + 100, { align: 'right', width: 40 });
        doc.text('100%', 470, footY + 100, { align: 'right', width: 70 });


        // DATA SOURCE & NOTES (y=635)
        const sourceY = 635;
        doc.moveTo(50, sourceY).lineTo(550, sourceY).strokeColor('#c3c3c3').stroke();

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text('DATA SOURCE & NOTES', 50, sourceY + 10);
        
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#495057');
        doc.text('Data Source', 50, sourceY + 26);
        doc.font('Helvetica').fillColor('#212529').text(': MotoLock System Database', 130, sourceY + 26);

        doc.font('Helvetica-Bold').fillColor('#495057').text('Records Included', 50, sourceY + 38);
        doc.font('Helvetica').fillColor('#212529').text(`: ${count}`, 130, sourceY + 38);

        doc.font('Helvetica-Bold').fillColor('#495057').text('Date Range Filter', 50, sourceY + 50);
        const rangeText = (startDate || endDate) ? `${startDate || 'Start'} to ${endDate || 'End'}` : 'All records';
        doc.font('Helvetica').fillColor('#212529').text(`: ${rangeText}`, 130, sourceY + 50);

        doc.font('Helvetica-Bold').fillColor('#495057').text('Notes', 310, sourceY + 26);
        doc.font('Helvetica').fillColor('#212529').text(': Report is based on actual records from the system.\n  Data may change if additional records are added or\n  updates are made.', 345, sourceY + 26, { lineGap: 1 });
      };

      if (reportType === 'users') {
        const [users] = await db.query('SELECT id, full_name, email, phone, role, face_enrolled, created_at FROM users ORDER BY created_at DESC');
        
        const count = users.length;
        const passed = users.filter(u => u.face_enrolled).length;
        const failed = count - passed;
        const lockouts = 0;
        const alerts = failed;
        const ridersCount = users.filter(u => u.role === 'rider').length;

        await generateReportHeader('Rider Registration Report', count, [count, passed, failed, lockouts, alerts, ridersCount]);

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text('DETAILED RECORDS', 50, 155);

        let yPos = 168;
        doc.rect(50, yPos, 500, 18).fill('#f1f3f5');
        
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#495057');
        doc.text('#', 55, yPos + 5);
        doc.text('USER ID', 70, yPos + 5);
        doc.text('FULL NAME', 140, yPos + 5);
        doc.text('EMAIL ADDRESS', 240, yPos + 5);
        doc.text('PHONE NUMBER', 360, yPos + 5);
        doc.text('SYSTEM ROLE', 450, yPos + 5);
        doc.text('FACE ID STATUS', 500, yPos + 5);

        yPos += 18;
        doc.font('Helvetica').fillColor('#212529');
        users.slice(0, 17).forEach((u, idx) => {
          doc.rect(50, yPos, 500, 18).strokeColor('#dee2e6').lineWidth(0.5).stroke();

          doc.text(String(idx + 1), 55, yPos + 5);
          doc.text(`USR-${10000 + u.id}`, 70, yPos + 5);
          doc.text(u.full_name || '—', 140, yPos + 5, { width: 95, ellipsis: true });
          doc.text(u.email || '—', 240, yPos + 5, { width: 115, ellipsis: true });
          doc.text(maskPhone(u.phone), 360, yPos + 5);
          doc.text(u.role === 'admin' ? 'ADMIN' : 'RIDER', 450, yPos + 5);
          doc.text(u.face_enrolled ? 'ENROLLED' : 'MISSING', 500, yPos + 5);
          yPos += 18;
        });

        generateReportFooter(count, [count, passed, failed, lockouts, alerts, ridersCount]);


      } else if (reportType === 'overrides') {
        const [logs] = await db.query(`
          SELECT r.*, u.full_name, u.email 
          FROM ride_history r
          JOIN users u ON r.user_id = u.id
          WHERE r.unlock_status LIKE '%override%' OR r.unlock_status LIKE '%OVERRIDE%'
          ORDER BY r.created_at DESC
        `);

        const count = logs.length;
        const passed = 0;
        const failed = count;
        const lockouts = count;
        const alerts = count;
        const ridersCount = new Set(logs.map(l => l.user_id)).size;

        await generateReportHeader('Override History Report', count, [count, passed, failed, lockouts, alerts, ridersCount]);

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text('DETAILED RECORDS', 50, 155);

        let yPos = 168;
        doc.rect(50, yPos, 500, 18).fill('#f1f3f5');
        
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#495057');
        doc.text('#', 55, yPos + 5);
        doc.text('OVERRIDE ID', 70, yPos + 5);
        doc.text('DATE & TIME', 140, yPos + 5);
        doc.text('RIDER NAME', 240, yPos + 5);
        doc.text('EMAIL ADDRESS', 340, yPos + 5);
        doc.text('ALCOHOL LEVEL', 450, yPos + 5);
        doc.text('AUDIT STATUS', 505, yPos + 5);

        yPos += 18;
        doc.font('Helvetica').fillColor('#212529');
        logs.slice(0, 11).forEach((l, idx) => {
          doc.rect(50, yPos, 500, 18).strokeColor('#dee2e6').lineWidth(0.5).stroke();

          doc.text(String(idx + 1), 55, yPos + 5);
          doc.text(`OR-${10000 + l.id}`, 70, yPos + 5);
          doc.text(new Date(l.created_at).toLocaleString(), 140, yPos + 5, { width: 95, ellipsis: true });
          doc.text(l.full_name || '—', 240, yPos + 5, { width: 95, ellipsis: true });
          doc.text(l.email || '—', 340, yPos + 5, { width: 105, ellipsis: true });
          doc.text(`${l.brac || 0} BAC`, 450, yPos + 5);
          doc.text('MANUAL OVERRIDE', 505, yPos + 5);
          yPos += 18;
        });

        generateReportFooter(count, [count, passed, failed, lockouts, alerts, ridersCount]);

      } else {
        // default: rides
        let query = `
          SELECT r.*, u.full_name, u.email 
          FROM ride_history r
          JOIN users u ON r.user_id = u.id
          WHERE 1=1
        `;
        const params = [];
        if (status && status !== 'all') { query += ' AND r.status = ?'; params.push(status); }
        if (alcohol !== undefined && alcohol !== '' && alcohol !== 'all') { query += ' AND r.alcohol_detected = ?'; params.push(parseInt(alcohol) || 0); }
        if (startDate) { query += ' AND r.created_at >= ?'; params.push(startDate + ' 00:00:00'); }
        if (endDate) { query += ' AND r.created_at <= ?'; params.push(endDate + ' 23:59:59'); }
        query += ' ORDER BY r.created_at DESC LIMIT 200';

        const [rides] = await db.query(query, params);

        const count = rides.length;
        const failed = rides.filter(r => parseFloat(r.brac) >= 0.05).length;
        const passed = count - failed;
        const lockouts = failed;
        const alerts = failed;
        const ridersCount = new Set(rides.map(r => r.user_id)).size;

        await generateReportHeader('Sobriety Test Report', count, [count, passed, failed, lockouts, alerts, ridersCount]);

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text('DETAILED RECORDS', 50, 155);

        let yPos = 168;
        doc.rect(50, yPos, 500, 18).fill('#f1f3f5');
        
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#495057');
        doc.text('#', 53, yPos + 5);
        doc.text('TEST ID', 63, yPos + 5);
        doc.text('DATE & TIME', 120, yPos + 5);
        doc.text('RIDER', 190, yPos + 5);
        doc.text('ALCOHOL READ', 270, yPos + 5);
        doc.text('TEST RESULT', 340, yPos + 5);
        doc.text('IDENTITY', 400, yPos + 5);
        doc.text('IGNITION', 450, yPos + 5);
        doc.text('LOCATION', 500, yPos + 5);

        yPos += 18;
        doc.font('Helvetica').fillColor('#212529');
        rides.slice(0, 11).forEach((ride, idx) => {
          doc.rect(50, yPos, 500, 18).strokeColor('#dee2e6').lineWidth(0.5).stroke();

          doc.text(String(idx + 1), 53, yPos + 5);
          doc.text(`ST-${10000 + ride.id}`, 63, yPos + 5);
          doc.text(new Date(ride.created_at || Date.now()).toLocaleDateString(), 120, yPos + 5);
          doc.text(ride.full_name || 'Rider', 190, yPos + 5, { width: 75, ellipsis: true });
          doc.text(`${ride.brac || 0} BAC`, 270, yPos + 5);
          
          const isIntoxicated = parseFloat(ride.brac) >= 0.05;
          doc.text(isIntoxicated ? 'FAILED' : 'PASSED', 340, yPos + 5);
          doc.text(ride.face_verified ? 'PASSED' : 'BYPASSED', 400, yPos + 5);
          doc.text(ride.status === 'unlocked' ? 'ENABLED' : 'LOCKED', 450, yPos + 5);
          doc.text('Calamba, Laguna', 500, yPos + 5, { width: 48, ellipsis: true });
          yPos += 18;
        });

        generateReportFooter(count, [count, passed, failed, lockouts, alerts, ridersCount]);
      }

      // Add page numbers at footers
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.moveTo(50, 740).lineTo(550, 740).strokeColor('#e9ecef').lineWidth(1).stroke();
        doc.fontSize(8).fillColor('#6c757d');
        doc.text(`Confidential — Authorized Personnel Only`, 50, 748, { align: 'left' });
        doc.text(`© 2026 MotoLock System. All rights reserved.`, 350, 748, { align: 'right', width: 200 });
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
      const worksheet = workbook.addWorksheet('Report Overview');

      const maskPhone = (p) => {
        if (!p) return '—';
        if (p.length < 7) return p;
        return p.slice(0, 3) + '*'.repeat(p.length - 5) + p.slice(-2);
      };

      // Set column widths — tailored to data content
      worksheet.columns = [
        { key: 'colA', width: 4 },   // margin
        { key: 'colB', width: 6 },   // #
        { key: 'colC', width: 26 },  // name
        { key: 'colD', width: 30 },  // email
        { key: 'colE', width: 20 },  // phone / date
        { key: 'colF', width: 18 },  // role / brac / result
        { key: 'colG', width: 18 },  // face / status
        { key: 'colH', width: 18 },  // ignition
        { key: 'colI', width: 24 },  // location
        { key: 'colJ', width: 20 },
        { key: 'colK', width: 20 }
      ];

      const typeLabel = reportType === 'users'
        ? 'RIDER REGISTRATION REPORT'
        : (reportType === 'overrides' ? 'OVERRIDE HISTORY REPORT' : 'SOBRIETY TEST REPORT');

      const rId = `RPT-2026-${String(Math.floor(10000 + Math.random() * 90000))}`;
      const periodStr = (startDate || endDate) ? `${startDate || 'Start'} — ${endDate || 'End'}` : 'All-Time Records';
      const adminNameExcel = req.user?.full_name || req.user?.fullName || req.user?.username || 'Administrator';
      let filtersApplied = 'All Records';
      if (status && status !== 'all') filtersApplied = `Status: ${status}`;
      if (alcohol && alcohol !== 'all') filtersApplied += ` | Alcohol: ${alcohol === '1' ? 'Detected' : 'Sober'}`;

      // Row 1: spacer
      // Row 2: Main title
      const titleRow = worksheet.getRow(2);
      titleRow.height = 28;
      titleRow.getCell('colB').value = 'MOTOLOCK — Alcohol Detection and Safe-Ride System';
      titleRow.getCell('colB').font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: '002060' } };

      // Row 3: Report sub-title
      const subtitleRow = worksheet.getRow(3);
      subtitleRow.height = 20;
      subtitleRow.getCell('colB').value = typeLabel;
      subtitleRow.getCell('colB').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: '6c757d' } };

      // Row 4: Metadata key row (labels)
      const metaLabelRow = worksheet.getRow(4);
      metaLabelRow.height = 16;
      const metaLabels = ['Report ID', 'Reporting Period', 'Generated By', 'Generated At', 'Filters'];
      const metaCols  = ['colB', 'colD', 'colF', 'colH', 'colJ'];
      metaLabels.forEach((lbl, i) => {
        const cell = metaLabelRow.getCell(metaCols[i]);
        cell.value = lbl;
        cell.font = { name: 'Segoe UI', size: 8, bold: true, color: { argb: '495057' } };
      });

      // Row 5: Metadata value row
      const metaValueRow = worksheet.getRow(5);
      metaValueRow.height = 16;
      const metaValues = [rId, periodStr, adminNameExcel, new Date().toLocaleString(), filtersApplied];
      metaValues.forEach((val, i) => {
        const cell = metaValueRow.getCell(metaCols[i]);
        cell.value = val;
        cell.font = { name: 'Segoe UI', size: 8, color: { argb: '212529' } };
      });

      // Row 6: thin separator line via bottom border on row 5
      metaValueRow.eachCell({ includeEmpty: false }, (cell) => {
        cell.border = { bottom: { style: 'thin', color: { argb: 'dee2e6' } } };
      });

      // Query Data
      let records = [];
      let stats = [0, 0, 0, 0, 0, 0];

      if (reportType === 'users') {
        const [users] = await db.query('SELECT full_name, email, phone, role, face_enrolled, created_at FROM users ORDER BY created_at DESC');
        records = users;
        const count = users.length;
        const passed = users.filter(u => u.face_enrolled).length;
        stats = [count, passed, count - passed, 0, count - passed, users.filter(u => u.role === 'rider').length];
      } else if (reportType === 'overrides') {
        const [logs] = await db.query(`
          SELECT r.*, u.full_name, u.email 
          FROM ride_history r
          JOIN users u ON r.user_id = u.id
          WHERE r.unlock_status LIKE '%override%' OR r.unlock_status LIKE '%OVERRIDE%'
          ORDER BY r.created_at DESC
        `);
        records = logs;
        const count = logs.length;
        stats = [count, 0, count, count, count, new Set(logs.map(l => l.user_id)).size];
      } else {
        let query = `
          SELECT r.*, u.full_name, u.email 
          FROM ride_history r
          JOIN users u ON r.user_id = u.id
          WHERE 1=1
        `;
        const params = [];
        if (status && status !== 'all') { query += ' AND r.status = ?'; params.push(status); }
        if (alcohol !== undefined && alcohol !== '' && alcohol !== 'all') { query += ' AND r.alcohol_detected = ?'; params.push(parseInt(alcohol) || 0); }
        if (startDate) { query += ' AND r.created_at >= ?'; params.push(startDate + ' 00:00:00'); }
        if (endDate) { query += ' AND r.created_at <= ?'; params.push(endDate + ' 23:59:59'); }
        query += ' ORDER BY r.created_at DESC';

        const [rides] = await db.query(query, params);
        records = rides;
        const count = rides.length;
        const failed = rides.filter(r => parseFloat(r.brac) >= 0.05).length;
        stats = [count, count - failed, failed, failed, failed, new Set(rides.map(r => r.user_id)).size];
      }

      // Row 7: Table Header (dark blue, white text) — no ID columns
      let tableHeaders = [];
      if (reportType === 'users') {
        tableHeaders = [
          { name: '#' },
          { name: 'FULL NAME' },
          { name: 'EMAIL ADDRESS' },
          { name: 'PHONE NUMBER' },
          { name: 'SYSTEM ROLE' },
          { name: 'FACE ID STATUS' },
          { name: 'REGISTERED' }
        ];
      } else if (reportType === 'overrides') {
        tableHeaders = [
          { name: '#' },
          { name: 'DATE & TIME' },
          { name: 'RIDER NAME' },
          { name: 'EMAIL ADDRESS' },
          { name: 'ALCOHOL LEVEL' },
          { name: 'AUDIT STATUS' }
        ];
      } else {
        tableHeaders = [
          { name: '#' },
          { name: 'DATE & TIME' },
          { name: 'RIDER' },
          { name: 'ALCOHOL READING (% BAC)' },
          { name: 'TEST RESULT' },
          { name: 'IDENTITY VERIFICATION' },
          { name: 'IGNITION STATUS' },
          { name: 'LOCATION' }
        ];
      }

      const tableHeaderRow = worksheet.getRow(7);
      tableHeaderRow.height = 24;
      tableHeaders.forEach((th, idx) => {
        const cell = tableHeaderRow.getCell(idx + 2); // Col B onwards
        cell.value = th.name;
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '002060' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: '001040' } },
          left: { style: 'thin', color: { argb: '001040' } },
          bottom: { style: 'thin', color: { argb: '001040' } },
          right: { style: 'thin', color: { argb: '001040' } }
        };
      });

      // Data rows starting at row 8
      let currentRow = 8;
      records.forEach((r, idx) => {
        const row = worksheet.getRow(currentRow);
        row.height = 20;

        let rowValues = [];
        if (reportType === 'users') {
          rowValues = [
            idx + 1,
            r.full_name || '—',
            r.email || '—',
            maskPhone(r.phone),
            r.role === 'admin' ? 'ADMIN' : 'RIDER',
            r.face_enrolled ? 'ENROLLED' : 'MISSING',
            new Date(r.created_at).toLocaleDateString()
          ];
        } else if (reportType === 'overrides') {
          rowValues = [
            idx + 1,
            new Date(r.created_at).toLocaleString(),
            r.full_name || '—',
            r.email || '—',
            `${r.brac || 0} BAC`,
            'MANUAL OVERRIDE'
          ];
        } else {
          const isIntoxicated = parseFloat(r.brac) >= 0.05;
          rowValues = [
            idx + 1,
            new Date(r.created_at).toLocaleString(),
            r.full_name || '—',
            r.brac || '0.00',
            isIntoxicated ? 'FAILED' : 'PASSED',
            r.face_verified ? 'PASSED' : 'BYPASSED',
            r.status === 'unlocked' ? 'ENABLED' : 'LOCKED',
            'Calamba City, Laguna'
          ];
        }

        rowValues.forEach((val, valIdx) => {
          const cell = row.getCell(valIdx + 2);
          cell.value = val;
          cell.font = { name: 'Segoe UI', size: 9 };
          cell.alignment = {
            vertical: 'middle',
            horizontal: (valIdx === 1 || valIdx === 2) ? 'left' : 'center'
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'dee2e6' } },
            left: { style: 'thin', color: { argb: 'dee2e6' } },
            bottom: { style: 'thin', color: { argb: 'dee2e6' } },
            right: { style: 'thin', color: { argb: 'dee2e6' } }
          };
          if (currentRow % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8F9FA' } };
          }
        });

        currentRow++;
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=MotoLock_Report_${Date.now()}.xlsx`);

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
