type BackupRow = Record<string, unknown>;
export async function createBackup(read: (table: string, columns?: string) => Promise<BackupRow[]>) {
  const [users, rides, contacts] = await Promise.all([
    read('users', 'id, name, email, role, status, created_at, updated_at'),
    read('ride_history'),
    read('emergency_contacts'),
  ]);
  // Preserve the existing export format and contact-phone masking.
  const backup = {
    users, rides,
    emergency_contacts: contacts.map(contact => ({ ...contact, ...(typeof contact.phone_number === 'string' && contact.phone_number ? {
      phone_number: contact.phone_number.substring(0, 3) + '****' + contact.phone_number.substring(contact.phone_number.length - 4),
    } : {}) })),
    exported_at: new Date().toISOString(),
  };
  return { backup, filename: `MotoLock_Database_Backup_${backup.exported_at.replace(/[:.]/g, '-')}.json` };
}
