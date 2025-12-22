// src/utils/password.js
// Password hashing + verification helper
// Hinglish: frontend se plain password aayega, hum yaha securely hash karke DB me store / compare karenge.

import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

export const hashPassword = async (plainPassword) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hashed = await bcrypt.hash(plainPassword, salt);
  return hashed;
};

export const verifyPassword = async (plainPassword, hashedPassword) => {
  // bcrypt.compare automatically hashing + compare karega
  return bcrypt.compare(plainPassword, hashedPassword);
};
