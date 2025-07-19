import { db } from './server/db.ts';
import { whatsappIntegrations, whatsappActivationCodes } from './shared/schema.ts';

async function checkWhatsAppData() {
  try {
    console.log('=== WhatsApp Integrations ===');
    const integrations = await db.select().from(whatsappIntegrations);
    console.log(JSON.stringify(integrations, null, 2));

    console.log('\n=== WhatsApp Activation Codes ===');
    const codes = await db.select().from(whatsappActivationCodes);
    console.log(JSON.stringify(codes, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkWhatsAppData();
