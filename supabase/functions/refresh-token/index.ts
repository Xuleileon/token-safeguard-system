import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tokenId } = await req.json();
    console.log('Refreshing token:', tokenId);

    // Get token from database
    const { data: token, error: tokenError } = await supabase
      .from('tokens')
      .select('*')
      .eq('id', tokenId)
      .single();

    if (tokenError) {
      throw new Error(`Error fetching token: ${tokenError.message}`);
    }

    if (!token) {
      throw new Error('Token not found');
    }

    // Check if token needs refresh
    const expiresAt = new Date(token.expires_at);
    const now = new Date();
    const bufferTime = 10 * 60 * 1000; // 10 minutes in milliseconds

    if (expiresAt.getTime() - now.getTime() > bufferTime) {
      return new Response(JSON.stringify({
        message: 'Token still valid',
        expires_at: token.expires_at
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call Qianchuan API to refresh token
    try {
      const apiUrl = 'https://ad.oceanengine.com/open_api/oauth2/refresh_token/';
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
      console.log('API Response Status:', apiResponse.status);
      console.log('API Response Headers:', Object.fromEntries(apiResponse.headers.entries()));

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API request failed: ${apiResponse.status} ${apiResponse.statusText}`);
      }

      const data = await apiResponse.json();
      console.log('API Response Data:', data);

      if (data.message !== 'success') {
        throw new Error(data.message || 'Failed to refresh token');
      }

      // Update token in database
      const { error: updateError } = await supabase
        .from('tokens')
        .update({
          access_token: data.data.access_token,
          refresh_token: data.data.refresh_token,
          expires_at: new Date(Date.now() + data.data.expires_in * 1000).toISOString(),
        })
        .eq('id', token.id);

      if (updateError) {
        throw new Error(`Error updating token: ${updateError.message}`);
      }

      return new Response(JSON.stringify({
        message: 'Token refreshed successfully',
        expires_at: new Date(Date.now() + data.data.expires_in * 1000).toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('Error refreshing token:', error);
      throw new Error(`Error refreshing token: ${error.message}`);
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});