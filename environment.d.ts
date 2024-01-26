declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production';
      readonly SPREAD_DOC_ID: string;
      readonly GOOGLE_API_KEY: string;
    }
  }
}

export {};
