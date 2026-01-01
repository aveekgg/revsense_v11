--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS supabase_migrations;


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: execute_ddl(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.execute_ddl(p_ddl_statement text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Validate input
  IF p_ddl_statement IS NULL OR TRIM(p_ddl_statement) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DDL statement cannot be null or empty'
    );
  END IF;

  -- Log the DDL (visible in Supabase logs - first 500 chars)
  RAISE NOTICE 'Executing DDL (first 500 chars): %', LEFT(p_ddl_statement, 500);
  
  -- Execute the DDL statement
  BEGIN
    EXECUTE p_ddl_statement;
    
    RAISE NOTICE 'DDL executed successfully';
    
    -- Return success
    RETURN jsonb_build_object('success', true);
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the full error
      RAISE WARNING 'DDL execution failed - SQLSTATE: %, SQLERRM: %', SQLSTATE, SQLERRM;
      
      -- Return detailed error
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', SQLSTATE,
        'hint', CASE 
          WHEN SQLSTATE = '42P07' THEN 'Object already exists'
          WHEN SQLSTATE = '42703' THEN 'Column does not exist'
          WHEN SQLSTATE = '42P01' THEN 'Table does not exist'
          WHEN SQLSTATE = '42501' THEN 'Permission denied'
          WHEN SQLSTATE = '42601' THEN 'Syntax error in SQL'
          ELSE 'Check SQL syntax and permissions'
        END
      );
  END;
END;
$$;


