import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartLine, MessageCircle, Camera, Brain, Shield, Target } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <ChartLine className="h-12 w-12 text-primary mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">Monly AI</h1>
          </div>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            AI-powered financial tracking that learns from your spending habits. 
            Track expenses through WhatsApp, photos, and voice messages.
          </p>
          <Button 
            size="lg" 
            className="bg-primary hover:bg-primary/90 text-white px-8 py-3 text-lg"
            onClick={() => window.location.href = '/api/login'}
          >
            Get Started
          </Button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <MessageCircle className="h-10 w-10 text-primary mb-2" />
              <CardTitle>WhatsApp Integration</CardTitle>
              <CardDescription>
                Send transactions via WhatsApp chat, voice messages, or text
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Simply message your expenses naturally and let AI categorize them automatically.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <Camera className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Receipt OCR</CardTitle>
              <CardDescription>
                Snap photos of receipts for instant transaction recording
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Advanced OCR technology extracts transaction details from receipt images.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <Brain className="h-10 w-10 text-primary mb-2" />
              <CardTitle>AI Categorization</CardTitle>
              <CardDescription>
                Smart categorization that learns from your spending patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                AI automatically categorizes transactions and provides spending insights.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <Shield className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Privacy First</CardTitle>
              <CardDescription>
                Your financial data is encrypted and never shared
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                End-to-end encryption ensures your financial information stays private.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <Target className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Smart Budgeting</CardTitle>
              <CardDescription>
                Set budgets and receive intelligent alerts and recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                AI-powered budget tracking with personalized spending recommendations.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <ChartLine className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Advanced Analytics</CardTitle>
              <CardDescription>
                Interactive charts and detailed financial reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Beautiful visualizations help you understand your spending patterns.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to take control of your finances?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Join thousands of users who trust Monly AI to manage their money smarter.
          </p>
          <Button 
            size="lg" 
            className="bg-primary hover:bg-primary/90 text-white px-8 py-3 text-lg"
            onClick={() => window.location.href = '/api/login'}
          >
            Start Your Free Trial
          </Button>
        </div>
      </div>
    </div>
  );
}
