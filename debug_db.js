const Database = require('sql.js');
const fs = require('fs');
const path = require('path');

async function checkTranscriptions() {
    const dbPath = path.resolve('./data/transcriptions.db');
    console.log('Database path:', dbPath);

    if (!fs.existsSync(dbPath)) {
        console.log('Database file not found!');
        return;
    }

    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);

    try {
        const sessions = db.exec("SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5");
        console.log('\nLast 5 Sessions:');
        if (sessions.length > 0) {
            sessions[0].values.forEach(row => {
                console.log(`Session ID: ${row[1]}, Channel: ${row[4]}, Duration: ${row[8]}s, Status: ${row[10]}`);
            });
        } else {
            console.log("No sessions found.");
        }

        const transcripts = db.exec("SELECT * FROM transcriptions ORDER BY created_at DESC LIMIT 5");
        console.log('\nLast 5 Transcriptions:');
        if (transcripts.length > 0) {
            transcripts[0].values.forEach(row => {
                console.log(`User: ${row[3]}, Text: "${row[5].substring(0, 50)}...", Word Count: ${row[10]}`);
            });
        } else {
            console.log("No transcriptions found.");
        }

    } catch (error) {
        console.error('Error querying database:', error);
    } finally {
        db.close();
    }
}

checkTranscriptions();
