import type { Contact, Device, Motorcycle, Ride, Rider } from './types';

// The admin entry point loads these libraries through CDN scripts in admin.html.
interface ServiceError { message: string; context?: unknown }
interface Result<T> { data: T | null; error: ServiceError | null }
interface Query<T> extends PromiseLike<Result<T[]>> {
  eq(column: string, value: unknown): Query<T>;
  single(): Promise<Result<T>>;
}
interface Tables {
  users: Rider;
  motorcycles: Motorcycle;
  ride_history: Ride;
  devices: Device;
  emergency_contacts: Contact;
}
interface Session { access_token: string }
interface SupabaseClient {
  from(table: 'audit_logs'): {
    select(columns: string): Query<Record<string, unknown>>;
    insert(value: Record<string, unknown>): Query<Record<string, unknown>> & {
      select(columns: string): Query<Record<string, unknown>>;
    };
  };
  from<K extends keyof Tables>(table: K): { select(columns: string): Query<Tables[K]> };
  auth: {
    getUser(): Promise<{ data: { user: { id: string; email?: string } | null }; error: ServiceError | null }>;
    signInWithPassword(credentials: { email: string; password: string }): Promise<{
      data: { user: { email?: string } | null; session: Session | null };
      error: ServiceError | null;
    }>;
    signOut(): Promise<unknown>;
    getSession(): Promise<{ data: { session: Session | null }; error: ServiceError | null }>;
  };
  functions: {
    invoke(name: string, options: { body: Record<string, unknown>; headers: Record<string, string> }): Promise<Result<{ error?: string; user?: { id: string } }>>;
  };
}
interface PdfDocument {
  text(text: string, x: number, y: number): void;
  autoTable(options: { startY: number; head: string[][]; body: string[][] }): void;
  save(filename: string): void;
}
interface Workbook { SheetNames: string[]; Sheets: Record<string, unknown> }

declare global {
  interface Window {
    supabase: { createClient(url: string, key: string): SupabaseClient };
    jspdf?: { jsPDF: new () => PdfDocument };
    XLSX?: {
      utils: {
        json_to_sheet(rows: Record<string, unknown>[]): Record<string, unknown>;
        book_new(): Workbook;
        book_append_sheet(workbook: Workbook, sheet: Record<string, unknown>, name: string): void;
      };
      writeFile(workbook: Workbook, filename: string): void;
    };
  }
}
