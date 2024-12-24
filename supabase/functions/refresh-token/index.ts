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

    // Parse request body and validate token ID
    let tokenId;
    try {
      const body = await req.json();
      tokenId = body.tokenId;
    } catch (error) {
      console.error('Error parsing request body:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request body',
          details: 'Request body must be valid JSON with a tokenId field'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!tokenId) {
      return new Response(
        JSON.stringify({ 
          error: 'Token ID is required',
          details: null
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Refreshing token with ID:', tokenId);

    // Get token from database
    const { data: token, error: fetchError } = await supabaseClient
      .from('tokens')
      .select('*')
      .eq('id', tokenId)
      .single();

    if (fetchError) {
      console.error('Error fetching token:', fetchError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch token',
          details: fetchError
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!token) {
      return new Response(
        JSON.stringify({ 
          error: 'Token not found',
          details: null
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Found token:', token);

    // Call Qianchuan API to refresh token
    let response;
    try {
      response = await fetch('https://qianchuan.jinritemai.com/oauth2/refresh_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: token.app_id,
          secret: token.app_secret,
          grant_type: 'refresh_token',
          refresh_token: token.refresh_token,
        }),
      });
    } catch (error) {
      console.error('Network error calling Qianchuan API:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to connect to Qianchuan API',
          details: error.message
        }),
        { 
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      console.error('Error parsing Qianchuan API response:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid response from Qianchuan API',
          details: error.message
        }),
        { 
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Qianchuan API response:', data);

    if (!response.ok || data.message !== 'success') {
      return new Response(
        JSON.stringify({ 
          error: data.message || 'Failed to refresh token',
          details: data
        }),
        { 
          status: response.status || 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

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
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update token',
          details: updateError
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        data: data.data 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An unexpected error occurred',
        details: error.message || String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});