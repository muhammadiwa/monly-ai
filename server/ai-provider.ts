/**
 * AI Provider Abstraction Layer
 * Mendukung OpenAI, OpenRouter, dan MegaLLM untuk multi-model AI
 */

import OpenAI from "openai";

export type AIProvider = "openai" | "openrouter" | "megallm";

export interface AIConfig {
    provider: AIProvider;
    apiKey: string;
    baseURL?: string;
    defaultHeaders?: Record<string, string>;
    models: {
        chat: string;
        analysis: string;
        vision: string;
        fallback: string;
    };
}

// Konfigurasi default berdasarkan environment
function getAIConfig(): AIConfig {
    const provider = (process.env.AI_PROVIDER || "openai") as AIProvider;

    if (provider === "megallm") {
        return {
            provider: "megallm",
            apiKey: process.env.MEGALLM_API_KEY || "",
            baseURL: process.env.MEGALLM_BASE_URL || "https://api.megallm.app/v1",
            defaultHeaders: {
                "X-App-Name": "Monly AI Finance",
            },
            models: {
                chat: process.env.AI_MODEL_CHAT || "gpt-4o-mini",
                analysis: process.env.AI_MODEL_ANALYSIS || "gpt-4o-mini",
                vision: process.env.AI_MODEL_VISION || "gpt-4o-mini",
                fallback: process.env.AI_MODEL_FALLBACK || "gpt-3.5-turbo",
            },
        };
    }

    if (provider === "openrouter") {
        return {
            provider: "openrouter",
            apiKey: process.env.OPENROUTER_API_KEY || "",
            baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
            defaultHeaders: {
                "HTTP-Referer": process.env.DOMAIN || "http://localhost:5000",
                "X-Title": "Monly AI Finance",
            },
            models: {
                chat: process.env.AI_MODEL_CHAT || "openai/gpt-4o-mini",
                analysis: process.env.AI_MODEL_ANALYSIS || "openai/gpt-4o-mini",
                vision: process.env.AI_MODEL_VISION || "openai/gpt-4o-mini",
                fallback: process.env.AI_MODEL_FALLBACK || "meta-llama/llama-3.2-3b-instruct:free",
            },
        };
    }

    // Default: OpenAI
    return {
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "",
        models: {
            chat: process.env.AI_MODEL_CHAT || "gpt-4o-mini",
            analysis: process.env.AI_MODEL_ANALYSIS || "gpt-4o-mini",
            vision: process.env.AI_MODEL_VISION || "gpt-4o-mini",
            fallback: process.env.AI_MODEL_FALLBACK || "gpt-3.5-turbo",
        },
    };
}

// Singleton AI client
let aiClient: OpenAI | null = null;
let currentConfig: AIConfig | null = null;

export function getAIClient(): OpenAI {
    const config = getAIConfig();

    // Re-create client jika config berubah
    if (!aiClient || JSON.stringify(currentConfig) !== JSON.stringify(config)) {
        currentConfig = config;

        const clientOptions: any = {
            apiKey: config.apiKey,
            timeout: 60000, // 60 seconds timeout for Vision API
            maxRetries: 2,  // Retry 2 times on failure
        };

        // Set baseURL untuk provider non-OpenAI
        if (config.baseURL) {
            clientOptions.baseURL = config.baseURL;
        }

        // Set custom headers jika ada
        if (config.defaultHeaders) {
            clientOptions.defaultHeaders = config.defaultHeaders;
        }

        aiClient = new OpenAI(clientOptions);
        console.log(`🤖 AI Provider initialized: ${config.provider} (${config.baseURL || 'api.openai.com'})`);
    }

    return aiClient;
}

export function getModelForTask(task: "chat" | "analysis" | "vision" | "fallback"): string {
    const config = getAIConfig();
    return config.models[task];
}

export function getAIProviderInfo(): { provider: AIProvider; models: AIConfig["models"] } {
    const config = getAIConfig();
    return {
        provider: config.provider,
        models: config.models,
    };
}


