import Whop from "@whop/sdk";
import { demoWhopClient, DEMO_COMPANY_ID } from "@/lib/demo/whop-client";

const DEMO_MODE = process.env.DEMO_MODE === "true";

if (DEMO_MODE) {
  process.env.WHOP_API_KEY = process.env.WHOP_API_KEY || "demo_key";
  process.env.WHOP_COMPANY_ID = process.env.WHOP_COMPANY_ID || "biz_demo";
}

if (!process.env.WHOP_API_KEY) {
  console.warn("Warning: WHOP_API_KEY is not set. Whop API calls will fail.");
}

if (!process.env.WHOP_COMPANY_ID) {
  console.warn("Warning: WHOP_COMPANY_ID is not set.");
}

export const whopClient = DEMO_MODE
  ? (demoWhopClient as unknown as Whop)
  : new Whop({ apiKey: process.env.WHOP_API_KEY || "" });

export const COMPANY_ID = DEMO_MODE
  ? DEMO_COMPANY_ID
  : (process.env.WHOP_COMPANY_ID || "");