--
-- Name: execute_safe_query(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.execute_safe_query(query_text text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  result JSONB;
  normalized_query TEXT;
BEGIN
  -- Handle NULL input
  IF query_text IS NULL OR TRIM(query_text) = '' THEN
    RETURN jsonb_build_object(
      'error', 'Query cannot be null or empty'
    );
  END IF;

  -- Normalize the query for validation (trim and uppercase)
  normalized_query := UPPER(TRIM(query_text));
  
  -- Allow SELECT and WITH (for CTEs)
  IF NOT (normalized_query LIKE 'SELECT%' OR normalized_query LIKE 'WITH%') THEN
    RETURN jsonb_build_object(
      'error', 'Only SELECT queries (with optional WITH clauses) are allowed',
      'details', 'Query must start with SELECT or WITH'
    );
  END IF;
  
  -- Check for dangerous keywords that could modify data
  IF normalized_query ~ '(DELETE|INSERT|UPDATE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)' THEN
    RETURN jsonb_build_object(
      'error', 'Query contains forbidden operations',
      'details', 'Only SELECT queries are permitted'
    );
  END IF;
  
  -- Execute the query and convert results to JSON
  BEGIN
    EXECUTE format('SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t', query_text) INTO result;
    
    -- Handle empty results
    IF result IS NULL THEN
      result := '[]'::jsonb;
    END IF;
    
    RETURN result;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'error', 'Query execution failed',
        'details', SQLERRM,
        'sqlstate', SQLSTATE
      );
  END;
END;
$$;


--
-- Name: get_table_columns(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_table_columns(p_table_name text) RETURNS TABLE(column_name text, data_type text, is_nullable text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' 
    AND t.table_name = p_table_name
  ) THEN
    -- Return empty result for non-existent tables (not an error)
    RAISE NOTICE 'Table % does not exist, returning empty result', p_table_name;
    RETURN;
  END IF;

  -- Return columns excluding system columns
  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT
  FROM information_schema.columns c
  WHERE c.table_name = p_table_name
    AND c.table_schema = 'public'
    AND c.column_name NOT IN ('id', 'user_id', 'source_workbook', 'source_mapping_id', 'extracted_at')
  ORDER BY c.ordinal_position;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;


--
-- Name: sanitize_table_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sanitize_table_name(p_name text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Handle NULL or empty input
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RAISE EXCEPTION 'Table name cannot be null or empty';
  END IF;
  
  -- Return sanitized name: lowercase, replace special chars with underscores
  RETURN lower(regexp_replace(p_name, '[^a-zA-Z0-9_]', '_', 'g'));
END;
$$;


--
-- Name: test_cross_user_access(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.test_cross_user_access() RETURNS TABLE(test_name text, result text, details text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  schema_count INTEGER;
  clean_data_count INTEGER;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Test 1: Schema access
  BEGIN
    SELECT COUNT(*) INTO schema_count FROM public.schemas;
    RETURN QUERY SELECT 'schemas_access'::TEXT, 'SUCCESS'::TEXT, format('Found %s schemas', schema_count)::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'schemas_access'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;
  
  -- Test 2: Clean data access  
  BEGIN
    SELECT COUNT(*) INTO clean_data_count FROM public.clean_data;
    RETURN QUERY SELECT 'clean_data_access'::TEXT, 'SUCCESS'::TEXT, format('Found %s clean data records', clean_data_count)::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'clean_data_access'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;
  
  -- Test 3: Current user info
  RETURN QUERY SELECT 'current_user'::TEXT, 'INFO'::TEXT, format('Current user ID: %s', current_user_id)::TEXT;
  
END;
$$;


--
-- Name: update_chat_entities_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_chat_entities_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_chat_sessions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_chat_sessions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: business_context; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_context (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    context_type text NOT NULL,
    name text NOT NULL,
    definition text NOT NULL,
    examples text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT business_context_context_type_check CHECK ((context_type = ANY (ARRAY['entity'::text, 'formula'::text, 'relationship'::text])))
);


--
-- Name: chat_entities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_entities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    CONSTRAINT chat_entities_type_check CHECK ((type = ANY (ARRAY['hotel'::text, 'operator'::text, 'legal_entity'::text, 'metric'::text])))
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    session_id uuid,
    role text NOT NULL,
    content text NOT NULL,
    sql_query text,
    query_result jsonb,
    chart_suggestion jsonb,
    created_at timestamp with time zone DEFAULT now(),
    data_summary text,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
);

ALTER TABLE ONLY public.chat_messages REPLICA IDENTITY FULL;


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_sessions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    title text DEFAULT 'New Chat'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    conversation_summary text
);


--
-- Name: clean_currency_exchange_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clean_currency_exchange_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    source_workbook text,
    source_mapping_id uuid,
    extracted_at timestamp with time zone DEFAULT now(),
    from_currency text NOT NULL,
    to_currency text NOT NULL,
    average_exchange_rate double precision NOT NULL,
    month_start_date date NOT NULL,
    days_in_month double precision NOT NULL
);


--
-- Name: clean_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clean_data (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    schema_id uuid,
    user_id uuid,
    data jsonb NOT NULL,
    source_workbook text,
    source_mapping_id uuid,
    extracted_at timestamp with time zone DEFAULT now()
);


--
-- Name: clean_hotel_financials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clean_hotel_financials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    source_workbook text,
    source_mapping_id uuid,
    extracted_at timestamp with time zone DEFAULT now(),
    period_type text NOT NULL,
    period_start_date date NOT NULL,
    room_revenue numeric(12,2),
    fnb_revenue numeric(12,2),
    other_operating_revenue numeric(12,2),
    total_revenue numeric(12,2) NOT NULL,
    departmental_operating_expenses numeric(12,2),
    undistributed_operating_expenses numeric(12,2),
    management_fees numeric(12,2),
    corporate_expenses numeric(12,2),
    ff_and_e_reserve numeric(12,2),
    pre_ifrs_rental_expense numeric(12,2),
    goi numeric(12,2),
    gop numeric(12,2),
    reported_ebitda numeric(12,2),
    adjustment_notes text,
    reporting_currency text,
    room_night_sold double precision,
    hotel_name text DEFAULT ''::text NOT NULL
);


--
-- Name: clean_hotel_master; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clean_hotel_master (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    source_workbook text,
    source_mapping_id uuid,
    extracted_at timestamp with time zone DEFAULT now(),
    hotel_name text NOT NULL,
    address text NOT NULL,
    location text NOT NULL,
    number_of_rooms double precision NOT NULL,
    operator text NOT NULL,
    revenue_domicile text NOT NULL,
    reported_currency text NOT NULL,
    legal_entity text NOT NULL
);


--
-- Name: clean_hotel_utility_consumption; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clean_hotel_utility_consumption (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    source_workbook text,
    source_mapping_id uuid,
    extracted_at timestamp with time zone DEFAULT now(),
    hotel_name text NOT NULL,
    week_start_date date NOT NULL,
    week_end_date date NOT NULL,
    electricity_consumption_kwh double precision,
    water_consumption_kl double precision,
    gas_consumption_mmbtu double precision,
    electricity_cost double precision,
    water_cost double precision,
    reporting_currency text NOT NULL,
    data_source text,
    remarks text
);


--
-- Name: dashboard_charts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_charts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    dashboard_id uuid,
    chart_type text NOT NULL,
    title text NOT NULL,
    sql_query text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb,
    "position" integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    CONSTRAINT dashboard_charts_chart_type_check CHECK ((chart_type = ANY (ARRAY['bar'::text, 'line'::text, 'pie'::text, 'area'::text, 'table'::text, 'combo'::text])))
);


