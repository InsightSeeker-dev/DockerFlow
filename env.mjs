import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NEXTAUTH_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(1),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.string().min(1),
    SMTP_USER: z.string().email(),
    SMTP_PASSWORD: z.string().min(1),
    SMTP_FROM: z.string().min(1),
    SMTP_SECURE: z.string(),
    OVH_APPLICATION_KEY: z.string().min(1),
    OVH_APPLICATION_SECRET: z.string().min(1),
    OVH_CONSUMER_KEY: z.string().min(1),
    OVH_ENDPOINT: z.string().min(1),
    DOMAIN_NAME: z.string().min(1),
    SERVER_IP: z.string().ip(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_FROM: process.env.SMTP_FROM,
    SMTP_SECURE: process.env.SMTP_SECURE,
    OVH_APPLICATION_KEY: process.env.OVH_APPLICATION_KEY,
    OVH_APPLICATION_SECRET: process.env.OVH_APPLICATION_SECRET,
    OVH_CONSUMER_KEY: process.env.OVH_CONSUMER_KEY,
    OVH_ENDPOINT: process.env.OVH_ENDPOINT,
    DOMAIN_NAME: process.env.DOMAIN_NAME,
    SERVER_IP: process.env.SERVER_IP,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
});
