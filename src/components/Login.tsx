import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error, data } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && !data.session) {
          setMessage({ text: 'Registration successful! Please check your email to verify your account.', type: 'success' });
        } else {
          setMessage({ text: 'Registration successful! Logging you in...', type: 'success' });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      setMessage({ text: error.message || 'An error occurred', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-md border border-border">
        <h2 className="text-2xl font-bold mb-2 text-center text-card-foreground">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p className="text-center text-muted-foreground mb-6 text-sm">
          {isSignUp ? 'Sign up to start organizing your co-parenting documentation.' : 'Login to CoParent Intel'}
        </p>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              required
              className="mt-1 block w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-background text-foreground"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground">Password</label>
            <input
              type="password"
              required
              minLength={6}
              className="mt-1 block w-full px-3 py-2 border border-input rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary bg-background text-foreground"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-colors"
          >
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setMessage(null); }}
              className="ml-1 text-primary hover:text-primary/80 font-medium hover:underline"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>

        {message && (
          <div className={`mt-4 text-center text-sm p-3 rounded-lg ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};
