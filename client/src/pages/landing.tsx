import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { 
  ArrowRight, 
  BarChart, 
  Brain, 
  Camera, 
  MessageCircle, 
  PiggyBank, 
  TrendingUp, 
  Star, 
  Check, 
  Zap, 
  Shield, 
  Smartphone, 
  Globe,
  Users,
  DollarSign,
  ChevronRight,
  Play,
  CreditCard,
  Coins,
  Target,
  Sparkles,
  Award,
  Crown
} from "lucide-react";

export default function Landing() {
  const [isYearly, setIsYearly] = useState(false);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50"></div>
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div className="absolute top-40 right-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-1000"></div>
          <div className="absolute -bottom-32 left-40 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-12 h-12 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-300">
                <span className="text-white font-bold text-xl">M</span>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                Monly AI
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                className="hidden md:inline-flex text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-300"
                onClick={() => scrollToSection('features')}
              >
                Features
              </Button>
              <Button 
                variant="ghost"
                className="hidden md:inline-flex text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-300"
                onClick={() => scrollToSection('pricing')}
              >
                Pricing
              </Button>
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 px-6 py-2"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-8 bg-gradient-to-r from-emerald-100 to-blue-100 text-emerald-700 border-0 px-6 py-2 text-sm font-medium hover:scale-105 transition-transform duration-300">
            <Sparkles className="w-4 h-4 mr-2" />
            New: AI-Powered Financial Insights
          </Badge>
          
          <h1 className="text-6xl md:text-8xl font-bold text-gray-900 mb-8 leading-tight">
            Your Money,
            <br />
            <span className="bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent animate-pulse">
              Smarter Than Ever
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed">
            Transform your financial life with AI-powered insights, automated expense tracking, 
            and intelligent budgeting that adapts to your lifestyle.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button 
              size="lg" 
              onClick={() => window.location.href = '/api/login'}
              className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 px-8 py-4 text-lg font-semibold"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-2 border-gray-300 hover:border-emerald-600 hover:bg-emerald-50 transition-all duration-300 px-8 py-4 text-lg font-semibold"
              onClick={() => scrollToSection('demo')}
            >
              <Play className="mr-2 h-5 w-5" />
              Watch Demo
            </Button>
          </div>

          {/* 3D Financial Cards Animation */}
          <div className="relative max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 perspective-1000">
              <Card className="transform hover:rotate-y-12 transition-transform duration-500 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 shadow-xl hover:shadow-2xl">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Brain className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">AI Intelligence</h3>
                  <p className="text-gray-600">Smart categorization and insights</p>
                </CardContent>
              </Card>
              
              <Card className="transform hover:rotate-y-12 transition-transform duration-500 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-xl hover:shadow-2xl">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Camera className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Receipt Scanning</h3>
                  <p className="text-gray-600">Instant expense capture</p>
                </CardContent>
              </Card>
              
              <Card className="transform hover:rotate-y-12 transition-transform duration-500 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-xl hover:shadow-2xl">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <BarChart className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Smart Analytics</h3>
                  <p className="text-gray-600">Real-time financial insights</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gradient-to-br from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Powerful Features for 
              <span className="bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent"> Smart Money Management</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Everything you need to take control of your finances with cutting-edge AI technology
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <Brain className="h-8 w-8" />,
                title: "AI-Powered Insights",
                description: "Get personalized financial advice and spending patterns analysis powered by advanced AI",
                gradient: "from-emerald-500 to-blue-500"
              },
              {
                icon: <Camera className="h-8 w-8" />,
                title: "Receipt OCR",
                description: "Scan receipts instantly with our advanced OCR technology for automatic expense tracking",
                gradient: "from-blue-500 to-purple-500"
              },
              {
                icon: <MessageCircle className="h-8 w-8" />,
                title: "WhatsApp Integration",
                description: "Track expenses directly through WhatsApp with natural language processing",
                gradient: "from-purple-500 to-pink-500"
              },
              {
                icon: <BarChart className="h-8 w-8" />,
                title: "Smart Analytics",
                description: "Beautiful charts and insights to understand your spending habits and financial health",
                gradient: "from-pink-500 to-red-500"
              },
              {
                icon: <Target className="h-8 w-8" />,
                title: "Budget Tracking",
                description: "Set and track budgets with intelligent alerts and recommendations",
                gradient: "from-red-500 to-orange-500"
              },
              {
                icon: <Shield className="h-8 w-8" />,
                title: "Bank-Level Security",
                description: "Your financial data is protected with enterprise-grade security measures",
                gradient: "from-orange-500 to-yellow-500"
              }
            ].map((feature, index) => (
              <Card key={index} className="group hover:shadow-2xl transition-all duration-500 transform hover:scale-105 bg-white border-0 shadow-lg">
                <CardContent className="p-8">
                  <div className={`w-16 h-16 bg-gradient-to-r ${feature.gradient} rounded-2xl flex items-center justify-center mb-6 text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gradient-to-br from-emerald-50 to-blue-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Simple, Transparent 
              <span className="bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent"> Pricing</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Choose the perfect plan for your financial journey. Start free, upgrade when you're ready.
            </p>
            
            {/* Pricing Toggle */}
            <div className="flex items-center justify-center gap-4 mb-12">
              <span className={`text-lg font-semibold ${!isYearly ? 'text-emerald-600' : 'text-gray-500'}`}>
                Monthly
              </span>
              <Switch
                checked={isYearly}
                onCheckedChange={setIsYearly}
                className="data-[state=checked]:bg-emerald-600"
              />
              <span className={`text-lg font-semibold ${isYearly ? 'text-emerald-600' : 'text-gray-500'}`}>
                Yearly
              </span>
              <Badge className="bg-gradient-to-r from-emerald-600 to-blue-600 text-white border-0 ml-2">
                Save 20%
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <Card className="relative bg-white border-2 border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:scale-105">
              <CardHeader className="text-center pb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Coins className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">Free</CardTitle>
                <CardDescription className="text-gray-600">Perfect for getting started</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">$0</span>
                  <span className="text-gray-600 ml-2">forever</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[
                    "Up to 100 transactions/month",
                    "Basic expense tracking",
                    "Simple budget tracking",
                    "Mobile app access",
                    "Email support"
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-emerald-600" />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
                <Button 
                  className="w-full mt-8 bg-gray-600 hover:bg-gray-700 text-white"
                  onClick={() => window.location.href = '/api/login'}
                >
                  Get Started Free
                </Button>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="relative bg-gradient-to-br from-emerald-50 to-blue-50 border-2 border-emerald-300 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:scale-105">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-emerald-600 to-blue-600 text-white border-0 px-4 py-2 shadow-lg">
                  <Award className="w-4 h-4 mr-1" />
                  Most Popular
                </Badge>
              </div>
              <CardHeader className="text-center pb-8 pt-8">
                <div className="w-16 h-16 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <CreditCard className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">Pro</CardTitle>
                <CardDescription className="text-gray-600">Best for individuals</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">
                    ${isYearly ? '79' : '9.99'}
                  </span>
                  <span className="text-gray-600 ml-2">/{isYearly ? 'year' : 'month'}</span>
                  {isYearly && <div className="text-sm text-emerald-600 font-semibold mt-1">Save $40/year</div>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[
                    "Unlimited transactions",
                    "AI-powered insights",
                    "Receipt OCR scanning",
                    "WhatsApp integration",
                    "Advanced analytics",
                    "Custom categories",
                    "Priority support"
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-emerald-600" />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
                <Button 
                  className="w-full mt-8 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white shadow-lg"
                  onClick={() => window.location.href = '/api/login'}
                >
                  Start Pro Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Premium Plan */}
            <Card className="relative bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-300 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:scale-105">
              <CardHeader className="text-center pb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Crown className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">Premium</CardTitle>
                <CardDescription className="text-gray-600">For power users</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">
                    ${isYearly ? '159' : '19.99'}
                  </span>
                  <span className="text-gray-600 ml-2">/{isYearly ? 'year' : 'month'}</span>
                  {isYearly && <div className="text-sm text-purple-600 font-semibold mt-1">Save $80/year</div>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[
                    "Everything in Pro",
                    "Advanced AI predictions",
                    "Investment tracking",
                    "Multi-currency support",
                    "API access",
                    "Custom reports",
                    "Dedicated support"
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-purple-600" />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
                <Button 
                  className="w-full mt-8 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg"
                  onClick={() => window.location.href = '/api/login'}
                >
                  Go Premium
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-20 bg-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            See Monly AI in 
            <span className="bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent"> Action</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12">
            Watch how easy it is to track your expenses and get AI-powered insights
          </p>
          
          <div className="relative max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-emerald-600 to-blue-600 rounded-2xl p-8 shadow-2xl">
              <div className="bg-white rounded-xl p-8 text-center">
                <div className="w-20 h-20 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Play className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Interactive Demo</h3>
                <p className="text-gray-600 mb-6">
                  See how Monly AI transforms your financial management in under 2 minutes
                </p>
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white shadow-lg"
                  onClick={() => window.location.href = '/api/login'}
                >
                  Try Live Demo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-emerald-600 to-blue-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Finances?
          </h2>
          <p className="text-xl text-emerald-100 max-w-3xl mx-auto mb-12">
            Join thousands of users who have already taken control of their financial future with Monly AI
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              onClick={() => window.location.href = '/api/login'}
              className="bg-white text-emerald-600 hover:bg-gray-100 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 px-8 py-4 text-lg font-semibold"
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white hover:text-emerald-600 transition-all duration-300 px-8 py-4 text-lg font-semibold"
              onClick={() => scrollToSection('pricing')}
            >
              View Pricing
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-10 h-10 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              <span className="text-2xl font-bold">Monly AI</span>
            </div>
            <p className="text-gray-400 text-center md:text-right">
              © 2024 Monly AI. All rights reserved. Transform your financial future today.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}