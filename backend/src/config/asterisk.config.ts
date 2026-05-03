import { registerAs } from '@nestjs/config';

export default registerAs('asterisk', () => ({
  // Host *interno* — usado por el backend (que corre en Docker bridge) para
  // alcanzar AMI/ARI de Asterisk. En prod es `host.docker.internal` cuando
  // Asterisk corre con network_mode: host.
  host: process.env.ASTERISK_HOST,
  // Host *público* — el dominio que ven los navegadores de los agentes para
  // conectar al WSS de WebRTC (`wss://<publicHost>:8089/ws`). Si no se define
  // explícitamente, cae al `host` interno (rompe en prod cuando son distintos).
  publicHost: process.env.ASTERISK_PUBLIC_HOST ?? process.env.ASTERISK_HOST,
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
  agentsConfPath: process.env.ASTERISK_AGENTS_CONF_PATH ?? '/etc/asterisk/agents.conf',
  trunksConfPath: process.env.ASTERISK_TRUNKS_CONF_PATH ?? '/etc/asterisk/trunks.conf',
  // Path al dialplan dinamico generado por DialplanGeneratorService.
  // Es bind-mounted al volumen de Asterisk via docker-compose.
  extensionsDynamicPath: process.env.ASTERISK_EXTENSIONS_DYNAMIC_PATH ?? '/etc/asterisk/extensions_dynamic.conf',
}));
