require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function initializeDatabase() {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY
    );

    console.log('Creating tables in Supabase...');

    try {
        // Create live_sessions table
        const { error: error1 } = await supabase.rpc('create_live_sessions_table', {
            sql: `
                create table if not exists live_sessions (
                    id serial primary key,
                    date date not null,
                    session_id text not null,
                    username text not null,
                    start_time timestamp with time zone not null,
                    end_time timestamp with time zone not null,
                    total_diamonds integer not null default 0,
                    peak_viewers integer not null default 0,
                    duration_minutes integer not null,
                    created_at timestamp with time zone default now()
                );

                create index if not exists live_sessions_date_idx on live_sessions(date);
            `
        });

        if (error1) throw error1;

        // Create top_spenders table
        const { error: error2 } = await supabase.rpc('create_top_spenders_table', {
            sql: `
                create table if not exists top_spenders (
                    id serial primary key,
                    date date not null,
                    session_id text not null,
                    username text not null,
                    top_spenders jsonb not null default '[]',
                    created_at timestamp with time zone default now()
                );

                create index if not exists top_spenders_date_idx on top_spenders(date);
            `
        });

        if (error2) throw error2;

        console.log('Tables created successfully!');

    } catch (error) {
        console.error('Error creating tables:', error);
    }
}

initializeDatabase().catch(console.error);
