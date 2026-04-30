import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  ok: boolean;
  data: T;
  meta?: Record<string, unknown>;
  requestId?: string;
}

/** Envuelve cualquier respuesta exitosa en { ok:true, data, requestId }. */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(
      map(data => {
        // Si el controller ya retornó la forma envuelta, no la duplicamos
        if (data && typeof data === 'object' && 'ok' in (data as object)) {
          return data as ApiResponse<T>;
        }
        return {
          ok: true,
          data,
          requestId: req.requestId,
        };
      }),
    );
  }
}
