import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TokenFormProps {
  onSubmit: (appId: string, appSecret: string) => Promise<void>;
  loading: boolean;
  error: string;
}

export default function TokenForm({ onSubmit, loading, error }: TokenFormProps) {
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSubmit(appId, appSecret);
  };

  return (
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
  );
}