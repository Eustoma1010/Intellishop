# 🔐 Google OAuth Integration - Complete Documentation

**Status:** ✅ Complete & Ready to Use  
**Date:** March 19, 2026  
**Version:** 1.0

---

## 📚 Documentation Map

Choose the guide that fits your needs:

### 🚀 **Just want to get it working?**
👉 Start here: **`GOOGLE_OAUTH_QUICK_START.md`**
- 5-minute setup
- Copy-paste configuration
- Direct instructions

### 📖 **Need detailed step-by-step?**
👉 Read this: **`GOOGLE_LOGIN_SETUP.md`**
- 25 detailed steps
- Screenshots for each step
- Troubleshooting section
- Production deployment guide

### 🎨 **Want visual explanation?**
👉 Check this: **`GOOGLE_OAUTH_VISUAL_GUIDE.md`**
- Flow diagrams
- ASCII art guides
- Common issues with visual fixes
- Testing checklist

### 📋 **Need the summary?**
👉 Review this: **`GOOGLE_OAUTH_IMPLEMENTATION_SUMMARY.md`**
- What was changed
- Files modified
- Configuration needed
- Success criteria

### 🔧 **Need template/examples?**
👉 Use this: **`.env.example`**
- All required environment variables
- Template for configuration
- Links to get credentials

---

## ⚡ 30-Second Quick Start

```bash
# 1. Get Google Credentials (5 min)
Go to: https://console.cloud.google.com/
Create OAuth 2.0 credentials
Copy Client ID & Secret

# 2. Update Backend (2 min)
Edit: intelishop_backend/.env
Add: GOOGLE_OAUTH_CLIENT_ID=xxx
Add: GOOGLE_OAUTH_CLIENT_SECRET=xxx

# 3. Setup Django Admin (2 min)
http://127.0.0.1:8000/admin/
Add Social Application with Google

# 4. Update Frontend (1 min)
Edit: intelishop_frontend/index.html
Replace: YOUR_GOOGLE_CLIENT_ID_HERE
With: Your actual Client ID

# 5. Test (2 min)
Run backend & frontend
Click "Đăng Nhập" → Click Google → Login ✅
```

---

## 🔄 What Changed in the Code

### Backend
```python
# Before: Hardcoded localhost
class GoogleLogin(SocialLoginView):
    callback_url = "http://localhost:63342"

# After: Uses environment variable
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5500')
class GoogleLogin(SocialLoginView):
    callback_url = f"{FRONTEND_URL}/"
```

### Frontend
```html
<!-- Before: Non-functional button -->
<button class="pointer-events-none">
    <i class="fa-brands fa-google"></i> Google
</button>

<!-- After: Official Google Sign-In -->
<div class="g_id_signin"></div>
<script>
  google.accounts.id.initialize({
    client_id: 'YOUR_GOOGLE_CLIENT_ID_HERE',
    callback: handleGoogleCallback
  });
  google.accounts.id.renderButton(
    document.querySelector('.g_id_signin'),
    { theme: 'outline', size: 'large' }
  );
</script>
```

---

## 📊 Files & What They Do

| File | Purpose | Action |
|------|---------|--------|
| `GOOGLE_OAUTH_QUICK_START.md` | Quick 5-min setup | Start here first |
| `GOOGLE_LOGIN_SETUP.md` | Complete 25-step guide | Detailed reference |
| `GOOGLE_OAUTH_VISUAL_GUIDE.md` | Visual explanations | Learn with diagrams |
| `GOOGLE_OAUTH_IMPLEMENTATION_SUMMARY.md` | Technical summary | Code changes review |
| `.env.example` | Configuration template | Copy to .env |
| `SETUP_GOOGLE_OAUTH.sh` | Auto setup script | Linux/Mac automation |
| `intelishop_backend/.env` | Your actual config | Fill with credentials |
| `intelishop_frontend/index.html` | Frontend code | Update Client ID |
| `intelishop_backend/config/urls.py` | Backend URLs | Already updated |

---

## ✅ Setup Verification

After setup, test with this checklist:

