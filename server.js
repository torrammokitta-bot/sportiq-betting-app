const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 4000;
const API_KEY = process.env.SPORTS_API_KEY || '';

app.use(express.static(path.join(__dirname, 'public')));

function mapMatch(raw) {
  const market = raw.markets && raw.markets['1x2'] ? raw.markets['1x2'] : {};
  const homeOdds = market['1'] || null;
  const drawOdds = market['X'] || null;
  const awayOdds = market['2'] || null;

  // simple equal probabilities if odds missing
  let homeProb = 0.4, drawProb = 0.2, awayProb = 0.4;
  if (homeOdds && awayOdds) {
    const pHome = 1 / homeOdds;
    const pAway = 1 / awayOdds;
    const pDraw = drawOdds ? 1 / drawOdds : 0.05;
    const sum = pHome + pAway + pDraw;
    homeProb = pHome / sum;
    drawProb = pDraw / sum;
    awayProb = pAway / sum;
  }

  const start = new Date(raw.start_at * 1000);
  const startTime = start.toISOString().substring(11,16); // HH:MM

  return {
    id: String(raw.id),
    league: raw.league ? raw.league.name : 'Unknown League',
    sport: raw.sport || 'football',
    startTime,
    status: raw.status_short || 'NS',
    homeTeam: { name: raw.teams.home },
    awayTeam: { name: raw.teams.away },
    score: raw.score ? { home: raw.score.home, away: raw.score.away } : null,
    odds: {
      home: homeOdds,
      draw: drawOdds,
      away: awayOdds
    },
    prediction: {
      homeWin: homeProb,
      draw: drawProb,
      awayWin: awayProb
    }
  };
}

app.get('/api/matches', async (req, res) => {
  const sport = req.query.sport || 'football';
  if (!API_KEY) {
    return res.status(500).json({ error: 'SPORTS_API_KEY not set on server' });
  }
  try {
    const url = `https://api.betting-api.com/1xbet/${sport}/line/all`;
    const response = await fetch(url, {
      headers: { authorization: API_KEY }
    });
    if (!response.ok) {
      const txt = await response.text();
      console.error('Betting API error:', response.status, txt);
      return res.status(500).json({ error: 'Betting API error', status: response.status });
    }
    const data = await response.json();
    const list = Array.isArray(data.data) ? data.data : [];
    const mapped = list.slice(0, 40).map(mapMatch); // limit a bit
    res.json({ sport, matches: mapped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('SportIQ app listening on port', PORT);
});
