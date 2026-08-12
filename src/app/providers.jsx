"use client";

import { Provider } from "react-redux";
import { persistor, store } from "@/store/index";
import { PersistGate } from "redux-persist/integration/react";
import ToastProvider from "@/components/ui/Toast";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import AuthProvider from "@/components/auth/AuthProvider";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

export default function Providers({ children }) {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <I18nProvider>
          <PersistGate loading={null} persistor={persistor}>
            <AuthProvider>
              <ErrorBoundary>
                <ToastProvider>{children}</ToastProvider>
              </ErrorBoundary>
            </AuthProvider>
          </PersistGate>
        </I18nProvider>
      </ThemeProvider>
    </Provider>
  );
}
