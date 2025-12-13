# 🔑 Environment Variables - כל המשתנים הנדרשים

## 📋 רשימה מלאה של Environment Variables

### ✅ חובה (Required)

#### 1. OpenRouter API Key
```
OPENROUTER_API_KEY=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
```
או
```
NEXT_PUBLIC_OPENROUTER_API_KEY=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
```

**שימוש:** AI Trade Review - סקירת עסקאות עם בינה מלאכותית
**איפה:** `/api/ai/review-trade` ו-`/lib/openrouter.ts`
**מקור:** https://openrouter.ai/

---

#### 2. Site URL
```
NEXT_PUBLIC_SITE_URL=https://your-app-name.vercel.app
```

**שימוש:** HTTP Referer headers ל-OpenRouter API
**איפה:** כל הקריאות ל-OpenRouter
**הערה:** יתעדכן אוטומטית אחרי ה-deployment הראשון ב-Vercel

---

### ⚠️ אופציונלי (Optional)

#### 3. JBlanked API Key (Economic Calendar)
```
JBLANKED_API_KEY=your_jblanked_api_key_here
```
או
```
NEXT_PUBLIC_JBLANKED_API_KEY=your_jblanked_api_key_here
```

**שימוש:** Economic Calendar - אירועים כלכליים
**איפה:** `/api/economic-calendar` ו-`/lib/economicCalendarApi.ts`
**מקור:** https://www.jblanked.com/
**הערה:** אם לא מוגדר, Economic Calendar לא יעבוד

---

#### 4. Backend API URL (אם יש backend נפרד)
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

**שימוש:** חיבור ל-backend API (אם יש)
**איפה:** `/lib/api.ts`
**הערה:** כברירת מחדל: `http://localhost:8000/api/v1`

---

## 🔧 הגדרה ב-Vercel

### שלב 1: לך ל-Project Settings
1. לך ל-Vercel Dashboard
2. בחר את ה-Project
3. לחץ על **Settings**
4. לחץ על **Environment Variables**

### שלב 2: הוסף את המשתנים
לכל משתנה:
1. לחץ **Add New**
2. הזן את ה-Name (לדוגמה: `OPENROUTER_API_KEY`)
3. הזן את ה-Value
4. בחר את ה-Environments:
   - ✅ **Production**
   - ✅ **Preview** (אופציונלי)
   - ✅ **Development** (אופציונלי)
5. לחץ **Save**

### שלב 3: Redeploy
אחרי הוספת משתנים חדשים:
1. לך ל-**Deployments**
2. לחץ על ה-3 נקודות ליד ה-deployment האחרון
3. לחץ **Redeploy**

---

## 📝 דוגמה להגדרה מלאה ב-Vercel

```
OPENROUTER_API_KEY=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
NEXT_PUBLIC_OPENROUTER_API_KEY=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
JBLANKED_API_KEY=your_jblanked_key_here
NEXT_PUBLIC_JBLANKED_API_KEY=your_jblanked_key_here
NEXT_PUBLIC_SITE_URL=https://your-app-name.vercel.app
```

---

## 🔒 אבטחה

### ⚠️ חשוב:
- **אל תעלה** את ה-API keys ל-GitHub!
- השתמש ב-**Secrets** ב-Vercel
- `NEXT_PUBLIC_*` משתנים חשופים ב-client-side
- `OPENROUTER_API_KEY` (ללא NEXT_PUBLIC) נשאר ב-server-side

### 🔐 מה חשוף ומה לא:
- ✅ `OPENROUTER_API_KEY` - **לא חשוף** (server-side only)
- ⚠️ `NEXT_PUBLIC_OPENROUTER_API_KEY` - **חשוף** (client-side)
- ✅ `JBLANKED_API_KEY` - **לא חשוף** (server-side only)
- ⚠️ `NEXT_PUBLIC_JBLANKED_API_KEY` - **חשוף** (client-side)

---

## 🧪 בדיקה מקומית (.env.local)

צור קובץ `frontend/.env.local`:

```env
OPENROUTER_API_KEY=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
NEXT_PUBLIC_OPENROUTER_API_KEY=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
JBLANKED_API_KEY=your_jblanked_key_here
NEXT_PUBLIC_JBLANKED_API_KEY=your_jblanked_key_here
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**הערה:** הוסף את `.env.local` ל-`.gitignore` (כבר קיים)

---

## ✅ רשימת בדיקה

לפני deployment, ודא שהוספת:
- [ ] `OPENROUTER_API_KEY` - חובה ל-AI Review
- [ ] `NEXT_PUBLIC_SITE_URL` - חובה ל-OpenRouter
- [ ] `JBLANKED_API_KEY` - אופציונלי ל-Economic Calendar
- [ ] כל המשתנים מוגדרים ב-**Production** environment

---

**מוכן!** עכשיו תוכל להגדיר את כל ה-Environment Variables ב-Vercel 🚀





