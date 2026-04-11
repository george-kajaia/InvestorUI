export const environment = {
  // Local development
  //apiBaseUrl: 'https://localhost:7044/api',
  //signalRHubUrl: 'https://localhost:7044/hubs/redemption'

  // Production — API and SignalR hub on same domain
  apiBaseUrl: 'https://service-tokens.com/api',
  signalRHubUrl: 'https://service-tokens.com/hubs/redemption',

  // Number of featured tokens shown on the home page (between hero and "How It Works")
  homeFeaturedLimit: 20
};
