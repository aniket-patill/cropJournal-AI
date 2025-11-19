import Groq from 'groq-sdk';

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (groqClient) {
    return groqClient;
  }

  const groqApiKey = process.env.GROQ_API_KEY;

  if (!groqApiKey) {
    throw new Error(
      'Missing GROQ_API_KEY environment variable. Please set GROQ_API_KEY in your .env file.'
    );
  }

  groqClient = new Groq({
    apiKey: groqApiKey,
  });

  return groqClient;
}

// Export a proxy that lazily initializes the client
export const groq = new Proxy({} as Groq, {
  get(_target, prop) {
    const client = getGroqClient();
    const value = client[prop as keyof Groq];
    return typeof value === 'function' ? value.bind(client) : value;
  },
}) as Groq;