--
-- Name: dashboards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboards (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    "position" integer
);


--
-- Name: mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mappings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    schema_id uuid,
    name text NOT NULL,
    description text,
    tags text[] DEFAULT '{}'::text[],
    workbook_format text,
    field_mappings jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: schemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schemas (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    description text,
    fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: vw_hotel_financial_normalized; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_hotel_financial_normalized AS
 WITH fx AS (
         SELECT clean_currency_exchange_rates.month_start_date,
            clean_currency_exchange_rates.from_currency,
            clean_currency_exchange_rates.to_currency,
            clean_currency_exchange_rates.average_exchange_rate
           FROM public.clean_currency_exchange_rates
        ), base AS (
         SELECT f.hotel_name,
            m.address,
            m.location,
            m.number_of_rooms AS number_of_rooms_available,
            m.operator,
            m.revenue_domicile,
            m.reported_currency AS master_reported_currency,
            m.legal_entity,
            f.period_type,
            f.period_start_date,
            (date_trunc('month'::text, (f.period_start_date)::timestamp with time zone))::date AS period_month,
            (date_trunc('quarter'::text, (f.period_start_date)::timestamp with time zone))::date AS period_quarter,
            (date_trunc('year'::text, (f.period_start_date)::timestamp with time zone))::date AS period_year,
            f.reporting_currency AS financial_reporting_currency,
            fx.average_exchange_rate AS fx_rate_to_inr,
            f.room_revenue,
            f.fnb_revenue,
            f.other_operating_revenue,
            f.total_revenue,
            f.departmental_operating_expenses,
            f.undistributed_operating_expenses,
            f.management_fees,
            f.corporate_expenses,
            f.ff_and_e_reserve,
            f.pre_ifrs_rental_expense,
            f.goi,
            f.gop,
            f.reported_ebitda,
            f.adjustment_notes,
            f.room_night_sold,
                CASE
                    WHEN (f.reporting_currency = 'INR'::text) THEN (f.room_revenue)::double precision
                    ELSE ((f.room_revenue)::double precision * fx.average_exchange_rate)
                END AS room_revenue_inr,
                CASE
                    WHEN (f.reporting_currency = 'INR'::text) THEN (f.fnb_revenue)::double precision
                    ELSE ((f.fnb_revenue)::double precision * fx.average_exchange_rate)
                END AS fnb_revenue_inr,
                CASE
                    WHEN (f.reporting_currency = 'INR'::text) THEN (f.other_operating_revenue)::double precision
                    ELSE ((f.other_operating_revenue)::double precision * fx.average_exchange_rate)
                END AS other_operating_revenue_inr,
                CASE
                    WHEN (f.reporting_currency = 'INR'::text) THEN (f.total_revenue)::double precision
                    ELSE ((f.total_revenue)::double precision * fx.average_exchange_rate)
                END AS total_revenue_inr,
                CASE
                    WHEN (f.reporting_currency = 'INR'::text) THEN (f.departmental_operating_expenses)::double precision
                    ELSE ((f.departmental_operating_expenses)::double precision * fx.average_exchange_rate)
                END AS departmental_operating_expenses_inr,
                CASE
                    WHEN (f.reporting_currency = 'INR'::text) THEN (f.undistributed_operating_expenses)::double precision
                    ELSE ((f.undistributed_operating_expenses)::double precision * fx.average_exchange_rate)
                END AS undistributed_operating_expenses_inr,
                CASE
                    WHEN (f.reporting_currency = 'INR'::text) THEN (f.management_fees)::double precision
                    ELSE ((f.management_fees)::double precision * fx.average_exchange_rate)
                END AS management_fees_inr,
                CASE
                    WHEN (f.reporting_currency = 'INR'::text) THEN (f.corporate_expenses)::double precision
                    ELSE ((f.corporate_expenses)::double precision * fx.average_exchange_rate)
                END AS corporate_expenses_inr,
                CASE
                    WHEN (f.reporting_currency = 'INR'::text) THEN (f.ff_and_e_reserve)::double precision
                    ELSE ((f.ff_and_e_reserve)::double precision * fx.average_exchange_rate)
                END AS ff_and_e_reserve_inr,
                CASE
                    WHEN (f.reporting_currency = 'INR'::text) THEN (f.pre_ifrs_rental_expense)::double precision
                    ELSE ((f.pre_ifrs_rental_expense)::double precision * fx.average_exchange_rate)
                END AS pre_ifrs_rental_expense_inr,
                CASE
                    WHEN (f.reporting_currency = 'INR'::text) THEN (f.goi)::double precision
                    ELSE ((f.goi)::double precision * fx.average_exchange_rate)
                END AS goi_inr,
                CASE
                    WHEN (f.reporting_currency = 'INR'::text) THEN (f.gop)::double precision
                    ELSE ((f.gop)::double precision * fx.average_exchange_rate)
                END AS gop_inr,
                CASE
                    WHEN (f.reporting_currency = 'INR'::text) THEN (f.reported_ebitda)::double precision
                    ELSE ((f.reported_ebitda)::double precision * fx.average_exchange_rate)
                END AS reported_ebitda_inr
           FROM ((public.clean_hotel_financials f
             LEFT JOIN public.clean_hotel_master m ON ((f.hotel_name = m.hotel_name)))
             LEFT JOIN fx ON (((fx.month_start_date = date_trunc('month'::text, (f.period_start_date)::timestamp with time zone)) AND (fx.from_currency = f.reporting_currency) AND (fx.to_currency = 'INR'::text))))
        )
 SELECT hotel_name,
    address,
    location,
    number_of_rooms_available,
    operator,
    revenue_domicile,
    master_reported_currency,
    legal_entity,
    period_type,
    period_start_date,
    period_month,
    period_quarter,
    period_year,
    financial_reporting_currency,
    fx_rate_to_inr,
    room_revenue,
    fnb_revenue,
    other_operating_revenue,
    total_revenue,
    departmental_operating_expenses,
    undistributed_operating_expenses,
    management_fees,
    corporate_expenses,
    ff_and_e_reserve,
    pre_ifrs_rental_expense,
    goi,
    gop,
    reported_ebitda,
    adjustment_notes,
    room_night_sold,
    room_revenue_inr,
    fnb_revenue_inr,
    other_operating_revenue_inr,
    total_revenue_inr,
    departmental_operating_expenses_inr,
    undistributed_operating_expenses_inr,
    management_fees_inr,
    corporate_expenses_inr,
    ff_and_e_reserve_inr,
    pre_ifrs_rental_expense_inr,
    goi_inr,
    gop_inr,
    reported_ebitda_inr
   FROM base;


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text,
    created_by text,
    idempotency_key text
);


