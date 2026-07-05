# Finance Splitter v2

A modern expense splitting application built with a React frontend, an Expo (React Native) mobile app, and a Node.js backend that uses Python scripts to sync bank feeds, all powered by a PostgreSQL database.

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Installation & Setup](#installation--setup)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Mobile (Expo) Setup](#mobile-expo-setup)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Network Access](#network-access)

## ✨ Features

- Split expenses between multiple people
- Real-time expense tracking
- User-friendly React web interface
- Native mobile app built with Expo / React Native
- Automated bank feed syncing via Python scripts
- RESTful API backend
- PostgreSQL database integration

## 🔧 Prerequisites

Make sure the following are installed before you begin:

- **Node.js** (v18 or higher) and **npm**
- **Python 3** (v3.9 or higher) with `venv` and `pip` available
  - On Debian/Ubuntu/WSL2 you may need: `sudo apt install python3 python3-venv python3-pip`
- **PostgreSQL** database (running and reachable)
- **Git**

### Additional prerequisites for the mobile app

- The **Expo** tooling is run via `npx` (installed automatically by `npm install`), so no global install is required.
- A way to preview the app, at least one of:
  - The **Expo Go** app on a physical iOS/Android device ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
  - **Xcode** with an iOS Simulator (macOS only)
  - **Android Studio** with an Android emulator
  - Or run it in a browser with Expo's web target

## 🔐 Environment Setup

1. **Copy the environment template:**

   ```bash
   cp backend/.env.template backend/.env
   ```

2. **Configure your environment variables:**
   Open `backend/.env` and fill in your own values for:
   - Database connection details (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`)
   - API keys (e.g. `POCKETSMITH_API_KEY`)
   - Other configuration variables
   - **`PYTHON_BIN`** — the Python interpreter the backend uses to run the bank feed scripts. Point this at the virtual environment you create in the [Backend Setup](#backend-setup) step, for example:
     ```bash
     PYTHON_BIN=/absolute/path/to/finance-splitter-v2/backend/venv/bin/python3
     ```
     If left unset, the backend falls back to the system `python3`, which will only work if the Python dependencies are installed globally.

## 🚀 Installation & Setup

### Backend Setup

1. **Navigate to the backend directory:**

   ```bash
   cd backend
   ```

2. **Install Node.js dependencies:**

   ```bash
   npm install
   ```

3. **Create a Python virtual environment and install the Python dependencies:**

   The backend shells out to Python scripts (`shared_bank_feed.py`, `personal_bank_feed.py`, `offset_bank_feed.py`) to sync bank feeds. These require their own dependencies, installed into an isolated virtual environment:

   ```bash
   python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
   ```

   This creates a `venv/` folder inside `backend/` and installs the packages listed in `requirements.txt` (`requests`, `psycopg2-binary`, `python-dotenv`).

4. **Point the backend at the virtual environment:**

   Set `PYTHON_BIN` in `backend/.env` to the interpreter inside the venv you just created so the bank feed scripts run with the correct dependencies (see [Environment Setup](#environment-setup)):

   ```bash
   PYTHON_BIN=/absolute/path/to/finance-splitter-v2/backend/venv/bin/python3
   ```

### Frontend Setup

1. **Configure API endpoint:**

   **For WSL2 users:**

   - Find your WSL2 IP address:
     ```bash
     ip addr | grep inet
     ```
   - Copy the IP address and update `frontend/src/config/apiConfig.js`

   **For other users:**

   - Update `frontend/src/config/apiConfig.js` with `localhost`

2. **Navigate to the frontend directory:**

   ```bash
   cd frontend
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

### Mobile (Expo) Setup

The mobile app lives in the `mobile/` directory and is built with Expo / React Native.

1. **Navigate to the mobile directory:**

   ```bash
   cd mobile
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

   This installs Expo and all native dependencies. The Expo CLI is invoked through `npx`, so there is no separate global install step.

3. **Configure the API endpoint:**

   The app points at the backend via the `API_CONFIG` block in `mobile/app/(tabs)/index.tsx` (and `test_page.tsx`). Update the `development` URLs so they match the host/IP and port your backend is running on:

   ```ts
   const API_CONFIG = {
     development: {
       ios: 'http://<your-machine-ip>:<backend-port>',
       android: 'http://<your-machine-ip>:<backend-port>',
       web: 'http://<your-machine-ip>:<backend-port>',
     },
     production: 'https://your-production-api-url.com',
   };
   ```

   > **WSL2 / physical device note:** `localhost` will not resolve from Expo Go on a physical device. Use your machine's LAN IP (find it with `ip addr | grep inet`) so your phone can reach the backend.

## 🏃‍♂️ Running the Application

### Start the Backend

```bash
cd backend
node index.js
```

### Start the Frontend

```bash
cd frontend
npm run dev
```

The application will be available at the URL shown in your terminal (typically `http://localhost:5173`).

### Start the Mobile App (Expo)

Make sure the backend is running and reachable from your device first, then start the Expo dev server:

```bash
cd mobile
npx expo start
```

This opens the Expo developer tools and prints a QR code. From there you can:

- **Scan the QR code** with the Expo Go app on a physical device
- Press **`i`** to open the iOS Simulator (macOS + Xcode)
- Press **`a`** to open the Android emulator (Android Studio)
- Press **`w`** to open the app in a web browser

Handy shortcuts:

```bash
npx expo start --ios       # boot straight into the iOS Simulator
npx expo start --android   # boot straight into the Android emulator
npx expo start --web       # run in the browser
npx expo start --clear     # clear the Metro bundler cache (use if you hit stale-cache errors)
```

> **First-run tip:** If you run into native module or version mismatch errors, run `npx expo install --check` inside `mobile/` to align dependency versions with your installed Expo SDK.

## 📱 Mobile Web Interface

The React web application is responsive and can also be accessed on mobile devices through any modern browser at the same URL as the desktop version.

## 🧪 Testing

To run the frontend unit tests:

```bash
cd frontend
npm test
```

## 🌐 Network Access

This setup is compatible with WSL2 and will be accessible on other devices on the same network when properly configured with your WSL2 IP address.

---

**Note:** The backend must be running for the frontend or mobile app to work. When developing the mobile app, ensure the backend is reachable from your device (via your machine's LAN IP, not `localhost`) and that the Python virtual environment is set up so bank feed syncing works.
