import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { buildSiweMessage, issueNonce } from "@/lib/siwe.server";

const Body = z.object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) });

export const Route = createFileRoute("/api/public/siwe/nonce")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = Body.parse(await request.json());
          const nonce = await issueNonce(body.address);
          const host = new URL(request.url).host;
          const message = buildSiweMessage(body.address, nonce, host);
          return Response.json({ nonce, message });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Bad request";
          return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});
