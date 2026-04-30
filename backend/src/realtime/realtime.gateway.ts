import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EventBusService } from '../events/event-bus.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

interface SocketUser {
  userId: number;
  email: string;
  companyId: number | null;
  roles: string[];
  permissions: string[];
}

/**
 * Gateway Socket.IO. Cada cliente se conecta con su access_token JWT y queda
 * en una sala por empresa: `company:<id>`. Eventos que el backend publica
 * en EventBus por canal `co:<companyId>:<topic>` se forwardean al room
 * correspondiente.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
  transports: ['websocket'],
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly bus: EventBusService,
  ) {}

  afterInit(): void {
    // Forwarder genérico: cualquier evento publicado en `co:<id>:*` lo emitimos
    // a `company:<id>` con el topic como nombre del evento
    const subscribeTopic = (topic: string) => {
      this.bus.on(`co:event:${topic}`, () => undefined); // placeholder
    };
    // Como no podemos hacer wildcard sub fácilmente, suscribimos los topics
    // conocidos. Cuando emite InboundDispatcher, escuchamos en EventBus local.
    const topics = ['call', 'queue', 'agent', 'recording', 'webhook', 'ai'];
    for (const t of topics) subscribeTopic(t);

    // Atajo: re-emitir todo asterisk:event como `system.asterisk` para super_admin
    this.bus.on('asterisk:event', evt => {
      this.server.to('global:super').emit('system.asterisk', evt);
    });

    // Para los `co:<id>:<topic>`, la suscripción dinámica la hace
    // RealtimeForwarderService (abajo). Aquí solo iniciamos.
    this.logger.log('RealtimeGateway initialized');
  }

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = this.extractToken(socket);
      if (!token) throw new Error('no token');
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      });
      const user: SocketUser = {
        userId: payload.sub,
        email: payload.email,
        companyId: payload.companyId,
        roles: payload.roles ?? [],
        permissions: payload.permissions ?? [],
      };
      (socket.data as any).user = user;

      if (user.companyId) socket.join(`company:${user.companyId}`);
      if (user.roles.includes('super_admin')) socket.join('global:super');
      socket.join(`user:${user.userId}`);

      this.logger.debug(`socket connect uid=${user.userId} co=${user.companyId} roles=${user.roles.join(',')}`);
      socket.emit('hello', { user });
    } catch (e: any) {
      this.logger.warn(`Conexión rechazada: ${e?.message ?? e}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    const user = (socket.data as any).user as SocketUser | undefined;
    if (user) this.logger.debug(`socket disconnect uid=${user.userId}`);
  }

  private extractToken(socket: Socket): string | null {
    const headerAuth = socket.handshake.headers['authorization'] as string | undefined;
    if (headerAuth?.startsWith('Bearer ')) return headerAuth.substring(7);
    const q = socket.handshake.auth as any;
    return q?.token ?? null;
  }

  // -------- API pública para que otros servicios emitan a clientes --------
  emitToCompany(companyId: number, event: string, payload: unknown): void {
    this.server.to(`company:${companyId}`).emit(event, payload);
  }
  emitToUser(userId: number, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
