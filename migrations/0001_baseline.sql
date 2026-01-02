-- +goose Up
CREATE TABLE public.item_shelf_locations (
    id uuid NOT NULL,
    item_id uuid NOT NULL,
    shelf_id uuid NOT NULL,
    shelf_slot_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.items (
    id uuid NOT NULL,
    title text NOT NULL,
    creator text DEFAULT ''::text NOT NULL,
    item_type text NOT NULL,
    release_year integer,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    page_count integer,
    isbn_13 text DEFAULT ''::text NOT NULL,
    isbn_10 text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    cover_image text DEFAULT ''::text NOT NULL,
    reading_status text DEFAULT 'none'::text NOT NULL,
    read_at timestamp with time zone,
    current_page integer,
    platform text DEFAULT ''::text NOT NULL,
    age_group text DEFAULT ''::text NOT NULL,
    player_count text DEFAULT ''::text NOT NULL,
    format text DEFAULT ''::text NOT NULL,
    genre text DEFAULT ''::text NOT NULL,
    rating integer,
    retail_price_usd numeric(10,2),
    google_volume_id text DEFAULT ''::text NOT NULL,
    series_name text DEFAULT ''::text NOT NULL,
    volume_number integer,
    total_volumes integer,
    owner_id uuid NOT NULL
);

CREATE TABLE public.schema_migrations (
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.shelf_columns (
    id uuid NOT NULL,
    shelf_row_id uuid NOT NULL,
    col_index integer NOT NULL,
    x_start_norm double precision NOT NULL,
    x_end_norm double precision NOT NULL
);

CREATE TABLE public.shelf_rows (
    id uuid NOT NULL,
    shelf_id uuid NOT NULL,
    row_index integer NOT NULL,
    y_start_norm double precision NOT NULL,
    y_end_norm double precision NOT NULL
);

CREATE TABLE public.shelf_slots (
    id uuid NOT NULL,
    shelf_id uuid NOT NULL,
    shelf_row_id uuid NOT NULL,
    shelf_column_id uuid NOT NULL,
    row_index integer NOT NULL,
    col_index integer NOT NULL,
    x_start_norm double precision NOT NULL,
    x_end_norm double precision NOT NULL,
    y_start_norm double precision NOT NULL,
    y_end_norm double precision NOT NULL
);

CREATE TABLE public.shelves (
    id uuid NOT NULL,
    name text NOT NULL,
    description text,
    photo_url text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    owner_id uuid NOT NULL
);

CREATE TABLE public.user_sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    session_token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_agent text DEFAULT ''::text NOT NULL,
    ip_address text DEFAULT ''::text NOT NULL
);

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    avatar_url text DEFAULT ''::text NOT NULL,
    oauth_provider text NOT NULL,
    oauth_provider_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.item_shelf_locations
    ADD CONSTRAINT item_shelf_locations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (name);

ALTER TABLE ONLY public.shelf_columns
    ADD CONSTRAINT shelf_columns_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shelf_rows
    ADD CONSTRAINT shelf_rows_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shelf_slots
    ADD CONSTRAINT shelf_slots_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shelves
    ADD CONSTRAINT shelves_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_session_token_hash_key UNIQUE (session_token_hash);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

CREATE INDEX idx_item_shelf_locations_item_id ON public.item_shelf_locations USING btree (item_id);
CREATE INDEX idx_item_shelf_locations_shelf_id ON public.item_shelf_locations USING btree (shelf_id);
CREATE UNIQUE INDEX idx_item_shelf_locations_shelf_item ON public.item_shelf_locations USING btree (shelf_id, item_id);
CREATE INDEX idx_items_created_at ON public.items USING btree (created_at DESC);
CREATE INDEX idx_items_google_volume_id ON public.items USING btree (google_volume_id) WHERE (google_volume_id <> ''::text);
CREATE INDEX idx_items_owner_id ON public.items USING btree (owner_id);
CREATE INDEX idx_items_reading_status ON public.items USING btree (reading_status);
CREATE INDEX idx_items_series_name ON public.items USING btree (series_name) WHERE (series_name <> ''::text);
CREATE INDEX idx_items_series_volume ON public.items USING btree (series_name, volume_number) WHERE (series_name <> ''::text);
CREATE INDEX idx_shelf_columns_row_id ON public.shelf_columns USING btree (shelf_row_id);
CREATE INDEX idx_shelf_rows_shelf_id ON public.shelf_rows USING btree (shelf_id);
CREATE INDEX idx_shelf_slots_shelf_id ON public.shelf_slots USING btree (shelf_id);
CREATE INDEX idx_shelves_owner_id ON public.shelves USING btree (owner_id);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions USING btree (expires_at);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);
CREATE UNIQUE INDEX uq_shelves_name_owner ON public.shelves USING btree (owner_id, name);
CREATE UNIQUE INDEX uq_users_email ON public.users USING btree (email);
CREATE UNIQUE INDEX uq_users_oauth ON public.users USING btree (oauth_provider, oauth_provider_id);

ALTER TABLE ONLY public.item_shelf_locations
    ADD CONSTRAINT item_shelf_locations_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.item_shelf_locations
    ADD CONSTRAINT item_shelf_locations_shelf_id_fkey FOREIGN KEY (shelf_id) REFERENCES public.shelves(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.item_shelf_locations
    ADD CONSTRAINT item_shelf_locations_shelf_slot_id_fkey FOREIGN KEY (shelf_slot_id) REFERENCES public.shelf_slots(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.shelf_columns
    ADD CONSTRAINT shelf_columns_shelf_row_id_fkey FOREIGN KEY (shelf_row_id) REFERENCES public.shelf_rows(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shelf_rows
    ADD CONSTRAINT shelf_rows_shelf_id_fkey FOREIGN KEY (shelf_id) REFERENCES public.shelves(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shelf_slots
    ADD CONSTRAINT shelf_slots_shelf_column_id_fkey FOREIGN KEY (shelf_column_id) REFERENCES public.shelf_columns(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shelf_slots
    ADD CONSTRAINT shelf_slots_shelf_id_fkey FOREIGN KEY (shelf_id) REFERENCES public.shelves(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shelf_slots
    ADD CONSTRAINT shelf_slots_shelf_row_id_fkey FOREIGN KEY (shelf_row_id) REFERENCES public.shelf_rows(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shelves
    ADD CONSTRAINT shelves_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- +goose Down
DROP TABLE IF EXISTS public.item_shelf_locations CASCADE;
DROP TABLE IF EXISTS public.shelf_slots CASCADE;
DROP TABLE IF EXISTS public.shelf_columns CASCADE;
DROP TABLE IF EXISTS public.shelf_rows CASCADE;
DROP TABLE IF EXISTS public.shelves CASCADE;
DROP TABLE IF EXISTS public.user_sessions CASCADE;
DROP TABLE IF EXISTS public.items CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.schema_migrations CASCADE;
