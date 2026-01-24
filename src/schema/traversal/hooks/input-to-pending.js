// fixme - will likely need to deal with assignedInput more intelligently at some point
export async function inputToPending(state) {
  state.input = state.assignedInput;
  state.pending = state.input;
}