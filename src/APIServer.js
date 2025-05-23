const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

class APIServer {
    constructor(dataDir) {
        this.app = express();
        this.dataDir = dataDir;
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
    }

    setupRoutes() {
        // Get list of available files
        this.app.get('/api/files', async (req, res) => {
            try {
                const files = await fs.readdir(this.dataDir);
                const csvFiles = files.filter(file => file.endsWith('.csv'));
                res.json(csvFiles);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Download specific file
        this.app.get('/api/download/:filename', async (req, res) => {
            try {
                const filename = req.params.filename;
                if (!filename.endsWith('.csv')) {
                    return res.status(400).json({ error: 'Only CSV files can be downloaded' });
                }

                const filePath = path.join(this.dataDir, filename);
                try {
                    await fs.access(filePath);
                } catch {
                    return res.status(404).json({ error: 'File not found' });
                }

                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                const fileStream = require('fs').createReadStream(filePath);
                fileStream.pipe(res);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Get latest data without downloading
        this.app.get('/api/view/:filename', async (req, res) => {
            try {
                const filename = req.params.filename;
                if (!filename.endsWith('.csv')) {
                    return res.status(400).json({ error: 'Only CSV files can be viewed' });
                }

                const filePath = path.join(this.dataDir, filename);
                const content = await fs.readFile(filePath, 'utf-8');
                res.send(content);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    start(port = process.env.PORT || 3000) {
        return new Promise((resolve) => {
            const server = this.app.listen(port, () => {
                console.log(`API Server running on port ${port}`);
                resolve(server);
            });
        });
    }
}

module.exports = APIServer;
