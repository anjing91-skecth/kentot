const { WebcastPushConnection } = require('tiktok-live-connector');
const SessionManager = require('./SessionManager');

class TikTokLiveMonitor {
    constructor(usernames, dataDir, supabaseManager) {
        this.sessionManager = new SessionManager(dataDir, supabaseManager);
        this.connections = new Map();
        this.usernames = usernames;
        this.reconnectAttempts = new Map();
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 30000; // 30 seconds
    }

    async init() {
        await this.sessionManager.init();
    }

    async startMonitoring() {
        for (const username of this.usernames) {
            await this.monitorUser(username);
        }
    }

    async monitorUser(username) {
        try {
            console.log(`Starting monitoring for ${username}`);
            const tiktokConnection = new WebcastPushConnection(username);
            
            // Reset reconnect attempts on successful connection
            this.reconnectAttempts.set(username, 0);
            this.connections.set(username, tiktokConnection);
            
            let sessionId = null;

            // Connection events
            tiktokConnection.on('connected', ({ roomId }) => {
                console.log(`Connected to roomId ${roomId}`);
                const session = this.sessionManager.createSession(username);
                sessionId = session.sessionId;
            });

            tiktokConnection.on('disconnected', () => {
                console.log(`Disconnected from ${username}'s livestream`);
                if (sessionId) {
                    this.sessionManager.endSession(sessionId);
                    sessionId = null;
                }
            });

            // Gift events
            tiktokConnection.on('gift', (data) => {
                if (sessionId && data.diamondCount > 0) {
                    this.sessionManager.updateSession(sessionId, {
                        diamonds: data.diamondCount,
                        senderId: data.userId.toString(),
                        senderUsername: data.nickname
                    });
                    console.log(`Gift from ${data.nickname}: ${data.diamondCount} diamonds`);
                }
            });

            // Member events
            tiktokConnection.on('roomUser', (data) => {
                if (sessionId) {
                    this.sessionManager.updateSession(sessionId, {
                        viewers: data.viewerCount
                    });
                    console.log(`Viewer count: ${data.viewerCount}`);
                }
            });

            // Error handling
            tiktokConnection.on('error', (err) => {
                console.error(`Error in ${username}'s connection:`, err);
            });

            // Connect to TikTok
            await tiktokConnection.connect();

        } catch (error) {
            console.error(`Error monitoring ${username}:`, error);
            await this.handleReconnection(username);
        }
    }

    async handleReconnection(username) {
        const attempts = (this.reconnectAttempts.get(username) || 0) + 1;
        this.reconnectAttempts.set(username, attempts);

        if (attempts > this.maxReconnectAttempts) {
            console.error(`Max reconnection attempts reached for ${username}`);
            this.reconnectAttempts.set(username, 0);
            // Wait 5 minutes before resetting
            await new Promise(resolve => setTimeout(resolve, 300000));
            return;
        }

        const delay = this.reconnectDelay * Math.pow(2, attempts - 1);
        console.log(`Attempting to reconnect to ${username} in ${delay/1000} seconds (attempt ${attempts})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        await this.monitorUser(username);
    }

    async stop() {
        for (const [username, connection] of this.connections) {
            try {
                await connection.disconnect();
                console.log(`Stopped monitoring ${username}`);
            } catch (error) {
                console.error(`Error stopping ${username}'s connection:`, error);
            }
        }
        this.connections.clear();
    }
}

module.exports = TikTokLiveMonitor;
