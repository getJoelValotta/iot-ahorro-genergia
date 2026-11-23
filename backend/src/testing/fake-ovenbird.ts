import type { Command, Device, DeviceStatus, Page } from '@ovenbird/node';
import { OvenbirdNotFoundError } from '@ovenbird/node';
import type { OvenbirdClientLike } from '../ovenbird/ovenbird.gateway';

type CommandStatus = Command['status'];
type Op = 'list' | 'status' | 'pair' | 'send' | 'getCommand' | 'embed';

/**
 * Ovenbird falso en memoria, con la misma forma que `@ovenbird/node`. Permite agregar
 * dispositivos, fijar su estado, cambiar el estado de comandos y forzar errores del SDK.
 */
export class FakeOvenbird implements OvenbirdClientLike {
  readonly deviceMap = new Map<string, Device>();
  readonly statusMap = new Map<string, DeviceStatus>();
  readonly commandMap = new Map<string, Command>();
  readonly sentCommands: Array<{
    deviceId: string;
    dps: Record<string, unknown>;
    ttlS?: number;
  }> = [];
  readonly embedRequests: Array<{ deviceIds: string[]; ttlS?: number }> = [];
  readonly pairingLabels: Array<string | undefined> = [];
  /** Estado con el que nace cada comando (el dispositivo virtual confirma al instante). */
  initialCommandStatus: CommandStatus = 'pending';
  private failures = new Map<Op | '*', Error>();
  private n = 0;

  /** Hace que la operación (o todas con `'*'`) lance este error hasta `clearFailures()`. */
  failWith(err: Error, op: Op | '*' = '*'): void {
    this.failures.set(op, err);
  }

  clearFailures(): void {
    this.failures.clear();
  }

  addDevice(partial: Partial<Device> & { deviceId: string }): Device {
    const now = new Date();
    const device: Device = {
      productId: 'ob.lora.unit',
      uid: `02:00:00:00:00:${String(this.deviceMap.size).padStart(2, '0')}`,
      name: `Unidad ${partial.deviceId}`,
      online: true,
      lastSeenAt: now,
      createdAt: now,
      metadata: {},
      connection: 'ble-bridge',
      ...partial,
    };
    this.deviceMap.set(device.deviceId, device);
    return device;
  }

  setBattery(deviceId: string, pct: number | null): void {
    const dps: DeviceStatus['dps'] = {};
    if (pct !== null) dps.battery_pct = { value: pct, ts: new Date() };
    this.statusMap.set(deviceId, {
      deviceId,
      online: true,
      lastSeenAt: new Date(),
      dps,
    });
  }

  setCommandStatus(commandId: string, status: CommandStatus): void {
    const c = this.commandMap.get(commandId);
    if (!c) throw new Error(`comando desconocido ${commandId}`);
    this.commandMap.set(commandId, { ...c, status, updatedAt: new Date() });
  }

  private check(op: Op): void {
    const err = this.failures.get(op) ?? this.failures.get('*');
    if (err) throw err;
  }

  readonly devices: OvenbirdClientLike['devices'] = {
    list: (opts) => {
      this.check('list');
      // Paginación real: obliga al gateway a recorrer cursores.
      const all = [...this.deviceMap.values()];
      const limit = opts?.limit ?? 50;
      const start = opts?.cursor ? Number(opts.cursor) : 0;
      const items = all.slice(start, start + limit);
      const page: Page<Device> = { items };
      if (start + limit < all.length) page.nextCursor = String(start + limit);
      return Promise.resolve(page);
    },
    get: (deviceId) => {
      const d = this.deviceMap.get(deviceId);
      return d
        ? Promise.resolve(d)
        : Promise.reject(
            new OvenbirdNotFoundError(404, 'not_found', 'not found'),
          );
    },
    update: () => Promise.reject(new Error('no implementado')),
    remove: () => Promise.reject(new Error('no implementado')),
    status: (deviceId) => {
      this.check('status');
      if (!this.deviceMap.has(deviceId)) {
        return Promise.reject(
          new OvenbirdNotFoundError(404, 'not_found', 'not found'),
        );
      }
      return Promise.resolve(
        this.statusMap.get(deviceId) ?? {
          deviceId,
          online: false,
          lastSeenAt: null,
          dps: {},
        },
      );
    },
    history: () => Promise.resolve([]),
  };

  readonly pairing: OvenbirdClientLike['pairing'] = {
    createCode: (opts) => {
      this.check('pair');
      this.pairingLabels.push(opts?.label);
      this.n += 1;
      return Promise.resolve({
        code: `PAIR${String(this.n).padStart(4, '0')}`,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      });
    },
  };

  readonly commands: OvenbirdClientLike['commands'] = {
    send: (deviceId, input) => {
      this.check('send');
      this.sentCommands.push({ deviceId, ...input });
      this.n += 1;
      const now = new Date();
      const cmd: Command = {
        commandId: `cmd-${this.n}`,
        deviceId,
        dps: input.dps,
        status: this.initialCommandStatus,
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + (input.ttlS ?? 300) * 1000),
      };
      this.commandMap.set(cmd.commandId, cmd);
      return Promise.resolve(cmd);
    },
    get: (commandId) => {
      this.check('getCommand');
      const c = this.commandMap.get(commandId);
      return c
        ? Promise.resolve(c)
        : Promise.reject(
            new OvenbirdNotFoundError(404, 'not_found', 'not found'),
          );
    },
    waitForAck: () => Promise.reject(new Error('no implementado')),
  };

  readonly embed: OvenbirdClientLike['embed'] = {
    createToken: (input) => {
      this.check('embed');
      this.embedRequests.push(input);
      return Promise.resolve({
        token: `embed-${input.deviceIds.join(',')}`,
        expiresAt: new Date(Date.now() + (input.ttlS ?? 900) * 1000),
      });
    },
  };
}
