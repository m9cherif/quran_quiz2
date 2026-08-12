import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";
import userReducer from "./Slices/userSlice";
import participantReducer from "./Slices/participantSlice";

const persistConfig = {
    key: "root",
    storage,
    // Never boot from a persisted user profile/status: the role must be
    // re-fetched from the DB on every load (stale persisted roles caused
    // wrongful "access restricted" redirects). Session tokens live in
    // Supabase's own storage, so this is purely a UI-state refresh.
    // Only the anonymous player identity survives a reload.
    whitelist: ["participant"],
};

const rootReducer = combineReducers({
    user: userReducer,
    participant: participantReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: false,
    }),
});

export const persistor = persistStore(store);
