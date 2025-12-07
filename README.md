# 🚀 TradeTracker - Trade Analysis Platform

פלטפורמת SaaS מקצועית לניתוח עסקאות מסחר בסגנון TradeZella.

![Dashboard Preview](docs/dashboard.png)

## 📋 תכונות

### ✅ שלב 1: Parser (הושלם)
- **Parser אוניברסלי** - תמיכה בברוקרים מרובים
- **מודל נתונים אחיד** - Unified Trade Model
- **מטריקות מתקדמות** - Win Rate, Profit Factor, R-Multiple
- **זיהוי אוטומטי** של סוג הברוקר

### ✅ שלב 2: Dashboard (הושלם)
- **Backend API** - FastAPI + SQLAlchemy
- **Authentication** - JWT tokens
- **Frontend Dashboard** - Next.js + TradingView Charts
- **Equity Curve** - גרף עקומת ההון
- **Hourly Heatmap** - ביצועים לפי שעות

## 🛠️ מבנה הפרויקט

```
TradeTracker/
├── main.py                    # CLI Parser
├── src/                       # Parser Core
│   ├── models/
│   │   ├── trade.py          # Unified Trade Model
│   │   └── account.py
│   └── parsers/
│       ├── base.py           # Base Parser
│       ├── generic.py        # Generic CSV
│       ├── interactive_brokers.py
│       ├── metatrader.py
│       ├── binance.py
│       └── factory.py
├── backend/                   # FastAPI Backend
│   ├── app/
│   │   ├── main.py           # FastAPI app
│   │   ├── config.py         # Settings
│   │   ├── database.py       # SQLAlchemy
│   │   ├── models/           # DB Models
│   │   ├── schemas/          # Pydantic Schemas
│   │   ├── services/         # Business Logic
│   │   └── routers/          # API Routes
│   └── requirements.txt
└── frontend/                  # Next.js Frontend
    ├── src/
    │   ├── app/              # App Router
    │   ├── components/       # React Components
    │   └── lib/              # Utils & Store
    └── package.json
```

## 🚀 הרצה מהירה

### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
pip install aiosqlite pydantic-settings

# הרץ את השרת
uvicorn app.main:app --reload --port 8000
```

השרת יעלה ב: http://localhost:8000
API Docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

ה-Dashboard יעלה ב: http://localhost:3000

## 📊 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - הרשמה
- `POST /api/v1/auth/login` - התחברות
- `GET /api/v1/auth/me` - פרטי משתמש

### Accounts
- `GET /api/v1/accounts` - רשימת חשבונות
- `POST /api/v1/accounts` - צור חשבון
- `DELETE /api/v1/accounts/{id}` - מחק חשבון

### Trades
- `GET /api/v1/trades` - רשימת עסקאות
- `GET /api/v1/trades/chart-data` - נתונים לגרף
- `POST /api/v1/trades` - צור עסקה
- `PUT /api/v1/trades/{id}` - עדכן עסקה

### Upload
- `POST /api/v1/upload` - העלה קובץ CSV
- `GET /api/v1/upload/brokers` - ברוקרים נתמכים

### Statistics
- `GET /api/v1/stats` - סטטיסטיקות מלאות
- `GET /api/v1/stats/daily-pnl` - P&L יומי
- `GET /api/v1/stats/summary` - סיכום מהיר

## 🎨 Stack טכנולוגי

### Backend
- **FastAPI** - Web Framework
- **SQLAlchemy** - ORM (Async)
- **SQLite/PostgreSQL** - Database
- **JWT** - Authentication
- **Pydantic** - Validation

### Frontend
- **Next.js 14** - React Framework
- **TailwindCSS** - Styling
- **TradingView Lightweight Charts** - Charts
- **Zustand** - State Management
- **Recharts** - Additional Charts

## 📈 מטריקות שמחושבות

### ברמת עסקה
- P&L (Gross & Net)
- אחוז רווח/הפסד
- משך העסקה
- R-Multiple

### ברמת תיק
- Win Rate
- Profit Factor
- Average Win/Loss
- Daily/Hourly Performance
- Winning/Losing Streaks

## 🔜 Roadmap

### שלב 3: Trade Replay
- [ ] חיבור ל-Polygon.io API
- [ ] נגן מחדש עסקאות על הגרף
- [ ] סימון נקודות כניסה/יציאה

### שלב 4: Advanced Analytics
- [ ] Behavioral Analysis
- [ ] Pattern Recognition
- [ ] AI-powered Insights

## 📝 רישיון

MIT License

---

נבנה עם ❤️ בישראל
