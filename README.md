# Plant ID Pro

This repo is building a modern plant identification and care product with a split backend/front-end architecture.

## What it does

- Scan plant photos with Google Gemini
- Return rich plant data: plant type, disease, fertilizer, soil, weather, habitat, care summary, and confidence
- Save scans to a backend database
- Provide a searchable plant care library
- Use a polished React frontend for a user-friendly experience

## Project structure

- `backend/` — Express API, PostgreSQL schema, plant scanning, and library seeding
- `frontend/` — React + Vite app with scan UI, library search, and smart care cards
- `public/` and root files — legacy starter files from the earlier version

## Setup

### Backend

1. Install dependencies:

   ```bash
   cd backend
   npm install
   ```

2. Create `backend/.env` from `.env.example` and fill in values:

   ```bash
   DATABASE_URL=postgres://user:password@localhost:5432/plantidpro
   GEMINI_API_KEY=your_gemini_api_key
   JWT_SECRET=your_jwt_secret
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_webhook_webhook_secret
   EMAIL_HOST=smtp.example.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@example.com
   EMAIL_PASS=your-email-password
   EMAIL_FROM="Plant ID Pro" <no-reply@example.com>
   NODE_ENV=development
   ```

3. Start the backend:

   ```bash
   npm run dev
   ```

### Frontend

1. Install dependencies:

   ```bash
   cd frontend
   npm install
   ```

2. Start the frontend:

   ```bash
   npm run dev
   ```

3. Open the local Vite URL (usually `http://localhost:5173`).

## Key APIs

- `POST /api/scans/public` — upload a photo field named `photo`
- `GET /api/scans/public` — recent public scan history
- `GET /api/plants?search=...` — search the seed plant library

## Product goals for phase 1

1. Scan photos and show plant care cards
2. Seed a searchable plant database
3. Display a plant health score and practical advice
4. Keep the UI green, clean, and easy to use

## Later phases

- Login and premium subscription
- AI chat for plant questions
- Growth timeline and reminders
- Business API for agricultural partners

## Notes

- The backend seeds 1000+ sample plant entries automatically on first startup.
- The frontend includes a camera-style scan panel, library search, and recent history.
- If you want to test the first version separately, run the backend and frontend in two terminals.
