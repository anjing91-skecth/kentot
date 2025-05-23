const { createClient } = require('@supabase/supabase-js');

class SupabaseManager {
    constructor() {
        // Ini akan diambil dari environment variables
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_KEY
        );
    }

    async initTables() {
        // Note: Table creation should be done through Supabase dashboard or migrations
        // This is just for checking if we can connect
        try {
            const { data, error } = await this.supabase
                .from('live_sessions')
                .select('id')
                .limit(1);
            
            if (error) throw error;
            console.log('Successfully connected to Supabase');
        } catch (error) {
            console.error('Error connecting to Supabase:', error.message);
            throw error;
        }
    }

    async saveLiveSession(sessionData) {
        const { data, error } = await this.supabase
            .from('live_sessions')
            .insert([{
                date: sessionData.date,
                session_id: sessionData.sessionId,
                username: sessionData.username,
                start_time: sessionData.startTime,
                end_time: sessionData.endTime,
                total_diamonds: sessionData.totalDiamonds,
                peak_viewers: sessionData.peakViewers,
                duration_minutes: sessionData.durationMinutes
            }]);

        if (error) throw error;
        return data;
    }

    async saveTopSpenders(spendersData) {
        const { data, error } = await this.supabase
            .from('top_spenders')
            .insert([{
                date: spendersData.date,
                session_id: spendersData.sessionId,
                username: spendersData.username,
                top_spenders: spendersData.topSpenders.map(s => ({
                    username: s.username,
                    diamonds: s.diamonds
                }))
            }]);

        if (error) throw error;
        return data;
    }

    async getSessionsByDate(date) {
        const { data, error } = await this.supabase
            .from('live_sessions')
            .select('*')
            .eq('date', date);

        if (error) throw error;
        return data;
    }

    async getTopSpendersByDate(date) {
        const { data, error } = await this.supabase
            .from('top_spenders')
            .select('*')
            .eq('date', date);

        if (error) throw error;
        return data;
    }

    async getLatestSessions(limit = 10) {
        const { data, error } = await this.supabase
            .from('live_sessions')
            .select('*')
            .order('start_time', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    }
}

module.exports = SupabaseManager;
