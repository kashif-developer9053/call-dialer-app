"use client";

import { useState, useEffect, useCallback } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Phone, Lock, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // Redirect if already logged in
  useEffect(() => {
    if (session?.user) {
      const role = (session.user as any).role;
      const redirectPath = getRoleBasedPath(role);
      router.push(redirectPath);
    }
  }, [session, router]);

  const getRoleBasedPath = (role: string) => {
    switch (role) {
      case "admin":
        return "/admin/dashboard";
      case "manager":
        return "/manager/dashboard";
      case "agent":
        return "/agent/dialer";
      default:
        return "/agent/dialer";
    }
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
        setLoading(false);
      } else if (result?.ok) {
        toast.success("Login successful!");
        // Wait for session to be established before redirecting
        const checkSession = setInterval(async () => {
          const session = await fetch("/api/auth/session").then(res => res.json());
          if (session?.user?.role) {
            clearInterval(checkSession);
            const role = session.user.role;
            const redirectPath = getRoleBasedPath(role);
            setLoading(false);
            router.push(redirectPath);
          }
        }, 100);

        // Timeout after 5 seconds to avoid infinite loop
        setTimeout(() => {
          clearInterval(checkSession);
          setLoading(false);
          router.push("/agent/dialer"); // Default redirect
        }, 5000);
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      toast.error("Login failed");
      setLoading(false);
    }
  }, [formData, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20"></div>
      
      <Card className="w-full max-w-md relative z-10 bg-white/95 backdrop-blur-sm shadow-2xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-xl w-fit">
            <Phone className="h-8 w-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">CallDialer</CardTitle>
            <CardDescription className="text-base mt-2">
              Call Center Management System
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  className="pl-10"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Demo Credentials:</p>
            <p className="font-mono text-xs mt-1">
              Admin: admin@calldialer.com / admin123
            </p>
            <p className="font-mono text-xs">
              Agent: agent@calldialer.com / agent123
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Animated Gradient Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
    </div>
  );
}