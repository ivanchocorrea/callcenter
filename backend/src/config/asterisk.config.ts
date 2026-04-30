import { registerAs } from '@nestjs/config';

export default registerAs('asterisk', () => ({
  host: process.env.ASTERISK_HOST,
  ami: {
    port: parseInt(process.env.ASTERISK_AMI_PORT ?? '5038', 10),
    username: process.env.ASTERISK_AMI_USER,
    password: process.env.ASTERISK_AMI_PASSWORD,
  },
  ari: {
    port: parseInt(process.env.ASTERISK_ARI_PORT ?? '8088', 10),
    username: process.env.ASTERISK_ARI_USER,
    password: process.env.ASTERISK_ARI_PASSWORD,
    appName: process.env.ASTERISK_ARI_APP ?? 'callcenter-app',
  },
}));
