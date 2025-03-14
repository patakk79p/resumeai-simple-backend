const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Mongoose 6+ doesn't need these options anymore
      // They're included here for compatibility with older versions
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline.bold);
    return conn;
  } catch (err) {
    console.error(`Error connecting to MongoDB: ${err.message}`.red);
    throw err;
  }
};

module.exports = connectDB; 