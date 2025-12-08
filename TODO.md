# TODO: Fix Authentication Error in Production

## Completed Tasks
- [x] Analyze the authentication error: "Unauthorized: No valid token or user found" occurring on GET /backend/api/customers in Vercel and Render.
- [x] Identify root cause: Cross-domain cookie sharing issue between Vercel (frontend) and Render (backend).
- [x] Modify `arvan-main/src/auth.config.ts` to configure NextAuth cookies with `sameSite: 'none'` and `secure: true` to allow cross-domain requests.

## Pending Tasks
- [ ] Deploy the updated frontend code to Vercel.
- [ ] Test the authentication on the production environment to ensure the error is resolved.
- [ ] If issues persist, verify that NEXTAUTH_SECRET and AUTH_SECRET are consistent between frontend and backend environments.
