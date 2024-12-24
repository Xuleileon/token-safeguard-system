import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SavedToken {
  app_id: string;
  expires_at: string | null;
}

interface SavedTokensListProps {
  onSelect: (appId: string, appSecret: string) => void;
}

export default function SavedTokensList({ onSelect }: SavedTokensListProps) {
  const [savedTokens, setSavedTokens] = useState<SavedToken[]>([]);

  useEffect(() => {
    loadSavedTokens();
  }, []);

  const loadSavedTokens = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: tokens } = await supabase
      .from("tokens")
      .select("app_id, app_secret, expires_at")
      .eq("user_id", session.user.id);

    if (tokens) {
      setSavedTokens(tokens);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Saved Apps</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {savedTokens.map((token) => (
          <Card key={token.app_id}>
            <CardHeader>
              <CardTitle className="text-lg">App ID: {token.app_id}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                Expires: {token.expires_at ? new Date(token.expires_at).toLocaleString() : 'Not authorized'}
              </p>
              <Button 
                onClick={() => onSelect(token.app_id, token.app_secret)}
                className="w-full"
              >
                Use This App
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}