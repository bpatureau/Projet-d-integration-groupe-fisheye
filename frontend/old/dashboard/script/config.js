const Config = {
  API_BASE_URL: "https://pi.linadu.live/api",
  WS_BASE_URL: "wss://pi.linadu.live/api/ws",

  // Pagination
  DEFAULT_PAGE_SIZE: 20,

  // Intervals
  AUTO_REFRESH_INTERVAL: 30000, // 30 seconds

  // Storage Keys
  STORAGE_KEYS: {
    AUTH_TOKEN: "authToken",
    USER: "user",
    TOKEN_EXPIRY: "tokenExpiry",
  },
};

// Allow override from environment
// if (
//   window.location.hostname === "localhost" ||
//   window.location.hostname === "127.0.0.1"
// ) {
//   Config.API_BASE_URL = "http://localhost:8080/api";
//   Config.WS_BASE_URL = "ws://localhost:8080/api/ws";
// }
