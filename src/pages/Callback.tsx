import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Callback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      const auth_code = searchParams.get("auth_code");
      const app_id = searchParams.get("app_id");
      
      if (!auth_code || !app_id) {
        throw new Error("Missing auth_code or app_id");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Get the stored app credentials
      const { data: token } = await supabase
        .from("tokens")
        .select("app_id, app_secret")
        .eq("user_id", session.user.id)
        .eq("app_id", app_id)
        .maybeSingle();

      if (!token) {
        throw new Error("App credentials not found");
      }

      // Get access token using auth code
      const response = await fetch("https://ad.oceanengine.com/open_api/oauth2/access_token/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          app_id: token.app_id,
          secret: token.app_secret,
          grant_type: "authorization_code",
          auth_code: auth_code,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.message !== "success") {
        throw new Error(data.message || "Failed to get access token");
      }

      // Update tokens in database
      const { error: dbError } = await supabase
        .from("tokens")
        .update({
          auth_token: auth_code,
          access_token: data.data.access_token,
          refresh_token: data.data.refresh_token,
          expires_at: new Date(Date.now() + data.data.expires_in * 1000).toISOString(),
        })
        .eq("user_id", session.user.id)
        .eq("app_id", app_id);

      if (dbError) throw dbError;

      toast({
        title: "Success!",
        description: "Authorization successful. Tokens have been stored.",
      });

      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Processing Authorization...</h2>
          <p className="text-gray-500">Please wait while we complete the authorization process.</p>
        </div>
      </div>
    );
  }

  return null;
}