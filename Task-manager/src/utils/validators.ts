// Email Validation (regex)
export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Password Validation (min 8 chars, 1 uppercase, 1 number, 1 special char)
export const validatePassword = (password: string): boolean => {
  const re = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,18}$/;
  return re.test(password);
};
