import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userEmail, displayName } = await req.json();

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Send email via Supabase
    const { error } = await supabaseClient.auth.admin.sendRawEmail({
      to: userEmail,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
              .content { line-height: 1.6; color: #374151; }
              .footer { margin-top: 30px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; }
              .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; color: #111827;">Family Budget Calculator</h1>
              </div>
              
              <div class="content">
                <p>Hi ${displayName || "there"},</p>
                
                <p>You or someone logged into your Family Budget Calculator account.</p>
                
                <div class="warning">
                  <strong>⚠️ Security Notice:</strong><br>
                  If you did not log in, please change your password immediately by going to the password reset page.
                </div>
                
                <p><strong>Login Details:</strong></p>
                <ul>
                  <li><strong>Email:</strong> ${userEmail}</li>
                  <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
                </ul>
                
                <p>If you don't recognize this activity, please:</p>
                <ol>
                  <li>Change your password immediately</li>
                  <li>Contact us if you need further assistance</li>
                </ol>
                
                <p>Stay safe,<br>The Family Budget Calculator Team</p>
              </div>
              
              <div class="footer">
                <p>This is an automated security notification. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
