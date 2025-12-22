// src/AppRoutes.tsx
import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/auth/Login";
import ForgotPassword from "../pages/auth/ForgotPassword";
import ResetPassword from "../pages/auth/ResetPassword";
import InvalidPage from "../pages/auth/InvalidPage";
import SignUp from "../pages/auth/Sign-Up";

import HomePage from "../pages/users/HomePage";
import ProtectedRoute from "./ProtectedRoute";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import Profile from "../pages/users/Profile";
import UsersList from "../pages/users/UsersList";
import UserCreate from "../pages/users/UserCreate";
import UserEdit from "../pages/users/UserEdit";

import CountryListPage from "../pages/countries/CountryListPage";
import StateListPage from "../pages/states/StateListPage";
import CityListPage from "../pages/cities/CityListPage";

import TaskListPage from "../components/tasks/TaskListPage";
import TaskFormPage from "../pages/task/TaskFormPage";

import SettingsPage from "../pages/settings/SettingsPage";

export default function AppRoutes() {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <Routes>
      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      {/* Forgot Password - support old & new paths */}
      <Route path="/forgotpassword" element={<ForgotPassword />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Reset Password - support lowercase & capital R (email link) */}
      <Route
        path="/resetpassword/:resetPasswordCode"
        element={<ResetPassword />}
      />
      <Route
        path="/ResetPassword/:resetPasswordCode"
        element={<ResetPassword />}
      />

      {/* Invalid link page - support both variants */}
      <Route path="/invalidpage" element={<InvalidPage />} />
      <Route path="/invalid" element={<InvalidPage />} />

      {/* Protected Routes */}
      <Route
        path="/home"
        element={
          <ProtectedRoute element={<Layout><HomePage /></Layout>} />
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute
            element={
              <Layout>
                <Profile
                  open={profileOpen}
                  onClose={() => setProfileOpen(false)}
                />
              </Layout>
            }
          />
        }
      />

      {/* Users - accessible to any authenticated user.
          (Server / UsersList will filter what each user can see.) */}
      <Route
        path="/users"
        element={
          <ProtectedRoute element={<Layout><UsersList /></Layout>} />
        }
      />

      <Route
        path="/users/create"
        element={
          <ProtectedRoute element={<Layout><UserCreate /></Layout>} />
        }
      />

      <Route
        path="/users/edit/:id"
        element={
          <ProtectedRoute element={<Layout><UserEdit /></Layout>} />
        }
      />

      {/* Country / State / City - accessible to any authenticated user */}
      <Route
        path="/countries"
        element={
          <ProtectedRoute element={<Layout><CountryListPage /></Layout>} />
        }
      />

      <Route
        path="/states"
        element={
          <ProtectedRoute element={<Layout><StateListPage /></Layout>} />
        }
      />

      <Route
        path="/cities"
        element={
          <ProtectedRoute element={<Layout><CityListPage /></Layout>} />
        }
      />

      {/* Tasks - accessible to any authenticated user */}
      <Route
        path="/tasks"
        element={
          <ProtectedRoute element={<Layout><TaskListPage /></Layout>} />
        }
      />

      <Route
        path="/tasks/create"
        element={
          <ProtectedRoute element={<Layout><TaskFormPage /></Layout>} />
        }
      />

      <Route
        path="/tasks/edit/:id"
        element={
          <ProtectedRoute element={<Layout><TaskFormPage /></Layout>} />
        }
      />

      <Route 
      path="/settings" 
      element={
        <ProtectedRoute element={<Layout><SettingsPage /></Layout>} />
      } />

      {/* 404 fallback — must be LAST route */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

/* ---------------------- Layout Wrapper ---------------------- */
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex h-full ">
    <Sidebar />
    <div className="flex-1 flex flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </div>
    </div>
  </div>
);
