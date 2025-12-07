# 🚀 הוראות העלאה לאינטרנט

## אפשרות 1: Vercel (מומלץ - הכי קל ל-Next.js)

### שלב 1: הרשמה ל-Vercel
1. לך ל-https://vercel.com
2. היכנס עם GitHub account שלך
3. לחץ על "Add New Project"

### שלב 2: חיבור ל-GitHub Repository
1. בחר את ה-repository: `arielSofer/aiTradeReports`
2. Vercel יזהה אוטומטית שזה Next.js project

### שלב 3: הגדרת Environment Variables
הוסף את המשתנים הבאים ב-Vercel Dashboard:

```
OPENROUTER_API_KEY=your_openrouter_api_key
JBLANKED_API_KEY=your_jblanked_api_key
NEXT_PUBLIC_SITE_URL=https://your-app-name.vercel.app
```

### שלב 4: הגדרת Build Settings
- **Framework Preset:** Next.js
- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `.next`

### שלב 5: Deploy!
לחץ על "Deploy" והאפליקציה תהיה online תוך דקות!

---

## אפשרות 2: Netlify

### שלב 1: הרשמה ל-Netlify
1. לך ל-https://netlify.com
2. היכנס עם GitHub account

### שלב 2: New site from Git
1. בחר "Add new site" > "Import an existing project"
2. בחר את ה-repository
3. הגדר:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`

### שלב 3: Environment Variables
הוסף את המשתנים ב-Site settings > Environment variables

---

## אפשרות 3: GitHub Pages (לא מומלץ ל-Next.js)

Next.js לא עובד טוב עם GitHub Pages כי צריך static export.
אם אתה רוצה להשתמש בזה, צריך להוסיף `output: 'export'` ל-`next.config.js`.

---

## 🔧 הגדרות נוספות

### Firebase Configuration
ודא שהקובץ `frontend/src/lib/firebase/config.ts` מכיל את ההגדרות הנכונות:
- Firebase project שלך
- API keys
- Auth domain

### Custom Domain
ב-Vercel/Netlify תוכל להוסיף domain מותאם אישית:
1. לך ל-Domain settings
2. הוסף את ה-domain שלך
3. עקוב אחר ההוראות ל-DNS setup

---

## 📝 הערות חשובות

1. **Environment Variables** - אל תשכח להוסיף את כל ה-API keys ב-Vercel/Netlify
2. **Firebase Rules** - ודא שה-Firestore rules מאפשרים גישה
3. **CORS** - אם יש בעיות CORS, ודא שה-origins נכונים ב-Firebase
4. **Build Errors** - אם יש שגיאות build, בדוק את ה-logs ב-Vercel/Netlify dashboard

---

## 🎉 אחרי ה-Deployment

האפליקציה תהיה זמינה ב:
- Vercel: `https://your-app-name.vercel.app`
- Netlify: `https://your-app-name.netlify.app`

כל push ל-`main` branch יעלה אוטומטית את האפליקציה!

