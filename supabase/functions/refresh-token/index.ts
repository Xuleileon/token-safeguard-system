import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
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
        { headers: corsHeaders, status: 400 }
      );
    }

    if (!tokenId) {
      return new Response(
        JSON.stringify({ 
          error: 'Token ID is required',
          details: null
        }),
        { headers: corsHeaders, status: 400 }
      );
    }

    console.log('Fetching token with ID:', tokenId);

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
        { headers: corsHeaders, status: 400 }
      );
    }

    if (!token) {
      return new Response(
        JSON.stringify({ 
          error: 'Token not found',
          details: null
        }),
        { headers: corsHeaders, status: 404 }
      );
    }

    console.log('Preparing to call Qianchuan API with token:', {
      app_id: token.app_id,
      refresh_token: token.refresh_token?.substring(0, 10) + '...',
    });

    // Call Qianchuan API to refresh token
    try {
      const apiUrl = 'https://business.oceanengine.com/open_api/oauth2/refresh_token/';
      const requestBody = {
        app_id: token.app_id,
        secret: token.app_secret,
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
      };

      console.log('Making request to Qianchuan API:', {
        url: apiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: { ...requestBody, refresh_token: requestBody.refresh_token?.substring(0, 10) + '...' }
      });

      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody),
      });

      // Log API response status and headers
      console.log('Qianchuan API response status:', apiResponse.status);
      console.log('Qianchuan API response headers:', Object.fromEntries(apiResponse.headers.entries()));

      // Get raw response text first
      const rawResponse = await apiResponse.text();
      console.log('Raw Qianchuan API response:', rawResponse);

      // Try to parse the response as JSON
      let data;
      try {
        data = JSON.parse(rawResponse);
      } catch (error) {
        console.error('Failed to parse Qianchuan API response as JSON:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Invalid response from Qianchuan API',
            details: 'Response was not valid JSON',
            raw_response: rawResponse.substring(0, 200) // Log first 200 chars for debugging
          }),
          { headers: corsHeaders, status: 502 }
        );
      }

      console.log('Parsed Qianchuan API response:', data);

      if (!apiResponse.ok || data.message !== 'success') {
        return new Response(
          JSON.stringify({ 
            error: 'Qianchuan API error',
            details: data
          }),
          { headers: corsHeaders, status: apiResponse.status || 400 }
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
          { headers: corsHeaders, status: 400 }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          data: data.data 
        }),
        { headers: corsHeaders }
      );

    } catch (error) {
      console.error('Network error calling Qianchuan API:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to connect to Qianchuan API',
          details: error.message
        }),
        { headers: corsHeaders, status: 503 }
      );
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An unexpected error occurred',
        details: error.message || String(error)
      }),
      { headers: corsHeaders, status: 500 }
    );
  }
});