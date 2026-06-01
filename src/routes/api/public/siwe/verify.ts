import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifySiweAndIssueJwt } from "@/lib/siwe.server";

const Body = z.object({
  message: z.string().min(20).max(2000),
  signature: z.string().min(20).max(400),
});

export const Route = createFileRoute("/api/public/siwe/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = Body.parse(await request.json());
          const { jwt, wallet, exp } = await verifySiweAndIssueJwt(body.message, body.signature);
          return Response.json({ jwt, wallet, exp });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Verification failed";
          return new Response(JSON.stringify({ error: msg }), { status: 401, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});
