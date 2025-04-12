// Load environment variables first!
const dotenv = require('dotenv');
dotenv.config();
// Import required packages
const express = require('express');
const cookieSession = require('cookie-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
// Initialize Express app
const app = express();
// Configure view engine
app.set("view engine", "ejs");
// Middleware
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static("public"));
app.use(cookieSession({
    name: "session",
    keys: [process.env.SESSION_SECRET || "oscar-grind-baccarat-tracker-secret"], // Use an array of keys for security
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === "production", // Set to true in production if using HTTPS
    secureProxy: true // Add this line to trust the proxy
}));
// Flash message middleware
app.use(function (req, res, next) {
  res.locals.flash = req.session.flash || {};
  delete req.session.flash;
  next();
});
// Oscar Grind strategy calculation
function calculateNextBet(currentBankroll, highestBankroll, baseBet, lastBet, lastResult) {
  if (!lastBet || !lastResult) return baseBet;
  const threshold = highestBankroll + parseFloat(baseBet);
  if (lastResult === "win") {
    if (currentBankroll >= threshold) return baseBet;

    const standardNextBet = parseFloat(lastBet) + parseFloat(baseBet);
    const potentialBankroll = currentBankroll + standardNextBet;

      if (potentialBankroll > threshold) {
      const adjustedBet = threshold - currentBankroll;
      const multiplier = Math.floor(adjustedBet / baseBet);
      return Math.max(baseBet, multiplier * baseBet);
    }
    return standardNextBet;
  } else {
    return parseFloat(lastBet);
  }
}

// Routes
app.get("/", (req, res) => {
    if (req.session.sessionId) return res.redirect("/session");
    res.render("index");
});
app.post("/", (req, res) => {
    console.log('Headers:', req.headers);
    if(!req.body){
        req.session.flash = { danger: 'Please enter valid inputs.' };
        return res.redirect('/');
    }
    const starting_bankroll = parseFloat(req.body.starting_bankroll);
    const base_bet = parseFloat(req.body.base_bet);
    const profit_target = parseFloat(req.body.profit_target);
    
    if (isNaN(starting_bankroll) || starting_bankroll <= 0 ||
        isNaN(base_bet) || base_bet <= 0 ||
        isNaN(profit_target) || profit_target <= 0) {
        req.session.flash = { danger: 'Please enter valid inputs.' };
        return res.redirect('/');
  }
    req.session.sessionId = Math.random().toString(36).substring(2, 9);
    req.session.starting_bankroll = starting_bankroll;
    req.session.current_bankroll = starting_bankroll;
    req.session.highest_bankroll = starting_bankroll;
    req.session.base_bet = base_bet;
    req.session.profit_target = profit_target;
    req.session.current_bet = base_bet;
    req.session.round_number = 1;
    req.session.bet_history = [];
    req.session.flash = { success: "Session started successfully! Good luck!" };
    res.redirect("/session");
});
app.get("/session", (req, res) => {
    const session = req.session;
    console.log('Session data:', req.session);
    if (!session || !session.sessionId) {
        req.session.flash = { warning: "No active session found. Please set up a new session." };
        return res.redirect("/");
    }
    
    const net_profit = session.current_bankroll - session.starting_bankroll;
    res.render("session", { ...session, net_profit });
});
app.post("/session", (req, res) => {
    if (!req.session.sessionId) {
        req.session.flash = { warning: "No active session found. Please set up a new session." };
        return res.redirect("/");
    }
    const session = req.session;
    const bet_amount = parseFloat(req.body.bet_amount);
    const result = req.body.result;
    
    if (isNaN(bet_amount) || bet_amount <= 0 || !["win", "loss"].includes(result)) {
        req.session.flash = { danger: "Invalid input." };
        return res.redirect("/session");
    }
    
    if (bet_amount > session.current_bankroll) {
        req.session.flash = { danger: "Bet exceeds current bankroll." };
        return res.redirect("/session");
    }
    
    const isDivisible = Math.abs(Math.round(bet_amount / session.base_bet) - (bet_amount / session.base_bet)) < 0.0001;
    if (!isDivisible) {
        req.session.flash = { danger: `Bet must be a multiple of base bet ($${session.base_bet.toFixed(2)}).` };
        return res.redirect("/session");
    }
    
    let profit_loss = 0;
    if (result === 'win') {
        profit_loss = bet_amount;
        session.current_bankroll += bet_amount;
    } else {
        profit_loss = -bet_amount;
        session.current_bankroll -= bet_amount;
    }
    
    if (session.current_bankroll > session.highest_bankroll) {
        session.highest_bankroll = session.current_bankroll;
    }

    const nextBet = calculateNextBet(
        session.current_bankroll,
        session.highest_bankroll,
        session.base_bet,
        bet_amount,
        result
    );
    
    session.bet_history.unshift({
        round: session.round_number, bet_amount, result, profit_loss,
        bankroll: session.current_bankroll,
        next_bet: nextBet,
        followed_suggestion: bet_amount === session.current_bet
    });
    
    session.round_number += 1;
    session.current_bet = nextBet;
    let flashMessage = {};
    if (result === "win") {
      flashMessage.success = `You won $${bet_amount.toFixed(2)}. Current bankroll: $${session.current_bankroll.toFixed(2)}.`;
    } else {
      flashMessage.info = `You lost $${bet_amount.toFixed(2)}. Current bankroll: $${session.current_bankroll.toFixed(2)}.`;
    }
    req.session.flash = flashMessage;

    res.redirect("/session");
});
app.post("/reset", (req, res) => {
    if (req.session) {
        req.session = null;
    }
    req.session.flash = { info: "Your session has been reset." };
    res.redirect("/");
});
// Error handling
app.use(function (req, res, next) {
    res.status(404).render("index", { error: "Page not found" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('index', { error: 'Something went wrong!' });
});