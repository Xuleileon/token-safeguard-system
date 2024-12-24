import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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

  async function handleDelete(tokenId: string) {
    try {
      const { error } = await supabase
        .from("tokens")
        .delete()
        .eq("id", tokenId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Token deleted successfully",
      });

      loadTokens();
    } catch (error) {
      console.error("Error deleting token:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete token",
      });
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
        <div className="space-x-2">
          <Button onClick={() => navigate("/")} variant="outline">
            添加新的 Token
          </Button>
          <Button onClick={handleLogout} variant="outline">
            退出登录
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {tokens.map((token) => (
          <div
            key={token.id}
            className="p-4 border rounded-lg space-y-2"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-2 flex-1">
                <p className="font-medium">App ID: {token.app_id}</p>
                <p className="text-sm text-gray-500 break-all">
                  Access Token: {token.access_token || "Not authorized"}
                </p>
                <p className="text-sm text-gray-500 break-all">
                  Refresh Token: {token.refresh_token || "Not authorized"}
                </p>
                <p className="text-sm text-gray-500">
                  过期时间: {token.expires_at ? new Date(token.expires_at).toLocaleString() : "Not authorized"}
                </p>
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => handleRefresh(token.id)}
                  size="sm"
                  disabled={!token.refresh_token}
                >
                  刷新
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">删除</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认删除</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要删除这个 Token 吗？此操作无法撤销。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(token.id)}>
                        确认删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        ))}

        {tokens.length === 0 && (
          <p className="text-center text-gray-500">
            没有找到任何 token，请先添加一个新的 token。
          </p>
        )}
      </div>
    </div>
  );
}