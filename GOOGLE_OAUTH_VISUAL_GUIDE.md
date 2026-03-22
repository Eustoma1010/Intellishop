# 🦋 INTELISHOP - GOOGLE OAUTH SETUP VISUAL GUIDE

**Vietnamese Instructions with Visual Steps**

---

## 📱 Frontend: What User Sees

### Before Setup (Not Working ❌)
```
Login Screen
├─ Email field
├─ Password field  
├─ Login button
│
└─ Or login with section
   ├─ [Google]  ← Cannot click
   └─ [Facebook]
```

### After Setup (Working ✅)
```
Login Screen
├─ Email field
├─ Password field  
├─ Login button
│
└─ Or login with section
   ├─ [Google Official Sign-In Widget]  ← Can click
   └─ [Facebook]
```

---

## 🔐 Complete Setup Flow

### FLOW 1: Existing User
```
┌─ User has Gmail account
│
├─ Click "Google" button
│  └─ Google popup shows
│
├─ User selects email & confirms
│  └─ handleGoogleCallback() runs
│
├─ Backend checks: "Is this email in DB?"
│  └─ YES! Email exists
│
├─ Backend returns JWT tokens
│  └─ Frontend saves to localStorage
│
└─ ✅ User logged in
   └─ Redirected to home page
```

### FLOW 2: New User
```
┌─ User has Gmail account but NO Intelishop account
│
├─ Click "Google" button
│  └─ Google popup shows
│
├─ User selects email & confirms
│  └─ handleGoogleCallback() runs
│
├─ Backend checks: "Is this email in DB?"
│  └─ NO! Email not found
│
├─ Backend returns temp_token + redirect to form
│  └─ Frontend shows "Complete Registration" form
│
├─ User enters password (optional for social)
│  └─ Frontend sends to /api/social-complete/
│
├─ Backend creates user + links SocialAccount
│  └─ Returns JWT tokens
│
└─ ✅ User logged in + Account created
   └─ Redirected to home page
```

---

## 🛠️ Step-by-Step Setup

### PHASE 1: Google Cloud Console (10 minutes)

#### Step 1: Create Project
```
URL: https://console.cloud.google.com/

┌─ Click "Select a Project" (top left)
├─ Click "NEW PROJECT"
├─ Project name: "Intelishop"
├─ Click "CREATE"
└─ Wait for creation (~2 mins)
```

#### Step 2: Create OAuth Consent Screen
```
┌─ Left sidebar → "Consent Screen"
├─ Choose "External"
├─ Click "CREATE"
├─ Fill form:
│  ├─ App name: "Intelishop"
│  ├─ User support email: your-email@gmail.com
│  └─ Developer contact: your-email@gmail.com
├─ SAVE AND CONTINUE
├─ SAVE AND CONTINUE (skip optional fields)
└─ BACK TO DASHBOARD
```

#### Step 3: Create OAuth 2.0 Credentials
```
┌─ Left sidebar → "Credentials"
├─ Blue button: "CREATE CREDENTIALS"
├─ Choose: "OAuth 2.0 Client IDs"
├─ Choose: "Web application"
├─ Name: "Intelishop Web"
│
├─ Authorized JavaScript origins:
│  ├─ http://localhost:5500
│  ├─ http://127.0.0.1:5500
│  └─ (Add Vercel URL when deploying)
│
├─ Authorized redirect URIs:
│  ├─ http://localhost:8000/accounts/google/login/callback/
│  ├─ http://127.0.0.1:8000/accounts/google/login/callback/
│  └─ (Add production URL when deploying)
│
├─ Click "CREATE"
└─ ⭐ COPY: Client ID & Client Secret
   └─ Store temporarily (you'll need them next)
```

#### Result:
```
✅ You have:
├─ Google Client ID: xxx-xxx.apps.googleusercontent.com
└─ Google Client Secret: xxxxxxxxxxxxx
```

---

### PHASE 2: Backend Configuration (5 minutes)

#### Step 4: Create/Update .env File
```
Directory: D:\Self\WorkSpace\Web\Intelishop\intelishop_backend\

┌─ If .env doesn't exist:
│  └─ Copy .env.example to .env
│
└─ Edit .env and add:

   GOOGLE_OAUTH_CLIENT_ID=xxx-xxx.apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=xxxxxxxxxxxxx
   FRONTEND_URL=http://localhost:5500

   (Don't change other variables)

Save file ✅
```

#### Step 5: Run Backend
```
PowerShell:

┌─ cd D:\Self\WorkSpace\Web\Intelishop\intelishop_backend
├─ venv\Scripts\Activate.ps1  (or source venv/bin/activate)
├─ pip install -r requirements.txt  (if not done yet)
├─ python manage.py migrate  (if not done yet)
└─ python manage.py runserver

✅ Backend running at http://127.0.0.1:8000/
```

#### Step 6: Django Admin Configuration
```
URL: http://127.0.0.1:8000/admin/

┌─ Login with your superuser account
│
├─ Go to: Django > SITES
│  ├─ Click "example.com"
│  ├─ Domain name: localhost:8000
│  ├─ Display name: Intelishop
│  ├─ SAVE
│  └─ ✅ Done
│
└─ Go to: Social Accounts > Social applications
   ├─ Click "+ ADD SOCIAL APPLICATION"
   ├─ Provider: Google (dropdown)
   ├─ Name: Google OAuth
   ├─ Client id: [Paste from Google Cloud]
   ├─ Secret key: [Paste from Google Cloud]
   ├─ Sites: Check ✓ "localhost:8000"
   ├─ SAVE
   └─ ✅ Done
```

