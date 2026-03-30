import type { Page, Route } from "@playwright/test";

type CartItem = { id: number; name: string; price: number; description: string };

export type MobileMockState = {
  deleteCalls: number;
  downloadCalls: number;
  addToCartCalls: number;
  submitOrderCalls: number;
};

const FILE_FIXTURES = [
  {
    id: 101,
    fileId: 101,
    name: "demo-report.pdf",
    fileName: "Demo Report.pdf",
    fileSize: "242 KB",
    contentType: "application/pdf",
  },
  {
    id: 102,
    fileId: 102,
    name: "avatar.png",
    fileName: "Avatar.png",
    fileSize: "98 KB",
    contentType: "image/png",
  },
];

const NOTE_FIXTURES = [
  {
    id: 201,
    title: "Release checklist",
    description: "Confirm mobile workspace and shop flows before shipping.",
  },
  {
    id: 202,
    title: "Regression notes",
    description: "Validate shell nav tap targets and combined workspace layout.",
  },
];

const SHOP_ITEMS: CartItem[] = [
  { id: 1, name: "Starter Kit", price: 19.99, description: "Portable starter bundle" },
  { id: 2, name: "Pro Pack", price: 49.5, description: "Extended accessory pack" },
];

const CHAT_ROOM = {
  name: "Mobile E2E Room",
  code: "MOBILE_E2E",
  createdBy: "mobile_tester",
};

function json(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
}

export async function prepareMobilePage(page: Page, width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
}

export async function stubMobileApis(page: Page): Promise<MobileMockState> {
  const state: MobileMockState = {
    deleteCalls: 0,
    downloadCalls: 0,
    addToCartCalls: 0,
    submitOrderCalls: 0,
  };

  let cartItems: CartItem[] = [];
  let orderHistory: Array<{
    id: number;
    items: CartItem[];
    total: number;
    date: string;
  }> = [];
  let notes = [...NOTE_FIXTURES];

  await page.route(/\/api\/remotes\/status$/, async (route) =>
    json(route, {
      checkedAt: "2026-01-01T12:00:00.000Z",
      remotes: {
        openmaps: { enabled: true, available: true },
        chatllm: { enabled: false, available: null },
        jira: { enabled: false, available: null },
        mlops: { enabled: false, available: null },
        petstore: { enabled: false, available: null },
      },
    })
  );

  await page.route(/\/cloudapp\//, async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/cloudapp/user/auth-check") && method === "GET") {
      return json(route, { username: "mobile_tester", roles: ["ROLE_USER"] });
    }

    if (path.endsWith("/cloudapp/user/csrf-token") && method === "GET") {
      return json(route, { token: "mobile-csrf-token" });
    }

    if (/\/cloudapp\/file\/user\/[^/]+$/.test(path) && method === "GET") {
      return json(route, FILE_FIXTURES);
    }

    if (/\/cloudapp\/note\/user\/[^/]+$/.test(path) && method === "GET") {
      return json(route, notes);
    }

    if (path.endsWith("/cloudapp/note/addNote") && method === "POST") {
      const body = request.postDataJSON() as { title?: string; description?: string } | null;
      const nextNote = {
        id: notes.length + 300,
        title: body?.title || "Untitled note",
        description: body?.description || "",
      };
      notes = [nextNote, ...notes];
      return json(route, nextNote);
    }

    if (path.endsWith("/cloudapp/note/updateNote") && method === "POST") {
      const body = request.postDataJSON() as { id?: number; title?: string; description?: string } | null;
      notes = notes.map((note) =>
        note.id === body?.id
          ? {
              ...note,
              title: body?.title || note.title,
              description: body?.description || note.description,
            }
          : note
      );
      return json(route, { success: true });
    }

    if (/\/cloudapp\/note\/delete\/\d+$/.test(path) && method === "DELETE") {
      const noteId = Number(path.split("/").pop());
      notes = notes.filter((note) => note.id !== noteId);
      return json(route, { success: true });
    }

    if (/\/cloudapp\/file\/delete-file\/\d+$/.test(path) && method === "DELETE") {
      state.deleteCalls += 1;
      return json(route, { success: true });
    }

    if (/\/cloudapp\/file\/get-file\/\d+$/.test(path) && method === "GET") {
      state.downloadCalls += 1;
      return route.fulfill({
        status: 200,
        headers: {
          "content-type": "application/octet-stream",
          "content-disposition": "attachment; filename=demo.txt",
        },
        body: Buffer.from("mobile-download-fixture"),
      });
    }

    if (path.endsWith("/cloudapp/item") && method === "GET") {
      return json(route, SHOP_ITEMS);
    }

    if (path.endsWith("/cloudapp/cart/getCart") && method === "POST") {
      const total = cartItems.reduce((sum, item) => sum + item.price, 0);
      return json(route, { id: 1, items: cartItems, total: Number(total.toFixed(2)) });
    }

    if (path.endsWith("/cloudapp/cart/addToCart") && method === "POST") {
      state.addToCartCalls += 1;
      const body = request.postDataJSON() as { itemId?: number } | null;
      const selected = SHOP_ITEMS.find((item) => item.id === body?.itemId) || SHOP_ITEMS[0];
      cartItems = [...cartItems, selected];
      const total = cartItems.reduce((sum, item) => sum + item.price, 0);
      return json(route, { id: 1, items: cartItems, total: Number(total.toFixed(2)) });
    }

    if (path.endsWith("/cloudapp/cart/clearCart") && method === "POST") {
      cartItems = [];
      return json(route, { id: 1, items: [], total: 0 });
    }

    if (/\/cloudapp\/order\/submit\/[^/]+$/.test(path) && method === "POST") {
      state.submitOrderCalls += 1;
      const total = cartItems.reduce((sum, item) => sum + item.price, 0);
      if (cartItems.length > 0) {
        orderHistory = [
          {
            id: orderHistory.length + 1,
            items: cartItems,
            total: Number(total.toFixed(2)),
            date: "2026-01-01T12:00:00.000Z",
          },
          ...orderHistory,
        ];
      }
      cartItems = [];
      return json(route, { success: true });
    }

    if (/\/cloudapp\/order\/history\/[^/]+$/.test(path) && method === "GET") {
      return json(route, orderHistory);
    }

    if (path.endsWith("/cloudapp/room") && method === "GET") {
      return json(route, { err_code: 0, err_msg: "", data: [CHAT_ROOM] });
    }

    if (path.endsWith("/cloudapp/room") && method === "POST") {
      return json(route, { err_code: 0, err_msg: "", data: CHAT_ROOM });
    }

    if (/\/cloudapp\/room\/[^/]+$/.test(path) && method === "GET") {
      return json(route, { err_code: 0, err_msg: "", data: CHAT_ROOM });
    }

    return json(route, {});
  });

  return state;
}

export async function gotoRouteAndSettle(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
}
