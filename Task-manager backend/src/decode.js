// decode.js
const jwt = require("jsonwebtoken");

// paste the token string below (cookie or header — they are same)
const token = "PASTE_THE_FULL_TOKEN_HERE";

const decoded = jwt.decode(token, { complete: true });
console.log("decoded:", decoded);
if (decoded && decoded.payload) {
  const iat = decoded.payload.iat;
  const exp = decoded.payload.exp;
  console.log("iat (unix):", iat, " ->", new Date(iat * 1000).toISOString());
  console.log("exp (unix):", exp, " ->", new Date(exp * 1000).toISOString());
}