---

### PHASE 3: Frontend Configuration (2 minutes)

#### Step 7: Update HTML File
```
File: D:\Self\WorkSpace\Web\Intelishop\intelishop_frontend\index.html

┌─ Find section (near end of file):
│  ┌─ <!-- ========== GOOGLE OAUTH SDK ========== -->
│  └─ client_id: 'YOUR_GOOGLE_CLIENT_ID_HERE'
│
├─ Replace 'YOUR_GOOGLE_CLIENT_ID_HERE' with:
│  └─ Your actual Client ID from Google Cloud
│     Example: '717682002366-8ivvapiplm9m674j4c67ti5sbt9245rl.apps.googleusercontent.com'
│
└─ Save file ✅

(Optional: Update Facebook App ID in the same file)
```

---

### PHASE 4: Testing (5 minutes)

#### Step 8: Run Frontend
```
Option A: VS Code Live Server
├─ Right-click index.html
├─ "Open with Live Server"
└─ Browser opens to http://localhost:5500/

Option B: Python Server
├─ cd intelishop_frontend
├─ python -m http.server 5500
└─ Browser opens to http://localhost:5500/
```

#### Step 9: Test Login Flow
```
Web Browser:

┌─ Go to http://localhost:5500/
├─ Click "Đăng Nhập" button
├─ You see Google button on login page
├─ Click Google button
│  └─ Official Google Sign-In popup appears ✅
├─ Select your Gmail account
├─ Click "Continue" in popup
│  └─ Popup closes ✅
└─ You're logged into Intelishop ✅

Verification:
├─ Check localStorage (F12 → Application → Storage)
│  └─ Should have 'access_token' ✅
├─ Go to http://127.0.0.1:8000/admin/users/
│  └─ Your account should appear ✅
└─ Go back to frontend → should see "Logout" ✅
```

---

## 🧪 Verification Checklist

After setup, verify everything works:

```
Frontend Check:
├─ □ Can see Google button on login page
├─ □ Button is clickable
├─ □ Clicking shows Google Sign-In popup
├─ □ Can select Gmail account
├─ □ After selection, redirected to home
└─ □ Can click profile icon (logged in)

Backend Check:
├─ □ No errors in Django terminal
├─ □ /api/social-check/ works (can test in Postman)
├─ □ /api/social-complete/ works
├─ □ Social Application in Django Admin
└─ □ User created in Users table

Browser Check:
├─ □ F12 Console: No JavaScript errors
├─ □ F12 Network: /api/social-check/ returns 200
├─ □ F12 Application: localStorage has access_token
└─ □ F12 Application: localStorage has refresh_token
```

---

## 🐛 Common Issues & Fixes

### ❌ Issue 1: Google button looks broken/wrong
```
❌ Problem:
   - Button doesn't show properly
   - Button text instead of Google official button

✅ Solution:
   1. Check browser console (F12) for Google SDK errors
   2. Verify Client ID is correct in index.html
   3. Clear browser cache (Ctrl+Shift+Del)
   4. Reload page
```

### ❌ Issue 2: Clicking button does nothing
```
❌ Problem:
   - Button not responding to clicks

✅ Solution:
   1. F12 Console → check for JavaScript errors
   2. Verify 'handleGoogleCallback' function exists in auth.js
   3. Check network tab → is Google loading?
   4. Make sure Google SDK loaded: chrome type "google.accounts" in console
```

### ❌ Issue 3: Popup error "origin not allowed"
```
❌ Problem:
   - Popup closed or error about origin

✅ Solution:
   1. Go to Google Cloud Console
   2. Credentials → OAuth 2.0 Client IDs
   3. Check "Authorized JavaScript origins" includes:
      - http://localhost:5500
      - http://127.0.0.1:5500
   4. If missing, add it and save
   5. Wait ~5 minutes for change to take effect
   6. Try again
```

### ❌ Issue 4: Django error about unknown domain
```
❌ Problem:
   - Django error: "No Site matches the given query"

✅ Solution:
   1. Go to http://127.0.0.1:8000/admin/sites/site/
   2. Click "example.com"
   3. Change "Domain name" to: localhost:8000
   4. Save
   5. Try login again
```

### ❌ Issue 5: Email not being shared
```
❌ Problem:
   - Google account selected but email not sent to backend

✅ Solution:
   1. Click Google button again
   2. When popup shows, check permissions
   3. Grant "See your email address" permission
   4. If prompted, click "Allow"
   5. Complete login
```

---

## 📞 Need Help?

| Question | Answer |
|----------|--------|
| **Where do I get credentials?** | Google Cloud Console: https://console.cloud.google.com/ |
| **What's my Client ID?** | Credentials → OAuth 2.0 Client IDs → Copy Client ID |
| **How to fix "not allowed" error?** | Add localhost URLs to "Authorized JavaScript origins" |
| **Backend error - which URL to use?** | http://localhost:8000/accounts/google/login/callback/ |
| **Does it work with production?** | Yes! Update Google Cloud URLs and .env for production |

---

## 🎯 Success! 

When everything works:
```
┌─ User can login with Google ✅
├─ New accounts auto-created ✅
├─ JWT tokens stored ✅
├─ User profile accessible ✅
└─ Can logout and login again ✅
```

---

**Happy coding! 🚀**

Last Updated: March 19, 2026

