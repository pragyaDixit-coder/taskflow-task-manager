# 🗂️ TaskFlow – Task Management Application

TaskFlow is a full-stack Task Management web application designed to help users manage tasks efficiently with secure authentication, role-based access, and a clean, modern UI.

---

## 🚀 Features

### 🔐 Authentication & Security
- User Signup & Login
- Remember Me functionality (DB-based session)
- Forgot Password with Email Reset Link
- Secure password hashing (bcrypt)
- HTTP-only cookie based authentication

### 📝 Task Management
- Create, update, delete tasks
- Assign tasks to users
- Task priority (Low / Medium / High)
- Task status tracking
- Filter & search tasks

### 👥 User & Role Management
- Admin & User roles
- Admin can manage users
- Role-based access control

### 🌍 Location Management
- Country, State, City management
- Zip code handling

### 🎨 UI & UX
- React + TypeScript
- Material UI (MUI)
- Responsive design
- Clean login UI with custom background
- Semi-transparent (glassmorphism) login card

---

## 🛠️ Tech Stack

### Frontend
- React
- TypeScript
- Material UI (MUI)
- Tailwind CSS
- React Router
- Axios

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- bcrypt / bcryptjs
- Nodemailer

### Authentication
- HTTP-only cookies
- DB-based session management
- JWT (used for internal payload only)

---

## 📂 Project Structure

TaskFlow/
│
├── backend/
│ ├── src/
│ │ ├── controllers/
│ │ ├── models/
│ │ ├── routes/
│ │ ├── services/
│ │ ├── middleware/
│ │ └── app.js
│ └── package.json
│
├── frontend/
│ ├── src/
│ │ ├── pages/
│ │ ├── components/
│ │ ├── assets/
│ │ ├── utils/
│ │ └── App.tsx
│ └── package.json
│
└── README.md


---

## ⚙️ Environment Variables

Create a `.env` file in backend root:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
AUTH_COOKIE_NAME=session
NODE_ENV=development
RESET_PASSWORD_EXP_MINUTES=10
FRONTEND_ORIGIN=http://localhost:5173

▶️ How to Run the Project Locally
1️⃣ Backend Setup
cd backend
npm install
npm run dev


Server will start on:

http://localhost:5000

2️⃣ Frontend Setup
cd frontend
npm install
npm run dev


Frontend will run on:

http://localhost:5173

🧪 Testing Features

Login with valid credentials

Test Remember Me (browser close & reopen)

Forgot Password with valid & invalid email

Create and assign tasks

Admin vs User role access

🔒 Security Notes

Passwords are never stored in plain text

Sessions are stored securely in the database

HTTP-only cookies prevent XSS attacks

Reset password links expire automatically

📌 Future Improvements

Dark mode

Activity logs

File attachments in tasks

Notifications

👩‍💻 Developed By

Pragya Dixit
TaskFlow – Task Management Application