// Helper untuk chat completion dengan fallback
export async function createChatCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options: {
        task?: "chat" | "analysis" | "vision";
        temperature?: number;
        maxTokens?: number;
        responseFormat?: { type: "json_object" | "text" };
    } = {}
): Promise<OpenAI.Chat.ChatCompletion> {
    const client = getAIClient();
    const model = getModelForTask(options.task || "chat");
    const fallbackModel = getModelForTask("fallback");

    try {
        const response = await client.chat.completions.create({
            model,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 1500,
            ...(options.responseFormat && { response_format: options.responseFormat }),
        });

        return response;
    } catch (error: any) {
        console.error(`❌ AI Error with model ${model}:`, error.message);

        // Coba fallback model
        if (model !== fallbackModel) {
            console.log(`🔄 Trying fallback model: ${fallbackModel}`);
            try {
                const fallbackResponse = await client.chat.completions.create({
                    model: fallbackModel,
                    messages,
                    temperature: options.temperature ?? 0.7,
                    max_tokens: options.maxTokens ?? 1500,
                    ...(options.responseFormat && { response_format: options.responseFormat }),
                });

                return fallbackResponse;
            } catch (fallbackError: any) {
                console.error(`❌ Fallback model also failed:`, fallbackError.message);
                throw fallbackError;
            }
        }

        throw error;
    }
}

// Model recommendations untuk OpenRouter
export const OPENROUTER_MODELS = {
    // Model Gratis
    free: {
        "meta-llama/llama-3.2-3b-instruct:free": "Llama 3.2 3B - Fast, free",
        "google/gemma-2-9b-it:free": "Gemma 2 9B - Good quality, free",
        "mistralai/mistral-7b-instruct:free": "Mistral 7B - Balanced, free",
    },
    // Model Berbayar (murah)
    budget: {
        "openai/gpt-4o-mini": "GPT-4o Mini - Best value",
        "anthropic/claude-3-haiku": "Claude 3 Haiku - Fast & cheap",
        "google/gemini-flash-1.5": "Gemini Flash - Very fast",
    },
    // Model Premium
    premium: {
        "openai/gpt-4o": "GPT-4o - Best overall",
        "anthropic/claude-3.5-sonnet": "Claude 3.5 Sonnet - Best reasoning",
        "google/gemini-pro-1.5": "Gemini Pro - Good for analysis",
    },
    // Model dengan Vision
    vision: {
        "openai/gpt-4o-mini": "GPT-4o Mini - Good vision, affordable",
        "openai/gpt-4o": "GPT-4o - Best vision",
        "anthropic/claude-3.5-sonnet": "Claude 3.5 - Excellent vision",
    },
};

// Model recommendations untuk MegaLLM
// MegaLLM menggunakan format model name yang mirip OpenAI
export const MEGALLM_MODELS = {
    // Model Chat
    chat: {
        "gpt-4o-mini": "GPT-4o Mini - Best value, fast",
        "gpt-4o": "GPT-4o - Best overall quality",
        "gpt-4-turbo": "GPT-4 Turbo - High quality",
        "gpt-3.5-turbo": "GPT-3.5 Turbo - Budget option",
        "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet - Best reasoning",
        "claude-3-haiku-20240307": "Claude 3 Haiku - Fast & cheap",
        "gemini-1.5-pro": "Gemini 1.5 Pro - Good for analysis",
        "gemini-1.5-flash": "Gemini 1.5 Flash - Very fast",
    },
    // Model dengan Vision
    vision: {
        "gpt-4o-mini": "GPT-4o Mini - Good vision, affordable",
        "gpt-4o": "GPT-4o - Best vision quality",
        "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet - Excellent vision",
        "gemini-1.5-pro": "Gemini 1.5 Pro - Good vision",
    },
    // Model untuk Analysis
    analysis: {
        "gpt-4o-mini": "GPT-4o Mini - Best value for analysis",
        "claude-3-5-sonnet-20241022": "Claude 3.5 - Best for complex analysis",
        "gemini-1.5-pro": "Gemini 1.5 Pro - Good structured output",
    },
};

// Helper untuk mendapatkan info provider saat ini
export function getCurrentProviderInfo(): {
    provider: AIProvider;
    baseURL: string | undefined;
    models: AIConfig["models"];
    availableModels: Record<string, Record<string, string>>;
} {
    const config = getAIConfig();

    let availableModels: Record<string, Record<string, string>>;

    switch (config.provider) {
        case "megallm":
            availableModels = MEGALLM_MODELS;
            break;
        case "openrouter":
            availableModels = OPENROUTER_MODELS;
            break;
        default:
            availableModels = {
                chat: { "gpt-4o-mini": "GPT-4o Mini", "gpt-4o": "GPT-4o", "gpt-3.5-turbo": "GPT-3.5 Turbo" },
                vision: { "gpt-4o-mini": "GPT-4o Mini", "gpt-4o": "GPT-4o" },
            };
    }

    return {
        provider: config.provider,
        baseURL: config.baseURL,
        models: config.models,
        availableModels,
    };
}
