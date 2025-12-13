# 🚀 הגדרת GitHub Pages

## שלב 1: הפעלת GitHub Pages

1. לך ל-GitHub repository: https://github.com/arielSofer/aiTradeReports
2. לחץ על **Settings**
3. גלול ל-**Pages** (בסיידבר השמאלי)
4. תחת **Source**, בחר:
   - **Branch:** `main`
   - **Folder:** `/ (root)`
5. לחץ **Save**

## שלב 2: הפעלת GitHub Actions

1. ב-Settings, לך ל-**Actions** > **General**
2. תחת **Workflow permissions**, בחר:
   - ✅ **Read and write permissions**
   - ✅ **Allow GitHub Actions to create and approve pull requests**
3. לחץ **Save**

## שלב 3: הגדרת Environment Variables

1. לך ל-Settings > **Secrets and variables** > **Actions**
2. הוסף את ה-Secrets הבאים:
   - `NEXT_PUBLIC_OPENROUTER_API_KEY` - מפתח OpenRouter API
   - `NEXT_PUBLIC_JBLANKED_API_KEY` - מפתח JBlanked API (אופציונלי)
   - `NEXT_PUBLIC_SITE_URL` - URL של האתר (יתעדכן אוטומטית)

## שלב 4: הפעלת ה-Workflow

1. לך ל-**Actions** tab ב-GitHub
2. לחץ על **Deploy to GitHub Pages**
3. לחץ **Run workflow** > **Run workflow**
4. המתן 2-3 דקות

## שלב 5: גישה לאתר

האתר יהיה זמין ב:
**https://arielsofer.github.io/aiTradeReports**

---

## ⚠️ הערות חשובות

1. **API Routes לא יעבדו** - API routes הועברו ל-client-side
2. **Environment Variables** - ודא שהוספת את כל ה-API keys
3. **Firebase** - ודא שה-Firebase rules מאפשרים גישה מ-github.io domain
4. **Base Path** - האתר משתמש ב-base path `/aiTradeReports`

---

## 🔄 Deployment אוטומטי

כל push ל-`main` branch יעלה אוטומטית את האתר!





