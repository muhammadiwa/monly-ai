# Monly AI - Financial Tracking Application

## Overview

Monly AI is a full-stack financial tracking application that leverages AI to help users manage their finances through intuitive interfaces including WhatsApp integration, OCR receipt processing, and voice message analysis. The application automatically categorizes transactions and provides comprehensive financial insights through an interactive dashboard.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite for development and production builds
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for client-side routing
- **UI Components**: Radix UI primitives with custom styling

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **AI Services**: OpenAI GPT-4o for transaction analysis, OCR, and categorization
- **Authentication**: Replit Auth with session management
- **File Processing**: Multer for handling image uploads

### Database Schema
The application uses PostgreSQL with the following key entities:
- **Users**: User profiles and authentication data
- **Categories**: Transaction categories with icons and colors
- **Transactions**: Financial transactions with AI-processed metadata
- **Budgets**: User-defined spending limits per category
- **Sessions**: Authentication session storage (required for Replit Auth)

## Key Components

### AI-Powered Transaction Processing
- **OCR Engine**: Processes receipt images to extract transaction data
- **Speech-to-Text**: Converts voice messages to transaction records
- **Natural Language Processing**: Analyzes text messages for financial data
- **Auto-categorization**: Intelligently assigns categories to transactions

### WhatsApp Integration
- **Business API**: Receives messages, images, and voice notes
- **Multi-modal Input**: Supports text, image, and audio transaction entry
- **Real-time Processing**: Immediate transaction analysis and storage

### Financial Dashboard
- **Real-time Analytics**: Live financial statistics and trends
- **Visual Charts**: Expense categories, monthly trends, and budget progress
- **Transaction Management**: Full CRUD operations for financial records
- **Budget Tracking**: Goal setting and progress monitoring

### Authentication & Security
- **Replit Auth**: Integrated OAuth authentication system
- **Session Management**: Secure session storage with PostgreSQL
- **Data Privacy**: Encrypted data handling and secure API endpoints

## Data Flow

1. **User Input**: Transaction data enters via web interface or WhatsApp
2. **AI Processing**: OpenAI services analyze and extract financial information
3. **Data Storage**: Processed transactions stored in PostgreSQL database
4. **Real-time Updates**: TanStack Query manages client-side cache invalidation
5. **Dashboard Updates**: React components re-render with fresh financial data

## External Dependencies

### Core Services
- **OpenAI API**: GPT-4o for transaction analysis and categorization
- **Neon Database**: Serverless PostgreSQL hosting
- **Replit Auth**: Authentication and user management

### Development Tools
- **Drizzle Kit**: Database schema management and migrations
- **ESBuild**: Server-side bundling for production deployment

### UI Libraries
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling framework
- **Lucide React**: Icon library for consistent iconography

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with hot module replacement
- **Database**: Neon serverless PostgreSQL with connection pooling
- **Environment Variables**: Secure credential management

### Production Build
- **Frontend**: Vite builds static assets to `dist/public`
- **Backend**: ESBuild compiles TypeScript server to `dist/index.js`
- **Database**: Drizzle manages schema migrations with `db:push`

### Scalability Considerations
- **Serverless Architecture**: Neon database scales automatically
- **Connection Pooling**: Efficient database connection management
- **Static Asset Serving**: Optimized frontend delivery

### Security Measures
- **Environment Isolation**: Separate development and production configurations
- **Session Security**: HTTP-only cookies with secure flags
- **Data Encryption**: PostgreSQL encryption at rest
- **API Security**: Authentication middleware on all protected routes

The application is designed to be easily deployable on Replit's infrastructure while maintaining the flexibility to scale to other platforms as needed.