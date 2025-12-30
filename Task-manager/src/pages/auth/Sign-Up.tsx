// src/pages/signup/Signup.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  TextField,
  Button,
  Card,
  Typography,
  MenuItem,
  IconButton,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material";
import { Visibility, VisibilityOff, LocationCity } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { validateEmail, validatePassword } from "../../utils/validators";
import { registerUserApi } from "../../api/authApi"; // unchanged
import TaskFlowLogo from "../../assets/taskflow-logo.png";
import storage, {
  login as storageLogin,
  fetchCurrentUserFromServer,
} from "../../utils/storage";

interface Country {
  id: number;
  name: string;
}
interface StateType {
  id: number;
  name: string;
  countryId: number;
}
interface City {
  id: number;
  name: string;
  stateId: number;
}

const Signup: React.FC = () => {
  const navigate = useNavigate();

  // form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState<number>(0);
  const [state, setState] = useState<number>(0);
  const [city, setCity] = useState<number>(0);
  const [zip, setZip] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // top-level server message (e.g., generic duplicate)
  const [formError, setFormError] = useState<string | null>(null);

  // Dummy dynamic data (simulate fetched data)
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<StateType[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  // refs for focusing first invalid
  const refs: Record<string, React.RefObject<HTMLInputElement>> = {
    firstName: useRef<HTMLInputElement | null>(null),
    lastName: useRef<HTMLInputElement | null>(null),
    email: useRef<HTMLInputElement | null>(null),
    password: useRef<HTMLInputElement | null>(null),
    confirmPassword: useRef<HTMLInputElement | null>(null),
    address: useRef<HTMLInputElement | null>(null),
    zip: useRef<HTMLInputElement | null>(null),
  };

  useEffect(() => {
    const countryData: Country[] = [
      { id: 1, name: "India" },
      { id: 2, name: "United States" },
      { id: 3, name: "Germany" },
    ];

    const stateData: StateType[] = [
      { id: 1, name: "Madhya Pradesh", countryId: 1 },
      { id: 2, name: "Maharashtra", countryId: 1 },
      { id: 3, name: "California", countryId: 2 },
      { id: 4, name: "New York", countryId: 2 },
      { id: 5, name: "Berlin", countryId: 3 },
    ];

    const cityData: City[] = [
      { id: 1, name: "Indore", stateId: 1 },
      { id: 2, name: "Bhopal", stateId: 1 },
      { id: 3, name: "Mumbai", stateId: 2 },
      { id: 4, name: "Pune", stateId: 2 },
      { id: 5, name: "Los Angeles", stateId: 3 },
      { id: 6, name: "San Francisco", stateId: 3 },
      { id: 7, name: "New York City", stateId: 4 },
      { id: 8, name: "Berlin City", stateId: 5 },
    ];

    setCountries(countryData);
    setStates(stateData);
    setCities(cityData);
  }, []);

  const filteredStates = states.filter((s) => s.countryId === country);
  const filteredCities = cities.filter((c) => c.stateId === state);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!firstName.trim()) newErrors.firstName = "First name is required";
    if (!lastName.trim()) newErrors.lastName = "Last name is required";
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!validateEmail(email)) newErrors.email = "Enter a valid email";
    if (!password) newErrors.password = "Password is required";
    else if (!validatePassword(password))
      newErrors.password =
        "Password must be 8–18 chars, 1 uppercase, 1 number, 1 special char";
    if (confirmPassword !== password)
      newErrors.confirmPassword = "Passwords do not match";

    if (address.trim()) {
      if (!country)
        newErrors.country = "Country is required when address is provided";
      if (country && !state)
        newErrors.state = "State is required when address is provided";
      if (state && !city)
        newErrors.city = "City is required when address is provided";
    }
    /* ✅ ZIP CODE VALIDATION */
    if (zip && zip.length !== 6) {
      newErrors.zip = "ZIP code must be exactly 6 characters";
    }

    setErrors(newErrors);

    // focus first invalid field (if any)
    const keysOrder = [
      "firstName",
      "lastName",
      "email",
      "password",
      "confirmPassword",
      "country",
      "state",
      "city",
      "address",
      "ZipCode",
    ];
    for (const k of keysOrder) {
      if (newErrors[k]) {
        const ref = refs[k];
        if (ref && ref.current) {
          try {
            ref.current.focus();
          } catch (e) {
            /* ignore */
          }
        }
        break;
      }
    }

    return Object.keys(newErrors).length === 0;
  };

  const parseServerError = (err: any): { field?: string; message: string } => {
    const fallback = { message: "Registration failed. Please try again." };
    if (!err) return fallback as any;

    // Prefer parsed body if present (our http wrapper sets err.body)
    const body = err.body ?? err.response ?? err.data ?? null;

    // If backend explicitly supplied a field, use it
    if (body && typeof body === "object" && body.field && body.message) {
      return { field: body.field, message: body.message };
    }

    // Mongoose duplicate shape via earlier parsing
    if (
      body &&
      typeof body === "object" &&
      body.errorResponse &&
      body.errorResponse.code === 11000
    ) {
      const kp = body.errorResponse.keyPattern || {};
      const keys = Object.keys(kp).join("|").toLowerCase();
      if (keys.includes("countryid") && keys.includes("namelower")) {
        return {
          field: "state",
          message: "State already exists for the selected country.",
        };
      }
      if (keys.includes("stateid") && keys.includes("namelower")) {
        return {
          field: "city",
          message: "City already exists for the selected state.",
        };
      }
      // fallback
      return { message: "Duplicate record exists." };
    }

    // if body.message exists
    if (body && typeof body === "object" && body.message) {
      const msg = String(body.message);
      if (msg.toLowerCase().includes("email"))
        return { field: "email", message: msg };
      return { message: msg };
    }

    // if body is string
    if (typeof body === "string") {
      return { message: body };
    }

    // fallback to err.message
    if (err.message && typeof err.message === "string") {
      if (
        err.message.includes("E11000") ||
        err.message.toLowerCase().includes("duplicate key")
      ) {
        return {
          message:
            "Duplicate entry detected on server. Please check your input.",
        };
      }
      if (err.message.toLowerCase().includes("email")) {
        return { field: "email", message: err.message };
      }
      return { message: err.message };
    }

    return fallback as any;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    setErrors({});
    if (!validateForm()) return;

    const selectedCountry = countries.find((c) => c.id === country);
    const selectedState = states.find((s) => s.id === state);
    const selectedCity = cities.find((c) => c.id === city);

    const CountryName = selectedCountry?.name || "";
    const StateName = selectedState?.name || "";
    const CityName = selectedCity?.name || "";

    // prepare zipCodes array: if user entered comma-separated list, split it
    setSubmitting(true);
    try {
      // Build a payload as a flexible record so TypeScript won't complain about unknown keys
      const payload: Record<string, any> = {
        FirstName: firstName,
        LastName: lastName,
        EmailID: email,
        Password: password,
        ConfirmPassword: confirmPassword,
        Address: address,
        // 🔥 NAMES (backend validation ke liye REQUIRED)
  CountryName: CountryName || null,
  StateName: StateName || null,
  CityName: CityName || null,
        ZipCode: zip || null, // <-- included here as array
        CountryID: country || null,
        StateID: state || null,
        CityID: city || null,
      };
    
      // 🔍 DEBUG: check what is actually going to backend
  console.log("SIGNUP PAYLOAD 👉", payload);
      // send the payload (registerUserApi likely expects a specific type, so using Record<string, any> avoids TS error)
      await registerUserApi(payload);

      // Redirect to login after successful signup
      navigate("/login");
      return;
    } catch (err: any) {
      // Debug logs - useful during development
      // eslint-disable-next-line no-console
      console.error(
        "Signup error:",
        err?.status ?? "(no-status)",
        err?.body ?? err
      );

      const parsed = parseServerError(err);

      // If backend returned explicit field
      if (parsed.field === "email") {
        setErrors((p) => ({ ...p, email: parsed.message }));
      } else if (parsed.field === "state") {
        setErrors((p) => ({ ...p, state: parsed.message }));
      } else if (parsed.field === "city") {
        setErrors((p) => ({ ...p, city: parsed.message }));
      } else if (typeof parsed.message === "string") {
        // if message refers to email, map to email field else set top-level form error
        const msgLower = parsed.message.toLowerCase();
        if (msgLower.includes("email")) {
          setErrors((p) => ({ ...p, email: parsed.message }));
        } else {
          setFormError(parsed.message);
        }
      } else {
        setFormError("Registration failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center"> 
      <Card
        className="w-[525px] rounded-2xl p-8 flex flex-col items-center"
        elevation={0}
        sx={{
          backgroundColor: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(100px)",
          WebkitBackdropFilter: "blur(100px)",
          boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
        }}
      >
        <div className="w-25 h-25 rounded-lg flex items-center justify-center ">
          <img
            src={TaskFlowLogo}
            alt="TaskFlow Logo"
            className="w-full h-full object-contain"
          />
        </div>

        <Typography variant="h5" className="font-bold text-gray-800">
          Create your account
        </Typography>
        <Typography variant="body2" className="text-gray-500 mb-2 pb-2">
          Sign up to start managing tasks with your team
        </Typography>

        {/* Top-level server message */}
        {formError && (
          <div className="w-full mb-2 text-sm text-red-700 bg-red-50 p-2 rounded">
            {formError}
          </div>
        )}

        <form
          onSubmit={handleSignup}
          className="w-full flex flex-col gap-2 items-center"
        >
          <div className="flex gap-2 w-full">
            <TextField
              label="First Name *"
              name="firstName"
              size="small"
              fullWidth
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              error={!!errors.firstName}
              helperText={errors.firstName}
              inputRef={refs.firstName}
            />
            <TextField
              label="Last Name *"
              name="lastName"
              size="small"
              fullWidth
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              error={!!errors.lastName}
              helperText={errors.lastName}
              inputRef={refs.lastName}
            />
          </div>

          <TextField
            label="Email Address *"
            name="email"
            type="email"
            size="small"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={!!errors.email}
            helperText={errors.email}
            inputRef={refs.email}
          />

          <TextField
            label="Address"
            name="address"
            size="small"
            fullWidth
            multiline
            maxRows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            inputRef={refs.address}
          />

          <TextField
            select
            label="Country"
            name="country"
            size="small"
            fullWidth
            value={country}
            onChange={(e) => {
              const val = Number(e.target.value);
              setCountry(val);
              setState(0);
              setCity(0);
            }}
            error={!!errors.country}
            helperText={errors.country}
          >
            <MenuItem value={0}>Select Country</MenuItem>
            {countries.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>

          <div className="flex gap-2 w-full">
            <TextField
              select
              label="State"
              name="state"
              size="small"
              fullWidth
              value={state}
              onChange={(e) => {
                const val = Number(e.target.value);
                setState(val);
                setCity(0);
              }}
              disabled={!country}
              error={!!errors.state}
              helperText={errors.state}
            >
              <MenuItem value={0}>Select State</MenuItem>
              {filteredStates.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="City"
              name="city"
              size="small"
              fullWidth
              value={city}
              onChange={(e) => setCity(Number(e.target.value))}
              disabled={!state}
              error={!!errors.city}
              helperText={errors.city}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LocationCity fontSize="small" />
                  </InputAdornment>
                ),
              }}
            >
              <MenuItem value={0}>Select City</MenuItem>
              {filteredCities.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          </div>

          <TextField
            label="ZIP Code"
            size="small"
            name="zip"
            fullWidth
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} // only numbers
            error={!!errors.zip}
            helperText={errors.zip}
            inputRef={refs.zip}
            inputProps={{ maxLength: 6 }}
          />

          <TextField
            label="Password *"
            name="signup_password"
            type={showPwd ? "text" : "password"}
            autoComplete="off"
            size="small"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={!!errors.password}
            helperText={errors.password}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPwd(!showPwd)} size="small">
                    {showPwd ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            inputProps={{
              autoComplete: "off",
              "data-form-type": "other",
              "data-lpignore": "true",
            }}
            inputRef={refs.password}
          />

          <TextField
            label="Confirm Password *"
            name="signup_confirm_password"
            type={showConfirm ? "text" : "password"}
            autoComplete="off"
            size="small"
            fullWidth
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowConfirm(!showConfirm)}
                    size="small"
                  >
                    {showConfirm ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            inputProps={{
              autoComplete: "off",
              "data-form-type": "other",
              "data-lpignore": "true",
            }}
            inputRef={refs.confirmPassword}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={submitting}
            sx={{
              mt: 1,
              background: "linear-gradient(90deg, #007bff 0%, #0a54c3 100%)",
              "&:hover": {
                background: "linear-gradient(90deg, #007bff 0%, #0849ab 100%)",
              },
              borderRadius: "8px",
              textTransform: "none",
              py: 1.2,
              fontWeight: 600,
            }}
            
          >
            {submitting ? "Creating..." : "Create Account"}
          </Button>
        </form>

        <Typography
          variant="body2"
          className="text-[#0a54c3] mt-2 pt-4 cursor-pointer hover:underline"
          onClick={() => navigate("/login")}
        >
          ← Back to Login
        </Typography>
      </Card>

      <Dialog open={openModal} onClose={() => setOpenModal(false)}>
        <DialogTitle className="text-center font-semibold h-24 w-100 flex items-center justify-center">
          Signup Successful 🎉
        </DialogTitle>
        <DialogContent className="text-center">
          <Button
            onClick={() => navigate("/login")}
            variant="contained"
            sx={{
              mt: 2,
              background: "linear-gradient(90deg, #007bff 0%, #0a54c3 100%)",
              "&:hover": {
                background: "linear-gradient(90deg, #007bff 0%, #0849ab 100%)",
              },
              textTransform: "none",
            }}
          >
            Go to Login Now
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Signup;
