# Project: Plant Scanner

## What this app does
A small web app for agriculture. The user uploads a photo of a plant from
their phone or computer. The server sends the photo to Google Gemini Vision,
gets back four pieces of information, saves the result in a local database,
and shows it in the browser:

1. `plant_name` — common name + species
2. `disease` — disease or pest visible (or "none visible")
3. `fertilizer` — recommended fertilizer type and dosage
4. `soil_advice` — soil type, pH range, watering frequency

## Tech stack (do not change without asking)
- **Backend**: Node.js + Express (CommonJS, `require`, not ESM)
- **AI**: `@google/generative-ai` package, model `gemini-2.0-flash-exp`
- **Database**: `better-sqlite3` (synchronous, file-based — `data.db`)
- **File upload**: `multer` with disk storage in `/uploads`
- **Env vars**: `dotenv` reads `.env`
- **Frontend**: Plain HTML + vanilla JS + plain CSS. **No React, no build step, no TypeScript, no bundler.**

## File map
```
server.js              Express entry. Routes: POST /api/scan, GET /api/history
gemini.js              Wraps Gemini call. Exports analyzePlant(filePath)
db.js                  SQLite. Exports insertScan(row), listScans()
public/index.html      Upload form, result cards, history list
public/app.js          Fetch /api/scan, render result, reload history
public/style.css       Styling
.env                   GEMINI_API_KEY, PORT (never commit)
uploads/               Saved photos (gitignored)
data.db                SQLite file (gitignored, auto-created)
```

## Conventions Copilot must follow
- **CommonJS only** in Node files: `const x = require('y')`, `module.exports = ...`. No `import`/`export`.
- **Vanilla JS only** in `public/`. No frameworks, no JSX, no TypeScript.
- **Keep files small.** If a file passes ~150 lines, suggest splitting.
- **Never put the Gemini API key in frontend code.** It must stay in `.env` and only be read by `gemini.js`.
- **Keep the prompt structured.** When changing the Gemini prompt in `gemini.js`, always keep `responseMimeType: 'application/json'` and ask for JSON-only output.
- **Validate user input** in `server.js` (file present, image mimetype, size limit already set to 10 MB).
- **Use the existing helpers** `insertScan()` and `listScans()` in `db.js` rather than writing raw SQL elsewhere.
- **Don't introduce a new dependency** unless it's clearly needed; comment why.
- **No comments explaining what code does** — only why, when non-obvious.

## Database schema (already created in db.js)
```sql
CREATE TABLE scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  plant_name TEXT,
  disease TEXT,
  fertilizer TEXT,
  soil_advice TEXT,
  raw_response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
If a new field is needed, add a migration that uses `ALTER TABLE` inside `db.js`. Don't drop the table.

## API contract (do not break)
- `POST /api/scan` — multipart form, field name `photo`, returns:
  ```json
  {
    "id": 1,
    "filename": "...",
    "url": "/uploads/...",
    "plant_name": "...",
    "disease": "...",
    "fertilizer": "...",
    "soil_advice": "...",
    "raw_response": "..."
  }
  ```
- `GET /api/history` — returns last 20 rows, each with the fields above plus `created_at`.

## Common tasks (good prompt starters for the user)
The user is a beginner who is using Copilot to extend this app. When they ask for things like:
- "Add a confidence score" → add a `confidence` field to the Gemini prompt + JSON, store it in a new column, render it in the result card and history.
- "Add a delete button" → add `DELETE /api/scans/:id` in `server.js`, a delete button per item in `public/app.js`, and remove the file from `uploads/`.
- "Translate to Hindi/Tagalog/Swahili" → add a language select in the UI, pass the language as a form field, append the language instruction to the prompt in `gemini.js`.
- "Show a chart of diseases" → add a small SQL aggregation in `db.js` and a Canvas/SVG chart in vanilla JS — do not add Chart.js or React.
- "Deploy this" → suggest Render.com or Railway. Remind to set `GEMINI_API_KEY` as an env var and switch SQLite to a managed DB if multiple instances are needed.

## Out of scope
- User accounts / authentication
- Real-time features (websockets)
- Mobile native app
- Training a custom model — `raw_response` is saved precisely so the user can do this later, but it is not part of this codebase.

## When unsure
Ask the user a clarifying question instead of inventing a new framework or restructuring the app.
