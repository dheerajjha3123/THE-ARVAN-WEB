# TODO: Fix 403 Error in Production After OTP Login

## Problem
In production, after successful OTP login for new users, subsequent requests (like accessing profile or buying) fail with 403 "Unauthorized: No valid token or user found" error. Works fine locally.

## Root Cause
The authenticateJWT middleware was only accepting JWT tokens with type "login", but after OTP verification, the frontend was sending the JWT from the OTP request which has type "verify". This caused authentication to fail even though the user was properly created. Additionally, for new users, the "verify" JWT was generated before the user existed in the database.

## Solution
Modified authenticateJWT to accept both "login" and "verify" type JWT tokens, and ensured users are created during OTP generation for "verify" type to allow authentication.

## Changes Made
- [x] Modified authenticateJWT in globalerrorhandler.ts to accept both "login" and "verify" JWT types
- [x] Modified getOtpByNumber in customers.controller.ts to upsert user for "verify" type OTP requests
- [x] Modified authenticateJWT to prioritize mobile_no lookup for "verify" type JWTs
- [x] This allows the JWT returned from OTP generation (type "verify") to be used for authentication even for new users

## Testing
- Deploy the changes to production
- Test OTP login flow for new user
- Verify profile access and buying work without 403 errors

## Followup
- Monitor production logs for any remaining authentication issues
