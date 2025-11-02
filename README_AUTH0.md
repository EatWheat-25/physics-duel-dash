# Auth0 Integration Setup

This project uses Auth0 for authentication with Supabase for data storage.

## Setup Instructions

### 1. Auth0 Dashboard Configuration

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Create a new application or use existing one
3. Configure the following settings:

**Application URIs:**
- Allowed Callback URLs: `http://localhost:5173/callback`, `https://yourdomain.com/callback`
- Allowed Logout URLs: `http://localhost:5173/auth`, `https://yourdomain.com/auth`
- Allowed Web Origins: `http://localhost:5173`, `https://yourdomain.com`

**Connections:**
- Enable Google (google-oauth2) under Social connections

### 2. Environment Variables

Update your `.env` file with your Auth0 credentials:

```env
VITE_AUTH0_DOMAIN="your-tenant.us.auth0.com"
VITE_AUTH0_CLIENT_ID="your-auth0-client-id"
# VITE_AUTH0_AUDIENCE="https://your-api-identifier"  # Optional, only if you have an Auth0 API
```

**Important Notes:**
- Domain should NOT include `https://` protocol
- Domain format: `dev-xyz.us.auth0.com` or `your-tenant.auth0.com`
- Get these values from your Auth0 Application settings

### 3. Google OAuth Setup in Auth0

1. In Auth0 Dashboard, go to **Authentication > Social**
2. Find Google and click to configure
3. Add your Google OAuth credentials:
   - Get Client ID and Client Secret from [Google Cloud Console](https://console.cloud.google.com/)
   - Configure Google OAuth consent screen
   - Add authorized redirect URI: `https://YOUR_AUTH0_DOMAIN/login/callback`

### 4. Local Development

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` - you should see the Auth page with Google login button.

## How It Works

### Authentication Flow

1. **Login**: User clicks "Continue with Google" → Redirects to Auth0 → Auth0 handles Google OAuth → Returns to `/callback` → Redirects to `/`
2. **User Sync**: When user logs in via Auth0, their profile is automatically created in Supabase `profiles` table
3. **Data Storage**: All user data (profiles, game stats, etc.) stored in Supabase
4. **Session**: Auth0 manages authentication session, Supabase stores user data

### Key Files

- `src/main.tsx` - Auth0Provider wrapper
- `src/contexts/AuthContext.tsx` - Auth integration with Supabase sync
- `src/pages/Auth.tsx` - Login page
- `src/pages/Callback.tsx` - OAuth callback handler

### Protected Routes

To protect a route, use the `useAuth` hook:

```tsx
import { useAuth } from "@/contexts/AuthContext";

function MyComponent() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/auth" />;

  return <div>Protected content</div>;
}
```

## Troubleshooting

### "requested path is invalid" error
- Check Allowed Callback URLs in Auth0 dashboard
- Ensure callback URL matches exactly: `http://localhost:5173/callback`

### Google login not showing
- Verify Google connection is enabled in Auth0 Social connections
- Check Google OAuth credentials are configured

### User not syncing to Supabase
- Check browser console for errors
- Verify Supabase connection in Network tab
- Ensure `profiles` table exists in Supabase

## Production Deployment

1. Add your production domain to Auth0 Allowed URLs
2. Update `.env` with production Auth0 credentials
3. Deploy normally - Auth0 works on both dev and production

## Future Enhancements

- Add Auth0 API (audience) for secure backend API calls
- Implement refresh token rotation
- Add MFA (Multi-Factor Authentication)
- Custom Auth0 login page styling
