import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get token ID from request
    const { tokenId } = await req.json();
    console.log('Refreshing token with ID:', tokenId);

    // Get token from database
    const { data: token, error: fetchError } = await supabaseClient
      .from('tokens')
      .select('*')
      .eq('id', tokenId)
      .single();

    if (fetchError) {
      console.error('Error fetching token:', fetchError);
      throw new Error('Failed to fetch token');
    }

    if (!token) {
      throw new Error('Token not found');
    }

    console.log('Found token:', token);

    // Call Qianchuan API to refresh token
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

    if (!response.ok) {
      throw new Error(`Qianchuan API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('Qianchuan API response:', data);

    if (data.message === 'success') {
      // Update token in database
      const { error: updateError } = await supabaseClient
        .from('tokens')
        .update({
          access_token: data.data.access_token,
          refresh_token: data.data.refresh_token,
          expires_at: new Date(Date.now() + data.data.expires_in * 1000).toISOString(),
        })
        .eq('id', tokenId);

      if (updateError) {
        console.error('Error updating token:', updateError);
        throw new Error('Failed to update token');
      }

      return new Response(
        JSON.stringify({ success: true, data: data.data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      throw new Error(data.message || 'Failed to refresh token');
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred',
        details: error
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});