import { InMemoryPetsRepository } from '../testing/in-memory-repositories';
import { PetsService } from './pets.service';

describe('PetsService', () => {
  let repo: InMemoryPetsRepository;
  let service: PetsService;

  beforeEach(() => {
    repo = new InMemoryPetsRepository();
    service = new PetsService(repo);
  });

  it('crea con opcionales en null y deviceId null', async () => {
    const pet = await service.create('u1', { name: 'Rex', species: 'dog' });
    expect(pet).toMatchObject({
      breed: null,
      birthDate: null,
      photoUrl: null,
      deviceId: null,
    });
  });

  it('pagina con offset y total', async () => {
    for (let i = 0; i < 7; i++)
      await service.create('u1', { name: `P${i}`, species: 'cat' });
    const page = await service.list('u1', { page: 2, limit: 3 });
    expect(page.meta).toEqual({ page: 2, limit: 3, total: 7 });
    expect(page.data.map((p) => p.name)).toEqual(['P3', 'P4', 'P5']);
  });

  it('una mascota ajena da PET_NOT_FOUND en get, update y remove', async () => {
    const pet = await service.create('owner', { name: 'Rex', species: 'dog' });
    await expect(service.get('intruso', pet.id)).rejects.toMatchObject({
      code: 'PET_NOT_FOUND',
    });
    await expect(
      service.update('intruso', pet.id, { name: 'X' }),
    ).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.remove('intruso', pet.id)).rejects.toMatchObject({
      status: 404,
    });
    expect(repo.rows.has(pet.id)).toBe(true);
  });

  it('PATCH parcial: lo ausente no cambia y null borra el opcional', async () => {
    const pet = await service.create('u1', {
      name: 'Rex',
      species: 'dog',
      breed: 'Galgo',
    });
    const updated = await service.update('u1', pet.id, { breed: null });
    expect(updated).toMatchObject({ name: 'Rex', species: 'dog', breed: null });
  });

  it('al borrar libera el collar antes', async () => {
    const pet = await service.create('u1', { name: 'Rex', species: 'dog' });
    await repo.update('u1', pet.id, { deviceId: 'dev-1' });
    const spy = jest.spyOn(repo, 'update');
    await service.remove('u1', pet.id);
    expect(spy).toHaveBeenCalledWith('u1', pet.id, { deviceId: null });
    expect(await repo.findByDeviceIds(['dev-1'])).toEqual([]);
  });
});
