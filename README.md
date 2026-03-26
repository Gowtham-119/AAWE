# AAWE

AAWE is organized as a single repository with two main folders:

- `frontend`: React frontend application
- `backend`: backend support assets (database setup SQL, seed scripts, admin scripts)

## Repository Structure

```text
AAWE/
	frontend/
		src/
		public/
		package.json
	backend/
		scripts/
		guidelines/
```

## Prerequisites

- Node.js 18+
- npm

## Run Frontend

From the project root:

```powershell
cd frontend
npm install
npm start
```

The app runs on the default React dev server URL:

- `http://localhost:3000`

## Build Frontend

```powershell
cd frontend
npm run build
```

## Backend Folder Notes

The `backend` folder currently contains project backend resources, not a standalone API server framework.

- `backend/scripts`: utility scripts for Supabase checks/setup/import/seed
- `backend/guidelines`: setup guide and SQL files

Run a script from the root like this:

```powershell
node backend/scripts/checkSupabase.js
```

## Supabase Setup Files

- `backend/guidelines/SupabaseSetup.sql`
- `backend/guidelines/SupabaseSampleData.sql`
- `backend/guidelines/Guidelines.md`

Use the SQL files in Supabase SQL editor, then use scripts as needed.

## Quick Deploy on Netlify

Use these settings in Netlify:

1. Base directory: `frontend`
2. Build command: `npm run build`
3. Publish directory: `frontend/build` or `build` (when base directory is set to `frontend`)
4. Environment variables:
	- `REACT_APP_SUPABASE_URL`
	- `REACT_APP_SUPABASE_ANON_KEY`

The frontend and helper scripts require the Supabase env vars explicitly; there are no committed fallback credentials.