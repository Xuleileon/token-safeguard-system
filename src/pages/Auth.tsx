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

    // Check if user is already signed in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkUser();

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
          localization={{
            variables: {
              sign_in: {
                email_label: 'Email address',
                password_label: 'Password',
                button_label: 'Sign in',
                loading_button_label: 'Signing in...',
                email_input_placeholder: 'Your email address',
                password_input_placeholder: 'Your password',
              },
              sign_up: {
                email_label: 'Email address',
                password_label: 'Create a password',
                button_label: 'Sign up',
                loading_button_label: 'Signing up...',
                email_input_placeholder: 'Your email address',
                password_input_placeholder: 'Choose a strong password',
              },
            },
          }}
        />
      </div>
    </div>
  );
}