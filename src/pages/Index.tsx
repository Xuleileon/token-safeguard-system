import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Index() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [error, setError] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [existingToken, setExistingToken] = useState(null);

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
        const response = await fetch("https://ad.oceanengine.com/open_api/oauth2/access_token/", {
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
          .eq("user_id", session.user.id)
          .eq("app_id", tokens.app_id);

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

  async function checkExistingToken(appId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: token } = await supabase
      .from("tokens")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("app_id", appId)
      .single();

    return token;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No user found");

      // Check for existing token
      const existingToken = await checkExistingToken(appId);
      
      if (existingToken) {
        setExistingToken(existingToken);
        if (new Date(existingToken.expires_at) > new Date()) {
          setShowConfirmDialog(true);
          setLoading(false);
          return;
        }
      }

      // Store app credentials temporarily
      const { error: dbError } = await supabase
        .from("tokens")
        .upsert({
          user_id: session.user.id,
          app_id: appId,
          app_secret: appSecret,
        });

      if (dbError) throw dbError;

      // Redirect to authorization page
      const authUrl = `https://ad.oceanengine.com/oauth2/authorize/?response_type=code&client_id=${appId}&redirect_uri=${window.location.origin}/auth/callback&scope=basic_info`;
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

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Token Still Valid</DialogTitle>
            <DialogDescription>
              This App ID already has a valid token that expires at {new Date(existingToken?.expires_at).toLocaleString()}. 
              Do you want to proceed with re-authorization?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowConfirmDialog(false);
              handleSubmit(new Event('submit'));
            }}>
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}