# Finance Splitter v2

A modern expense splitting application built with React frontend and Node.js backend, powered by PostgreSQL database.

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Installation & Setup](#installation--setup)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Network Access](#network-access)

## ✨ Features

- Split expenses between multiple people
- Real-time expense tracking
- User-friendly React interface
- RESTful API backend
- PostgreSQL database integration

## 🔧 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- PostgreSQL database
- Git

## 🔐 Environment Setup

1. **Copy the environment template:**

   ```bash
   cp backend/.env.template backend/.env
   ```

2. **Configure your environment variables:**
   Open `backend/.env` and fill in your own values for:
   - Database connection details
   - API keys
   - Other configuration variables

## 🚀 Installation & Setup

### Backend Setup

1. **Navigate to the backend directory:**

   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
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

## 📱 Mobile Access

### Mobile Web Interface

The web application is responsive and can be accessed on mobile devices through any modern browser at the same URL as the desktop version.

### Native Mobile App (Coming Soon)

A dedicated mobile component is planned for enhanced mobile experience:

```bash
# Future mobile setup (placeholder)
cd mobile
npm install
# Additional mobile-specific setup instructions will be added here
```

**Planned Features:**

- Native mobile app experience

_Note: Mobile component is currently in development. Check back for updates!_

## 🧪 Testing

To run the frontend unit tests:

```bash
cd frontend
npm test
```

## 🌐 Network Access

This setup is compatible with WSL2 and will be accessible on other devices on the same network when properly configured with your WSL2 IP address.

---

**Note:** Make sure both backend and frontend are running simultaneously for the application to work properly.
