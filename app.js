// Load environment variables first!
const dotenv = require('dotenv');
dotenv.config();

// Import required packages
const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const admin = require('firebase-admin');
const { Store } = require('express-session');

// Initialize Express app
const app = express();

// Initialize Firebase Admin
const serviceAccount = require('./firebaseServiceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const sessionsCollection = db.collection('betting_sessions');

// Configure view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Firestore session store
class FirestoreStore extends Store {
  constructor(options = {}) {
    super(options);
    this.db = admin.firestore();
    this.collection = this.db.collection(options.collection || 'sessions');
  }

  async get(sid, callback) {
    try {
      const doc = await this.collection.doc(sid).get();
      if (!doc.exists) return callback(null, null);
      const data = doc.data();
      callback(null, data);
    } catch (error) {
      callback(error);
    }
  }

  async set(sid, session, callback) {
    try {
      await this.collection.doc(sid).set(session);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
}

// Session configuration with Firebase store
app.use(session({
  secret: process.env.SESSION_SECRET || 'oscar-grind-baccarat-tracker-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production'
  },
  store: new FirestoreStore()
}));

// Flash message middleware
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || {};
  delete req.session.flash;
  next();
});

// Oscar Grind strategy calculation
function calculateNextBet(currentBankroll, highestBankroll, baseBet, lastBet, lastResult) {
  if (!lastBet || !lastResult) return baseBet;

  const threshold = highestBankroll + parseFloat(baseBet);
  if (lastResult === 'win') {
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
app.get('/', (req, res) => {
  if (req.session.sessionId) return res.redirect('/session');
  res.render('index');
});

app.post('/', async (req, res) => {
  const starting_bankroll = parseFloat(req.body.starting_bankroll);
  const base_bet = parseFloat(req.body.base_bet);
  const profit_target = parseFloat(req.body.profit_target);

  if (isNaN(starting_bankroll) || starting_bankroll <= 0 ||
      isNaN(base_bet) || base_bet <= 0 ||
      isNaN(profit_target) || profit_target <= 0) {
    req.session.flash = { danger: 'Please enter valid inputs.' };
    return res.redirect('/');
  }

  const bettingSession = {
    starting_bankroll,
    current_bankroll: starting_bankroll,
    highest_bankroll: starting_bankroll,
    base_bet,
    profit_target,
    current_bet: base_bet,
    round_number: 1,
    bet_history: []
  };

  const docRef = await sessionsCollection.add(bettingSession);
  req.session.sessionId = docRef.id;
  req.session.flash = { success: 'Session started successfully! Good luck!' };
  res.redirect('/session');
});

app.get('/session', (req, res) => {
  if (!req.session.sessionId) {
    req.session.flash = { warning: 'No active session found. Please set up a new session.' };
    return res.redirect('/');
  }

  const session = await sessionStore(req.session.sessionId);
  if (!session) {
    req.session.flash = { warning: 'Session not found. Please start a new session.' };
    return res.redirect('/');
  }

  if (session.current_bankroll - session.starting_bankroll >= session.profit_target) {
    req.session.flash = { success: `You've reached your profit target of $${session.profit_target.toFixed(2)}!` };
  }

  if (session.current_bankroll < session.base_bet) {
    req.session.flash = { danger: 'Bankroll below base bet. Consider resetting your strategy.' };
  }

  const net_profit = session.current_bankroll - session.starting_bankroll;
  res.render('session', { ...session, net_profit });
});

app.post('/session', async (req, res) => {
  if (!req.session.sessionId) {
    req.session.flash = { warning: 'No active session found. Please set up a new session.' };
    return res.redirect('/');
  }

  const docRef = sessionsCollection.doc(req.session.sessionId);
  const doc = await docRef.get();
  if (!doc.exists) {
    req.session.flash = { warning: 'Session not found. Please start a new session.' };
    return res.redirect('/');
  }

  const session = doc.data();
  const bet_amount = parseFloat(req.body.bet_amount);
  const result = req.body.result;

  if (isNaN(bet_amount) || bet_amount <= 0 || !['win', 'loss'].includes(result)) {
    req.session.flash = { danger: 'Invalid input.' };
    return res.redirect('/session');
  }

  if (bet_amount > session.current_bankroll) {
    req.session.flash = { danger: 'Bet exceeds current bankroll.' };
    return res.redirect('/session');
  }

  const isDivisible = Math.abs(Math.round(bet_amount / session.base_bet) - (bet_amount / session.base_bet)) < 0.0001;
  if (!isDivisible) {
    req.session.flash = { danger: `Bet must be a multiple of base bet ($${session.base_bet.toFixed(2)}).` };
    return res.redirect('/session');
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
    round: session.round_number,
    bet_amount,
    result,
    profit_loss,
    bankroll: session.current_bankroll,
    next_bet: nextBet,
    followed_suggestion: bet_amount === session.current_bet
  });

  session.round_number += 1;
  session.current_bet = nextBet;

  req.session.flash = {
    [result === 'win' ? 'success' : 'info']:
      `${result === 'win' ? 'You won' : 'You lost'} $${bet_amount.toFixed(2)}. Current bankroll: $${session.current_bankroll.toFixed(2)}.`
  };

  res.redirect('/session');
});

app.post('/reset', async (req, res) => {
  if (req.session.sessionId) {
    await sessionsCollection.doc(req.session.sessionId).delete();
    delete req.session.sessionId;
  }
  req.session.flash = { info: 'Your session has been reset.' };
  res.redirect('/');
});

// Error handling
app.use((req, res, next) => {
  res.status(404).render('index', { error: 'Page not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('index', { error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
