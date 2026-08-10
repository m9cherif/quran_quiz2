import { createSlice } from "@reduxjs/toolkit";

/**
 * Auth slice: current user profile + session status.
 * Only the public profile is persisted — never tokens or JWTs
 * (Supabase keeps its own session storage for those).
 */
const initialState = {
  user: null,
  status: "checking", // "checking" | "authenticated" | "anonymous"
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
    },
    cleanUser: (state) => {
      state.user = null;
    },
    setAuthStatus: (state, action) => {
      state.status = action.payload;
    },
    updateUser: (state, action) => {
      state.user = state.user ? { ...state.user, ...action.payload } : action.payload;
    },
  },
});

export const { setUser, cleanUser, setAuthStatus, updateUser } = userSlice.actions;

export default userSlice.reducer;