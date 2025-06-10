import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs'; // Import fs for checking file existence

console.log('jest.env.setup.js: Current working directory:', process.cwd());

const envPath = path.resolve(process.cwd(), '.env.test');
console.log('jest.env.setup.js: Attempting to load .env.test from path:', envPath);

if (fs.existsSync(envPath)) {
  console.log('jest.env.setup.js: .env.test file FOUND at path:', envPath);
} else {
  console.error('jest.env.setup.js: .env.test file NOT FOUND at path:', envPath);
  // Try to list files in CWD for more context
  try {
    const filesInCwd = fs.readdirSync(process.cwd());
    console.log('jest.env.setup.js: Files in CWD:', filesInCwd);
  } catch (e) {
    console.error('jest.env.setup.js: Error listing files in CWD:', e);
  }
}

const result = dotenv.config({ path: envPath, override: true });

if (result.error) {
  console.error('jest.env.setup.js: Error loading .env.test:', result.error);
} else {
  console.log('jest.env.setup.js: Successfully loaded .env.test. Parsed variables:', result.parsed);
}
console.log('jest.env.setup.js: DB_NAME after load attempt:', process.env.DB_NAME);
console.log('jest.env.setup.js: NODE_ENV after load attempt:', process.env.NODE_ENV);
