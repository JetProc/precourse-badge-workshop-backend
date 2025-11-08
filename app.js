const express = require('express');
const mongoose = require('mongoose');
const app = express();
require('dotenv').config();

const authRouter = require('./routes/auth');
const dialogRouter = require('./routes/dialog');
const validationRouter = require('./routes/validation');

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/dialog', dialogRouter);
app.use('/api/validation', validationRouter);

app.get('/', (req, res) => {
  res.status(200).send('Hello, Woowacourse Badge Workshop Backend!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