--
-- Name: seed_files; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.seed_files (
    path text NOT NULL,
    hash text NOT NULL
);


--
-- Name: business_context business_context_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_context
    ADD CONSTRAINT business_context_pkey PRIMARY KEY (id);


--
-- Name: chat_entities chat_entities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_entities
    ADD CONSTRAINT chat_entities_pkey PRIMARY KEY (id);


--
-- Name: chat_entities chat_entities_user_id_name_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_entities
    ADD CONSTRAINT chat_entities_user_id_name_type_key UNIQUE (user_id, name, type);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: clean_currency_exchange_rates clean_currency_exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clean_currency_exchange_rates
    ADD CONSTRAINT clean_currency_exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: clean_data clean_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clean_data
    ADD CONSTRAINT clean_data_pkey PRIMARY KEY (id);


--
-- Name: clean_hotel_financials clean_hotel_financials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clean_hotel_financials
    ADD CONSTRAINT clean_hotel_financials_pkey PRIMARY KEY (id);


--
-- Name: clean_hotel_master clean_hotel_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clean_hotel_master
    ADD CONSTRAINT clean_hotel_master_pkey PRIMARY KEY (id);


--
-- Name: clean_hotel_utility_consumption clean_hotel_utility_consumption_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clean_hotel_utility_consumption
    ADD CONSTRAINT clean_hotel_utility_consumption_pkey PRIMARY KEY (id);


--
-- Name: dashboard_charts dashboard_charts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_charts
    ADD CONSTRAINT dashboard_charts_pkey PRIMARY KEY (id);


