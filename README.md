# 🎓 BrightFuture School Management CMS

A comprehensive, full-stack primary school management system built with **Next.js 14**, **Node.js/Express**, and **PostgreSQL**.

---

## 📋 Features

| Module | Description |
|---|---|
| 🏠 **Dashboard** | Real-time stats, charts, upcoming events |
| 👤 **Students** | Enrollment, profiles, search & filter |
| 👩‍🏫 **Staff** | Teachers, admin, librarian, accountant |
| 🏫 **Classes** | Grade management, capacity tracking |
| 📋 **Attendance** | Daily marking, summary reports |
| 📝 **Grades & Exams** | Exam creation, result entry, grade letters |
| 📅 **Timetable** | Weekly class schedule view |
| 💰 **Finance** | Fee categories, payment recording, GH₵ tracking |
| 📚 **Library** | Book inventory, borrowing & return with fines |
| 👨‍👩‍👧 **Parents** | Guardian profiles, linked children |
| 🗓️ **Events** | School calendar, announcements |

---

## 🗂️ Project Structure

```
school-cms/
├── backend/           # Node.js + Express + PostgreSQL API
│   ├── src/
│   │   ├── db/        # Database connection, migrations, seed
│   │   ├── middleware/ # JWT authentication
│   │   └── routes/    # API route handlers
│   ├── .env.example
│   └── package.json
│
└── frontend/          # Next.js 14 + Tailwind CSS
    ├── src/
    │   ├── app/       # Next.js app router pages
    │   ├── components/ # Reusable components
    │   └── lib/       # API client, auth context
    ├── .env.local.example
    └── package.json
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Database Setup

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE school_cms;"
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
Yarn install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations (create all tables)
Yarn run db:migrate

# Seed with dummy data
Yarn run db:seed

# Start the server
Yarn  dev
```

Backend runs at: `http://localhost:5000`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
Yarn install

# Configure environment
cp .env.local.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Start the dev server
Yarn run dev
```

Frontend runs at: `http://localhost:3000`

---

## 🔐 Demo Login Credentials

All accounts use password: **`password123`**

| Role | Email |
|---|---|
| Admin | admin@brightfuture.edu.gh |
| Teacher | abena.mensah@brightfuture.edu.gh |
| Parent | grace.tetteh@brightfuture.edu.gh |
| Librarian | akua.sarpong@brightfuture.edu.gh |
| Accountant | yaw.ofori@brightfuture.edu.gh |

---

## 🛠️ API Endpoints

### Auth
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Current user

### Students
- `GET /api/students` — List (with search/filter)
- `POST /api/students` — Create
- `GET /api/students/:id` — Detail + parents
- `PUT /api/students/:id` — Update
- `DELETE /api/students/:id` — Delete
- `GET /api/students/:id/grades` — Student grades
- `GET /api/students/:id/attendance` — Student attendance
- `GET /api/students/:id/fees` — Student fee history

### Academic
- `GET/POST /api/academic/classes`
- `GET/POST /api/academic/subjects`
- `GET/POST /api/academic/timetable`
- `GET/POST /api/academic/attendance`
- `GET /api/academic/attendance/summary`
- `GET/POST /api/academic/exams`
- `GET/POST /api/academic/grades`

### Finance
- `GET/POST /api/finance/categories`
- `GET/POST /api/finance/payments`
- `GET /api/finance/summary`

### Library
- `GET/POST /api/library/books`
- `PUT /api/library/books/:id`
- `GET /api/library/borrowings`
- `POST /api/library/borrow`
- `PUT /api/library/return/:id`

### Other
- `GET /api/dashboard` — Dashboard statistics
- `GET/POST/DELETE /api/events`
- `GET/api/parents`
- `GET /api/staff`

---

## 🎨 Tech Stack

**Frontend**
- Next.js 14 (App Router)
- Tailwind CSS
- Recharts (data visualization)
- Lucide React (icons)
- Axios (API client)
- React Hot Toast (notifications)

**Backend**
- Node.js + Express
- PostgreSQL (via `pg`)
- JWT Authentication
- bcryptjs (password hashing)

---

## 🌍 Customization

- School name: Update in `Sidebar.jsx` and login page
- Currency: Currently set to GH₵ (Ghana Cedis) — search and replace `GH₵`
- Academic year: Update seed data and default form values

---

## 📝 License

Built for BrightFuture Primary School, Accra, Ghana.
