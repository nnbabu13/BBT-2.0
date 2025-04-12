// main.js - Entry point for the application
// Import the Express app
const app = require('./app');

// For Vercel deployment, we need to export the Express app
module.exports = app;

// Start the server if this file is executed directly
if (require.main === module) {
  const PORT = process.env.NODE_PORT || 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Baccarat Oscar Grind Tracker started on http://0.0.0.0:${PORT}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
      console.log('Closed out remaining connections');
      process.exit(0); // Exit cleanly after all connections are closed
    });

    // Force close after 10 seconds if not finished
    setTimeout(() => {
      console.error('Forcefully shutting down after timeout');
      process.exit(1); // Force exit if the server is not closed gracefully within timeout
    }, 10000);
  };

  // Handle termination signals
  process.on('SIGTERM', shutdown); // SIGTERM is sent by process manager (e.g., Kubernetes, Docker)
  process.on('SIGINT', shutdown);  // SIGINT is sent by Ctrl+C in the terminal
}