--
-- Name: dashboards dashboards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboards
    ADD CONSTRAINT dashboards_pkey PRIMARY KEY (id);


--
-- Name: mappings mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mappings
    ADD CONSTRAINT mappings_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: schemas schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schemas
    ADD CONSTRAINT schemas_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_idempotency_key_key; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: seed_files seed_files_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.seed_files
    ADD CONSTRAINT seed_files_pkey PRIMARY KEY (path);


--
-- Name: idx_chat_entities_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_entities_name ON public.chat_entities USING btree (name);


--
-- Name: idx_chat_entities_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_entities_tags ON public.chat_entities USING gin (tags);


--
-- Name: idx_chat_entities_user_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_entities_user_type ON public.chat_entities USING btree (user_id, type);


--
-- Name: idx_chat_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_created_at ON public.chat_messages USING btree (created_at);


--
-- Name: idx_chat_messages_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_session_id ON public.chat_messages USING btree (session_id);


--
-- Name: idx_chat_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions USING btree (user_id);


--
-- Name: idx_currency_exchange_rates_extracted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_currency_exchange_rates_extracted_at ON public.clean_currency_exchange_rates USING btree (extracted_at);


--
-- Name: idx_currency_exchange_rates_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_currency_exchange_rates_user_id ON public.clean_currency_exchange_rates USING btree (user_id);


--
-- Name: idx_dashboards_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dashboards_position ON public.dashboards USING btree ("position");


--
-- Name: idx_hotel_financials_extracted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hotel_financials_extracted_at ON public.clean_hotel_financials USING btree (extracted_at);


--
-- Name: idx_hotel_financials_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hotel_financials_user_id ON public.clean_hotel_financials USING btree (user_id);


--
-- Name: idx_hotel_master_extracted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hotel_master_extracted_at ON public.clean_hotel_master USING btree (extracted_at);


--
-- Name: idx_hotel_master_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hotel_master_user_id ON public.clean_hotel_master USING btree (user_id);


--
-- Name: idx_hotel_utility_consumption_extracted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hotel_utility_consumption_extracted_at ON public.clean_hotel_utility_consumption USING btree (extracted_at);


--
-- Name: idx_hotel_utility_consumption_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hotel_utility_consumption_user_id ON public.clean_hotel_utility_consumption USING btree (user_id);


--
-- Name: chat_entities update_chat_entities_timestamp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_chat_entities_timestamp BEFORE UPDATE ON public.chat_entities FOR EACH ROW EXECUTE FUNCTION public.update_chat_entities_updated_at();


--
-- Name: chat_sessions update_chat_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON public.chat_sessions FOR EACH ROW EXECUTE FUNCTION public.update_chat_sessions_updated_at();


--
-- Name: business_context business_context_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_context
    ADD CONSTRAINT business_context_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_entities chat_entities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_entities
    ADD CONSTRAINT chat_entities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;


--
-- Name: chat_sessions chat_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: clean_currency_exchange_rates clean_currency_exchange_rates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clean_currency_exchange_rates
    ADD CONSTRAINT clean_currency_exchange_rates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: clean_data clean_data_schema_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clean_data
    ADD CONSTRAINT clean_data_schema_id_fkey FOREIGN KEY (schema_id) REFERENCES public.schemas(id) ON DELETE CASCADE;


--
-- Name: clean_data clean_data_source_mapping_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clean_data
    ADD CONSTRAINT clean_data_source_mapping_id_fkey FOREIGN KEY (source_mapping_id) REFERENCES public.mappings(id);


--
-- Name: clean_data clean_data_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clean_data
    ADD CONSTRAINT clean_data_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: clean_hotel_financials clean_hotel_financials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clean_hotel_financials
    ADD CONSTRAINT clean_hotel_financials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: clean_hotel_master clean_hotel_master_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clean_hotel_master
    ADD CONSTRAINT clean_hotel_master_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: clean_hotel_utility_consumption clean_hotel_utility_consumption_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clean_hotel_utility_consumption
    ADD CONSTRAINT clean_hotel_utility_consumption_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: dashboard_charts dashboard_charts_dashboard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_charts
    ADD CONSTRAINT dashboard_charts_dashboard_id_fkey FOREIGN KEY (dashboard_id) REFERENCES public.dashboards(id) ON DELETE CASCADE;


