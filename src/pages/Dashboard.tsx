import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Token {
  id: string;
  app_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
    loadTokens();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  }

  async function loadTokens() {
    try {
      const { data, error } = await supabase
        .from("tokens")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTokens(data || []);
    } catch (error) {
      console.error("Error loading tokens:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load tokens",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh(tokenId: string) {
    try {
      const response = await supabase.functions.invoke("refresh-token", {
        body: { tokenId },
      });

      if (response.error) throw response.error;

      toast({
        title: "Success",
        description: "Token refreshed successfully",
      });

      loadTokens();
    } catch (error) {
      console.error("Error refreshing token:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to refresh token",
      });
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/auth");
  }

  if (loading) {
    return <div className="container p-6">Loading...</div>;
  }

  return (
    <div className="container p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Token 管理</h1>
        <Button onClick={handleLogout} variant="outline">
          退出登录
        </Button>
      </div>

      <div className="space-y-4">
        {tokens.map((token) => (
          <div
            key={token.id}
            className="p-4 border rounded-lg space-y-2"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">App ID: {token.app_id}</p>
                <p className="text-sm text-gray-500">
                  过期时间: {new Date(token.expires_at).toLocaleString()}
                </p>
              </div>
              <Button
                onClick={() => handleRefresh(token.id)}
                size="sm"
              >
                刷新
              </Button>
            </div>
          </div>
        ))}

        {tokens.length === 0 && (
          <p className="text-center text-gray-500">
            没有找到任何 token，请先添加一个新的 token。
          </p>
        )}

        <Button
          onClick={() => navigate("/")}
          className="w-full"
        >
          添加新的 Token
        </Button>
      </div>
    </div>
  );
}