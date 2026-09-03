export const config = {
    ollama: {
        baseUrl: 'http://localhost:11434',
        chatModel: 'qwen3.5:0.8b',
        embeddingModel: 'mxbai-embed-large:latest',
        temperature: 0.3
    },
    langGraph: {
        model: process.env.LANGGRAPH_MODEL || 'qwen3.5:0.8b',
        baseURL: process.env.LANGGRAPH_BASE_URL || 'http://localhost:11434/v1',
        apiKey: 'ollama',    // Ollama 不校验 apiKey，随便填个占位符即可
        temperature: 0.7,
    },
}