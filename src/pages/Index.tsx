import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import TokenForm from "@/components/auth/TokenForm";
import TokenConfirmDialog from "@/components/auth/TokenConfirmDialog";
import SavedTokensList from "@/components/auth/SavedTokensList";
import { generateAuthUrl } from "@/utils/auth";

export default function Index() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [existingToken, setExistingToken] = useState<any>(null);
  const [currentAppId, setCurrentAppId] = useState("");
  const [currentAppSecret, setCurrentAppSecret] = useState("");

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
          .maybeSingle();

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
      } catch (error: any) {
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

    const { data: token, error } = await supabase
      .from("tokens")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("app_id", appId)
      .maybeSingle();

    if (error) {
      console.error("Error checking existing token:", error);
      return null;
    }

    return token;
  }

  async function handleSubmit(appId: string, appSecret: string) {
    setLoading(true);
    setError("");
    setCurrentAppId(appId);
    setCurrentAppSecret(appSecret);

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

      await proceedWithAuth(appId, appSecret);
    } catch (error: any) {
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

  async function proceedWithAuth(appId: string, appSecret: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No user found");

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
    window.location.href = generateAuthUrl(appId);
  }

  const handleConfirmReauth = async () => {
    setShowConfirmDialog(false);
    if (currentAppId && currentAppSecret) {
      await proceedWithAuth(currentAppId, currentAppSecret);
    }
  };

  return (
    <div className="container max-w-lg mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-center">巨量千川 Token 管理</h1>
      
      <SavedTokensList onSelect={handleSubmit} />
      
      <div className="my-8">
        <h2 className="text-xl font-semibold mb-4">Add New App</h2>
        <TokenForm 
          onSubmit={handleSubmit}
          loading={loading}
          error={error}
        />
      </div>

      <TokenConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        expiresAt={existingToken?.expires_at}
        onConfirm={handleConfirmReauth}
      />
    </div>
  );
}