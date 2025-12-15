-- Database setup script for Arvan production deployment
-- Run this script as PostgreSQL superuser

-- Create database
CREATE DATABASE arvan_db;

-- Create user for the application
CREATE USER arvan_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE arvan_db TO arvan_user;

-- Connect to the database and set up permissions
\c arvan_db;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO arvan_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO arvan_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO arvan_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO arvan_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO arvan_user;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Optional: Create a backup user
-- CREATE USER arvan_backup WITH ENCRYPTED PASSWORD 'backup_password_here';
-- GRANT CONNECT ON DATABASE arvan_db TO arvan_backup;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO arvan_backup;
