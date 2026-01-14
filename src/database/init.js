require('dotenv').config();
const path = require('path');
const DatabaseSchema = require('./schema');

const dbPath = process.env.DATABASE_PATH || './data/transcriptions.db';
const absolutePath = path.resolve(dbPath);

console.log('Initializing database at:', absolutePath);

async function initDatabase() {
  try {
    const dbSchema = new DatabaseSchema();
    await dbSchema.initialize(absolutePath);
    console.log('✅ Database initialized successfully!');
    dbSchema.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

initDatabase();
