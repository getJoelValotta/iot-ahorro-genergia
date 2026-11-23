/** Filas de la base tal como las usan los servicios (independientes de Supabase). */

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Species = 'dog' | 'cat' | 'other';
export type PowerMode = 'normal' | 'saving';
export type CommandStatus = 'none' | 'pending' | 'confirmed' | 'failed';

export type PetRecord = {
  id: string;
  ownerId: string;
  name: string;
  species: Species;
  breed: string | null;
  /** `YYYY-MM-DD` */
  birthDate: string | null;
  photoUrl: string | null;
  deviceId: string | null;
  powerMode: PowerMode;
  powerCommandId: string | null;
  powerCommandStatus: CommandStatus;
  powerRequestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Campos que se pueden cambiar de una mascota (incluye vínculo y estado de energía). */
export type PetPatch = Partial<
  Pick<
    PetRecord,
    | 'name'
    | 'species'
    | 'breed'
    | 'birthDate'
    | 'photoUrl'
    | 'deviceId'
    | 'powerMode'
    | 'powerCommandId'
    | 'powerCommandStatus'
    | 'powerRequestedAt'
  >
>;

export type NewPet = Pick<PetRecord, 'name' | 'species'> &
  Partial<Pick<PetRecord, 'breed' | 'birthDate' | 'photoUrl'>>;

export type PairingSessionRecord = {
  id: string;
  userId: string;
  code: string;
  expiresAt: Date;
  createdAt: Date;
};

/** El email ya existe (unicidad en la base). */
export class EmailTakenError extends Error {
  constructor() {
    super('email taken');
    this.name = 'EmailTakenError';
  }
}

/** El dispositivo ya está en otra mascota (unicidad de `pets.device_id`). */
export class DeviceTakenError extends Error {
  constructor() {
    super('device taken');
    this.name = 'DeviceTakenError';
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un id que no es UUID no puede existir: se trata como "no encontrado". */
export const isUuid = (id: string) => UUID_RE.test(id);
