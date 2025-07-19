# WhatsApp Integration Guide

## Overview
Sistem integrasi WhatsApp dengan AI untuk pencatatan keuangan otomatis mendukung:
- ✅ Pesan Teks (Transaction parsing)
- ✅ Pesan Suara (Speech-to-text + Transaction parsing)
- ✅ Gambar/Foto (OCR Receipt processing)

## Features

### 1. Text Message Processing
- **Input**: "Makan siang di McD 75000"
- **AI Processing**: OpenAI analysis untuk extract amount, description, category
- **Output**: Transaction tersimpan otomatis

### 2. Voice Message Processing
- **Input**: Voice message dengan informasi transaksi
- **AI Processing**: 
  1. OpenAI Whisper untuk speech-to-text
  2. OpenAI GPT untuk transaction analysis
- **Output**: Transaction tersimpan otomatis

### 3. Image/Receipt Processing
- **Input**: Foto struk/receipt
- **AI Processing**: 
  1. OpenAI Vision untuk OCR
  2. Extract transaction details
- **Output**: Multiple transactions dari satu receipt

## API Endpoints

### Multi-Account Routes (`/api/whatsapp/`)
- `POST /generate-code` - Generate activation code
- `GET /connections` - Get user's WhatsApp connections
- `GET /active-codes` - Get active activation codes
- `DELETE /connections/:id` - Disconnect WhatsApp
- `POST /initialize` - Initialize WhatsApp client
- `GET /status` - Get connection status
- `POST /send-test` - Send test message

### Legacy Routes (backward compatibility)
- `GET /whatsapp/status` - Get status
- `POST /whatsapp/connect` - Connect WhatsApp
- `POST /whatsapp/disconnect` - Disconnect
- `POST /whatsapp/init-handlers` - Initialize handlers

## WhatsApp Bot Commands

### User Commands
- `bantuan` atau `help` - Show help message
- `saldo` atau `balance` atau `ringkasan` - Show financial summary
- `status` - Show connection status

### Transaction Examples
- Text: "Makan siang 50000", "Gaji bulan ini 5000000"
- Voice: Record transaction details
- Image: Send receipt photos

## Implementation Details

### Message Processing Flow
1. **Message Received** → Check user authentication
2. **Authentication** → Verify WhatsApp number in database
3. **Message Type Detection** → Text/Voice/Image
4. **AI Processing** → OpenAI analysis
5. **Transaction Creation** → Save to database
6. **Response** → Send confirmation to user

### Error Handling
- Invalid activation codes
- Network errors
- AI processing failures
- Database errors
- WhatsApp API errors

### Security Features
- User authentication via activation codes
- WhatsApp number verification
- Rate limiting (to be implemented)
- Message encryption in transit

## Configuration

### Environment Variables
```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_KEY=your_openai_api_key (fallback)
```

### Database Schema
- `whatsapp_integrations` - User WhatsApp connections
- `whatsapp_activation_codes` - Temporary activation codes
- `transactions` - Financial transactions with AI flag

## Usage Instructions

### For Users:
1. Open Monly AI app
2. Go to "Integrasi WhatsApp"
3. Generate activation code
4. Send "AKTIVASI: [CODE]" to WhatsApp bot
5. Start sending transaction messages

### For Developers:
1. Ensure OpenAI API key is configured
2. Install dependencies: `npm install whatsapp-web.js qrcode puppeteer`
3. Start server
4. Monitor logs for connection status

## Troubleshooting

### Common Issues:
1. **WhatsApp not connecting**: Check Puppeteer installation
2. **AI not working**: Verify OpenAI API key
3. **Messages not processed**: Check message handlers registration
4. **Database errors**: Verify schema migrations

### Debug Steps:
1. Check server logs
2. Verify WhatsApp client status
3. Test OpenAI API separately
4. Check database connections
