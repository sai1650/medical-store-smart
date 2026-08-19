# Deploying the backend (Render)

This document walks through deploying the `backend/` service to a host that supports long‑running Node apps.

Recommended: Render (free tier).

## Prepare

1. Create a MongoDB Atlas cluster and obtain the connection string. Fill in `MONGODB_URI`.
2. In your repo root add a `.env` (locally) using `.env.example` as template (do NOT commit secrets).

## Render (quick)

1. Go to https://dashboard.render.com and create a new **Web Service**.
2. Connect your GitHub repository and select the `smart-medical-store` repo.
3. Set the **Root Directory** to `backend`.
4. Set the Build Command to `npm ci` and Start Command to `npm start`.
5. Under Environment, add these variables. Enter their real values only in the Render Dashboard:
	- `MONGODB_URI`
	- `AWS_REGION`
	- `AWS_ACCESS_KEY_ID`
	- `AWS_SECRET_ACCESS_KEY`
	- `AWS_S3_BUCKET_NAME`
	- `S3_URL_EXPIRATION` = `3600`
	- `JWT_SECRET`
6. Create the service — Render will build and start the server. Note the HTTPS endpoint it provides.

Render does not read the local `backend/.env` file from your computer. The local file is ignored by Git, so production variables must be configured in Render's Environment settings or through the `sync: false` entries in `render.yaml`.

## After deployment

- The frontend is already configured to use the Render backend URL by default.
- If you rename the Render service, update the `VITE_API_BASE_URL` frontend environment variable and rebuild the Vite frontend.
- Make sure CORS is allowed — `backend/server.js` already uses `cors()`.
