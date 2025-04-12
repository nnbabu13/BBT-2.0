# Baccarat Oscar Grind Tracker

A web application for tracking Baccarat bets using a modified Oscar Grind betting strategy.

## Features

- Modified Oscar Grind betting strategy with bankroll-aware progression
- Threshold control to prevent excessive bet progression
- Comprehensive dashboard for tracking bets and session statistics
- Responsive design with Bootstrap dark theme

## How to use

1. Enter your starting bankroll, base bet unit, and profit target
2. Follow the suggested bet amounts for each round
3. Record wins and losses to track your progress
4. The application will automatically calculate optimal bets to reach your targets

## Technologies

- Node.js with Express
- EJS templating
- Bootstrap CSS
- Session management

## Deployment to Vercel

This application is ready for deployment to Vercel. Follow these steps:

1. Fork or clone this repository
2. Connect your GitHub repository to Vercel
3. Configure the environment variables in Vercel dashboard
4. Deploy the application
5. Access your application using the provided Vercel URL

## Deployment to Render.com

To deploy this application on Render.com, follow these steps:

1.  Create a new Web Service on Render.com.
2.  Connect your GitHub repository that contains the application code.
3.  In the settings for the new Web Service:
    *   Set the **Build Command** to `npm install`.
    *   Set the **Start Command** to `npm start`.
    *   Add an environment variable named `PORT` and set its value to a port number (e.g., `3000`). Render will automatically assign a port if you do not provide one, but setting one explicitly is recommended.
4.  Deploy the application.
5.  Access your application using the Render.com URL provided after deployment.

## Local Development

To run this application locally:

1. Clone the repository
2. Install dependencies
3. Create a .env file with required variables
4. Start the development server
5. Access the application at http://localhost:3000
"# BBT-2.0" 
