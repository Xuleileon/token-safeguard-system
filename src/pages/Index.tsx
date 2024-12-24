import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    checkUser();
    handleAuthCode();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    // Ensure user exists in the users table
    const { error: userError } = await supabase
      .from("users")
      .upsert({
        id: session.user.id,
        email: session.user.email,
      });

    if (userError) {
      console.error("Error ensuring user exists:", userError);
      setError(userError.message);
    }
  }

  async function handleAuthCode() {
    const auth_code = searchParams.get("auth_code");
    if (auth_code) {
      setLoading(true);
      setError("");

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("No user found");

        // Get the stored app credentials
        const { data: tokens } = await supabase
          .from("tokens")
          .select("app_id, app_secret")
          .eq("user_id", session.user.id)
          .single();

        if (!tokens) {
          throw new Error("Please save your app credentials first");
        }

        // Get access token using auth code
        const response = await fetch("https://qianchuan.jinritemai.com/oauth2/access_token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            app_id: tokens.app_id,
            secret: tokens.app_secret,
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
          .eq("user_id", session.user.id);

        if (dbError) throw dbError;

        toast({
          title: "Success!",
          description: "Authorization successful. Tokens have been stored.",
        });

        navigate("/dashboard");
      } catch (error) {
        console.error("Error:", error);
        setError(error.message);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      } finally {
        setLoading(false);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No user found");

      // Ensure user exists in users table
      const { error: userError } = await supabase
        .from("users")
        .upsert({
          id: session.user.id,
          email: session.user.email,
        });

      if (userError) throw userError;

      // Store app credentials
      const { error: dbError } = await supabase
        .from("tokens")
        .upsert({
          user_id: session.user.id,
          app_id: appId,
          app_secret: appSecret,
        });

      if (dbError) throw dbError;

      // Redirect to authorization page
      const authUrl = `https://qianchuan.jinritemai.com/openapi/qc/audit/oauth.html?app_id=${appId}&state=your_custom_params&material_auth=1`;
      window.location.href = authUrl;

    } catch (error) {
      console.error("Error:", error);
      setError(error.message);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container max-w-lg mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-center">巨量千川 Token 管理</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="appId" className="block text-sm font-medium mb-1">
            App ID
          </label>
          <Input
            id="appId"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="appSecret" className="block text-sm font-medium mb-1">
            App Secret
          </label>
          <Input
            id="appSecret"
            type="password"
            value={appSecret}
            onChange={(e) => setAppSecret(e.target.value)}
            required
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "处理中..." : "开始授权"}
        </Button>
      </form>
    </div>
  );
}