```
Authentication Flow:
├─ □ Login page shows Google button
├─ □ Clicking button opens Google popup
├─ □ Can select Gmail account
├─ □ Popup closes after selection
├─ □ Redirected to home page logged in

Database:
├─ □ New user created in Django Admin
├─ □ SocialAccount linked to user
├─ □ Can login again with same Google account

Frontend:
├─ □ JWT tokens in browser localStorage
├─ □ User profile menu visible
├─ □ Cart and purchases work
└─ □ Can logout and login again

Backend:
├─ □ No Django errors in terminal
├─ □ /api/social-check/ endpoint works
├─ □ /api/social-complete/ endpoint works
└─ □ Logs show successful social auth
```

---

## 🚀 Production Deployment

When ready for production:

```env
# Update .env on production server

DEBUG=False
ALLOWED_HOSTS=intelishop-backend.onrender.com
FRONTEND_URL=https://intelishop-frontend.vercel.app
GOOGLE_OAUTH_CLIENT_ID=production-client-id
GOOGLE_OAUTH_CLIENT_SECRET=production-secret

# Also update in Google Cloud Console:
# - Authorized JavaScript origins
# - Authorized redirect URIs
```

---

## 🆘 Quick Troubleshooting

| Error | Fix |
|-------|-----|
| "Origin not allowed" | Add localhost URLs to Google Cloud Console |
| "Domain mismatch" | Update Django SITES to 'localhost:8000' |
| "Button not showing" | Check Client ID in HTML, clear cache |
| "Callback URL error" | Verify redirect URI in Google Cloud |
| "Email not shared" | User needs to grant email permission |

For more: See **`GOOGLE_OAUTH_QUICK_START.md`** section "❌ Sự cố"

---

## 🎯 How It Works (Simple)

```
1. User clicks "Google" button
   ↓
2. Google popup shows
   ↓
3. User picks Gmail account
   ↓
4. Frontend gets JWT token from backend
   ↓
5. User is logged in ✅
```

---

## 🔐 Security Features

✅ Already implemented:
- JWT tokens (1 day expiry)
- Social accounts properly linked
- Temp tokens (15 min expiry)
- Environment variables for secrets
- CORS properly configured

---

## 📞 Support Workflow

**If you get stuck:**

1. Check the **Quick Start** guide first (5 min)
2. If still confused, check the **Detailed Setup** guide (30 min)
3. If error occurs, check **Visual Guide** troubleshooting (10 min)
4. If still stuck, review **Implementation Summary** (5 min)

---

## ✨ What You Get

After completing setup:
- ✅ Users can login with Google
- ✅ New users auto-registered
- ✅ Existing users auto-linked
- ✅ JWT tokens managed automatically
- ✅ Profile data available
- ✅ Logout works correctly
- ✅ Ready for production

---

## 🎓 Learning Resources

- [Google Identity Services](https://developers.google.com/identity)
- [Django-allauth Documentation](https://django-allauth.readthedocs.io/)
- [JWT Authentication](https://jwt.io/)
- [OAuth 2.0 Basics](https://oauth.net/2/)

---

## 📝 Next Steps

1. **Immediate (Today):**
   - Read `GOOGLE_OAUTH_QUICK_START.md`
   - Get Google credentials
   - Update .env file
   - Test locally

2. **Short-term (This week):**
   - Deploy to production
   - Monitor for errors
   - Optimize if needed

3. **Future (Optional):**
   - Add Facebook complete integration
   - Add GitHub login
   - Profile picture sync
   - User data enrichment

---

## 📢 Important Notes

⚠️ **Remember:**
- Client ID is public (OK in frontend HTML)
- Client Secret must be kept private (use .env only)
- Never commit .env to GitHub
- Different credentials for dev/production
- Test thoroughly before deploying

---

## 🎉 Success Criteria

You're done when:
```
✅ User clicks "Đăng Nhập"
✅ User sees Google button
✅ Clicking shows Google popup
✅ User logs in with Gmail
✅ User redirected to home page
✅ Dashboard shows logged in state
✅ Can logout and login again
✅ Django Admin shows new user created
```

---

**Ready to get started? 👉 Open `GOOGLE_OAUTH_QUICK_START.md` now!**

---

**Documentation Version:** 1.0  
**Last Updated:** March 19, 2026  
**Created by:** AI Assistant  
**Status:** ✅ Production Ready

