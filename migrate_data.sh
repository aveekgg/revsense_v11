# Data Export Script
# Replace YOUR_OLD_PROJECT_REF with your old project ID
# Replace YOUR_PASSWORD with your database password

# Export data from old project (using PostgreSQL 17 pg_dump to match Supabase server)
/opt/homebrew/opt/postgresql@17/bin/pg_dump 'postgresql://postgres:wFPWIMAe74GGsLf0@db.djskqegnpplmnyrzomri.supabase.co:5432/postgres'   --data-only   --exclude-schema=auth   --exclude-schema=storage   --exclude-schema=realtime   --exclude-schema=supabase_functions   --exclude-schema=extensions   --exclude-schema=graphql   --exclude-schema=graphql_public   --exclude-schema=pgbouncer   --exclude-schema=pgsodium   --exclude-schema=pgsodium_masks   --exclude-schema=vault   -f data_export.sql

# Import data to new project
/opt/homebrew/opt/postgresql@17/bin/psql 'postgresql://postgres:YeUVGaadTJ0O46NO@db.qgtelxfvamsitzrsoiox.supabase.co:5432/postgres' < data_export.sql
