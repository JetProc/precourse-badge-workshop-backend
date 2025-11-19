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

// CORS 설정 - 동적 오리진 처리
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://13.211.169.114:5173',
  'http://13.211.169.114',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // origin이 없거나 허용 목록에 있으면 통과
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS rejected origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
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
