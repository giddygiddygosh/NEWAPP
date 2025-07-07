import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    // You can show a loading spinner here while checking auth state
    return <div>Loading...</div>;
  }

  if (!user) {
    // If user is not logged in, redirect to the login page
    return <Navigate to="/login" />;
  }

  // If user is logged in, show the requested page
  return children;
};

export default ProtectedRoute;
