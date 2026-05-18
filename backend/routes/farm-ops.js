const express     = require('express');
const { query }   = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ── FIELDS ────────────────────────────────────────────────────

router.get('/fields', async (req, res, next) => {
  try {
    const r = await query(
      'SELECT * FROM farm_fields WHERE user_id=$1 ORDER BY name ASC',
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) { next(err); }
});

router.post('/fields', async (req, res, next) => {
  try {
    const { name, acreage, soil_type, last_soil_test, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Field name is required' });
    const r = await query(
      `INSERT INTO farm_fields (user_id, name, acreage, soil_type, last_soil_test, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, name.trim(), acreage || null, soil_type?.trim() || null,
       last_soil_test || null, notes?.trim() || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { next(err); }
});

router.put('/fields/:id', async (req, res, next) => {
  try {
    const { name, acreage, soil_type, last_soil_test, notes } = req.body;
    const r = await query(
      `UPDATE farm_fields SET name=$1, acreage=$2, soil_type=$3, last_soil_test=$4,
       notes=$5, updated_at=NOW()
       WHERE id=$6 AND user_id=$7 RETURNING *`,
      [name?.trim(), acreage || null, soil_type?.trim() || null, last_soil_test || null,
       notes?.trim() || null, req.params.id, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Field not found' });
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/fields/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM farm_fields WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── PLANTINGS ─────────────────────────────────────────────────

router.get('/plantings', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT p.*, f.name AS field_name
       FROM farm_plantings p
       LEFT JOIN farm_fields f ON f.id = p.field_id
       WHERE p.user_id=$1 ORDER BY p.planned_date DESC NULLS LAST`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) { next(err); }
});

router.post('/plantings', async (req, res, next) => {
  try {
    const {
      field_id, season, crop_name, variety, seed_lot,
      planned_date, actual_date, seed_rate, days_to_maturity,
      target_yield_kg, status, notes, crop_family,
    } = req.body;
    if (!crop_name?.trim()) return res.status(400).json({ error: 'Crop name is required' });

    // Rotation conflict check — same crop family in same field last season
    if (field_id && crop_family) {
      const prev = await query(
        `SELECT crop_name FROM farm_rotation
         WHERE field_id=$1 AND crop_family=$2
         ORDER BY season DESC LIMIT 1`,
        [field_id, crop_family]
      );
      if (prev.rows.length) {
        // Flag but still allow — include warning in response
        const r2 = await query(
          `INSERT INTO farm_plantings
             (user_id, field_id, season, crop_name, variety, seed_lot, planned_date,
              actual_date, seed_rate, days_to_maturity, target_yield_kg, status, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
          [req.user.id, field_id || null, season?.trim() || null, crop_name.trim(),
           variety?.trim() || null, seed_lot?.trim() || null, planned_date || null,
           actual_date || null, seed_rate || null, days_to_maturity || null,
           target_yield_kg || null, status || 'planned', notes?.trim() || null]
        );
        return res.status(201).json({
          ...r2.rows[0],
          rotation_warning: `${prev.rows[0].crop_name} (same family) was grown here recently`,
        });
      }
    }

    const r = await query(
      `INSERT INTO farm_plantings
         (user_id, field_id, season, crop_name, variety, seed_lot, planned_date,
          actual_date, seed_rate, days_to_maturity, target_yield_kg, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [req.user.id, field_id || null, season?.trim() || null, crop_name.trim(),
       variety?.trim() || null, seed_lot?.trim() || null, planned_date || null,
       actual_date || null, seed_rate || null, days_to_maturity || null,
       target_yield_kg || null, status || 'planned', notes?.trim() || null]
    );

    // Write rotation history entry
    if (field_id && season && crop_family) {
      await query(
        `INSERT INTO farm_rotation (field_id, season, crop_name, crop_family)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [field_id, season, crop_name.trim(), crop_family]
      ).catch(() => {});
    }

    res.status(201).json(r.rows[0]);
  } catch (err) { next(err); }
});

router.put('/plantings/:id', async (req, res, next) => {
  try {
    const {
      field_id, season, crop_name, variety, seed_lot,
      planned_date, actual_date, seed_rate, days_to_maturity,
      target_yield_kg, status, notes,
    } = req.body;
    const r = await query(
      `UPDATE farm_plantings SET field_id=$1, season=$2, crop_name=$3, variety=$4,
       seed_lot=$5, planned_date=$6, actual_date=$7, seed_rate=$8,
       days_to_maturity=$9, target_yield_kg=$10, status=$11, notes=$12, updated_at=NOW()
       WHERE id=$13 AND user_id=$14 RETURNING *`,
      [field_id || null, season?.trim() || null, crop_name?.trim(), variety?.trim() || null,
       seed_lot?.trim() || null, planned_date || null, actual_date || null, seed_rate || null,
       days_to_maturity || null, target_yield_kg || null, status || 'planned',
       notes?.trim() || null, req.params.id, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Planting not found' });
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/plantings/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM farm_plantings WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── INVENTORY ────────────────────────────────────────────────

router.get('/inventory', async (req, res, next) => {
  try {
    const { category } = req.query;
    const r = category
      ? await query('SELECT * FROM farm_inventory WHERE user_id=$1 AND category=$2 ORDER BY name', [req.user.id, category])
      : await query('SELECT * FROM farm_inventory WHERE user_id=$1 ORDER BY category, name', [req.user.id]);
    res.json(r.rows);
  } catch (err) { next(err); }
});

router.get('/inventory/alerts', async (req, res, next) => {
  try {
    // Alert when current_stock <= reorder_point + (daily_usage * lead_time_days)
    const r = await query(
      `SELECT * FROM farm_inventory
       WHERE user_id=$1
         AND quantity <= (reorder_point + (COALESCE(daily_usage,0) * COALESCE(lead_time_days,0)))
       ORDER BY category, name`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) { next(err); }
});

router.post('/inventory', async (req, res, next) => {
  try {
    const {
      category, name, quantity, unit, reorder_point, daily_usage,
      lead_time_days, preferred_supplier, last_price_usd, expiry_date, notes,
    } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Item name is required' });
    if (!category)     return res.status(400).json({ error: 'Category is required' });
    const r = await query(
      `INSERT INTO farm_inventory
         (user_id, category, name, quantity, unit, reorder_point, daily_usage,
          lead_time_days, preferred_supplier, last_price_usd, expiry_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.user.id, category, name.trim(), quantity ?? 0, unit?.trim() || null,
       reorder_point ?? 0, daily_usage || null, lead_time_days || null,
       preferred_supplier?.trim() || null, last_price_usd || null,
       expiry_date || null, notes?.trim() || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { next(err); }
});

router.put('/inventory/:id', async (req, res, next) => {
  try {
    const {
      category, name, quantity, unit, reorder_point, daily_usage,
      lead_time_days, preferred_supplier, last_price_usd, expiry_date, notes,
    } = req.body;
    const r = await query(
      `UPDATE farm_inventory SET category=$1, name=$2, quantity=$3, unit=$4, reorder_point=$5,
       daily_usage=$6, lead_time_days=$7, preferred_supplier=$8, last_price_usd=$9,
       expiry_date=$10, notes=$11, updated_at=NOW()
       WHERE id=$12 AND user_id=$13 RETURNING *`,
      [category, name?.trim(), quantity ?? 0, unit?.trim() || null, reorder_point ?? 0,
       daily_usage || null, lead_time_days || null, preferred_supplier?.trim() || null,
       last_price_usd || null, expiry_date || null, notes?.trim() || null,
       req.params.id, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/inventory/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM farm_inventory WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── EQUIPMENT ────────────────────────────────────────────────

router.get('/equipment', async (req, res, next) => {
  try {
    const r = await query('SELECT * FROM farm_equipment WHERE user_id=$1 ORDER BY name', [req.user.id]);
    res.json(r.rows);
  } catch (err) { next(err); }
});

router.post('/equipment', async (req, res, next) => {
  try {
    const { name, make_model, hours_current, service_interval_hrs, next_service_date, insurance_renewal, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Equipment name is required' });
    const r = await query(
      `INSERT INTO farm_equipment
         (user_id, name, make_model, hours_current, service_interval_hrs, next_service_date, insurance_renewal, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, name.trim(), make_model?.trim() || null, hours_current || 0,
       service_interval_hrs || null, next_service_date || null,
       insurance_renewal || null, notes?.trim() || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { next(err); }
});

router.put('/equipment/:id', async (req, res, next) => {
  try {
    const { name, make_model, hours_current, service_interval_hrs, next_service_date, insurance_renewal, notes } = req.body;
    const r = await query(
      `UPDATE farm_equipment SET name=$1, make_model=$2, hours_current=$3,
       service_interval_hrs=$4, next_service_date=$5, insurance_renewal=$6,
       notes=$7, updated_at=NOW()
       WHERE id=$8 AND user_id=$9 RETURNING *`,
      [name?.trim(), make_model?.trim() || null, hours_current || 0, service_interval_hrs || null,
       next_service_date || null, insurance_renewal || null, notes?.trim() || null,
       req.params.id, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Equipment not found' });
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/equipment/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM farm_equipment WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/equipment/:id/log', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT l.* FROM farm_equipment_log l
       JOIN farm_equipment e ON e.id = l.equipment_id
       WHERE l.equipment_id=$1 AND e.user_id=$2
       ORDER BY l.created_at DESC`,
      [req.params.id, req.user.id]
    );
    res.json(r.rows);
  } catch (err) { next(err); }
});

router.post('/equipment/:id/log', async (req, res, next) => {
  try {
    const { log_type, description, hours_at_service, parts_json, cost_usd, downtime_hrs } = req.body;
    // Verify ownership
    const eq = await query('SELECT id FROM farm_equipment WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!eq.rows.length) return res.status(404).json({ error: 'Equipment not found' });
    const r = await query(
      `INSERT INTO farm_equipment_log
         (equipment_id, user_id, log_type, description, hours_at_service, parts_json, cost_usd, downtime_hrs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, req.user.id, log_type || 'maintenance',
       description?.trim() || null, hours_at_service || null,
       JSON.stringify(parts_json || []), cost_usd || null, downtime_hrs || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { next(err); }
});

// ── TASKS ────────────────────────────────────────────────────

router.get('/tasks', async (req, res, next) => {
  try {
    const { status } = req.query;
    const r = status
      ? await query(
          `SELECT t.*, f.name AS field_name FROM farm_tasks t
           LEFT JOIN farm_fields f ON f.id = t.field_id
           WHERE t.user_id=$1 AND t.status=$2 ORDER BY t.due_date ASC NULLS LAST`,
          [req.user.id, status])
      : await query(
          `SELECT t.*, f.name AS field_name FROM farm_tasks t
           LEFT JOIN farm_fields f ON f.id = t.field_id
           WHERE t.user_id=$1 ORDER BY t.due_date ASC NULLS LAST`,
          [req.user.id]);
    res.json(r.rows);
  } catch (err) { next(err); }
});

router.post('/tasks', async (req, res, next) => {
  try {
    const { field_id, title, description, due_date, assigned_to, status, priority, est_hours } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Task title is required' });
    const r = await query(
      `INSERT INTO farm_tasks
         (user_id, field_id, title, description, due_date, assigned_to, status, priority, est_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, field_id || null, title.trim(), description?.trim() || null,
       due_date || null, assigned_to?.trim() || null, status || 'pending',
       priority || 'medium', est_hours || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { next(err); }
});

router.put('/tasks/:id', async (req, res, next) => {
  try {
    const { field_id, title, description, due_date, assigned_to, status, priority, est_hours } = req.body;
    const r = await query(
      `UPDATE farm_tasks SET field_id=$1, title=$2, description=$3, due_date=$4,
       assigned_to=$5, status=$6, priority=$7, est_hours=$8, updated_at=NOW()
       WHERE id=$9 AND user_id=$10 RETURNING *`,
      [field_id || null, title?.trim(), description?.trim() || null, due_date || null,
       assigned_to?.trim() || null, status || 'pending', priority || 'medium',
       est_hours || null, req.params.id, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json(r.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/tasks/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM farm_tasks WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── HARVESTS ─────────────────────────────────────────────────

router.get('/harvests', async (req, res, next) => {
  try {
    const r = await query(
      `SELECT h.*, f.name AS field_name FROM farm_harvests h
       LEFT JOIN farm_fields f ON f.id = h.field_id
       WHERE h.user_id=$1 ORDER BY h.start_date DESC NULLS LAST`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) { next(err); }
});

router.post('/harvests', async (req, res, next) => {
  try {
    const {
      field_id, planting_id, crop_name, start_date, end_date,
      area_acres, yield_kg, moisture_pct, grade, storage_location, notes,
    } = req.body;
    if (!crop_name?.trim()) return res.status(400).json({ error: 'Crop name is required' });
    const r = await query(
      `INSERT INTO farm_harvests
         (user_id, field_id, planting_id, crop_name, start_date, end_date,
          area_acres, yield_kg, moisture_pct, grade, storage_location, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.user.id, field_id || null, planting_id || null, crop_name.trim(),
       start_date || null, end_date || null, area_acres || null, yield_kg || null,
       moisture_pct || null, grade?.trim() || null, storage_location?.trim() || null,
       notes?.trim() || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/harvests/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM farm_harvests WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── HEARTBEAT ─────────────────────────────────────────────────
// Check: inventory alerts, overdue tasks, equipment service due

router.get('/heartbeat', async (req, res, next) => {
  try {
    const uid = req.user.id;
    const alerts = [];

    // Inventory low stock
    const inv = await query(
      `SELECT name, quantity, unit, reorder_point, preferred_supplier
       FROM farm_inventory
       WHERE user_id=$1
         AND quantity <= (reorder_point + (COALESCE(daily_usage,0) * COALESCE(lead_time_days,0)))`,
      [uid]
    );
    inv.rows.forEach(i =>
      alerts.push({ type: 'inventory', severity: 'medium', message: `Low stock: ${i.name} (${i.quantity} ${i.unit || 'units'} — reorder from ${i.preferred_supplier || 'supplier'})` })
    );

    // Overdue tasks
    const tasks = await query(
      `SELECT t.title, t.due_date, f.name AS field_name FROM farm_tasks t
       LEFT JOIN farm_fields f ON f.id = t.field_id
       WHERE t.user_id=$1 AND t.status != 'done' AND t.due_date < NOW()`,
      [uid]
    );
    tasks.rows.forEach(t =>
      alerts.push({ type: 'task', severity: 'high', message: `Overdue: ${t.title}${t.field_name ? ` (${t.field_name})` : ''} — was due ${new Date(t.due_date).toLocaleDateString()}` })
    );

    // Equipment service overdue or due within 7 days
    const equip = await query(
      `SELECT name, next_service_date FROM farm_equipment
       WHERE user_id=$1
         AND next_service_date IS NOT NULL
         AND next_service_date <= NOW() + INTERVAL '7 days'`,
      [uid]
    );
    equip.rows.forEach(e => {
      const daysOut = Math.ceil((new Date(e.next_service_date) - Date.now()) / 86400000);
      const past = daysOut < 0;
      alerts.push({
        type: 'equipment', severity: past ? 'high' : 'low',
        message: past
          ? `Service overdue: ${e.name} (was due ${new Date(e.next_service_date).toLocaleDateString()})`
          : `Service due in ${daysOut}d: ${e.name}`,
      });
    });

    res.json({ alerts, ok: alerts.length === 0 });
  } catch (err) { next(err); }
});

module.exports = router;
