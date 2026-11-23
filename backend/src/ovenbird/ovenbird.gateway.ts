import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  Command,
  Device,
  DeviceStatus,
  OvenbirdClient,
} from '@ovenbird/node';
import { OvenbirdError } from '@ovenbird/node';
import { translateOvenbirdError } from './ovenbird-errors';

/** Parte del cliente de `@ovenbird/node` que usa el backend (permite reemplazarlo en tests). */
export type OvenbirdClientLike = Pick<
  OvenbirdClient,
  'devices' | 'pairing' | 'commands' | 'embed'
>;

export const OVENBIRD_CLIENT = Symbol('OVENBIRD_CLIENT');

/** Tope de páginas al listar dispositivos del tenant (100 por página). */
const MAX_PAGES = 20;

/**
 * Único punto de acceso a Ovenbird. Cada llamada traduce los errores del SDK a respuestas
 * HTTP del contrato y registra solo la operación y el código (nunca tokens ni el secret).
 */
@Injectable()
export class OvenbirdGateway {
  private readonly logger = new Logger('Ovenbird');

  constructor(
    @Inject(OVENBIRD_CLIENT) private readonly client: OvenbirdClientLike,
  ) {}

  /** Todos los dispositivos del tenant (recorre las páginas del SDK). */
  listAllDevices(): Promise<Device[]> {
    return this.call('devices.list', async () => {
      const all: Device[] = [];
      let cursor: string | undefined;
      for (let i = 0; i < MAX_PAGES; i++) {
        const page = await this.client.devices.list({ limit: 100, cursor });
        all.push(...page.items);
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
      return all;
    });
  }

  deviceStatus(deviceId: string): Promise<DeviceStatus> {
    return this.call('devices.status', () =>
      this.client.devices.status(deviceId),
    );
  }

  createPairingCode(
    label?: string,
  ): Promise<{ code: string; expiresAt: Date }> {
    return this.call('pairing.createCode', () =>
      this.client.pairing.createCode(label ? { label } : {}),
    );
  }

  sendCommand(
    deviceId: string,
    dps: Record<string, unknown>,
    ttlS?: number,
  ): Promise<Command> {
    return this.call('commands.send', () =>
      this.client.commands.send(deviceId, { dps, ttlS }),
    );
  }

  getCommand(commandId: string): Promise<Command> {
    return this.call('commands.get', () => this.client.commands.get(commandId));
  }

  createEmbedToken(
    deviceIds: string[],
    ttlS: number,
  ): Promise<{ token: string; expiresAt: Date }> {
    return this.call('embed.createToken', () =>
      this.client.embed.createToken({ deviceIds, ttlS }),
    );
  }

  private async call<T>(op: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const problem = translateOvenbirdError(err);
      const origin =
        err instanceof OvenbirdError
          ? `${err.name} status=${err.status} code=${err.code}`
          : err instanceof Error
            ? err.name
            : 'unknown';
      this.logger.warn(
        `${op} falló (${origin}) -> ${problem.status} ${problem.code}`,
      );
      throw problem;
    }
  }
}
