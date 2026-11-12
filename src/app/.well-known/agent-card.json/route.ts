export function GET(request: Request) {
  return Response.json({
    name: "Glimpsea",
    description: "Research printable and physical wall art ideas for Etsy sellers. This endpoint uses simulated payments.",
    version: "0.1.0",
    supportedInterfaces: [{
      url: new URL("/a2a/v1", request.url).href,
      protocolBinding: "JSONRPC",
      protocolVersion: "1.0",
    }],
    capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["text/markdown"],
    skills: [{
      id: "etsy-wall-art-research",
      name: "Etsy wall art research",
      description: "Send a country code, an audience, a format, and a production time limit.",
      tags: ["research", "wall art", "etsy"],
    }],
  });
}
