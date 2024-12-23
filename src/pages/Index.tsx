import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // First try to get access token using auth token
      const response = await fetch("https://qianchuan.jinritemai.com/oauth2/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: appId,
          secret: appSecret,
          grant_type: "authorization_code",
          auth_code: authToken,
        }),
      });

      const data = await response.json();

      if (data.message !== "success") {
        throw new Error(data.message || "Failed to get access token");
      }

      // Store tokens in database
      const { error: dbError } = await supabase
        .from("tokens")
        .insert({
          user_id: user.id,
          app_id: appId,
          app_secret: appSecret,
          auth_token: authToken,
          access_token: data.data.access_token,
          refresh_token: data.data.refresh_token,
          expires_at: new Date(Date.now() + data.data.expires_in * 1000).toISOString(),
        });

      if (dbError) throw dbError;

      toast({
        title: "Success!",
        description: "Tokens have been stored and will be refreshed automatically.",
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

        <div>
          <label htmlFor="authToken" className="block text-sm font-medium mb-1">
            Auth Token
          </label>
          <Input
            id="authToken"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            required
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "处理中..." : "保存"}
        </Button>
      </form>
    </div>
  );
}