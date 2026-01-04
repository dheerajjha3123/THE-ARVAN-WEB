# TODO: Fix 403 Error in Production After OTP Login

## Problem
In production, after successful OTP login for new users, subsequent requests (like accessing profile or buying) fail with 403 "Unauthorized: No valid token or user found" error. Works fine locally.

## Root Cause
The authenticateJWT middleware was only accepting JWT tokens with type "login", but after OTP verification, the frontend was sending the JWT from the OTP request which has type "verify". This caused authentication to fail even though the user was properly created.

## Solution
Modified authenticateJWT to accept both "login" and "verify" type JWT tokens, since both represent authenticated users.

## Changes Made
- [x] Modified authenticateJWT in globalerrorhandler.ts to accept both "login" and "verify" JWT types
- [x] This allows the JWT returned from OTP verification (type "verify") to be used for authentication

## Testing
- Deploy the changes to production
- Test OTP login flow for new user
- Verify profile access and buying work without 403 errors

## Followup
- Monitor production logs for any remaining authentication issues