--
-- Name: dashboard_charts dashboard_charts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_charts
    ADD CONSTRAINT dashboard_charts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: dashboards dashboards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboards
    ADD CONSTRAINT dashboards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mappings mappings_schema_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mappings
    ADD CONSTRAINT mappings_schema_id_fkey FOREIGN KEY (schema_id) REFERENCES public.schemas(id) ON DELETE CASCADE;


--
-- Name: mappings mappings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mappings
    ADD CONSTRAINT mappings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: schemas schemas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schemas
    ADD CONSTRAINT schemas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: dashboard_charts All authenticated users can delete dashboard charts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All authenticated users can delete dashboard charts" ON public.dashboard_charts FOR DELETE TO authenticated USING (true);


--
-- Name: dashboards All authenticated users can delete dashboards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All authenticated users can delete dashboards" ON public.dashboards FOR DELETE TO authenticated USING (true);


--
-- Name: dashboard_charts All authenticated users can update dashboard charts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All authenticated users can update dashboard charts" ON public.dashboard_charts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: dashboards All authenticated users can update dashboards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All authenticated users can update dashboards" ON public.dashboards FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: business_context All authenticated users can view business context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All authenticated users can view business context" ON public.business_context FOR SELECT TO authenticated USING (true);


--
-- Name: dashboard_charts All authenticated users can view dashboard charts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All authenticated users can view dashboard charts" ON public.dashboard_charts FOR SELECT TO authenticated USING (true);


--
-- Name: dashboards All authenticated users can view dashboards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All authenticated users can view dashboards" ON public.dashboards FOR SELECT TO authenticated USING (true);


--
-- Name: clean_currency_exchange_rates All authenticated users can view data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All authenticated users can view data" ON public.clean_currency_exchange_rates FOR SELECT TO authenticated USING (true);


--
-- Name: clean_hotel_financials All authenticated users can view data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All authenticated users can view data" ON public.clean_hotel_financials FOR SELECT TO authenticated USING (true);


--
-- Name: clean_hotel_master All authenticated users can view data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All authenticated users can view data" ON public.clean_hotel_master FOR SELECT TO authenticated USING (true);


--
-- Name: clean_hotel_utility_consumption All authenticated users can view data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All authenticated users can view data" ON public.clean_hotel_utility_consumption FOR SELECT TO authenticated USING (true);


--
-- Name: mappings All authenticated users can view mappings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All authenticated users can view mappings" ON public.mappings FOR SELECT TO authenticated USING (true);


--
-- Name: schemas All authenticated users can view schemas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "All authenticated users can view schemas" ON public.schemas FOR SELECT TO authenticated USING (true);


--
-- Name: clean_hotel_financials Allow all authenticated users to delete any record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all authenticated users to delete any record" ON public.clean_hotel_financials FOR DELETE TO authenticated USING (true);


--
-- Name: dashboard_charts Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for authenticated users only" ON public.dashboard_charts FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: clean_data Everyone can view all clean data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view all clean data" ON public.clean_data FOR SELECT TO authenticated USING (true);


--
-- Name: business_context Users can create business context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create business context" ON public.business_context FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: clean_data Users can create clean data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create clean data" ON public.clean_data FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: dashboard_charts Users can create dashboard charts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create dashboard charts" ON public.dashboard_charts FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: dashboards Users can create dashboards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create dashboards" ON public.dashboards FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: mappings Users can create mappings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create mappings" ON public.mappings FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: chat_messages Users can create messages in their sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create messages in their sessions" ON public.chat_messages FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.chat_sessions
  WHERE ((chat_sessions.id = chat_messages.session_id) AND (chat_sessions.user_id = auth.uid())))));


--
-- Name: schemas Users can create schemas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create schemas" ON public.schemas FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: chat_sessions Users can create their own chat sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own chat sessions" ON public.chat_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: dashboard_charts Users can delete charts in their own dashboards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete charts in their own dashboards" ON public.dashboard_charts FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.dashboards
  WHERE ((dashboards.id = dashboard_charts.dashboard_id) AND (dashboards.user_id = auth.uid())))));


--
-- Name: chat_messages Users can delete messages in their sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete messages in their sessions" ON public.chat_messages FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.chat_sessions
  WHERE ((chat_sessions.id = chat_messages.session_id) AND (chat_sessions.user_id = auth.uid())))));


