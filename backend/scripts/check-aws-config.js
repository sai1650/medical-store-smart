const path = require('path');
const dotenv = require('dotenv');
const { getMissingS3EnvironmentVariables } = require('../config/s3');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const missing = getMissingS3EnvironmentVariables();
console.log(`AWS configuration: ${missing.length === 0 ? 'OK' : 'MISSING'}`);
process.exitCode = missing.length === 0 ? 0 : 1;