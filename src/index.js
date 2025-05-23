require('dotenv').config();
const path = require('path');
const fs = require('fs').promises;
const TikTokLiveMonitor = require('./TikTokLiveMonitor');
const APIServer = require('./APIServer');
const SupabaseManager = require('./SupabaseManager');

async function loadUsernames() {
    try {
        const content = await fs.readFile(path.join(__dirname, '..', 'data', 'usernames.txt'), 'utf-8');
        return content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#')); // Skip empty lines and comments
    } catch (error) {
        console.error('Error loading usernames:', error);
        return [];
    }
}

async function main() {
    // Initialize Supabase
    const supabase = new SupabaseManager();
    await supabase.initTables();
    console.log('Supabase connection established');

    const usernames = await loadUsernames();
    if (usernames.length === 0) {
        console.error('No usernames found in usernames.txt');
        process.exit(1);
    }
    
    console.log('Monitoring usernames:', usernames);
    const monitor = new TikTokLiveMonitor(
        usernames,
        path.join(__dirname, '..', 'data'),
        supabase
    );

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\nStopping monitoring...');
        await monitor.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\nStopping monitoring...');
        await monitor.stop();
        process.exit(0);
    });

    try {
        // Initialize Supabase
        const supabase = new SupabaseManager();
        await supabase.initTables();
        console.log('Supabase connection established');

        // Initialize and start the API server
        const dataDir = path.join(__dirname, '..', 'data');
        const apiServer = new APIServer(dataDir);
        await apiServer.start();
        console.log('API Server is ready for file downloads');

        // Start the monitor
        await monitor.init();
        await monitor.startMonitoring();
    } catch (error) {
        console.error('Error in main:', error);
        process.exit(1);
    }
}

main().catch(console.error);
