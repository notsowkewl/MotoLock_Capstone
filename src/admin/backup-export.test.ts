import { afterEach, expect, it, vi } from 'vitest';
import { createBackup } from './backup-export';

afterEach(() => vi.useRealTimers());

it('fetches fresh data for each export and includes matching timestamps in the file and filename', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-27T14:00:00Z'));
  let version = 1;
  const contact = { id: 1, phone_number: '09171234567' };
  const read = vi.fn(async (table: string) => table === 'emergency_contacts' ? [contact] : [{ id: version }]);
  const first = await createBackup(read);
  version = 2;
  vi.setSystemTime(new Date('2026-09-27T14:01:00Z'));
  const second = await createBackup(read);
  expect(read).toHaveBeenCalledTimes(6);
  expect(read).toHaveBeenCalledWith('users', 'id, name, email, role, status, created_at, updated_at');
  expect(first.backup.users[0].id).toBe(1);
  expect(second.backup.users[0].id).toBe(2);
  expect(second.backup.exported_at).toBe('2026-09-27T14:01:00.000Z');
  expect(second.filename).toBe('MotoLock_Database_Backup_2026-09-27T14-01-00-000Z.json');
  expect(second.filename).not.toBe(first.filename);
  expect(second.backup.emergency_contacts[0].phone_number).toBe('091****4567');
  expect(contact.phone_number).toBe('09171234567');
});

it('fails instead of generating an incomplete backup when a table cannot be read', async () => {
  await expect(createBackup(async table => {
    if (table === 'ride_history') throw new Error('Database unavailable');
    return [];
  })).rejects.toThrow('Database unavailable');
});
