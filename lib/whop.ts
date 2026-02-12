import Whop from "@whop/sdk";

if (!process.env.WHOP_API_KEY) {
  console.warn("Warning: WHOP_API_KEY is not set. Whop API calls will fail.");
}

if (!process.env.WHOP_COMPANY_ID) {
  console.warn("Warning: WHOP_COMPANY_ID is not set.");
}

export const whopClient = new Whop({
  apiKey: process.env.WHOP_API_KEY || "",
});

export const COMPANY_ID = process.env.WHOP_COMPANY_ID || "";
