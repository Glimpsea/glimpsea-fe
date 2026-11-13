export function GET(request: Request) {
  return Response.json({
    name: "Glimpsea",
    description: "Compare digital, print-on-demand, and personalized product ideas for Etsy sellers. This endpoint uses simulated payments.",
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
      id: "etsy-product-research",
      name: "Etsy product research",
      description: "Send a country code, an audience, and a production time limit. Omit category to compare all three.",
      tags: ["research", "product discovery", "etsy"],
    }],
  });
}
