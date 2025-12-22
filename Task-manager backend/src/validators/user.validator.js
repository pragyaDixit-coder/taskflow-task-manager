// src/validators/user.validator.js
// Simple validators for user registration

export const registerValidator = (req, res, next) => {
  const body = req.body || {};
  const errors = [];

  if (!body.FirstName || String(body.FirstName).trim().length < 1) {
    errors.push("FirstName is required");
  }
  if (!body.LastName || String(body.LastName).trim().length < 1) {
    errors.push("LastName is required");
  }

  const email = body.EmailID?.trim?.();
  if (!email) {
    errors.push("EmailID is required");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("EmailID is not valid");
  }

  const pwd = body.Password;
  if (!pwd || String(pwd).length < 6) {
    errors.push("Password must be at least 6 characters");
  }

  if (errors.length) {
    return res.status(400).json({ errors });
  }

  return next();
};

export default {
  registerValidator,
};