--
-- Name: business_context Users can delete their own business context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own business context" ON public.business_context FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: chat_sessions Users can delete their own chat sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own chat sessions" ON public.chat_sessions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: clean_data Users can delete their own clean data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own clean data" ON public.clean_data FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: clean_currency_exchange_rates Users can delete their own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own data" ON public.clean_currency_exchange_rates FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: clean_hotel_master Users can delete their own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own data" ON public.clean_hotel_master FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: clean_hotel_utility_consumption Users can delete their own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own data" ON public.clean_hotel_utility_consumption FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: chat_entities Users can delete their own entities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own entities" ON public.chat_entities FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: mappings Users can delete their own mappings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own mappings" ON public.mappings FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: schemas Users can delete their own schemas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own schemas" ON public.schemas FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: clean_currency_exchange_rates Users can insert their own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own data" ON public.clean_currency_exchange_rates FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: clean_hotel_financials Users can insert their own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own data" ON public.clean_hotel_financials FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: clean_hotel_master Users can insert their own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own data" ON public.clean_hotel_master FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: clean_hotel_utility_consumption Users can insert their own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own data" ON public.clean_hotel_utility_consumption FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: chat_entities Users can insert their own entities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own entities" ON public.chat_entities FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: dashboard_charts Users can update charts in their own dashboards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update charts in their own dashboards" ON public.dashboard_charts FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.dashboards
  WHERE ((dashboards.id = dashboard_charts.dashboard_id) AND (dashboards.user_id = auth.uid())))));


--
-- Name: chat_messages Users can update messages in their sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update messages in their sessions" ON public.chat_messages FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.chat_sessions
  WHERE ((chat_sessions.id = chat_messages.session_id) AND (chat_sessions.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.chat_sessions
  WHERE ((chat_sessions.id = chat_messages.session_id) AND (chat_sessions.user_id = auth.uid())))));


--
-- Name: business_context Users can update their own business context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own business context" ON public.business_context FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: chat_sessions Users can update their own chat sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own chat sessions" ON public.chat_sessions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: clean_data Users can update their own clean data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own clean data" ON public.clean_data FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: clean_currency_exchange_rates Users can update their own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own data" ON public.clean_currency_exchange_rates FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: clean_hotel_financials Users can update their own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own data" ON public.clean_hotel_financials FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: clean_hotel_master Users can update their own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own data" ON public.clean_hotel_master FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: clean_hotel_utility_consumption Users can update their own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own data" ON public.clean_hotel_utility_consumption FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: chat_entities Users can update their own entities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own entities" ON public.chat_entities FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: mappings Users can update their own mappings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own mappings" ON public.mappings FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: dashboard_charts Users can view charts in their own dashboards; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view charts in their own dashboards" ON public.dashboard_charts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.dashboards
  WHERE ((dashboards.id = dashboard_charts.dashboard_id) AND (dashboards.user_id = auth.uid())))));


--
-- Name: chat_messages Users can view messages in their sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages in their sessions" ON public.chat_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.chat_sessions
  WHERE ((chat_sessions.id = chat_messages.session_id) AND (chat_sessions.user_id = auth.uid())))));


--
-- Name: chat_sessions Users can view their own chat sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own chat sessions" ON public.chat_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: chat_entities Users can view their own entities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own entities" ON public.chat_entities FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: schemas authenticated user can update any schema ; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated user can update any schema " ON public.schemas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: business_context authenticated_users_can_read_all_business_context; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_users_can_read_all_business_context ON public.business_context FOR SELECT TO authenticated USING (true);


--
-- Name: schemas authenticated_users_can_read_all_schemas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_users_can_read_all_schemas ON public.schemas FOR SELECT TO authenticated USING (true);


--
-- Name: business_context; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_context ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_entities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_entities ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: clean_currency_exchange_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clean_currency_exchange_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: clean_data; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clean_data ENABLE ROW LEVEL SECURITY;

--
-- Name: clean_hotel_financials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clean_hotel_financials ENABLE ROW LEVEL SECURITY;

--
-- Name: clean_hotel_master; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clean_hotel_master ENABLE ROW LEVEL SECURITY;

--
-- Name: clean_hotel_utility_consumption; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clean_hotel_utility_consumption ENABLE ROW LEVEL SECURITY;

--
-- Name: dashboard_charts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dashboard_charts ENABLE ROW LEVEL SECURITY;

--
-- Name: dashboards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;

--
-- Name: mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: schemas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schemas ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--
