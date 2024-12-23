import { serve } from "https://deno.fresh.dev/std@v1/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all tokens that need refresh (expires within 24 hours)
    const { data: tokens, error: fetchError } = await supabaseClient
      .from('tokens')
      .select('*')
      .lt('expires_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

    if (fetchError) throw fetchError;

    const results = [];
    for (const token of tokens) {
      try {
        const response = await fetch('https://qianchuan.jinritemai.com/oauth2/refresh_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app_id: token.app_id,
            secret: token.app_secret,
            grant_type: 'refresh_token',
            refresh_token: token.refresh_token,
          }),
        });

        const data = await response.json();

        if (data.message === 'success') {
          const { error: updateError } = await supabaseClient
            .from('tokens')
            .update({
              access_token: data.data.access_token,
              refresh_token: data.data.refresh_token,
              expires_at: new Date(Date.now() + data.data.expires_in * 1000).toISOString(),
            })
            .eq('id', token.id);

          if (updateError) throw updateError;
          
          results.push({ id: token.id, success: true });
        } else {
          results.push({ id: token.id, success: false, error: data.message });
        }
      } catch (error) {
        results.push({ id: token.id, success: false, error: error.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});