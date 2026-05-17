const express = require('express');
const { query }                    = require('../db');
const { requireAuth, optionalAuth }= require('../middleware/auth');
const { getFarmingAdvice, chatWithPlantExpert } = require('../utils/gemini');

const router = express.Router();

// ── POST /api/farming/plan ─────────────────────────────────────
router.post('/plan', optionalAuth, async (req, res, next) => {
  try {
    const {
      location, latitude, longitude, country, climate_zone,
      plot_size_sqm, soil_type, water_source, budget_usd,
      is_hydroponic, desired_crops, season, language,
      plan_name,
    } = req.body;

    const advice = await getFarmingAdvice({
      location, climate_zone, plot_size_sqm, soil_type, water_source,
      budget_usd, is_hydroponic, desired_crops, season,
    }, language || 'en');

    // Save plan if authenticated
    let savedPlan = null;
    if (req.user) {
      const result = await query(
        `INSERT INTO crop_plans
           (user_id, plan_name, location, latitude, longitude, country, climate_zone,
            plot_size_sqm, soil_type, water_source, budget_usd, is_hydroponic,
            crops_json, schedule_json, ai_advice, cost_estimate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [
          req.user.id,
          plan_name?.trim() || `Farm Plan ${new Date().toLocaleDateString()}`,
          location?.trim() || null, latitude || null, longitude || null, country?.trim() || null,
          climate_zone?.trim() || null, plot_size_sqm || null, soil_type?.trim() || null,
          water_source?.trim() || null, budget_usd || null, !!is_hydroponic,
          JSON.stringify(advice.recommended_crops || []),
          JSON.stringify(advice.planting_calendar || []),
          advice.summary || null,
          advice.cost_breakdown?.total || null,
        ]
      );
      savedPlan = result.rows[0];

      await query('INSERT INTO user_achievements (user_id, achievement_key) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [req.user.id, 'first_farm_plan']).catch(() => {});
    }

    res.json({ advice, plan_id: savedPlan?.id || null });
  } catch (err) { next(err); }
});

// ── GET /api/farming/plans ─────────────────────────────────────
router.get('/plans', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM crop_plans WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ── GET /api/farming/plans/:id ────────────────────────────────
router.get('/plans/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM crop_plans WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Plan not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// ── DELETE /api/farming/plans/:id ─────────────────────────────
router.delete('/plans/:id', requireAuth, async (req, res, next) => {
  try {
    await query('DELETE FROM crop_plans WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── POST /api/farming/hydroponics ─────────────────────────────
router.post('/hydroponics', optionalAuth, async (req, res, next) => {
  try {
    const { crop, space_sqm, budget_usd, experience_level, language } = req.body;
    if (!crop) return res.status(400).json({ error: 'Crop name is required' });

    const question = `Provide a complete hydroponics setup guide for growing ${crop} with the following parameters:
- Available space: ${space_sqm || 'small (1-2 m²)'}
- Budget: $${budget_usd || 'flexible'}
- Experience level: ${experience_level || 'beginner'}

Include in JSON format:
{
  "system_type": "best hydroponic system for this crop",
  "nutrients": "nutrient solution recipe and brands",
  "ph_range": "optimal pH range",
  "ec_range": "EC/TDS range for nutrients",
  "light_requirements": "lighting setup",
  "temperature_range": "optimal temp range",
  "growing_medium": "recommended growing medium",
  "setup_cost_usd": 0,
  "monthly_running_cost_usd": 0,
  "expected_yield_kg_per_sqm": 0,
  "days_to_first_harvest": 0,
  "step_by_step_setup": ["step 1", "step 2"],
  "common_problems": [{"problem": "", "solution": ""}],
  "tips": ["tip 1"],
  "suppliers": "where to buy equipment",
  "roi_estimate": "estimated return on investment"
}`;

    const answer = await chatWithPlantExpert(question, '', language || 'en');
    let guide = {};
    try {
      const m = answer.match(/\{[\s\S]*\}/);
      guide = JSON.parse(m ? m[0] : answer);
    } catch { guide = { notes: answer }; }

    res.json({ crop, guide });
  } catch (err) { next(err); }
});

// ── POST /api/farming/cost-calculator ─────────────────────────
router.post('/cost-calculator', optionalAuth, async (req, res, next) => {
  try {
    const { crops, plot_size_sqm, country, season, language } = req.body;
    if (!crops?.length) return res.status(400).json({ error: 'At least one crop is required' });

    const question = `Calculate detailed farming costs and profitability for the following setup:
Crops: ${Array.isArray(crops) ? crops.join(', ') : crops}
Plot size: ${plot_size_sqm || 100} m²
Country/Region: ${country || 'Global'}
Season: ${season || 'Current season'}

Provide JSON:
{
  "crops": [{
    "name": "",
    "seed_cost_per_sqm": 0,
    "fertilizer_cost_per_sqm": 0,
    "pesticide_cost_per_sqm": 0,
    "irrigation_cost_per_sqm": 0,
    "labor_hours_per_sqm": 0,
    "total_cost_per_sqm": 0,
    "expected_yield_kg_per_sqm": 0,
    "estimated_market_price_per_kg": 0,
    "gross_revenue_per_sqm": 0,
    "net_profit_per_sqm": 0,
    "break_even_yield_kg": 0,
    "roi_pct": 0,
    "days_to_harvest": 0
  }],
  "total_investment": 0,
  "total_expected_revenue": 0,
  "total_net_profit": 0,
  "payback_period_days": 0,
  "best_crop": "",
  "notes": ""
}`;

    const answer = await chatWithPlantExpert(question, '', language || 'en');
    let result = {};
    try {
      const m = answer.match(/\{[\s\S]*\}/);
      result = JSON.parse(m ? m[0] : answer);
    } catch { result = { notes: answer }; }

    res.json({ calculation: result, plot_size_sqm, crops });
  } catch (err) { next(err); }
});

// ── GET /api/farming/calendar ─────────────────────────────────
router.get('/calendar', optionalAuth, async (req, res, next) => {
  try {
    const { country, hemisphere, language } = req.query;
    const question = `Create a 12-month agricultural planting calendar for ${country || 'temperate climate'} in the ${hemisphere === 'south' ? 'Southern' : 'Northern'} Hemisphere.
For each month provide:
- What to plant (seeds indoors, transplant outdoors)
- What to harvest
- Key garden tasks
- Pest/disease watch
Format as JSON array of 12 months.`;

    const answer = await chatWithPlantExpert(question, '', language || 'en');
    let calendar = [];
    try {
      const m = answer.match(/\[[\s\S]*\]/);
      calendar = JSON.parse(m ? m[0] : '[]');
    } catch { calendar = [{ notes: answer }]; }

    res.json({ calendar, country: country || 'temperate', hemisphere: hemisphere || 'north' });
  } catch (err) { next(err); }
});

// ── GET /api/farming/companion-plants/:crop ───────────────────
router.get('/companion-plants/:crop', optionalAuth, async (req, res, next) => {
  try {
    const crop     = decodeURIComponent(req.params.crop);
    const language = req.query.language || 'en';
    const question = `What are the best and worst companion plants for ${crop}? Provide JSON:
{
  "good_companions": [{"plant": "", "benefit": ""}],
  "bad_companions":  [{"plant": "", "reason": ""}],
  "notes": ""
}`;
    const answer = await chatWithPlantExpert(question, '', language);
    let result = {};
    try {
      const m = answer.match(/\{[\s\S]*\}/);
      result = JSON.parse(m ? m[0] : answer);
    } catch { result = { notes: answer }; }
    res.json({ crop, ...result });
  } catch (err) { next(err); }
});

module.exports = router;
