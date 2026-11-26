import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sql } from "https://esm.sh/kysely@0.27.2";
import { db, CompiledQuery } from "../_shared/db.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication.ts";

// One merge implementation: the SQL function public.merge_contacts (supabase/schemas/02_functions.sql),
// covered by pgTAP. It also carries the MVP parent fields (country, timezone, phone_e164, whatsapp_opt_in).
async function mergeContacts(
  loserId: number,
  winnerId: number,
  userId: string,
) {
  try {
    return await db.transaction().execute(async (trx) => {
      // Enable RLS by switching to authenticated role and setting user context
      await trx.executeQuery(CompiledQuery.raw("SET LOCAL ROLE authenticated"));
      await trx.executeQuery(
        CompiledQuery.raw(
          `SELECT set_config('request.jwt.claim.sub', '${userId}', true)`,
        ),
      );

      await sql`SELECT public.merge_contacts(${loserId}::bigint, ${winnerId}::bigint)`.execute(
        trx,
      );

      return { success: true, winnerId };
    });
  } catch (error) {
    console.error("Transaction failed:", error);
    throw error;
  }
}

Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        // Handle POST request
        if (req.method === "POST") {
          try {
            const { loserId, winnerId } = await req.json();

            if (!loserId || !winnerId) {
              return createErrorResponse(400, "Missing loserId or winnerId");
            }

            const result = await mergeContacts(loserId, winnerId, user.id);

            return new Response(JSON.stringify(result), {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          } catch (error) {
            console.error("Merge failed:", error);
            return createErrorResponse(
              500,
              `Failed to merge contacts: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            );
          }
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
