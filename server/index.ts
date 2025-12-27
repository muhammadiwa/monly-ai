import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeSingleWhatsAppBot } from "./whatsapp-single-bot";
import { getHealthMonitor } from "./whatsapp-health-monitor";
import { startTransactionReminderScheduler } from "./transaction-reminder-scheduler";
import { startBudgetAlertScheduler } from "./budget-alert-scheduler";
import { startSubscriptionCronJobs } from "./cron/subscription-cron";

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

  // Use port from environment variable, fallback to 5000 if not set
  // this serves both the API and the client.
  const port = parseInt(process.env.PORT || '5000');
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);

    // Initialize single WhatsApp bot for all users (optional - can be triggered manually from admin panel)
    const autoInitWhatsApp = process.env.WHATSAPP_AUTO_INIT !== 'false'; // Default true unless explicitly disabled

    if (autoInitWhatsApp) {
      log('🤖 Auto-initializing WhatsApp Bot...');
      try {
        initializeSingleWhatsAppBot();
        log('✅ WhatsApp Bot initialization started');

        // Start health monitoring
        log('🏥 Starting WhatsApp health monitor...');
        const healthMonitor = getHealthMonitor();
        healthMonitor.start();
        log('✅ WhatsApp health monitor started');
      } catch (error) {
        log(`❌ WhatsApp Bot initialization failed: ${error}`);
      }
    } else {
      log('⏸️ WhatsApp Bot auto-initialization disabled (WHATSAPP_AUTO_INIT=false)');
      log('💡 Bot can be started manually from Admin Panel → WhatsApp Bot Config');
    }

    // Start transaction reminder scheduler
    log('⏰ Starting transaction reminder scheduler...');
    try {
      startTransactionReminderScheduler();
      log('✅ Transaction reminder scheduler started successfully');
    } catch (error) {
      log(`❌ Failed to start transaction reminder scheduler: ${error}`);
    }

    // Start budget alert scheduler
    log('⏰ Starting budget alert scheduler...');
    try {
      startBudgetAlertScheduler();
      log('✅ Budget alert scheduler started successfully');
    } catch (error) {
      log(`❌ Failed to start budget alert scheduler: ${error}`);
    }

    // Start subscription cron jobs
    log('⏰ Starting subscription cron jobs...');
    try {
      startSubscriptionCronJobs();
      log('✅ Subscription cron jobs started successfully');
    } catch (error) {
      log(`❌ Failed to start subscription cron jobs: ${error}`);
    }
  });
})();
