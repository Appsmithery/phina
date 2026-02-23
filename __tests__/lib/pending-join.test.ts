/**
 * Do NOT import expo-secure-store here — it pulls in native modules and breaks in CI.
 * Mock it below and use require() inside tests for assertions.
 */
import { setPendingJoinEventId, getPendingJoinEventId, clearPendingJoinEventId } from "@/lib/pending-join";

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

describe("pending-join", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("setPendingJoinEventId calls SecureStore.setItemAsync", async () => {
    await setPendingJoinEventId("evt-123");
    const SecureStore = require("expo-secure-store");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("phina_pending_join", "evt-123");
  });

  it("getPendingJoinEventId calls SecureStore.getItemAsync and returns value", async () => {
    const SecureStore = require("expo-secure-store");
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce("evt-456");
    const result = await getPendingJoinEventId();
    expect(result).toBe("evt-456");
  });

  it("clearPendingJoinEventId calls SecureStore.deleteItemAsync", async () => {
    await clearPendingJoinEventId();
    const SecureStore = require("expo-secure-store");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("phina_pending_join");
  });
});
