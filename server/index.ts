import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './app';

const PORT = parseInt(process.env.PORT || '4800', 10);

console.log(`
  ____                                        _ _
 |  _ \\  ___   ___  _ __ ___  ___  ___ _ __ ___ | | |___
 | | | |/ _ \\ / _ \\| '_ \` _ \\/ __|/ __| '__/ _ \\| | / __|
 | |_| | (_) | (_) | | | | | \\__ \\ (__| | | (_) | | \\__ \\
 |____/ \\___/ \\___/|_| |_| |_|___/\\___|_|  \\___/|_|_|___/

`);

console.log(`Starting Doomscrolls API server...`);

serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
  console.log(`Health check: http://localhost:${info.port}/health`);
  console.log(`API base: http://localhost:${info.port}/api`);
  console.log('');
  console.log('Press Ctrl+C to stop');
});
