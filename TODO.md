# TODO: Fix Authentication Error in Production

## Issue
- Login succeeds but fetching data or adding products fails with "Unauthorized: No valid token or user found"
- Server clock is ahead, causing JWT verification to fail due to future iat timestamps

## Changes Made
- [x] Added custom verifyJWT function to handle clock skew by setting clockTimestamp to max(now, decoded.iat)
- [x] Replaced jwt.verify calls in authenticateJWT with verifyJWT for login token verification
- [x] Replaced jwt.verify calls in fallback JWT decoding with verifyJWT

## Next Steps
- [x] Deploy changes to production
- [ ] Monitor logs for authentication errors
- [ ] If issues persist, consider fixing server clock or adjusting tolerance
