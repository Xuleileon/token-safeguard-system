import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AuthChangeEvent } from "@supabase/supabase-js";

export default function AuthPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate("/");
        toast({
          title: "Success",
          description: "Successfully signed in!",
        });
      }
      if (event === 'SIGNED_OUT') {
        navigate("/auth");
      }
      if (event === 'PASSWORD_RECOVERY') {
        toast({
          title: "Check your email",
          description: "We've sent you a password recovery link.",
        });
      }
      if (event === 'USER_UPDATED') {
        toast({
          title: "Success",
          description: "Your account has been updated.",
        });
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, toast]);

  return (
    <div className="container max-w-lg mx-auto p-6">
      <div className="bg-card rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">Welcome Back</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#2563eb',
                  brandAccent: '#1d4ed8',
                }
              }
            }
          }}
          providers={[]}
          redirectTo={`${window.location.origin}/auth/callback`}
          view="sign_in"
        />
      </div>
    </div>
  );
}