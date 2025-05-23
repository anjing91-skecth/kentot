const fs = require('fs').promises;
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

class SessionManager {
    constructor(dataDir, supabaseManager) {
        this.dataDir = dataDir;
        this.activeSessions = new Map();
        this.stateFile = path.join(dataDir, 'state.json');
        this.supabase = supabaseManager;
        this.liveSummaryWriter = createObjectCsvWriter({
            path: path.join(dataDir, 'live_summary.csv'),
            header: [
                { id: 'date', title: 'date' },
                { id: 'sessionId', title: 'session_id' },
                { id: 'username', title: 'username' },
                { id: 'startTime', title: 'start_time' },
                { id: 'endTime', title: 'end_time' },
                { id: 'totalDiamonds', title: 'total_diamonds' },
                { id: 'peakViewers', title: 'peak_viewers' },
                { id: 'durationMinutes', title: 'duration_minutes' }
            ]
        });

        // Header for top spenders CSV
        let topSpendersHeader = [
            { id: 'date', title: 'date' },
            { id: 'sessionId', title: 'session_id' },
            { id: 'username', title: 'username' }
        ];

        // Add columns for top 10 spenders
        for (let i = 1; i <= 10; i++) {
            topSpendersHeader.push(
                { id: `top${i}`, title: `top${i}` }
            );
        }

        this.topSpendersWriter = createObjectCsvWriter({
            path: path.join(dataDir, 'top_spenders.csv'),
            header: topSpendersHeader
        });
    }

    async init() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            await this.loadState();
        } catch (error) {
            console.error('Error initializing SessionManager:', error);
        }
    }

    async loadState() {
        try {
            const data = await fs.readFile(this.stateFile, 'utf8');
            const state = JSON.parse(data);
            this.activeSessions = new Map(Object.entries(state));
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading state:', error);
            }
        }
    }

    async saveState() {
        try {
            const state = Object.fromEntries(this.activeSessions);
            await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
        } catch (error) {
            console.error('Error saving state:', error);
        }
    }

    createSession(username) {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        
        // Count existing sessions for this user today
        const todaySessions = Array.from(this.activeSessions.values())
            .filter(s => s.username === username && 
                    s.startTime.split('T')[0] === dateStr)
            .length;

        const sessionId = `${username}_${dateStr}_${todaySessions + 1}`;
        const session = {
            sessionId,
            username,
            startTime: now.toISOString(),
            lastActivity: now.toISOString(),
            totalDiamonds: 0,
            peakViewers: 0,
            giftData: new Map() // Initialize empty Map for storing gift data
        };

        this.activeSessions.set(sessionId, session);
        this.saveState();
        return session;
    }

    updateSession(sessionId, { diamonds = 0, senderId = null, senderUsername = null, viewers = null }) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return null;

        session.lastActivity = new Date().toISOString();

        if (diamonds > 0 && senderId && senderUsername) {
            let giftData = session.giftData.get(senderId) || {
                senderId,
                username: senderUsername,
                diamonds: 0
            };
            giftData.diamonds += diamonds;
            session.giftData.set(senderId, giftData);
            session.totalDiamonds += diamonds;
        }

        if (viewers !== null) {
            session.peakViewers = Math.max(session.peakViewers, viewers);
        }

        this.saveState();
        return session;
    }

    async endSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;

        const endTime = new Date();
        const startTime = new Date(session.startTime);
        const durationMinutes = Math.floor((endTime - startTime) / 60000);

        // Save to Supabase
        try {
            // Save live session data
            await this.supabase.saveLiveSession({
                date: endTime.toISOString().split('T')[0],
                sessionId: session.sessionId,
                username: session.username,
                startTime: session.startTime,
                endTime: endTime.toISOString(),
                totalDiamonds: session.totalDiamonds,
                peakViewers: session.peakViewers,
                durationMinutes
            });

            // Get and save top spenders
            // Get top spenders data
            const topSpenders = Array.from(session.giftData.values())
                .sort((a, b) => b.diamonds - a.diamonds)
                .slice(0, 10)
                .map(spender => ({
                    username: spender.username,
                    diamonds: spender.diamonds
                }));

            // Save to Supabase
            await this.supabase.saveTopSpenders({
                date: endTime.toISOString().split('T')[0],
                sessionId: session.sessionId,
                username: session.username,
                topSpenders
            });
        } catch (error) {
            console.error('Error saving to Supabase:', error);
        }

        // Save to live_summary.csv
        await this.liveSummaryWriter.writeRecords([{
            date: endTime.toISOString().split('T')[0],
            sessionId: session.sessionId,
            username: session.username,
            startTime: session.startTime,
            endTime: endTime.toISOString(),
            totalDiamonds: session.totalDiamonds,
            peakViewers: session.peakViewers,
            durationMinutes
        }]);

        // Get top spenders
        const topSpenders = Array.from(session.giftData.values())
            .sort((a, b) => b.diamonds - a.diamonds)
            .slice(0, 10);

        // Prepare top spenders data
        const topSpendersData = {
            date: endTime.toISOString().split('T')[0],
            sessionId: session.sessionId,
            username: session.username
        };

        // Add top 10 spenders data
        for (let i = 0; i < 10; i++) {
            const spender = topSpenders[i] || { username: '', diamonds: 0 };
            topSpendersData[`top${i + 1}`] = `${spender.username || ''} (${spender.diamonds || 0})`; // Kembali ke format awal
        }

        // Save to top_spenders.csv
        await this.topSpendersWriter.writeRecords([topSpendersData]);

        // Remove from active sessions
        this.activeSessions.delete(sessionId);
        await this.saveState();
    }
}

module.exports = SessionManager;
