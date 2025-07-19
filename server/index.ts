import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeWhatsAppClient, registerMessageHandlers } from "./whatsapp-service";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  
  // Add an API debug endpoint to help diagnose issues
  app.get('/api/debug', (req, res) => {
    res.json({ message: 'API is working correctly', timestamp: new Date().toISOString() });
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Initialize WhatsApp bot for multi-account support
    try {
      const botUserId = 'monly-ai-bot';
      log('Initializing WhatsApp bot...');
      const connection = initializeWhatsAppClient(botUserId);
      
      // Register message handlers once the client is ready
      const checkReady = setInterval(() => {
        if (connection.status === 'ready') {
          log('WhatsApp bot is ready! Registering message handlers...');
          const handlersRegistered = registerMessageHandlers(botUserId);
          if (handlersRegistered) {
            log('✅ WhatsApp bot message handlers registered successfully');
          } else {
            log('❌ Failed to register WhatsApp bot message handlers');
          }
          clearInterval(checkReady);
        } else if (connection.status === 'qr_received') {
          log('WhatsApp QR code received. Please scan with your WhatsApp bot account.');
        }
      }, 2000);
      
      // Clear interval after 5 minutes if still not ready
      setTimeout(() => {
        clearInterval(checkReady);
        if (connection.status !== 'ready') {
          log('WhatsApp bot initialization timed out');
        }
      }, 300000); // 5 minutes
      
    } catch (error) {
      log(`Failed to initialize WhatsApp bot: ${error}`);
    }
  });
})();
