import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    Participant: {},
};

const participantSlice = createSlice({
    name: "participant",
    initialState,
    reducers: {
        setParticipant: (state, action) => {
            state.Participant = action.payload;
        },
        removeParticipant: (state) => {
            state.Participant = {};
        },
    },
});

export const { setParticipant, removeParticipant } = participantSlice.actions;

export default participantSlice.reducer;