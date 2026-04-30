import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.BACKEND_PORT ?? '3001', 10),
  publicUrl: process.env.PUBLIC_APP_URL,
  publicApiUrl: process.env.PUBLIC_API_URL,
  bootstrap: {
    email: process.env.BOOTSTRAP_SUPERADMIN_EMAIL,
    password: process.env.BOOTSTRAP_SUPERADMIN_PASSWORD,
    name: process.env.BOOTSTRAP_SUPERADMIN_NAME,
  },
}));
