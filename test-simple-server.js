// test-simple-server.js
import express from 'express';

const app = express();
const port = 3001;

app.use(express.json());

app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

app.listen(port, () => {
  console.log(`Simple test server running on port ${port}`);
}).on('error', (err) => {
  console.error('Server start error:', err);
});
