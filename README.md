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

## Quick Deploy on Vercel (Review)

This repository includes `vercel.json` so you can deploy from the repo root.

### Steps

1. Push this repository to GitHub.
2. In Vercel, click **Add New Project** and import the repository.
3. In project settings, add environment variables:
	- `REACT_APP_SUPABASE_URL`
	- `REACT_APP_SUPABASE_ANON_KEY`
4. Deploy.

The configuration builds `frontend` and serves `frontend/build` with SPA rewrite support, so routes like `/admin/users` and `/student/dashboard` open correctly on refresh.