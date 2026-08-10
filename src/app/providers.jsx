"use client";

import { Provider } from "react-redux";
import { persistor, store } from "@/store/index";
import { PersistGate } from "redux-persist/integration/react";
import ToastProvider from "@/components/ui/Toast";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import AuthProvider from "@/components/auth/AuthProvider";

export default function Providers({ children }) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AuthProvider>
          <ErrorBoundary>
            <ToastProvider>{children}</ToastProvider>
          </ErrorBoundary>
        </AuthProvider>
      </PersistGate>
    </Provider>
  );
}