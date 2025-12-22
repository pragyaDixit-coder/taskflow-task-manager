// src/server.js

import dotenv from "dotenv";
dotenv.config(); // .env file load karna

import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Pehle DB connect karo
  await connectDB();

  // Fir server start karo
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
     
  });

 
};

startServer();
