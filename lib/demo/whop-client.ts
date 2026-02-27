/**
 * Mock Whop SDK client for demo mode.
 *
 * Replaces the real @whop/sdk client when DEMO_MODE=true so the app can run
 * without a Whop API key. Implements the three SDK methods used across the
 * codebase: plans.create, products.list, and webhooks.create.
 */

export const DEMO_COMPANY_ID = "biz_demo";

// ---------------------------------------------------------------------------
// Counter for generating unique plan IDs
// ---------------------------------------------------------------------------

let _planCounter = 0;

// ---------------------------------------------------------------------------
// Mock products (returned by products.list)
// ---------------------------------------------------------------------------

const DEMO_PRODUCTS = [
  {
    id: "prod_demo_1",
    title: "Coaching Program",
    description: "1-on-1 coaching sessions",
  },
  {
    id: "prod_demo_2",
    title: "Premium Mentorship",
    description: "Premium mentorship package",
  },
  {
    id: "prod_demo_3",
    title: "VIP Mastermind",
    description: "Exclusive VIP mastermind group",
  },
];

// ---------------------------------------------------------------------------
// Mock Whop client
// ---------------------------------------------------------------------------

export const demoWhopClient = {
  plans: {
    create(params: Record<string, unknown>) {
      _planCounter += 1;
      const id = `plan_demo_${Date.now()}_${_planCounter}`;
      return Promise.resolve({
        id,
        purchase_url: `https://whop.com/checkout/demo-${id}/`,
        ...params,
      });
    },
  },

  products: {
    list(_params?: Record<string, unknown>) {
      // The real Whop SDK returns an async iterable (used with `for await...of`)
      const items = [...DEMO_PRODUCTS];
      let index = 0;

      const asyncIterable: AsyncIterable<(typeof DEMO_PRODUCTS)[number]> = {
        [Symbol.asyncIterator]() {
          return {
            next() {
              if (index < items.length) {
                const value = items[index];
                index += 1;
                return Promise.resolve({ value, done: false as const });
              }
              return Promise.resolve({
                value: undefined as unknown as (typeof DEMO_PRODUCTS)[number],
                done: true as const,
              });
            },
          };
        },
      };

      return asyncIterable;
    },
  },

  webhooks: {
    create(params: Record<string, unknown>) {
      return Promise.resolve({
        id: "wh_demo_1",
        webhook_secret: "demo_webhook_secret",
        ...params,
      });
    },
  },
};
