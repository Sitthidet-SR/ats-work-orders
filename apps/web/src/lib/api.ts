import type { Person } from '@ats/types';
let token: string | null = null;
let refreshing: Promise<{ accessToken: string; user: Person }> | null = null;
export const baseUrl = () => {
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (!value) throw new Error('ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
  return value.replace(/\/$/, '');
};
export function setToken(value: string | null) {
  token = value;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: string[] = [],
  ) {
    super(message);
  }
}
async function decode<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok || body.success === false)
    throw new ApiError(
      body.error?.message ?? 'เชื่อมต่อระบบไม่สำเร็จ',
      response.status,
      body.error?.details ?? [],
    );
  return body.data as T;
}
export async function refreshSession() {
  if (!refreshing)
    refreshing = fetch(`${baseUrl()}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((r) => decode<{ accessToken: string; user: Person }>(r))
      .then((result) => {
        token = result.accessToken;
        return result;
      })
      .finally(() => {
        refreshing = null;
      });
  return refreshing;
}
export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  const response = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    try {
      await refreshSession();
    } catch {
      setToken(null);
      if (typeof window !== 'undefined') window.location.assign('/login');
      throw new ApiError('กรุณาเข้าสู่ระบบใหม่', 401);
    }
    return api<T>(path, options, false);
  }
  return decode<T>(response);
}
export async function pdfBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  const request = () =>
    fetch(`${baseUrl()}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      credentials: 'include',
    });
  let response = await request();
  if (response.status === 401) {
    await refreshSession();
    response = await request();
  }
  if (!response.ok) await decode(response);
  return response.blob();
}
export async function openArchivedPdf(
  id: string,
  archiveId: string,
  fileName: string,
  download = false,
) {
  const target = download ? null : window.open('about:blank', '_blank');
  try {
    const blob = await pdfBlob(`/work-orders/${id}/pdf-archives/${archiveId}`);
    const url = URL.createObjectURL(blob);
    if (target) target.location.href = url;
    else {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    target?.close();
    throw error;
  }
}
export async function downloadWorkOrderPdf(id: string, documentNo: string) {
  // The print endpoint saves the immutable archive and returns its PDF in the same request.
  const blob = await pdfBlob(`/work-orders/${id}/print`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${documentNo}.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function openPdf(id: string, print = false) {
  // Open synchronously to keep the browser popup permission from the click event.
  const target = print ? window.open('about:blank', '_blank') : null;
  try {
    const blob = await pdfBlob(`/work-orders/${id}/${print ? 'print' : 'pdf'}`);
    const url = URL.createObjectURL(blob);
    if (print && target) {
      target.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = `work-order-${id}.pdf`;
      a.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    target?.close();
    throw error;
  }
}
