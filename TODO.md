# Fix NextAuth Import Errors

## Tasks
- [x] Update signIn import in arvan-main/src/app/signin/actions/action.tsx
- [x] Fix LoginSchema import path in arvan-main/src/app/signin/actions/action.tsx
- [x] Update signOut import in arvan-main/src/app/signup/actions/auth-functions.ts
- [x] Fix production authentication errors - RouteError: Unauthorized: No valid token or user found
  - Root cause: Backend was expecting custom JWT tokens but frontend sends NextAuth session tokens
  - Solution: Prioritized NextAuth session token lookup in authentication middleware
  - Changes: Updated authenticateJWT to check session tokens first, then fall back to JWT verification
