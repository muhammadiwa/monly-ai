import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

// Google Icon Component
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export default function Auth() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState(false);
  const [checkingGoogleAuth, setCheckingGoogleAuth] = useState(true);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    confirmPassword: ""
  });

  // Check if Google OAuth is enabled
  useEffect(() => {
    const checkGoogleAuth = async () => {
      try {
        const response = await fetch('/api/system/settings/google-auth-enabled');
        if (response.ok) {
          const data = await response.json();
          setGoogleAuthEnabled(data.enabled);
        }
      } catch (error) {
        console.error('Error checking Google auth status:', error);
      } finally {
        setCheckingGoogleAuth(false);
      }
    };

    checkGoogleAuth();
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const oauth = urlParams.get('oauth');
    const error = urlParams.get('error');

    if (error) {
      toast({
        title: "Login Gagal",
        description: error === 'google_auth_failed'
          ? "Login dengan Google gagal. Silakan coba lagi."
          : "Terjadi kesalahan saat login.",
        variant: "destructive",
      });
      // Clean URL without reloading
      window.history.replaceState({}, '', '/auth');
      return;
    }

    if (token && oauth === 'google') {
      // Store token
      localStorage.setItem('auth-token', token);

      // Fetch user data immediately before redirecting
      const fetchUserData = async () => {
        try {
          const response = await fetch('/api/auth/user', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const userData = await response.json();
            localStorage.setItem('auth-user', JSON.stringify(userData));

            toast({
              title: "Login Berhasil!",
              description: "Anda berhasil masuk dengan Google.",
            });

            // Clean URL and redirect
            window.history.replaceState({}, '', '/auth');

            // Use setTimeout to ensure state is updated before redirect
            setTimeout(() => {
              window.location.href = "/dashboard";
            }, 100);
          } else {
            throw new Error('Failed to fetch user data');
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
          localStorage.removeItem('auth-token');
          toast({
            title: "Login Gagal",
            description: "Gagal mengambil data pengguna. Silakan coba lagi.",
            variant: "destructive",
          });
          window.history.replaceState({}, '', '/auth');
        }
      };

      fetchUserData();
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      window.location.href = "/dashboard";
    }
  }, [isAuthenticated, authLoading]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memeriksa autentikasi...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!formData.email || !formData.password) {
        toast({
          title: "Validasi Error",
          description: "Email dan password wajib diisi.",
          variant: "destructive",
        });
        return;
      }

      if (!isLogin) {
        if (!formData.name) {
          toast({
            title: "Validasi Error",
            description: "Nama lengkap wajib diisi untuk registrasi.",
            variant: "destructive",
          });
          return;
        }

        if (formData.password !== formData.confirmPassword) {
          toast({
            title: "Validasi Error",
            description: "Password tidak cocok.",
            variant: "destructive",
          });
          return;
        }

        if (formData.password.length < 6) {
          toast({
            title: "Validasi Error",
            description: "Password minimal 6 karakter.",
            variant: "destructive",
          });
          return;
        }
      }

      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : { email: formData.email, password: formData.password, name: formData.name };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Autentikasi gagal');
      }

      if (data.token) {
        localStorage.setItem('auth-token', data.token);
      }

      if (data.user) {
        localStorage.setItem('auth-user', JSON.stringify(data.user));
      }

      toast({
        title: isLogin ? "Selamat Datang!" : "Akun Berhasil Dibuat!",
        description: isLogin ? "Anda berhasil masuk." : "Akun Anda telah dibuat.",
      });

      window.location.href = "/dashboard";
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Autentikasi gagal';
      toast({
        title: "Error Autentikasi",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-32 left-40 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">M</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
              Monly AI
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isLogin ? "Selamat Datang!" : "Mulai Gratis"}
          </h1>
          <p className="text-gray-600">
            {isLogin ? "Masuk ke akun Anda" : "Buat akun dan mulai kelola keuanganmu"}
          </p>
        </div>

        <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <Tabs value={isLogin ? "login" : "register"} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" onClick={() => setIsLogin(true)}>Masuk</TabsTrigger>
                <TabsTrigger value="register" onClick={() => setIsLogin(false)}>Daftar</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4">
                <div className="text-center">
                  <CardTitle className="text-2xl">Masuk</CardTitle>
                  <CardDescription>Masukkan email dan password untuk mengakses akun</CardDescription>
                </div>
              </TabsContent>

              <TabsContent value="register" className="space-y-4">
                <div className="text-center">
                  <CardTitle className="text-2xl">Buat Akun</CardTitle>
                  <CardDescription>Daftar untuk memulai perjalanan keuanganmu dengan AI</CardDescription>
                </div>
              </TabsContent>
            </Tabs>
          </CardHeader>

          <CardContent>
            {/* Google OAuth Button - Only show on LOGIN tab if enabled */}
            {isLogin && googleAuthEnabled && !checkingGoogleAuth && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleLogin}
                  className="w-full mb-4 h-11 border-gray-300 hover:bg-gray-50"
                >
                  <GoogleIcon />
                  <span className="ml-2">Masuk dengan Google</span>
                </Button>

                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">atau</span>
                  </div>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                    Nama Lengkap
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Masukkan nama lengkap"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="nama@email.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="pl-10 h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Masukkan password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="pl-10 pr-10 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                    Konfirmasi Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Ulangi password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="pl-10 h-11"
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white font-medium"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Memproses...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    {isLogin ? "Masuk" : "Daftar"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              {isLogin ? (
                <p>
                  Belum punya akun?{" "}
                  <button
                    type="button"
                    onClick={() => setIsLogin(false)}
                    className="text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Daftar sekarang
                  </button>
                </p>
              ) : (
                <p>
                  Sudah punya akun?{" "}
                  <button
                    type="button"
                    onClick={() => setIsLogin(true)}
                    className="text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Masuk
                  </button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500 mt-6">
          Dengan melanjutkan, Anda menyetujui{" "}
          <a href="#" className="text-emerald-600 hover:underline">Syarat & Ketentuan</a>
          {" "}dan{" "}
          <a href="#" className="text-emerald-600 hover:underline">Kebijakan Privasi</a>
        </p>
      </div>
    </div>
  );
}
