const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
require('dotenv').config();

const authRouter = require('./routes/auth');
const validationRouter = require('./routes/validation');
const workshopRouter = require('./routes/workshop');
const webRouter = require('./routes/web');

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use(
  cors({
    origin: 'http://localhost:5173/',
  })
);

app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/validation', validationRouter);
app.use('/api/workshop', workshopRouter);
app.use('/api/web', webRouter);

app.get('/', (req, res) => {
  res.status(200).send('Hello, Woowacourse Badge Workshop Backend!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
