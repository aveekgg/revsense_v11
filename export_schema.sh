#!/bin/bash

# Schema Export Script for Supabase Free Plan
# This script exports your database schema using pg_dump

echo "🔍 Supabase Schema Export Tool"
echo "================================"
echo ""

# Get database password
echo "📝 You'll need your database password from:"
echo "   https://supabase.com/dashboard/project/djskqegnpplmnyrzomri/settings/database"
echo ""
read -sp "Enter your database password: " DB_PASSWORD
echo ""
echo ""

# Connection string - Use DIRECT connection, not pooler
DB_HOST="db.djskqegnpplmnyrzomri.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"
CONNECTION_STRING="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

echo "🚀 Exporting schema..."
echo ""

# Export schema only (no data)
# Using PostgreSQL 17 client to match Supabase server version 17.6
/opt/homebrew/opt/postgresql@17/bin/pg_dump "$CONNECTION_STRING" \
  --schema-only \
  --no-owner \
  --no-acl \
  --exclude-schema=auth \
  --exclude-schema=storage \
  --exclude-schema=realtime \
  --exclude-schema=supabase_functions \
  --exclude-schema=extensions \
  --exclude-schema=graphql \
  --exclude-schema=graphql_public \
  --exclude-schema=pgbouncer \
  --exclude-schema=pgsodium \
  --exclude-schema=pgsodium_masks \
  --exclude-schema=vault \
  -f supabase/schema_export.sql

if [ $? -eq 0 ]; then
  echo "✅ Schema exported successfully!"
  echo ""
  echo "📄 File saved to: supabase/schema_export.sql"
  echo ""
  echo "📊 Summary:"
  echo "   - Tables: $(grep -c 'CREATE TABLE' supabase/schema_export.sql || echo '0')"
  echo "   - Functions: $(grep -c 'CREATE FUNCTION' supabase/schema_export.sql || echo '0')"
  echo "   - Policies: $(grep -c 'CREATE POLICY' supabase/schema_export.sql || echo '0')"
  echo ""
  echo "🎯 Next steps:"
  echo "   1. Review the file: code supabase/schema_export.sql"
  echo "   2. Create your new Supabase project"
  echo "   3. Run this SQL in the new project's SQL Editor"
else
  echo "❌ Export failed!"
  echo ""
  echo "💡 Troubleshooting:"
  echo "   - Check your database password"
  echo "   - Verify you have network access to Supabase"
  echo "   - Try the SQL Editor method in QUICK_SCHEMA_EXPORT.md"
fi
