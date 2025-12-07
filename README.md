# 🚀 TradeTracker - AI-Powered Trading Journal & Analytics Platform

פלטפורמת SaaS מקצועית לניתוח עסקאות מסחר בסגנון TradeZella עם בינה מלאכותית.

![Dashboard Preview](https://github.com/arielSofer/aiTradeReports)

## ✨ תכונות עיקריות

### 📊 Dashboard & Analytics
- **Equity Curve** - גרף עקומת ההון המצטבר
- **Trading Calendar** - לוח שנה עם P&L יומי
- **Hourly Heatmap** - ביצועים לפי שעות ביום
- **Advanced Statistics** - Win Rate, Profit Factor, R-Multiple ועוד
- **Symbol Performance** - ביצועים לפי סמלים
- **Direction Analysis** - ניתוח Long vs Short

### 🤖 AI Trade Review
- **AI-Powered Analysis** - סקירת עסקאות עם בינה מלאכותית
- **Multi-Timeframe Charts** - גרפים ב-3 timeframes (5min, 15min, 1h)
- **Candlestick Charts** - נרות יפנים מקצועיים
- **Entry/Exit Markers** - סימון נקודות כניסה ויציאה
- **Hebrew Reviews** - סקירות מפורטות בעברית

### 📥 Data Import
- **Multiple Brokers** - תמיכה בברוקרים מרובים:
  - Interactive Brokers
  - MetaTrader 4/5
  - Binance
  - NinjaTrader 8
  - Tradovate
  - TopstepX (URL import)
- **CSV Upload** - העלאת קבצי CSV
- **Manual Entry** - הוספת עסקאות ידנית
- **TopstepX Integration** - ייבוא ישיר מ-TopstepX

### 📅 Economic Calendar
- **Real-time Events** - אירועים כלכליים בזמן אמת
- **JBlanked API Integration** - חיבור ל-JBlanked News API
- **Custom Events** - הוספת אירועים מותאמים אישית
- **Filtering** - סינון לפי השפעה, קטגוריה, מטבע
- **Caching** - שמירה במטמון ל-24 שעות

### 🔐 Authentication & Security
- **Firebase Authentication** - התחברות עם Email/Password או Google
- **Protected Routes** - הגנה על דפים
- **User Management** - ניהול משתמשים
- **Account Management** - ניהול תיקי מסחר מרובים

### 📈 Trade Journal
- **Trade Table** - טבלת עסקאות מפורטת
- **Trade Details** - פרטי עסקה מלאים
- **Tags & Notes** - תגיות והערות
- **Trade Deletion** - מחיקת עסקאות
- **Filtering & Sorting** - סינון ומיון

## 🛠️ Stack טכנולוגי

### Backend
- **Python 3.11+**
- **FastAPI** - Web Framework
- **SQLAlchemy** - ORM
- **Pydantic** - Validation
- **JWT** - Authentication

### Frontend
- **Next.js 14** - React Framework (App Router)
- **TypeScript** - Type Safety
- **TailwindCSS** - Styling
- **TradingView Lightweight Charts** - Professional Charts
- **Recharts** - Additional Charts
- **Zustand** - State Management
- **Firebase** - Authentication & Firestore

### AI & APIs
- **OpenRouter** - AI API (Gemini 2.0 Flash)
- **JBlanked News API** - Economic Calendar
- **html2canvas** - Chart Screenshots

## 🚀 התקנה והרצה

### דרישות מוקדמות
- Python 3.11+
- Node.js 18+
- npm או yarn

### 1. Clone את ה-Repository

```bash
git clone https://github.com/arielSofer/aiTradeReports.git
cd aiTradeReports
```

### 2. Backend Setup

```bash
# יצירת virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# או
venv\Scripts\activate  # Windows

# התקנת dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

### 4. Firebase Configuration

צור קובץ `frontend/src/lib/firebase/config.ts` עם ההגדרות שלך:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  // ...
}
```

### 5. Environment Variables

צור קובץ `.env.local` ב-`frontend/`:

```env
OPENROUTER_API_KEY=your_openrouter_api_key
JBLANKED_API_KEY=your_jblanked_api_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 6. הרצת השרתים

**Backend:**
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm run dev
```

האפליקציה תהיה זמינה ב: http://localhost:3000

## 🌐 העלאה לאינטרנט

להעלאה לאינטרנט (Vercel/Netlify), עיין ב-[DEPLOYMENT.md](./DEPLOYMENT.md) להוראות מפורטות.

**הדרך המהירה ביותר:**
1. לך ל-https://vercel.com
2. היכנס עם GitHub
3. בחר את ה-repository `arielSofer/aiTradeReports`
4. הגדר Root Directory: `frontend`
5. הוסף Environment Variables
6. לחץ Deploy!

## 📖 שימוש

### ייבוא עסקאות

1. **CSV Upload:**
   - לחץ על "Import Trades"
   - בחר קובץ CSV
   - המערכת תזהה אוטומטית את סוג הברוקר

2. **TopstepX:**
   - לחץ על "Import Trades"
   - בחר "TopstepX"
   - הזן URL או הדבק HTML

3. **Manual Entry:**
   - לחץ על "+" בכותרת
   - מלא את פרטי העסקה

### AI Trade Review

1. פתח עסקה סגורה מטבלת העסקאות
2. לחץ על כפתור ה-AI (✨)
3. המערכת תיצור 3 גרפים (5min, 15min, 1h)
4. קבל סקירה מפורטת בעברית מה-AI

### Economic Calendar

1. עבור לדף הראשי
2. גלול ל-Economic Calendar
3. צפה באירועים כלכליים
4. הוסף אירועים מותאמים אישית

## 📊 מטריקות

### ברמת עסקה
- P&L (Gross & Net)
- אחוז רווח/הפסד
- משך העסקה
- R-Multiple

### ברמת תיק
- Win Rate
- Profit Factor
- Average Win/Loss
- Largest Winner/Loser
- Daily/Hourly Performance
- Winning/Losing Streaks

## 🔒 אבטחה

- כל הנתונים מוצפנים ב-Firebase
- Authentication עם JWT tokens
- Protected routes
- Input validation

## 🤝 תרומה

תרומות מתקבלות בברכה! אנא פתח Pull Request או Issue.

## 📝 רישיון

MIT License

## 🙏 תודות

- [TradingView Lightweight Charts](https://www.tradingview.com/lightweight-charts/)
- [OpenRouter](https://openrouter.ai/)
- [JBlanked](https://www.jblanked.com/)

---

נבנה עם ❤️ בישראל

**GitHub:** https://github.com/arielSofer/aiTradeReports
