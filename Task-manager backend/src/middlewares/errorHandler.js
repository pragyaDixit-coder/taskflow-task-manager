// src/middlewares/errorHandler.js

// Global error handler
// Hinglish: agar kahi bhi try/catch se error next(err) aaya
// to yaha aayega, aur hum JSON response bhejenge.

export const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    message: err.message || "Internal Server Error",
  });
};
