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
    const { email, redirectUrl } = await req.json();

    if (!email || !redirectUrl) {
      return new Response(
        JSON.stringify({ error: "Missing email or redirectUrl" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Resend API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase admin client to generate reset link
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Generate password reset link
    const { data, error: linkError } = await supabaseClient.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (linkError || !data) {
      return new Response(
        JSON.stringify({ error: linkError?.message || "Failed to generate reset link" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resetLink = data.properties?.action_link || redirectUrl;

    // Send email via Resend REST API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "noreply@resend.dev",
        to: email,
        subject: "Reset Your Password",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
                .content { line-height: 1.6; color: #374151; }
                .button { display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; }
                .footer { margin-top: 30px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; }
                .warning { background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0; color: #111827;">Family Budget Calculator</h1>
                </div>

                <div class="content">
                  <p>Hi,</p>

                  <p>We received a request to reset your password. Click the button below to set a new password:</p>

                  <a href="${resetLink}" class="button">Reset Password</a>

                  <p>Or copy and paste this link in your browser:</p>
                  <p style="word-break: break-all; background-color: #f9fafb; padding: 10px; border-radius: 4px;">${resetLink}</p>

                  <div class="warning">
                    <strong>⚠️ Security Notice:</strong><br>
                    If you did not request a password reset, please ignore this email. Your account is secure.
                  </div>

                  <p>This link will expire in 24 hours.</p>

                  <p>Best regards,<br>The Family Budget Calculator Team</p>
                </div>

                <div class="footer">
                  <p>This is an automated email. Please do not reply to this message.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      }),
    });

    const emailData = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: emailData.message || "Failed to send email" }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: true, id: emailData.id }), {
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
