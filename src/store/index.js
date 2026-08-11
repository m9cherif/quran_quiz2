import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";
import userReducer from "./Slices/userSlice";
import roomReducer from "./Slices/roomSlice";
import participantReducer from "./Slices/participantSlice";
import leaderBoardReducer from "./Slices/leaderBoardSlice";

const persistConfig = {
    key: "root",
    storage,
    // Never boot from a persisted user profile/status: the role must be
    // re-fetched from the DB on every load (stale persisted roles caused
    // wrongful "access restricted" redirects). Session tokens live in
    // Supabase's own storage, so this is purely a UI-state refresh.
    blacklist: ["user"],
};

const rootReducer = combineReducers({
    user: userReducer,
    room_key: roomReducer,
    participant: participantReducer,
    leaderBoard: leaderBoardReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: false,
    }),
});

export const persistor = persistStore(store);
