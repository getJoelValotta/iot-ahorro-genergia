import { OvenbirdGateway } from '../ovenbird/ovenbird.gateway';
import { PetsService } from '../pets/pets.service';
import { FakeOvenbird } from '../testing/fake-ovenbird';
import {
  InMemoryPairingRepository,
  InMemoryPetsRepository,
} from '../testing/in-memory-repositories';
import { DevicesService } from './devices.service';

describe('DevicesService (vínculo con Ovenbird simulado)', () => {
  let ovenbird: FakeOvenbird;
  let pets: InMemoryPetsRepository;
  let pairing: InMemoryPairingRepository;
  let service: DevicesService;
  const page = { page: 1, limit: 20 };

  beforeEach(() => {
    ovenbird = new FakeOvenbird();
    pets = new InMemoryPetsRepository();
    pairing = new InMemoryPairingRepository();
    service = new DevicesService(
      new OvenbirdGateway(ovenbird),
      pairing,
      pets,
      new PetsService(pets),
    );
  });

  const appear = async (userId: string, deviceId: string) => {
    await service.createPairingCode(userId);
    ovenbird.addDevice({ deviceId, createdAt: new Date() });
  };

  it('el código abre una ventana de 10 minutos para el usuario', async () => {
    const { code, expiresAt } = await service.createPairingCode('u1');
    const [session] = await pairing.listByUser('u1');
    expect(session.code).toBe(code);
    expect(session.expiresAt.toISOString()).toBe(expiresAt);
  });

  it('un dispositivo creado fuera de la ventana no es visible', async () => {
    await service.createPairingCode('u1');
    ovenbird.addDevice({
      deviceId: 'tarde',
      createdAt: new Date(Date.now() + 20 * 60_000),
    });
    ovenbird.addDevice({
      deviceId: 'temprano',
      createdAt: new Date(Date.now() - 20 * 60_000),
    });
    expect((await service.list('u1', page)).data).toEqual([]);
  });

  it('vincula, es idempotente y rechaza conflictos', async () => {
    const a = await pets.create('u1', { name: 'A', species: 'dog' });
    const b = await pets.create('u1', { name: 'B', species: 'dog' });
    await appear('u1', 'dev');
    await appear('u1', 'dev2');

    expect((await service.link('u1', a.id, 'dev')).deviceId).toBe('dev');
    expect((await service.link('u1', a.id, 'dev')).deviceId).toBe('dev');
    await expect(service.link('u1', b.id, 'dev')).rejects.toMatchObject({
      code: 'DEVICE_ALREADY_LINKED',
    });
    await expect(service.link('u1', a.id, 'dev2')).rejects.toMatchObject({
      code: 'PET_ALREADY_HAS_DEVICE',
    });
  });

  it('si la base detecta la carrera, responde DEVICE_ALREADY_LINKED', async () => {
    const a = await pets.create('u1', { name: 'A', species: 'dog' });
    const b = await pets.create('u1', { name: 'B', species: 'dog' });
    await appear('u1', 'dev');
    // Simula otro pedido que vinculó 'dev' después de la verificación previa.
    jest.spyOn(pets, 'findByDeviceIds').mockResolvedValueOnce([]);
    await pets.update('u1', b.id, { deviceId: 'dev' });
    await expect(service.link('u1', a.id, 'dev')).rejects.toMatchObject({
      code: 'DEVICE_ALREADY_LINKED',
    });
  });

  it('desvincular deja el collar libre y lo muestra con petId null', async () => {
    const a = await pets.create('u1', { name: 'A', species: 'dog' });
    await appear('u1', 'dev');
    await service.link('u1', a.id, 'dev');
    expect((await service.list('u1', page)).data[0].petId).toBe(a.id);
    await service.unlink('u1', a.id);
    expect((await service.list('u1', page)).data[0].petId).toBeNull();
  });

  it('los errores del SDK salen traducidos', async () => {
    ovenbird.failWith(new Error('ECONNRESET'));
    await expect(service.createPairingCode('u1')).rejects.toMatchObject({
      status: 503,
      code: 'OVENBIRD_UNAVAILABLE',
    });
    expect(await pairing.listByUser('u1')).toEqual([]);
  });
});
