# AAWE

AAWE is organized as a single repository with two main folders:

- `client`: React frontend application
- `server`: backend support assets (database setup SQL, seed scripts, admin scripts)

## Repository Structure

```text
AAWE/
	client/
		src/
		public/
		package.json
	server/
		scripts/
		guidelines/
```

## Prerequisites

- Node.js 18+
- npm

## Run Frontend (Client)

From the project root:

```powershell
cd client
npm install
npm start
```

The app runs on the default React dev server URL:

- `http://localhost:3000`

## Build Frontend

```powershell
cd client
npm run build
```

## Backend Folder Notes

The `server` folder currently contains project backend resources, not a standalone API server framework.

- `server/scripts`: utility scripts for Supabase checks/setup/import/seed
- `server/guidelines`: setup guide and SQL files

Run a script from the root like this:

```powershell
node server/scripts/checkSupabase.js
```

## Supabase Setup Files

- `server/guidelines/SupabaseSetup.sql`
- `server/guidelines/SupabaseSampleData.sql`
- `server/guidelines/Guidelines.md`

Use the SQL files in Supabase SQL editor, then use scripts as needed.