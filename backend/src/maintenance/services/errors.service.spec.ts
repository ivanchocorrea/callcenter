import { ErrorsService } from './errors.service';

/**
 * Pruebas de la lógica pura de ErrorsService:
 *  - Traducción técnica → lenguaje claro
 *  - Redacción de secretos en metadata y stack
 *  - Recomendaciones por origen
 */
describe('ErrorsService (pure logic)', () => {
  const ds: any = { query: jest.fn().mockResolvedValue({ insertId: 1 }) };
  const svc = new ErrorsService(ds);
  const callPrivate = (name: string, ...args: any[]) => (svc as any)[name](...args);

  it('translate produce mensaje claro para errores de BD', () => {
    const msg = callPrivate('translate', {
      source: 'database', module: 'X', technicalMessage: 'ECONNREFUSED 127.0.0.1:3306',
    });
    expect(msg).toMatch(/base de datos/i);
  });

  it('translate produce mensaje claro para Asterisk', () => {
    const msg = callPrivate('translate', {
      source: 'telephony', module: 'X', technicalMessage: 'AMI auth failed: pjsip down',
    });
    expect(msg).toMatch(/llamadas/i);
  });

  it('suggest sugiere reinicio en errores críticos', () => {
    const r = callPrivate('suggest', { source: 'backend', module: 'X', severity: 'critical', technicalMessage: 'boom' });
    expect(r).toMatch(/cr[ií]tico/i);
  });

  it('scrub elimina passwords y tokens en metadata', () => {
    const out = callPrivate('scrub', {
      user: 'ana',
      api_key: 'sk-abcdef',
      nested: { token: 'eyJ...', other: 'ok' },
    });
    expect(out.user).toBe('ana');
    expect(out.api_key).toBe('***');
    expect((out.nested as any).token).toBe('***');
    expect((out.nested as any).other).toBe('ok');
  });

  it('scrubText elimina JWT y Authorization', () => {
    const cleaned = callPrivate('scrubText',
      'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature err'
    );
    expect(cleaned).not.toMatch(/eyJhbGciOiJIUzI1NiI/);
  });

  it('record persiste con friendly y recommendation auto-generadas', async () => {
    const id = await svc.record({
      source: 'database', module: 'TestModule',
      technicalMessage: 'Lost connection ECONNRESET',
    });
    expect(id).toBe(1);
    expect(ds.query).toHaveBeenCalled();
    const args = ds.query.mock.calls[0][1];
    // 7º param = friendly_message
    expect(String(args[6])).toMatch(/base de datos/i);
  });
});
