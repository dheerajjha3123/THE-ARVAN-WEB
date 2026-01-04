# TODO: Fix 403 Error in Production After OTP Login

## Problem
In production, after successful OTP login for new users, subsequent requests (like accessing profile or buying) fail with 403 "Unauthorized: No valid token or user found" error. Works fine locally.

## Root Cause
Database replication lag in production causes the authenticateJWT middleware to fail finding the newly created user by ID, as the user record hasn't synced to the read replica yet.

## Solution
Added fallback in authenticateJWT to find user by mobile_no if not found by id. Since mobile_no is unique and present in the JWT, this ensures the user is found even during sync delays.

## Changes Made
- [x] Modified authenticateJWT in globalerrorhandler.ts to add fallback lookup by mobile_no when id lookup fails
- [x] Added fallback in both places where user is looked up by id from JWT

## Testing
- Deploy the changes to production
- Test OTP login flow for new user
- Verify profile access and buying work without 403 errors

## Followup
- Monitor production logs for any remaining authentication issues
- If issues persist, consider forcing reads from master database for critical auth operations
