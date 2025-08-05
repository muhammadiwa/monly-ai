import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  generateActivationCode,
  getWhatsAppConnections,
  getActiveActivationCodes,
  disconnectWhatsAppConnection,
  formatWhatsAppNumber,
  getTimeRemaining,
  type WhatsAppConnection,
  type WhatsAppActivationCode,
} from "@/lib/whatsappMultiAccountService";
import { copyActivationCode } from "@/lib/clipboardUtils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { 
  MessageCircle, 
  Smartphone, 
  Plus, 
  Clock, 
  Trash2, 
  Copy,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw
} from "lucide-react";

export default function WhatsAppIntegration() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  
  const [timeRemainingUpdater, setTimeRemainingUpdater] = useState(0);

  // Fetch WhatsApp connections
  const { data: connectionsData, isLoading: connectionsLoading, refetch: refetchConnections } = useQuery({
    queryKey: ['whatsapp-connections'],
    queryFn: getWhatsAppConnections,
    enabled: Boolean(user),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch active activation codes
  const { data: activeCodesData, isLoading: codesLoading, refetch: refetchCodes } = useQuery({
    queryKey: ['whatsapp-active-codes'],
    queryFn: getActiveActivationCodes,
    enabled: Boolean(user),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Generate activation code mutation
  const generateCodeMutation = useMutation({
    mutationFn: generateActivationCode,
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "✅ Kode Aktivasi Dibuat",
          description: `Kode: ${data.code} - Berlaku 5 menit`,
          className: "bg-green-50 border-green-200 text-green-800",
        });
        refetchCodes();
      } else {
        toast({
          title: "❌ Gagal Membuat Kode",
          description: data.message || "Silakan coba lagi",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "❌ Error",
        description: "Gagal membuat kode aktivasi",
        variant: "destructive",
      });
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: disconnectWhatsAppConnection,
    onSuccess: (data, variables) => {
      if (data.success) {
        toast({
          title: "✅ WhatsApp Terputus",
          description: "Koneksi WhatsApp berhasil dihapus",
          className: "bg-blue-50 border-blue-200 text-blue-800",
        });
        refetchConnections();
      } else {
        toast({
          title: "❌ Gagal Memutus Koneksi",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "❌ Error",
        description: "Gagal memutus koneksi WhatsApp",
        variant: "destructive",
      });
    },
  });

  // Update time remaining every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemainingUpdater(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleGenerateCode = () => {
    generateCodeMutation.mutate();
  };

  const handleDisconnect = (connectionId: number) => {
    disconnectMutation.mutate(connectionId);
  };

  const handleCopyCode = async (code: string) => {
    const result = await copyActivationCode(code);
    
    if (result.success) {
      toast({
        title: "✅ Kode Disalin",
        description: `Kode aktivasi berhasil disalin menggunakan ${result.method}`,
        className: "bg-green-50 border-green-200 text-green-800",
      });
    } else {
      // Show manual copy fallback
      toast({
        title: "📋 Salin Manual",
        description: (
          <div className="space-y-2">
            <p className="text-sm">Copy otomatis gagal. Salin kode ini secara manual:</p>
            <div className="bg-white p-3 rounded border font-mono text-sm select-all break-all">
              AKTIVASI: {code}
            </div>
            <p className="text-xs text-gray-600">Tap dan tahan untuk select all, lalu copy</p>
          </div>
        ),
        duration: 15000, // Show longer for manual copy
        className: "bg-blue-50 border-blue-200 text-blue-800",
      });
    }
  };

  const connections = connectionsData?.connections || [];
  const activeCodes = activeCodesData?.activeCodes || [];

  if (!isAuthenticated) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600">Silakan login untuk mengakses integrasi WhatsApp</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="px-2 sm:px-4 lg:px-6 w-full">
        {/* Header */}
        <div className="mb-4 pt-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent flex items-center gap-2">
                <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                Integrasi WhatsApp
              </h1>
              <p className="mt-0.5 text-sm text-gray-600">
                Kelola koneksi WhatsApp untuk menggunakan bot keuangan
              </p>
            </div>
            <Button
              onClick={handleGenerateCode}
              disabled={generateCodeMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
            >
              {generateCodeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Membuat...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Buat Kode Aktivasi
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Information Card */}
          <Card className="shadow-lg border-0 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Smartphone className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-green-800 mb-2 text-sm sm:text-base">
                    Cara Menghubungkan WhatsApp
                  </h3>
                  <ol className="text-xs sm:text-sm text-green-700 space-y-1 list-decimal list-inside">
                    <li>Klik "Buat Kode Aktivasi" untuk mendapatkan kode unik</li>
                    <li>Buka WhatsApp dan kirim pesan ke bot Monly AI</li>
                    <li className="break-all">Ketik: <code className="bg-green-200 px-1 sm:px-2 py-1 rounded text-xs">AKTIVASI: [KODE_ANDA]</code></li>
                    <li>Akun WhatsApp Anda akan terhubung secara otomatis</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Active Codes */}
            <Card className="shadow-lg border-0 bg-white">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                  <span className="text-sm sm:text-base">Kode Aktivasi Aktif</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                {codesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : activeCodes.length > 0 ? (
                  <div className="space-y-3">
                    {activeCodes.map((code) => (
                      <div
                        key={code.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200 gap-3"
                      >
                        <div className="flex-1">
                          <div className="font-mono text-lg sm:text-xl font-bold text-blue-800 break-all">
                            {code.code}
                          </div>
                          <div className="text-xs sm:text-sm text-blue-600">
                            Berlaku: {getTimeRemaining(code.expiresAt)}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyCode(code.code)}
                          className="border-blue-200 text-blue-600 hover:bg-blue-100 w-full sm:w-auto"
                        >
                          <Copy className="h-4 w-4 mr-2 sm:mr-0" />
                          <span className="sm:hidden">Salin Kode</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8 text-gray-500">
                    <Clock className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm sm:text-base">Tidak ada kode aktivasi aktif</p>
                    <p className="text-xs sm:text-sm">Klik "Buat Kode Aktivasi" untuk memulai</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Connected Accounts */}
            <Card className="shadow-lg border-0 bg-white">
              <CardHeader className="pb-2 sm:pb-3 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  <span className="text-sm sm:text-base">WhatsApp Terhubung</span>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchConnections()}
                  disabled={connectionsLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${connectionsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                {connectionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : connections.length > 0 ? (
                  <div className="space-y-3">
                    {connections.map((connection) => (
                      <div
                        key={connection.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-white rounded-lg border gap-3"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                            <Smartphone className="h-4 w-4 text-green-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm sm:text-base break-all">
                              {formatWhatsAppNumber(connection.whatsappNumber)}
                            </div>
                            {connection.displayName && (
                              <div className="text-xs sm:text-sm text-gray-600 truncate">
                                {connection.displayName}
                              </div>
                            )}
                            <div className="text-xs text-gray-500">
                              Terhubung: {new Date(connection.activatedAt).toLocaleDateString('id-ID')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <Badge
                            variant={connection.status === 'active' ? 'default' : 'secondary'}
                            className={`${connection.status === 'active' ? 'bg-green-100 text-green-700' : ''} text-xs flex-shrink-0`}
                          >
                            {connection.status === 'active' ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Aktif
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 mr-1" />
                                Nonaktif
                              </>
                            )}
                          </Badge>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-red-200 text-red-600 hover:bg-red-50 flex-shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="hidden sm:inline ml-1">Hapus</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="mx-4 max-w-md">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-base sm:text-lg">Putuskan Koneksi WhatsApp?</AlertDialogTitle>
                                <AlertDialogDescription className="text-sm">
                                  Aksi ini akan memutus koneksi WhatsApp{' '}
                                  <strong className="break-all">{formatWhatsAppNumber(connection.whatsappNumber)}</strong>{' '}
                                  dari akun Anda. WhatsApp ini tidak akan bisa menggunakan bot Monly AI.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                <AlertDialogCancel className="w-full sm:w-auto">Batal</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDisconnect(connection.id)}
                                  className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
                                  disabled={disconnectMutation.isPending}
                                >
                                  {disconnectMutation.isPending ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Memutus...
                                    </>
                                  ) : (
                                    'Ya, Putuskan'
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8 text-gray-500">
                    <MessageCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm sm:text-base">Belum ada WhatsApp yang terhubung</p>
                    <p className="text-xs sm:text-sm">Gunakan kode aktivasi untuk menghubungkan</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bot Features */}
          <Card className="shadow-lg border-0 bg-white">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-lg sm:text-xl">Fitur Bot WhatsApp</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {[
                  {
                    title: "💰 Pencatatan Keuangan",
                    description: "Catat pemasukan & pengeluaran dengan mudah",
                    icon: "💸",
                    examples: ["keluar 50000 untuk makan", "masuk 500000 dari gaji", "bayar 25000 transport"]
                  },
                  {
                    title: "📊 Cek Saldo & Laporan",
                    description: "Lihat saldo dan ringkasan keuangan real-time",
                    icon: "💰",
                    examples: ["saldo", "hari ini", "minggu ini", "bulan ini"]
                  },
                  {
                    title: "🎯 Manajemen Budget",
                    description: "Atur dan pantau budget per kategori",
                    icon: "📋",
                    examples: ["budget check", "budget set makanan 1000000", "anggaran transport 500000"]
                  },
                  {
                    title: "🏆 Target & Goal",
                    description: "Buat dan tracking target finansial",
                    icon: "🎯",
                    examples: ["goal list", "goal add rumah 500000000", "target emergency 15000000"]
                  },
                  {
                    title: "📈 Analisis Kategori",
                    description: "Analisis pengeluaran per kategori",
                    icon: "📊",
                    examples: ["kategori", "analisis pengeluaran", "category breakdown"]
                  },
                  {
                    title: "🤖 AI Financial Insights",
                    description: "Saran dan insight cerdas dari AI",
                    icon: "🧠",
                    examples: ["ai insights", "saran keuangan", "tips hemat", "analisa pola"]
                  },
                  {
                    title: "📱 Quick Commands",
                    description: "Perintah cepat untuk info harian",
                    icon: "⚡",
                    examples: ["today", "yesterday", "week summary", "month report"]
                  },
                  {
                    title: "🚨 Smart Alerts",
                    description: "Notifikasi otomatis budget & target",
                    icon: "🔔",
                    examples: ["Auto notification", "Budget warnings", "Goal reminders"]
                  },
                  {
                    title: "📑 Laporan Lengkap",
                    description: "Laporan detail harian/mingguan/bulanan",
                    icon: "📋",
                    examples: ["laporan harian", "report weekly", "summary monthly"]
                  }
                ].map((feature, index) => (
                  <div key={index} className="p-3 sm:p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                    <div className="text-xl sm:text-2xl mb-2">{feature.icon}</div>
                    <h4 className="font-medium mb-1 text-sm sm:text-base">{feature.title}</h4>
                    <p className="text-xs sm:text-sm text-gray-600 mb-3">{feature.description}</p>
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-700">Contoh perintah:</div>
                      {feature.examples.map((example, idx) => (
                        <code key={idx} className="text-xs bg-gray-200 px-2 py-1 rounded block break-all">
                          {example}
                        </code>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
