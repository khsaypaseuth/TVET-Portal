// Quick test to see if server can start
import('./src/index.ts').catch(err => {
  console.error('Error starting server:', err);
  process.exit(1);
});

