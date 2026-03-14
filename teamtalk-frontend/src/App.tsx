import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from '@/store';
import { AppRoutes } from '@/routes';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { fetchCurrentUser } from '@/store/slices/authSlice';

// Restores user session on page refresh when token exists but user is null
const AuthBootstrap: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  useEffect(() => {
    if (isAuthenticated && !user) {
      dispatch(fetchCurrentUser());
    }
  }, [isAuthenticated, user, dispatch]);
  return null;
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthBootstrap />
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '13px',
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            },
          }}
        />
      </BrowserRouter>
    </Provider>
  );
};

export default App;
